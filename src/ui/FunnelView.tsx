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
import { Bar, Card, CsvButton, InfoTip, SectionTitle } from './components';
import { FORMULAS } from './definitions';
import { downloadCsv } from './csv';
import { requisitionDrill } from './drill';
import { num, pct } from './format';

const dur = (s: DurationStats | null) => (s ? `${num(s.median)}d` : '—');
const sub = (s: DurationStats | null) => (s ? `p25–p75 ${num(s.p25)}–${num(s.p75)} · n=${num(s.n)}` : 'n=0');

function CycleCard({ label, stats, info, onClick }: { label: string; stats: DurationStats | null; info?: string; onClick?: () => void }) {
  const body = (
    <>
      <div className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-slate-500">
        <span>{label}</span>
        {info && <InfoTip text={info} />}
      </div>
      <div className="tabular mt-1 text-xl font-semibold text-slate-900">{dur(stats)}</div>
      <div className="text-[11px] text-slate-400">{sub(stats)}</div>
    </>
  );
  if (!onClick) return <div className="card p-3">{body}</div>;
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
      className="group card relative cursor-pointer p-3 transition-all hover:border-brand-300 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
    >
      {body}
      <span className="no-print absolute right-1.5 top-1.5 text-[10px] text-slate-300 transition-colors group-hover:text-brand-500" aria-hidden>⤢</span>
    </div>
  );
}

export function FunnelView() {
  const result = useStore((s) => s.result);
  const filters = useStore((s) => s.filters);
  const reveal = useStore((s) => s.prefs.privateDrillDown);
  const openDrill = useStore((s) => s.openDrill);
  const rows = useMemo(() => (result ? applyFilters(result.rows, filters) : []), [result, filters]);
  const decomp = useMemo(() => velocityDecomposition(rows), [rows]);
  const hist = useMemo(() => ttfHistogram(rows), [rows]);
  const funnelStages = useMemo(() => funnel(rows), [rows]);
  const byLevel = useMemo(() => durationByGroup(rows, 'level', 'reqReceivedDate', 'joiningDate').filter((g) => g.stats), [rows]);

  if (!result) return null;
  if (rows.length === 0) return <div className="px-4 py-16 text-center text-sm text-slate-400">No rows match the current filters.</div>;
  const bn = bottleneck(decomp);
  const maxSeg = Math.max(1, ...decomp.map((d) => d.stats?.median ?? 0));
  const ttf = timeToFill(rows);

  const drill = (title: string, file: string, subset: typeof rows) =>
    openDrill(requisitionDrill(title, file, subset, reveal));

  return (
    <div className="mx-auto grid max-w-6xl gap-5 px-4 py-5">
      {/* Cycle-time cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <CycleCard label="Time to Fill" stats={ttf} info={FORMULAS.medianTtf}
          onClick={() => drill('Joined cohort (Time-to-Fill)', 'time-to-fill', rows.filter((r) => r.isJoined))} />
        <CycleCard label="Time to Offer" stats={timeToOffer(rows)} info={FORMULAS.timeToOffer}
          onClick={() => drill('Offers sent (Time-to-Offer)', 'time-to-offer', rows.filter((r) => r.date.offerSentDate != null))} />
        <CycleCard label="Offer → Accept" stats={offerToAccept(rows)} info={FORMULAS.offerToAccept}
          onClick={() => drill('Offers accepted (Offer → Accept)', 'offer-to-accept', rows.filter((r) => r.date.offerAcceptedDate != null))} />
        <CycleCard label="Accept → Join" stats={acceptToJoin(rows)} info={FORMULAS.acceptToJoin}
          onClick={() => drill('Joined (Accept → Join)', 'accept-to-join', rows.filter((r) => r.date.offerAcceptedDate != null && r.isJoined))} />
        <CycleCard label="Intake lag" stats={intakeLag(rows)} info={FORMULAS.intakeLag}
          onClick={() => drill('Reqs with an intake date (Intake lag)', 'intake-lag', rows.filter((r) => r.date.intakeDate != null))} />
        <CycleCard label="Offer-approval cycle" stats={offerApprovalCycle(rows)} info={FORMULAS.offerApprovalCycle}
          onClick={() => drill('Offer-approval cycle', 'offer-approval-cycle', rows.filter((r) => r.date.sentForApprovalDate != null))} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* TTF distribution */}
        <Card>
          <SectionTitle hint="30-day bins; median marked in cards above" info={FORMULAS.ttfDistribution}
            action={<CsvButton onClick={() => downloadCsv('ttf-distribution', hist, [
              { header: 'Bin', value: (h) => h.bin },
              { header: 'Count', value: (h) => h.count },
            ])} />}>TTF distribution</SectionTitle>
          <div className="h-56" role="img" aria-label={`Time-to-fill distribution histogram in 30-day bins across ${hist.reduce((a, b) => a + b.count, 0)} joined requisitions.`}>
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
          <SectionTitle hint="median days per segment — bottleneck in red" info={FORMULAS.velocityDecomp}
            action={<CsvButton onClick={() => downloadCsv('stage-dwell', decomp, [
              { header: 'Segment', value: (d) => d.label },
              { header: 'Median days', value: (d) => d.stats?.median ?? '' },
              { header: 'p25', value: (d) => d.stats?.p25 ?? '' },
              { header: 'p75', value: (d) => d.stats?.p75 ?? '' },
              { header: 'n', value: (d) => d.stats?.n ?? 0 },
            ])} />}>Stage dwell</SectionTitle>
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
          <SectionTitle hint="reached-stage counts + yield" info={FORMULAS.funnel}
            action={<CsvButton onClick={() => downloadCsv('funnel-yield', funnelStages, [
              { header: 'Stage', value: (s) => s.label },
              { header: 'Count', value: (s) => s.count },
              { header: 'Yield from prev %', value: (s) => Math.round(s.yieldFromPrev * 100) },
              { header: 'Yield from start %', value: (s) => Math.round(s.yieldFromStart * 100) },
            ])} />}>Funnel &amp; yield</SectionTitle>
          <div className="grid gap-2">
            {funnelStages.map((s) => (
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
          <SectionTitle hint="median TTF by grade (n-shown)" info={FORMULAS.ttfByLevel}
            action={byLevel.length > 0 ? <CsvButton onClick={() => downloadCsv('ttf-by-level', byLevel, [
              { header: 'Level', value: (g) => g.group },
              { header: 'Median TTF', value: (g) => g.stats?.median ?? '' },
              { header: 'p25', value: (g) => g.stats?.p25 ?? '' },
              { header: 'p75', value: (g) => g.stats?.p75 ?? '' },
              { header: 'n', value: (g) => g.stats?.n ?? 0 },
            ])} /> : undefined}>TTF by level</SectionTitle>
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
