"use client";

import { setWorkerUrl } from "maplibre-gl";

// MapLibre 6 ships its worker separately. Let the bundler emit the installed
// version as a same-origin asset rather than resolving a worker URL at runtime.
setWorkerUrl(
  new URL("maplibre-gl/dist/maplibre-gl-worker.mjs", import.meta.url).toString(),
);

export function MapRuntime() {
  return null;
}
