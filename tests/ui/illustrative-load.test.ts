import { describe, expect, it } from "vitest";
import { property } from "../fixtures/contracts";
import { editorReducer } from "@/features/scenarios/editor-state";
import { planIllustrativeLoad } from "@/features/scenarios/illustrative-load";
import { initialModel } from "@/features/scenarios/model";
import { ILLUSTRATIVE_EXAMPLE_DISCLOSURE, ILLUSTRATIVE_EXAMPLE_LABEL } from "@/lib/scenarios/illustrative-example";
import { initialState, reducer } from "@/features/dashboard/state";

const withArea = () => ({
  ...property,
  rentableAreaSqft: { ...property.rentableAreaSqft, value: "10000", origin: "source_data" as const },
});
const withoutArea = () => ({
  ...property,
  rentableAreaSqft: { ...property.rentableAreaSqft, value: null, origin: "unknown" as const },
});

describe("illustrative example load plan", () => {
  it("loads untouched initial drafts immediately", () => {
    const p = withArea();
    const plan = planIllustrativeLoad(p, initialModel(p, 2026));
    expect(plan.kind).toBe("load");
    if (plan.kind === "load") {
      expect(plan.model.scenarios).toHaveLength(3);
      expect(plan.model.constraints.maxInitialInvestment.text).toBe("2000000");
      expect(plan.model.scenarios[0].rentableAreaSqft).toEqual({ text: "10000", accepted: false });
    }
  });
  it("asks before replacing user-edited drafts, and applies nothing itself", () => {
    const p = withArea();
    const edited = editorReducer(initialModel(p, 2026), {
      type: "patch_constraints",
      patch: { riskTolerance: "low" },
    });
    const before = JSON.stringify(edited);
    expect(planIllustrativeLoad(p, edited).kind).toBe("confirm");
    expect(JSON.stringify(edited)).toBe(before);
  });
  it("reloading an already loaded example needs no confirmation", () => {
    const p = withArea();
    const plan = planIllustrativeLoad(p, initialModel(p, 2026));
    if (plan.kind !== "load") throw new Error("expected load");
    expect(planIllustrativeLoad(p, plan.model).kind).toBe("load");
  });
  it("fails with a message for missing or assumed rentable area, inventing nothing", () => {
    const p = withoutArea();
    const m = initialModel(p, 2026);
    const plan = planIllustrativeLoad(p, m);
    expect(plan).toMatchObject({ kind: "error", message: expect.stringContaining("recorded rentable area") });
    const assumed = { ...property, rentableAreaSqft: { ...property.rentableAreaSqft, value: "9000", origin: "assumption" as never } };
    expect(planIllustrativeLoad(assumed, initialModel(assumed, 2026)).kind).toBe("error");
  });
  it("replace_model swaps the whole model", () => {
    const p = withArea();
    const plan = planIllustrativeLoad(p, initialModel(p, 2026));
    if (plan.kind !== "load") throw new Error("expected load");
    expect(editorReducer(initialModel(p, 2026), { type: "replace_model", model: plan.model })).toBe(plan.model);
  });
  it("exports the disclosure and label shown beside the action", () => {
    expect(ILLUSTRATIVE_EXAMPLE_LABEL).toBe("Load illustrative investment example");
    expect(ILLUSTRATIVE_EXAMPLE_DISCLOSURE).toMatch(/hypothetical/);
    expect(ILLUSTRATIVE_EXAMPLE_DISCLOSURE).toMatch(/not sponsor facts/);
  });
  it("one edit advances the input revision exactly once", () => {
    const s = reducer({ ...initialState, selectedId: "p" }, { type: "revision_bumped" });
    expect(s.inputRevision).toBe(initialState.inputRevision + 1);
  });
});
