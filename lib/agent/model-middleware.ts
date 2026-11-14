import "server-only";
import {
  createMiddleware,
  modelFallbackMiddleware,
  modelRetryMiddleware,
  type AgentMiddleware,
} from "langchain";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import {
  AgentExecutionError,
  isTransientModelError,
  retryDelayFits,
} from "./errors";
export interface AttemptAudit {
  attempts: number;
  successfulProvider: "gemini" | "openrouter";
  fallbackUsed: boolean;
}
export function modelReliabilityMiddleware(
  primary: BaseChatModel,
  secondary: BaseChatModel | undefined,
  signal: AbortSignal,
  audit: AttemptAudit,
): AgentMiddleware[] {
  const retry = modelRetryMiddleware({
    maxRetries: 1,
    retryOn: (error) =>
      !signal.aborted && isTransientModelError(error) && retryDelayFits(error),
    initialDelayMs: 1000,
    maxDelayMs: 1000,
    jitter: false,
    onFailure: "error",
  });
  const retryHook = retry.wrapModelCall as NonNullable<
    AgentMiddleware["wrapModelCall"]
  >;
  const fallback = secondary ? modelFallbackMiddleware(secondary) : undefined;
  const routing = createMiddleware({
    name: "KestrelEligibleFallback",
    wrapModelCall: async (request, handler) => {
      signal.throwIfAborted();
      if (!secondary || !fallback?.wrapModelCall) return handler(request);
      if (audit.fallbackUsed) return handler({ ...request, model: secondary });
      let primaryError: unknown;
      return fallback.wrapModelCall(request, async (candidate) => {
        if (
          candidate.model === secondary &&
          (signal.aborted || !isTransientModelError(primaryError))
        )
          throw primaryError;
        try {
          return await handler(candidate);
        } catch (error) {
          if (candidate.model !== secondary) primaryError = error;
          throw error;
        }
      });
    },
  });
  const primaryRetry = createMiddleware({
    name: "KestrelPrimaryRetry",
    wrapModelCall: (request, handler) =>
      request.model === primary
        ? retryHook(request, handler)
        : handler(request),
  });
  const attempts = createMiddleware({
    name: "KestrelPhysicalAttemptAudit",
    wrapModelCall: async (request, handler) => {
      signal.throwIfAborted();
      if (audit.attempts >= 8)
        throw new AgentExecutionError(
          "ANALYSIS_UNAVAILABLE",
          "The model attempt limit was reached.",
        );
      audit.attempts++;
      const result = await handler({
        ...request,
        modelSettings: {
          ...request.modelSettings,
          timeout: 15000,
          maxRetries: 0,
        },
      });
      if (request.model === secondary) {
        audit.successfulProvider = "openrouter";
        audit.fallbackUsed = true;
      } else audit.successfulProvider = "gemini";
      return result;
    },
  });
  return [routing, primaryRetry, attempts];
}
