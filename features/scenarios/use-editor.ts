import { useCallback, useMemo, useState } from "react";
import type { ComparisonRequestDTO, PropertyDTO } from "@/lib/contracts";
import { editorReducer, type EditorAction } from "./editor-state";
import { planIllustrativeLoad } from "./illustrative-load";
import {
  initialModel,
  problemCount,
  propertyProposals,
  validateModel,
  type EditorModel,
  type Proposal,
  type ProposalField,
  type ScenarioForm,
  type Validation,
} from "./model";
import { readiness, type Readiness } from "./readiness";

/** Quick Analysis and Advanced Underwriting are two views of the same drafts. */
export type EditorMode = "quick" | "advanced";

interface Session {
  propertyId: string;
  model: EditorModel;
  activeId: string;
  attempted: boolean;
  pendingLoad: EditorModel | null;
  loadError: string | null;
  mode: EditorMode;
}

export interface ScenarioEditor {
  property: PropertyDTO;
  model: EditorModel;
  validation: Validation;
  ready: Readiness;
  proposals: Partial<Record<ProposalField, Proposal>>;
  /** Field and form problems that block a request. */
  totalProblems: number;
  /** The validated request, or null while anything is invalid. */
  request: ComparisonRequestDTO | null;
  active: ScenarioForm;
  setActiveId: (id: string) => void;
  mode: EditorMode;
  /** Changes the view only: drafts, validation and the input revision are untouched. */
  setMode: (mode: EditorMode) => void;
  /** Every edit advances the input revision and stales older results. */
  edit: (action: EditorAction) => void;
  attempted: boolean;
  /** Marks a blocked submission and shows the first scenario with a problem. */
  markAttempt: () => void;
  clearAttempt: () => void;
  /** Explicit "load illustrative example": loads, asks to confirm, or reports why it cannot. */
  loadExample: () => void;
  confirmLoad: () => void;
  cancelLoad: () => void;
  pendingLoad: boolean;
  loadError: string | null;
}

/**
 * The scenario drafts for the selected property, held above the stages so the
 * underwriting, comparison and investigation stages read one model and no
 * navigation can drop it. Selecting a different property discards the session,
 * exactly as before; nothing here calculates a financial value.
 */
export function useScenarioEditor(
  property: PropertyDTO | null,
  selectedId: string | null,
  /**
   * The calendar year the stabilized period starts in. Read from the clock in
   * the selection handler, never while rendering, so prerendering and
   * hydration see no time-dependent value; null until a property is chosen.
   */
  year: number | null,
  inputRevision: number,
  onEdited: () => void,
): ScenarioEditor | null {
  const [stored, setStored] = useState<Session | null>(null);

  let session = stored;
  if (session && session.propertyId !== selectedId) {
    session = null;
    setStored(null);
  }
  if (property && property.id === selectedId && year !== null && !session) {
    session = {
      propertyId: property.id,
      model: initialModel(property, year),
      activeId: "baseline",
      attempted: false,
      pendingLoad: null,
      loadError: null,
      mode: "quick",
    };
    setStored(session);
  }

  const model = session?.model ?? null;
  const propertyId = property?.id ?? null;
  const validation = useMemo(
    () => (model && propertyId ? validateModel(model, propertyId, inputRevision) : null),
    [model, propertyId, inputRevision],
  );
  const ready = useMemo(() => (model ? readiness(model) : null), [model]);
  const proposals = useMemo(() => (property ? propertyProposals(property) : {}), [property]);

  const patch = useCallback((change: Partial<Session>) => {
    setStored((s) => (s ? { ...s, ...change } : s));
  }, []);

  const edit = useCallback(
    (action: EditorAction) => {
      setStored((s) => (s ? { ...s, model: editorReducer(s.model, action) } : s));
      onEdited();
    },
    [onEdited],
  );

  const apply = useCallback(
    (next: EditorModel) => {
      // One replacement is one edit: one input revision.
      setStored((s) =>
        s ? { ...s, model: next, activeId: "baseline", attempted: false, pendingLoad: null, loadError: null } : s,
      );
      onEdited();
    },
    [onEdited],
  );

  if (!session || !property || !model || !validation || !ready) return null;

  const active = model.scenarios.find((s) => s.id === session.activeId) ?? model.scenarios[0];
  const pending = session.pendingLoad;
  return {
    property,
    model,
    validation,
    ready,
    proposals,
    totalProblems: Object.keys(validation.fieldErrors).length + validation.formErrors.length,
    request: validation.request,
    active,
    setActiveId: (id) => patch({ activeId: id }),
    mode: session.mode,
    setMode: (mode) => patch({ mode }),
    edit,
    attempted: session.attempted,
    markAttempt: () => {
      const firstBad = model.scenarios.find((s) => problemCount(validation, s.id) > 0);
      patch({ attempted: true, ...(firstBad ? { activeId: firstBad.id } : {}) });
    },
    clearAttempt: () => patch({ attempted: false }),
    loadExample: () => {
      const plan = planIllustrativeLoad(property, model);
      if (plan.kind === "error") patch({ pendingLoad: null, loadError: plan.message });
      else if (plan.kind === "confirm") patch({ pendingLoad: plan.model, loadError: null });
      else apply(plan.model);
    },
    confirmLoad: () => {
      if (pending) apply(pending);
    },
    cancelLoad: () => patch({ pendingLoad: null }),
    pendingLoad: pending !== null,
    loadError: session.loadError,
  };
}
