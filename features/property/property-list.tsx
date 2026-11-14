import { Building2 } from "lucide-react";
import { DataModeBadge } from "@/components/kestrel/badges";
import { cn } from "@/lib/utils";
import type { PropertySummaryDTO } from "@/features/dashboard/state";

export function PropertyList({
  properties,
  selectedId,
  onSelect,
}: {
  properties: PropertySummaryDTO[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  if (properties.length === 0)
    return (
      <p className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-700">
        No properties are available in the catalog.
      </p>
    );
  return (
    <ul aria-label="Properties" className="space-y-2">
      {properties.map((p) => {
        const selected = p.id === selectedId;
        return (
          <li key={p.id}>
            <button
              type="button"
              aria-pressed={selected}
              onClick={() => onSelect(p.id)}
              className={cn(
                "w-full rounded-lg border bg-white p-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600",
                selected
                  ? "border-sky-600 ring-2 ring-sky-600/30"
                  : "border-slate-200 hover:border-slate-400",
              )}
            >
              <span className="flex items-start gap-3">
                <Building2
                  className="mt-0.5 size-5 shrink-0 text-slate-500"
                  aria-hidden
                />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-slate-900">
                    {p.address.value ?? "Address unknown"}
                  </span>
                  <span className="mt-0.5 block text-xs text-slate-600">
                    {p.propertyType.value ?? "Type unknown"}
                  </span>
                  <span className="mt-2 block">
                    <DataModeBadge mode={p.dataMode} />
                  </span>
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
