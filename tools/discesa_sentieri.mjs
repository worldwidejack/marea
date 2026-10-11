#!/usr/bin/env node
// Genera i sentieri della discesa in mountain bike (banco provadiscesa3d.html, #229) da tools/discesa_sentieri/<id>.mjs e li scrive in
// packages/content/src/corse/discesa/sentieri/<id>.json, che la sim legge (packages/sim/src/corse/bici.ts).
// Come per le piste delle Corse (tools/corse_piste.mjs) una «tartaruga» lascia i punti del centro mentre cammina (dritto, curva, con
// `sali` = dislivello del tratto) e segna le cose lungo il sentiero: zone (cresta/bosco), lati, radici, rampe e tronchi. I sassi e i
// ceppi sul sentiero li mette lo strumento, a caso ma sempre uguali (seme fisso), lontano dalle rampe e dai tornanti.
// Uso: node tools/discesa_sentieri.mjs [id…]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { costruisciNastro } from '../packages/sim/src/corse/nastro.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(ROOT, 'tools/discesa_sentieri');
const OUT = path.join(ROOT, 'packages/content/src/corse/discesa/sentieri');
const r3 = (v) => Math.round(v * 1000) / 1000;
const RAD = Math.PI / 180;

class Tartaruga {
  constructor(meta) {
    this.meta = meta;
    [this.x, this.y, this.z] = meta.da; this.a = (meta.dir ?? 0) * RAD;
    this.passo = 4; this.punti = []; this.segni = { zone: [], lati: [], radici: [], rampe: [] };
    this.zona = null; this.metti();
  }
  metti() { this.punti.push({ p: [r3(this.x), r3(this.y), r3(this.z)] }); }
  qui(o = 0) { return { i: this.punti.length - 1, o }; }
  dritto(m, o = {}) {
    const n = Math.max(1, Math.round(m / this.passo)), sali = o.sali ?? 0, da = this.qui();
    for (let i = 0; i < n; i++) { this.x += (Math.cos(this.a) * m) / n; this.z += (Math.sin(this.a) * m) / n; this.y += sali / n; this.metti(); }
    if (o.radici) this.segni.radici.push({ da, a: this.qui() });
    return this;
  }
  /** Curva di `gradi` (+ = a destra) su un raggio di `raggio` m. */
  curva(gradi, raggio, o = {}) {
    const ang = gradi * RAD, lato = Math.sign(gradi) || 1, n = Math.max(2, Math.round((Math.abs(ang) * raggio) / this.passo)), sali = o.sali ?? 0;
    const rx = -Math.sin(this.a), rz = Math.cos(this.a), cx = this.x + rx * lato * raggio, cz = this.z + rz * lato * raggio;
    for (let i = 0; i < n; i++) {
      this.a += ang / n;
      const qx = -Math.sin(this.a), qz = Math.cos(this.a);
      this.x = cx - qx * lato * raggio; this.z = cz - qz * lato * raggio; this.y += sali / n; this.metti();
    }
    return this;
  }
  /** Rampa di terra o tronco qui (`salto` = spinta minima in su, m/s). */
  rampa(salto, tipo = 'rampa') { this.segni.rampe.push({ m: this.qui(), salto, tipo }); return this; }
  /** Da qui comincia una zona nuova (cresta o bosco) con i suoi lati: `sx`/`dx` = dirupo, bosco o prato. */
  inizia(tipo, sx, dx) {
    this.chiudi();
    this.zona = { tipo, sx, dx, da: this.qui() };
    return this;
  }
  chiudi() {
    if (!this.zona) return;
    const a = this.qui(), z = this.zona;
    this.segni.zone.push({ tipo: z.tipo, da: z.da, a });
    this.segni.lati.push({ lato: -1, tipo: z.sx, da: z.da, a }, { lato: 1, tipo: z.dx, da: z.da, a });
    this.zona = null;
  }
}

/** Numeri a caso ma sempre uguali (mulberry32). */
function rng(seme) {
  let t = seme >>> 0;
  return () => { t = (t + 0x6d2b79f5) >>> 0; let r = Math.imul(t ^ (t >>> 15), 1 | t); r ^= r + Math.imul(r ^ (r >>> 7), 61 | r); return ((r ^ (r >>> 14)) >>> 0) / 4294967296; };
}

function definizione(t) {
  t.chiudi();
  const m = t.meta, n = costruisciNastro(t.punti, { chiuso: false, passo: 1, larghezza: m.larghezza });
  const S = (seg) => r3(n.sPunti[seg.i] + seg.o), T = (x) => ({ da: S(x.da), a: S(x.a) });
  const zone = t.segni.zone.map((z) => ({ tipo: z.tipo, ...T(z) }));
  const rampe = t.segni.rampe.map((r) => ({ s: S(r.m), salto: r.salto, tipo: r.tipo }));
  const radici = t.segni.radici.map(T);
  const arrivo = r3(n.len - 8);
  // sassi e ceppi sul sentiero: uno ogni `ogni` m (a caso ±40 %), non a meno di 14 m da una rampa, non nei tornanti, non nei primi 40 m
  const ostacoli = [], caso = rng(m.seme ?? 7);
  for (const z of zone) {
    const ogni = z.tipo === 'cresta' ? m.sassiCresta : m.sassiBosco;
    for (let s = Math.max(40, z.da + ogni * 0.5); s < Math.min(z.a, arrivo - 20); s += ogni * (0.6 + caso() * 0.8)) {
      const k = Math.abs(n.k[Math.round(s)] ?? 0);
      if (k > 1 / 30 || rampe.some((r) => s - r.s > -10 && s - r.s < 28) || radici.some((r) => s > r.da - 4 && s < r.a + 4)) continue;
      const lato = caso() < 0.5 ? -1 : 1, tipo = z.tipo === 'bosco' && caso() < 0.4 ? 'ceppo' : 'sasso';
      const r = tipo === 'ceppo' ? 0.32 : 0.3 + caso() * 0.18;
      ostacoli.push({ s: r3(s), lat: r3(lato * (0.15 + caso() * Math.max(0.1, m.larghezza - 0.35))), r: r3(r), alto: tipo === 'ceppo' ? 0.45 : r3(r * 1.2), tipo });
    }
  }
  return {
    id: m.id, nome: m.nome, passo: 1, larghezza: m.larghezza, bordo: m.bordo, punti: t.punti, zone,
    lati: t.segni.lati.map((l) => ({ lato: l.lato, tipo: l.tipo, ...T(l) })), ostacoli, radici, rampe, arrivo,
  };
}

const ids = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.mjs') && (!ids.length || ids.includes(f.replace('.mjs', ''))));
fs.mkdirSync(OUT, { recursive: true });
for (const f of files) {
  const mod = await import(pathToFileURL(path.join(DIR, f)).href);
  const t = new Tartaruga(mod.meta);
  mod.default(t);
  const def = definizione(t);
  fs.writeFileSync(path.join(OUT, def.id + '.json'), JSON.stringify(def) + '\n');
  const n = costruisciNastro(def.punti, { chiuso: false, passo: 1, larghezza: def.larghezza });
  console.log(`[discesa] ${def.id}: ${Math.round(n.len)} m, dislivello ${Math.round(n.y[0] - n.y[n.n - 1])} m, zone ${def.zone.map((z) => `${z.tipo} ${Math.round(z.da)}-${Math.round(z.a)}`).join(', ')}, ${def.ostacoli.length} ostacoli, ${def.rampe.length} rampe, ${def.radici.length} tratti di radici`);
}
