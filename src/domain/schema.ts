/**
 * Field schema: logical roles, default header candidates, sensitivity, and the
 * GENERIC canonical taxonomies used for auto-suggestions.
 *
 * What is allowed here (per the privacy brief):
 *   - logical role keys / neutral labels (our own design)
 *   - column HEADER NAMES as `defaultHeaders` (the only data-derived strings allowed)
 *   - GENERIC recruitment vocabulary (e.g. New/Replacement/Drive, the funnel concept
 *     ladder) — domain constants, NOT values discovered from any user's file.
 *
 * What is NOT here: any cell value, BU/person/candidate name, or the dataset's
 * actual `stage` strings (those are discovered at runtime and bound by the user).
 */
import type { CanonicalKind, LogicalRole, RoleDef, RoleGroup } from './types';

export const ROLES: RoleDef[] = [
  // ── identity & period ──
  { key: 'requisitionId', label: 'Requisition ID', kind: 'id', sensitive: false, group: 'identity', defaultHeaders: ['Position Code', 'Requisition ID', 'Req Code', 'Req ID'], description: 'Unique requisition key. May be blank or duplicated; de-dup uses a composite fallback.' },
  { key: 'positionTitle', label: 'Position Title', kind: 'text', sensitive: false, group: 'identity', defaultHeaders: ['Position Title', 'Role', 'Designation', 'Job Title'] },
  { key: 'calendarYear', label: 'Calendar Year', kind: 'category', sensitive: false, group: 'identity', defaultHeaders: ['Calendar year (CY)', 'Calendar Year', 'CY', 'Year'], description: 'Reporting-period label; not necessarily the req-received year.' },

  // ── demand ──
  { key: 'demandType', label: 'Demand Type', kind: 'category', sensitive: false, group: 'demand', canonical: 'demandType', defaultHeaders: ['New/Replacement', 'New / Replacement', 'Demand Type'] },
  { key: 'budgetFlag', label: 'Budgeted', kind: 'category', sensitive: false, group: 'demand', canonical: 'budget', defaultHeaders: ['Budgeted/Non-Budgeted', 'Budgeted / Non-Budgeted', 'Budget'] },
  { key: 'replacementOf', label: 'Replacement Of (person)', kind: 'text', sensitive: true, group: 'demand', defaultHeaders: ['Replacement of', 'Replacement Of', 'Backfill For'] },

  // ── org dimensions ──
  { key: 'businessUnit', label: 'Business Unit', kind: 'category', sensitive: false, group: 'org', defaultHeaders: ['BU', 'Business Unit', 'Vertical'] },
  { key: 'function', label: 'Function', kind: 'category', sensitive: false, group: 'org', defaultHeaders: ['Function', 'Department', 'Sub Function'], description: 'High missingness; blanks treated as "Unspecified".' },
  { key: 'haziraFlag', label: 'Hazira / Non-Hazira', kind: 'category', sensitive: false, group: 'org', canonical: 'hazira', defaultHeaders: ['Hazira / Non-Hazira', 'Hazira/Non-Hazira', 'Hazira'] },
  { key: 'location', label: 'Location', kind: 'category', sensitive: false, group: 'org', defaultHeaders: ['Location', 'City', 'Site'] },
  { key: 'level', label: 'Level / Grade', kind: 'category', sensitive: false, group: 'org', defaultHeaders: ['Level', 'Grade', 'Band'], description: 'Grade formats unified (e.g. M-9 / M9 / M 10).' },
  { key: 'hrHead', label: 'HR Head', kind: 'category', sensitive: true, group: 'org', defaultHeaders: ['HR Head', 'HR Lead', 'BHR Head'], description: 'Primary review slicer. Masked / aliased by default.' },
  { key: 'hrbp', label: 'HRBP', kind: 'category', sensitive: true, group: 'org', defaultHeaders: ['HRBP', 'HR Business Partner'] },
  { key: 'recruiter', label: 'Recruiter', kind: 'category', sensitive: true, group: 'org', defaultHeaders: ['Recruiter', 'TA Recruiter', 'Sourcer'] },
  { key: 'rpoLead', label: 'RPO Lead', kind: 'category', sensitive: true, group: 'org', defaultHeaders: ['Taggd Lead', 'RPO Lead', 'Vendor Lead'] },

  // ── funnel status ──
  { key: 'stage', label: 'Stage', kind: 'category', sensitive: false, group: 'funnel', defaultHeaders: ['Stage', 'Current Stage', 'Status'], description: 'Primary funnel state; values discovered at runtime and ordered in mapping.' },
  { key: 'stageGroup', label: 'Stage Group', kind: 'category', sensitive: false, group: 'funnel', defaultHeaders: ['Stage1', 'Stage Group', 'Stage Bucket'] },
  { key: 'subStage', label: 'Sub Stage', kind: 'category', sensitive: false, group: 'funnel', defaultHeaders: ['Sub Stage', 'Substage', 'Sub-Stage'] },
  { key: 'jdFlag', label: 'JD Available', kind: 'boolean', sensitive: false, group: 'funnel', canonical: 'yesno', defaultHeaders: ['JD', 'JD Available', 'JD Received'] },
  { key: 'qualification', label: 'Qualification', kind: 'category', sensitive: false, group: 'funnel', defaultHeaders: ['Qualification', 'Education'], description: 'Very sparse — diagnostic only.' },

  // ── ageing ──
  { key: 'ageingDays', label: 'Ageing (days)', kind: 'number', sensitive: false, group: 'ageing', defaultHeaders: ['Ageing', 'Aging', 'Age (days)'], description: 'For open reqs, age is recomputed = today − req received.' },
  { key: 'ageingBucket', label: 'Ageing Bucket', kind: 'category', sensitive: false, group: 'ageing', defaultHeaders: ['Ageing Bucket', 'Aging Bucket'], description: 'Recomputed from a single canonical bucket definition.' },
  { key: 'ageingReason', label: 'Ageing Reason', kind: 'text', sensitive: false, group: 'ageing', defaultHeaders: ['Ageing Reason', 'Aging Reason'] },

  // ── funnel date spine ──
  { key: 'reqReceivedDate', label: 'Req Received Date', kind: 'date', sensitive: false, group: 'dates', defaultHeaders: ['Req Received Date', 'Requisition Received Date', 'Req Date'] },
  { key: 'intakeDate', label: 'Intake Date', kind: 'date', sensitive: false, group: 'dates', defaultHeaders: ['Intake Date', 'Intake Call Date'] },
  { key: 'selectionDate', label: 'Selection Date', kind: 'date', sensitive: false, group: 'dates', defaultHeaders: ['Selection date', 'Selection Date'] },
  { key: 'documentationDate', label: 'Documentation Date', kind: 'date', sensitive: false, group: 'dates', defaultHeaders: ['Documentation date', 'Documentation Date'] },
  { key: 'remunerationDate', label: 'Remuneration Discussion Date', kind: 'date', sensitive: false, group: 'dates', defaultHeaders: ['Remuneration discussion date', 'Remuneration Date'] },
  { key: 'draftOfferSentDate', label: 'Draft Offer Sent Date', kind: 'date', sensitive: false, group: 'dates', defaultHeaders: ['Draft offer sent to BHR//Asset Head HR', 'Draft Offer Sent Date'] },
  { key: 'draftOfferApprovedDate', label: 'Draft Offer Approved Date', kind: 'date', sensitive: false, group: 'dates', defaultHeaders: ['Draft offer approved by BHR//Asset Head HR', 'Draft Offer Approved Date'] },
  { key: 'sentForApprovalDate', label: 'Sent for Approval Date', kind: 'date', sensitive: false, group: 'dates', defaultHeaders: ['Sent for approval date', 'Sent For Approval Date'] },
  { key: 'offerApprovalDate', label: 'Offer Approval Date', kind: 'date', sensitive: false, group: 'dates', defaultHeaders: ['Offer Approval Date', 'Offer Approved Date'] },
  { key: 'offerSentDate', label: 'Offer Sent Date', kind: 'date', sensitive: false, group: 'dates', defaultHeaders: ['Offer Sent Date', 'Offer Released Date'] },
  { key: 'offerAcceptedDate', label: 'Offer Accepted Date', kind: 'date', sensitive: false, group: 'dates', defaultHeaders: ['Offer Accepted Date', 'Offer Acceptance Date'] },
  { key: 'joiningDate', label: 'Joining Date', kind: 'date', sensitive: false, group: 'dates', defaultHeaders: ['Joining date', 'Joining Date', 'DOJ', 'Date of Joining'] },

  // ── post-offer / onboarding ──
  { key: 'medicalInitiationDate', label: 'Medical Initiation Date', kind: 'date', sensitive: false, group: 'postoffer', defaultHeaders: ['Medical Initiation Date'], description: 'Often holds "Yes"; treated as completion flag where not a date.' },
  { key: 'medicalCompletionDate', label: 'Medical Completion Date', kind: 'date', sensitive: false, group: 'postoffer', defaultHeaders: ['Medical Completion Date'] },
  { key: 'bgvInitiationDate', label: 'BGV Initiation Date', kind: 'date', sensitive: false, group: 'postoffer', defaultHeaders: ['BGV Initiation Date'] },
  { key: 'bgvCompletionDate', label: 'BGV Completion Date', kind: 'date', sensitive: false, group: 'postoffer', defaultHeaders: ['BGV Completion Date'], description: 'Typically empty/broken — excluded from metrics.' },
  { key: 'kcheckNo', label: 'Kcheck No', kind: 'text', sensitive: false, group: 'postoffer', defaultHeaders: ['Kcheck No'], description: 'Typically empty/placeholder — excluded from metrics.' },
  { key: 'employeeNo', label: 'Employee No', kind: 'text', sensitive: true, group: 'postoffer', defaultHeaders: ['Employee No', 'Emp No'], description: 'Typically empty/placeholder — excluded from metrics.' },

  // ── diversity ──
  { key: 'gender', label: 'Gender', kind: 'category', sensitive: false, group: 'diversity', canonical: 'gender', defaultHeaders: ['Gender', 'Sex'], description: 'Normalised to Male/Female/Unknown; Unknown preserved.' },

  // ── source ──
  { key: 'source', label: 'Source', kind: 'category', sensitive: false, group: 'source', canonical: 'source', defaultHeaders: ['Source', 'Sourcing Channel', 'Channel'] },

  // ── TBO (to-be-onboarded) ──
  { key: 'tboAgeingDays', label: 'TBO Ageing (days)', kind: 'number', sensitive: false, group: 'tbo', defaultHeaders: ['TBO Aging', 'TBO Ageing', 'TBO Age'] },
  { key: 'tboBucket', label: 'TBO Bucket', kind: 'category', sensitive: false, group: 'tbo', defaultHeaders: ['TBO Bucket'], description: 'May contain formula-leak values ("False"); recomputed from canonical buckets.' },
  { key: 'tboAgeingReason', label: 'TBO Ageing Reason', kind: 'text', sensitive: false, group: 'tbo', defaultHeaders: ['TBO Ageing reason', 'TBO Aging Reason'] },
  { key: 'nextFollowUp', label: 'Next Follow-up', kind: 'date', sensitive: false, group: 'tbo', defaultHeaders: ['Next Follow up', 'Next Follow-up'] },
  { key: 'actionables', label: 'Actionables', kind: 'text', sensitive: true, group: 'tbo', defaultHeaders: ['Actionables', 'Action Items'] },

  // ── drops ──
  { key: 'dropList', label: 'Selection / Offer Drops', kind: 'text', sensitive: true, group: 'drops', defaultHeaders: ['Selection drop/Offer Drop candidates', 'Drop Candidates'], description: 'Free text with candidate names + reasons. Derives wasDropped; names masked.' },

  // ── notes ──
  { key: 'taRemark', label: 'TA Remark', kind: 'text', sensitive: true, group: 'notes', defaultHeaders: ["Alifiya's Remark", 'TA Remark', 'Recruiter Remark', 'Remark'], description: 'Header embeds a personal name; aliased to "TA Remark". Hidden by default.' },
];

