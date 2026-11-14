// Display-only formatting. Canonical financial values stay decimal strings in
// DTOs; nothing here performs financial arithmetic or ranking.
import type { PropertyDTO } from "@/lib/contracts";

export type Origin = PropertyDTO["address"]["origin"];

export interface DatumView<T> {
  value: T | null;
  origin: Origin;
  unit: string;
  evidenceIds: string[];
  recordedAt: string;
  sourceAsOf: string | null;
  note: string | null;
}

export const ORIGIN_LABEL: Record<Origin, string> = {
  source_data: "Source data",
  user_input: "Your input",
  derived_calculation: "Calculated",
  explicit_estimate: "Estimate",
  unknown: "Unknown",
};

export const UNIT_LABEL: Record<string, string> = {
  USD: "USD",
  "USD/year": "USD per year",
  "USD/sqft/year": "USD per sq ft per year",
  sqft: "sq ft",
  ratio: "ratio",
  years: "years",
  count: "count",
  text: "text",
  date: "date",
  WGS84: "WGS84 (lon/lat)",
};

type Numeric = `${number}`;

function isNumeric(value: string): value is Numeric {
  return /^-?\d+(\.\d+)?$/.test(value);
}

/** Group a plain decimal string for display, rounding only for display. */
export function formatDecimal(value: string, maxFractionDigits = 0): string {
  if (!isNumeric(value)) return value;
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: maxFractionDigits,
  }).format(value);
}

export function formatUsd(value: string, maxFractionDigits = 0): string {
  if (!isNumeric(value)) return value;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: maxFractionDigits,
  }).format(value);
}

/** Ratios are shown as percentages; the raw ratio remains available in titles. */
export function formatRatio(value: string): string {
  if (!isNumeric(value)) return value;
  return new Intl.NumberFormat("en-US", {
    style: "percent",
    maximumFractionDigits: 1,
  }).format(value);
}

/** Format a decimal string according to its contract unit. */
export function formatByUnit(value: string, unit: string): string {
  switch (unit) {
    case "USD":
      return formatUsd(value);
    case "USD/year":
      return `${formatUsd(value)} / yr`;
    case "USD/sqft/year":
      return `${formatUsd(value, 2)} / sq ft / yr`;
    case "sqft":
      return `${formatDecimal(value)} sq ft`;
    case "ratio":
      return formatRatio(value);
    case "years":
      return `${formatDecimal(value, 1)} years`;
    default:
      return value;
  }
}

export function formatCoordinates(c: { longitude: number; latitude: number }) {
  const lat = `${Math.abs(c.latitude).toFixed(5)}° ${c.latitude >= 0 ? "N" : "S"}`;
  const lon = `${Math.abs(c.longitude).toFixed(5)}° ${c.longitude >= 0 ? "E" : "W"}`;
  return `${lat}, ${lon}`;
}

export function formatInstant(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

export const DATA_MODE_LABEL: Record<string, string> = {
  live: "Live",
  licensed_cache: "Licensed cache",
  sponsor_dataset: "Sponsor dataset",
  synthetic: "Synthetic",
  mixed: "Mixed",
  unavailable: "Unavailable",
};
