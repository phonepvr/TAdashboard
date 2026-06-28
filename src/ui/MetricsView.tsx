/**
 * Phase-2 metrics view: renders the §7 catalogue output against the (filtered)
 * dataset. Not the final executive layout (Phase 3) — this proves the engine.
 * All durations show median + p25/p75 + n; PII is masked unless drill-down is on.
 */
import { useMemo } from 'react';
import { useStore } from '../state/store';
import {
  ageingDistribution,
  agedOpenWorklist,
  applyFilters,
  bottleneck,
  demandMix,
  demandVsSupply,
  funnel,
  genderBySlice,
  genderRatio,
  headlineKpis,
  NOT_COMPUTABLE,
  offerAcceptanceRate,
  pipelineSnapshot,
  recruiterProductivity,
  slaBreach,
  sourceConversion,
  timeToFill,
  velocityDecomposition,
} from '../domain/metrics';
import type { DurationStats } from '../domain/metrics';
import { Bar, Card, SectionTitle, Stat } from './components';
import { num, pct } from './format';
import { maskValue } from './mask';

const med = (s: DurationStats | null) => (s ? `${num(s.median)}d` : '—');
const spread = (s: DurationStats | null) => (s ? `p25–p75 ${num(s.p25)}–${num(s.p75)} · n=${num(s.n)}` : 'n=0');

