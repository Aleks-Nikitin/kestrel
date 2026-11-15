import { useId } from "react";

/**
 * Kestrel mark: a faceted falcon head in profile with a hooked beak, a sharp
 * brow-eye and the kestrel's malar stripe in copper. Original geometry, drawn on
 * a 64×64 grid so it holds up from favicon size to hero size.
 * `light` is for dark surfaces, `dark` for light ones.
 */
const HEAD = "M13 55 L16 26 L27 12.5 L40 9 L50 14 L57 23 L58 36 L51 30.5 L46.5 31.5 L43 41 L34 56 L22 60 Z";

const TONES = {
  light: { head: "#f3e3cf", facet: "#e8cfae", stripe: "#b06a3b", eye: "#17100b" },
  dark: { head: "#2c1f16", facet: "#54402f", stripe: "#b06a3b", eye: "#fbf8f1" },
} as const;

export function KestrelMark({
  tone = "light",
  className,
  title,
}: {
  tone?: keyof typeof TONES;
  className?: string;
  /** Provide only when the mark is not next to the word "Kestrel". */
  title?: string;
}) {
  const id = useId();
  const clip = `${id}-head`;
  const c = TONES[tone];
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      <defs>
        <clipPath id={clip}>
          <path d={HEAD} />
        </clipPath>
      </defs>
      <path d={HEAD} fill={c.head} />
      <g clipPath={`url(#${clip})`}>
        <path d="M37 30 L43 28 L33 62 L25 62 Z" fill={c.stripe} />
        <path d="M27 12.5 L40 9 L50 14 L36 18 Z" fill={c.facet} />
      </g>
      <path d="M33 21.5 L47 20.5 L43 28 Z" fill={c.eye} />
    </svg>
  );
}
