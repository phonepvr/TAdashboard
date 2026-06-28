/** §8.4 Ageing & TBO: ageing distribution, aged-open table, reason Pareto, TBO pipeline + follow-up tracker. */
import { useMemo } from 'react';
import { useStore } from '../state/store';
import {
  ageingDistribution,
  ageingReasonPareto,
  agedOpenWorklist,
  applyFilters,
  distribution,
  pipelineSnapshot,
  slaBreach,
  tboWorklist,
} from '../domain/metrics';
import { formatISO } from '../domain/dates';
import { Bar, Card, SectionTitle, Stat } from './components';
import { FORMULAS } from './definitions';
import { num, pct } from './format';
import { maskValue } from './mask';

export function AgeingView() {
  const result = useStore((s) => s.result);
  const filters = useStore((s) => s.filters);
  const reveal = useStore((s) => s.prefs.privateDrillDown);
  const rows = useMemo(() => (result ? applyFilters(result.rows, filters) : []), [result, filters]);

  const snap = useMemo(() => pipelineSnapshot(rows), [rows]);
  const ageDist = useMemo(() => ageingDistribution(rows), [rows]);
  const reasons = useMemo(() => ageingReasonPareto(rows).slice(0, 8), [rows]);
  const aged = useMemo(() => agedOpenWorklist(rows, 90).slice(0, 20), [rows]);
  const tbo = useMemo(() => tboWorklist(rows), [rows]);
  const tboBuckets = useMemo(() => distribution(rows.filter((r) => r.isTBO), (r) => r.cat.tboBucket ?? null), [rows]);
  const tboReasons = useMemo(() => distribution(rows.filter((r) => r.isTBO), (r) => r.cat.tboAgeingReason ?? null).slice(0, 6), [rows]);

  if (!result) return null;
  if (rows.length === 0) return <div className="px-4 py-16 text-center text-sm text-slate-400">No rows match the current filters.</div>;
  const followUps = tbo.filter((t) => t.nextFollowUp !== null);

  return (
    <div className="mx-auto grid max-w-6xl gap-5 px-4 py-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Open" value={num(snap.open)} info={FORMULAS.open} />
        <Stat label="Aged > 180d" value={num(rows.filter((r) => r.isOpen && (r.num.ageingDays ?? 0) > 180).length)} info={FORMULAS.agedOver180} />
        <Stat label="TBO" value={num(snap.tbo)} sub="awaiting join" info={FORMULAS.tbo} />
        <Stat label="SLA > 90d breach" value={pct(slaBreach(rows, 90).share * 100)} sub="of joined" info={FORMULAS.slaBreach} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <SectionTitle hint="open reqs, recomputed canonical buckets" info={FORMULAS.ageingDistribution}>Ageing distribution</SectionTitle>
          <div className="grid gap-1.5">
            {ageDist.map((b) => (
              <div key={b.key} className="grid grid-cols-12 items-center gap-2">
                <span className="col-span-3 text-xs text-slate-600">{b.key}</span>
                <span className="col-span-7"><Bar value={b.share * 100} tone={b.key === '365+' ? 'critical' : b.key === '181–365' ? 'warn' : 'brand'} /></span>
                <span className="tabular col-span-2 text-right text-xs text-slate-500">{num(b.count)}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <SectionTitle hint="why open reqs are stuck" info={FORMULAS.ageingReasonPareto}>Ageing-reason Pareto</SectionTitle>
          {reasons.length === 0 ? <p className="text-xs text-slate-400">No reasons recorded.</p> : (
            <div className="grid gap-1.5">
              {reasons.map((b) => (
                <div key={b.key} className="grid grid-cols-12 items-center gap-2">
                  <span className="col-span-5 truncate text-xs text-slate-600" title={b.key}>{b.key}</span>
                  <span className="col-span-5"><Bar value={b.share * 100} tone="warn" /></span>
                  <span className="tabular col-span-2 text-right text-xs text-slate-500">{num(b.count)}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card>
        <SectionTitle hint="open > 90 days, oldest first" info={FORMULAS.agedWorklist}>Aged-open worklist</SectionTitle>
        {aged.length === 0 ? <p className="text-xs text-slate-400">No open reqs over 90 days. ✓</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-slate-400"><tr><th className="text-left font-medium">Req</th><th className="text-left font-medium">BU</th><th className="text-left font-medium">Function</th><th className="text-left font-medium">Stage</th><th className="text-right font-medium">Age</th><th className="text-left font-medium">Owner</th></tr></thead>
              <tbody>
                {aged.map((a) => (
                  <tr key={a.i} className="border-t border-slate-100">
                    <td className="py-1 text-slate-700">{a.reqId ?? `#${a.i}`}</td>
                    <td className="py-1 text-slate-600">{a.businessUnit ?? '—'}</td>
                    <td className="py-1 text-slate-600">{a.function ?? '—'}</td>
                    <td className="py-1 text-slate-600">{a.stage ?? '—'}</td>
                    <td className="tabular py-1 text-right text-critical-600">{num(a.ageDays)}d</td>
                    <td className="py-1 text-slate-600">{maskValue(a.hrHead, true, reveal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <SectionTitle hint="recomputed (ignores 'False' formula leaks)" info={FORMULAS.tboBucket}>TBO bucket distribution</SectionTitle>
          {tboBuckets.length === 0 ? <p className="text-xs text-slate-400">No TBO pipeline.</p> : (
            <div className="grid gap-1.5">
              {tboBuckets.map((b) => (
                <div key={b.key} className="grid grid-cols-12 items-center gap-2">
                  <span className="col-span-3 text-xs text-slate-600">{b.key}</span>
                  <span className="col-span-7"><Bar value={b.share * 100} tone="warn" /></span>
                  <span className="tabular col-span-2 text-right text-xs text-slate-500">{num(b.count)}</span>
                </div>
              ))}
            </div>
          )}
          {tboReasons.length > 0 && (
            <div className="mt-3 text-xs text-slate-500">Top TBO reason: <strong>{tboReasons[0]!.key}</strong> ({num(tboReasons[0]!.count)})</div>
          )}
        </Card>
        <Card>
          <SectionTitle hint="offer accepted, with a scheduled follow-up" info={FORMULAS.tboFollowUp}>TBO follow-up tracker</SectionTitle>
          {followUps.length === 0 ? <p className="text-xs text-slate-400">No scheduled follow-ups.</p> : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-slate-400"><tr><th className="text-left font-medium">Req</th><th className="text-right font-medium">TBO age</th><th className="text-left font-medium">Follow-up</th><th className="text-left font-medium">Recruiter</th></tr></thead>
                <tbody>
                  {followUps.slice(0, 12).map((t) => (
                    <tr key={t.i} className="border-t border-slate-100">
                      <td className="py-1 text-slate-700">{t.reqId ?? `#${t.i}`}</td>
                      <td className="tabular py-1 text-right text-slate-600">{t.tboAgeingDays !== null ? `${num(t.tboAgeingDays)}d` : '—'}</td>
                      <td className="py-1 text-slate-600">{t.nextFollowUp !== null ? formatISO(t.nextFollowUp) : '—'}</td>
                      <td className="py-1 text-slate-600">{maskValue(t.recruiter, true, reveal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
