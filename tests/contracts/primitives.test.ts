import { describe, expect, it } from "vitest";
import {
  Amount,
  DecimalString,
  Period,
  Ratio,
  datum,
} from "@/lib/schemas/primitives";
describe("bounded decimal and provenance contracts", () => {
  it.each([
    "NaN",
    "Infinity",
    "1e22",
    "1,000",
    "",
    ".9",
    "01",
    "1234567890123",
    "0.123456789",
  ])("rejects unsupported decimal %s", (value) =>
    expect(DecimalString.safeParse(value).success).toBe(false),
  );
  it("preserves tiny ratios and large bounded amounts", () => {
    expect(Ratio.parse("0.00000005")).toBe("0.00000005");
    expect(Amount.parse("999999999999.99")).toBe("999999999999.99");
  });
  it.each(["-1", "1.00000001"])("rejects out-of-range ratio %s", (value) =>
    expect(Ratio.safeParse(value).success).toBe(false),
  );
  it.each(["not-a-date", "2026-13-01", "2026-02-30", ""])("rejects malformed period start %s without throwing", start => {
    expect(Period.safeParse({ start, end: "2027-01-01", basis: "stabilized_annual" }).success).toBe(false);
  });
  it("requires an exact calendar year", () => {
    expect(
      Period.safeParse({
        start: "2026-01-01",
        end: "2026-12-31",
        basis: "stabilized_annual",
      }).success,
    ).toBe(false);
  });
  it("requires source evidence and explanatory unknowns", () => {
    const s = datum(Amount, "USD");
    const d = {
      value: "1",
      origin: "source_data",
      unit: "USD",
      evidenceIds: [],
      recordedAt: "2026-11-14T17:00:00Z",
      sourceAsOf: null,
      note: null,
    };
    expect(s.safeParse(d).success).toBe(false);
    expect(s.safeParse({ ...d, origin: "unknown", value: null }).success).toBe(
      false,
    );
    expect(
      s.safeParse({
        ...d,
        origin: "unknown",
        value: null,
        note: "Not supplied",
      }).success,
    ).toBe(true);
  });
});
