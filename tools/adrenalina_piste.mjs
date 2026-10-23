#!/usr/bin/env node
// Genera le piste dell'Isola dell'Adrenalina (docs/ADRENALINA.md §7, CONTRACTS §42) e le scrive in
// packages/content/src/adrenalina/piste/<id>.json, che la sim legge (packages/sim/src/adrenalina/pista.ts).
// Una pista si descrive per tratti (lunghezza, svolta, pendenza, larghezza): una tartaruga cammina in discesa e lascia un punto ogni
// PASSO m. Porte, trampolini, ostacoli e zone si mettono in metri della tartaruga; lo strumento li riporta ai metri veri del nastro
// (lo costruisce con la stessa funzione della sim, `costruisciNastro`).
// Uso: node tools/adrenalina_piste.mjs [id…]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { costruisciNastro } from '../packages/sim/src/corse/nastro.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'packages/content/src/adrenalina/piste');
const r2 = (v) => Math.round(v * 100) / 100;
const PASSO = 10, RAD = Math.PI / 180;

/** Le piste dello snowboard: blu, rossa, nera, sempre più difficili, ognuna in tre parti per durata (~1 minuto in
 *  tutto): un quarto di porte su una pista che curva (le porte vicine e sfalsate, da prendere curvando), un tratto corto di salti senza
 *  porte (la cornice, il canalino coi salti di neve, il trampolino), più di metà nel bosco: il fuoripista, un sentiero stretto che serpeggia
 *  tra gli abeti (un abete cade sulla pista battuta, la deviazione è a sinistra). Dalla blu alla nera: più ripida, più veloce, più curve,
 *  porte più strette e più fitte, salti più alti, sentiero più stretto con più abeti in mezzo e qualche roccia. */
