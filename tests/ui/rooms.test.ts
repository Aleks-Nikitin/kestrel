import { describe, expect, it } from "vitest";
import { layoutRooms } from "@/features/property/rooms";

const room = (id: string, width: string | null, depth: string | null) => ({
  id,
  width,
  depth,
  height: "3",
  floorArea: width && depth ? "80" : null,
});

describe("room schematic layout", () => {
  it("uses one shared scale so relative sizes are preserved", () => {
    const l = layoutRooms([room("a", "10", "8"), room("b", "5", "4")], { maxPx: 100 });
    const [a, b] = l.rects;
    expect(a.w / a.h).toBeCloseTo(10 / 8);
    expect(a.w / b.w).toBeCloseTo(2);
    expect(a.w).toBeCloseTo(100);
  });

  it("lists rooms without both dimensions instead of inventing sizes", () => {
    const l = layoutRooms([room("a", "10", "8"), room("b", null, "4"), room("c", "0", "3")]);
    expect(l.rects.map((r) => r.id)).toEqual(["a"]);
    expect(l.unknown).toEqual(["b", "c"]);
  });

  it("wraps rows and never produces NaN", () => {
    const l = layoutRooms(
      Array.from({ length: 6 }, (_, i) => room(`r${i}`, "10", "8")),
      { maxPx: 100, rowWidth: 250, gap: 10 },
    );
    expect(l.rects.some((r) => r.y > 0)).toBe(true);
    for (const r of l.rects) for (const v of [r.x, r.y, r.w, r.h]) expect(Number.isFinite(v)).toBe(true);
    expect(Number.isFinite(l.viewHeight)).toBe(true);
  });

  it("returns an empty layout when nothing is drawable", () => {
    const l = layoutRooms([room("a", null, null)]);
    expect(l.rects).toEqual([]);
    expect(l.unknown).toEqual(["a"]);
    expect(l.scaleBarMetres).toBe(0);
  });

  it("scale bar fits inside the drawing", () => {
    const l = layoutRooms([room("a", "10", "8")], { maxPx: 140 });
    expect(l.scaleBarMetres).toBeGreaterThan(0);
    expect(l.scaleBarPx).toBeLessThanOrEqual(140);
  });
});
