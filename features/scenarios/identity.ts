/** Stable visual identity per scenario: a short code and an accent. Never conveys a value. */
const ACCENT = [
  { letter: "A", bar: "bg-sky-700", badge: "bg-sky-700 text-white" },
  { letter: "B", bar: "bg-emerald-700", badge: "bg-emerald-700 text-white" },
  { letter: "C", bar: "bg-copper-600", badge: "bg-copper-600 text-white" },
  { letter: "D", bar: "bg-rose-700", badge: "bg-rose-700 text-white" },
  { letter: "E", bar: "bg-orange-700", badge: "bg-orange-700 text-white" },
  { letter: "F", bar: "bg-cyan-700", badge: "bg-cyan-700 text-white" },
];
const BASELINE = { letter: "Base", bar: "bg-slate-500", badge: "bg-slate-600 text-white" };

export function scenarioIdentity(scenario: { id: string; role: string } | undefined, index: number) {
  if (scenario?.role === "baseline") return BASELINE;
  const m = /-([a-z])$/.exec(scenario?.id ?? "");
  const i = m ? m[1].charCodeAt(0) - 97 : index;
  return ACCENT[((i % ACCENT.length) + ACCENT.length) % ACCENT.length];
}
