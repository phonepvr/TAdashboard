# Changelog

All notable changes to this project are documented here.

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
