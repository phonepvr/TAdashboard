/**
 * Normalization layer (§6): deterministic, value-agnostic pipeline that turns a
 * raw ParsedTable + MappingConfig into a clean, typed NormalizedRow[].
 *
 * Rules are GENERIC — they never hard-code specific data values. Free-text
 * sensitive fields (remarks, drop lists, names) are NOT copied into the
 * normalized rows; only presence/derived flags are kept. Raw values remain in
 * the in-memory ParsedTable for explicit, local private drill-down by row index.
 */
import {
  CANONICAL_RULES,
  ROLE_BY_KEY,
  ROLES,
} from './schema';
import { matchFunnelConcept } from './mapping';
import { dayDiff, defaultWindow, nowUtcMidnight, parseDateCell, type DateWindow } from './dates';
import type {
  LogicalRole,
  MappingConfig,
  NormalizedRow,
  ParsedTable,
  RawCell,
  RawRow,
} from './types';

// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001F\u007F]/g;

/** Trim, strip non-breaking spaces + control chars, collapse internal whitespace. '' -> null. */
export function normStr(v: RawCell): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  const s = String(v)
    .replace(/ /g, ' ')
    .replace(CONTROL_CHARS, '')
    .replace(/\s+/g, ' ')
    .trim();
  return s === '' ? null : s;
}

/** Case-folded key for matching / override lookup. */
export function foldKey(s: string): string {
  return s.toLowerCase();
}

