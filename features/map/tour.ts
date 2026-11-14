import type { SpatialContextDTO } from "@/lib/contracts";
import type { Load } from "@/features/dashboard/state";

/**
 * Matterport documents no SID length (published examples are 11 characters),
 * so only URL-safety is enforced: alphanumeric, bounded length.
 */
export const SHOWCASE_SID = /^[A-Za-z0-9]{6,32}$/;

export type TourState =
  | { status: "checking" }
  | { status: "available"; sid: string; url: string }
  | { status: "unavailable"; reason: string };

/** Plain Showcase iframe URL. No SDK key or GraphQL credential is involved. */
export function showcaseUrl(sid: string): string {
  return `https://my.matterport.com/show/?m=${encodeURIComponent(sid)}&play=1`;
}

/** Only trusted publication proof enables an embed; model.id alone is insufficient. */
export function showcaseSidOf(spatial: SpatialContextDTO): string | null {
  return spatial.model?.showcase?.sid ?? null;
}

export const NO_SID_REASON =
  "This property's data does not include an embeddable Matterport Showcase model.";

export function resolveTour(
  spatial: Load<SpatialContextDTO>,
  selectedId: string | null,
  sidOf: (s: SpatialContextDTO) => string | null = showcaseSidOf,
): TourState {
  if (!selectedId) return { status: "unavailable", reason: "Select a property first." };
  if (spatial.status === "idle" || spatial.status === "loading") return { status: "checking" };
  if (spatial.status === "error")
    return { status: "unavailable", reason: "Spatial evidence could not be loaded, so no tour can be verified." };
  const s = spatial.data;
  if (s.propertyId !== selectedId) return { status: "checking" };
  if (s.match.status !== "verified")
    return { status: "unavailable", reason: "No verified Matterport match for this property." };
  if (!s.model || s.provider !== "matterport")
    return { status: "unavailable", reason: "No Matterport model is matched to this property." };
  const sid = sidOf(s);
  if (!sid || !SHOWCASE_SID.test(sid)) return { status: "unavailable", reason: NO_SID_REASON };
  return { status: "available", sid, url: showcaseUrl(sid) };
}
