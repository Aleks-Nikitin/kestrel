import { expect, it } from "vitest";
import { apiResponse, CatalogResponse, ComparisonResponse, Property } from "@/lib/contracts";
import { buildRequest } from "@/features/scenarios/model";
import { createIllustrativeInvestmentExample } from "@/lib/scenarios/illustrative-example";

/** Opt-in local comparison only: no /analysis route or paid model is called. */
it("the selected local property preserves the reviewed budget preference change with the illustrative adapter", async () => {
  const base = new URL(process.env.LIVE_BASE_URL ?? "http://localhost:4321");
  if (base.protocol !== "http:" || !["localhost", "127.0.0.1", "[::1]"].includes(base.hostname))
    throw Error("This verification requires the authorized loopback demo.");
  const catalog = apiResponse(CatalogResponse).parse(await (await fetch(new URL("/api/v1/properties", base))).json());
  if (!catalog.ok) throw Error(`Local catalog unavailable: ${catalog.error.code}`);
  expect(catalog.data.properties.length === 1).toBe(true);
  const id = catalog.data.properties[0].id;
  const property = apiResponse(Property).parse(await (await fetch(new URL(`/api/v1/properties/${encodeURIComponent(id)}`, base))).json());
  if (!property.ok) throw Error(`Local property unavailable: ${property.error.code}`);
  const loaded = createIllustrativeInvestmentExample(property.data, 2026);
  if (!loaded.ok) throw Error(`Illustrative draft unavailable: ${loaded.reason}`);
  const first = buildRequest(loaded.model, id, 401);
  const second = structuredClone(first);
  second.inputRevision++;
  second.constraints.maxInitialInvestment.value = "1000000";
  expect(JSON.stringify(first.scenarios) === JSON.stringify(second.scenarios)).toBe(true);
  const compare = async (input: typeof first) => {
    const response = await fetch(new URL("/api/v1/scenarios/compare", base), {
      method: "POST", headers: { "content-type": "application/json", origin: base.origin }, body: JSON.stringify(input),
    });
    const result = apiResponse(ComparisonResponse).parse(await response.json());
    if (!result.ok) throw Error(`Local comparison unavailable: ${result.error.code}`);
    return result.data;
  };
  const initial = await compare(first), changed = await compare(second);
  expect(initial.comparison.preferredScenarioId === "alternative-b").toBe(true);
  expect(changed.comparison.preferredScenarioId === "alternative-a").toBe(true);
  expect(changed.comparison.feasibility.find(f => f.scenarioId === "alternative-b")?.eligibility === "excluded").toBe(true);
  expect(initial.comparison.results.every(r => [r.noi, r.initialInvestment, r.incrementalNoi, r.yieldOnCost].every(d => d.value !== null))).toBe(true);
  expect(initial.scenarios.every(s => s.annualRentPerSqft.origin === "user_input" && s.occupancyRatio.origin === "user_input" && s.rentableAreaSqft.origin === "source_data")).toBe(true);
  console.info("Local illustrative comparison verified", { preferredAtTwoMillion: "alternative-b", preferredAtOneMillion: "alternative-a", noPaidModelCalls: true });
});
