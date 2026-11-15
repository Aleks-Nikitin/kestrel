"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export const SECTIONS = [
  { id: "section-property", label: "Overview" },
  { id: "section-spatial", label: "Spatial intelligence" },
  { id: "section-scenarios", label: "Scenarios" },
  { id: "section-comparison", label: "Comparison" },
  { id: "section-analysis", label: "Agent analysis" },
] as const;

/**
 * Sticky jump links for the demo flow: property → spatial evidence → scenario
 * editing → comparison → agent explanation. Plain anchors, so it works without
 * script; the observer only highlights where you are.
 */
export function SectionNav({ available }: { available: string[] }) {
  const [active, setActive] = useState<string>(SECTIONS[0].id);

  useEffect(() => {
    const els = SECTIONS.map((s) => document.getElementById(s.id)).filter(
      (e): e is HTMLElement => e !== null,
    );
    if (!els.length || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setActive(visible.target.id);
      },
      { rootMargin: "-20% 0px -60% 0px" },
    );
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, [available.join("|")]); // eslint-disable-line react-hooks/exhaustive-deps

  function go(e: React.MouseEvent<HTMLAnchorElement>, id: string) {
    const el = document.getElementById(id);
    if (!el) return;
    e.preventDefault();
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    history.replaceState(null, "", `#${id}`);
    setActive(id);
  }

  return (
    <nav aria-label="Page sections" className="min-w-0 basis-full lg:basis-auto lg:flex-1">
      <ol className="flex gap-1 overflow-x-auto text-sm [scrollbar-width:none] lg:justify-end">
        {SECTIONS.map((s, i) => {
          const on = available.includes(s.id);
          return (
            <li key={s.id} className="shrink-0">
              {on ? (
                <a
                  href={`#${s.id}`}
                  onClick={(e) => go(e, s.id)}
                  aria-current={active === s.id ? "location" : undefined}
                  className={cn(
                    "relative inline-flex min-h-10 items-center gap-1.5 rounded-md px-3 font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-copper-300",
                    active === s.id
                      ? "bg-espresso-700 text-ivory after:absolute after:inset-x-3 after:bottom-1 after:h-0.5 after:rounded-full after:bg-copper-400"
                      : "text-ivory/75 hover:bg-espresso-800 hover:text-ivory",
                  )}
                >
                  <span className="text-xs tabular-nums text-copper-300" aria-hidden>{i + 1}</span>
                  {s.label}
                </a>
              ) : (
                <span className="inline-flex min-h-10 items-center gap-1.5 rounded-md px-3 text-ivory/40" aria-disabled="true">
                  <span className="text-xs tabular-nums" aria-hidden>{i + 1}</span>
                  {s.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
