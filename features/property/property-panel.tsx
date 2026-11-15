import type { PropertyDTO } from "@/lib/contracts";
import { DataModeBadge, Pill } from "@/components/kestrel/badges";
import { DatumRow } from "@/components/kestrel/datum-row";
import {
  formatByUnit,
  formatCoordinates,
  formatInstant,
} from "@/features/dashboard/format";
import { EvidenceList } from "./evidence-list";

export function PropertyPanel({ property }: { property: PropertyDTO }) {
  return (
    <section
      aria-labelledby="property-heading"
      className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2
            id="property-heading"
            tabIndex={-1}
            className="text-xl font-semibold tracking-tight text-slate-900 outline-none [overflow-wrap:anywhere]"
          >
            {property.address.value ?? "Property (address unknown)"}
          </h2>
          {subtitle(property) ? (
            <p className="mt-0.5 text-sm text-slate-600">{subtitle(property)}</p>
          ) : null}
        </div>
        <DataModeBadge mode={property.dataMode} prefix="Property data" />
      </div>
      <dl className="mt-3">
        <DatumRow label="Address" datum={property.address} render={(v) => v} />
        <DatumRow
          label="Location"
          datum={property.location}
          render={formatCoordinates}
        />
        <DatumRow label="Property type" datum={property.propertyType} render={(v) => v} />
        <DatumRow label="Existing use" datum={property.existingUse} render={(v) => v} />
        <DatumRow
          label="Gross area"
          datum={property.grossAreaSqft}
          render={(v) => formatByUnit(v, "sqft")}
        />
        <DatumRow
          label="Rentable area"
          datum={property.rentableAreaSqft}
          render={(v) => formatByUnit(v, "sqft")}
        />
        <DatumRow label="Year built" datum={property.yearBuilt} render={(v) => String(v)} />
        <DatumRow label="Floors" datum={property.floors} render={(v) => String(v)} />
        <DatumRow
          label="Occupancy"
          datum={property.occupancyRatio}
          render={(v) => formatByUnit(v, "ratio")}
        />
        <DatumRow
          label="Market rent"
          datum={property.marketRentAnnualPerSqft}
          render={(v) => formatByUnit(v, "USD/sqft/year")}
        />
        <DatumRow
          label="Market description"
          datum={property.marketDescription}
          render={(v) => v}
        />
      </dl>

      <h3 className="mt-6 border-t border-slate-200 pt-5 text-sm font-semibold uppercase tracking-wide text-slate-700">
        Documented legal and physical constraints
      </h3>
      {property.documentedConstraints.length === 0 ? (
        <p className="mt-1 text-sm text-slate-700">
          None were supplied. This means legal and physical feasibility is{" "}
          <strong>unverified</strong>, not that the property is unrestricted.
        </p>
      ) : (
        <ul className="mt-2 space-y-2">
          {property.documentedConstraints.map((c) => (
            <li key={c.id} className="rounded-md border border-slate-200 p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <Pill tone={c.finding === "excluded" ? "red" : "green"}>
                  {c.dimension} · {c.finding}
                </Pill>
                <span className="text-xs text-slate-600">
                  Applies to: {c.appliesToUses.join(", ")}
                </span>
              </div>
              <p className="mt-1 text-slate-800">{c.explanation}</p>
            </li>
          ))}
        </ul>
      )}

      <EvidenceList evidence={property.evidence} title="Property evidence" />
      <p className="mt-3 text-xs text-slate-600">
        Preliminary screening only — not an appraisal, zoning determination or
        structural inspection. Retrieved {latest(property)}.
      </p>
    </section>
  );
}

function latest(p: PropertyDTO) {
  const times = p.evidence.map((e) => e.retrievedAt).sort();
  return times.length ? formatInstant(times[times.length - 1]) : "time unavailable";
}

function subtitle(p: PropertyDTO): string {
  return [p.propertyType.value, p.existingUse.value].filter((v): v is string => !!v).join(" · ");
}
