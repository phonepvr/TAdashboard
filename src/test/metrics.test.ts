import { describe, expect, it } from 'vitest';
import { normalizeTable } from '../domain/normalize';
import { dedupeRows } from '../domain/dedup';
import {
  agedOpenWorklist,
  ageingDistribution,
  applyFilters,
  bottleneck,
  demandMix,
  distinctValues,
  dropRate,
  durationStats,
  funnel,
  genderRatio,
  headlineKpis,
  loadDistribution,
  offerAcceptanceRate,
  pipelineSnapshot,
  quantileSorted,
  recruiterProductivity,
  selectionToJoin,
  slaBreach,
  sourceConversion,
  sourceMix,
  timeToFill,
  velocityDecomposition,
} from '../domain/metrics';
import { tableFromRecords, defaultMapping, serial, FIXED_TODAY, type Record_ } from './fixtures';

const base = serial(2025, 1, 1);
const joinedRow = (id: string, ttf: number, extra: Record_): Record_ => ({
  requisitionId: id,
  reqReceivedDate: base,
  intakeDate: base + 2,
  selectionDate: base + 50,
  offerSentDate: base + 80,
  offerAcceptedDate: base + 81,
  joiningDate: base + ttf,
  stage: 'Joined',
  ...extra,
});

const records: Record_[] = [
  joinedRow('1', 100, { demandType: 'New', gender: 'Female', source: 'RPO', recruiter: 'Alpha' }),
  joinedRow('2', 150, { demandType: 'New', gender: 'Female', source: 'RPO', recruiter: 'Alpha' }),
  joinedRow('3', 200, { demandType: 'Replacement', gender: 'Male', source: 'Employee Referral', recruiter: 'Alpha' }),
  // open at sourcing (received only)
  { requisitionId: '4', reqReceivedDate: serial(2025, 2, 1), stage: 'Sourcing', demandType: 'New', gender: 'Male', source: 'Consultant', recruiter: 'Alpha' },
  // open, reached selection
  { requisitionId: '5', reqReceivedDate: base, intakeDate: base + 2, selectionDate: base + 50, stage: 'Interview', demandType: 'New', source: null, recruiter: 'Beta' },
  // dropped
  { requisitionId: '6', reqReceivedDate: base, selectionDate: base + 50, stage: 'Dropped', dropList: 'Cand - reason', demandType: 'Replacement', gender: 'Male', source: 'RPO', recruiter: 'Beta' },
];

const table = tableFromRecords(records);
const { rows } = dedupeRows(normalizeTable(table, defaultMapping(table), { todayMs: FIXED_TODAY }));

describe('stats', () => {
  it('quantileSorted interpolates', () => {
    expect(quantileSorted([100, 150, 200], 0.5)).toBe(150);
    expect(quantileSorted([100, 150, 200], 0.25)).toBe(125);
    expect(quantileSorted([100, 150, 200], 0.75)).toBe(175);
  });
  it('durationStats returns null for empty', () => {
    expect(durationStats([])).toBeNull();
  });
});

describe('velocity', () => {
  it('TTF median/p25/p75 over the joined cohort', () => {
    const ttf = timeToFill(rows)!;
    expect(ttf.n).toBe(3);
    expect(ttf.median).toBe(150);
    expect(ttf.p25).toBe(125);
    expect(ttf.p75).toBe(175);
  });
  it('identifies the bottleneck segment', () => {
    expect(bottleneck(velocityDecomposition(rows))?.key).toBe('accept_join');
  });
});

describe('funnel & conversion', () => {
  it('builds a monotonic funnel tolerant of missing intermediates', () => {
    const f = funnel(rows);
    expect(f.find((s) => s.key === 'received')!.count).toBe(6);
    expect(f.find((s) => s.key === 'offer_sent')!.count).toBe(3);
    expect(f.find((s) => s.key === 'joined')!.count).toBe(3);
  });
  it('offer acceptance rate (small cohort => not flagged as artifact)', () => {
    const a = offerAcceptanceRate(rows);
    expect(a.rate).toBe(1);
    expect(a.likelyArtifact).toBe(false);
  });
  it('drop rate and selection→join', () => {
    expect(dropRate(rows).dropped).toBe(1);
    const s2j = selectionToJoin(rows);
    expect(s2j.selected).toBe(5);
    expect(s2j.joined).toBe(3);
    expect(s2j.rate).toBeCloseTo(0.6);
  });
});

describe('pipeline & demand', () => {
  it('snapshot counts', () => {
    const snap = pipelineSnapshot(rows);
    expect(snap.total).toBe(6);
    expect(snap.joined).toBe(3);
    expect(snap.open).toBe(2);
    expect(snap.dropped).toBe(1);
    expect(snap.pctOpen).toBeCloseTo(2 / 6);
  });
  it('demand mix', () => {
    const mix = demandMix(rows);
    expect(mix.find((b) => b.key === 'New')!.count).toBe(4);
    expect(mix.find((b) => b.key === 'Replacement')!.count).toBe(2);
  });
});

describe('ageing', () => {
  it('aged-open worklist (open reqs over threshold, oldest first)', () => {
    const aged = agedOpenWorklist(rows, 90);
    expect(aged).toHaveLength(2);
    expect(aged[0]!.ageDays).toBeGreaterThanOrEqual(aged[1]!.ageDays);
  });
  it('ageing distribution is in canonical bucket order', () => {
    const dist = ageingDistribution(rows);
    expect(dist[0]!.key).toBe('0–30');
    expect(dist[dist.length - 1]!.key).toBe('365+');
  });
  it('SLA breaches vs target', () => {
    const sla = slaBreach(rows, 90);
    expect(sla.cohort).toBe(3);
    expect(sla.breaches).toBe(3); // 100,150,200 all > 90
  });
});

describe('diversity & source', () => {
  it('gender preserves Unknown explicitly', () => {
    const g = genderRatio(rows);
    expect(g.female).toBe(2);
    expect(g.male).toBe(3);
    expect(g.unknown).toBe(1);
    expect(g.femaleShareKnown).toBeCloseTo(0.4);
  });
  it('source mix + conversion', () => {
    expect(sourceMix(rows).find((b) => b.key === 'RPO')!.count).toBe(3);
    const rpo = sourceConversion(rows).find((s) => s.source === 'RPO')!;
    expect(rpo.total).toBe(3);
    expect(rpo.joined).toBe(2);
  });
});

describe('recruiter productivity', () => {
  it('n-guards median TTF below minN', () => {
    const prod = recruiterProductivity(rows, 'recruiter', 5);
    const alpha = prod.find((r) => r.name === 'Alpha')!;
    expect(alpha.total).toBe(4);
    expect(alpha.joined).toBe(3);
    expect(alpha.ttf).toBeNull(); // joined (3) < minN (5)
    expect(loadDistribution(rows).recruiters).toBe(2);
  });
});

describe('filters & headline KPIs', () => {
  it('applyFilters narrows by slicer', () => {
    expect(applyFilters(rows, { demandType: ['Replacement'] })).toHaveLength(2);
    expect(distinctValues(rows, 'recruiter')).toEqual(['Alpha', 'Beta']);
  });
  it('headline KPIs', () => {
    const k = headlineKpis(rows);
    expect(k.total).toBe(6);
    expect(k.joined).toBe(3);
    expect(k.open).toBe(2);
    expect(k.medianTtf).toBe(150);
    expect(k.agedOver180).toBe(2);
    expect(k.topSourceShare).toBeCloseTo(0.5);
  });
});
