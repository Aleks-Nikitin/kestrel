"use client";

import { useId, useRef, useState, useSyncExternalStore, type ComponentProps } from "react";
import { Box, ExternalLink, Map as MapIcon, Maximize2, Minimize2 } from "lucide-react";
import { PropertyMap } from "./property-map";
import { TourViewer } from "./tour-viewer";
import type { TourState } from "./tour";
import { Button } from "@/components/ui/button";

type Mode = "2d" | "3d";

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
      className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-sm text-slate-800"
    >
      {tour.status === "checking" ? (
        <p>Checking for a verified 3D tour…</p>
      ) : (
        <>
          <p className="font-semibold">No 3D tour for this property</p>
          <p className="max-w-md">{tour.reason}</p>
        </>
      )}
      <Button type="button" size="sm" variant="outline" onClick={onBack}>
        Back to 2D map
      </Button>
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
  "inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-800 transition-colors hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600";

/**
 * 2D Map | 3D Tour switch. The map stays mounted (invisible, inert and out of
 * flow) while the tour is shown, so camera, markers and selection survive
 * switching and the tour's own aspect ratio decides the height. The selection
 * itself lives in the dashboard and is never touched here.
 */
export function Explorer({
  tour,
  tourTitle,
  ...mapProps
}: ComponentProps<typeof PropertyMap> & { tour: TourState; tourTitle: string }) {
  const [mode, setMode] = useState<Mode>("2d");
  const name = useId();
  const hintId = useId();
  const frame = useRef<HTMLElement>(null);
  const canFullscreen = useSyncExternalStore(noSubscribe, fullscreenEnabled, () => false);
  const isFullscreen = useSyncExternalStore(onFullscreenChange, fullscreenActive, () => false);
  const canShow3d = tour.status === "available";
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
        "relative inline-flex min-h-9 select-none items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors has-[:checked]:bg-white has-[:checked]:text-slate-900 has-[:checked]:shadow-sm has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-sky-600 " +
        (disabled ? "cursor-not-allowed text-slate-500" : "cursor-pointer text-slate-700 hover:text-slate-900")
      }
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={mode === value}
        disabled={disabled}
        onChange={() => setMode(value)}
        aria-describedby={value === "3d" && hint ? hintId : undefined}
        className="sr-only"
      />
      <span aria-hidden className="grid place-items-center">{icon}</span>
      {label}
    </label>
  );

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <fieldset className="m-0 border-0 p-0">
          <legend className="sr-only">Property view</legend>
          <div className="inline-flex gap-1 rounded-lg bg-slate-200 p-1">
            {option("2d", "2D Map", <MapIcon className="size-4" />)}
            {option("3d", "3D Tour", <Box className="size-4" />, disable3d)}
          </div>
        </fieldset>
        {mode === "3d" && tour.status === "available" ? (
          <div className="flex flex-wrap items-center gap-2" data-testid="tour-actions">
            {canFullscreen ? (
              <button type="button" onClick={toggleFullscreen} className={ACTION}>
                {isFullscreen ? <Minimize2 className="size-4" aria-hidden /> : <Maximize2 className="size-4" aria-hidden />}
                {isFullscreen ? "Exit full screen" : "Full screen"}
              </button>
            ) : null}
            <a href={tour.url} target="_blank" rel="noopener noreferrer" className={ACTION}>
              <ExternalLink className="size-4" aria-hidden />
              Open tour in new tab
              <span className="sr-only"> (opens Matterport)</span>
            </a>
          </div>
        ) : hint ? (
          <p id={hintId} className="text-xs text-slate-700" data-testid="tour-hint">
            {hint}
          </p>
        ) : null}
      </div>

      <div className={"relative " + (mode === "3d" ? "overflow-hidden rounded-xl" : "")}>
        <div
          className={mode === "3d" ? "pointer-events-none invisible absolute inset-x-0 top-0" : undefined}
          aria-hidden={mode === "3d" || undefined}
          inert={mode === "3d"}
        >
          <PropertyMap {...mapProps} />
        </div>
        {mode === "3d" ? (
          <section
            ref={frame}
            aria-label="3D tour"
            data-testid="tour-panel"
            data-tour-frame
            className="relative z-10 aspect-[4/3] max-h-[44rem] min-h-80 w-full overflow-hidden rounded-xl border border-slate-300 bg-slate-900 shadow-sm sm:aspect-[16/10] lg:max-h-[min(72vh,46rem)]"
          >
            <div className="absolute inset-0">
              <TourPanel tour={tour} title={tourTitle} onBack={() => setMode("2d")} />
            </div>
          </section>
        ) : null}
      </div>
      {mode === "3d" && tour.status === "available" ? (
        <p className="text-xs text-slate-600" data-testid="tour-note">
          Move through the tour with Matterport&apos;s own controls. The starting view is set by Matterport and
          can&apos;t be changed from Kestrel.
        </p>
      ) : null}
    </div>
  );
}
