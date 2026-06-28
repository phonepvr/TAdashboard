/** §7H — recruiter / RPO productivity (n-guarded; PII masked at the UI layer). */
import type { LogicalRole, NormalizedRow } from '../types';
import { durationBetween } from './velocity';
import { median } from './stats';
import type { DurationStats } from './types';

export interface RecruiterLoad {
  /** raw value — the UI masks this unless private drill-down is on. */
  name: string;
  total: number;
  openWip: number;
  joined: number;
  /** median TTF, or null when the joined cohort is below minN (avoids small-sample noise). */
  ttf: DurationStats | null;
}

export function recruiterProductivity(
  rows: NormalizedRow[],
  role: LogicalRole = 'recruiter',
  minN = 5,
): RecruiterLoad[] {
  const groups = new Map<string, NormalizedRow[]>();
  for (const r of rows) {
    const k = r.cat[role] ?? null;
    if (k === null) continue;
    const arr = groups.get(k);
    if (arr) arr.push(r);
    else groups.set(k, [r]);
  }
  return [...groups.entries()]
    .map(([name, gr]) => {
      const joined = gr.filter((r) => r.isJoined).length;
      const ttf = joined >= minN ? durationBetween(gr, 'reqReceivedDate', 'joiningDate') : null;
      return {
        name,
        total: gr.length,
        openWip: gr.filter((r) => r.isOpen).length,
        joined,
        ttf,
      };
    })
    .sort((a, b) => b.openWip - a.openWip || b.total - a.total);
}

export interface LoadSummary {
  recruiters: number;
  maxLoad: number;
  medianLoad: number;
}

export function loadDistribution(rows: NormalizedRow[], role: LogicalRole = 'recruiter'): LoadSummary {
  const loads = recruiterProductivity(rows, role, 0).map((r) => r.total);
  return {
    recruiters: loads.length,
    maxLoad: loads.length ? Math.max(...loads) : 0,
    medianLoad: loads.length ? Math.round(median(loads)) : 0,
  };
}
