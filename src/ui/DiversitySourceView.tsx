/** §8.5 + §8.6 Diversity & Source. Unknown is always explicit. */
import { useMemo } from 'react';
import { useStore } from '../state/store';
import {
  applyFilters,
  genderAcrossFunnel,
  genderBySlice,
  genderJoinedVsPipeline,
  genderRatio,
  referralShare,
  sourceConversion,
  sourceMix,
  type GenderRatio,
} from '../domain/metrics';
import { Bar, Card, CsvButton, SectionTitle, Stat } from './components';
import { FORMULAS } from './definitions';
import { downloadCsv, slugify } from './csv';
import { requisitionDrill } from './drill';
import { num, pct } from './format';

function GenderRow({ label, g, small }: { label: string; g: GenderRatio; small?: boolean }) {
  const total = g.total || 1;
  return (
    <div>
      <div className="mb-0.5 flex justify-between text-xs">
        <span className={small ? 'truncate text-slate-500' : 'text-slate-600'}>{label}</span>
        <span className="text-slate-400">F {pct(g.femaleShareKnown * 100)} · ?{pct(g.unknownShare * 100)}</span>
      </div>
      <div className="flex h-2 overflow-hidden rounded-full bg-slate-100">
        <span className="bg-brand-500" style={{ width: `${(g.female / total) * 100}%` }} />
        <span className="bg-slate-400" style={{ width: `${(g.male / total) * 100}%` }} />
        <span className="bg-slate-200" style={{ width: `${(g.unknown / total) * 100}%` }} />
      </div>
    </div>
  );
}

