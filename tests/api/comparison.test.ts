import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { createHandlers } from "@/lib/api/handlers";
import {
  ComparisonResponse,
  apiResponse,
  type PropertyProvider,
  type SpatialProvider,
} from "@/lib/contracts";
import { property, spatial, f01, originForgery } from "../fixtures/contracts";
import { ProviderError } from "@/lib/providers/errors";
function setup() {
  const propertyProvider: PropertyProvider = {
    listProperties: vi.fn(async () => [property]),
    getProperty: vi.fn(async () => property),
  };
  const spatialProvider: SpatialProvider = {
    getSpatialContext: vi.fn(async () => spatial),
  };
  return {
    handlers: createHandlers(() => ({
      property: propertyProvider,
      spatial: spatialProvider,
    })),
    propertyProvider,
    spatialProvider,
  };
}
const req = (data: unknown, origin = "http://localhost") =>
  new Request("http://localhost/api/v1/scenarios/compare", {
    method: "POST",
    headers: { "content-type": "application/json", origin },
    body: JSON.stringify(data),
  });
describe("actual route boundary and deterministic comparison", () => {
  it("normalizes trusted origins and computes F01 without any model call", async () => {
    const { handlers, spatialProvider } = setup();
    const response = await handlers.compare(req(f01));
    expect(response.status).toBe(200);
    const body = apiResponse(ComparisonResponse).parse(await response.json());
    if (!body.ok) throw Error("comparison failed");
    expect(body.data.inputRevision).toBe(1);
    expect(body.data.comparison.preferredScenarioId).toBe("alternative-b");
    expect(
      body.data.comparison.results.find((r) => r.scenarioId === "alternative-a")
        ?.noi.value,
    ).toBe("190000");
    expect(body.data.scenarios[1].annualRentPerSqft.origin).toBe("user_input");
    expect(spatialProvider.getSpatialContext).not.toHaveBeenCalled();
  });
  it("changes the preferred scenario with a smaller real constraint", async () => {
    const { handlers } = setup();
    const input = structuredClone(f01);
    input.constraints.maxInitialInvestment.value = "350000";
    input.inputRevision = 11;
    const response = await handlers.compare(req(input));
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.data.comparison.preferredScenarioId).toBe("alternative-a");
    expect(body.data.inputRevision).toBe(11);
  });
  it("rejects client origins and calculated values before provider access", async () => {
    const { handlers, propertyProvider } = setup();
    const response = await handlers.compare(req(originForgery));
    expect(response.status).toBe(400);
    expect(propertyProvider.getProperty).not.toHaveBeenCalled();
  });
  it("rejects cross-origin and oversized bodies", async () => {
    const { handlers } = setup();
    expect(
      (await handlers.compare(req(f01, "https://attacker.example"))).status,
    ).toBe(403);
    expect(
      (await handlers.compare(req({ padding: "a".repeat(200000) }))).status,
    ).toBe(413);
  });
  it("keeps unknown expenses incomplete instead of defaulting to zero", async () => {
    const { handlers } = setup();
    const input = structuredClone(f01);
    input.scenarios[1].operatingExpenses = {
      mode: "total",
      annualAmount: { value: null },
    };
    const body = await (await handlers.compare(req(input))).json();
    expect(body.ok).toBe(true);
    expect(body.data.comparison.results[1].noi.value).toBeNull();
    expect(body.data.comparison.preferredScenarioId).toBeNull();
  });
  it("validates property and spatial responses and returns safe provider errors", async () => {
    const { handlers, propertyProvider } = setup();
    expect(
      (
        await handlers.catalog(
          new Request("http://localhost/api/v1/properties"),
        )
      ).status,
    ).toBe(200);
    expect(
      (await handlers.property(new Request("http://localhost"), property.id))
        .status,
    ).toBe(200);
    expect(
      (await handlers.spatial(new Request("http://localhost"), property.id))
        .status,
    ).toBe(200);
    vi.mocked(propertyProvider.getProperty).mockRejectedValue(
      new ProviderError("UPSTREAM_AUTH", "Provider access rejected."),
    );
    const response = await handlers.compare(req(f01));
    expect(response.status).toBe(502);
    expect((await response.json()).error.code).toBe("UPSTREAM_AUTH");
  });
  it("uses source provenance only for exactly matching verified values", async () => {
    const { handlers } = setup();
    const input = structuredClone(f01);
    input.scenarios[0].rentableAreaSqft = {
      value: property.rentableAreaSqft.value,
    };
    const body = await (await handlers.compare(req(input))).json();
    expect(body.ok).toBe(true);
    expect(body.data.scenarios[0].rentableAreaSqft.origin).toBe(
      property.rentableAreaSqft.origin,
    );
  });
});
