"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ReferenceLine,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
import { formatUsd } from "@/features/dashboard/format";

export interface ChartDatum {
  id: string;
  name: string;
  /** Authoritative backend string; null when the backend reports it unavailable. */
  noi: string | null;
  preferred: boolean;
  baseline: boolean;
}

/**
 * Bars show NOI exactly as returned by the backend. The numeric value passed to
 * Recharts is for drawing only; labels re-use the authoritative strings.
 */
export function ComparisonChart({ data }: { data: ChartDatum[] }) {
  const drawn = data
    .filter((d) => d.noi !== null)
    .map((d) => ({ ...d, value: Number(d.noi) }));
  const missing = data.filter((d) => d.noi === null).map((d) => d.name);
  const summary = drawn.map((d) => `${d.name}: ${formatUsd(d.noi as string)} per year`).join("; ");
  return (
    <figure>
      <div
        role="img"
        aria-label={`Net operating income per year by scenario. ${summary}`}
        className="h-64 w-full"
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={drawn} margin={{ top: 24, right: 12, left: 4, bottom: 8 }}>
            <CartesianGrid vertical={false} stroke="#e4dac7" />
            <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#4b3f34" }} interval={0} />
            <YAxis
              width={64}
              tick={{ fontSize: 12, fill: "#4b3f34" }}
              tickFormatter={(v: number) => formatUsd(String(v))}
            />
            <ReferenceLine y={0} stroke="#64574a" />
            <Bar dataKey="value" isAnimationActive={false} radius={[3, 3, 0, 0]}>
              {drawn.map((d) => (
                <Cell
                  key={d.id}
                  fill={d.preferred ? "#94532b" : d.baseline ? "#b9ab94" : "#64574a"}
                />
              ))}
              <LabelList
                dataKey="noi"
                position="top"
                formatter={(v: unknown) => formatUsd(String(v))}
                style={{ fontSize: 12, fill: "#221811" }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="mt-1 text-xs text-slate-600">
        Annual NOI (USD per year). Copper = preferred scenario, light stone = baseline.
        {missing.length ? ` NOI unavailable for: ${missing.join(", ")}.` : ""}
      </figcaption>
    </figure>
  );
}
