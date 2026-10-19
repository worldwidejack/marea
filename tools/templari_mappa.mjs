#!/usr/bin/env node
// Mappa dell'arena dei Templari (docs/TEMPLARI.md §3): celle da 1 m disegnate con forme semplici (cerchi, rettangoli, segmenti) e scritte
// come righe ASCII in packages/content/src/templari/mappa.json, che la sim legge (packages/sim/src/templari/mappa.ts).
// Uso: node tools/templari_mappa.mjs [--stampa]   (--stampa mostra la mappa nel terminale)
// Legenda — chiesa: '#' muro · 'N' tramezzo (il muro col passaggio tra rotonda e coro) · 'o' colonna · '.' pavimento · 'W' finestra
//   sbarrata · 'A' altare maggiore · 'a' altare laterale · 'p' stalli del coro · 'V' sarcofago di un cavaliere con la statua distesa ·
//   'Y' armadio della sacrestia · 'r' macerie del tetto · 'b' braciere · 'S' partenza · 'C' posto della cassa del tesoro.
// Tre stanze: la rotonda (la navata), il coro (presbiterio e abside con l'altare) e la sacrestia a sud del coro (assito, armadi), che si
// apre con la porta '6'.
// Fuori: ',' terra del sagrato · 'v' acciottolato della piazza · 'e' erba del cimitero · 's' sabbia della spiaggia · 'w' assito della taverna
//   · 'h' casa diroccata (muro) · 't' tenda dei pirati (muro) · 'm' muretto (basso, ferma tutti) · 'g' tomba · 'k' pozzo, carretti, botti,
//   cannoni · 'q' macerie (sulla sabbia scogli) · '|' palizzata dell'accampamento (muro) · '=' la nave in secca (muro) · ' ' fuori dalla mappa.
// Porte (legenda `porta`: si comprano, aprono una zona): '1' portale → piazza · '2' porta nord → cimitero · '3' taverna · '4' dalla taverna
//   all'accampamento · '5' dal cimitero all'accampamento · '6' dal coro alla sacrestia.
// Comparse degli zombie: 'z' sagrato (sempre attive) · 'y' piazza · 'u' cimitero · 'x' taverna · 'j' spiaggia (legenda `comparsa`: attive
//   quando la loro zona è aperta). Armi sul muro (legenda `muro`), nella cella davanti: 'R' arco · 'M' mazza · 'X' ascia · 'G' pistola ·
//   'K' moschetto · 'E' trombone. Trappole (legenda `trappola`): 'J' zona del rogo e 'Q' la sua leva · 'T' zona della campana e 'L' la leva.
// Personaggi (legenda `personaggio`, il posto dove gli si parla): 'F' la Strega · 'D' il Mercante.
// Fuochi da accendere (legenda `fuoco`, docs/TEMPLARI.md §9b): 'I' coro (il rogo) · 'O' cimitero (la Strega) · 'U' spiaggia (il falò dei
//   pirati: la nave del Mercante). Pezzi della campana (legenda `pezzo`, posti possibili: la partita ne sceglie uno per pezzo): 'c' la
//   corda · 'd' il battaglio · 'f' il perno.
// Segreti (docs/TEMPLARI.md §9c, legenda `cripta`, `campanella`, `indizio`, `teschio`): 'Z' il muro crepato della rotonda (si rompe con un
//   colpo pesante) · 'H' la scala della cripta (in cima si torna in chiesa) · 'P' l'altare della Lancia · 'n' comparse della cripta (dai
//   sarcofagi, attive col muro rotto) · '7' '8' '9' '0' le campanelle (croce, teschio, ancora, luna) · 'B' il muro con l'ordine delle
//   campane (la cella davanti) · 'i' 'l' '!' i teschi della canzone segreta.
// Il piano di sotto (§12b punto 3, le catacombe): sta nelle righe sotto la riga SOPRA (84), staccato da tutto. La cripta, i tunnel e le
// sale si raggiungono solo dalle scale, che sono due capi della stessa scala (la sim porta eroi e zombie dall'uno all'altro): il muro rotto
// della rotonda e la scala 'H' in fondo alla cripta; le due grate da comprare ('<' sull'ossario del cimitero, '>' nella grotta tra gli
// scogli dell'accampamento), ognuna con una cella sopra e una sotto (legenda `porta` con `scala`). Sotto: ':' terra battuta, '%' roccia
// (muro), '&' nicchia coi morti (muro), '+' comparse delle catacombe (attive col muro rotto o una grata aperta), '*' la fucina dei Templari.
// La chiesa è alla templare: una rotonda (come il Santo Sepolcro, la Temple Church di Londra, la Vera Cruz di Segovia) col giro di
// colonne, e a est il presbiterio con l'abside e l'altare maggiore. Attorno il sagrato diviso da muretti in tre parti: ovest verso la
// piazza del borgo, nord verso il cimitero, sud-est verso la spiaggia e l'accampamento dei pirati.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'packages/content/src/templari/mappa.json');
const W = 100, H = 145, SOPRA = 84; // dalla riga SOPRA in giù il piano di sotto (le catacombe, §12b punto 3), che comincia 24 righe più giù:
// tra la riva e il sotto c'è il mare, così dall'accampamento non si vede il nero del sotto e dal sotto non si vede il mare
const g = Array.from({ length: H }, () => Array(W).fill(' '));
const set = (x, z, c) => { if (x >= 0 && z >= 0 && x < W && z < H) g[z][x] = c; };
const get = (x, z) => (x >= 0 && z >= 0 && x < W && z < H ? g[z][x] : ' ');
const each = (fn) => { for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) fn(x, z); };
const rect = (x0, z0, x1, z1, c, solo) => { for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) if (!solo || solo(get(x, z))) set(x, z, c); };
const d = (x, z, cx, cz) => Math.hypot(x + 0.5 - cx, z + 0.5 - cz);

