import { describe, expect, it } from "vitest";
import {
  formatByUnit,
  formatCoordinates,
  formatDecimal,
  formatInstant,
  formatRatio,
  formatUsd,
} from "@/features/dashboard/format";

describe("display formatting", () => {
  it("formats money and area with units", () => {
    expect(formatUsd("190000")).toBe("$190,000");
    expect(formatByUnit("190000", "USD/year")).toBe("$190,000 / yr");
    expect(formatByUnit("20", "USD/sqft/year")).toBe("$20.00 / sq ft / yr");
    expect(formatByUnit("10000", "sqft")).toBe("10,000 sq ft");
  });
  it("shows ratios as percentages and rounds years only for display", () => {
    expect(formatRatio("0.9")).toBe("90%");
    expect(formatByUnit("4.285714285714285714285714286", "years")).toBe("4.3 years");
    expect(formatDecimal("6", 1)).toBe("6");
  });
  it("passes through non-numeric strings instead of guessing", () => {
    expect(formatUsd("not-a-number")).toBe("not-a-number");
  });
  it("formats WGS84 coordinates with hemispheres", () => {
    expect(formatCoordinates({ longitude: -95.36, latitude: 29.76 })).toBe(
      "29.76000° N, 95.36000° W",
    );
  });
  it("formats instants as UTC", () => {
    expect(formatInstant("2026-11-14T17:00:00Z")).toBe("2026-11-14 17:00 UTC");
  });
});
