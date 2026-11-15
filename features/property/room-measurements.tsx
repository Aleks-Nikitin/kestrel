import type { SpatialContextDTO } from "@/lib/contracts";
import { summarizeRooms, type RoomRow } from "./rooms";

type Model = NonNullable<SpatialContextDTO["model"]>;

const WRAP = "min-w-0 [overflow-wrap:anywhere]";

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
      <dd className="text-lg font-semibold tabular-nums text-slate-900">{value}</dd>
      <dt className="text-xs text-slate-600">{label}</dt>
    </div>
  );
}

function Bar({ label, text, pct, tone }: { label: string; text: string; pct: number | null; tone: string }) {
  return (
    <div className="grid grid-cols-[3rem_minmax(0,1fr)_4.25rem] items-center gap-2 text-xs sm:grid-cols-[3.25rem_minmax(0,1fr)_4.5rem]">
      <span className="text-slate-600">{label}</span>
      <span className="h-2 overflow-hidden rounded-full bg-slate-100" aria-hidden>
        {pct === null ? null : <span className={"block h-full rounded-full " + tone} style={{ width: `${pct}%` }} />}
      </span>
      <span className="text-right text-sm font-medium tabular-nums text-slate-900">{text} m</span>
    </div>
  );
}

function RoomRowItem({ room, rank }: { room: RoomRow; rank: number }) {
  return (
    <li data-room={room.id} className="space-y-1.5 border-t border-slate-200 py-3 first:border-t-0 first:pt-0">
      <div className="flex min-w-0 items-baseline gap-2">
        <span className="w-5 shrink-0 text-xs tabular-nums text-slate-500" aria-hidden>
          {rank}
        </span>
        <span className="min-w-0 truncate text-sm font-semibold text-slate-900" title={room.id}>
          {room.label}
        </span>
        {room.named ? null : <span className="sr-only">, source id {room.id}</span>}
      </div>
      <div className="space-y-1 pl-7">
        <Bar label="Width" text={room.widthText} pct={room.widthPct} tone="bg-sky-700" />
        <Bar label="Depth" text={room.depthText} pct={room.depthPct} tone="bg-slate-600" />
      </div>
    </li>
  );
}

/**
 * Matterport room measurements as ranked comparison rows. Width and depth are
 * the model's own estimates; bars share one metre scale. This is a size
 * comparison only: it does not show positions, adjacency, shape, floor areas or
 * building coverage because none of those are established by the data.
 */
export function RoomMeasurements({ model }: { model: Model }) {
  const s = summarizeRooms(model.rooms);
  const unit = model.dimensionsUnit;
  if (s.total === 0)
    return (
      <p className="mt-2 text-sm text-slate-700" data-testid="room-measurements">
        The model supplied no room measurements.
      </p>
    );
  return (
    <div className="mt-3 space-y-4" data-testid="room-measurements">
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat value={String(s.total)} label="Rooms in model" />
        <Stat value={String(s.ranked.length)} label="With width and depth" />
        <Stat value={s.widthRange ? `${s.widthRange.min}–${s.widthRange.max} ${unit}` : "—"} label="Width range" />
        <Stat value={s.depthRange ? `${s.depthRange.min}–${s.depthRange.max} ${unit}` : "—"} label="Depth range" />
      </dl>

      {s.ranked.length ? (
        <section aria-labelledby="rooms-compare-heading">
          <h4 id="rooms-compare-heading" className="text-sm font-semibold text-slate-900">
            {s.hidden.length ? `Largest ${s.visible.length} of ${s.ranked.length} dimensioned rooms` : `${s.ranked.length} dimensioned ${s.ranked.length === 1 ? "room" : "rooms"}`}
          </h4>
          <p className="mt-0.5 text-xs text-slate-600">
            Ordered by estimated width and depth, largest first. Bars share one scale in metres.
          </p>
          <ol className="mt-3" aria-label="Rooms ranked by estimated size">
            {s.visible.map((r, i) => (
              <RoomRowItem key={r.id} room={r} rank={i + 1} />
            ))}
          </ol>
          {s.hidden.length ? (
            <details className="mt-2 rounded-lg border border-slate-200">
              <summary className="cursor-pointer select-none rounded-lg px-3 py-2 text-sm font-medium text-sky-800 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600">
                Show {s.hidden.length} more {s.hidden.length === 1 ? "room" : "rooms"}
              </summary>
              <ol className="border-t border-slate-200 px-3 pt-3">
                {s.hidden.map((r, i) => (
                  <RoomRowItem key={r.id} room={r} rank={s.visible.length + i + 1} />
                ))}
              </ol>
            </details>
          ) : null}
        </section>
      ) : (
        <p className="text-sm text-slate-700">
          No room has both a width and a depth, so no comparison can be shown.
        </p>
      )}

      {s.undimensioned.length ? (
        <p className="text-sm text-slate-700" data-testid="rooms-unknown">
          {s.undimensioned.length} {s.undimensioned.length === 1 ? "room has" : "rooms have"} no usable width or
          depth and {s.undimensioned.length === 1 ? "is" : "are"} not compared. Unknown values are shown as “—”,
          not zero.
        </p>
      ) : null}

      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950">
        <p className="font-semibold">What these measurements do and don&apos;t show</p>
        <ul className="mt-1 list-disc space-y-0.5 pl-4">
          <li>
            Width and depth are the model&apos;s own estimates in metres ({unit}), rounded to 0.1 for display; source
            values are unchanged.
          </li>
          <li>
            They do not establish room shape, position, adjacency, floor-plan layout, floor area or whether the model
            covers the whole building.
          </li>
          <li>Unit conversion: {model.conversionNote}</li>
        </ul>
      </div>

      <details className="rounded-lg border border-slate-200">
        <summary className="cursor-pointer select-none rounded-lg px-3 py-2 text-sm font-medium text-sky-800 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600">
          Source room IDs and values as supplied
        </summary>
        <div
          role="region"
          aria-label="Room source values"
          tabIndex={0}
          className="overflow-x-auto border-t border-slate-200 focus-visible:outline-2 focus-visible:outline-sky-600"
        >
          <table className="w-full min-w-[34rem] text-left text-xs">
            <caption className="sr-only">Room source IDs and unrounded values from the model</caption>
            <thead className="bg-slate-50 text-slate-700">
              <tr>
                <th scope="col" className="px-3 py-2 font-medium">Room</th>
                <th scope="col" className="px-3 py-2 font-medium">Source ID</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Width ({unit})</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Depth ({unit})</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Height ({unit})</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Model floor area ({model.areaUnit === "m2" ? "m²" : model.areaUnit})</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {s.all.map((r) => (
                <tr key={r.id} className="border-t border-slate-200 align-top">
                  <th scope="row" className="whitespace-nowrap px-3 py-2 font-medium text-slate-900">{r.label}</th>
                  <td className={`max-w-[14rem] px-3 py-2 font-mono text-slate-700 ${WRAP}`}>{r.id}</td>
                  <td className="px-3 py-2 text-right">{r.raw.width ?? "unknown"}</td>
                  <td className="px-3 py-2 text-right">{r.raw.depth ?? "unknown"}</td>
                  <td className="px-3 py-2 text-right">{r.raw.height ?? "unknown"}</td>
                  <td className="px-3 py-2 text-right">{r.raw.floorArea ?? "unknown"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
