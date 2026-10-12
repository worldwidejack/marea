// La pista dello snowboard in 3D (docs/ADRENALINA.md §3 e §7): la montagna vista da vicino attorno al nastro della sim.
// - Terreno: un nastro largo (±~110 m) a fasce per riquadri da 100 m (si spengono fuori inquadratura): pista battuta, neve fresca, bosco
//   che sale ai lati, pareti di roccia nella gola, il sentiero di neve alta del fuoripista e accanto la pista battuta chiusa.
// - Abeti in InstancedMesh per riquadro (bosco, quelli in pista, quelli del fuoripista), rocce, porte dello slalom, paletti dei bordi,
//   trampolini, partenza, arrivo a scacchi, l'abete che cade di traverso sulla pista chiusa, montagne lontane.
// Colori solo della palette (ART_BIBLE §2), flat shading, niente texture.
import * as THREE from 'three';
import type { PistaNeve } from '@marea/sim/adrenalina/pista.ts';
import { altezzaRampa, bordoA, fuoripistaA, neveA, quotaA } from '@marea/sim/adrenalina/pista.ts';
import { dove, punto, terna, nuovaTerna } from '@marea/sim/corse/nastro.ts';
import { PAL } from '../ui/style.ts';
import { M, merged, painted } from '../render/island_parts.ts';

export type Pista3d = {
  gruppo: THREE.Group;
  /** Spegne riquadri e abeti oltre la nebbia (`lontano` m dalla camera). */
  aggiorna(camera: THREE.Vector3, lontano: number): void;
  /** L'abete che cade sulla pista chiusa: `cade(k)` con k da 0 (in piedi) a 1 (di traverso). */
  tronco: { cade(k: number): void } | null;
  dispose(): void;
  numeri(): { abeti: number; triangoli: number; riquadri: number };
};

const RIQUADRO = 100, PASSO_T = 4;
/** Rumore deterministico 0-1 da due interi. */
const h01 = (a: number, b: number, c = 0) => { let x = (a * 374761393 + b * 668265263 + c * 2147483647) | 0; x = (x ^ (x >>> 13)) * 1274126177; return ((x ^ (x >>> 16)) >>> 0) / 4294967296; };
const C = (h: string) => new THREE.Color(h);
const COL = {
  battuta: C(PAL.pietraChiara), fresca: C(PAL.sabbiaChiara), bosco: C(PAL.pietraChiara), macchia: C(PAL.pietra),
  roccia: C(PAL.pietraScura), rocciaScura: C(PAL.roccia),
};

/** Colonne del terreno (m di lato, da un lato) dato il bordo `e` e la neve fresca `nv`. */
const colonne = (e: number, nv: number) => [0, e * 0.5, e, e + nv * 0.5, e + nv, e + nv + 4, e + nv + 10, e + nv + 20, e + nv + 36, e + nv + 64, e + nv + 110];

