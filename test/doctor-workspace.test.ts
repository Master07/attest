// G2: the doctor workspace check. @corbet/harness-core is a workspace package that npm links
// into node_modules; an older clone pulled before packages/harness-core existed is missing it.
// The check must pass in this repo and report a one-line fix when resolution fails, without
// crashing or skipping the other checks.

import assert from "node:assert/strict";
import { test } from "node:test";
import { checkWorkspacePackage } from "../src/doctor.js";

test("the workspace package check passes in this repo", () => {
  const check = checkWorkspacePackage();
  assert.equal(check.ok, true);
  assert.equal(check.name, "workspace");
  assert.match(check.detail, /@corbet\/harness-core resolves/);
  assert.equal(check.fix, undefined);
});

test("a simulated resolution failure reports the npm install fix line", () => {
  const check = checkWorkspacePackage(() => {
    throw new Error("Cannot find module '@corbet/harness-core'");
  });
  assert.equal(check.ok, false);
  assert.equal(check.name, "workspace");
  assert.equal(check.fix, "run `npm install` (the workspace package isn't linked)");
  assert.match(check.detail, /@corbet\/harness-core does not resolve/);
});
