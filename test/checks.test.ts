import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizePath, runAllChecks, runChecks } from "../src/checks.js";
import type { BrowserRecords } from "../src/checks.js";
import type { NetworkRecord } from "../src/browser.js";
import type { Criterion } from "../src/criteria.js";

const baseCriterion: Criterion = {
  id: "pay-completes",
  given: "A cart with one item at /cart",
  when: 'The user clicks "Pay"',
  then: "The order confirmation page shows an order number",
};

function record(method: string, path: string, status: number | null): NetworkRecord {
  return { ts: "2026-11-02T00:00:00.000Z", method, url: `http://localhost:4100${path}`, path, status };
}

function records(overrides: Partial<BrowserRecords> = {}): BrowserRecords {
  return {
    finalUrl: "http://localhost:4100/cart",
    urlHistory: ["http://localhost:4100/cart"],
    network: [],
    ...overrides,
  };
}

test("url passes on the final pathname, ignoring query and hash", () => {
  const criterion: Criterion = { ...baseCriterion, expect: { url: "/order-confirmation" } };
  const result = runChecks(
    criterion,
    records({ finalUrl: "http://localhost:4100/order-confirmation?order=1042#top" }),
  );

  assert.equal(result.result, "pass");
  assert.deepEqual(result.outcomes, [
    { kind: "url", result: "pass", expected: "/order-confirmation", observed: "/order-confirmation" },
  ]);
});

test("url fails and reports the observed path", () => {
  const criterion: Criterion = { ...baseCriterion, expect: { url: "/order-confirmation" } };
  const result = runChecks(criterion, records({ finalUrl: "http://localhost:4100/cart" }));

  assert.equal(result.result, "fail");
  assert.equal(result.outcomes.length, 1);
  assert.equal(result.outcomes[0]?.result, "fail");
  assert.equal(result.outcomes[0]?.observed, "/cart");
});

test("normalizes trailing slashes but leaves the root path alone", () => {
  assert.equal(normalizePath("/order-confirmation/"), "/order-confirmation");
  assert.equal(normalizePath("/order-confirmation///"), "/order-confirmation");
  assert.equal(normalizePath("/"), "/");

  const criterion: Criterion = { ...baseCriterion, expect: { url: "/order-confirmation/" } };
  const result = runChecks(
    criterion,
    records({ finalUrl: "http://localhost:4100/order-confirmation" }),
  );
  assert.equal(result.result, "pass");
});

test("network passes when a matching request reaches the expected status", () => {
  const criterion: Criterion = {
    ...baseCriterion,
    expect: { network: { method: "POST", path: "/api/pay", status: 200 } },
  };
  const result = runChecks(
    criterion,
    records({
      network: [record("GET", "/cart", 200), record("POST", "/api/pay", 200)],
    }),
  );

  assert.equal(result.result, "pass");
  assert.deepEqual(result.outcomes, [
    { kind: "network", result: "pass", expected: "POST /api/pay → 200", observed: "POST /api/pay → 200" },
  ]);
});

test("network fails when the request never happened", () => {
  const criterion: Criterion = {
    ...baseCriterion,
    expect: { network: { method: "POST", path: "/api/pay", status: 200 } },
  };
  const result = runChecks(criterion, records({ network: [record("GET", "/cart", 200)] }));

  assert.equal(result.result, "fail");
  assert.match(result.outcomes[0]?.observed ?? "", /no POST \/api\/pay request/);
});

test("network fails when the status is wrong and reports it", () => {
  const criterion: Criterion = {
    ...baseCriterion,
    expect: { network: { method: "POST", path: "/api/pay", status: 200 } },
  };
  const result = runChecks(criterion, records({ network: [record("POST", "/api/pay", 500)] }));

  assert.equal(result.result, "fail");
  assert.match(result.outcomes[0]?.observed ?? "", /500/);
});

test("compares the method case-insensitively", () => {
  const criterion: Criterion = {
    ...baseCriterion,
    expect: { network: { method: "post", path: "/api/pay", status: 200 } },
  };
  const result = runChecks(criterion, records({ network: [record("POST", "/api/pay", 200)] }));

  assert.equal(result.result, "pass");
});

test("a failed request (null status) does not pass", () => {
  const criterion: Criterion = {
    ...baseCriterion,
    expect: { network: { method: "POST", path: "/api/pay", status: 200 } },
  };
  const result = runChecks(criterion, records({ network: [record("POST", "/api/pay", null)] }));

  assert.equal(result.result, "fail");
  assert.match(result.outcomes[0]?.observed ?? "", /failed/);
});

test("no expectation is not applicable", () => {
  assert.deepEqual(runChecks(baseCriterion, records()), {
    id: "pay-completes",
    result: "n/a",
    outcomes: [],
  });
});

test("a visible-only expectation is not applicable here", () => {
  const criterion: Criterion = { ...baseCriterion, expect: { visible: ["Pay button"] } };
  assert.deepEqual(runChecks(criterion, records()), {
    id: "pay-completes",
    result: "n/a",
    outcomes: [],
  });
});

test("with both expectations, url comes first and one failure fails the criterion", () => {
  const criterion: Criterion = {
    ...baseCriterion,
    expect: {
      url: "/order-confirmation",
      network: { method: "POST", path: "/api/pay", status: 200 },
    },
  };
  const result = runChecks(
    criterion,
    records({
      finalUrl: "http://localhost:4100/cart",
      network: [record("POST", "/api/pay", 200)],
    }),
  );

  assert.equal(result.result, "fail");
  assert.equal(result.outcomes.length, 2);
  assert.equal(result.outcomes[0]?.kind, "url");
  assert.equal(result.outcomes[0]?.result, "fail");
  assert.equal(result.outcomes[1]?.kind, "network");
  assert.equal(result.outcomes[1]?.result, "pass");
});

test("runAllChecks keeps criterion order and ids", () => {
  const criteria: Criterion[] = [
    baseCriterion,
    { ...baseCriterion, id: "second", expect: { url: "/cart" } },
  ];
  const results = runAllChecks(criteria, records());

  assert.deepEqual(
    results.map((result) => [result.id, result.result]),
    [
      ["pay-completes", "n/a"],
      ["second", "pass"],
    ],
  );
});
