"use client";

import type { MouseEvent, ReactNode } from "react";

/** Same-page navigation only: retains selected property, drafts and results. */
export function OverviewLink({ children, className }: { children: ReactNode; className?: string }) {
  function go(event: MouseEvent<HTMLAnchorElement>) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const overview = document.getElementById("overview");
    if (!overview) return;
    event.preventDefault();
    overview.focus({ preventScroll: true });
    overview.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      block: "start",
    });
    history.replaceState(null, "", "#overview");
  }
  return <a href="#overview" aria-label="Kestrel overview" onClick={go} className={className}>{children}</a>;
}
