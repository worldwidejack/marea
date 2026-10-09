#!/usr/bin/env node
// Genera le piste del motore v2 dell'Isola delle Corse (docs/CORSE.md A11) da tools/corse_piste/<id>.mjs e le scrive come JSON in
// packages/content/src/corse/piste/<id>.json, che la sim legge (packages/sim/src/corse/pista.ts).
// Ogni pista si descrive con una «tartaruga» che lascia i punti del centro mentre cammina. Le mosse:
// - dritto, curva, giro della morte, salto, chiudi (torna al via), raggiungi;
// - i tratti di superficie, i bordi senza muro, gli eventi, i tappeti del turbo e i rami.
// I metri dei tratti sono quelli veri del nastro: lo strumento lo costruisce con la stessa funzione della sim.
// Uso: node tools/corse_piste.mjs [id…] [--planimetria]   (--planimetria disegna la pista vista dall'alto in tests/out/piste/<id>.png)
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { costruisciNastro } from '../packages/sim/src/corse/nastro.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(ROOT, 'tools/corse_piste');
const OUT = path.join(ROOT, 'packages/content/src/corse/piste');
const PLAN = path.join(ROOT, 'tests/out/piste');
const r3 = (v) => Math.round(v * 1000) / 1000;
const RAD = Math.PI / 180;

