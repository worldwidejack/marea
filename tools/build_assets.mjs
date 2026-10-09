#!/usr/bin/env node
// WP5 — pipeline asset in un comando: `node tools/build_assets.mjs [nomi...] [--no-preview]`
// 1. atlas procedurale (assets/blender/atlas.py → assets/atlas/atlas.png)
// 2. Blender headless (assets/blender/build_all.py + tools/export_gltf.py) → assets/export/glb/*.glb + anteprime
// 3. glTF-Transform (dedup, prune, weld, quantize; niente Draco) + ritocchi: sampler nearest, emissivi, tinte avatar,
//    atlas esterno condiviso (le glb puntano a `atlas.png` invece di incorporarlo)
// 4. apps/client/public/assets/{*.glb, atlas.png, manifest.json, manifest_rpg.json} + contact sheet assets/export/preview/contact.png
//    manifest_rpg.json (stesso formato) = modelli del GDR (dng_, nem_, arm_, fx_, prop_sacco), scaricati solo entrando in un dungeon
//    (CONTRACTS §15): il manifest principale non li elenca. Foglio per Jack: tests/out/rpg_contact.png.
//    manifest_corse.json = kit delle zone dell'Isola delle Corse (cs_), scaricato solo dal chunk delle Corse (CONTRACTS §34).
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
// CONTRACTS §15 «Modelli»
const REQUIRED_MAIN_RPG = ['prop_ingresso_grotta', 'prop_ingresso_cripta', 'prop_ingresso_vuoto',
  ...['banco', 'alchimia', 'forziere', 'serra'].flatMap((b) => [1, 2, 3].map((l) => `bld_${b}_l${l}`))];
const REQUIRED_RPG = [...['grotta', 'cripta', 'vuoto'].flatMap((st) => ['pavimento', 'muro', 'muro_basso'].map((k) => `dng_${st}_${k}`)),
  'dng_colonna', 'dng_torcia', 'dng_forziere', 'dng_forziere_aperto', 'dng_scala', 'dng_libro', 'dng_ossa', 'dng_cristallo', 'prop_sacco',
  'nem_bandito', 'nem_lupo', 'nem_ragno', 'nem_scheletro', 'nem_nonmorto', 'nem_re_ossa', 'nem_spettro', 'nem_golem', 'nem_custode',
  'arm_nunchaku', 'arm_katana', 'arm_ascia', 'arm_lancia', 'arm_spadone', 'arm_martello', 'arm_arco', 'arm_freccia', 'fx_fiammata'];
const isRpg = (n) => /^(dng_|nem_|arm_|fx_)/.test(n) || n === 'prop_sacco';
const isCorse = (n) => n.startsWith('cs_');
const CLIPS = ['idle', 'walk', 'run', 'sit', 'row'];
const DNG_MODULE = /^dng_(grotta|cripta|vuoto|drenaggio|archivio|fucina|mausoleo)_(pavimento|muro|muro_basso)$/;
const BOSS = new Set(['nem_re_ossa', 'nem_custode', 'nem_capoturno', 'nem_astrolabio', 'nem_forgiatore', 'nem_custode_egida']);
// Corse: edifici, gru, faro e arco di roccia come gli edifici; prop e manichini come i prop (le teste sotto il minimo dei prop).
const CORSE_GRANDI = /^cs_(casa_|gru_|faro|tribuna|arco_)/;
// Corse (#178, Jack 9 ott: sull'isola si può andare oltre il budget del resto): veicoli fino a 1800 triangoli, animali piloti fino a 3000.
// Hub delle Corse (#185, grafica più curata del resto): edifici grandi e quartieri ≤ 1500, porte ≤ 1200, ruota che gira ≤ 2000, il resto ≤ 400.
const HUB_GRANDI = /^cs_h_(garage|statua|torre|trofeo|tempio|rovina|ruota_base|tendone|palazzo_|corallo|igloo)/;
const HUB_BUDGET = (n) => n === 'cs_h_ruota_giro' ? [1, 2000] : HUB_GRANDI.test(n) ? [1, 1500] : /^cs_h_(porta_|sbarra)/.test(n) ? [1, 1200] : [1, 400];
const BUDGET = (n) => n.startsWith('cs_h_') ? HUB_BUDGET(n) : n === 'cs_manichino_testa' ? [1, 50] : n.startsWith('cs_v_') ? [1, 1800] : n.startsWith('cs_p_') ? [1, 3000] : CORSE_GRANDI.test(n) ? [1, 800] : isCorse(n) ? [1, 300] : n.startsWith('mod_') || DNG_MODULE.test(n) ? [1, 60] : n.startsWith('bld_') ? [300, 800] : n.startsWith('prop_') || n.startsWith('dng_') ? [50, 200]
  : n.startsWith('boat_') ? [1, 600] : n.startsWith('chr_') ? [1, 1500] : BOSS.has(n) ? [1, 1200] : n.startsWith('nem_') ? [1, 600]
  : n.startsWith('arm_') ? [1, 80] : n.startsWith('fx_') ? [1, 40] : [1, 800];
