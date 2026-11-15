// Display-only helpers for the Matterport room measurements. They parse the
// model's own width/depth strings for comparison bars and rounding. Nothing
// here computes or returns a floor area, a position or an adjacency, and the
// raw source strings are carried through unchanged.
import type { SpatialContextDTO } from "@/lib/contracts";

type Room = NonNullable<SpatialContextDTO["model"]>["rooms"][number];

export const DEFAULT_VISIBLE_ROOMS = 5;

export interface RoomRow {
  /** Full source room id, never altered. */
  id: string;
  /** 1-based position in the source list, used for fallback labels. */
  sourceIndex: number;
  /** Short display label: a readable name if the id is one, else "Room N". */
  label: string;
  named: boolean;
  /** Rounded for display only; "—" when the source value is unknown. */
  widthText: string;
  depthText: string;
  heightText: string;
  floorAreaText: string;
  /** Source strings exactly as supplied. */
  raw: { width: string | null; depth: string | null; height: string | null; floorArea: string | null };
  /** Bar lengths, 0–100, on one shared metre scale; null when unknown. */
  widthPct: number | null;
  depthPct: number | null;
}

export interface RoomSummary {
  total: number;
  /** All rooms in source order. */
  all: RoomRow[];
  /** Rooms with both a positive width and depth, largest first. */
  ranked: RoomRow[];
  visible: RoomRow[];
  hidden: RoomRow[];
  /** Rooms missing a usable width or depth: listed, never drawn. */
  undimensioned: RoomRow[];
  widthRange: { min: string; max: string } | null;
  depthRange: { min: string; max: string } | null;
  heightReported: number;
  floorAreaReported: number;
}

/** One decimal place, fixed locale so server and client render alike. */
export function fmt1(n: number): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function num(v: string | null): number | null {
  if (v === null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function pos(v: string | null): number | null {
  const n = num(v);
  return n !== null && n > 0 ? n : null;
}

const NAME = /^[A-Za-z][A-Za-z ]{1,22}( \d{1,2})?$/;

/** A readable name is short and word-like; ids such as "room-001" or hashes are not. */
export function displayLabel(id: string, sourceIndex: number): { label: string; named: boolean } {
  const cleaned = id.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  if (NAME.test(cleaned) && !/^[0-9a-f ]+$/i.test(cleaned))
    return { label: cleaned.charAt(0).toUpperCase() + cleaned.slice(1), named: true };
  return { label: `Room ${sourceIndex}`, named: false };
}

const text = (v: string | null) => {
  const n = num(v);
  return n === null ? "—" : fmt1(n);
};

export function summarizeRooms(rooms: Room[], visibleCount = DEFAULT_VISIBLE_ROOMS): RoomSummary {
  const dims = rooms.map((r) => ({ w: pos(r.width), d: pos(r.depth) }));
  const longest = Math.max(
    0,
    ...dims.flatMap((x) => (x.w !== null && x.d !== null ? [x.w, x.d] : [])),
  );
  const pct = (v: number | null) =>
    v === null || longest === 0 ? null : Math.min(100, Math.max(2, (v / longest) * 100));

  const all: RoomRow[] = rooms.map((r, i) => {
    const { label, named } = displayLabel(r.id, i + 1);
    const { w, d } = dims[i] ?? { w: null, d: null };
    const both = w !== null && d !== null;
    return {
      id: r.id,
      sourceIndex: i + 1,
      label,
      named,
      widthText: text(r.width),
      depthText: text(r.depth),
      heightText: text(r.height),
      floorAreaText: text(r.floorArea),
      raw: { width: r.width, depth: r.depth, height: r.height, floorArea: r.floorArea },
      widthPct: both ? pct(w) : null,
      depthPct: both ? pct(d) : null,
    };
  });

  const usable = (row: RoomRow) => row.widthPct !== null && row.depthPct !== null;
  // width × depth is only a sort key for "largest first"; it is never shown or stored.
  const key = (row: RoomRow) => (pos(row.raw.width) ?? 0) * (pos(row.raw.depth) ?? 0);
  const ranked = all
    .filter(usable)
    .sort((a, b) => key(b) - key(a) || a.sourceIndex - b.sourceIndex);

  const range = (pick: (r: RoomRow) => string | null) => {
    const vs = ranked.flatMap((r) => {
      const n = pos(pick(r));
      return n === null ? [] : [n];
    });
    return vs.length ? { min: fmt1(Math.min(...vs)), max: fmt1(Math.max(...vs)) } : null;
  };

  return {
    total: all.length,
    all,
    ranked,
    visible: ranked.slice(0, visibleCount),
    hidden: ranked.slice(visibleCount),
    undimensioned: all.filter((r) => !usable(r)),
    widthRange: range((r) => r.raw.width),
    depthRange: range((r) => r.raw.depth),
    heightReported: rooms.filter((r) => num(r.height) !== null).length,
    floorAreaReported: rooms.filter((r) => num(r.floorArea) !== null).length,
  };
}
