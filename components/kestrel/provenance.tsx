import { Box, Building2, Calculator, FlaskConical, Sparkles, UserRound, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Who a piece of information comes from. Icon + words + colour, so colour is
 * never the only signal. Labels follow the frozen evidence provider and
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

const KIND: Record<ProvenanceKind, { label: string; icon: LucideIcon; style: string }> = {
  costar: { label: "CoStar", icon: Building2, style: "bg-emerald-50 text-emerald-900 ring-emerald-600/30" },
  matterport: { label: "Matterport", icon: Box, style: "bg-violet-50 text-violet-900 ring-violet-600/30" },
  vexcel: { label: "Vexcel imagery", icon: Box, style: "bg-cyan-50 text-cyan-900 ring-cyan-600/30" },
  user: { label: "Your assumption", icon: UserRound, style: "bg-sky-50 text-sky-900 ring-sky-600/30" },
  calculation: { label: "Server calculation", icon: Calculator, style: "bg-indigo-50 text-indigo-900 ring-indigo-600/30" },
  inference: { label: "AI inference", icon: Sparkles, style: "bg-fuchsia-50 text-fuchsia-900 ring-fuchsia-600/30" },
  fact: { label: "Fact", icon: Building2, style: "bg-emerald-50 text-emerald-900 ring-emerald-600/30" },
  assumption: { label: "Assumption", icon: UserRound, style: "bg-amber-50 text-amber-950 ring-amber-600/40" },
  synthetic: { label: "Synthetic", icon: FlaskConical, style: "bg-amber-50 text-amber-950 ring-amber-600/40 border border-dashed border-amber-600" },
};

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
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
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
    <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-700" aria-label="Where information comes from">
      <span className="font-medium">Sources:</span>
      {kinds.map((k) => (
        <ProvenanceChip key={k} kind={k} />
      ))}
    </div>
  );
}
