// Append-only event log (ARCHITECTURE §9). Every line commits to the previous one,
// so editing, deleting or inserting a line breaks the chain at that line.
//
// Platform I/O and hashing go through the adapter; this file itself only uses
// web-standard types so the log format can be verified anywhere.
import {
  appendTextFile,
  ensureDirFor,
  readTextFile,
  sha256Hex,
  utf8Bytes,
  writeNewTextFile,
} from "./adapters/node.js";

export interface LogEntry {
  seq: number;
  ts: string;
  phase: string | null;
  kind: string;
  data: Record<string, unknown>;
  prev: string;
  hash: string;
}

export const GENESIS: string = `sha256:${"0".repeat(64)}`;

function fail(reason: string): never {
  throw new Error(`canonicalJson: ${reason}`);
}

function serialize(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) fail(`non-finite number ${String(value)}`);
    return JSON.stringify(value);
  }
  if (
    typeof value === "undefined" ||
    typeof value === "bigint" ||
    typeof value === "function" ||
    typeof value === "symbol"
  ) {
    fail(`${typeof value} is not a JSON value`);
  }
  if (Array.isArray(value)) {
    const items: string[] = [];
    for (let index = 0; index < value.length; index++) items.push(serialize(value[index]));
    return `[${items.join(",")}]`;
  }

  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    fail("only plain objects are JSON values");
  }

  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  const body = keys
    .map((key) => `${JSON.stringify(key)}:${serialize(record[key])}`)
    .join(",");
  return `{${body}}`;
}

/** JSON with object keys sorted recursively and no whitespace. Throws on values JSON cannot carry. */
export function canonicalJson(value: unknown): string {
  return serialize(value);
}

/** The exact bytes a canonical value is signed and hashed as. */
export function canonicalBytes(value: unknown): Uint8Array {
  return utf8Bytes(canonicalJson(value));
}

/** Hash of one event chained after prev, using the existing algorithm. */
export function hashEvent(
  prev: string,
  event: { seq: number; ts: string; phase: string | null; kind: string; data: Record<string, unknown> },
): string {
  const body = {
    seq: event.seq,
    ts: event.ts,
    phase: event.phase,
    kind: event.kind,
    data: event.data,
    prev,
  };
  return `sha256:${sha256Hex(canonicalBytes(body))}`;
}

export function hashEntry(entry: Omit<LogEntry, "hash">): string {
  return hashEvent(entry.prev, entry);
}

export class EventLog {
  private entries = 0;
  private lastHash = GENESIS;

  private constructor(private readonly file: string) {}

  /** Creates a new log file (and parent directories). Throws if the file already exists. */
  static create(path: string): EventLog {
    ensureDirFor(path);
    writeNewTextFile(path, "");
    return new EventLog(path);
  }

  /** Appends one entry and writes it to disk before returning. */
  append(kind: string, data: Record<string, unknown> = {}, phase: string | null = null): LogEntry {
    const body: Omit<LogEntry, "hash"> = {
      seq: this.entries + 1,
      ts: new Date().toISOString(),
      phase,
      kind,
      data,
      prev: this.lastHash,
    };
    const hash = hashEntry(body);
    const entry: LogEntry = { ...body, hash };

    appendTextFile(this.file, `${JSON.stringify(entry)}\n`);

    this.entries = body.seq;
    this.lastHash = hash;
    return entry;
  }

  /** Current head hash. Stays a getter: Attest reads it as a property. */
  get head(): string {
    return this.lastHash;
  }

