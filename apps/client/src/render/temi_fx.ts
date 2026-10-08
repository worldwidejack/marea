// Scenografia viva delle isole a tema (#68), chunk caricato con import() quando ti avvicini (game/temi.ts). Solo vicino all'isola,
// pochi draw call (InstancedMesh, Points, LineSegments), colori della palette, facce piatte:
//   Tempesta: mare scuro con onde alte nella barriera, pioggia a pixel, nuvole nere che fanno ombra, fulmini con lampo
//   Ghiacci:  banchisa nella barriera finché è chiusa (poi il mare si sgela), neve, aurora boreale di notte
//   Vulcano:  fumo dal cratere, cenere e scintille (gli abitanti col cappello giusto sono decorazioni ferme: island_temi.ts)
//   Giardino: muro di nebbia che nasconde l'isola finché non hai la mappa, petali di ciliegio, carpe koi nello stagno
//   Templari: nebbia rossastra che nasconde l'isola finché non hai la reliquia, poi cenere che cade e corvi neri sopra la chiesa
import * as THREE from 'three';
import { distanzaIsola } from '@marea/sim';
import type { Archipelago, ArchPlace, GridMap } from '@marea/sim';
import type { Loader } from './loader.ts';
import { P, M, merged, painted } from './island_parts.ts';

export type TemiFx = { update(dt: number, t: number, focus: { x: number; z: number }): void; respinta(id: string): void; caccia(id: string): void; stato(): Record<string, unknown> };
type Fx = { id: string; group: THREE.Group; update(dt: number, t: number, near: number): void; stato(): Record<string, unknown>; respinta?(): void; caccia?(): void };

/** Distanza (m) dal bordo dell'isola entro cui la sua scenografia si vede. */
const VISTA_M = 130;
const rnd = Math.random; // solo resa: niente sim qui

/** Celle d'acqua (`~`, e `,` se `bassa`) attorno all'isola con la distanza dal suo rettangolo in [d0, d1] (m). */
function acqua(p: ArchPlace, map: GridMap, d0: number, d1: number, bassa = false): { x: number; z: number; d: number }[] {
  const out: { x: number; z: number; d: number }[] = [], m = Math.ceil(d1 / map.tile) + 1;
  for (let cz = p.origin[1] - m; cz < p.origin[1] + p.h + m; cz++) for (let cx = p.origin[0] - m; cx < p.origin[0] + p.w + m; cx++) {
    const t = map.at(cx, cz); if (t !== '~' && !(bassa && t === ',')) continue;
    const w = map.cellToWorld(cx, cz), d = distanzaIsola(p, map.tile, w.x, w.z).d;
    if (d >= d0 && d <= d1) out.push({ ...w, d });
  }
  return out;
}
/** Rettangolo dell'isola allargato di `m` metri: [x0, z0, x1, z1]. */
const box = (p: ArchPlace, T: number, m: number) => [p.origin[0] * T - m, p.origin[1] * T - m, (p.origin[0] + p.w) * T + m, (p.origin[1] + p.h) * T + m] as const;
/** Particelle (Points) in una scatola: posizioni casuali, colori dalla lista. */
function particelle(n: number, b: readonly [number, number, number, number], y0: number, y1: number, cols: string[], size: number): THREE.Points {
  const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), c = new THREE.Color();
  for (let i = 0; i < n; i++) {
    pos[i * 3] = b[0] + rnd() * (b[2] - b[0]); pos[i * 3 + 1] = y0 + rnd() * (y1 - y0); pos[i * 3 + 2] = b[1] + rnd() * (b[3] - b[1]);
    c.set(cols[i % cols.length]!); col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const pts = new THREE.Points(g, new THREE.PointsMaterial({ size, sizeAttenuation: false, vertexColors: true }));
  pts.frustumCulled = false;
  return pts;
}
const instColors = (im: THREE.InstancedMesh, cols: string[]) => { const c = new THREE.Color(); for (let i = 0; i < im.count; i++) im.setColorAt(i, c.set(cols[i % cols.length]!)); };
const litMat = () => new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
/** Per gli InstancedMesh colorati con setColorAt: senza vertexColors (la geometria non ha colori per vertice, verrebbe nera). */
const instMat = () => new THREE.MeshLambertMaterial({ flatShading: true });
/** Scacchiera 2×2 bianco/trasparente: con alphaTest fa il «mezzo velo» a pixel (aurora, nebbia) senza trasparenze sfumate. */
function scacchi(rx: number, ry: number): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = c.height = 2; const g = c.getContext('2d')!; g.fillStyle = '#FFFFFF'; g.fillRect(0, 0, 1, 1); g.fillRect(1, 1, 1, 1);
  const t = new THREE.CanvasTexture(c); t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry);
  return t;
}
/** Texture a pixel 32×32 (una cella da 2 m, 16 texel/m) per il mare attorno a un'isola: base, trattini d'onda, schiuma. */
function mareTex(base: string, onda: string, schiuma: string, seed: number): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = c.height = 32; const g = c.getContext('2d')!;
  let h = seed; const r = () => { h = (h * 1103515245 + 12345) & 0x7fffffff; return h / 0x7fffffff; };
  g.fillStyle = base; g.fillRect(0, 0, 32, 32);
  g.fillStyle = onda; for (let i = 0; i < 9; i++) g.fillRect(Math.floor(r() * 32), Math.floor(r() * 32), 3 + Math.floor(r() * 5), 1);
  g.fillStyle = schiuma; for (let i = 0; i < 4; i++) g.fillRect(Math.floor(r() * 32), Math.floor(r() * 32), 1 + Math.floor(r() * 2), 1);
  const t = new THREE.CanvasTexture(c); t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
