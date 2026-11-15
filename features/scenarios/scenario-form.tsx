import type { ReactNode } from "react";
import type { Needs } from "./readiness";
import { SelectField, TextAreaField, TextField } from "@/components/kestrel/field";
import {
  formatByUnit,
  type Origin,
} from "@/features/dashboard/format";
import {
  CAPEX_FIELDS,
  CAPEX_LABEL,
  CATEGORY_LABEL,
  EXPENSE_CATEGORIES,
  validateDecimal,
  type DecimalKind,
  type FieldDraft,
  type OtherIncomeMode,
  type Proposal,
  type ProposalField,
  type ScenarioForm,
  type Validation,
} from "./model";

const ORIGIN_NOTE: Record<Origin, string> = {
  source_data: "source data",
  user_input: "your input",
  derived_calculation: "calculated",
  explicit_estimate: "estimate",
  unknown: "unknown",
};

function originOf(f: FieldDraft): Origin {
  return f.text.trim() === "" ? "unknown" : f.accepted ? "explicit_estimate" : "user_input";
}

/** Display-only echo of a valid entry in its unit; the typed string is what is sent. */
function echo(f: FieldDraft, unit: string, kind: DecimalKind): string | undefined {
  const t = f.text.trim();
  if (t === "" || validateDecimal(t, kind) !== null) return undefined;
  return `= ${formatByUnit(t, unit)}`;
}