// Tinte di default dell'avatar: le zone pelle/capelli/vestito dell'atlas sono maschere bianche, il colore è il fattore del materiale.
const TINT = { mat_pelle: '#D9A070', mat_capelli: '#2E1E14', mat_vestito: '#3FB9C9', mat_cappello: '#E2B97F' };
// Armi: le facce della lama/testa sono `mat_lama` (maschera bianca): il client le tinge col colore del materiale; di default ferro.
const TINT_LAMA = { mat_lama: '#B9AFA3' };

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
const rpgPath = path.join(PUB, 'manifest_rpg.json');
const corsePath = path.join(PUB, 'manifest_corse.json');
const readMan = (p) => (fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : { models: {} });
const old = readMan(manPath); const oldRpg = readMan(rpgPath); const oldCorse = readMan(corsePath);
// tutti i modelli in un dizionario solo; la separazione nei due manifest avviene alla scrittura (isRpg)
const models = only.length ? { ...(old.models || {}), ...(oldRpg.models || {}), ...(oldCorse.models || {}) } : {};
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
    if (TINT_LAMA[m.getName()]) m.setBaseColorFactor([...hexLin(TINT_LAMA[m.getName()]), 1]);
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
  await doc.transform(quantize({ quantizePosition: 14, quantizeTexcoord: 16, quantizeNormal: 8 }));
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
  if (extra.footprint) entry.footprint = extra.footprint; // impronta a terra in metri [x, z] (edifici M1, Porto, facciate)
  if (root.listMaterials().some((m) => m.getName() === 'mat_lama')) entry.tint = TINT_LAMA;
  if (name.startsWith('chr_')) {
    entry.tint = TINT; entry.materials = root.listMaterials().map((m) => m.getName());
    if (extra.durate) entry.durations = extra.durate;
    entry.parts = root.listNodes().map((n) => n.getName()).filter((n) => /^(capelli|cappello)_/.test(n));
    for (let i = 0; i < 8; i++) if (!entry.parts.includes(`capelli_${i}`)) errors.push(`${name}: manca il nodo capelli_${i}`);
  }
  models[name] = entry;
}
for (const n of [...REQUIRED, ...REQUIRED_MAIN_RPG, ...REQUIRED_RPG]) if (!models[n]) errors.push(`manca il modello obbligatorio ${n}`);
for (const n of REQUIRED_RPG) if (models[n] && n.startsWith('arm_') && !(models[n].tint && models[n].tint.mat_lama)) errors.push(`${n}: nessuna faccia con il materiale mat_lama`);
// glb pubblicate che non esistono più
if (!only.length) for (const f of fs.readdirSync(PUB)) if (f.endsWith('.glb') && !models[f.replace('.glb', '')]) fs.rmSync(path.join(PUB, f));

