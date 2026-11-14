import { describe, expect, it } from "vitest";
import { createApiClient } from "@/lib/contracts/client";
import * as f from "../fixtures/contracts";

const transport = (data: unknown, status = 200) =>
  (async () => new Response(JSON.stringify(data), { status })) as typeof fetch;

describe("property identity checks", () => {
  it("accepts a property detail whose identity is its own id", async () => {
    const r = await createApiClient(transport(f.success(f.property))).getProperty(f.propertyId);
    expect(r.ok).toBe(true);
  });
  it("rejects a property detail for a different property", async () => {
    const r = await createApiClient(transport(f.success(f.property))).getProperty("another-property");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("CONTRACT_MISMATCH");
  });
  it("still rejects a spatial response for a different property", async () => {
    const r = await createApiClient(transport(f.success(f.spatial))).getSpatialContext("another-property");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("CONTRACT_MISMATCH");
  });
  it("still rejects a comparison answering another input revision", async () => {
    const r = await createApiClient(
      transport(f.success({ ...f.comparison, inputRevision: 99 })),
    ).compare(f.f01);
    expect(r.ok).toBe(false);
  });
});
