/**
 * §9 — Patterns & Projections. Deliberately SIMPLE, transparent, explainable.
 * The history is short (~14 months) so everything here is "directional", with
 * wide uncertainty and a visible assumptions panel in the UI.
 */
import type { LogicalRole, NormalizedRow } from '../types';
import { DAY_MS, dayDiff, monthKey, nowUtcMidnight } from '../dates';
import { durationStats, median } from './stats';
import { FUNNEL_STAGES } from './conversion';
import { intakeTrend } from './volume';
import { durationValues } from './velocity';

// ───────────────────────── month helpers ─────────────────────────

export function addMonths(ym: string, k: number): string {
  const [y, m] = ym.split('-').map(Number) as [number, number];
  const total = y * 12 + (m - 1) + k;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return `${ny}-${nm < 10 ? '0' : ''}${nm}`;
}

function contiguousMonths(start: string, end: string): string[] {
  const out: string[] = [];
  let cur = start;
  // guard against pathological ranges
  for (let i = 0; i < 600 && cur <= end; i++) {
    out.push(cur);
    cur = addMonths(cur, 1);
  }
  return out;
}

function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

interface Ols {
  slope: number;
  intercept: number;
  r2: number;
}
function ols(ys: number[]): Ols {
  const n = ys.length;
  if (n < 2) return { slope: 0, intercept: ys[0] ?? 0, r2: 0 };
  const xs = ys.map((_, i) => i);
  const mx = mean(xs);
  const my = mean(ys);
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    sxy += (xs[i]! - mx) * (ys[i]! - my);
    sxx += (xs[i]! - mx) ** 2;
    syy += (ys[i]! - my) ** 2;
  }
  const slope = sxx === 0 ? 0 : sxy / sxx;
  const intercept = my - slope * mx;
  const r2 = syy === 0 ? 0 : (sxy * sxy) / (sxx * syy);
  return { slope, intercept, r2 };
}

// ───────────────────────── §9.1 demand forecast ─────────────────────────

export interface DemandPoint {
  month: string;
  received: number | null;
  trend: number | null; // OLS fitted/projected
  ma: number | null; // trailing moving average (projection only)
  lo: number | null;
  hi: number | null;
  projected: boolean;
}

export interface DemandForecast {
  monthsOfHistory: number;
  slope: number;
  r2: number;
  maWindow: number;
  horizon: number;
  series: DemandPoint[];
}

export function demandForecast(rows: NormalizedRow[], horizon = 3, maWindow = 3): DemandForecast {
  const raw = intakeTrend(rows);
  if (raw.length === 0) {
    return { monthsOfHistory: 0, slope: 0, r2: 0, maWindow, horizon, series: [] };
  }
  const months = contiguousMonths(raw[0]!.month, raw[raw.length - 1]!.month);
  const counts = new Map(raw.map((p) => [p.month, p.count]));
  const ys = months.map((m) => counts.get(m) ?? 0);
  const { slope, intercept, r2 } = ols(ys);

  // residual std for the uncertainty band
  const resid = ys.map((y, i) => y - (intercept + slope * i));
  const residStd = Math.sqrt(mean(resid.map((r) => r * r)));
  const band = 1.96 * residStd;
  const trailingMa = mean(ys.slice(-maWindow));

  const series: DemandPoint[] = months.map((month, i) => ({
    month,
    received: ys[i]!,
    trend: Math.max(0, intercept + slope * i),
    ma: null,
    lo: null,
    hi: null,
    projected: false,
  }));

  const last = months[months.length - 1]!;
  for (let h = 1; h <= horizon; h++) {
    const i = months.length - 1 + h;
    const trend = Math.max(0, intercept + slope * i);
    series.push({
      month: addMonths(last, h),
      received: null,
      trend,
      ma: Math.max(0, trailingMa),
      lo: Math.max(0, trend - band),
      hi: trend + band,
      projected: true,
    });
  }

  return { monthsOfHistory: months.length, slope, r2, maWindow, horizon, series };
}

// ───────────────────────── stage residual / conversion model ─────────────────────────

