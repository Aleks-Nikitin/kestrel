// Display-only conversion between the contract's ratio strings ("0.9") and the
// percentages people think in ("90"). It moves the decimal point in the text
// and never goes through a floating-point number, so what is stored and sent
// is exactly what was typed, two places over. Anything that is not a plain
// decimal is passed through untouched for the normal validation to report.

const PLAIN = /^\d+(\.\d+)?$/;

/** "0.9" → "90", "0.925" → "92.5", "0.900" → "90.0". Null when the text is not a plain decimal. */
export function ratioToPercent(ratio: string): string | null {
  const t = ratio.trim();
  if (t === "") return "";
  if (!PLAIN.test(t)) return null;
  const [int, frac = ""] = t.split(".");
  const padded = frac.padEnd(2, "0");
  const whole = (int + padded.slice(0, 2)).replace(/^0+(?=\d)/, "");
  const rest = padded.slice(2);
  return rest ? `${whole}.${rest}` : whole;
}

/** "90" → "0.9", "92.5" → "0.925", "90.0" → "0.900". Text that is not a plain decimal is returned as typed. */
export function percentToRatio(percent: string): string {
  const t = percent.trim();
  if (t === "") return "";
  if (!PLAIN.test(t)) return percent;
  const [int, frac] = t.split(".");
  const padded = int.padStart(3, "0");
  const whole = padded.slice(0, -2).replace(/^0+(?=\d)/, "");
  const moved = padded.slice(-2) + (frac ?? "");
  // A whole-number percentage has no typed decimals to preserve: 90 is 0.9, 100 is 1.
  const digits = frac === undefined ? moved.replace(/0+$/, "") : moved;
  return digits ? `${whole}.${digits}` : whole;
}

/** What a percent box shows for a stored ratio: the percentage, or the raw text while it is not a number. */
export function percentText(ratio: string): string {
  return ratioToPercent(ratio) ?? ratio;
}
