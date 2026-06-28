/** Consistent, fixed-locale number / percent / day formatting. */
const NF = new Intl.NumberFormat('en-US');

export function num(n: number): string {
  return NF.format(Math.round(n));
}

export function pct(n: number, digits = 0): string {
  return `${n.toFixed(digits)}%`;
}

export function pctOf(part: number, whole: number, digits = 0): string {
  return pct(whole === 0 ? 0 : (part / whole) * 100, digits);
}

export function days(n: number | null | undefined): string {
  return n === null || n === undefined ? '—' : `${num(n)}d`;
}
