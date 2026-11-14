import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { normalizeCommercialProperty } from "@/lib/providers/costar/records";
import { CoStarDatasetProvider } from "@/lib/providers/costar/dataset";
import {
  readCommercialModelMapping,
  selectCommercialModel,
} from "@/lib/providers/costar/mapping";
const permissions = { display: false, modelProcessing: false, export: false };
const at = "2026-11-14T18:00:00Z";
// Deliberately fictional source-shaped record, not a sponsor payload or snapshot.
const record = {
  id: 900000001,
  propertyType: 5,
  constructionStatus: 1,
  primaryAddress: {
    streetNumber: "100",
    streetName: "Fictional",
    city: "Imaginary",
    state: "TX",
    postcode: "00000",
    longitude: -95,
    latitude: 29,
  },
  grossBuildingAreaSquareFeet: 12000,
  rentableBuildingAreaSquareFeet: 10000,
  numStoriesAboveGrade: 1,
  constructionEvents: [{ eventType: 2, year: 2000 }],
  secretContact: "MUST_NOT_CROSS_BOUNDARY",
  attachments: [{ attachmentUri: "https://example.com/?token=secret" }],
};
const dirs: string[] = [];
afterEach(async () => {
  await Promise.all(
    dirs.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  );
});
async function kit(
  records: unknown[] = [record],
  csv = 'PropertyId,MatterportModelId,Address,City,State\n900000001,fictional-model,"100 Fictional, Suite 1",Imaginary,TX\n',
) {
  const dir = await mkdtemp(join(tmpdir(), "kestrel-synthetic-"));
  dirs.push(dir);
  await mkdir(join(dir, "data"));
  await writeFile(
    join(dir, "data/commercial-property.jsonl"),
    records.map((r) => JSON.stringify(r)).join("\n"),
  );
  await writeFile(join(dir, "commercial-properties.csv"), csv);
  return dir;
}
describe("CoStar normalization", () => {
  it("preserves an explicitly recorded address range without inferring scan coverage", () => {
    const p=normalizeCommercialProperty({...record,primaryAddress:{...record.primaryAddress,streetType:"Rd"},addresses:[{...record.primaryAddress,streetType:"Rd",streetNumberEndRange:"104"}]},at,permissions);
    expect(p.address.value).toContain("100 Fictional Rd");
    expect(p.address.note).toContain("Dataset address range: 100–104 Fictional Rd");
    expect(p.address.note).toContain("does not establish");
  });
  it("retains units, provenance and unknowns without leaking unrelated fields", () => {
    const p = normalizeCommercialProperty(record, at, permissions);
    expect(p.dataMode).toBe("sponsor_dataset");
    expect(p.rentableAreaSqft.value).toBe("10000");
    expect(p.rentableAreaSqft.unit).toBe("sqft");
    expect(p.yearBuilt.value).toBe(2000);
    expect(p.marketRentAnnualPerSqft.value).toBeNull();
    expect(p.occupancyRatio.origin).toBe("unknown");
    expect(p.evidence[0].allowedUse.modelProcessing).toBe(false);
    expect(JSON.stringify(p)).not.toMatch(/MUST_NOT|token=|secretContact/);
  });
  it("does not substitute gross area or missing coordinates", () => {
    const p = normalizeCommercialProperty(
      { ...record, rentableBuildingAreaSquareFeet: null, primaryAddress: null },
      at,
      permissions,
    );
    expect(p.rentableAreaSqft.value).toBeNull();
    expect(p.location.value).toBeNull();
  });
  it("uses documented retail GLA rather than gross area", () => {
    const p = normalizeCommercialProperty(
      {
        ...record,
        propertyType: 6,
        rentableBuildingAreaSquareFeet: null,
        propertyRetail: { grossLeasableAreaSquareFeet: 8000 },
      },
      at,
      permissions,
    );
    expect(p.rentableAreaSqft.value).toBe("8000");
    expect(p.rentableAreaSqft.note).toContain("retail lease basis");
  });
  it("rejects impossible area and malformed records without raw values", () => {
    expect(() =>
      normalizeCommercialProperty(
        { ...record, rentableBuildingAreaSquareFeet: 13000 },
        at,
        permissions,
      ),
    ).toThrow(/invalid area/);
    expect(() =>
      normalizeCommercialProperty({ secret: "sensitive" }, at, permissions),
    ).toThrow(/documented dataset shape/);
  });
  it("keeps conflicting construction years unknown", () =>
    expect(
      normalizeCommercialProperty(
        {
          ...record,
          constructionEvents: [
            { eventType: 2, year: 2000 },
            { eventType: 2, year: 2001 },
          ],
        },
        at,
        permissions,
      ).yearBuilt.value,
    ).toBeNull());
});
describe("bounded dataset ingestion", () => {
  it("reads the selected dataset record and a bounded catalog", async () => {
    const provider = new CoStarDatasetProvider({
      kitDir: await kit(),
      agreementAccepted: true,
      permissions,
      now: () => new Date(at),
    });
    expect(
      (
        await provider.getProperty({
          propertyId: String(record.id),
          signal: AbortSignal.timeout(5000),
        })
      ).id,
    ).toBe(String(record.id));
    expect(
      await provider.listProperties({
        limit: 1,
        signal: AbortSignal.timeout(5000),
      }),
    ).toHaveLength(1);
  });
  it("blocks unaccepted access before file reads", async () => {
    const provider = new CoStarDatasetProvider({
      kitDir: "/does/not/exist",
      agreementAccepted: false,
      permissions,
    });
    await expect(
      provider.getProperty({
        propertyId: String(record.id),
        signal: AbortSignal.timeout(1000),
      }),
    ).rejects.toMatchObject({ code: "LICENSE_RESTRICTED" });
  });
  it("rejects duplicate IDs, unknown IDs and path-like input", async () => {
    const provider = new CoStarDatasetProvider({
      kitDir: await kit([record, record]),
      agreementAccepted: true,
      permissions,
    });
    await expect(
      provider.getProperty({
        propertyId: String(record.id),
        signal: AbortSignal.timeout(1000),
      }),
    ).rejects.toMatchObject({ code: "DATA_MISMATCH" });
    await expect(
      provider.getProperty({
        propertyId: "../secret",
        signal: AbortSignal.timeout(1000),
      }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    const valid = new CoStarDatasetProvider({
      kitDir: await kit(),
      agreementAccepted: true,
      permissions,
    });
    await expect(
      valid.getProperty({
        propertyId: "900000002",
        signal: AbortSignal.timeout(1000),
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
  it("honors cancellation", async () => {
    const controller = new AbortController();
    controller.abort(new Error("cancelled"));
    const provider = new CoStarDatasetProvider({
      kitDir: await kit(),
      agreementAccepted: true,
      permissions,
    });
    await expect(
      provider.listProperties({ limit: 1, signal: controller.signal }),
    ).rejects.toThrow("cancelled");
  });
});
describe("commercial model mapping", () => {
  it("parses quoted CSV and joins on explicit IDs", async () => {
    const matches = await readCommercialModelMapping(
      { kitDir: await kit(), agreementAccepted: true },
      AbortSignal.timeout(5000),
    );
    expect(selectCommercialModel(matches, String(record.id)).modelId).toBe(
      "fictional-model",
    );
    expect(() => selectCommercialModel(matches, "other-property")).toThrow(
      /No explicit/,
    );
  });
  it("rejects missing, residential and conflicting join keys", async () => {
    await expect(
      readCommercialModelMapping(
        {
          kitDir: await kit(
            [],
            "ListingId,MatterportModelId\n900000001,fictional-model\n",
          ),
          agreementAccepted: true,
        },
        AbortSignal.timeout(5000),
      ),
    ).rejects.toMatchObject({ code: "DATA_MISMATCH" });
    const conflicting = await readCommercialModelMapping(
      {
        kitDir: await kit(
          [],
          "PropertyId,MatterportModelId\n900000001,fictional-model\n900000002,fictional-model\n",
        ),
        agreementAccepted: true,
      },
      AbortSignal.timeout(5000),
    );
    expect(() => selectCommercialModel(conflicting, "900000001")).toThrow(
      /conflicting/,
    );
  });
  it("requires reviewed selection when a property has several scans", () => {
    const matches = ["scan-a", "scan-b"].map((modelId) => ({
      modelId,
      propertyId: "900000001",
      source: "commercial_property_mapping" as const,
    }));
    expect(() => selectCommercialModel(matches, "900000001")).toThrow(
      /Multiple/,
    );
    expect(selectCommercialModel(matches, "900000001", "scan-a").modelId).toBe(
      "scan-a",
    );
  });
});