// ——— zone di fuori (prima, così chiesa e sagrato ci si disegnano sopra) ———
rect(4, 25, 34, 59, 'v');    // piazza del borgo
rect(36, 3, 88, 25, 'e');    // cimitero
// case diroccate della piazza, il pozzo e i carretti
for (const [x0, z0, x1, z1] of [[6, 27, 12, 33], [16, 26, 22, 30], [5, 39, 10, 46], [6, 50, 13, 56], [20, 51, 26, 56], [27, 27, 32, 31]]) rect(x0, z0, x1, z1, 'h');
rect(18, 40, 19, 41, 'k'); set(26, 37, 'k'); set(27, 37, 'k'); set(14, 36, 'q'); set(30, 47, 'q');
// taverna del Teschio: muri, assito, bancone, botti; due porte (dalla piazza a nord, verso l'accampamento a est: §12b, prima a sud)
rect(6, 60, 24, 73, '#'); rect(7, 61, 23, 72, 'w');
rect(9, 64, 15, 64, 'p'); set(20, 62, 'k'); set(21, 62, 'k'); set(22, 65, 'k'); set(8, 71, 'k');
for (const x of [14, 15]) set(x, 60, '3');
for (const z of [66, 67]) set(24, z, '4');
// cimitero: tombe in file, l'ossario in fondo
for (let z = 7; z <= 21; z += 4) for (let x = 41; x <= 84; x += 3) if (!(x > 68 && z < 12)) { set(x, z, 'g'); set(x, z + 1, 'g'); }
rect(70, 5, 79, 10, 'h');

// ——— rotonda e presbiterio ———
const R = { cx: 46, cz: 42.5, r: 10 };          // rotonda: muro tra 9 e 10 m dal centro
const P = { x0: 54, x1: 68, z0: 36, z1: 48 };   // presbiterio: muri sul bordo, dentro z 37..47
const AB = { cx: 68, cz: 42.5, r: 6 };          // abside: semicerchio a est del presbiterio
const SA = { x0: 56, x1: 68, z0: 48, z1: 56 };   // sacrestia: a sud del presbiterio, il muro in comune è z 48
const dentroChiesa = (x, z) => d(x, z, R.cx, R.cz) < R.r || (x >= P.x0 && x <= P.x1 && z >= P.z0 && z <= P.z1) || (x > P.x1 - 1 && d(x, z, AB.cx, AB.cz) < AB.r)
  || (x >= SA.x0 && x <= SA.x1 && z >= SA.z0 && z <= SA.z1);
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
// tramezzo tra rotonda e coro: muro con un passaggio di 3 m al centro (le colonne dell'arco restano ai lati)
for (const z of [P.z0 + 3, P.z0 + 4, P.z1 - 4, P.z1 - 3]) set(55, z, 'N');
// sacrestia: il muro in comune col coro (con la porta), l'assito
for (let x = SA.x0; x <= SA.x1; x++) set(x, SA.z0, '#');
for (let z = SA.z0 + 1; z < SA.z1; z++) for (let x = SA.x0 + 1; x < SA.x1; x++) if (get(x, z) === '.') set(x, z, 'w');

// ——— muretti che dividono il sagrato: ovest (piazza), nord (cimitero), sud-est (spiaggia) ———
const muretto = (x0, z0, x1, z1) => rect(x0, z0, x1, z1, 'm', (c) => 'v,es '.includes(c));
muretto(43, 22, 43, 32);     // ovest | nord, dal muro della rotonda in su
muretto(43, 51, 43, 61);     // ovest | sud-est, dal muro della rotonda in giù
muretto(25, 59, 42, 59);     // piazza | spiaggia
muretto(74, 44, 92, 44);     // nord | sud-est, dall'abside verso il mare
muretto(35, 3, 35, 22); muretto(35, 22, 43, 22); // piazza | cimitero
muretto(88, 3, 88, 41);      // cimitero | spiaggia, lungo il bordo est
for (const x of [74, 75]) set(x, 44, '5'); // cancello dal cimitero alla spiaggia (§12b: accanto all'abside, prima a x 80)

