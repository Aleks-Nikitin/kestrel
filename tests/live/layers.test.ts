import { expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { selectLiveCommercial } from "./provider-setup";
import { MatterportClient } from "@/lib/providers/matterport/client";
import { MatterportSpatialProvider } from "@/lib/providers/matterport/spatial";
it("retrieves metric room estimates from an explicitly matched real commercial model", async () => {
  const signal = AbortSignal.timeout(20000);
  const { property, matches } = await selectLiveCommercial(signal);
  if (!process.env.MATTERPORT_API_KEY || !process.env.MATTERPORT_API_TOKEN)
    throw new Error(
      "MATTERPORT_API_KEY and MATTERPORT_API_TOKEN are required; no live test is skipped.",
    );
  const provider = new MatterportSpatialProvider(
    new MatterportClient({
      apiKey: process.env.MATTERPORT_API_KEY,
      apiToken: process.env.MATTERPORT_API_TOKEN,
      agreementAccepted: true,
    }),
    async () => matches,
    { permissions: { display: false, modelProcessing: false, export: false } },
  );
  const spatial = await provider.getSpatialContext({ property, signal });
  // Never emit restricted model IDs, addresses, dimensions or response payloads in test diagnostics.
  expect(spatial.propertyId === property.id).toBe(true);
  expect(
    spatial.match.status === "verified" &&
      spatial.model?.commercialPropertyId === property.id,
  ).toBe(true);
  expect(
    spatial.dataMode === "live" && property.dataMode === "sponsor_dataset",
  ).toBe(true);
  expect(
    spatial.model?.dimensionsUnit === "m" && spatial.model?.areaUnit === "m2",
  ).toBe(true);
  expect(
    !!spatial.model?.rooms.some(
      (r) => r.floorArea !== null && r.width !== null && r.depth !== null,
    ),
  ).toBe(true);
  expect(spatial.observations.length > 0).toBe(true);
  expect(
    spatial.evidence.every(
      (e) =>
        !e.allowedUse.modelProcessing &&
        !e.allowedUse.display &&
        !e.allowedUse.export,
    ),
  ).toBe(true);
});