function Group({ title, children, note }: { title: string; children: ReactNode; note?: ReactNode }) {
  return (
    <fieldset className="min-w-0 rounded-lg border border-slate-200 p-4">
      <legend className="px-1 text-sm font-semibold text-slate-900">{title}</legend>
      {note ? <p className="mb-3 text-xs text-slate-600">{note}</p> : null}
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}

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
  const setField = (key: keyof ScenarioForm, text: string) =>
    onPatch({ [key]: { text, accepted: false } } as Partial<ScenarioForm>);
  const useProposal = (key: ProposalField): { label: string; onUse: () => void } | undefined => {
    const p = proposals[key];
    if (!p) return undefined;
    const unit =
      key === "rentableAreaSqft" ? "sqft" : key === "occupancyRatio" ? "ratio" : "USD/sqft/year";
    return {
      label: `Use property value ${formatByUnit(p.value, unit)} (${ORIGIN_NOTE[p.origin]})`,
      onUse: () =>
        onPatch({
          [key]: { text: p.value, accepted: p.origin === "explicit_estimate" },
        } as Partial<ScenarioForm>),
    };
  };
  const baseline = s.role === "baseline";

  return (
    <div className="space-y-4">
      <Group title="Scenario">
        <TextField
          label="Name"
          required
          inputMode="text"
          value={s.name}
          onChange={(v) => onPatch({ name: v })}
          error={err("name")}
        />
        <TextField
          label="Proposed use"
          required
          inputMode="text"
          value={s.proposedUse}
          onChange={(v) => onPatch({ proposedUse: v })}
          error={err("proposedUse")}
          hint={baseline ? "The current use of the building." : "A use that excludes the others (alternatives are mutually exclusive)."}
        />
        <SelectField
          label="Lease basis"
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
      </Group>

      <Group
        title="Income"
        note={`Stabilized annual USD for ${year}-01-01 to ${year + 1}-01-01 (end exclusive). Leave a field empty if unknown — it is never treated as zero.`}
      >
        <TextField
          label="Rentable area"
          unit="sq ft"
          value={s.rentableAreaSqft.text}
          onChange={(v) => setField("rentableAreaSqft", v)}
          origin={originOf(s.rentableAreaSqft)}
          error={err("rentableAreaSqft")}
          needed={need("rentableAreaSqft")}
          hint={echo(s.rentableAreaSqft, "sqft", "positive")}
          proposal={useProposal("rentableAreaSqft")}
        />
        <TextField
          label="Annual rent"
          unit="USD per sq ft per year"
          value={s.annualRentPerSqft.text}
          onChange={(v) => setField("annualRentPerSqft", v)}
          origin={originOf(s.annualRentPerSqft)}
          error={err("annualRentPerSqft")}
          needed={need("annualRentPerSqft")}
          hint={echo(s.annualRentPerSqft, "USD/sqft/year", "amount")}
          proposal={useProposal("annualRentPerSqft")}
        />
        <TextField
          label="Occupancy"
          unit="ratio 0–1"
          value={s.occupancyRatio.text}
          onChange={(v) => setField("occupancyRatio", v)}
          origin={originOf(s.occupancyRatio)}
          error={err("occupancyRatio")}
          needed={need("occupancyRatio")}
          hint={echo(s.occupancyRatio, "ratio", "ratio") ?? "Enter 0.9 for 90%."}
          proposal={useProposal("occupancyRatio")}
        />
        <TextField
          label="Collection loss"
          unit="ratio 0–1"
          value={s.collectionLossRatio.text}
          onChange={(v) => setField("collectionLossRatio", v)}
          origin={originOf(s.collectionLossRatio)}
          error={err("collectionLossRatio")}
          needed={need("collectionLossRatio")}
          hint={echo(s.collectionLossRatio, "ratio", "ratio")}
        />
        <TextField
          label="Concessions"
          unit="USD per year"
          value={s.annualConcessions.text}
          onChange={(v) => setField("annualConcessions", v)}
          origin={originOf(s.annualConcessions)}
          error={err("annualConcessions")}
          needed={need("annualConcessions")}
          hint={echo(s.annualConcessions, "USD/year", "amount")}
        />
        <div className="sm:col-span-2">
          <p id={`${s.id}-other-income`} className="text-sm font-medium text-slate-800">
            Other income
          </p>
          <div role="radiogroup" aria-labelledby={`${s.id}-other-income`} className="mt-1 flex flex-wrap gap-x-5 gap-y-1">
            {(
              [
                ["unknown", "Not yet known"],
                ["none_modeled", "No other income modeled"],
                ["entered", "Enter amounts"],
              ] as [OtherIncomeMode, string][]
            ).map(([mode, label]) => (
              <label key={mode} className="flex items-center gap-2 text-sm text-slate-800">
                <input
                  type="radio"
                  name={`${s.id}-other-income`}
                  checked={s.otherIncomeMode === mode}
                  onChange={() => onPatch({ otherIncomeMode: mode })}
                  className="size-4 accent-sky-700"
                />
                {label}
              </label>
            ))}
          </div>
          <p className="mt-1 text-xs text-slate-600">
            {s.otherIncomeMode === "none_modeled"
              ? "Sends an explicit zero that you chose; it is recorded as your input."
              : s.otherIncomeMode === "unknown"
                ? need("otherIncome") ?? "Left unknown: results that depend on it will be unavailable."
                : null}
          </p>
          {s.otherIncomeMode === "entered" ? (
            <div className="mt-2 grid gap-4 sm:grid-cols-2">
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
      </Group>

      <Group
        title="Operating expenses"
        note="Owner-paid, excluding financing, depreciation and capital expenditure. Use either one total or the six categories, never both."
      >
        <div className="sm:col-span-2">
          <div role="radiogroup" aria-label="Expense entry mode" className="flex flex-wrap gap-x-5 gap-y-1">
            {(
              [
                ["total", "One annual total"],
                ["itemized", "Itemize six categories"],
              ] as const
            ).map(([mode, label]) => (
              <label key={mode} className="flex items-center gap-2 text-sm text-slate-800">
                <input
                  type="radio"
                  name={`${s.id}-expense-mode`}
                  checked={s.expenseMode === mode}
                  onChange={() => onPatch({ expenseMode: mode })}
                  className="size-4 accent-sky-700"
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
              onChange={(v) =>
                onPatch({ expenseItems: { ...s.expenseItems, [c]: { text: v, accepted: false } } })
              }
              origin={originOf(s.expenseItems[c])}
              error={err(`expenseItems.${c}`)}
              needed={need(`expenseItems.${c}`)}
              hint={echo(s.expenseItems[c], "USD/year", "amount")}
            />
          ))
        )}
      </Group>

      <Group
        title="Capital"
        note={
          baseline
            ? "The baseline needs no conversion investment; the contract fixes it at $0."
            : "Enter all five upfront cost categories, including an explicit 0 for excluded work. Their sum is initial investment. Total project cost below does not fill these fields."
        }
      >
        {baseline
          ? null
          : CAPEX_FIELDS.map((c) => (
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
            ))}
        <TextField
          label="Total project cost (optional)"
          unit="USD"
          value={s.totalProjectCost.text}
          onChange={(v) => setField("totalProjectCost", v)}
          origin={originOf(s.totalProjectCost)}
          error={err("totalProjectCost")}
          needed={need("totalProjectCost")}
          hint="Optional denominator for yield on cost, not upfront capex. Must include the initial investment above and a disclosed basis below."
        />
        <TextAreaField
          label="Total project cost basis"
          rows={2}
          value={s.totalProjectCostNote ?? ""}
          onChange={(value) => onPatch({ totalProjectCostNote: value })}
          needed={need("totalProjectCostNote")}
          hint="Needed only when calculating yield on cost. State the existing-property or acquisition basis, included upfront costs, and exclusions. Do not describe an assumed basis as a valuation."
        />
      </Group>

      <TextAreaField
        label="Assumptions (one per line)"
        rows={3}
        value={s.assumptions}
        onChange={(v) => onPatch({ assumptions: v })}
      />

      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-800 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-sky-600"
        >
          Remove this alternative
        </button>
      ) : null}
    </div>
  );
}
