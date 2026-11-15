import { useId, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { OriginBadge } from "./badges";
import { Term } from "./term";
import type { Origin } from "@/features/dashboard/format";

const control =
  "w-full min-w-0 rounded-md border border-ink-300 bg-white px-3 py-2 text-base text-ink-950 placeholder:text-ink-400 hover:border-ink-500 focus-visible:outline-offset-0 aria-[invalid=true]:border-brick-600 aria-[invalid=true]:bg-brick-50 disabled:bg-ink-100 sm:text-[15px]";

interface Common {
  label: string;
  error?: string | null;
  hint?: ReactNode;
  required?: boolean;
  /** Why an evidence-backed recommendation still needs this input (never a default). */
  needed?: string | null;
  /** Glossary entry explained by a "?" beside the label. */
  term?: string;
  className?: string;
}

/** Marks an input the deterministic engine still needs. Quiet on purpose: open is not wrong. */
function OpenMark({ show }: { show: boolean }) {
  return show ? (
    <span aria-hidden="true" className="ml-1.5 inline-flex items-center gap-1 align-middle text-[11px] font-medium text-ink-500">
      <span className="size-1.5 rounded-full border border-ink-500" />
      Open
    </span>
  ) : null;
}
function NeededNote({ id, text }: { id: string; text?: string | null }) {
  return text ? (
    <p id={id} data-testid="field-needed" className="mt-1 text-xs leading-5 text-ink-600">
      {text}
    </p>
  ) : null;
}
function Help({ term, about }: { term?: string; about: string }) {
  return term ? (
    <span className="ml-1.5 text-xs font-normal text-ink-500">
      <Term id={term}>
        What is this?<span className="sr-only"> ({about})</span>
      </Term>
    </span>
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
  term,
  inputMode = "decimal",
  placeholder,
  className,
  disabled,
}: Common & {
  value: string;
  onChange: (v: string) => void;
  /** Unit shown inside the field so every number is labeled. */
  unit?: string;
  origin?: Origin;
  /** A deliberate "use this value" action, never applied automatically. */
  proposal?: { label: string; onUse: () => void };
  inputMode?: "decimal" | "text";
  placeholder?: string;
  disabled?: boolean;
}) {
  const id = useId();
  const describedBy = [unit ? `${id}-unit` : "", hint ? `${id}-hint` : "", needed ? `${id}-need` : "", error ? `${id}-err` : ""]
    .filter(Boolean)
    .join(" ");
  return (
    <div className={cn("min-w-0", className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-2">
        <span>
          <label htmlFor={id} className="text-sm font-medium text-ink-900">
            {label}
            {required ? <span aria-hidden className="text-brick-700"> *</span> : null}
          </label>
          <OpenMark show={!!needed} />
          <Help term={term} about={label} />
        </span>
        {origin && origin !== "unknown" ? <OriginBadge origin={origin} /> : null}
      </div>
      <div className="relative mt-1">
        <input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          inputMode={inputMode}
          autoComplete="off"
          spellCheck={false}
          placeholder={placeholder ?? (inputMode === "decimal" ? "Not set" : undefined)}
          aria-invalid={error ? true : undefined}
          aria-required={required || undefined}
          aria-describedby={describedBy || undefined}
          disabled={disabled}
          className={cn(control, inputMode === "decimal" && "figure font-medium", unit && "pr-[7.5rem]")}
        />
        {unit ? (
          <span id={`${id}-unit`} className="pointer-events-none absolute inset-y-0 right-3 flex max-w-[6.75rem] items-center text-right text-xs leading-tight text-ink-500">
            {unit}
          </span>
        ) : null}
      </div>
      {hint ? (
        <p id={`${id}-hint`} className="figure mt-1 text-xs text-ink-500">
          {hint}
        </p>
      ) : null}
      <NeededNote id={`${id}-need`} text={needed} />
      {proposal ? (
        <button
          type="button"
          onClick={proposal.onUse}
          className="mt-1 cursor-pointer rounded-sm text-left text-xs font-medium text-rufous-700 underline underline-offset-2 hover:text-rufous-800"
        >
          {proposal.label}
        </button>
      ) : null}
      {error ? (
        <p id={`${id}-err`} className="mt-1 text-xs font-medium text-brick-700">
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
  term,
  className,
}: Common & {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  const id = useId();
  return (
    <div className={cn("min-w-0", className)}>
      <span>
        <label htmlFor={id} className="text-sm font-medium text-ink-900">
          {label}
        </label>
        <OpenMark show={!!needed} />
        <Help term={term} about={label} />
      </span>
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
        <p id={`${id}-hint`} className="mt-1 text-xs text-ink-500">
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
      <span>
        <label htmlFor={id} className="text-sm font-medium text-ink-900">
          {label}
        </label>
        <OpenMark show={!!needed} />
      </span>
      <textarea
        id={id}
        value={value}
        rows={rows}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={[hint ? `${id}-hint` : "", needed ? `${id}-need` : "", error ? `${id}-err` : ""].filter(Boolean).join(" ") || undefined}
        className={cn(control, "mt-1 leading-relaxed")}
      />
      {hint ? (
        <p id={`${id}-hint`} className="mt-1 text-xs text-ink-500">
          {hint}
        </p>
      ) : null}
      <NeededNote id={`${id}-need`} text={needed} />
      {error ? (
        <p id={`${id}-err`} className="mt-1 text-xs font-medium text-brick-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** A small set of mutually exclusive choices as a segmented control; real radios underneath. */
export function Segmented<T extends string>({
  legend,
  name,
  value,
  onChange,
  options,
  className,
}: {
  legend: string;
  name: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  className?: string;
}) {
  return (
    <fieldset className={cn("m-0 min-w-0 border-0 p-0", className)}>
      <legend className="sr-only">{legend}</legend>
      <div className="inline-flex max-w-full flex-wrap gap-0.5 rounded-lg border border-ink-200 bg-white p-0.5">
        {options.map((o) => (
          <label
            key={o.value}
            className="relative inline-flex min-h-9 cursor-pointer select-none items-center rounded-[5px] px-3 text-sm font-medium text-ink-700 transition-colors hover:text-ink-950 has-[:checked]:bg-ink-900 has-[:checked]:text-white has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-rufous-500"
          >
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={value === o.value}
              onChange={() => onChange(o.value)}
              className="sr-only"
            />
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
