#!/usr/bin/env node
// Build del client (vite) + controllo dei budget (TECH.md §5) + report tests/out/build.json.
// Uso: node tools/build.mjs [--out <dir>] [--quiet] [--no-enforce]. Esporta build() per i test/deploy.
// Budget (alzati l'8 ott 2026 su decisione di Jack, ROADMAP §Deviazioni): js iniziale ≤ 1200 KB (gzip ≤ 350 KB; entry + chunk precaricati da index.html) · ogni chunk caricato dopo con import() ≤ 600 KB (gzip ≤ 180),
// tutti insieme ≤ 3000 KB (gzip ≤ 900): ognuno si scarica solo quando serve (dall'8 ott 2026, ROADMAP §Deviazioni; il JS delle pagine di prova va a parte, in proveJsKB) ·
// modelli del manifest secondario `manifest_rpg.json` (caricati entrando in un dungeon) ≤ 1,5 MB · caricamento iniziale ≤ 2 MB (html + js + css + manifest + atlas + modelli del manifest) · texture ≤ 16 MB stimati (w×h×4 di ogni PNG).
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CLIENT = path.join(ROOT, 'apps/client');
export const BUDGET = { jsKB: 1200, jsGzipKB: 350, lazyChunkKB: 600, lazyChunkGzipKB: 180, lazyJsKB: 3000, lazyJsGzipKB: 900, initialMB: 3, rpgAssetsMB: 1.5, textureMB: 16 };
const REPORT = path.join(ROOT, 'tests/out/build.json');

const kb = (n) => +(n / 1024).toFixed(1);
const mb = (n) => +(n / 1048576).toFixed(2);
/** Dimensioni di un PNG dall'header IHDR (senza decodificarlo). */
function pngSize(f) {
  const b = fs.readFileSync(f);
  if (b.length < 24 || b.readUInt32BE(0) !== 0x89504e47) return null;
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}

