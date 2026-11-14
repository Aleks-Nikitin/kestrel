import { createAnalysisHandler } from "@/lib/api/analysis";
import { readAgentConfig } from "@/lib/agent/config";
import { createComparisonService } from "@/lib/contracts/service";
import { createRuntimeProviders } from "@/lib/providers/runtime";

export const maxDuration = 65;

export const POST = createAnalysisHandler(() => ({
  config: readAgentConfig(),
  service: createComparisonService(createRuntimeProviders()),
}));
