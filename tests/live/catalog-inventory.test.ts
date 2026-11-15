import { readFile, writeFile, chmod } from "node:fs/promises";
import { resolve } from "node:path";
import { config } from "dotenv";
import { expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { CommercialRecord, isSupportedCommercial, normalizeCommercialProperty } from "@/lib/providers/costar/records";
import { readCommercialModelMapping, selectCommercialModel } from "@/lib/providers/costar/mapping";
import { MatterportClient } from "@/lib/providers/matterport/client";
import { normalizeMatchedSpatial } from "@/lib/providers/matterport/spatial";
config({ quiet: true });
it("inventories authorized commercial coverage and optionally prepares a bounded protected catalog", async () => {
  if (process.env.SPONSOR_AGREEMENT_ACCEPTED !== "true") throw Error("Owner-authorized sponsor access is required.");
  const kitDir = process.env.COSTAR_KIT_DIR || "sponsor-data/costar-hackathon-kit";
  const permissions = { display: true, modelProcessing: true, export: false };
  const mapping = await readCommercialModelMapping({ kitDir, agreementAccepted: true, indexPath: resolve(kitDir, "commercial-properties.csv") }, AbortSignal.timeout(15000));
  const lines = (await readFile(resolve(kitDir, "data/commercial-property.jsonl"), "utf8")).split("\n").filter(s => s.trim());
  const counts = { accessible: lines.length, supported: 0, candidate: 0, exactUnambiguousJoins: 0, normalized: 0, completeMappedPropertyFacts: 0, graphVerified: 0, measured: 0 };
  const ready = [];
  const unmapped = [];
  for (const line of lines) {
    const parsed = CommercialRecord.safeParse(JSON.parse(line));
    if (!parsed.success) throw Error("Commercial source validation failed; no records logged.");
    if (!isSupportedCommercial(parsed.data)) continue;
    counts.supported++;
    if (mapping.some(m => m.propertyId === String(parsed.data.id))) counts.candidate++;
    let binding;
    try { binding = selectCommercialModel(mapping, String(parsed.data.id)); counts.exactUnambiguousJoins++; } catch { /* Exclude ambiguous/conflicting joins. */ }
    try {
      const property = normalizeCommercialProperty(parsed.data, new Date().toISOString(), permissions);
      counts.normalized++;
      if (!mapping.some(m => m.propertyId === property.id) && property.address.value && property.location.value && Number(property.rentableAreaSqft.value) > 0) unmapped.push(property);
      if (binding && property.address.value && property.location.value && Number(property.rentableAreaSqft.value) > 0) {
        counts.completeMappedPropertyFacts++;
        ready.push({ property, modelMapping: binding });
      }
    } catch { /* A bad projection is excluded, never fabricated. */ }
  }
  const base = JSON.parse(await readFile("sponsor-data/runtime/demo-property.json", "utf8"));
  expect(selectCommercialModel(mapping, base.property.id).modelId === base.modelMapping.modelId).toBe(true);
  const client = new MatterportClient({ apiKey: process.env.MATTERPORT_API_KEY, apiToken: process.env.MATTERPORT_API_TOKEN, agreementAccepted: true });
  const selected = [];
  const usedTypes = new Set<string>();
  const candidates = ready.filter(r => r.property.id !== base.property.id);
  // At most twelve real read-only queries; diverse types first, then any useful pair.
  candidates.sort((a, b) => String(a.property.propertyType.value).localeCompare(String(b.property.propertyType.value)));
  let queries = 0;
  while (selected.length < 3 && candidates.length && queries < 12) {
    const index = Math.max(0, candidates.findIndex(r => !usedTypes.has(r.property.propertyType.value ?? "")));
    const candidate = candidates.splice(index, 1)[0]; queries++;
    try {
      const model = await client.getModel(candidate.modelMapping.modelId, AbortSignal.timeout(10000));
      const spatial = normalizeMatchedSpatial(candidate.property, candidate.modelMapping, model, new Date().toISOString(), permissions);
      counts.graphVerified++;
      if (!spatial.model?.rooms.some(r => Number(r.width) > 0 && Number(r.depth) > 0)) continue;
      counts.measured++; selected.push(candidate); usedTypes.add(candidate.property.propertyType.value ?? "");
    } catch { /* No property/model data or upstream payloads in logs. */ }
  }
  console.info("Authorized commercial coverage", { ...counts, allowedDisplayNormalizedProperties: counts.normalized, graphQueries: queries, selectedAdditional: selected.length, completeUnmappedPropertyFacts: unmapped.length });
  expect(selected.length === 3).toBe(true);
  if (process.env.KESTREL_PREPARE_CATALOG === "true") {
    const path = "sponsor-data/runtime/demo-catalog.json";
    await writeFile(path, JSON.stringify(selected, null, 2), { mode: 0o600 }); await chmod(path, 0o600);
  }
  if (process.env.KESTREL_ADD_COSTAR_ONLY === "true") {
    expect(unmapped.length > 0).toBe(true);
    const path = "sponsor-data/runtime/demo-catalog.json";
    const existing = JSON.parse(await readFile(path, "utf8"));
    if (!existing.some((r: { modelMapping: unknown }) => r.modelMapping === null)) {
      await writeFile(path, JSON.stringify([...existing, { property: unmapped[0], modelMapping: null }], null, 2), { mode: 0o600 });
      await chmod(path, 0o600);
    }
  }

}, 160000);