export async function build({ outDir = path.join(CLIENT, 'dist'), quiet = false, buildId = '', enforce = true } = {}) {
  await new Promise((res, rej) => {
    const p = spawn(process.execPath, [path.join(ROOT, 'node_modules/vite/bin/vite.js'), 'build'], { cwd: CLIENT, stdio: quiet ? ['ignore', 'pipe', 'pipe'] : 'inherit', env: { ...process.env, MAREA_OUTDIR: outDir, ...(buildId ? { MAREA_BUILD: buildId } : {}) } });
    let out = ''; p.stdout?.on('data', (d) => (out += d)); p.stderr?.on('data', (d) => (out += d));
    p.on('close', (c) => (c === 0 ? res() : rej(new Error('Build fallita (vite):\n' + out.split('\n').slice(-30).join('\n')))));
  });
  const files = fs.readdirSync(outDir, { recursive: true }).map((f) => String(f).split(path.sep).join('/')).filter((f) => fs.statSync(path.join(outDir, f)).isFile());
  const size = (f) => fs.statSync(path.join(outDir, f)).size;
  const errs = [], warns = [];

  // --- JS ---
  // iniziale = gli script e i modulepreload di index.html; il resto (chunk di import() dinamici, il GDR) si scarica dopo e ha il suo budget
  const allJs = files.filter((f) => f.endsWith('.js'));
  const html = files.includes('index.html') ? fs.readFileSync(path.join(outDir, 'index.html'), 'utf8') : '';
  const linked = new Set([...html.matchAll(/(?:src|href)="\/?([^"]+\.js)"/g)].map((m) => m[1]));
  const js = allJs.filter((f) => linked.has(f) || !html);
  // pagine di prova (prova3d.html, provapixel.html…): il gioco non le scarica mai, quindi il loro JS non pesa né sull'iniziale né sul GDR
  const pageLinks = (f) => [...fs.readFileSync(path.join(outDir, f), 'utf8').matchAll(/(?:src|href)="\/?([^"]+\.js)"/g)].map((m) => m[1]);
  const proveLinked = new Set(files.filter((f) => f.endsWith('.html') && f !== 'index.html' && !f.includes('/')).flatMap(pageLinks));
  // …tranne i chunk che il gioco richiama anche lui (import() da index, es. la resa delle impostazioni condivisa con provapixel): quelli sono del gioco
  const gameText = js.map((f) => fs.readFileSync(path.join(outDir, f), 'utf8')).join('\n');
  const prove = allJs.filter((f) => !js.includes(f) && proveLinked.has(f) && !gameText.includes(path.basename(f)));
  const lazy = allJs.filter((f) => !js.includes(f) && !prove.includes(f));
  const gzOf = (f) => zlib.gzipSync(fs.readFileSync(path.join(outDir, f))).length;
  const jsBytes = js.reduce((a, f) => a + size(f), 0);
  const gz = js.reduce((a, f) => a + gzOf(f), 0);
  const lazyBytes = lazy.reduce((a, f) => a + size(f), 0), lazyGz = lazy.reduce((a, f) => a + gzOf(f), 0);
  const lazyChunks = lazy.map((f) => ({ file: f, kb: kb(size(f)), gz: kb(gzOf(f)) })).sort((a, b) => b.gz - a.gz);
  const biggest = allJs.map((f) => ({ file: f, kb: kb(size(f)) })).sort((a, b) => b.kb - a.kb).slice(0, 3);

  // --- manifest asset: atlas + modelli elencati ---
  const manifestRel = 'assets/manifest.json';
  let manifest = null; const listed = [];
  if (files.includes(manifestRel)) {
    try { manifest = JSON.parse(fs.readFileSync(path.join(outDir, manifestRel), 'utf8')); }
    catch (e) { errs.push(`assets/manifest.json non è un JSON valido (${e.message})`); }
  } else warns.push('assets/manifest.json assente nel dist');
  const resolveAsset = (name) => [`assets/${name}`, name].find((c) => files.includes(c));
  if (manifest) {
    if (manifest.atlas) listed.push({ kind: 'atlas', name: manifest.atlas });
    for (const [name, m] of Object.entries(manifest.models || {})) listed.push({ kind: 'modello', name: m && m.file ? m.file : name, model: name });
  }
  const assetFiles = [];
  for (const it of listed) {
    const rel = resolveAsset(it.name);
    if (!rel) errs.push(`il manifest elenca ${it.kind} «${it.name}» ma il file non è nel dist (404 a runtime)`);
    else assetFiles.push(rel);
  }
  const tris = Object.values((manifest && manifest.models) || {}).reduce((a, m) => a + (Number(m && m.tris) || 0), 0);

  // --- caricamento iniziale: tutto fuori da assets/ + manifest + atlas + modelli ---
  const initialSet = new Set([...files.filter((f) => !f.startsWith('assets/') && !lazy.includes(f) && !prove.includes(f)), ...(files.includes(manifestRel) ? [manifestRel] : []), ...assetFiles]);
  // manifest secondario del GDR: modelli scaricati entrando in un dungeon (non nel caricamento iniziale)
  let rpgAssetsBytes = 0;
  const rpgRel = 'assets/manifest_rpg.json';
  if (files.includes(rpgRel)) {
    try {
      const mr = JSON.parse(fs.readFileSync(path.join(outDir, rpgRel), 'utf8'));
      for (const m of Object.values(mr.models || {})) { const rel = resolveAsset(m && m.file ? m.file : ''); if (rel) rpgAssetsBytes += size(rel); else errs.push(`manifest_rpg.json elenca «${m && m.file}» ma il file non è nel dist`); }
    } catch (e) { errs.push(`assets/manifest_rpg.json non è un JSON valido (${e.message})`); }
  }
  const initialBytes = [...initialSet].reduce((a, f) => a + size(f), 0);
  const assetsBytes = files.filter((f) => f.startsWith('assets/')).reduce((a, f) => a + size(f), 0);

  // --- texture in VRAM (stima: w×h×4, senza mipmap) ---
  const pngs = files.filter((f) => f.endsWith('.png'));
  const textures = pngs.map((f) => { const s = pngSize(path.join(outDir, f)); return s ? { file: f, w: s.w, h: s.h, bytes: s.w * s.h * 4 } : null; }).filter(Boolean);
  const texBytes = textures.reduce((a, t) => a + t.bytes, 0);

  const version = JSON.parse(fs.readFileSync(path.join(outDir, 'version.json'), 'utf8'));
  const report = {
    build: version.build, jsKB: kb(jsBytes), jsGzipKB: kb(gz), lazyJsKB: kb(lazyBytes), lazyJsGzipKB: kb(lazyGz), proveJsKB: kb(prove.reduce((a, f) => a + size(f), 0)), rpgAssetsMB: mb(rpgAssetsBytes), initialMB: mb(initialBytes), textureMB: mb(texBytes),
    files: files.length, assetsMB: mb(assetsBytes), atlas: manifest?.atlas || null, models: Object.keys(manifest?.models || {}).length, modelTris: tris,
    biggestJs: biggest, lazyChunks, textures, budget: BUDGET, outDir,
  };
  if (report.jsKB > BUDGET.jsKB) errs.push(`JS ${report.jsKB} KB oltre il limite di ${BUDGET.jsKB} KB (i più grossi: ${biggest.map((b) => `${b.file} ${b.kb} KB`).join(', ')})`);
  if (report.jsGzipKB > BUDGET.jsGzipKB) errs.push(`JS gzip ${report.jsGzipKB} KB oltre il limite di ${BUDGET.jsGzipKB} KB`);
  for (const c of lazyChunks) {
    if (c.kb > BUDGET.lazyChunkKB) errs.push(`chunk caricato dopo ${c.file} ${c.kb} KB oltre il limite di ${BUDGET.lazyChunkKB} KB`);
    if (c.gz > BUDGET.lazyChunkGzipKB) errs.push(`chunk caricato dopo ${c.file} gzip ${c.gz} KB oltre il limite di ${BUDGET.lazyChunkGzipKB} KB`);
  }
  if (report.lazyJsKB > BUDGET.lazyJsKB) errs.push(`JS caricato dopo, in tutto, ${report.lazyJsKB} KB oltre il limite di ${BUDGET.lazyJsKB} KB (${lazy.join(', ')})`);
  if (report.lazyJsGzipKB > BUDGET.lazyJsGzipKB) errs.push(`JS caricato dopo, in tutto, gzip ${report.lazyJsGzipKB} KB oltre il limite di ${BUDGET.lazyJsGzipKB} KB`);
  if (report.rpgAssetsMB > BUDGET.rpgAssetsMB) errs.push(`modelli del GDR ${report.rpgAssetsMB} MB oltre il limite di ${BUDGET.rpgAssetsMB} MB`);
  if (report.initialMB > BUDGET.initialMB) errs.push(`caricamento iniziale ${report.initialMB} MB oltre il limite di ${BUDGET.initialMB} MB (JS ${report.jsKB} KB + asset del manifest ${mb(assetFiles.reduce((a, f) => a + size(f), 0))} MB)`);
  if (report.textureMB > BUDGET.textureMB) errs.push(`texture stimate ${report.textureMB} MB oltre il limite di ${BUDGET.textureMB} MB (${textures.map((t) => `${t.file} ${t.w}×${t.h}`).join(', ')})`);
  report.ok = errs.length === 0; report.errors = errs; report.warnings = warns;
  try { fs.mkdirSync(path.dirname(REPORT), { recursive: true }); fs.writeFileSync(REPORT, JSON.stringify(report, null, 1)); } catch { /* il report non è critico */ }
  if (!quiet) {
    console.log(`[build] ${report.build} · js ${report.jsKB} KB (gzip ${report.jsGzipKB}) · dopo ${report.lazyJsKB} KB (gzip ${report.lazyJsGzipKB}) · modelli GDR ${report.rpgAssetsMB} MB · iniziale ${report.initialMB} MB · texture ${report.textureMB} MB · ${report.models} modelli (${tris} tri) · ${report.files} file → ${path.relative(ROOT, outDir)}`);
    for (const w of warns) console.log(`[build] avviso: ${w}`);
    console.log(`[build] report → ${path.relative(ROOT, REPORT)}`);
  }
  if (errs.length && enforce) throw new Error('Budget superato:\n  - ' + errs.join('\n  - ') + '\n(TECH.md §5: non si alza il limite, si taglia il contenuto)');
  return report;
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const a = process.argv.slice(2); const o = a.indexOf('--out');
  build({ outDir: o >= 0 ? path.resolve(a[o + 1]) : undefined, quiet: a.includes('--quiet'), enforce: !a.includes('--no-enforce') }).catch((e) => { console.error(e.message); process.exit(1); });
}
