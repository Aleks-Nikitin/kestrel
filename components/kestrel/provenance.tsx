import { Box, Building2, Calculator, FlaskConical, Sparkles, UserRound, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Who a piece of information comes from. Icon + words on a neutral tag, so
 * colour is never the signal. Labels follow the frozen evidence provider and
 * summary claim kinds; nothing is inferred beyond what the response states.
 */
export type ProvenanceKind =
  | "costar"
  | "matterport"
  | "vexcel"
  | "user"
  | "calculation"
  | "inference"
  | "fact"
  | "assumption"
  | "synthetic";

const KIND: Record<ProvenanceKind, { label: string; icon: LucideIcon; style?: string }> = {
  costar: { label: "CoStar", icon: Building2 },
  matterport: { label: "Matterport", icon: Box },
  vexcel: { label: "Vexcel imagery", icon: Box },
  user: { label: "Your assumption", icon: UserRound },
  calculation: { label: "Server calculation", icon: Calculator },
  inference: { label: "Inference", icon: Sparkles, style: "border-ochre-300 text-ochre-800" },
  fact: { label: "Fact", icon: Building2, style: "border-spruce-300 text-spruce-800" },
  assumption: { label: "Assumption", icon: UserRound, style: "border-ochre-300 text-ochre-800" },
  synthetic: { label: "Synthetic", icon: FlaskConical, style: "border-dashed border-ochre-600 bg-ochre-50 text-ochre-800" },
};

export const PROVENANCE_LABEL = Object.fromEntries(
  Object.entries(KIND).map(([k, v]) => [k, v.label]),
) as Record<ProvenanceKind, string>;

/** Maps the contract's evidence provider onto a chip ("model" is the AI). */
export function providerKind(provider: string): ProvenanceKind {
  switch (provider) {
    case "costar":
    case "matterport":
    case "vexcel":
    case "user":
    case "calculation":
      return provider;
    case "model":
      return "inference";
    default:
      return "calculation";
  }
}

export function ProvenanceChip({ kind, className }: { kind: ProvenanceKind; className?: string }) {
  const k = KIND[kind];
  const Icon = k.icon;
  return (
    <span
      data-provenance={kind}
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-[4px] border border-ink-200 bg-white px-1.5 py-0.5 text-xs font-medium leading-4 text-ink-700",
        k.style,
        className,
      )}
    >
      <Icon className="size-3" aria-hidden />
      {k.label}
    </span>
  );
}

export function ProvenanceLegend() {
  const kinds: ProvenanceKind[] = ["costar", "matterport", "user", "calculation", "inference", "synthetic"];
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs text-ink-600" aria-label="Where information comes from">
      <span className="font-medium">Sources:</span>
      {kinds.map((k) => (
        <ProvenanceChip key={k} kind={k} />
      ))}
    </div>
  );
}
