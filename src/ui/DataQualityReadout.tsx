/**
 * Data-Quality panel (§8.8): completeness, date health, vocabulary violations,
 * broken columns, cross-field consistency, transparent score — plus a masked
 * remediation export and a LOCAL drill-down to offending rows (PII masked unless
 * private drill-down is on). Drill-down fetches raw rows from the worker on
 * demand; raw values never leave the device.
 */
import { useMemo, useState } from 'react';
import { useStore } from '../state/store';
import type { ConsistencyIssue, DataQualityReport, LogicalRole, RawRow } from '../domain/types';
import { ROLE_BY_KEY } from '../domain/schema';
import { defaultWindow, formatISO, parseDateCell } from '../domain/dates';
import { normStr } from '../domain/normalize';
import { Bar, Card, Chip, InfoTip, ScoreBadge, SectionTitle, Stat } from './components';
import { FORMULAS } from './definitions';
import { num, pct } from './format';
import { maskValue } from './mask';

const DRILL_ROLES: LogicalRole[] = [
  'requisitionId',
  'stage',
  'reqReceivedDate',
  'offerSentDate',
  'offerAcceptedDate',
  'joiningDate',
];

function download(name: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function buildRemediation(dq: DataQualityReport) {
  return {
    generatedForRows: dq.rows,
    score: dq.score,
    brokenColumns: dq.broken.map((b) => ({ field: b.label, header: b.header, filledPct: +b.filledPct.toFixed(2), reason: b.reason })),
    dateHealth: dq.dateHealth.filter((d) => d.invalid > 0 || d.missing > 0).map((d) => ({ field: d.label, valid: d.valid, missing: d.missing, invalid: d.invalid })),
    vocabularyViolations: dq.vocab.map((v) => ({ field: v.label, unmatched: v.unmatchedTokens })),
    consistency: dq.consistency.map((c) => ({ issue: c.label, count: c.count })),
    note: 'Masked remediation list — contains no PII. Row-level drill-down stays local in the app.',
  };
}

function toCsv(dq: DataQualityReport): string {
  const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const lines = [['category', 'field', 'detail', 'count'].join(',')];
  for (const b of dq.broken) lines.push(['broken-column', b.label, b.reason, ''].map((x) => esc(String(x))).join(','));
  for (const d of dq.dateHealth) {
    if (d.invalid > 0) lines.push(['invalid-dates', d.label, 'epoch/out-of-range/junk', String(d.invalid)].map((x) => esc(String(x))).join(','));
  }
  for (const v of dq.vocab) lines.push(['vocab-violation', v.label, v.unmatchedTokens.map((t) => `${t.token}×${t.count}`).join('; '), String(v.total - v.matched)].map((x) => esc(String(x))).join(','));
  for (const c of dq.consistency) lines.push(['consistency', c.label, '', String(c.count)].map((x) => esc(String(x))).join(','));
  return lines.join('\n');
}

export function DataQualityReadout() {
  const result = useStore((s) => s.result);
  const profile = useStore((s) => s.profile);
  const mapping = useStore((s) => s.mapping);
  const reveal = useStore((s) => s.prefs.privateDrillDown);

  const headerSensitive = useMemo(() => {
    const m = new Map<string, boolean>();
    if (mapping) {
      for (const [role, h] of Object.entries(mapping.roleToHeader)) {
        if (h) m.set(h, ROLE_BY_KEY[role as LogicalRole].sensitive);
      }
    }
    return m;
  }, [mapping]);

  if (!result || !profile || !mapping) return null;
  const { dq, dedup } = result;

  return (
    <div className="mx-auto grid max-w-6xl gap-5 px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold text-slate-900">Data Quality</h1>
        <div className="flex gap-2">
          <button type="button" className="btn-ghost px-2.5 py-1 text-xs" onClick={() => download('dq-remediation.json', JSON.stringify(buildRemediation(dq), null, 2), 'application/json')}>
            ⬇ Remediation (JSON)
          </button>
          <button type="button" className="btn-ghost px-2.5 py-1 text-xs" onClick={() => download('dq-remediation.csv', toCsv(dq), 'text/csv')}>
            ⬇ Remediation (CSV)
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Rows in" value={num(dedup.inputRows)} sub={`${num(profile.columns.length)} columns`} info={FORMULAS.rowsIn} />
        <Stat label="After de-dup" value={num(dedup.outputRows)} sub={`${num(dedup.rowsDropped)} merged · ${num(dedup.duplicateGroups)} dup groups`} info={FORMULAS.afterDedup} />
        <Stat label="Blank / placeholder IDs" value={num(dedup.blankIdRows)} sub={`${num(dedup.highFrequencyIds)} placeholder code(s)`} info={FORMULAS.blankIds} />
        <Stat label="Broken columns" value={num(dq.broken.length)} sub="excluded from metrics" info={FORMULAS.brokenColumns} />
        <div className="card flex flex-col justify-center p-4">
          <div className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-slate-500">
            <span>Data-quality score</span>
            <InfoTip text={FORMULAS.dqScore} />
          </div>
          <div className="mt-1"><ScoreBadge score={dq.score.overall} /></div>
        </div>
      </div>

      <Card>
        <SectionTitle hint="transparent formula: 0.5×completeness + 0.3×validity + 0.2×consistency" info={FORMULAS.dqScore}>Score breakdown</SectionTitle>
        <div className="grid gap-3 md:grid-cols-3">
          {(['completeness', 'validity', 'consistency'] as const).map((kk) => (
            <div key={kk}>
              <div className="mb-1 flex justify-between text-xs text-slate-500">
                <span className="capitalize">{kk}</span>
                <span className="tabular">{dq.score[kk]}/100</span>
              </div>
              <Bar value={dq.score[kk]} tone={dq.score[kk] >= 80 ? 'good' : dq.score[kk] >= 60 ? 'warn' : 'critical'} />
            </div>
          ))}
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <SectionTitle hint="worst-first" info={FORMULAS.completeness}>Field completeness</SectionTitle>
          <div className="grid max-h-96 gap-1.5 overflow-y-auto pr-1">
            {dq.completeness.map((c) => (
              <div key={c.role} className="grid grid-cols-12 items-center gap-2">
                <span className="col-span-5 truncate text-xs text-slate-600" title={c.header ?? c.label}>
                  {c.label}
                  {c.broken && <span className="ml-1 text-critical-500">⚠</span>}
                </span>
                <span className="col-span-5">
                  <Bar value={c.pct} tone={c.broken ? 'critical' : c.pct >= 80 ? 'good' : c.pct >= 40 ? 'warn' : 'critical'} />
                </span>
                <span className="tabular col-span-2 text-right text-xs text-slate-500">{pct(c.pct)}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <SectionTitle hint="valid · missing · invalid (epoch/out-of-range/junk)" info={FORMULAS.dateHealth}>Date health</SectionTitle>
          <div className="grid max-h-96 gap-1.5 overflow-y-auto pr-1">
            {dq.dateHealth.map((d) => {
              const total = d.valid + d.missing + d.invalid || 1;
              return (
                <div key={d.role} className="grid grid-cols-12 items-center gap-2">
                  <span className="col-span-4 truncate text-xs text-slate-600" title={d.header ?? d.label}>{d.label}</span>
                  <span className="col-span-6 flex h-2 overflow-hidden rounded-full bg-slate-100">
                    <span className="bg-good-500" style={{ width: `${(d.valid / total) * 100}%` }} />
                    <span className="bg-slate-300" style={{ width: `${(d.missing / total) * 100}%` }} />
                    <span className="bg-critical-500" style={{ width: `${(d.invalid / total) * 100}%` }} />
                  </span>
                  <span className="tabular col-span-2 text-right text-xs text-slate-500">
                    {num(d.valid)}
                    {d.invalid > 0 && <span className="text-critical-500"> +{num(d.invalid)}!</span>}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <SectionTitle hint="unmapped raw tokens — fix in mapping or at source" info={FORMULAS.vocabViolations}>Controlled-vocabulary violations</SectionTitle>
          {dq.vocab.length === 0 ? (
            <p className="text-sm text-slate-400">No vocabulary violations detected. ✓</p>
          ) : (
            <div className="grid gap-3">
              {dq.vocab.map((v) => (
                <div key={v.role}>
                  <div className="mb-1 text-xs font-medium text-slate-600">
                    {v.label} <span className="text-slate-400">({num(v.total - v.matched)} of {num(v.total)} unmatched)</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {v.unmatchedTokens.map((t) => (
                      <Chip key={t.token} tone="warn">{t.token} ×{t.count}</Chip>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <div className="grid gap-5">
          <Card>
            <SectionTitle info={FORMULAS.brokenColumns}>Broken columns (excluded)</SectionTitle>
            {dq.broken.length === 0 ? (
              <p className="text-sm text-slate-400">None.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {dq.broken.map((b) => (
                  <Chip key={b.role} tone="critical">{b.label} · {pct(b.filledPct, 1)}</Chip>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <SectionTitle hint="click to drill to the offending rows (local, masked)" info={FORMULAS.consistency}>Cross-field consistency</SectionTitle>
            {dq.consistency.length === 0 ? (
              <p className="text-sm text-slate-400">No sequence anomalies detected. ✓</p>
            ) : (
              <div className="grid gap-1.5">
                {dq.consistency.map((c) => (
                  <ConsistencyRow key={c.key} issue={c} headers={profile.headers} mapping={mapping} headerSensitive={headerSensitive} reveal={reveal} />
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function ConsistencyRow({
  issue,
  headers,
  mapping,
  headerSensitive,
  reveal,
}: {
  issue: ConsistencyIssue;
  headers: string[];
  mapping: NonNullable<ReturnType<typeof useStore.getState>['mapping']>;
  headerSensitive: Map<string, boolean>;
  reveal: boolean;
}) {
  const getRawRows = useStore((s) => s.getRawRows);
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<{ i: number; cells: RawRow }[] | null>(null);
  const win = defaultWindow();

  const drillCols = DRILL_ROLES.map((role) => ({ role, header: mapping.roleToHeader[role] ?? null })).filter(
    (c): c is { role: LogicalRole; header: string } => c.header !== null,
  );

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (next && rows === null) {
      setRows(await getRawRows(issue.rowIndices));
    }
  };

  const renderCell = (role: LogicalRole, header: string, cells: RawRow) => {
    const idx = headers.indexOf(header);
    const raw = idx >= 0 ? cells[idx] ?? null : null;
    if (ROLE_BY_KEY[role].kind === 'date') {
      const p = parseDateCell(raw, win);
      return p.status === 'valid' && p.ms !== null ? formatISO(p.ms) : '—';
    }
    return maskValue(normStr(raw), headerSensitive.get(header) ?? false, reveal);
  };

  return (
    <div>
      <button type="button" className="flex w-full items-center justify-between text-left text-xs hover:text-brand-700" onClick={() => void toggle()}>
        <span className="text-slate-600">{issue.label}</span>
        <Chip tone="critical">{num(issue.count)} {open ? '▴' : '▾'}</Chip>
      </button>
      {open && rows && (
        <div className="mt-2 overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full text-[11px]">
            <thead className="bg-slate-50 text-slate-400">
              <tr>{drillCols.map((c) => <th key={c.role} className="px-2 py-1 text-left font-medium">{ROLE_BY_KEY[c.role].label}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.i} className="border-t border-slate-100">
                  {drillCols.map((c) => <td key={c.role} className="px-2 py-1 text-slate-600">{renderCell(c.role, c.header, r.cells)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
          {issue.rowIndices.length < issue.count && (
            <div className="px-2 py-1 text-[10px] text-slate-400">Showing first {issue.rowIndices.length} of {num(issue.count)}.</div>
          )}
        </div>
      )}
    </div>
  );
}
