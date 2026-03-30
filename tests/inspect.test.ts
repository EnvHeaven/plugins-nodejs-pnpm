import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createNodejsPnpmApi } from "../src";

test("inspect blocks when cwd does not exist", async () => {
  const api = createNodejsPnpmApi({
    platform: "linux",
    checkCommand: async () => ({ ok: true }),
  });

  const result = await api.inspect({
    kind: "pnpm-run",
    cwd: path.join(os.tmpdir(), "missing-cwd"),
    script: "start",
  });

  assert.equal(result.status, "blocked");
  assert.equal(result.diagnostics.some((entry) => entry.code === "cwd-missing"), true);
});

test("inspect blocks when package.json is missing", async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "pnpm-plugin-no-package-"));
  const api = createNodejsPnpmApi({
    platform: "linux",
    checkCommand: async () => ({ ok: true }),
  });

  const result = await api.inspect({
    kind: "pnpm-run",
    cwd,
    script: "start",
  });

  assert.equal(result.status, "blocked");
  assert.equal(result.diagnostics.some((entry) => entry.code === "package-json-missing"), true);
});

test("inspect blocks when node is unavailable", async () => {
  const cwd = await createPackageFixture();
  const api = createNodejsPnpmApi({
    platform: "linux",
    checkCommand: async (request) => {
      if (request.command === "node") {
        return { ok: false, error: "not found" };
      }

      return { ok: true };
    },
  });

  const result = await api.inspect({
    kind: "pnpm-run",
    cwd,
    script: "start",
  });

  assert.equal(result.status, "blocked");
  assert.equal(result.diagnostics.some((entry) => entry.code === "node-missing"), true);
});

test("inspect blocks when pnpm is unavailable", async () => {
  const cwd = await createPackageFixture();
  const api = createNodejsPnpmApi({
    platform: "linux",
    checkCommand: async (request) => {
      if (request.command === "pnpm") {
        return { ok: false, error: "not found" };
      }

      return { ok: true };
    },
  });

  const result = await api.inspect({
    kind: "pnpm-run",
    cwd,
    script: "start",
  });

  assert.equal(result.status, "blocked");
  assert.equal(result.diagnostics.some((entry) => entry.code === "pnpm-missing"), true);
});

test("inspect returns partial when a script is missing", async () => {
  const cwd = await createPackageFixture();
  const api = createNodejsPnpmApi({
    platform: "linux",
    checkCommand: async () => ({ ok: true }),
  });

  const result = await api.inspect({
    kind: "pnpm-run",
    cwd,
    script: "start",
  });

  assert.equal(result.status, "partial");
  assert.equal(result.diagnostics.some((entry) => entry.code === "script-missing"), true);
});

test("inspect returns partial when local CLI is not resolvable", async () => {
  const cwd = await createPackageFixture({
    scripts: {
      start: "node server.js",
    },
  });

  const api = createNodejsPnpmApi({
    platform: "linux",
    checkCommand: async () => ({ ok: true }),
  });

  const result = await api.inspect({
    kind: "pnpm-exec",
    cwd,
    bin: "ng",
    args: ["serve"],
  });

  assert.equal(result.status, "partial");
  assert.equal(result.diagnostics.some((entry) => entry.code === "local-cli-missing"), true);
});

test("inspect returns partial when dependencies are not installed", async () => {
  const cwd = await createPackageFixture({
    scripts: {
      start: "node server.js",
    },
    withNodeModules: false,
  });

  const api = createNodejsPnpmApi({
    platform: "linux",
    checkCommand: async () => ({ ok: true }),
  });

  const result = await api.inspect({
    kind: "pnpm-run",
    cwd,
    script: "start",
  });

  assert.equal(result.status, "partial");
  assert.equal(result.diagnostics.some((entry) => entry.code === "dependencies-missing"), true);
});

test("inspect resolves workspace node_modules for package execution", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "pnpm-plugin-workspace-"));
  const packageDirectory = path.join(root, "packages", "web");
  await fs.mkdir(packageDirectory, { recursive: true });
  await fs.writeFile(path.join(root, "pnpm-workspace.yaml"), "packages:\n  - packages/*\n", "utf8");
  await fs.writeFile(path.join(root, "package.json"), JSON.stringify({ private: true }, null, 2), "utf8");
  await fs.writeFile(
    path.join(packageDirectory, "package.json"),
    JSON.stringify(
      {
        name: "web",
        scripts: {
          start: "vite",
        },
      },
      null,
      2,
    ),
    "utf8",
  );
  await fs.mkdir(path.join(root, "node_modules", ".bin"), { recursive: true });
  await fs.writeFile(path.join(root, "node_modules", ".bin", "vite"), "", "utf8");

  const api = createNodejsPnpmApi({
    platform: "linux",
    checkCommand: async () => ({ ok: true }),
  });

  const runResult = await api.inspect({
    kind: "pnpm-run",
    cwd: packageDirectory,
    script: "start",
  });
  const execResult = await api.inspect({
    kind: "pnpm-exec",
    cwd: packageDirectory,
    bin: "vite",
  });

  assert.equal(runResult.status, "ready");
  assert.equal(runResult.details?.dependencyRoot, root);
  assert.equal(execResult.status, "ready");
  assert.equal(execResult.details?.localBinPath, path.join(root, "node_modules", ".bin", "vite"));
});

async function createPackageFixture(options?: {
  scripts?: Record<string, string>;
  withNodeModules?: boolean;
}): Promise<string> {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "pnpm-plugin-package-"));
  await fs.writeFile(
    path.join(cwd, "package.json"),
    JSON.stringify(
      {
        name: "fixture",
        scripts: options?.scripts ?? {},
      },
      null,
      2,
    ),
    "utf8",
  );

  if (options?.withNodeModules !== false) {
    await fs.mkdir(path.join(cwd, "node_modules"), { recursive: true });
  }

  return cwd;
}
