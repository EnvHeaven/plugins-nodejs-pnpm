import fs from "node:fs/promises";
import { spawn, spawnSync } from "node:child_process";
import path from "node:path";
import { createDiagnostic, createSuggestedAction } from "./diagnostics";
import { metadata } from "./metadata";
import { normalizeSpec } from "./normalize";
import type {
  CommandCheckRequest,
  CommandCheckResult,
  Diagnostic,
  NodejsPnpmApi,
  NodejsPnpmExecuteResult,
  NodejsPnpmExecutionSpec,
  NodejsPnpmInspectResult,
  NodejsPnpmInspectionDetails,
  RuntimeDependencies,
  SpawnRequest,
  SpawnResult,
  SuggestedAction,
} from "./types";

export function createNodejsPnpmApi(overrides: Partial<RuntimeDependencies> = {}): NodejsPnpmApi {
  const runtime = createRuntimeDependencies(overrides);

  return {
    metadata,
    normalizeSpec,
    inspect: async (input) => await inspectWithRuntime(input, runtime),
    execute: async (input) => await executeWithRuntime(input, runtime),
    fromEnvheavenExecution: (input) => normalizeSpec(input),
  };
}

export async function inspectWithRuntime(
  input: unknown,
  runtime: RuntimeDependencies,
): Promise<NodejsPnpmInspectResult> {
  const normalized = normalizeSpec(input);
  const diagnostics = [...normalized.diagnostics];
  const suggestedActions: SuggestedAction[] = [];

  if (!normalized.spec) {
    return {
      status: "blocked",
      diagnostics,
      suggestedActions,
      spec: null,
    };
  }

  const spec = normalized.spec;
  const execution = buildExecutionShape(spec, runtime.platform);
  const cwdExists = await pathExists(spec.cwd);

  if (!cwdExists) {
    diagnostics.push(
      createDiagnostic("error", "cwd-missing", `Working directory "${spec.cwd}" does not exist.`, spec.cwd),
    );
    suggestedActions.push(
      createSuggestedAction("create-cwd", "Create the target working directory or correct the cwd in the spec."),
    );
    return blocked(spec, diagnostics, suggestedActions, execution);
  }

  if (runtime.platform === "win32") {
    await pushCommandDiagnostic(
      diagnostics,
      suggestedActions,
      await runtime.checkCommand({ command: "wsl", args: ["pwd"] }),
      "wsl",
      spec.cwd,
      "Install and configure WSL on the host before invoking this plugin from Windows.",
      "wsl-install",
    );
  }

  await pushCommandDiagnostic(
    diagnostics,
    suggestedActions,
    await runtime.checkCommand({
      command: commandForPlatform("node", runtime.platform),
      args: argsForPlatform("node", runtime.platform),
    }),
    "node",
    spec.cwd,
    "Install Node.js in the target Linux environment before using this plugin.",
    "node-install",
  );

  await pushCommandDiagnostic(
    diagnostics,
    suggestedActions,
    await runtime.checkCommand({
      command: commandForPlatform("pnpm", runtime.platform),
      args: argsForPlatform("pnpm", runtime.platform),
    }),
    "pnpm",
    spec.cwd,
    "Install pnpm in the target Linux environment before using this plugin.",
    "pnpm-install",
  );

  const packageJsonPath = await findNearestFile(spec.cwd, "package.json");
  if (!packageJsonPath) {
    diagnostics.push(
      createDiagnostic("error", "package-json-missing", `No package.json was found from "${spec.cwd}" upward.`, spec.cwd),
    );
    suggestedActions.push(
      createSuggestedAction("add-package-json", "Create a package.json in the project or point cwd at the correct package directory."),
    );
    return blocked(spec, diagnostics, suggestedActions, execution);
  }

  const packageDirectory = path.dirname(packageJsonPath);
  const workspaceRoot = await findNearestFile(spec.cwd, "pnpm-workspace.yaml");
  const workspaceDirectory = workspaceRoot ? path.dirname(workspaceRoot) : undefined;
  const packageJson = await readJsonFile(packageJsonPath);

  if (!packageJson || typeof packageJson !== "object") {
    diagnostics.push(
      createDiagnostic("error", "package-json-invalid", `Failed to read package.json at "${packageJsonPath}".`, packageJsonPath),
    );
    suggestedActions.push(
      createSuggestedAction("fix-package-json", "Fix the package.json file so it contains valid JSON."),
    );
    return blocked(spec, diagnostics, suggestedActions, execution);
  }

  const dependencyRoot = await resolveDependencyRoot(spec.cwd, packageDirectory, workspaceDirectory);
  if (!dependencyRoot) {
    diagnostics.push(
      createDiagnostic(
        "warning",
        "dependencies-missing",
        "No node_modules directory was found in the package or workspace tree.",
        packageDirectory,
      ),
    );
    suggestedActions.push(
      createSuggestedAction("install-dependencies", "Run pnpm install in the workspace or package directory before executing this spec."),
    );
  }

  let localBinPath: string | undefined;

  if (spec.kind === "pnpm-run") {
    const scripts = readScripts(packageJson);
    if (!(spec.script in scripts)) {
      diagnostics.push(
        createDiagnostic(
          "warning",
          "script-missing",
          `Script "${spec.script}" is not defined in "${packageJsonPath}".`,
          packageJsonPath,
        ),
      );
      suggestedActions.push(
        createSuggestedAction("add-script", `Add a "${spec.script}" script to package.json or change the spec to an existing script.`),
      );
    }
  } else {
    localBinPath = await findLocalBin(spec.bin, spec.cwd, packageDirectory, workspaceDirectory);
    if (!localBinPath) {
      diagnostics.push(
        createDiagnostic(
          "warning",
          "local-cli-missing",
          `CLI "${spec.bin}" is not resolvable from local node_modules/.bin entries.`,
          packageDirectory,
        ),
      );
      suggestedActions.push(
        createSuggestedAction("install-cli", `Add the package that provides "${spec.bin}" to the workspace or package dependencies and run pnpm install.`),
      );
    }
  }

  return {
    status: calculateStatus(diagnostics),
    diagnostics,
    suggestedActions,
    spec,
    details: {
      packageDirectory,
      packageJsonPath,
      workspaceRoot: workspaceDirectory,
      dependencyRoot,
      localBinPath,
      execution,
    },
  };
}

