import type { PropertyDTO } from "@/lib/contracts";
import { createIllustrativeInvestmentExample } from "@/lib/scenarios/illustrative-example";
import { initialModel, type EditorModel } from "./model";

/**
 * What an explicit "Load illustrative example" click should do. Pure: it never
 * edits state. Untouched drafts (still the initial model, or already equal to
 * the example) load immediately so the demo stays fast; anything the person has
 * edited needs a confirmation before it is replaced. A failure carries the
 * adapter's message and leaves every draft alone.
 */
export type IllustrativeLoadPlan =
  | { kind: "load"; model: EditorModel }
  | { kind: "confirm"; model: EditorModel }
  | { kind: "error"; message: string };

export function planIllustrativeLoad(property: PropertyDTO, current: EditorModel): IllustrativeLoadPlan {
  const result = createIllustrativeInvestmentExample(property, current.year);
  if (!result.ok) return { kind: "error", message: result.message };
  const same = (a: EditorModel, b: EditorModel) => JSON.stringify(a) === JSON.stringify(b);
  const untouched =
    same(current, initialModel(property, current.year)) || same(current, result.model);
  return untouched ? { kind: "load", model: result.model } : { kind: "confirm", model: result.model };
}
