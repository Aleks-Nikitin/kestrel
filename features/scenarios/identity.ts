/**
 * Stable visual identity per scenario: a short code on a neutral badge. Colour
 * is reserved for meaning (rufous marks the preferred scenario), so the badge
 * itself never conveys a value.
 */
const ALTERNATIVE = { bar: "bg-ink-700", badge: "bg-ink-800 text-white" };
const BASELINE = { letter: "Base", bar: "bg-ink-300", badge: "bg-ink-200 text-ink-900" };

export function scenarioIdentity(scenario: { id: string; role: string } | undefined, index: number) {
  if (scenario?.role === "baseline") return BASELINE;
  const m = /-([a-z])$/.exec(scenario?.id ?? "");
  const i = m ? m[1].charCodeAt(0) - 97 : index;
  return { letter: String.fromCharCode(65 + (((i % 26) + 26) % 26)), ...ALTERNATIVE };
}
