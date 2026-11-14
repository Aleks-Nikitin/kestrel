import {
  MAX_SCENARIOS,
  MIN_ALTERNATIVES,
  newAlternative,
  type ConstraintsForm,
  type EditorModel,
  type ScenarioForm,
} from "./model";

export type EditorAction =
  | { type: "patch_scenario"; id: string; patch: Partial<ScenarioForm> }
  | { type: "patch_constraints"; patch: Partial<ConstraintsForm> }
  | { type: "add_alternative" }
  | { type: "remove_alternative"; id: string };

export function canAddAlternative(m: EditorModel) {
  return m.scenarios.length < MAX_SCENARIOS;
}
export function canRemoveAlternative(m: EditorModel, id: string) {
  const s = m.scenarios.find((x) => x.id === id);
  return (
    !!s &&
    s.role === "alternative" &&
    m.scenarios.filter((x) => x.role === "alternative").length > MIN_ALTERNATIVES
  );
}

export function editorReducer(m: EditorModel, a: EditorAction): EditorModel {
  switch (a.type) {
    case "patch_scenario":
      return {
        ...m,
        scenarios: m.scenarios.map((s) =>
          s.id === a.id ? { ...s, ...a.patch, id: s.id, role: s.role } : s,
        ),
      };
    case "patch_constraints":
      return { ...m, constraints: { ...m.constraints, ...a.patch } };
    case "add_alternative": {
      if (!canAddAlternative(m)) return m;
      // First unused letter, so ids stay unique after removals.
      let i = 0;
      while (m.scenarios.some((s) => s.id === newAlternative(i).id)) i += 1;
      return { ...m, scenarios: [...m.scenarios, newAlternative(i)] };
    }
    case "remove_alternative":
      if (!canRemoveAlternative(m, a.id)) return m;
      return { ...m, scenarios: m.scenarios.filter((s) => s.id !== a.id) };
  }
}
