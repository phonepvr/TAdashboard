/**
 * Client-side CSV building + download. Pure (no React); zero network — files are
 * produced from in-memory data via a Blob and an <a download>, exactly like the
 * existing DQ remediation export. A UTF-8 BOM is prepended so Excel opens it with
 * the right encoding.
 *
 * PRIVACY: callers are responsible for masking sensitive columns BEFORE building
 * the row objects (see drill.ts). What you pass in is what lands in the file.
 */
export type CsvValue = string | number | null | undefined;

/** A column in a drill-down table / CSV: a stable key + a display label. */
export interface DrillColumn {
  key: string;
  label: string;
  align?: 'left' | 'right';
}

/** A self-contained, serialisable drill-down payload (safe to hold in the store). */
export interface DrillData {
  title: string;
  subtitle?: string;
  /** base filename, without extension. */
  filename: string;
  columns: DrillColumn[];
  rows: Record<string, CsvValue>[];
  /** optional footnote (e.g. masking disclosure). */
  note?: string;
}

function escapeCell(v: CsvValue): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Build CSV text from a typed array + column accessors. */
export function toCsv<T>(rows: T[], columns: { header: string; value: (r: T) => CsvValue }[]): string {
  const lines = [columns.map((c) => escapeCell(c.header)).join(',')];
  for (const r of rows) lines.push(columns.map((c) => escapeCell(c.value(r))).join(','));
  return lines.join('\r\n');
}

/** Build CSV text from a DrillData payload. */
export function drillToCsv(data: DrillData): string {
  return toCsv(data.rows, data.columns.map((c) => ({ header: c.label, value: (r: Record<string, CsvValue>) => r[c.key] })));
}

export function downloadText(filename: string, content: string, type = 'text/csv;charset=utf-8'): void {
  const blob = new Blob(['﻿', content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Convenience: build + download CSV from a typed array. */
export function downloadCsv<T>(
  filename: string,
  rows: T[],
  columns: { header: string; value: (r: T) => CsvValue }[],
): void {
  downloadText(filename.endsWith('.csv') ? filename : `${filename}.csv`, toCsv(rows, columns));
}

/** Convenience: build + download CSV from a DrillData payload. */
export function downloadDrill(data: DrillData): void {
  downloadText(`${data.filename}.csv`, drillToCsv(data));
}

/** Filesystem-safe slug for filenames (no data leakage — used on labels we already show). */
export function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'export'
  );
}
