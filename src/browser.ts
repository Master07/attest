import { chromium } from "playwright";

export type Action =
  | { type: "click"; x: number; y: number; button?: "left" | "right" | "middle" }
  | { type: "double_click"; x: number; y: number }
  | { type: "move"; x: number; y: number }
  | { type: "scroll"; x: number; y: number; scroll_x: number; scroll_y: number }
  | { type: "type"; text: string }
  | { type: "keypress"; keys: string[] }
  | { type: "drag"; path: { x: number; y: number }[] }
  | { type: "wait"; ms?: number };

export interface NetworkRecord {
  ts: string;
  method: string;
  url: string;
  path: string;
  status: number | null;
}

export interface Rect { x: number; y: number; width: number; height: number }

/** What a click actually landed on, hit-tested in the page just before the click. */
export interface ClickRecord {
  ts: string;
  x: number;
  y: number;
  target: string | null;       // e.g. "div#hb-root" or "button#pay.pay"
  rect: Rect | null;           // the hit element's bounding box
  interactive: boolean;        // the hit element is (inside) a button, link, input or [role=button]
}

export interface Overlay { rect: Rect; label: string; color: string; dashed?: boolean }

export interface BrowserSession {
  open(url: string): Promise<void>;
  act(action: Action): Promise<void>;
  screenshot(): Promise<Buffer>;
  currentUrl(): string;
  urlHistory(): string[];
  network(): NetworkRecord[];
  clicks(): ClickRecord[];
  /** Draws labelled boxes over a screenshot (rendered in a separate page) and returns a PNG. */
  annotate(png: Buffer, overlays: Overlay[]): Promise<Buffer>;
  /** Test/debug only. Never expose to the verifier. Centre of the first match, or null. */
  locate(selector: string): Promise<{ x: number; y: number } | null>;
  close(): Promise<void>;
}

const KEY_NAMES = new Map<string, string>([
  ["CTRL", "Control"],
  ["CONTROL", "Control"],
  ["CMD", "Meta"],
  ["COMMAND", "Meta"],
  ["META", "Meta"],
  ["ALT", "Alt"],
  ["OPTION", "Alt"],
  ["SHIFT", "Shift"],
  ["ENTER", "Enter"],
  ["RETURN", "Enter"],
  ["ESC", "Escape"],
  ["ESCAPE", "Escape"],
  ["TAB", "Tab"],
  ["BACKSPACE", "Backspace"],
  ["DELETE", "Delete"],
  ["DEL", "Delete"],
  ["SPACE", "Space"],
  ["UP", "ArrowUp"],
  ["DOWN", "ArrowDown"],
  ["LEFT", "ArrowLeft"],
  ["RIGHT", "ArrowRight"],
  ["PAGEUP", "PageUp"],
  ["PAGEDOWN", "PageDown"],
  ["HOME", "Home"],
  ["END", "End"],
]);

export function toPlaywrightKeys(keys: string[]): string {
  if (keys.length === 0) throw new Error("keypress: keys must not be empty");

  const mapped = keys.map((key) => {
    const trimmed = key.trim();
    if (trimmed === "") throw new Error("keypress: key must not be empty");

    const named = KEY_NAMES.get(trimmed.toUpperCase());
    if (named !== undefined) return named;
    if (/^[A-Za-z0-9]$/.test(trimmed)) return trimmed;

    throw new Error(`keypress: unknown key "${key}"`);
  });

  return mapped.join("+");
}

function pathnameOf(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}

