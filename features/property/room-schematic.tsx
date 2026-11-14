import type { SpatialContextDTO } from "@/lib/contracts";
import { layoutRooms } from "./rooms";

type Model = NonNullable<SpatialContextDTO["model"]>;

/**
 * Relative room sizes from the model's own width and depth, drawn at one scale.
 * It is a size comparison, not a floor plan: positions and walls are not known.
 */
export function RoomSchematic({ rooms }: { rooms: Model["rooms"] }) {
  const layout = layoutRooms(rooms);
  if (layout.rects.length === 0)
    return (
      <p className="mt-2 text-sm text-slate-700">
        No room has both width and depth, so no schematic can be drawn.
      </p>
    );
  const labelRoom = 18;
  const barY = layout.viewHeight + labelRoom + 12;
  return (
    <figure className="mt-3">
      <svg
        role="img"
        aria-labelledby="rooms-title rooms-desc"
        viewBox={`-2 -2 ${layout.viewWidth + 4} ${barY + 24}`}
        className="h-auto w-full max-w-2xl rounded-md border border-slate-200 bg-slate-50"
      >
        <title id="rooms-title">Schematic of model rooms at a common scale</title>
        <desc id="rooms-desc">
          {layout.rects
            .map((r) => `${r.id}: ${r.width} by ${r.depth} metres`)
            .join("; ")}
        </desc>
        <g>
          {layout.rects.map((r) => (
            <g key={r.id} data-room={r.id}>
              <rect
                x={r.x}
                y={r.y}
                width={r.w}
                height={r.h}
                rx={3}
                className="fill-sky-100 stroke-sky-700"
                strokeWidth={1.5}
              />
              <text
                x={r.x + 6}
                y={r.y + 16}
                className="fill-slate-900 text-[11px] font-medium"
              >
                {r.id}
              </text>
              <text
                x={r.x + 6}
                y={r.y + r.h + 14}
                className="fill-slate-700 text-[10px]"
              >
                {r.width} × {r.depth} m
              </text>
            </g>
          ))}
        </g>
        <g transform={`translate(0 ${barY})`}>
          <line x1={0} x2={layout.scaleBarPx} y1={0} y2={0} className="stroke-slate-800" strokeWidth={2} />
          <line x1={0} x2={0} y1={-4} y2={4} className="stroke-slate-800" strokeWidth={2} />
          <line x1={layout.scaleBarPx} x2={layout.scaleBarPx} y1={-4} y2={4} className="stroke-slate-800" strokeWidth={2} />
          <text x={layout.scaleBarPx + 8} y={4} className="fill-slate-800 text-[10px]">
            {layout.scaleBarMetres} m
          </text>
        </g>
      </svg>
      <figcaption className="mt-1 text-xs text-slate-600">
        Relative room sizes from model width × depth (metres), one shared
        scale. Not a floor plan: room positions are not known.
        {layout.unknown.length
          ? ` Not drawn (width or depth unknown): ${layout.unknown.join(", ")}.`
          : ""}
      </figcaption>
    </figure>
  );
}
