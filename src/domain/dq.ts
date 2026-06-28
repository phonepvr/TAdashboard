/**
 * Data-quality engine (§8.8) — quality is a first-class, quantified feature.
 * Produces completeness, date-health (valid/missing/invalid), controlled-vocab
 * violations, broken-column flags, impossible-sequence consistency checks, and a
 * single transparent Data-Quality Score.
 */
import { DATE_ROLES, ROLES, ROLE_BY_KEY } from './schema';
import { canonicalizeBoolean, canonicalizeCategory, cellOf, colIndexMap, normStr } from './normalize';
import { defaultWindow, nowUtcMidnight, parseDateCell, type DateWindow } from './dates';
import type {
  BrokenColumn,
  ConsistencyIssue,
  DataQualityReport,
  DateHealth,
  FieldCompleteness,
  MappingConfig,
  NormalizedRow,
  ParsedTable,
  VocabViolation,
} from './types';

const BROKEN_MAX_CELLS = 2;
const BROKEN_MAX_PCT = 1.0;
const SAMPLE_CAP = 50;
const TOKEN_CAP = 25;

export interface DqOptions {
  todayMs?: number;
  window?: DateWindow;
}

function pct(n: number, d: number): number {
  return d === 0 ? 0 : (n / d) * 100;
}

