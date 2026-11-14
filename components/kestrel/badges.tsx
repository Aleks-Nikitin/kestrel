import { cn } from "@/lib/utils";
import {
  DATA_MODE_LABEL,
  ORIGIN_LABEL,
  type Origin,
} from "@/features/dashboard/format";

// Plain Tailwind palette on purpose: the shared stylesheet does not define
// shadcn theme tokens yet, so token-based variants would render unstyled.
const ORIGIN_STYLE: Record<Origin, string> = {
  source_data: "bg-emerald-50 text-emerald-800 ring-emerald-600/30",
  user_input: "bg-sky-50 text-sky-800 ring-sky-600/30",
  derived_calculation: "bg-indigo-50 text-indigo-800 ring-indigo-600/30",
  explicit_estimate: "bg-amber-50 text-amber-900 ring-amber-600/40",
  unknown: "bg-slate-100 text-slate-700 ring-slate-500/30 border-dashed",
};

const pill =
  "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset whitespace-nowrap";

export function OriginBadge({ origin }: { origin: Origin }) {
  return (
    <span className={cn(pill, ORIGIN_STYLE[origin])} data-origin={origin}>
      {ORIGIN_LABEL[origin]}
    </span>
  );
}

const MODE_STYLE: Record<string, string> = {
  synthetic: "bg-fuchsia-50 text-fuchsia-900 ring-fuchsia-600/40",
  live: "bg-emerald-50 text-emerald-800 ring-emerald-600/30",
  sponsor_dataset: "bg-emerald-50 text-emerald-800 ring-emerald-600/30",
  licensed_cache: "bg-sky-50 text-sky-800 ring-sky-600/30",
  mixed: "bg-amber-50 text-amber-900 ring-amber-600/40",
  unavailable: "bg-slate-100 text-slate-700 ring-slate-500/30",
};

export function DataModeBadge({
  mode,
  prefix,
}: {
  mode: string;
  prefix?: string;
}) {
  return (
    <span
      className={cn(pill, MODE_STYLE[mode] ?? MODE_STYLE.unavailable)}
      data-mode={mode}
    >
      {prefix ? `${prefix}: ` : ""}
      {DATA_MODE_LABEL[mode] ?? mode}
    </span>
  );
}

export function Pill({
  children,
  tone = "slate",
}: {
  children: React.ReactNode;
  tone?: "slate" | "green" | "amber" | "red" | "blue";
}) {
  const tones = {
    slate: "bg-slate-100 text-slate-700 ring-slate-500/30",
    green: "bg-emerald-50 text-emerald-800 ring-emerald-600/30",
    amber: "bg-amber-50 text-amber-900 ring-amber-600/40",
    red: "bg-red-50 text-red-800 ring-red-600/30",
    blue: "bg-sky-50 text-sky-800 ring-sky-600/30",
  } as const;
  return <span className={cn(pill, tones[tone])}>{children}</span>;
}
