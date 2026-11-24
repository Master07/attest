// Minimal client for the Responses API (Meta Model API, and OpenAI-compatible providers such as Baseten).
import { Cassette, CassetteExhaustedError, withRetries } from "@corbet/harness-core";

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
let replayCassette: Cassette | null = null;
let recordCassette: Cassette | null = null;

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
    replayCassette ??= Cassette.replay(replay);
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
    recordCassette ??= Cassette.record(record);
    recordCassette.appendResponse(model, response, Date.now() - started);
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
  return withRetries(send, {
    backoffMs: [1000, 3000, 8000],
    isTransient: (err) => err instanceof ApiError && (err.status === null || err.status >= 500),
  });
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
