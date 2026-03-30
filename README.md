# `@envheaven/plugins-nodejs-pnpm`

`@envheaven/plugins-nodejs-pnpm@0.1.0` is a focused Node.js plugin for running pnpm-backed execution specs. It exports explicit metadata, normalizes raw or env-map style inputs, inspects project readiness, and executes `pnpm run` or `pnpm exec` with structured `child_process.spawn()` calls.

Linux is supported directly. Windows support is implemented by delegating execution through WSL from the package itself.

## Install

```bash
npm install @envheaven/plugins-nodejs-pnpm
```

## API

```ts
import { inspect, execute, metadata, normalizeSpec } from "@envheaven/plugins-nodejs-pnpm";
```

## Supported kinds

- `pnpm-exec`
- `pnpm-run`

## `pnpm-exec` example

Use `pnpm exec` for locally installed CLIs. This plugin does not require a global Angular CLI.

```ts
import { inspect, execute } from "@envheaven/plugins-nodejs-pnpm";

const spec = {
  kind: "pnpm-exec",
  cwd: "/workspace/apps/web",
  bin: "ng",
  args: ["serve", "--host", "0.0.0.0"],
};

const inspection = await inspect(spec);

if (inspection.status === "ready") {
  await execute(spec);
}
```

## `pnpm-run` example

Use `pnpm run` for `package.json` scripts.

```ts
import { inspect, execute } from "@envheaven/plugins-nodejs-pnpm";

const spec = {
  kind: "pnpm-run",
  cwd: "/workspace/apps/api",
  script: "start",
  args: ["--port", "3000"],
};

const inspection = await inspect(spec);

if (inspection.status === "ready") {
  await execute(spec);
}
```

## Missing `package.json`

When no `package.json` can be found from `cwd` upward, `inspect()` returns `blocked` with an explicit diagnostic and a suggested action.

```ts
const result = await inspect({
  kind: "pnpm-run",
  cwd: "/workspace/empty-dir",
  script: "start",
});

result.status;
// "blocked"
```

## Missing dependencies

When `node_modules` cannot be found in the package or workspace tree, `inspect()` returns `partial` and suggests running `pnpm install`.

```ts
const result = await inspect({
  kind: "pnpm-exec",
  cwd: "/workspace/apps/web",
  bin: "ng",
  args: ["serve"],
});

result.status;
// "partial"
```

## Diagnostics behavior

`inspect(spec)` validates:

- Node availability
- pnpm availability
- `cwd` existence
- `package.json` existence
- script existence for `pnpm-run`
- local CLI resolvability for `pnpm-exec`
- dependency installation state

Statuses mean:

- `ready`: all required checks passed and the spec can be executed
- `partial`: the project shape is recognized, but setup is incomplete
- `blocked`: the spec or runtime is fundamentally invalid for execution

Each result includes:

- `diagnostics`
- `suggestedActions`
- normalized `spec`
- execution details such as command, args, cwd, and transport

## Env-map input aliases

The package accepts normalized fields and env-map style aliases:

```ts
const result = normalizeSpec({
  Kind: "pnpm-run",
  Cwd: "/workspace/apps/api",
  Script: "start",
  Args: ["--port", "3000"],
  Env: {
    NODE_ENV: "development",
  },
});
```

## v0.1.0 limitations

- No automatic installation of Node.js, pnpm, or dependencies
- No fallback to global CLIs for `pnpm-exec`
- No package-manager abstraction beyond pnpm
- No native Windows execution path; Windows always delegates through WSL
- No direct runtime dependency on `envheaven`; integration is adapter-oriented
