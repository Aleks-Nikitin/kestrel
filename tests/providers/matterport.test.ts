import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import {
  MatterportClient,
  MODEL_QUERY,
} from "@/lib/providers/matterport/client";
import {
  normalizeMatchedSpatial,
  MatterportSpatialProvider,
} from "@/lib/providers/matterport/spatial";
import { property } from "../fixtures/contracts";
const model = {
  id: "fictional-model",
  geolocation: {
    lat: property.location.value!.latitude,
    long: property.location.value!.longitude,
  },
  rooms: [
    {
      id: "fictional-room",
      dimensions: { width: 10, depth: 8, height: 3, areaFloor: 80 },
    },
  ],
};
const match = {
  propertyId: property.id,
  modelId: model.id,
  source: "commercial_property_mapping" as const,
};
const permissions = { display: false, modelProcessing: false, export: false };
const config = {
  apiKey: "fictional-key",
  apiToken: "fictional-token",
  agreementAccepted: true,
};
const transport = (body: unknown, status = 200) =>
  vi
    .fn<typeof fetch>()
    .mockResolvedValue(new Response(JSON.stringify(body), { status }));
describe("bounded Matterport GraphQL", () => {
  it("uses the fixed endpoint, mapped variable, metric units and server auth", async () => {
    const fetcher = transport({ data: { model } });
    const result = await new MatterportClient({
      ...config,
      transport: fetcher,
    }).getModel(model.id, AbortSignal.timeout(2000));
    expect(result.id).toBe(model.id);
    expect(fetcher.mock.calls[0][0]).toBe(
      "https://api.matterport.com/api/models/graph",
    );
    const request = fetcher.mock.calls[0][1]!;
    expect(JSON.parse(request.body as string)).toEqual({
      query: MODEL_QUERY,
      variables: { id: model.id },
    });
    expect(request.redirect).toBe("error");
    expect(MODEL_QUERY).toContain("units: metric");
    expect(JSON.stringify(result)).not.toContain("fictional-key");
  });
  it("normalizes numeric coordinate scalars while rejecting arbitrary text", async () => {
    const result = await new MatterportClient({
      ...config,
      transport: transport({
        data: {
          model: { ...model, geolocation: { lat: "29.76", long: "-95.36" } },
        },
      }),
    }).getModel(model.id, AbortSignal.timeout(2000));
    expect(result.geolocation?.lat).toBe(29.76);
  });
  it.each([401, 403, 429, 500])(
    "maps HTTP %s to a safe bounded error without retries",
    async (status) => {
      const fetcher = transport({ private: "MUST_NOT_LEAK" }, status);
      await expect(
        new MatterportClient({ ...config, transport: fetcher }).getModel(
          model.id,
          AbortSignal.timeout(2000),
        ),
      ).rejects.toMatchObject({
        code:
          status === 429
            ? "RATE_LIMITED"
            : status === 500
              ? "UPSTREAM_UNAVAILABLE"
              : "UPSTREAM_AUTH",
      });
      expect(fetcher).toHaveBeenCalledTimes(1);
    },
  );
  it("rejects null, wrong-identity, malformed and partial GraphQL results", async () => {
    for (const body of [
      { data: { model: null } },
      { data: { model: { ...model, id: "another-model" } } },
      { data: { model }, errors: [{ message: "private diagnostics" }] },
      {
        data: {
          model: {
            id: model.id,
            rooms: [{ id: "room", dimensions: { width: -1 } }],
          },
        },
      },
    ])
      await expect(
        new MatterportClient({
          ...config,
          transport: transport(body),
        }).getModel(model.id, AbortSignal.timeout(2000)),
      ).rejects.toBeInstanceOf(Error);
  });
  it("blocks missing credentials and agreement before any fetch", async () => {
    const fetcher = transport({});
    for (const options of [
      { ...config, apiKey: undefined },
      { ...config, agreementAccepted: false },
    ])
      await expect(
        new MatterportClient({ ...options, transport: fetcher }).getModel(
          model.id,
          AbortSignal.timeout(2000),
        ),
      ).rejects.toBeInstanceOf(Error);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("rejects oversized responses before parsing", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response("{}", { headers: { "content-length": "2000000" } }),
      );
    await expect(
      new MatterportClient({ ...config, transport: fetcher }).getModel(
        model.id,
        AbortSignal.timeout(2000),
      ),
    ).rejects.toMatchObject({ code: "DATA_MISMATCH" });
  });
  it("preserves cancellation", async () => {
    const controller = new AbortController();
    controller.abort(new Error("cancelled"));
    await expect(
      new MatterportClient(config).getModel(model.id, controller.signal),
    ).rejects.toThrow("cancelled");
  });
});
describe("explicit cross-layer spatial evidence", () => {
  it("retains metric dimensions and disclosed sqft conversion without replacing rentable area", () => {
    const spatial = normalizeMatchedSpatial(
      property,
      match,
      model,
      "2026-11-14T18:00:00Z",
      permissions,
    );
    expect(spatial.model?.dimensionsUnit).toBe("m");
    expect(spatial.model?.areaUnit).toBe("m2");
    expect(spatial.model?.rooms[0].floorArea).toBe("80");
    expect(spatial.observations[0].statement).toContain("861.11 sqft");
    expect(property.rentableAreaSqft.value).toBe("10000");
    expect(spatial.imagery).toBeNull();
    expect(spatial.evidence.every((e) => !e.allowedUse.modelProcessing)).toBe(
      true,
    );
  });
  it("rejects a different commercial property, model, or conflicting location", () => {
    for (const [p, m, r] of [
      [property, { ...match, propertyId: "other" }, model],
      [property, match, { ...model, id: "other-model" }],
      [property, match, { ...model, geolocation: { lat: 0, long: 0 } }],
    ] as const)
      expect(() =>
        normalizeMatchedSpatial(p, m, r, "2026-11-14T18:00:00Z", permissions),
      ).toThrow();
  });
  it("keeps unknown dimensions unknown and makes no area claim", () => {
    const s = normalizeMatchedSpatial(
      property,
      match,
      { ...model, rooms: [{ id: "unmeasured", dimensions: null }] },
      "2026-11-14T18:00:00Z",
      permissions,
    );
    expect(s.model?.rooms[0].floorArea).toBeNull();
    expect(s.observations).toHaveLength(0);
  });
  it("does not retrieve an unmatched model", async () => {
    const fetcher = transport({ data: { model } });
    const provider = new MatterportSpatialProvider(
      new MatterportClient({ ...config, transport: fetcher }),
      async () => [],
      { permissions },
    );
    await expect(
      provider.getSpatialContext({
        property,
        signal: AbortSignal.timeout(2000),
      }),
    ).rejects.toMatchObject({ code: "DATA_MISMATCH" });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("only exposes a verified Showcase SID matching the retrieved model", async () => {
    const make = (sid: string) => new MatterportSpatialProvider(
      new MatterportClient({ ...config, transport: transport({ data: { model } }) }),
      async () => [match],
      { permissions, showcase: { sid, verifiedAt: "2026-11-14T21:30:00Z" } },
    );
    const signal = AbortSignal.timeout(2000);
    const spatial = await make(model.id).getSpatialContext({ property, signal });
    expect(spatial.model?.showcase?.sid).toBe(model.id);
    await expect(make("another-model").getSpatialContext({ property, signal })).rejects.toMatchObject({ code: "DATA_MISMATCH" });
  });

});
