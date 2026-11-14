import { expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import { resolve } from "node:path";
import Decimal from "decimal.js";
import { selectLiveCommercial } from "./provider-setup";
it("reads a real sanctioned commercial JSONL record and verifies mapped facts", async () => {
  const { property, config, matches } = await selectLiveCommercial(
    AbortSignal.timeout(15000),
  );
  let source: Record<string, unknown> | undefined;
  const stream = createReadStream(
    resolve(config.kitDir, "data/commercial-property.jsonl"),
    { encoding: "utf8" },
  );
  const lines = createInterface({ input: stream, crlfDelay: Infinity });
  try {
    for await (const line of lines) {
      const r = JSON.parse(line);
      if (String(r.id) === property.id) {
        source = r;
        break;
      }
    }
  } finally {
    lines.close();
    stream.destroy();
  }
  // Boolean assertions prevent a failure reporter from printing restricted record values.
  expect(!!source).toBe(true);
  expect(property.dataMode === "sponsor_dataset").toBe(true);
  expect(
    property.evidence.every(
      (e) =>
        !e.synthetic && e.provider === "costar" && e.recordId === property.id,
    ),
  ).toBe(true);
  expect(
    property.grossAreaSqft.value ===
      new Decimal(String(source!.grossBuildingAreaSquareFeet)).toFixed(),
  ).toBe(true);
  expect(property.rentableAreaSqft.origin === "source_data").toBe(true);
  expect(
    property.marketRentAnnualPerSqft.value === null &&
      property.occupancyRatio.value === null,
  ).toBe(true);
  expect(matches.filter((m) => m.propertyId === property.id).length === 1).toBe(
    true,
  );
});
