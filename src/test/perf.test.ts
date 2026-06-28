import { describe, expect, it } from 'vitest';
import { generateDemoTable } from '../domain/demo';
import { buildDefaultMapping } from '../domain/mapping';
import { normalizeTable } from '../domain/normalize';
import { dedupeRows } from '../domain/dedup';
import { computeDataQuality } from '../domain/dq';
import { demandForecast, headlineKpis, openReqEtas, projectedJoins } from '../domain/metrics';
import { FIXED_TODAY } from './fixtures';

// Scale test: the whole pure pipeline must stay within budget at ~50k rows.
// (Parsing + this run all happen in a Web Worker in the app, so the UI stays
// responsive; here we assert the compute cost itself.)
describe('performance @ 50k rows', () => {
  it('normalizes, de-dups, scores DQ and computes headline metrics within budget', () => {
    const ROWS = 50_000;
    const BUDGET_MS = 12_000; // generous to avoid CI flakiness; locally far faster

    const t0 = Date.now();
    const table = generateDemoTable({ rows: ROWS, seed: 5, nowMs: FIXED_TODAY });
    const mapping = buildDefaultMapping(table.headers, 0);
    const normalized = normalizeTable(table, mapping, { todayMs: FIXED_TODAY });
    const { rows } = dedupeRows(normalized);
    const dq = computeDataQuality(table, mapping, rows, { todayMs: FIXED_TODAY });
    const kpis = headlineKpis(rows);
    demandForecast(rows);
    projectedJoins(rows, 3, FIXED_TODAY);
    openReqEtas(rows, FIXED_TODAY);
    const elapsed = Date.now() - t0;

    // eslint-disable-next-line no-console
    console.log(`[perf] 50k rows full pipeline: ${elapsed}ms (kpis.total=${kpis.total}, dqScore=${dq.score.overall})`);

    expect(table.rows.length).toBe(ROWS);
    expect(kpis.total).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(BUDGET_MS);
  });
});
