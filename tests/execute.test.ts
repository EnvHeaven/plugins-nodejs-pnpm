import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createNodejsPnpmApi } from "../src";
import type { SpawnRequest } from "../src";

test("execute spawns pnpm run directly on Linux", async () => {
  const cwd = await createPackageFixture({
    scripts: {
      start: "node server.js",
    },
  });
  const requests: SpawnRequest[] = [];
  const api = createNodejsPnpmApi({
    platform: "linux",
    checkCommand: async () => ({ ok: true }),
    spawn: async (request) => {
      requests.push(request);
      return { exitCode: 0, signal: null };
    },
  });

  const result = await api.execute({
    kind: "pnpm-run",
    cwd,
    script: "start",
    args: ["--host", "0.0.0.0"],
    env: {
      PORT: "3000",
    },
  });

  assert.equal(result.status, "ready");
  assert.equal(result.exitCode, 0);
  assert.deepEqual(requests[0], {
    command: "pnpm",
    args: ["run", "start", "--host", "0.0.0.0"],
    cwd,
    env: {
      PORT: "3000",
    },
    stdio: "inherit",
    shell: false,
  });
});

test("execute spawns pnpm exec directly on Linux", async () => {
  const cwd = await createPackageFixture({
    scripts: {
      start: "node server.js",
    },
    bins: ["ng"],
  });
  const requests: SpawnRequest[] = [];
  const api = createNodejsPnpmApi({
    platform: "linux",
    checkCommand: async () => ({ ok: true }),
    spawn: async (request) => {
      requests.push(request);
      return { exitCode: 0, signal: null };
    },
  });

  const result = await api.execute({
    kind: "pnpm-exec",
    cwd,
    bin: "ng",
    args: ["serve"],
  });

  assert.equal(result.status, "ready");
  assert.equal(result.exitCode, 0);
  assert.deepEqual(requests[0], {
    command: "pnpm",
    args: ["exec", "ng", "serve"],
    cwd,
    env: {},
    stdio: "inherit",
    shell: false,
  });
});

test("execute delegates through WSL on Windows", async () => {
  const cwd = await createPackageFixture({
    scripts: {
      start: "node server.js",
    },
    windowsPath: "D:\\workspace\\web",
  });
  const requests: SpawnRequest[] = [];
  const api = createNodejsPnpmApi({
    platform: "win32",
    checkCommand: async () => ({ ok: true }),
    spawn: async (request) => {
      requests.push(request);
      return { exitCode: 0, signal: null };
    },
  });

  const result = await api.execute({
    kind: "pnpm-run",
    cwd,
    script: "start",
    env: {
      PORT: "4200",
    },
  });

  assert.equal(result.status, "ready");
  assert.equal(result.exitCode, 0);
  assert.deepEqual(requests[0], {
    command: "wsl",
    args: ["--cd", "/mnt/d/workspace/web", "env", "PORT=4200", "pnpm", "run", "start"],
    cwd,
    env: {},
    stdio: "inherit",
    shell: false,
  });
});

test("execute returns inspection failures without spawning", async () => {
  const cwd = await createPackageFixture({
    scripts: {},
  });
  const api = createNodejsPnpmApi({
    platform: "linux",
    checkCommand: async () => ({ ok: true }),
    spawn: async () => {
      throw new Error("spawn should not be called");
    },
  });

  const result = await api.execute({
    kind: "pnpm-run",
    cwd,
    script: "missing",
  });

  assert.equal(result.status, "partial");
  assert.equal(result.exitCode, 1);
});

test("execute converts spawn failures into diagnostics", async () => {
  const cwd = await createPackageFixture({
    scripts: {
      start: "node server.js",
    },
  });
  const api = createNodejsPnpmApi({
    platform: "linux",
    checkCommand: async () => ({ ok: true }),
    spawn: async () => {
      throw new Error("spawn broke");
    },
  });

  const result = await api.execute({
    kind: "pnpm-run",
    cwd,
    script: "start",
  });

  assert.equal(result.status, "blocked");
  assert.equal(result.exitCode, 1);
  assert.equal(result.diagnostics.some((entry) => entry.code === "spawn-failed"), true);
});

async function createPackageFixture(options?: {
  scripts?: Record<string, string>;
  bins?: string[];
  windowsPath?: string;
}): Promise<string> {
  const cwd = options?.windowsPath ?? await fs.mkdtemp(path.join(os.tmpdir(), "pnpm-plugin-execute-"));
  await fs.mkdir(cwd, { recursive: true });
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
  await fs.mkdir(path.join(cwd, "node_modules", ".bin"), { recursive: true });

  for (const bin of options?.bins ?? []) {
    await fs.writeFile(path.join(cwd, "node_modules", ".bin", bin), "", "utf8");
  }

  return cwd;
}
