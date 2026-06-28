/**
 * §8.1 Executive Summary (default landing). One-glance KPIs with trend, demand
 * vs supply, funnel snapshot, velocity decomposition, "what changed", watchlist,
 * and auto-generated plain-English callouts. Respects filters + PII masking.
 */
import { useMemo, useState } from 'react';
import {
  CartesianGrid,
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
  bottleneck,
  callouts,
  demandVsSupply,
  funnel,
  headlineKpis,
  pipelineSnapshot,
  sourceMix,
  timeToFill,
  velocityDecomposition,
  whatChanged,
  type ChangeItem,
} from '../domain/metrics';
import { Bar, Card, Chip, CsvButton, InfoTip, SectionTitle, Stat } from './components';
import { ExportBar } from './ExportBar';
import { PrintableReport } from './PrintableReport';
import { FORMULAS } from './definitions';
import { nextPaint, printDocument } from './export';
import { downloadCsv } from './csv';
import { requisitionDrill } from './drill';
import { num, pct } from './format';

function fmt(v: number | null, unit: ChangeItem['unit']): string {
  if (v === null) return '—';
  if (unit === 'pct') return `${Math.round(v * 100)}%`;
  if (unit === 'days') return `${num(v)}d`;
  return num(v);
}

function ChangeBadge({ item }: { item: ChangeItem }) {
  const { current, prior, betterWhenLower, unit } = item;
  let arrow = '→';
  let tone: 'good' | 'critical' | 'neutral' = 'neutral';
  if (current !== null && prior !== null && current !== prior) {
    const up = current > prior;
    arrow = up ? '↑' : '↓';
    const good = betterWhenLower ? !up : up;
    tone = good ? 'good' : 'critical';
  }
  return (
    <div className="card p-3">
      <div className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-slate-500">
        <span>{item.label}</span>
        <InfoTip text={FORMULAS[`change_${item.key}` as keyof typeof FORMULAS]} />
      </div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="tabular text-lg font-semibold text-slate-900">{fmt(current, unit)}</span>
        <span className={`text-xs ${tone === 'good' ? 'text-good-600' : tone === 'critical' ? 'text-critical-600' : 'text-slate-400'}`}>
          {arrow} prior {fmt(prior, unit)}
        </span>
      </div>
    </div>
  );
}

