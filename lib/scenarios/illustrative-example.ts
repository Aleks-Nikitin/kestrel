import Decimal from "decimal.js";
import { Positive, type PropertyDTO } from "@/lib/contracts";
import { initialModel, validateModel, type EditorModel, type FieldDraft } from "@/features/scenarios/model";

export const ILLUSTRATIVE_EXAMPLE_LABEL = "Load illustrative investment example";
export const ILLUSTRATIVE_EXAMPLE_DISCLOSURE =
  "Illustrative investment example: all rents, occupancy, expenses, capital costs and the existing-property cost basis are hypothetical user assumptions, not sponsor facts, market quotes or an appraisal. Only rentable area comes from the selected property record. Loading replaces the current scenario drafts and constraints; every value remains editable. Legal permission, structural suitability and complete scan coverage remain unverified.";

export type IllustrativeExampleResult =
  | { ok: true; model: EditorModel }
  | { ok: false; reason: "RECORDED_AREA_REQUIRED" | "INVALID_DRAFT"; message: string };

/**
 * Pure draft preparation for an explicit user click, never an initial default.
 * Reads one displayed source datum; contains no sponsor IDs, mappings or data.
 * Decimal arithmetic scales hypothetical inputs, not canonical financial results.
 */
export function createIllustrativeInvestmentExample(
  property: PropertyDTO,
  year: number,
): IllustrativeExampleResult {
  const recorded = property.rentableAreaSqft;
  if (recorded.origin !== "source_data" || !Positive.safeParse(recorded.value).success)
    return { ok: false, reason: "RECORDED_AREA_REQUIRED", message: "A positive recorded rentable area is required. No area is invented or substituted from Matterport rooms." };

  if (!Number.isInteger(year) || year < 1000 || year > 9998)
    return { ok: false, reason: "INVALID_DRAFT", message: "A supported whole calendar year is required; keep the existing drafts unchanged." };
  const sourceArea = recorded.value!;
  const area = new Decimal(sourceArea);
  const model = initialModel(property, year);
  // The explicit load action accepts hypothetical assumptions, not source facts.
  // This flag also prevents equal-valued rent/occupancy from becoming source data.
  const assumption = (text: string): FieldDraft => ({ text, accepted: true });
  const scaled = (perSqft: string) => assumption(area.times(perSqft).toFixed());
  model.scenarios.forEach((s, i) => {
    s.name = ["Current flex use", "Light industrial refresh", "Upgraded flex workspace"][i];
    s.proposedUse = ["Existing flex use", "Light industrial workspace", "Upgraded flex workspace"][i];
    s.leaseBasis = "gross";
    s.rentNormalizationNote = "Illustrative annual USD gross rent per rentable square foot. Owner-paid expenses are modeled separately; this is not a sourced lease quote or an NNN quote.";
    // Preserve the exact recorded string for the server's source binding.
    s.rentableAreaSqft = { text: sourceArea, accepted: false };
    s.annualRentPerSqft = assumption(["14", "16", "18"][i]);
    s.occupancyRatio = assumption(i === 0 ? "0.85" : "0.9");
    s.collectionLossRatio = assumption("0.01");
    s.annualConcessions = assumption("0");
    s.otherIncomeMode = "none_modeled";
    s.expenseMode = "total";
    s.expenseTotal = scaled(["4", "5", "5.5"][i]);
    s.expenseTotalNote = "Illustrative owner-paid property taxes, insurance, management, utilities, maintenance and other operating costs; excludes financing, depreciation and capital expenditure.";
    s.capex = {
      renovation: scaled(["0", "10", "20"][i]), conversion: assumption("0"),
      softCosts: scaled(["0", "1.5", "3"][i]), contingency: scaled(["0", "1.5", "3"][i]), other: assumption("0"),
    };
    s.totalProjectCost = assumption(new Decimal("6000000").plus(area.times(["0", "13", "26"][i])).toFixed());
    s.totalProjectCostNote = "Hypothetical existing-property cost basis of USD 6000000 plus all five disclosed upfront cost categories. Not an appraisal, purchase price or sponsor valuation. Excludes financing, transaction costs, downtime and lease-up.";
    s.assumptions = "All rents, occupancy, collection loss, operating costs, capex and existing-property cost basis are illustrative user inputs, not sponsor facts or contractor quotes.\nThe same recorded rentable area is modeled under mutually exclusive illustrative uses; the baseline use is a hypothetical scenario, not a claim about the property's actual current use. Zoning, physical conversion scope and full scan coverage remain unverified.\nOther income and concessions are deliberately excluded (zero); conversion and other capital are deliberately zero, not unknown.";
  });
  model.constraints.maxInitialInvestment = assumption("2000000");
  model.constraints.maxPaybackYears = assumption("10");
  model.constraints.riskTolerance = "moderate";
  if (!validateModel(model, property.id, 1).request)
    return { ok: false, reason: "INVALID_DRAFT", message: "The example cannot be represented by the current scenario contract. Keep the existing drafts and review the recorded area and year." };
  return { ok: true, model };
}
