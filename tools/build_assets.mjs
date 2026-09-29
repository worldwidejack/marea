#!/usr/bin/env node
// WP5 — pipeline asset in un comando: `node tools/build_assets.mjs [nomi...] [--no-preview]`
// 1. atlas procedurale (assets/blender/atlas.py → assets/atlas/atlas.png)
// 2. Blender headless (assets/blender/build_all.py + tools/export_gltf.py) → assets/export/glb/*.glb + anteprime
// 3. glTF-Transform (dedup, prune, weld, quantize; niente Draco) + ritocchi: sampler nearest, emissivi, tinte avatar,
//    atlas esterno condiviso (le glb puntano a `atlas.png` invece di incorporarlo)
// 4. apps/client/public/assets/{*.glb, atlas.png, manifest.json} + contact sheet assets/export/preview/contact.png
// Fallisce se un modello supera il budget (ART_BIBLE §4) o manca un nome obbligatorio (CONTRACTS §9).
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { KHRMeshQuantization, KHRMaterialsEmissiveStrength } from '@gltf-transform/extensions';
import { dedup, prune, weld, quantize } from '@gltf-transform/functions';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BLENDER = process.env.BLENDER || '/Applications/Blender.app/Contents/MacOS/Blender';
const FFMPEG = fs.existsSync('/opt/homebrew/bin/ffmpeg') ? '/opt/homebrew/bin/ffmpeg' : 'ffmpeg';
const SRC = path.join(ROOT, 'assets/blender');
const ATLAS = path.join(ROOT, 'assets/atlas/atlas.png');
const RAW = path.join(ROOT, 'assets/export/glb');
const PREV = path.join(ROOT, 'assets/export/preview');
const PUB = path.join(ROOT, 'apps/client/public/assets');
const argv = process.argv.slice(2);
const only = argv.filter((a) => !a.startsWith('--'));
const noPreview = argv.includes('--no-preview');

const REQUIRED = ['mod_sabbia', 'mod_sabbia_bordo', 'mod_erba', 'mod_scogliera', 'mod_molo', 'bld_segheria_l1', 'bld_cava_l1', 'bld_casa_l1',
  'boat_barca', 'prop_lanterna', 'prop_torii', 'prop_palma', 'prop_cassa', 'prop_insegna_neon', 'prop_barile', 'chr_base'];
const CLIPS = ['idle', 'walk', 'run', 'sit', 'row'];
const BUDGET = (n) => n.startsWith('mod_') ? [1, 60] : n.startsWith('bld_') ? [300, 800] : n.startsWith('prop_') ? [50, 200] : n.startsWith('boat_') ? [1, 600] : n.startsWith('chr_') ? [1, 1500] : [1, 800];
// Tinte di default dell'avatar: le zone pelle/capelli/vestito dell'atlas sono maschere bianche, il colore è il fattore del materiale.
const TINT = { mat_pelle: '#D9A070', mat_capelli: '#2E1E14', mat_vestito: '#3FB9C9', mat_cappello: '#E2B97F' };

const die = (msg) => { console.error(`[assets] ERRORE: ${msg}`); process.exit(1); };
const run = (cmd, args, label) => {
  const t = Date.now();
  const r = spawnSync(cmd, args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 << 20 });
  if (r.status !== 0) die(`${label} fallito (${r.status})\n${(r.stdout || '').split('\n').slice(-25).join('\n')}\n${r.stderr || ''}`);
  console.log(`[assets] ${label} ok (${((Date.now() - t) / 1000).toFixed(1)} s)`);
  return r.stdout;
};
const srgbToLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const hexLin = (h) => [1, 3, 5].map((i) => srgbToLinear(parseInt(h.slice(i, i + 2), 16) / 255));

// ---- 1. atlas
if (!fs.existsSync(BLENDER)) die(`Blender non trovato in ${BLENDER} (variabile BLENDER per cambiarlo)`);
fs.mkdirSync(path.dirname(ATLAS), { recursive: true });
const py = spawnSync('python3', ['-c', 'print(1)'], { encoding: 'utf8' }).status === 0;
if (py) run('python3', [path.join(SRC, 'atlas.py'), ATLAS], 'atlas');
else run(BLENDER, ['-b', '--python-expr', `import sys; sys.path.insert(0, ${JSON.stringify(SRC)}); import atlas; atlas.build(${JSON.stringify(ATLAS)})`], 'atlas (python di Blender)');

