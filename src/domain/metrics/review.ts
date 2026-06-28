/** §8.2 building blocks — scorecards, scope-vs-baseline, worklists, drop analysis, callouts. */
import type { LogicalRole, NormalizedRow } from '../types';
import { distribution, groupBy, share } from './stats';
import { pipelineSnapshot } from './volume';
import { timeToFill } from './velocity';
import { offerAcceptanceRate, dropRate } from './conversion';
import { genderRatio } from './diversity';
import { sourceMix } from './source';
import type { Bucket } from './types';

export interface Scorecard {
  n: number;
  joined: number;
  open: number;
  tbo: number;
  medianTtf: number | null;
  ttfN: number;
  acceptance: number;
  pctAged180: number;
  femaleShareKnown: number;
  unknownGenderShare: number;
  dropRate: number;
  topSource: string | null;
}

export function scorecard(rows: NormalizedRow[]): Scorecard {
  const snap = pipelineSnapshot(rows);
  const ttf = timeToFill(rows);
  const g = genderRatio(rows);
  const aged180 = rows.filter((r) => r.isOpen && (r.num.ageingDays ?? 0) > 180).length;
  return {
    n: rows.length,
    joined: snap.joined,
    open: snap.open,
    tbo: snap.tbo,
    medianTtf: ttf?.median ?? null,
    ttfN: ttf?.n ?? 0,
    acceptance: offerAcceptanceRate(rows).rate,
    pctAged180: share(aged180, snap.open),
    femaleShareKnown: g.femaleShareKnown,
    unknownGenderShare: g.unknownShare,
    dropRate: dropRate(rows).share,
    topSource: sourceMix(rows)[0]?.key ?? null,
  };
}

export type CompareDirection = 'lowerBetter' | 'higherBetter' | 'neutral';
export interface KpiCompare {
  key: string;
  label: string;
  scope: number | null;
  baseline: number | null;
  unit: 'days' | 'pct';
  direction: CompareDirection;
}

/** Scope (e.g. an HR head's reqs) vs the org baseline, KPI by KPI. */
export function reviewComparison(scopeRows: NormalizedRow[], allRows: NormalizedRow[]): KpiCompare[] {
  const s = scorecard(scopeRows);
  const b = scorecard(allRows);
  return [
    { key: 'ttf', label: 'Median TTF', scope: s.medianTtf, baseline: b.medianTtf, unit: 'days', direction: 'lowerBetter' },
    { key: 'aged180', label: '% open aged > 180d', scope: s.pctAged180, baseline: b.pctAged180, unit: 'pct', direction: 'lowerBetter' },
    { key: 'drop', label: 'Drop rate', scope: s.dropRate, baseline: b.dropRate, unit: 'pct', direction: 'lowerBetter' },
    { key: 'accept', label: 'Offer acceptance', scope: s.acceptance, baseline: b.acceptance, unit: 'pct', direction: 'higherBetter' },
    { key: 'female', label: 'Female share (known)', scope: s.femaleShareKnown, baseline: b.femaleShareKnown, unit: 'pct', direction: 'neutral' },
    { key: 'unknownG', label: 'Unknown gender', scope: s.unknownGenderShare, baseline: b.unknownGenderShare, unit: 'pct', direction: 'lowerBetter' },
  ];
}

export interface GroupScorecard extends Scorecard {
  group: string;
}

export function byGroupScorecards(rows: NormalizedRow[], role: LogicalRole): GroupScorecard[] {
  const groups = groupBy(rows, (r) => r.cat[role] ?? null);
  return [...groups.entries()]
    .map(([group, gr]) => ({ group, ...scorecard(gr) }))
    .sort((a, b) => b.n - a.n);
}

export interface TboItem {
  i: number;
  reqId: string | null;
  positionTitle: string | null;
  businessUnit: string | null;
  tboAgeingDays: number | null;
  nextFollowUp: number | null;
  recruiter: string | null;
  hrHead: string | null;
}

/** Offer-accepted, awaiting-join pipeline, oldest first. */
export function tboWorklist(rows: NormalizedRow[]): TboItem[] {
  return rows
    .filter((r) => r.isTBO)
    .map((r) => ({
      i: r.i,
      reqId: r.reqId,
      positionTitle: r.cat.positionTitle ?? null,
      businessUnit: r.cat.businessUnit ?? null,
      tboAgeingDays: r.num.tboAgeingDays ?? null,
      nextFollowUp: r.date.nextFollowUp ?? null,
      recruiter: r.cat.recruiter ?? null,
      hrHead: r.cat.hrHead ?? null,
    }))
    .sort((a, b) => (b.tboAgeingDays ?? 0) - (a.tboAgeingDays ?? 0));
}

export interface DropAnalysis {
  count: number;
  rate: number;
  reasons: Bucket[];
}

export function dropAnalysis(rows: NormalizedRow[]): DropAnalysis {
  const dropped = rows.filter((r) => r.wasDropped);
  return {
    count: dropped.length,
    rate: share(dropped.length, rows.length),
    reasons: distribution(dropped, (r) => r.dropReason),
  };
}

/** Plain-English callouts from thresholds, for the Executive Summary. */
export function callouts(allRows: NormalizedRow[]): string[] {
  const out: string[] = [];
  const org = scorecard(allRows);

  if (org.medianTtf !== null) {
    const worst = byGroupScorecards(allRows, 'businessUnit')
      .filter((g) => g.ttfN >= 10 && g.medianTtf !== null && g.medianTtf > org.medianTtf! + 30)
      .sort((a, b) => (b.medianTtf ?? 0) - (a.medianTtf ?? 0))[0];
    if (worst) {
      out.push(`TTF in ${worst.group} is ${Math.round(worst.medianTtf! - org.medianTtf!)}d above the org median (${worst.medianTtf}d vs ${org.medianTtf}d, n=${worst.ttfN}).`);
    }
  }

  const aged180 = allRows.filter((r) => r.isOpen && (r.num.ageingDays ?? 0) > 180).length;
  if (aged180 > 0) out.push(`${aged180} open requisition(s) are aged over 180 days — see the watchlist.`);

  if (org.tbo > 0) out.push(`${org.tbo} offer(s) accepted and awaiting join (TBO).`);

  if (org.unknownGenderShare > 0.2) {
    out.push(`Gender is unknown for ${Math.round(org.unknownGenderShare * 100)}% of records — diversity figures exclude these from "known".`);
  }

  const acc = offerAcceptanceRate(allRows);
  if (acc.likelyArtifact) out.push(`Offer-acceptance reads ${Math.round(acc.rate * 100)}% — likely a logging artifact (declined offers not captured), not a true rate.`);

  return out;
}
