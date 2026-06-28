/**
 * Metric catalogue (§7) — pure functions over the normalized dataset.
 * Apply a FilterContext first (applyFilters) to scope any metric to a slice.
 */
export * from './types';
export * from './stats';
export * from './filters';
export * from './volume';
export * from './velocity';
export * from './conversion';
export * from './ageing';
export * from './diversity';
export * from './source';
export * from './recruiter';

import type { NormalizedRow } from '../types';
import { pipelineSnapshot } from './volume';
import { timeToFill } from './velocity';
import { offerAcceptanceRate } from './conversion';
import { genderRatio } from './diversity';
import { sourceMix } from './source';

/**
 * External benchmarks — display as faint reference lines only, clearly labelled
 * "external benchmark — calibrate to your own history". The PRIMARY baseline is
 * always the org's own trailing median.
 */
export const BENCHMARKS = {
  ttfDaysManagerToDirector: [45, 75] as const,
  ttfDaysSeniorExec: 90,
  offerAcceptanceAvg: 0.67,
  offerAcceptanceBestInClass: 0.85,
  funnelDropoff: [0.3, 0.5] as const,
};

/** Things this schema CANNOT measure — surfaced so leadership sees the roadmap. */
export const NOT_COMPUTABLE: { metric: string; reason: string; capture: string }[] = [
  { metric: 'Quality of Hire / first-year attrition', reason: 'no post-join outcome fields', capture: 'performance & retention at 90/180/365 days' },
  { metric: 'Cost-per-hire / source cost', reason: 'no cost fields', capture: 'agency fees, job-board spend, referral payouts per req' },
  { metric: 'Candidate experience / NPS', reason: 'no candidate feedback fields', capture: 'post-interview & post-offer surveys' },
  { metric: 'Applicants per opening (top-of-funnel)', reason: 'pipeline starts at requisition', capture: 'application counts per req from the ATS' },
  { metric: 'Reliable Offer Acceptance Rate', reason: 'declined offers appear not to be logged', capture: 'record offers that were declined, with reason' },
  { metric: 'Onboarding / BGV / medical cycle time', reason: 'those columns are empty or mixed-type', capture: 'consistent dates for medical & BGV initiation/completion' },
];

export interface HeadlineKpis {
  total: number;
  open: number;
  joined: number;
  tbo: number;
  pctOpen: number;
  medianTtf: number | null;
  ttfN: number;
  acceptanceRate: number;
  acceptanceLikelyArtifact: boolean;
  agedOver180: number;
  femaleShareKnown: number;
  unknownGenderShare: number;
  topSourceShare: number;
}

export function headlineKpis(rows: NormalizedRow[]): HeadlineKpis {
  const snap = pipelineSnapshot(rows);
  const ttf = timeToFill(rows);
  const acc = offerAcceptanceRate(rows);
  const gender = genderRatio(rows);
  const mix = sourceMix(rows);
  const agedOver180 = rows.filter((r) => r.isOpen && (r.num.ageingDays ?? 0) > 180).length;
  return {
    total: snap.total,
    open: snap.open,
    joined: snap.joined,
    tbo: snap.tbo,
    pctOpen: snap.pctOpen,
    medianTtf: ttf?.median ?? null,
    ttfN: ttf?.n ?? 0,
    acceptanceRate: acc.rate,
    acceptanceLikelyArtifact: acc.likelyArtifact,
    agedOver180,
    femaleShareKnown: gender.femaleShareKnown,
    unknownGenderShare: gender.unknownShare,
    topSourceShare: mix[0]?.share ?? 0,
  };
}