export function MetricsView() {
  const result = useStore((s) => s.result);
  const filters = useStore((s) => s.filters);
  const reveal = useStore((s) => s.prefs.privateDrillDown);

  const rows = useMemo(() => (result ? applyFilters(result.rows, filters) : []), [result, filters]);
  const k = useMemo(() => headlineKpis(rows), [rows]);
  const snap = useMemo(() => pipelineSnapshot(rows), [rows]);
  const decomp = useMemo(() => velocityDecomposition(rows), [rows]);
  const bn = bottleneck(decomp);
  const ttf = timeToFill(rows);
  const acc = offerAcceptanceRate(rows);

  if (!result) return null;
  if (rows.length === 0) {
    return <div className="px-4 py-16 text-center text-sm text-slate-400">No rows match the current filters.</div>;
  }

  const maxSeg = Math.max(1, ...decomp.map((d) => d.stats?.median ?? 0));

  return (
    <div className="mx-auto grid max-w-6xl gap-5 px-4 py-5">
      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
        <Stat label="Requisitions" value={num(k.total)} sub={`${num(snap.joined)} joined · ${num(snap.open)} open`} />
        <Stat label="% Open" value={pct(k.pctOpen * 100)} sub={`${num(k.open)} active`} />
        <Stat label="Median TTF" value={med(ttf)} sub={spread(ttf)} />
        <Stat
          label="Offer acceptance"
          value={pct(acc.rate * 100)}
          sub={acc.likelyArtifact ? '⚠ likely artifact (see note)' : `${num(acc.accepted)}/${num(acc.sent)}`}
        />
        <Stat label="TBO (awaiting join)" value={num(snap.tbo)} sub="offer accepted, not joined" />
        <Stat label="Aged > 180d (open)" value={num(k.agedOver180)} sub="needs attention" />
        <Stat label="Female share" value={pct(k.femaleShareKnown * 100)} sub={`of known · ${pct(k.unknownGenderShare * 100)} unknown`} />
        <Stat label="Top source" value={pct(k.topSourceShare * 100)} sub="share of mix" />
      </div>

      {acc.likelyArtifact && (
        <Card className="border-warn-500/40 bg-warn-50">
          <p className="text-xs text-warn-600">
            <strong>Offer-acceptance caveat:</strong> a rate this high almost certainly means declined
            offers aren&apos;t captured in the source — treat it as a logging artifact, not a true rate.
            Capturing declined offers is on the &quot;what to instrument next&quot; list below.
          </p>
        </Card>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Velocity decomposition */}
        <Card>
          <SectionTitle hint="median days per segment — where time accumulates">Velocity decomposition</SectionTitle>
          <div className="grid gap-2">
            {decomp.map((d) => (
              <div key={d.key} className="grid grid-cols-12 items-center gap-2">
                <span className="col-span-4 truncate text-xs text-slate-600">{d.label}</span>
                <span className="col-span-6">
                  <Bar value={((d.stats?.median ?? 0) / maxSeg) * 100} tone={d.key === bn?.key ? 'critical' : 'brand'} />
                </span>
                <span className="tabular col-span-2 text-right text-xs text-slate-500">{med(d.stats)}</span>
              </div>
            ))}
          </div>
          {bn && (
            <p className="mt-3 text-xs text-slate-500">
              Bottleneck: <strong className="text-critical-600">{bn.label}</strong> (median {med(bn.stats)}).
              External TTF benchmark 45–90d is reference only; your trailing median is the baseline.
            </p>
          )}
        </Card>

        {/* Funnel */}
        <Card>
          <SectionTitle hint="reached-stage counts (tolerant of missing intermediate dates)">Funnel &amp; yield</SectionTitle>
          <div className="grid gap-2">
            {funnel(rows).map((s) => (
              <div key={s.key} className="grid grid-cols-12 items-center gap-2">
                <span className="col-span-3 truncate text-xs text-slate-600">{s.label}</span>
                <span className="col-span-6">
                  <Bar value={s.yieldFromStart * 100} tone="brand" />
                </span>
                <span className="tabular col-span-3 text-right text-xs text-slate-500">
                  {num(s.count)} <span className="text-slate-400">({pct(s.yieldFromPrev * 100)})</span>
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Demand vs supply */}
      <Card>
        <SectionTitle hint="reqs received vs joins per month">Demand vs supply</SectionTitle>
        <DemandSupply rows={rows} />
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Ageing + worklist */}
        <Card>
          <SectionTitle hint="open reqs by recomputed bucket">Ageing &amp; aged-open worklist</SectionTitle>
          <div className="mb-3 grid gap-1.5">
            {ageingDistribution(rows).map((b) => (
              <div key={b.key} className="grid grid-cols-12 items-center gap-2">
                <span className="col-span-3 text-xs text-slate-600">{b.key}</span>
                <span className="col-span-7"><Bar value={b.share * 100} tone={b.key === '365+' ? 'critical' : 'warn'} /></span>
                <span className="tabular col-span-2 text-right text-xs text-slate-500">{num(b.count)}</span>
              </div>
            ))}
          </div>
          <div className="text-xs text-slate-500">
            SLA &gt; 90d: <strong>{pct(slaBreach(rows, 90).share * 100)}</strong> of joined breached.
          </div>
          <AgedWorklist rows={rows} reveal={reveal} />
        </Card>

        {/* Diversity */}
        <Card>
          <SectionTitle hint="Unknown shown explicitly, never hidden">Diversity</SectionTitle>
          <GenderBars label="Overall" g={genderRatio(rows)} />
          <div className="mt-3 grid gap-2">
            {genderBySlice(rows, 'businessUnit')
              .slice(0, 6)
              .map((s) => (
                <GenderBars key={s.group} label={s.group} g={s} small />
              ))}
          </div>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Source */}
        <Card>
          <SectionTitle hint="mix · join rate · median TTF">Source effectiveness</SectionTitle>
          <table className="w-full text-xs">
            <thead className="text-slate-400">
              <tr>
                <th className="text-left font-medium">Source</th>
                <th className="text-right font-medium">Reqs</th>
                <th className="text-right font-medium">Join rate</th>
                <th className="text-right font-medium">Median TTF</th>
              </tr>
            </thead>
            <tbody>
              {sourceConversion(rows).map((s) => (
                <tr key={s.source} className="border-t border-slate-100">
                  <td className="py-1 text-slate-700">{s.source}</td>
                  <td className="tabular py-1 text-right text-slate-600">{num(s.total)}</td>
                  <td className="tabular py-1 text-right text-slate-600">{pct(s.joinRate * 100)}</td>
                  <td className="tabular py-1 text-right text-slate-600">{med(s.ttf)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        {/* Recruiter productivity */}
        <Card>
          <SectionTitle hint="WIP · throughput · median TTF (n-guarded) · PII masked">Recruiter productivity</SectionTitle>
          <table className="w-full text-xs">
            <thead className="text-slate-400">
              <tr>
                <th className="text-left font-medium">Recruiter</th>
                <th className="text-right font-medium">WIP</th>
                <th className="text-right font-medium">Joins</th>
                <th className="text-right font-medium">Median TTF</th>
              </tr>
            </thead>
            <tbody>
              {recruiterProductivity(rows, 'recruiter', 5)
                .slice(0, 10)
                .map((r) => (
                  <tr key={r.name} className="border-t border-slate-100">
                    <td className="py-1 text-slate-700">{maskValue(r.name, true, reveal)}</td>
                    <td className="tabular py-1 text-right text-slate-600">{num(r.openWip)}</td>
                    <td className="tabular py-1 text-right text-slate-600">{num(r.joined)}</td>
                    <td className="tabular py-1 text-right text-slate-600">{r.ttf ? med(r.ttf) : <span className="text-slate-300">n&lt;5</span>}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </Card>
      </div>

      {/* Demand mix + measurement maturity */}
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <SectionTitle>Demand mix</SectionTitle>
          <div className="grid gap-1.5">
            {demandMix(rows).map((b) => (
              <div key={b.key} className="grid grid-cols-12 items-center gap-2">
                <span className="col-span-3 text-xs text-slate-600">{b.key}</span>
                <span className="col-span-7"><Bar value={b.share * 100} tone="brand" /></span>
                <span className="tabular col-span-2 text-right text-xs text-slate-500">{num(b.count)}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <SectionTitle hint="honest gaps, not silent ones">Measurement maturity — what to instrument next</SectionTitle>
          <ul className="grid gap-2">
            {NOT_COMPUTABLE.map((n) => (
              <li key={n.metric} className="text-xs">
                <span className="font-medium text-slate-700">{n.metric}</span>
                <span className="text-slate-400"> — {n.reason}.</span>
                <span className="text-slate-500"> Capture: {n.capture}.</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}

function GenderBars({ label, g, small }: { label: string; g: ReturnType<typeof genderRatio>; small?: boolean }) {
  const total = g.total || 1;
  return (
    <div>
      <div className="mb-0.5 flex justify-between text-xs">
        <span className={small ? 'truncate text-slate-500' : 'text-slate-600'}>{label}</span>
        <span className="text-slate-400">
          F {pct(g.femaleShareKnown * 100)} · ?{pct(g.unknownShare * 100)}
        </span>
      </div>
      <div className="flex h-2 overflow-hidden rounded-full bg-slate-100">
        <span className="bg-brand-500" style={{ width: `${(g.female / total) * 100}%` }} />
        <span className="bg-slate-400" style={{ width: `${(g.male / total) * 100}%` }} />
        <span className="bg-slate-200" style={{ width: `${(g.unknown / total) * 100}%` }} />
      </div>
    </div>
  );
}

function AgedWorklist({ rows, reveal }: { rows: ReturnType<typeof applyFilters>; reveal: boolean }) {
  const aged = agedOpenWorklist(rows, 180).slice(0, 8);
  if (aged.length === 0) return <p className="mt-3 text-xs text-slate-400">No open reqs over 180 days. ✓</p>;
  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full text-xs">
        <thead className="text-slate-400">
          <tr>
            <th className="text-left font-medium">Req</th>
            <th className="text-left font-medium">BU</th>
            <th className="text-left font-medium">Stage</th>
            <th className="text-right font-medium">Age</th>
            <th className="text-left font-medium">Owner</th>
          </tr>
        </thead>
        <tbody>
          {aged.map((a) => (
            <tr key={a.i} className="border-t border-slate-100">
              <td className="py-1 text-slate-700">{a.reqId ?? `#${a.i}`}</td>
              <td className="py-1 text-slate-600">{a.businessUnit ?? '—'}</td>
              <td className="py-1 text-slate-600">{a.stage ?? '—'}</td>
              <td className="tabular py-1 text-right text-critical-600">{num(a.ageDays)}d</td>
              <td className="py-1 text-slate-600">{maskValue(a.hrHead, true, reveal)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DemandSupply({ rows }: { rows: ReturnType<typeof applyFilters> }) {
  const series = demandVsSupply(rows).slice(-12);
  const max = Math.max(1, ...series.map((s) => Math.max(s.received, s.joined)));
  return (
    <div className="flex items-end gap-2 overflow-x-auto">
      {series.map((s) => (
        <div key={s.month} className="flex min-w-[34px] flex-col items-center gap-1">
          <div className="flex h-24 items-end gap-0.5">
            <div className="w-2.5 rounded-t bg-brand-500" style={{ height: `${(s.received / max) * 100}%` }} title={`received ${s.received}`} />
            <div className="w-2.5 rounded-t bg-good-500" style={{ height: `${(s.joined / max) * 100}%` }} title={`joined ${s.joined}`} />
          </div>
          <span className="text-[9px] text-slate-400">{s.month.slice(2)}</span>
        </div>
      ))}
      <div className="ml-3 flex flex-col gap-1 text-xs text-slate-500">
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-brand-500" /> Received</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-good-500" /> Joined</span>
      </div>
    </div>
  );
}
