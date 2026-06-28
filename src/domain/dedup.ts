/**
 * De-duplication / merge (§1.3): union by requisition id with "latest record
 * wins". Critically, an id that repeats *very* often is treated as a placeholder
 * (e.g. a bulk-drive code), NOT as a real duplicate — those rows are kept
 * distinct via a composite key so we never collapse 60+ genuine reqs into one.
 */
import { foldKey } from './normalize';
import type { DedupSummary, NormalizedRow } from './types';

/** An id repeating more than this is assumed to be a non-unique placeholder. */
export const PLACEHOLDER_THRESHOLD = 5;

function compositeKey(r: NormalizedRow, withRowIndex: boolean): string {
  const base = `c:${foldKey(r.cat.positionTitle ?? '')}|${r.date.reqReceivedDate ?? ''}|${foldKey(
    r.cat.recruiter ?? '',
  )}`;
  return withRowIndex ? `${base}|#${r.i}` : base;
}

export function dedupeRows(rows: NormalizedRow[]): { rows: NormalizedRow[]; summary: DedupSummary } {
  const freq = new Map<string, number>();
  let blankIdRows = 0;
  for (const r of rows) {
    if (r.reqId) {
      const k = foldKey(r.reqId);
      freq.set(k, (freq.get(k) ?? 0) + 1);
    } else {
      blankIdRows++;
    }
  }

  const placeholderIds = new Set<string>();
  for (const [id, c] of freq) if (c > PLACEHOLDER_THRESHOLD) placeholderIds.add(id);

  // Assign a final de-dup key per row.
  const keyed = rows.map((r) => {
    let key: string;
    if (r.reqId && !placeholderIds.has(foldKey(r.reqId))) {
      key = `id:${foldKey(r.reqId)}`;
    } else if (r.reqId && placeholderIds.has(foldKey(r.reqId))) {
      key = compositeKey(r, true); // placeholder id -> never collapse
    } else {
      key = compositeKey(r, false); // blank id -> collapse true re-extracts only
    }
    return { r, key };
  });

  // latest-wins, preserving first-seen order.
  const firstSeenOrder = new Map<string, number>();
  const counts = new Map<string, number>();
  const latest = new Map<string, NormalizedRow>();
  let order = 0;
  for (const { r, key } of keyed) {
    if (!firstSeenOrder.has(key)) firstSeenOrder.set(key, order++);
    counts.set(key, (counts.get(key) ?? 0) + 1);
    latest.set(key, r);
  }

  const out = [...firstSeenOrder.entries()]
    .sort((a, b) => a[1] - b[1])
    .map(([k]) => latest.get(k)!);

  let duplicateGroups = 0;
  for (const c of counts.values()) if (c > 1) duplicateGroups++;

  return {
    rows: out,
    summary: {
      inputRows: rows.length,
      outputRows: out.length,
      duplicateGroups,
      rowsDropped: rows.length - out.length,
      blankIdRows,
      highFrequencyIds: placeholderIds.size,
    },
  };
}
