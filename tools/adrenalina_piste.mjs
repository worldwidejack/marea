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

/** Pista verde dello snowboard: una discesa vera da una montagna (birbasan, 12 ott 2026, dopo i video di freeride su YouTube), col tratto
 *  di mezzo corto, stretto e con dei salti fatti di neve (largo e lungo era noioso: sembrava in piano e non c'era niente da fare). Dalla vetta: la cresta, la pista battuta con lo slalom (porte più distanti), la cornice da cui ci si
 *  butta nel muro, il canalino stretto tra le rocce con tre salti di neve, gli abeti a filo della pista, il trampolino, il bosco col
 *  fuoripista (un abete cade sulla pista e si scende tra gli alberi), l'arrivo. */
function snowboardVerde() {
  // tratti: [nome, metri, svolta in gradi (+ = destra), pendenza (m giù per m avanti), mezza carreggiata, netto (la pendenza cambia di colpo:
  // un bordo, da cui a velocità si vola)]
  const tratti = [
    ['partenza', 30, 0, 0.12, 8],
    ['cresta', 75, -8, 0.26, 9], ['', 75, 6, 0.3, 9],
    ['slalom', 150, 12, 0.36, 11], ['', 150, -14, 0.4, 11],
    ['cornice', 20, 0, 0.18, 9], ['muro', 40, 0, 0.8, 9, true], ['', 20, 6, 0.62, 7],
    // il canalino: stretto tra le rocce e ripido, tre salti di neve da una parete all'altra (non si scansano)
    ['canalino', 50, 14, 0.62, 5.5], ['', 60, -20, 0.64, 5.5], ['', 60, 12, 0.6, 5.5],
    ['abeti', 50, -6, 0.5, 6.5],
    ['trampolino', 25, 0, 0.4, 8], ['', 12, 0, 0.2, 8], ['', 55, 0, 0.62, 8, true], ['', 15, 0, 0.42, 9],
    ['bosco', 40, 0, 0.34, 12],
    // il fuoripista (birbasan, 12 ott): una S a sinistra, il sentiero che serpeggia, una S a destra. Svolte simmetriche: si rientra sulla
    // stessa retta della pista battuta, che resta lì chiusa dall'abete caduto
    ['fuoripista', 30, -40, 0.33, 3.5], ['', 30, 40, 0.34, 3.5], ['', 30, -30, 0.32, 3.5], ['', 60, 60, 0.36, 3.5], ['', 30, -30, 0.32, 3.5],
    ['', 30, 40, 0.34, 3.5], ['', 30, -40, 0.3, 3.5],
    ['arrivo', 50, 0, 0.14, 14], ['', 60, 0, 0.03, 14],
  ];
  const zone = { partenza: 'La vetta', cresta: 'La cresta', slalom: 'Lo slalom', cornice: 'La cornice', muro: 'Il muro', canalino: 'Il canalino', abeti: 'Gli abeti', trampolino: 'Il trampolino', bosco: 'Il bosco', fuoripista: 'Fuoripista', arrivo: 'Arrivo' };
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
  // ---- porte (solo dove c'è la pista battuta): 2 sulla cresta, 6 nello slalom (a 45 m l'una dall'altra), 1 prima del trampolino ----
  const porte = [];
  const porta = (m, lat, w) => porte.push({ s: S(m), lat, w, colore: porte.length % 2 ? 'blu' : 'rosso' });
  porta(z0('cresta') + 50, -2.5, 6); porta(z0('cresta') + 110, 2.5, 6);
  for (let k = 0; k < 6; k++) porta(z0('slalom') + 25 + k * 45, k % 2 ? 4.5 : -4.5, 5.5);
  porta(z0('trampolino') + 14, 0, 7);
  // ---- trampolini: i tre salti di neve del canalino (larghi quanto lui) e il trampolino battuto prima del bosco ----
  const rampe = [
    ...[35, 90, 145].map((m, i) => ({ s: S(z0('canalino') + m), lungo: 7, alto: r2(1.1 + i * 0.15), salto: 4.5 + i * 0.5, lat: [-5.5, 5.5] })),
    { s: S(z0('trampolino') + 37), lungo: 10, alto: 2.0, salto: 11, lat: [-5, 5], grande: true },
  ];
  // ---- ostacoli: due rocce tra i salti del canalino, qualche roccia fuori dal bordo dello slalom da rasentare ----
  const ostacoli = [];
  for (const [m, lat, r] of [[62, 3.3, 0.8], [118, -3.3, 0.8]]) ostacoli.push({ s: S(z0('canalino') + m), lat, r, tipo: 'roccia' });
  let seme = 12345;
  const caso = () => { seme = (seme * 1103515245 + 12345) % 2147483648; return seme / 2147483648; };
  for (const [m, lato] of [[45, 1], [100, -1], [155, 1], [210, -1], [265, 1]]) ostacoli.push({ s: S(z0('slalom') + m), lat: r2(lato * (11 + 2 + caso() * 4)), r: 1.0, tipo: 'roccia' });
  // nel fuoripista: abeti fitti a filo del sentiero (da rasentare) e due in mezzo da scansare
  const lungoF = z0('arrivo') - z0('fuoripista');
  for (let m = 25, k = 0; m < lungoF - 15; m += 11 + Math.round(caso() * 5), k++) ostacoli.push({ s: S(z0('fuoripista') + m), lat: r2((k % 2 ? 1 : -1) * (4.6 + caso() * 1.2)), r: 0.7, tipo: 'abete' });
  for (const [m, lat] of [[95, 1.6], [150, -1.6]]) ostacoli.push({ s: S(z0('fuoripista') + m), lat, r: 0.6, tipo: 'abete' });
  ostacoli.sort((p, q) => p.s - q.s);
  // la pista battuta chiusa: dritta dal bivio al rientro, con l'abete caduto di traverso poco dopo il bivio
  const A = dove['fuoripista'], B = dove['arrivo'], lx = B.x - A.x, lz = B.z - A.z, L = Math.hypot(lx, lz);
  const chiusa = [];
  for (let k = 0; k <= Math.ceil(L / PASSO); k++) { const t = Math.min(1, (k * PASSO) / L); chiusa.push([r2(A.x + lx * t), r2(A.y + (B.y - A.y) * t), r2(A.z + lz * t)]); }
  return {
    // versione 2: il tratto di mezzo corto, i salti di neve, le porte più distanti
    id: 'snowboard_verde', nome: 'Verde', gioco: 'snowboard', colore: 'verde', versione: 2, passo: 1, larghezza: 10, neve: 10,
    punti, partenza: 6, arrivo: S(fine - 50),
    porte, rampe, ostacoli,
    gole: [{ da: S(z0('canalino') + 5), a: S(z0('canalino') + 165) }],
    fuoripista: { da: S(z0('fuoripista')), a: S(z0('arrivo')), neve: 2.5, chiusa: { punti: chiusa, l: 12, tronco: 8 } },
    zone: Object.entries(zone).map(([id, nome], i, all) => ({ id, nome, da: S(inizi[id]), a: i + 1 < all.length ? S(inizi[all[i + 1][0]]) : r2(nastro.len) })),
  };
}

const PISTE = { snowboard_verde: snowboardVerde };
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