// ——— accampamento dei pirati (§12b punto 2, 18 ott 2026): prima era una spiaggia larga e vuota dove si girava in tondo; ora è una striscia
// tra la taverna e la palizzata est, chiusa a nord da una palizzata (dal sagrato si entra da un varco solo: ci arriva chi viene dal
// cimitero) e a sud dagli scogli. In mezzo la strada (z 65..68) dalla porta della taverna al varco, e a pettine i vicoli tra tende,
// palizzate, la nave in secca e i cannoni, quasi tutti ciechi; alla riva si scende solo dall'approdo del Mercante.
const ACC = { x0: 25, x1: 80, z0: 60, z1: 73 };
rect(ACC.x0, ACC.z0, ACC.x1, ACC.z1, 's');
set(43, 60, 'm'); set(43, 61, 'm');            // il muretto ovest | sud-est arriva fino alla palizzata
const tenda = (x0, z0) => rect(x0, z0, x0 + 3, z0 + 3, 't');
// a nord: la palizzata col varco, poi a pettine tende e vicoli ciechi
rect(44, 60, 80, 60, '|'); rect(73, 60, 74, 60, 's');
rect(25, 61, 25, 63, '|');                       // tra la taverna e la prima tenda niente passaggio (si girerebbe attorno alla tenda)
tenda(26, 61);
rect(32, 64, 43, 64, '|'); rect(43, 62, 43, 64, '|'); // la tasca del moschetto: ci si entra solo accanto alla tenda
tenda(44, 61); rect(51, 61, 51, 64, '|'); tenda(52, 61); tenda(58, 61); tenda(64, 61); rect(68, 61, 68, 64, '|'); rect(72, 61, 72, 64, '|'); tenda(76, 61);
rect(80, 61, 80, 72, '|');                       // a est la palizzata scende fino agli scogli
// la strada: qualche botte che la spezza (il falò dei pirati sta in mezzo, davanti all'approdo: sotto coi fuochi)
for (const [x, z] of [[34, 65], [35, 65], [41, 68], [66, 65], [67, 68]]) set(x, z, 'k');
// a sud: la nave in secca su un fianco, le tende, i cannoni puntati al mare; la riva è tutta scogli tranne l'approdo
rect(27, 69, 37, 71, '=');
rect(42, 70, 46, 72, 'q'); tenda(47, 69); rect(55, 70, 55, 72, 'q'); rect(61, 70, 62, 72, 'q'); tenda(63, 69);
tenda(70, 69); rect(76, 69, 76, 72, '|');
for (const x of [52, 67, 74]) { set(x, 72, 'k'); set(x + 1, 72, 'k'); }
rect(ACC.x0, 72, 37, 72, 'q');                  // dietro la nave gli scogli (niente giro attorno alla nave)
rect(ACC.x0, ACC.z1, ACC.x1, ACC.z1, 'q'); rect(56, ACC.z1, 60, ACC.z1, 's');

// colonne: giro di 8 nella rotonda (raggio 5,5), due pilastri all'arco del presbiterio
for (let i = 0; i < 8; i++) {
  const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
  set(Math.floor(R.cx + Math.cos(a) * 5.5), Math.floor(R.cz + Math.sin(a) * 5.5), 'o');
}
set(55, 38, 'o'); set(55, 46, 'o');
// altare maggiore nell'abside (2×3), stalli del coro lungo i fianchi del presbiterio
for (let z = 41; z <= 43; z++) for (let x = 69; x <= 70; x++) set(x, z, 'A');
for (const x of [62, 63, 64]) set(x, 37, 'p');   // a nord tra la mazza e la finestra (la porta nord resta libera)
for (const x of [57, 58, 59, 64, 65, 66]) set(x, 47, 'p'); // a sud, lasciando libera la porta della sacrestia
// sacrestia: armadi dei paramenti lungo il muro nord e ovest, un tavolo coi calici in mezzo
for (const x of [57, 58, 66, 67]) set(x, SA.z0 + 1, 'Y');
for (const z of [52, 53]) set(SA.x0 + 1, z, 'Y');
for (const x of [61, 62]) set(x, 52, 'k');
// sarcofagi dei cavalieri nel deambulatorio della rotonda (le effigie della Temple Church): 1 × 2 m, tra le colonne e il muro
for (const deg of [60, 120, 240, 300]) {
  const ang = (deg * Math.PI) / 180, cx = Math.floor(R.cx + Math.cos(ang) * 7.2), cz = Math.floor(R.cz + Math.sin(ang) * 7.2) - (deg > 180 ? 1 : 0);
  if (get(cx, cz) === '.' && get(cx, cz + 1) === '.') { set(cx, cz, 'V'); set(cx, cz + 1, 'V'); }
}
// bracieri: al centro della rotonda (dove nel Santo Sepolcro c'è l'edicola) e ai lati dell'arco del presbiterio
for (const [x, z] of [[46, 42], [57, 40], [57, 44]]) set(x, z, 'b');
// macerie del tetto crollato (ostacoli dentro; davanti al muro crepato no, §9c)
for (const [x, z] of [[42, 36], [49, 48], [50, 48], [50, 47], [38, 45], [60, 44], [61, 44]]) if (get(x, z) === '.') set(x, z, 'r');

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
const finestre = [rotondaA(90), rotondaA(270), rotondaA(140), rotondaA(220), [60, P.z0], [65, P.z0], [60, SA.z1], [65, SA.z1], [SA.x1, SA.z0 + 4]];
for (let x = W - 1; x > AB.cx; x--) if (sulMuro(x, 42)) { finestre.push([x, 42]); break; } // abside: finestra a est
for (const [x, z] of finestre) set(x, z, 'W');

