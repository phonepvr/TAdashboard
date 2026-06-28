/**
 * Builders that turn metric results into drill-down payloads (DrillData). The
 * standard requisition-detail columns are shared by most "click a number → see
 * the rows behind it" interactions.
 *
 * PRIVACY: sensitive people fields (HR Head, Recruiter) are masked here unless
 * the user has the explicit, local "Private drill-down" toggle ON — so the
 * exported CSV always matches exactly what is shown on screen.
 */
import type { NormalizedRow } from '../domain/types';
import { dayDiff, formatISO } from '../domain/dates';
import { maskValue } from './mask';
import type { CsvValue, DrillColumn, DrillData } from './csv';

export function statusLabel(r: NormalizedRow): string {
  if (r.wasDropped) return 'Dropped';
  if (r.isJoined) return 'Joined';
  if (r.isTBO) return 'TBO';
  if (r.isOnHold) return 'On hold';
  if (r.isOpen) return 'Open';
  return '—';
}

const d = (ms: number | null | undefined): string => (ms === null || ms === undefined ? '' : formatISO(ms));

/** One requisition → a flat, maskable record using the standard column keys. */
export function reqRow(r: NormalizedRow, reveal: boolean): Record<string, CsvValue> {
  const req = r.date.reqReceivedDate ?? null;
  const join = r.date.joiningDate ?? null;
  const ttf = req !== null && join !== null && dayDiff(req, join) >= 0 ? dayDiff(req, join) : '';
  return {
    req: r.reqId ?? `#${r.i}`,
    position: r.cat.positionTitle ?? '',
    bu: r.cat.businessUnit ?? '',
    func: r.cat.function ?? '',
    level: r.cat.level ?? '',
    stage: r.cat.stage ?? '',
    status: statusLabel(r),
    owner: maskValue(r.cat.hrHead ?? null, true, reveal),
    recruiter: maskValue(r.cat.recruiter ?? null, true, reveal),
    source: r.cat.source ?? '',
    reqReceived: d(req),
    joining: d(join),
    age: r.num.ageingDays ?? '',
    ttf,
  };
}

export const REQ_COLUMNS: DrillColumn[] = [
  { key: 'req', label: 'Req' },
  { key: 'position', label: 'Position' },
  { key: 'bu', label: 'BU' },
  { key: 'func', label: 'Function' },
  { key: 'level', label: 'Level' },
  { key: 'stage', label: 'Stage' },
  { key: 'status', label: 'Status' },
  { key: 'owner', label: 'HR Head' },
  { key: 'recruiter', label: 'Recruiter' },
  { key: 'source', label: 'Source' },
  { key: 'reqReceived', label: 'Req received' },
  { key: 'joining', label: 'Joining' },
  { key: 'age', label: 'Age (d)', align: 'right' },
  { key: 'ttf', label: 'TTF (d)', align: 'right' },
];

const maskNote = (reveal: boolean) =>
  reveal
    ? 'Private drill-down is ON — people fields are unmasked in this export.'
    : 'People fields are masked. Enable "Private drill-down" (top bar) to reveal names.';

/** Standard requisition-level drill-down for a set of rows. */
export function requisitionDrill(
  title: string,
  filename: string,
  rows: NormalizedRow[],
  reveal: boolean,
  subtitle?: string,
): DrillData {
  return {
    title,
    subtitle: subtitle ?? `${rows.length} requisition${rows.length === 1 ? '' : 's'}`,
    filename,
    columns: REQ_COLUMNS,
    rows: rows.map((r) => reqRow(r, reveal)),
    note: maskNote(reveal),
  };
}
