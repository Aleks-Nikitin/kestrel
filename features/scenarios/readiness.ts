import {
  CAPEX_FIELDS,
  CAPEX_LABEL,
  EXPENSE_CATEGORIES,
  type ConstraintsForm,
  type EditorModel,
  type ScenarioForm,
} from "./model";

/**
 * Which inputs the deterministic engine needs before it can give an
 * evidence-backed recommendation. These mirror rules that already exist on the
 * server (lib/finance/calculate.ts, lib/feasibility/compare.ts); the browser
 * never invents a rule or fills a value. The server remains the authority.
 *
 * Keys match the field names used by validation (`${scenarioId}:${key}`).
 */
export type Needs = Record<string, string>;

const blank = (t: string) => t.trim() === "";
const UNKNOWN = "Unknown stays unknown, so results that depend on it will be unavailable.";

export function scenarioNeeds(s: ScenarioForm, constraints: ConstraintsForm): Needs {
  const out: Needs = {};
  const need = (key: string, why: string) => {
    out[key] = why;
  };
  if (s.leaseBasis !== "gross" && s.leaseBasis !== "modified_gross")
    need(
      "leaseBasis",
      "Choose Gross or Modified gross. Triple net and Unknown are not supported, so income, NOI and the recommendation stay unavailable.",
    );
  if (blank(s.rentNormalizationNote))
    need(
      "rentNormalizationNote",
      "Describe how rent and owner-paid expenses were normalized to an annual gross basis. Without this note income is unavailable.",
    );
  const scalar: [keyof ScenarioForm, string][] = [
    ["rentableAreaSqft", "Enter the rentable area you are modeling."],
    ["annualRentPerSqft", "Enter the annual rent per sq ft you are modeling."],
    ["occupancyRatio", "Enter occupancy as a ratio, e.g. 0.9."],
    ["collectionLossRatio", "Enter collection loss as a ratio; enter 0 only if you mean zero."],
    ["annualConcessions", "Enter annual concessions; enter 0 only if you mean zero."],
  ];
  for (const [key, why] of scalar)
    if (blank((s[key] as { text: string }).text)) need(key, `${why} ${UNKNOWN}`);
  if (s.otherIncomeMode === "unknown")
    need("otherIncome", `Choose "No other income modeled" or enter amounts. ${UNKNOWN}`);
  if (s.expenseMode === "total") {
    if (blank(s.expenseTotal.text)) need("expenseTotal", `Enter total owner-paid operating expenses. ${UNKNOWN}`);
    else if (blank(s.expenseTotalNote)) need("expenseTotalNote", "Say which owner-paid costs the total includes.");
  } else
    for (const c of EXPENSE_CATEGORIES)
      if (blank(s.expenseItems[c].text)) need(`expenseItems.${c}`, `Enter this category, or switch to one total. ${UNKNOWN}`);
  if (s.role === "alternative")
    for (const c of CAPEX_FIELDS)
      if (blank(s.capex[c].text))
        need(
          `capex.${c}`,
          `Enter ${CAPEX_LABEL[c].toLowerCase()} cost; enter 0 only if none. Initial investment, payback and incremental NOI need every capital line.`,
        );
  if (!blank(constraints.minimumYieldOnCost.text) && blank(s.totalProjectCost.text))
    need("totalProjectCost", "The minimum yield on cost constraint needs a total project cost that includes the investment.");
  return out;
}

/** The server requires at least one capital or return constraint to prefer an alternative. */
export function constraintsNeed(c: ConstraintsForm): string | null {
  return blank(c.maxInitialInvestment.text) && blank(c.maxPaybackYears.text) && blank(c.minimumYieldOnCost.text)
    ? "Enter at least one of: maximum initial investment, maximum payback, or minimum yield on cost. Without one the comparison cannot prefer an alternative."
    : null;
}

export interface Readiness {
  byScenario: Record<string, Needs>;
  constraints: string | null;
  total: number;
}

export function readiness(model: EditorModel): Readiness {
  const byScenario: Record<string, Needs> = {};
  let total = 0;
  for (const s of model.scenarios) {
    const n = scenarioNeeds(s, model.constraints);
    byScenario[s.id] = n;
    total += Object.keys(n).length;
  }
  const constraints = constraintsNeed(model.constraints);
  return { byScenario, constraints, total: total + (constraints ? 1 : 0) };
}

/** Server missing-input entries look like `scenario-id.path: reason`; make them readable. */
export function describeMissing(entry: string, nameOf: (id: string) => string): string {
  const m = /^([^.:\s]+)\.([^:]+):\s*(.*)$/.exec(entry);
  if (!m) return entry.replace(/^constraints:\s*/, "Constraints: ");
  const [, id, path, reason] = m;
  const label = PATH_LABEL[path] ?? path;
  return `${nameOf(id)} — ${label}: ${reason}`;
}

const PATH_LABEL: Record<string, string> = {
  leaseBasis: "lease basis and rent normalization note",
  rentableAreaSqft: "rentable area",
  noi: "net operating income",
  initialInvestment: "initial investment (all capital lines)",
  incrementalNoi: "incremental NOI",
  paybackYears: "payback",
  yieldOnCost: "yield on cost (needs total project cost and its basis)",
  legalFeasibility: "legal feasibility",
};
