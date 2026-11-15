import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";

/**
 * The workspace is a sequence of stages, one on screen at a time:
 * choose a property → explore the building → configure scenarios → compare →
 * investigate. Every stage stays mounted, so drafts, the map camera and a
 * loaded tour survive navigation and switching never calls the network.
 */
export const STAGES = [
  { id: "overview", label: "Overview", does: "Choose a property and read its record" },
  { id: "building", label: "Building", does: "Walk the 3D tour and spatial evidence" },
  { id: "underwriting", label: "Underwriting", does: "Set up the baseline and alternatives" },
  { id: "comparison", label: "Comparison", does: "Read the deterministic pro forma" },
  { id: "investigation", label: "Investigation", does: "Run the evidence-bound analyst" },
] as const;

export type StageId = (typeof STAGES)[number]["id"];

export function parseStage(hash: string): StageId | null {
  const id = hash.replace(/^#/, "");
  return STAGES.some((s) => s.id === id) ? (id as StageId) : null;
}

function subscribe(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}
const readHash = () => window.location.hash;
const serverHash = () => "";

/** Stage navigation lives in the URL hash: plain links work, and so does Back. */
export function goToStage(id: StageId) {
  if (window.location.hash !== `#${id}`) window.location.hash = id;
}

/**
 * The current stage. Stages past the overview need a loaded property; until
 * then the overview is shown whatever the hash says. Focus moves to the new
 * stage's heading after a change so keyboard and screen-reader users land on it.
 */
export function useStage(canLeaveOverview: boolean): { stage: StageId; go: (id: StageId) => void } {
  const hash = useSyncExternalStore(subscribe, readHash, serverHash);
  const requested = parseStage(hash) ?? "overview";
  const stage: StageId = canLeaveOverview ? requested : "overview";
  const previous = useRef<StageId | null>(null);

  useEffect(() => {
    const from = previous.current;
    previous.current = stage;
    if (from === null || from === stage) return;
    window.scrollTo({ top: 0, behavior: "auto" });
    const target =
      stage === "overview" ? document.getElementById("overview") : document.getElementById(`${stage}-heading`);
    target?.focus({ preventScroll: true });
  }, [stage]);

  const go = useCallback((id: StageId) => goToStage(id), []);
  return { stage, go };
}
