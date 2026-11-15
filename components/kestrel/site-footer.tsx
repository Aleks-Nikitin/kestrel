"use client";

import type { MouseEvent } from "react";
import { KestrelMark } from "./kestrel-mark";

/** Every link targets a section that already exists on the page; nothing is invented. */
const LINKS = [
  { id: "section-property", label: "Property Intelligence" },
  { id: "section-spatial", label: "Spatial Analysis" },
  { id: "section-scenarios", label: "Investment Scenarios" },
  { id: "section-analysis", label: "AI Investigation" },
] as const;

function go(e: MouseEvent<HTMLAnchorElement>, id: string) {
  const el = document.getElementById(id);
  if (!el) return; // section not on screen yet (no property selected): leave the link inert
  e.preventDefault();
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  history.replaceState(null, "", `#${id}`);
}

export function SiteFooter() {
  return (
    <footer className="mt-10 border-t border-espresso-700 bg-espresso-950 text-ivory">
      <div className="mx-auto grid max-w-[90rem] gap-8 px-4 py-8 sm:px-6 md:grid-cols-[1.1fr_1fr_1.3fr]">
        <div className="flex items-start gap-3">
          <KestrelMark tone="light" className="size-10 shrink-0" />
          <div>
            <p className="font-semibold tracking-[0.28em]">KESTREL</p>
            <p className="mt-1 text-sm text-stone-300">Commercial Property Intelligence</p>
          </div>
        </div>
        <nav aria-label="Footer sections">
          <ul className="grid gap-1 text-sm">
            {LINKS.map((l) => (
              <li key={l.id}>
                <a
                  href={`#${l.id}`}
                  onClick={(e) => go(e, l.id)}
                  className="inline-flex min-h-8 items-center rounded text-stone-200 underline-offset-4 hover:text-copper-300 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-copper-400"
                >
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="text-sm">
          <p className="font-medium text-copper-300">Evidence-backed property analysis</p>
          <p className="mt-1 text-stone-300">
            Financial scenarios use disclosed assumptions. Independent due diligence is required.
          </p>
        </div>
      </div>
      <div className="border-t border-espresso-700">
        <p className="mx-auto max-w-[90rem] px-4 py-3 text-xs text-stone-400 sm:px-6">Kestrel · HackPrinceton 2026</p>
      </div>
    </footer>
  );
}