/** Il mare di un'isola: una lastra per cella (girata di 90° a caso, così la texture non si ripete uguale), un solo draw call. */
function mare(cells: { x: number; z: number }[], y: number, t: THREE.Texture, name: string): THREE.Mesh {
  const g = new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2);
  const parts = cells.map((c) => g.clone().applyMatrix4(M(c.x, y, c.z, 0, Math.floor(rnd() * 4) * (Math.PI / 2), 0)));
  g.dispose();
  const m = new THREE.Mesh(merged(parts), new THREE.MeshLambertMaterial({ map: t })); m.receiveShadow = true; m.name = name;
  return m;
}

function tempesta(p: ArchPlace, map: GridMap, root: HTMLElement): Fx {
  const T = map.tile, B = p.tema!.barriera, group = new THREE.Group(); group.name = 'fx_tempesta';
  // mare scuro: profondo color abisso, l'acqua bassa vicino alla riva un tono sopra
  group.add(mare(acqua(p, map, 0, B + 16), 0.05, mareTex(P.abisso, P.acquaProfonda, P.pietraChiara, 7), 'mare_scuro'));
  group.add(mare(acqua(p, map, 0, B + 16, true).filter((c) => map.at(map.worldToCell(c.x, c.z).cx, map.worldToCell(c.x, c.z).cz) === ','), 0.05, mareTex(P.acquaProfonda, P.acqua, P.pietraChiara, 11), 'mare_basso'));
  // onde alte nella barriera: creste a prisma con la schiuma in cima, che si gonfiano e si sgonfiano
  const posti = acqua(p, map, 1, B + 8).filter(() => rnd() < 0.2);
  const cresta = new THREE.CylinderGeometry(0.9, 0.9, 4.2, 3, 1, false, Math.PI / 2).rotateZ(Math.PI / 2);
  const onda = merged([painted(cresta, P.acquaProfonda), painted(new THREE.BoxGeometry(3.6, 0.22, 0.3), P.pietraChiara, M(0, 0.85, 0))]);
  const onde = new THREE.InstancedMesh(onda, litMat(), Math.max(1, posti.length)); onde.name = 'onde'; onde.frustumCulled = false; group.add(onde);
  const fase = posti.map(() => rnd() * 6.28), ry = posti.map((c) => Math.atan2(c.x - (p.origin[0] + p.w / 2) * T, c.z - (p.origin[1] + p.h / 2) * T) + Math.PI / 2); // cresta di traverso: l'onda corre verso l'isola
  // pioggia: trattini obliqui che cadono
  const b = box(p, T, B + 12), N = 900, rain = new Float32Array(N * 6);
  for (let i = 0; i < N; i++) { const x = b[0] + rnd() * (b[2] - b[0]), z = b[1] + rnd() * (b[3] - b[1]), y = rnd() * 24; rain.set([x, y, z, x + 0.25, y + 1.3, z - 0.15], i * 6); }
  const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.BufferAttribute(rain, 3));
  const pioggia = new THREE.LineSegments(rg, new THREE.LineBasicMaterial({ color: P.pietraChiara })); pioggia.frustumCulled = false; pioggia.name = 'pioggia'; group.add(pioggia);
  // nuvole nere basse: fanno ombra sull'isola
  const nb: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 30; i++) nb.push(painted(new THREE.BoxGeometry(6 + rnd() * 10, 1.6 + rnd() * 2, 5 + rnd() * 8), [P.roccia, P.neroCaldo, P.pietraScura][i % 3]!, M(b[0] + rnd() * (b[2] - b[0]), 19 + rnd() * 5, b[1] + rnd() * (b[3] - b[1]))));
  // le nuvole non si disegnano (starebbero tra la camera e la barca): fanno solo ombra sull'isola e sul mare
  const nuvole = new THREE.Mesh(merged(nb), new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false })); nuvole.castShadow = true; nuvole.name = 'nuvole'; group.add(nuvole);
  // fulmine: zig-zag che si accende un attimo, lampo bianco sullo schermo se sei vicino
  const zz: THREE.BufferGeometry[] = []; let x = 0, y = 22, z = 0;
  for (let i = 0; i < 9; i++) {
    const nx = x + (rnd() - 0.5) * 3, ny = y - 2.5, nz = z + (rnd() - 0.5) * 2, dir = new THREE.Vector3(nx - x, ny - y, nz - z), l = dir.length();
    zz.push(painted(new THREE.BoxGeometry(0.35, l, 0.35), i % 2 ? P.giallo : P.pietraChiara, new THREE.Matrix4().compose(new THREE.Vector3((x + nx) / 2, (y + ny) / 2, (z + nz) / 2), new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize()), new THREE.Vector3(1, 1, 1))));
    x = nx; y = ny; z = nz;
  }
  const fulmine = new THREE.Mesh(merged(zz), new THREE.MeshBasicMaterial({ vertexColors: true })); fulmine.visible = false; fulmine.name = 'fulmine'; group.add(fulmine);
  const lampo = document.createElement('div'); lampo.id = 'mzLampo';
  Object.assign(lampo.style, { position: 'absolute', inset: '0', background: P.pietraChiara, opacity: '0', pointerEvents: 'none', zIndex: '9' });
  root.appendChild(lampo);
  let prossimo = 2, acceso = 0, fulmini = 0, vicino = Infinity;
  const colpo = (cx?: number, cz?: number) => {
    const c = cx !== undefined && cz !== undefined ? { x: cx, z: cz } : posti[Math.floor(rnd() * posti.length)] ?? { x: p.spawn.x, z: p.spawn.z };
    fulmine.position.set(c.x, 0, c.z); fulmine.rotation.y = rnd() * 6.28; acceso = 0.22; fulmini++;
    if (vicino < 140) lampo.style.opacity = '0.3';
  };
  const m4 = new THREE.Matrix4();
  return {
    id: p.island, group,
    update(dt, t, near) {
      vicino = near;
      for (let i = 0; i < posti.length; i++) { const s = Math.sin(t * 1.4 + fase[i]!) * 0.5 + 0.5; onde.setMatrixAt(i, m4.copy(M(posti[i]!.x, -0.55 + s * 0.45, posti[i]!.z, 0, ry[i]!, 0, 1, 0.3 + s * 0.8, 1.2))); }
      onde.instanceMatrix.needsUpdate = true;
      const a = rg.attributes.position as THREE.BufferAttribute, arr = a.array as Float32Array;
      for (let i = 0; i < N; i++) { let yy = arr[i * 6 + 1]! - 24 * dt; if (yy < 0) yy += 24; arr[i * 6 + 1] = yy; arr[i * 6 + 4] = yy + 1.3; }
      a.needsUpdate = true;
      nuvole.position.x = Math.sin(t * 0.05) * 6;
      prossimo -= dt; if (prossimo <= 0) { colpo(); prossimo = 2 + rnd() * 4; }
      if (acceso > 0) { acceso -= dt; fulmine.visible = acceso > 0.12 || (acceso > 0 && acceso < 0.07); } else fulmine.visible = false;
      if (lampo.style.opacity !== '0' && acceso < 0.14) lampo.style.opacity = '0';
    },
    respinta() { colpo(); },
    stato: () => ({ onde: posti.length, pioggia: N, fulmini, mare: true }),
  };
}

