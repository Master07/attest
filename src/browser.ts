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

export interface BrowserSession {
  open(url: string): Promise<void>;
  act(action: Action): Promise<void>;
  screenshot(): Promise<Buffer>;
  currentUrl(): string;
  urlHistory(): string[];
  network(): NetworkRecord[];
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

  return {
    async open(url: string): Promise<void> {
      await page.goto(url, { waitUntil: "load" });
    },

    async act(action: Action): Promise<void> {
      switch (action.type) {
        case "click":
          await page.mouse.click(action.x, action.y, { button: action.button ?? "left" });
          break;
        case "double_click":
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

    async locate(selector: string): Promise<{ x: number; y: number } | null> {
      const box = await page.locator(selector).first().boundingBox();
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
