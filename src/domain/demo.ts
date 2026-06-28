/**
 * Synthetic demo data — generated entirely in code at runtime (§4.1). Lets any
 * visitor to the public site explore every view WITHOUT any real data existing.
 *
 * Everything here is fictional and produced from code-defined pools + a seeded
 * PRNG. It deliberately injects messiness (junk dates, vocab variants, "False"
 * formula leaks, placeholder codes, ~21% blanks) so the Data-Quality view and
 * normalization are exercised too. Badged "DEMO DATA" in the UI.
 */
import { ROLES } from './schema';
import { DAY_MS } from './dates';
import type { LogicalRole, ParsedTable, RawCell, RawRow } from './types';

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rng: () => number, arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)]!;
}
function chance(rng: () => number, p: number): boolean {
  return rng() < p;
}
function intBetween(rng: () => number, lo: number, hi: number): number {
  return lo + Math.floor(rng() * (hi - lo + 1));
}

// ── fictional pools (invented words / synthetic names — never from any file) ──
const SYL_A = ['Ka', 'Ro', 'Mi', 'Ta', 'Su', 'Ve', 'Na', 'Li', 'Da', 'Pa', 'An', 'Ji'];
const SYL_B = ['ran', 'vik', 'sha', 'mit', 'lan', 'deep', 'nya', 'tha', 'mir', 'lee', 'sen', 'wal'];
function fakeName(rng: () => number): string {
  return `${pick(rng, SYL_A)}${pick(rng, SYL_B)} ${pick(rng, SYL_A)}${pick(rng, SYL_B)}`;
}

const BUS = ['Polymers', 'Refining', 'Retail', 'Logistics', 'Digital', 'Chemicals', 'Energy', 'Textiles', 'Finance', 'Telecom', 'Healthcare', 'Agri'];
const FUNCTIONS = ['Engineering', 'Operations', 'Finance', 'Sales', 'HR', 'Procurement', 'Quality', 'IT', 'Legal', 'Marketing'];
const TITLES = ['Manager', 'Senior Engineer', 'Analyst', 'Lead', 'Executive', 'Director', 'Specialist', 'Officer', 'Consultant', 'Head'];
const LOCATIONS = ['Mumbai', 'Pune', 'Hazira', 'Jamnagar', 'Bengaluru', 'Delhi', 'Chennai', 'Kolkata', 'Ahmedabad', 'Surat'];
const HR_HEADS = ['Priya Sharma (demo)', 'Arun Mehta (demo)', 'Sana Kapoor (demo)', 'Vivek Rao (demo)'];
// Stage groups (coarser) — stage strings are emitted inline per funnel path below.
const STAGE_GROUPS = ['Open', 'In Process', 'Offer', 'Closed', 'Hold'];
const SUBSTAGES = ['Initial', 'L1', 'L2', 'Final', 'Docs', 'Pending Approval'];
const LEVELS = ['M9', 'M-9', 'M 10', 'M11', 'L4', 'L-5', 'S2'];
// Messy Hazira variants (exercise the 13-distinct normalization).
const HAZIRA = ['Hazira', 'Non-Hazira', 'non hazira', 'HAZIRA ', 'Non Hazira', 'hazira', 'Non-hazira'];
const SOURCES = ['RPO', 'rpo', 'Employee Referral', 'referral', 'Consultant', 'consultant ', 'Vendor'];
const DEMAND = ['New', 'Replacement', 'Drive', 'new', 'replacement'];
const AGE_REASONS = ['Awaiting BHR approval', 'Candidate backed out', 'Position on hold', 'Salary mismatch', 'Notice period long'];

function excelSerial(ms: number): number {
  return Math.round(ms / DAY_MS) + 25569;
}
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function ddMonYY(ms: number): string {
  const d = new Date(ms);
  return `${d.getUTCDate()}-${MONTHS[d.getUTCMonth()]}-${String(d.getUTCFullYear()).slice(2)}`;
}

export interface DemoOptions {
  rows?: number;
  seed?: number;
  nowMs?: number;
}