// ---- 2. Blender
fs.mkdirSync(RAW, { recursive: true }); fs.mkdirSync(PREV, { recursive: true });
if (!only.length) for (const f of fs.readdirSync(RAW)) fs.rmSync(path.join(RAW, f));
run(BLENDER, ['-b', '--factory-startup', '-P', path.join(SRC, 'build_all.py'), '--', ATLAS, RAW, PREV, ...only, ...(noPreview ? ['--no-preview'] : [])], 'Blender (modelli + anteprime)');
const report = JSON.parse(fs.readFileSync(path.join(RAW, '_report.json'), 'utf8'));

// ---- 3. glTF-Transform + ritocchi
const io = new NodeIO().registerExtensions([KHRMeshQuantization, KHRMaterialsEmissiveStrength]);
fs.mkdirSync(PUB, { recursive: true });
const manPath = path.join(PUB, 'manifest.json');
const old = fs.existsSync(manPath) ? JSON.parse(fs.readFileSync(manPath, 'utf8')) : { models: {} };
const models = only.length ? { ...(old.models || {}) } : {};
const errors = [];

/** Toglie l'atlas incorporato dal GLB: l'immagine diventa `uri: atlas.png` (una sola texture condivisa, file piccoli). */
function externalizeAtlas(buf) {
  const jsonLen = buf.readUInt32LE(12);
  const json = JSON.parse(buf.subarray(20, 20 + jsonLen).toString('utf8').trim());
  const binStart = 20 + jsonLen;
  const bin = binStart < buf.length ? buf.subarray(binStart + 8, binStart + 8 + buf.readUInt32LE(binStart)) : Buffer.alloc(0);
  const drop = new Set();
  for (const img of json.images || []) { if (img.bufferView !== undefined) drop.add(img.bufferView); delete img.bufferView; img.uri = 'atlas.png'; img.mimeType = 'image/png'; img.name = 'atlas'; }
  const remap = new Map(); const views = []; const parts = []; let off = 0;
  (json.bufferViews || []).forEach((v, i) => {
    if (drop.has(i)) return;
    const pad = (4 - (off % 4)) % 4; if (pad) { parts.push(Buffer.alloc(pad)); off += pad; }
    parts.push(bin.subarray(v.byteOffset || 0, (v.byteOffset || 0) + v.byteLength));
    remap.set(i, views.length); views.push({ ...v, byteOffset: off }); off += v.byteLength;
  });
  json.bufferViews = views;
  for (const a of json.accessors || []) if (a.bufferView !== undefined) a.bufferView = remap.get(a.bufferView);
  for (const s of json.accessors || []) if (s.sparse) { s.sparse.indices.bufferView = remap.get(s.sparse.indices.bufferView); s.sparse.values.bufferView = remap.get(s.sparse.values.bufferView); }
  const newBin = Buffer.concat(parts);
  const binPad = Buffer.concat([newBin, Buffer.alloc((4 - (newBin.length % 4)) % 4)]);
  json.buffers = binPad.length ? [{ byteLength: binPad.length }] : [];
  let js = Buffer.from(JSON.stringify(json), 'utf8');
  js = Buffer.concat([js, Buffer.alloc((4 - (js.length % 4)) % 4, 0x20)]);
  const chunks = [Buffer.from(new Uint32Array([js.length, 0x4e4f534a]).buffer), js];
  if (binPad.length) chunks.push(Buffer.from(new Uint32Array([binPad.length, 0x004e4942]).buffer), binPad);
  const body = Buffer.concat(chunks);
  return Buffer.concat([Buffer.from(new Uint32Array([0x46546c67, 2, 12 + body.length]).buffer), body]);
}