export function creaPista3d(p: PistaNeve): Pista3d {
  const n = p.n, d = p.def, fp = d.fuoripista ?? null;
  const gruppo = new THREE.Group(); gruppo.name = 'snowboard_pista';
  const matV = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  const P3: [number, number, number] = [0, 0, 0];
  let triangoli = 0, abetiN = 0;

  // ---- la pista chiusa del fuoripista: retta dal bivio al rientro; per sapere dov'è rispetto al nastro ----
  const chiusa = fp ? fp.chiusa.punti : [];
  const distChiusa = (x: number, z: number): number => {
    let best = Infinity;
    for (let i = 0; i + 1 < chiusa.length; i++) {
      const a = chiusa[i]!, b = chiusa[i + 1]!, sx = b[0] - a[0], sz = b[2] - a[2], l2 = sx * sx + sz * sz || 1;
      let t = ((x - a[0]) * sx + (z - a[2]) * sz) / l2; t = t < 0 ? 0 : t > 1 ? 1 : t;
      const dx = x - a[0] - sx * t, dz = z - a[2] - sz * t, d2 = dx * dx + dz * dz;
      if (d2 < best) best = d2;
    }
    return Math.sqrt(best);
  };
  const inFuori = (s: number) => !!fp && s > fp.da - 30 && s < fp.a + 30;

  /** Quota del terreno a (s, lat) sopra la linea della pista: piatta in pista, sale nel bosco, a picco nella gola. */
  function rilievo(s: number, lat: number, i: number, j: number): number {
    const e = bordoA(p, s), nv = neveA(p, s), a = Math.abs(lat), k = a - e - nv;
    if (a <= e) return 0;
    if (k <= 0) return 0.35 * (a - e) / Math.max(1, nv);
    const r = (h01(i, j, 5) - 0.5) * 1.2;
    if (nv === 0) return 1.4 + k * 1.1 + (k > 12 ? (k - 12) * 0.6 : 0) + r * 2; // gola: pareti di roccia
    if (fuoripistaA(p, s) || inFuori(s)) {
      // nel bosco del fuoripista: sottobosco quasi piatto, dal lato della pista chiusa piatto del tutto fino a lei e oltre
      if (lat > 0) return k < 50 ? 0.1 + r * 0.15 : 0.1 + (k - 50) * 0.35;
      return 0.35 + k * 0.08 + (k > 30 ? (k - 30) * 0.4 : 0) + r * 0.4;
    }
    return 0.35 + k * 0.16 + (k > 22 ? (k - 22) * 0.5 : 0) + r;
  }
  const quotaTerreno = (s: number, lat: number, i: number, j: number) => quotaA(p, s, lat) + rilievo(s, lat, i, j);

  // ---- terreno a riquadri ----
  const fine = n.len;
  const riquadri: THREE.Mesh[] = [];
  for (let s0 = 0; s0 < fine; s0 += RIQUADRO) {
    const s1 = Math.min(fine, s0 + RIQUADRO), righe = Math.max(1, Math.round((s1 - s0) / PASSO_T));
    const pos: number[] = [], col: number[] = [];
    let grid: { x: number; y: number; z: number; lat: number }[][] = [];
    for (let r = 0; r <= righe; r++) {
      const s = s0 + ((s1 - s0) * r) / righe, e = bordoA(p, s), nv = neveA(p, s), ri = Math.round(s / PASSO_T);
      const c = colonne(e, nv), lats = [...c.slice(1).reverse().map((v) => -v), ...c];
      grid.push(lats.map((lat, j) => { punto(n, s, lat, 0, P3); return { x: P3[0], y: quotaTerreno(s, lat, ri, j), z: P3[2], lat }; }));
    }
    const tri = (a: { x: number; y: number; z: number }, b: typeof a, c: typeof a, colr: THREE.Color) => {
      pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
      // le facce ripide (pareti) sono roccia, quelle in piano restano neve
      const ux = b.x - a.x, uy = b.y - a.y, uz = b.z - a.z, vx = c.x - a.x, vy = c.y - a.y, vz = c.z - a.z;
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, ln = Math.hypot(nx, ny, nz) || 1;
      const cc = Math.abs(ny / ln) < 0.62 ? (h01(Math.round(a.x), Math.round(a.z)) < 0.5 ? COL.roccia : COL.rocciaScura) : colr;
      for (let k = 0; k < 3; k++) col.push(cc.r, cc.g, cc.b);
    };
    for (let r = 0; r < righe; r++) {
      const A = grid[r]!, B = grid[r + 1]!, sMid = s0 + ((s1 - s0) * (r + 0.5)) / righe, e = bordoA(p, sMid), fuori = fuoripistaA(p, sMid);
      for (let j = 0; j + 1 < A.length; j++) {
        const lm = Math.abs((A[j]!.lat + A[j + 1]!.lat) / 2);
        const colr = lm <= e ? (fuori ? COL.fresca : COL.battuta) : lm <= e + neveA(p, sMid) ? COL.fresca : h01(r + Math.round(s0), j, 9) < 0.18 ? COL.macchia : COL.bosco;
        tri(A[j]!, B[j + 1]!, B[j]!, colr); tri(A[j]!, A[j + 1]!, B[j + 1]!, colr); // verso: la faccia guarda in su
      }
    }
    grid = [];
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.computeVertexNormals(); g.computeBoundingSphere();
    const m = new THREE.Mesh(g, matV); m.name = 'snowboard_terreno'; m.receiveShadow = true;
    riquadri.push(m); gruppo.add(m); triangoli += pos.length / 9;
  }

  // ---- abeti: uno solo in geometria (tronco, tre palchi, neve sopra), in InstancedMesh per riquadro ----
  // (pochi triangoli: ce ne sono ~2400; coni a 5 lati senza fondo, tronco senza tappi)
  const abete = merged([
    painted(new THREE.CylinderGeometry(0.18, 0.24, 1.4, 4, 1, true), PAL.legnoScuro, M(0, 0.7, 0)),
    painted(new THREE.ConeGeometry(1.5, 2.4, 5, 1, true), PAL.bosco, M(0, 2.2, 0)),
    painted(new THREE.ConeGeometry(1.15, 2.1, 5, 1, true), PAL.bosco, M(0, 3.6, 0, 0, 0.6, 0)),
    painted(new THREE.ConeGeometry(0.8, 1.9, 5, 1, true), PAL.erbaScura, M(0, 4.9, 0)),
    painted(new THREE.ConeGeometry(0.5, 0.9, 5, 1, true), PAL.pietraChiara, M(0, 5.75, 0, 0, 0.6, 0)),
  ]);
  const triAbete = abete.attributes.position!.count / 3;
  const perRiquadro = new Map<number, THREE.Matrix4[]>();
  const mat4 = new THREE.Matrix4(), q = new THREE.Quaternion(), su = new THREE.Vector3(0, 1, 0);
  const piantaIn = (s: number, x: number, y: number, z: number, scala: number, giro: number) => {
    const k = Math.floor(s / RIQUADRO);
    const l = perRiquadro.get(k) ?? []; perRiquadro.set(k, l);
    l.push(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), q.setFromAxisAngle(su, giro).clone(), new THREE.Vector3(scala, scala * (0.9 + (giro % 0.3)), scala)));
  };
  // il bosco ai lati (non nella gola, non sulla pista chiusa)
  for (let s = 0, i = 0; s < fine; s += 5.5, i++) {
    const e = bordoA(p, s), nv = neveA(p, s);
    if (nv === 0) continue;
    for (const lato of [-1, 1]) {
      for (let j = 0; j < 6; j++) {
        const dl = [1.2, 4, 8.5, 14, 22, 33][j]! + h01(i, j, lato) * 3, ss = s + (h01(j, i, 3) - 0.5) * 4;
        if (h01(i, j, 11 + lato) < (j > 3 ? 0.35 : 0.15)) continue;
        const lat = lato * (e + nv + dl);
        punto(n, ss, lat, 0, P3);
        if (fp && inFuori(ss) && distChiusa(P3[0], P3[2]) < fp.chiusa.l + 3) continue;
        piantaIn(ss, P3[0], quotaTerreno(ss, lat, Math.round(ss / PASSO_T), 99) - 0.1, P3[2], 0.85 + h01(i, j, 7) * 0.8, h01(j, i, 8) * 6.28);
      }
    }
  }
  // gli abeti della pista e del fuoripista (gli ostacoli della sim: la scala dal raggio)
  for (const o of d.ostacoli) if (o.tipo === 'abete') { punto(n, o.s, o.lat, 0, P3); piantaIn(o.s, P3[0], P3[1] - 0.05, P3[2], o.r * 1.15, o.s % 6.28); }
  const istanze: THREE.InstancedMesh[] = [];
  for (const [k, l] of perRiquadro) {
    const im = new THREE.InstancedMesh(abete, matV, l.length); im.name = 'snowboard_abeti_' + k;
    l.forEach((m, i) => im.setMatrixAt(i, m));
    im.castShadow = true; im.computeBoundingSphere(); istanze.push(im); gruppo.add(im);
    abetiN += l.length;
  }

  // ---- tutto il resto fuso in una geometria: rocce, porte, paletti, trampolini, partenza, arrivo, la pista chiusa ----
  const parti: THREE.BufferGeometry[] = [];
  const T = nuovaTerna();
  /** Matrice a (s, lat, h): assi della pista (x = destra, y = su, z = avanti). */
  const sulNastro = (s: number, lat: number, h: number, sx = 1, sy = 1, sz = 1) => {
    terna(n, s, T); punto(n, s, lat, h, P3);
    const f = new THREE.Vector3(T.tx, 0, T.tz).normalize(), x = new THREE.Vector3().crossVectors(su, f).normalize();
    return new THREE.Matrix4().makeBasis(x, su, f).scale(new THREE.Vector3(sx, sy, sz)).setPosition(P3[0], P3[1], P3[2]);
  };
  for (const o of d.ostacoli) if (o.tipo === 'roccia') parti.push(painted(new THREE.DodecahedronGeometry(o.r * 1.15, 0), PAL.pietraScura, sulNastro(o.s, o.lat, o.r * 0.45, 1, 0.8, 1.2)));
  // porte dello slalom: due pali con la bandiera
  for (const g of d.porte) {
    const c = g.colore === 'rosso' ? PAL.rosso : PAL.acquaProfonda;
    for (const lato of [-1, 1]) {
      const lat = g.lat + (lato * g.w) / 2;
      parti.push(painted(new THREE.BoxGeometry(0.09, 1.9, 0.09), c, sulNastro(g.s, lat, 0.95)));
      parti.push(painted(new THREE.BoxGeometry(0.75, 0.6, 0.03), c, sulNastro(g.s, lat - lato * 0.42, 1.5)));
      parti.push(painted(new THREE.BoxGeometry(0.1, 0.12, 0.04), PAL.pietraChiara, sulNastro(g.s, lat - lato * 0.42, 1.5)));
    }
  }
  // paletti arancio e neri dei bordi ogni 24 m (non nella gola e nel fuoripista)
  for (let s = 16; s < d.arrivo; s += 24) {
    if (neveA(p, s) === 0 || fuoripistaA(p, s)) continue;
    const e = bordoA(p, s);
    for (const lato of [-1, 1]) {
      parti.push(painted(new THREE.BoxGeometry(0.08, 0.7, 0.08), PAL.arancio, sulNastro(s, lato * (e + 0.3), 0.35)));
      parti.push(painted(new THREE.BoxGeometry(0.085, 0.5, 0.085), PAL.neroCaldo, sulNastro(s, lato * (e + 0.3), 0.95)));
    }
  }
  // trampolini: la salita a gradini di 1 m, il bordo arancio, i fianchi
  for (const r of d.rampe) {
    const w = r.lat[1] - r.lat[0], mid = (r.lat[0] + r.lat[1]) / 2, passi = Math.ceil(r.lungo);
    for (let k = 0; k < passi; k++) {
      const sa = r.s - r.lungo + k, sb = Math.min(r.s, sa + 1), ha = altezzaRampa(r, sa + 0.001), hb = altezzaRampa(r, sb);
      const h = (ha + hb) / 2, ultimo = k === passi - 1;
      parti.push(painted(new THREE.BoxGeometry(w, Math.max(0.05, h), sb - sa + 0.02), PAL.sabbiaChiara, sulNastro((sa + sb) / 2, mid, h / 2)));
      if (ultimo) parti.push(painted(new THREE.BoxGeometry(w + 0.02, 0.06, 0.5), PAL.arancio, sulNastro(sb - 0.25, mid, h + 0.02)));
    }
    for (const lato of [-1, 1]) parti.push(painted(new THREE.BoxGeometry(0.25, 0.5, 0.25), PAL.rosso, sulNastro(r.s, mid + (lato * (w + 0.6)) / 2, 0.25)));
  }
  // partenza: la stazione a monte (casetta di legno, tetto innevato, la cabina rossa) e l'arco
  parti.push(painted(new THREE.BoxGeometry(9, 4.2, 7), PAL.legno, sulNastro(1, -18, 2.1)));
  parti.push(painted(new THREE.BoxGeometry(10, 0.6, 8), PAL.pietraChiara, sulNastro(1, -18, 4.5)));
  parti.push(painted(new THREE.BoxGeometry(2.2, 2, 1.8), PAL.rosso, sulNastro(1, -12.5, 2.2)));
  const arco = (s: number, larga: number, alto: number, colore: string, scacchi: boolean) => {
    for (const lato of [-1, 1]) parti.push(painted(new THREE.BoxGeometry(0.35, alto, 0.35), PAL.legnoScuro, sulNastro(s, lato * larga, alto / 2)));
    if (!scacchi) { parti.push(painted(new THREE.BoxGeometry(larga * 2, 0.9, 0.1), colore, sulNastro(s, 0, alto - 0.45))); return; }
    const nq = Math.round(larga * 2 / 0.9);
    for (let i = 0; i < nq; i++) for (let r = 0; r < 2; r++) parti.push(painted(new THREE.BoxGeometry((larga * 2) / nq, 0.45, 0.1), (i + r) % 2 ? PAL.neroCaldo : PAL.pietraChiara, sulNastro(s, -larga + ((i + 0.5) * larga * 2) / nq, alto - 0.225 - r * 0.45)));
  };
  arco(d.partenza + 1, bordoA(p, d.partenza) + 0.5, 7, PAL.rosso, false);
  arco(d.arrivo, bordoA(p, d.arrivo) + 0.8, 4.8, PAL.rosso, true);
  // la pista battuta chiusa del fuoripista: un nastro piatto sul terreno dal bivio al rientro, i paletti, il cartello con la freccia
  let tronco: Pista3d['tronco'] = null;
  if (fp && chiusa.length > 1) {
    const L = fp.chiusa.l, pos: number[] = [];
    // `y` = quota della pista chiusa lì (dove cerca in 3D: con una quota sbagliata scivola indietro lungo il nastro)
    const sopra = (x: number, y: number, z: number, hint: number) => { const w = dove(n, x, y, z, hint, 90); return quotaTerreno(w.s, w.lat, Math.round(w.s / PASSO_T), 50) + 0.06; };
    let prima: [THREE.Vector3, THREE.Vector3] | null = null, hint = fp.da;
    for (let i = 0; i < chiusa.length; i++) {
      const a = chiusa[i]!, b = chiusa[Math.min(i + 1, chiusa.length - 1)]!, c = chiusa[Math.max(0, i - 1)]!;
      const fx = b[0] - c[0], fz = b[2] - c[2], lf = Math.hypot(fx, fz) || 1, rx = -fz / lf, rz = fx / lf;
      const sx = a[0] - rx * L, sz = a[2] - rz * L, dx = a[0] + rx * L, dz = a[2] + rz * L;
      hint += 10;
      const coppia: [THREE.Vector3, THREE.Vector3] = [new THREE.Vector3(sx, sopra(sx, a[1], sz, hint), sz), new THREE.Vector3(dx, sopra(dx, a[1], dz, hint), dz)];
      if (prima) for (const v of [prima[0], coppia[1], coppia[0], prima[0], prima[1], coppia[1]]) pos.push(v.x, v.y, v.z);
      prima = coppia;
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
    const chiusaM = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color: PAL.pietraChiara, flatShading: true, polygonOffset: true, polygonOffsetFactor: -2 }));
    chiusaM.name = 'snowboard_pista_chiusa'; chiusaM.receiveShadow = true; gruppo.add(chiusaM); triangoli += pos.length / 9;
    // l'abete al bordo della pista chiusa, a `tronco` m dal bivio: cade di traverso (pivot alla base)
    const a = chiusa[0]!, b = chiusa[1]!, fx = b[0] - a[0], fz = b[2] - a[2], lf = Math.hypot(fx, fz) || 1;
    const bx = a[0] + (fx / lf) * fp.chiusa.tronco + (-fz / lf) * (L + 1.5), bz = a[2] + (fz / lf) * fp.chiusa.tronco + (fx / lf) * (L + 1.5);
    const perno = new THREE.Group(); perno.name = 'snowboard_tronco';
    perno.position.set(bx, sopra(bx, a[1], bz, fp.da + fp.chiusa.tronco) - 0.1, bz);
    perno.rotation.y = Math.atan2(fx, fz); // asse z del perno lungo la pista chiusa, la base a −x: cade verso +x, di traverso
    const albero = new THREE.Mesh(abete, matV); albero.scale.set(1.3, 2.4, 1.3); albero.castShadow = true; perno.add(albero);
    gruppo.add(perno);
    tronco = { cade: (k) => { const e = Math.min(1, Math.max(0, k)); perno.rotation.z = -((e * e * Math.PI) / 2) * 0.97; } };
    // paletti della pista chiusa e il cartello con la freccia verso il sentiero (a sinistra)
    for (let i = 2; i < chiusa.length - 1; i += 3) for (const lato of [-1, 1]) {
      const c = chiusa[i]!, x = c[0] + (-fz / lf) * lato * (L + 0.3), z = c[2] + (fx / lf) * lato * (L + 0.3);
      parti.push(painted(new THREE.BoxGeometry(0.08, 1.2, 0.08), PAL.arancio, M(x, sopra(x, c[1], z, fp.da + i * 10) + 0.6, z)));
    }
  }
  if (fp) {
    parti.push(painted(new THREE.BoxGeometry(0.15, 2.2, 0.15), PAL.legnoScuro, sulNastro(fp.da - 25, -6, 1.1)));
    parti.push(painted(new THREE.BoxGeometry(2.2, 0.9, 0.08), PAL.arancio, sulNastro(fp.da - 25, -6.4, 2)));
    parti.push(painted(new THREE.ConeGeometry(0.35, 0.7, 3), PAL.neroCaldo, sulNastro(fp.da - 25, -7.1, 2, 1, 1, 1).multiply(M(0, 0, -0.05, 0, 0, Math.PI / 2))));
    parti.push(painted(new THREE.BoxGeometry(0.8, 0.14, 0.09), PAL.neroCaldo, sulNastro(fp.da - 25, -6.4, 2)));
  }
  const resto = new THREE.Mesh(merged(parti), matV); resto.name = 'snowboard_pezzi'; resto.castShadow = true; resto.receiveShadow = true;
  gruppo.add(resto); triangoli += resto.geometry.attributes.position!.count / 3;

  // ---- montagne lontane attorno (senza nebbia: sagome contro il cielo) ----
  const box = new THREE.Box3(); for (const r of riquadri) { r.geometry.computeBoundingBox(); box.union(r.geometry.boundingBox!); }
  const centro = box.getCenter(new THREE.Vector3()), raggio = box.getSize(new THREE.Vector3()).length() / 2;
  const monti: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 14; i++) {
    const ang = (i / 14) * Math.PI * 2 + h01(i, 1) * 0.3, dist = raggio + 350 + h01(i, 2) * 400, alto = 260 + h01(i, 3) * 380, largo = 260 + h01(i, 4) * 220;
    const x = centro.x + Math.cos(ang) * dist, z = centro.z + Math.sin(ang) * dist, y = box.min.y - 80;
    monti.push(painted(new THREE.ConeGeometry(largo, alto, 5), i % 2 ? PAL.pietraScura : PAL.pietra, M(x, y + alto / 2, z, 0, ang, 0)));
    monti.push(painted(new THREE.ConeGeometry(largo * 0.32, alto * 0.32, 5), PAL.pietraChiara, M(x, y + alto * 0.84 + 1, z, 0, ang, 0)));
  }
  const montiM = new THREE.Mesh(merged(monti), new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, fog: false }));
  montiM.name = 'snowboard_monti'; gruppo.add(montiM);

  // riquadri del terreno e degli abeti col loro centro e raggio, per spegnerli oltre la nebbia
  const spegnibili = [...riquadri, ...istanze].map((m) => ({ m, c: m.geometry.boundingSphere?.center.clone() ?? new THREE.Vector3(), r: m.geometry.boundingSphere?.radius ?? 0 }));
  for (const sp of spegnibili) if (sp.m instanceof THREE.InstancedMesh && sp.m.boundingSphere) { sp.c.copy(sp.m.boundingSphere.center); sp.r = sp.m.boundingSphere.radius; }
  return {
    gruppo, tronco,
    aggiorna(cam, lontano) { for (const sp of spegnibili) sp.m.visible = sp.c.distanceTo(cam) - sp.r < lontano; },
    numeri: () => ({ abeti: abetiN, triangoli: Math.round(triangoli + abetiN * triAbete), riquadri: riquadri.length }),
    dispose() {
      gruppo.traverse((o) => { if (o instanceof THREE.Mesh) o.geometry.dispose(); });
      abete.dispose(); matV.dispose();
    },
  };
}
