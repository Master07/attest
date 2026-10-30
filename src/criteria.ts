import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "yaml";

export interface Expect {
  url?: string;
  network?: { method: string; path: string; status: number };
  visible?: string[];
}

export interface Criterion {
  id: string;
  given: string;
  when: string;
  then: string;
  expect?: Expect;
}

export interface CriteriaFile {
  id: string;
  criteria: Criterion[];
  sha256: string;
  path: string;
}

export class CriteriaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CriteriaError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireNonEmptyString(value: unknown, label: string, field: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new CriteriaError(`${label}: ${field} must be a non-empty string`);
  }
  return value;
}

function parseExpect(value: unknown, label: string): Expect {
  if (!isRecord(value)) throw new CriteriaError(`${label}: expect must be a mapping`);
  const expect: Expect = {};

  if (value["url"] !== undefined) {
    expect.url = requireNonEmptyString(value["url"], label, "expect.url");
  }

  if (value["network"] !== undefined) {
    const network = value["network"];
    if (!isRecord(network)) throw new CriteriaError(`${label}: expect.network must be a mapping`);
    const method = requireNonEmptyString(network["method"], label, "expect.network.method");
    const path = requireNonEmptyString(network["path"], label, "expect.network.path");
    const status = network["status"];
    if (typeof status !== "number" || !Number.isInteger(status)) {
      throw new CriteriaError(`${label}: expect.network.status must be an integer`);
    }
    expect.network = { method, path, status };
  }

  if (value["visible"] !== undefined) {
    const visible = value["visible"];
    if (!Array.isArray(visible)) {
      throw new CriteriaError(`${label}: expect.visible must be an array of strings`);
    }
    expect.visible = visible.map((entry, index) =>
      requireNonEmptyString(entry, label, `expect.visible[${index}]`),
    );
  }

  return expect;
}

export function loadCriteria(path: string): CriteriaFile {
  const absolute = resolve(path);

  let text: string;
  try {
    text = readFileSync(absolute, "utf8");
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    throw new CriteriaError(`${absolute}: cannot read criteria file (${reason})`);
  }

  const normalized = text.replace(/\r\n/g, "\n");
  const sha256 = createHash("sha256").update(normalized, "utf8").digest("hex");

  let document: unknown;
  try {
    document = parse(normalized);
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    throw new CriteriaError(`${absolute}: invalid YAML (${reason})`);
  }

  if (!isRecord(document)) throw new CriteriaError(`${absolute}: must be a YAML mapping`);

  const id = requireNonEmptyString(document["id"], absolute, "id");

  const rawCriteria = document["criteria"];
  if (!Array.isArray(rawCriteria) || rawCriteria.length === 0) {
    throw new CriteriaError(`${absolute}: criteria must be a non-empty array`);
  }

  const seen = new Set<string>();
  const criteria: Criterion[] = rawCriteria.map((entry, index) => {
    if (!isRecord(entry)) throw new CriteriaError(`${absolute}: criteria[${index}] must be a mapping`);

    const criterionId = requireNonEmptyString(entry["id"], `${absolute}: criteria[${index}]`, "id");
    const label = `${absolute}: criterion "${criterionId}"`;

    if (seen.has(criterionId)) {
      throw new CriteriaError(`${absolute}: duplicate criterion id "${criterionId}"`);
    }
    seen.add(criterionId);

    const criterion: Criterion = {
      id: criterionId,
      given: requireNonEmptyString(entry["given"], label, "given"),
      when: requireNonEmptyString(entry["when"], label, "when"),
      then: requireNonEmptyString(entry["then"], label, "then"),
    };

    if (entry["expect"] !== undefined) {
      criterion.expect = parseExpect(entry["expect"], label);
    }

    return criterion;
  });

  return { id, criteria, sha256, path: absolute };
}
