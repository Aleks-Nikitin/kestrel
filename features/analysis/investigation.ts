import type { AnalysisResponseDTO } from "@/lib/contracts";

type Complete = Extract<AnalysisResponseDTO, { status: "complete" }>;

/**
 * View-model for the investigation panel. Every field is read from the
 * AnalysisResponse the backend returned, or counted from it. Nothing here is
 * inferred, simulated or scored, and nothing is called "verified": the
 * contract currently carries no verifier result, so `verification` is always
 * null until the backend exposes one (see INVESTIGATION.md).
 */
export interface ToolStep {
  toolCallId: string;
  name: string;
  /** Display-only rewording of the backend's tool name. */
  label: string;
  evidence: { id: string; label: string; provider: string; synthetic: boolean }[];
  /** Ids the backend listed that are not in the evidence table. */
  unresolved: string[];
}

export interface ClaimSupport {
  total: number;
  facts: number;
  /** Facts that cite at least one evidence record or calculated metric. */
  factsWithCitedSupport: number;
  /** Facts that cite neither. Cited support is not verification. */
  factsWithoutCitedSupport: number;
  assumptionsAndInferences: number;
  citingMetrics: number;
}

export interface Investigation {
  steps: ToolStep[];
  /** Distinct evidence records touched by tool calls. */
  evidenceTouched: number;
  providers: string[];
  syntheticEvidence: boolean;
  claims: ClaimSupport;
  model: { id: string; provider: string; fallbackUsed: boolean; attempts: number };
  elapsedMs: number;
  requestId: string;
  dataMode: Complete["execution"]["dataMode"];
  /** Not in the contract yet: no verification state is ever shown. */
  verification: null;
}

export function toolLabel(name: string): string {
  const words = name.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/[_\-.]+/g, " ").trim();
  return words ? words[0].toUpperCase() + words.slice(1).toLowerCase() : name;
}

export function buildInvestigation(response: Complete): Investigation {
  const byId = new Map(response.evidence.map((e) => [e.id, e]));
  const steps: ToolStep[] = response.execution.completedTools.map((t) => {
    const ids = [...new Set(t.evidenceIds)];
    return {
      toolCallId: t.toolCallId,
      name: t.name,
      label: toolLabel(t.name),
      evidence: ids.flatMap((id) => {
        const e = byId.get(id);
        return e ? [{ id, label: e.label, provider: e.provider, synthetic: e.synthetic }] : [];
      }),
      unresolved: ids.filter((id) => !byId.has(id)),
    };
  });
  const touched = new Map(steps.flatMap((s) => s.evidence.map((e) => [e.id, e] as const)));
  const claims = response.summary.claims;
  const facts = claims.filter((c) => c.kind === "fact");
  const supported = facts.filter((c) => c.evidenceIds.length > 0 || c.metricRefs.length > 0);
  return {
    steps,
    evidenceTouched: touched.size,
    providers: [...new Set([...touched.values()].map((e) => e.provider))],
    syntheticEvidence: [...touched.values()].some((e) => e.synthetic),
    claims: {
      total: claims.length,
      facts: facts.length,
      factsWithCitedSupport: supported.length,
      factsWithoutCitedSupport: facts.length - supported.length,
      assumptionsAndInferences: claims.length - facts.length,
      citingMetrics: claims.filter((c) => c.metricRefs.length > 0).length,
    },
    model: {
      id: response.modelUsage.modelId,
      provider: response.modelUsage.provider,
      fallbackUsed: response.modelUsage.fallbackUsed,
      attempts: response.modelUsage.attempts,
    },
    elapsedMs: response.execution.elapsedMs,
    requestId: response.execution.requestId,
    dataMode: response.execution.dataMode,
    verification: null,
  };
}
