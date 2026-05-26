<br />

<p align="center">
  <a href="https://envheaven.com">
    <img src="./docs/readme/logo/envheaven-logo.svg" alt="EnvHeaven" width="96" />
  </a>

  <h1 align="center">EnvHeaven Node.js pnpm Plugin</h1>

  <p align="center">
    Environment hell, inverted.
  </p>

  <p align="center">
    <a href="#install">Install</a>
    ·
    <a href="#usage">Usage</a>
    ·
    <a href="#release-channels">Release Channels</a>
  </p>
</p>

<div align="center">

[![npm](https://img.shields.io/npm/v/@envheaven/plugins-nodejs-pnpm)](https://www.npmjs.com/package/@envheaven/plugins-nodejs-pnpm)
[![license](https://img.shields.io/npm/l/@envheaven/plugins-nodejs-pnpm)](#license)
[![plugin](https://img.shields.io/badge/envheaven-plugin-blue)](#usage)
[![status](https://img.shields.io/badge/status-experimental%200.x-orange)](#experimental-0x)

</div>

> **Experimental 0.x:** EnvHeaven is currently in experimental `0.x` development. APIs, CLI commands, plugin contracts, package names, and release behavior may change before `1.0.0`. Pin versions and read release notes before using it in production workflows.

## Install

| Channel | Install | Purpose |
|---|---|---|
| `release` | `npm install @envheaven/plugins-nodejs-pnpm@release` | recommended 0.x release track |
| `latest` | `npm install @envheaven/plugins-nodejs-pnpm` | npm default alias for the release track |
| `exp` | `npm install @envheaven/plugins-nodejs-pnpm@exp` | experimental builds with newer changes |

Install compatible `envheaven` host package in the same workflow.

## Usage

Run pnpm scripts and local pnpm exec binaries through EnvHeaven.

```jsonc
{
  "pluginPackage": "@envheaven/plugins-nodejs-pnpm",
  "Execution": {
    "cwd": "."
  }
}
```

## What it does

- `pnpm-run` for package scripts.
- `pnpm-exec` for local CLI binaries.
- readiness diagnostics before execution.
- structured process execution through the plugin host.

## Requirements

Node.js `>=20`, EnvHeaven host package, pnpm, and a target `package.json`.

## Release Channels

| Channel | Install | Purpose |
|---|---|---|
| `release` | `npm install @envheaven/plugins-nodejs-pnpm@release` | recommended 0.x release track |
| `latest` | `npm install @envheaven/plugins-nodejs-pnpm` | npm default alias for the release track |
| `exp` | `npm install @envheaven/plugins-nodejs-pnpm@exp` | experimental builds with newer changes |

`release` is the recommended 0.x track, not a stable API promise.

## Status

Experimental. Plugin contracts may change before EnvHeaven `1.0.0`.

## License

MIT, as declared in `package.json`.