export async function launchBrowser(viewport: { width: number; height: number }): Promise<BrowserSession> {
  const browser = await chromium.launch({
    channel: process.env.ATTEST_BROWSER_CHANNEL ?? "msedge",
    headless: process.env.ATTEST_HEADLESS !== "0",
  });

  const context = await browser.newContext({ viewport });
  const page = await context.newPage();

  const records: NetworkRecord[] = [];
  const urls: string[] = [];
  let closed = false;

  page.on("response", (response) => {
    const request = response.request();
    const url = response.url();
    records.push({
      ts: new Date().toISOString(),
      method: request.method(),
      url,
      path: pathnameOf(url),
      status: response.status(),
    });
  });

  page.on("requestfailed", (request) => {
    const url = request.url();
    records.push({
      ts: new Date().toISOString(),
      method: request.method(),
      url,
      path: pathnameOf(url),
      status: null,
    });
  });

  page.on("framenavigated", (frame) => {
    if (frame === page.mainFrame()) urls.push(frame.url());
  });

  const actionWaitMs = 300;
  const clickRecords: ClickRecord[] = [];

  // Evidence only: records which element a click at (x, y) will hit. It never changes the click.
  const hitTest = async (x: number, y: number): Promise<void> => {
    const hit = await page
      .evaluate(([px, py]) => {
        // Runs in the page; tsconfig has no DOM lib, so reach `document` through a minimal shim.
        interface El {
          id: string; className: unknown; tagName: string;
          getBoundingClientRect(): { x: number; y: number; width: number; height: number };
          closest(selector: string): El | null;
        }
        const doc = (globalThis as unknown as { document: { elementFromPoint(x: number, y: number): El | null } }).document;
        const el = doc.elementFromPoint(px, py);
        if (el === null) return null;
        const r = el.getBoundingClientRect();
        const id = el.id ? `#${el.id}` : "";
        const cls = typeof el.className === "string" && el.className.trim() ? `.${el.className.trim().split(/\s+/).join(".")}` : "";
        return {
          target: `${el.tagName.toLowerCase()}${id}${cls}`,
          rect: { x: r.x, y: r.y, width: r.width, height: r.height },
          interactive: el.closest("button, a[href], input, select, textarea, [role=button]") !== null,
        };
      }, [x, y] as const)
      .catch(() => null);
    clickRecords.push({ ts: new Date().toISOString(), x, y, target: hit?.target ?? null, rect: hit?.rect ?? null, interactive: hit?.interactive ?? false });
  };

  return {
    async open(url: string): Promise<void> {
      await page.goto(url, { waitUntil: "load" });
    },

    async act(action: Action): Promise<void> {
      switch (action.type) {
        case "click":
          await hitTest(action.x, action.y);
          await page.mouse.click(action.x, action.y, { button: action.button ?? "left" });
          break;
        case "double_click":
          await hitTest(action.x, action.y);
          await page.mouse.dblclick(action.x, action.y);
          break;
        case "move":
          await page.mouse.move(action.x, action.y);
          break;
        case "scroll":
          await page.mouse.move(action.x, action.y);
          await page.mouse.wheel(action.scroll_x, action.scroll_y);
          break;
        case "type":
          await page.keyboard.type(action.text);
          break;
        case "keypress":
          await page.keyboard.press(toPlaywrightKeys(action.keys));
          break;
        case "drag": {
          const [first, ...rest] = action.path;
          if (first === undefined) throw new Error("drag: path must contain at least one point");
          await page.mouse.move(first.x, first.y);
          await page.mouse.down();
          for (const point of rest) await page.mouse.move(point.x, point.y);
          await page.mouse.up();
          break;
        }
        case "wait":
          await page.waitForTimeout(action.ms ?? 1000);
          break;
        default: {
          const unknown: never = action;
          throw new Error(`unsupported action: ${JSON.stringify(unknown)}`);
        }
      }

      await page.waitForTimeout(actionWaitMs);
    },

    async screenshot(): Promise<Buffer> {
      return page.screenshot({ type: "png" });
    },

    currentUrl(): string {
      return page.url();
    },

    urlHistory(): string[] {
      return [...urls];
    },

    network(): NetworkRecord[] {
      return [...records];
    },

    clicks(): ClickRecord[] {
      return [...clickRecords];
    },

    async annotate(png: Buffer, overlays: Overlay[]): Promise<Buffer> {
      const canvas = await context.newPage();
      try {
        const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
        const boxes = overlays
          .map((o) => {
            const border = `3px ${o.dashed ? "dashed" : "solid"} ${o.color}`;
            const style = `left:${o.rect.x}px;top:${o.rect.y}px;width:${o.rect.width}px;height:${o.rect.height}px;border:${border}`;
            return `<div class="box" style="${style}"><span style="background:${o.color}">${esc(o.label)}</span></div>`;
          })
          .join("");
        await canvas.setContent(
          `<html><body style="margin:0"><div style="position:relative">` +
            `<img src="data:image/png;base64,${png.toString("base64")}" style="display:block">` +
            `<style>.box{position:absolute;box-sizing:border-box}.box span{position:absolute;left:-3px;top:-24px;` +
            `color:#fff;font:600 13px/20px -apple-system,Segoe UI,Arial;padding:0 6px;white-space:nowrap}</style>` +
            `${boxes}</div></body></html>`,
        );
        return await canvas.locator("div").first().screenshot({ type: "png" });
      } finally {
        await canvas.close();
      }
    },

    async locate(selector: string): Promise<{ x: number; y: number } | null> {
      const locator = page.locator(selector);
      if ((await locator.count()) === 0) return null;
      const box = await locator.first().boundingBox();
      if (box === null) return null;
      return { x: Math.round(box.x + box.width / 2), y: Math.round(box.y + box.height / 2) };
    },

    async close(): Promise<void> {
      if (closed) return;
      closed = true;
      await browser.close().catch(() => undefined);
    },
  };
}
