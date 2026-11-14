"use client";

import { useId, useState, type ComponentProps } from "react";
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

/**
 * 2D Map | 3D Tour switch. The map stays mounted (hidden and inert) while the
 * tour is shown, so camera, markers and selection survive switching. The
 * selection itself lives in the dashboard and is never touched here.
 */
export function Explorer({
  tour,
  tourTitle,
  ...mapProps
}: ComponentProps<typeof PropertyMap> & { tour: TourState; tourTitle: string }) {
  const [mode, setMode] = useState<Mode>("2d");
  const name = useId();
  const hintId = useId();
  const canShow3d = tour.status === "available";
  const disable3d = !canShow3d && mode === "2d";
  const hint =
    tour.status === "unavailable"
      ? `3D tour unavailable: ${tour.reason}`
      : tour.status === "checking"
        ? "Checking for a verified 3D tour…"
        : null;

  const option = (value: Mode, label: string, disabled = false) => (
    <label
      className={
        "relative cursor-pointer select-none rounded-md px-3 py-1.5 text-sm font-medium has-[:checked]:bg-white has-[:checked]:text-slate-900 has-[:checked]:shadow-sm has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-sky-600 " +
        (disabled ? "cursor-not-allowed text-slate-500" : "text-slate-700 hover:text-slate-900")
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
      {label}
    </label>
  );

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <fieldset className="m-0 border-0 p-0">
          <legend className="sr-only">Property view</legend>
          <div className="inline-flex gap-1 rounded-lg bg-slate-200 p-1">
            {option("2d", "2D Map")}
            {option("3d", "3D Tour", disable3d)}
          </div>
        </fieldset>
        {hint ? (
          <p id={hintId} className="text-xs text-slate-700" data-testid="tour-hint">
            {hint}
          </p>
        ) : null}
      </div>

      <div className={"relative " + (mode === "3d" ? "min-h-72 sm:min-h-96" : "")}>
        <div
          className={mode === "3d" ? "invisible" : undefined}
          aria-hidden={mode === "3d" || undefined}
          inert={mode === "3d"}
        >
          <PropertyMap {...mapProps} />
        </div>
        {mode === "3d" ? (
          <section
            aria-label="3D tour"
            data-testid="tour-panel"
            className="absolute inset-0 z-10 overflow-hidden rounded-lg border border-slate-200 bg-white"
          >
            <TourPanel tour={tour} title={tourTitle} onBack={() => setMode("2d")} />
          </section>
        ) : null}
      </div>
    </div>
  );
}
