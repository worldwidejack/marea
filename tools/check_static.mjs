#!/usr/bin/env node
// Controlli statici (TECH.md §3): purezza della sim (niente DOM/three/random/tempo/console.log, tsconfig senza lib DOM), import .ts espliciti ed esistenti,
// niente enum/namespace, `three` solo in apps/client, file > 400 righe (avviso), JSON dei contenuti validi, moduli importabili in Node.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const walk = (d) => fs.existsSync(d) ? fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? (e.name === 'node_modules' || e.name === 'dist' ? [] : walk(path.join(d, e.name))) : /\.(ts|mts)$/.test(e.name) && !e.name.endsWith('.d.ts') ? [path.join(d, e.name)] : []) : [];
const rel = (f) => path.relative(ROOT, f).split(path.sep).join('/');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');
const errs = [], warns = [];
const MAX_LINES = 400;
const files = [...walk(path.join(ROOT, 'packages')), ...walk(path.join(ROOT, 'apps'))];

for (const f of files) {
  const r = rel(f);
  const code = strip(fs.readFileSync(f, 'utf8'));
  const isSim = r.startsWith('packages/sim/src/'), isPure = isSim || r.startsWith('packages/protocol/src/') || r.startsWith('packages/content/src/');
  if (isSim) {
    if (/\bMath\.random\s*\(/.test(code)) errs.push(`${r}: Math.random (usa createRng)`);
    if (/\bDate\.now\s*\(/.test(code)) errs.push(`${r}: Date.now (il tempo lo passa il chiamante)`);
    if (/\bperformance\.now\s*\(/.test(code)) errs.push(`${r}: performance.now in sim`);
    if (/\b(setTimeout|setInterval|requestAnimationFrame)\s*\(/.test(code)) errs.push(`${r}: timer in sim`);
  }
  if (isPure) {
    if (/\b(document|window|localStorage|navigator)\s*\./.test(code)) errs.push(`${r}: DOM/window in pacchetto puro`);
    if (/from\s+['"]three/.test(code)) errs.push(`${r}: three in pacchetto puro`);
  }
  if (isSim && /\bconsole\s*\.\s*(log|debug|info)\s*\(/.test(code)) errs.push(`${r}: console.log in packages/sim (la sim non stampa; i log stanno nel client/server)`);
  if (!r.startsWith('apps/client/') && (/\b(?:from|import)\s*\(?\s*['"]three(?:\/[^'"]*)?['"]/.test(code) || /\bimport\s*\(\s*['"]three/.test(code))) errs.push(`${r}: import di three fuori da apps/client`);
  const nLines = fs.readFileSync(f, 'utf8').split('\n').length;
  if (nLines > MAX_LINES) warns.push(`${r}: ${nLines} righe (> ${MAX_LINES}: spezza il file)`);
  if (/^\s*(export\s+)?(const\s+)?enum\s+\w+/m.test(code)) errs.push(`${r}: enum (usa as const)`);
  if (/^\s*(export\s+)?namespace\s+\w+/m.test(code)) errs.push(`${r}: namespace`);
  for (const m of code.matchAll(/(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)|import\s*['"]([^'"]+)['"]/g)) {
    const spec = m[1] || m[2] || m[3];
    if (spec.startsWith('.')) {
      if (!/\.(ts|json|js)$/.test(spec)) errs.push(`${r}: import relativo senza estensione → ${spec}`);
      else if (!fs.existsSync(path.resolve(path.dirname(f), spec))) errs.push(`${r}: import inesistente → ${spec}`);
    } else if (spec.startsWith('@marea/') && spec.split('/').length > 2 && !spec.endsWith('.ts') && !spec.endsWith('.json')) errs.push(`${r}: import di sottopercorso senza .ts → ${spec}`);
  }
}
// packages/sim/tsconfig.json: niente lib DOM (la sim deve compilare senza browser)
try {
  const strip1 = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/,(\s*[}\]])/g, '$1');
  const readTs = (f) => JSON.parse(strip1(fs.readFileSync(f, 'utf8')));
  const simTs = path.join(ROOT, 'packages/sim/tsconfig.json');
  const cfg = readTs(simTs);
  let lib = cfg.compilerOptions?.lib;
  if (!lib && cfg.extends) lib = readTs(path.resolve(path.dirname(simTs), cfg.extends)).compilerOptions?.lib; // eredita dalla base
  if (Array.isArray(lib) && lib.some((l) => /^dom/i.test(String(l)))) errs.push(`packages/sim/tsconfig.json: lib DOM presente (${lib.join(', ')})`);
  if (!lib) warns.push('packages/sim/tsconfig.json: nessun `lib` esplicito (senza lib il default include DOM: metti "lib": ["ES2022"])');
  const types = cfg.compilerOptions?.types;
  if (Array.isArray(types) && types.some((t) => /^(dom|web|three|@types\/three)/i.test(String(t)))) errs.push(`packages/sim/tsconfig.json: types con DOM/three (${types.join(', ')})`);
} catch (e) { errs.push(`packages/sim/tsconfig.json: illeggibile (${e.message})`); }
// JSON dei contenuti
for (const f of fs.readdirSync(path.join(ROOT, 'packages/content/src'), { recursive: true })) {
  if (!String(f).endsWith('.json')) continue;
  try { JSON.parse(fs.readFileSync(path.join(ROOT, 'packages/content/src', String(f)), 'utf8')); } catch (e) { errs.push(`packages/content/src/${f}: JSON rotto (${e.message})`); }
}
// import in Node dei pacchetti puri + validazione contenuti
for (const f of files) {
  const r = rel(f);
  if (!/^packages\/(sim|protocol|content)\/src\//.test(r)) continue;
  try { await import(pathToFileURL(f).href); } catch (e) { errs.push(`${r}: import in Node fallisce: ${String(e && e.message).split('\n')[0]}`); }
}
try {
  const c = await import(pathToFileURL(path.join(ROOT, 'packages/content/src/index.ts')).href);
  for (const e of c.validateContent()) errs.push(`contenuti: ${e}`);
} catch (e) { errs.push(`contenuti: ${e.message}`); }
for (const w of warns) console.log('WARN', w);
for (const e of errs) console.log('FAIL', e);
console.log(`[static] ${files.length} file, ${errs.length} errori, ${warns.length} avvisi`);
process.exit(errs.length ? 1 : 0);
