/** §8.3 Funnel & Velocity: full funnel + yield, stage-dwell, approval-cycle drag, TTF distribution. */
import { useMemo } from 'react';
import { Bar as RBar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useStore } from '../state/store';
import {
  acceptToJoin,
  applyFilters,
  bottleneck,
  draftOfferCycle,
  durationByGroup,
  funnel,
  intakeLag,
  offerApprovalCycle,
  offerToAccept,
  timeToFill,
  timeToOffer,
  ttfHistogram,
  velocityDecomposition,
  type DurationStats,
} from '../domain/metrics';
import { Bar, Card, SectionTitle } from './components';
import { num, pct } from './format';

const dur = (s: DurationStats | null) => (s ? `${num(s.median)}d` : '—');
const sub = (s: DurationStats | null) => (s ? `p25–p75 ${num(s.p25)}–${num(s.p75)} · n=${num(s.n)}` : 'n=0');

function CycleCard({ label, stats }: { label: string; stats: DurationStats | null }) {
  return (
    <div className="card p-3">
      <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className="tabular mt-1 text-xl font-semibold text-slate-900">{dur(stats)}</div>
      <div className="text-[11px] text-slate-400">{sub(stats)}</div>
    </div>
  );
}

export function FunnelView() {
  const result = useStore((s) => s.result);
  const filters = useStore((s) => s.filters);
  const rows = useMemo(() => (result ? applyFilters(result.rows, filters) : []), [result, filters]);
  const decomp = useMemo(() => velocityDecomposition(rows), [rows]);
  const hist = useMemo(() => ttfHistogram(rows), [rows]);
  const byLevel = useMemo(() => durationByGroup(rows, 'level', 'reqReceivedDate', 'joiningDate').filter((g) => g.stats), [rows]);

  if (!result) return null;
  if (rows.length === 0) return <div className="px-4 py-16 text-center text-sm text-slate-400">No rows match the current filters.</div>;
  const bn = bottleneck(decomp);
  const maxSeg = Math.max(1, ...decomp.map((d) => d.stats?.median ?? 0));
  const ttf = timeToFill(rows);

  return (
    <div className="mx-auto grid max-w-6xl gap-5 px-4 py-5">
      {/* Cycle-time cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <CycleCard label="Time to Fill" stats={ttf} />
        <CycleCard label="Time to Offer" stats={timeToOffer(rows)} />
        <CycleCard label="Offer → Accept" stats={offerToAccept(rows)} />
        <CycleCard label="Accept → Join" stats={acceptToJoin(rows)} />
        <CycleCard label="Intake lag" stats={intakeLag(rows)} />
        <CycleCard label="Offer-approval cycle" stats={offerApprovalCycle(rows)} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* TTF distribution */}
        <Card>
          <SectionTitle hint="30-day bins; median marked in cards above">TTF distribution</SectionTitle>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hist} margin={{ top: 8, right: 12, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="bin" tick={{ fontSize: 9, fill: '#94a3b8' }} interval={1} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} allowDecimals={false} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <RBar dataKey="count" fill="#4f46e5" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Stage-dwell waterfall */}
        <Card>
          <SectionTitle hint="median days per segment — bottleneck in red">Stage dwell</SectionTitle>
          <div className="grid gap-2">
            {decomp.map((d) => (
              <div key={d.key} className="grid grid-cols-12 items-center gap-2">
                <span className="col-span-4 truncate text-xs text-slate-600">{d.label}</span>
                <span className="col-span-6"><Bar value={((d.stats?.median ?? 0) / maxSeg) * 100} tone={d.key === bn?.key ? 'critical' : 'brand'} /></span>
                <span className="tabular col-span-2 text-right text-xs text-slate-500">{dur(d.stats)}</span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-500">Approval drag (draft-offer cycle): <strong>{dur(draftOfferCycle(rows))}</strong>.</p>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Full funnel + yield */}
        <Card>
          <SectionTitle hint="reached-stage counts + yield">Funnel &amp; yield</SectionTitle>
          <div className="grid gap-2">
            {funnel(rows).map((s) => (
              <div key={s.key} className="grid grid-cols-12 items-center gap-2">
                <span className="col-span-3 truncate text-xs text-slate-600">{s.label}</span>
                <span className="col-span-6"><Bar value={s.yieldFromStart * 100} /></span>
                <span className="tabular col-span-3 text-right text-xs text-slate-500">{num(s.count)} <span className="text-slate-400">({pct(s.yieldFromPrev * 100)})</span></span>
              </div>
            ))}
          </div>
        </Card>

        {/* TTF by level */}
        <Card>
          <SectionTitle hint="median TTF by grade (n-shown)">TTF by level</SectionTitle>
          {byLevel.length === 0 ? (
            <p className="text-xs text-slate-400">No level data.</p>
          ) : (
            <table className="w-full text-xs">
              <thead className="text-slate-400"><tr><th className="text-left font-medium">Level</th><th className="text-right font-medium">Median TTF</th><th className="text-right font-medium">p25–p75</th><th className="text-right font-medium">n</th></tr></thead>
              <tbody>
                {byLevel.slice(0, 12).map((g) => (
                  <tr key={g.group} className="border-t border-slate-100">
                    <td className="py-1 text-slate-700">{g.group}</td>
                    <td className="tabular py-1 text-right text-slate-600">{dur(g.stats)}</td>
                    <td className="tabular py-1 text-right text-slate-500">{g.stats ? `${num(g.stats.p25)}–${num(g.stats.p75)}` : '—'}</td>
                    <td className="tabular py-1 text-right text-slate-400">{g.stats ? num(g.stats.n) : 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    </div>
  );
}