// ——— porte della chiesa: 1 = portale ovest della rotonda (verso la piazza), 2 = porta nord del presbiterio (verso il cimitero) ———
for (let z = 41; z <= 43; z++) { for (let x = 30; x < R.cx; x++) if (sulMuro(x, z)) { set(x, z, '1'); break; } }
for (const x of [57, 58]) set(x, P.z0, '2');
for (const x of [61, 62]) set(x, SA.z0, '6'); // dal coro alla sacrestia

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
set(41, 62, 'K');                     // moschetto: in fondo alla tasca dietro la prima tenda (contro la palizzata)
set(62, 61, 'E');                     // trombone: in fondo a un vicolo cieco tra due tende
set(44, 34, 'C'); set(67, 37, 'C');   // cassa: in fondo alla rotonda e accanto all'abside
set(SA.x1 - 1, SA.z1 - 2, 'C');      // e in sacrestia, contro il muro est
set(11, 44, 'C'); set(69, 11, 'C'); set(51, 70, 'C'); // e nella piazza (contro una casa), davanti all'ossario, accanto a una tenda della riva

// ——— trappole: il rogo sulla passatoia del presbiterio, la campana davanti alla porta nord (fuori) ———
for (let x = 58; x <= 66; x++) for (const z of [42, 43]) if (get(x, z) === '.') set(x, z, 'J');
set(63, 46, 'Q');
for (let x = 54; x <= 61; x++) for (let z = 29; z <= 34; z++) if (get(x, z) === ',') set(x, z, 'T');
set(59, 38, 'L');

// ——— fuochi da accendere (il terzo è il falò dei pirati, sopra) e posti dei pezzi della campana, uno per zona ———
set(66, 46, 'I');                     // coro: accanto agli stalli a sud, a due passi dalla partenza
set(58, 66, 'U');                     // spiaggia: il falò in mezzo alla strada, davanti all'approdo del Mercante
set(64, 5, 'O');                      // cimitero: in cima, accanto alla capanna della Strega
const PEZZI = { c: [[64, 54], [12, 69], [70, 64]], d: [[52, 22], [28, 45], [40, 72]], f: [[78, 71], [17, 34], [80, 25]] };
for (const [c, l] of Object.entries(PEZZI)) for (const [x, z] of l) { if (',vews'.includes(get(x, z))) set(x, z, c); else throw new Error(`pezzo ${c} su '${get(x, z)}' in ${x},${z}`); }

