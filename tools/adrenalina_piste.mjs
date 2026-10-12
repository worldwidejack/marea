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

/** Pista verde dello snowboard (bozza del 12 ott 2026): ~1,5 km, ~20 porte, 3 trampolini; prima dell'arrivo un abete cade sulla pista
 *  e si gira nel fuoripista tra gli alberi (birbasan, 12 ott), poi si rientra e si arriva. */
function snowboardVerde() {
  // tratti: [metri, svolta in gradi (+ = destra), pendenza (m giù per m avanti), mezza carreggiata]
  const tratti = [
    ['partenza', 30, 0, 0.1, 9],
    ['pendio', 120, 24, 0.17, 15], ['pendio', 110, -30, 0.18, 15],
    ['slalom', 140, -8, 0.16, 11], ['slalom', 140, 10, 0.16, 11],
    ['trampolini', 50, 0, 0.15, 11], ['', 10, 0, 0.08, 11], ['', 30, 0, 0.32, 11], ['', 55, 6, 0.14, 11],
    ['', 10, 0, 0.08, 11], ['', 30, 0, 0.32, 11], ['', 35, -6, 0.15, 11],
    ['gola', 30, 0, 0.17, 7], ['', 60, 35, 0.18, 6], ['', 60, -38, 0.18, 6], ['', 20, 0, 0.17, 7],
    ['abeti', 170, -14, 0.16, 14],
    ['trampolino', 45, 0, 0.15, 12], ['', 12, 0, 0.07, 12], ['', 45, 0, 0.36, 12], ['', 20, 0, 0.18, 12],
    ['bosco', 40, 0, 0.15, 12],
    // il fuoripista (birbasan, 12 ott): una S a sinistra, il sentiero che serpeggia, una S a destra. Svolte simmetriche: si rientra sulla
    // stessa retta della pista battuta, che resta lì chiusa dall'abete caduto
    ['fuoripista', 30, -40, 0.15, 3.5], ['', 30, 40, 0.15, 3.5], ['', 30, -30, 0.14, 3.5], ['', 60, 60, 0.16, 3.5], ['', 30, -30, 0.14, 3.5],
    ['', 30, 40, 0.15, 3.5], ['', 30, -40, 0.15, 3.5],
    ['arrivo', 50, 0, 0.06, 14], ['', 50, 0, 0.02, 14],
  ];
  const zone = { partenza: 'Partenza', pendio: 'Il pendio largo', slalom: 'Lo slalom', trampolini: 'I due trampolini', gola: 'La gola', abeti: 'Gli abeti', trampolino: 'Il trampolino grande', bosco: 'Il bosco', fuoripista: 'Fuoripista', arrivo: 'Arrivo' };
  // ---- la tartaruga: un punto ogni PASSO m, la pendenza passa dolce da un tratto all'altro ----
  let x = 0, y = 0, z = 0, a = -90 * RAD, d = 0, pend = tratti[0][3];
  const punti = [{ p: [0, 0, 0], l: tratti[0][4] }], inizi = {}, dove = {};
  for (const [nome, m, gradi, p, l] of tratti) {
    if (nome && inizi[nome] === undefined) { inizi[nome] = d; dove[nome] = { x, y, z }; }
    const n = Math.round(m / PASSO), p0 = pend, l0 = punti[punti.length - 1].l;
    for (let i = 1; i <= n; i++) {
      const k = Math.min(1, i / Math.min(n, 2));
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
  // ---- porte: 3 sul pendio, 8 nello slalom, 2 tra i trampolini, 2 nella gola, 4 tra gli abeti, 1 prima del trampolino grande ----
  const porte = [];
  const porta = (m, lat, w) => porte.push({ s: S(m), lat, w, colore: porte.length % 2 ? 'blu' : 'rosso' });
  porta(z0('pendio') + 60, -3, 7); porta(z0('pendio') + 125, 3, 7); porta(z0('pendio') + 190, 0, 7);
  for (let k = 0; k < 8; k++) porta(z0('slalom') + 20 + k * 32, k % 2 ? 3.5 : -3.5, 5);
  porta(z0('trampolini') + 125, 2.5, 6); porta(z0('trampolini') + 205, -2, 6);
  porta(z0('gola') + 65, 0.8, 4.6); porta(z0('gola') + 125, -0.8, 4.6);
  for (const [m, lat] of [[25, 0], [85, 3], [145, -3]]) porta(z0('abeti') + m, lat, 6);
  porta(z0('trampolino') + 18, 0, 8);
  // ---- trampolini: il bordo alla fine del tratto piatto, poi l'atterraggio ripido ----
  const rampe = [
    { s: S(z0('trampolini') + 60), lungo: 9, alto: 1.3, salto: 8.5, lat: [-4, 4] },
    { s: S(z0('trampolini') + 155), lungo: 9, alto: 1.3, salto: 8.5, lat: [-4, 4] },
    { s: S(z0('trampolino') + 57), lungo: 13, alto: 2.3, salto: 11.5, lat: [-5, 5], grande: true },
  ];
  // ---- ostacoli: rocce nella gola, abeti radi in pista, qualche abete nella neve fresca dove rasentarli ----
  const ostacoli = [];
  for (const [m, lat, r] of [[40, 3.2, 1.1], [95, -2.6, 1.0], [150, 2.4, 0.9]]) ostacoli.push({ s: S(z0('gola') + m), lat, r, tipo: 'roccia' });
  let seme = 12345;
  const caso = () => { seme = (seme * 1103515245 + 12345) % 2147483648; return seme / 2147483648; };
  const libere = porte.map((p) => p.s);
  for (let m = 10; m < 165; m += 13 + Math.round(caso() * 6)) {
    const s = S(z0('abeti') + m);
    if (libere.some((q) => Math.abs(q - s) < 9)) continue;
    const lato = caso() < 0.5 ? -1 : 1;
    ostacoli.push({ s, lat: r2(lato * (2.5 + caso() * 8.5)), r: 0.8, tipo: 'abete' });
  }
  for (const [m, lato] of [[30, 1], [70, -1], [115, 1], [160, -1], [210, 1], [260, -1], [330, 1], [400, -1], [470, 1]]) {
    const s = S(z0('pendio') + m), l = 15;
    ostacoli.push({ s, lat: r2(lato * (l + 2 + caso() * 4)), r: 0.9, tipo: 'abete' });
  }
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
    id: 'snowboard_verde', nome: 'Verde', gioco: 'snowboard', colore: 'verde', passo: 1, larghezza: 10, neve: 8,
    punti, partenza: 6, arrivo: S(fine - 45),
    porte, rampe, ostacoli,
    gole: [{ da: S(z0('gola') + 8), a: S(z0('gola') + 160) }],
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
