import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { UNIT_LABEL, formatInstant, type DatumView } from "@/features/dashboard/format";
import { OriginBadge } from "./badges";

/**
 * One property field with its provenance, as a ledger line. Unknown values are
 * stated as unknown (never as zero) with the reason supplied by the contract.
 */
export function DatumRow<T>({
  label,
  datum,
  render,
}: {
  label: string;
  datum: DatumView<T>;
  render: (value: T) => ReactNode;
}) {
  const unknown = datum.value === null;
  return (
    <div className="border-b border-ink-100 py-2.5 last:border-b-0">
      <details className="group">
        <summary className="grid cursor-pointer grid-cols-[minmax(0,9.5rem)_minmax(0,1fr)_auto] items-baseline gap-x-4 gap-y-0.5 rounded-sm max-sm:grid-cols-[minmax(0,1fr)_auto]">
          <span className="type-label max-sm:col-span-2">{label}</span>
          <span className="min-w-0">
            {unknown ? (
              <span className="text-sm text-ink-500">Unknown — not supplied</span>
            ) : (
              <span className="figure text-[15px] font-semibold text-ink-900 [overflow-wrap:anywhere]">
                {render(datum.value as T)}
              </span>
            )}
          </span>
          <span className="flex items-center gap-2">
            <OriginBadge origin={datum.origin} />
            <ChevronDown className="size-3.5 text-ink-400 transition-transform group-open:rotate-180" aria-hidden />
            <span className="sr-only">Provenance</span>
          </span>
        </summary>
        <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-0.5 rounded-md bg-ink-50 px-3 py-2 text-xs text-ink-600 sm:ml-[10.5rem]">
          <dt>Unit</dt>
          <dd>{UNIT_LABEL[datum.unit] ?? datum.unit}</dd>
          <dt>Retrieved</dt>
          <dd className="figure">{formatInstant(datum.recordedAt)}</dd>
          <dt>Source date</dt>
          <dd className="figure">{datum.sourceAsOf ?? "Not provided"}</dd>
          <dt>Evidence</dt>
          <dd className="[overflow-wrap:anywhere]">
            {datum.evidenceIds.length ? datum.evidenceIds.join(", ") : "None"}
          </dd>
          {datum.note ? (
            <>
              <dt>Note</dt>
              <dd>{datum.note}</dd>
            </>
          ) : null}
        </dl>
      </details>
    </div>
  );
}
