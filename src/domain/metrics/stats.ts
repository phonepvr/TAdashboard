/** Pure statistical helpers. Durations use median + p25/p75 (never mean). */
import type { Bucket, DurationStats } from './types';

/** Linear-interpolated quantile over an already-sorted ascending array. */
export function quantileSorted(sorted: number[], q: number): number {
  if (sorted.length === 0) return NaN;
  if (sorted.length === 1) return sorted[0]!;
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  const lo = sorted[base]!;
  const hi = sorted[base + 1];
  return hi === undefined ? lo : lo + rest * (hi - lo);
}

export function median(values: number[]): number {
  return quantileSorted([...values].sort((a, b) => a - b), 0.5);
}

/** Summarise a set of (already cohort-filtered) durations. Null when empty. */
export function durationStats(values: number[]): DurationStats | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  return {
    n: s.length,
    min: s[0]!,
    p25: Math.round(quantileSorted(s, 0.25)),
    median: Math.round(quantileSorted(s, 0.5)),
    p75: Math.round(quantileSorted(s, 0.75)),
    max: s[s.length - 1]!,
  };
}

export function share(part: number, whole: number): number {
  return whole === 0 ? 0 : part / whole;
}

export function countBy<T>(items: T[], keyFn: (item: T) => string | null): Map<string, number> {
  const m = new Map<string, number>();
  for (const it of items) {
    const k = keyFn(it);
    if (k === null) continue;
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return m;
}

/** Distribution as buckets sorted by count desc (ties: key asc). */
export function distribution<T>(items: T[], keyFn: (item: T) => string | null): Bucket[] {
  const counts = countBy(items, keyFn);
  const total = [...counts.values()].reduce((a, b) => a + b, 0);
  return [...counts.entries()]
    .map(([key, count]) => ({ key, count, share: share(count, total) }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

/** Group items by a key, returning a Map of key -> items. */
export function groupBy<T>(items: T[], keyFn: (item: T) => string | null): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const it of items) {
    const k = keyFn(it);
    if (k === null) continue;
    const arr = m.get(k);
    if (arr) arr.push(it);
    else m.set(k, [it]);
  }
  return m;
}
