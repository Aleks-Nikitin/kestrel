"use client";

import { useId, useRef, useState, useSyncExternalStore, type ComponentProps } from "react";
import { Box, ExternalLink, Map as MapIcon, Maximize2, Minimize2 } from "lucide-react";
import { PropertyMap } from "./property-map";
import { TourViewer } from "./tour-viewer";
import type { TourState } from "./tour";

type Mode = "2d" | "3d";

const ON_DARK =
  "inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-md border border-white/25 bg-ink-900/80 px-3 text-sm font-medium text-white backdrop-blur-sm transition-colors hover:bg-ink-800 focus-visible:outline-buff-200";

/** Content of the 3D pane for every tour state; each non-available state offers a way back. */
export function TourPanel({
  tour,
  title,
  onBack,
}: {
  tour: TourState;
  title: string;
  onBack: () => void;
}) {
  if (tour.status === "available")
    return <TourViewer sid={tour.sid} url={tour.url} title={title} onBack={onBack} />;
  return (
    <div
      role={tour.status === "checking" ? "status" : undefined}
      data-testid={tour.status === "checking" ? "tour-checking" : "tour-unavailable"}
      className="survey-grid flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-sm text-ink-200"
    >
      {tour.status === "checking" ? (
        <p>Checking for a verified 3D tour…</p>
      ) : (
        <>
          <p className="type-display text-3xl text-buff-100">No 3D tour for this property</p>
          <p className="max-w-md">{tour.reason}</p>
        </>
      )}
      <button type="button" className={ON_DARK} onClick={onBack}>
        Back to 2D map
      </button>
    </div>
  );
}

const noSubscribe = () => () => undefined;
const fullscreenEnabled = () => document.fullscreenEnabled === true;
const fullscreenActive = () => document.fullscreenElement !== null;
function onFullscreenChange(cb: () => void) {
  document.addEventListener("fullscreenchange", cb);
  return () => document.removeEventListener("fullscreenchange", cb);
}

const ACTION =
  "inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-md border border-white/25 px-3 text-sm font-medium text-white transition-colors hover:bg-white/10 focus-visible:outline-buff-200";

/**
 * 2D map | 3D tour. The map stays mounted (invisible, inert and out of flow)
 * while the tour is shown, and a tour that has been opened stays mounted while
 * the map is shown, so the camera, markers and the visitor's place in the tour
 * all survive switching. Nothing is requested from Matterport until the tour
 * is first shown. The selection itself lives in the dashboard.
 *
 * `compact` is the overview's framing: the map only. `prefer3d` is the building
 * stage's: open on the tour when one is verified, unless the person chose 2D.
 */
