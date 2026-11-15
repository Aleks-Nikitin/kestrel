"use client";

import type { MouseEvent, ReactNode } from "react";

/**
 * Returns to the overview stage on the same page: the selected property,
 * drafts and results are kept and nothing is fetched. Modified clicks fall
 * through to the browser.
 */
export function OverviewLink({ children, className }: { children: ReactNode; className?: string }) {
  function go(event: MouseEvent<HTMLAnchorElement>) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const overview = document.getElementById("overview");
    if (!overview) return;
    event.preventDefault();
    if (window.location.hash !== "#overview") window.location.hash = "overview";
    overview.focus({ preventScroll: true });
    window.scrollTo({
      top: 0,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    });
  }
  return <a href="#overview" aria-label="Kestrel overview" onClick={go} className={className}>{children}</a>;
}
