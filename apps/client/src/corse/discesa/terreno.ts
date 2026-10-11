// Il terreno della discesa (#229): il sentiero di terra battuta e la montagna intorno, fatti dal nastro del sentiero. Solo resa: la sim
// guarda il nastro, non questo.
// - Quota: lontano dal sentiero è la media pesata delle quote del sentiero vicino (così tra due tornanti c'è il pendio, non un gradino),
//   più il fianco della zona: sulla cresta a monte sale il prato e a valle il dirupo scende verso il mare; un po' di onde larghe. Vicino
//   al sentiero si raccorda alla sua quota (sentiero leggermente incassato, erba ai bordi).
// - Colori della palette per triangolo: erba gialla e verde sulla cresta, roccia dove è ripido, sottobosco scuro e aghi nel bosco.
// - La griglia c'è solo entro `RAGGIO` m dal sentiero: oltre si vede il fondale (sulla cresta il dirupo è già sceso sotto l'orizzonte).
import * as THREE from 'three';
import { campo, punto } from '@marea/sim/corse/nastro.ts';
import type { Sentiero } from '@marea/sim/corse/bici.ts';
import { P } from '../../render/island_parts.ts';

const RAGGIO = 170, LATO = 4;
type Camp = { x: number; y: number; z: number; rx: number; rz: number; s: number; l: number };

/** Campioni del sentiero in una griglia da 24 m, per trovare i vicini in fretta. */
function vicini(S: Sentiero) {
  const n = S.n, C = 24, b = new Map<number, Camp[]>(), tutti: Camp[] = [];
  const key = (i: number, j: number) => (i + 2048) * 4096 + (j + 2048);
  for (let i = 0; i < n.n; i += 2) {
    const c: Camp = { x: n.x[i]!, y: n.y[i]!, z: n.z[i]!, rx: n.rx[i]!, rz: n.rz[i]!, s: i * n.passo, l: n.l[i]! };
    const k = key(Math.floor(c.x / C), Math.floor(c.z / C));
    let a = b.get(k); if (!a) b.set(k, (a = [])); a.push(c); tutti.push(c);
  }
  /** Ogni campione entro `r` m (in pianta), con la distanza al quadrato. */
  const intorno = (x: number, z: number, r: number, f: (c: Camp, d2: number) => void) => {
    const i0 = Math.floor((x - r) / C), i1 = Math.floor((x + r) / C), j0 = Math.floor((z - r) / C), j1 = Math.floor((z + r) / C), r2 = r * r;
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) for (const c of b.get(key(i, j)) ?? []) { const dx = x - c.x, dz = z - c.z, d2 = dx * dx + dz * dz; if (d2 < r2) f(c, d2); }
  };
  return { tutti, intorno };
}

const liscio = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const hash = (x: number, z: number) => { const h = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return h - Math.floor(h); };
function onde(x: number, z: number, scala: number): number {
  const fx = x / scala, fz = z / scala, ix = Math.floor(fx), iz = Math.floor(fz), tx = fx - ix, tz = fz - iz;
  const sx = tx * tx * (3 - 2 * tx), sz = tz * tz * (3 - 2 * tz);
  const a = hash(ix, iz), b = hash(ix + 1, iz), c = hash(ix, iz + 1), d = hash(ix + 1, iz + 1);
  return (a + (b - a) * sx + (c - a) * sz + (a - b - c + d) * sx * sz) * 2 - 1;
}

export type Terreno = {
  group: THREE.Group;
  /** Quota del terreno e cosa c'è (zona, lato, distanza dal bordo del sentiero) in un punto: per piazzare i pezzi. */
  info(x: number, z: number): { y: number; zona: 'cresta' | 'bosco'; lato: -1 | 1; tipo: string; fuori: number; s: number } | null;
  tris: number;
};

