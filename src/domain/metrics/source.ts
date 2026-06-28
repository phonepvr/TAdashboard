/** §7G — source effectiveness: mix, conversion, median TTF by source. */
import type { NormalizedRow } from '../types';
import { distribution, groupBy, share } from './stats';
import { durationBetween } from './velocity';
import type { Bucket, DurationStats } from './types';

export function sourceMix(rows: NormalizedRow[]): Bucket[] {
  return distribution(rows, (r) => r.cat.source ?? null);
}

export interface SourcePerformance {
  source: string;
  total: number;
  joined: number;
  joinRate: number;
  ttf: DurationStats | null;
}

export function sourceConversion(rows: NormalizedRow[]): SourcePerformance[] {
  const groups = groupBy(rows, (r) => r.cat.source ?? null);
  return [...groups.entries()]
    .map(([source, gr]) => {
      const joined = gr.filter((r) => r.isJoined).length;
      return {
        source,
        total: gr.length,
        joined,
        joinRate: share(joined, gr.length),
        ttf: durationBetween(gr, 'reqReceivedDate', 'joiningDate'),
      };
    })
    .sort((a, b) => b.total - a.total);
}

export function referralShare(rows: NormalizedRow[]): number {
  const mix = sourceMix(rows);
  return mix.find((b) => b.key === 'Employee Referral')?.share ?? 0;
}
