/**
 * PII masking helpers (§1.1). People / free-text fields are masked by default in
 * every shared view; full values appear only when the user toggles the local,
 * explicit "private drill-down". Masking never touches the underlying data, only
 * its presentation.
 */
export function initials(value: string): string {
  // only tokens that start with a letter (skips "(demo)", numbers, punctuation)
  const parts = value.trim().split(/\s+/).filter((p) => /^[A-Za-z]/.test(p));
  if (parts.length === 0) return '••';
  return parts
    .slice(0, 3)
    .map((p) => p[0]!.toUpperCase())
    .join('.') + '.';
}

/** Stable alias map (sorted distinct -> "Prefix A/B/C…") for slicers like HR Head. */
export function buildAliasMap(values: string[], prefix: string): Map<string, string> {
  const distinct = [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const out = new Map<string, string>();
  distinct.forEach((v, i) => {
    const letter = i < 26 ? String.fromCharCode(65 + i) : `${i + 1}`;
    out.set(v, `${prefix} ${letter}`);
  });
  return out;
}

export function maskValue(value: string | null, sensitive: boolean, reveal: boolean): string {
  if (value === null || value === '') return '—';
  if (!sensitive || reveal) return value;
  return initials(value);
}
