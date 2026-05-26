<p align="center">
  <a href="https://envheaven.com">
    <img src="./docs/readme/logo/envheaven-logo.png" alt="EnvHeaven" width="96" />
  </a>
</p>

# @envheaven/plugins-nodejs-pnpm

> EnvHeaven plugin for pnpm-backed Node.js workflows.

[![npm version](https://img.shields.io/npm/v/@envheaven/plugins-nodejs-pnpm)](https://www.npmjs.com/package/@envheaven/plugins-nodejs-pnpm)
[![license](https://img.shields.io/npm/l/@envheaven/plugins-nodejs-pnpm)](https://www.npmjs.com/package/@envheaven/plugins-nodejs-pnpm)

> **Experimental 0.x:** EnvHeaven is currently in experimental `0.x` development. APIs, CLI commands, plugin contracts, package names, and release behavior may change before `1.0.0`. Pin versions and read release notes before using it in production workflows.

## What it does

This plugin lets EnvHeaven inspect and execute Node.js project steps through pnpm.

It supports:

- `pnpm-run` for `package.json` scripts.
- `pnpm-exec` for locally installed CLI binaries.
- readiness diagnostics for missing `cwd`, `package.json`, `node_modules`, pnpm, scripts, or local CLIs.
- structured `child_process.spawn()` execution through the EnvHeaven plugin contract.

## Install

```sh
npm install @envheaven/plugins-nodejs-pnpm
```

Install a compatible EnvHeaven host package in the same workflow:

```sh
npm install envheaven
```

## Use

Example execution spec:

```jsonc
{
  "pluginPackage": "@envheaven/plugins-nodejs-pnpm",
  "kind": "pnpm-run",
  "script": "build",
  "cwd": "./artifacts/web-site-01-fe-01"
}
```

For local CLIs, use `pnpm-exec`:

```jsonc
{
  "pluginPackage": "@envheaven/plugins-nodejs-pnpm",
  "kind": "pnpm-exec",
  "bin": "ng",
  "args": ["build"],
  "cwd": "./artifacts/web-site-01-fe-01"
}
```

EnvHeaven loads the plugin by package name and calls `inspect()` before `execute()` when the resolved plan is runnable.

## Requirements

- Node.js `>=20`.
- EnvHeaven host package.
- pnpm available in the target workflow.
- A valid `package.json` near the configured working directory.

## Current limitations

- No automatic installation of Node.js, pnpm, or project dependencies.
- No package-manager abstraction beyond pnpm.
- No fallback to global CLIs for `pnpm-exec`.
- Plugin contracts may change before EnvHeaven `1.0.0`.

## Related

- [`envheaven`](https://www.npmjs.com/package/envheaven)
- [`@envheaven/plugins-firebase-hosting-deploy`](https://www.npmjs.com/package/@envheaven/plugins-firebase-hosting-deploy)
- [`@envheaven/plugins-offiline-web-ui`](https://www.npmjs.com/package/@envheaven/plugins-offiline-web-ui)

## License

MIT, as declared in `package.json`.
