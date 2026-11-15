import type { ReactNode } from "react";
import type { PropertyDTO } from "@/lib/contracts";
import { ArrowRight, Box } from "lucide-react";
import { DataModeBadge, Pill } from "@/components/kestrel/badges";
import { DatumRow } from "@/components/kestrel/datum-row";
import { formatByUnit, formatCoordinates, formatInstant, type DatumView } from "@/features/dashboard/format";
import { EvidenceList } from "./evidence-list";

function isHeadlineFact(datum: DatumView<unknown>, evidence: PropertyDTO["evidence"]) {
  return datum.value !== null && datum.origin === "source_data" && datum.evidenceIds.length > 0 &&
    datum.evidenceIds.every(id => evidence.some(e => e.id === id && e.kind === "record" && e.allowedUse.display));
}

/** A headline figure: shown only for a sourced, displayable record value. */
function Fact<T>({
  label,
  datum,
  render,
  evidence,
}: {
  label: string;
  datum: DatumView<T>;
  render: (value: T) => { figure: string; unit?: string };
  evidence: PropertyDTO["evidence"];
}) {
  if (!isHeadlineFact(datum, evidence)) return null;
  const { figure, unit } = render(datum.value as T);
  return (
    <li className="min-w-0 border-l border-white/15 pl-4 first:border-l-0 first:pl-0">
      <p className="figure whitespace-nowrap text-[1.7rem] font-semibold leading-none tracking-tight text-white">
        {figure}
        {unit ? <span className="ml-1 text-sm font-medium text-ink-300">{unit}</span> : null}
      </p>
      <p className="mt-1.5 text-xs font-medium text-ink-300">{label}</p>
    </li>
  );
}

/** Splits "12,000 sq ft" style output into the figure and its unit for display. */
function split(text: string): { figure: string; unit?: string } {
  const m = /^(\S+)\s+(.+)$/.exec(text);
  return m ? { figure: m[1], unit: m[2] } : { figure: text };
}

const CTA = "inline-flex min-h-10 items-center gap-2 rounded-md px-4 text-sm font-semibold transition-colors focus-visible:outline-buff-200";

/** Selected-property header: identity and headline facts, all from real record values. */
export function PropertyHero({ property }: { property: PropertyDTO }) {
  const hasFacts = [property.grossAreaSqft, property.rentableAreaSqft, property.yearBuilt, property.floors,
    property.occupancyRatio, property.marketRentAnnualPerSqft].some(d => isHeadlineFact(d, property.evidence));
  return (
    <section aria-labelledby="property-heading" className="survey-grid overflow-hidden rounded-xl bg-ink-900 text-white">
      <div className="p-5 sm:p-7">
        <div className="flex flex-wrap items-center gap-2">
          <DataModeBadge mode={property.dataMode} prefix="Property data" />
          <span className="text-xs text-ink-300">
            {property.evidence.length} evidence {property.evidence.length === 1 ? "record" : "records"}, retrieved{" "}
            <span className="figure">{latest(property)}</span>
          </span>
        </div>
        <h2
          id="property-heading"
          tabIndex={-1}
          className="type-display mt-4 max-w-4xl text-[2.6rem] text-buff-100 outline-none [overflow-wrap:anywhere] sm:text-6xl"
        >
          {property.address.value ?? "Property (address unknown)"}
        </h2>
        {subtitle(property) ? <p className="mt-2 text-base text-ink-200">{subtitle(property)}</p> : null}

        {hasFacts ? (
          <ul aria-label="Headline facts" className="mt-7 flex flex-wrap gap-x-6 gap-y-5">
            <Fact label="Gross area" evidence={property.evidence} datum={property.grossAreaSqft} render={(v) => split(formatByUnit(v, "sqft"))} />
            <Fact label="Rentable area" evidence={property.evidence} datum={property.rentableAreaSqft} render={(v) => split(formatByUnit(v, "sqft"))} />
            <Fact label="Year built" evidence={property.evidence} datum={property.yearBuilt} render={(v) => ({ figure: String(v) })} />
            <Fact label="Floors" evidence={property.evidence} datum={property.floors} render={(v) => ({ figure: String(v) })} />
            <Fact label="Occupancy" evidence={property.evidence} datum={property.occupancyRatio} render={(v) => ({ figure: formatByUnit(v, "ratio") })} />
            <Fact label="Market rent" evidence={property.evidence} datum={property.marketRentAnnualPerSqft} render={(v) => split(formatByUnit(v, "USD/sqft/year"))} />
          </ul>
        ) : (
          <p className="mt-5 max-w-xl text-sm text-ink-300">
            No headline figure is backed by a displayable source record for this property. Every value on
            record, with its origin, is in the ledger below.
          </p>
        )}

        <div className="mt-7 flex flex-wrap gap-2.5">
          <a href="#building" className={`${CTA} bg-rufous-600 text-white hover:bg-rufous-500`}>
            <Box className="size-4" aria-hidden /> Explore the building
          </a>
          <a href="#underwriting" className={`${CTA} border border-white/25 text-white hover:bg-white/10`}>
            Start underwriting <ArrowRight className="size-4" aria-hidden />
          </a>
        </div>
      </div>
    </section>
  );
}

