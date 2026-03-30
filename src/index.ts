import { metadata } from "./metadata";
import { normalizeSpec } from "./normalize";
import { createNodejsPnpmApi } from "./plugin";

export * from "./metadata";
export * from "./normalize";
export * from "./plugin";
export * from "./types";

const api = createNodejsPnpmApi();

export const inspect = api.inspect;
export const execute = api.execute;
export const fromEnvheavenExecution = api.fromEnvheavenExecution;
export { metadata, normalizeSpec };

export default {
  metadata,
  inspect,
  execute,
  normalizeSpec,
  fromEnvheavenExecution,
};
