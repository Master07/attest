import { createHash } from "node:crypto";
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

// Append-only event log (ARCHITECTURE §9). Every line commits to the previous one,
// so editing, deleting or inserting a line breaks the chain at that line.

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

export function hashEntry(entry: Omit<LogEntry, "hash">): string {
  const body = {
    seq: entry.seq,
    ts: entry.ts,
    phase: entry.phase,
    kind: entry.kind,
    data: entry.data,
    prev: entry.prev,
  };
  return `sha256:${createHash("sha256").update(canonicalJson(body), "utf8").digest("hex")}`;
}

export class EventLog {
  private entries = 0;
  private lastHash = GENESIS;

  private constructor(private readonly file: string) {}

  /** Creates a new log file (and parent directories). Throws if the file already exists. */
  static create(path: string): EventLog {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, "", { encoding: "utf8", flag: "wx" });
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

    appendFileSync(this.file, `${JSON.stringify(entry)}\n`, "utf8");

    this.entries = body.seq;
    this.lastHash = hash;
    return entry;
  }

  get head(): string {
    return this.lastHash;
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

export function verifyChain(path: string): ChainCheck {
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    return { ok: false, entries: 0, head: GENESIS, error: { line: 0, reason: `cannot read ${path}: ${reason}` } };
  }

  const lines = text.split(/\r?\n/);
  if (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();

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

    if (!isRecord(parsed)) return bad("entry is not a JSON object");

    const seq = parsed["seq"];
    const ts = parsed["ts"];
    const phase = parsed["phase"];
    const kind = parsed["kind"];
    const data = parsed["data"];
    const prev = parsed["prev"];
    const hash = parsed["hash"];

    if (typeof seq !== "number" || !Number.isInteger(seq)) return bad("seq must be an integer");
    if (typeof ts !== "string") return bad("ts must be a string");
    if (typeof phase !== "string" && phase !== null) return bad("phase must be a string or null");
    if (typeof kind !== "string") return bad("kind must be a string");
    if (!isRecord(data)) return bad("data must be an object");
    if (typeof prev !== "string") return bad("prev must be a string");
    if (typeof hash !== "string") return bad("hash must be a string");

    if (seq !== line) return bad(`seq is ${seq}, expected ${line}`);
    if (prev !== head) return bad(`prev is ${prev}, expected ${head}`);

    const expected = hashEntry({ seq, ts, phase, kind, data, prev });
    if (hash !== expected) return bad(`hash is ${hash}, expected ${expected}`);

    head = hash;
    entries = line;
  }

  return { ok: true, entries, head };
}