export async function executeWithRuntime(
  input: unknown,
  runtime: RuntimeDependencies,
): Promise<NodejsPnpmExecuteResult> {
  const inspection = await inspectWithRuntime(input, runtime);

  if (!inspection.spec || inspection.status !== "ready") {
    return {
      ...inspection,
      exitCode: 1,
    };
  }

  const request = createSpawnRequest(inspection.spec, runtime.platform);

  try {
    const result = await runtime.spawn(request);
    return {
      ...inspection,
      exitCode: result.exitCode,
      diagnostics: appendSignalDiagnostic(inspection.diagnostics, result),
    };
  } catch (error) {
    return {
      ...inspection,
      status: "blocked",
      exitCode: 1,
      diagnostics: [
        ...inspection.diagnostics,
        createDiagnostic(
          "error",
          "spawn-failed",
          error instanceof Error ? error.message : "Process spawning failed.",
          inspection.spec.cwd,
        ),
      ],
      suggestedActions: [
        ...inspection.suggestedActions,
        createSuggestedAction("retry-execution", "Review the spawn diagnostics and retry after fixing the failing runtime precondition."),
      ],
    };
  }
}

function createRuntimeDependencies(overrides: Partial<RuntimeDependencies>): RuntimeDependencies {
  return {
    platform: overrides.platform ?? process.platform,
    checkCommand: overrides.checkCommand ?? defaultCheckCommand,
    spawn: overrides.spawn ?? defaultSpawn,
  };
}

async function defaultCheckCommand(request: CommandCheckRequest): Promise<CommandCheckResult> {
  const result = spawnSync(request.command, request.args, {
    cwd: request.cwd,
    stdio: "ignore",
    shell: false,
  });

  if (result.error) {
    return {
      ok: false,
      error: result.error.message,
    };
  }

  return {
    ok: result.status === 0,
    error: result.status === 0 ? undefined : `Command exited with status ${String(result.status)}.`,
  };
}

async function defaultSpawn(request: SpawnRequest): Promise<SpawnResult> {
  return await new Promise<SpawnResult>((resolve, reject) => {
    const child = spawn(request.command, request.args, {
      cwd: request.cwd,
      env: {
        ...process.env,
        ...request.env,
      },
      stdio: request.stdio,
      shell: request.shell,
    });

    child.on("error", reject);
    child.on("close", (exitCode, signal) => {
      resolve({
        exitCode: exitCode ?? 1,
        signal,
      });
    });
  });
}

function createSpawnRequest(spec: NodejsPnpmExecutionSpec, platform: NodeJS.Platform): SpawnRequest {
  const commandArgs = spec.kind === "pnpm-run" ? ["run", spec.script, ...(spec.args ?? [])] : ["exec", spec.bin, ...(spec.args ?? [])];

  if (platform === "win32") {
    const wslCwd = toWslPath(spec.cwd);
    const envArguments = Object.entries(spec.env ?? {}).map(([key, value]) => `${key}=${value}`);

    return {
      command: "wsl",
      args: ["--cd", wslCwd, "env", ...envArguments, "pnpm", ...commandArgs],
      cwd: spec.cwd,
      env: {},
      stdio: "inherit",
      shell: false,
    };
  }

  return {
    command: "pnpm",
    args: commandArgs,
    cwd: spec.cwd,
    env: spec.env ?? {},
    stdio: "inherit",
    shell: false,
  };
}

