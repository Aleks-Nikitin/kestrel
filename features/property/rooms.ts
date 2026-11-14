// Display-only room schematic layout. Uses the model's own width/depth values at
// one common scale; it does not compute areas, positions or any financial value.
import type { SpatialContextDTO } from "@/lib/contracts";

type Room = NonNullable<SpatialContextDTO["model"]>["rooms"][number];

export interface RoomRect {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  width: string;
  depth: string;
  height: string | null;
  floorArea: string | null;
}

export interface RoomLayout {
  rects: RoomRect[];
  /** Rooms lacking width or depth cannot be drawn and are listed instead. */
  unknown: string[];
  viewWidth: number;
  viewHeight: number;
  scaleBarMetres: number;
  scaleBarPx: number;
}

const NICE = [1, 2, 5, 10, 20, 50];

export function layoutRooms(
  rooms: Room[],
  opts: { maxPx?: number; gap?: number; rowWidth?: number } = {},
): RoomLayout {
  const { maxPx = 140, gap = 16, rowWidth = 640 } = opts;
  const drawable = rooms.flatMap((r) => {
    const w = r.width === null ? NaN : Number(r.width);
    const d = r.depth === null ? NaN : Number(r.depth);
    return Number.isFinite(w) && Number.isFinite(d) && w > 0 && d > 0
      ? [{ r, w, d }]
      : [];
  });
  const unknown = rooms
    .filter((r) => !drawable.some((x) => x.r.id === r.id))
    .map((r) => r.id);
  if (drawable.length === 0)
    return { rects: [], unknown, viewWidth: rowWidth, viewHeight: 0, scaleBarMetres: 0, scaleBarPx: 0 };

  const largest = Math.max(...drawable.flatMap((x) => [x.w, x.d]));
  const scale = maxPx / largest; // px per metre, shared by every room
  const rects: RoomRect[] = [];
  let x = 0;
  let y = 0;
  let rowHeight = 0;
  for (const { r, w, d } of drawable) {
    const pw = w * scale;
    const ph = d * scale;
    if (x > 0 && x + pw > rowWidth) {
      x = 0;
      y += rowHeight + gap;
      rowHeight = 0;
    }
    rects.push({
      id: r.id,
      x,
      y,
      w: pw,
      h: ph,
      width: r.width as string,
      depth: r.depth as string,
      height: r.height,
      floorArea: r.floorArea,
    });
    x += pw + gap;
    rowHeight = Math.max(rowHeight, ph);
  }
  const scaleBarMetres =
    [...NICE].reverse().find((m) => m * scale <= maxPx * 0.8) ?? NICE[0];
  return {
    rects,
    unknown,
    viewWidth: rowWidth,
    viewHeight: y + rowHeight,
    scaleBarMetres,
    scaleBarPx: scaleBarMetres * scale,
  };
}