interface Row {
  label: string;
  node: ReactNode;
  known: boolean;
}

export function PropertyPanel({ property }: { property: PropertyDTO }) {
  const row = <T,>(label: string, datum: DatumView<T>, render: (v: T) => ReactNode): Row => ({
    label,
    known: datum.value !== null,
    node: <DatumRow key={label} label={label} datum={datum} render={render} />,
  });
  const rows: Row[] = [
    row("Address", property.address, (v) => v),
    row("Location", property.location, formatCoordinates),
    row("Property type", property.propertyType, (v) => v),
    row("Existing use", property.existingUse, (v) => v),
    row("Gross area", property.grossAreaSqft, (v) => formatByUnit(v, "sqft")),
    row("Rentable area", property.rentableAreaSqft, (v) => formatByUnit(v, "sqft")),
    row("Year built", property.yearBuilt, (v) => String(v)),
    row("Floors", property.floors, (v) => String(v)),
    row("Occupancy", property.occupancyRatio, (v) => formatByUnit(v, "ratio")),
    row("Market rent", property.marketRentAnnualPerSqft, (v) => formatByUnit(v, "USD/sqft/year")),
    row("Market description", property.marketDescription, (v) => v),
  ];
  const known = rows.filter((r) => r.known);
  const unknown = rows.filter((r) => !r.known);
  return (
    <section aria-labelledby="property-data-heading" className="rounded-xl border border-ink-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-200 px-5 py-3.5">
        <h3 id="property-data-heading" className="text-base font-semibold text-ink-900">
          Property data and provenance
        </h3>
        <p className="text-xs text-ink-500">Open a line to see its unit, dates and evidence.</p>
      </div>
      <div className="px-5 py-2">
        <div>{known.map((r) => r.node)}</div>
        {unknown.length ? (
          <div className="mt-2 border-t border-dashed border-ink-200 pt-3">
            <h4 className="type-label">Not on record</h4>
            <div>{unknown.map((r) => r.node)}</div>
          </div>
        ) : null}
      </div>

      <div className="border-t border-ink-200 px-5 py-4">
        <h4 className="text-sm font-semibold text-ink-900">Documented legal and physical constraints</h4>
        {property.documentedConstraints.length === 0 ? (
          <p className="mt-1 max-w-prose text-sm text-ink-600">
            None were supplied. This means legal and physical feasibility is{" "}
            <strong className="font-semibold text-ink-900">unverified</strong>, not that the property is unrestricted.
          </p>
        ) : (
          <ul className="mt-2 space-y-2">
            {property.documentedConstraints.map((c) => (
              <li key={c.id} className="rounded-md border border-ink-200 p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <Pill tone={c.finding === "excluded" ? "red" : "green"}>
                    {c.dimension} · {c.finding}
                  </Pill>
                  <span className="text-xs text-ink-500">Applies to: {c.appliesToUses.join(", ")}</span>
                </div>
                <p className="mt-1.5 text-ink-800">{c.explanation}</p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="border-t border-ink-200 px-5 py-4">
        <EvidenceList evidence={property.evidence} title="Property evidence" />
        <p className="figure mt-3 text-xs text-ink-500">Retrieved {latest(property)}.</p>
      </div>
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
