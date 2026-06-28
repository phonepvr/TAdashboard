/** §7C — velocity / cycle time. Medians (+ p25/p75, n); outliers clamped. */
import type { LogicalRole, NormalizedRow } from '../types';
import { dayDiff } from '../dates';
import { durationStats, groupBy } from './stats';
import type { DurationStats, NamedDuration } from './types';

export const TTF_CAP_DEFAULT = 540;

/** Durations (days) between two date roles over rows where both are valid, clamped [0,cap]. */
export function durationValues(
  rows: NormalizedRow[],
  fromRole: LogicalRole,
  toRole: LogicalRole,
  cap = TTF_CAP_DEFAULT,
): number[] {
  const out: number[] = [];
  for (const r of rows) {
    const a = r.date[fromRole] ?? null;
    const b = r.date[toRole] ?? null;
    if (a === null || b === null) continue;
    const d = dayDiff(a, b);
    if (d >= 0 && d <= cap) out.push(d);
  }
  return out;
}

export function durationBetween(
  rows: NormalizedRow[],
  fromRole: LogicalRole,
  toRole: LogicalRole,
  cap = TTF_CAP_DEFAULT,
): DurationStats | null {
  return durationStats(durationValues(rows, fromRole, toRole, cap));
}

export const timeToFill = (rows: NormalizedRow[], cap = TTF_CAP_DEFAULT) =>
  durationBetween(rows, 'reqReceivedDate', 'joiningDate', cap);
export const timeToOffer = (rows: NormalizedRow[]) =>
  durationBetween(rows, 'reqReceivedDate', 'offerSentDate');
export const offerToAccept = (rows: NormalizedRow[]) =>
  durationBetween(rows, 'offerSentDate', 'offerAcceptedDate', 120);
export const acceptToJoin = (rows: NormalizedRow[]) =>
  durationBetween(rows, 'offerAcceptedDate', 'joiningDate', 365);
export const intakeLag = (rows: NormalizedRow[]) =>
  durationBetween(rows, 'reqReceivedDate', 'intakeDate', 180);
export const offerApprovalCycle = (rows: NormalizedRow[]) =>
  durationBetween(rows, 'sentForApprovalDate', 'offerApprovalDate', 120);
export const draftOfferCycle = (rows: NormalizedRow[]) =>
  durationBetween(rows, 'draftOfferSentDate', 'draftOfferApprovedDate', 120);

/** The headline velocity decomposition: median days per funnel segment. */
export const VELOCITY_SEGMENTS: { key: string; label: string; from: LogicalRole; to: LogicalRole }[] = [
  { key: 'req_intake', label: 'Req → Intake', from: 'reqReceivedDate', to: 'intakeDate' },
  { key: 'intake_selection', label: 'Intake → Selection', from: 'intakeDate', to: 'selectionDate' },
  { key: 'selection_offer', label: 'Selection → Offer sent', from: 'selectionDate', to: 'offerSentDate' },
  { key: 'offer_accept', label: 'Offer sent → Accepted', from: 'offerSentDate', to: 'offerAcceptedDate' },
  { key: 'accept_join', label: 'Accepted → Joined', from: 'offerAcceptedDate', to: 'joiningDate' },
];

export function velocityDecomposition(rows: NormalizedRow[], cap = TTF_CAP_DEFAULT): NamedDuration[] {
  return VELOCITY_SEGMENTS.map((s) => ({
    key: s.key,
    label: s.label,
    stats: durationBetween(rows, s.from, s.to, cap),
  }));
}

/** The segment where the most time accumulates (largest median dwell). */
export function bottleneck(decomp: NamedDuration[]): NamedDuration | null {
  let best: NamedDuration | null = null;
  for (const d of decomp) {
    if (!d.stats) continue;
    if (!best || (best.stats && d.stats.median > best.stats.median)) best = d;
  }
  return best;
}

/** TTF distribution as fixed-width histogram bins (days). */
export function ttfHistogram(rows: NormalizedRow[], binSize = 30, cap = TTF_CAP_DEFAULT): { bin: string; lo: number; count: number }[] {
  const vals = durationValues(rows, 'reqReceivedDate', 'joiningDate', cap);
  const bins = new Map<number, number>();
  for (const v of vals) {
    const b = Math.floor(v / binSize);
    bins.set(b, (bins.get(b) ?? 0) + 1);
  }
  const maxBin = bins.size ? Math.max(...bins.keys()) : -1;
  const out: { bin: string; lo: number; count: number }[] = [];
  for (let b = 0; b <= maxBin; b++) {
    const lo = b * binSize;
    out.push({ bin: `${lo}–${lo + binSize}`, lo, count: bins.get(b) ?? 0 });
  }
  return out;
}

/** Median TTF (or any duration) grouped by a categorical role, with n guard. */
export function durationByGroup(
  rows: NormalizedRow[],
  role: LogicalRole,
  fromRole: LogicalRole,
  toRole: LogicalRole,
  cap = TTF_CAP_DEFAULT,
): { group: string; stats: DurationStats | null }[] {
  const groups = groupBy(rows, (r) => r.cat[role] ?? null);
  return [...groups.entries()]
    .map(([group, gr]) => ({ group, stats: durationBetween(gr, fromRole, toRole, cap) }))
    .sort((a, b) => (b.stats?.median ?? -1) - (a.stats?.median ?? -1));
}
