/**
 * The single shared, tolerant date parser used everywhere (§6).
 *
 * Design choices that matter:
 *  - We parse spreadsheets with raw:true, so Excel date cells arrive as SERIAL
 *    NUMBERS. We convert serials ourselves to UTC-midnight epoch ms — this is
 *    fully timezone-independent (no off-by-one-day drift across CI / browsers).
 *  - Three outcomes, never conflated: valid / missing / invalid.
 *      missing  = blank, non-breaking space, or free text that isn't a date
 *                 ("Awaited", "Dropped", "Yes", …).
 *      invalid  = a real date that is epoch-zero or outside the sane window
 *                 (counted SEPARATELY from missing, per the brief).
 *      valid    = a real, in-window date.
 */
import type { RawCell } from './types';

export const DAY_MS = 86_400_000;
const EXCEL_EPOCH_OFFSET = 25_569; // serial 25569 === 1970-01-01 (1900 date system)

export type DateStatus = 'valid' | 'missing' | 'invalid';

export interface DateParse {
  status: DateStatus;
  /** UTC-midnight epoch ms when valid; null otherwise. */
  ms: number | null;
}

export interface DateWindow {
  lo: number; // inclusive, epoch ms
  hi: number; // inclusive, epoch ms
}

export function nowUtcMidnight(now: number = Date.now()): number {
  const d = new Date(now);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/** Default sanity window: 2023-01-01 … today + 365 days. */
export function defaultWindow(todayMs: number = nowUtcMidnight()): DateWindow {
  return { lo: Date.UTC(2023, 0, 1), hi: todayMs + 365 * DAY_MS };
}

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

function clean(s: string): string {
  return s.replace(/\u00A0/g, ' ').replace(/\s+/g, ' ').trim();
}

function buildUtc(y: number, mZero: number, d: number): number | null {
  if (mZero < 0 || mZero > 11 || d < 1 || d > 31) return null;
  const ms = Date.UTC(y, mZero, d);
  const back = new Date(ms);
  // round-trip guard rejects impossible dates like 31-Feb.
  if (back.getUTCFullYear() !== y || back.getUTCMonth() !== mZero || back.getUTCDate() !== d) {
    return null;
  }
  return ms;
}

function normalizeYear(yy: number): number {
  if (yy >= 100) return yy;
  return yy < 70 ? 2000 + yy : 1900 + yy;
}

function serialToUtcMs(serial: number): number {
  const ms = Math.round((serial - EXCEL_EPOCH_OFFSET) * DAY_MS);
  const d = new Date(ms);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/** Parse a string date (day-first tolerant). Returns UTC-midnight ms or null. */
export function parseDateString(input: string): number | null {
  const s = clean(input);
  if (!s) return null;

  // ISO: yyyy-mm-dd (optionally with time)
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T].*)?$/.exec(s);
  if (iso) return buildUtc(+iso[1]!, +iso[2]! - 1, +iso[3]!);

  // dd-MMM-yy / dd MMM yyyy / dd.MMM.yy  (month name)
  const mon = /^(\d{1,2})[-/.\s]([A-Za-z]{3,})[-/.\s](\d{2,4})$/.exec(s);
  if (mon) {
    const mZero = MONTHS[mon[2]!.slice(0, 3).toLowerCase()];
    if (mZero === undefined) return null;
    return buildUtc(normalizeYear(+mon[3]!), mZero, +mon[1]!);
  }

  // numeric d/m/y — DAY-FIRST preferred; swap to m/d only when day-first is impossible.
  const num = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/.exec(s);
  if (num) {
    const a = +num[1]!;
    const b = +num[2]!;
    const y = normalizeYear(+num[3]!);
    if (a > 12 && b <= 12) return buildUtc(y, b - 1, a); // clearly day-first
    if (a <= 12 && b > 12) return buildUtc(y, a - 1, b); // clearly month-first
    return buildUtc(y, b - 1, a); // ambiguous -> day-first
  }

  return null;
}

export function parseDateCell(value: RawCell | Date, window: DateWindow): DateParse {
  if (value === null || value === undefined) return { status: 'missing', ms: null };

  let ms: number | null = null;

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return { status: 'missing', ms: null };
    ms = serialToUtcMs(value);
  } else if (typeof value === 'boolean') {
    return { status: 'missing', ms: null }; // a boolean in a date column is not a date
  } else if (value instanceof Date) {
    ms = Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate());
  } else {
    const s = clean(String(value));
    if (!s) return { status: 'missing', ms: null };
    ms = parseDateString(s);
    if (ms === null) return { status: 'missing', ms: null }; // free text -> missing
  }

  if (ms === null) return { status: 'missing', ms: null };
  if (ms < window.lo || ms > window.hi) return { status: 'invalid', ms: null };
  return { status: 'valid', ms };
}

export function dayDiff(fromMs: number, toMs: number): number {
  return Math.round((toMs - fromMs) / DAY_MS);
}

/** "YYYY-MM" month key for trend bucketing. */
export function monthKey(ms: number): string {
  const d = new Date(ms);
  const m = d.getUTCMonth() + 1;
  return `${d.getUTCFullYear()}-${m < 10 ? '0' : ''}${m}`;
}

export function formatISO(ms: number): string {
  const d = new Date(ms);
  const m = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  return `${d.getUTCFullYear()}-${m < 10 ? '0' : ''}${m}-${day < 10 ? '0' : ''}${day}`;
}