function discesa(q) {
  // tratti: [nome, metri, svolta in gradi (+ = destra), pendenza (m giù per m avanti), mezza carreggiata, netto (la pendenza cambia di colpo:
  // un bordo, da cui a velocità si vola)]
  const tratti = [
    ['partenza', 25, 0, 0.18, 8],
    // le porte: curve con raggi da 90 m in su (più strette il terreno a nastro si piegherebbe)
    ...q.porte.map(([m, gradi, p], i) => [i === 0 ? 'cresta' : i === 1 ? 'slalom' : '', m, gradi, p, q.largo]),
    // i salti: la cornice da cui ci si butta nel muro, il canalino stretto tra le rocce coi salti di neve (non si scansano), il trampolino
    ['cornice', 15, 0, 0.2, q.largo], ['muro', q.muro[0], 0, q.muro[1], q.largo, true], ['', 15, 6, q.muro[1] * 0.8, q.canale + 1.5],
    ['canalino', q.canalino / 2, 12, q.ripido, q.canale], ['', q.canalino / 2, -14, q.ripido, q.canale],
    ['abeti', 10, -4, q.ripido * 0.8, q.canale + 1],
    ['trampolino', 15, 0, 0.4, 8], ['', 8, 0, 0.2, 8], ['', q.atterra, 0, q.ripido, 8, true], ['', 10, 0, 0.42, 9],
    ['bosco', 10, 0, 0.36, 10],
    // il bosco: il sentiero che serpeggia tra gli abeti, curve strette una dopo l'altra (la parte più bella)
    // (curve alternate, la prima a sinistra: la deviazione al bivio; ampiezze tra `bosco.da` e `bosco.a` gradi, sparse ma fisse)
    ...Array.from({ length: q.bosco.n }, (_, i) => [i === 0 ? 'fuoripista' : '', q.bosco.m, (i % 2 ? 1 : -1) * (q.bosco.da + (q.bosco.a - q.bosco.da) * ((i * 0.618) % 1)), q.boscoP + (i % 2 ? 0.02 : 0), q.sentiero]),
    ['arrivo', 40, 0, 0.14, 12], ['', 45, 0, 0.03, 12],
  ];
  const zone = { partenza: 'La vetta', cresta: 'Le porte', slalom: 'Il giro della montagna', cornice: 'La cornice', muro: 'Il muro', canalino: 'Il canalino', abeti: 'Gli abeti', trampolino: 'Il trampolino', bosco: 'Il bosco', fuoripista: 'Fuoripista', arrivo: 'Arrivo' };
  // ---- la tartaruga: un punto ogni PASSO m; la pendenza passa dolce da un tratto all'altro (in 20 m), di colpo se il tratto è netto ----
  let x = 0, y = 0, z = 0, a = -90 * RAD, d = 0, pend = tratti[0][3];
  const punti = [{ p: [0, 0, 0], l: tratti[0][4] }], inizi = {}, dove = {};
  for (const [nome, m, gradi, p, l, netto] of tratti) {
    if (nome && inizi[nome] === undefined) { inizi[nome] = d; dove[nome] = { x, y, z }; }
    const n = Math.round(m / PASSO), p0 = pend, l0 = punti[punti.length - 1].l;
    for (let i = 1; i <= n; i++) {
      const k = netto ? 1 : Math.min(1, i / Math.min(n, 2));
      pend = p0 + (p - p0) * k;
      a += (gradi * RAD) / n;
      x += Math.cos(a) * PASSO; z += Math.sin(a) * PASSO; y -= pend * PASSO; d += PASSO;
      punti.push({ p: [r2(x), r2(y), r2(z)], l: r2(l0 + (l - l0) * Math.min(1, i / 2)) });
    }
  }
  const fine = d;
  const nastro = costruisciNastro(punti, { chiuso: false, passo: 1, larghezza: 10 });
  // metri della tartaruga → metri del nastro (il punto k sta a k·PASSO m della tartaruga)
  const S = (m) => { const f = m / PASSO, i = Math.min(Math.floor(f), punti.length - 2), t = f - i; return r2(nastro.sPunti[i] + (nastro.sPunti[i + 1] - nastro.sPunti[i]) * t); };
  const z0 = (id) => inizi[id];
  // ---- porte: tutte nel primo tratto, vicine e sfalsate (da prendere curvando, non scendendo dritti) ----
  const porte = [];
  const porta = (m, lat, w) => porte.push({ s: S(m), lat, w, colore: porte.length % 2 ? 'blu' : 'rosso' });
  for (let m = z0('cresta') + 15, k = 0; m < z0('cornice') - 10; m += q.passoPorte, k++) porta(m, k % 2 ? q.latPorte : -q.latPorte, q.largoPorte);
  // ---- trampolini: i salti di neve del canalino (larghi quanto lui) e il trampolino battuto prima del bosco ----
  const nSalti = q.salti.length, rampe = [
    // il primo 25 m dentro il canalino (quando si è già stretto), l'ultimo 8 m prima della fine
    ...q.salti.map((alto, i) => ({ s: S(z0('canalino') + 25 + ((q.canalino - 33) * i) / Math.max(1, nSalti - 1)), lungo: 7, alto, salto: r2(4 + alto * 0.6), lat: [-q.canale, q.canale] })),
    { s: S(z0('trampolino') + 23), lungo: 10, alto: q.trampolino[0], salto: q.trampolino[1], lat: [-5, 5], grande: true },
  ];
  // ---- ostacoli: rocce tra i salti del canalino, qualche roccia fuori dal bordo delle porte da rasentare, abeti e rocce nel bosco ----
  const ostacoli = [];
  let seme = q.seme;
  const caso = () => { seme = (seme * 1103515245 + 12345) % 2147483648; return seme / 2147483648; };
  for (let i = 0; i < q.rocceCanale; i++) ostacoli.push({ s: S(z0('canalino') + (q.canalino * (i + 1.1)) / (q.rocceCanale + 0.8)), lat: r2((i % 2 ? -1 : 1) * (q.canale - 2)), r: 0.8, tipo: 'roccia' });
  const lungoP = z0('cornice') - z0('cresta');
  for (let m = 40, k = 0; m < lungoP - 20; m += 70, k++) ostacoli.push({ s: S(z0('cresta') + m), lat: r2((k % 2 ? -1 : 1) * (q.largo + 2 + caso() * 4)), r: 1.0, tipo: 'roccia' });
  const lungoF = z0('arrivo') - z0('fuoripista');
  for (let m = 25, k = 0; m < lungoF - 15; m += 11 + Math.round(caso() * 5), k++) ostacoli.push({ s: S(z0('fuoripista') + m), lat: r2((k % 2 ? 1 : -1) * (q.sentiero + 1.1 + caso() * 1.2)), r: 0.7, tipo: 'abete' });
  for (let m = 70, k = 0; m < lungoF - 30; m += q.passoMezzo, k++) ostacoli.push({ s: S(z0('fuoripista') + m), lat: r2((k % 2 ? 1 : -1) * q.sentiero * 0.45), r: 0.6, tipo: k % 3 === 2 && q.rocceBosco ? 'roccia' : 'abete' });
  ostacoli.sort((p, o) => p.s - o.s);
  // la pista battuta chiusa: un pezzo dritto dopo il bivio (70 m, nella direzione in cui si arrivava), con l'abete caduto di traverso
  const A = dove['fuoripista'], fin = punti[Math.round(z0('fuoripista') / PASSO)], pre = punti[Math.round(z0('fuoripista') / PASSO) - 1];
  const ux = fin.p[0] - pre.p[0], uz = fin.p[2] - pre.p[2], ul = Math.hypot(ux, uz), dy = fin.p[1] - pre.p[1];
  const B = { x: A.x + (ux / ul) * 70, y: A.y + (dy / ul) * 70, z: A.z + (uz / ul) * 70 }, lx = B.x - A.x, lz = B.z - A.z, L = Math.hypot(lx, lz);
  const chiusa = [];
  for (let k = 0; k <= Math.ceil(L / PASSO); k++) { const t = Math.min(1, (k * PASSO) / L); chiusa.push([r2(A.x + lx * t), r2(A.y + (B.y - A.y) * t), r2(A.z + lz * t)]); }
  return {
    id: q.id, nome: q.nome, gioco: 'snowboard', colore: q.colore, versione: 1, passo: 1, larghezza: 10, neve: 10,
    punti, partenza: 6, arrivo: S(fine - 40),
    porte, rampe, ostacoli,
    gole: [{ da: S(z0('canalino') + 5), a: S(z0('canalino') + q.canalino - 5) }],
    fuoripista: { da: S(z0('fuoripista')), a: S(z0('arrivo')), neve: 2.5, v: q.vBosco, chiusa: { punti: chiusa, l: 12, tronco: 8 } },
    zone: Object.entries(zone).map(([id, nome], i, all) => ({ id, nome, da: S(inizi[id]), a: i + 1 < all.length ? S(inizi[all[i + 1][0]]) : r2(nastro.len) })),
  };
}

