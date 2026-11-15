import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { STAGES, type StageId } from "./stages";

export interface StageStatus {
  /** Short live state, e.g. "37 open", "Out of date", "Verified". */
  text: string;
  tone: "quiet" | "attention" | "good";
  /** The stage's work is finished for the current inputs. */
  done?: boolean;
}

const TONE: Record<StageStatus["tone"], string> = {
  quiet: "text-ink-300",
  attention: "text-ochre-300",
  good: "text-spruce-300",
};

/**
 * The numbered workflow. Real links to hash targets, so it works with the
 * keyboard, the Back button and without script; numbers are shown because the
 * stages genuinely are a sequence.
 */
export function StageNav({
  stage,
  available,
  status,
}: {
  stage: StageId;
  available: ReadonlySet<StageId>;
  status: Partial<Record<StageId, StageStatus>>;
}) {
  return (
    <nav aria-label="Workflow" className="min-w-0">
      <ol className="flex items-stretch gap-0.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {STAGES.map((s, i) => {
          const current = s.id === stage;
          const st = status[s.id];
          const body = (
            <>
              <span
                aria-hidden
                className={cn(
                  "figure grid size-5 shrink-0 place-items-center rounded-full text-[11px] font-semibold",
                  current
                    ? "bg-rufous-500 text-white"
                    : st?.done
                      ? "bg-spruce-600 text-white"
                      : "border border-ink-500 text-ink-300",
                )}
              >
                {st?.done && !current ? <Check className="size-3" strokeWidth={3} /> : i + 1}
              </span>
              <span className="flex flex-col leading-tight">
                <span className="text-[13px] font-semibold">{s.label}</span>
                {st ? (
                  <span className={cn("figure text-[11px] font-medium", TONE[st.tone])} data-testid={`stage-status-${s.id}`}>
                    {st.text}
                  </span>
                ) : null}
              </span>
            </>
          );
          const shape = "relative flex min-h-12 shrink-0 items-center gap-2 px-3 sm:px-3.5";
          return (
            <li key={s.id} className="flex shrink-0">
              {available.has(s.id) ? (
                <a
                  href={`#${s.id}`}
                  aria-current={current ? "step" : undefined}
                  title={s.does}
                  className={cn(
                    shape,
                    "transition-colors focus-visible:outline-buff-200 focus-visible:-outline-offset-2",
                    current
                      ? "text-white after:absolute after:inset-x-3 after:bottom-0 after:h-[3px] after:bg-rufous-500"
                      : "text-ink-200 hover:bg-white/5 hover:text-white",
                  )}
                >
                  {body}
                </a>
              ) : (
                <span aria-disabled="true" title="Select a property first" className={cn(shape, "cursor-not-allowed text-ink-500 [&_span]:border-ink-700 [&_span]:text-ink-500")}>
                  {body}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
