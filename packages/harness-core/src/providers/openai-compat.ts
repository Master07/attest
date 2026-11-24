// OpenAI-compatible Chat Completions judge provider (e.g. OpenRouter).
//
// The caller passes its own base URL and API key in, so this package never
// reads product environment variables. Only web-standard APIs are used
// (fetch, URL, AbortController, setTimeout), so this file has no runtime-only imports.

import { createBudget } from "../budget.js";

export interface OpenAICompatImage {
  label: string;
  dataUrl: string;
}

export interface OpenAICompatJudgeRequest {
  model: string;
  instructions: string;
  task: string;
  criteriaIds: string[];
  images: OpenAICompatImage[];
}

export interface OpenAICompatVote {
  id: string;
  result: "pass" | "fail";
  reason: string;
}

export type OpenAICompatJudgeOutcome = { votes: OpenAICompatVote[] } | { vote: null; error: string };

export interface OpenAICompatProviderOptions {
  baseUrl: string;
  apiKey: string;
  /** Per-attempt abort deadline. Must be a positive integer; defaults to 60_000. */
  timeoutMs?: number;
  /** Defaults to globalThis.fetch; dependency-injected in tests. No environment access. */
  fetch?: typeof fetch;
}

export interface OpenAICompatProvider {
  judge(request: OpenAICompatJudgeRequest): Promise<OpenAICompatJudgeOutcome>;
}

const DEFAULT_TIMEOUT_MS = 60_000;
const MAX_IMAGES = 8;
const REDACTED = "[redacted]";

/** Parse and validate the base URL, returning the origin and path for endpoint building. */
function parseBaseUrl(baseUrl: string): { origin: string; path: string } {
  let url: URL;
  try {
    url = new URL(baseUrl);
  } catch {
    throw new Error("openai-compat: invalid base URL");
  }
  const httpLoopback = url.protocol === "http:" && url.hostname === "127.0.0.1";
  if (url.protocol !== "https:" && !httpLoopback) {
    throw new Error("openai-compat: base URL must use https: (http: is allowed only for 127.0.0.1)");
  }
  if (url.username !== "" || url.password !== "" || url.search !== "" || url.hash !== "") {
    throw new Error("openai-compat: base URL must not contain credentials, a query or a fragment");
  }
  return { origin: url.origin, path: url.pathname.replace(/\/+$/, "") };
}

/** One POST attempt with its own abort deadline. Throws sanitized errors only. */
async function postOnce(
  url: string,
  apiKey: string,
  body: string,
  timeoutMs: number,
  fetchImpl: typeof fetch | undefined,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await (fetchImpl ?? globalThis.fetch)(url, {
      method: "POST",
      redirect: "error",
      signal: controller.signal,
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body,
    });
  } catch {
    // The original rejection (including any abort error) is dropped so response
    // bodies and fetch messages can never carry the key into an error.
    if (controller.signal.aborted) {
      throw new Error(`openai-compat request timed out after ${timeoutMs} ms`);
    }
    throw new Error("openai-compat request failed");
  } finally {
    // A completed attempt must never abort late.
    clearTimeout(timer);
  }
}

function noChoiceText(): OpenAICompatJudgeOutcome {
  return { vote: null, error: "openai-compat judge returned no choice text" };
}

/** Map a 2xx Chat Completions body to votes or a no-vote result. Never throws. */
function parseSuccess(parsed: unknown, criteriaIds: string[], apiKey: string): OpenAICompatJudgeOutcome {
  const choices = (parsed as { choices?: unknown } | null | undefined)?.choices;
  const first = Array.isArray(choices) && choices.length > 0 ? choices[0] : undefined;
  const content = (first as { message?: { content?: unknown } } | undefined)?.message?.content;
  if (typeof content !== "string" || content === "") return noChoiceText();
  // A bare JSON body parses as-is; prose/code-fence wrapping falls back to the
  // same first-`{`-to-last-`}` extraction as parseJudgeReply.
  let reply: unknown;
  try {
    reply = JSON.parse(content);
  } catch {
    const start = content.indexOf("{");
    const end = content.lastIndexOf("}");
    if (start === -1 || end <= start) {
      return { vote: null, error: "openai-compat judge reply contained no JSON" };
    }
    try {
      reply = JSON.parse(content.slice(start, end + 1));
    } catch {
      return { vote: null, error: "openai-compat judge reply JSON did not parse" };
    }
  }
  const criteria = (reply as { criteria?: unknown } | null | undefined)?.criteria;
  if (!Array.isArray(criteria)) {
    return { vote: null, error: 'openai-compat judge reply has no "criteria" array' };
  }
  const known = new Set(criteriaIds);
  const votes: OpenAICompatVote[] = [];
  for (const item of criteria) {
    const vote = item as Record<string, unknown>;
    if (typeof vote?.["id"] !== "string" || !known.has(vote["id"] as string)) continue;
    if (vote["result"] !== "pass" && vote["result"] !== "fail") continue;
    const reason = typeof vote["reason"] === "string" ? vote["reason"].split(apiKey).join(REDACTED) : "";
    votes.push({ id: vote["id"], result: vote["result"], reason });
  }
  return { votes };
}

export function createOpenAICompatProvider(options: OpenAICompatProviderOptions): OpenAICompatProvider {
  const { baseUrl, apiKey } = options;
  if (!apiKey) throw new Error("openai-compat: apiKey is required");
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  if (!Number.isInteger(timeoutMs) || timeoutMs <= 0) {
    throw new Error("openai-compat: timeoutMs must be a positive integer");
  }
  const endpoint = parseBaseUrl(baseUrl);
  const url = `${endpoint.origin}${endpoint.path}/chat/completions`;

  return {
    async judge(request: OpenAICompatJudgeRequest): Promise<OpenAICompatJudgeOutcome> {
      if (request.images.length > MAX_IMAGES) {
        throw new Error("openai-compat: at most 8 images are allowed");
      }
      const body = JSON.stringify({
        model: request.model,
        messages: [
          { role: "system", content: request.instructions },
          {
            role: "user",
            content: [
              { type: "text", text: request.task },
              ...request.images.flatMap((image) => [
                { type: "text", text: image.label },
                { type: "image_url", image_url: { url: image.dataUrl } },
              ]),
            ],
          },
        ],
      });
      // One budgeted transient retry: a 5xx is retried once, anything else throws.
      const budget = createBudget({ maxSteps: 0, maxRetries: 0, transientRetry: 1 });
      for (;;) {
        const response = await postOnce(url, apiKey, body, timeoutMs, options.fetch);
        if (response.ok) {
          let parsed: unknown;
          try {
            parsed = JSON.parse(await response.text());
          } catch {
            return { vote: null, error: "openai-compat response JSON did not parse" };
          }
          return parseSuccess(parsed, request.criteriaIds, apiKey);
        }
        const status = response.status;
        if (status >= 500 && budget.useTransientRetry()) continue;
        throw new Error(`openai-compat HTTP ${status}`);
      }
    },
  };
}
