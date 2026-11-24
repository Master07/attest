// Cassette: record a live run once, then replay it with no API calls and no keys.
// The JSONL file format is fixed: one {"seq","model","ms","response"} object per line.
// Replay answers each model's calls in the order they were recorded; a call with no
// recording left throws instead of falling through to the network.
//
// File access is supplied by the caller (the shared file backing re-exported from
// the core index, or an in-memory fake in tests), so this file has no runtime
// imports and never touches the disk on its own.
export interface CassetteIo {
  readText(path: string): string;
  appendText(path: string, text: string): void;
}

export interface CassetteLine {
  seq: number;
  model: string;
  ms?: number;
  response: unknown;
}

export class CassetteExhaustedError extends Error {
  readonly path: string;
  readonly model: string;

  constructor(path: string, model: string) {
    super(`cassette ${path} has no more responses for model "${model}"`);
    this.name = "CassetteExhaustedError";
    this.path = path;
    this.model = model;
  }
}

export interface ReplayOptions {
  /** Sleep the recorded `ms` before answering, as live timing matters. Default true. */
  wait?: boolean;
  /** Wait used for lines recorded before `ms` existed. Default 1500. */
  defaultMs?: number;
  /** Upper bound on a single wait. Default 10_000. */
  maxMs?: number;
  sleep?: (ms: number) => Promise<void>;
}

const REPLAY_DEFAULT_MS = 1500;   // for cassettes recorded before `ms` existed
const REPLAY_MAX_MS = 10_000;

export class Cassette {
  private recordSeq = 0;

  private constructor(
    private readonly path: string,
    private readonly io: CassetteIo,
    private readonly queues: Map<string, CassetteLine[]> | null,
    private readonly replayOpts: Required<Omit<ReplayOptions, "sleep">> & Pick<ReplayOptions, "sleep">,
  ) {}

  /**
   * Open an empty replay cassette. The caller assigns it as the process-wide
   * state *before* loading, so a failed load still leaves an initialised
   * (empty or partial) queue behind — exactly like the pre-extraction code,
   * which assigned its queue map before reading and parsing the file.
   */
  static emptyReplay(path: string, io: CassetteIo, opts: ReplayOptions = {}): Cassette {
    return new Cassette(path, io, new Map<string, CassetteLine[]>(), {
      wait: opts.wait ?? true,
      defaultMs: opts.defaultMs ?? REPLAY_DEFAULT_MS,
      maxMs: opts.maxMs ?? REPLAY_MAX_MS,
      ...(opts.sleep !== undefined ? { sleep: opts.sleep } : {}),
    });
  }

  /**
   * Read this cassette's file and parse its lines into the queues. A missing
   * file throws with nothing queued; bad JSON throws with the entries parsed
   * so far kept. Single-shot: calling it twice queues every line twice.
   */
  load(): void {
    if (this.queues === null) throw new Error(`cassette ${this.path} was opened for recording, not replay`);
    for (const line of this.io.readText(this.path).split(/\r?\n/)) {
      if (!line.trim()) continue;
      const entry = JSON.parse(line) as CassetteLine;
      const queue = this.queues.get(entry.model) ?? [];
      queue.push(entry);
      this.queues.set(entry.model, queue);
    }
  }

  /** Open a cassette for replay: every recorded call, per model, in recorded order. */
  static replay(path: string, io: CassetteIo, opts: ReplayOptions = {}): Cassette {
    const cassette = Cassette.emptyReplay(path, io, opts);
    cassette.load();
    return cassette;
  }

  /** Open a cassette for recording: each appended response becomes one line. */
  static record(path: string, io: CassetteIo): Cassette {
    return new Cassette(path, io, null, { wait: false, defaultMs: REPLAY_DEFAULT_MS, maxMs: REPLAY_MAX_MS });
  }

  /** The next recorded response for `model`. Throws CassetteExhaustedError when none is left. */
  async nextResponse(model: string): Promise<unknown> {
    if (this.queues === null) throw new Error(`cassette ${this.path} was opened for recording, not replay`);
    const entry = this.queues.get(model)?.shift();
    // A missing recording is not transient, so it is never retried.
    if (entry === undefined) throw new CassetteExhaustedError(this.path, model);
    if (this.replayOpts.wait) {
      const sleep = this.replayOpts.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
      await sleep(Math.min(entry.ms ?? this.replayOpts.defaultMs, this.replayOpts.maxMs));
    }
    return entry.response;
  }

  /** Append one recorded response. Only valid on a cassette opened with record(). */
  appendResponse(model: string, response: unknown, ms?: number): void {
    if (this.queues !== null) throw new Error(`cassette ${this.path} was opened for replay, not recording`);
    const line: CassetteLine = { seq: ++this.recordSeq, model, ms, response };
    this.io.appendText(this.path, `${JSON.stringify(line)}\n`);
  }
}
