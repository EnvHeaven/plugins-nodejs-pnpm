import type { Diagnostic, DiagnosticSeverity, SuggestedAction } from "./types";

export function createDiagnostic(
  severity: DiagnosticSeverity,
  code: string,
  message: string,
  path?: string,
  details?: Record<string, unknown>,
): Diagnostic {
  return { severity, code, message, path, details };
}

export function createSuggestedAction(action: string, description: string): SuggestedAction {
  return { action, description };
}