function ghiacci(p: ArchPlace, map: GridMap, aperta: () => boolean, notte: () => boolean): Fx {
  const T = map.tile, B = p.tema!.barriera, group = new THREE.Group(); group.name = 'fx_ghiacci';
  // banchisa: lastre esagonali nella barriera (e attorno all'isola) finché è chiusa
  const posti = acqua(p, map, 0, B + 8).filter(() => rnd() < 0.55);
  const banchisa = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1.08, 0.36, 6), instMat(), Math.max(1, posti.length)); banchisa.name = 'banchisa';
  posti.forEach((c, i) => { const s = 0.9 + rnd() * 1.4; banchisa.setMatrixAt(i, M(c.x + (rnd() - 0.5), 0.1, c.z + (rnd() - 0.5), 0, rnd() * 3, 0, s, 1, s)); });
  instColors(banchisa, [P.pietraChiara, P.pietra, P.acquaBassa, P.pietraChiara, P.acquaBassa]);
  banchisa.receiveShadow = true; group.add(banchisa);
  const b = box(p, T, B + 10);
  const neve = particelle(700, b, 0, 22, [P.pietraChiara, P.sabbiaChiara], 3); neve.name = 'neve'; group.add(neve);
  // aurora: tre tende a bande appena oltre la riva nord, basse (la camera guarda in giù: il cielo non entra mai nell'inquadratura,
  // così la tenda si vede sopra le scogliere di ghiaccio, contro il mare scuro), a scacchi
  const tex = scacchi(420, 40);
  const cxI = (p.origin[0] + p.w / 2) * T, tende: THREE.BufferGeometry[] = [], x0 = p.origin[0] * T - 10, x1 = (p.origin[0] + p.w) * T + 40, zN = p.origin[1] * T - 2;
  for (let k = 0; k < 3; k++) {
    const g = new THREE.PlaneGeometry(x1 - x0, 14, 32, 3).toNonIndexed(), pos = g.attributes.position!, col = new Float32Array(pos.count * 3), c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const u = pos.getX(i), v = pos.getY(i);
      pos.setXYZ(i, (x0 + x1) / 2 + u, 9 + k * 3 + v, zN - k * 9 + Math.sin(u * 0.07 + k * 1.7) * 6);
    }
    for (let i = 0; i < pos.count; i += 3) { const yy = (pos.getY(i) + pos.getY(i + 1) + pos.getY(i + 2)) / 3 - 9 - k * 3; c.set(yy < -2 ? P.verdeNeon : yy < 3 ? P.cianoNeon : P.violaNeon); for (let j = 0; j < 3; j++) col.set([c.r, c.g, c.b], (i + j) * 3); }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3)); tende.push(g);
  }
  const aurora = new THREE.Mesh(merged(tende), new THREE.MeshBasicMaterial({ vertexColors: true, map: tex, alphaTest: 0.5, side: THREE.DoubleSide, fog: false }));
  aurora.name = 'aurora'; aurora.visible = false; aurora.frustumCulled = false; group.add(aurora);
  return {
    id: p.island, group,
    update(dt, t) {
      banchisa.visible = !aperta(); // sbloccata: il mare si sgela
      const a = neve.geometry.attributes.position as THREE.BufferAttribute, arr = a.array as Float32Array;
      for (let i = 0; i < arr.length; i += 3) { let yy = arr[i + 1]! - 2.2 * dt; if (yy < 0) yy += 22; arr[i + 1] = yy; arr[i] = arr[i]! + Math.sin(t + i) * 0.4 * dt; }
      a.needsUpdate = true;
      aurora.visible = notte(); tex.offset.x = (t * 0.6) % 1; aurora.position.x = Math.sin(t * 0.1) * 4;
    },
    stato: () => ({ banchisa: banchisa.visible, aurora: aurora.visible, neve: 700 }),
  };
}

