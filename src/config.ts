import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parse } from "yaml";

export interface AppConfig {
  install?: string;
  start: string;
  url: string;
  ready: string;
  timeout_s: number;
  open?: string;         // path the browser opens first (default "/")
}

export interface BrowserConfig {
  viewport: { width: number; height: number };
}

export interface VerifierConfig {
  max_steps: number;
  judge: boolean;
}

export interface AttestConfig {
  app: AppConfig;
  browser: BrowserConfig;
  verifier: VerifierConfig;
}

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

const DEFAULT_TIMEOUT_S = 90;
const DEFAULT_VIEWPORT = { width: 1280, height: 720 };
const DEFAULT_MAX_STEPS = 25;
const DEFAULT_JUDGE = true;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireNonEmptyString(value: unknown, file: string, field: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new ConfigError(`${file}: ${field} must be a non-empty string`);
  }
  return value;
}

function parseViewport(value: unknown, file: string): { width: number; height: number } {
  if (value === undefined) return { ...DEFAULT_VIEWPORT };
  if (!isRecord(value)) throw new ConfigError(`${file}: browser.viewport must be a mapping`);
  const width = value["width"] ?? DEFAULT_VIEWPORT.width;
  const height = value["height"] ?? DEFAULT_VIEWPORT.height;
  if (typeof width !== "number" || !Number.isInteger(width) || width <= 0) {
    throw new ConfigError(`${file}: browser.viewport.width must be a positive integer`);
  }
  if (typeof height !== "number" || !Number.isInteger(height) || height <= 0) {
    throw new ConfigError(`${file}: browser.viewport.height must be a positive integer`);
  }
  return { width, height };
}

export function loadConfig(appDir: string): AttestConfig {
  const dir = resolve(appDir);
  const file = join(dir, "attest.yml");

  let text: string;
  try {
    text = readFileSync(file, "utf8");
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    throw new ConfigError(`${file}: cannot read attest.yml (${reason})`);
  }

  let document: unknown;
  try {
    document = parse(text);
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    throw new ConfigError(`${file}: invalid YAML (${reason})`);
  }

  if (!isRecord(document)) throw new ConfigError(`${file}: must be a YAML mapping`);
  if (!isRecord(document["app"])) throw new ConfigError(`${file}: app must be a mapping`);
  const appRaw = document["app"];

  const start = requireNonEmptyString(appRaw["start"], file, "app.start");
  const url = requireNonEmptyString(appRaw["url"], file, "app.url");
  const ready = requireNonEmptyString(appRaw["ready"], file, "app.ready");

  let install: string | undefined;
  if (appRaw["install"] !== undefined) {
    install = requireNonEmptyString(appRaw["install"], file, "app.install");
  }

  const timeoutRaw = appRaw["timeout_s"] ?? DEFAULT_TIMEOUT_S;
  if (typeof timeoutRaw !== "number" || !Number.isFinite(timeoutRaw) || timeoutRaw <= 0) {
    throw new ConfigError(`${file}: app.timeout_s must be a positive number`);
  }

  const app: AppConfig = { start, url, ready, timeout_s: timeoutRaw };
  if (install !== undefined) app.install = install;
  if (appRaw["open"] !== undefined) app.open = requireNonEmptyString(appRaw["open"], file, "app.open");

  let browser: BrowserConfig = { viewport: { ...DEFAULT_VIEWPORT } };
  if (document["browser"] !== undefined) {
    if (!isRecord(document["browser"])) throw new ConfigError(`${file}: browser must be a mapping`);
    browser = { viewport: parseViewport(document["browser"]["viewport"], file) };
  }

  let verifier: VerifierConfig = { max_steps: DEFAULT_MAX_STEPS, judge: DEFAULT_JUDGE };
  if (document["verifier"] !== undefined) {
    if (!isRecord(document["verifier"])) throw new ConfigError(`${file}: verifier must be a mapping`);
    const verifierRaw = document["verifier"];

    const maxSteps = verifierRaw["max_steps"] ?? DEFAULT_MAX_STEPS;
    if (typeof maxSteps !== "number" || !Number.isInteger(maxSteps) || maxSteps <= 0) {
      throw new ConfigError(`${file}: verifier.max_steps must be a positive integer`);
    }

    const judge = verifierRaw["judge"] ?? DEFAULT_JUDGE;
    if (typeof judge !== "boolean") {
      throw new ConfigError(`${file}: verifier.judge must be a boolean`);
    }

    verifier = { max_steps: maxSteps, judge };
  }

  return { app, browser, verifier };
}

export function resolveUrl(template: string, port: number): string {
  return template.split("$PORT").join(String(port));
}
