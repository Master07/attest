// Minimal client for the Responses API (Meta Model API, and OpenAI-compatible providers such as Baseten).
import { appendFileSync, readFileSync } from "node:fs";

export interface ApiOutputItem {
  type?: string;
  call_id?: string;
  actions?: unknown[];
  pending_safety_checks?: { id: string; code: string; message: string }[];
  content?: { type?: string; text?: string }[];
}

export interface ApiResponse {
  id?: string;
  status?: string;
  output?: ApiOutputItem[];
  output_text?: string;
  incomplete_details?: { reason?: string };
}

export class ApiError extends Error {
  constructor(message: string, readonly status: number | null, readonly body: string) {
    super(message);
    this.name = "ApiError";
  }
}

// Record / replay (ARCHITECTURE §11). ATTEST_RECORD=<file> appends every successful response to a
// JSONL "cassette"; ATTEST_REPLAY=<file> answers requests from it instead of calling the API, in the
// order they were recorded, per model. The browser, checks and receipt still run for real, so a
// replay shows the same model decisions being re-applied to a live app — it is marked as a replay.

// `ms` is how long the live call took. Replay waits that long too: timing matters — e.g. a widget that
// appears 250 ms after load only covers the button if the click comes after "thinking time".
interface CassetteLine { seq: number; model: string; ms?: number; response: ApiResponse }
let replayQueues: Map<string, CassetteLine[]> | null = null;
let recordSeq = 0;
const REPLAY_DEFAULT_MS = 1500;   // for cassettes recorded before `ms` existed
const REPLAY_MAX_MS = 10_000;

function modelOf(body: unknown): string {
  return typeof body === "object" && body !== null && typeof (body as { model?: unknown }).model === "string"
    ? (body as { model: string }).model
    : "unknown";
}

async function nextReplay(path: string, model: string): Promise<ApiResponse> {
  if (replayQueues === null) {
    replayQueues = new Map();
    for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
      if (!line.trim()) continue;
      const entry = JSON.parse(line) as CassetteLine;
      const queue = replayQueues.get(entry.model) ?? [];
      queue.push(entry);
      replayQueues.set(entry.model, queue);
    }
  }
  const entry = replayQueues.get(model)?.shift();
  // 4xx-style status: a missing recording is not transient, so it is never retried.
  if (entry === undefined) throw new ApiError(`replay cassette has no more responses for ${model}`, 499, "");
  await new Promise((r) => setTimeout(r, Math.min(entry.ms ?? REPLAY_DEFAULT_MS, REPLAY_MAX_MS)));
  return entry.response;
}

export function isReplaying(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.ATTEST_REPLAY);
}

/** POST <baseUrl>/responses, retrying network errors and 5xx up to 3 times with backoff. */
export async function postResponses(baseUrl: string, apiKey: string, body: unknown): Promise<ApiResponse> {
  const model = modelOf(body);
  const replay = process.env.ATTEST_REPLAY;
  if (replay) return nextReplay(replay, model);

  const started = Date.now();
  const response = await postLive(baseUrl, apiKey, body);
  const record = process.env.ATTEST_RECORD;
  if (record) {
    const line: CassetteLine = { seq: ++recordSeq, model, ms: Date.now() - started, response };
    appendFileSync(record, `${JSON.stringify(line)}\n`);
  }
  return response;
}

async function postLive(baseUrl: string, apiKey: string, body: unknown): Promise<ApiResponse> {
  const send = async (): Promise<ApiResponse> => {
    let res: Response;
    try {
      res = await fetch(`${baseUrl.replace(/\/+$/, "")}/responses`, {
        method: "POST",
        headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(120_000),
      });
    } catch (err) {
      throw new ApiError(`request failed: ${err instanceof Error ? err.message : String(err)}`, null, "");
    }
    const text = await res.text();
    if (!res.ok) throw new ApiError(`HTTP ${res.status}`, res.status, text.slice(0, 2000));
    return JSON.parse(text) as ApiResponse;
  };

  // Transient failures (network, 5xx — e.g. the 500s and 503 "persistence service error" seen in live runs)
  // are retried with backoff. 4xx means the request itself is wrong, so it is never retried.
  const backoffMs = [1000, 3000, 8000];
  for (let attempt = 0; ; attempt++) {
    try {
      return await send();
    } catch (err) {
      const transient = err instanceof ApiError && (err.status === null || err.status >= 500);
      const wait = backoffMs[attempt];
      if (!transient || wait === undefined) throw err;
      await new Promise((r) => setTimeout(r, wait));
    }
  }
}

/** All output_text from a response, in order. */
export function outputText(response: ApiResponse): string {
  if (typeof response.output_text === "string" && response.output_text) return response.output_text;
  return (response.output ?? [])
    .flatMap((item) => item.content ?? [])
    .filter((part) => part.type === "output_text" && typeof part.text === "string")
    .map((part) => part.text)
    .join("\n");
}

export const pngDataUrl = (png: Buffer): string => `data:image/png;base64,${png.toString("base64")}`;
