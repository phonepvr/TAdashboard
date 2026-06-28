/**
 * Multi-page printable report: Executive Summary (page 1) + one page per HR Head.
 * Hidden on screen, shown only during print via the .print-only CSS class.
 * Triggered by a dedicated button that sets printing state, renders this, and
 * calls window.print().
 */
import { useMemo } from 'react';
import { useStore } from '../state/store';
import {
  applyFilters,
  headlineKpis,
  pipelineSnapshot,
  timeToFill,
  funnel,
  velocityDecomposition,
  bottleneck,
  whatChanged,
  distinctValues,
  reviewComparison,
  byGroupScorecards,
  agedOpenWorklist,
  tboWorklist,
  dropAnalysis,
  type KpiCompare,
  type GroupScorecard,
} from '../domain/metrics';
import type { NormalizedRow } from '../domain/types';
import { buildAliasMap, maskValue } from './mask';
import { num, pct } from './format';

const fmtCmp = (v: number | null, unit: KpiCompare['unit']) =>
  v === null ? '—' : unit === 'days' ? `${num(v)}d` : pct(v * 100);

function variance(c: KpiCompare): { tone: string; label: string } {
  if (c.scope === null || c.baseline === null) return { tone: '', label: '' };
  const diff = c.scope - c.baseline;
  if (Math.abs(diff) < 1e-9) return { tone: '', label: '0' };
  const worse = c.direction === 'lowerBetter' ? diff > 0 : c.direction === 'higherBetter' ? diff < 0 : false;
  const tone = worse ? 'color: #dc2626' : c.direction === 'neutral' ? '' : 'color: #16a34a';
  const d = c.unit === 'days' ? `${diff > 0 ? '+' : ''}${num(diff)}d` : `${diff > 0 ? '+' : ''}${pct(diff * 100)}`;
  return { tone, label: d };
}

