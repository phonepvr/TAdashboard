import { describe, expect, it } from 'vitest';
import { normalizeTable } from '../domain/normalize';
import { dedupeRows } from '../domain/dedup';
import {
  byGroupScorecards,
  callouts,
  dropAnalysis,
  reviewComparison,
  scorecard,
  tboWorklist,
  whatChanged,
} from '../domain/metrics';
import { tableFromRecords, defaultMapping, serial, FIXED_TODAY, type Record_ } from './fixtures';

const base = serial(2025, 1, 1);
const joined = (id: string, ttf: number, extra: Record_): Record_ => ({
  requisitionId: id,
  reqReceivedDate: base,
  offerSentDate: base + 70,
  offerAcceptedDate: base + 71,
  joiningDate: base + ttf,
  stage: 'Joined',
  ...extra,
});

const records: Record_[] = [
  joined('1', 100, { hrHead: 'Head One', businessUnit: 'BU1' }),
  joined('2', 150, { hrHead: 'Head One', businessUnit: 'BU1' }),
  joined('3', 300, { hrHead: 'Head Two', businessUnit: 'BU2' }),
  { requisitionId: '4', reqReceivedDate: base, stage: 'Dropped', dropList: 'Some Candidate - Salary mismatch', hrHead: 'Head One', businessUnit: 'BU1' },
  { requisitionId: '5', reqReceivedDate: base, offerAcceptedDate: base + 5, stage: 'Offer Stage', hrHead: 'Head Two', businessUnit: 'BU2' },
];

const table = tableFromRecords(records);
const { rows } = dedupeRows(normalizeTable(table, defaultMapping(table), { todayMs: FIXED_TODAY }));
const head1 = rows.filter((r) => r.cat.hrHead === 'Head One');

describe('review metrics', () => {
  it('scorecard summarizes a row set', () => {
    const s = scorecard(rows);
    expect(s.n).toBe(5);
    expect(s.joined).toBe(3);
    expect(s.tbo).toBe(1);
    expect(s.dropRate).toBeCloseTo(1 / 5);
  });

  it('extracts a name-stripped drop reason', () => {
    expect(rows.find((r) => r.reqId === '4')!.dropReason).toBe('Salary mismatch');
    const da = dropAnalysis(rows);
    expect(da.count).toBe(1);
    expect(da.reasons[0]!.key).toBe('Salary mismatch');
  });

  it('TBO worklist lists offer-accepted-not-joined', () => {
    const tbo = tboWorklist(rows);
    expect(tbo).toHaveLength(1);
    expect(tbo[0]!.reqId).toBe('5');
  });

  it('compares scope vs org baseline', () => {
    const cmp = reviewComparison(head1, rows);
    const ttf = cmp.find((c) => c.key === 'ttf')!;
    expect(ttf.scope).toBe(125); // median(100,150)
    expect(ttf.baseline).toBe(150); // median(100,150,300)
    expect(ttf.direction).toBe('lowerBetter');
  });

  it('per-group scorecards', () => {
    const byBu = byGroupScorecards(rows, 'businessUnit');
    expect(byBu.find((g) => g.group === 'BU1')!.n).toBe(3);
    expect(byBu.find((g) => g.group === 'BU2')!.n).toBe(2);
  });

  it('generates plain-english callouts', () => {
    expect(callouts(rows).length).toBeGreaterThan(0);
  });

  it('whatChanged returns the four headline deltas', () => {
    const c = whatChanged(rows, FIXED_TODAY);
    expect(c.map((x) => x.key)).toEqual(['reqs', 'joins', 'ttf', 'accept']);
  });
});