function vulcano(p: ArchPlace, map: GridMap, groundY: (x: number, z: number) => number): Fx {
  const T = map.tile, group = new THREE.Group(); group.name = 'fx_vulcano';
  // cratere: la cella di roccia più lontana dalla riva della montagna (stessa regola della resa)
  const dist = new Map<number, number>(), q: [number, number][] = [], k = (x: number, z: number) => z * 4096 + x;
  for (let cz = p.origin[1]; cz < p.origin[1] + p.h; cz++) for (let cx = p.origin[0]; cx < p.origin[0] + p.w; cx++)
    if (map.at(cx, cz) === 'r' && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => map.at(cx + dx!, cz + dz!) !== 'r')) { dist.set(k(cx, cz), 1); q.push([cx, cz]); }
  let top: [number, number] = [p.origin[0] + p.w / 2, p.origin[1] + p.h / 2], best = 0;
  for (let i = 0; i < q.length; i++) {
    const [cx, cz] = q[i]!, d = dist.get(k(cx, cz))!;
    if (d > best) { best = d; top = [cx, cz]; }
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) { const nx = cx + dx, nz = cz + dz; if (map.at(nx, nz) === 'r' && !dist.has(k(nx, nz)) && nx >= p.origin[0] && nz >= p.origin[1] && nx < p.origin[0] + p.w && nz < p.origin[1] + p.h) { dist.set(k(nx, nz), d + 1); q.push([nx, nz]); } }
  }
  const cw = map.cellToWorld(top[0], top[1]), cy = groundY(cw.x, cw.z) + 2;
  const NF = 16, fumo = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), instMat(), NF); fumo.name = 'fumo'; fumo.frustumCulled = false;
  instColors(fumo, [P.roccia, P.pietraScura, P.pietra, P.pietraScura]); fumo.castShadow = true; group.add(fumo);
  const eta = Array.from({ length: NF }, (_, i) => (i / NF) * 7);
  const b = box(p, T, 10);
  const cenere = particelle(320, b, 0, 26, [P.neroCaldo, P.pietraScura, P.roccia], 2); cenere.name = 'cenere'; group.add(cenere);
  const scintille = particelle(70, [cw.x - 3, cw.z - 3, cw.x + 3, cw.z + 3], cy, cy + 10, [P.arancio, P.giallo, P.rosso], 3); scintille.name = 'scintille'; group.add(scintille);
  let cacce = 0;
  return {
    id: p.island, group,
    update(dt, t) {
      for (let i = 0; i < NF; i++) {
        eta[i] = (eta[i]! + dt) % 7; const e = eta[i]!, s = 1 + e * 0.9;
        fumo.setMatrixAt(i, M(cw.x + e * 1.6 + Math.sin(i * 1.7 + t * 0.5) * 1.2, cy + e * 3.2, cw.z - e * 0.9 + Math.cos(i) * 1.2, i, i * 0.7, 0, s, s * 0.8, s));
      }
      fumo.instanceMatrix.needsUpdate = true;
      const a = cenere.geometry.attributes.position as THREE.BufferAttribute, arr = a.array as Float32Array;
      for (let i = 0; i < arr.length; i += 3) { let yy = arr[i + 1]! - 1.4 * dt; if (yy < 0) yy += 26; arr[i + 1] = yy; arr[i] = arr[i]! + 0.8 * dt; if (arr[i]! > b[2]) arr[i] = b[0]; }
      a.needsUpdate = true;
      const s2 = scintille.geometry.attributes.position as THREE.BufferAttribute, sa = s2.array as Float32Array;
      for (let i = 0; i < sa.length; i += 3) { let yy = sa[i + 1]! + 4 * dt; if (yy > cy + 12) { yy = cy; sa[i] = cw.x + (rnd() - 0.5) * 5; sa[i + 2] = cw.z + (rnd() - 0.5) * 5; } sa[i + 1] = yy; }
      s2.needsUpdate = true;
    },
    caccia() { cacce++; },
    stato: () => ({ fumo: NF, cratere: { x: cw.x, z: cw.z, y: cy }, cacce }),
  };
}

