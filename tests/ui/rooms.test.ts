import { describe, expect, it } from "vitest";
import { displayLabel, fmt1, summarizeRooms } from "@/features/property/rooms";

const room = (id: string, width: string | null, depth: string | null, extra: Partial<{ height: string | null; floorArea: string | null }> = {}) => ({
  id,
  width,
  depth,
  height: "3.04",
  floorArea: null,
  ...extra,
});

describe("room measurement summary", () => {
  it("ranks by relative size, shows five by default and keeps the rest", () => {
    const rooms = Array.from({ length: 8 }, (_, i) => room(`r${i}`, String(i + 1), String(i + 2)));
    const s = summarizeRooms(rooms);
    expect(s.total).toBe(8);
    expect(s.visible).toHaveLength(5);
    expect(s.hidden).toHaveLength(3);
    expect(s.visible[0]?.id).toBe("r7");
    expect(s.hidden.map((r) => r.id)).toEqual(["r2", "r1", "r0"]);
  });

  it("rounds for display only and leaves the raw source strings untouched", () => {
    const [r] = summarizeRooms([room("a", "4.2567", "6.04", { floorArea: "25.7123" })]).all;
    expect(r?.widthText).toBe("4.3");
    expect(r?.depthText).toBe("6.0");
    expect(r?.floorAreaText).toBe("25.7");
    expect(r?.raw).toEqual({ width: "4.2567", depth: "6.04", height: "3.04", floorArea: "25.7123" });
  });

  it("never exposes a computed area: only the model's own floor-area text is carried", () => {
    const s = summarizeRooms([room("a", "10", "8")]);
    expect(Object.keys(s.all[0] ?? {}).filter((k) => /area/i.test(k))).toEqual(["floorAreaText"]);
    expect(s.all[0]?.floorAreaText).toBe("—");
  });

  it("lists rooms without both dimensions as unknown, never as zero", () => {
    const s = summarizeRooms([room("a", "10", "8"), room("b", null, "4"), room("c", "0", "3")]);
    expect(s.ranked.map((r) => r.id)).toEqual(["a"]);
    expect(s.undimensioned.map((r) => r.id)).toEqual(["b", "c"]);
    expect(s.undimensioned[0]?.widthText).toBe("—");
    expect(s.undimensioned[0]?.widthPct).toBeNull();
  });

  it("scales bars on one shared metre scale within 0–100", () => {
    const s = summarizeRooms([room("a", "10", "8"), room("b", "5", "4")]);
    const [a, b] = s.ranked;
    expect(a?.widthPct).toBeCloseTo(100);
    expect(b?.widthPct).toBeCloseTo(50);
    expect(a?.depthPct).toBeCloseTo(80);
    for (const r of s.ranked) for (const p of [r.widthPct, r.depthPct]) expect(p).toBeGreaterThan(0);
  });

  it("reports ranges and reported-value counts without NaN", () => {
    const s = summarizeRooms([room("a", "10", "8"), room("b", "5", "4", { height: null })]);
    expect(s.widthRange).toEqual({ min: "5.0", max: "10.0" });
    expect(s.depthRange).toEqual({ min: "4.0", max: "8.0" });
    expect(s.heightReported).toBe(1);
    expect(summarizeRooms([]).widthRange).toBeNull();
    expect(summarizeRooms([room("a", null, null)]).ranked).toEqual([]);
  });

  it("is deterministic for ties", () => {
    const s = summarizeRooms([room("a", "5", "5"), room("b", "5", "5")]);
    expect(s.ranked.map((r) => r.id)).toEqual(["a", "b"]);
  });
});

describe("room display labels", () => {
  it("keeps a readable name and falls back to a short numbered label for opaque ids", () => {
    expect(displayLabel("conference_room", 3)).toEqual({ label: "Conference room", named: true });
    expect(displayLabel("room-001", 2)).toEqual({ label: "Room 2", named: false });
    expect(displayLabel("c0ffee12-3456-7890-abcd-ef0123456789", 9)).toEqual({ label: "Room 9", named: false });
    expect(displayLabel("x".repeat(80), 4).label).toBe("Room 4");
  });

  it("formats one decimal place", () => {
    expect(fmt1(4)).toBe("4.0");
    expect(fmt1(1234.56)).toBe("1,234.6");
  });
});