// le tre schede (~1 minuto ciascuna col pilota automatico: un quarto di porte, un quinto di salti, il resto nel bosco).
// porte = [metri, svolta, pendenza] per tratto; bosco = n curve da m metri, ampiezze tra da e a gradi
const BLU = {
  id: 'snowboard_blu', nome: 'Blu', colore: 'blu', seme: 12345, largo: 9,
  porte: [[45, -35, 0.44], [55, 40, 0.46], [70, -50, 0.47]], passoPorte: 24, latPorte: 3, largoPorte: 5.5,
  muro: [20, 0.6], canale: 6, canalino: 55, ripido: 0.52, salti: [1.0, 1.15], rocceCanale: 0, trampolino: [1.6, 9], atterra: 35,
  boscoP: 0.32, sentiero: 4.2, vBosco: 17, passoMezzo: 90, rocceBosco: false, bosco: { n: 15, m: 32, da: 25, a: 45 },
};
const ROSSA = {
  id: 'snowboard_rossa', nome: 'Rossa', colore: 'rossa', seme: 777, largo: 8.5,
  porte: [[42, -40, 0.54], [60, 45, 0.57], [85, -65, 0.58]], passoPorte: 19, latPorte: 3.4, largoPorte: 4.6,
  muro: [25, 0.75], canale: 5.5, canalino: 56, ripido: 0.6, salti: [1.1, 1.3, 1.5], rocceCanale: 2, trampolino: [2.0, 11], atterra: 65,
  boscoP: 0.36, sentiero: 3.6, vBosco: 18.5, passoMezzo: 55, rocceBosco: false, bosco: { n: 16, m: 30, da: 35, a: 60 },
};
const NERA = {
  id: 'snowboard_nera', nome: 'Nera', colore: 'nera', seme: 4242, largo: 8,
  porte: [[40, -35, 0.62], [70, 50, 0.66], [70, -45, 0.68]], passoPorte: 19, latPorte: 3.0, largoPorte: 3.9,
  muro: [25, 0.92], canale: 4.8, canalino: 60, ripido: 0.7, salti: [1.3, 1.5, 1.7], rocceCanale: 3, trampolino: [2.3, 11], atterra: 75,
  boscoP: 0.4, sentiero: 3.1, vBosco: 20, passoMezzo: 36, rocceBosco: true, bosco: { n: 18, m: 27, da: 45, a: 70 },
};

const PISTE = { snowboard_blu: () => discesa(BLU), snowboard_rossa: () => discesa(ROSSA), snowboard_nera: () => discesa(NERA) };
const chi = process.argv.slice(2).filter((a) => !a.startsWith('--'));
fs.mkdirSync(OUT, { recursive: true });
for (const id of chi.length ? chi : Object.keys(PISTE)) {
  const fa = PISTE[id];
  if (!fa) { console.error(`pista sconosciuta: ${id}`); process.exit(1); }
  const p = fa();
  fs.writeFileSync(path.join(OUT, `${id}.json`), JSON.stringify(p) + '\n');
  const n = costruisciNastro(p.punti, { chiuso: false, passo: p.passo, larghezza: p.larghezza });
  console.log(`${id}: ${n.len.toFixed(0)} m, dislivello ${(p.punti[0].p[1] - p.punti[p.punti.length - 1].p[1]).toFixed(0)} m, ${p.porte.length} porte, ${p.rampe.length} trampolini, ${p.ostacoli.length} ostacoli`);
}