export function computeDataQuality(
  table: ParsedTable,
  mapping: MappingConfig,
  rows: NormalizedRow[],
  opts: DqOptions = {},
): DataQualityReport {
  const todayMs = opts.todayMs ?? nowUtcMidnight();
  const window = opts.window ?? defaultWindow(todayMs);
  const cols = colIndexMap(table, mapping);
  const total = table.rows.length;

  // ── completeness + broken columns ──
  const completeness: FieldCompleteness[] = [];
  const broken: BrokenColumn[] = [];
  for (const def of ROLES) {
    const idx = cols[def.key];
    const header = mapping.roleToHeader[def.key] ?? null;
    if (idx === undefined || !header) continue;
    let filled = 0;
    for (const row of table.rows) if (normStr(cellOf(row, idx)) !== null) filled++;
    const p = pct(filled, total);
    const isBroken = filled <= BROKEN_MAX_CELLS || p < BROKEN_MAX_PCT;
    completeness.push({
      role: def.key,
      label: def.label,
      header,
      kind: def.kind,
      filled,
      total,
      pct: p,
      broken: isBroken,
    });
    if (isBroken) {
      broken.push({
        role: def.key,
        label: def.label,
        header,
        filledPct: p,
        reason: filled <= BROKEN_MAX_CELLS ? 'effectively empty / placeholder' : 'under 1% populated',
      });
    }
  }
  completeness.sort((a, b) => a.pct - b.pct); // worst-first

  // ── date health ──
  const dateHealth: DateHealth[] = [];
  for (const role of DATE_ROLES) {
    const idx = cols[role];
    const header = mapping.roleToHeader[role] ?? null;
    if (idx === undefined || !header) continue;
    let valid = 0;
    let missing = 0;
    let invalid = 0;
    for (const row of table.rows) {
      const s = parseDateCell(cellOf(row, idx), window).status;
      if (s === 'valid') valid++;
      else if (s === 'invalid') invalid++;
      else missing++;
    }
    dateHealth.push({ role, label: ROLE_BY_KEY[role].label, header, valid, missing, invalid });
  }

  // ── controlled-vocabulary violations (canonical + boolean fields; all non-PII) ──
  const vocab: VocabViolation[] = [];
  const vocabRoles = ROLES.filter((r) => r.canonical || r.kind === 'boolean');
  for (const def of vocabRoles) {
    const idx = cols[def.key];
    const header = mapping.roleToHeader[def.key] ?? null;
    if (idx === undefined || !header) continue;
    let matched = 0;
    let totalNonBlank = 0;
    const tokens = new Map<string, number>();
    for (const row of table.rows) {
      const cell = cellOf(row, idx);
      if (normStr(cell) === null) continue;
      totalNonBlank++;
      const res =
        def.kind === 'boolean'
          ? canonicalizeBoolean(cell, mapping.valueOverrides[def.key])
          : canonicalizeCategory(def.key, cell, mapping.valueOverrides[def.key]);
      if (res.matched) matched++;
      else if (res.token) tokens.set(res.token, (tokens.get(res.token) ?? 0) + 1);
    }
    if (tokens.size > 0) {
      vocab.push({
        role: def.key,
        label: def.label,
        header,
        matched,
        total: totalNonBlank,
        unmatchedTokens: [...tokens.entries()]
          .map(([token, count]) => ({ token, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, TOKEN_CAP),
      });
    }
  }

  // ── cross-field consistency (impossible / suspicious sequences) ──
  const consistency = computeConsistency(rows);

  // ── transparent Data-Quality Score ──
  const mappedPcts = completeness.map((c) => c.pct);
  const completenessScore = mappedPcts.length
    ? mappedPcts.reduce((a, b) => a + b, 0) / mappedPcts.length
    : 0;

  let dValid = 0;
  let dConsidered = 0;
  for (const d of dateHealth) {
    dValid += d.valid;
    dConsidered += d.valid + d.invalid;
  }
  const dateValidity = dConsidered === 0 ? 1 : dValid / dConsidered;
  let vMatched = 0;
  let vTotal = 0;
  for (const v of vocab) {
    vMatched += v.matched;
    vTotal += v.total;
  }
  const vocabValidity = vTotal === 0 ? 1 : vMatched / vTotal;
  const validityScore = ((dateValidity + vocabValidity) / 2) * 100;

  const issueTotal = consistency.reduce((a, c) => a + c.count, 0);
  const consistencyScore = total === 0 ? 100 : Math.max(0, (1 - issueTotal / total) * 100);

  const overall = 0.5 * completenessScore + 0.3 * validityScore + 0.2 * consistencyScore;

  return {
    rows: total,
    completeness,
    dateHealth,
    vocab,
    broken,
    consistency,
    score: {
      overall: Math.round(overall),
      completeness: Math.round(completenessScore),
      validity: Math.round(validityScore),
      consistency: Math.round(consistencyScore),
    },
  };
}

interface Check {
  key: string;
  label: string;
  test: (r: NormalizedRow) => boolean;
}

const CONSISTENCY_CHECKS: Check[] = [
  {
    key: 'join_before_req',
    label: 'Joining date before requisition received',
    test: (r) => lt(r.date.joiningDate, r.date.reqReceivedDate),
  },
  {
    key: 'join_before_accept',
    label: 'Joining date before offer accepted',
    test: (r) => lt(r.date.joiningDate, r.date.offerAcceptedDate),
  },
  {
    key: 'accept_before_sent',
    label: 'Offer accepted before offer sent',
    test: (r) => lt(r.date.offerAcceptedDate, r.date.offerSentDate),
  },
  {
    key: 'selection_after_offer',
    label: 'Selection date after offer sent',
    test: (r) => gt(r.date.selectionDate, r.date.offerSentDate),
  },
  {
    key: 'joined_no_accept',
    label: 'Joined but no offer-accepted date (missing intermediate)',
    test: (r) => r.isJoined && r.date.offerAcceptedDate == null,
  },
];

function lt(a: number | null | undefined, b: number | null | undefined): boolean {
  return a != null && b != null && a < b;
}
function gt(a: number | null | undefined, b: number | null | undefined): boolean {
  return a != null && b != null && a > b;
}

export function computeConsistency(rows: NormalizedRow[]): ConsistencyIssue[] {
  const out: ConsistencyIssue[] = [];
  for (const check of CONSISTENCY_CHECKS) {
    const rowIndices: number[] = [];
    let count = 0;
    for (const r of rows) {
      if (check.test(r)) {
        count++;
        if (rowIndices.length < SAMPLE_CAP) rowIndices.push(r.i);
      }
    }
    if (count > 0) out.push({ key: check.key, label: check.label, count, rowIndices });
  }
  return out;
}

/** Convenience for callers that only have a table + mapping. */
export function dateHealthForRole(
  table: ParsedTable,
  colIdx: number,
  window: DateWindow,
): { valid: number; missing: number; invalid: number } {
  let valid = 0;
  let missing = 0;
  let invalid = 0;
  for (const row of table.rows) {
    const s = parseDateCell(cellOf(row, colIdx), window).status;
    if (s === 'valid') valid++;
    else if (s === 'invalid') invalid++;
    else missing++;
  }
  return { valid, missing, invalid };
}