export function Explorer({
  tour,
  tourTitle,
  compact = false,
  prefer3d = false,
  ...mapProps
}: ComponentProps<typeof PropertyMap> & {
  tour: TourState;
  tourTitle: string;
  compact?: boolean;
  prefer3d?: boolean;
}) {
  // An explicit choice made in the switch; a different property starts fresh. Reset during render, not by
  // re-keying, so the map itself (camera, markers, focus) is never remounted when a marker changes the selection.
  const [choice, setChoice] = useState<Mode | null>(null);
  const [shownFor, setShownFor] = useState(mapProps.selectedId);
  const [tourOpenedFor, setTourOpenedFor] = useState<string | null>(null);
  if (shownFor !== mapProps.selectedId) {
    setShownFor(mapProps.selectedId);
    setChoice(null);
  }
  const canShow3d = tour.status === "available";
  const mode: Mode = compact ? "2d" : (choice ?? (prefer3d && canShow3d ? "3d" : "2d"));
  if (mode === "3d" && tourOpenedFor !== mapProps.selectedId) setTourOpenedFor(mapProps.selectedId);
  const tourMounted = mode === "3d" || (tourOpenedFor !== null && tourOpenedFor === mapProps.selectedId && canShow3d);

  const name = useId();
  const hintId = useId();
  const frame = useRef<HTMLElement>(null);
  const canFullscreen = useSyncExternalStore(noSubscribe, fullscreenEnabled, () => false);
  const isFullscreen = useSyncExternalStore(onFullscreenChange, fullscreenActive, () => false);
  const disable3d = !canShow3d && mode === "2d";
  const hint =
    tour.status === "unavailable"
      ? `3D tour unavailable: ${tour.reason}`
      : tour.status === "checking"
        ? "Checking for a verified 3D tour…"
        : null;

  const toggleFullscreen = () => {
    const el = frame.current;
    if (!el) return;
    // Failure (blocked by the browser) leaves the embed as it was.
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    else void el.requestFullscreen().catch(() => undefined);
  };

  const option = (value: Mode, label: string, icon: React.ReactNode, disabled = false) => (
    <label
      className={
        "relative inline-flex min-h-9 select-none items-center gap-1.5 rounded-[5px] px-3 text-sm font-medium transition-colors has-[:checked]:bg-buff-100 has-[:checked]:text-ink-950 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-buff-200 " +
        (disabled ? "cursor-not-allowed text-ink-500" : "cursor-pointer text-ink-200 hover:text-white")
      }
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={mode === value}
        disabled={disabled}
        onChange={() => setChoice(value)}
        aria-describedby={value === "3d" && hint ? hintId : undefined}
        className="sr-only"
      />
      <span aria-hidden className="grid place-items-center">{icon}</span>
      {label}
    </label>
  );

  return (
    <div className={compact ? "min-w-0 space-y-3" : "survey-grid min-w-0 space-y-3 rounded-2xl bg-ink-900 p-3 sm:p-4"}>
      {compact ? null : (
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <fieldset className="m-0 border-0 p-0">
            <legend className="sr-only">Property view</legend>
            <div className="inline-flex gap-0.5 rounded-lg border border-white/15 bg-ink-950/60 p-0.5">
              {option("2d", "2D Map", <MapIcon className="size-4" />)}
              {option("3d", "3D Tour", <Box className="size-4" />, disable3d)}
            </div>
          </fieldset>
          {mode === "3d" && tour.status === "available" ? (
            <div className="flex flex-wrap items-center gap-2" data-testid="tour-actions">
              {canFullscreen && !isFullscreen ? (
                <button type="button" onClick={toggleFullscreen} className={ACTION}>
                  <Maximize2 className="size-4" aria-hidden />
                  Full screen
                </button>
              ) : null}
              <a href={tour.url} target="_blank" rel="noopener noreferrer" className={ACTION}>
                <ExternalLink className="size-4" aria-hidden />
                Open tour in new tab
                <span className="sr-only"> (opens Matterport)</span>
              </a>
            </div>
          ) : hint ? (
            <p id={hintId} className="max-w-xl text-[13px] text-ink-200" data-testid="tour-hint">
              {hint}
            </p>
          ) : null}
        </div>
      )}

      <div className="relative">
        <div
          className={mode === "3d" ? "pointer-events-none invisible absolute inset-x-0 top-0" : "relative"}
          aria-hidden={mode === "3d" || undefined}
          inert={mode === "3d"}
        >
          <PropertyMap
            {...mapProps}
            onDark={!compact}
            frameClassName={compact ? "h-72 sm:h-96 lg:h-[30rem]" : "h-80 sm:h-[30rem] lg:h-[clamp(30rem,68vh,48rem)]"}
          />
          {compact && canShow3d ? (
            <a href="#building" className={"absolute left-3 top-3 z-10 " + ON_DARK} data-testid="open-tour">
              <Box className="size-4" aria-hidden /> Walk the 3D tour
            </a>
          ) : null}
        </div>
        {tourMounted ? (
          <section
            ref={frame}
            hidden={mode !== "3d"}
            aria-label="3D tour"
            data-testid="tour-panel"
            data-tour-frame
            className="relative z-10 h-[min(72vh,36rem)] min-h-96 w-full overflow-hidden rounded-xl bg-ink-950 sm:h-[min(78vh,48rem)] lg:h-[clamp(34rem,78vh,60rem)]"
          >
            {isFullscreen ? (
              <button type="button" onClick={toggleFullscreen} className={"absolute left-3 top-3 z-30 " + ON_DARK}>
                <Minimize2 className="size-4" aria-hidden /> Exit full screen
              </button>
            ) : null}
            <div className="absolute inset-0">
              <TourPanel tour={tour} title={tourTitle} onBack={() => setChoice("2d")} />
            </div>
          </section>
        ) : null}
      </div>
      {mode === "3d" && tour.status === "available" ? (
        <p className="text-xs text-ink-300" data-testid="tour-note">
          Move through the tour with Matterport&apos;s own controls. Use Dollhouse (top-right of the viewer) for a view of the whole space.
        </p>
      ) : null}
    </div>
  );
}
