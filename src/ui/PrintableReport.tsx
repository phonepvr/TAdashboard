/**
 * Multi-page printable report: Executive Summary (page 1) + one page per HR Head.
 * Hidden on screen; visible during print only (.print-only).
 * Styled to AM/NS brand guidelines: Strong Black header, Smart Red section titles,
 * Albert Sans typeface, the AM/NS diagonal stroke element.
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

const BRAND_RED = '#e52726';
const STRONG_BLACK = '#000000';
const INK = '#0f172a';
const MUTED = '#64748b';
const HAIRLINE = '#e2e8f0';

const fmtCmp = (v: number | null, unit: KpiCompare['unit']) =>
  v === null ? '—' : unit === 'days' ? `${num(v)}d` : pct(v * 100);

function variance(c: KpiCompare): { color: string; label: string } {
  if (c.scope === null || c.baseline === null) return { color: MUTED, label: '' };
  const diff = c.scope - c.baseline;
  if (Math.abs(diff) < 1e-9) return { color: MUTED, label: '0' };
  const worse = c.direction === 'lowerBetter' ? diff > 0 : c.direction === 'higherBetter' ? diff < 0 : false;
  const color = c.direction === 'neutral' ? MUTED : worse ? '#dc2626' : '#15803d';
  const d = c.unit === 'days' ? `${diff > 0 ? '+' : ''}${num(diff)}d` : `${diff > 0 ? '+' : ''}${pct(diff * 100)}`;
  return { color, label: d };
}

/** AM/NS brand header block: Strong Black background + diagonal red stroke. */
function BrandHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="print-brand-header">
      <div className="print-brand-header__text">
        <div className="print-brand-header__title">{title}</div>
        {subtitle && <div className="print-brand-header__sub">{subtitle}</div>}
      </div>
      <div className="print-brand-stroke" />
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div className="print-section-title">{children}</div>;
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <td style={{ padding: '6px 8px', verticalAlign: 'top' }}>
      <div style={{ fontSize: '7pt', fontWeight: 600, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: '16pt', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: INK, lineHeight: 1.1 }}>{value}</div>
    </td>
  );
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
      {/* ── PAGE 1: Executive Summary ──────────────────────────── */}
      <div className="print-page">
        <BrandHeader title="TA Command Centre" subtitle="ArcelorMittal Nippon Steel India · Executive Summary" />

        {/* Headline KPIs */}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 4 }}>
          <tbody>
            <tr>
              <Kpi label="Requisitions" value={num(k.total)} />
              <Kpi label="% Open" value={pct(k.pctOpen * 100)} />
              <Kpi label="Median TTF" value={ttf ? `${num(ttf.median)}d` : '—'} />
              <Kpi label="Offer accept" value={pct(k.acceptanceRate * 100)} />
              <Kpi label="TBO" value={num(snap.tbo)} />
              <Kpi label="Aged > 180d" value={num(k.agedOver180)} />
              <Kpi label="Female share" value={pct(k.femaleShareKnown * 100)} />
              <Kpi label="Top source" value={pct(k.topSourceShare * 100)} />
            </tr>
          </tbody>
        </table>

        {/* What changed */}
        <SectionTitle>What changed</SectionTitle>
        <table style={{ width: '100%', fontSize: '8.5pt', borderCollapse: 'collapse', marginBottom: 4 }}>
          <thead>
            <tr>
              {changes.map((c) => (
                <th key={c.key} style={{ textAlign: 'left', fontWeight: 600, color: MUTED, padding: '2px 5px', fontSize: '7pt', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              {changes.map((c) => {
                const fv = (v: number | null) =>
                  v === null ? '—' : c.unit === 'pct' ? `${Math.round(v * 100)}%` : c.unit === 'days' ? `${num(v)}d` : num(v);
                return (
                  <td key={c.key} style={{ padding: '2px 5px' }}>
                    <strong>{fv(c.current)}</strong>{' '}
                    <span style={{ color: MUTED }}>vs {fv(c.prior)}</span>
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>

        {/* Funnel + Velocity side by side */}
        <div style={{ display: 'flex', gap: 20 }}>
          <div style={{ flex: 1 }}>
            <SectionTitle>Funnel snapshot</SectionTitle>
            <table style={{ width: '100%', fontSize: '8.5pt', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', fontWeight: 600, color: MUTED, padding: '1px 4px', fontSize: '7pt' }}>Stage</th>
                  <th style={{ textAlign: 'right', fontWeight: 600, color: MUTED, padding: '1px 4px', fontSize: '7pt' }}>Count</th>
                  <th style={{ textAlign: 'right', fontWeight: 600, color: MUTED, padding: '1px 4px', fontSize: '7pt' }}>Yield</th>
                </tr>
              </thead>
              <tbody>
                {fn.map((s) => (
                  <tr key={s.key} style={{ borderTop: `1px solid ${HAIRLINE}` }}>
                    <td style={{ padding: '2px 4px', color: '#334155' }}>{s.label}</td>
                    <td style={{ padding: '2px 4px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{num(s.count)}</td>
                    <td style={{ padding: '2px 4px', textAlign: 'right', color: MUTED, fontVariantNumeric: 'tabular-nums' }}>{pct(s.yieldFromPrev * 100)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ flex: 1 }}>
            <SectionTitle>Velocity decomposition</SectionTitle>
            <table style={{ width: '100%', fontSize: '8.5pt', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', fontWeight: 600, color: MUTED, padding: '1px 4px', fontSize: '7pt' }}>Segment</th>
                  <th style={{ textAlign: 'right', fontWeight: 600, color: MUTED, padding: '1px 4px', fontSize: '7pt' }}>Median</th>
                </tr>
              </thead>
              <tbody>
                {decomp.map((d) => (
                  <tr key={d.key} style={{ borderTop: `1px solid ${HAIRLINE}` }}>
                    <td style={{ padding: '2px 4px', color: '#334155' }}>{d.label}</td>
                    <td style={{ padding: '2px 4px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: d.key === bn?.key ? 700 : 400, color: d.key === bn?.key ? BRAND_RED : INK }}>
                      {d.stats ? `${num(d.stats.median)}d` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {bn && (
              <p style={{ fontSize: '7.5pt', color: MUTED, marginTop: 4 }}>
                Bottleneck: <strong style={{ color: BRAND_RED }}>{bn.label}</strong>
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{ marginTop: 16, borderTop: `2px solid ${STRONG_BLACK}`, paddingTop: 6, display: 'flex', justifyContent: 'space-between', fontSize: '7pt', color: MUTED }}>
          <span>TA Command Centre · AMNS India · Confidential</span>
          <span>All data processed in-browser · Zero egress</span>
        </div>
      </div>

      {/* ── One page per HR Head ───────────────────────────────── */}
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
      <BrandHeader
        title={`${headLabel} — Review`}
        subtitle={`${num(scope.length)} requisitions · scope vs org baseline · ArcelorMittal Nippon Steel India`}
      />

      {/* Scorecard vs baseline */}
      <SectionTitle>Scorecard vs baseline</SectionTitle>
      <table style={{ width: '100%', fontSize: '8.5pt', borderCollapse: 'collapse', marginBottom: 4 }}>
        <thead>
          <tr style={{ background: '#f8fafc' }}>
            <th style={{ textAlign: 'left', fontWeight: 600, color: MUTED, padding: '3px 5px', fontSize: '7pt', textTransform: 'uppercase' }}>KPI</th>
            <th style={{ textAlign: 'right', fontWeight: 600, color: MUTED, padding: '3px 5px', fontSize: '7pt', textTransform: 'uppercase' }}>This head</th>
            <th style={{ textAlign: 'right', fontWeight: 600, color: MUTED, padding: '3px 5px', fontSize: '7pt', textTransform: 'uppercase' }}>Org baseline</th>
            <th style={{ textAlign: 'right', fontWeight: 600, color: MUTED, padding: '3px 5px', fontSize: '7pt', textTransform: 'uppercase' }}>Variance</th>
          </tr>
        </thead>
        <tbody>
          {cmp.map((c) => {
            const v = variance(c);
            return (
              <tr key={c.key} style={{ borderTop: `1px solid ${HAIRLINE}` }}>
                <td style={{ padding: '3px 5px', color: '#334155' }}>{c.label}</td>
                <td style={{ padding: '3px 5px', textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: INK }}>{fmtCmp(c.scope, c.unit)}</td>
                <td style={{ padding: '3px 5px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: MUTED }}>{fmtCmp(c.baseline, c.unit)}</td>
                <td style={{ padding: '3px 5px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: v.color }}>{v.label}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Per-BU + per-Function */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 4 }}>
        <div style={{ flex: 1 }}>
          <SectionTitle>Per Business Unit</SectionTitle>
          <GroupTable rows={buScores} />
        </div>
        <div style={{ flex: 1 }}>
          <SectionTitle>Per Function</SectionTitle>
          <GroupTable rows={fnScores} />
        </div>
      </div>

      {/* Worklists */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 4 }}>
        <div style={{ flex: 1 }}>
          <SectionTitle>Aged-open worklist (&gt;90d)</SectionTitle>
          {aged.length === 0 ? (
            <p style={{ fontSize: '8pt', color: MUTED }}>No open reqs over 90 days. ✓</p>
          ) : (
            <table style={{ width: '100%', fontSize: '8pt', borderCollapse: 'collapse' }}>
              <thead><tr>
                {['Req', 'BU', 'Stage', 'Age'].map((h) => (
                  <th key={h} style={{ textAlign: h === 'Age' ? 'right' : 'left', fontWeight: 600, color: MUTED, padding: '1px 3px', fontSize: '7pt', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {aged.map((a) => (
                  <tr key={a.i} style={{ borderTop: `1px solid ${HAIRLINE}` }}>
                    <td style={{ padding: '1.5px 3px', color: '#334155' }}>{a.reqId ?? `#${a.i}`}</td>
                    <td style={{ padding: '1.5px 3px', color: MUTED }}>{a.businessUnit ?? '—'}</td>
                    <td style={{ padding: '1.5px 3px', color: MUTED }}>{a.stage ?? '—'}</td>
                    <td style={{ padding: '1.5px 3px', textAlign: 'right', color: BRAND_RED, fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>{num(a.ageDays)}d</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div style={{ flex: 1 }}>
          <SectionTitle>TBO worklist</SectionTitle>
          {tbo.length === 0 ? (
            <p style={{ fontSize: '8pt', color: MUTED }}>No TBO in this scope. ✓</p>
          ) : (
            <table style={{ width: '100%', fontSize: '8pt', borderCollapse: 'collapse' }}>
              <thead><tr>
                {['Req', 'BU', 'TBO age', 'Recruiter'].map((h, i) => (
                  <th key={h} style={{ textAlign: i === 2 ? 'right' : 'left', fontWeight: 600, color: MUTED, padding: '1px 3px', fontSize: '7pt', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {tbo.map((t) => (
                  <tr key={t.i} style={{ borderTop: `1px solid ${HAIRLINE}` }}>
                    <td style={{ padding: '1.5px 3px', color: '#334155' }}>{t.reqId ?? `#${t.i}`}</td>
                    <td style={{ padding: '1.5px 3px', color: MUTED }}>{t.businessUnit ?? '—'}</td>
                    <td style={{ padding: '1.5px 3px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{t.tboAgeingDays !== null ? `${num(t.tboAgeingDays)}d` : '—'}</td>
                    <td style={{ padding: '1.5px 3px', color: MUTED }}>{maskValue(t.recruiter, true, reveal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Drop analysis */}
      <SectionTitle>Drop analysis</SectionTitle>
      <p style={{ fontSize: '8.5pt', color: '#334155', marginBottom: 3 }}>
        <strong>{num(drops.count)}</strong> drop(s) · {pct(drops.rate * 100)} of scope
        {drops.reasons.length > 0 && (
          <span style={{ color: MUTED }}> — {drops.reasons.slice(0, 8).map((r) => `${r.key} ×${r.count}`).join(' · ')}</span>
        )}
      </p>

      {/* Footer */}
      <div style={{ marginTop: 12, borderTop: `2px solid ${STRONG_BLACK}`, paddingTop: 5, display: 'flex', justifyContent: 'space-between', fontSize: '7pt', color: MUTED }}>
        <span>TA Command Centre · AMNS India · Confidential</span>
        <span>All data processed in-browser · Zero egress</span>
      </div>
    </div>
  );
}

function GroupTable({ rows }: { rows: GroupScorecard[] }) {
  if (rows.length === 0) return <p style={{ fontSize: '8pt', color: MUTED }}>No data.</p>;
  return (
    <table style={{ width: '100%', fontSize: '8pt', borderCollapse: 'collapse' }}>
      <thead><tr>
        {['Group', 'Reqs', 'TTF', 'Accept', 'Drop'].map((h, i) => (
          <th key={h} style={{ textAlign: i === 0 ? 'left' : 'right', fontWeight: 600, color: MUTED, padding: '1px 3px', fontSize: '7pt', textTransform: 'uppercase' }}>{h}</th>
        ))}
      </tr></thead>
      <tbody>
        {rows.slice(0, 8).map((g) => (
          <tr key={g.group} style={{ borderTop: `1px solid ${HAIRLINE}` }}>
            <td style={{ padding: '1.5px 3px', color: '#334155' }}>{g.group}</td>
            <td style={{ padding: '1.5px 3px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{num(g.n)}</td>
            <td style={{ padding: '1.5px 3px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{g.medianTtf !== null ? `${num(g.medianTtf)}d` : '—'}</td>
            <td style={{ padding: '1.5px 3px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{pct(g.acceptance * 100)}</td>
            <td style={{ padding: '1.5px 3px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{pct(g.dropRate * 100)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
