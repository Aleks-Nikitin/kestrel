import type { SpatialContextDTO } from "@/lib/contracts";
import { DataModeBadge, Pill } from "@/components/kestrel/badges";
import { formatInstant } from "@/features/dashboard/format";
import { EvidenceList } from "./evidence-list";
import { RoomSchematic } from "./room-schematic";
import { locationWithinFootprint } from "@/features/map/geo";

const PROVIDER_LABEL = { matterport: "Matterport", vexcel: "Vexcel" } as const;
const MATCH_TONE = {
  verified: "green",
  ambiguous: "amber",
  unmatched: "red",
} as const;

function dim(value: string | null) {
  return value === null ? "—" : value;
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
      className="rounded-lg border border-slate-200 bg-white p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h2 id="spatial-heading" className="text-lg font-semibold text-slate-900">
          Spatial evidence · {PROVIDER_LABEL[spatial.provider]}
        </h2>
        <DataModeBadge mode={spatial.dataMode} prefix="Spatial data" />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
        <Pill tone={MATCH_TONE[match.status]}>Match: {match.status}</Pill>
        <span className="text-xs text-slate-600">
          Method: {match.method === "provider_link" ? "provider link" : "geographic review"}
          {match.reviewedAt ? ` · Reviewed ${formatInstant(match.reviewedAt)}` : ""}
        </span>
      </div>
      <p className="mt-1 text-sm text-slate-800">{match.explanation}</p>

      {spatial.unavailableReason ? (
        <p className="mt-3 rounded-md border border-slate-300 bg-slate-50 p-3 text-sm text-slate-800">
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
          <h3 className="mt-5 text-sm font-semibold text-slate-900">Imagery</h3>
          {imagery ? (
            <figure className="mt-2">
              {/* Authorized same-origin proxy asset; not optimizable by next/image. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imagery.displayPath}
                alt="Matched imagery of the selected property"
                className="max-h-72 w-full rounded-md border border-slate-200 object-cover"
              />
              <figcaption className="mt-1 text-xs text-slate-600">
                {imagery.attribution} · Captured{" "}
                {imagery.capturedAt ? formatInstant(imagery.capturedAt) : "date unknown"}
              </figcaption>
            </figure>
          ) : (
            <p className="mt-1 text-sm text-slate-700">
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

          <h3 className="mt-5 text-sm font-semibold text-slate-900">
            3D model measurements
          </h3>
          {model ? (
            <div className="mt-2 text-sm">
              <p className="text-slate-800">
                Model <code className="text-xs">{model.id}</code> · joined by{" "}
                {model.joinSource === "costar_property_id"
                  ? "commercial property ID"
                  : "geographic review"}
              </p>
              <RoomSchematic rooms={model.rooms} />
              <p className="mt-3 text-xs text-slate-600">
                Dimensions in metres (m); areas in square metres (m²). Unit
                conversion: {model.conversionNote}
              </p>
              <div
                role="region"
                aria-label="Model room measurements"
                tabIndex={0}
                className="mt-2 overflow-x-auto rounded-md border border-slate-200 focus-visible:outline-2 focus-visible:outline-sky-600"
              >
                <table className="w-full min-w-[28rem] text-left text-sm">
                  <caption className="sr-only">Room measurements from the model</caption>
                  <thead className="bg-slate-50 text-xs text-slate-700">
                    <tr>
                      <th scope="col" className="px-3 py-2">Room</th>
                      <th scope="col" className="px-3 py-2 text-right">Width (m)</th>
                      <th scope="col" className="px-3 py-2 text-right">Depth (m)</th>
                      <th scope="col" className="px-3 py-2 text-right">Height (m)</th>
                      <th scope="col" className="px-3 py-2 text-right">Floor area (m²)</th>
                    </tr>
                  </thead>
                  <tbody className="tabular-nums">
                    {model.rooms.map((r) => (
                      <tr key={r.id} className="border-t border-slate-200">
                        <th scope="row" className="px-3 py-2 font-medium">{r.id}</th>
                        <td className="px-3 py-2 text-right">{dim(r.width)}</td>
                        <td className="px-3 py-2 text-right">{dim(r.depth)}</td>
                        <td className="px-3 py-2 text-right">{dim(r.height)}</td>
                        <td className="px-3 py-2 text-right">{dim(r.floorArea)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-1 text-xs text-slate-600">
                {model.signedUrlExpiresAt
                  ? `Model link expires ${formatInstant(model.signedUrlExpiresAt)}.`
                  : "No expiring model link."}
              </p>
            </div>
          ) : (
            <p className="mt-1 text-sm text-slate-700">
              No model measurements are available for this property.
            </p>
          )}

          <h3 className="mt-5 text-sm font-semibold text-slate-900">Observations</h3>
          {spatial.observations.length ? (
            <ul className="mt-2 space-y-2">
              {spatial.observations.map((o) => (
                <li key={o.id} className="rounded-md border border-slate-200 p-3 text-sm">
                  <p className="text-slate-900">{o.statement}</p>
                  <p className="mt-1 text-xs text-slate-600">
                    <Pill tone={o.origin === "source_data" ? "green" : "amber"}>
                      {o.origin === "source_data" ? "Source data" : "Estimate"}
                    </Pill>{" "}
                    Evidence: {o.evidenceIds.join(", ")}
                  </p>
                  {o.limitations.length ? (
                    <ul className="mt-1 list-disc pl-5 text-xs text-slate-700">
                      {o.limitations.map((l) => (
                        <li key={l}>{l}</li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-sm text-slate-700">No observations supplied.</p>
          )}
        </>
      ) : null}

      <EvidenceList evidence={spatial.evidence} title="Spatial evidence records" />
    </section>
  );
}
