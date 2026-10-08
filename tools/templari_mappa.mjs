#!/usr/bin/env node
// Mappa dell'arena dei Templari (docs/TEMPLARI.md §3): celle da 1 m disegnate con forme semplici (cerchi, rettangoli, segmenti) e scritte
// come righe ASCII in packages/content/src/templari/mappa.json, che la sim legge (packages/sim/src/templari/mappa.ts).
// Uso: node tools/templari_mappa.mjs [--stampa]   (--stampa mostra la mappa nel terminale)
// Legenda — chiesa: '#' muro · 'o' colonna · '.' pavimento · 'W' finestra sbarrata · 'A' altare maggiore · 'a' altare laterale · 'p' stalli
//   del coro · 'r' macerie del tetto · 'b' braciere · 'S' partenza · 'C' posto della cassa del tesoro.
// Fuori: ',' terra del sagrato · 'v' acciottolato della piazza · 'e' erba del cimitero · 's' sabbia della spiaggia · 'w' assito della taverna
//   · 'h' casa diroccata (muro) · 't' tenda dei pirati (muro) · 'm' muretto (basso, ferma tutti) · 'g' tomba · 'k' pozzo, carretti, botti,
//   cannoni · 'q' macerie · ' ' fuori dalla mappa.
// Porte (legenda `porta`: si comprano, aprono una zona): '1' portale → piazza · '2' porta nord → cimitero · '3' taverna · '4' dalla taverna
//   all'accampamento · '5' dal cimitero all'accampamento.
// Comparse degli zombie: 'z' sagrato (sempre attive) · 'y' piazza · 'u' cimitero · 'x' taverna · 'j' spiaggia (legenda `comparsa`: attive
//   quando la loro zona è aperta). Armi sul muro (legenda `muro`), nella cella davanti: 'R' arco · 'M' mazza · 'X' ascia · 'G' pistola ·
//   'K' moschetto · 'E' trombone. Trappole (legenda `trappola`): 'J' zona del rogo e 'Q' la sua leva · 'T' zona della campana e 'L' la leva.
// La chiesa è alla templare: una rotonda (come il Santo Sepolcro, la Temple Church di Londra, la Vera Cruz di Segovia) col giro di
// colonne, e a est il presbiterio con l'abside e l'altare maggiore. Attorno il sagrato diviso da muretti in tre parti: ovest verso la
// piazza del borgo, nord verso il cimitero, sud-est verso la spiaggia e l'accampamento dei pirati.
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
const rect = (x0, z0, x1, z1, c, solo) => { for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) if (!solo || solo(get(x, z))) set(x, z, c); };
const d = (x, z, cx, cz) => Math.hypot(x + 0.5 - cx, z + 0.5 - cz);

// ——— zone di fuori (prima, così chiesa e sagrato ci si disegnano sopra) ———
rect(4, 25, 34, 59, 'v');    // piazza del borgo
rect(36, 3, 88, 25, 'e');    // cimitero
rect(10, 74, 94, 82, 's'); rect(28, 60, 94, 73, 's'); // spiaggia e accampamento
// case diroccate della piazza, il pozzo e i carretti
for (const [x0, z0, x1, z1] of [[6, 27, 12, 33], [16, 26, 22, 30], [5, 39, 10, 46], [6, 50, 13, 56], [20, 51, 26, 56], [27, 27, 32, 31]]) rect(x0, z0, x1, z1, 'h');
rect(18, 40, 19, 41, 'k'); set(26, 37, 'k'); set(27, 37, 'k'); set(14, 36, 'q'); set(30, 47, 'q');
// taverna del Teschio: muri, assito, bancone, botti; due porte (dalla piazza a nord, verso la spiaggia a sud)
rect(6, 60, 24, 73, '#'); rect(7, 61, 23, 72, 'w');
rect(9, 64, 15, 64, 'p'); set(20, 62, 'k'); set(21, 62, 'k'); set(22, 65, 'k'); set(8, 71, 'k');
for (const x of [14, 15]) set(x, 60, '3');
for (const x of [16, 17]) set(x, 73, '4');
// cimitero: tombe in file, l'ossario in fondo
for (let z = 7; z <= 21; z += 4) for (let x = 41; x <= 84; x += 3) if (!(x > 68 && z < 12)) { set(x, z, 'g'); set(x, z + 1, 'g'); }
rect(70, 5, 79, 10, 'h');
// accampamento: tende, falò, cannoni puntati al mare, botti
for (const [x0, z0] of [[38, 67], [51, 70], [66, 66], [80, 68]]) rect(x0, z0, x0 + 3, z0 + 3, 't');
set(60, 65, 'b'); set(46, 79, 'k'); set(47, 79, 'k'); set(72, 79, 'k'); set(73, 79, 'k'); set(87, 64, 'k'); set(33, 76, 'q');

