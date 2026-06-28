/** §8.1 "what changed" — recent vs prior period deltas for headline KPIs. */
import type { LogicalRole, NormalizedRow } from '../types';
import { DAY_MS, dayDiff, nowUtcMidnight } from '../dates';
import { durationStats, share } from './stats';

function countInWindow(rows: NormalizedRow[], role: LogicalRole, lo: number, hi: number): number {
  let c = 0;
  for (const r of rows) {
    const ms = r.date[role] ?? null;
    if (ms !== null && ms > lo && ms <= hi) c++;
  }
  return c;
}

function medianTtfJoinedIn(rows: NormalizedRow[], lo: number, hi: number): number | null {
  const vals: number[] = [];
  for (const r of rows) {
    const join = r.date.joiningDate ?? null;
    const req = r.date.reqReceivedDate ?? null;
    if (join === null || req === null || join <= lo || join > hi) continue;
    const d = dayDiff(req, join);
    if (d >= 0 && d <= 540) vals.push(d);
  }
  return durationStats(vals)?.median ?? null;
}

function acceptanceIn(rows: NormalizedRow[], lo: number, hi: number): number | null {
  let sent = 0;
  let accepted = 0;
  for (const r of rows) {
    const s = r.date.offerSentDate ?? null;
    if (s !== null && s > lo && s <= hi) {
      sent++;
      if (r.date.offerAcceptedDate != null) accepted++;
    }
  }
  return sent === 0 ? null : share(accepted, sent);
}

export interface ChangeItem {
  key: string;
  label: string;
  current: number | null;
  prior: number | null;
  betterWhenLower: boolean;
  unit: 'days' | 'count' | 'pct';
}

export function whatChanged(rows: NormalizedRow[], todayMs: number = nowUtcMidnight()): ChangeItem[] {
  const d30 = todayMs - 30 * DAY_MS;
  const d60 = todayMs - 60 * DAY_MS;
  const d90 = todayMs - 90 * DAY_MS;
  const d180 = todayMs - 180 * DAY_MS;
  return [
    {
      key: 'reqs',
      label: 'Reqs received (30d)',
      current: countInWindow(rows, 'reqReceivedDate', d30, todayMs),
      prior: countInWindow(rows, 'reqReceivedDate', d60, d30),
      betterWhenLower: false,
      unit: 'count',
    },
    {
      key: 'joins',
      label: 'Joins (30d)',
      current: countInWindow(rows, 'joiningDate', d30, todayMs),
      prior: countInWindow(rows, 'joiningDate', d60, d30),
      betterWhenLower: false,
      unit: 'count',
    },
    {
      key: 'ttf',
      label: 'Median TTF (90d cohort)',
      current: medianTtfJoinedIn(rows, d90, todayMs),
      prior: medianTtfJoinedIn(rows, d180, d90),
      betterWhenLower: true,
      unit: 'days',
    },
    {
      key: 'accept',
      label: 'Offer acceptance (90d)',
      current: acceptanceIn(rows, d90, todayMs),
      prior: acceptanceIn(rows, d180, d90),
      betterWhenLower: false,
      unit: 'pct',
    },
  ];
}
