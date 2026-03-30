export type NodejsPnpmExecutionKind = "pnpm-exec" | "pnpm-run";

export type DiagnosticSeverity = "info" | "warning" | "error";

export interface Diagnostic {
  severity: DiagnosticSeverity;
  code: string;
  message: string;
  path?: string;
  details?: Record<string, unknown>;
}

export interface SuggestedAction {
  action: string;
  description: string;
}

export interface NodejsPnpmRunSpec {
  kind: "pnpm-run";
  cwd: string;
  script: string;
  args?: string[];
  env?: Record<string, string>;
}

export interface NodejsPnpmExecSpec {
  kind: "pnpm-exec";
  cwd: string;
  bin: string;
  args?: string[];
  env?: Record<string, string>;
}

export type NodejsPnpmExecutionSpec = NodejsPnpmRunSpec | NodejsPnpmExecSpec;

export interface NodejsPnpmExecutionSpecInput {
  kind?: unknown;
  Kind?: unknown;
  cwd?: unknown;
  Cwd?: unknown;
  env?: unknown;
  Env?: unknown;
  args?: unknown;
  Args?: unknown;
  script?: unknown;
  Script?: unknown;
  bin?: unknown;
  Bin?: unknown;
  command?: unknown;
  Command?: unknown;
}

export interface NormalizedSpecResult {
  spec: NodejsPnpmExecutionSpec | null;
  diagnostics: Diagnostic[];
}

export interface NodejsPnpmInspectionDetails {
  packageDirectory?: string;
  packageJsonPath?: string;
  workspaceRoot?: string;
  dependencyRoot?: string;
  localBinPath?: string;
  execution: {
    command: string;
    args: string[];
    cwd: string;
    transport: "direct" | "wsl";
  };
}

export interface NodejsPnpmInspectResult {
  status: "ready" | "partial" | "blocked";
  diagnostics: Diagnostic[];
  suggestedActions: SuggestedAction[];
  spec: NodejsPnpmExecutionSpec | null;
  details?: NodejsPnpmInspectionDetails;
}

export interface NodejsPnpmExecuteResult extends NodejsPnpmInspectResult {
  exitCode: number;
}

export interface NodejsPnpmMetadata {
  name: string;
  version: string;
  description: string;
  runtime: "node";
  supportedKinds: NodejsPnpmExecutionKind[];
  platforms: {
    linux: "direct";
    windows: "wsl-delegation";
  };
}

export interface SpawnRequest {
  command: string;
  args: string[];
  cwd: string;
  env: Record<string, string>;
  stdio: "inherit";
  shell: false;
}

export interface SpawnResult {
  exitCode: number;
  signal: NodeJS.Signals | null;
}

export interface CommandCheckRequest {
  command: string;
  args: string[];
  cwd?: string;
}

export interface CommandCheckResult {
  ok: boolean;
  error?: string;
}

export interface RuntimeDependencies {
  platform: NodeJS.Platform;
  checkCommand(request: CommandCheckRequest): Promise<CommandCheckResult>;
  spawn(request: SpawnRequest): Promise<SpawnResult>;
}

export interface NodejsPnpmApi {
  metadata: NodejsPnpmMetadata;
  normalizeSpec(input: unknown): NormalizedSpecResult;
  inspect(input: unknown): Promise<NodejsPnpmInspectResult>;
  execute(input: unknown): Promise<NodejsPnpmExecuteResult>;
  fromEnvheavenExecution(input: unknown): NormalizedSpecResult;
}
