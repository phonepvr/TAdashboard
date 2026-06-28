/** §9 patterns auto-surfaced: seasonality, concentration (Pareto), TTF drift. */
import type { LogicalRole, NormalizedRow } from '../types';
import { DAY_MS, dayDiff, nowUtcMidnight } from '../dates';
import { distribution, median } from './stats';
import type { Bucket } from './types';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export interface SeasonPoint {
  month: number; // 1..12
  label: string;
  avg: number; // average intake for that calendar month across the years seen
  total: number;
}

/** Average monthly intake shape (by calendar month), to reveal seasonality. */
export function seasonality(rows: NormalizedRow[]): SeasonPoint[] {
  const totals = new Array(12).fill(0) as number[];
  const years = Array.from({ length: 12 }, () => new Set<number>());
  for (const r of rows) {
    const ms = r.date.reqReceivedDate ?? null;
    if (ms === null) continue;
    const d = new Date(ms);
    const mo = d.getUTCMonth();
    totals[mo]!++;
    years[mo]!.add(d.getUTCFullYear());
  }
  return totals.map((t, mo) => ({
    month: mo + 1,
    label: MONTHS[mo]!,
    avg: years[mo]!.size ? t / years[mo]!.size : 0,
    total: t,
  }));
}

/** Concentration of open WIP by a dimension (Pareto, sorted desc). */
export function concentration(rows: NormalizedRow[], role: LogicalRole): Bucket[] {
  return distribution(rows.filter((r) => r.isOpen), (r) => r.cat[role] ?? null);
}

function medTtfWindow(rows: NormalizedRow[], lo: number, hi: number): number | null {
  const vals: number[] = [];
  for (const r of rows) {
    const join = r.date.joiningDate ?? null;
    const req = r.date.reqReceivedDate ?? null;
    if (join === null || req === null || join <= lo || join > hi) continue;
    const d = dayDiff(req, join);
    if (d >= 0 && d <= 540) vals.push(d);
  }
  return vals.length ? Math.round(median(vals)) : null;
}

export interface TtfDrift {
  recentMedian: number | null;
  priorMedian: number | null;
  direction: 'up' | 'down' | 'flat';
}

/** Is median TTF trending up or down across the recent two 90-day windows? */
export function driftTtf(rows: NormalizedRow[], todayMs: number = nowUtcMidnight()): TtfDrift {
  const d90 = todayMs - 90 * DAY_MS;
  const d180 = todayMs - 180 * DAY_MS;
  const recentMedian = medTtfWindow(rows, d90, todayMs);
  const priorMedian = medTtfWindow(rows, d180, d90);
  let direction: TtfDrift['direction'] = 'flat';
  if (recentMedian !== null && priorMedian !== null) {
    if (recentMedian > priorMedian + 5) direction = 'up';
    else if (recentMedian < priorMedian - 5) direction = 'down';
  }
  return { recentMedian, priorMedian, direction };
}
