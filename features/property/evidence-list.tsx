import type { PropertyDTO } from "@/lib/contracts";
import { Pill } from "@/components/kestrel/badges";
import { formatInstant } from "@/features/dashboard/format";

type Evidence = PropertyDTO["evidence"][number];

export function EvidenceList({
  evidence,
  title,
}: {
  evidence: Evidence[];
  title: string;
}) {
  if (evidence.length === 0) return null;
  return (
    <details className="mt-4 rounded-md border border-slate-200 p-3 text-sm">
      <summary className="cursor-pointer select-none font-medium text-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600">
        {title} ({evidence.length})
      </summary>
      <ul className="mt-2 space-y-2">
        {evidence.map((e) => (
          <li key={e.id} className="rounded bg-slate-50 p-2">
            <div className="flex flex-wrap items-center gap-2">
              <code className="text-xs text-slate-800">{e.id}</code>
              <Pill>{e.provider}</Pill>
              <Pill>{e.kind}</Pill>
              {e.synthetic ? <Pill tone="amber">Synthetic</Pill> : null}
            </div>
            <p className="mt-1 text-slate-800">{e.label}</p>
            <p className="mt-0.5 text-xs text-slate-600">
              Retrieved {formatInstant(e.retrievedAt)} · Source date{" "}
              {e.sourceAsOf ?? "not provided"}
              {e.sourceUrl ? (
                <>
                  {" · "}
                  <a
                    href={e.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                  >
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
