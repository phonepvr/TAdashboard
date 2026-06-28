/**
 * Plain-English formula/logic for every metric shown on a card. Surfaced via the
 * ⓘ tooltip so every number is defensible in a leadership room. Keep each entry
 * short (it renders in a small popover).
 */
export const FORMULAS = {
  // ── headline KPIs ──
  totalReqs: 'Count of requisitions after de-duplication (latest record wins; high-frequency placeholder codes kept distinct).',
  pctOpen: 'Open ÷ total. Open = not joined and not dropped (includes on-hold and TBO).',
  medianTtf: 'Time-to-Fill = joining date − req received date, over the joined cohort. Median (p25/p75 shown), clamped 0–540 days; n = cohort size.',
  offerAcceptance: 'Accepted ÷ sent (offer-accepted date present ÷ offer-sent date present). ⚠ If declined offers aren’t logged this nears 100% — treat as a logging artifact.',
  tbo: 'To-Be-Onboarded = offer accepted and not yet joined.',
  agedOver180: 'Open reqs whose recomputed age (today − req received) exceeds 180 days.',
  femaleShare: 'Female ÷ (Male + Female) — “of known”. Unknown (blank gender) is excluded from the denominator and reported separately.',
  unknownGender: 'Blank / unrecognised gender ÷ total. Kept explicit; excluded from “known” ratios.',
  topSource: 'Largest channel’s share of the source mix (RPO / Employee Referral / Consultant / Unknown).',

  // ── "what changed" deltas ──
  change_reqs: 'Requisitions with a req-received date in the last 30 days vs the prior 30 days.',
  change_joins: 'Joining dates in the last 30 days vs the prior 30 days.',
  change_ttf: 'Median Time-to-Fill for reqs that joined in the last 90 days vs the prior 90 days (lower is better).',
  change_accept: 'Accepted ÷ sent for offers sent in the last 90 days vs the prior 90 days.',

  // ── funnel / velocity ──
  funnel: 'Reqs that reached each stage = have that timestamp OR any later one (tolerant of missing intermediate dates). Yield = stage ÷ previous stage.',
  velocityDecomp: 'Median days between consecutive funnel timestamps. The largest segment is the bottleneck (red).',
  ttfDistribution: 'Histogram of Time-to-Fill (joining − req received) in 30-day bins over the joined cohort.',
  ttfByLevel: 'Median TTF grouped by grade/level, with p25–p75 and n. Small groups are still listed (judge by n).',
  timeToOffer: 'Offer-sent date − req received date. Median + p25/p75 + n; clamp 0–540 days.',
  offerToAccept: 'Offer-accepted − offer-sent. Median; clamp 0–120 days.',
  acceptToJoin: 'Joining − offer-accepted (largely notice period). Median; clamp 0–365 days.',
  intakeLag: 'Intake date − req received date. Median; clamp 0–180 days.',
  offerApprovalCycle: 'Offer-approval − sent-for-approval (internal process drag). Median; clamp 0–120 days.',
  demandVsSupply: 'Monthly counts: requisitions received (by req-received date) vs joins (by joining date).',
  watchlist: 'Open reqs aged > 180 days, and TBO (offer accepted, not joined). Click a tile to open the Review.',
  callouts: 'Auto-generated when a slice crosses a threshold (e.g. a BU’s median TTF > org median + 30 days, or aged-open reqs exist).',

  // ── ageing / TBO ──
  open: 'Not joined and not dropped (includes on-hold and TBO).',
  slaBreach: 'Joined reqs whose TTF exceeds the 90-day target ÷ joined cohort.',
  ageingDistribution: 'Open reqs bucketed by recomputed age (today − req received) into canonical bands (0–30 … 365+).',
  ageingReasonPareto: 'Distribution of the ageing-reason field among open reqs, most frequent first.',
  agedWorklist: 'Open reqs older than 90 days by recomputed age, oldest first.',
  tboBucket: 'TBO reqs bucketed by recomputed TBO age (today − offer-accepted). Source “False” formula leaks are ignored.',
  tboFollowUp: 'TBO reqs that have a scheduled next-follow-up date.',

  // ── diversity / source ──
  joinedFemale: 'Female share (of known) among the joined cohort; the pipeline figure is shown for comparison.',
  referralShare: 'Employee-referral share of the source mix.',
  funnelRepresentation: 'Female share (of known) among reqs that reached each funnel stage — where representation drops off.',
  genderBySlice: 'Male / Female / Unknown split per group. Bar segments: Female · Male · Unknown.',
  sourceMix: 'Distribution of the canonical source (RPO / Employee Referral / Consultant / Unknown). Blanks → Unknown.',
  sourceEffectiveness: 'Per source: req count, join rate (joined ÷ total), and median TTF.',

  // ── recruiters ──
  recruiterCount: 'Distinct recruiters with at least one req in the current scope.',
  recruiterMaxLoad: 'Highest total reqs held by a single recruiter (median load shown alongside).',
  rpoCount: 'Distinct RPO (Taggd) leads in the current scope.',
  rpoMaxLoad: 'Highest total reqs held by a single RPO lead (median shown).',
  recruiterProductivity: 'Per recruiter: total, open WIP, joins, and median TTF — shown only when joins ≥ 5 to avoid small-sample noise. Names masked unless private drill-down.',
  rpoProductivity: 'Per RPO (vendor) lead: total, open WIP, joins, and median TTF (n ≥ 5). Masked unless private drill-down.',

  // ── forecast ──
  demandForecast: 'Monthly intake fit with an OLS (least-squares) trend and a 3-month moving average. Band = ±1.96σ of residuals. Directional — history is short.',
  projectedJoins: 'For each open req, P(join) and expected join month come from the historical stage→join conversion and median residual time. Summed per month vs trailing-3-month demand → fulfilment gap.',
  atRisk: 'Open reqs whose recomputed age already exceeds their cohort (level) median TTF. ETA = median residual time from the current stage.',
  tboLanding: 'Each TBO req’s expected join month = offer-accepted date + median accept→join.',
  diversityTrajectory: 'Female share (of known) among joins, by joining month.',
  patterns: 'Seasonality = average intake by calendar month. TTF drift = recent-90d vs prior-90d median TTF. Concentration = open WIP by BU (Pareto).',

  // ── data quality ──
  rowsIn: 'Raw data rows (header excluded).',
  afterDedup: 'Rows after de-duplication (latest record wins; high-frequency placeholder codes kept distinct).',
  blankIds: 'Rows with no requisition id, plus codes repeating so often they’re treated as non-unique placeholders.',
  brokenColumns: 'Columns with ≤ 2 non-blank cells or < 1% populated — excluded from metrics and listed.',
  dqScore: 'Transparent score = 0.5×completeness + 0.3×validity + 0.2×consistency. Completeness = mean fill %; validity = date-validity & vocab-match; consistency = 1 − issues ÷ rows.',
  completeness: '% of rows with a non-blank value per field (worst first).',
  dateHealth: 'Per date field: valid (in-window real date) · missing (blank or non-date text) · invalid (epoch / out-of-range).',
  vocabViolations: 'Non-blank values that don’t map to a field’s controlled vocabulary, with counts — fix in mapping or at source.',
  consistency: 'Impossible / suspicious date sequences (e.g. join before req, accept before sent). Click to drill to the offending rows.',

  // ── HR-head review ──
  reviewScorecard: 'Each KPI for this head’s requisitions vs the org baseline (all reqs in scope). Variance is coloured red when worse for that metric’s direction, green when better.',
  groupScorecard: 'Per group: req count, median TTF, offer acceptance, % of open aged > 180d, and drop rate.',
  reviewAgedWorklist: 'This head’s open reqs older than 90 days (recomputed age), oldest first — the list to walk in the meeting.',
  reviewTbo: 'This head’s offer-accepted-not-joined reqs, oldest TBO age first. Recruiter masked unless private drill-down.',
  dropAnalysis: 'Count and rate of dropped reqs in scope, with a Pareto of reasons — candidate names stripped.',
} as const;

export type FormulaKey = keyof typeof FORMULAS;
