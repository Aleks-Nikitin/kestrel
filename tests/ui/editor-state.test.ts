import { describe, expect, it } from "vitest";
import { property } from "../fixtures/contracts";
import { canAddAlternative, canRemoveAlternative, editorReducer } from "@/features/scenarios/editor-state";
import { MAX_SCENARIOS, initialModel } from "@/features/scenarios/model";

const base = () => initialModel(property, 2026);

describe("editorReducer", () => {
  it("patches one scenario without changing its id or role", () => {
    const m = editorReducer(base(), {
      type: "patch_scenario",
      id: "alternative-a",
      patch: { name: "Storage", id: "evil", role: "baseline" },
    });
    expect(m.scenarios[1]).toMatchObject({ id: "alternative-a", role: "alternative", name: "Storage" });
    expect(m.scenarios[2].name).toBe("Alternative B");
  });
  it("patches constraints", () => {
    const m = editorReducer(base(), { type: "patch_constraints", patch: { riskTolerance: "low" } });
    expect(m.constraints.riskTolerance).toBe("low");
  });
  it("adds alternatives with unused ids up to the maximum", () => {
    let m = base();
    while (canAddAlternative(m)) m = editorReducer(m, { type: "add_alternative" });
    expect(m.scenarios).toHaveLength(MAX_SCENARIOS);
    expect(new Set(m.scenarios.map((s) => s.id)).size).toBe(MAX_SCENARIOS);
    expect(editorReducer(m, { type: "add_alternative" })).toBe(m);
  });
  it("keeps at least two alternatives and never removes the baseline", () => {
    const m = base();
    expect(canRemoveAlternative(m, "alternative-a")).toBe(false);
    expect(canRemoveAlternative(m, "baseline")).toBe(false);
    const three = editorReducer(m, { type: "add_alternative" });
    expect(three.scenarios.at(-1)?.id).toBe("alternative-c");
    const removed = editorReducer(three, { type: "remove_alternative", id: "alternative-a" });
    expect(removed.scenarios.map((s) => s.id)).toEqual(["baseline", "alternative-b", "alternative-c"]);
    // id reuse after removal picks the first free letter
    expect(editorReducer(removed, { type: "add_alternative" }).scenarios.at(-1)?.id).toBe("alternative-a");
    expect(editorReducer(m, { type: "remove_alternative", id: "alternative-a" })).toBe(m);
  });
});
