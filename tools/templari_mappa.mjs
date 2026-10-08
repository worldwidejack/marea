#!/usr/bin/env node
// Mappa dell'arena dei Templari (docs/TEMPLARI.md §3): celle da 1 m disegnate con forme semplici (cerchi, rettangoli, segmenti) e scritte
// come righe ASCII in packages/content/src/templari/mappa.json, che la sim legge (packages/sim/src/templari/mappa.ts).
// Uso: node tools/templari_mappa.mjs [--stampa]   (--stampa mostra la mappa nel terminale)
// Legenda: ' ' fuori dalla mappa · '#' muro · 'o' colonna · '.' pavimento della chiesa · ',' terra del sagrato · 'W' finestra sbarrata
// · '1'..'9' porte (chiuse finché non si comprano) · 'A' altare maggiore · 'p' stalli del coro · 'r' macerie del tetto · 'S' partenza
// · 'z' comparsa degli zombie (sagrato) · 'q' macerie fuori (ostacolo) · 'b' braciere (ostacolo basso che fa luce)
// · 'a' altare laterale · 'C' posto della cassa del tesoro (ostacolo basso) · armi da comprare sul muro accanto, nella cella davanti:
//   'R' arco (sull'altare laterale), 'M' mazza ferrata, 'X' ascia danese (legenda `muro`).
// La chiesa è alla templare: una rotonda (come il Santo Sepolcro, la Temple Church di Londra, la Vera Cruz di Segovia) col giro di
// colonne, e a est il presbiterio con l'abside e l'altare maggiore.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'packages/content/src/templari/mappa.json');
const W = 100, H = 84;
const g = Array.from({ length: H }, () => Array(W).fill(' '));
const set = (x, z, c) => { if (x >= 0 && z >= 0 && x < W && z < H) g[z][x] = c; };
const get = (x, z) => (x >= 0 && z >= 0 && x < W && z < H ? g[z][x] : ' ');
const each = (fn) => { for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) fn(x, z); };
const d = (x, z, cx, cz) => Math.hypot(x + 0.5 - cx, z + 0.5 - cz);

// ——— rotonda e presbiterio ———
const R = { cx: 46, cz: 42.5, r: 10 };          // rotonda: muro tra 9 e 10 m dal centro
const P = { x0: 54, x1: 68, z0: 36, z1: 48 };   // presbiterio: muri sul bordo, dentro z 37..47
const AB = { cx: 68, cz: 42.5, r: 6 };          // abside: semicerchio a est del presbiterio

// sagrato attorno: tutto ciò che sta entro 8 m dai muri esterni
const dentroChiesa = (x, z) => d(x, z, R.cx, R.cz) < R.r || (x >= P.x0 && x <= P.x1 && z >= P.z0 && z <= P.z1) || (x > P.x1 - 1 && d(x, z, AB.cx, AB.cz) < AB.r);
each((x, z) => {
  let near = false;
  for (let dz = -8; dz <= 8 && !near; dz++) for (let dx = -8; dx <= 8; dx++) if (dx * dx + dz * dz <= 64 && dentroChiesa(x + dx, z + dz)) { near = true; break; }
  if (near) set(x, z, ',');
});
// muri: ogni cella della chiesa che tocca (8 vicini) una cella fuori dalla chiesa
each((x, z) => { if (dentroChiesa(x, z)) set(x, z, '.'); });
each((x, z) => {
  if (!dentroChiesa(x, z)) return;
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) if (!dentroChiesa(x + dx, z + dz)) { set(x, z, '#'); return; }
});
// arco tra rotonda e presbiterio: il muro della rotonda si apre dove c'è il presbiterio (z 38..46)
for (let z = P.z0 + 2; z <= P.z1 - 2; z++) for (let x = 53; x <= 56; x++) if (get(x, z) === '#') set(x, z, '.');
// muro di testa del presbiterio verso l'abside: aperto (l'abside è il fondo)
for (let z = P.z0 + 1; z <= P.z1 - 1; z++) if (get(P.x1, z) === '#') set(P.x1, z, '.');

// colonne: giro di 8 nella rotonda (raggio 5,5), due pilastri all'arco del presbiterio
for (let i = 0; i < 8; i++) {
  const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
  set(Math.floor(R.cx + Math.cos(a) * 5.5), Math.floor(R.cz + Math.sin(a) * 5.5), 'o');
}
set(55, 38, 'o'); set(55, 46, 'o');

// altare maggiore nell'abside (2×3), stalli del coro lungo i fianchi del presbiterio
for (let z = 41; z <= 43; z++) for (let x = 69; x <= 70; x++) set(x, z, 'A');
for (const z of [37, 47]) for (let x = 58; x <= 65; x++) if (x !== 61 && x !== 62) set(x, z, 'p');
// bracieri: al centro della rotonda (dove nel Santo Sepolcro c'è l'edicola) e ai lati dell'arco del presbiterio
for (const [x, z] of [[46, 42], [57, 40], [57, 44]]) set(x, z, 'b');
// macerie del tetto crollato (ostacoli dentro)
for (const [x, z] of [[41, 36], [42, 36], [49, 48], [50, 48], [50, 47], [38, 45], [60, 44], [61, 44]]) if (get(x, z) === '.') set(x, z, 'r');

