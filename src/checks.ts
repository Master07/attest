import type { NetworkRecord } from "./browser.js";
import type { Criterion } from "./criteria.js";

// Deterministic checks (ARCHITECTURE §7): code, not a model, decides whether the
// browser ended on the expected URL and whether the expected request happened.
// `expect.visible` is deliberately ignored — SAM confirms elements later.

export type CheckResult = "pass" | "fail" | "n/a";

export interface CheckOutcome {
  kind: "url" | "network";
  result: "pass" | "fail";
  expected: string;
  observed: string;
}

export interface CriterionChecks {
  id: string;
  result: CheckResult;
  outcomes: CheckOutcome[];
}

export interface BrowserRecords {
  finalUrl: string;
  urlHistory: string[];
  network: NetworkRecord[];
}

export function normalizePath(path: string): string {
  if (path === "/") return "/";
  return path.replace(/\/+$/, "") || "/";
}

function pathnameOf(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url.split(/[?#]/)[0] ?? url;
  }
}

function checkUrl(expectedUrl: string, finalUrl: string): CheckOutcome {
  const expected = normalizePath(expectedUrl);
  const observedPath = pathnameOf(finalUrl);
  const pass = normalizePath(observedPath) === expected;
  return {
    kind: "url",
    result: pass ? "pass" : "fail",
    expected,
    observed: observedPath,
  };
}

function checkNetwork(
  expected: { method: string; path: string; status: number },
  records: NetworkRecord[],
): CheckOutcome {
  const expectedPath = normalizePath(expected.path);
  const method = expected.method.toUpperCase();
  const expectedText = `${method} ${expectedPath} → ${expected.status}`;

  const matching = records.filter(
    (record) =>
      record.method.toUpperCase() === method && normalizePath(record.path) === expectedPath,
  );

  if (matching.length === 0) {
    return {
      kind: "network",
      result: "fail",
      expected: expectedText,
      observed: `no ${method} ${expectedPath} request`,
    };
  }

  const observed = matching
    .map((record) => `${record.method.toUpperCase()} ${normalizePath(record.path)} → ${record.status ?? "failed"}`)
    .join(", ");

  const pass = matching.some((record) => record.status === expected.status);
  return {
    kind: "network",
    result: pass ? "pass" : "fail",
    expected: expectedText,
    observed,
  };
}

export function runChecks(criterion: Criterion, records: BrowserRecords): CriterionChecks {
  const outcomes: CheckOutcome[] = [];

  if (criterion.expect?.url !== undefined) {
    outcomes.push(checkUrl(criterion.expect.url, records.finalUrl));
  }
  if (criterion.expect?.network !== undefined) {
    outcomes.push(checkNetwork(criterion.expect.network, records.network));
  }

  const result: CheckResult =
    outcomes.length === 0 ? "n/a" : outcomes.every((outcome) => outcome.result === "pass") ? "pass" : "fail";

  return { id: criterion.id, result, outcomes };
}

export function runAllChecks(criteria: Criterion[], records: BrowserRecords): CriterionChecks[] {
  return criteria.map((criterion) => runChecks(criterion, records));
}