export const ROLE_BY_KEY: Record<LogicalRole, RoleDef> = Object.fromEntries(
  ROLES.map((r) => [r.key, r]),
) as Record<LogicalRole, RoleDef>;

export const SENSITIVE_ROLES: ReadonlySet<LogicalRole> = new Set(
  ROLES.filter((r) => r.sensitive).map((r) => r.key),
);

export function isSensitive(role: LogicalRole): boolean {
  return SENSITIVE_ROLES.has(role);
}

export const GROUP_LABELS: Record<RoleGroup, string> = {
  identity: 'Identity & Period',
  demand: 'Demand',
  org: 'Org Dimensions',
  funnel: 'Funnel Status',
  ageing: 'Ageing',
  dates: 'Funnel Date Spine',
  postoffer: 'Post-offer / Onboarding',
  diversity: 'Diversity',
  source: 'Source',
  tbo: 'TBO Pipeline',
  drops: 'Drops',
  notes: 'Working Notes',
};

export const GROUP_ORDER: RoleGroup[] = [
  'identity', 'demand', 'org', 'funnel', 'ageing', 'dates',
  'postoffer', 'diversity', 'source', 'tbo', 'drops', 'notes',
];

/** The ordered date spine — backbone of velocity / stage-dwell / forecasting. */
export const DATE_SPINE: LogicalRole[] = [
  'reqReceivedDate', 'intakeDate', 'selectionDate', 'documentationDate',
  'remunerationDate', 'sentForApprovalDate', 'offerApprovalDate',
  'offerSentDate', 'offerAcceptedDate', 'joiningDate',
];

