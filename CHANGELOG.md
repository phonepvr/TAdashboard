# Changelog

All notable changes to this project are documented here.

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
