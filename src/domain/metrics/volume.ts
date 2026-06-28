/** §7A/§7B — volume, demand mix, budget coverage, intake/joins trend, pipeline snapshot. */
import type { NormalizedRow } from '../types';
import { monthKey } from '../dates';
import { distribution } from './stats';
import type { Bucket, TrendPoint } from './types';

export function totalReqs(rows: NormalizedRow[]): number {
  return rows.length;
}

export function demandMix(rows: NormalizedRow[]): Bucket[] {
  return distribution(rows, (r) => r.cat.demandType ?? null);
}

export interface BudgetCoverage {
  buckets: Bucket[];
  dominantShare: number;
  hasVariance: boolean; // false => render as a caveat, not a chart
}

export function budgetCoverage(rows: NormalizedRow[]): BudgetCoverage {
  const buckets = distribution(rows, (r) => r.cat.budgetFlag ?? null);
  const dominantShare = buckets[0]?.share ?? 0;
  return { buckets, dominantShare, hasVariance: dominantShare < 0.98 && buckets.length > 1 };
}

function trendByMonth(rows: NormalizedRow[], dateKey: 'reqReceivedDate' | 'joiningDate'): TrendPoint[] {
  const m = new Map<string, number>();
  for (const r of rows) {
    const ms = r.date[dateKey] ?? null;
    if (ms === null) continue;
    const k = monthKey(ms);
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m.entries()].map(([month, count]) => ({ month, count })).sort((a, b) => a.month.localeCompare(b.month));
}

export const intakeTrend = (rows: NormalizedRow[]) => trendByMonth(rows, 'reqReceivedDate');
export const joinsTrend = (rows: NormalizedRow[]) => trendByMonth(rows, 'joiningDate');

/** Demand-vs-supply: reqs received vs joins per month (aligned month axis). */
export function demandVsSupply(rows: NormalizedRow[]): { month: string; received: number; joined: number }[] {
  const received = new Map(intakeTrend(rows).map((p) => [p.month, p.count]));
  const joined = new Map(joinsTrend(rows).map((p) => [p.month, p.count]));
  const months = [...new Set([...received.keys(), ...joined.keys()])].sort();
  return months.map((month) => ({
    month,
    received: received.get(month) ?? 0,
    joined: joined.get(month) ?? 0,
  }));
}

export interface PipelineSnapshot {
  total: number;
  joined: number;
  open: number;
  onHold: number;
  dropped: number;
  tbo: number;
  pctOpen: number;
  byStage: Bucket[];
  bySubStage: Bucket[];
}

export function pipelineSnapshot(rows: NormalizedRow[]): PipelineSnapshot {
  let joined = 0;
  let open = 0;
  let onHold = 0;
  let dropped = 0;
  let tbo = 0;
  for (const r of rows) {
    if (r.isJoined) joined++;
    if (r.isOpen) open++;
    if (r.isOnHold) onHold++;
    if (r.wasDropped) dropped++;
    if (r.isTBO) tbo++;
  }
  return {
    total: rows.length,
    joined,
    open,
    onHold,
    dropped,
    tbo,
    pctOpen: rows.length ? open / rows.length : 0,
    byStage: distribution(rows, (r) => r.cat.stage ?? null),
    bySubStage: distribution(rows, (r) => r.cat.subStage ?? null),
  };
}