export function coerceNumber(v: RawCell): number | null {
  if (v === null || v === undefined || typeof v === 'boolean') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  // strip all whitespace (incl. NBSP, matched by \s) and thousands separators
  const s = String(v).replace(/[\s,]/g, '');
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Unify grade formats: "M-9" / "M 9" / "m9" -> "M9"; ranges preserved. */
export function normalizeLevel(s: string): string {
  return s.toUpperCase().replace(/([A-Z])[\s-]?(\d)/g, '$1$2').replace(/\s+/g, ' ').trim();
}

export interface CategoryResult {
  value: string | null;
  matched: boolean; // false => controlled-vocabulary violation
  token: string | null; // the offending raw token (for DQ), when unmatched
}

export function canonicalizeCategory(
  role: LogicalRole,
  raw: RawCell,
  overrides?: Record<string, string>,
): CategoryResult {
  const def = ROLE_BY_KEY[role];
  const s = normStr(raw);

  if (def.canonical) {
    const rule = CANONICAL_RULES[def.canonical];
    if (s === null) return { value: rule.blank, matched: true, token: null };
    const key = foldKey(s);
    const override = overrides?.[key];
    if (override) return { value: override, matched: true, token: null };
    const m = rule.match(key);
    if (m !== null) return { value: m, matched: true, token: null };
    return { value: rule.blank, matched: false, token: s };
  }

  // Non-canonical category: clean string (+ field-specific tweaks), honour overrides.
  if (s === null) {
    return { value: role === 'function' ? 'Unspecified' : null, matched: true, token: null };
  }
  let value = s;
  if (role === 'level') value = normalizeLevel(s);
  const override = overrides?.[foldKey(value)];
  if (override) value = override;
  return { value, matched: true, token: null };
}

export interface BooleanResult {
  value: boolean | null;
  matched: boolean;
  token: string | null;
}

export function canonicalizeBoolean(raw: RawCell, overrides?: Record<string, string>): BooleanResult {
  const s = normStr(raw);
  if (s === null) return { value: null, matched: true, token: null };
  const key = foldKey(s);
  const override = overrides?.[key];
  if (override) return { value: override === 'Yes', matched: true, token: null };
  const m = CANONICAL_RULES.yesno.match(key);
  if (m !== null) return { value: m === 'Yes', matched: true, token: null };
  return { value: null, matched: false, token: s };
}

// ───────────────────────── canonical ageing buckets ─────────────────────────

const AGE_BUCKETS: { label: string; max: number }[] = [
  { label: '0–30', max: 30 },
  { label: '31–60', max: 60 },
  { label: '61–90', max: 90 },
  { label: '91–180', max: 180 },
  { label: '181–365', max: 365 },
  { label: '365+', max: Infinity },
];

export const AGE_BUCKET_LABELS: string[] = AGE_BUCKETS.map((b) => b.label);

export function ageBucket(days: number | null): string | null {
  if (days === null || days < 0) return null;
  return AGE_BUCKETS.find((b) => days <= b.max)!.label;
}

const TBO_BUCKETS: { label: string; max: number }[] = [
  { label: '0–7', max: 7 },
  { label: '8–15', max: 15 },
  { label: '16–30', max: 30 },
  { label: '31–60', max: 60 },
  { label: '60+', max: Infinity },
];

export const TBO_BUCKET_LABELS: string[] = TBO_BUCKETS.map((b) => b.label);

export function tboBucket(days: number | null): string | null {
  if (days === null || days < 0) return null;
  return TBO_BUCKETS.find((b) => days <= b.max)!.label;
}

// ───────────────────────── main pipeline ─────────────────────────

export interface NormalizeOptions {
  todayMs?: number;
  window?: DateWindow;
}

export function colIndexMap(table: ParsedTable, mapping: MappingConfig): Partial<Record<LogicalRole, number>> {
  const out: Partial<Record<LogicalRole, number>> = {};
  for (const role of Object.keys(mapping.roleToHeader) as LogicalRole[]) {
    const header = mapping.roleToHeader[role];
    if (!header) continue;
    const idx = table.headers.indexOf(header);
    if (idx >= 0) out[role] = idx;
  }
  return out;
}

export function cellOf(row: RawRow, idx: number | undefined): RawCell {
  if (idx === undefined) return null;
  const v = row[idx];
  return v === undefined ? null : v;
}

// Roles whose values we store on the normalized row (the rest stay raw-only for drill-down).
const STORED_CATEGORY: LogicalRole[] = [
  'requisitionId', 'positionTitle', 'calendarYear', 'demandType', 'budgetFlag',
  'businessUnit', 'function', 'haziraFlag', 'location', 'level', 'hrHead', 'hrbp',
  'recruiter', 'rpoLead', 'stage', 'stageGroup', 'subStage', 'qualification',
  'gender', 'source', 'ageingReason', 'tboAgeingReason',
];
const STORED_DATE: LogicalRole[] = ROLES.filter((r) => r.kind === 'date').map((r) => r.key);

export function normalizeRow(
  row: RawRow,
  rowIndex: number,
  cols: Partial<Record<LogicalRole, number>>,
  mapping: MappingConfig,
  window: DateWindow,
  todayMs: number,
): NormalizedRow {
  const cat: NormalizedRow['cat'] = {};
  const date: NormalizedRow['date'] = {};
  const num: NormalizedRow['num'] = {};
  const bool: NormalizedRow['bool'] = {};

  // categories / id / text-light
  for (const role of STORED_CATEGORY) {
    const def = ROLE_BY_KEY[role];
    if (def.kind === 'boolean') continue;
    const res = canonicalizeCategory(role, cellOf(row, cols[role]), mapping.valueOverrides[role]);
    cat[role] = res.value;
  }

  // booleans
  bool.jdFlag = canonicalizeBoolean(cellOf(row, cols.jdFlag), mapping.valueOverrides.jdFlag).value;

  // dates
  for (const role of STORED_DATE) {
    const p = parseDateCell(cellOf(row, cols[role]), window);
    date[role] = p.status === 'valid' ? p.ms : null;
  }

  // raw numbers we keep verbatim (TBO source ageing recomputed below).
  num.tboAgeingDays = coerceNumber(cellOf(row, cols.tboAgeingDays));

  const reqId = cat.requisitionId ?? null;
  const reqMs = date.reqReceivedDate ?? null;
  const joinMs = date.joiningDate ?? null;
  const acceptMs = date.offerAcceptedDate ?? null;

  // derived status
  const stageVal = cat.stage ?? null;
  const concept = stageVal ? matchFunnelConcept(stageVal) : null;
  const dropCell = normStr(cellOf(row, cols.dropList));
  const wasDropped = dropCell !== null || concept?.key === 'dropped';
  const isOnHold = concept?.key === 'hold';
  const isJoined = joinMs !== null;
  const isTBO = !isJoined && acceptMs !== null;
  const isOpen = !isJoined && !wasDropped;

  // canonical ageing (fresh): open => today − req; joined => req − join.
  let ageDays: number | null = null;
  if (reqMs !== null) {
    ageDays = isJoined && joinMs !== null ? dayDiff(reqMs, joinMs) : dayDiff(reqMs, todayMs);
    if (ageDays < 0) ageDays = null;
  }
  num.ageingDays = ageDays;
  cat.ageingBucket = ageBucket(ageDays);

  // canonical TBO ageing (fresh) for TBO rows only.
  let tboDays: number | null = null;
  if (isTBO && acceptMs !== null) tboDays = Math.max(0, dayDiff(acceptMs, todayMs));
  num.tboAgeingDays = tboDays;
  cat.tboBucket = tboBucket(tboDays);

  // composite de-dup key (placeholder demotion handled in dedup.ts).
  const dedupKey = reqId
    ? `id:${foldKey(reqId)}`
    : `c:${foldKey(cat.positionTitle ?? '')}|${reqMs ?? ''}|${foldKey(cat.recruiter ?? '')}`;

  return {
    i: rowIndex,
    reqId,
    dedupKey,
    cat,
    date,
    num,
    bool,
    isJoined,
    isOpen,
    isOnHold,
    isTBO,
    wasDropped,
  };
}

export function normalizeTable(
  table: ParsedTable,
  mapping: MappingConfig,
  opts: NormalizeOptions = {},
): NormalizedRow[] {
  const todayMs = opts.todayMs ?? nowUtcMidnight();
  const window = opts.window ?? defaultWindow(todayMs);
  const cols = colIndexMap(table, mapping);
  const out: NormalizedRow[] = new Array(table.rows.length);
  for (let i = 0; i < table.rows.length; i++) {
    out[i] = normalizeRow(table.rows[i]!, i, cols, mapping, window, todayMs);
  }
  return out;
}
