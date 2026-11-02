import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

// Drafts attest.yml and criteria.yml. Never overwrites, and never calls a model.
// timeout_s, the viewport, max_steps and judge match the defaults in config.ts.

export class InitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InitError";
  }
}

export const CRITERIA_REVIEW_HEADER = "# A person must review this before any run";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function scriptValue(scripts: unknown, name: string): string | undefined {
  if (!isRecord(scripts)) return undefined;
  const value = scripts[name];
  if (typeof value !== "string" || value.trim() === "") return undefined;
  return value.trim();
}

/** `--start` wins, then package.json `scripts.start`, then `scripts.dev`, run through npm so
 *  node_modules/.bin is on PATH (Attest starts the app with a plain shell). */
export function startCommand(explicit: string | undefined, packageJsonText: string | undefined): string {
  if (explicit !== undefined && explicit.trim() !== "") return explicit.trim();
  if (packageJsonText === undefined) {
    throw new InitError("pass --start, or a package.json with a start or dev script");
  }

  let document: unknown;
  try {
    document = JSON.parse(packageJsonText.replace(/^\uFEFF/, ""));
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    throw new InitError(`package.json is not valid JSON (${reason})`);
  }

  const scripts = isRecord(document) ? document["scripts"] : undefined;
  const name = scriptValue(scripts, "start") !== undefined ? "start" : scriptValue(scripts, "dev") !== undefined ? "dev" : undefined;
  if (name === undefined) throw new InitError("pass --start, or add a start or dev script to package.json");
  return `npm run ${name}`;
}

function yamlScalar(value: string): string {
  if (value !== "" && value === value.trim() && !/[:#&*!|>%@`'"{}[\],]/.test(value)) return value;
  return JSON.stringify(value);
}

export function draftAttestYml(start: string): string {
  return [
    "app:",
    "  # The app must listen on the port Attest passes in the PORT environment variable.",
    `  start: ${yamlScalar(start)}`,
    "  url: http://localhost:$PORT",
    "  ready: /",
    "  timeout_s: 90",
    "browser:",
    "  viewport: { width: 1280, height: 720 }",
    "verifier:",
    "  max_steps: 25",
    "  judge: true",
    "",
  ].join("\n");
}

export function draftCriteriaYml(): string {
  return [
    CRITERIA_REVIEW_HEADER,
    "id: draft",
    "criteria:",
    "  - id: draft-criterion",
    "    given: <given>",
    "    when: <when>",
    "    then: <then>",
    "",
  ].join("\n");
}

export interface InitOptions {
  appPath: string;
  start?: string;
  outDir?: string;
}

export interface InitResult {
  start?: string;
  wrote: string[];
  skipped: string[];
}

export function initApp(opts: InitOptions): InitResult {
  const appDir = resolve(opts.appPath);
  const outDir = resolve(opts.outDir ?? appDir);
  const attestPath = join(outDir, "attest.yml");
  const criteriaPath = join(outDir, "criteria.yml");
  const wrote: string[] = [];
  const skipped: string[] = [];
  let start: string | undefined;

  if (existsSync(attestPath)) {
    skipped.push(attestPath);
  } else {
    const packagePath = join(appDir, "package.json");
    const packageText = existsSync(packagePath) ? readFileSync(packagePath, "utf8") : undefined;
    start = startCommand(opts.start, packageText);
    mkdirSync(outDir, { recursive: true });
    writeFileSync(attestPath, draftAttestYml(start), "utf8");
    wrote.push(attestPath);
  }

  if (existsSync(criteriaPath)) {
    skipped.push(criteriaPath);
  } else {
    mkdirSync(outDir, { recursive: true });
    writeFileSync(criteriaPath, draftCriteriaYml(), "utf8");
    wrote.push(criteriaPath);
  }

  return { wrote, skipped, ...(start !== undefined ? { start } : {}) };
}
