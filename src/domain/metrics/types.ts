/** Shared types for the metric catalogue (§7). All metrics are pure functions. */
import type { LogicalRole } from '../types';

/** Slicer/filter context that drives every view. Empty/undefined => no filter. */
export interface FilterContext {
  calendarYear?: string[];
  businessUnit?: string[];
  function?: string[];
  hrHead?: string[];
  level?: string[];
  recruiter?: string[];
  source?: string[];
  demandType?: string[];
  location?: string[];
  /** period window on reqReceivedDate (epoch ms, inclusive). */
  fromMs?: number;
  toMs?: number;
}

/** The categorical roles usable as slicers. */
export const SLICER_ROLES: LogicalRole[] = [
  'calendarYear',
  'businessUnit',
  'function',
  'hrHead',
  'level',
  'recruiter',
  'source',
  'demandType',
  'location',
];

/** Robust duration summary — median + p25/p75 + n (mean is intentionally avoided). */
export interface DurationStats {
  n: number;
  min: number;
  p25: number;
  median: number;
  p75: number;
  max: number;
}

export interface Bucket {
  key: string;
  count: number;
  share: number; // 0..1
}

export interface TrendPoint {
  month: string; // YYYY-MM
  count: number;
}

export interface NamedDuration {
  key: string;
  label: string;
  stats: DurationStats | null;
}