// ——— segreti (§9c): la cripta, il muro crepato, le campanelle col loro indizio, i teschi ———
// ——— il piano di sotto (§9c, §12b punto 3) ———
// cripta: una sala buia a colonne, quattro sarcofagi per lato (gli zombie escono da lì davanti), l'altare della Lancia a ovest, la scala a est
const CR = { x0: 3, x1: 25, z0: 129, z1: 141 };
rect(CR.x0, CR.z0, CR.x1, CR.z1, '#'); rect(CR.x0 + 1, CR.z0 + 1, CR.x1 - 1, CR.z1 - 1, '.');
for (const x of [8, 12, 16, 20]) { for (const z of [CR.z0 + 1, CR.z0 + 2, CR.z1 - 2, CR.z1 - 1]) set(x, z, 'V'); set(x, CR.z0 + 3, 'n'); set(x, CR.z1 - 3, 'n'); }
for (const x of [10, 14, 18]) { set(x, CR.z0 + 4, 'o'); set(x, CR.z0 + 8, 'o'); }
for (const z of [CR.z0 + 5, CR.z0 + 6, CR.z0 + 7]) set(5, z, 'P');
const SCALA = [CR.x1, CR.z0 + 6];
set(SCALA[0], SCALA[1], 'H');
// le catacombe: dal lato nord della cripta un tunnel che arriva a un incrocio; a est una strettoia e la grotta sotto l'accampamento, a
// ovest il ramo (con una strettoia) che sale all'ossario del cimitero, a nord la sala della fucina. Larghi 2 m, strettoie da 1 m (scelta
// di birbasan). Si scava nel vuoto (':'), poi la roccia attorno ('%'), poi le nicchie coi morti ('&') sulla roccia dei tunnel.
const scava = (x0, z0, x1, z1) => rect(x0, z0, x1, z1, ':');
scava(23, CR.z0, 24, CR.z0);                    // il varco nel muro nord della cripta
scava(23, 123, 24, 128);                        // il tunnel
scava(16, 121, 25, 122);                        // l'incrocio
scava(26, 121, 28, 121);                        // strettoia verso la grotta
scava(29, 117, 34, 122); scava(30, 116, 33, 116);  // la grotta sotto l'accampamento
scava(14, 121, 15, 122); scava(11, 121, 13, 121); scava(8, 121, 10, 122); // il ramo ovest, con una strettoia
scava(8, 114, 9, 120);                            // sale verso l'ossario
scava(5, 109, 12, 113);                           // l'ossario di sotto
scava(21, 119, 22, 120); scava(17, 111, 26, 118);   // la sala della fucina
const SOTTO = (c) => c === ':' || c === '.' || c === 'V' || c === 'o' || c === 'P' || c === 'H' || c === 'n';
each((x, z) => {
  if (z < SOPRA || get(x, z) !== ' ') return;
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) if (SOTTO(get(x + dx, z + dz))) { set(x, z, '%'); return; }
});
// la fucina dei Templari contro il muro nord della sala (fredda: si accende al passo 7), le grate in cima alle due salite
set(21, 111, '*'); set(22, 111, '*');
const GRATE = { '<': { sotto: [8, 108], sopra: [74, 11] }, '>': { sotto: [32, 115], sopra: [61, 70] } };
for (const [c, { sotto, sopra }] of Object.entries(GRATE)) {
  if (get(...sotto) !== '%') throw new Error(`la grata ${c} di sotto non è nella roccia (${get(...sotto)})`);
  if (!'eq'.includes(get(...sopra))) throw new Error(`la grata ${c} di sopra è su '${get(...sopra)}'`);
  set(...sotto, c); set(...sopra, c);
}
// nicchie coi morti sulla roccia dei tunnel (non accanto alle grate, alla fucina e ai varchi)
for (const [x, z] of [[22, 124], [25, 126], [22, 127], [17, 120], [25, 120], [18, 123], [25, 123], [27, 120], [14, 120], [10, 123], [7, 116], [10, 118], [6, 108], [11, 108], [13, 112], [16, 114], [27, 116], [35, 119], [31, 123]]) {
  if (get(x, z) !== '%') throw new Error(`nicchia fuori dalla roccia in ${x},${z} (${get(x, z)})`);
  set(x, z, '&');
}
// gli zombie escono anche dalle nicchie: comparse delle catacombe davanti a qualcuna
const CATACOMBE = [[17, 121], [25, 122], [9, 117], [31, 119], [19, 116], [24, 113], [8, 111]];
for (const [x, z] of CATACOMBE) { if (get(x, z) !== ':') throw new Error(`comparsa delle catacombe su '${get(x, z)}' in ${x},${z}`); set(x, z, '+'); }
// il muro crepato: nel muro nord-ovest della rotonda, accanto all'ascia (dietro c'è la scala che scende)
const CREPA = [40, 35];
if (get(...CREPA) !== '#') throw new Error(`il muro crepato non è su un muro (${get(...CREPA)})`);
set(CREPA[0], CREPA[1], 'Z');
// campanelle: una per zona, su un palo (croce in chiesa, teschio al cimitero, ancora alla spiaggia, luna in piazza); l'indizio in taverna
const CAMPANELLE = { 7: [41, 48], 8: [67, 14], 9: [49, 61], 0: [21, 43] }; // croce: nella rotonda, accanto alla tomba di un cavaliere (non dal coro: lì le draw call sono al limite)
for (const [c, [x, z]] of Object.entries(CAMPANELLE)) { if ('.,vesw'.includes(get(x, z))) set(x, z, c); else throw new Error(`campanella ${c} su '${get(x, z)}' in ${x},${z}`); }
const INDIZIO = [19, 61]; // sul muro nord della taverna, dentro (la camera lo vede dritto; lontano dal coro, dove le draw call sono al limite)
if (get(...INDIZIO) !== 'w' || get(INDIZIO[0], INDIZIO[1] - 1) !== '#') throw new Error("l'indizio delle campane vuole l'assito con un muro a nord");
set(INDIZIO[0], INDIZIO[1], 'B');
// teschi (nascosti, come gli orsacchiotti): dietro una casa della piazza, nell'angolo della taverna, dietro l'ossario
const TESCHI = { i: [17, 25], l: [7, 72], '!': [75, 4] };
for (const [c, [x, z]] of Object.entries(TESCHI)) { if ('.,vesw'.includes(get(x, z))) set(x, z, c); else throw new Error(`teschio ${c} su '${get(x, z)}' in ${x},${z}`); }
// ——— gli indizi (§12b punto 4): fuori dalle righe (la mappa e il dipinto non cambiano) ———
// scheletri col biglietto, seduti con la schiena al muro, uno per segreto, in catena: il coro (accanto alla partenza: cosa si fa
// sull'isola), la rotonda (il muro crepato e la cripta), la taverna (le campanelle e i teschi), l'ossario (i teschi e la grata), le
// catacombe (le grate e la fucina), la fucina (passo 7)
const SCHELETRI = { coro: [71, 44], rotonda: [39, 37], taverna: [23, 61], ossario: [77, 11], catacombe: [19, 121], fucina: [25, 111] };
for (const [id, [x, z]] of Object.entries(SCHELETRI)) {
  if (!'.,vesw:'.includes(get(x, z))) throw new Error(`scheletro ${id} su '${get(x, z)}' in ${x},${z}`);
  if (!QUATTRO.some(([dx, dz]) => '#h%&'.includes(get(x + dx, z + dz)))) throw new Error(`lo scheletro ${id} in ${x},${z} non ha un muro per la schiena`);
}
// scritte col sangue: sul pavimento (si leggono meglio: la camera le vede dritte) o su un muro (la faccia `lato` guarda una cella
// libera; la camera vede di sbieco le facce a sud e a est)
const SANGUE = [
  { id: 'crepa', x: 42.7, z: 39.8 },              // in mezzo alla rotonda, dentro il giro di colonne (tra il muro crepato e le colonne non c'è posto)
  { id: 'campane', x: 17, z: 62 },               // in taverna, sotto l'ordine delle campane scritto sul muro
  { id: 'teschi', x: 75.6, z: 12.6 },            // davanti all'ossario, accanto allo scheletro del becchino
  { id: 'fucina', x: 24.4, z: 110, lato: 's' },    // sul muro nord della sala della fucina
];
const LATO = { n: [0, -1], s: [0, 1], e: [1, 0], o: [-1, 0] };
for (const { id, x, z, lato } of SANGUE) {
  const cx = Math.floor(x), cz = Math.floor(z);
  if (lato) {
    const [dx, dz] = LATO[lato];
    if (!'#h%&'.includes(get(cx, cz)) || !'.,vesw:'.includes(get(cx + dx, cz + dz))) throw new Error(`la scritta ${id} vuole un muro in ${cx},${cz} con la faccia ${lato} libera`);
  } else if (!'.,vesw:XMRGKE'.includes(get(cx, cz))) throw new Error(`la scritta ${id} sul pavimento è su '${get(cx, cz)}' in ${cx},${cz}`);
}

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
const comparse = { y: [[9, 36], [15, 48], [24, 33], [30, 54], [8, 58]], u: [[39, 6], [50, 13], [63, 9], [76, 19], [85, 13], [44, 22]], x: [[21, 70], [10, 69]], j: [[36, 61], [25, 71], [56, 62], [70, 61], [78, 69], [39, 69]] };
// Strega e Mercante (docs/TEMPLARI.md §7b): il posto dove si parla con loro, sul bordo del campo; loro stanno fuori, oltre il bordo
// ('F' strega: in cima al cimitero, la capanna oltre i cipressi · 'D' mercante: sulla riva della spiaggia, la barca in mare)
const PERSONAGGI = { F: [61, 3], D: [58, 73] };
for (const [c, [x, z]] of Object.entries(PERSONAGGI)) { if ('es'.includes(get(x, z)) && get(x, z - 1 + (c === 'D' ? 2 : 0)) === ' ') set(x, z, c); else throw new Error(`${c} non sta sul bordo in ${x},${z}`); }
for (const [c, l] of Object.entries(comparse)) for (const [x, z] of l) { if ('vews'.includes(get(x, z))) set(x, z, c); else throw new Error(`comparsa ${c} su '${get(x, z)}' in ${x},${z}`); }
// qualche maceria sul sagrato (ostacoli che spezzano le corse)
for (const [x, z] of [[33, 33], [34, 52], [60, 30], [72, 33], [76, 50], [52, 56]]) if (fuori(x, z)) set(x, z, 'q');

