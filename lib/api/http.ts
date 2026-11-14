import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { apiResponse, type ApiErrorDTO } from "@/lib/contracts";
import { DomainInputError } from "@/lib/finance/calculate";
import { ProviderError } from "@/lib/providers/errors";
import { AgentExecutionError } from "@/lib/agent/errors";
export class HttpInputError extends Error {
  constructor(
    message: string,
    readonly status = 400,
    readonly fields?: { path: string; message: string }[],
  ) {
    super(message);
  }
}
function isAllowedOrigin(request: Request, origin: string): boolean {
  try {
    const expected = new URL(process.env.APP_ORIGIN || request.url);
    const actual = new URL(origin);
    if (actual.origin !== origin) return false;
    if (actual.origin === expected.origin) return true;
    const loopback = new Set(["localhost", "127.0.0.1", "[::1]"]);
    return loopback.has(expected.hostname) && loopback.has(actual.hostname)
      && actual.protocol === expected.protocol && actual.port === expected.port;
  } catch {
    return false;
  }
}
export async function readJSON<T extends z.ZodType>(
  request: Request,
  schema: T,
): Promise<z.infer<T>> {
  const origin = request.headers.get("origin");
  if (origin && !isAllowedOrigin(request, origin))
    throw new HttpInputError("The request origin is not allowed.", 403);
  if (
    !request.headers
      .get("content-type")
      ?.toLowerCase()
      .startsWith("application/json")
  )
    throw new HttpInputError("Content-Type must be application/json.", 415);
  const cap = 200000;
  if (Number(request.headers.get("content-length")) > cap)
    throw new HttpInputError("The request exceeds the 200 KB limit.", 413);
  if (!request.body)
    throw new HttpInputError("A JSON request body is required.");
  const reader = request.body.getReader();
  const signal = AbortSignal.any([request.signal, AbortSignal.timeout(5000)]);
  const cancelRead = () => { void reader.cancel(signal.reason).catch(() => {}); };
  signal.addEventListener("abort", cancelRead, { once: true });
  let size = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      signal.throwIfAborted();
      const chunk = await reader.read();
      signal.throwIfAborted();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > cap) {
        await reader.cancel();
        throw new HttpInputError("The request exceeds the 200 KB limit.", 413);
      }
      chunks.push(chunk.value);
    }
  } finally {
    signal.removeEventListener("abort", cancelRead);
    reader.releaseLock();
  }
  let data: unknown;
  try {
    data = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new HttpInputError("The request contains invalid JSON.");
  }
  const result = schema.safeParse(data);
  if (!result.success)
    throw new HttpInputError(
      "The request does not match the input contract.",
      400,
      result.error.issues
        .map((i) => ({ path: i.path.join("."), message: i.message }))
        .slice(0, 30),
    );
  return result.data;
}
const headers = { "Cache-Control": "private, no-store" };
export function success<T extends z.ZodType>(
  schema: T,
  data: z.infer<T>,
  requestId = randomUUID(),
) {
  const parsed = apiResponse(schema).safeParse({ ok: true, data, requestId });
  if (!parsed.success)
    return failure(new Error("Response contract mismatch"), requestId);
  return Response.json(parsed.data, { headers });
}
export function failure(error: unknown, requestId = randomUUID()) {
  let code: ApiErrorDTO["code"] = "INTERNAL",
    message = "The request could not be completed.",
    retryable = false,
    status = 500,
    fieldErrors: ApiErrorDTO["fieldErrors"];
  if (error instanceof HttpInputError) {
    code = "INVALID_INPUT";
    message = error.message;
    status = error.status;
    fieldErrors = error.fields;
  } else if (error instanceof DomainInputError) {
    code = "INVALID_INPUT";
    message = error.message;
    status = 400;
  } else if (error instanceof ProviderError) {
    code = error.code;
    message = error.message;
    retryable = error.retryable;
    status = {
      INVALID_INPUT: 400,
      NOT_FOUND: 404,
      UPSTREAM_AUTH: 502,
      UPSTREAM_UNAVAILABLE: 502,
      TIMEOUT: 504,
      RATE_LIMITED: 429,
      DATA_MISMATCH: 409,
      LICENSE_RESTRICTED: 403,
    }[code];
  } else if (
    error instanceof Error &&
    ["AbortError", "TimeoutError"].includes(error.name)
  ) {
    code = "TIMEOUT";
    message = "The request was cancelled or exceeded its deadline.";
    status = 504;
    retryable = true;
  } else if (error instanceof AgentExecutionError) {
    code = error.code as ApiErrorDTO["code"];
    message = error.message;
    status = code === "INVALID_INPUT" ? 400 : code === "LICENSE_RESTRICTED" ? 403 : code === "TIMEOUT" ? 504 : 503;
    retryable = error.retryable;
  }
  return Response.json(
    {
      ok: false,
      error: {
        code,
        message,
        retryable,
        requestId,
        ...(fieldErrors ? { fieldErrors } : {}),
      },
    },
    { status, headers },
  );
}
