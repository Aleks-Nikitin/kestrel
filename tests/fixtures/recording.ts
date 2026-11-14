import Decimal from "decimal.js";
import type {PropertyDTO} from "@/lib/contracts";
import {initialModel,type EditorModel} from "@/features/scenarios/model";
/** User-authored hypothetical screening inputs, NOT sponsor market facts or quotes.
 * Source area is supplied by the caller; no actual sponsor record is embedded here.
 * This is test/demo preparation, never a production autofill or fixture fallback.
 */
export function recordingModel(property:PropertyDTO):EditorModel{
 if(!property.rentableAreaSqft.value)throw Error("Reviewed source area is required.");
 const area=new Decimal(property.rentableAreaSqft.value);
 const model=initialModel(property,2026);
 const field=(text:string)=>({text,accepted:false});
 const amount=(perSqft:string)=>field(area.times(perSqft).toFixed());
 model.scenarios.forEach((s,i)=>{
  s.name=["Current flex use","Light industrial refresh","Upgraded flex workspace"][i];
  s.proposedUse=["Existing flex use","Light industrial workspace","Upgraded flex workspace"][i];
  s.leaseBasis="gross";
  s.rentNormalizationNote="Illustrative annual USD gross rent per rentable square foot. Owner-paid expenses are modeled separately; this is not a sourced lease quote or an NNN quote.";
  s.rentableAreaSqft=field(area.toFixed());
  s.annualRentPerSqft=field(["14","16","18"][i]);
  s.occupancyRatio=field(i===0?"0.85":"0.9");
  s.collectionLossRatio=field("0.01");s.annualConcessions=field("0");s.otherIncomeMode="none_modeled";
  s.expenseMode="total";s.expenseTotal=amount(["4","5","5.5"][i]);
  s.expenseTotalNote="Illustrative owner-paid property taxes, insurance, management, utilities, maintenance and other operating costs; excludes financing, depreciation and capital expenditure.";
  s.capex={renovation:amount(["0","10","20"][i]),conversion:field("0"),softCosts:amount(["0","1.5","3"][i]),contingency:amount(["0","1.5","3"][i]),other:field("0")};
  const investment=area.times(["0","13","26"][i]);
  s.totalProjectCost=field(new Decimal("6000000").plus(investment).toFixed());
  s.totalProjectCostNote="Hypothetical existing-property cost basis of USD 6000000 plus all five disclosed upfront cost categories. Not an appraisal, purchase price or sponsor valuation. Excludes financing, transaction costs, downtime and lease-up.";
  s.assumptions="All rents, occupancy, collection loss, operating costs, capex and existing-property cost basis are illustrative user inputs for this recording, not sponsor facts or contractor quotes.\nThe same recorded rentable area is modeled under mutually exclusive alternatives; zoning, physical conversion scope and full scan coverage remain unverified.\nOther income and concessions are deliberately excluded (zero); conversion and other capital are deliberately zero, not unknown.";
 });
 model.constraints.maxInitialInvestment=field("2000000");
 model.constraints.maxPaybackYears=field("10");
 model.constraints.riskTolerance="moderate";
 return model;
}
