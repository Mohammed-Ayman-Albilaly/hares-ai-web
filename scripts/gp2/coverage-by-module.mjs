// Turns the three coverage-summary.json files into per-module tables (markdown on stdout).
// Usage: node scripts/gp2/coverage-by-module.mjs > docs/gp2-evidence/coverage/by-module.md
import { readFileSync } from 'node:fs';

const KINDS = ['statements', 'branches', 'functions', 'lines'];
const pct = (c, t) => (t === 0 ? '-' : `${((c / t) * 100).toFixed(1)}%`);

function load(pkg) {
  return JSON.parse(readFileSync(new URL(`../../docs/gp2-evidence/coverage/${pkg}/coverage-summary.json`, import.meta.url), 'utf8'));
}

/** Module of a file: first folder under src (API, contract), first two folders (web), or the file itself for a root file. */
function moduleOf(pkg, file) {
  const rel = file.replaceAll('\\', '/').split(`/${pkg}/src/`).pop();
  const parts = rel.split('/');
  if (parts.length === 1) return parts[0];
  if (pkg === 'api' && parts[0] === 'auth' && ['extension', 'password'].includes(parts[1]) && parts.length > 2) return `auth/${parts[1]}`;
  if (pkg === 'web' && ['features', 'pages', 'components'].includes(parts[0]) && parts.length > 2) return `${parts[0]}/${parts[1]}`;
  return parts[0];
}

function table(pkg, label) {
  const summary = load(pkg);
  const by = new Map();
  for (const [file, v] of Object.entries(summary)) {
    if (file === 'total') continue;
    const m = moduleOf(pkg, file);
    const acc = by.get(m) ?? Object.fromEntries(KINDS.map((k) => [k, { covered: 0, total: 0 }]));
    for (const k of KINDS) {
      acc[k].covered += v[k].covered;
      acc[k].total += v[k].total;
    }
    by.set(m, acc);
  }
  const rows = [...by.entries()]
    .map(([m, a]) => ({ m, a, lines: a.lines.total === 0 ? 1 : a.lines.covered / a.lines.total }))
    .sort((x, y) => x.lines - y.lines);
  const t = summary.total;
  const out = [`## ${label}`, '', `Total: statements ${pct(t.statements.covered, t.statements.total)} (${t.statements.covered}/${t.statements.total}), branches ${pct(t.branches.covered, t.branches.total)} (${t.branches.covered}/${t.branches.total}), functions ${pct(t.functions.covered, t.functions.total)} (${t.functions.covered}/${t.functions.total}), lines ${pct(t.lines.covered, t.lines.total)} (${t.lines.covered}/${t.lines.total}).`, '', '| Module | Statements | Branches | Functions | Lines |', '| --- | --- | --- | --- | --- |'];
  for (const { m, a } of rows) out.push(`| ${m} | ${KINDS.map((k) => pct(a[k].covered, a[k].total)).join(' | ')} |`);
  out.push('', `Least covered by lines: ${rows.slice(0, 5).map((r) => `${r.m} (${(r.lines * 100).toFixed(1)}%)`).join(', ')}.`, '');
  return out.join('\n');
}

console.log('# Coverage by module (v8, from `coverage-summary.json`)\n');
console.log(table('api', 'API (`api/src`)'));
console.log(table('web', 'Web (`web/src`)'));
console.log(table('contract', 'Contract (`contract/src`)'));
