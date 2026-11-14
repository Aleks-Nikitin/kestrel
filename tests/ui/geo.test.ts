import { describe, expect, it } from "vitest";
import { CatalogResponse, SpatialContext } from "@/lib/contracts";
import {
  boundsOfPoints,
  footprintBounds,
  locationWithinFootprint,
  mappableProperties,
  resolveStyleUrl,
  type Footprint,
} from "@/features/map/geo";
import { property, spatial, propertyId } from "../fixtures/contracts";

const footprint: Footprint = {
  type: "Polygon",
  coordinates: [
    [
      [-95.3602, 29.7598],
      [-95.3598, 29.7598],
      [-95.3598, 29.7602],
      [-95.3602, 29.7602],
      [-95.3602, 29.7598],
    ],
  ],
};

function summary(location: typeof property.location) {
  return CatalogResponse.parse({
    contractVersion: "1",
    properties: [
      {
        id: property.id,
        address: property.address,
        location,
        propertyType: property.propertyType,
        dataMode: property.dataMode,
        evidence: property.evidence,
      },
    ],
    nextCursor: null,
  }).properties;
}

describe("map geometry helpers", () => {
  it("maps properties with known WGS84 coordinates as [longitude, latitude]", () => {
    const { points, unmappable } = mappableProperties(summary(property.location));
    expect(unmappable).toBe(0);
    expect(points).toEqual([
      { id: propertyId, label: "100 Fictional Example Way, Imaginary City", lngLat: [-95.36, 29.76] },
    ]);
  });

  it("counts, never fabricates, properties without coordinates", () => {
    const unknown = {
      ...property.location,
      value: null,
      origin: "unknown" as const,
      evidenceIds: [],
      note: "Not supplied",
    };
    const { points, unmappable } = mappableProperties(summary(unknown));
    expect(points).toEqual([]);
    expect(unmappable).toBe(1);
  });

  it("computes bounds", () => {
    expect(boundsOfPoints([])).toBeNull();
    expect(boundsOfPoints([[-95.4, 29.7], [-95.3, 29.8]])).toEqual([[-95.4, 29.7], [-95.3, 29.8]]);
    expect(footprintBounds(footprint)).toEqual([[-95.3602, 29.7598], [-95.3598, 29.7602]]);
  });

  it("checks the property coordinate against a matched footprint with Turf", () => {
    expect(locationWithinFootprint({ longitude: -95.36, latitude: 29.76 }, footprint)).toBe(true);
    expect(locationWithinFootprint({ longitude: -95.3, latitude: 29.76 }, footprint)).toBe(false);
  });

  it("accepts only credential-free https style URLs", () => {
    expect(resolveStyleUrl(undefined)).toBeNull();
    expect(resolveStyleUrl("")).toBeNull();
    expect(resolveStyleUrl("http://tiles.example/style.json")).toBeNull();
    expect(resolveStyleUrl("https://user:pw@tiles.example/style.json")).toBeNull();
    expect(resolveStyleUrl("not a url")).toBeNull();
    expect(resolveStyleUrl("https://tiles.example/style.json")).toBe("https://tiles.example/style.json");
  });

  it("the contract allows a footprint only on a verified match", () => {
    const withImagery = {
      ...spatial,
      imagery: {
        assetId: "asset-1",
        displayPath: `/api/v1/properties/${propertyId}/media/asset-1`,
        capturedAt: "2026-01-01T00:00:00Z",
        footprintGeoJSON: footprint,
        attribution: "Fictional synthetic imagery",
      },
    };
    expect(SpatialContext.safeParse(withImagery).success).toBe(true);
    expect(
      SpatialContext.safeParse({
        ...withImagery,
        match: { ...spatial.match, status: "ambiguous" },
      }).success,
    ).toBe(false);
  });
});