function giardino(p: ArchPlace, map: GridMap, scene: THREE.Scene, aperta: () => boolean): Fx {
  const T = map.tile, B = p.tema!.barriera, group = new THREE.Group(); group.name = 'fx_giardino';
  // muro di nebbia: blocchi chiari sopra l'isola e nella barriera, finché non hai la mappa
  const bb = box(p, T, B), posti: { x: number; z: number }[] = [];
  for (let i = 0; i < 260; i++) {
    const x = bb[0] + rnd() * (bb[2] - bb[0]), z = bb[1] + rnd() * (bb[3] - bb[1]);
    if (distanzaIsola(p, T, x, z).d < B - 3) posti.push({ x, z }); // la barca respinta resta fuori dalla nebbia: si vede
  }
  const nebbia = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial({ map: scacchi(36, 24), alphaTest: 0.5, flatShading: true }), Math.max(1, posti.length)); nebbia.name = 'nebbia'; nebbia.frustumCulled = false; // velo a pixel: si intravede
  instColors(nebbia, [P.pietraChiara, P.sabbiaChiara, P.pietra, P.pietraChiara]); group.add(nebbia);
  const dim = posti.map(() => [5 + rnd() * 8, 2.5 + rnd() * 4.5, 5 + rnd() * 8, rnd() * 6.28] as const);
  const b = box(p, T, 2);
  const petali = particelle(260, b, 0, 14, [P.rosaNeon, P.sabbiaChiara, P.rosaNeon, P.pietraChiara], 3); petali.name = 'petali'; group.add(petali);
  // carpe koi: nello stagno chiuso dentro l'isola (acqua bassa non collegata al mare)
  const fuori = new Set<number>(), q: [number, number][] = [], k = (x: number, z: number) => z * 4096 + x, inR = (x: number, z: number) => x >= p.origin[0] && z >= p.origin[1] && x < p.origin[0] + p.w && z < p.origin[1] + p.h;
  for (let cx = p.origin[0]; cx < p.origin[0] + p.w; cx++) for (const cz of [p.origin[1], p.origin[1] + p.h - 1]) { fuori.add(k(cx, cz)); q.push([cx, cz]); }
  for (let cz = p.origin[1]; cz < p.origin[1] + p.h; cz++) for (const cx of [p.origin[0], p.origin[0] + p.w - 1]) { fuori.add(k(cx, cz)); q.push([cx, cz]); }
  for (let i = 0; i < q.length; i++) { const [cx, cz] = q[i]!; for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) { const nx = cx + dx, nz = cz + dz, t = map.at(nx, nz); if (inR(nx, nz) && !fuori.has(k(nx, nz)) && (t === '~' || t === ',' || t === 'B')) { fuori.add(k(nx, nz)); q.push([nx, nz]); } } }
  const stagno: { x: number; z: number }[] = [];
  for (let cz = p.origin[1]; cz < p.origin[1] + p.h; cz++) for (let cx = p.origin[0]; cx < p.origin[0] + p.w; cx++) if (map.at(cx, cz) === ',' && !fuori.has(k(cx, cz))) stagno.push(map.cellToWorld(cx, cz));
  const sx = stagno.reduce((a, c) => a + c.x, 0) / Math.max(1, stagno.length), sz = stagno.reduce((a, c) => a + c.z, 0) / Math.max(1, stagno.length);
  const rx = stagno.reduce((a, c) => Math.max(a, Math.abs(c.x - sx)), 0) * 0.7, rz = stagno.reduce((a, c) => Math.max(a, Math.abs(c.z - sz)), 0) * 0.7;
  const NK = stagno.length ? 7 : 0;
  const pesce = merged([new THREE.BoxGeometry(0.28, 0.12, 0.8), new THREE.BoxGeometry(0.34, 0.06, 0.3).translate(0, 0, 0.5), new THREE.BoxGeometry(0.4, 0.04, 0.14).translate(0, 0, -0.05)]);
  const koi = new THREE.InstancedMesh(pesce, instMat(), Math.max(1, NK)); koi.count = NK; koi.name = 'koi'; koi.frustumCulled = false;
  instColors(koi, [P.arancio, P.sabbiaChiara, P.rosso, P.giallo]); group.add(koi);
  let isola: THREE.Object3D | null = null;
  scene.traverse((n) => { if (!isola && n.name.startsWith('isola_' + p.island)) isola = n; });
  const m4 = new THREE.Matrix4();
  return {
    id: p.island, group,
    update(dt, t) {
      const chiusa = !aperta();
      nebbia.visible = chiusa; if (isola) (isola as THREE.Object3D).visible = !chiusa; petali.visible = !chiusa; koi.visible = !chiusa;
      if (chiusa) {
        for (let i = 0; i < posti.length; i++) { const d = dim[i]!; nebbia.setMatrixAt(i, m4.copy(M(posti[i]!.x + Math.sin(t * 0.2 + d[3]) * 2, d[1] / 2 + Math.sin(t * 0.5 + d[3]) * 0.6, posti[i]!.z + Math.cos(t * 0.17 + d[3]) * 2, 0, d[3], 0, d[0], d[1], d[2]))); }
        nebbia.instanceMatrix.needsUpdate = true;
        return;
      }
      const a = petali.geometry.attributes.position as THREE.BufferAttribute, arr = a.array as Float32Array;
      for (let i = 0; i < arr.length; i += 3) { let yy = arr[i + 1]! - 0.9 * dt; if (yy < 0.4) yy += 14; arr[i + 1] = yy; arr[i] = arr[i]! + Math.sin(t * 1.3 + i) * 0.7 * dt; arr[i + 2] = arr[i + 2]! + 0.3 * dt; if (arr[i + 2]! > b[3]) arr[i + 2] = b[1]; }
      a.needsUpdate = true;
      for (let i = 0; i < NK; i++) {
        const sp = 0.25 + (i % 3) * 0.06, ang = t * sp * (i % 2 ? 1 : -1) + i * 0.9, r = 0.55 + (i % 4) * 0.13;
        const x = sx + Math.cos(ang) * rx * r, z = sz + Math.sin(ang) * rz * r, yaw = Math.atan2(-Math.sin(ang) * rx, Math.cos(ang) * rz) * (i % 2 ? 1 : -1);
        koi.setMatrixAt(i, m4.copy(M(x, 0.05, z, 0, (i % 2 ? Math.PI : 0) - yaw, 0)));
      }
      koi.instanceMatrix.needsUpdate = true;
    },
    stato: () => ({ nebbia: nebbia.visible, isolaNascosta: isola ? !(isola as THREE.Object3D).visible : null, koi: NK, petali: petali.visible }),
  };
}

