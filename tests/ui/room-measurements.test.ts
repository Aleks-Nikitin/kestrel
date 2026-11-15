import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RoomMeasurements } from "@/features/property/room-measurements";
import { spatial } from "../fixtures/contracts";

type Model = NonNullable<typeof spatial.model>;
const model = (rooms: Model["rooms"]): Model => ({ ...spatial.model!, rooms });
const room = (id: string, width: string | null, depth: string | null) => ({ id, width, depth, height: "3.1234", floorArea: null });
const html = (m: Model) => renderToStaticMarkup(createElement(RoomMeasurements, { model: m }));

describe("RoomMeasurements", () => {
  const LONG = "c0ffee12-3456-7890-abcd-ef0123456789-" + "x".repeat(60);
  const rooms = [
    ...Array.from({ length: 9 }, (_, i) => room(`room-${String(i + 1).padStart(3, "0")}`, String(3 + i * 1.234), String(4 + i))),
    room(LONG, "20.987", "15.5"),
    room("no-depth", "5", null),
  ];
  const h = html(model(rooms));

  it("summarises the model and shows five rooms before the expandable remainder", () => {
    expect(h).toContain("Rooms in model");
    expect(h).toContain("Largest 5 of 10 dimensioned rooms");
    expect(h).toContain("Show 5 more rooms");
    expect((h.match(/<li data-room=/g) ?? []).length).toBe(10);
  });

  it("uses short labels and keeps the full source id in details, wrapped", () => {
    expect(h).toContain("Room 10");
    expect(h).toContain(LONG);
    expect(h).toContain("overflow-wrap:anywhere");
    expect(h).toContain("Source room IDs and values as supplied");
  });

  it("rounds for display, keeps source strings, and states unknowns and limits", () => {
    expect(h).toContain("21.0 m");
    expect(h).toContain("20.987");
    expect(h).toContain("unknown");
    expect(h).toContain("not zero");
    expect(h).toContain("do not establish room shape, position, adjacency");
  });

  it("never presents a derived area or an SVG pseudo floor plan", () => {
    expect(h).not.toContain("<svg");
    expect(h).not.toMatch(/\b\d+(\.\d+)? ?m²/);
    expect(h).toContain("Model floor area");
  });

  it("handles a model with no usable dimensions or no rooms", () => {
    expect(html(model([room("a", null, null)]))).toContain("No room has both a width and a depth");
    expect(html(model([]))).toContain("supplied no room measurements");
  });
});
