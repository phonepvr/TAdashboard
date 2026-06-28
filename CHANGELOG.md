# Changelog

All notable changes to this project are documented here.

## [1.1.0] — Explain-every-number

### Added
- An accessible **ⓘ info tooltip** on every metric card (KPI cards, “what
  changed” deltas, cycle-time cards, section headers across all views, and the
  Data-Quality cards) that reveals the **exact formula / logic** for that number
  or ratio. Backed by a central `definitions.ts` registry so wording stays
  consistent. Pure CSS (hover + keyboard focus), CSP-safe, and hidden from
  PDF/PNG exports.

## [1.0.0] — Phase 5: Polish (feature-complete)

### Added
- **Presentation mode**: projector-friendly, page-by-page deck for the HR-head
  walkthrough — enlarged type, hidden controls, arrow-key navigation, Esc to exit.
- **Client-side exports** (§11): Executive Summary and HR-head one-pager to
  **PDF** (print path with print CSS) and **PNG** (`html2canvas`, lazy-loaded),
  with a **per-export opt-in** to include unmasked PII. (DQ remediation export
  shipped in 0.2.0.)
- **Self-hosted Inter font** (bundled woff2, zero network).

### Performance & a11y
- **Code-split** the Recharts-heavy views — initial bundle ~661 kB → **~195 kB**;
  charts load on demand.
- **50k-row performance test** in the suite (full pipeline within budget); parsing
  + aggregation run in a Web Worker so the UI stays responsive.
- Accessibility: `aria-current` on the active tab, `role="img"` + descriptive
  `aria-label`s on charts, keyboard-navigable controls, no colour-only encoding.

### Acceptance
- Loads & renders every view fully offline (Playwright asserts **zero** external
  requests + the CSP `<meta>`); repo + history contain **no data**; Data-Leak
  Guard + gitleaks are required checks; build ships no data-shaped or `.map`
  files; 72 unit tests + e2e green.

## [0.4.0] — Phase 4: Patterns & Projections

### Added
- **Forecast engine** (`forecast.ts`, `patterns.ts`) — pure, unit-tested,
  deliberately simple/transparent:
  - **Demand forecast**: 3-mo moving average **+** OLS linear trend with a
    ±1.96σ uncertainty band and a short-history caveat.
  - **Projected joins**: empirical stage→join conversion × median residual time
    applied to the current open pipeline → expected joins/month vs demand →
    **fulfilment gap**, with a visible **assumptions panel**.
  - **Open-req ETA + at-risk** flagging (past the cohort median TTF).
  - **TBO landing** forecast (accepted + median accept→join).
  - **Diversity trajectory** (female share among joins over time).
  - **Patterns**: seasonality, concentration (Pareto), TTF drift.
- **Forecast view** with charts (Recharts), per-projection method captions, and
  "directional" caveats.
- **Dedicated domain views** promoting the combined preview into tabs:
  **Funnel & Velocity** (§8.3: cycle-time cards, TTF histogram, stage-dwell,
  approval-cycle drag, TTF-by-level), **Ageing & TBO** (§8.4: distribution,
  aged-open worklist, reason Pareto, TBO buckets + follow-up tracker),
  **Diversity & Source** (§8.5–8.6: funnel-stage representation, joined-vs-
  pipeline, source effectiveness, referral share), **Recruiters** (§8.7:
  productivity + load distribution, n-guarded, masked).
- 8-tab view switcher; the combined Metrics preview was retired.
- 15 new unit tests (71 total).

## [0.3.0] — Phase 3: Executive Summary + HR-Head Review

### Added
- **Executive Summary** (§8.1, default landing): headline KPI strip, a **"what
  changed"** recent-vs-prior delta row with trend arrows, a **demand-vs-supply**
  line chart (Recharts), funnel snapshot, velocity decomposition + bottleneck,
  a **watchlist** (aged-open + TBO), and auto-generated plain-English **callouts**.
