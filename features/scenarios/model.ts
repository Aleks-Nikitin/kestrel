// Form-side model for the scenario editor. Values stay as the user typed them
// (plain decimal strings) and are converted to the frozen ScenarioInput /
// ConstraintsInput request shapes. Nothing here calculates a financial result;
// contract validation is reused, not reimplemented.
import {
  Amount,
  ComparisonRequest,
  Positive,
  Ratio,
  type ComparisonRequestDTO,
  type ConstraintsInputDTO,
  type PropertyDTO,
  type ScenarioInputDTO,
} from "@/lib/contracts";
import type { Origin } from "@/features/dashboard/format";

export const EXPENSE_CATEGORIES = [
  "taxes",
  "insurance",
  "management",
  "utilities",
  "maintenance",
  "other",
] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];
export const CATEGORY_LABEL: Record<ExpenseCategory, string> = {
  taxes: "Taxes",
  insurance: "Insurance",
  management: "Management",
  utilities: "Utilities",
  maintenance: "Maintenance",
  other: "Other",
};
export const CAPEX_FIELDS = [
  "renovation",
  "conversion",
  "softCosts",
  "contingency",
  "other",
] as const;
export type CapexField = (typeof CAPEX_FIELDS)[number];
export const CAPEX_LABEL: Record<CapexField, string> = {
  renovation: "Renovation",
  conversion: "Conversion",
  softCosts: "Soft costs",
  contingency: "Contingency",
  other: "Other capital",
};

export interface FieldDraft {
  text: string;
  /** True only when the user deliberately accepted a proposed estimate. */
  accepted: boolean;
}
export const blank = (): FieldDraft => ({ text: "", accepted: false });

export type OtherIncomeMode = "unknown" | "none_modeled" | "entered";
export type LeaseBasis = ScenarioInputDTO["leaseBasis"];

export interface ScenarioForm {
  id: string;
  role: "baseline" | "alternative";
  name: string;
  proposedUse: string;
  leaseBasis: LeaseBasis;
  rentNormalizationNote: string;
  rentableAreaSqft: FieldDraft;
  annualRentPerSqft: FieldDraft;
  occupancyRatio: FieldDraft;
  collectionLossRatio: FieldDraft;
  annualConcessions: FieldDraft;
  otherIncomeMode: OtherIncomeMode;
  otherPotentialAnnualIncome: FieldDraft;
  otherEffectiveAnnualIncome: FieldDraft;
  expenseMode: "total" | "itemized";
  expenseTotal: FieldDraft;
  expenseTotalNote: string;
  expenseItems: Record<ExpenseCategory, FieldDraft>;
  capex: Record<CapexField, FieldDraft>;
  totalProjectCost: FieldDraft;
  assumptions: string;
}

export interface ConstraintsForm {
  maxInitialInvestment: FieldDraft;
  maxPaybackYears: FieldDraft;
  minimumYieldOnCost: FieldDraft;
  riskTolerance: ConstraintsInputDTO["riskTolerance"];
}

export interface EditorModel {
  year: number;
  scenarios: ScenarioForm[];
  constraints: ConstraintsForm;
}

export const MAX_SCENARIOS = 6;
export const MIN_ALTERNATIVES = 2;

function blankScenario(
  id: string,
  role: ScenarioForm["role"],
  name: string,
): ScenarioForm {
  return {
    id,
    role,
    name,
    proposedUse: "",
    leaseBasis: "unknown",
    rentNormalizationNote: "",
    rentableAreaSqft: blank(),
    annualRentPerSqft: blank(),
    occupancyRatio: blank(),
    collectionLossRatio: blank(),
    annualConcessions: blank(),
    otherIncomeMode: "unknown",
    otherPotentialAnnualIncome: blank(),
    otherEffectiveAnnualIncome: blank(),
    expenseMode: "total",
    expenseTotal: blank(),
    expenseTotalNote: "",
    expenseItems: {
      taxes: blank(),
      insurance: blank(),
      management: blank(),
      utilities: blank(),
      maintenance: blank(),
      other: blank(),
    },
    capex: {
      renovation: blank(),
      conversion: blank(),
      softCosts: blank(),
      contingency: blank(),
      other: blank(),
    },
    totalProjectCost: blank(),
    assumptions: "",
  };
}

export function newAlternative(index: number): ScenarioForm {
  const letter = String.fromCharCode(97 + index); // a, b, c…
  return blankScenario(
    `alternative-${letter}`,
    "alternative",
    `Alternative ${letter.toUpperCase()}`,
  );
}

export interface Proposal {
  value: string;
  origin: Origin;
}
export type ProposalField = "rentableAreaSqft" | "occupancyRatio" | "annualRentPerSqft";

