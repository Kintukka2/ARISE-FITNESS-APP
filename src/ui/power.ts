/**
 * Power as the hunter reads it (the owner's call: `666` against `2382` felt small, and growth should feel real): every
 * power and every equipment score on a screen is shown at `POWER_SHOWN` times the engine's figure, compact past a
 * thousand (`99.9k`, `357.3k`, `1.2M`). Only the display: every stat, every rule, Auto Deploy's weighing and every
 * comparison read the engine's own figure, so nothing a fight or a choice does moves with it.
 */
export const POWER_SHOWN = 150;

/** A figure compact past a thousand, to one decimal, a whole one left bare: `750`, `99.9k`, `120k`, `1.2M`. */
function compact(v: number): string {
  const one = (x: number) => x.toFixed(1).replace(/\.0$/, '');
  if (v < 1000) return String(Math.round(v));
  if (v < 999_950) return `${one(v / 1000)}k`;
  if (v < 999_950_000) return `${one(v / 1_000_000)}M`;
  return `${one(v / 1_000_000_000)}B`;
}

/** A power, or an equipment score, as shown: `666` reads `99.9k`. */
export const powerText = (n: number): string => compact(Math.max(0, n) * POWER_SHOWN);

/** A difference in power or score as shown, without its sign: what a ▲ or a ▼ stands beside. */
export const powerGap = (n: number): string => compact(Math.abs(n) * POWER_SHOWN);
