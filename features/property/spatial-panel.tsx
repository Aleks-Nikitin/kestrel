import type { SpatialContextDTO } from "@/lib/contracts";
import { DataModeBadge, Pill } from "@/components/kestrel/badges";
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

function Group({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="mt-6 border-t border-slate-200 pt-5">
      <h3 id={id} className="text-sm font-semibold uppercase tracking-wide text-slate-700">
        {title}
      </h3>
      {children}
    </section>
  );
}

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
    <section
      aria-labelledby="spatial-heading"
      className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 id="spatial-heading" className="text-xl font-semibold tracking-tight text-slate-900">
            Spatial evidence · {PROVIDER_LABEL[spatial.provider]}
          </h2>
        </div>
        <DataModeBadge mode={spatial.dataMode} prefix="Spatial data" />
      </div>

      <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Pill tone={MATCH_TONE[match.status]}>Match: {match.status}</Pill>
          <span className="text-xs text-slate-600">
            Method: {match.method === "provider_link" ? "provider link" : "geographic review"}
            {match.reviewedAt ? ` · Reviewed ${formatInstant(match.reviewedAt)}` : ""}
          </span>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-slate-800">{match.explanation}</p>
      </div>

      {spatial.unavailableReason ? (
        <p className="mt-3 rounded-lg border border-slate-300 bg-slate-50 p-3 text-sm text-slate-800">
          <strong>Unavailable:</strong> {spatial.unavailableReason}
        </p>
      ) : null}
      {!verified ? (
        <p className="mt-3 text-sm text-slate-700">
          This layer is not verified as the selected building, so no imagery,
          model or observations are shown as evidence for it.
        </p>
      ) : null}

      {verified ? (
        <>
          <Group id="spatial-imagery-heading" title="Imagery">
            {imagery ? (
              <figure className="mt-3">
                {/* Authorized same-origin proxy asset; not optimizable by next/image. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imagery.displayPath}
                  alt="Matched imagery of the selected property"
                  className="max-h-72 w-full rounded-lg border border-slate-200 object-cover"
                />
                <figcaption className="mt-1.5 text-xs text-slate-600">
                  {imagery.attribution} · Captured{" "}
                  {imagery.capturedAt ? formatInstant(imagery.capturedAt) : "date unknown"}
                </figcaption>
              </figure>
            ) : (
              <p className="mt-2 text-sm text-slate-700">
                No matched imagery is available for this property.
              </p>
            )}
            <p className="mt-2 text-sm text-slate-800" data-testid="footprint-check">
              {footprint === null
                ? "No building footprint was supplied, so the coordinates could not be checked against one."
                : location === null
                  ? "The property has no known coordinates to check against the footprint."
                  : inside
                    ? "The property's coordinates fall inside the matched footprint."
                    : "The property's coordinates fall outside the matched footprint — treat the match with caution."}
            </p>
          </Group>

          <Group id="spatial-rooms-heading" title="Matterport room measurements">
            {model ? (
              <div className="text-sm">
                <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-600">
                  <ProvenanceChip kind={providerKind(spatial.provider)} />
                  {spatial.dataMode === "synthetic" ? <ProvenanceChip kind="synthetic" /> : null}
                  <span className="min-w-0 [overflow-wrap:anywhere]">
                    Model <code>{model.id}</code> · joined by{" "}
                    {model.joinSource === "costar_property_id"
                      ? "commercial property ID"
                      : "geographic review"}
                  </span>
                </p>
                <RoomMeasurements model={model} />
                <p className="mt-3 text-xs text-slate-600">
                  {model.signedUrlExpiresAt
                    ? `Model link expires ${formatInstant(model.signedUrlExpiresAt)}.`
                    : "No expiring model link."}
                </p>
              </div>
            ) : (
              <p className="mt-2 text-sm text-slate-700">
                No model measurements are available for this property.
              </p>
            )}
          </Group>

          <Group id="spatial-observations-heading" title="Observations">
            {spatial.observations.length ? (
              <ul className="mt-3 space-y-2">
                {spatial.observations.map((o) => (
                  <li key={o.id} className="rounded-lg border border-slate-200 p-3 text-sm">
                    <p className="text-slate-900">{o.statement}</p>
                    <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-600">
                      <ProvenanceChip kind={providerKind(spatial.provider)} />
                      {spatial.dataMode === "synthetic" ? <ProvenanceChip kind="synthetic" /> : null}
                      <Pill tone={o.origin === "source_data" ? "green" : "amber"}>
                        {o.origin === "source_data" ? "Source data" : "Estimate"}
                      </Pill>{" "}
                      <span className="min-w-0 [overflow-wrap:anywhere]">
                        Evidence: {o.evidenceIds.join(", ")}
                      </span>
                    </p>
                    {o.limitations.length ? (
                      <ul className="mt-1.5 list-disc pl-5 text-xs text-slate-700">
                        {o.limitations.map((l) => (
                          <li key={l}>{l}</li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-slate-700">No observations supplied.</p>
            )}
          </Group>
        </>
      ) : null}

      <EvidenceList evidence={spatial.evidence} title="Spatial evidence records" />
    </section>
  );
}
