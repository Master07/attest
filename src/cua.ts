import { createHash } from "node:crypto";
import { ApiError, pngDataUrl, postResponses } from "./api.js";
import type { ApiOutputItem, ApiResponse } from "./api.js";
import type { Action, BrowserSession } from "./browser.js";
import type { CriteriaFile } from "./criteria.js";
import { pickRoute, resolveProvider } from "./models.js";
import { buildVerifierPrompt } from "./prompt.js";

// The inner agent loop (ARCHITECTURE §1.2): screenshot → computer_call → execute → repeat,
// on the Meta Responses API `computer` tool. Models propose; this harness executes and records.

export interface SafetyCheck {
  id: string;
  code: string;
  message: string;
}

export interface CuaStep {
  step: number;
  actions: unknown[];          // actions exactly as the model sent them
  errors: string[];            // actions that could not be executed
  safetyChecks: SafetyCheck[];
  screenshotSha256: string;    // screenshot taken after this step's actions
}

export interface CriterionVerdict {
  id: string;
  result: "pass" | "fail";
  evidence_step: number | null;
  observation: string;
}

export interface CuaResult {
  status: "completed" | "step_cap" | "error";
  verdicts: CriterionVerdict[];
  steps: CuaStep[];
  finalText: string;
  model: string;
  promptSha256: string;
  fallbacks: string[];        // e.g. switches to stateless replay after server errors
  error?: string;
}

export interface CuaOptions {
  browser: BrowserSession;
  criteria: CriteriaFile;
  appUrl: string;
  maxSteps: number;
  /** Called with every screenshot, step 0 included, so the caller can store evidence. */
  onScreenshot?: (step: number, png: Buffer) => void | Promise<void>;
  env?: NodeJS.ProcessEnv;
}

const sha256 = (data: Buffer | string): string => createHash("sha256").update(data).digest("hex");
const dataUrl = pngDataUrl;
const post = postResponses;

function isLocalUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return host === "localhost" || host === "127.0.0.1" || host === "[::1]";
  } catch {
    return false;
  }
}


/** Maps one model action to browser actions. Returns null for actions that need no execution. */
function toBrowserActions(raw: unknown): Action[] | null {
  if (typeof raw !== "object" || raw === null) throw new Error(`malformed action: ${JSON.stringify(raw)}`);
  const a = raw as Record<string, unknown>;
  const num = (key: string): number => {
    const v = a[key];
    if (typeof v !== "number") throw new Error(`action ${String(a["type"])}: ${key} must be a number`);
    return v;
  };

  switch (a["type"]) {
    case "click": {
      const button = a["button"] ?? "left";
      if (button === "back") return [{ type: "keypress", keys: ["ALT", "LEFT"] }];
      if (button === "forward") return [{ type: "keypress", keys: ["ALT", "RIGHT"] }];
      const mapped = button === "wheel" ? "middle" : button;
      if (mapped !== "left" && mapped !== "right" && mapped !== "middle") {
        throw new Error(`click: unsupported button ${String(button)}`);
      }
      return [{ type: "click", x: num("x"), y: num("y"), button: mapped }];
    }
    case "double_click":
      return [{ type: "double_click", x: num("x"), y: num("y") }];
    case "move":
      return [{ type: "move", x: num("x"), y: num("y") }];
    case "scroll":
      return [{ type: "scroll", x: num("x"), y: num("y"), scroll_x: num("scroll_x"), scroll_y: num("scroll_y") }];
    case "type":
      if (typeof a["text"] !== "string") throw new Error("type: text must be a string");
      return [{ type: "type", text: a["text"] }];
    case "keypress": {
      const keys = a["keys"];
      if (!Array.isArray(keys) || !keys.every((k) => typeof k === "string")) {
        throw new Error("keypress: keys must be an array of strings");
      }
      return [{ type: "keypress", keys }];
    }
    case "drag": {
      const path = a["path"];
      if (!Array.isArray(path)) throw new Error("drag: path must be an array");
      return [{ type: "drag", path: path as { x: number; y: number }[] }];
    }
    case "wait":
      return [{ type: "wait", ms: 1000 }];
    case "screenshot":
      return null; // a screenshot is taken after every batch anyway
    default:
      throw new Error(`unsupported action type ${String(a["type"])}`);
  }
}

function parseVerdicts(text: string, criteria: CriteriaFile): { verdicts: CriterionVerdict[]; error?: string } {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) return { verdicts: [], error: "final reply contained no JSON object" };

  let parsed: unknown;
  try {
    parsed = JSON.parse(text.slice(start, end + 1));
  } catch (err) {
    return { verdicts: [], error: `final reply JSON did not parse: ${err instanceof Error ? err.message : String(err)}` };
  }

  const list = (parsed as { criteria?: unknown }).criteria;
  if (!Array.isArray(list)) return { verdicts: [], error: 'final reply JSON has no "criteria" array' };

  const known = new Set(criteria.criteria.map((c) => c.id));
  const verdicts: CriterionVerdict[] = [];
  for (const item of list) {
    if (typeof item !== "object" || item === null) continue;
    const v = item as Record<string, unknown>;
    if (typeof v["id"] !== "string" || !known.has(v["id"])) continue;
    if (v["result"] !== "pass" && v["result"] !== "fail") continue;
    verdicts.push({
      id: v["id"],
      result: v["result"],
      evidence_step: typeof v["evidence_step"] === "number" ? v["evidence_step"] : null,
      observation: typeof v["observation"] === "string" ? v["observation"] : "",
    });
  }

  const missing = [...known].filter((id) => !verdicts.some((v) => v.id === id));
  return missing.length > 0
    ? { verdicts, error: `no valid verdict for: ${missing.join(", ")}` }
    : { verdicts };
}

