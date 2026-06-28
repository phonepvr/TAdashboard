import { describe, expect, it } from 'vitest';
import { generateDemoTable } from '../domain/demo';
import { autoMapHeaders, buildDefaultMapping } from '../domain/mapping';
import { normalizeTable } from '../domain/normalize';
import { dedupeRows } from '../domain/dedup';
import { computeDataQuality } from '../domain/dq';
import { ROLES } from '../domain/schema';
import { FIXED_TODAY } from './fixtures';

describe('synthetic demo generator', () => {
  it('produces the full header set and requested rows, badged as demo', () => {
    const t = generateDemoTable({ rows: 300, seed: 42, nowMs: FIXED_TODAY });
    expect(t.headers).toHaveLength(ROLES.length);
    expect(t.rows).toHaveLength(300);
    expect(t.isDemo).toBe(true);
  });

  it('is fully auto-mappable and flows through the whole pipeline', () => {
    const t = generateDemoTable({ rows: 400, seed: 7, nowMs: FIXED_TODAY });
    const mapping = buildDefaultMapping(t.headers, 0);
    const mapped = Object.values(autoMapHeaders(t.headers)).filter(Boolean).length;
    expect(mapped).toBe(ROLES.length);

    const { rows } = dedupeRows(normalizeTable(t, mapping, { todayMs: FIXED_TODAY }));
    expect(rows.some((r) => r.isJoined)).toBe(true);
    expect(rows.some((r) => r.isTBO)).toBe(true);
    expect(rows.some((r) => r.wasDropped)).toBe(true);

    const dq = computeDataQuality(t, mapping, rows, { todayMs: FIXED_TODAY });
    expect(dq.score.overall).toBeGreaterThan(0);
    // demo deliberately injects broken columns + vocab noise
    expect(dq.broken.length).toBeGreaterThan(0);
    expect(dq.vocab.length).toBeGreaterThan(0);
  });

  it('is deterministic for a given seed', () => {
    const a = generateDemoTable({ rows: 50, seed: 99, nowMs: FIXED_TODAY });
    const b = generateDemoTable({ rows: 50, seed: 99, nowMs: FIXED_TODAY });
    expect(JSON.stringify(a.rows[0])).toBe(JSON.stringify(b.rows[0]));
  });
});
