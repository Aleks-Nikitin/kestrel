import { ChevronDown } from "lucide-react";
import { ProvenanceChip, providerKind } from "@/components/kestrel/provenance";
import type { PropertyDTO } from "@/lib/contracts";
import { Pill } from "@/components/kestrel/badges";
import { formatInstant } from "@/features/dashboard/format";

type Evidence = PropertyDTO["evidence"][number];

/** The records a section rests on, closed by default so they never crowd the reading. */
export function EvidenceList({ evidence, title }: { evidence: Evidence[]; title: string }) {
  if (evidence.length === 0) return null;
  return (
    <details className="group rounded-lg border border-ink-200 bg-white text-sm">
      <summary className="flex cursor-pointer select-none items-center justify-between gap-3 rounded-lg px-4 py-3 font-medium text-ink-900 hover:bg-ink-50">
        <span>
          {title} <span className="figure text-ink-500">({evidence.length})</span>
        </span>
        <ChevronDown className="size-4 text-ink-500 transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <ul className="divide-y divide-ink-100 border-t border-ink-200">
        {evidence.map((e) => (
          <li key={e.id} className="px-4 py-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <ProvenanceChip kind={providerKind(e.provider)} />
              <Pill>{e.kind}</Pill>
              {e.synthetic ? <ProvenanceChip kind="synthetic" /> : null}
            </div>
            <p className="mt-1.5 text-ink-900">{e.label}</p>
            <p className="mt-0.5 text-xs text-ink-500">
              <code className="[overflow-wrap:anywhere]">{e.id}</code>
            </p>
            <p className="figure mt-0.5 text-xs text-ink-500">
              Retrieved {formatInstant(e.retrievedAt)} · Source date {e.sourceAsOf ?? "not provided"}
              {e.sourceUrl ? (
                <>
                  {" · "}
                  <a href={e.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
                    Source
                  </a>
                </>
              ) : null}
            </p>
          </li>
        ))}
      </ul>
    </details>
  );
}