/** All roles that should be parsed as dates (for the shared date parser / DQ). */
export const DATE_ROLES: LogicalRole[] = ROLES.filter((r) => r.kind === 'date').map((r) => r.key);

// ───────────────────────── Generic canonical taxonomies ─────────────────────────

export interface CanonicalRule {
  buckets: string[];
  /** input token is already lower-cased + trimmed; return canonical bucket or null (unmatched). */
  match: (token: string) => string | null;
  /** value to use when the source cell is blank. */
  blank: string;
}

const TRUTHY = new Set(['yes', 'y', 'true', '1', 'available', 'done', 'received', 'complete', 'completed']);
const FALSEY = new Set(['no', 'n', 'false', '0', 'pending', 'awaited', 'na', 'n/a', 'not received', 'not available']);

export const CANONICAL_RULES: Record<CanonicalKind, CanonicalRule> = {
  demandType: {
    buckets: ['New', 'Replacement', 'Drive'],
    blank: 'Unknown',
    match: (t) =>
      t.includes('replac') ? 'Replacement' : t.includes('drive') ? 'Drive' : t.includes('new') ? 'New' : null,
  },
  gender: {
    buckets: ['Male', 'Female', 'Unknown'],
    blank: 'Unknown',
    match: (t) => (t.startsWith('f') ? 'Female' : t.startsWith('m') ? 'Male' : null),
  },
  source: {
    buckets: ['RPO', 'Employee Referral', 'Consultant', 'Unknown'],
    blank: 'Unknown',
    match: (t) =>
      t.includes('rpo') || t.includes('taggd')
        ? 'RPO'
        : t.includes('refer')
          ? 'Employee Referral'
          : t.includes('consult') || t.includes('agenc') || t.includes('vendor')
            ? 'Consultant'
            : null,
  },
  budget: {
    buckets: ['Budgeted', 'Non-Budgeted'],
    blank: 'Unknown',
    match: (t) => (t.includes('non') ? 'Non-Budgeted' : t.includes('budget') ? 'Budgeted' : null),
  },
  hazira: {
    buckets: ['Hazira', 'Non-Hazira'],
    blank: 'Unknown',
    match: (t) => (t.includes('non') ? 'Non-Hazira' : t.includes('hazira') ? 'Hazira' : null),
  },
  yesno: {
    buckets: ['Yes', 'No'],
    blank: 'Unknown',
    match: (t) => (TRUTHY.has(t) ? 'Yes' : FALSEY.has(t) ? 'No' : null),
  },
};

