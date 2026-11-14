export type ProviderErrorCode =
  | "INVALID_INPUT"
  | "NOT_FOUND"
  | "UPSTREAM_AUTH"
  | "UPSTREAM_UNAVAILABLE"
  | "TIMEOUT"
  | "RATE_LIMITED"
  | "DATA_MISMATCH"
  | "LICENSE_RESTRICTED";
/** Safe errors deliberately exclude upstream payloads, credentials and local paths. */
export class ProviderError extends Error {
  constructor(
    readonly code: ProviderErrorCode,
    message: string,
    readonly retryable = false,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}
