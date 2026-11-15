import type { ReactNode } from "react";
import { TextField } from "@/components/kestrel/field";
import { OriginBadge } from "@/components/kestrel/badges";
import { formatByUnit } from "@/features/dashboard/format";
import { percentText, percentToRatio } from "./percent";
import { echo, originOf, proposalFor } from "./scenario-form";
import type { Needs } from "./readiness";
import {
  CAPEX_FIELDS,
  CAPEX_LABEL,
  CATEGORY_LABEL,
  EXPENSE_CATEGORIES,
  validateDecimal,
  type DecimalKind,
  type FieldDraft,
  type Proposal,
  type ProposalField,
  type ScenarioForm,
  type Validation,
} from "./model";

const LEASE_LABEL: Record<ScenarioForm["leaseBasis"], string> = {
  unknown: "Unknown",
  gross: "Gross",
  modified_gross: "Modified gross",
  nnn: "Triple net (NNN)",
};

/** A draft shown read-only: formatted when it is a valid number, as typed otherwise, "Not set" when empty. */
function shown(f: FieldDraft, unit: string, kind: DecimalKind): string | null {
  const t = f.text.trim();
  if (t === "") return null;
  return validateDecimal(t, kind) === null ? formatByUnit(t, unit) : t;
}

function LedgerRow({ label, value, draft }: { label: string; value: string | null; draft?: FieldDraft }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4 border-t border-ink-100 py-1.5 first:border-t-0 sm:grid-cols-[minmax(0,11rem)_minmax(0,1fr)_auto]">
      <dt className="text-[13px] text-ink-600 max-sm:col-span-2">{label}</dt>
      <dd className={value === null ? "text-[13px] text-ink-400" : "figure min-w-0 text-[13px] font-medium text-ink-950 [overflow-wrap:anywhere]"}>
        {value ?? "Not set"}
      </dd>
      <span className="justify-self-end">{draft && value !== null ? <OriginBadge origin={originOf(draft)} /> : null}</span>
    </div>
  );
}

function LedgerGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <h4 className="type-label mb-1">{title}</h4>
      <dl>{children}</dl>
    </div>
  );
}

/**
 * Every value this scenario will send, read-only. Quick Analysis shows a
 * handful of inputs; this ledger is what keeps the rest in view, so no
 * assumption behind a result is ever hidden by the simpler mode.
 */
