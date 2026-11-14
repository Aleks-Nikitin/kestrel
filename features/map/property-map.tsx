"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Map as MapLibreMap, Marker } from "maplibre-gl";
import {
  PLAIN_STYLE,
  boundsOfPoints,
  footprintBounds,
  mappableProperties,
  resolveStyleUrl,
  type Footprint,
} from "./geo";
import type { PropertySummaryDTO } from "@/features/dashboard/state";

type Engine = "loading" | "ready" | "unsupported";

function webglAvailable() {
  try {
    const canvas = document.createElement("canvas");
    return !!(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

const PIN =
  "flex size-7 items-center justify-center rounded-full border-2 border-white bg-slate-700 text-[11px] font-bold text-white shadow-md outline-none focus-visible:ring-4 focus-visible:ring-sky-500/60";
const PIN_SELECTED =
  "flex size-9 items-center justify-center rounded-full border-2 border-white bg-sky-700 text-[11px] font-bold text-white shadow-lg ring-4 ring-sky-500/50 outline-none focus-visible:ring-sky-500";

/**
 * Client-only MapLibre map. Markers are real buttons, so clicking and keyboard
 * activation call the same onSelect as the property list. If WebGL or the style
 * fails, the list and property panel keep working and the failure is stated.
 */
export function PropertyMap({
  properties,
  selectedId,
  onSelect,
  footprint,
  styleUrl = process.env.NEXT_PUBLIC_MAP_STYLE_URL,
}: {
  properties: PropertySummaryDTO[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** Matched, verified footprint of the selected property only; otherwise null. */
  footprint: Footprint | null;
  styleUrl?: string;
}) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const mlRef = useRef<typeof import("maplibre-gl") | null>(null);
  const onSelectRef = useRef(onSelect);
  const [engine, setEngine] = useState<Engine>("loading");
  const [styleLoaded, setStyleLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);

  const resolved = useMemo(() => resolveStyleUrl(styleUrl), [styleUrl]);
  const { points, unmappable } = useMemo(
    () => mappableProperties(properties),
    [properties],
  );

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  // Create the map once per style; always remove it on unmount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ml = await import("maplibre-gl");
      if (cancelled || !container.current) return;
      if (!webglAvailable()) {
        setEngine("unsupported");
        return;
      }
      try {
        // MapLibre 6 ships its worker as a separate file that bundlers cannot
        // discover on their own ("Worker failed to load"). Point it at the
        // installed version, emitted by the bundler as a same-origin asset.
        ml.setWorkerUrl(
          new URL("maplibre-gl/dist/maplibre-gl-worker.mjs", import.meta.url).toString(),
        );
        const map = new ml.Map({
          container: container.current,
          style: resolved ?? PLAIN_STYLE,
          center: [-95.36, 29.76],
          zoom: 3,
          attributionControl: { compact: true },
        });
        map.addControl(new ml.NavigationControl({ showCompass: false }), "top-right");
        map.on("load", () => setStyleLoaded(true));
        map.on("error", (e) =>
          setMapError(e.error?.message ?? "The map reported an error."),
        );
        mlRef.current = ml;
        mapRef.current = map;
        setEngine("ready");
      } catch {
        setEngine("unsupported");
      }
    })();
    return () => {
      cancelled = true;
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      mapRef.current?.remove();
      mapRef.current = null;
      mlRef.current = null;
    };
  }, [resolved]);

  // Property markers (DOM buttons) and camera.
  useEffect(() => {
    const map = mapRef.current;
    const ml = mlRef.current;
    if (engine !== "ready" || !map || !ml) return;
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = points.map((p) => {
      const selected = p.id === selectedId;
      const el = document.createElement("button");
      el.type = "button";
      el.className = selected ? PIN_SELECTED : PIN;
      el.textContent = "●";
      el.setAttribute("aria-label", `Select ${p.label}`);
      el.setAttribute("aria-pressed", String(selected));
      el.dataset.propertyId = p.id;
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        onSelectRef.current(p.id);
      });
      return new ml.Marker({ element: el }).setLngLat(p.lngLat).addTo(map);
    });
    const selectedPoint = points.find((p) => p.id === selectedId);
    const fpBounds = selectedPoint && footprint ? footprintBounds(footprint) : null;
    if (fpBounds) map.fitBounds(fpBounds, { padding: 60, maxZoom: 19, duration: 0 });
    else if (selectedPoint)
      map.jumpTo({ center: selectedPoint.lngLat, zoom: Math.max(map.getZoom(), 15) });
    else {
      const b = boundsOfPoints(points.map((p) => p.lngLat));
      if (b && points.length > 1) map.fitBounds(b, { padding: 60, maxZoom: 15, duration: 0 });
      else if (points.length === 1) map.jumpTo({ center: points[0].lngLat, zoom: 14 });
    }
  }, [engine, points, selectedId, footprint]);

  // Matched footprint overlay (needs a loaded style).
  useEffect(() => {
    const map = mapRef.current;
    if (engine !== "ready" || !map || !styleLoaded) return;
    const data = {
      type: "FeatureCollection" as const,
      features: footprint
        ? [{ type: "Feature" as const, properties: {}, geometry: footprint }]
        : [],
    };
    const src = map.getSource("footprint");
    if (src && "setData" in src) {
      (src as unknown as { setData: (d: typeof data) => void }).setData(data);
      return;
    }
    map.addSource("footprint", { type: "geojson", data });
    map.addLayer({
      id: "footprint-fill",
      type: "fill",
      source: "footprint",
      paint: { "fill-color": "#0369a1", "fill-opacity": 0.25 },
    });
    map.addLayer({
      id: "footprint-line",
      type: "line",
      source: "footprint",
      paint: { "line-color": "#0369a1", "line-width": 2 },
    });
  }, [engine, styleLoaded, footprint]);

  return (
    <section aria-labelledby="map-heading" className="min-w-0">
      <h2 id="map-heading" className="sr-only">
        Property map
      </h2>
      {engine === "unsupported" ? (
        <div
          role="alert"
          data-testid="map-unavailable"
          className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950"
        >
          <p className="font-semibold">The map can&apos;t be shown in this browser.</p>
          <p className="mt-1">
            WebGL is unavailable or the map failed to start. Everything else
            still works: choose a property from the list.
          </p>
        </div>
      ) : (
        <div
          role="region"
          aria-label="Map of properties. The property list offers the same selection."
          data-testid="property-map"
          className="relative h-72 overflow-hidden rounded-lg border border-slate-200 bg-slate-200 sm:h-96"
        >
          {/* MapLibre's unlayered CSS sets .maplibregl-map to position:relative,
              which beats Tailwind's layered `absolute inset-0` and collapses the
              container to zero height (its overflow:hidden then clips the
              canvas and markers, so clicks hit this region instead). Give the
              map element an explicitly sized, absolutely positioned parent. */}
          <div className="absolute inset-0">
            <div ref={container} className="size-full" />
          </div>
          {engine === "loading" ? (
            <p
              role="status"
              className="absolute inset-0 grid place-items-center text-sm text-slate-700"
            >
              Loading map…
            </p>
          ) : null}
        </div>
      )}
      <div className="mt-2 space-y-1 text-xs text-slate-700">
        {engine !== "unsupported" && !resolved ? (
          <p data-testid="no-basemap">
            No approved basemap is configured, so locations are shown on a plain
            background without streets or imagery.
          </p>
        ) : null}
        {mapError ? (
          <p role="status" data-testid="map-error" className="text-amber-900">
            Map notice: {mapError}
          </p>
        ) : null}
        {unmappable > 0 ? (
          <p>
            {unmappable} {unmappable === 1 ? "property has" : "properties have"} no
            known coordinates and {unmappable === 1 ? "is" : "are"} not on the
            map. {unmappable === 1 ? "It is" : "They are"} still in the list.
          </p>
        ) : null}
        {footprint ? (
          <p>Shaded area: footprint matched to the selected property.</p>
        ) : selectedId ? (
          <p>No matched footprint is available for the selected property.</p>
        ) : null}
      </div>
    </section>
  );
}
