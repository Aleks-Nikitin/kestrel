import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { createProtectedCatalog } from "@/lib/providers/protected-catalog";
import { MatterportClient } from "@/lib/providers/matterport/client";
import { property as fixture } from "../fixtures/contracts";
const permissions = { display: true, modelProcessing: true, export: false };
const auth = { agreementAccepted: true, permissions };
function record(id: string, model: string, published = false) {
  const property = structuredClone(fixture); property.id = id;
  property.evidence.forEach(e => { e.propertyId = id; });
  return { property, modelMapping: { propertyId: id, modelId: model, source: "commercial_property_mapping", ...(published ? { showcase: { sid: model, verifiedAt: "2026-11-14T20:00:00Z" } } : {}) } };
}
function client(fail = "") {
  const transport = vi.fn<typeof fetch>(async (_url, init) => {
    const id = JSON.parse(String(init?.body)).variables.id;
    return Response.json({ data: { model: id === fail ? null : { id, rooms: [{ id: `room-${id}`, dimensions: { width: 5, depth: 4, height: null, areaFloor: null } }] } } });
  });
  return { transport, client: new MatterportClient({ apiKey: "fictional", apiToken: "fictional", agreementAccepted: true, transport }) };
}
const signal = () => AbortSignal.timeout(1000);
describe("bounded protected property catalog", () => {
  it("preserves the original first property and honors limits without exposing unlisted records", async () => {
    const p = createProtectedCatalog(record("original", "OriginalModel1"), [record("second", "SecondModel2"), record("third", "ThirdModel3")], auth, client().client);
    expect((await p.property.listProperties({ limit: 20, signal: signal() })).map(r => r.id)).toEqual(["original", "second", "third"]);
    expect((await p.property.listProperties({ limit: 1, signal: signal() })).map(r => r.id)).toEqual(["original"]);
    await expect(p.property.getProperty({ propertyId: "not-allowed", signal: signal() })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
  it("requires the original agreement and display gates", () => {
    for (const authorization of [{ ...auth, agreementAccepted: false }, { ...auth, permissions: { ...permissions, display: false } }])
      expect(() => createProtectedCatalog(record("one", "ModelOne1"), [], authorization, client().client)).toThrow();
  });
  it("rejects duplicated property/model IDs and mismatched publication identities", () => {
    const base = record("one", "ModelOne1", true);
    const wrong = record("two", "ModelTwo2", true); wrong.modelMapping.showcase!.sid = "ModelOne1";
    const wrongJoin = record("two", "ModelTwo2"); wrongJoin.modelMapping.propertyId = "one";
    for (const extras of [[record("one", "ModelTwo2")], [record("two", "ModelOne1")], [wrong], [wrongJoin], Array.from({ length: 5 }, (_, i) => record(`extra-${i}`, `ExtraModel${i}`))])
      expect(() => createProtectedCatalog(base, extras, auth, client().client)).toThrow();
  });
  it("retrieves only each selected property's own scan and never reuses publication metadata", async () => {
    const network = client();
    const p = createProtectedCatalog(record("one", "ModelOne1", true), [record("two", "ModelTwo2")], auth, network.client);
    for (const [id, model] of [["one", "ModelOne1"], ["two", "ModelTwo2"], ["one", "ModelOne1"]]) {
      const property = await p.property.getProperty({ propertyId: id, signal: signal() });
      const spatial = await p.spatial.getSpatialContext({ property, signal: signal() });
      expect(spatial.propertyId).toBe(id); expect(spatial.model?.id).toBe(model); expect(spatial.model?.commercialPropertyId).toBe(id);
      expect(spatial.model?.showcase?.sid).toBe(id === "one" ? model : undefined);
      expect(spatial.model?.rooms[0].height).toBeNull(); expect(spatial.model?.rooms[0].floorArea).toBeNull();
      expect(spatial.evidence.every(e => e.propertyId === id)).toBe(true);
    }
    expect(network.transport.mock.calls.map(([, init]) => JSON.parse(String(init?.body)).variables.id)).toEqual(["ModelOne1", "ModelTwo2", "ModelOne1"]);
  });
  it("fails a missing scan honestly rather than supplying another building's model", async () => {
    const p = createProtectedCatalog(record("one", "ModelOne1"), [record("two", "ModelTwo2")], auth, client("ModelTwo2").client);
    const one = await p.property.getProperty({ propertyId: "one", signal: signal() });
    expect((await p.spatial.getSpatialContext({ property: one, signal: signal() })).model?.id).toBe("ModelOne1");
    const two = await p.property.getProperty({ propertyId: "two", signal: signal() });
    await expect(p.spatial.getSpatialContext({ property: two, signal: signal() })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
  it("supports a real-property-only record without fabricating or fetching a scan", async () => {
    const network = client(); const extra = { property: record("no-scan", "unused").property, modelMapping: null };
    const p = createProtectedCatalog(record("one", "ModelOne1", true), [extra], auth, network.client);
    const property = await p.property.getProperty({ propertyId: "no-scan", signal: signal() });
    const spatial = await p.spatial.getSpatialContext({ property, signal: signal() });
    expect(spatial.propertyId).toBe("no-scan"); expect(spatial.match.status).toBe("unmatched");
    expect(spatial.model).toBeNull(); expect(spatial.observations).toEqual([]); expect(spatial.dataMode).toBe("unavailable");
    expect(network.transport).not.toHaveBeenCalled();
  });
  it("keeps processing permission false and rejects unlisted spatial context", async () => {
    const p = createProtectedCatalog(record("one", "ModelOne1"), [], { ...auth, permissions: { ...permissions, modelProcessing: false } }, client().client);
    const property = await p.property.getProperty({ propertyId: "one", signal: signal() });
    expect(property.evidence.every(e => !e.allowedUse.modelProcessing)).toBe(true);
    await expect(p.spatial.getSpatialContext({ property: { ...property, id: "other" }, signal: signal() })).rejects.toMatchObject({ code: "DATA_MISMATCH" });
  });
});