/** La tartaruga: posizione, direzione (`a`, rad: 0 = +x, cresce girando a destra), mezza carreggiata; lascia un punto ogni ~5 m. */
export class Tartaruga {
  constructor(meta, da = null) {
    this.meta = meta;
    this.x = da?.x ?? meta.da?.[0] ?? 0; this.y = da?.y ?? meta.da?.[1] ?? 0; this.z = da?.z ?? meta.da?.[2] ?? 0;
    this.a = da?.a ?? (meta.dir ?? 0) * RAD;
    this.l = da?.l ?? meta.larghezza;
    this.passo = 5;
    this.punti = []; this.dir = [];
    this.tratti = { superfici: [], vuoti: [], senzaMuro: [], rampe: [], turbo: [], eventi: [] };
    this.rami = [];
    this.metti();
  }
  get f() { return [Math.cos(this.a), 0, Math.sin(this.a)]; }
  get r() { return [-Math.sin(this.a), 0, Math.cos(this.a)]; }
  metti(o = {}) {
    const pt = { p: [r3(this.x), r3(this.y), r3(this.z)] };
    if (this.l !== this.meta.larghezza) pt.l = r3(this.l);
    if (o.su) pt.su = o.su.map(r3);
    if (o.aderente) pt.aderente = true;
    this.punti.push(pt); this.dir.push(this.a);
  }
  /** Il segno di dove si è adesso (l'ultimo punto), con `o` metri in più. */
  qui(o = 0) { return { i: this.punti.length - 1, o }; }
  larghezza(l) { this.l = l; return this; }
  /** Punto messo a mano (x, y, z): la direzione è quella dal punto prima. */
  vai(p) {
    this.a = Math.atan2(p[2] - this.z, p[0] - this.x);
    this.x = p[0]; this.y = p[1]; this.z = p[2];
    this.metti();
    return this;
  }
  dritto(m, o = {}) {
    const n = Math.max(1, Math.round(m / this.passo)), [fx, , fz] = this.f, sali = o.sali ?? 0;
    for (let i = 0; i < n; i++) { this.x += (fx * m) / n; this.z += (fz * m) / n; this.y += sali / n; this.metti(); }
    return this;
  }
  /** Curva di `gradi` (+ = a destra) su un raggio di `raggio` m; `inc` = sopraelevazione in gradi verso l'interno; `sali` = dislivello. */
  curva(gradi, raggio, o = {}) {
    const ang = gradi * RAD, lato = Math.sign(gradi) || 1, n = Math.max(2, Math.round((Math.abs(ang) * raggio) / this.passo));
    const [rx, , rz] = this.r, cx = this.x + rx * lato * raggio, cz = this.z + rz * lato * raggio, sali = o.sali ?? 0, b = (o.inc ?? 0) * RAD;
    for (let i = 0; i < n; i++) {
      this.a += ang / n;
      const [qx, , qz] = this.r;
      this.x = cx - qx * lato * raggio; this.z = cz - qz * lato * raggio; this.y += sali / n;
      const fine = i === n - 1;
      this.metti(b && !fine ? { su: [qx * lato * Math.sin(b), Math.cos(b), qz * lato * Math.sin(b)] } : {});
    }
    return this;
  }
  /** Giro della morte di raggio `raggio`: si esce `sposta` m a destra (+) o a sinistra (−) di dove si è entrati. */
  giro(raggio, sposta = 7) {
    const [fx, , fz] = this.f, [rx, , rz] = this.r, x0 = this.x, y0 = this.y, z0 = this.z, n = 18;
    for (let i = 1; i <= n; i++) {
      const ph = (2 * Math.PI * i) / n, s = Math.sin(ph), c = Math.cos(ph), k = (sposta * i) / n;
      this.x = x0 + fx * raggio * s + rx * k; this.y = y0 + raggio * (1 - c); this.z = z0 + fz * raggio * s + rz * k;
      this.metti(i < n ? { su: [-fx * s, c, -fz * s], aderente: true } : {});
    }
    return this;
  }
  /** Salto: rampa qui, poi `lungo` m di vuoto (la pista continua dritta, `scende` m più in basso all'atterraggio). */
  salto(lungo, o = {}) {
    const p0 = this.qui();
    this.tratti.rampe.push({ m: p0, salto: o.salto ?? 8 });
    this.tratti.vuoti.push({ da: { i: p0.i, o: 2 }, a: { i: p0.i, o: 2 + lungo } });
    return this.dritto(lungo + 8, { sali: -(o.scende ?? 0) });
  }
  /** Torna morbida al punto `p` con la direzione `a` (rad), lasciando punti lungo una curva di Hermite. */
  raggiungi(p, a, o = {}) {
    const p0 = [this.x, this.y, this.z], d0 = this.f, d1 = [Math.cos(a), 0, Math.sin(a)];
    const dist = Math.hypot(p[0] - p0[0], p[2] - p0[2]), m = dist * (o.tensione ?? 1.1), n = Math.max(2, Math.round(dist / this.passo));
    const l0 = this.l, l1 = o.l ?? this.l;
    for (let i = 1; i < (o.ultimo ? n + 1 : n); i++) {
      const t = i / n, t2 = t * t, t3 = t2 * t, h00 = 2 * t3 - 3 * t2 + 1, h10 = t3 - 2 * t2 + t, h01 = -2 * t3 + 3 * t2, h11 = t3 - t2;
      const dh = 6 * t2 - 6 * t, dh10 = 3 * t2 - 4 * t + 1, dh01 = -6 * t2 + 6 * t, dh11 = 3 * t2 - 2 * t;
      this.x = h00 * p0[0] + h10 * m * d0[0] + h01 * p[0] + h11 * m * d1[0];
      this.z = h00 * p0[2] + h10 * m * d0[2] + h01 * p[2] + h11 * m * d1[2];
      this.y = p0[1] + (p[1] - p0[1]) * (3 * t2 - 2 * t3);
      const vx = dh * p0[0] + dh10 * m * d0[0] + dh01 * p[0] + dh11 * m * d1[0], vz = dh * p0[2] + dh10 * m * d0[2] + dh01 * p[2] + dh11 * m * d1[2];
      this.a = Math.atan2(vz, vx);
      this.l = l0 + (l1 - l0) * t;
      this.metti();
    }
    return this;
  }
  /** Chiude il circuito: torna al primo punto con la direzione di partenza. */
  chiudi() { const p = this.punti[0].p; return this.raggiungi(p, this.dir[0]); }
  // ---- tratti (da e a sono segni presi con qui()) ----
  superficie(tipo, da, a, lat) { this.tratti.superfici.push({ tipo, da, a, lat }); return this; }
  /** Una superficie su tutta la lunghezza della pista (di una fascia laterale `lat`): per le corsie delle piste miste. */
  superficieTutta(tipo, lat) { this.tratti.superfici.push({ tipo, intero: true, lat }); return this; }
  senzaMuro(lato, da, a) { this.tratti.senzaMuro.push({ lato, da, a }); return this; }
  turbo(m, lat = [-2.5, 2.5], lungo = 5) { this.tratti.turbo.push({ m, lungo, lat }); return this; }
  evento(tipo, daGiro, superficie, da, a, lat) { this.tratti.eventi.push({ tipo, daGiro, superficie, da, a, lat }); return this; }
  /** Ramo (scorciatoia): parte a `da` (segno sulla principale) `lat` m a destra, `fn` lo disegna con una tartaruga sua, poi
   *  ritrova la principale ad `a` (segno) `latA` m a destra. */
  ramo(id, da, a, o, fn) { this.rami.push({ id, da, a, o, fn }); return this; }
}

