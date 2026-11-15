import type { ReactNode } from "react";
import type { Needs } from "./readiness";
import { SelectField, TextAreaField, TextField } from "@/components/kestrel/field";
import { formatByUnit, type Origin } from "@/features/dashboard/format";
import { percentText, percentToRatio } from "./percent";
import {
  CAPEX_LABEL,
  CATEGORY_LABEL,
  EXPENSE_CATEGORIES,
  validateDecimal,
  type CapexField,
  type DecimalKind,
  type FieldDraft,
  type OtherIncomeMode,
  type Proposal,
  type ProposalField,
  type ScenarioForm,
  type Validation,
} from "./model";

export const ORIGIN_NOTE: Record<Origin, string> = {
  source_data: "source data",
  user_input: "your input",
  derived_calculation: "calculated",
  explicit_estimate: "estimate",
  unknown: "unknown",
};

export function originOf(f: FieldDraft): Origin {
  return f.text.trim() === "" ? "unknown" : f.accepted ? "explicit_estimate" : "user_input";
}

/** Display-only echo of a valid entry in its unit; the typed string is what is sent. */
export function echo(f: FieldDraft, unit: string, kind: DecimalKind): string | undefined {
  const t = f.text.trim();
  if (t === "" || validateDecimal(t, kind) !== null) return undefined;
  return `= ${formatByUnit(t, unit)}`;
}

/** The "use the property's value" action for a field, when the record has one. Never applied silently. */
export function proposalFor(
  key: ProposalField,
  proposals: Partial<Record<ProposalField, Proposal>>,
  onPatch: (patch: Partial<ScenarioForm>) => void,
): { label: string; onUse: () => void } | undefined {
  const p = proposals[key];
  if (!p) return undefined;
  const unit = key === "rentableAreaSqft" ? "sqft" : key === "occupancyRatio" ? "ratio" : "USD/sqft/year";
  return {
    label: `Use property value ${formatByUnit(p.value, unit)} (${ORIGIN_NOTE[p.origin]})`,
    onUse: () => onPatch({ [key]: { text: p.value, accepted: p.origin === "explicit_estimate" } } as Partial<ScenarioForm>),
  };
}

/** A collapsible group of inputs with a one-line summary of how much of it is set. */
function Section({
  title,
  set,
  of,
  open: openNeeds,
  note,
  children,
}: {
  title: string;
  /** How many of this section's inputs have a value. */
  set: number;
  of: number;
  /** Inputs here the engine still needs. */
  open: number;
  note?: ReactNode;
  children: ReactNode;
}) {
  return (
    <details open className="group rounded-xl border border-ink-200 bg-white" data-section={title}>
      <summary className="flex cursor-pointer select-none items-center justify-between gap-3 rounded-xl px-4 py-3.5 hover:bg-ink-50 sm:px-5">
        <span className="text-base font-semibold text-ink-950">{title}</span>
        <span className="flex items-center gap-3 text-xs text-ink-500">
          <span className="figure">
            {set} of {of} set{openNeeds > 0 ? `, ${openNeeds} open` : ""}
          </span>
          <span aria-hidden className="mr-1 size-2 shrink-0 rotate-45 border-b-[1.5px] border-r-[1.5px] border-ink-500 transition-transform group-open:-rotate-135" />
        </span>
      </summary>
      <div className="border-t border-ink-200 px-4 py-4 sm:px-5">
        {note ? <p className="mb-4 max-w-prose text-[13px] leading-5 text-ink-600">{note}</p> : null}
        <div className="grid gap-x-5 gap-y-4 sm:grid-cols-2">{children}</div>
      </div>
    </details>
  );
}

const filled = (...texts: string[]) => texts.filter((t) => t.trim() !== "").length;

/**
 * Advanced Underwriting: every input the financial model takes, for one
 * scenario, grouped the way an underwriter works through a deal. It edits the
 * same drafts Quick Analysis does and calculates nothing.
 */