export function generateDemoTable(opts: DemoOptions = {}): ParsedTable {
  const n = opts.rows ?? 1500;
  const rng = mulberry32(opts.seed ?? 1234567);
  const now = opts.nowMs ?? Date.now();
  const todayMid = Date.UTC(new Date(now).getUTCFullYear(), new Date(now).getUTCMonth(), new Date(now).getUTCDate());

  const headers = ROLES.map((r) => r.defaultHeaders[0]!);
  const colOf: Partial<Record<LogicalRole, number>> = {};
  ROLES.forEach((r, i) => (colOf[r.key] = i));

  // Emit a date as a serial (mostly) or a dd-MMM-yy string (some), to exercise the parser.
  const emitDate = (ms: number): RawCell => (chance(rng, 0.15) ? ddMonYY(ms) : excelSerial(ms));

  const rows: RawRow[] = [];
  for (let i = 0; i < n; i++) {
    const row: RawCell[] = new Array(headers.length).fill(null);
    const set = (role: LogicalRole, v: RawCell) => {
      const c = colOf[role];
      if (c !== undefined) row[c] = v;
    };

    // requisition id: mostly unique; a few blanks; a placeholder "DRIVE-0" repeated often.
    if (chance(rng, 0.04)) set('requisitionId', null);
    else if (chance(rng, 0.05)) set('requisitionId', 'DRIVE-0');
    else set('requisitionId', `REQ-${10000 + i}`);

    set('positionTitle', `${pick(rng, TITLES)} - ${pick(rng, FUNCTIONS)}`);
    set('calendarYear', chance(rng, 0.1) ? 'CY26' : 'CY25');
    // demand: mostly valid, rare mis-keyed name (wrong-column entry).
    set('demandType', chance(rng, 0.01) ? fakeName(rng) : pick(rng, DEMAND));
    set('budgetFlag', chance(rng, 0.999) ? 'Budgeted' : 'Non-Budgeted'); // ~no variance
    set('businessUnit', chance(rng, 0.05) ? `${pick(rng, BUS)} ` : pick(rng, BUS));
    set('function', chance(rng, 0.18) ? null : pick(rng, FUNCTIONS));
    set('haziraFlag', pick(rng, HAZIRA));
    set('location', pick(rng, LOCATIONS));
    set('level', pick(rng, LEVELS));
    set('hrHead', pick(rng, HR_HEADS));
    set('hrbp', fakeName(rng));
    set('recruiter', fakeName(rng));
    set('rpoLead', `${pick(rng, SYL_A)}${pick(rng, SYL_B)} (RPO)`);
    set('jdFlag', chance(rng, 0.02) ? 'maybe' : chance(rng, 0.9) ? 'Yes' : 'No');
    set('subStage', pick(rng, SUBSTAGES));
    set('stageGroup', pick(rng, STAGE_GROUPS));
    set('gender', chance(rng, 0.21) ? null : chance(rng, 0.66) ? 'Male' : 'Female');
    set('source', chance(rng, 0.21) ? null : pick(rng, SOURCES));
    set('qualification', chance(rng, 0.89) ? null : 'B.Tech');

    // ── coherent funnel timeline ──
    const reqMs = todayMid - intBetween(rng, 10, 880) * DAY_MS;
    if (chance(rng, 0.006)) set('reqReceivedDate', 'Awaited'); // junk -> missing
    else if (chance(rng, 0.005)) set('reqReceivedDate', null);
    else set('reqReceivedDate', emitDate(reqMs));
    set('intakeDate', emitDate(reqMs + intBetween(rng, 0, 5) * DAY_MS));

    const path = rng();
    const selMs = reqMs + intBetween(rng, 20, 150) * DAY_MS;
    const offerSentMs = selMs + intBetween(rng, 5, 60) * DAY_MS;
    const acceptMs = offerSentMs + intBetween(rng, 0, 3) * DAY_MS;
    const joinMs = acceptMs + intBetween(rng, 30, 90) * DAY_MS;

    let stage: string;
    if (path < 0.6 && joinMs <= todayMid) {
      // joined
      stage = 'Joined';
      set('selectionDate', emitDate(selMs));
      set('documentationDate', emitDate(selMs + 3 * DAY_MS));
      set('remunerationDate', emitDate(selMs + 5 * DAY_MS));
      set('sentForApprovalDate', emitDate(offerSentMs - 4 * DAY_MS));
      set('offerApprovalDate', chance(rng, 0.002) ? excelSerial(0) : emitDate(offerSentMs - 2 * DAY_MS)); // rare epoch -> invalid
      set('offerSentDate', emitDate(offerSentMs));
      // occasionally drop the accept date though joined (missing intermediate)
      if (!chance(rng, 0.04)) set('offerAcceptedDate', emitDate(acceptMs));
      set('joiningDate', emitDate(joinMs));
    } else if (path < 0.72) {
      // offer accepted, awaiting join (TBO)
      stage = 'Offer Stage';
      set('selectionDate', emitDate(selMs));
      set('offerSentDate', emitDate(offerSentMs));
      set('offerAcceptedDate', emitDate(acceptMs));
      set('tboAgeingDays', intBetween(rng, 1, 80));
      set('tboBucket', chance(rng, 0.03) ? false : '0–30'); // "False" formula leak
      if (chance(rng, 0.1)) set('nextFollowUp', emitDate(todayMid + 7 * DAY_MS));
    } else if (path < 0.8) {
      stage = 'Dropped';
      set('selectionDate', chance(rng, 0.5) ? emitDate(selMs) : null);
      set('dropList', `${fakeName(rng)} - ${pick(rng, AGE_REASONS)}`);
    } else if (path < 0.86) {
      stage = 'On Hold';
      set('ageingReason', pick(rng, AGE_REASONS));
    } else {
      // open in pipeline
      stage = pick(rng, ['Sourcing', 'Screening', 'Interview', 'Selection']);
      if (stage !== 'Sourcing') set('selectionDate', emitDate(selMs));
      if (chance(rng, 0.4)) set('ageingReason', pick(rng, AGE_REASONS));
    }
    set('stage', stage);

    // ageing source value (we recompute canonically anyway)
    if (!chance(rng, 0.1)) set('ageingDays', intBetween(rng, 1, 600));
    set('ageingBucket', pick(rng, ['0-30', '30-60', '60-90', '90+']));

    // broken / placeholder columns (mostly empty, occasional "Yes" leak)
    if (chance(rng, 0.02)) set('medicalInitiationDate', chance(rng, 0.2) ? 'Yes' : emitDate(joinMs - 10 * DAY_MS));
    if (chance(rng, 0.015)) set('medicalCompletionDate', 'Yes');
    if (chance(rng, 0.007)) set('bgvInitiationDate', 'Yes');
    // kcheckNo, bgvCompletionDate, employeeNo: leave empty -> detected broken
    if (chance(rng, 0.25)) set('taRemark', `${pick(rng, AGE_REASONS)} — follow up`);
    if (chance(rng, 0.1)) set('actionables', 'Schedule interview');
    if (chance(rng, 0.07)) set('replacementOf', fakeName(rng));

    rows.push(row);
  }

  return { headers, rows, sheetName: 'DemoData', fileName: 'synthetic-demo', isDemo: true };
}
