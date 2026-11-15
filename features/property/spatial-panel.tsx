import type { ReactNode } from "react";
import type { SpatialContextDTO } from "@/lib/contracts";
import { DataModeBadge, OriginBadge, Pill } from "@/components/kestrel/badges";
import { formatInstant } from "@/features/dashboard/format";
import { ProvenanceChip, providerKind } from "@/components/kestrel/provenance";
import { EvidenceList } from "./evidence-list";
import { RoomMeasurements } from "./room-measurements";
import { locationWithinFootprint } from "@/features/map/geo";

const PROVIDER_LABEL = { matterport: "Matterport", vexcel: "Vexcel" } as const;
const MATCH_TONE = {
  verified: "green",
  ambiguous: "amber",
  unmatched: "red",
} as const;

function Card({ id, title, aside, children }: { id: string; title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="rounded-xl border border-ink-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-200 px-5 py-3.5">
        <h3 id={id} className="text-base font-semibold text-ink-950">
          {title}
        </h3>
        {aside}
      </div>
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}

/**
 * The evidence behind the building stage: how the scan was matched, what it
 * measured and what was observed. Nothing is shown as evidence for a layer
 * that is not verified as the selected building.
 */
export function SpatialPanel({
  spatial,
  location = null,
}: {
  spatial: SpatialContextDTO;
  /** The selected property's own coordinates, for the footprint check. */
  location?: { longitude: number; latitude: number } | null;
}) {
  const { match, model, imagery } = spatial;
  const footprint = imagery?.footprintGeoJSON ?? null;
  const inside =
    footprint && location ? locationWithinFootprint(location, footprint) : null;
  const verified = match.status === "verified";
  return (
    <div className="space-y-5">
      <section aria-labelledby="spatial-heading" className="rounded-xl border border-ink-200 bg-white px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 id="spatial-heading" className="text-base font-semibold text-ink-950">
            Spatial evidence · {PROVIDER_LABEL[spatial.provider]}
          </h3>
          <div className="flex flex-wrap items-center gap-2">
            <Pill tone={MATCH_TONE[match.status]}>Match: {match.status}</Pill>
            <DataModeBadge mode={spatial.dataMode} prefix="Spatial data" />
          </div>
        </div>
        <p className="mt-2 max-w-prose text-sm leading-relaxed text-ink-800">{match.explanation}</p>
        <p className="figure mt-1 text-xs text-ink-500">
          Method: {match.method === "provider_link" ? "provider link" : "geographic review"}
          {match.reviewedAt ? ` · Reviewed ${formatInstant(match.reviewedAt)}` : ""}
        </p>
        {spatial.unavailableReason ? (
          <p className="mt-3 rounded-md border border-ink-200 bg-ink-50 px-3 py-2 text-sm text-ink-800">
            <strong>Unavailable:</strong> {spatial.unavailableReason}
          </p>
        ) : null}
        {!verified ? (
          <p className="mt-3 max-w-prose text-sm text-ink-600">
            This layer is not verified as the selected building, so no imagery,
            model or observations are shown as evidence for it.
          </p>
        ) : null}
      </section>

      {verified ? (
        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
          <Card
            id="spatial-rooms-heading"
            title="Matterport room measurements"
            aside={
              model ? (
                <span className="flex flex-wrap items-center gap-1.5">
                  <ProvenanceChip kind={providerKind(spatial.provider)} />
                  {spatial.dataMode === "synthetic" ? <ProvenanceChip kind="synthetic" /> : null}
                </span>
              ) : null
            }
          >
            {model ? (
              <div className="text-sm">
                <RoomMeasurements model={model} />
                <p className="mt-4 text-xs text-ink-500">
                  <span className="[overflow-wrap:anywhere]">
                    Model <code>{model.id}</code> · joined by{" "}
                    {model.joinSource === "costar_property_id" ? "commercial property ID" : "geographic review"}.
                  </span>{" "}
                  <span className="figure">
                    {model.signedUrlExpiresAt
                      ? `Model link expires ${formatInstant(model.signedUrlExpiresAt)}.`
                      : "No expiring model link."}
                  </span>
                </p>
              </div>
            ) : (
              <p className="text-sm text-ink-600">No model measurements are available for this property.</p>
            )}
          </Card>

          <div className="space-y-5">
            <Card id="spatial-imagery-heading" title="Imagery">
              {imagery ? (
                <figure>
                  {/* Authorized same-origin proxy asset; not optimizable by next/image. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imagery.displayPath}
                    alt="Matched imagery of the selected property"
                    className="max-h-72 w-full rounded-md border border-ink-200 object-cover"
                  />
                  <figcaption className="figure mt-1.5 text-xs text-ink-500">
                    {imagery.attribution} · Captured{" "}
                    {imagery.capturedAt ? formatInstant(imagery.capturedAt) : "date unknown"}
                  </figcaption>
                </figure>
              ) : (
                <p className="text-sm text-ink-600">No matched imagery is available for this property.</p>
              )}
              <p className="mt-2 text-sm text-ink-800" data-testid="footprint-check">
                {footprint === null
                  ? "No building footprint was supplied, so the coordinates could not be checked against one."
                  : location === null
                    ? "The property has no known coordinates to check against the footprint."
                    : inside
                      ? "The property's coordinates fall inside the matched footprint."
                      : "The property's coordinates fall outside the matched footprint — treat the match with caution."}
              </p>
            </Card>

            <Card id="spatial-observations-heading" title="Observations">
              {spatial.observations.length ? (
                <ul className="-my-1 divide-y divide-ink-100">
                  {spatial.observations.map((o) => (
                    <li key={o.id} className="py-3 text-sm">
                      <p className="font-serif text-[1.02rem] leading-relaxed text-ink-950">{o.statement}</p>
                      <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-ink-500">
                        <ProvenanceChip kind={providerKind(spatial.provider)} />
                        {spatial.dataMode === "synthetic" ? <ProvenanceChip kind="synthetic" /> : null}
                        <OriginBadge origin={o.origin === "source_data" ? "source_data" : "explicit_estimate"} />
                        <span className="min-w-0 [overflow-wrap:anywhere]">Evidence: {o.evidenceIds.join(", ")}</span>
                      </p>
                      {o.limitations.length ? (
                        <ul className="mt-1.5 space-y-0.5 border-l-2 border-ink-200 pl-3 text-xs text-ink-600">
                          {o.limitations.map((l) => (
                            <li key={l}>{l}</li>
                          ))}
                        </ul>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-ink-600">No observations supplied.</p>
              )}
            </Card>
          </div>
        </div>
      ) : null}

      <EvidenceList evidence={spatial.evidence} title="Spatial evidence records" />
    </div>
  );
}
