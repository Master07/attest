import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const css = await readFile(new URL("./public/styles.css", import.meta.url), "utf8");
const payRule = css.match(/\.pay\s*\{([^}]*)\}/)?.[1] ?? "";

test("Pay button is positioned so it can stack above overlapping UI", () => {
  assert.match(payRule, /position:\s*relative/);
});

test("Pay button z-index is high enough to sit above overlays", () => {
  const z = Number(payRule.match(/z-index:\s*(\d+)/)?.[1] ?? 0);
  assert.ok(z >= 1000, `expected z-index >= 1000, got ${z}`);
});
