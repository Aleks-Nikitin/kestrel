import "server-only";
import { z } from "zod";
const optionalSecret = z.string().trim().min(1).optional();
const flag = z
  .enum(["true", "false"])
  .default("false")
  .transform((value) => value === "true");
const Environment = z.object({
  GOOGLE_API_KEY: optionalSecret,
  OPENROUTER_API_KEY: optionalSecret,
  GEMINI_MODEL: z.string().min(1).default("gemini-3.1-flash-lite"),
  FALLBACK_MODEL_ID: z.string().min(1).default("anthropic/claude-haiku-5.5"),
  ANALYSIS_ENABLED: flag,
  FALLBACK_ENABLED: flag,
  SPONSOR_DATA_PROCESSING_PERMITTED: flag,
  FALLBACK_SPONSOR_DATA_PERMITTED: flag,
});
export interface AgentConfig {
  googleApiKey?: string;
  openRouterApiKey?: string;
  primaryModelId: string;
  fallbackModelId: string;
  analysisEnabled: boolean;
  fallbackEnabled: boolean;
  sponsorDataProcessingPermitted: boolean;
  fallbackSponsorDataPermitted: boolean;
}
export function readAgentConfig(
  environment: Record<string, string | undefined> = process.env,
): AgentConfig {
  const cleaned = Object.fromEntries(
    Object.entries(environment).map(([key, value]) => [
      key,
      value?.trim() || undefined,
    ]),
  );
  const result = Environment.safeParse(cleaned);
  if (!result.success)
    throw new Error(
      "Agent environment configuration is invalid; verify model IDs and boolean switches.",
    );
  const e = result.data;
  return {
    googleApiKey: e.GOOGLE_API_KEY,
    openRouterApiKey: e.OPENROUTER_API_KEY,
    primaryModelId: e.GEMINI_MODEL,
    fallbackModelId: e.FALLBACK_MODEL_ID,
    analysisEnabled: e.ANALYSIS_ENABLED,
    fallbackEnabled: e.FALLBACK_ENABLED && !!e.OPENROUTER_API_KEY,
    sponsorDataProcessingPermitted: e.SPONSOR_DATA_PROCESSING_PERMITTED,
    fallbackSponsorDataPermitted: e.FALLBACK_SPONSOR_DATA_PERMITTED,
  };
}
export function fallbackAvailability(
  config: AgentConfig,
): "configured" | "unavailable: not configured" | "disabled" {
  return !config.openRouterApiKey
    ? "unavailable: not configured"
    : config.fallbackEnabled
      ? "configured"
      : "disabled";
}
