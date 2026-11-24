// Minimal client for the Responses API (Meta Model API, and OpenAI-compatible providers such as Baseten).
import { Cassette, CassetteExhaustedError, createBudget, nodeCassetteIo, withRetries } from "@corbet/harness-core";

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
// appears 250 ms after load only covers the button if the click comes after "thinking" time.
// Attest's production retry policy: network errors and 5xx are retried up to 3
// times with [1000, 3000, 8000]ms backoff; 4xx (including 429) never is. The retry
// limit lives on the budget — the schedule here only sets the delays.
const retryBudget = createBudget({ maxSteps: 0, maxRetries: 3, transientRetry: 0 });
const RETRY_BACKOFF_MS = [1000, 3000, 8000];

// One record sequence counter and one replay queue for the whole process, exactly
// like the pre-extraction code: they are never reset when ATTEST_RECORD or
// ATTEST_REPLAY changes, or when replay is turned off and on again. Only the path
// used for each read or write comes from the environment on every call. The Node
// file backing is passed explicitly (the cassette core itself never imports it).
let replayCassette: Cassette | null = null;
let recordSeq = 0;

function modelOf(body: unknown): string {
  return typeof body === "object" && body !== null && typeof (body as { model?: unknown }).model === "string"
    ? (body as { model: string }).model
    : "unknown";
}

export function isReplaying(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.ATTEST_REPLAY);
}

/** POST <baseUrl>/responses, retrying network errors and 5xx up to 3 times with backoff. */
export async function postResponses(baseUrl: string, apiKey: string, body: unknown): Promise<ApiResponse> {
  const model = modelOf(body);
  const replay = process.env.ATTEST_REPLAY;
  if (replay) {
    // Loaded once, from the first path seen: later changes keep answering from the
    // same queue, which the calls below consume in order.
    if (replayCassette === null) {
      replayCassette = Cassette.replay(replay, nodeCassetteIo);
    }
    try {
      return (await replayCassette.nextResponse(model)) as ApiResponse;
    } catch (err) {
      // 4xx-style status: a missing recording is not transient, so it is never retried.
      if (err instanceof CassetteExhaustedError) {
        throw new ApiError(`replay cassette has no more responses for ${model}`, 499, "");
      }
      throw err;
    }
  }

  const started = Date.now();
  const response = await postLive(baseUrl, apiKey, body);
  const record = process.env.ATTEST_RECORD;
  if (record) {
    nodeCassetteIo.appendText(record, `${JSON.stringify({ seq: ++recordSeq, model, ms: Date.now() - started, response })}\n`);
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
  // The default wait sleeps with setTimeout, so tests fast-forward it with fake timers.
  return withRetries(
    send,
    retryBudget.retryPolicy(
      RETRY_BACKOFF_MS,
      (err) => err instanceof ApiError && (err.status === null || err.status >= 500),
    ),
  );
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
