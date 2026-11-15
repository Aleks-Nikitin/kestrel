"use client";

import { useEffect, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/*
 * Two small effects, written locally with no dependency. The techniques (a
 * once-only scroll entrance and a cursor-following card spotlight) are common
 * UI patterns also found in component libraries such as React Bits; none of
 * their source is used. Neither effect ever touches a number, and both are
 * switched off under prefers-reduced-motion.
 */

type Phase = "static" | "hidden" | "shown";

/**
 * Fades a section up once as it first scrolls into view. Content is fully
 * visible on the server, without script, with reduced motion, and whenever it
 * is already on screen, so nothing is ever stuck hidden.
 */
export function Reveal({ children, className, id }: { children: ReactNode; className?: string; id?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<Phase>("static");

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (el.getBoundingClientRect().top < window.innerHeight * 0.95) return;
    // Only an element that starts below the fold is ever hidden, and only until
    // the observer below reveals it.
    setPhase("hidden");
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setPhase("shown");
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -8% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      id={id}
      className={cn(
        "transition-[opacity,transform] duration-500 ease-out",
        phase === "hidden" && "translate-y-3 opacity-0",
        className,
      )}
    >
      {children}
    </div>
  );
}

/**
 * A card with a soft copper highlight that follows the pointer. Hover-capable
 * devices only; no effect for keyboard, touch or reduced motion.
 */
export function SpotlightCard({
  children,
  className,
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "li";
}) {
  function move(e: PointerEvent<HTMLElement>) {
    if (e.pointerType !== "mouse") return;
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`);
    e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`);
  }
  return (
    <Tag
      onPointerMove={move}
      style={{ "--mx": "50%", "--my": "50%" } as CSSProperties}
      className={cn(
        "group/spot relative overflow-hidden",
        "before:pointer-events-none before:absolute before:inset-0 before:opacity-0 before:transition-opacity before:duration-300",
        "before:bg-[radial-gradient(220px_circle_at_var(--mx)_var(--my),rgba(176,106,59,0.16),transparent_70%)]",
        "[@media(hover:hover)]:hover:before:opacity-100 motion-reduce:before:hidden",
        className,
      )}
    >
      {children}
    </Tag>
  );
}
