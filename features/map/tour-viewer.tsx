"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const SLOW_MS = 20_000;

/**
 * Matterport Showcase in a plain iframe. Mounted only in 3D mode, so nothing
 * is fetched from Matterport until the user asks for it.
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
  const [phase, setPhase] = useState<"loading" | "loaded" | "slow">("loading");

  useEffect(() => {
    const t = setTimeout(() => setPhase((p) => (p === "loading" ? "slow" : p)), SLOW_MS);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="relative h-full w-full bg-slate-900" data-testid="tour-viewer" data-sid={sid}>
      <iframe
        title={title}
        src={url}
        loading="lazy"
        allow="fullscreen; xr-spatial-tracking"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
        sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
        onLoad={() => setPhase("loaded")}
        className="size-full border-0"
      />
      {phase === "loading" ? (
        <div
          role="status"
          className="absolute inset-0 flex items-center justify-center gap-2 bg-slate-900/80 text-sm text-white"
        >
          <Loader2 className="size-4 animate-spin" aria-hidden /> Loading 3D tour…
        </div>
      ) : null}
      {phase === "slow" ? (
        <div
          role="alert"
          data-testid="tour-error"
          className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-900/90 p-6 text-center text-sm text-white"
        >
          <p className="font-semibold">The 3D tour is taking too long or was blocked.</p>
          <p className="max-w-md text-slate-200">
            The embed may be restricted for this site, or the connection is slow.
            The 2D map and all property data are unaffected.
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <Button type="button" size="sm" variant="secondary" onClick={onRetry}>
              Try again
            </Button>
            <Button type="button" size="sm" variant="secondary" onClick={onBack}>
              Back to 2D map
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