fs.copyFileSync(ATLAS, path.join(PUB, 'atlas.png'));
const sorted = Object.fromEntries(Object.keys(models).sort().map((k) => [k, models[k]]));
const mainModels = Object.fromEntries(Object.entries(sorted).filter(([k]) => !isRpg(k) && !isCorse(k)));
const corseModels = Object.fromEntries(Object.entries(sorted).filter(([k]) => isCorse(k)));
const rpgModels = Object.fromEntries(Object.entries(sorted).filter(([k]) => isRpg(k)));
const version = new Date().toISOString().slice(0, 10) + '-' + Object.keys(mainModels).length;
fs.writeFileSync(manPath, JSON.stringify({ version, atlas: 'atlas.png', texelsPerMeter: 16, models: mainModels }, null, 1) + '\n');
const versionRpg = new Date().toISOString().slice(0, 10) + '-' + Object.keys(rpgModels).length;
fs.writeFileSync(rpgPath, JSON.stringify({ version: versionRpg, atlas: 'atlas.png', texelsPerMeter: 16, models: rpgModels }, null, 1) + '\n');
const versionCorse = new Date().toISOString().slice(0, 10) + '-' + Object.keys(corseModels).length;
fs.writeFileSync(corsePath, JSON.stringify({ version: versionCorse, atlas: 'atlas.png', texelsPerMeter: 16, models: corseModels }, null, 1) + '\n');

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
  const shots = fs.readdirSync(PREV).filter((f) => f.endsWith('.png') && !['contact.png', 'chr_varianti.png', 'chr_catalogo.png', 'm1_contact.png'].includes(f)).sort();
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