// ——— rotonda e presbiterio ———
const R = { cx: 46, cz: 42.5, r: 10 };          // rotonda: muro tra 9 e 10 m dal centro
const P = { x0: 54, x1: 68, z0: 36, z1: 48 };   // presbiterio: muri sul bordo, dentro z 37..47
const AB = { cx: 68, cz: 42.5, r: 6 };          // abside: semicerchio a est del presbiterio
const dentroChiesa = (x, z) => d(x, z, R.cx, R.cz) < R.r || (x >= P.x0 && x <= P.x1 && z >= P.z0 && z <= P.z1) || (x > P.x1 - 1 && d(x, z, AB.cx, AB.cz) < AB.r);
// sagrato attorno: tutto ciò che sta entro 8 m dai muri esterni
each((x, z) => {
  let near = false;
  for (let dz = -8; dz <= 8 && !near; dz++) for (let dx = -8; dx <= 8; dx++) if (dx * dx + dz * dz <= 64 && dentroChiesa(x + dx, z + dz)) { near = true; break; }
  if (near && 'vse '.includes(get(x, z))) set(x, z, ',');
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

// ——— muretti che dividono il sagrato: ovest (piazza), nord (cimitero), sud-est (spiaggia) ———
const muretto = (x0, z0, x1, z1) => rect(x0, z0, x1, z1, 'm', (c) => 'v,es '.includes(c));
muretto(43, 22, 43, 32);     // ovest | nord, dal muro della rotonda in su
muretto(43, 51, 43, 61);     // ovest | sud-est, dal muro della rotonda in giù
muretto(25, 59, 42, 59);     // piazza | spiaggia
muretto(74, 44, 92, 44);     // nord | sud-est, dall'abside verso il mare
muretto(35, 3, 35, 22); muretto(35, 22, 43, 22); // piazza | cimitero
muretto(88, 3, 88, 41);      // cimitero | spiaggia, lungo il bordo est
for (const x of [80, 81]) set(x, 44, '5'); // cancello dal cimitero alla spiaggia

// colonne: giro di 8 nella rotonda (raggio 5,5), due pilastri all'arco del presbiterio
for (let i = 0; i < 8; i++) {
  const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
  set(Math.floor(R.cx + Math.cos(a) * 5.5), Math.floor(R.cz + Math.sin(a) * 5.5), 'o');
}
set(55, 38, 'o'); set(55, 46, 'o');
// altare maggiore nell'abside (2×3), stalli del coro lungo i fianchi del presbiterio
for (let z = 41; z <= 43; z++) for (let x = 69; x <= 70; x++) set(x, z, 'A');
for (const x of [62, 63, 64]) set(x, 37, 'p');   // a nord tra la mazza e la finestra (la porta nord resta libera)
for (const x of [58, 59, 62, 63, 64]) set(x, 47, 'p'); // a sud, lasciando libere le due finestre
// bracieri: al centro della rotonda (dove nel Santo Sepolcro c'è l'edicola) e ai lati dell'arco del presbiterio
for (const [x, z] of [[46, 42], [57, 40], [57, 44]]) set(x, z, 'b');
// macerie del tetto crollato (ostacoli dentro)
for (const [x, z] of [[41, 36], [42, 36], [49, 48], [50, 48], [50, 47], [38, 45], [60, 44], [61, 44]]) if (get(x, z) === '.') set(x, z, 'r');

// ——— finestre sbarrate (gli zombie entrano da qui) ———
const sulMuro = (x, z) => get(x, z) === '#';
const QUATTRO = [[1, 0], [-1, 0], [0, 1], [0, -1]];
/** Cella di muro della rotonda all'angolo `deg` (0 = est, 90 = sud) che si attraversa dritta: pavimento da un lato, sagrato dall'altro. */
function rotondaA(deg) {
  for (let off = 0; off <= 12; off++) for (const segno of [1, -1]) {
    const a = ((deg + off * segno * 2) * Math.PI) / 180;
    for (let r = R.r - 0.3; r > R.r - 1.6; r -= 0.2) {
      const x = Math.floor(R.cx + Math.cos(a) * r), z = Math.floor(R.cz + Math.sin(a) * r);
      if (!sulMuro(x, z)) continue;
      if (QUATTRO.some(([dx, dz]) => get(x + dx, z + dz) === '.' && get(x - dx, z - dz) === ',')) return [x, z];
    }
  }
  throw new Error(`nessun muro della rotonda a ${deg}°`);
}
const finestre = [rotondaA(90), rotondaA(270), rotondaA(140), rotondaA(220), [60, P.z0], [65, P.z0], [60, P.z1], [65, P.z1]];
for (let x = W - 1; x > AB.cx; x--) if (sulMuro(x, 42)) { finestre.push([x, 42]); break; } // abside: finestra a est
for (const [x, z] of finestre) set(x, z, 'W');

// ——— porte della chiesa: 1 = portale ovest della rotonda (verso la piazza), 2 = porta nord del presbiterio (verso il cimitero) ———
for (let z = 41; z <= 43; z++) { for (let x = 30; x < R.cx; x++) if (sulMuro(x, z)) { set(x, z, '1'); break; } }
for (const x of [57, 58]) set(x, P.z0, '2');

/** L'altare laterale contro il muro della rotonda tra il portale e la finestra di nord-ovest, l'arco sulla cella davanti (verso il centro). */
function altareLaterale() {
  for (let deg = 200; deg <= 214; deg++) for (let r = R.r - 1.2; r > R.r - 2.6; r -= 0.2) {
    const a = (deg * Math.PI) / 180, x = Math.floor(R.cx + Math.cos(a) * r), z = Math.floor(R.cz + Math.sin(a) * r);
    if (get(x, z) !== '.' || !QUATTRO.some(([dx, dz]) => get(x + dx, z + dz) === '#')) continue;
    if (QUATTRO.some(([dx, dz]) => 'W1'.includes(get(x + dx, z + dz)))) continue;
    const [dx, dz] = QUATTRO.reduce((m, q) => (d(x + q[0], z + q[1], R.cx, R.cz) < d(x + m[0], z + m[1], R.cx, R.cz) ? q : m));
    if (get(x + dx, z + dz) !== '.') continue;
    set(x, z, 'a'); set(x + dx, z + dz, 'R');
    return;
  }
  throw new Error("nessun posto per l'altare laterale");
}
// ——— armi sul muro (gesso), l'arco sull'altare laterale, le armi dei pirati accanto alle tende; posti della cassa ———
altareLaterale();                     // altare laterale a sinistra del portale, con l'arco
set(61, 37, 'M');                     // mazza ferrata: muro nord del presbiterio, tra gli stalli
set(40, 36, 'X');                     // ascia danese: muro nord-ovest della rotonda, tra le macerie
set(7, 67, 'G');                      // pistola a pietra focaia: muro ovest della taverna
set(42, 69, 'K');                     // moschetto: accanto alla prima tenda
set(65, 68, 'E');                     // trombone: accanto alla terza tenda
set(44, 34, 'C'); set(67, 37, 'C');   // cassa: in fondo alla rotonda e accanto all'abside
set(11, 44, 'C'); set(69, 11, 'C'); set(55, 71, 'C'); // e nella piazza (contro una casa), davanti all'ossario, accanto a una tenda

// ——— trappole: il rogo sulla passatoia del presbiterio, la campana davanti alla porta nord (fuori) ———
for (let x = 58; x <= 66; x++) for (const z of [42, 43]) if (get(x, z) === '.') set(x, z, 'J');
set(63, 46, 'Q');
for (let x = 54; x <= 61; x++) for (let z = 29; z <= 34; z++) if (get(x, z) === ',') set(x, z, 'T');
set(59, 38, 'L');

// ——— partenza davanti all'altare; comparse: sagrato fuori dalle finestre, e nelle zone ———
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
const comparse = { y: [[9, 36], [15, 48], [24, 33], [30, 54], [8, 58]], u: [[39, 6], [50, 13], [63, 9], [76, 19], [85, 13], [44, 22]], x: [[21, 70], [10, 69]], j: [[34, 81], [50, 82], [63, 81], [77, 82], [90, 80], [92, 62]] };
for (const [c, l] of Object.entries(comparse)) for (const [x, z] of l) { if ('vews'.includes(get(x, z))) set(x, z, c); else throw new Error(`comparsa ${c} su '${get(x, z)}' in ${x},${z}`); }
// qualche maceria sul sagrato (ostacoli che spezzano le corse)
for (const [x, z] of [[33, 33], [34, 52], [60, 30], [72, 33], [76, 50], [52, 56]]) if (fuori(x, z)) set(x, z, 'q');

// ——— controlli: zone collegate dalle porte giuste, comparse raggiungibili, l'eroe chiuso in chiesa all'inizio ———
const PORTE = '12345';
const pieno = (c) => ' #ohtmApbrqkgaCW'.includes(c);
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
const errs = [];
const chiuso = bfs(sx, sz, (c) => pieno(c) || PORTE.includes(c));
const aperte = (lista) => bfs(sx, sz, (c) => pieno(c) || (PORTE.includes(c) && !lista.includes(c)));
rows.forEach((r, z) => [...r].forEach((c, x) => { if ('v,esw'.includes(c) && chiuso.has(x + ',' + z)) errs.push(`l'eroe esce dalla chiesa in ${x},${z}`); }));
// ogni zona si apre con la sua porta: la piazza col portale, la taverna dalla piazza, il cimitero con la porta nord, la spiaggia da taverna o cimitero
const zona = { y: ['1'], x: ['1', '3'], u: ['2'], j: ['1', '3', '4'] };
for (const [c, porte] of Object.entries(zona)) {
  const prima = porte.length > 1 ? aperte(porte.slice(0, -1)) : chiuso, dopo = aperte(porte);
  for (const [x, z] of comparse[c]) {
    if (prima.has(x + ',' + z)) errs.push(`la comparsa ${c} in ${x},${z} si raggiunge senza la porta ${porte.at(-1)}`);
    if (!dopo.has(x + ',' + z)) errs.push(`la comparsa ${c} in ${x},${z} non si raggiunge con le porte ${porte.join('')}`);
  }
}
// ogni finestra si passa dritta: dentro un pavimento, fuori il sagrato
for (const [x, z] of finestre) if (!QUATTRO.some(([dx, dz]) => !pieno(get(x + dx, z + dz)) && get(x - dx, z - dz) !== ' ' && !pieno(get(x - dx, z - dz)))) errs.push(`la finestra ${x},${z} non si attraversa`);
if (!aperte(['2', '5']).has('50,82')) errs.push('dal cimitero col cancello 5 non si arriva alla spiaggia');
// gli zombie delle comparse 'z' arrivano alla partenza dalle finestre (senza porte aperte)
const daZombie = bfs(sx, sz, (c) => (pieno(c) && c !== 'W') || PORTE.includes(c));
rows.forEach((r, z) => [...r].forEach((c, x) => { if (c === 'z' && !daZombie.has(x + ',' + z)) errs.push(`comparsa ${x},${z} non arriva alla chiesa`); }));
if (errs.length) { console.error(errs.slice(0, 20).join('\n')); process.exit(1); }

// righe senza spazi in coda (il parser tratta il fuori come spazio)
const trimmed = rows.map((r) => r.replace(/ +$/, ''));
const out = {
  tile: 1,
  legenda: {
    '1': { porta: 'portale' }, '2': { porta: 'cimitero' }, '3': { porta: 'taverna' }, '4': { porta: 'spiaggia_taverna' }, '5': { porta: 'spiaggia_cimitero' },
    'R': { muro: 'arco' }, 'M': { muro: 'mazza' }, 'X': { muro: 'ascia' }, 'G': { muro: 'pistola' }, 'K': { muro: 'moschetto' }, 'E': { muro: 'trombone' },
    'y': { comparsa: 'piazza' }, 'u': { comparsa: 'cimitero' }, 'x': { comparsa: 'taverna' }, 'j': { comparsa: 'spiaggia' },
    'J': { trappola: 'rogo' }, 'Q': { leva: 'rogo' }, 'T': { trappola: 'campana' }, 'L': { leva: 'campana' },
  },
  rows: trimmed,
};
fs.writeFileSync(OUT, JSON.stringify(out, null, 0).replace('"rows":[', '"rows":[\n').replace(/","/g, '",\n"').replace(/"\]\}$/, '"\n]}\n'));
const conta = (c) => rows.join('').split(c).length - 1;
console.log(`[templari] mappa ${W}×${H}: ${conta('W')} finestre, ${conta('z') + conta('y') + conta('u') + conta('x') + conta('j')} comparse, ${conta('C')} posti della cassa → ${path.relative(ROOT, OUT)}`);
if (process.argv.includes('--stampa')) console.log(trimmed.filter((r) => r.trim()).join('\n'));
