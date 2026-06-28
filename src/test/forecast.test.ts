import { describe, expect, it } from 'vitest';
import { normalizeTable } from '../domain/normalize';
import { dedupeRows } from '../domain/dedup';
import {
  demandForecast,
  diversityTrajectory,
  driftTtf,
  openReqEtas,
  projectedJoins,
  seasonality,
  stageModel,
  tboLanding,
  addMonths,
} from '../domain/metrics';
import { tableFromRecords, defaultMapping, serial, FIXED_TODAY, type Record_ } from './fixtures';

function build(records: Record_[]) {
  const table = tableFromRecords(records);
  return dedupeRows(normalizeTable(table, defaultMapping(table), { todayMs: FIXED_TODAY })).rows;
}

describe('month helper', () => {
  it('adds months across year boundary', () => {
    expect(addMonths('2025-11', 3)).toBe('2026-02');
    expect(addMonths('2026-06', 1)).toBe('2026-07');
  });
});

describe('demand forecast (OLS + MA + band)', () => {
  const recs: Record_[] = [];
  const add = (m: number, n: number) => {
    for (let i = 0; i < n; i++) recs.push({ requisitionId: `${m}-${i}`, reqReceivedDate: serial(2025, m, i + 1), stage: 'Sourcing' });
  };
  add(1, 2);
  add(2, 4);
  add(3, 6); // perfectly linear: slope 2, r2 1
  const rows = build(recs);

  it('fits a linear trend and projects forward', () => {
    const f = demandForecast(rows, 3, 3);
    expect(f.monthsOfHistory).toBe(3);
    expect(f.slope).toBeCloseTo(2, 5);
    expect(f.r2).toBeCloseTo(1, 5);
    const projected = f.series.filter((p) => p.projected);
    expect(projected).toHaveLength(3);
    expect(projected[0]!.trend).toBeCloseTo(8, 5); // intercept 2 + slope 2 * x=3
    expect(projected[0]!.hi).toBeGreaterThanOrEqual(projected[0]!.lo!);
  });
});

describe('stage model, projected joins, ETA, TBO landing', () => {
  const base = serial(2025, 1, 1);
  const recs: Record_[] = [
    // joined cohort: accept->join consistently 30 days; req->join = 41
    ...[1, 2, 3, 4, 5].map((k) => ({
      requisitionId: `J${k}`,
      reqReceivedDate: base,
      offerSentDate: base + 9,
      offerAcceptedDate: base + 11,
      joiningDate: base + 41,
      stage: 'Joined' as const,
    })),
    // open, very old -> at risk vs org median (~41)
    { requisitionId: 'O1', reqReceivedDate: base, intakeDate: base + 1, stage: 'Sourcing' },
    // TBO: accepted, not joined
    { requisitionId: 'T1', reqReceivedDate: base, offerSentDate: base + 9, offerAcceptedDate: base + 11, stage: 'Offer Stage' },
  ];
  const rows = build(recs);

  it('stage model returns residual + conversion per funnel stage', () => {
    const model = stageModel(rows);
    expect(model).toHaveLength(6);
    const received = model.find((m) => m.stage === 'Received')!;
    expect(received.n).toBeGreaterThan(0);
    expect(received.conversion).toBeGreaterThan(0);
  });

  it('projects joins with assumptions and a fulfilment gap', () => {
    const p = projectedJoins(rows, 3, FIXED_TODAY);
    expect(p.byMonth).toHaveLength(3);
    expect(p.assumptions).toHaveLength(6);
    expect(typeof p.gap).toBe('number');
  });

  it('flags an old open req as at-risk', () => {
    const etas = openReqEtas(rows, FIXED_TODAY);
    expect(etas.some((e) => e.reqId === 'O1' && e.atRisk)).toBe(true);
  });

  it('TBO landing uses median accept→join', () => {
    const t = tboLanding(rows, 3, FIXED_TODAY);
    expect(t.medianAcceptToJoin).toBe(30);
    expect(t.byMonth.reduce((a, b) => a + b.expected, 0)).toBe(1); // the single TBO
  });
});

describe('patterns', () => {
  it('seasonality aggregates by calendar month', () => {
    const rows = build([
      { requisitionId: 'a', reqReceivedDate: serial(2025, 3, 1), stage: 'Sourcing' },
      { requisitionId: 'b', reqReceivedDate: serial(2025, 3, 2), stage: 'Sourcing' },
    ]);
    const s = seasonality(rows);
    expect(s[2]!.label).toBe('Mar');
    expect(s[2]!.total).toBe(2);
  });

  it('diversity trajectory + drift run without error', () => {
    const rows = build([
      { requisitionId: 'x', reqReceivedDate: serial(2025, 1, 1), joiningDate: serial(2025, 3, 1), gender: 'Female', stage: 'Joined' },
    ]);
    expect(diversityTrajectory(rows).length).toBeGreaterThanOrEqual(1);
    expect(['up', 'down', 'flat']).toContain(driftTtf(rows, FIXED_TODAY).direction);
  });
});
