import { useId, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { OriginBadge } from "./badges";
import type { Origin } from "@/features/dashboard/format";

const control =
  "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 placeholder:text-slate-400 focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-sky-600 aria-[invalid=true]:border-red-600 aria-[invalid=true]:bg-red-50 disabled:bg-slate-100 sm:text-sm";

interface Common {
  label: string;
  error?: string | null;
  hint?: ReactNode;
  required?: boolean;
  /** Why an evidence-backed recommendation still needs this input (never a default). */
  needed?: string | null;
  className?: string;
}


/** Marks an input the deterministic engine needs before it can recommend. */
function NeededPill({ show }: { show: boolean }) {
  return show ? (
    <span aria-hidden="true" className="ml-1.5 rounded bg-amber-100 px-1.5 py-0.5 align-middle text-[10px] font-semibold uppercase tracking-wide text-amber-900">
      Needed
    </span>
  ) : null;
}
function NeededNote({ id, text }: { id: string; text?: string | null }) {
  return text ? (
    <p id={id} data-testid="field-needed" className="mt-1 text-xs font-medium text-amber-900">
      {text}
    </p>
  ) : null;
}

export function TextField({
  label,
  value,
  onChange,
  unit,
  hint,
  error,
  origin,
  proposal,
  required,
  needed,
  inputMode = "decimal",
  placeholder,
  className,
  disabled,
}: Common & {
  value: string;
  onChange: (v: string) => void;
  /** Unit shown beside the field so every number is labeled. */
  unit?: string;
  origin?: Origin;
  /** A deliberate "use this value" action, never applied automatically. */
  proposal?: { label: string; onUse: () => void };
  inputMode?: "decimal" | "text";
  placeholder?: string;
  disabled?: boolean;
}) {
  const id = useId();
  const describedBy = [hint ? `${id}-hint` : "", needed ? `${id}-need` : "", error ? `${id}-err` : ""]
    .filter(Boolean)
    .join(" ");
  return (
    <div className={cn("min-w-0", className)}>
      <div className="flex flex-wrap items-center justify-between gap-x-2">
        <label htmlFor={id} className="text-sm font-medium text-slate-800">
          {label}
          {required ? <span aria-hidden className="text-red-700"> *</span> : null}
          <NeededPill show={!!needed} />
        </label>
        {origin ? <OriginBadge origin={origin} /> : null}
      </div>
      <div className="mt-1 flex items-stretch gap-2">
        <input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          inputMode={inputMode}
          autoComplete="off"
          spellCheck={false}
          placeholder={placeholder ?? (inputMode === "decimal" ? "Unknown" : undefined)}
          aria-invalid={error ? true : undefined}
          aria-required={required || undefined}
          aria-describedby={describedBy || undefined}
          disabled={disabled}
          className={cn(control, inputMode === "decimal" && "tabular-nums")}
        />
        {unit ? (
          <span className="flex shrink-0 items-center text-xs text-slate-600">{unit}</span>
        ) : null}
      </div>
      {hint ? (
        <p id={`${id}-hint`} className="mt-1 text-xs text-slate-600">
          {hint}
        </p>
      ) : null}
      <NeededNote id={`${id}-need`} text={needed} />
      {proposal ? (
        <button
          type="button"
          onClick={proposal.onUse}
          className="mt-1 rounded text-xs font-medium text-sky-800 underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-sky-600"
        >
          {proposal.label}
        </button>
      ) : null}
      {error ? (
        <p id={`${id}-err`} className="mt-1 text-xs font-medium text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function SelectField<T extends string>({
  label,
  value,
  onChange,
  options,
  hint,
  needed,
  className,
}: Common & {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  const id = useId();
  return (
    <div className={cn("min-w-0", className)}>
      <label htmlFor={id} className="text-sm font-medium text-slate-800">
        {label}
        <NeededPill show={!!needed} />
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        aria-describedby={[hint ? `${id}-hint` : "", needed ? `${id}-need` : ""].filter(Boolean).join(" ") || undefined}
        className={cn(control, "mt-1")}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {hint ? (
        <p id={`${id}-hint`} className="mt-1 text-xs text-slate-600">
          {hint}
        </p>
      ) : null}
      <NeededNote id={`${id}-need`} text={needed} />
    </div>
  );
}

export function TextAreaField({
  label,
  value,
  onChange,
  hint,
  error,
  needed,
  rows = 3,
  className,
}: Common & { value: string; onChange: (v: string) => void; rows?: number }) {
  const id = useId();
  return (
    <div className={cn("min-w-0", className)}>
      <label htmlFor={id} className="text-sm font-medium text-slate-800">
        {label}
        <NeededPill show={!!needed} />
      </label>
      <textarea
        id={id}
        value={value}
        rows={rows}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={[hint ? `${id}-hint` : "", needed ? `${id}-need` : "", error ? `${id}-err` : ""].filter(Boolean).join(" ") || undefined}
        className={cn(control, "mt-1")}
      />
      {hint ? (
        <p id={`${id}-hint`} className="mt-1 text-xs text-slate-600">
          {hint}
        </p>
      ) : null}
      <NeededNote id={`${id}-need`} text={needed} />
      {error ? (
        <p id={`${id}-err`} className="mt-1 text-xs font-medium text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