export function DiversitySourceView() {
  const result = useStore((s) => s.result);
  const filters = useStore((s) => s.filters);
  const reveal = useStore((s) => s.prefs.privateDrillDown);
  const openDrill = useStore((s) => s.openDrill);
  const rows = useMemo(() => (result ? applyFilters(result.rows, filters) : []), [result, filters]);

  const overall = useMemo(() => genderRatio(rows), [rows]);
  const jvp = useMemo(() => genderJoinedVsPipeline(rows), [rows]);
  const funnelRep = useMemo(() => genderAcrossFunnel(rows), [rows]);
  const byBu = useMemo(() => genderBySlice(rows, 'businessUnit').slice(0, 8), [rows]);
  const byLevel = useMemo(() => genderBySlice(rows, 'level').slice(0, 8), [rows]);
  const mix = useMemo(() => sourceMix(rows), [rows]);
  const conv = useMemo(() => sourceConversion(rows), [rows]);

  if (!result) return null;
  if (rows.length === 0) return <div className="px-4 py-16 text-center text-sm text-slate-400">No rows match the current filters.</div>;

  const drill = (title: string, file: string, subset: typeof rows) =>
    openDrill(requisitionDrill(title, file, subset, reveal));
  const genderCsvRows = [
    { scope: 'Overall', group: '—', g: overall },
    ...byBu.map((s) => ({ scope: 'BU', group: s.group, g: s as GenderRatio })),
    ...byLevel.map((s) => ({ scope: 'Level', group: s.group, g: s as GenderRatio })),
  ];

  return (
    <div className="mx-auto grid max-w-6xl gap-5 px-4 py-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Female (known)" value={pct(overall.femaleShareKnown * 100)} sub={`${num(overall.female)} of ${num(overall.male + overall.female)}`} info={FORMULAS.femaleShare}
          onClick={() => drill('Female (known gender) requisitions', 'female-known', rows.filter((r) => r.cat.gender === 'Female'))} />
        <Stat label="Unknown gender" value={pct(overall.unknownShare * 100)} sub="excluded from 'known'" info={FORMULAS.unknownGender}
          onClick={() => drill('Unknown-gender requisitions', 'unknown-gender', rows.filter((r) => (r.cat.gender ?? 'Unknown') !== 'Female' && (r.cat.gender ?? 'Unknown') !== 'Male'))} />
        <Stat label="Joined female" value={pct(jvp.joined.femaleShareKnown * 100)} sub={`pipeline ${pct(jvp.pipeline.femaleShareKnown * 100)}`} info={FORMULAS.joinedFemale}
          onClick={() => drill('Joined female requisitions', 'joined-female', rows.filter((r) => r.isJoined && r.cat.gender === 'Female'))} />
        <Stat label="Referral share" value={pct(referralShare(rows) * 100)} sub="of source mix" info={FORMULAS.referralShare}
          onClick={() => drill('Employee-referral requisitions', 'employee-referral', rows.filter((r) => r.cat.source === 'Employee Referral'))} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <SectionTitle hint="female share of known at each stage reached" info={FORMULAS.funnelRepresentation}
            action={<CsvButton onClick={() => downloadCsv('funnel-representation', funnelRep, [
              { header: 'Stage', value: (f) => f.label },
              { header: 'Female % (known)', value: (f) => Math.round(f.femaleShareKnown * 100) },
              { header: 'n', value: (f) => f.n },
            ])} />}>Representation across funnel</SectionTitle>
          <div className="grid gap-2">
            {funnelRep.map((f) => (
              <div key={f.key} className="grid grid-cols-12 items-center gap-2">
                <span className="col-span-4 truncate text-xs text-slate-600">{f.label}</span>
                <span className="col-span-6"><Bar value={f.femaleShareKnown * 100} /></span>
                <span className="tabular col-span-2 text-right text-xs text-slate-500">{pct(f.femaleShareKnown * 100)}<span className="text-slate-300"> n{num(f.n)}</span></span>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <SectionTitle hint="brand=F · grey=M · light=Unknown" info={FORMULAS.genderBySlice}
            action={<CsvButton onClick={() => downloadCsv('gender-by-slice', genderCsvRows, [
              { header: 'Scope', value: (r) => r.scope },
              { header: 'Group', value: (r) => r.group },
              { header: 'Female', value: (r) => r.g.female },
              { header: 'Male', value: (r) => r.g.male },
              { header: 'Unknown', value: (r) => r.g.unknown },
              { header: 'Female % (known)', value: (r) => Math.round(r.g.femaleShareKnown * 100) },
              { header: 'Unknown %', value: (r) => Math.round(r.g.unknownShare * 100) },
            ])} />}>Gender by slice</SectionTitle>
          <GenderRow label="Overall" g={overall} />
          <div className="mt-2 text-[11px] font-medium uppercase tracking-wide text-slate-400">By BU</div>
          <div className="grid gap-1.5">{byBu.map((s) => <GenderRow key={s.group} label={s.group} g={s} small />)}</div>
          <div className="mt-2 text-[11px] font-medium uppercase tracking-wide text-slate-400">By level</div>
          <div className="grid gap-1.5">{byLevel.map((s) => <GenderRow key={s.group} label={s.group} g={s} small />)}</div>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <SectionTitle info={FORMULAS.sourceMix}
            action={<CsvButton onClick={() => downloadCsv('source-mix', mix, [
              { header: 'Source', value: (b) => b.key },
              { header: 'Count', value: (b) => b.count },
              { header: 'Share %', value: (b) => Math.round(b.share * 100) },
            ])} />}>Source mix</SectionTitle>
          <div className="grid gap-1.5">
            {mix.map((b) => (
              <button
                key={b.key}
                type="button"
                onClick={() => drill(`Source: ${b.key}`, slugify(`source-${b.key}`), rows.filter((r) => (r.cat.source ?? 'Unknown') === b.key))}
                className="grid grid-cols-12 items-center gap-2 rounded px-1 py-0.5 text-left transition-colors hover:bg-slate-50"
              >
                <span className="col-span-3 truncate text-xs text-slate-600">{b.key}</span>
                <span className="col-span-7"><Bar value={b.share * 100} /></span>
                <span className="tabular col-span-2 text-right text-xs text-slate-500">{num(b.count)}</span>
              </button>
            ))}
          </div>
        </Card>
        <Card>
          <SectionTitle hint="which channel is faster / stickier" info={FORMULAS.sourceEffectiveness}
            action={<CsvButton onClick={() => downloadCsv('source-effectiveness', conv, [
              { header: 'Source', value: (s) => s.source },
              { header: 'Reqs', value: (s) => s.total },
              { header: 'Join rate %', value: (s) => Math.round(s.joinRate * 100) },
              { header: 'Median TTF', value: (s) => s.ttf?.median ?? '' },
            ])} />}>Source effectiveness</SectionTitle>
          <table className="w-full text-xs">
            <thead className="text-slate-400"><tr><th className="text-left font-medium">Source</th><th className="text-right font-medium">Reqs</th><th className="text-right font-medium">Join rate</th><th className="text-right font-medium">Median TTF</th></tr></thead>
            <tbody>
              {conv.map((s) => (
                <tr
                  key={s.source}
                  onClick={() => drill(`Source: ${s.source}`, slugify(`source-${s.source}`), rows.filter((r) => (r.cat.source ?? 'Unknown') === s.source))}
                  className="cursor-pointer border-t border-slate-100 hover:bg-slate-50"
                >
                  <td className="py-1 text-slate-700">{s.source}</td>
                  <td className="tabular py-1 text-right text-slate-600">{num(s.total)}</td>
                  <td className="tabular py-1 text-right text-slate-600">{pct(s.joinRate * 100)}</td>
                  <td className="tabular py-1 text-right text-slate-600">{s.ttf ? `${num(s.ttf.median)}d` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}
