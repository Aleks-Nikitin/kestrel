import "server-only";
import { randomUUID } from "node:crypto";
import { AnalysisRequest, AnalysisResponse } from "@/lib/contracts";
import { runPropertyAnalysis, type AnalysisService } from "@/lib/agent/analysis";
import type { AgentConfig } from "@/lib/agent/config";
import { failure, readJSON, success } from "./http";

export function createAnalysisHandler(dependencies: () => {
  service: AnalysisService;
  config: AgentConfig;
}) {
  return async function POST(request: Request) {
    const requestId = randomUUID();
    try {
      const input = await readJSON(request, AnalysisRequest);
      const { service, config } = dependencies();
      const result = await runPropertyAnalysis({
        request: input,
        config,
        service,
        requestId,
        signal: request.signal,
      });
      return success(AnalysisResponse, result, requestId);
    } catch (error) {
      return failure(error, requestId);
    }
  };
}
