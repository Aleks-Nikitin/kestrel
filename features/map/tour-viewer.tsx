"use client";

import { useEffect, useRef, useState } from "react";
import { ExternalLink, Loader2, X } from "lucide-react";

/**
 * After this long without the iframe's load event we show a notice. It is only
 * a notice: Matterport keeps loading assets after the page itself is usable,
 * so a late load event does not mean the tour failed.
 */
const SLOW_MS = 12_000;

/**
 * Matterport Showcase in a plain iframe. Mounted only in 3D mode, so nothing
 * is fetched from Matterport until the user asks for it. Kestrel does not
 * inspect Matterport's own network requests: analytics or telemetry calls that
 * are aborted say nothing about whether the scene works.
 */
export function TourViewer({
  sid,
  url,
  title,
  onBack,
}: {
  sid: string;
  url: string;
  title: string;
  onBack: () => void;
}) {
  const [attempt, setAttempt] = useState(0);
  // Keyed, so a new SID or a retry starts again from "loading".
  return (
    <TourFrame
      key={`${sid}-${attempt}`}
      sid={sid}
      url={url}
      title={title}
      onBack={onBack}
      onRetry={() => setAttempt((n) => n + 1)}
    />
  );
}

function TourFrame({
  sid,
  url,
  title,
  onBack,
  onRetry,
}: {
  sid: string;
  url: string;
  title: string;
  onBack: () => void;
  onRetry: () => void;
}) {
  const [phase, setPhase] = useState<"loading" | "slow" | "ready">("loading");
  const [dismissed, setDismissed] = useState(false);
  const frame = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setPhase((p) => (p === "loading" ? "slow" : p)), SLOW_MS);
    return () => clearTimeout(t);
  }, []);

  // Clicking into the tour moves focus into the iframe, which proves the person
  // is already using it, whatever its load event has or hasn't done.
  useEffect(() => {
    const onBlur = () => {
      if (document.activeElement === frame.current) setPhase("ready");
    };
    window.addEventListener("blur", onBlur);
    return () => window.removeEventListener("blur", onBlur);
  }, []);

  return (
    <div className="relative h-full w-full bg-ink-950" data-testid="tour-viewer" data-sid={sid}>
      <iframe
        ref={frame}
        title={title}
        src={url}
        allow="fullscreen; xr-spatial-tracking"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
        sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
        onLoad={() => setPhase("ready")}
        className="size-full border-0"
      />
      {phase === "loading" ? (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <p
            role="status"
            className="flex items-center gap-2 rounded-md bg-ink-900/90 px-4 py-2 text-sm text-white"
          >
            <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden /> Loading 3D tour…
          </p>
        </div>
      ) : null}
      {phase === "slow" && !dismissed ? (
        <div
          role="status"
          data-testid="tour-slow"
          className="absolute inset-x-2 top-2 z-20 rounded-lg border border-white/20 bg-ink-900/95 p-3 text-sm text-white shadow-lg sm:inset-x-auto sm:left-3 sm:max-w-md"
        >
          <div className="flex items-start justify-between gap-2">
            <p className="font-medium">Still loading the 3D tour</p>
            <button
              type="button"
              onClick={() => setDismissed(true)}
              aria-label="Dismiss this notice"
              className="-m-1 grid size-8 cursor-pointer place-items-center rounded-md text-ink-200 hover:bg-white/10 focus-visible:outline-buff-200"
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>
          <p className="mt-1 text-ink-200">
            Matterport can take a while, and the tour may already be usable. This notice clears itself once it
            loads. The 2D map and all property data are unaffected.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md bg-white px-3 text-sm font-medium text-ink-900 hover:bg-ink-100 focus-visible:outline-buff-200" onClick={onRetry}>
              Try again
            </button>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md bg-white px-3 text-sm font-medium text-ink-900 hover:bg-ink-100 focus-visible:outline-buff-200"
            >
              <ExternalLink className="size-4" aria-hidden /> Open tour in new tab
            </a>
            <button type="button" className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md bg-white px-3 text-sm font-medium text-ink-900 hover:bg-ink-100 focus-visible:outline-buff-200" onClick={onBack}>
              Back to 2D map
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
