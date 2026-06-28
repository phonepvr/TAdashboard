/**
 * §9 Forecast view. Everything here is SIMPLE, transparent and labelled
 * "directional" with wide uncertainty — the assumptions panels expose the exact
 * medians/conversions so reviewers can challenge the numbers.
 */
import { useMemo, useState } from 'react';
import {
  Area,
  Bar as RBar,
  CartesianGrid,
  ComposedChart,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useStore } from '../state/store';
import {
  applyFilters,
  concentration,
  demandForecast,
  diversityTrajectory,
  driftTtf,
  openReqEtas,
  projectedJoins,
  seasonality,
  tboLanding,
} from '../domain/metrics';
import { Bar, Card, Chip, SectionTitle } from './components';
import { num, pct } from './format';

const AX = { fontSize: 11, fill: '#94a3b8' };

export function ForecastView() {
  const result = useStore((s) => s.result);
  const filters = useStore((s) => s.filters);
  const [showAssume, setShowAssume] = useState(false);

  const rows = useMemo(() => (result ? applyFilters(result.rows, filters) : []), [result, filters]);
  const demand = useMemo(() => demandForecast(rows), [rows]);
  const joins = useMemo(() => projectedJoins(rows), [rows]);
  const etas = useMemo(() => openReqEtas(rows), [rows]);
  const tbo = useMemo(() => tboLanding(rows), [rows]);
  const diversity = useMemo(() => diversityTrajectory(rows), [rows]);
  const season = useMemo(() => seasonality(rows), [rows]);
  const drift = useMemo(() => driftTtf(rows), [rows]);
  const conc = useMemo(() => concentration(rows, 'businessUnit').slice(0, 8), [rows]);

  if (!result) return null;
  if (rows.length === 0) return <div className="px-4 py-16 text-center text-sm text-slate-400">No rows match the current filters.</div>;

  const demandChart = demand.series.map((p) => ({
    month: p.month,
    received: p.received,
    trend: p.trend,
    ma: p.ma,
    band: p.projected ? [p.lo, p.hi] : null,
  }));
  const atRisk = etas.filter((e) => e.atRisk).slice(0, 12);
  const maxSeason = Math.max(1, ...season.map((s) => s.avg));

  return (
    <div className="mx-auto grid max-w-6xl gap-5 px-4 py-5">
      <Card className="border-warn-500/40 bg-warn-50">
        <p className="text-xs text-warn-600">
          <strong>Directional only.</strong> History is short (~{num(demand.monthsOfHistory)} months) — projections
          carry wide uncertainty. Methods and the exact medians/conversions used are shown in the assumptions panels.
        </p>
      </Card>

      {/* Demand forecast */}
      <Card>
        <SectionTitle hint="3-mo moving average + OLS trend; band = ±1.96σ residual">Demand forecast</SectionTitle>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={demandChart} margin={{ top: 8, right: 16, bottom: 0, left: -16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="month" tick={AX} tickFormatter={(m: string) => m.slice(2)} />
              <YAxis tick={AX} allowDecimals={false} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Area dataKey="band" stroke="none" fill="#c7d2fe" fillOpacity={0.5} name="uncertainty" />
              <Line dataKey="received" stroke="#4f46e5" strokeWidth={2} dot={false} name="received" connectNulls={false} />
              <Line dataKey="trend" stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="5 4" dot={false} name="OLS trend" />
              <Line dataKey="ma" stroke="#16a34a" strokeWidth={1.5} strokeDasharray="2 3" dot={false} name="3-mo MA" connectNulls={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          Trend slope ≈ <strong>{demand.slope >= 0 ? '+' : ''}{demand.slope.toFixed(1)}</strong> reqs/month (R²={demand.r2.toFixed(2)}).
        </p>
      </Card>

      {/* Projected joins vs demand + fulfilment gap */}
      <Card>
        <SectionTitle hint="empirical stage→join conversion × current pipeline">Projected joins vs demand</SectionTitle>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="md:col-span-2 h-52">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={joins.byMonth} margin={{ top: 8, right: 16, bottom: 0, left: -16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" tick={AX} tickFormatter={(m: string) => m.slice(2)} />
                <YAxis tick={AX} allowDecimals={false} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <RBar dataKey="expectedJoins" fill="#16a34a" name="expected joins" radius={[3, 3, 0, 0]} />
                <Line dataKey="demand" stroke="#4f46e5" strokeWidth={2} dot name="demand baseline" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-col justify-center gap-2">
            <div className="text-xs text-slate-500">Next {joins.byMonth.length} months</div>
            <div><span className="tabular text-2xl font-semibold text-good-600">{num(joins.totalExpected)}</span><span className="text-xs text-slate-500"> expected joins</span></div>
            <div><span className="tabular text-2xl font-semibold text-brand-600">{num(joins.totalDemand)}</span><span className="text-xs text-slate-500"> projected demand</span></div>
            <div className={`text-sm font-medium ${joins.gap < 0 ? 'text-critical-600' : 'text-good-600'}`}>
              Fulfilment gap: {joins.gap >= 0 ? '+' : ''}{num(joins.gap)}
            </div>
          </div>
        </div>
        <button type="button" className="mt-3 text-xs text-brand-700 hover:underline" onClick={() => setShowAssume((v) => !v)}>
          {showAssume ? '▴ Hide' : '▾ Show'} assumptions (stage residual + conversion)
        </button>
        {showAssume && (
          <div className="mt-2 overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-slate-400">
                <tr><th className="px-2 py-1 text-left font-medium">Stage</th><th className="px-2 py-1 text-right font-medium">Median residual → join</th><th className="px-2 py-1 text-right font-medium">Conversion</th><th className="px-2 py-1 text-right font-medium">n</th></tr>
              </thead>
              <tbody>
                {joins.assumptions.map((a) => (
                  <tr key={a.stage} className="border-t border-slate-100">
                    <td className="px-2 py-1 text-slate-700">{a.stage}</td>
                    <td className="tabular px-2 py-1 text-right text-slate-600">{a.medianResidualDays !== null ? `${num(a.medianResidualDays)}d` : '—'}</td>
                    <td className="tabular px-2 py-1 text-right text-slate-600">{pct(a.conversion * 100)}</td>
                    <td className="tabular px-2 py-1 text-right text-slate-500">{num(a.n)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Open-req ETA / at-risk */}
        <Card>
          <SectionTitle hint="past the cohort median TTF = at-risk">At-risk open requisitions</SectionTitle>
          {atRisk.length === 0 ? (
            <p className="text-sm text-slate-400">No open reqs past their cohort median TTF. ✓</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-slate-400"><tr><th className="text-left font-medium">Req</th><th className="text-left font-medium">BU</th><th className="text-left font-medium">Stage</th><th className="text-right font-medium">Age</th><th className="text-right font-medium">ETA</th></tr></thead>
                <tbody>
                  {atRisk.map((e) => (
                    <tr key={e.i} className="border-t border-slate-100">
                      <td className="py-1 text-slate-700">{e.reqId ?? `#${e.i}`}</td>
                      <td className="py-1 text-slate-600">{e.businessUnit ?? '—'}</td>
                      <td className="py-1 text-slate-600">{e.stage ?? '—'}</td>
                      <td className="tabular py-1 text-right text-critical-600">{e.ageDays !== null ? `${num(e.ageDays)}d` : '—'}</td>
                      <td className="tabular py-1 text-right text-slate-600">{e.etaDays !== null ? `+${num(e.etaDays)}d` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* TBO landing */}
        <Card>
          <SectionTitle hint="offer-accepted + median accept→join">TBO landing forecast</SectionTitle>
          <p className="mb-2 text-xs text-slate-500">Median accept→join: <strong>{tbo.medianAcceptToJoin !== null ? `${num(tbo.medianAcceptToJoin)}d` : '—'}</strong></p>
          <div className="grid gap-2">
            {tbo.byMonth.map((m) => (
              <div key={m.month} className="grid grid-cols-12 items-center gap-2">
                <span className="col-span-3 text-xs text-slate-600">{m.month.slice(2)}</span>
                <span className="col-span-7"><Bar value={tbo.byMonth.length ? (m.expected / Math.max(1, ...tbo.byMonth.map((x) => x.expected))) * 100 : 0} tone="warn" /></span>
                <span className="tabular col-span-2 text-right text-xs text-slate-500">{num(m.expected)}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Diversity trajectory */}
        <Card>
          <SectionTitle hint="female share (of known) among joins, by month">Diversity trajectory</SectionTitle>
          {diversity.length < 2 ? (
            <p className="text-sm text-slate-400">Not enough joined-cohort history.</p>
          ) : (
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={diversity.map((d) => ({ month: d.month, female: Math.round(d.femaleShareKnown * 100) }))} margin={{ top: 8, right: 16, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="month" tick={AX} tickFormatter={(m: string) => m.slice(2)} />
                  <YAxis tick={AX} domain={[0, 100]} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Line dataKey="female" stroke="#4f46e5" strokeWidth={2} dot={false} name="female % (known)" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        {/* Patterns: seasonality + drift + concentration */}
        <Card>
          <SectionTitle hint="intake shape · TTF drift · WIP concentration">Patterns</SectionTitle>
          <div className="mb-3">
            <div className="mb-1 text-xs font-medium text-slate-500">Seasonality (avg intake by month)</div>
            <div className="flex items-end gap-1">
              {season.map((s) => (
                <div key={s.month} className="flex flex-1 flex-col items-center gap-0.5">
                  <div className="w-full rounded-t bg-brand-400" style={{ height: `${(s.avg / maxSeason) * 48}px` }} title={`${s.label}: avg ${s.avg.toFixed(1)}`} />
                  <span className="text-[9px] text-slate-400">{s.label[0]}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="mb-3 flex items-center gap-2 text-xs">
            <span className="text-slate-500">TTF drift:</span>
            <Chip tone={drift.direction === 'up' ? 'critical' : drift.direction === 'down' ? 'good' : 'neutral'}>
              {drift.direction === 'up' ? '↑ rising' : drift.direction === 'down' ? '↓ falling' : '→ flat'}
            </Chip>
            <span className="text-slate-400">{drift.priorMedian ?? '—'}d → {drift.recentMedian ?? '—'}d</span>
          </div>
          <div>
            <div className="mb-1 text-xs font-medium text-slate-500">Open-WIP concentration (BU)</div>
            <div className="grid gap-1">
              {conc.map((b) => (
                <div key={b.key} className="grid grid-cols-12 items-center gap-2">
                  <span className="col-span-4 truncate text-xs text-slate-600">{b.key}</span>
                  <span className="col-span-6"><Bar value={b.share * 100} /></span>
                  <span className="tabular col-span-2 text-right text-xs text-slate-500">{num(b.count)}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
