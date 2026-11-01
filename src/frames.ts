import { chromium } from "playwright";

// The judge's providers accept at most 8 images per request (Baseten's Spark Open rejects more), but a
// keyboard flow can take 15+ screenshots — and sampling 8 of them can drop the one frame that shows the bug
// (Board#918, run 1). So long sequences are tiled: up to 4 consecutive frames per image, each labelled with
// its frame number, which fits 32 frames in 8 images without leaving any out.

export const MAX_IMAGES = 8;
export const MAX_PER_SHEET = 4;

/** Pure: which frame indices go in which image. ≤ maxImages frames → one frame per image (unchanged);
 *  more → consecutive groups of equal size (≤ perSheet); beyond maxImages × perSheet → evenly sampled first. */
export function planSheets(n: number, maxImages = MAX_IMAGES, perSheet = MAX_PER_SHEET): number[][] {
  if (n <= 0) return [];
  let indices = Array.from({ length: n }, (_, i) => i);
  const capacity = maxImages * perSheet;
  if (n > capacity) {
    indices = Array.from({ length: capacity }, (_, i) => Math.round((i * (n - 1)) / (capacity - 1)));
  }
  if (indices.length <= maxImages) return indices.map((i) => [i]);
  const per = Math.ceil(indices.length / maxImages);
  const groups: number[][] = [];
  for (let i = 0; i < indices.length; i += per) groups.push(indices.slice(i, i + per));
  return groups;
}

/** Renders one sheet: frames in a 2-column grid, left to right then top to bottom, each with a large "FRAME n" label. */
export async function composeSheets(frames: Buffer[], plan: number[][]): Promise<Buffer[]> {
  const browser = await chromium.launch({ channel: process.env.ATTEST_BROWSER_CHANNEL ?? "msedge", headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1200 } });
    const out: Buffer[] = [];
    for (const group of plan) {
      const cols = group.length === 1 ? 1 : 2;
      const cells = group
        .map((i) => `<figure><div class="lbl">FRAME ${i + 1}</div><img src="data:image/png;base64,${(frames[i] as Buffer).toString("base64")}"></figure>`)
        .join("");
      await page.setContent(`<!doctype html><html><body style="margin:0;background:#fff">
<div id="sheet" style="display:grid;grid-template-columns:repeat(${cols},960px);gap:8px;padding:8px;background:#222;width:max-content">${cells}</div>
<style>figure{margin:0;position:relative}img{display:block;width:960px;height:auto}
.lbl{position:absolute;top:6px;left:6px;background:#d00;color:#fff;font:700 28px/1.2 Arial,sans-serif;padding:4px 10px;border-radius:4px}</style></body></html>`);
      await page.waitForFunction("Array.from(document.images).every((img) => img.complete)");
      out.push(await page.locator("#sheet").screenshot({ type: "png" }));
    }
    return out;
  } finally {
    await browser.close();
  }
}