function buildExecutionShape(
  spec: NodejsPnpmExecutionSpec,
  platform: NodeJS.Platform,
): NodejsPnpmInspectionDetails["execution"] {
  const request = createSpawnRequest(spec, platform);
  return {
    command: request.command,
    args: request.args,
    cwd: request.cwd,
    transport: platform === "win32" ? "wsl" : "direct",
  };
}

async function pushCommandDiagnostic(
  diagnostics: Diagnostic[],
  suggestedActions: SuggestedAction[],
  result: CommandCheckResult,
  toolName: string,
  cwd: string,
  description: string,
  action: string,
): Promise<void> {
  if (result.ok) {
    return;
  }

  diagnostics.push(
    createDiagnostic("error", `${toolName}-missing`, `${toolName} is not available: ${result.error ?? "command lookup failed."}`, cwd),
  );
  suggestedActions.push(createSuggestedAction(action, description));
}

function commandForPlatform(command: "node" | "pnpm", platform: NodeJS.Platform): string {
  return platform === "win32" ? "wsl" : command;
}

function argsForPlatform(command: "node" | "pnpm", platform: NodeJS.Platform): string[] {
  return platform === "win32" ? [command, "--version"] : ["--version"];
}

function blocked(
  spec: NodejsPnpmExecutionSpec,
  diagnostics: Diagnostic[],
  suggestedActions: SuggestedAction[],
  execution: NodejsPnpmInspectionDetails["execution"],
): NodejsPnpmInspectResult {
  return {
    status: "blocked",
    diagnostics,
    suggestedActions,
    spec,
    details: {
      execution,
    },
  };
}

function calculateStatus(diagnostics: Diagnostic[]): "ready" | "partial" | "blocked" {
  if (diagnostics.some((diagnostic) => diagnostic.severity === "error")) {
    return "blocked";
  }

  if (diagnostics.some((diagnostic) => diagnostic.severity === "warning")) {
    return "partial";
  }

  return "ready";
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function findNearestFile(startDirectory: string, fileName: string): Promise<string | undefined> {
  let current = startDirectory;

  while (true) {
    const candidate = path.join(current, fileName);
    if (await pathExists(candidate)) {
      return candidate;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      return undefined;
    }

    current = parent;
  }
}

async function readJsonFile(filePath: string): Promise<unknown> {
  try {
    const contents = await fs.readFile(filePath, "utf8");
    return JSON.parse(contents) as unknown;
  } catch {
    return undefined;
  }
}

function readScripts(packageJson: object): Record<string, string> {
  const scripts = Reflect.get(packageJson, "scripts");
  if (typeof scripts !== "object" || scripts === null || Array.isArray(scripts)) {
    return {};
  }

  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(scripts)) {
    if (typeof value === "string") {
      normalized[key] = value;
    }
  }

  return normalized;
}

async function resolveDependencyRoot(
  cwd: string,
  packageDirectory: string,
  workspaceDirectory?: string,
): Promise<string | undefined> {
  const candidates = unique([...(await collectAncestorDirectories(cwd, packageDirectory)), workspaceDirectory]);

  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }

    const nodeModules = path.join(candidate, "node_modules");
    if (await pathExists(nodeModules)) {
      return candidate;
    }
  }

  return undefined;
}

async function findLocalBin(
  binName: string,
  cwd: string,
  packageDirectory: string,
  workspaceDirectory?: string,
): Promise<string | undefined> {
  const candidates = unique([...(await collectAncestorDirectories(cwd, packageDirectory)), workspaceDirectory]);

  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }

    for (const suffix of ["", ".cmd", ".ps1"]) {
      const target = path.join(candidate, "node_modules", ".bin", `${binName}${suffix}`);
      if (await pathExists(target)) {
        return target;
      }
    }
  }

  return undefined;
}

async function collectAncestorDirectories(startDirectory: string, stopDirectory: string): Promise<string[]> {
  const entries: string[] = [];
  let current = startDirectory;

  while (true) {
    entries.push(current);
    if (current === stopDirectory) {
      return entries;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      return entries;
    }

    current = parent;
  }
}

function unique(values: Array<string | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => typeof value === "string"))];
}

function toWslPath(windowsPath: string): string {
  const resolved = path.win32.resolve(windowsPath);
  const drive = resolved.slice(0, 1).toLowerCase();
  const tail = resolved.slice(2).replace(/\\/g, "/");
  return `/mnt/${drive}${tail}`;
}

function appendSignalDiagnostic(diagnostics: Diagnostic[], result: SpawnResult): Diagnostic[] {
  if (!result.signal) {
    return diagnostics;
  }

  return [
    ...diagnostics,
    createDiagnostic("warning", "process-signal", `Process exited from signal "${result.signal}".`),
  ];
}