// ---- 5. foglio M1: livelli affiancati (L1 L2 L3) per ogni edificio + cantiere, molo, Porto, facciate
if (!noPreview) {
  const L = (id, n) => [1, 2, 3].map((l) => (l <= n ? `bld_${id}_l${l}` : null));
  const GRID = [
    [...L('segheria', 3), ...L('cava', 3)],
    [...L('magazzino', 3), ...L('casa', 3)],
    [...L('tavolo', 3), ...L('faro', 2)],
    ['bld_cantiere', 'prop_deposito', 'mod_molo', 'prop_molo_l2', 'prop_molo_l3', 'prop_filo_lanterne'],
    ['bld_porto_casa_a', 'bld_porto_casa_b', 'bld_porto_casa_c', 'bld_porto_tavolo', 'prop_boa', 'prop_boa_next'],
    ['fac_neon', 'fac_selvaggia', 'prop_torii', 'prop_lanterna', null, null],
  ];
  const blankDir = path.join(PREV, '_m1'); fs.mkdirSync(blankDir, { recursive: true });
  const blank = path.join(blankDir, 'vuoto.png');
  spawnSync(FFMPEG, ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', 'color=c=0x2E1E14:s=384x384', '-frames:v', '1', '-pix_fmt', 'rgba', blank]);
  const cells = GRID.flat().map((n) => (n && fs.existsSync(path.join(PREV, `${n}.png`)) ? n : null));
  const list = path.join(blankDir, 'lista.txt');
  fs.writeFileSync(list, cells.map((n) => `file '${n ? path.join(PREV, `${n}.png`) : blank}'\nduration 1`).join('\n') + '\n');
  const cols = 6, step = 390;
  const labels = cells.map((n, i) => (n ? `drawtext=text='${n}':x=${(i % cols) * step + 8}:y=${Math.floor(i / cols) * step + 8}:fontsize=16:fontcolor=0xF4E3C1:box=1:boxcolor=0x2E1E14@0.8` : null)).filter(Boolean);
  const out = path.join(PREV, 'm1_contact.png');
  const r = spawnSync(FFMPEG, ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-vf', `scale=384:384,tile=${cols}x${GRID.length}:padding=6:color=0x2E1E14,${labels.join(',')}`, '-frames:v', '1', out], { encoding: 'utf8' });
  if (r.status === 0) console.log(`[assets] foglio M1: ${path.relative(ROOT, out)} (${cells.filter(Boolean).length} riquadri)`);
  else console.warn('[assets] foglio M1 non riuscito:', r.stderr);
  fs.rmSync(list, { force: true });
}

// ---- 6. foglio GDR per Jack (tests/out/rpg_contact.png): ingressi, edifici L1-L3, kit dei dungeon, nemici, armi
if (!noPreview) {
  const L = (id) => [1, 2, 3].map((l) => `bld_${id}_l${l}`);
  const GRID = [
    ['prop_ingresso_grotta', 'prop_ingresso_cripta', 'prop_ingresso_vuoto', ...L('banco')],
    [...L('alchimia'), ...L('forziere')],
    [...L('serra'), 'dng_colonna', 'dng_torcia', 'dng_scala'],
    ['dng_grotta_pavimento', 'dng_grotta_muro', 'dng_grotta_muro_basso', 'dng_cripta_pavimento', 'dng_cripta_muro', 'dng_cripta_muro_basso'],
    ['dng_vuoto_pavimento', 'dng_vuoto_muro', 'dng_vuoto_muro_basso', 'dng_forziere', 'dng_forziere_aperto', 'dng_libro'],
    ['dng_ossa', 'dng_cristallo', 'prop_sacco', 'fx_fiammata', 'nem_bandito', 'nem_lupo'],
    ['nem_ragno', 'nem_scheletro', 'nem_nonmorto', 'nem_re_ossa', 'nem_spettro', 'nem_golem'],
    ['nem_custode', 'arm_nunchaku', 'arm_katana', 'arm_ascia', 'arm_lancia', 'arm_spadone'],
    ['arm_martello', 'arm_arco', 'arm_freccia', null, null, null],
  ];
  const blankDir = path.join(PREV, '_m1'); fs.mkdirSync(blankDir, { recursive: true });
  const blank = path.join(blankDir, 'vuoto.png');
  if (!fs.existsSync(blank)) spawnSync(FFMPEG, ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', 'color=c=0x2E1E14:s=384x384', '-frames:v', '1', '-pix_fmt', 'rgba', blank]);
  const cells = GRID.flat().map((n) => (n && fs.existsSync(path.join(PREV, `${n}.png`)) ? n : null));
  const list = path.join(blankDir, 'lista_rpg.txt');
  fs.writeFileSync(list, cells.map((n) => `file '${n ? path.join(PREV, `${n}.png`) : blank}'\nduration 1`).join('\n') + '\n');
  const cols = 6, step = 390;
  const labels = cells.map((n, i) => (n ? `drawtext=text='${n} ${models[n] ? models[n].tris + ' tri' : ''}':x=${(i % cols) * step + 8}:y=${Math.floor(i / cols) * step + 8}:fontsize=16:fontcolor=0xF4E3C1:box=1:boxcolor=0x2E1E14@0.8` : null)).filter(Boolean);
  const outDir = path.join(ROOT, 'tests/out'); fs.mkdirSync(outDir, { recursive: true });
  const out = path.join(outDir, 'rpg_contact.png');
  const r = spawnSync(FFMPEG, ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-vf', `scale=384:384,tile=${cols}x${GRID.length}:padding=6:color=0x2E1E14,${labels.join(',')}`, '-frames:v', '1', out], { encoding: 'utf8' });
  if (r.status === 0) console.log(`[assets] foglio GDR: ${path.relative(ROOT, out)} (${cells.filter(Boolean).length} riquadri)`);
  else console.warn('[assets] foglio GDR non riuscito:', r.stderr);
  fs.rmSync(list, { force: true });
}

// ---- riepilogo
console.log('\n  modello               tri    KB  clip');
for (const [n, e] of Object.entries(sorted)) console.log(`  ${n.padEnd(20)} ${String(e.tris).padStart(5)} ${String(e.kb).padStart(5)}  ${(e.clips || []).join(' ')}`);
if (errors.length) die('\n  ' + errors.join('\n  '));
const kbSum = (o) => Math.round(Object.values(o).reduce((a, e) => a + e.kb, 0));
console.log(`\n[assets] ok: ${Object.keys(mainModels).length} modelli in ${path.relative(ROOT, manPath)} (${kbSum(mainModels)} KB) · ${Object.keys(rpgModels).length} in ${path.relative(ROOT, rpgPath)} (${kbSum(rpgModels)} KB)`);
