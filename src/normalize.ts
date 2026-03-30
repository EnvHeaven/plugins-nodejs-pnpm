import path from "node:path";
import { createDiagnostic } from "./diagnostics";
import type {
  Diagnostic,
  NodejsPnpmExecutionSpec,
  NodejsPnpmExecutionSpecInput,
  NormalizedSpecResult,
} from "./types";

export function normalizeSpec(input: unknown): NormalizedSpecResult {
  if (!isRecord(input)) {
    return {
      spec: null,
      diagnostics: [createDiagnostic("error", "spec-invalid", "Execution spec must be an object.")],
    };
  }

  const record = input as NodejsPnpmExecutionSpecInput;
  const kind = readString(record.kind, record.Kind);
  const cwd = readString(record.cwd, record.Cwd);
  const args = normalizeStringArray(record.args ?? record.Args);
  const env = normalizeStringMap(record.env ?? record.Env);
  const diagnostics: Diagnostic[] = [];

  if (!kind) {
    diagnostics.push(createDiagnostic("error", "kind-missing", "Execution spec Kind is required."));
  }

  if (!cwd) {
    diagnostics.push(createDiagnostic("error", "cwd-missing", "Execution spec cwd is required."));
  }

  if (diagnostics.length > 0) {
    return { spec: null, diagnostics };
  }

  const normalizedCwd = path.resolve(cwd as string);

  if (kind === "pnpm-run") {
    const script = readString(record.script, record.Script, record.command, record.Command);
    if (!script) {
      return {
        spec: null,
        diagnostics: [createDiagnostic("error", "script-missing", 'pnpm-run requires a "script" value.')],
      };
    }

    const spec: NodejsPnpmExecutionSpec = {
      kind,
      cwd: normalizedCwd,
      script,
      args,
      env,
    };

    return { spec, diagnostics: [] };
  }

  if (kind === "pnpm-exec") {
    const bin = readString(record.bin, record.Bin, record.command, record.Command);
    if (!bin) {
      return {
        spec: null,
        diagnostics: [createDiagnostic("error", "bin-missing", 'pnpm-exec requires a "bin" value.')],
      };
    }

    const spec: NodejsPnpmExecutionSpec = {
      kind,
      cwd: normalizedCwd,
      bin,
      args,
      env,
    };

    return { spec, diagnostics: [] };
  }

  return {
    spec: null,
    diagnostics: [
      createDiagnostic("error", "kind-unsupported", `Unsupported execution kind "${String(kind)}".`),
    ],
  };
}

function readString(...values: unknown[]): string | undefined {
  const found = values.find((value) => typeof value === "string" && value.trim().length > 0);
  return typeof found === "string" ? found.trim() : undefined;
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === "string");
}

function normalizeStringMap(value: unknown): Record<string, string> {
  if (!isRecord(value)) {
    return {};
  }

  const normalized: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === "string") {
      normalized[key] = entry;
    }
  }

  return normalized;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