export function creaTerreno(S: Sentiero): Terreno {
  const n = S.n, d = S.def, V = vicini(S);
  const zonaA = (s: number) => d.zone.find((z) => s >= z.da && s < z.a)?.tipo ?? d.zone[d.zone.length - 1]!.tipo;
  const latoA = (s: number, lato: -1 | 1) => d.lati.find((l) => l.lato === lato && s >= l.da && s < l.a)?.tipo ?? 'prato';
  // il profilo di fianco di ogni campione: sulla cresta a monte sale il prato, a valle scende il dirupo; nel bosco un pendio leggero
  const fianco = (c: Camp, lat: number) => {
    const lato: -1 | 1 = lat >= 0 ? 1 : -1, oltre = Math.max(0, Math.abs(lat) - c.l - d.bordo), tipo = latoA(c.s, lato);
    return tipo === 'dirupo' ? -oltre * 0.42 - oltre * oltre * 0.0012 : tipo === 'prato' ? oltre * 0.3 : -lato * oltre * 0.12;
  };
  /** Il più vicino dei campioni e la quota «naturale» (media pesata molto locale dei campioni vicini, ognuno col suo fianco: tra due
   *  tornanti il pendio è continuo), con le onde larghe. */
  function natura(x: number, z: number): { c: Camp; dist: number; y: number } | null {
    let best: Camp | null = null, bd = RAGGIO * RAGGIO, sw = 0, sy = 0;
    V.intorno(x, z, RAGGIO, (c, d2) => {
      if (d2 < bd) { bd = d2; best = c; }
      const lat = (x - c.x) * c.rx + (z - c.z) * c.rz, w = 1 / ((d2 + 64) * (d2 + 64));
      sw += w; sy += w * (c.y + fianco(c, lat));
    });
    if (!best) return null;
    const c = best as Camp, dist = Math.sqrt(bd), lim = c.l + d.bordo;
    return { c, dist, y: sy / sw + onde(x, z, 26) * 1.6 * liscio(lim, lim + 14, dist) + onde(x, z, 7) * 0.35 * liscio(lim, lim + 4, dist) };
  }
  /** Vicino al sentiero: alla sua quota (l'erba dei bordi appena rialzata), poi si raccorda alla natura. */
  const raccorda = (yNat: number, yBordo: number, l: number, dist: number) => {
    const vicino = yBordo + Math.max(0, dist - l) * 0.05;
    return vicino + (yNat - vicino) * liscio(l, l + d.bordo + 3, dist);
  };
  function info(x: number, z: number) {
    const q = natura(x, z); if (!q) return null;
    const { c, dist } = q, lat = (x - c.x) * c.rx + (z - c.z) * c.rz, lato: -1 | 1 = lat >= 0 ? 1 : -1;
    return { y: raccorda(q.y, c.y, c.l, dist), zona: zonaA(c.s), lato, tipo: latoA(c.s, lato), fuori: dist - c.l, s: c.s };
  }
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  const tmp = new THREE.Color();
  /** Colore di un triangolo: macchie larghe (rumore a 22 m) e un filo di variazione; roccia dove è ripido; sui bordi erba e terra. */
  function colore(ax: number, ay: number, az: number, bx: number, by: number, bz: number, cx: number, cy: number, cz: number, bosco: boolean, bordo: boolean): THREE.Color {
    const ux = bx - ax, uy = by - ay, uz = bz - az, vx = cx - ax, vy = cy - ay, vz = cz - az;
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, ripido = Math.abs(ny) / Math.hypot(nx, ny, nz);
    const h = hash(ax + cx * 0.37, az + cz * 0.61), mx = (ax + bx + cx) / 3, mz = (az + bz + cz) / 3, macchia = onde(mx, mz, 22) + (h - 0.5) * 0.08;
    let c0: string = bosco ? (macchia > 0.2 ? P.bosco : macchia < -0.5 ? P.boscoOmbra : P.erbaScura) : macchia > 0.62 ? P.erbaChiara : macchia < -0.5 ? P.erbaScura : P.erba;
    if (bordo) c0 = bosco ? (macchia > 0.3 ? P.bosco : P.erbaScura) : macchia > 0.75 ? P.erbaChiara : P.erba;
    else if (ripido < 0.6) c0 = h < 0.5 ? P.pietra : P.pietraScura;
    else if (ripido < 0.72) c0 = macchia > 0 ? P.pietraChiara : P.pietra;
    return tmp.set(c0);
  }
  // triangoli per riquadri da 96 m: ogni riquadro è una mesh, così la camera scarta quelli fuori dall'inquadratura
  const RIQ = 96, riquadri = new Map<number, { pos: number[]; col: number[] }>();
  let nTri = 0;
  const tri3 = (a: number[], b: number[], c: number[], bosco: boolean, bordo: boolean) => {
    const key = Math.floor((a[0]! + b[0]! + c[0]!) / 3 / RIQ) * 10007 + Math.floor((a[2]! + b[2]! + c[2]!) / 3 / RIQ);
    let r = riquadri.get(key); if (!r) riquadri.set(key, (r = { pos: [], col: [] }));
    r.pos.push(a[0]!, a[1]!, a[2]!, b[0]!, b[1]!, b[2]!, c[0]!, c[1]!, c[2]!);
    const k = colore(a[0]!, a[1]!, a[2]!, b[0]!, b[1]!, b[2]!, c[0]!, c[1]!, c[2]!, bosco, bordo);
    for (let v = 0; v < 3; v++) r.col.push(k.r, k.g, k.b);
    nTri++;
  };

  // ---------- vicino: una fascia larga 16 m per lato che segue il sentiero (i bordi combaciano col sentiero) ----------
  const COL = [0, 0.6, 1, 2.2, 4, 7, 11, 16]; // m oltre il bordo del sentiero
  const PASSO = 2;
  for (const lato of [-1, 1] as const) {
    let prima: (number[] | null)[] | null = null;
    for (let s = 0; s <= n.len; s += PASSO) {
      const fila: (number[] | null)[] = [], l = campo(n, n.l, s), P3: [number, number, number] = [0, 0, 0];
      for (const o of COL) {
        punto(n, s, lato * (l + o), 0, P3);
        if (o === 0) { fila.push([P3[0], P3[1] + 0.01, P3[2]]); continue; }
        const q = natura(P3[0], P3[2]);
        // un altro tratto del sentiero è più vicino (tornante): qui ci pensa la fascia di quell'altro
        if (!q || Math.abs(q.c.s - s) > 24) { fila.push(null); continue; }
        fila.push([P3[0], raccorda(q.y, P3[1], 0, o), P3[2]]);
      }
      if (prima) {
        const bos = zonaA(s) === 'bosco';
        for (let k = 0; k < COL.length - 1; k++) {
          const a = prima[k], b = prima[k + 1], c = fila[k], e = fila[k + 1];
          if (!a || !b || !c || !e) continue;
          const bordo = COL[k + 1]! <= d.bordo;
          if (lato > 0) { tri3(a, b, c, bos, bordo); tri3(b, e, c, bos, bordo); } else { tri3(a, c, b, bos, bordo); tri3(b, c, e, bos, bordo); }
        }
      }
      prima = fila;
    }
  }

  // ---------- lontano: griglia da 4 m (solo dove serve); vicino al sentiero scende sotto la fascia, così non la buca ----------
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const c of V.tutti) { x0 = Math.min(x0, c.x); x1 = Math.max(x1, c.x); z0 = Math.min(z0, c.z); z1 = Math.max(z1, c.z); }
  x0 = Math.floor((x0 - RAGGIO) / LATO) * LATO; z0 = Math.floor((z0 - RAGGIO) / LATO) * LATO;
  const NX = Math.ceil((x1 + RAGGIO - x0) / LATO) + 1, NZ = Math.ceil((z1 + RAGGIO - z0) / LATO) + 1;
  const Y = new Float32Array(NX * NZ).fill(NaN), Zn = new Uint8Array(NX * NZ);
  for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) {
    const q = natura(x0 + i * LATO, z0 + j * LATO); if (!q) continue;
    const k = j * NX + i, lim = q.c.l + d.bordo;
    Y[k] = q.y - 2.5 * (1 - liscio(lim + 6, lim + 13, q.dist)); Zn[k] = zonaA(q.c.s) === 'bosco' ? 1 : 0;
  }
  const V3 = (a: number) => [x0 + (a % NX) * LATO, Y[a]!, z0 + Math.floor(a / NX) * LATO];
  const tri = (a: number, b: number, c: number) => {
    if (Number.isNaN(Y[a]!) || Number.isNaN(Y[b]!) || Number.isNaN(Y[c]!)) return;
    tri3(V3(a), V3(b), V3(c), Zn[a]! + Zn[b]! + Zn[c]! >= 2, false);
  };
  for (let j = 0; j < NZ - 1; j++) for (let i = 0; i < NX - 1; i++) {
    const a = j * NX + i, b = a + 1, c = a + NX, e = c + 1;
    if ((i + j) & 1) { tri(a, c, b); tri(b, c, e); } else { tri(a, c, e); tri(a, e, b); }
  }
  const suolo = new THREE.Group(); suolo.name = 'terreno';
  for (const r of riquadri.values()) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(r.pos, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(r.col, 3));
    geo.computeVertexNormals(); geo.computeBoundingSphere();
    const m = new THREE.Mesh(geo, mat); m.receiveShadow = true; suolo.add(m);
  }

  // ---------- il sentiero: terra battuta, chiara al centro, i solchi delle ruote più scuri, sassolini; radici scure ----------
  const sp: number[] = [], sc: number[] = [], strisce = [-1, -0.72, -0.3, 0.3, 0.72, 1];
  const colStr = [P.legnoChiaro, P.sabbia, P.sabbia, P.sabbia, P.legnoChiaro];
  for (let i = 0; i < n.n - 1; i++) {
    for (let k = 0; k < strisce.length - 1; k++) {
      const q = (ii: number, f: number): [number, number, number] => { const l = n.l[ii]! * f; return [n.x[ii]! + n.rx[ii]! * l + n.ux[ii]! * 0.02, n.y[ii]! + n.ry[ii]! * l + n.uy[ii]! * 0.02, n.z[ii]! + n.rz[ii]! * l + n.uz[ii]! * 0.02]; };
      const a = q(i, strisce[k]!), b = q(i, strisce[k + 1]!), c = q(i + 1, strisce[k]!), e = q(i + 1, strisce[k + 1]!);
      sp.push(...a, ...b, ...c, ...b, ...e, ...c);
      const radici = d.radici.some((r) => i >= r.da && i < r.a), bosco = zonaA(i) === 'bosco';
      const h = hash(i * 0.7, k * 3.1);
      const chiazza = onde(n.x[i]!, n.z[i]!, 9);
      tmp.set(bosco ? (k === 0 || k === 4 ? P.legnoScuro : chiazza > 0.1 || radici ? P.legnoChiaro : P.sabbia) : chiazza > 0.35 ? P.legnoChiaro : colStr[k]!);
      for (let v = 0; v < 6; v++) sc.push(tmp.r, tmp.g, tmp.b);
    }
  }
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3)); sg.setAttribute('color', new THREE.Float32BufferAttribute(sc, 3));
  sg.computeVertexNormals();
  const strada = new THREE.Mesh(sg, mat); strada.receiveShadow = true; strada.name = 'sentiero';

  const group = new THREE.Group(); group.add(suolo, strada);
  return { group, info, tris: nTri + sp.length / 9 };
}
