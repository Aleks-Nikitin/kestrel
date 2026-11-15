import { describe, expect, it } from "vitest";
import { percentText, percentToRatio, ratioToPercent } from "@/features/scenarios/percent";
import { validateDecimal } from "@/features/scenarios/model";

describe("percent display of ratio fields", () => {
  it("moves the decimal point exactly, without floating point", () => {
    expect(ratioToPercent("0.9")).toBe("90");
    expect(ratioToPercent("0.85")).toBe("85");
    expect(ratioToPercent("0.925")).toBe("92.5");
    expect(ratioToPercent("0.01")).toBe("1");
    expect(ratioToPercent("0.005")).toBe("0.5");
    expect(ratioToPercent("1")).toBe("100");
    expect(ratioToPercent("0")).toBe("0");
    expect(ratioToPercent("0.07")).toBe("7");
    expect(ratioToPercent("0.1234567")).toBe("12.34567");
  });
  it("turns a typed percentage into the contract ratio string", () => {
    expect(percentToRatio("90")).toBe("0.9");
    expect(percentToRatio("85")).toBe("0.85");
    expect(percentToRatio("92.5")).toBe("0.925");
    expect(percentToRatio("1")).toBe("0.01");
    expect(percentToRatio("0.5")).toBe("0.005");
    expect(percentToRatio("100")).toBe("1");
    expect(percentToRatio("0")).toBe("0");
    expect(percentToRatio("7")).toBe("0.07");
  });
  it("round-trips every value entered in either mode", () => {
    for (const ratio of ["0.9", "0.85", "0.925", "0.01", "1", "0", "0.07", "0.900", "0.3333"])
      expect(percentToRatio(ratioToPercent(ratio)!)).toBe(ratio);
    for (const pct of ["90", "85", "92.5", "1", "0.5", "100", "0", "90.0", "33.33"])
      expect(ratioToPercent(percentToRatio(pct))).toBe(pct);
  });
  it("keeps unknown as unknown and never invents a value", () => {
    expect(ratioToPercent("")).toBe("");
    expect(percentToRatio("")).toBe("");
    expect(percentToRatio("  ")).toBe("");
  });
  it("passes anything that is not a plain number through for validation to reject", () => {
    for (const bad of ["9o", "90.", "12,5", "-5", "1e2"]) {
      expect(percentToRatio(bad)).toBe(bad);
      expect(percentText(bad)).toBe(bad);
      expect(validateDecimal(bad, "ratio")).not.toBeNull();
    }
    expect(validateDecimal(percentToRatio("150"), "ratio")).not.toBeNull();
    expect(validateDecimal(percentToRatio("90"), "ratio")).toBeNull();
  });
});
