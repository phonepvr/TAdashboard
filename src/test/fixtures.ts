/** Synthetic, in-code fixtures for unit tests. No real data, ever. */
import { ROLES } from '../domain/schema';
import { buildDefaultMapping } from '../domain/mapping';
import { DAY_MS } from '../domain/dates';
import type { LogicalRole, MappingConfig, ParsedTable, RawCell } from '../domain/types';

export const FIXED_TODAY = Date.UTC(2026, 5, 28); // 2026-06-28

const HEADERS = ROLES.map((r) => r.defaultHeaders[0]!);
const ROLE_INDEX = new Map<LogicalRole, number>(ROLES.map((r, i) => [r.key, i]));

export type Record_ = Partial<Record<LogicalRole, RawCell>>;

export function tableFromRecords(records: Record_[], fileName = 'fixture'): ParsedTable {
  const rows = records.map((rec) => {
    const row: RawCell[] = new Array(HEADERS.length).fill(null);
    for (const [role, val] of Object.entries(rec) as [LogicalRole, RawCell][]) {
      const idx = ROLE_INDEX.get(role);
      if (idx !== undefined) row[idx] = val ?? null;
    }
    return row;
  });
  return { headers: HEADERS, rows, sheetName: 'Sheet1', fileName };
}

export function defaultMapping(table: ParsedTable): MappingConfig {
  return buildDefaultMapping(table.headers, 0);
}

/** Excel serial for a UTC y-m-d (matches the parser's 1900 date system). */
export function serial(y: number, m1: number, d: number): number {
  return Math.round(Date.UTC(y, m1 - 1, d) / DAY_MS) + 25569;
}