for (const file of fs.readdirSync(RAW).filter((f) => f.endsWith('.glb')).sort()) {
  const name = file.replace('.glb', '');
  if (only.length && !only.includes(name)) continue;
  const doc = await io.read(path.join(RAW, file));
  // keepUniqueNames: i materiali dell'avatar (mat_pelle, mat_capelli, mat_vestito, mat_cappello) sono identici finché il
  // client non li tinge: senza, dedup li fonde in uno solo e le tinte si perdono.
  await doc.transform(dedup({ keepUniqueNames: true }), prune(), weld());
  const root = doc.getRoot();
  for (const s of root.listTextures()) s.setName('atlas');
  for (const m of root.listMaterials()) {
    m.setDoubleSided(false).setRoughnessFactor(1).setMetallicFactor(0);
    const info = m.getBaseColorTextureInfo();
    if (info) info.setMagFilter(9728).setMinFilter(9728).setWrapS(33071).setWrapT(33071); // NEAREST, CLAMP
    if (m.getName().startsWith('mat_emissivo')) { m.setEmissiveTexture(m.getBaseColorTexture()); m.setEmissiveFactor([1, 1, 1]); const ei = m.getEmissiveTextureInfo(); if (ei) ei.setMagFilter(9728).setMinFilter(9728); }
    else m.setEmissiveFactor([0, 0, 0]).setEmissiveTexture(null);
    if (TINT[m.getName()]) m.setBaseColorFactor([...hexLin(TINT[m.getName()]), 1]);
  }
  // numeri
  let tris = 0; const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (const node of root.listNodes()) {
    const mesh = node.getMesh(); if (!mesh) continue;
    const wm = node.getWorldMatrix();
    for (const prim of mesh.listPrimitives()) {
      const idx = prim.getIndices(); const pos = prim.getAttribute('POSITION');
      tris += (idx ? idx.getCount() : pos.getCount()) / 3;
      const el = [0, 0, 0];
      for (let i = 0; i < pos.getCount(); i++) {
        pos.getElement(i, el);
        const p = [0, 1, 2].map((r) => wm[r] * el[0] + wm[4 + r] * el[1] + wm[8 + r] * el[2] + wm[12 + r]);
        for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], p[k]); max[k] = Math.max(max[k], p[k]); }
      }
    }
  }
  // quantize dopo le misure: sulle mesh skinnate sposta la scala nelle inverseBindMatrices e i bounds diventerebbero [-1, 1]
  await doc.transform(quantize({ quantizePosition: 14, quantizeTexcoord: 16, quantizeNormal: 10 }));
  const clips = root.listAnimations().map((a) => a.getName());
  const [lo, hi] = BUDGET(name);
  if (tris > hi || tris < lo) errors.push(`${name}: ${tris} tri fuori budget [${lo}, ${hi}]`);
  if (name.startsWith('chr_')) for (const c of CLIPS) if (!clips.includes(c)) errors.push(`${name}: manca la clip «${c}»`);
  const glb = externalizeAtlas(Buffer.from(await io.writeBinary(doc)));
  fs.writeFileSync(path.join(PUB, file), glb);
  const r2 = (v) => Math.round(v * 100) / 100;
  const entry = { file, tris, kb: Math.round(glb.length / 102.4) / 10, bounds: { min: min.map(r2), max: max.map(r2) } };
  if (clips.length) entry.clips = clips;
  const extra = report[name] || {};
  if (extra.anchors) entry.anchors = extra.anchors;
  if (name.startsWith('chr_')) {
    entry.tint = TINT; entry.materials = root.listMaterials().map((m) => m.getName());
    if (extra.durate) entry.durations = extra.durate;
    entry.parts = root.listNodes().map((n) => n.getName()).filter((n) => /^(capelli|cappello)_/.test(n));
    for (let i = 0; i < 8; i++) if (!entry.parts.includes(`capelli_${i}`)) errors.push(`${name}: manca il nodo capelli_${i}`);
  }
  models[name] = entry;
}
for (const n of REQUIRED) if (!models[n]) errors.push(`manca il modello obbligatorio ${n}`);
// glb pubblicate che non esistono più
if (!only.length) for (const f of fs.readdirSync(PUB)) if (f.endsWith('.glb') && !models[f.replace('.glb', '')]) fs.rmSync(path.join(PUB, f));

fs.copyFileSync(ATLAS, path.join(PUB, 'atlas.png'));
const sorted = Object.fromEntries(Object.keys(models).sort().map((k) => [k, models[k]]));
const version = new Date().toISOString().slice(0, 10) + '-' + Object.keys(sorted).length;
fs.writeFileSync(manPath, JSON.stringify({ version, atlas: 'atlas.png', texelsPerMeter: 16, models: sorted }, null, 1) + '\n');