/** Templari (docs/TEMPLARI.md §2): finché non hai la reliquia, nebbia rossastra sopra l'isola e nella barriera (nasconde l'isola, come il
 *  Giardino); aperta, cenere che cade e un giro di corvi sopra la chiesa. */
function templari(p: ArchPlace, map: GridMap, scene: THREE.Scene, aperta: () => boolean): Fx {
  const T = map.tile, B = p.tema!.barriera, group = new THREE.Group(); group.name = 'fx_templari';
  const bb = box(p, T, B), posti: { x: number; z: number }[] = [];
  for (let i = 0; i < 240; i++) {
    const x = bb[0] + rnd() * (bb[2] - bb[0]), z = bb[1] + rnd() * (bb[3] - bb[1]);
    if (distanzaIsola(p, T, x, z).d < B - 3) posti.push({ x, z });
  }
  const nebbia = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial({ map: scacchi(36, 24), alphaTest: 0.5, flatShading: true }), Math.max(1, posti.length)); nebbia.name = 'nebbia_rossa'; nebbia.frustumCulled = false;
  instColors(nebbia, [P.roccia, P.rosso, P.pietraScura, P.ombraCalda, P.roccia, P.pietraScura]); group.add(nebbia);
  const dim = posti.map(() => [5 + rnd() * 8, 2.5 + rnd() * 5, 5 + rnd() * 8, rnd() * 6.28] as const);
  const b = box(p, T, 2);
  const cenere = particelle(200, b, 0, 14, [P.pietra, P.roccia, P.pietraScura], 2); cenere.name = 'cenere'; group.add(cenere);
  const corvo = merged([new THREE.BoxGeometry(0.25, 0.15, 0.6), new THREE.BoxGeometry(1.4, 0.05, 0.3).translate(0, 0.05, 0)]);
  const NC = 7, corvi = new THREE.InstancedMesh(corvo, instMat(), NC); corvi.name = 'corvi'; corvi.frustumCulled = false;
  instColors(corvi, [P.neroCaldo]); group.add(corvi);
  let isola: THREE.Object3D | null = null;
  scene.traverse((n) => { if (!isola && n.name.startsWith('isola_' + p.island)) isola = n; });
  const cx = (p.origin[0] + p.w / 2) * T, cz = (p.origin[1] + p.h / 2) * T, m4 = new THREE.Matrix4();
  return {
    id: p.island, group,
    update(dt, t) {
      const chiusa = !aperta();
      nebbia.visible = chiusa; if (isola) (isola as THREE.Object3D).visible = !chiusa; cenere.visible = !chiusa; corvi.visible = !chiusa;
      if (chiusa) {
        for (let i = 0; i < posti.length; i++) { const d = dim[i]!; nebbia.setMatrixAt(i, m4.copy(M(posti[i]!.x + Math.sin(t * 0.15 + d[3]) * 2, d[1] / 2 + Math.sin(t * 0.4 + d[3]) * 0.6, posti[i]!.z + Math.cos(t * 0.13 + d[3]) * 2, 0, d[3], 0, d[0], d[1], d[2]))); }
        nebbia.instanceMatrix.needsUpdate = true;
        return;
      }
      const a = cenere.geometry.attributes.position as THREE.BufferAttribute, arr = a.array as Float32Array;
      for (let i = 0; i < arr.length; i += 3) { let yy = arr[i + 1]! - 0.6 * dt; if (yy < 0.4) yy += 14; arr[i + 1] = yy; arr[i] = arr[i]! + Math.sin(t * 0.9 + i) * 0.4 * dt; }
      a.needsUpdate = true;
      for (let i = 0; i < NC; i++) {
        const ang = t * (0.35 + (i % 3) * 0.07) + i * 0.9, r = 9 + (i % 4) * 2.5, flap = Math.floor(t * 6 + i) % 2 ? 0.35 : -0.25;
        corvi.setMatrixAt(i, m4.copy(M(cx + Math.cos(ang) * r, 15 + (i % 3) * 1.5, cz + Math.sin(ang) * r, 0, -ang, flap)));
      }
      corvi.instanceMatrix.needsUpdate = true;
    },
    stato: () => ({ nebbia: nebbia.visible, isolaNascosta: isola ? !(isola as THREE.Object3D).visible : null, corvi: NC, cenere: cenere.visible }),
  };
}