- **HR-Head / BU / Function Review** (§8.2, meeting mode): pick an HR Head (name
  **aliased** "HR Head A/B…") → **scope vs org baseline** on every KPI with
  variance highlighting; **per-BU and per-function scorecards**; scoped
  **aged-open** and **TBO** worklists; **drop analysis** with **name-stripped**
  reasons; and a **print one-pager** (print CSS hides app chrome).
- Review/trend metrics (`review.ts`, `trends.ts`): scorecards, baseline
  comparison, per-group scorecards, TBO worklist, drop analysis, callouts,
  period deltas. Derived a sanitized `dropReason` in normalization.
- 7 new unit tests (63 total). Recharts added (bundled, no network).

## [0.2.0] — Phase 2: Metric catalogue + Data-Quality panel

### Added
- **Metric engine** (`src/domain/metrics/`) — pure, unit-tested functions over the
  normalized dataset, each accepting a `FilterContext`:
  - Volume & demand (mix, budget-coverage caveat, intake/joins trend, pipeline snapshot).
  - Velocity (TTF, time-to-offer, offer→accept, accept→join, approval cycles, intake lag)
    with **median + p25/p75 + n**, plus the **velocity decomposition** and **bottleneck**.
  - Conversion (monotonic funnel tolerant of missing intermediates, offer-acceptance
    rate with **artifact flag**, drop rate, selection→join).
  - Ageing (recomputed-bucket distribution, **aged-open worklist**, reason Pareto, SLA).
  - Diversity (Unknown preserved), Source (mix, conversion, median TTF), Recruiter/RPO
    productivity (n-guarded, PII-masked).
  - External benchmarks (reference only) + a "what to instrument next" roadmap.
- **Metrics view** with a global **filter bar** (period/BU/function/HR head/level/
  recruiter/source/demand) and a **view switcher**; PII masked by default.
- **Data-Quality panel (§8.8)** upgrades: masked **remediation export** (JSON + CSV)
  and **local drill-down** to offending rows (raw rows fetched from the worker,
  masked unless private drill-down is on).
- 17 new metric unit tests (56 total).

## [0.1.0] — Phase 1: Ingestion + privacy spine + data-quality readout

### Added
- **Privacy spine**
  - Strict zero-egress Content-Security-Policy via `<meta>` tag (`connect-src 'none'`).
  - 100% in-browser pipeline; no server, no telemetry, no runtime network calls.
  - Local-only persistence (IndexedDB) for the mapping config.
  - **Session-only** mode (memory-only) and **Clear all data** (wipes all storage).
  - PII masking utilities (initials / stable aliases); private drill-down toggle.
- **Ingestion**
  - Drag-drop / file-picker loader for `.xlsx` and `.csv`.
  - SheetJS parsing inside a **Web Worker** with progress reporting; timezone-safe
    (serials parsed deterministically to UTC midnight).
  - **Load synthetic demo data** — generated in code, badged "DEMO DATA".
- **Schema mapping + normalization engine** (pure, unit-tested)
  - 50 logical roles mapped to header names via fuzzy auto-mapping; one-time
    Mapping Screen to confirm/adjust, order the funnel, and bind canonical buckets.
  - Tolerant shared date parser (valid / missing / **invalid** kept separate).
  - Generic value-agnostic normalization (categories, booleans, numbers, grades).
  - Placeholder-aware de-duplication (latest-record-wins; composite fallback key).
- **Data-Quality readout** (§8.8 foundation)
  - Completeness (worst-first), date health, controlled-vocabulary violations,
    broken-column detection, impossible-sequence consistency checks, and a single
    transparent Data-Quality Score.
- **CI/CD + guards**
  - GitHub Actions: lint, typecheck, unit tests, build, **Data-Leak Guard**,
    Playwright smoke + **offline assertion**, and **gitleaks** secret scanning.
  - Artifact-based GitHub Pages deploy (no `gh-pages` branch); `sourcemap: false`.
  - `.gitignore`, gitleaks config, CONTRIBUTING + issue/PR templates forbidding
    real data.

### Notes
- Offer Acceptance Rate will be shown (later phase) with a prominent "likely a
  logging artifact" caveat when declines are not captured.

[0.1.0]: https://github.com/phonepvr/tadashboard/releases/tag/v0.1.0
