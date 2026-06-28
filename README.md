# TA Command Centre

An **offline, privacy-first** Talent-Acquisition / recruitment command centre. It
turns a requisition-tracking spreadsheet into an executive decision tool —
**entirely inside your browser**.

> **Status:** Phase 1 (ingestion + privacy spine + data-quality readout). The
> executive summary, HR-Head review, funnel/velocity, ageing/TBO, diversity,
> source, recruiter and forecast views arrive in later phases. See
> [CHANGELOG](./CHANGELOG.md).

---

## 🔒 Privacy (read this first)

This tool is built so there is **nothing to leak**.

- **100% in-browser.** All parsing, computation and rendering happen on your
  device. There is **no server, no upload, no database, no telemetry, no
  analytics**.
- **Zero network egress at runtime.** After the static assets load, the app makes
  **no** `fetch` / `XHR` / `WebSocket` / beacon calls — it works in airplane mode.
  This is enforced by a strict Content-Security-Policy (`connect-src 'none'`)
  delivered via a `<meta>` tag, and **verified in CI** by a Playwright test that
  asserts zero outbound requests.
- **Your file never leaves the tab.** It is parsed in a Web Worker and held only
  in memory unless you explicitly enable local caching.
- **No data in this repository — by construction.** The source contains only
  code and **synthetic** fixtures. The only data-derived strings allowed are
  column header names. A **Data-Leak Guard** + **gitleaks** run on every push and
  fail the build if anything data-shaped appears.
- **PII masked by default.** People and free-text fields are masked everywhere
  until you toggle the local **private drill-down**.
- **Shared-computer escape hatches.** A **Session-only** mode keeps everything in
  memory (discarded on tab close), and **Clear all data** wipes all in-browser
  storage for this site.

Because there is no server, one visitor's data is never visible to another. The
only residual risk is a **shared OS/browser profile** — use Session-only or Clear
all data there.

---

## Using the dashboard

1. **Load** your `.xlsx`/`.csv` (drag-drop or browse) — or click **Load synthetic
   demo data** to explore with generated fake data.
2. **Map columns.** The app auto-maps your headers to logical roles; confirm or
   adjust, order your funnel stages, and bind category values to canonical
   buckets. Your mapping is saved locally (no values, just header names + your
   choices).
3. **Read the Data-Quality readout.** Completeness, date health (valid / missing /
   invalid), controlled-vocabulary violations, broken columns, impossible-sequence
   checks, and a transparent quality score.

Adding more rows, a new month, a new BU/recruiter, or a new stage label needs
**no code change** — everything flows through the mapping config.

---

## One-time setup (repo owner)

This repo deploys to GitHub Pages via GitHub Actions (no `gh-pages` branch).

1. **Pages source:** repo **Settings → Pages → Build and deployment → Source =
   "GitHub Actions"**.
2. **Base path:** already set to `/tadashboard/` in `vite.config.ts`. If you fork
   under a different repo name, change `base` to `/<repo-name>/`. The site serves
   at `https://<user>.github.io/<repo-name>/`.
3. **Native secret protection:** **Settings → Code security → Secret scanning** and
   **Push protection = Enabled** (free on public repos).
4. **Branch protection:** make the CI checks **`build-test`** and **`secret-scan`**
   **required status checks** on `main` so nothing merges without the Data-Leak
   Guard + gitleaks passing.
5. Push to `main` → the **Deploy** workflow builds and publishes.

---

## Definitions

- **Time-to-Fill (TTF):** req received → joining date.
- **Time-to-Hire:** candidate entry → offer accepted.
- **Offer Acceptance Rate:** accepted ÷ sent. *(Note: if your source only logs
  accepted offers, this approaches 100% as an artifact — capture declined offers
  to make it meaningful.)*
- **Yield ratio:** count passing a stage ÷ count entering it.
- **TBO (To-Be-Onboarded):** offer accepted, not yet joined.

Durations use **median + p25/p75** (the data has outliers; mean misleads) and
always show **n**. The **baseline is your own trailing median**; external
benchmarks are reference only.

---

## How it's built

- **React + TypeScript + Vite**, **Tailwind** (system-font stack, zero network),
  **Recharts** (later phases), **SheetJS** for parsing (in a Web Worker),
  **Zustand** state, **IndexedDB** (via `idb`) for local-only persistence,
  **date-fns**.
- Architecture: `src/domain/` holds pure, unit-tested functions (schema, dates,
  normalization, mapping, de-dup, data-quality, demo); `src/worker/` does heavy
  lifting off the main thread; `src/state/` owns the store + persistence;
  `src/ui/` renders.

### Development

No local setup is required — CI builds, tests and deploys. To work locally:

```bash
npm ci
npm run lint && npm run typecheck && npm test   # unit tests (Vitest)
npm run build && npm run guard                   # build + Data-Leak Guard
npm run e2e                                       # Playwright smoke + offline assertion
npm run dev                                        # local dev server (optional)
```

---

## If real data is ever committed by accident (purge runbook)

The architecture (runtime-only data loading) is designed so this never happens.
If it does, treat it as an **incident**:

1. **Do not just delete the file** — git history is permanent. Remove it from
   **all history** with [`git filter-repo`](https://github.com/newren/git-filter-repo)
   or **BFG**, then **force-push**:
   ```bash
   git filter-repo --path path/to/leaked.xlsx --invert-paths
   git push --force --all && git push --force --tags
   ```
2. **Rotate** anything sensitive that may have been exposed.
3. **If the history is short**, prefer **deleting and recreating the repo** from a
   clean state — simpler and less error-prone than rewriting shared history.
4. Invalidate caches: a public repo may have been mirrored/cached; assume the data
   is compromised and act accordingly.

---

## License

MIT — see code headers. The repository contains **no data**, only code and
synthetic fixtures.
