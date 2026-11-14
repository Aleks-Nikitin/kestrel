"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export const SECTIONS = [
  { id: "section-property", label: "Property" },
  { id: "section-spatial", label: "Spatial evidence" },
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
    <nav
      aria-label="Page sections"
      className="sticky top-0 z-30 -mx-4 border-b border-slate-200 bg-white/90 px-4 backdrop-blur sm:-mx-6 sm:px-6"
    >
      <ol className="flex gap-1 overflow-x-auto py-2 text-sm [scrollbar-width:none]">
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
                    "inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-medium focus-visible:outline-2 focus-visible:outline-sky-600",
                    active === s.id
                      ? "bg-slate-900 text-white"
                      : "text-slate-700 hover:bg-slate-100",
                  )}
                >
                  <span className="text-xs opacity-70" aria-hidden>{i + 1}</span>
                  {s.label}
                </a>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-slate-500" aria-disabled="true">
                  <span className="text-xs opacity-70" aria-hidden>{i + 1}</span>
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
