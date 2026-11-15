import type { ReactNode } from "react";
import {
  UNIT_LABEL,
  formatInstant,
  type DatumView,
} from "@/features/dashboard/format";
import { OriginBadge } from "./badges";

/**
 * One property or scenario field with its provenance. Unknown values are shown
 * as unknown (never as zero) together with the reason supplied by the contract.
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
    <div className="grid gap-1 border-b border-slate-200 py-3 last:border-b-0 sm:grid-cols-[11rem_1fr] sm:gap-4">
      <dt className="text-sm font-medium text-slate-600">{label}</dt>
      <dd className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {unknown ? (
            <span className="text-sm italic text-slate-600">
              Unknown — not supplied
            </span>
          ) : (
            <span className="tabular-nums text-sm font-medium text-slate-900">
              {render(datum.value as T)}
            </span>
          )}
          <OriginBadge origin={datum.origin} />
        </div>
        <details className="mt-1 text-xs text-slate-600">
          <summary className="cursor-pointer select-none rounded text-slate-600 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600">
            Provenance
          </summary>
          <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
            <dt>Unit</dt>
            <dd>{UNIT_LABEL[datum.unit] ?? datum.unit}</dd>
            <dt>Retrieved</dt>
            <dd>{formatInstant(datum.recordedAt)}</dd>
            <dt>Source date</dt>
            <dd>{datum.sourceAsOf ?? "Not provided"}</dd>
            <dt>Evidence</dt>
            <dd className="break-words">
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
      </dd>
    </div>
  );
}