export function PrintableReport() {
  const result = useStore((s) => s.result);
  const filters = useStore((s) => s.filters);
  const reveal = useStore((s) => s.prefs.privateDrillDown);

  const rows = useMemo(() => (result ? applyFilters(result.rows, filters) : []), [result, filters]);
  const heads = useMemo(() => (result ? distinctValues(result.rows, 'hrHead') : []), [result]);
  const aliasMap = useMemo(() => buildAliasMap(heads, 'HR Head'), [heads]);

  if (!result || rows.length === 0) return null;

  const label = (v: string) => (reveal ? v : aliasMap.get(v) ?? v);
  const k = headlineKpis(rows);
  const snap = pipelineSnapshot(rows);
  const ttf = timeToFill(rows);
  const fn = funnel(rows);
  const decomp = velocityDecomposition(rows);
  const bn = bottleneck(decomp);
  const changes = whatChanged(rows);

  return (
    <div className="print-only">
      {/* Page 1: Executive Summary */}
      <div className="print-page">
        <h1 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>Executive Summary</h1>

        <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse', marginBottom: 12 }}>
          <tbody>
            <tr>
              <Kpi label="Requisitions" value={num(k.total)} />
              <Kpi label="% Open" value={pct(k.pctOpen * 100)} />
              <Kpi label="Median TTF" value={ttf ? `${num(ttf.median)}d` : '—'} />
              <Kpi label="Offer Accept" value={pct(k.acceptanceRate * 100)} />
            </tr>
            <tr>
              <Kpi label="TBO" value={num(snap.tbo)} />
              <Kpi label="Aged > 180d" value={num(k.agedOver180)} />
              <Kpi label="Female share" value={pct(k.femaleShareKnown * 100)} />
              <Kpi label="Top source" value={pct(k.topSourceShare * 100)} />
            </tr>
          </tbody>
        </table>

        {/* What changed */}
        <SectionHeading>What changed</SectionHeading>
        <table style={{ width: '100%', fontSize: 10, borderCollapse: 'collapse', marginBottom: 12 }}>
          <thead>
            <tr>
              {changes.map((c) => (
                <th key={c.key} style={{ textAlign: 'left', fontWeight: 500, color: '#64748b', padding: '2px 6px' }}>{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              {changes.map((c) => {
                const cur = c.current;
                const pri = c.prior;
                const fv = (v: number | null) => v === null ? '—' : c.unit === 'pct' ? `${Math.round(v * 100)}%` : c.unit === 'days' ? `${num(v)}d` : num(v);
                return (
                  <td key={c.key} style={{ padding: '2px 6px', fontSize: 11 }}>
                    <strong>{fv(cur)}</strong> <span style={{ color: '#94a3b8' }}>vs {fv(pri)}</span>
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>

        {/* Funnel */}
        <SectionHeading>Funnel snapshot</SectionHeading>
        <table style={{ width: '100%', fontSize: 10, borderCollapse: 'collapse', marginBottom: 12 }}>
          <tbody>
            {fn.map((s) => (
              <tr key={s.key}>
                <td style={{ padding: '1px 4px', width: 120, color: '#475569' }}>{s.label}</td>
                <td style={{ padding: '1px 4px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{num(s.count)}</td>
                <td style={{ padding: '1px 4px', textAlign: 'right', color: '#64748b' }}>{pct(s.yieldFromPrev * 100)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Velocity */}
        <SectionHeading>Velocity decomposition</SectionHeading>
        <table style={{ width: '100%', fontSize: 10, borderCollapse: 'collapse', marginBottom: 8 }}>
          <tbody>
            {decomp.map((d) => (
              <tr key={d.key}>
                <td style={{ padding: '1px 4px', width: 160, color: '#475569' }}>{d.label}</td>
                <td style={{ padding: '1px 4px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: d.key === bn?.key ? '#dc2626' : '#334155' }}>
                  {d.stats ? `${num(d.stats.median)}d` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {bn && <p style={{ fontSize: 10, color: '#64748b' }}>Bottleneck: <strong style={{ color: '#dc2626' }}>{bn.label}</strong></p>}
      </div>

      {/* One page per HR Head */}
      {heads.map((head) => (
        <HeadPage key={head} head={head} label={label(head)} allRows={result.rows} reveal={reveal} />
      ))}
    </div>
  );
}

function HeadPage({ head, label: headLabel, allRows, reveal }: {
  head: string;
  label: string;
  allRows: NormalizedRow[];
  reveal: boolean;
}) {
  const scope = useMemo(() => allRows.filter((r) => r.cat.hrHead === head), [allRows, head]);
  const cmp = reviewComparison(scope, allRows);
  const buScores = byGroupScorecards(scope, 'businessUnit');
  const fnScores = byGroupScorecards(scope, 'function');
  const aged = agedOpenWorklist(scope, 90).slice(0, 10);
  const tbo = tboWorklist(scope).slice(0, 10);
  const drops = dropAnalysis(scope);

  return (
    <div className="print-page" style={{ pageBreakBefore: 'always' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
        <h1 style={{ fontSize: 16, fontWeight: 700 }}>{headLabel} — Review</h1>
        <span style={{ fontSize: 10, color: '#94a3b8' }}>{num(scope.length)} reqs · scope vs org baseline</span>
      </div>

      {/* Scorecard vs baseline */}
      <SectionHeading>Scorecard vs baseline</SectionHeading>
      <table style={{ width: '100%', fontSize: 10, borderCollapse: 'collapse', marginBottom: 12 }}>
        <thead>
          <tr style={{ color: '#94a3b8' }}>
            <th style={{ textAlign: 'left', fontWeight: 500, padding: '2px 4px' }}>KPI</th>
            <th style={{ textAlign: 'right', fontWeight: 500, padding: '2px 4px' }}>This head</th>
            <th style={{ textAlign: 'right', fontWeight: 500, padding: '2px 4px' }}>Org baseline</th>
            <th style={{ textAlign: 'right', fontWeight: 500, padding: '2px 4px' }}>Variance</th>
          </tr>
        </thead>
        <tbody>
          {cmp.map((c) => {
            const v = variance(c);
            return (
              <tr key={c.key} style={{ borderTop: '1px solid #f1f5f9' }}>
                <td style={{ padding: '3px 4px', color: '#334155' }}>{c.label}</td>
                <td style={{ padding: '3px 4px', textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{fmtCmp(c.scope, c.unit)}</td>
                <td style={{ padding: '3px 4px', textAlign: 'right', color: '#64748b', fontVariantNumeric: 'tabular-nums' }}>{fmtCmp(c.baseline, c.unit)}</td>
                <td style={{ padding: '3px 4px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                  <span style={v.tone ? { color: v.tone.replace('color: ', '') } : undefined}>{v.label}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Per-BU + per-Function side by side */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
        <div style={{ flex: 1 }}>
          <SectionHeading>Per Business Unit</SectionHeading>
          <GroupTable rows={buScores} />
        </div>
        <div style={{ flex: 1 }}>
          <SectionHeading>Per Function</SectionHeading>
          <GroupTable rows={fnScores} />
        </div>
      </div>

      {/* Worklists side by side */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
        <div style={{ flex: 1 }}>
          <SectionHeading>Aged-open worklist (&gt;90d)</SectionHeading>
          {aged.length === 0 ? (
            <p style={{ fontSize: 10, color: '#94a3b8' }}>No open reqs over 90 days.</p>
          ) : (
            <table style={{ width: '100%', fontSize: 9, borderCollapse: 'collapse' }}>
              <thead><tr style={{ color: '#94a3b8' }}>
                <th style={{ textAlign: 'left', fontWeight: 500, padding: '1px 3px' }}>Req</th>
                <th style={{ textAlign: 'left', fontWeight: 500, padding: '1px 3px' }}>BU</th>
                <th style={{ textAlign: 'left', fontWeight: 500, padding: '1px 3px' }}>Stage</th>
                <th style={{ textAlign: 'right', fontWeight: 500, padding: '1px 3px' }}>Age</th>
              </tr></thead>
              <tbody>
                {aged.map((a) => (
                  <tr key={a.i} style={{ borderTop: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '1px 3px', color: '#475569' }}>{a.reqId ?? `#${a.i}`}</td>
                    <td style={{ padding: '1px 3px', color: '#475569' }}>{a.businessUnit ?? '—'}</td>
                    <td style={{ padding: '1px 3px', color: '#475569' }}>{a.stage ?? '—'}</td>
                    <td style={{ padding: '1px 3px', textAlign: 'right', color: '#dc2626', fontVariantNumeric: 'tabular-nums' }}>{num(a.ageDays)}d</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div style={{ flex: 1 }}>
          <SectionHeading>TBO worklist</SectionHeading>
          {tbo.length === 0 ? (
            <p style={{ fontSize: 10, color: '#94a3b8' }}>No TBO in this scope.</p>
          ) : (
            <table style={{ width: '100%', fontSize: 9, borderCollapse: 'collapse' }}>
              <thead><tr style={{ color: '#94a3b8' }}>
                <th style={{ textAlign: 'left', fontWeight: 500, padding: '1px 3px' }}>Req</th>
                <th style={{ textAlign: 'left', fontWeight: 500, padding: '1px 3px' }}>BU</th>
                <th style={{ textAlign: 'right', fontWeight: 500, padding: '1px 3px' }}>TBO age</th>
                <th style={{ textAlign: 'left', fontWeight: 500, padding: '1px 3px' }}>Recruiter</th>
              </tr></thead>
              <tbody>
                {tbo.map((t) => (
                  <tr key={t.i} style={{ borderTop: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '1px 3px', color: '#475569' }}>{t.reqId ?? `#${t.i}`}</td>
                    <td style={{ padding: '1px 3px', color: '#475569' }}>{t.businessUnit ?? '—'}</td>
                    <td style={{ padding: '1px 3px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{t.tboAgeingDays !== null ? `${num(t.tboAgeingDays)}d` : '—'}</td>
                    <td style={{ padding: '1px 3px', color: '#475569' }}>{maskValue(t.recruiter, true, reveal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Drop analysis */}
      <SectionHeading>Drop analysis</SectionHeading>
      <p style={{ fontSize: 10, color: '#475569', marginBottom: 4 }}>
        <strong>{num(drops.count)}</strong> drop(s) · {pct(drops.rate * 100)} of scope
      </p>
      {drops.reasons.length > 0 && (
        <p style={{ fontSize: 9, color: '#64748b' }}>
          {drops.reasons.slice(0, 8).map((r) => `${r.key} ×${r.count}`).join(' · ')}
        </p>
      )}
    </div>
  );
}

function GroupTable({ rows }: { rows: GroupScorecard[] }) {
  if (rows.length === 0) return <p style={{ fontSize: 10, color: '#94a3b8' }}>No data.</p>;
  return (
    <table style={{ width: '100%', fontSize: 9, borderCollapse: 'collapse' }}>
      <thead><tr style={{ color: '#94a3b8' }}>
        <th style={{ textAlign: 'left', fontWeight: 500, padding: '1px 3px' }}>Group</th>
        <th style={{ textAlign: 'right', fontWeight: 500, padding: '1px 3px' }}>Reqs</th>
        <th style={{ textAlign: 'right', fontWeight: 500, padding: '1px 3px' }}>TTF</th>
        <th style={{ textAlign: 'right', fontWeight: 500, padding: '1px 3px' }}>Accept</th>
        <th style={{ textAlign: 'right', fontWeight: 500, padding: '1px 3px' }}>Drop</th>
      </tr></thead>
      <tbody>
        {rows.slice(0, 8).map((g) => (
          <tr key={g.group} style={{ borderTop: '1px solid #f1f5f9' }}>
            <td style={{ padding: '1px 3px', color: '#475569' }}>{g.group}</td>
            <td style={{ padding: '1px 3px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{num(g.n)}</td>
            <td style={{ padding: '1px 3px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{g.medianTtf !== null ? `${num(g.medianTtf)}d` : '—'}</td>
            <td style={{ padding: '1px 3px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{pct(g.acceptance * 100)}</td>
            <td style={{ padding: '1px 3px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{pct(g.dropRate * 100)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <td style={{ padding: '4px 6px' }}>
      <div style={{ fontSize: 9, fontWeight: 500, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: '#0f172a' }}>{value}</div>
    </td>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#475569', marginBottom: 4, marginTop: 4 }}>
      {children}
    </h2>
  );
}