export function ExecutiveSummary() {
  const result = useStore((s) => s.result);
  const filters = useStore((s) => s.filters);
  const setActiveView = useStore((s) => s.setActiveView);
  const reveal = useStore((s) => s.prefs.privateDrillDown);
  const setPref = useStore((s) => s.setPref);
  const openDrill = useStore((s) => s.openDrill);
  const [showReport, setShowReport] = useState(false);
  const [includePii, setIncludePii] = useState(false);

  const printFullReport = async () => {
    const needToggle = includePii && !reveal;
    if (needToggle) {
      await setPref('privateDrillDown', true);
      await nextPaint();
    }
    setShowReport(true);
    document.body.classList.add('print-report-active');
    await nextPaint();
    printDocument();
    document.body.classList.remove('print-report-active');
    setShowReport(false);
    if (needToggle) await setPref('privateDrillDown', false);
  };

  const rows = useMemo(() => (result ? applyFilters(result.rows, filters) : []), [result, filters]);
  const k = useMemo(() => headlineKpis(rows), [rows]);
  const snap = useMemo(() => pipelineSnapshot(rows), [rows]);
  const decomp = useMemo(() => velocityDecomposition(rows), [rows]);
  const supply = useMemo(() => demandVsSupply(rows).slice(-14), [rows]);
  const changes = useMemo(() => whatChanged(rows), [rows]);
  const notes = useMemo(() => callouts(rows), [rows]);
  const funnelStages = useMemo(() => funnel(rows), [rows]);
  const mix = useMemo(() => sourceMix(rows), [rows]);
  const ttf = timeToFill(rows);
  const bn = bottleneck(decomp);
  const aged180 = k.agedOver180;

  // Click a KPI → drill to the requisitions behind it (PII masked per the toggle).
  const drill = (title: string, file: string, subset: typeof rows) =>
    openDrill(requisitionDrill(title, file, subset, reveal));
  const topSource = mix[0]?.key ?? null;

  if (!result) return null;
  if (rows.length === 0) return <div className="px-4 py-16 text-center text-sm text-slate-400">No rows match the current filters.</div>;

  const maxSeg = Math.max(1, ...decomp.map((d) => d.stats?.median ?? 0));

  return (
    <div className="mx-auto max-w-6xl px-4 py-5">
      <div className="no-print mb-3 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold text-slate-900">Executive Summary</h1>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-slate-500" title="Include unmasked PII in full report">
            <input type="checkbox" checked={includePii} onChange={(e) => setIncludePii(e.target.checked)} />
            Include PII
          </label>
          <button type="button" className="btn-ghost px-2.5 py-1 text-xs" onClick={() => void printFullReport()}>
            ⬇ Full Report PDF
          </button>
          <ExportBar targetId="exec-summary" baseName="executive-summary" />
        </div>
      </div>
      <div id="exec-summary" className="grid gap-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
        <Stat label="Requisitions" value={num(k.total)} sub={`${num(snap.joined)} joined · ${num(snap.open)} open`} info={FORMULAS.totalReqs}
          onClick={() => drill('All requisitions', 'requisitions', rows)} />
        <Stat label="% Open" value={pct(k.pctOpen * 100)} info={FORMULAS.pctOpen}
          onClick={() => drill('Open requisitions', 'open-requisitions', rows.filter((r) => r.isOpen))} />
        <Stat label="Median TTF" value={ttf ? `${num(ttf.median)}d` : '—'} sub={ttf ? `n=${num(ttf.n)}` : 'n=0'} info={FORMULAS.medianTtf}
          onClick={() => drill('Joined cohort (Time-to-Fill)', 'joined-cohort', rows.filter((r) => r.isJoined))} />
        <Stat label="Offer acceptance" value={pct(k.acceptanceRate * 100)} sub={k.acceptanceLikelyArtifact ? '⚠ artifact' : undefined} info={FORMULAS.offerAcceptance}
          onClick={() => drill('Offers sent', 'offers-sent', rows.filter((r) => r.date.offerSentDate != null))} />
        <Stat label="TBO" value={num(snap.tbo)} info={FORMULAS.tbo}
          onClick={() => drill('TBO — offer accepted, awaiting join', 'tbo', rows.filter((r) => r.isTBO))} />
        <Stat label="Aged > 180d" value={num(aged180)} info={FORMULAS.agedOver180}
          onClick={() => drill('Open reqs aged > 180 days', 'aged-over-180d', rows.filter((r) => r.isOpen && (r.num.ageingDays ?? 0) > 180))} />
        <Stat label="Female share" value={pct(k.femaleShareKnown * 100)} sub={`${pct(k.unknownGenderShare * 100)} unknown`} info={FORMULAS.femaleShare}
          onClick={() => drill('Female (known gender) requisitions', 'female-known', rows.filter((r) => r.cat.gender === 'Female'))} />
        <Stat label="Top source" value={pct(k.topSourceShare * 100)} sub={topSource ?? undefined} info={FORMULAS.topSource}
          onClick={() => topSource && drill(`Source: ${topSource}`, 'top-source', rows.filter((r) => (r.cat.source ?? 'Unknown') === topSource))} />
      </div>

      {/* What changed */}
      <div>
        <SectionTitle hint="recent vs prior comparable period" info="Each tile compares a recent window against the immediately prior window of equal length."
          action={<CsvButton onClick={() => downloadCsv('what-changed', changes, [
            { header: 'Metric', value: (c) => c.label },
            { header: 'Current', value: (c) => c.current },
            { header: 'Prior', value: (c) => c.prior },
            { header: 'Unit', value: (c) => c.unit },
          ])} />}>What changed</SectionTitle>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {changes.map((c) => <ChangeBadge key={c.key} item={c} />)}
        </div>
      </div>

      {/* Demand vs supply */}
      <Card>
        <SectionTitle hint="reqs received vs joins per month" info={FORMULAS.demandVsSupply}
          action={<CsvButton onClick={() => downloadCsv('demand-vs-supply', supply, [
            { header: 'Month', value: (p) => p.month },
            { header: 'Received', value: (p) => p.received },
            { header: 'Joined', value: (p) => p.joined },
          ])} />}>Demand vs supply</SectionTitle>
        <div className="h-64 w-full" role="img" aria-label={`Demand vs supply line chart over ${supply.length} months: requisitions received versus joins per month.`}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={supply} margin={{ top: 8, right: 16, bottom: 0, left: -16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={(m: string) => m.slice(2)} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} allowDecimals={false} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Line type="monotone" dataKey="received" name="Received" stroke="#4f46e5" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="joined" name="Joined" stroke="#16a34a" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="flex gap-4 text-xs text-slate-500">
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-brand-600" /> Received</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-good-500" /> Joined</span>
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Funnel snapshot */}
        <Card>
          <SectionTitle hint="current pipeline by stage reached" info={FORMULAS.funnel}
            action={<CsvButton onClick={() => downloadCsv('funnel-snapshot', funnelStages, [
              { header: 'Stage', value: (s) => s.label },
              { header: 'Count', value: (s) => s.count },
              { header: 'Yield from prev %', value: (s) => Math.round(s.yieldFromPrev * 100) },
              { header: 'Yield from start %', value: (s) => Math.round(s.yieldFromStart * 100) },
            ])} />}>Funnel snapshot</SectionTitle>
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

        {/* Velocity decomposition */}
        <Card>
          <SectionTitle hint="median days per segment" info={FORMULAS.velocityDecomp}
            action={<CsvButton onClick={() => downloadCsv('velocity-decomposition', decomp, [
              { header: 'Segment', value: (d) => d.label },
              { header: 'Median days', value: (d) => d.stats?.median ?? '' },
              { header: 'p25', value: (d) => d.stats?.p25 ?? '' },
              { header: 'p75', value: (d) => d.stats?.p75 ?? '' },
              { header: 'n', value: (d) => d.stats?.n ?? 0 },
            ])} />}>Velocity decomposition</SectionTitle>
          <div className="grid gap-2">
            {decomp.map((d) => (
              <div key={d.key} className="grid grid-cols-12 items-center gap-2">
                <span className="col-span-4 truncate text-xs text-slate-600">{d.label}</span>
                <span className="col-span-6"><Bar value={((d.stats?.median ?? 0) / maxSeg) * 100} tone={d.key === bn?.key ? 'critical' : 'brand'} /></span>
                <span className="tabular col-span-2 text-right text-xs text-slate-500">{d.stats ? `${num(d.stats.median)}d` : '—'}</span>
              </div>
            ))}
          </div>
          {bn && <p className="mt-2 text-xs text-slate-500">Bottleneck: <strong className="text-critical-600">{bn.label}</strong>.</p>}
        </Card>
      </div>

      {/* Watchlist + callouts */}
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <SectionTitle info={FORMULAS.watchlist}>Watchlist</SectionTitle>
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={() => setActiveView('review')} className="flex-1 rounded-lg border border-slate-200 p-3 text-left hover:bg-slate-50">
              <div className="tabular text-2xl font-semibold text-critical-600">{num(aged180)}</div>
              <div className="text-xs text-slate-500">open reqs aged &gt; 180d →</div>
            </button>
            <button type="button" onClick={() => setActiveView('review')} className="flex-1 rounded-lg border border-slate-200 p-3 text-left hover:bg-slate-50">
              <div className="tabular text-2xl font-semibold text-warn-600">{num(snap.tbo)}</div>
              <div className="text-xs text-slate-500">TBO awaiting join →</div>
            </button>
          </div>
        </Card>
        <Card>
          <SectionTitle hint="auto-generated from thresholds" info={FORMULAS.callouts}>Callouts</SectionTitle>
          {notes.length === 0 ? (
            <p className="text-sm text-slate-400">Nothing notable against current thresholds.</p>
          ) : (
            <ul className="grid gap-1.5">
              {notes.map((n) => (
                <li key={n} className="flex gap-2 text-xs text-slate-600">
                  <Chip tone="warn">!</Chip>
                  <span>{n}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
      </div>
      {showReport && <PrintableReport />}
    </div>
  );
}