// ——— controlli: zone collegate dalle porte giuste, comparse raggiungibili, l'eroe chiuso in chiesa all'inizio ———
const PORTE = '123456<>';
const pieno = (c) => ' #ohtmApbrqkgaCWNVYIOUZP7890|=%&*'.includes(c);
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
if (!aperte(['2', '5']).has(PERSONAGGI.D.join(','))) errs.push('dal cimitero col cancello 5 non si arriva alla spiaggia');
// la Strega si raggiunge con la porta del cimitero, il Mercante solo arrivando alla spiaggia
{ const f = PERSONAGGI.F.join(','), m = PERSONAGGI.D.join(',');
  if (chiuso.has(f) || !aperte(['2']).has(f)) errs.push('la Strega si deve raggiungere con la porta del cimitero');
  if (aperte(['1', '2', '3', '6']).has(m) || !aperte(['1', '3', '4']).has(m) || !aperte(['2', '5']).has(m)) errs.push('il Mercante si deve raggiungere solo dalla spiaggia'); }
// i pezzi della campana e i fuochi si raggiungono con tutte le porte aperte (un fuoco: dalla cella accanto)
{ const tutte = aperte(PORTE.split(''));
  for (const [c, l] of Object.entries(PEZZI)) for (const [x, z] of l) if (!tutte.has(x + ',' + z)) errs.push(`il pezzo ${c} in ${x},${z} non si raggiunge`);
  rows.forEach((r, z) => [...r].forEach((c, x) => { if ('IOU'.includes(c) && !QUATTRO.some(([dx, dz]) => tutte.has(x + dx + ',' + (z + dz)))) errs.push(`il fuoco ${c} in ${x},${z} non si raggiunge`); })); }
