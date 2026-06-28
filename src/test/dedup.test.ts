import { describe, expect, it } from 'vitest';
import { normalizeTable } from '../domain/normalize';
import { dedupeRows } from '../domain/dedup';
import { tableFromRecords, defaultMapping, serial, FIXED_TODAY, type Record_ } from './fixtures';

function dedup(records: Record_[]) {
  const table = tableFromRecords(records);
  const rows = normalizeTable(table, defaultMapping(table), { todayMs: FIXED_TODAY });
  return dedupeRows(rows);
}

describe('dedupeRows', () => {
  it('collapses true duplicate ids with latest-record-wins', () => {
    const { rows, summary } = dedup([
      { requisitionId: 'A', positionTitle: 'First', reqReceivedDate: serial(2025, 1, 1) },
      { requisitionId: 'A', positionTitle: 'Second', reqReceivedDate: serial(2025, 1, 1) },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.cat.positionTitle).toBe('Second');
    expect(summary.duplicateGroups).toBe(1);
    expect(summary.rowsDropped).toBe(1);
  });

  it('does NOT collapse a high-frequency placeholder id', () => {
    const records: Record_[] = [];
    for (let i = 0; i < 8; i++) {
      records.push({ requisitionId: 'DRIVE-0', positionTitle: `T${i}`, reqReceivedDate: serial(2025, 1, 1 + i) });
    }
    const { rows, summary } = dedup(records);
    expect(rows).toHaveLength(8); // kept distinct
    expect(summary.highFrequencyIds).toBe(1);
    expect(summary.duplicateGroups).toBe(0);
  });

  it('uses a composite fallback key for blank ids', () => {
    const { rows, summary } = dedup([
      { positionTitle: 'X', reqReceivedDate: serial(2025, 1, 1), recruiter: 'R1' },
      { positionTitle: 'X', reqReceivedDate: serial(2025, 1, 1), recruiter: 'R1' }, // identical -> merge
      { positionTitle: 'Y', reqReceivedDate: serial(2025, 1, 1), recruiter: 'R1' }, // distinct -> keep
    ]);
    expect(rows).toHaveLength(2);
    expect(summary.blankIdRows).toBe(3);
  });
});
