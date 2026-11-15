import { cn } from "@/lib/utils";
import { DATA_MODE_LABEL, ORIGIN_LABEL, type Origin } from "@/features/dashboard/format";

/*
 * Provenance is carried by a small mark plus a word, on neutral ink. Each
 * origin has its own shape so the distinction never depends on colour.
 */
const ORIGIN_MARK: Record<Origin, string> = {
  source_data: "size-2 rounded-[1px] bg-spruce-600",
  user_input: "size-2 rounded-full bg-ink-500",
  derived_calculation: "size-[7px] rotate-45 bg-ink-900",
  explicit_estimate: "size-2 rounded-full border-[1.5px] border-ochre-600",
  unknown: "size-2 rounded-full border border-dashed border-ink-400",
};

export function OriginBadge({ origin, className }: { origin: Origin; className?: string }) {
  return (
    <span
      data-origin={origin}
      className={cn("inline-flex items-center gap-1.5 whitespace-nowrap text-xs text-ink-600", className)}
    >
      <span aria-hidden className={cn("inline-block shrink-0", ORIGIN_MARK[origin])} />
      {ORIGIN_LABEL[origin]}
    </span>
  );
}

const tag =
  "inline-flex items-center gap-1 whitespace-nowrap rounded-[4px] border px-1.5 py-0.5 text-xs font-medium leading-4";

const MODE_STYLE: Record<string, string> = {
  synthetic: "border-dashed border-ochre-600 bg-ochre-50 text-ochre-800",
  live: "border-spruce-300 bg-spruce-50 text-spruce-800",
  sponsor_dataset: "border-spruce-300 bg-spruce-50 text-spruce-800",
  licensed_cache: "border-ink-300 bg-white text-ink-700",
  mixed: "border-ochre-300 bg-ochre-50 text-ochre-800",
  unavailable: "border-ink-200 bg-ink-50 text-ink-600",
};

export function DataModeBadge({ mode, prefix }: { mode: string; prefix?: string }) {
  return (
    <span className={cn(tag, MODE_STYLE[mode] ?? MODE_STYLE.unavailable)} data-mode={mode}>
      {prefix ? `${prefix}: ` : ""}
      {DATA_MODE_LABEL[mode] ?? mode}
    </span>
  );
}

const TONES = {
  slate: "border-ink-200 bg-ink-50 text-ink-700",
  green: "border-spruce-300 bg-spruce-50 text-spruce-800",
  amber: "border-ochre-300 bg-ochre-50 text-ochre-800",
  red: "border-brick-300 bg-brick-50 text-brick-800",
  blue: "border-rufous-300 bg-rufous-50 text-rufous-800",
  ink: "border-ink-900 bg-ink-900 text-buff-100",
} as const;

export function Pill({
  children,
  tone = "slate",
  className,
}: {
  children: React.ReactNode;
  tone?: keyof typeof TONES;
  className?: string;
}) {
  return <span className={cn(tag, TONES[tone], className)}>{children}</span>;
}
