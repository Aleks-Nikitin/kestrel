import type { SpatialContextDTO } from "@/lib/contracts";
import { summarizeRooms, type RoomRow } from "./rooms";

type Model = NonNullable<SpatialContextDTO["model"]>;

const WRAP = "min-w-0 [overflow-wrap:anywhere]";

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="min-w-0 border-l border-ink-200 pl-4 first:border-l-0 first:pl-0">
      <dd className="figure text-xl font-semibold tracking-tight text-ink-950">{value}</dd>
      <dt className="type-label mt-0.5">{label}</dt>
    </div>
  );
}

/** One measured length drawn as a dimension line: end ticks and a rule, on the shared metre scale. */
function Dimension({ label, text, pct }: { label: string; text: string; pct: number | null }) {
  return (
    <div className="grid grid-cols-[3rem_minmax(0,1fr)_4.25rem] items-center gap-3 text-xs">
      <span className="text-ink-500">{label}</span>
      <span className="dimension text-ink-800" aria-hidden>
        {pct === null ? null : <span style={{ width: `${pct}%` }} />}
      </span>
      <span className="figure text-right text-sm font-semibold text-ink-950">{text} m</span>
    </div>
  );
}

function RoomRowItem({ room, rank }: { room: RoomRow; rank: number }) {
  return (
    <li data-room={room.id} className="grid grid-cols-[1.5rem_minmax(0,7rem)_minmax(0,1fr)] items-start gap-x-3 gap-y-1 border-t border-ink-100 py-3 first:border-t-0 max-sm:grid-cols-[1.5rem_minmax(0,1fr)]">
      <span className="figure pt-0.5 text-xs text-ink-400" aria-hidden>
        {rank}
      </span>
      <span className="min-w-0 truncate text-sm font-semibold text-ink-950" title={room.id}>
        {room.label}
        {room.named ? null : <span className="sr-only">, source id {room.id}</span>}
      </span>
      <div className="space-y-1.5 max-sm:col-span-2 max-sm:pl-9">
        <Dimension label="Width" text={room.widthText} pct={room.widthPct} />
        <Dimension label="Depth" text={room.depthText} pct={room.depthPct} />
      </div>
    </li>
  );
}

const DISCLOSE =
  "flex cursor-pointer select-none items-center justify-between gap-3 rounded-md px-3 py-2 text-sm font-medium text-ink-800 hover:bg-ink-50";

/**
 * Matterport room measurements as ranked dimension lines. Width and depth are
 * the model's own estimates; every line shares one metre scale. This is a size
 * comparison only: it does not show positions, adjacency, shape, floor areas or
 * building coverage because none of those are established by the data.
 */
export function RoomMeasurements({ model }: { model: Model }) {
  const s = summarizeRooms(model.rooms);
  const unit = model.dimensionsUnit;
  if (s.total === 0)
    return (
      <p className="text-sm text-ink-600" data-testid="room-measurements">
        The model supplied no room measurements.
      </p>
    );
  return (
    <div className="space-y-5" data-testid="room-measurements">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-4">
        <Stat value={String(s.total)} label="Rooms in model" />
        <Stat value={String(s.ranked.length)} label="With width and depth" />
        <Stat value={s.widthRange ? `${s.widthRange.min}–${s.widthRange.max} ${unit}` : "—"} label="Width range" />
        <Stat value={s.depthRange ? `${s.depthRange.min}–${s.depthRange.max} ${unit}` : "—"} label="Depth range" />
      </dl>

      {s.ranked.length ? (
        <section aria-labelledby="rooms-compare-heading">
          <h4 id="rooms-compare-heading" className="text-sm font-semibold text-ink-950">
            {s.hidden.length ? `Largest ${s.visible.length} of ${s.ranked.length} dimensioned rooms` : `${s.ranked.length} dimensioned ${s.ranked.length === 1 ? "room" : "rooms"}`}
          </h4>
          <p className="mt-0.5 text-xs text-ink-500">
            Ordered by estimated width and depth, largest first. Lines share one scale in metres.
          </p>
          <ol className="mt-2" aria-label="Rooms ranked by estimated size">
            {s.visible.map((r, i) => (
              <RoomRowItem key={r.id} room={r} rank={i + 1} />
            ))}
          </ol>
          {s.hidden.length ? (
            <details className="group mt-1 rounded-md border border-ink-200">
              <summary className={DISCLOSE}>
                Show {s.hidden.length} more {s.hidden.length === 1 ? "room" : "rooms"}
                <span aria-hidden className="mr-1 size-2 shrink-0 rotate-45 border-b-[1.5px] border-r-[1.5px] border-ink-500 transition-transform group-open:-rotate-135" />
              </summary>
              <ol className="border-t border-ink-200 px-3">
                {s.hidden.map((r, i) => (
                  <RoomRowItem key={r.id} room={r} rank={s.visible.length + i + 1} />
                ))}
              </ol>
            </details>
          ) : null}
        </section>
      ) : (
        <p className="text-sm text-ink-600">
          No room has both a width and a depth, so no comparison can be shown.
        </p>
      )}

      {s.undimensioned.length ? (
        <p className="text-sm text-ink-600" data-testid="rooms-unknown">
          {s.undimensioned.length} {s.undimensioned.length === 1 ? "room has" : "rooms have"} no usable width or
          depth and {s.undimensioned.length === 1 ? "is" : "are"} not compared. Unknown values are shown as “—”,
          not zero.
        </p>
      ) : null}

      <div className="border-l-2 border-ink-300 pl-3 text-xs leading-5 text-ink-600">
        <p className="font-semibold text-ink-800">What these measurements do and don&apos;t show</p>
        <ul className="mt-0.5 space-y-0.5">
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

      <details className="group rounded-md border border-ink-200">
        <summary className={DISCLOSE}>
          Source room IDs and values as supplied
          <span aria-hidden className="mr-1 size-2 shrink-0 rotate-45 border-b-[1.5px] border-r-[1.5px] border-ink-500 transition-transform group-open:-rotate-135" />
        </summary>
        <div role="region" aria-label="Room source values" tabIndex={0} className="overflow-x-auto border-t border-ink-200 focus-visible:-outline-offset-2">
          <table className="w-full min-w-[34rem] text-left text-xs">
            <caption className="sr-only">Room source IDs and unrounded values from the model</caption>
            <thead className="bg-ink-50 text-ink-600">
              <tr>
                <th scope="col" className="px-3 py-2 font-medium">Room</th>
                <th scope="col" className="px-3 py-2 font-medium">Source ID</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Width ({unit})</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Depth ({unit})</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Height ({unit})</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Model floor area ({model.areaUnit === "m2" ? "m²" : model.areaUnit})</th>
              </tr>
            </thead>
            <tbody className="figure">
              {s.all.map((r) => (
                <tr key={r.id} className="border-t border-ink-100 align-top">
                  <th scope="row" className="whitespace-nowrap px-3 py-2 font-medium text-ink-950">{r.label}</th>
                  <td className={`max-w-[14rem] px-3 py-2 font-mono text-ink-600 ${WRAP}`}>{r.id}</td>
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
