import { AlertTriangle, RefreshCw } from "lucide-react";
import type { ApiErrorDTO } from "@/lib/contracts";
import { cn } from "@/lib/utils";

export const buttonQuiet =
  "inline-flex min-h-9 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-ink-300 bg-white px-3 text-sm font-medium text-ink-900 transition-colors hover:border-ink-500 hover:bg-ink-50 disabled:cursor-not-allowed disabled:opacity-50";
export const buttonPrimary =
  "inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-md bg-rufous-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-rufous-700 disabled:cursor-not-allowed disabled:bg-ink-300 disabled:text-ink-600";
export const buttonInk =
  "inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-md bg-ink-900 px-4 text-sm font-semibold text-buff-100 transition-colors hover:bg-ink-800 disabled:cursor-not-allowed disabled:opacity-50";

/** A measured wait: a label, an optional cancel, and ruled placeholder lines. */
export function LoadingPanel({
  label,
  rows = 3,
  onCancel,
  className,
}: {
  label: string;
  rows?: number;
  onCancel?: () => void;
  className?: string;
}) {
  return (
    <div role="status" aria-live="polite" className={cn("rounded-lg border border-ink-200 bg-white p-4", className)}>
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-2.5 text-sm font-medium text-ink-700">
          <span aria-hidden className="relative grid size-3 place-items-center">
            <span className="absolute size-3 animate-ping rounded-full bg-rufous-400 opacity-60 motion-reduce:animate-none" />
            <span className="size-2 rounded-full bg-rufous-600" />
          </span>
          {label}
        </p>
        {onCancel ? (
          <button type="button" className={buttonQuiet} onClick={onCancel}>
            Cancel
          </button>
        ) : null}
      </div>
      <div className="mt-4 space-y-2.5" aria-hidden>
        {Array.from({ length: rows }, (_, i) => (
          <div
            key={i}
            className="h-3 animate-pulse rounded-sm bg-ink-100 motion-reduce:animate-none"
            style={{ width: `${92 - ((i * 17) % 40)}%` }}
          />
        ))}
      </div>
    </div>
  );
}

const TITLES: Partial<Record<ApiErrorDTO["code"], string>> = {
  TIMEOUT: "The request timed out",
  RATE_LIMITED: "Too many requests",
  UPSTREAM_UNAVAILABLE: "Unable to reach the data service",
  UPSTREAM_AUTH: "Data provider authorization failed",
  NOT_FOUND: "Not found",
  INVALID_INPUT: "Some inputs were rejected",
  DATA_MISMATCH: "Data did not match the selected property",
  LICENSE_RESTRICTED: "Restricted by data license",
  INSUFFICIENT_DATA: "Not enough data",
  CONTRACT_MISMATCH: "Unexpected server response",
  ANALYSIS_UNAVAILABLE: "AI analysis is unavailable",
  INTERNAL: "Something went wrong",
};

export function ErrorPanel({
  error,
  what,
  onRetry,
  className,
}: {
  error: ApiErrorDTO;
  what: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div role="alert" className={cn("rounded-lg border border-brick-300 bg-brick-50 p-4 text-brick-800", className)}>
      <p className="flex items-center gap-2 text-sm font-semibold">
        <AlertTriangle className="size-4 shrink-0" aria-hidden />
        {what}: {TITLES[error.code] ?? "Request failed"}
      </p>
      <p className="mt-1 text-sm">{error.message}</p>
      {error.fieldErrors?.length ? (
        <ul className="mt-2 list-disc pl-5 text-sm">
          {error.fieldErrors.map((f) => (
            <li key={f.path}>
              <code className="text-xs">{f.path}</code>: {f.message}
            </li>
          ))}
        </ul>
      ) : null}
      <p className="figure mt-2 text-xs text-brick-700">
        Code {error.code} · Request {error.requestId}
      </p>
      {error.retryable && onRetry ? (
        <button type="button" className={cn(buttonQuiet, "mt-3 border-brick-300 text-brick-800 hover:border-brick-600 hover:bg-white")} onClick={onRetry}>
          <RefreshCw className="size-4" aria-hidden /> Try again
        </button>
      ) : null}
    </div>
  );
}
