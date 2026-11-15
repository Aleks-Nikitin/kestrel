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

/**
 * Optional starting view, supplied by trusted server data (never hardcoded in
 * source). Both parts are passed through to Matterport's own link parameters
 * exactly as verified for the model; Kestrel only validates their shape.
 */
export interface StartView {
  ss: string;
  sr?: string;
}

const START_SS = /^\d{1,4}$/;
const START_SR = /^(-?\d{1,3}(\.\d{1,4})?)?,(-?\d{1,3}(\.\d{1,4})?)?$/;

export function parseStartView(value: unknown): StartView | null {
  if (typeof value !== "object" || value === null) return null;
  const { ss, sr } = value as { ss?: unknown; sr?: unknown };
  if (typeof ss !== "string" || !START_SS.test(ss)) return null;
  if (sr === undefined) return { ss };
  if (typeof sr !== "string" || sr === "," || !START_SR.test(sr)) return { ss };
  return { ss, sr };
}

/**
 * The shared contract does not carry a start view yet. When the server adds one
 * at `model.showcase.startView` it is picked up here; until then this is null
 * and the tour opens at Matterport's own default start.
 */
export function startViewOf(spatial: SpatialContextDTO): StartView | null {
  const showcase: unknown = spatial.model?.showcase;
  if (typeof showcase !== "object" || showcase === null) return null;
  return parseStartView((showcase as { startView?: unknown }).startView);
}

/** Plain Showcase iframe URL. No SDK key or GraphQL credential is involved. */
export function showcaseUrl(sid: string, start: StartView | null = null): string {
  const base = `https://my.matterport.com/show/?m=${encodeURIComponent(sid)}&play=1`;
  if (!start) return base;
  return `${base}&ss=${start.ss}${start.sr ? `&sr=${start.sr}` : ""}`;
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
  startOf: (s: SpatialContextDTO) => StartView | null = startViewOf,
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
  return { status: "available", sid, url: showcaseUrl(sid, startOf(s)) };
}