/** Known property values the user may choose to use; never applied silently. */
export function propertyProposals(
  property: PropertyDTO,
): Partial<Record<ProposalField, Proposal>> {
  const out: Partial<Record<ProposalField, Proposal>> = {};
  const add = (f: ProposalField, d: { value: string | null; origin: Origin }) => {
    if (d.value !== null) out[f] = { value: d.value, origin: d.origin };
  };
  add("rentableAreaSqft", property.rentableAreaSqft);
  add("occupancyRatio", property.occupancyRatio);
  add("annualRentPerSqft", property.marketRentAnnualPerSqft);
  return out;
}

export function initialModel(property: PropertyDTO, year: number): EditorModel {
  const baseline = blankScenario("baseline", "baseline", "Current use (baseline)");
  baseline.proposedUse = property.existingUse.value ?? "";
  // Only sourced facts are prefilled; estimates need a deliberate "use" click.
  if (
    property.rentableAreaSqft.value !== null &&
    property.rentableAreaSqft.origin === "source_data"
  )
    baseline.rentableAreaSqft = { text: property.rentableAreaSqft.value, accepted: false };
  if (
    property.occupancyRatio.value !== null &&
    property.occupancyRatio.origin === "source_data"
  )
    baseline.occupancyRatio = { text: property.occupancyRatio.value, accepted: false };
  return {
    year,
    scenarios: [baseline, newAlternative(0), newAlternative(1)],
    constraints: {
      maxInitialInvestment: blank(),
      maxPaybackYears: blank(),
      minimumYieldOnCost: blank(),
      riskTolerance: "moderate",
    },
  };
}

// ---- request building ------------------------------------------------------

function iv(f: FieldDraft) {
  const text = f.text.trim();
  if (text === "") return { value: null };
  return f.accepted ? { value: text, acceptedEstimate: true } : { value: text };
}

export function toScenarioInput(
  f: ScenarioForm,
  propertyId: string,
  year: number,
): ScenarioInputDTO {
  const zero = (note: string) => ({ value: "0", note });
  const other =
    f.otherIncomeMode === "none_modeled"
      ? {
          potential: zero("No other income modeled (user choice)"),
          effective: zero("No other income modeled (user choice)"),
        }
      : f.otherIncomeMode === "entered"
        ? { potential: iv(f.otherPotentialAnnualIncome), effective: iv(f.otherEffectiveAnnualIncome) }
        : { potential: { value: null }, effective: { value: null } };
  const baseline = f.role === "baseline";
  const capexValue = (k: CapexField) =>
    // The contract defines baseline investment as zero.
    baseline ? { value: "0" } : iv(f.capex[k]);
  const totalNote = f.expenseTotalNote.trim();
  return {
    id: f.id,
    propertyId,
    role: f.role,
    name: f.name.trim(),
    proposedUse: f.proposedUse.trim(),
    leaseBasis: f.leaseBasis,
    rentNormalizationNote: f.rentNormalizationNote.trim() || null,
    period: {
      start: `${year}-01-01`,
      end: `${year + 1}-01-01`,
      basis: "stabilized_annual",
    },
    currency: "USD",
    rentableAreaSqft: iv(f.rentableAreaSqft),
    annualRentPerSqft: iv(f.annualRentPerSqft),
    occupancyRatio: iv(f.occupancyRatio),
    collectionLossRatio: iv(f.collectionLossRatio),
    annualConcessions: iv(f.annualConcessions),
    otherPotentialAnnualIncome: other.potential,
    otherEffectiveAnnualIncome: other.effective,
    operatingExpenses:
      f.expenseMode === "total"
        ? {
            mode: "total",
            annualAmount:
              f.expenseTotal.text.trim() !== "" && totalNote
                ? { ...iv(f.expenseTotal), note: totalNote }
                : iv(f.expenseTotal),
          }
        : {
            mode: "itemized",
            items: EXPENSE_CATEGORIES.map((c) => ({
              id: `${f.id}-${c}`,
              category: c,
              label: CATEGORY_LABEL[c],
              annualAmount: iv(f.expenseItems[c]),
            })),
          },
    capex: {
      renovation: capexValue("renovation"),
      conversion: capexValue("conversion"),
      softCosts: capexValue("softCosts"),
      contingency: capexValue("contingency"),
      other: capexValue("other"),
    },
    totalProjectCost: iv(f.totalProjectCost),
    assumptions: f.assumptions
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean),
  };
}

export function toConstraintsInput(c: ConstraintsForm): ConstraintsInputDTO {
  return {
    maxInitialInvestment: iv(c.maxInitialInvestment),
    maxPaybackYears: iv(c.maxPaybackYears),
    minimumYieldOnCost: iv(c.minimumYieldOnCost),
    riskTolerance: c.riskTolerance,
    objective: "maximize_incremental_noi",
  };
}

export function buildRequest(
  model: EditorModel,
  propertyId: string,
  inputRevision: number,
): ComparisonRequestDTO {
  return {
    contractVersion: "1",
    propertyId,
    inputRevision,
    scenarios: model.scenarios.map((s) => toScenarioInput(s, propertyId, model.year)),
    constraints: toConstraintsInput(model.constraints),
  };
}