function currentStageIndex(r: NormalizedRow): number {
  for (let j = FUNNEL_STAGES.length - 1; j >= 0; j--) {
    if (r.date[FUNNEL_STAGES[j]!.role] != null) return j;
  }
  return -1;
}

export interface StageModelRow {
  stage: string;
  medianResidualDays: number | null; // stage timestamp -> join
  conversion: number; // P(join | reached stage)
  n: number;
}

export function stageModel(rows: NormalizedRow[], cap = 540): StageModelRow[] {
  return FUNNEL_STAGES.map((s) => {
    const reached: NormalizedRow[] = [];
    const residuals: number[] = [];
    let joinedReached = 0;
    for (const r of rows) {
      const ts = r.date[s.role] ?? null;
      if (ts == null) continue;
      reached.push(r);
      if (r.isJoined) {
        joinedReached++;
        const join = r.date.joiningDate ?? null;
        if (join != null) {
          const d = dayDiff(ts, join);
          if (d >= 0 && d <= cap) residuals.push(d);
        }
      }
    }
    return {
      stage: s.label,
      medianResidualDays: residuals.length ? Math.round(median(residuals)) : null,
      conversion: reached.length ? joinedReached / reached.length : 0,
      n: reached.length,
    };
  });
}

// ───────────────────────── §9.2 projected joins + fulfilment gap ─────────────────────────

export interface JoinProjection {
  byMonth: { month: string; expectedJoins: number; demand: number; gap: number }[];
  totalExpected: number;
  totalDemand: number;
  gap: number;
  assumptions: StageModelRow[];
}

export function projectedJoins(rows: NormalizedRow[], horizon = 3, todayMs: number = nowUtcMidnight()): JoinProjection {
  const model = stageModel(rows);
  const residual = model.map((m) => m.medianResidualDays);
  const conversion = model.map((m) => m.conversion);

  const monthAcc = new Map<string, number>();
  for (const r of rows) {
    if (!r.isOpen) continue;
    const idx = currentStageIndex(r);
    if (idx < 0 || residual[idx] == null) continue;
    const ts = r.date[FUNNEL_STAGES[idx]!.role]!;
    let expectedMs = ts + residual[idx]! * DAY_MS;
    if (expectedMs < todayMs) expectedMs = todayMs;
    const m = monthKey(expectedMs);
    monthAcc.set(m, (monthAcc.get(m) ?? 0) + conversion[idx]!);
  }

  // demand baseline = trailing 3-month avg received
  const recent = intakeTrend(rows).slice(-3).map((p) => p.count);
  const demandBaseline = recent.length ? Math.round(mean(recent)) : 0;

  const startMonth = monthKey(todayMs);
  const byMonth = Array.from({ length: horizon }, (_, h) => {
    const month = addMonths(startMonth, h);
    const expectedJoins = Math.round(monthAcc.get(month) ?? 0);
    return { month, expectedJoins, demand: demandBaseline, gap: expectedJoins - demandBaseline };
  });

  const totalExpected = byMonth.reduce((a, b) => a + b.expectedJoins, 0);
  const totalDemand = demandBaseline * horizon;
  return { byMonth, totalExpected, totalDemand, gap: totalExpected - totalDemand, assumptions: model };
}

// ───────────────────────── §9.3 open-req ETA + at-risk ─────────────────────────

export interface OpenReqEta {
  i: number;
  reqId: string | null;
  businessUnit: string | null;
  level: string | null;
  stage: string | null;
  ageDays: number | null;
  etaDays: number | null;
  atRisk: boolean;
}

function ttfMedianByRole(rows: NormalizedRow[], role: LogicalRole, minN = 5): Map<string, number> {
  const groups = new Map<string, number[]>();
  for (const r of rows) {
    if (!r.isJoined) continue;
    const key = r.cat[role] ?? null;
    const req = r.date.reqReceivedDate ?? null;
    const join = r.date.joiningDate ?? null;
    if (key === null || req === null || join === null) continue;
    const d = dayDiff(req, join);
    if (d < 0 || d > 540) continue;
    let arr = groups.get(key);
    if (!arr) {
      arr = [];
      groups.set(key, arr);
    }
    arr.push(d);
  }
  const out = new Map<string, number>();
  for (const [k, vals] of groups) if (vals.length >= minN) out.set(k, Math.round(median(vals)));
  return out;
}