// la sacrestia si apre solo con la sua porta
{ const sc = `${SA.x0 + 3},${SA.z0 + 3}`; if (chiuso.has(sc)) errs.push('la sacrestia si raggiunge senza la porta 6'); if (!aperte(['6']).has(sc)) errs.push('con la porta 6 non si entra in sacrestia'); }
// gli zombie delle comparse 'z' arrivano alla partenza dalle finestre (senza porte aperte)
const daZombie = bfs(sx, sz, (c) => (pieno(c) && c !== 'W') || PORTE.includes(c));
rows.forEach((r, z) => [...r].forEach((c, x) => { if (c === 'z' && !daZombie.has(x + ',' + z)) errs.push(`comparsa ${x},${z} non arriva alla chiesa`); }));
// segreti (§9c): il muro crepato tocca solo la chiesa (rotto non apre una strada fuori), la cripta è staccata da tutto e dalla scala si
// arriva ai sarcofagi e all'altare; campanelle, indizio e teschi si raggiungono con le porte aperte
{ const tutte = aperte(PORTE.split(''));
  for (const [dx, dz] of QUATTRO) { const c = get(CREPA[0] + dx, CREPA[1] + dz); if (c !== '#' && c !== '.' && c !== 'X') errs.push(`il muro crepato tocca '${c}' in ${CREPA[0] + dx},${CREPA[1] + dz}`); }
  for (const [dx, dz] of QUATTRO) { const k = CREPA[0] + dx + ',' + (CREPA[1] + dz); if (get(CREPA[0] + dx, CREPA[1] + dz) !== '#' && !chiuso.has(k)) errs.push(`davanti al muro crepato la cella ${k} non si raggiunge dalla chiesa`); }
  const giu = bfs(SCALA[0] - 1, SCALA[1], pieno);
  if (giu.has(sx + ',' + sz) || tutte.has(`${SCALA[0] - 1},${SCALA[1]}`)) errs.push('la cripta deve essere staccata dal resto');
  rows.forEach((r, z) => [...r].forEach((c, x) => {
    if ('n+'.includes(c) && !giu.has(x + ',' + z)) errs.push(`la comparsa della cripta in ${x},${z} non si raggiunge dalla scala`);
    if ('<>*'.includes(c) && z >= SOPRA && !QUATTRO.some(([dx, dz]) => giu.has(x + dx + ',' + (z + dz)))) errs.push(`'${c}' di sotto in ${x},${z} non si raggiunge dalla cripta`);
    if (c === 'P' && !QUATTRO.some(([dx, dz]) => giu.has(x + dx + ',' + (z + dz)))) errs.push(`l'altare della cripta in ${x},${z} non si raggiunge`);
  }));
  for (const [c, [x, z]] of Object.entries(CAMPANELLE)) if (!QUATTRO.some(([dx, dz]) => tutte.has(x + dx + ',' + (z + dz)))) errs.push(`la campanella ${c} in ${x},${z} non si raggiunge`);
  for (const [c, [x, z]] of Object.entries(TESCHI)) if (!tutte.has(x + ',' + z)) errs.push(`il teschio ${c} in ${x},${z} non si raggiunge`);
  for (const [id, [x, z]] of Object.entries(SCHELETRI)) if (!tutte.has(x + ',' + z) && !giu.has(x + ',' + z)) errs.push(`lo scheletro ${id} in ${x},${z} non si raggiunge`);
  if (!chiuso.has(SCHELETRI.coro.join(','))) errs.push('lo scheletro del coro si deve raggiungere dalla partenza');
  if (!aperte(['1', '3']).has(INDIZIO.join(','))) errs.push("l'indizio delle campane non si raggiunge dalla taverna");
  // le grate di sopra: l'ossario col cimitero, la grotta con l'accampamento
  const accanto = (s, [x, z]) => QUATTRO.some(([dx, dz]) => s.has(x + dx + ',' + (z + dz)));
  if (!accanto(aperte(['2']), GRATE['<'].sopra)) errs.push("la grata dell'ossario non si raggiunge dal cimitero");
  if (!accanto(aperte(['1', '3', '4']), GRATE['>'].sopra) || accanto(aperte(['1', '3']), GRATE['>'].sopra)) errs.push("la grata della grotta si deve raggiungere dall'accampamento"); }
