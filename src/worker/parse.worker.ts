/// <reference lib="webworker" />
/**
 * Parse + normalize worker. Heavy work (SheetJS parse, normalization, DQ) runs
 * here so the main thread stays responsive even at ~50k rows.
 *
 * PRIVACY: the raw table (with any PII) is held ONLY in this worker's memory and
 * is never transmitted anywhere. The main thread receives the maskable
 * NormalizedRow[] + aggregate DQ. Raw rows are returned only on explicit,
 * local `getRawRows` requests for private drill-down.
 */
import * as XLSX from 'xlsx';
import type {
  ColumnProfile,
  FieldKind,
  ParsedTable,
  RawCell,
  TableProfile,
} from '../domain/types';
import { normalizeTable } from '../domain/normalize';
import { dedupeRows } from '../domain/dedup';
import { computeDataQuality } from '../domain/dq';
import { parseDateString } from '../domain/dates';
import type { WorkerRequest, WorkerResponse } from './protocol';

const ctx = self as unknown as DedicatedWorkerGlobalScope;

let table: ParsedTable | null = null;

function post(msg: WorkerResponse) {
  ctx.postMessage(msg);
}
function progress(phase: string, pct: number) {
  post({ type: 'progress', phase, pct });
}

function looksNumeric(s: string): boolean {
  return /^-?\d+(\.\d+)?$/.test(s);
}

function inferKind(dateLike: number, numeric: number, sampled: number, distinct: number): FieldKind {
  if (sampled === 0) return 'text';
  if (dateLike / sampled > 0.5) return 'date';
  if (numeric / sampled > 0.8) return 'number';
  if (distinct <= 15) return 'category';
  return 'text';
}

const DISTINCT_CAP = 201;
const SAMPLE_VALUES_CAP = 60;
const SHAPE_SAMPLE = 1200;

function profileTable(t: ParsedTable): TableProfile {
  const { headers, rows } = t;
  const total = rows.length;
  const columns: ColumnProfile[] = headers.map((header, idx) => {
    let filled = 0;
    let sampled = 0;
    let dateLike = 0;
    let numeric = 0;
    const distinctMap = new Map<string, string>(); // lower -> original
    let overflow = false;
    for (let r = 0; r < total; r++) {
      const v = rows[r]![idx];
      if (v === null || v === undefined) continue;
      const s = String(v).replace(/\u00A0/g, ' ').trim();
      if (s === '') continue;
      filled++;
      if (!overflow) {
        const key = s.toLowerCase();
        if (!distinctMap.has(key)) {
          if (distinctMap.size >= DISTINCT_CAP) overflow = true;
          else distinctMap.set(key, s);
        }
      }
      if (sampled < SHAPE_SAMPLE) {
        sampled++;
        if (typeof v === 'number') numeric++;
        else if (parseDateString(s) !== null) dateLike++;
        else if (looksNumeric(s)) numeric++;
      }
    }
    const distinct = overflow ? DISTINCT_CAP : distinctMap.size;
    const sampleValues = distinct <= SAMPLE_VALUES_CAP ? [...distinctMap.values()] : [];
    return {
      header,
      index: idx,
      filled,
      total,
      distinct,
      sampleValues,
      inferredKind: inferKind(dateLike, numeric, sampled, distinct),
      dateLikeShare: sampled ? dateLike / sampled : 0,
      numericShare: sampled ? numeric / sampled : 0,
    };
  });
  return {
    headers,
    rowCount: total,
    sheetName: t.sheetName,
    fileName: t.fileName,
    isDemo: !!t.isDemo,
    columns,
  };
}

async function parseFile(file: File) {
  progress('reading', 5);
  const isCsv = /\.csv$/i.test(file.name);
  let wb: XLSX.WorkBook;
  if (isCsv) {
    const text = await file.text();
    progress('parsing', 30);
    wb = XLSX.read(text, { type: 'string', raw: true });
  } else {
    const buf = await file.arrayBuffer();
    progress('parsing', 30);
    wb = XLSX.read(new Uint8Array(buf), { type: 'array' });
  }
  const sheetName = wb.SheetNames[0];
  if (!sheetName) throw new Error('The workbook has no sheets.');
  const ws = wb.Sheets[sheetName]!;
  progress('extracting', 55);
  const aoa = XLSX.utils.sheet_to_json<RawCell[]>(ws, {
    header: 1,
    raw: true,
    defval: null,
    blankrows: false,
  });
  const headerRow = (aoa[0] ?? []) as RawCell[];
  const headers = headerRow.map((h) => String(h ?? '').replace(/\u00A0/g, ' ').trim());
  const body = aoa
    .slice(1)
    .filter((r) => r.some((c) => c !== null && c !== undefined && String(c).trim() !== ''));
  table = { headers, rows: body, sheetName, fileName: file.name };
  progress('profiling', 80);
  post({ type: 'parsed', profile: profileTable(table) });
  progress('done', 100);
}

function loadTable(t: ParsedTable) {
  table = t;
  progress('profiling', 60);
  post({ type: 'parsed', profile: profileTable(t) });
  progress('done', 100);
}

function normalize(mapping: import('../domain/types').MappingConfig, todayMs?: number) {
  if (!table) throw new Error('No table loaded.');
  progress('normalizing', 30);
  const normalized = normalizeTable(table, mapping, todayMs ? { todayMs } : {});
  progress('de-duplicating', 60);
  const { rows, summary } = dedupeRows(normalized);
  progress('scoring quality', 80);
  const dq = computeDataQuality(table, mapping, rows, todayMs ? { todayMs } : {});
  post({ type: 'normalized', result: { rows, dq, dedup: summary } });
  progress('done', 100);
}

function getRawRows(indices: number[]) {
  if (!table) throw new Error('No table loaded.');
  const set = new Set(indices);
  const out: { i: number; cells: RawCell[] }[] = [];
  for (let i = 0; i < table.rows.length; i++) {
    if (set.has(i)) out.push({ i, cells: table.rows[i]! });
  }
  post({ type: 'rawRows', rows: out });
}

ctx.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  const msg = e.data;
  try {
    switch (msg.type) {
      case 'parseFile':
        await parseFile(msg.file);
        break;
      case 'loadTable':
        loadTable(msg.table);
        break;
      case 'normalize':
        normalize(msg.mapping, msg.todayMs);
        break;
      case 'getRawRows':
        getRawRows(msg.indices);
        break;
    }
  } catch (err) {
    post({ type: 'error', message: err instanceof Error ? err.message : String(err) });
  }
};