// ---- validation ------------------------------------------------------------

const DECIMAL = /^-?(?:0|[1-9]\d{0,11})(?:\.\d{1,8})?$/;
export const DECIMAL_HELP =
  "Enter a plain number: digits with an optional decimal point (no commas, symbols or exponent), up to 12 whole digits and 8 decimals.";

export type DecimalKind = "amount" | "positive" | "ratio";

/** Returns an error message, or null when empty (unknown) or valid. */
export function validateDecimal(text: string, kind: DecimalKind): string | null {
  const t = text.trim();
  if (t === "") return null;
  if (!DECIMAL.test(t)) return DECIMAL_HELP;
  const schema = kind === "amount" ? Amount : kind === "positive" ? Positive : Ratio;
  const r = schema.safeParse(t);
  return r.success ? null : (r.error.issues[0]?.message ?? "Invalid value");
}

export interface Validation {
  /** Keyed `${scenarioId}:${field}` or `constraints:${field}`. */
  fieldErrors: Record<string, string>;
  formErrors: string[];
  /** Present only when every field and the full contract validate. */
  request: ComparisonRequestDTO | null;
}

const SCALAR_KINDS: [keyof ScenarioForm, DecimalKind][] = [
  ["rentableAreaSqft", "positive"],
  ["annualRentPerSqft", "amount"],
  ["occupancyRatio", "ratio"],
  ["collectionLossRatio", "ratio"],
  ["annualConcessions", "amount"],
  ["totalProjectCost", "positive"],
];

export function validateModel(
  model: EditorModel,
  propertyId: string,
  inputRevision: number,
): Validation {
  const fieldErrors: Record<string, string> = {};
  const formErrors: string[] = [];
  const set = (key: string, msg: string | null) => {
    if (msg && !(key in fieldErrors)) fieldErrors[key] = msg;
  };
  for (const s of model.scenarios) {
    const k = (f: string) => `${s.id}:${f}`;
    if (!s.name.trim()) set(k("name"), "Enter a name.");
    if (!s.proposedUse.trim()) set(k("proposedUse"), "Enter the proposed use.");
    for (const [f, kind] of SCALAR_KINDS)
      set(k(f), validateDecimal((s[f] as FieldDraft).text, kind));
    if (s.otherIncomeMode === "entered") {
      set(k("otherPotentialAnnualIncome"), validateDecimal(s.otherPotentialAnnualIncome.text, "amount"));
      set(k("otherEffectiveAnnualIncome"), validateDecimal(s.otherEffectiveAnnualIncome.text, "amount"));
    }
    if (s.expenseMode === "total") {
      set(k("expenseTotal"), validateDecimal(s.expenseTotal.text, "amount"));
      if (s.expenseTotal.text.trim() !== "" && !s.expenseTotalNote.trim())
        set(k("expenseTotalNote"), "Describe which owner-paid costs this total includes.");
    } else
      for (const c of EXPENSE_CATEGORIES)
        set(k(`expenseItems.${c}`), validateDecimal(s.expenseItems[c].text, "amount"));
    if (s.role === "alternative")
      for (const c of CAPEX_FIELDS) set(k(`capex.${c}`), validateDecimal(s.capex[c].text, "amount"));
  }
  const c = model.constraints;
  set("constraints:maxInitialInvestment", validateDecimal(c.maxInitialInvestment.text, "amount"));
  set("constraints:maxPaybackYears", validateDecimal(c.maxPaybackYears.text, "positive"));
  set("constraints:minimumYieldOnCost", validateDecimal(c.minimumYieldOnCost.text, "ratio"));

  if (Object.keys(fieldErrors).length > 0)
    return { fieldErrors, formErrors, request: null };

  const request = buildRequest(model, propertyId, inputRevision);
  const parsed = ComparisonRequest.safeParse(request);
  if (parsed.success) return { fieldErrors, formErrors, request };
  for (const issue of parsed.error.issues) {
    const path = issue.path;
    if (path[0] === "scenarios" && typeof path[1] === "number") {
      const s = model.scenarios[path[1]];
      const head = String(path[2] ?? "");
      const key =
        head === "capex" && path[3]
          ? `capex.${String(path[3])}`
          : head === "operatingExpenses" && path[3] === "annualAmount"
            ? "expenseTotal"
            : head;
      if (s && key && key !== "operatingExpenses") {
        set(`${s.id}:${key}`, issue.message);
        continue;
      }
      formErrors.push(`${s?.name ?? "Scenario"}: ${issue.message}`);
    } else if (path[0] === "constraints" && path[1]) {
      set(`constraints:${String(path[1])}`, issue.message);
    } else formErrors.push(issue.message);
  }
  return { fieldErrors, formErrors, request: null };
}

export function problemCount(v: Validation, scenarioId: string): number {
  return Object.keys(v.fieldErrors).filter((k) => k.startsWith(`${scenarioId}:`)).length;
}
