import { outputText, pngDataUrl, postResponses } from "./api.js";
import type { ClickRecord, Rect } from "./browser.js";
import { pickRoute, resolveProvider } from "./models.js";

// UI confirmation with SAM 3.1 (ARCHITECTURE §7). SAM sees pixels, so it can say where an element
// visibly is — not whether something transparent covers it. Covering is judged by combining SAM's
// box with the browser's hit-test of each click (ClickRecord): "the Pay button is visible here,
// but a click here landed on div#hb-root".

export interface SamBox {
  id: number;
  rect: Rect;
  confidence: number | null;
}

export interface VisibleCheck {
  name: string;
  result: "pass" | "fail";
  box: Rect | null;
  coveredBy: string | null;
  reason: string;
}

/** Parses SAM's text output: records like `<|box;x1=..;y1=..;x2=..;y2=..;w=..;h=..[;c=..]|>`. */
export function parseSamOutput(text: string): SamBox[] {
  const boxes: SamBox[] = [];
  const record = /(\d+)\s*<\|box;([^|]*)\|>/g;
  for (const m of text.matchAll(record)) {
    const fields = Object.fromEntries(
      (m[2] ?? "").split(";").map((kv) => {
        const [k, v] = kv.split("=");
        return [k ?? "", Number(v)];
      }),
    ) as Record<string, number>;
    const { x1, y1, x2, y2 } = fields;
    if ([x1, y1, x2, y2].some((v) => v === undefined || Number.isNaN(v))) continue;
    boxes.push({
      id: Number(m[1]),
      rect: { x: x1!, y: y1!, width: x2! - x1!, height: y2! - y1! },
      confidence: fields["c"] !== undefined && !Number.isNaN(fields["c"]) ? fields["c"] : null,
    });
  }
  return boxes;
}

const inside = (x: number, y: number, r: Rect): boolean => x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height;
const area = (r: Rect): number => Math.max(0, r.width) * Math.max(0, r.height);

/**
 * Pure: is the named element visible, and do clicks on it reach it?
 * - No SAM box → fail (not visible).
 * - A click inside the box whose hit target is non-interactive, or far larger than the element,
 *   → fail, "covered by <target>".
 * - Otherwise → pass.
 */
export function judgeVisibility(name: string, boxes: SamBox[], clicks: ClickRecord[]): VisibleCheck {
  // Several matches (e.g. "button" finds Pay and the chat launcher): the element under test is the
  // one the verifier clicked; otherwise the most confident match.
  const clicksIn = (b: SamBox): number => clicks.filter((c) => inside(c.x, c.y, b.rect)).length;
  const best = [...boxes].sort((a, b) => clicksIn(b) - clicksIn(a) || (b.confidence ?? 0) - (a.confidence ?? 0))[0];
  if (best === undefined) return { name, result: "fail", box: null, coveredBy: null, reason: `SAM found no "${name}" on screen` };

  const onIt = clicks.filter((c) => inside(c.x, c.y, best.rect));
  const blocked = onIt.find((c) => !c.interactive || (c.rect !== null && area(c.rect) > 4 * area(best.rect)));
  if (blocked !== undefined) {
    return {
      name, result: "fail", box: best.rect, coveredBy: blocked.target,
      reason: `"${name}" is visible, but a click on it at (${blocked.x}, ${blocked.y}) landed on ${blocked.target ?? "nothing"}`,
    };
  }
  const reason = onIt.length > 0 ? `"${name}" is visible and clicks on it reach it` : `"${name}" is visible (not clicked)`;
  return { name, result: "pass", box: best.rect, coveredBy: null, reason };
}

/**
 * Runs SAM 3.1 on one screenshot. SAM works best with short generic concepts: "Pay button" can
 * return nothing where "button" finds it, so on an empty result we retry with the head noun.
 */
export async function segment(
  png: Buffer,
  phrase: string,
  env: NodeJS.ProcessEnv = process.env,
): Promise<{ boxes: SamBox[]; phraseUsed: string; raw: string; model: string }> {
  const route = pickRoute("ui", false, env);
  const { baseUrl, apiKey } = resolveProvider(route.provider, env);
  const ask = async (text: string): Promise<string> =>
    outputText(await postResponses(baseUrl, apiKey, {
      model: route.model,
      input: [{ type: "message", role: "user", content: [{ type: "input_text", text }, { type: "input_image", image_url: pngDataUrl(png) }] }],
      metadata: { include_confidence: "true", mask_encoding: "one_bit" },
    }));

  let phraseUsed = phrase;
  let raw = await ask(phrase);
  const head = phrase.trim().split(/\s+/).pop()?.toLowerCase();
  if (parseSamOutput(raw).length === 0 && head !== undefined && head !== phrase.trim().toLowerCase()) {
    phraseUsed = head;
    raw = await ask(head);
  }
  return { boxes: parseSamOutput(raw), phraseUsed, raw, model: route.model };
}