/** Dalla tartaruga alla definizione della pista (i segni diventano metri veri del nastro). */
function definizione(t) {
  const m = t.meta;
  const n = costruisciNastro(t.punti, { chiuso: m.chiusa, passo: m.passo ?? 1, larghezza: m.larghezza });
  const S = (seg) => { let s = n.sPunti[seg.i] + seg.o; if (n.chiuso) s = ((s % n.len) + n.len) % n.len; return r3(s); };
  /** Tratto di superficie: `intero` = da 0 a oltre la fine. */
  const sup = (x) => (x.intero ? { da: 0, a: r3(n.len + 1), ...lat(x.lat), tipo: x.tipo } : { da: S(x.da), a: S(x.a), ...lat(x.lat), tipo: x.tipo });
  const lat = (v) => (v ? { lat: v } : {});
  const rami = t.rami.map((r) => {
    const ia = r.da.i, ib = r.a.i, pa = t.punti[ia].p, pb = t.punti[ib].p, aa = t.dir[ia], ab = t.dir[ib];
    const la = r.o.lat ?? 0, lb = r.o.latA ?? la;
    const ra = [-Math.sin(aa), 0, Math.cos(aa)], rb = [-Math.sin(ab), 0, Math.cos(ab)];
    const sub = new Tartaruga({ ...m, larghezza: r.o.larghezza }, { x: pa[0] + ra[0] * la, y: pa[1], z: pa[2] + ra[2] * la, a: aa, l: r.o.larghezza });
    r.fn(sub);
    sub.raggiungi([pb[0] + rb[0] * lb, pb[1], pb[2] + rb[2] * lb], ab, { ultimo: true });
    const rn = costruisciNastro(sub.punti, { chiuso: false, passo: m.passo ?? 1, larghezza: r.o.larghezza });
    const SR = (seg) => r3(rn.sPunti[seg.i] + seg.o);
    return {
      id: r.id, da: S(r.da), a: S(r.a), punti: sub.punti, larghezza: r.o.larghezza, bordo: r.o.bordo ?? 1.5,
      superficie: r.o.superficie ?? m.superficie, bordoTipo: r.o.bordoTipo ?? m.bordoTipo,
      superfici: sub.tratti.superfici.map((x) => ({ da: SR(x.da), a: SR(x.a), ...lat(x.lat), tipo: x.tipo })),
      ...(sub.tratti.turbo.length ? { turbo: sub.tratti.turbo.map((x) => ({ s: SR(x.m), lungo: x.lungo, lat: x.lat })) } : {}),
      ...(r.o.scorciatoia ? { scorciatoia: true } : {}),
      ...(r.o.famiglie ? { famiglie: r.o.famiglie } : {}),
    };
  });
  return {
    id: m.id, nome: m.nome, zona: m.zona, famiglia: m.famiglia, ...(m.famiglie ? { famiglie: m.famiglie } : {}), ...(m.corsie ? { corsie: m.corsie } : {}),
    ...(m.inseguitore ? { inseguitore: m.inseguitore } : {}), tipo: m.tipo, giri: m.giri ?? (m.tipo === 'fuga' ? 1 : 3), chiusa: m.chiusa,
    passo: m.passo ?? 1, via: m.via ?? 0, larghezza: m.larghezza, bordo: m.bordo, muro: m.muro ?? 0.7,
    superficie: m.superficie, bordoTipo: m.bordoTipo, stile: m.stile ?? 'strada',
    punti: t.punti,
    superfici: t.tratti.superfici.map(sup),
    vuoti: t.tratti.vuoti.map((x) => ({ da: S(x.da), a: S(x.a) })),
    senzaMuro: t.tratti.senzaMuro.map((x) => ({ da: S(x.da), a: S(x.a), lato: x.lato })),
    rampe: t.tratti.rampe.map((x) => ({ s: S(x.m), salto: x.salto })),
    turbo: t.tratti.turbo.map((x) => ({ s: S(x.m), lungo: x.lungo, lat: x.lat })),
    rami,
    griglia: m.griglia ?? [[-5, -2.5], [-5, 2.5], [-11, -2.5], [-11, 2.5], [-17, 0]],
    eventi: t.tratti.eventi.map((x) => ({ tipo: x.tipo, daGiro: x.daGiro, superficie: x.superficie, da: S(x.da), a: S(x.a), ...lat(x.lat) })),
  };
}

// ---- planimetria: PNG vista dall'alto (colore = quota, rosso = rampe, giallo = turbo, nero = buchi, verde = rami) ----
function png(w, h, rgb) {
  const crcT = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
  const crc = (b) => { let c = -1; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 3 + 1)] = 0; rgb.copy(raw, y * (w * 3 + 1) + 1, y * w * 3, (y + 1) * w * 3); }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
