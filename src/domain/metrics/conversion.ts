/** §7D — conversion / yield: funnel, offer acceptance, drops, selection→join. */
import type { LogicalRole, NormalizedRow } from '../types';
import { share } from './stats';

/** Ordered funnel stages, each anchored to a date-spine timestamp. */
export const FUNNEL_STAGES: { key: string; label: string; role: LogicalRole }[] = [
  { key: 'received', label: 'Received', role: 'reqReceivedDate' },
  { key: 'intake', label: 'Intake', role: 'intakeDate' },
  { key: 'selection', label: 'Selection', role: 'selectionDate' },
  { key: 'offer_sent', label: 'Offer sent', role: 'offerSentDate' },
  { key: 'offer_accepted', label: 'Offer accepted', role: 'offerAcceptedDate' },
  { key: 'joined', label: 'Joined', role: 'joiningDate' },
];

/**
 * A row "reached" stage i if it has the timestamp at i OR at any later stage
 * (a later timestamp implies the earlier stage was passed). This keeps the
 * funnel monotonic and tolerant of missing intermediate dates.
 */
function reachedCount(rows: NormalizedRow[], stageIndex: number): number {
  let count = 0;
  for (const r of rows) {
    let reached = false;
    for (let j = stageIndex; j < FUNNEL_STAGES.length; j++) {
      if (r.date[FUNNEL_STAGES[j]!.role] != null) {
        reached = true;
        break;
      }
    }
    if (reached) count++;
  }
  return count;
}

export interface FunnelStage {
  key: string;
  label: string;
  count: number;
  yieldFromPrev: number; // 0..1
  yieldFromStart: number; // 0..1
}

export function funnel(rows: NormalizedRow[]): FunnelStage[] {
  const counts = FUNNEL_STAGES.map((_, i) => reachedCount(rows, i));
  const start = counts[0] || 0;
  return FUNNEL_STAGES.map((s, i) => ({
    key: s.key,
    label: s.label,
    count: counts[i]!,
    yieldFromPrev: i === 0 ? 1 : share(counts[i]!, counts[i - 1]!),
    yieldFromStart: share(counts[i]!, start),
  }));
}

export interface OfferAcceptance {
  sent: number;
  accepted: number;
  rate: number;
  /** true when the rate is suspiciously high (declines likely not captured). */
  likelyArtifact: boolean;
}

export function offerAcceptanceRate(rows: NormalizedRow[]): OfferAcceptance {
  let sent = 0;
  let accepted = 0;
  for (const r of rows) {
    if (r.date.offerSentDate != null) sent++;
    if (r.date.offerAcceptedDate != null) accepted++;
  }
  const rate = share(accepted, sent);
  return { sent, accepted, rate, likelyArtifact: sent > 20 && rate >= 0.97 };
}

export interface DropRate {
  dropped: number;
  total: number;
  share: number;
}

export function dropRate(rows: NormalizedRow[]): DropRate {
  const dropped = rows.filter((r) => r.wasDropped).length;
  return { dropped, total: rows.length, share: share(dropped, rows.length) };
}

export interface SelectionToJoin {
  selected: number;
  joined: number;
  rate: number;
}

export function selectionToJoin(rows: NormalizedRow[]): SelectionToJoin {
  let selected = 0;
  let joined = 0;
  for (const r of rows) {
    if (r.date.selectionDate != null) {
      selected++;
      if (r.isJoined) joined++;
    }
  }
  return { selected, joined, rate: share(joined, selected) };
}
