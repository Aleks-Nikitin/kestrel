import { cn } from "@/lib/utils";
import type { PropertySummaryDTO } from "@/features/dashboard/state";
import { DATA_MODE_LABEL } from "@/features/dashboard/format";

/**
 * The property index: one ruled schedule rather than a stack of cards. Each
 * row is a real button, and the map's markers call the same selection.
 */
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
      <p className="rounded-lg border border-ink-200 bg-white p-4 text-sm text-ink-700">
        No properties are available in the catalog.
      </p>
    );
  return (
    <ul aria-label="Properties" className="overflow-hidden rounded-lg border border-ink-200 bg-white">
      {properties.map((p) => {
        const selected = p.id === selectedId;
        return (
          <li key={p.id} className="border-b border-ink-100 last:border-b-0">
            <button
              type="button"
              aria-pressed={selected}
              onClick={() => onSelect(p.id)}
              className={cn(
                "group relative block w-full cursor-pointer px-4 py-3.5 text-left transition-colors focus-visible:-outline-offset-2",
                selected ? "bg-ink-900 text-white" : "hover:bg-ink-50",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "absolute inset-y-0 left-0 w-1 transition-colors",
                  selected ? "bg-rufous-500" : "bg-transparent group-hover:bg-ink-300",
                )}
              />
              <span className={cn("block text-[15px] font-semibold leading-snug", selected ? "text-white" : "text-ink-900")}>
                {p.address.value ?? "Address unknown"}
              </span>
              <span className={cn("mt-1 flex flex-wrap items-center gap-x-2 text-xs", selected ? "text-ink-300" : "text-ink-500")}>
                <span>{p.propertyType.value ?? "Type unknown"}</span>
                <span aria-hidden className={cn("h-3 w-px", selected ? "bg-ink-600" : "bg-ink-200")} />
                <span data-mode={p.dataMode}>{DATA_MODE_LABEL[p.dataMode] ?? p.dataMode}</span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
