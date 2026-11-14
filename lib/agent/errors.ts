import "server-only";
export type AgentErrorCode =
  | "ANALYSIS_UNAVAILABLE"
  | "UPSTREAM_AUTH"
  | "TIMEOUT"
  | "INVALID_INPUT"
  | "LICENSE_RESTRICTED";
export class AgentExecutionError extends Error {
  constructor(
    readonly code: AgentErrorCode,
    message: string,
    readonly retryable = false,
  ) {
    super(message);
    this.name = "AgentExecutionError";
  }
}
function record(error: unknown): Record<string, unknown> {
  return error && typeof error === "object"
    ? (error as Record<string, unknown>)
    : {};
}
export function modelErrorStatus(error: unknown): number | undefined {
  const e = record(error),
    response = record(e.response);
  const code = e.status ?? e.statusCode ?? response.status;
  return typeof code === "number" ? code : undefined;
}
export function isTransientModelError(error: unknown): boolean {
  if (error instanceof AgentExecutionError) return false;
  const status = modelErrorStatus(error);
  if (status !== undefined)
    return status === 429 || (status >= 500 && status <= 599);
  const e = record(error);
  const cause = record(e.cause);
  return (
    ["TimeoutError", "AbortError", "FetchError"].includes(String(e.name)) ||
    ["ECONNRESET", "ETIMEDOUT", "EAI_AGAIN"].includes(
      String(e.code ?? cause.code),
    )
  );
}
export function retryDelayFits(error: unknown): boolean {
  const response = record(record(error).response),
    headers = response.headers ?? record(error).headers;
  let value: unknown;
  if (
    headers &&
    typeof headers === "object" &&
    "get" in headers &&
    typeof headers.get === "function"
  )
    value = headers.get("retry-after");
  else value = record(headers)["retry-after"];
  if (value == null) return true;
  const seconds = Number(value);
  // The native retry waits one second. Longer or date-form delays skip the retry,
  // allowing an eligible configured fallback to fit the unchanged request deadline.
  return Number.isFinite(seconds) && seconds >= 0 && seconds <= 1;
}
export function safeAgentError(
  error: unknown,
  timedOut = false,
): AgentExecutionError {
  if (error instanceof AgentExecutionError) return error;
  if (timedOut)
    return new AgentExecutionError(
      "TIMEOUT",
      "Analysis exceeded its request deadline.",
      true,
    );
  if ([401, 403].includes(modelErrorStatus(error) ?? 0))
    return new AgentExecutionError(
      "UPSTREAM_AUTH",
      "The model credentials or access were rejected.",
    );
  return new AgentExecutionError(
    "ANALYSIS_UNAVAILABLE",
    "AI analysis is unavailable. Required tool execution was not verified.",
    isTransientModelError(error),
  );
}
