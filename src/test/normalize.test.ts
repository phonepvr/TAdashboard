import { describe, expect, it } from 'vitest';
import {
  ageBucket,
  canonicalizeBoolean,
  canonicalizeCategory,
  coerceNumber,
  normalizeLevel,
  normalizeTable,
  normStr,
} from '../domain/normalize';
import { tableFromRecords, defaultMapping, serial, FIXED_TODAY } from './fixtures';

describe('string / number helpers', () => {
  it('normStr trims, strips NBSP + controls, collapses spaces', () => {
    expect(normStr('  a  b  ')).toBe('a b');
    expect(normStr('')).toBeNull();
    expect(normStr('   ')).toBeNull();
    expect(normStr(null)).toBeNull();
  });

  it('coerceNumber handles separators and rejects junk', () => {
    expect(coerceNumber('1,234')).toBe(1234);
    expect(coerceNumber('  42 ')).toBe(42);
    expect(coerceNumber('abc')).toBeNull();
    expect(coerceNumber(null)).toBeNull();
  });

  it('normalizeLevel unifies grade formats', () => {
    expect(normalizeLevel('M-9')).toBe('M9');
    expect(normalizeLevel('M 10')).toBe('M10');
    expect(normalizeLevel('m9')).toBe('M9');
  });
});

describe('canonicalization', () => {
  it('maps demand-type variants and flags violations', () => {
    expect(canonicalizeCategory('demandType', 'new').value).toBe('New');
    expect(canonicalizeCategory('demandType', 'Replacement ').value).toBe('Replacement');
    const junk = canonicalizeCategory('demandType', 'Some Name');
    expect(junk.matched).toBe(false);
    expect(junk.value).toBe('Unknown');
    expect(junk.token).toBe('Some Name');
  });

  it('honours value overrides', () => {
    const res = canonicalizeCategory('gender', 'M', { m: 'Male' });
    expect(res.value).toBe('Male');
  });

  it('maps booleans and flags non-boolean tokens', () => {
    expect(canonicalizeBoolean('Yes').value).toBe(true);
    expect(canonicalizeBoolean('no').value).toBe(false);
    const bad = canonicalizeBoolean('maybe');
    expect(bad.value).toBeNull();
    expect(bad.matched).toBe(false);
  });

  it('ageBucket is monotonic and bounded', () => {
    expect(ageBucket(15)).toBe(ageBucket(20));
    expect(ageBucket(15)).not.toBe(ageBucket(45));
    expect(ageBucket(400)).toBe(ageBucket(999));
    expect(ageBucket(-1)).toBeNull();
    expect(ageBucket(null)).toBeNull();
  });
});

describe('normalizeTable derived status', () => {
  const table = tableFromRecords([
    { requisitionId: 'A', stage: 'Joined', reqReceivedDate: serial(2025, 1, 1), joiningDate: serial(2025, 6, 1), offerAcceptedDate: serial(2025, 5, 20) },
    { requisitionId: 'B', stage: 'Offer Stage', reqReceivedDate: serial(2025, 1, 1), offerAcceptedDate: serial(2025, 3, 1) },
    { requisitionId: 'C', stage: 'On Hold', reqReceivedDate: serial(2024, 1, 1) },
    { requisitionId: 'D', stage: 'Dropped', reqReceivedDate: serial(2025, 1, 1), dropList: 'Candidate Name - declined' },
  ]);
  const rows = normalizeTable(table, defaultMapping(table), { todayMs: FIXED_TODAY });

  it('classifies joined / open / TBO / hold / dropped', () => {
    const [a, b, c, d] = rows;
    expect(a!.isJoined).toBe(true);
    expect(a!.isOpen).toBe(false);
    expect(a!.num.ageingDays).toBe(151); // Jan 1 -> Jun 1 2025

    expect(b!.isTBO).toBe(true);
    expect(b!.isJoined).toBe(false);
    expect(b!.isOpen).toBe(true);

    expect(c!.isOnHold).toBe(true);
    expect(c!.isOpen).toBe(true);

    expect(d!.wasDropped).toBe(true);
    expect(d!.isOpen).toBe(false);
  });

  it('recomputes open-req ageing against today', () => {
    const c = rows[2]!;
    // open since 2024-01-01, "today" fixed 2026-06-28
    expect(c.num.ageingDays).toBe(Math.round((FIXED_TODAY - Date.UTC(2024, 0, 1)) / 86_400_000));
  });
});
