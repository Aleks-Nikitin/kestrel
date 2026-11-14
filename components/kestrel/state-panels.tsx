import { AlertTriangle, Loader2, RefreshCw } from "lucide-react";
import type { ApiErrorDTO } from "@/lib/contracts";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export function LoadingPanel({
  label,
  rows = 3,
  onCancel,
}: {
  label: string;
  rows?: number;
  onCancel?: () => void;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="rounded-lg border border-slate-200 bg-white p-4"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <Loader2
            className="size-4 animate-spin motion-reduce:animate-none"
            aria-hidden
          />
          {label}
        </p>
        {onCancel ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-slate-300 bg-white text-slate-800 hover:bg-slate-100"
            onClick={onCancel}
          >
            Cancel
          </Button>
        ) : null}
      </div>
      <div className="mt-3 space-y-2" aria-hidden>
        {Array.from({ length: rows }, (_, i) => (
          <Skeleton key={i} className="h-4 bg-slate-200 motion-reduce:animate-none" />
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
}: {
  error: ApiErrorDTO;
  what: string;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-900"
    >
      <p className="flex items-center gap-2 text-sm font-semibold">
        <AlertTriangle className="size-4" aria-hidden />
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
      <p className="mt-2 text-xs text-red-800">
        Code {error.code} · Request {error.requestId}
      </p>
      {error.retryable && onRetry ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="mt-3 border-red-300 bg-white text-red-900 hover:bg-red-100"
          onClick={onRetry}
        >
          <RefreshCw aria-hidden /> Try again
        </Button>
      ) : null}
    </div>
  );
}
