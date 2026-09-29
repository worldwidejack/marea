#!/usr/bin/env node
// Build del client (vite) + controllo dei budget (TECH.md §5). Uso: node tools/build.mjs [--out <dir>] [--quiet]. Esporta build() per i test.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CLIENT = path.join(ROOT, 'apps/client');
export const BUDGET = { jsKB: 900, jsGzipKB: 250, initialMB: 2 };

export async function build({ outDir = path.join(CLIENT, 'dist'), quiet = false, buildId = '' } = {}) {
  await new Promise((res, rej) => {
    const p = spawn(process.execPath, [path.join(ROOT, 'node_modules/vite/bin/vite.js'), 'build'], { cwd: CLIENT, stdio: quiet ? ['ignore', 'pipe', 'pipe'] : 'inherit', env: { ...process.env, MAREA_OUTDIR: outDir, ...(buildId ? { MAREA_BUILD: buildId } : {}) } });
    let out = ''; p.stdout?.on('data', (d) => (out += d)); p.stderr?.on('data', (d) => (out += d));
    p.on('close', (c) => (c === 0 ? res() : rej(new Error('vite build fallita\n' + out.split('\n').slice(-30).join('\n')))));
  });
  const files = fs.readdirSync(outDir, { recursive: true }).map(String).filter((f) => fs.statSync(path.join(outDir, f)).isFile());
  const size = (f) => fs.statSync(path.join(outDir, f)).size;
  const js = files.filter((f) => f.endsWith('.js'));
  const jsBytes = js.reduce((a, f) => a + size(f), 0);
  const gz = js.reduce((a, f) => a + zlib.gzipSync(fs.readFileSync(path.join(outDir, f))).length, 0);
  const initial = files.filter((f) => !f.startsWith('assets/') || f === 'assets/manifest.json').reduce((a, f) => a + size(f), 0);
  const version = JSON.parse(fs.readFileSync(path.join(outDir, 'version.json'), 'utf8'));
  const report = { build: version.build, jsKB: +(jsBytes / 1024).toFixed(1), jsGzipKB: +(gz / 1024).toFixed(1), initialMB: +(initial / 1048576).toFixed(2), files: files.length, outDir };
  const errs = [];
  if (report.jsKB > BUDGET.jsKB) errs.push(`js ${report.jsKB} KB > ${BUDGET.jsKB} KB`);
  if (report.jsGzipKB > BUDGET.jsGzipKB) errs.push(`js gzip ${report.jsGzipKB} KB > ${BUDGET.jsGzipKB} KB`);
  if (report.initialMB > BUDGET.initialMB) errs.push(`caricamento iniziale ${report.initialMB} MB > ${BUDGET.initialMB} MB`);
  if (!quiet) console.log(`[build] ${report.build} · js ${report.jsKB} KB (gzip ${report.jsGzipKB}) · iniziale ${report.initialMB} MB · ${report.files} file → ${path.relative(ROOT, outDir)}`);
  if (errs.length) throw new Error('Budget superato: ' + errs.join('; '));
  return report;
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const a = process.argv.slice(2); const o = a.indexOf('--out');
  build({ outDir: o >= 0 ? path.resolve(a[o + 1]) : undefined, quiet: a.includes('--quiet') }).catch((e) => { console.error(e.message); process.exit(1); });
}