export function AssumptionLedger({ scenario: s, onEditAll }: { scenario: ScenarioForm; onEditAll: () => void }) {
  const baseline = s.role === "baseline";
  return (
    <details className="group rounded-xl border border-ink-200 bg-white" data-testid="assumption-ledger">
      <summary className="flex cursor-pointer select-none items-center justify-between gap-3 rounded-xl px-4 py-3.5 hover:bg-ink-50 sm:px-5">
        <span>
          <span className="block text-base font-semibold text-ink-950">Everything this scenario will send</span>
          <span className="block text-[13px] text-ink-600">All inputs behind the calculation, including the ones Quick Analysis does not show.</span>
        </span>
        <span aria-hidden className="mr-1 size-2 shrink-0 rotate-45 border-b-[1.5px] border-r-[1.5px] border-ink-500 transition-transform group-open:-rotate-135" />
      </summary>
      <div className="grid gap-x-10 gap-y-5 border-t border-ink-200 px-4 py-4 sm:px-5 lg:grid-cols-2">
        <LedgerGroup title="Lease economics">
          <LedgerRow label="Proposed use" value={s.proposedUse.trim() || null} />
          <LedgerRow label="Lease basis" value={s.leaseBasis === "unknown" ? null : LEASE_LABEL[s.leaseBasis]} />
          <LedgerRow label="Rentable area" value={shown(s.rentableAreaSqft, "sqft", "positive")} draft={s.rentableAreaSqft} />
          <LedgerRow label="Annual rent" value={shown(s.annualRentPerSqft, "USD/sqft/year", "amount")} draft={s.annualRentPerSqft} />
          <LedgerRow label="Rent normalization note" value={s.rentNormalizationNote.trim() || null} />
        </LedgerGroup>
        <LedgerGroup title="Occupancy and collections">
          <LedgerRow label="Occupancy" value={shown(s.occupancyRatio, "ratio", "ratio")} draft={s.occupancyRatio} />
          <LedgerRow label="Collection loss" value={shown(s.collectionLossRatio, "ratio", "ratio")} draft={s.collectionLossRatio} />
          <LedgerRow label="Concessions" value={shown(s.annualConcessions, "USD/year", "amount")} draft={s.annualConcessions} />
          {s.otherIncomeMode === "entered" ? (
            <>
              <LedgerRow label="Other potential income" value={shown(s.otherPotentialAnnualIncome, "USD/year", "amount")} draft={s.otherPotentialAnnualIncome} />
              <LedgerRow label="Other effective income" value={shown(s.otherEffectiveAnnualIncome, "USD/year", "amount")} draft={s.otherEffectiveAnnualIncome} />
            </>
          ) : (
            <LedgerRow label="Other income" value={s.otherIncomeMode === "none_modeled" ? "None modeled (your choice, sent as $0)" : null} />
          )}
        </LedgerGroup>
        <LedgerGroup title="Operating expenses">
          {s.expenseMode === "total" ? (
            <>
              <LedgerRow label="Total operating expenses" value={shown(s.expenseTotal, "USD/year", "amount")} draft={s.expenseTotal} />
              <LedgerRow label="Costs included" value={s.expenseTotalNote.trim() || null} />
            </>
          ) : (
            EXPENSE_CATEGORIES.map((c) => (
              <LedgerRow key={c} label={CATEGORY_LABEL[c]} value={shown(s.expenseItems[c], "USD/year", "amount")} draft={s.expenseItems[c]} />
            ))
          )}
        </LedgerGroup>
        <LedgerGroup title="Capital">
          {baseline ? (
            <LedgerRow label="Initial investment" value="$0 (fixed for the baseline)" />
          ) : (
            CAPEX_FIELDS.map((c) => (
              <LedgerRow key={c} label={CAPEX_LABEL[c]} value={shown(s.capex[c], "USD", "amount")} draft={s.capex[c]} />
            ))
          )}
          <LedgerRow label="Total project cost" value={shown(s.totalProjectCost, "USD", "positive")} draft={s.totalProjectCost} />
          <LedgerRow label="Cost basis" value={(s.totalProjectCostNote ?? "").trim() || null} />
        </LedgerGroup>
        {s.assumptions.trim() ? (
          <div className="lg:col-span-2">
            <h4 className="type-label mb-1">Stated assumptions</h4>
            <ul className="space-y-1 text-[13px] leading-5 text-ink-700">
              {s.assumptions.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          </div>
        ) : null}
        <div className="lg:col-span-2">
          <button type="button" onClick={onEditAll} className="cursor-pointer rounded-sm text-sm font-semibold text-rufous-700 underline underline-offset-4 hover:text-rufous-800">
            Edit every input in Advanced Underwriting
          </button>
        </div>
      </div>
    </details>
  );
}

/**
 * Quick Analysis: the few inputs that move the result most, in plain units.
 * It writes to the same drafts as Advanced Underwriting; nothing is defaulted,
 * and anything it does not show stays exactly as it is.
 */
export function QuickFormView({
  scenario: s,
  validation,
  needs,
  proposals,
  onPatch,
  onEditAll,
}: {
  scenario: ScenarioForm;
  validation: Validation;
  needs?: Needs;
  proposals: Partial<Record<ProposalField, Proposal>>;
  onPatch: (patch: Partial<ScenarioForm>) => void;
  onEditAll: () => void;
}) {
  const need = (f: string) => needs?.[f] ?? null;
  const err = (f: string) => validation.fieldErrors[`${s.id}:${f}`] ?? null;
  const setField = (key: keyof ScenarioForm, text: string) =>
    onPatch({ [key]: { text, accepted: false } } as Partial<ScenarioForm>);
  const baseline = s.role === "baseline";
  const otherCapital = CAPEX_FIELDS.filter((c) => c !== "renovation");
  const otherCapitalSet = otherCapital.filter((c) => s.capex[c].text.trim() !== "").length;
  // What Quick Analysis leaves to Advanced, counted from the same readiness rules; never a blocker.
  const shownHere = new Set(["rentableAreaSqft", "annualRentPerSqft", "occupancyRatio", "expenseTotal", "capex.renovation"]);
  const elsewhere = Object.keys(needs ?? {}).filter((k) => !shownHere.has(k)).length;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-ink-200 bg-white p-4 sm:p-5">
        <div className="grid gap-x-5 gap-y-4 sm:grid-cols-2">
          <TextField
            className="sm:col-span-2"
            label="Proposed use"
            required
            inputMode="text"
            value={s.proposedUse}
            onChange={(v) => onPatch({ proposedUse: v })}
            error={err("proposedUse")}
            placeholder={baseline ? "The current use of the building" : "For example: light industrial workspace"}
            hint={baseline ? "The current use of the building." : "What the space would become. Each alternative excludes the others."}
          />
          <TextField
            label="Annual rent"
            unit="USD per sq ft per year"
            term="rent"
            value={s.annualRentPerSqft.text}
            onChange={(v) => setField("annualRentPerSqft", v)}
            origin={originOf(s.annualRentPerSqft)}
            error={err("annualRentPerSqft")}
            needed={need("annualRentPerSqft") ? "Open: income stays unavailable until rent is entered." : null}
            hint={echo(s.annualRentPerSqft, "USD/sqft/year", "amount")}
            proposal={proposalFor("annualRentPerSqft", proposals, onPatch)}
          />
          <TextField
            label="Occupancy"
            unit="% of rentable area"
            term="occupancy"
            value={percentText(s.occupancyRatio.text)}
            onChange={(v) => setField("occupancyRatio", percentToRatio(v))}
            origin={originOf(s.occupancyRatio)}
            error={err("occupancyRatio")}
            needed={need("occupancyRatio") ? "Open: enter 90 for 90% leased." : null}
            proposal={proposalFor("occupancyRatio", proposals, onPatch)}
          />
          <TextField
            label="Rentable area"
            unit="sq ft"
            value={s.rentableAreaSqft.text}
            onChange={(v) => setField("rentableAreaSqft", v)}
            origin={originOf(s.rentableAreaSqft)}
            error={err("rentableAreaSqft")}
            needed={need("rentableAreaSqft") ? "Open: the area being leased in this scenario." : null}
            hint={echo(s.rentableAreaSqft, "sqft", "positive")}
            proposal={proposalFor("rentableAreaSqft", proposals, onPatch)}
          />
          {s.expenseMode === "total" ? (
            <TextField
              label="Operating expenses"
              unit="USD per year"
              term="operatingExpenses"
              value={s.expenseTotal.text}
              onChange={(v) => setField("expenseTotal", v)}
              origin={originOf(s.expenseTotal)}
              error={err("expenseTotal")}
              needed={need("expenseTotal") ? "Open: one annual total of owner-paid costs." : null}
              hint={echo(s.expenseTotal, "USD/year", "amount")}
            />
          ) : (
            <div className="min-w-0">
              <p className="text-sm font-medium text-ink-900">Operating expenses</p>
              <p className="mt-1 rounded-md border border-dashed border-ink-300 px-3 py-2 text-[13px] leading-5 text-ink-600">
                Itemized across six categories in Advanced Underwriting (
                {EXPENSE_CATEGORIES.filter((c) => s.expenseItems[c].text.trim() !== "").length} of 6 entered).
              </p>
            </div>
          )}
          {baseline ? (
            <div className="min-w-0 sm:col-span-2">
              <p className="text-sm font-medium text-ink-900">Upfront capital</p>
              <p className="mt-1 text-[13px] leading-5 text-ink-600">
                The baseline keeps the building as it is, so its initial investment is fixed at $0.
              </p>
            </div>
          ) : (
            <TextField
              className="sm:col-span-2"
              label="Renovation cost"
              unit="USD"
              term="initialInvestment"
              value={s.capex.renovation.text}
              onChange={(v) => onPatch({ capex: { ...s.capex, renovation: { text: v, accepted: false } } })}
              origin={originOf(s.capex.renovation)}
              error={err("capex.renovation")}
              needed={need("capex.renovation") ? "Open: payback needs every capital line, including an explicit 0." : null}
              hint={
                <>
                  {echo(s.capex.renovation, "USD", "amount") ?? ""}
                  {echo(s.capex.renovation, "USD", "amount") ? " · " : ""}
                  {otherCapitalSet} of {otherCapital.length} other capital lines set (conversion, soft costs, contingency, other).
                </>
              }
            />
          )}
        </div>
        {elsewhere > 0 ? (
          <p className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-ink-100 pt-3 text-[13px] leading-5 text-ink-600" data-testid="quick-elsewhere">
            <span>
              {elsewhere} more {elsewhere === 1 ? "input" : "inputs"} for this scenario {elsewhere === 1 ? "is" : "are"} still open, such as lease
              basis and collection loss.
            </span>
            <button type="button" onClick={onEditAll} className="cursor-pointer rounded-sm font-semibold text-rufous-700 underline underline-offset-4 hover:text-rufous-800">
              Complete them in Advanced
            </button>
          </p>
        ) : null}
      </div>
      <AssumptionLedger scenario={s} onEditAll={onEditAll} />
    </div>
  );
}