export function createTemiFx(o: {
  scene: THREE.Scene; arch: Archipelago; map: GridMap; loader: Loader; root: HTMLElement; groundY(x: number, z: number): number;
  aperta(id: string): boolean; notte(): boolean;
}): TemiFx {
  const fxs: (Fx & { place: ArchPlace })[] = [];
  for (const p of o.arch.places) {
    if (!p.tema) continue;
    const ap = () => o.aperta(p.island);
    const fx = p.island === 'tempesta' ? tempesta(p, o.map, o.root) : p.island === 'ghiacci' ? ghiacci(p, o.map, ap, o.notte)
      : p.island === 'vulcano' ? vulcano(p, o.map, o.groundY) : p.island === 'giardino' ? giardino(p, o.map, o.scene, ap)
      : p.island === 'templari' ? templari(p, o.map, o.scene, ap) : null;
    if (!fx) continue;
    fx.group.visible = false; o.scene.add(fx.group); fxs.push({ ...fx, place: p });
  }
  return {
    update(dt, t, f) {
      for (const fx of fxs) {
        const d = distanzaIsola(fx.place, o.map.tile, f.x, f.z).d, on = d < VISTA_M;
        fx.group.visible = on;
        if (on || fx.id === 'giardino' || fx.id === 'templari') fx.update(dt, t, d); // Giardino e Templari nascondono l'isola anche da lontano
      }
    },
    respinta(id) { fxs.find((f) => f.id === id)?.respinta?.(); },
    caccia(id) { fxs.find((f) => f.id === id)?.caccia?.(); },
    stato: () => Object.fromEntries(fxs.map((f) => [f.id, { visibile: f.group.visible, ...f.stato() }])),
  };
}
