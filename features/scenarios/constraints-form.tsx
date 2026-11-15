import { Segmented, TextField } from "@/components/kestrel/field";
import { Term } from "@/components/kestrel/term";
import { formatByUnit, type Origin } from "@/features/dashboard/format";
import { percentText, percentToRatio } from "./percent";
import {
  validateDecimal,
  type ConstraintsForm,
  type DecimalKind,
  type FieldDraft,
  type Validation,
} from "./model";

const origin = (f: FieldDraft): Origin => (f.text.trim() === "" ? "unknown" : f.accepted ? "explicit_estimate" : "user_input");
function echo(f: FieldDraft, unit: string, kind: DecimalKind) {
  const t = f.text.trim();
  return t !== "" && validateDecimal(t, kind) === null ? `= ${formatByUnit(t, unit)}` : undefined;
}

/**
 * The investor's limits. Quick Analysis shows the two that most often decide
 * the outcome plus risk; Advanced adds minimum yield on cost. Same values
 * either way.
 */
export function ConstraintsFormView({
  constraints: c,
  validation,
  need,
  advanced,
  onPatch,
}: {
  constraints: ConstraintsForm;
  validation: Validation;
  /** Set when none of the three constraints is supplied. */
  need?: string | null;
  advanced: boolean;
  onPatch: (patch: Partial<ConstraintsForm>) => void;
}) {
  const err = (f: string) => validation.fieldErrors[`constraints:${f}`] ?? null;
  return (
    <fieldset className="m-0 min-w-0 border-0 p-0">
      <legend className="text-base font-semibold text-ink-950">Investment constraints</legend>
      <p className="mt-1 text-[13px] leading-5 text-ink-600">
        Your limits decide which alternative can be preferred. Empty means unset, not zero; the server
        applies them, not the browser.
      </p>
      {need ? (
        <p data-testid="constraints-needed" className="mt-2 border-l-2 border-ink-400 pl-3 text-[13px] leading-5 text-ink-700">
          {need}
        </p>
      ) : null}
      <div className="mt-4 space-y-4">
        <TextField
          label="Maximum initial investment"
          unit="USD"
          term="capitalBudget"
          value={c.maxInitialInvestment.text}
          onChange={(v) => onPatch({ maxInitialInvestment: { text: v, accepted: false } })}
          origin={origin(c.maxInitialInvestment)}
          error={err("maxInitialInvestment")}
          hint={echo(c.maxInitialInvestment, "USD", "amount")}
        />
        <TextField
          label="Maximum simple payback"
          unit="years"
          term="maxPayback"
          value={c.maxPaybackYears.text}
          onChange={(v) => onPatch({ maxPaybackYears: { text: v, accepted: false } })}
          origin={origin(c.maxPaybackYears)}
          error={err("maxPaybackYears")}
        />
        {advanced || c.minimumYieldOnCost.text.trim() !== "" ? (
          <TextField
            label="Minimum yield on cost"
            unit="%"
            term="yieldOnCost"
            value={percentText(c.minimumYieldOnCost.text)}
            onChange={(v) => onPatch({ minimumYieldOnCost: { text: percentToRatio(v), accepted: false } })}
            origin={origin(c.minimumYieldOnCost)}
            error={err("minimumYieldOnCost")}
            hint="Needs a disclosed total project cost."
          />
        ) : null}
        <div>
          <p className="text-sm font-medium text-ink-900">
            Risk tolerance
            <span className="ml-1.5 text-xs font-normal text-ink-500">
              <Term id="riskTolerance">What is this?<span className="sr-only"> (Risk tolerance)</span></Term>
            </span>
          </p>
          <Segmented
            className="mt-1"
            legend="Risk tolerance"
            name="risk-tolerance"
            value={c.riskTolerance}
            onChange={(v) => onPatch({ riskTolerance: v })}
            options={[
              { value: "low", label: "Low" },
              { value: "moderate", label: "Moderate" },
              { value: "high", label: "High" },
            ]}
          />
        </div>
      </div>
    </fieldset>
  );
}
