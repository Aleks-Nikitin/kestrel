import "server-only";
import {
  ComparisonRequest,
  ComparisonResponse,
  type ComparisonRequestDTO,
  type PropertyProvider,
  type SpatialProvider,
} from "@/lib/contracts";
import { ProviderError } from "@/lib/providers/errors";
import { calculateFinancials } from "@/lib/finance/calculate";
import { compareScenarios } from "@/lib/feasibility/compare";
import {
  normalizeScenarioInputs,
  normalizeConstraintsInputs,
} from "./normalize";
export function createComparisonService(providers: {
  property: PropertyProvider;
  spatial: SpatialProvider;
}) {
  return {
    async context(propertyId: string, signal: AbortSignal) {
      const property = await providers.property.getProperty({
        propertyId,
        signal,
      });
      if (property.id !== propertyId)
        throw new ProviderError(
          "DATA_MISMATCH",
          "Property identity does not match the selection.",
        );
      const spatial = await providers.spatial.getSpatialContext({
        property,
        signal,
      });
      return { property, spatial };
    },
    async compare(request: ComparisonRequestDTO, signal: AbortSignal) {
      const input = ComparisonRequest.parse(request);
      const property = await providers.property.getProperty({
        propertyId: input.propertyId,
        signal,
      });
      if (property.id !== input.propertyId)
        throw new ProviderError(
          "DATA_MISMATCH",
          "Property identity does not match the selection.",
        );
      const { scenarios, evidence: scenarioEvidence } = normalizeScenarioInputs(
        property,
        input.scenarios,
        { inputRevision: input.inputRevision },
      );
      const { constraints, evidence: constraintEvidence } =
        normalizeConstraintsInputs(property.id, input.constraints, {
          inputRevision: input.inputRevision,
        });
      signal.throwIfAborted();
      const results = calculateFinancials(scenarios);
      const comparison = compareScenarios(
        scenarios,
        results,
        constraints,
        property,
        input.inputRevision,
      );
      const evidence = [
        ...new Map(
          [
            ...property.evidence,
            ...scenarioEvidence,
            ...constraintEvidence,
          ].map((e) => [e.id, e]),
        ).values(),
      ];
      return ComparisonResponse.parse({
        contractVersion: "1",
        propertyId: property.id,
        inputRevision: input.inputRevision,
        scenarios,
        evidence,
        comparison,
      });
    },
  };
}
