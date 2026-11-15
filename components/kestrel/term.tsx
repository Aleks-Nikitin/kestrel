"use client";

import { useId, useState, type ReactNode } from "react";

/**
 * Plain-language definitions for the financial terms the interface uses. They
 * describe what the server calculates; nothing here calculates anything.
 */
export const GLOSSARY: Record<string, { title: string; body: string }> = {
  noi: {
    title: "Net operating income (NOI)",
    body: "Effective gross income minus owner-paid operating expenses, for one stabilized year. It excludes financing, depreciation and capital spending.",
  },
  egi: {
    title: "Effective gross income",
    body: "Potential income after vacancy, collection loss, concessions and other income loss are taken out.",
  },
  incrementalNoi: {
    title: "Incremental NOI",
    body: "How much more (or less) NOI a scenario produces each year than the baseline use.",
  },
  initialInvestment: {
    title: "Initial investment",
    body: "The sum of the five upfront cost lines: renovation, conversion, soft costs, contingency and other capital. The baseline is fixed at zero.",
  },
  payback: {
    title: "Simple payback",
    body: "Initial investment divided by incremental NOI: the years of extra income needed to recover the upfront cost. It ignores financing and the time value of money.",
  },
  yieldOnCost: {
    title: "Yield on cost",
    body: "NOI divided by total project cost. It needs a total project cost and a disclosed cost basis, so it is often unavailable.",
  },
  leaseBasis: {
    title: "Lease basis",
    body: "Who pays operating expenses. Kestrel calculates on a gross or modified-gross basis, where rent is quoted with owner-paid expenses modeled separately. Triple-net rents are not supported.",
  },
  occupancy: {
    title: "Occupancy",
    body: "The share of rentable area that is leased and paying in a stabilized year. 90% means a tenth of the space earns nothing.",
  },
  collectionLoss: {
    title: "Collection loss",
    body: "The share of billed rent that is never collected. Enter 0 only if you mean none.",
  },
  concessions: {
    title: "Concessions",
    body: "Free rent or other incentives given to tenants, as an annual dollar amount.",
  },
  rent: {
    title: "Annual rent per square foot",
    body: "Gross rent per rentable square foot per year. Multiplied by rentable area, it gives potential rent.",
  },
  operatingExpenses: {
    title: "Operating expenses",
    body: "Owner-paid annual costs: taxes, insurance, management, utilities, maintenance and other. Financing, depreciation and capital spending are excluded.",
  },
  capitalBudget: {
    title: "Maximum initial investment",
    body: "Your capital limit. An alternative that needs more upfront than this is excluded from the recommendation.",
  },
  maxPayback: {
    title: "Maximum simple payback",
    body: "The longest payback you would accept. Alternatives that take longer are excluded.",
  },
  riskTolerance: {
    title: "Risk tolerance",
    body: "How unresolved critical feasibility questions, such as unverified zoning, are treated when choosing a preferred scenario.",
  },
  totalProjectCost: {
    title: "Total project cost",
    body: "The denominator for yield on cost: the existing-property or acquisition basis plus all upfront costs. It is optional and must come with a stated basis.",
  },
};

/**
 * A term with its definition one click away. A real button that toggles a
 * described-by note, so it works with touch and the keyboard, not only hover.
 */
export function Term({ id, children }: { id: string; children: ReactNode }) {
  const entry = GLOSSARY[id];
  const noteId = useId();
  const [open, setOpen] = useState(false);
  if (!entry) return <>{children}</>;
  return (
    <span className="relative inline-block">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={noteId}
        aria-label={`${entry.title}: what this means`}
        onClick={() => setOpen((v) => !v)}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
        }}
        className="cursor-help rounded-sm text-left underline decoration-ink-300 decoration-dotted underline-offset-[3px] [font:inherit] hover:decoration-ink-600"
      >
        {children}
      </button>
      <span
        id={noteId}
        role="note"
        hidden={!open}
        className="absolute left-0 top-full z-30 mt-1.5 block w-64 rounded-md bg-ink-900 p-3 text-left text-xs font-normal leading-5 text-ink-100 shadow-lg"
      >
        <span className="block font-semibold text-white">{entry.title}</span>
        {entry.body}
      </span>
    </span>
  );
}
