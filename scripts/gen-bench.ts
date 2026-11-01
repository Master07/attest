import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse, stringify } from "yaml";

// Deterministic generator for examples/bench-gen. It reads the five fixed shells and applies
// each recipe to every shell where it makes sense. Generated scenarios are never edited by hand:
// change a recipe here, then `npm run gen-bench`.

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const benchRoot = join(repoRoot, "examples", "bench-gen");
const shellsRoot = join(benchRoot, "_shells");

type Layer = Record<string, string>;

interface ShellMeta {
  control: string;
  field: string | null;
  api: { method: string; path: string };
  success: string;
}

interface Shell {
  id: string;
  appDir: string;
  meta: ShellMeta;
  probe: unknown;
  files: Map<string, string>;
}

interface RecipeResult {
  base: Layer;
  fix: Layer;
  badFix: Layer;
  tests: Layer;
  testKind: "unit" | "source";
}

interface Recipe {
  id: string;
  category: string;
  title: string;
  bugReport: string;
  applies(shell: Shell): true | string;
  build(shell: Shell): RecipeResult;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`expected a mapping, got ${JSON.stringify(value)}`);
  }
  return value as Record<string, unknown>;
}

function readFiles(dir: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const name of readdirSync(dir).sort()) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      for (const [key, value] of readFiles(path)) out.set(`${name}/${key}`, value);
    } else {
      out.set(name, readFileSync(path, "utf8"));
    }
  }
  return out;
}

function loadShells(): Shell[] {
  return readdirSync(shellsRoot)
    .filter((name) => statSync(join(shellsRoot, name)).isDirectory() && existsSync(join(shellsRoot, name, "probe.yml")))
    .sort()
    .map((id) => {
      const dir = join(shellsRoot, id);
      const doc = asRecord(parse(readFileSync(join(dir, "probe.yml"), "utf8")));
      const api = asRecord(doc["api"]);
      return {
        id,
        appDir: join(dir, "app"),
        meta: {
          control: typeof doc["control"] === "string" ? doc["control"] : "",
          field: typeof doc["field"] === "string" ? doc["field"] : null,
          api: {
            method: typeof api["method"] === "string" ? api["method"] : "",
            path: typeof api["path"] === "string" ? api["path"] : "",
          },
          success: typeof doc["success"] === "string" ? doc["success"] : "",
        },
        probe: doc["probe"],
        files: readFiles(join(dir, "app")),
      };
    });
}

