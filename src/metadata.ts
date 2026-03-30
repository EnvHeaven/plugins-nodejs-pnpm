import type { NodejsPnpmMetadata } from "./types";

export const metadata: NodejsPnpmMetadata = {
  name: "@envheaven/plugins/nodejs-pnpm",
  version: "0.1.0",
  description: "Spec-first pnpm execution plugin for envheaven and workspace-based Node.js projects.",
  runtime: "node",
  supportedKinds: ["pnpm-exec", "pnpm-run"],
  platforms: {
    linux: "direct",
    windows: "wsl-delegation",
  },
};
