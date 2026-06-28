/** §7E — ageing & risk: distribution, aged-open worklist, reason Pareto, SLA. */
import type { NormalizedRow } from '../types';
import { dayDiff } from '../dates';
import { AGE_BUCKET_LABELS } from '../normalize';
import { distribution, share } from './stats';
import type { Bucket } from './types';

/** Ageing distribution for OPEN reqs, in canonical bucket order. */
export function ageingDistribution(rows: NormalizedRow[]): Bucket[] {
  const open = rows.filter((r) => r.isOpen);
  const raw = new Map(distribution(open, (r) => r.cat.ageingBucket ?? null).map((b) => [b.key, b]));
  const total = open.length;
  return AGE_BUCKET_LABELS.map((label) => {
    const b = raw.get(label);
    return { key: label, count: b?.count ?? 0, share: share(b?.count ?? 0, total) };
  });
}

export interface AgedReq {
  i: number;
  reqId: string | null;
  positionTitle: string | null;
  businessUnit: string | null;
  function: string | null;
  stage: string | null;
  ageDays: number;
  hrHead: string | null;
  recruiter: string | null;
}

/** Open requisitions older than `thresholdDays`, oldest first — the review worklist. */
export function agedOpenWorklist(rows: NormalizedRow[], thresholdDays = 90): AgedReq[] {
  const out: AgedReq[] = [];
  for (const r of rows) {
    if (!r.isOpen) continue;
    const age = r.num.ageingDays ?? null;
    if (age === null || age <= thresholdDays) continue;
    out.push({
      i: r.i,
      reqId: r.reqId,
      positionTitle: r.cat.positionTitle ?? null,
      businessUnit: r.cat.businessUnit ?? null,
      function: r.cat.function ?? null,
      stage: r.cat.stage ?? null,
      ageDays: age,
      hrHead: r.cat.hrHead ?? null,
      recruiter: r.cat.recruiter ?? null,
    });
  }
  return out.sort((a, b) => b.ageDays - a.ageDays);
}

/** Ageing-reason Pareto among open reqs (where a reason is present). */
export function ageingReasonPareto(rows: NormalizedRow[]): Bucket[] {
  return distribution(
    rows.filter((r) => r.isOpen),
    (r) => r.cat.ageingReason ?? null,
  );
}

export interface SlaView {
  targetDays: number;
  cohort: number;
  breaches: number;
  share: number;
}

/** Joined cohort vs a configurable TTF target. */
export function slaBreach(rows: NormalizedRow[], targetDays = 90): SlaView {
  let cohort = 0;
  let breaches = 0;
  for (const r of rows) {
    const req = r.date.reqReceivedDate ?? null;
    const join = r.date.joiningDate ?? null;
    if (req === null || join === null) continue;
    const ttf = dayDiff(req, join);
    if (ttf < 0) continue;
    cohort++;
    if (ttf > targetDays) breaches++;
  }
  return { targetDays, cohort, breaches, share: share(breaches, cohort) };
}
