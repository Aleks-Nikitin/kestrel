// Pure geographic helpers for the map. Spatial checks use Turf; there is no
// financial logic here. Coordinates are WGS84 longitude/latitude as in the contract.
import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import type { SpatialContextDTO } from "@/lib/contracts";
import type { PropertySummaryDTO } from "@/features/dashboard/state";

export type Footprint = NonNullable<
  NonNullable<SpatialContextDTO["imagery"]>["footprintGeoJSON"]
>;
export type LngLat = [longitude: number, latitude: number];
export type Bounds = [southWest: LngLat, northEast: LngLat];

export interface MapPoint {
  id: string;
  label: string;
  lngLat: LngLat;
}

/** Properties with a known, valid location become map points; the rest are counted. */
export function mappableProperties(summaries: PropertySummaryDTO[]) {
  const points: MapPoint[] = [];
  let unmappable = 0;
  for (const p of summaries) {
    const loc = p.location.value;
    if (loc === null) {
      unmappable += 1;
      continue;
    }
    points.push({
      id: p.id,
      label: p.address.value ?? "Address unknown",
      lngLat: [loc.longitude, loc.latitude],
    });
  }
  return { points, unmappable };
}

export function boundsOfPoints(points: LngLat[]): Bounds | null {
  if (points.length === 0) return null;
  let [minX, minY] = points[0];
  let [maxX, maxY] = points[0];
  for (const [x, y] of points) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  return [
    [minX, minY],
    [maxX, maxY],
  ];
}

export function footprintPositions(footprint: Footprint): LngLat[] {
  const rings =
    footprint.type === "Polygon"
      ? footprint.coordinates
      : footprint.coordinates.flat();
  return rings.flat().map(([x, y]) => [x, y] as LngLat);
}

export function footprintBounds(footprint: Footprint): Bounds | null {
  return boundsOfPoints(footprintPositions(footprint));
}

/** True when the selected property's coordinates fall inside the matched footprint. */
export function locationWithinFootprint(
  location: { longitude: number; latitude: number },
  footprint: Footprint,
): boolean {
  return booleanPointInPolygon([location.longitude, location.latitude], footprint);
}

/**
 * The basemap comes from the configured public style URL. Only credential-free
 * HTTPS URLs are accepted; otherwise the map renders on a plain background and
 * says so. No public demo tile server is assumed.
 */
export function resolveStyleUrl(raw: string | undefined): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:" || u.username || u.password) return null;
    return u.toString();
  } catch {
    return null;
  }
}

export const PLAIN_STYLE = {
  version: 8 as const,
  sources: {},
  layers: [
    {
      id: "plain-background",
      type: "background" as const,
      paint: { "background-color": "#e2e8f0" },
    },
  ],
};
