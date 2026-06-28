# Contributing

Thank you for helping improve the TA Command Centre. This project has one
**non-negotiable** rule that overrides everything else.

## 🔒 Never put real data anywhere in this repository

This repo is **public** and its **git history is permanent**. The deployed site
processes each user's file entirely in their own browser — so the repository
itself must contain **no data**, ever.

Do **not** paste, commit, attach, or screenshot any of the following — in code,
commits, issues, pull requests, discussions, or CI logs:

- Real spreadsheets / CSV / exports (any `.xlsx`, `.csv`, …).
- Real values: BU names, person names, candidate names, stage labels, remarks,
  or sample rows.
- Screenshots of the dashboard populated with **real** data.
- Redacted real files — redaction leaks structure and is error-prone. Use
  generated synthetic data instead.

The **only** data-derived strings allowed in the repo are **column header
names** (the field schema). Everything value-level is discovered at runtime.

All fixtures, demos, and test screenshots must be **synthetic, generated in
code** (see `src/domain/demo.ts` and `src/test/fixtures.ts`). The repo is fully
runnable and testable with **zero** real data present.

The **Data-Leak Guard** (`npm run guard`) and **gitleaks** run in CI on every
push/PR and will fail the build if anything data-shaped appears. They are
required status checks.

## Development

There is no required local setup — CI builds, tests, and deploys. If you do work
locally:

```bash
npm ci
npm run lint && npm run typecheck && npm test
npm run build && npm run guard
npm run e2e            # Playwright smoke + offline assertion
```

- Metrics and normalization live in `src/domain/` as **pure functions** — add a
  Vitest unit test for any change there.
- Keep the app **offline**: no `fetch`/network calls; no runtime CDN/font/image
  requests. The CSP (`connect-src 'none'`) and the Playwright offline assertion
  enforce this.
- Mask PII by default; never surface unmasked people/free-text fields outside the
  explicit local private drill-down.

## If real data is ever committed by accident

Treat it as an incident — see the **purge runbook** in the root `README.md`.