// ───────────────────────── Canonical funnel ladder (Appendix A) ─────────────────────────
// GENERIC recruitment concepts used only to *suggest* an ordering of the dataset's
// discovered `stage` values. The user confirms the binding; we never hard-code the
// dataset's actual stage strings.

export interface FunnelConcept {
  key: string;
  label: string;
  order: number;
  offPipeline?: boolean;
  keywords: string[];
}

export const FUNNEL_CONCEPTS: FunnelConcept[] = [
  { key: 'sourcing', label: 'Sourcing', order: 1, keywords: ['sourc', 'pipeline', 'prospect', 'talent', 'open'] },
  { key: 'screening', label: 'Screening', order: 2, keywords: ['screen', 'shortlist', 'cv', 'resume', 'assess'] },
  { key: 'interview', label: 'Interview / Selection', order: 3, keywords: ['interview', 'selection', 'select', 'panel', 'evaluat'] },
  { key: 'offer', label: 'Offer in progress', order: 4, keywords: ['offer', 'approval', 'documentation', 'remuneration', 'negotiat', 'roll'] },
  { key: 'accepted', label: 'Offer accepted / awaiting join', order: 5, keywords: ['accept', 'tbo', 'to be onboard', 'awaiting', 'to join', 'yet to join'] },
  { key: 'joined', label: 'Joined', order: 6, keywords: ['join', 'onboard', 'hired', 'fulfil', 'closed'] },
  { key: 'hold', label: 'On hold', order: 90, offPipeline: true, keywords: ['hold', 'freeze', 'park', 'stall', 'on-hold'] },
  { key: 'dropped', label: 'Dropped', order: 91, offPipeline: true, keywords: ['drop', 'declin', 'reject', 'withdraw', 'cancel', 'abort', 'close'] },
];
