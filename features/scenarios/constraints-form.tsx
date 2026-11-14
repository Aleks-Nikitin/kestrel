import { SelectField, TextField } from "@/components/kestrel/field";
import { formatByUnit, type Origin } from "@/features/dashboard/format";
import {
  validateDecimal,
  type ConstraintsForm,
  type DecimalKind,
  type FieldDraft,
  type Validation,
} from "./model";

const origin = (f: FieldDraft): Origin => (f.text.trim() === "" ? "unknown" : "user_input");
function echo(f: FieldDraft, unit: string, kind: DecimalKind) {
  const t = f.text.trim();
  return t !== "" && validateDecimal(t, kind) === null ? `= ${formatByUnit(t, unit)}` : undefined;
}

export function ConstraintsFormView({
  constraints: c,
  validation,
  need,
  onPatch,
}: {
  constraints: ConstraintsForm;
  validation: Validation;
  /** Set when none of the three constraints is supplied. */
  need?: string | null;
  onPatch: (patch: Partial<ConstraintsForm>) => void;
}) {
  const err = (f: string) => validation.fieldErrors[`constraints:${f}`] ?? null;
  return (
    <fieldset className="rounded-lg border border-slate-200 p-4">
      <legend className="px-1 text-sm font-semibold text-slate-900">Investment constraints</legend>
      <p className="mb-3 text-xs text-slate-600">
        Empty constraints are unset, not zero. Changing one can change the
        preferred scenario — the server decides, not the browser.
        Supply at least one capital or return constraint to select a preferred alternative.
      </p>
      {need ? (
        <p data-testid="constraints-needed" className="mb-3 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs font-medium text-amber-950">
          Needed: {need}
        </p>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <TextField
          label="Maximum initial investment"
          unit="USD"
          value={c.maxInitialInvestment.text}
          onChange={(v) => onPatch({ maxInitialInvestment: { text: v, accepted: false } })}
          origin={origin(c.maxInitialInvestment)}
          error={err("maxInitialInvestment")}
          hint={echo(c.maxInitialInvestment, "USD", "amount")}
        />
        <TextField
          label="Maximum simple payback"
          unit="years"
          value={c.maxPaybackYears.text}
          onChange={(v) => onPatch({ maxPaybackYears: { text: v, accepted: false } })}
          origin={origin(c.maxPaybackYears)}
          error={err("maxPaybackYears")}
        />
        <TextField
          label="Minimum yield on cost"
          unit="ratio 0–1"
          value={c.minimumYieldOnCost.text}
          onChange={(v) => onPatch({ minimumYieldOnCost: { text: v, accepted: false } })}
          origin={origin(c.minimumYieldOnCost)}
          error={err("minimumYieldOnCost")}
          hint={echo(c.minimumYieldOnCost, "ratio", "ratio") ?? "Needs a disclosed total project cost."}
        />
        <SelectField
          label="Risk tolerance"
          value={c.riskTolerance}
          onChange={(v) => onPatch({ riskTolerance: v })}
          options={[
            { value: "low", label: "Low" },
            { value: "moderate", label: "Moderate" },
            { value: "high", label: "High" },
          ]}
          hint="How unresolved critical feasibility is handled."
        />
      </div>
    </fieldset>
  );
}