// ---- 4. contact sheet delle anteprime
if (!noPreview) {
  // fogli per l'approvazione: varianti di look (figura + viso) e catalogo dei pezzi, da PNG singoli in preview/_varianti, _catalogo
  const SHEETS = { _varianti: ['chr_varianti.png', ['corpo', 'viso']], _catalogo: ['chr_catalogo.png', ['viso']] };
  for (const [sub, [outName, tags]] of Object.entries(SHEETS)) {
    const dir = path.join(PREV, sub); const meta = path.join(dir, 'chr_base.json');
    if (!fs.existsSync(meta) || (only.length && !only.includes('chr_base'))) continue;
    const names = JSON.parse(fs.readFileSync(meta, 'utf8'));
    const inputs = []; const cols = [];
    names.forEach((nm, i) => {
      const k = String(i).padStart(2, '0');
      const ins = tags.map((t) => { inputs.push('-i', path.join(dir, `chr_base_${k}_${t}.png`)); return inputs.length / 2 - 1; });
      const lab = `drawtext=text='${nm}':x=10:y=10:fontsize=${sub === '_varianti' ? 32 : 18}:fontcolor=0xF4E3C1:box=1:boxcolor=0x2E1E14@0.85:boxborderw=6`;
      cols.push(ins.length > 1 ? `${ins.map((n) => `[${n}:v]`).join('')}vstack=${ins.length},${lab}[c${i}]` : `[${ins[0]}:v]${lab}[c${i}]`);
    });
    const perRow = sub === '_varianti' ? names.length : 8;
    const rows = []; for (let r = 0; r * perRow < names.length; r++) rows.push(names.slice(r * perRow, (r + 1) * perRow).map((_, j) => r * perRow + j));
    let fc = cols.join(';');
    rows.forEach((row, r) => {
      const pad = row.length < perRow ? `,pad=iw*${perRow}/${row.length}:ih:0:0:color=0x2E1E14` : '';
      fc += `;${row.map((i) => `[c${i}]`).join('')}${row.length > 1 ? `hstack=${row.length}` : 'null'}${pad}[r${r}]`;
    });
    fc += rows.length > 1 ? `;${rows.map((_, r) => `[r${r}]`).join('')}vstack=${rows.length}[out]` : `;[r0]null[out]`;
    const rs = spawnSync(FFMPEG, ['-y', '-loglevel', 'error', ...inputs, '-filter_complex', fc, '-map', '[out]', '-frames:v', '1', path.join(PREV, outName)], { encoding: 'utf8' });
    if (rs.status === 0) console.log(`[assets] ${path.relative(ROOT, path.join(PREV, outName))} (${names.length} riquadri)`);
    else console.warn(`[assets] ${outName} non riuscito:`, rs.stderr);
  }
  const shots = fs.readdirSync(PREV).filter((f) => f.endsWith('.png') && !['contact.png', 'chr_varianti.png', 'chr_catalogo.png'].includes(f)).sort();
  if (shots.length) {
    const cols = 6, rows = Math.ceil(shots.length / cols);
    const list = path.join(PREV, 'contact.txt');
    fs.writeFileSync(list, shots.map((f) => `file '${path.join(PREV, f)}'\nduration 1`).join('\n') + '\n');
    const labels = shots.map((f, i) => `drawtext=text='${f.replace('.png', '')}':x=${(i % cols) * 390 + 8}:y=${Math.floor(i / cols) * 390 + 8}:fontsize=16:fontcolor=0xF4E3C1:box=1:boxcolor=0x2E1E14@0.8`);
    const r = spawnSync(FFMPEG, ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-vf', `scale=384:384,tile=${cols}x${rows}:padding=6:color=0x2E1E14`, '-frames:v', '1', path.join(PREV, 'contact_raw.png')], { encoding: 'utf8' });
    if (r.status === 0) {
      const r2 = spawnSync(FFMPEG, ['-y', '-loglevel', 'error', '-i', path.join(PREV, 'contact_raw.png'), '-vf', labels.join(','), path.join(PREV, 'contact.png')], { encoding: 'utf8' });
      if (r2.status !== 0) fs.renameSync(path.join(PREV, 'contact_raw.png'), path.join(PREV, 'contact.png'));
      else fs.rmSync(path.join(PREV, 'contact_raw.png'));
      console.log(`[assets] contact sheet: ${path.relative(ROOT, path.join(PREV, 'contact.png'))} (${shots.length} anteprime)`);
    } else console.warn('[assets] contact sheet non riuscito:', r.stderr);
    fs.rmSync(list, { force: true });
  }
}

// ---- riepilogo
console.log('\n  modello               tri    KB  clip');
for (const [n, e] of Object.entries(sorted)) console.log(`  ${n.padEnd(20)} ${String(e.tris).padStart(5)} ${String(e.kb).padStart(5)}  ${(e.clips || []).join(' ')}`);
if (errors.length) die('\n  ' + errors.join('\n  '));
console.log(`\n[assets] ok: ${Object.keys(sorted).length} modelli, manifest ${path.relative(ROOT, manPath)}`);
