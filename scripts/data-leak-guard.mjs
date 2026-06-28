#!/usr/bin/env node
/**
 * Data-Leak Guard (§1.4 / §12). Blocking check that fails the build if anything
 * data-shaped is present. Runs against the working tree AND (when present) the
 * built artifact in dist/.
 *
 * Checks:
 *   (a) any tracked file with a data extension (xlsx/csv/…) or living in a data path
 *   (b) oversized non-asset text files (possible bulk data)
 *   (c) files that look like delimited bulk data (many comma/tab rows)
 *   (d) JSON that looks like a record dump (top-level array) rather than config
 *   (e) the built artifact containing data-shaped files or .map files
 *
 * Secret scanning (gitleaks) runs as a dedicated CI step; if the binary happens
 * to be installed locally we also invoke it here.
 */
import { execSync } from 'node:child_process';
import { readFileSync, statSync, existsSync, readdirSync } from 'node:fs';
import path from 'node:path';

const DATA_EXT = new Set(['.xlsx', '.xls', '.xlsm', '.xlsb', '.csv', '.tsv', '.parquet', '.ndjson']);
const ARTIFACT_FORBIDDEN = new Set([...DATA_EXT, '.map']);
const DATA_PATHS = ['data/', 'samples/', 'uploads/', 'exports/', 'private/', 'fixtures-real/'];
const SIZE_LIMIT = 1_000_000; // 1 MB
const ALLOW_LARGE = new Set(['package-lock.json', 'pnpm-lock.yaml', 'yarn.lock']);
const TEXT_EXT = new Set(['.txt', '.csv', '.tsv', '.json', '.md', '.log', '.dat', '.ndjson', '']);
const JSON_CONFIG =
  /(^|\/)(package\.json|package-lock\.json|tsconfig[^/]*\.json|[^/]*\.config\.json|manifest\.json)$/;

const violations = [];
const fail = (rule, file, detail) => violations.push({ rule, file, detail });

function trackedFiles() {
  return execSync('git ls-files', { encoding: 'utf8' }).split('\n').filter(Boolean);
}

function looksDelimited(content) {
  const lines = content.split('\n').slice(0, 300).filter((l) => l.trim() !== '');
  if (lines.length < 10) return false;
  for (const delim of [',', '\t']) {
    const counts = lines.map((l) => l.split(delim).length - 1);
    const withDelims = counts.filter((c) => c >= 4);
    if (withDelims.length / lines.length < 0.8) continue;
    // modal field-count consistency (real CSVs are rectangular)
    const mode = counts.sort((a, b) => counts.filter((x) => x === b).length - counts.filter((x) => x === a).length)[0];
    const consistent = counts.filter((c) => Math.abs(c - mode) <= 1).length / counts.length;
    if (consistent >= 0.8 && mode >= 4) return true;
  }
  return false;
}

function looksJsonData(content) {
  const t = content.trimStart();
  return t.startsWith('[');
}

function scanTracked() {
  for (const f of trackedFiles()) {
    const ext = path.extname(f).toLowerCase();
    const base = path.basename(f);

    if (DATA_EXT.has(ext)) fail('data-extension', f, `extension ${ext}`);
    if (DATA_PATHS.some((p) => f === p.slice(0, -1) || f.startsWith(p))) fail('data-path', f, 'in a data directory');

    let size = 0;
    try {
      size = statSync(f).size;
    } catch {
      continue;
    }
    const textLike = TEXT_EXT.has(ext);
    if (size > SIZE_LIMIT && !ALLOW_LARGE.has(base) && textLike) {
      fail('oversized', f, `${(size / 1e6).toFixed(2)} MB text file`);
    }
    if (textLike && size > 0 && size < 5_000_000) {
      let content = '';
      try {
        content = readFileSync(f, 'utf8');
      } catch {
        continue;
      }
      if (looksDelimited(content)) fail('delimited-bulk-data', f, 'rectangular comma/tab rows');
      if (ext === '.json' && !JSON_CONFIG.test(f) && looksJsonData(content)) {
        fail('json-record-dump', f, 'top-level JSON array (looks like records)');
      }
    }
  }
}

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

function scanArtifact() {
  if (!existsSync('dist')) {
    console.log('• dist/ not present — skipping built-artifact scan (run after build to include it).');
    return;
  }
  for (const f of walk('dist')) {
    const ext = path.extname(f).toLowerCase();
    if (ARTIFACT_FORBIDDEN.has(ext)) fail('artifact', f, `forbidden ${ext} in build output`);
    if (TEXT_EXT.has(ext) && ext !== '.json') {
      try {
        const c = readFileSync(f, 'utf8');
        if (looksDelimited(c)) fail('artifact-data', f, 'delimited bulk data in build output');
      } catch {
        /* ignore */
      }
    }
  }
}

function maybeGitleaks() {
  try {
    execSync('gitleaks version', { stdio: 'ignore' });
  } catch {
    console.log('• gitleaks not installed locally — secret scan runs as a dedicated CI step.');
    return;
  }
  try {
    execSync('gitleaks detect --no-banner --redact -c .gitleaks.toml', { stdio: 'inherit' });
    console.log('✓ gitleaks: no secrets found.');
  } catch {
    fail('secret', '(history)', 'gitleaks detected potential secrets');
  }
}

console.log('🔒 Data-Leak Guard');
scanTracked();
scanArtifact();
maybeGitleaks();

if (violations.length > 0) {
  console.error(`\n❌ Data-Leak Guard FAILED with ${violations.length} violation(s):`);
  for (const v of violations) console.error(`   [${v.rule}] ${v.file} — ${v.detail}`);
  console.error('\nThe deployed site must ship CODE ONLY. Remove the offending files and purge from history if needed.');
  process.exit(1);
}
console.log('✅ Data-Leak Guard passed: no data-shaped files, no .map files, no record dumps.');
