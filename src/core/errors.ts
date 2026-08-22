export type FoundryErrorCode =
  | "INVALID_ARTIFACT"
  | "INVALID_TRANSITION"
  | "ACCESS_DENIED"
  | "LICENSE_REJECTED"
  | "SECURITY_REJECTED"
  | "SOURCE_UNAVAILABLE"
  | "NO_FEASIBLE_COMPONENT_SET"
  | "AUDIT_FAILED"
  | "RUN_NOT_FOUND";

export class FoundryError extends Error {
  readonly code: FoundryErrorCode;
  readonly details: unknown;

  constructor(code: FoundryErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = "FoundryError";
    this.code = code;
    this.details = details;
  }
}
