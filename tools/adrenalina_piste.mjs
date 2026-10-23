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

/** Pista verde dello snowboard: una discesa vera da una montagna (birbasan, 12 ott 2026, dopo i video di freeride su YouTube), in tre
 *  parti per durata: un quarto di porte su una pista che curva (a sinistra, a destra, poi un giro attorno alla montagna; le porte vicine e
 *  sfalsate, da prendere curvando), un quarto di salti senza porte (la cornice, il canalino coi tre salti di neve, il trampolino), metà nel
 *  bosco: il fuoripista, un sentiero stretto che serpeggia tra gli abeti (un abete cade sulla pista battuta e ci si butta dentro). */
function snowboardVerde() {
  // tratti: [nome, metri, svolta in gradi (+ = destra), pendenza (m giù per m avanti), mezza carreggiata, netto (la pendenza cambia di colpo:
  // un bordo, da cui a velocità si vola)]
  const tratti = [
    ['partenza', 25, 0, 0.15, 8],
    // le porte: la pista curva a sinistra, a destra, poi gira attorno alla montagna (raggi da 100 m in su: il terreno a nastro non si piega)
    ['cresta', 70, -40, 0.5, 9],
    ['slalom', 90, 50, 0.54, 9], ['', 140, -80, 0.56, 9], ['', 20, 10, 0.5, 9],
    // i salti: la cornice da cui ci si butta nel muro, il canalino stretto tra le rocce coi tre salti di neve (non si scansano), il trampolino
    ['cornice', 20, 0, 0.18, 9], ['muro', 40, 0, 0.8, 9, true], ['', 20, 6, 0.62, 7],
    ['canalino', 50, 14, 0.62, 5.5], ['', 60, -20, 0.64, 5.5], ['', 60, 12, 0.6, 5.5],
    ['abeti', 30, -6, 0.5, 6.5],
    ['trampolino', 25, 0, 0.4, 8], ['', 12, 0, 0.2, 8], ['', 55, 0, 0.62, 8, true], ['', 15, 0, 0.42, 9],
    ['bosco', 20, 0, 0.36, 12],
    // il bosco: il sentiero che serpeggia tra gli abeti, curve strette una dopo l'altra (la parte più bella, birbasan: metà della discesa)
    ['fuoripista', 30, -40, 0.34, 3.5], ['', 30, 45, 0.36, 3.5], ['', 35, -55, 0.36, 3.5], ['', 30, 50, 0.38, 3.5], ['', 40, -30, 0.36, 3.5],
    ['', 30, 60, 0.38, 3.5], ['', 30, -50, 0.36, 3.5], ['', 35, 40, 0.38, 3.5], ['', 40, -60, 0.36, 3.5], ['', 30, 45, 0.38, 3.5],
    ['', 35, -35, 0.36, 3.5], ['', 30, 55, 0.38, 3.5], ['', 40, -45, 0.36, 3.5], ['', 30, 35, 0.38, 3.5], ['', 35, -50, 0.36, 3.5],
    ['', 30, 40, 0.36, 3.5], ['', 35, -45, 0.38, 3.5], ['', 30, 50, 0.36, 3.5], ['', 35, -40, 0.38, 3.5], ['', 30, 30, 0.36, 3.5],
    ['', 30, -20, 0.34, 3.5],
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
  // ---- porte: tutte nel primo quarto, a 24 m l'una dall'altra e sfalsate (da prendere curvando, non scendendo dritti) ----
  const porte = [];
  const porta = (m, lat, w) => porte.push({ s: S(m), lat, w, colore: porte.length % 2 ? 'blu' : 'rosso' });
  for (let m = z0('cresta') + 18, k = 0; m < z0('cornice') - 12; m += 24, k++) porta(m, k % 2 ? 4 : -4, 4.5);
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
  for (const [m, lato] of [[40, 1], [110, -1], [180, 1], [250, -1], [320, 1]]) ostacoli.push({ s: S(z0('cresta') + m), lat: r2(lato * (9 + 2 + caso() * 4)), r: 1.0, tipo: 'roccia' });
  // nel bosco: abeti fitti a filo del sentiero (da rasentare) e, ogni tanto, uno in mezzo da scansare
  const lungoF = z0('arrivo') - z0('fuoripista');
  for (let m = 25, k = 0; m < lungoF - 15; m += 11 + Math.round(caso() * 5), k++) ostacoli.push({ s: S(z0('fuoripista') + m), lat: r2((k % 2 ? 1 : -1) * (4.6 + caso() * 1.2)), r: 0.7, tipo: 'abete' });
  for (let m = 80, k = 0; m < lungoF - 40; m += 55, k++) ostacoli.push({ s: S(z0('fuoripista') + m), lat: k % 2 ? 1.6 : -1.6, r: 0.6, tipo: 'abete' });
  ostacoli.sort((p, q) => p.s - q.s);
  // la pista battuta chiusa: un pezzo dritto dopo il bivio (70 m, nella direzione in cui si arrivava), con l'abete caduto di traverso
  const A = dove['fuoripista'], fin = punti[Math.round(z0('fuoripista') / PASSO)], pre = punti[Math.round(z0('fuoripista') / PASSO) - 1];
  const ux = fin.p[0] - pre.p[0], uz = fin.p[2] - pre.p[2], ul = Math.hypot(ux, uz), dy = fin.p[1] - pre.p[1];
  const B = { x: A.x + (ux / ul) * 70, y: A.y + (dy / ul) * 70, z: A.z + (uz / ul) * 70 }, lx = B.x - A.x, lz = B.z - A.z, L = Math.hypot(lx, lz);
  const chiusa = [];
  for (let k = 0; k <= Math.ceil(L / PASSO); k++) { const t = Math.min(1, (k * PASSO) / L); chiusa.push([r2(A.x + lx * t), r2(A.y + (B.y - A.y) * t), r2(A.z + lz * t)]); }
  return {
    // versione 3: un quarto di porte in curva, un quarto di salti, metà nel bosco
    id: 'snowboard_verde', nome: 'Verde', gioco: 'snowboard', colore: 'verde', versione: 3, passo: 1, larghezza: 10, neve: 10,
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
