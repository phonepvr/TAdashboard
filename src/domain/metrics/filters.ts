/** Filter context application + slicer option discovery. */
import type { LogicalRole, NormalizedRow } from '../types';
import type { FilterContext } from './types';
import { SLICER_ROLES } from './types';

function matches(row: NormalizedRow, role: LogicalRole, allowed: string[] | undefined): boolean {
  if (!allowed || allowed.length === 0) return true;
  const v = row.cat[role] ?? null;
  return v !== null && allowed.includes(v);
}

export function applyFilters(rows: NormalizedRow[], f: FilterContext): NormalizedRow[] {
  return rows.filter((r) => {
    if (!matches(r, 'calendarYear', f.calendarYear)) return false;
    if (!matches(r, 'businessUnit', f.businessUnit)) return false;
    if (!matches(r, 'function', f.function)) return false;
    if (!matches(r, 'hrHead', f.hrHead)) return false;
    if (!matches(r, 'level', f.level)) return false;
    if (!matches(r, 'recruiter', f.recruiter)) return false;
    if (!matches(r, 'source', f.source)) return false;
    if (!matches(r, 'demandType', f.demandType)) return false;
    if (!matches(r, 'location', f.location)) return false;
    if (f.fromMs !== undefined || f.toMs !== undefined) {
      const d = r.date.reqReceivedDate ?? null;
      if (d === null) return false;
      if (f.fromMs !== undefined && d < f.fromMs) return false;
      if (f.toMs !== undefined && d > f.toMs) return false;
    }
    return true;
  });
}

/** Distinct non-null values for a slicer role, sorted, for building filter options. */
export function distinctValues(rows: NormalizedRow[], role: LogicalRole): string[] {
  const s = new Set<string>();
  for (const r of rows) {
    const v = r.cat[role] ?? null;
    if (v !== null) s.add(v);
  }
  return [...s].sort((a, b) => a.localeCompare(b));
}

/** All slicer options at once (for the global filter bar). */
export function slicerOptions(rows: NormalizedRow[]): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const role of SLICER_ROLES) out[role] = distinctValues(rows, role);
  return out;
}
