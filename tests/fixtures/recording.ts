import type { PropertyDTO } from "@/lib/contracts";
import { createIllustrativeInvestmentExample } from "@/lib/scenarios/illustrative-example";
/** Explicit synthetic/live test preparation, never an automatic production default. */
export function recordingModel(property: PropertyDTO) {
  const result = createIllustrativeInvestmentExample(property, 2026);
  if (!result.ok) throw new Error(result.message);
  return result.model;
}