export function ScenarioFormView({
  scenario: s,
  validation,
  needs,
  proposals,
  onPatch,
  onRemove,
  year,
}: {
  scenario: ScenarioForm;
  validation: Validation;
  needs?: Needs;
  proposals: Partial<Record<ProposalField, Proposal>>;
  onPatch: (patch: Partial<ScenarioForm>) => void;
  onRemove?: () => void;
  year: number;
}) {
  const need = (f: string) => needs?.[f] ?? null;
  const err = (f: string) => validation.fieldErrors[`${s.id}:${f}`] ?? null;
  const open = (...keys: string[]) => keys.filter((k) => needs?.[k]).length;
  const setField = (key: keyof ScenarioForm, text: string) =>
    onPatch({ [key]: { text, accepted: false } } as Partial<ScenarioForm>);
  const baseline = s.role === "baseline";
  const capex = (c: CapexField) => (
    <TextField
      key={c}
      label={CAPEX_LABEL[c]}
      unit="USD"
      value={s.capex[c].text}
      onChange={(v) => onPatch({ capex: { ...s.capex, [c]: { text: v, accepted: false } } })}
      origin={originOf(s.capex[c])}
      error={err(`capex.${c}`)}
      needed={need(`capex.${c}`)}
      hint={echo(s.capex[c], "USD", "amount")}
    />
  );
  const expenseSet =
    s.expenseMode === "total"
      ? filled(s.expenseTotal.text, s.expenseTotalNote)
      : filled(...EXPENSE_CATEGORIES.map((c) => s.expenseItems[c].text));

  return (
    <div className="space-y-3">
      <Section
        title="Lease economics"
        set={filled(s.name, s.proposedUse, s.leaseBasis === "unknown" ? "" : s.leaseBasis, s.rentNormalizationNote, s.rentableAreaSqft.text, s.annualRentPerSqft.text)}
        of={6}
        open={open("leaseBasis", "rentNormalizationNote", "rentableAreaSqft", "annualRentPerSqft")}
        note={`Stabilized annual USD for ${year}-01-01 to ${year + 1}-01-01 (end exclusive). Leave a field empty if unknown — it is never treated as zero.`}
      >
        <TextField label="Name" required inputMode="text" value={s.name} onChange={(v) => onPatch({ name: v })} error={err("name")} />
        <TextField
          label="Proposed use"
          required
          inputMode="text"
          value={s.proposedUse}
          onChange={(v) => onPatch({ proposedUse: v })}
          error={err("proposedUse")}
          hint={baseline ? "The current use of the building." : "A use that excludes the others (alternatives are mutually exclusive)."}
        />
        <TextField
          label="Rentable area"
          unit="sq ft"
          value={s.rentableAreaSqft.text}
          onChange={(v) => setField("rentableAreaSqft", v)}
          origin={originOf(s.rentableAreaSqft)}
          error={err("rentableAreaSqft")}
          needed={need("rentableAreaSqft")}
          hint={echo(s.rentableAreaSqft, "sqft", "positive")}
          proposal={proposalFor("rentableAreaSqft", proposals, onPatch)}
        />
        <TextField
          label="Annual rent"
          unit="USD per sq ft per year"
          term="rent"
          value={s.annualRentPerSqft.text}
          onChange={(v) => setField("annualRentPerSqft", v)}
          origin={originOf(s.annualRentPerSqft)}
          error={err("annualRentPerSqft")}
          needed={need("annualRentPerSqft")}
          hint={echo(s.annualRentPerSqft, "USD/sqft/year", "amount")}
          proposal={proposalFor("annualRentPerSqft", proposals, onPatch)}
        />
        <SelectField
          label="Lease basis"
          term="leaseBasis"
          value={s.leaseBasis}
          onChange={(v) => onPatch({ leaseBasis: v })}
          options={[
            { value: "unknown", label: "Unknown" },
            { value: "gross", label: "Gross" },
            { value: "modified_gross", label: "Modified gross" },
            { value: "nnn", label: "Triple net (NNN)" },
          ]}
          needed={need("leaseBasis")}
          hint="Only Gross and Modified gross are supported; NNN or Unknown leave results unavailable."
        />
        <TextAreaField
          label="Rent normalization note"
          rows={2}
          value={s.rentNormalizationNote}
          onChange={(v) => onPatch({ rentNormalizationNote: v })}
          needed={need("rentNormalizationNote")}
          hint="Required for financial calculation, including Gross: disclose annual USD rent per rentable sq ft and which expenses the owner pays."
        />
      </Section>

      <Section
        title="Occupancy and collections"
        set={filled(s.occupancyRatio.text, s.collectionLossRatio.text, s.annualConcessions.text, s.otherIncomeMode === "unknown" ? "" : "x")}
        of={4}
        open={open("occupancyRatio", "collectionLossRatio", "annualConcessions", "otherIncome")}
      >
        <TextField
          label="Occupancy"
          unit="% of rentable area"
          term="occupancy"
          value={percentText(s.occupancyRatio.text)}
          onChange={(v) => setField("occupancyRatio", percentToRatio(v))}
          origin={originOf(s.occupancyRatio)}
          error={err("occupancyRatio")}
          needed={need("occupancyRatio")}
          proposal={proposalFor("occupancyRatio", proposals, onPatch)}
        />
        <TextField
          label="Collection loss"
          unit="% of billed rent"
          term="collectionLoss"
          value={percentText(s.collectionLossRatio.text)}
          onChange={(v) => setField("collectionLossRatio", percentToRatio(v))}
          origin={originOf(s.collectionLossRatio)}
          error={err("collectionLossRatio")}
          needed={need("collectionLossRatio")}
        />
        <TextField
          label="Concessions"
          unit="USD per year"
          term="concessions"
          value={s.annualConcessions.text}
          onChange={(v) => setField("annualConcessions", v)}
          origin={originOf(s.annualConcessions)}
          error={err("annualConcessions")}
          needed={need("annualConcessions")}
          hint={echo(s.annualConcessions, "USD/year", "amount")}
        />
        <div className="sm:col-span-2">
          <p id={`${s.id}-other-income`} className="text-sm font-medium text-ink-900">
            Other income
          </p>
          <div role="radiogroup" aria-labelledby={`${s.id}-other-income`} className="mt-1.5 flex flex-wrap gap-x-5 gap-y-1.5">
            {(
              [
                ["unknown", "Not yet known"],
                ["none_modeled", "No other income modeled"],
                ["entered", "Enter amounts"],
              ] as [OtherIncomeMode, string][]
            ).map(([mode, label]) => (
              <label key={mode} className="flex cursor-pointer items-center gap-2 text-sm text-ink-800">
                <input
                  type="radio"
                  name={`${s.id}-other-income`}
                  checked={s.otherIncomeMode === mode}
                  onChange={() => onPatch({ otherIncomeMode: mode })}
                  className="size-4 accent-rufous-600"
                />
                {label}
              </label>
            ))}
          </div>
          <p className="mt-1 text-xs leading-5 text-ink-600">
            {s.otherIncomeMode === "none_modeled"
              ? "Sends an explicit zero that you chose; it is recorded as your input."
              : s.otherIncomeMode === "unknown"
                ? need("otherIncome") ?? "Left unknown: results that depend on it will be unavailable."
                : null}
          </p>
          {s.otherIncomeMode === "entered" ? (
            <div className="mt-3 grid gap-x-5 gap-y-4 sm:grid-cols-2">
              <TextField
                label="Other potential income"
                unit="USD per year"
                value={s.otherPotentialAnnualIncome.text}
                onChange={(v) => setField("otherPotentialAnnualIncome", v)}
                origin={originOf(s.otherPotentialAnnualIncome)}
                error={err("otherPotentialAnnualIncome")}
              />
              <TextField
                label="Other effective income"
                unit="USD per year"
                value={s.otherEffectiveAnnualIncome.text}
                onChange={(v) => setField("otherEffectiveAnnualIncome", v)}
                origin={originOf(s.otherEffectiveAnnualIncome)}
                error={err("otherEffectiveAnnualIncome")}
                hint="Cannot exceed potential income."
              />
            </div>
          ) : null}
        </div>
      </Section>

      <Section
        title="Operating expenses"
        set={expenseSet}
        of={s.expenseMode === "total" ? 2 : 6}
        open={open("expenseTotal", "expenseTotalNote", ...EXPENSE_CATEGORIES.map((c) => `expenseItems.${c}`))}
        note="Owner-paid, excluding financing, depreciation and capital expenditure. Use either one total or the six categories, never both."
      >
        <div className="sm:col-span-2">
          <div role="radiogroup" aria-label="Expense entry mode" className="flex flex-wrap gap-x-5 gap-y-1.5">
            {(
              [
                ["total", "One annual total"],
                ["itemized", "Itemize six categories"],
              ] as const
            ).map(([mode, label]) => (
              <label key={mode} className="flex cursor-pointer items-center gap-2 text-sm text-ink-800">
                <input
                  type="radio"
                  name={`${s.id}-expense-mode`}
                  checked={s.expenseMode === mode}
                  onChange={() => onPatch({ expenseMode: mode })}
                  className="size-4 accent-rufous-600"
                />
                {label}
              </label>
            ))}
          </div>
        </div>
        {s.expenseMode === "total" ? (
          <>
            <TextField
              label="Total operating expenses"
              unit="USD per year"
              term="operatingExpenses"
              value={s.expenseTotal.text}
              onChange={(v) => setField("expenseTotal", v)}
              origin={originOf(s.expenseTotal)}
              error={err("expenseTotal")}
              needed={need("expenseTotal")}
              hint={echo(s.expenseTotal, "USD/year", "amount")}
            />
            <TextAreaField
              label="Costs included in the total"
              rows={2}
              value={s.expenseTotalNote}
              onChange={(v) => onPatch({ expenseTotalNote: v })}
              error={err("expenseTotalNote")}
              needed={need("expenseTotalNote")}
              hint="Required when a total is entered."
            />
          </>
        ) : (
          EXPENSE_CATEGORIES.map((c) => (
            <TextField
              key={c}
              label={CATEGORY_LABEL[c]}
              unit="USD per year"
              value={s.expenseItems[c].text}
              onChange={(v) => onPatch({ expenseItems: { ...s.expenseItems, [c]: { text: v, accepted: false } } })}
              origin={originOf(s.expenseItems[c])}
              error={err(`expenseItems.${c}`)}
              needed={need(`expenseItems.${c}`)}
              hint={echo(s.expenseItems[c], "USD/year", "amount")}
            />
          ))
        )}
      </Section>

      <Section
        title="Capital expenditure and conversion"
        set={baseline ? 0 : filled(s.capex.renovation.text, s.capex.conversion.text, s.capex.other.text)}
        of={baseline ? 0 : 3}
        open={open("capex.renovation", "capex.conversion", "capex.other")}
        note={
          baseline
            ? "The baseline needs no conversion investment; the contract fixes it at $0."
            : "Enter every upfront cost category, including an explicit 0 for excluded work. Together with soft costs and contingency below, their sum is the initial investment."
        }
      >
        {baseline ? null : (["renovation", "conversion", "other"] as CapexField[]).map(capex)}
      </Section>

      <Section
        title="Soft costs and contingency"
        set={(baseline ? 0 : filled(s.capex.softCosts.text, s.capex.contingency.text)) + filled(s.totalProjectCost.text, s.totalProjectCostNote ?? "")}
        of={baseline ? 2 : 4}
        open={open("capex.softCosts", "capex.contingency", "totalProjectCost", "totalProjectCostNote")}
        note="Total project cost is an optional denominator for yield on cost, not upfront capex, and does not fill the lines above."
      >
        {baseline ? null : (["softCosts", "contingency"] as CapexField[]).map(capex)}
        <TextField
          label="Total project cost (optional)"
          unit="USD"
          term="totalProjectCost"
          value={s.totalProjectCost.text}
          onChange={(v) => setField("totalProjectCost", v)}
          origin={originOf(s.totalProjectCost)}
          error={err("totalProjectCost")}
          needed={need("totalProjectCost")}
          hint="Must include the initial investment and a disclosed basis."
        />
        <TextAreaField
          label="Total project cost basis"
          rows={2}
          value={s.totalProjectCostNote ?? ""}
          onChange={(value) => onPatch({ totalProjectCostNote: value })}
          needed={need("totalProjectCostNote")}
          hint="Needed only when calculating yield on cost. State the existing-property or acquisition basis, included upfront costs, and exclusions. Do not describe an assumed basis as a valuation."
        />
      </Section>

      <Section title="Additional assumptions" set={filled(s.assumptions)} of={1} open={0}>
        <TextAreaField
          className="sm:col-span-2"
          label="Assumptions (one per line)"
          rows={4}
          value={s.assumptions}
          onChange={(v) => onPatch({ assumptions: v })}
        />
      </Section>

      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          className="cursor-pointer rounded-md border border-ink-300 bg-white px-3 py-2 text-sm font-medium text-ink-800 hover:border-brick-600 hover:text-brick-700"
        >
          Remove this alternative
        </button>
      ) : null}
    </div>
  );
}