// ——— finestre sbarrate (gli zombie entrano da qui) ———
const sulMuro = (x, z) => get(x, z) === '#';
/** Cella di muro della rotonda all'angolo `deg` (0 = est, 90 = sud). */
function rotondaA(deg) {
  const a = (deg * Math.PI) / 180;
  for (let r = R.r - 0.3; r > R.r - 1.6; r -= 0.2) {
    const x = Math.floor(R.cx + Math.cos(a) * r), z = Math.floor(R.cz + Math.sin(a) * r);
    if (sulMuro(x, z)) return [x, z];
  }
  throw new Error(`nessun muro della rotonda a ${deg}°`);
}
const finestre = [rotondaA(90), rotondaA(270), rotondaA(140), rotondaA(220), [60, P.z0], [65, P.z0], [60, P.z1], [65, P.z1]];
// abside: finestra a est
for (let x = W - 1; x > AB.cx; x--) if (sulMuro(x, 42)) { finestre.push([x, 42]); break; }
for (const [x, z] of finestre) set(x, z, 'W');

// ——— porte (chiuse: si comprano dal passo 5) ———
// 1 = portale ovest della rotonda (verso la piazza del borgo), 2 = porta nord del presbiterio (verso il cimitero)
for (let z = 41; z <= 43; z++) { for (let x = 30; x < R.cx; x++) if (sulMuro(x, z)) { set(x, z, '1'); break; } }
for (const x of [57, 58]) set(x, P.z0, '2');

// ——— armi sul muro (disegnate col gesso), l'arco sull'altare laterale, i posti della cassa del tesoro ———
set(38, 38, 'a'); set(39, 38, 'R');   // altare laterale a sinistra del portale, con l'arco
set(61, 37, 'M');                     // mazza ferrata: muro nord del presbiterio, tra gli stalli
set(40, 36, 'X');                     // ascia danese: muro nord-ovest della rotonda, tra le macerie
set(44, 34, 'C'); set(67, 37, 'C');   // cassa: in fondo alla rotonda e accanto all'abside

// ——— partenza davanti all'altare, comparse sul sagrato fuori dalle finestre ———
set(66, 42, 'S');
const fuori = (x, z) => get(x, z) === ',';
for (const [x, z] of finestre) {
  // la cella di sagrato a 4-5 m dalla finestra, dalla parte opposta alla chiesa
  let best = null;
  for (let dz = -6; dz <= 6; dz++) for (let dx = -6; dx <= 6; dx++) {
    const nx = x + dx, nz = z + dz, dd = Math.hypot(dx, dz);
    if (dd < 3.5 || dd > 5.5 || !fuori(nx, nz)) continue;
    const away = dentroChiesa(nx, nz) ? -1 : Math.min(...[[0, 1], [1, 0], [0, -1], [-1, 0]].map(([a, b]) => (dentroChiesa(nx + a * 2, nz + b * 2) ? 0 : 1)));
    const score = away * 10 - Math.abs(dd - 4.5);
    if (!best || score > best.score) best = { x: nx, z: nz, score };
  }
  if (!best) throw new Error(`nessuna comparsa per la finestra ${x},${z}`);
  set(best.x, best.z, 'z');
}
// qualche maceria sul sagrato (ostacoli che spezzano le corse)
for (const [x, z] of [[33, 33], [34, 52], [60, 30], [72, 33], [76, 50], [52, 56]]) if (fuori(x, z)) set(x, z, 'q');

// ——— controlli: le comparse raggiungono la partenza passando dalle finestre, la partenza non esce dalla chiesa ———
const solidoZ = (c) => c === ' ' || c === '#' || c === 'o' || c === 'A' || c === 'p' || c === 'r' || c === 'q' || c === 'b' || c === 'a' || c === 'C' || /[1-9]/.test(c);
const solidoE = (c) => solidoZ(c) || c === 'W';
function bfs(sx, sz, solido) {
  const seen = new Set([sx + ',' + sz]), q = [[sx, sz]];
  while (q.length) {
    const [x, z] = q.shift();
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, nz = z + dz, k = nx + ',' + nz;
      if (seen.has(k) || solido(get(nx, nz))) continue;
      seen.add(k); q.push([nx, nz]);
    }
  }
  return seen;
}
const rows = g.map((r) => r.join(''));
let sx = 0, sz = 0;
rows.forEach((r, z) => { const x = r.indexOf('S'); if (x >= 0) { sx = x; sz = z; } });
const daEroe = bfs(sx, sz, solidoE), daZombie = bfs(sx, sz, solidoZ);
const errs = [];
rows.forEach((r, z) => [...r].forEach((c, x) => {
  if (c === 'z' && !daZombie.has(x + ',' + z)) errs.push(`comparsa ${x},${z} non arriva alla chiesa`);
  if (c === ',' && daEroe.has(x + ',' + z)) errs.push(`l'eroe esce dalla chiesa in ${x},${z}`);
}));
if (errs.length) { console.error(errs.join('\n')); process.exit(1); }

// righe senza spazi in coda (il parser tratta il fuori come spazio)
const trimmed = rows.map((r) => r.replace(/ +$/, ''));
const out = {
  tile: 1,
  legenda: {
    '1': { porta: 'portale' }, '2': { porta: 'cimitero' },
    'R': { muro: 'arco' }, 'M': { muro: 'mazza' }, 'X': { muro: 'ascia' },
  },
  rows: trimmed,
};
fs.writeFileSync(OUT, JSON.stringify(out, null, 0).replace('"rows":[', '"rows":[\n').replace(/","/g, '",\n"').replace(/"\]\}$/, '"\n]}\n'));
const nW = rows.join('').split('W').length - 1, nZ = rows.join('').split('z').length - 1;
console.log(`[templari] mappa ${W}×${H}: ${nW} finestre, ${nZ} comparse → ${path.relative(ROOT, OUT)}`);
if (process.argv.includes('--stampa')) console.log(trimmed.filter((r) => r.trim()).join('\n'));