function messageText(output: ApiOutputItem[]): string {
  return output
    .filter((item) => item.type === "message")
    .flatMap((item) => item.content ?? [])
    .filter((part) => part.type === "output_text" && typeof part.text === "string")
    .map((part) => part.text)
    .join("\n")
    .trim();
}

export async function runVerifier(opts: CuaOptions): Promise<CuaResult> {
  const env = opts.env ?? process.env;
  const route = pickRoute("verifier", false, env);
  const { baseUrl, apiKey } = resolveProvider(route.provider, env);
  const prompt = buildVerifierPrompt(opts.criteria, opts.appUrl);

  const steps: CuaStep[] = [];
  const fallbacks: string[] = [];
  const result = (status: CuaResult["status"], extra: Partial<CuaResult> = {}): CuaResult => ({
    status,
    verdicts: [],
    steps,
    finalText: "",
    model: route.model,
    promptSha256: prompt.sha256,
    fallbacks,
    ...extra,
  });

  try {
    let png = await opts.browser.screenshot();
    await opts.onScreenshot?.(0, png);

    const base = { model: route.model, tools: [{ type: "computer" }], instructions: prompt.instructions };
    const firstInput = [
      {
        role: "user",
        content: [
          { type: "input_text", text: prompt.task },
          { type: "input_image", image_url: dataUrl(png) },
        ],
      },
    ];

    const transcript: unknown[] = [...firstInput];
    // ATTEST_CUA_STATELESS=1 replays the full history on every turn (no server-side storage).
    let stateless = env.ATTEST_CUA_STATELESS === "1";

    // truncation:"auto" keeps recent screenshots; if the account doesn't allow it, drop it.
    let truncation: "auto" | undefined = "auto";
    let response: ApiResponse;
    try {
      response = await post(baseUrl, apiKey, { ...base, input: firstInput, truncation });
    } catch (err) {
      if (!(err instanceof ApiError && err.status === 400 && /truncation/i.test(err.body))) throw err;
      truncation = undefined;
      response = await post(baseUrl, apiKey, { ...base, input: firstInput });
    }

    for (let step = 1; ; step++) {
      if (response.status === "incomplete") {
        return result("error", { error: `response incomplete: ${response.incomplete_details?.reason ?? "unknown"}` });
      }
      const output = response.output ?? [];
      const call = output.find((item) => item.type === "computer_call");

      if (call === undefined) {
        const finalText = messageText(output);
        const { verdicts, error } = parseVerdicts(finalText, opts.criteria);
        return result(error ? "error" : "completed", { verdicts, finalText, ...(error ? { error } : {}) });
      }

      if (step > opts.maxSteps) return result("step_cap", { error: `stopped after ${opts.maxSteps} steps` });

      const safetyChecks = call.pending_safety_checks ?? [];
      if (safetyChecks.length > 0 && !isLocalUrl(opts.appUrl)) {
        return result("error", { error: `safety check raised on a non-local app: ${safetyChecks.map((c) => c.code).join(", ")}` });
      }

      const errors: string[] = [];
      for (const raw of call.actions ?? []) {
        try {
          const mapped = toBrowserActions(raw);
          for (const action of mapped ?? []) await opts.browser.act(action);
        } catch (err) {
          errors.push(err instanceof Error ? err.message : String(err));
        }
      }

      png = await opts.browser.screenshot();
      await opts.onScreenshot?.(step, png);
      steps.push({ step, actions: call.actions ?? [], errors, safetyChecks, screenshotSha256: sha256(png) });

      if (response.id === undefined || call.call_id === undefined) {
        return result("error", { error: "response is missing id or call_id" });
      }

      const callOutput = {
        type: "computer_call_output",
        call_id: call.call_id,
        // Only ever reached for local apps we run ourselves (checked above).
        acknowledged_safety_checks: safetyChecks,
        output: { type: "computer_screenshot", image_url: dataUrl(png) },
      };
      // History for stateless replay: each computer_call is copied unchanged (keeping any
      // `meta_safety_replay_receipt`, which replay requires) next to its output. Reasoning items are
      // not replayed — they can't be resent without server-side storage.
      transcript.push(call, callOutput);

      if (!stateless) {
        try {
          response = await post(baseUrl, apiKey, {
            ...base,
            previous_response_id: response.id,
            ...(truncation ? { truncation } : {}),
            input: [callOutput],
          });
          continue;
        } catch (err) {
          // Chained turns depend on the server's stored copy of the conversation; live runs saw
          // HTTP 500 / 503 "persistence service error" here. Fall back to replaying it ourselves.
          if (!(err instanceof ApiError && (err.status === null || err.status >= 500))) throw err;
          stateless = true;
          fallbacks.push(`step ${step}: chained turn failed (${err.message}); switched to stateless replay`);
        }
      }
      response = await post(baseUrl, apiKey, { ...base, store: false, input: transcript });
    }
  } catch (err) {
    const detail = err instanceof ApiError ? `${err.message} ${err.body}`.trim() : err instanceof Error ? err.message : String(err);
    return result("error", { error: detail });
  }
}
