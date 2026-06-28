/** §7F — diversity. Unknown is preserved explicitly (never hidden). */
import type { LogicalRole, NormalizedRow } from '../types';
import { groupBy, share } from './stats';
import { FUNNEL_STAGES } from './conversion';

export interface GenderRatio {
  male: number;
  female: number;
  unknown: number;
  total: number;
  femaleShareKnown: number; // female / (male+female)
  femaleShareTotal: number; // female / total
  unknownShare: number;
}

export function genderRatio(rows: NormalizedRow[]): GenderRatio {
  let male = 0;
  let female = 0;
  let unknown = 0;
  for (const r of rows) {
    const g = r.cat.gender ?? 'Unknown';
    if (g === 'Male') male++;
    else if (g === 'Female') female++;
    else unknown++;
  }
  const total = rows.length;
  return {
    male,
    female,
    unknown,
    total,
    femaleShareKnown: share(female, male + female),
    femaleShareTotal: share(female, total),
    unknownShare: share(unknown, total),
  };
}

export interface GenderSlice extends GenderRatio {
  group: string;
}

export function genderBySlice(rows: NormalizedRow[], role: LogicalRole): GenderSlice[] {
  const groups = groupBy(rows, (r) => r.cat[role] ?? null);
  return [...groups.entries()]
    .map(([group, gr]) => ({ group, ...genderRatio(gr) }))
    .sort((a, b) => b.total - a.total);
}

/** Joined cohort diversity vs the rest of the pipeline. */
export function genderJoinedVsPipeline(rows: NormalizedRow[]): { joined: GenderRatio; pipeline: GenderRatio } {
  return {
    joined: genderRatio(rows.filter((r) => r.isJoined)),
    pipeline: genderRatio(rows.filter((r) => !r.isJoined)),
  };
}

/** Female share (of known) at each funnel stage reached — where representation drops. */
export function genderAcrossFunnel(rows: NormalizedRow[]): { key: string; label: string; femaleShareKnown: number; n: number }[] {
  return FUNNEL_STAGES.map((s, i) => {
    const reached = rows.filter((r) => {
      for (let j = i; j < FUNNEL_STAGES.length; j++) if (r.date[FUNNEL_STAGES[j]!.role] != null) return true;
      return false;
    });
    const g = genderRatio(reached);
    return { key: s.key, label: s.label, femaleShareKnown: g.femaleShareKnown, n: g.male + g.female };
  });
}