function planimetria(def, file) {
  const nast = [{ n: costruisciNastro(def.punti, { chiuso: def.chiusa, passo: def.passo, larghezza: def.larghezza }), ramo: false }];
  for (const r of def.rami) nast.push({ n: costruisciNastro(r.punti, { chiuso: false, passo: def.passo, larghezza: r.larghezza }), ramo: true });
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const { n } of nast) for (let i = 0; i < n.n; i++) { x0 = Math.min(x0, n.x[i]); x1 = Math.max(x1, n.x[i]); z0 = Math.min(z0, n.z[i]); z1 = Math.max(z1, n.z[i]); y0 = Math.min(y0, n.y[i]); y1 = Math.max(y1, n.y[i]); }
  const pad = 20, k = Math.min(1200 / (x1 - x0 + pad * 2), 900 / (z1 - z0 + pad * 2)), W = Math.ceil((x1 - x0 + pad * 2) * k), H = Math.ceil((z1 - z0 + pad * 2) * k);
  const img = Buffer.alloc(W * H * 3, 0); for (let i = 0; i < W * H; i++) { img[i * 3] = 22; img[i * 3 + 1] = 63; img[i * 3 + 2] = 115; }
  const disco = (x, z, r, c) => {
    const cx = (x - x0 + pad) * k, cz = (z - z0 + pad) * k, rr = Math.max(1, r * k);
    for (let py = Math.floor(cz - rr); py <= cz + rr; py++) for (let px = Math.floor(cx - rr); px <= cx + rr; px++) {
      if (px < 0 || py < 0 || px >= W || py >= H || (px - cx) ** 2 + (py - cz) ** 2 > rr * rr) continue;
      img[(py * W + px) * 3] = c[0]; img[(py * W + px) * 3 + 1] = c[1]; img[(py * W + px) * 3 + 2] = c[2];
    }
  };
  const quota = (y) => { const t = (y - y0) / Math.max(1, y1 - y0); return [Math.round(120 + 135 * t), Math.round(180 - 60 * t), Math.round(200 - 170 * t)]; };
  const inTr = (t, s, len) => (def.chiusa && t.da > t.a ? s >= t.da || s < t.a : s >= t.da && s < t.a);
  for (const { n, ramo } of nast) for (let i = 0; i < n.n; i++) disco(n.x[i], n.z[i], n.l[i], ramo ? [80, 190, 90] : quota(n.y[i]));
  const n = nast[0].n;
  for (let i = 0; i < n.n; i++) {
    const s = i * n.passo;
    if (def.vuoti.some((t) => inTr(t, s, n.len))) disco(n.x[i], n.z[i], n.l[i], [10, 10, 10]);
    if (def.turbo.some((t) => s >= t.s && s < t.s + t.lungo)) disco(n.x[i], n.z[i], 2, [245, 213, 71]);
    if (def.rampe.some((t) => Math.abs(s - t.s) < 1.5)) disco(n.x[i], n.z[i], n.l[i] * 0.8, [232, 67, 63]);
    if (n.ad[i]) disco(n.x[i], n.z[i], 1.2, [255, 61, 166]);
    if (i % 20 === 0) disco(n.x[i], n.z[i], 0.6, [255, 255, 255]);
  }
  disco(n.x[0], n.z[0], 3, [255, 255, 255]);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, png(W, H, img));
  return { w: W, h: H };
}

const args = process.argv.slice(2), plan = args.includes('--planimetria'), ids = args.filter((a) => !a.startsWith('--'));
const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.mjs') && (!ids.length || ids.includes(f.replace('.mjs', ''))));
fs.mkdirSync(OUT, { recursive: true });
for (const f of files) {
  const mod = await import(pathToFileURL(path.join(DIR, f)).href);
  const t = new Tartaruga(mod.meta);
  mod.default(t);
  const def = definizione(t);
  fs.writeFileSync(path.join(OUT, def.id + '.json'), JSON.stringify(def) + '\n');
  const n = costruisciNastro(def.punti, { chiuso: def.chiusa, passo: def.passo, larghezza: def.larghezza });
  let salita = 0; for (let i = 1; i < n.n; i++) salita += Math.max(0, n.y[i] - n.y[i - 1]);
  const extra = plan ? ` → ${path.relative(ROOT, path.join(PLAN, def.id + '.png'))}` : '';
  if (plan) planimetria(def, path.join(PLAN, def.id + '.png'));
  console.log(`[corse] ${def.id}: ${Math.round(n.len)} m, ${def.punti.length} punti, quota ${Math.round(Math.min(...n.y))}…${Math.round(Math.max(...n.y))} m (salita ${Math.round(salita)} m), ${def.rampe.length} rampe, ${def.rami.length} rami${extra}`);
}