  /** Reads and parses every entry currently in the log file. */
  read(): LogEntry[] {
    const text = readTextFile(this.file);
    const lines = text.split(/\r?\n/);
    if (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
    return lines.map((line) => JSON.parse(line) as LogEntry);
  }

  get length(): number {
    return this.entries;
  }

  get path(): string {
    return this.file;
  }
}

export interface ChainCheck {
  ok: boolean;
  entries: number;
  head: string;
  error?: { line: number; reason: string };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

interface CheckedFields {
  seq: number;
  ts: string;
  phase: string | null;
  kind: string;
  data: Record<string, unknown>;
  prev: string;
  hash: string;
}

function checkedFields(parsed: unknown): { fields: CheckedFields } | { reason: string } {
  if (!isRecord(parsed)) return { reason: "entry is not a JSON object" };

  const seq = parsed["seq"];
  const ts = parsed["ts"];
  const phase = parsed["phase"];
  const kind = parsed["kind"];
  const data = parsed["data"];
  const prev = parsed["prev"];
  const hash = parsed["hash"];

  if (typeof seq !== "number" || !Number.isInteger(seq)) return { reason: "seq must be an integer" };
  if (typeof ts !== "string") return { reason: "ts must be a string" };
  if (typeof phase !== "string" && phase !== null) return { reason: "phase must be a string or null" };
  if (typeof kind !== "string") return { reason: "kind must be a string" };
  if (!isRecord(data)) return { reason: "data must be an object" };
  if (typeof prev !== "string") return { reason: "prev must be a string" };
  if (typeof hash !== "string") return { reason: "hash must be a string" };

  return { fields: { seq, ts, phase, kind, data, prev, hash } };
}

function checkLines(lines: string[]): ChainCheck {
  let head = GENESIS;
  let entries = 0;

  for (let index = 0; index < lines.length; index++) {
    const line = index + 1;
    const bad = (reason: string): ChainCheck => ({ ok: false, entries, head, error: { line, reason } });

    let parsed: unknown;
    try {
      parsed = JSON.parse(lines[index] ?? "");
    } catch (err) {
      return bad(`invalid JSON: ${err instanceof Error ? err.message : String(err)}`);
    }

    const checked = checkedFields(parsed);
    if ("reason" in checked) return bad(checked.reason);
    const { seq, ts, phase, kind, data, prev, hash } = checked.fields;

    if (seq !== line) return bad(`seq is ${seq}, expected ${line}`);
    if (prev !== head) return bad(`prev is ${prev}, expected ${head}`);

    const expected = hashEntry({ seq, ts, phase, kind, data, prev });
    if (hash !== expected) return bad(`hash is ${hash}, expected ${expected}`);

    head = hash;
    entries = line;
  }

  return { ok: true, entries, head };
}

/** Result of verifying already-parsed events: only whether the chain holds and,
 *  when it does not, the 1-based line Attest reports. */
export interface EventsChainCheck {
  ok: boolean;
  brokenAt?: number;
}

function checkEvents(events: LogEntry[]): EventsChainCheck {
  let head = GENESIS;

  for (let index = 0; index < events.length; index++) {
    const line = index + 1;
    const checked = checkedFields(events[index] as unknown);
    if ("reason" in checked) return { ok: false, brokenAt: line };
    const { seq, ts, phase, kind, data, prev, hash } = checked.fields;

    if (seq !== line || prev !== head) return { ok: false, brokenAt: line };
    if (hash !== hashEntry({ seq, ts, phase, kind, data, prev })) return { ok: false, brokenAt: line };

    head = hash;
  }

  return { ok: true };
}

/** Verifies log text already loaded into memory. */
export function verifyChainText(text: string): ChainCheck {
  const lines = text.split(/\r?\n/);
  if (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
  return checkLines(lines);
}

/** Verifies the log file at a path. Unchanged shape: missing files fail at line 0. */
export function verifyChain(path: string): ChainCheck;
/** Verifies already-parsed events. Reports only whether the chain holds and,
 *  when it does not, the 1-based `brokenAt` line Attest reports. */
export function verifyChain(events: LogEntry[]): EventsChainCheck;
export function verifyChain(input: string | LogEntry[]): ChainCheck | EventsChainCheck {
  if (typeof input !== "string") return checkEvents(input);
  let text: string;
  try {
    text = readTextFile(input);
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    return { ok: false, entries: 0, head: GENESIS, error: { line: 0, reason: `cannot read ${input}: ${reason}` } };
  }
  return verifyChainText(text);
}

/** Path-based chain verification under an explicit name; `verifyChain(path)` keeps working. */
export function verifyChainFile(path: string): ChainCheck {
  return verifyChain(path);
}
