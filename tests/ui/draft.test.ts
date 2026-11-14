import { describe, expect, it } from "vitest";
import { AnalysisRequest } from "@/lib/contracts";
import { analysisRequest } from "@/features/dashboard/draft";
import { property } from "../fixtures/contracts";

describe("spike analysis request", () => {
  const req = analysisRequest(property, 3, 2027);

  it("is a valid contract request for the selected property and revision", () => {
    expect(AnalysisRequest.safeParse(req).success).toBe(true);
    expect(req.propertyId).toBe(property.id);
    expect(req.inputRevision).toBe(3);
    expect(req.scenarios).toHaveLength(1);
    expect(req.scenarios[0].role).toBe("baseline");
    expect(req.scenarios[0].period).toEqual({
      start: "2027-01-01",
      end: "2028-01-01",
      basis: "stabilized_annual",
    });
  });

  it("never defaults unknown financial inputs to zero", () => {
    const s = req.scenarios[0];
    expect(s.annualRentPerSqft.value).toBeNull();
    expect(s.collectionLossRatio.value).toBeNull();
    expect(s.annualConcessions.value).toBeNull();
    expect(s.capex.renovation.value).toBeNull();
    expect(s.operatingExpenses).toEqual({ mode: "total", annualAmount: { value: null } });
    expect(req.constraints.maxInitialInvestment.value).toBeNull();
  });

  it("copies rentable area, never gross area, and carries no provenance fields", () => {
    const s = req.scenarios[0];
    expect(s.rentableAreaSqft.value).toBe(property.rentableAreaSqft.value);
    expect(s.rentableAreaSqft.value).not.toBe(property.grossAreaSqft.value);
    expect(JSON.stringify(req)).not.toMatch(/origin|evidenceIds/);
  });
});