const stripJs = (text: string): string => text.replace(/\/\*@[a-z-]+\*\//g, "");
const stripHtml = (text: string): string => text.replace(/<!--@[a-z-]+-->/g, "");

function strip(path: string, text: string): string {
  if (path.endsWith(".js")) return stripJs(text);
  if (path.endsWith(".html")) return stripHtml(text);
  return text;
}

function raw(shell: Shell, path: string): string {
  const text = shell.files.get(path);
  if (text === undefined) throw new Error(`${shell.id}: missing ${path}`);
  return text;
}

function clean(shell: Shell, path: string): string {
  return strip(path, raw(shell, path));
}

function insert(js: string, anchor: string, code: string): string {
  if (!js.includes(anchor)) throw new Error(`anchor ${anchor} missing`);
  return js.replace(anchor, `${code}\n${anchor}`);
}

function replaceOnce(text: string, from: string, to: string): string {
  if (!text.includes(from)) throw new Error(`missing text: ${from}`);
  return text.replace(from, to);
}

function addImport(js: string, name: string, file: string): string {
  return replaceOnce(
    js,
    'import { apply } from "./state.js";',
    `import { apply } from "./state.js";\nimport { ${name} } from "./${file}.js";`,
  );
}

function overlayHtml(shell: Shell, snippet: string): string {
  const html = raw(shell, "public/index.html");
  return stripHtml(replaceOnce(html, "  <!--@overlay-->", `${snippet}\n  <!--@overlay-->`));
}

function appRecipe(shell: Shell, baseJs: string, badJs: string, tests: Layer, testKind: "unit" | "source", badExtra: Layer = {}): RecipeResult {
  return {
    base: { "public/app.js": stripJs(baseJs) },
    fix: { "public/app.js": clean(shell, "public/app.js") },
    badFix: { "public/app.js": stripJs(badJs), ...badExtra },
    tests,
    testKind,
  };
}

function cssRecipe(shell: Shell, baseCss: string, badCss: string, tests: Layer, baseHtml?: string, badHtml?: string): RecipeResult {
  const base: Layer = { "public/styles.css": baseCss };
  const fix: Layer = { "public/styles.css": clean(shell, "public/styles.css") };
  const badFix: Layer = { "public/styles.css": badCss };
  if (baseHtml !== undefined) {
    base["public/index.html"] = baseHtml;
    fix["public/index.html"] = clean(shell, "public/index.html");
  }
  if (badHtml !== undefined) badFix["public/index.html"] = badHtml;
  else if (baseHtml !== undefined) badFix["public/index.html"] = baseHtml;
  return { base, fix, badFix, tests, testKind: "source" };
}

function htmlRecipe(shell: Shell, baseHtml: string, badHtml: string, tests: Layer, testKind: "unit" | "source", badExtra: Layer = {}): RecipeResult {
  return {
    base: { "public/index.html": baseHtml },
    fix: { "public/index.html": clean(shell, "public/index.html") },
    badFix: { "public/index.html": badHtml, ...badExtra },
    tests,
    testKind,
  };
}

function sourceTest(file: string, pattern: string, what: string): string {
  return `import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test(${JSON.stringify(what)}, () => {
  const text = readFileSync(new URL("./public/${file}", import.meta.url), "utf8");
  assert.match(text, /${pattern}/);
});
`;
}

function unitTest(helper: string, file: string, body: string, what: string): string {
  return `import test from "node:test";
import assert from "node:assert/strict";
import { ${helper} } from "./public/${file}.js";

test(${JSON.stringify(what)}, () => {
${body}
});
`;
}

const controlId = (shell: Shell): string => shell.meta.control.replace(/^#/, "");
const fieldId = (shell: Shell): string => (shell.meta.field ?? "").replace(/^#/, "");
const rawCss = (shell: Shell): string => raw(shell, "public/styles.css");

const doubleCode: Record<string, string> = {
  checkout: "payload.amount = payload.amount * 2;",
  signup: "payload.name = payload.name + payload.name;",
  todo: "payload.item = payload.item + payload.item;",
  settings: "payload.interval = payload.interval * 2;",
  search: "q = q + q;",
};

const doubleBadCode: Record<string, string> = {
  checkout: "payload.amount = normalize(payload.amount * 2);",
  signup: "payload.name = normalize(payload.name + payload.name);",
  todo: "payload.item = normalize(payload.item + payload.item);",
  settings: "payload.interval = normalize(payload.interval * 2);",
  search: "q = normalize(q + q);",
};

const strictPattern: Record<string, { base: string; bad: string; helper: string; test: string; input: string }> = {
  signup: { base: "[A-Z]{5,}", bad: "[A-Z]{4,}", helper: "nameOk", test: 'assert.equal(nameOk("Alexander"), true);', input: "Alexander" },
  todo: { base: "[A-Za-z]+", bad: "[A-Za-z]+ [A-Za-z]+ [A-Za-z]+", helper: "itemOk", test: 'assert.equal(itemOk("Buy milk now"), true);', input: "Buy milk now" },
  search: { base: "[A-Z]+", bad: "[A-Z]{2,}", helper: "queryOk", test: 'assert.equal(queryOk("LAMP"), true);', input: "LAMP" },
};

const recipes: Recipe[] = [
  {
    id: "transparent-overlay",
    category: "overlay",
    title: "Transparent layer over the control",
    bugReport: "I can see the button but clicking it does nothing.",
    applies: () => true,
    build: (s) => {
      const cssBug = `${rawCss(s)}\n.cover { position: fixed; inset: 0; z-index: 9999; background: transparent; }\n`;
      const cssBad = `${cssBug}\n.control { position: relative; z-index: 1000; }\n`;
      const html = overlayHtml(s, '    <div class="cover"></div>');
      return cssRecipe(s, cssBug, cssBad, { "overlay.test.js": sourceTest("styles.css", "z-index:\\s*1000", "the control is raised above other layers") }, html);
    },
  },
  {
    id: "fixed-banner",
    category: "overlay",
    title: "Fixed banner covers the control",
    bugReport: "A banner covers the page and I can't use the button.",
    applies: () => true,
    build: (s) => {
      const banner = `    <div class="banner" id="banner">\n      <p>We use cookies to keep the shop working.</p>\n    </div>`;
      const html = overlayHtml(s, banner);
      const htmlBad = overlayHtml(s, `${banner}\n    <button id="banner-close" type="button">Close</button>`);
      const cssBug = `${rawCss(s)}\n.banner { position: fixed; left: 0; right: 0; bottom: 0; height: 600px; z-index: 9999; background: #fff; border-top: 1px solid #ddd; padding: 24px; }\n`;
      return cssRecipe(s, cssBug, cssBug, { "banner.test.js": sourceTest("index.html", 'id="banner-close"', "the banner has a close button") }, html, htmlBad);
    },
  },
  {
    id: "offscreen",
    category: "layout",
    title: "Control pushed off-screen",
    bugReport: "The button is missing from the page.",
    applies: () => true,
    build: (s) => {
      const cssBug = `${rawCss(s)}\n.control { margin-left: 3000px; }\nhtml, body { overflow-x: hidden; }\n`;
      const cssBad = `${cssBug}\n.control { position: relative; z-index: 1000; }\n`;
      return cssRecipe(s, cssBug, cssBad, { "offscreen.test.js": sourceTest("styles.css", "z-index:\\s*1000", "the control is raised above other layers") });
    },
  },
  {
    id: "invisible",
    category: "layout",
    title: "Control invisible",
    bugReport: "The button is there but I can't see it.",
    applies: () => true,
    build: (s) => {
      const cssBug = `${rawCss(s)}\n.control { opacity: 0; visibility: hidden; pointer-events: none; }\n`;
      const htmlBad = stripHtml(replaceOnce(raw(s, "public/index.html"), `id="${controlId(s)}"`, `aria-label="Action" id="${controlId(s)}"`));
      return cssRecipe(s, cssBug, cssBug, { "invisible.test.js": sourceTest("index.html", 'aria-label="Action"', "the control has an accessible name") }, undefined, htmlBad);
    },
  },
  {
    id: "no-pointer",
    category: "layout",
    title: "Container ignores the pointer",
    bugReport: "Clicking the button does nothing.",
    applies: () => true,
    build: (s) => {
      const cssBug = `${rawCss(s)}\n.panel { pointer-events: none; }\n`;
      const cssBad = `${cssBug}\n.control { cursor: pointer; }\n`;
      return cssRecipe(s, cssBug, cssBad, { "pointer.test.js": sourceTest("styles.css", "cursor:\\s*pointer", "the control has a pointer cursor") });
    },
  },
  {
    id: "zero-size",
    category: "layout",
    title: "Control rendered at zero size",
    bugReport: "I can't see or click the button.",
    applies: () => true,
    build: (s) => {
      const cssBug = `${rawCss(s)}\n.control { width: 0; height: 0; padding: 0; border: 0; margin: 0; overflow: hidden; font-size: 0; }\n`;
      const cssBad = `${cssBug}\n.panel { min-width: 40px; }\n`;
      return cssRecipe(s, cssBug, cssBad, { "size.test.js": sourceTest("styles.css", "min-width:\\s*40px", "the panel has a minimum width") });
    },
  },
  {
    id: "clipped",
    category: "layout",
    title: "Control clipped by its panel",
    bugReport: "The button is cut off and I can't click it.",
    applies: () => true,
    build: (s) => {
      const cssBug = `${rawCss(s)}\n.panel { max-height: 100px; overflow: hidden; }\n`;
      const cssBad = `${cssBug}\n.panel { padding: 40px; }\n`;
      return cssRecipe(s, cssBug, cssBad, { "clipped.test.js": sourceTest("styles.css", "padding:\\s*40px", "the panel has extra padding") });
    },
  },
  {
    id: "string-compare",
    category: "state",
    title: "Action disabled by a type mismatch",
    bugReport: "The button is greyed out and I can't click it.",
    applies: () => true,
    build: (s) => {
      const base = insert(raw(s, "public/app.js"), "/*@init*/", 'const max = "10";\nif (qty.value > max) control.disabled = true;');
      const bad = addImport(insert(raw(s, "public/app.js"), "/*@init*/", 'const max = "10";\nif (compare(qty.value, max)) control.disabled = true;'), "compare", "compare");
      return appRecipe(s, base, bad, {
        "compare.test.js": unitTest("compare", "compare", '  assert.equal(compare(9, 10), false);', "compares numbers"),
        "public/compare.js": "export function compare(a, b) {\n  return a >= b;\n}\n",
      }, "unit", { "public/compare.js": "export function compare(a, b) {\n  return a >= b;\n}\n" });
    },
  },
  {
    id: "double-apply",
    category: "state",
    title: "Update applied twice",
    bugReport: "I submit the form and the result is wrong.",
    applies: () => true,
    build: (s) => {
      const base = insert(raw(s, "public/app.js"), "/*@after-payload*/", doubleCode[s.id] ?? "payload.value = payload.value + payload.value;");
      const bad = addImport(insert(raw(s, "public/app.js"), "/*@after-payload*/", doubleBadCode[s.id] ?? "payload.value = normalize(payload.value + payload.value);"), "normalize", "normalize");
      return appRecipe(s, base, bad, {
        "normalize.test.js": unitTest("normalize", "normalize", "  assert.equal(normalize(178), 178);", "returns the value unchanged"),
        "public/normalize.js": "export function normalize(value) {\n  return value;\n}\n",
      }, "unit", { "public/normalize.js": "export function normalize(value) {\n  return value;\n}\n" });
    },
  },
  {
    id: "nan",
    category: "state",
    title: "Parsed amount becomes NaN",
    bugReport: "The button does nothing.",
    applies: () => true,
    build: (s) => {
      const base = insert(raw(s, "public/app.js"), "/*@pre-submit*/", "const amount = Number(form.dataset.amount);\nif (!Number.isFinite(amount)) return;");
      const bad = addImport(insert(raw(s, "public/app.js"), "/*@pre-submit*/", "if (isBadAmount(form.dataset.amount)) return;"), "isBadAmount", "isBadAmount");
      return appRecipe(s, base, bad, {
        "nan.test.js": unitTest("isBadAmount", "isBadAmount", '  assert.equal(isBadAmount("$1.00"), true);', "flags an unparseable amount"),
        "public/isBadAmount.js": "export function isBadAmount(value) {\n  return isNaN(Number(value));\n}\n",
      }, "unit", { "public/isBadAmount.js": "export function isBadAmount(value) {\n  return isNaN(Number(value));\n}\n" });
    },
  },
  {
    id: "stale-render",
    category: "state",
    title: "State updates but the page does not",
    bugReport: "I submit and the page never changes.",
    applies: () => true,
    build: (s) => {
      const block = "  state = apply(state, data);\n  /*@render*/\n  renderSuccess(state);";
      const base = replaceOnce(raw(s, "public/app.js"), block, "  state = apply(state, data);");
      const bad = replaceOnce(raw(s, "public/app.js"), block, "  renderSuccess(state);\n  state = apply(state, data);");
      return appRecipe(s, base, bad, {
        "state.test.js": unitTest("apply", "state", "  assert.deepEqual(apply({}, { value: 1 }), { value: 1 });", "applies data to state"),
      }, "unit");
    },
  },
  {
    id: "wrong-endpoint",
    category: "network",
    title: "Request to a missing path",
    bugReport: "I submit and get an error.",
    applies: () => true,
    build: (s) => {
      const search = s.id === "search";
      const base = search
        ? replaceOnce(raw(s, "public/app.js"), 'fetch("/api/search?q="', 'fetch("/api/search-missing?q="')
        : replaceOnce(raw(s, "public/app.js"), `fetch("${s.meta.api.path}"`, `fetch("/api/${s.id}-missing"`);
      const bad = search
        ? addImport(replaceOnce(raw(s, "public/app.js"), 'fetch("/api/search?q="', 'fetch(endpoint() + "?q="'), "endpoint", "endpoint")
        : addImport(replaceOnce(raw(s, "public/app.js"), `fetch("${s.meta.api.path}"`, "fetch(endpoint()"), "endpoint", "endpoint");
      const helper = `export function endpoint() {\n  return "/api/${s.id}-missing2";\n}\n`;
      return appRecipe(s, base, bad, {
        "endpoint.test.js": unitTest("endpoint", "endpoint", '  assert.equal(endpoint().startsWith("/api/"), true);', "builds an API path"),
        "public/endpoint.js": helper,
      }, "unit", { "public/endpoint.js": helper });
    },
  },
  {
    id: "wrong-method",
    category: "network",
    title: "Request uses the wrong method",
    bugReport: "I submit and get an error.",
    applies: () => true,
    build: (s) => {
      const base = replaceOnce(raw(s, "public/app.js"), `method: "${s.meta.api.method}"`, 'method: "PATCH"');
      const helper = `export function methodFor() {\n  return "${s.meta.api.method}";\n}\n`;
      return appRecipe(s, base, base, {
        "method.test.js": unitTest("methodFor", "methodFor", `  assert.equal(methodFor(), "${s.meta.api.method}");`, "returns the expected method"),
        "public/methodFor.js": helper,
      }, "unit", { "public/methodFor.js": helper });
    },
  },
  {
    id: "navigate-early",
    category: "network",
    title: "Navigation before the save finishes",
    bugReport: "It sends me away before anything happens.",
    applies: () => true,
    build: (s) => {
      const target = s.id === "checkout" ? '"/order-confirmation"' : s.id === "signup" ? '"/welcome"' : null;
      const early = target === null ? "location.reload();\nreturn;" : `location.assign(${target});\nreturn;`;
      const late = target === null ? "soon(() => location.reload());\nreturn;" : `soon(() => location.assign(${target}));\nreturn;`;
      const base = insert(raw(s, "public/app.js"), "/*@pre-request*/", early);
      const bad = addImport(insert(raw(s, "public/app.js"), "/*@pre-request*/", late), "soon", "soon");
      const helper = "export function soon(fn) {\n  return setTimeout(fn, 0);\n}\n";
      return appRecipe(s, base, bad, {
        "soon.test.js": unitTest("soon", "soon", "  const timer = soon(() => {});\n  assert.ok(timer !== null);\n  clearTimeout(timer);", "schedules a callback"),
        "public/soon.js": helper,
      }, "unit", { "public/soon.js": helper });
    },
  },
  {
    id: "bad-redirect",
    category: "navigation",
    title: "Success goes to a missing page",
    bugReport: "After submitting I land on a page that doesn't exist.",
    applies: () => true,
    build: (s) => {
      const base = insert(raw(s, "public/app.js"), "/*@pre-success*/", 'location.assign("/missing");\nreturn;');
      const bad = addImport(insert(raw(s, "public/app.js"), "/*@pre-success*/", "location.assign(redirectPath());\nreturn;"), "redirectPath", "redirectPath");
      const helper = 'export function redirectPath() {\n  return "/missing";\n}\n';
      return appRecipe(s, base, bad, {
        "redirect.test.js": unitTest("redirectPath", "redirectPath", '  assert.equal(redirectPath().startsWith("/"), true);', "builds a path"),
        "public/redirectPath.js": helper,
      }, "unit", { "public/redirectPath.js": helper });
    },
  },
  {
    id: "strict-pattern",
    category: "validation",
    title: "Over-strict input pattern",
    bugReport: "It won't let me submit the form.",
    applies: (s) => (s.meta.field === null ? "no text input in the task" : true),
    build: (s) => {
      const strict = strictPattern[s.id];
      if (strict === undefined || s.meta.field === null) throw new Error(`${s.id}: strict-pattern configuration missing`);
      const id = fieldId(s);
      const base = stripHtml(replaceOnce(raw(s, "public/index.html"), `id="${id}"`, `pattern="${strict.base}" id="${id}"`));
      const bad = stripHtml(replaceOnce(raw(s, "public/index.html"), `id="${id}"`, `pattern="${strict.bad}" id="${id}"`));
      const helper = `export function ${strict.helper}(value) {\n  return /^${strict.bad}$/.test(value);\n}\n`;
      return htmlRecipe(s, base, bad, {
        "validate.test.js": unitTest(strict.helper, "validate", `  ${strict.test}`, "accepts another valid value"),
        "public/validate.js": helper,
      }, "unit", { "public/validate.js": helper });
    },
  },
  {
    id: "hidden-required",
    category: "validation",
    title: "Hidden required field blocks submit",
    bugReport: "It won't let me submit the form.",
    applies: () => true,
    build: (s) => {
      const form = '<form id="task" data-amount="$1.00">';
      const input = '        <input class="offscreen" name="company" type="text" style="position:absolute;left:-9999px" required />';
      const base = stripHtml(replaceOnce(raw(s, "public/index.html"), form, `${form}\n${input}`));
      const bad = base.replace(
        'name="company" type="text" style="position:absolute;left:-9999px" required',
        'name="company2" type="text" style="position:absolute;left:-9999px" required',
      );
      return htmlRecipe(s, base, bad, {
        "hidden.test.js": sourceTest("index.html", 'name="company2"[^>]*required', "the moved field is still required"),
      }, "source");
    },
  },
  {
    id: "wrong-element",
    category: "events",
    title: "Handler bound to the wrong element",
    bugReport: "Clicking the button does nothing.",
    applies: () => true,
    build: (s) => {
      const base = replaceOnce(raw(s, "public/app.js"), 'form.addEventListener("submit"', 'document.querySelector("#toolbar").addEventListener("submit"');
      const bad = addImport(replaceOnce(raw(s, "public/app.js"), 'form.addEventListener("submit"', "bind(control.parentElement,"), "bind", "bind");
      const helper = 'export function bind(target, handler) {\n  target.addEventListener("submit", handler);\n}\n';
      return appRecipe(s, base, bad, {
        "bind.test.js": unitTest("bind", "bind", '  let event = "";\n  const target = { addEventListener: (name) => { event = name; } };\n  bind(target, () => {});\n  assert.equal(event, "submit");', "binds a submit handler"),
        "public/bind.js": helper,
      }, "unit", { "public/bind.js": helper });
    },
  },
  {
    id: "prevent-default",
    category: "events",
    title: "Default action prevented",
    bugReport: "Clicking the button does nothing.",
    applies: () => true,
    build: (s) => {
      const base = insert(raw(s, "public/app.js"), "/*@init*/", 'document.addEventListener("submit", (event) => { event.preventDefault(); event.stopPropagation(); }, true);');
      const bad = insert(raw(s, "public/app.js"), "/*@init*/", 'document.addEventListener("click", (event) => { event.preventDefault(); event.stopPropagation(); }, true);');
      return appRecipe(s, base, bad, {
        "prevent.test.js": sourceTest("app.js", 'addEventListener\\("click"', "the block moved to a click capture listener"),
      }, "source");
    },
  },
  {
    id: "late-overlay",
    category: "events",
    title: "Late third-party overlay",
    bugReport: "Something covers the button a moment after the page loads.",
    applies: () => true,
    build: (s) => {
      const inject = `setTimeout(() => {
  const cover = document.createElement("div");
  cover.style.cssText = "position:fixed;inset:0;z-index:9999;background:transparent";
  document.body.appendChild(cover);
}, 250);`;
      const base = insert(raw(s, "public/app.js"), "/*@init*/", inject);
      const bad = insert(raw(s, "public/app.js"), "/*@init*/", inject.replace("  document.body.appendChild(cover);", '  document.body.appendChild(cover);\n  control.style.position = "relative";\n  control.style.zIndex = "1000";'));
      return appRecipe(s, base, bad, {
        "late.test.js": sourceTest("app.js", 'zIndex = "1000"', "the control is raised above the late layer"),
      }, "source");
    },
  },
  {
    id: "delayed-enable",
    category: "state",
    title: "Control disabled shortly after load",
    bugReport: "The button goes grey after the page loads and I can't click it.",
    applies: () => true,
    build: (s) => {
      const base = insert(raw(s, "public/app.js"), "/*@init*/", "setTimeout(() => { control.disabled = true; }, 300);");
      const bad = insert(raw(s, "public/app.js"), "/*@init*/", "setTimeout(() => { control.disabled = true; }, 100);");
      return appRecipe(s, base, bad, {
        "delayed.test.js": sourceTest("app.js", "\\}, 100\\);", "the timer still disables the control"),
      }, "source");
    },
  },
];

function writeTree(dir: string, files: Layer): void {
  for (const [rel, content] of Object.entries(files)) {
    const path = join(dir, rel);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content.endsWith("\n") ? content : `${content}\n`, "utf8");
  }
}

function removeOwned(shells: Shell[]): void {
  const prefixes = new Set(shells.map((s) => `${s.id}-`));
  for (const name of readdirSync(benchRoot)) {
    const path = join(benchRoot, name);
    if (!statSync(path).isDirectory()) continue;
    if ([...prefixes].some((prefix) => name.startsWith(prefix))) rmSync(path, { recursive: true, force: true });
  }
}

function scenarioYaml(shell: Shell, recipe: Recipe, result: RecipeResult): string {
  return stringify({
    id: `G-${shell.id}-${recipe.id}`,
    title: `${shell.id}: ${recipe.title}`,
    category: recipe.category,
    shell: shell.id,
    recipe: recipe.id,
    bad_fix_test: result.testKind,
    bug_report: recipe.bugReport,
    outside_app_dir: false,
    probe: shell.probe,
  });
}

const shells = loadShells();
removeOwned(shells);

let generated = 0;
const skipped: string[] = [];

for (const shell of shells) {
  for (const recipe of recipes) {
    const applicability = recipe.applies(shell);
    if (applicability !== true) {
      skipped.push(`- ${shell.id} / ${recipe.id}: ${applicability}`);
      continue;
    }

    const result = recipe.build(shell);
    const dirName = `${shell.id}-${recipe.id}`;
    const scenarioDir = join(benchRoot, dirName);
    const appDir = join(scenarioDir, "app");

    for (const [path, content] of shell.files) {
      const target = join(appDir, path);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, strip(path, content), "utf8");
    }
    writeFileSync(join(appDir, "criteria.yml"), readFileSync(join(shell.appDir, "criteria.yml")));

    writeTree(appDir, result.base);
    writeTree(join(scenarioDir, "fix"), result.fix);
    writeTree(join(scenarioDir, "bad-fix"), { ...result.badFix, ...result.tests });
    writeFileSync(join(scenarioDir, "scenario.yml"), scenarioYaml(shell, recipe, result), "utf8");
    generated += 1;
  }
}

skipped.sort();
writeFileSync(
  join(benchRoot, "SKIPPED.md"),
  [
    "# Skipped combinations",
    "",
    ...skipped,
    "",
    `${skipped.length} skipped; ${generated} generated.`,
    "",
  ].join("\n"),
  "utf8",
);

console.log(`generated ${generated} scenarios; ${skipped.length} skipped; ${shells.length} shells x ${recipes.length} recipes`);
