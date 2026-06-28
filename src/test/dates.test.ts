import { describe, expect, it } from 'vitest';
import { defaultWindow, parseDateCell, dayDiff, monthKey, DAY_MS } from '../domain/dates';
import { serial, FIXED_TODAY } from './fixtures';

const W = defaultWindow(FIXED_TODAY);
const expectValid = (v: unknown, y: number, m: number, d: number) => {
  const p = parseDateCell(v as never, W);
  expect(p.status).toBe('valid');
  expect(p.ms).toBe(Date.UTC(y, m - 1, d));
};

describe('parseDateCell', () => {
  it('parses Excel serials to UTC midnight', () => {
    expectValid(serial(2025, 6, 15), 2025, 6, 15);
  });

  it('parses dd-MMM-yy', () => {
    expectValid('15-Jun-25', 2025, 6, 15);
  });

  it('parses day-first dd/MM/yyyy', () => {
    expectValid('15/06/2025', 2025, 6, 15);
  });

  it('parses ISO yyyy-mm-dd', () => {
    expectValid('2025-06-15', 2025, 6, 15);
  });

  it('prefers day-first for ambiguous numeric dates', () => {
    // 06/07/2025 -> 6 July 2025 (day first), not 7 June
    expectValid('06/07/2025', 2025, 7, 6);
  });

  it('treats blank / NBSP / free text as MISSING (not invalid)', () => {
    for (const v of [null, '', ' ', '   ', 'Awaited', 'Dropped', 'Yes']) {
      expect(parseDateCell(v as never, W).status).toBe('missing');
    }
  });

  it('treats epoch / out-of-window real dates as INVALID (separate from missing)', () => {
    expect(parseDateCell(serial(1970, 1, 1), W).status).toBe('invalid');
    expect(parseDateCell('1970-01-01', W).status).toBe('invalid');
    expect(parseDateCell('2019-01-01', W).status).toBe('invalid'); // before window lo
    expect(parseDateCell(serial(2030, 1, 1), W).status).toBe('invalid'); // beyond today+365
  });

  it('rejects impossible calendar dates', () => {
    expect(parseDateCell('31-Feb-25', W).status).toBe('missing');
  });

  it('dayDiff and monthKey work in whole UTC days', () => {
    expect(dayDiff(Date.UTC(2025, 0, 1), Date.UTC(2025, 0, 11))).toBe(10);
    expect((Date.UTC(2025, 0, 11) - Date.UTC(2025, 0, 1)) / DAY_MS).toBe(10);
    expect(monthKey(Date.UTC(2025, 5, 15))).toBe('2025-06');
  });
});
