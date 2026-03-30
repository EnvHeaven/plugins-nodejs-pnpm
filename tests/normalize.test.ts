import assert from "node:assert/strict";
import test from "node:test";
import { normalizeSpec } from "../src";

test("normalizeSpec accepts lowercase pnpm-run input", () => {
  const result = normalizeSpec({
    kind: "pnpm-run",
    cwd: ".",
    script: "start",
    args: ["--watch"],
    env: {
      NODE_ENV: "development",
    },
  });

  assert.equal(result.diagnostics.length, 0);
  assert.deepEqual(result.spec, {
    kind: "pnpm-run",
    cwd: process.cwd(),
    script: "start",
    args: ["--watch"],
    env: {
      NODE_ENV: "development",
    },
  });
});

test("normalizeSpec accepts env-map style aliases", () => {
  const result = normalizeSpec({
    Kind: "pnpm-exec",
    Cwd: ".",
    Bin: "ng",
    Args: ["serve"],
    Env: {
      CI: "false",
    },
  });

  assert.equal(result.diagnostics.length, 0);
  assert.deepEqual(result.spec, {
    kind: "pnpm-exec",
    cwd: process.cwd(),
    bin: "ng",
    args: ["serve"],
    env: {
      CI: "false",
    },
  });
});

test("normalizeSpec rejects unsupported kinds", () => {
  const result = normalizeSpec({
    kind: "npm-run",
    cwd: ".",
  });

  assert.equal(result.spec, null);
  assert.equal(result.diagnostics[0]?.code, "kind-unsupported");
});

test("normalizeSpec requires script for pnpm-run", () => {
  const result = normalizeSpec({
    kind: "pnpm-run",
    cwd: ".",
  });

  assert.equal(result.spec, null);
  assert.equal(result.diagnostics[0]?.code, "script-missing");
});

test("normalizeSpec requires bin for pnpm-exec", () => {
  const result = normalizeSpec({
    kind: "pnpm-exec",
    cwd: ".",
  });

  assert.equal(result.spec, null);
  assert.equal(result.diagnostics[0]?.code, "bin-missing");
});
