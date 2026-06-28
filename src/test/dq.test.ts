import { describe, expect, it } from 'vitest';
import { normalizeTable } from '../domain/normalize';
import { dedupeRows } from '../domain/dedup';
import { computeDataQuality } from '../domain/dq';
import { tableFromRecords, defaultMapping, serial, FIXED_TODAY } from './fixtures';

const table = tableFromRecords([
  // accept (Feb) BEFORE sent (Mar) => impossible
  {
    requisitionId: '1',
    demandType: 'New',
    reqReceivedDate: serial(2025, 1, 1),
    offerSentDate: serial(2025, 3, 1),
    offerAcceptedDate: serial(2025, 2, 1),
    joiningDate: serial(2025, 4, 1),
    stage: 'Joined',
  },
  // vocab violation + junk date (missing, not invalid)
  { requisitionId: '2', demandType: 'Banana', reqReceivedDate: 'Awaited', stage: 'Sourcing' },
  // join (2024) before req (2025) => impossible
  { requisitionId: '3', demandType: 'Replacement', reqReceivedDate: serial(2025, 1, 1), joiningDate: serial(2024, 1, 1), stage: 'Joined' },
]);
const mapping = defaultMapping(table);
const { rows } = dedupeRows(normalizeTable(table, mapping, { todayMs: FIXED_TODAY }));
const dq = computeDataQuality(table, mapping, rows, { todayMs: FIXED_TODAY });

describe('computeDataQuality', () => {
  it('detects controlled-vocabulary violations with the offending token', () => {
    const v = dq.vocab.find((x) => x.role === 'demandType');
    expect(v).toBeTruthy();
    expect(v!.unmatchedTokens.map((t) => t.token)).toContain('Banana');
  });

  it('separates missing vs invalid in date health', () => {
    const req = dq.dateHealth.find((d) => d.role === 'reqReceivedDate')!;
    expect(req.valid).toBe(2);
    expect(req.missing).toBe(1); // "Awaited" -> missing
    expect(req.invalid).toBe(0);
  });

  it('flags impossible sequences', () => {
    const keys = dq.consistency.map((c) => c.key);
    expect(keys).toContain('accept_before_sent');
    expect(keys).toContain('join_before_req');
  });

  it('auto-flags fully-empty columns as broken', () => {
    expect(dq.broken.some((b) => b.role === 'kcheckNo')).toBe(true);
    expect(dq.broken.some((b) => b.role === 'employeeNo')).toBe(true);
  });

  it('keeps a fully-populated field out of the broken list', () => {
    const demand = dq.completeness.find((c) => c.role === 'demandType')!;
    expect(demand.pct).toBe(100);
    expect(demand.broken).toBe(false);
  });

  it('produces a bounded, transparent score', () => {
    for (const k of ['overall', 'completeness', 'validity', 'consistency'] as const) {
      expect(dq.score[k]).toBeGreaterThanOrEqual(0);
      expect(dq.score[k]).toBeLessThanOrEqual(100);
    }
  });
});