export function openReqEtas(rows: NormalizedRow[], todayMs: number = nowUtcMidnight()): OpenReqEta[] {
  const model = stageModel(rows);
  const residual = model.map((m) => m.medianResidualDays);
  const byLevel = ttfMedianByRole(rows, 'level');
  const orgTtf = durationStats(durationValues(rows, 'reqReceivedDate', 'joiningDate'))?.median ?? null;

  const out: OpenReqEta[] = [];
  for (const r of rows) {
    if (!r.isOpen) continue;
    const idx = currentStageIndex(r);
    const ageDays = r.num.ageingDays ?? null;
    const level = r.cat.level ?? null;
    const cohortTtf = (level && byLevel.get(level)) || orgTtf;

    let etaDays: number | null = null;
    if (idx >= 0 && residual[idx] != null) {
      const ts = r.date[FUNNEL_STAGES[idx]!.role]!;
      etaDays = Math.max(0, Math.round((ts + residual[idx]! * DAY_MS - todayMs) / DAY_MS));
    } else if (cohortTtf != null && ageDays != null) {
      etaDays = Math.max(0, cohortTtf - ageDays);
    }
    const atRisk = ageDays != null && cohortTtf != null && ageDays > cohortTtf;
    out.push({
      i: r.i,
      reqId: r.reqId,
      businessUnit: r.cat.businessUnit ?? null,
      level,
      stage: r.cat.stage ?? null,
      ageDays,
      etaDays,
      atRisk,
    });
  }
  return out.sort((a, b) => Number(b.atRisk) - Number(a.atRisk) || (b.ageDays ?? 0) - (a.ageDays ?? 0));
}

// ───────────────────────── §9.4 TBO landing ─────────────────────────

export interface TboLanding {
  byMonth: { month: string; expected: number }[];
  medianAcceptToJoin: number | null;
}

export function tboLanding(rows: NormalizedRow[], horizon = 3, todayMs: number = nowUtcMidnight()): TboLanding {
  const acceptToJoin = durationValues(rows, 'offerAcceptedDate', 'joiningDate', 365);
  const medAccept = acceptToJoin.length ? Math.round(median(acceptToJoin)) : null;
  const acc = new Map<string, number>();
  if (medAccept != null) {
    for (const r of rows) {
      if (!r.isTBO) continue;
      const a = r.date.offerAcceptedDate ?? null;
      if (a == null) continue;
      let ms = a + medAccept * DAY_MS;
      if (ms < todayMs) ms = todayMs;
      const m = monthKey(ms);
      acc.set(m, (acc.get(m) ?? 0) + 1);
    }
  }
  const start = monthKey(todayMs);
  const byMonth = Array.from({ length: horizon }, (_, h) => {
    const month = addMonths(start, h);
    return { month, expected: acc.get(month) ?? 0 };
  });
  return { byMonth, medianAcceptToJoin: medAccept };
}

// ───────────────────────── §9.5 diversity trajectory ─────────────────────────

export function diversityTrajectory(rows: NormalizedRow[]): { month: string; femaleShareKnown: number; n: number }[] {
  const buckets = new Map<string, { f: number; known: number }>();
  for (const r of rows) {
    const join = r.date.joiningDate ?? null;
    if (join == null) continue;
    const g = r.cat.gender ?? 'Unknown';
    if (g !== 'Male' && g !== 'Female') continue;
    const m = monthKey(join);
    const b = buckets.get(m) ?? { f: 0, known: 0 };
    b.known++;
    if (g === 'Female') b.f++;
    buckets.set(m, b);
  }
  return [...buckets.entries()]
    .map(([month, b]) => ({ month, femaleShareKnown: b.known ? b.f / b.known : 0, n: b.known }))
    .sort((a, b) => a.month.localeCompare(b.month));
}