if (errs.length) { console.error(errs.slice(0, 20).join('\n')); process.exit(1); }

// righe senza spazi in coda (il parser tratta il fuori come spazio)
const trimmed = rows.map((r) => r.replace(/ +$/, ''));
// larghezza fissa a 95 (quella di prima del §12b): l'aspetto delle celle (altezze dei muri, colori) viene da cellHash(indice), e con una
// larghezza diversa cambierebbe tutta l'isola, anche sotto il dipinto
const LARGA = 95;
if (Math.max(...trimmed.map((r) => r.length)) > LARGA) throw new Error(`la mappa è più larga di ${LARGA}`);
const out = {
  tile: 1, w: LARGA, sopra: SOPRA,
  legenda: {
    '1': { porta: 'portale' }, '2': { porta: 'cimitero' }, '3': { porta: 'taverna' }, '4': { porta: 'spiaggia_taverna' }, '5': { porta: 'spiaggia_cimitero' }, '6': { porta: 'sacrestia' },
    'R': { muro: 'arco' }, 'M': { muro: 'mazza' }, 'X': { muro: 'ascia' }, 'G': { muro: 'pistola' }, 'K': { muro: 'moschetto' }, 'E': { muro: 'trombone' },
    'y': { comparsa: 'piazza' }, 'u': { comparsa: 'cimitero' }, 'x': { comparsa: 'taverna' }, 'j': { comparsa: 'spiaggia' },
    'J': { trappola: 'rogo' }, 'Q': { leva: 'rogo' }, 'T': { trappola: 'campana' }, 'L': { leva: 'campana' },
    'F': { personaggio: 'strega' }, 'D': { personaggio: 'mercante' },
    'I': { fuoco: 'coro' }, 'O': { fuoco: 'cimitero' }, 'U': { fuoco: 'spiaggia' },
    'c': { pezzo: 'corda' }, 'd': { pezzo: 'battaglio' }, 'f': { pezzo: 'perno' },
    'Z': { cripta: 'muro' }, 'H': { cripta: 'scala' }, 'P': { cripta: 'altare' }, 'n': { comparsa: 'cripta' }, '+': { comparsa: 'cripta' },
    '<': { porta: 'grata_ossario', scala: true }, '>': { porta: 'grata_grotta', scala: true }, '*': { fucina: 'forgia' },
    '7': { campanella: 'croce' }, '8': { campanella: 'teschio' }, '9': { campanella: 'ancora' }, '0': { campanella: 'luna' },
    'B': { indizio: 'campane' }, 'i': { teschio: 'piazza' }, 'l': { teschio: 'taverna' }, '!': { teschio: 'ossario' },
  },
  rows: trimmed,
};
const liste = { scheletri: Object.entries(SCHELETRI).map(([id, [x, z]]) => ({ id, x, z })), sangue: SANGUE };
fs.writeFileSync(OUT, JSON.stringify(out, null, 0).replace('"rows":[', '"rows":[\n').replace(/","/g, '",\n"').replace(/"\]\}$/, '"\n],\n')
  + Object.entries(liste).map(([k, l]) => `"${k}":[\n${l.map((x) => JSON.stringify(x)).join(',\n')}\n]`).join(',\n') + '}\n');
const conta = (c) => rows.join('').split(c).length - 1;
console.log(`[templari] mappa ${W}×${H}: ${conta('W')} finestre, ${conta('z') + conta('y') + conta('u') + conta('x') + conta('j')} comparse, ${conta('C')} posti della cassa → ${path.relative(ROOT, OUT)}`);
if (process.argv.includes('--stampa')) console.log(trimmed.filter((r) => r.trim()).join('\n'));
