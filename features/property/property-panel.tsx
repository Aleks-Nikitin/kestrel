import type { PropertyDTO } from "@/lib/contracts";
import { ArrowRight, Box, Calculator } from "lucide-react";
import { DataModeBadge, OriginBadge, Pill } from "@/components/kestrel/badges";
import { SpotlightCard } from "@/components/kestrel/motion";
import { DatumRow } from "@/components/kestrel/datum-row";
import {
  formatByUnit,
  formatCoordinates,
  formatInstant,
  type DatumView,
} from "@/features/dashboard/format";
import { EvidenceList } from "./evidence-list";

function Kpi<T>({
  label,
  datum,
  render,
}: {
  label: string;
  datum: DatumView<T>;
  render: (value: T) => string;
}) {
  return (
    <SpotlightCard as="li" className="rounded-xl border border-slate-200 bg-white p-3.5">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-600">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums text-slate-900">
        {datum.value === null ? (
          <span className="text-base font-normal italic text-slate-600">Unknown</span>
        ) : (
          render(datum.value as T)
        )}
      </p>
      <div className="mt-2">
        <OriginBadge origin={datum.origin} />
      </div>
    </SpotlightCard>
  );
}

const CTA =
  "inline-flex min-h-10 items-center gap-2 rounded-md px-3.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-copper-300";

/** Selected-property header: identity, source distinction and headline facts, all from real values. */
export function PropertyHero({ property }: { property: PropertyDTO }) {
  return (
    <section
      aria-labelledby="property-heading"
      className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-sm"
    >
      <div className="border-t-2 border-copper-500 bg-espresso-900 p-5 text-ivory sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-copper-300">Selected property</p>
          <div className="flex flex-wrap items-center gap-2">
            <DataModeBadge mode={property.dataMode} prefix="Property data" />
            <span className="rounded-full bg-espresso-700 px-2.5 py-0.5 text-xs text-ivory/80">
              {property.evidence.length} evidence {property.evidence.length === 1 ? "record" : "records"}
            </span>
          </div>
        </div>
        <h2
          id="property-heading"
          tabIndex={-1}
          className="mt-3 font-display text-3xl leading-tight tracking-tight outline-none [overflow-wrap:anywhere] sm:text-4xl"
        >
          {property.address.value ?? "Property (address unknown)"}
        </h2>
        {subtitle(property) ? <p className="mt-1.5 text-base text-ivory/75">{subtitle(property)}</p> : null}
        <p className="mt-1 text-xs text-ivory/60">Facts retrieved {latest(property)}.</p>
        <div className="mt-5 flex flex-wrap gap-2">
          <a href="#section-spatial" className={`${CTA} bg-copper-600 text-ivory hover:bg-copper-500`}>
            <Box className="size-4" aria-hidden /> Explore map and 3D tour
          </a>
          <a href="#section-scenarios" className={`${CTA} border border-ivory/25 text-ivory hover:bg-espresso-700`}>
            <Calculator className="size-4" aria-hidden /> Compare scenarios <ArrowRight className="size-4" aria-hidden />
          </a>
        </div>
      </div>
      <ul aria-label="Headline facts" className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 sm:p-5 xl:grid-cols-6">
        <Kpi label="Gross area" datum={property.grossAreaSqft} render={(v) => formatByUnit(v, "sqft")} />
        <Kpi label="Rentable area" datum={property.rentableAreaSqft} render={(v) => formatByUnit(v, "sqft")} />
        <Kpi label="Year built" datum={property.yearBuilt} render={(v) => String(v)} />
        <Kpi label="Floors" datum={property.floors} render={(v) => String(v)} />
        <Kpi label="Occupancy" datum={property.occupancyRatio} render={(v) => formatByUnit(v, "ratio")} />
        <Kpi label="Market rent" datum={property.marketRentAnnualPerSqft} render={(v) => formatByUnit(v, "USD/sqft/year")} />
      </ul>
    </section>
  );
}

export function PropertyPanel({ property }: { property: PropertyDTO }) {
  return (
    <section
      aria-labelledby="property-data-heading"
      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 id="property-data-heading" className="font-display text-xl text-slate-900">
          Property data and provenance
        </h3>
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
