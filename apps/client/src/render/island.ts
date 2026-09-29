// Isola dalle celle della mappa (CONTRACTS §4): moduli glTF dal manifest quando esistono (mod_sabbia, mod_sabbia_bordo, mod_erba,
// mod_scogliera, mod_molo, prop_palma, prop_barile, prop_cassa), altrimenti blocchi e segnaposto con texture a pixel dalla palette.
// Un InstancedMesh per tipo: l'isola intera sta in ≤ 12 draw call. Scenografia deterministica da createRng(map.id).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createRng } from '@marea/sim';
import { BUILDINGS } from '@marea/content';
import type { GridMap, Tile, Rng } from '@marea/sim';
import type { Loader } from './loader.ts';
import { setWaterMap } from './water.ts';

/** Quota del piano calpestabile (sabbia, erba, molo) e fondo dei blocchi sott'acqua. */
export const ISLAND = { TOP: 0.4, BOTTOM: -1.2, STEP: 0.12, STEP_W: 0.6 } as const;
const P = {
  sabbiaChiara: '#F4E3C1', sabbia: '#E2B97F', legnoChiaro: '#C98A4B', legno: '#8E5A2B', legnoScuro: '#5A3A1E', ombraCalda: '#2E1E14',
  erbaChiara: '#D9E872', erba: '#8FC35B', erbaScura: '#4E9A46', bosco: '#2C6B3F', boscoOmbra: '#1E4A3A',
  pietraChiara: '#E8E1D6', pietra: '#B9AFA3', pietraScura: '#7F7568', roccia: '#4A4340',
} as const;
const WATER = new Set<Tile>(['~', ',', 'B']);
const LAND = new Set<Tile>(['.', 'g', 'r', 'P', 'L']);
const isWater = (t: Tile) => WATER.has(t);
const N4: readonly [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
// Negli angoli il modulo di bordo guarda di preferenza verso la camera (sud, est): la discesa si vede, il fianco dritto resta dietro.
const BORDO_PREF: readonly [number, number][] = [[0, 1], [1, 0], [-1, 0], [0, -1]];

// ——— texture procedurali a pixel (16 texel/m): 32×64, metà alta = faccia superiore (2×2 m), metà bassa = fianco (2 m) ———
type Painter = (g: CanvasRenderingContext2D, r: Rng) => void;
function tex(label: string, seed: string, paint: Painter): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = 32; c.height = 64;
  const g = c.getContext('2d')!;
  paint(g, createRng(seed + ':' + label));
  const t = new THREE.CanvasTexture(c);
  t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}
const px = (g: CanvasRenderingContext2D, c: string, x: number, y: number, w = 1, h = 1) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
const speckle = (g: CanvasRenderingContext2D, r: Rng, c: string, n: number, y0: number, y1: number, w = 1, h = 1) => { for (let i = 0; i < n; i++) px(g, c, r.int(0, 31), r.int(y0, y1 - h), w, h); };
/** Fianco: lista di [colore, righe] dall'alto; tra una fascia e l'altra una riga a scacchi (dithering tra colori adiacenti). */
function strata(g: CanvasRenderingContext2D, bands: [string, number][]): void {
  let y = 32;
  for (const [c, n] of bands) { px(g, c, 0, y, 32, 64 - y); y += n; }
  y = 32;
  for (let i = 0; i < bands.length - 1; i++) { y += bands[i]![1]; for (let x = (y & 1); x < 32; x += 2) px(g, bands[i]![0], x, y); }
}
const PAINT: Record<string, Painter> = {
  sabbia: (g, r) => { px(g, P.sabbia, 0, 0, 32, 32); speckle(g, r, P.sabbiaChiara, 46, 0, 32); speckle(g, r, P.legnoChiaro, 10, 0, 32); strata(g, [[P.sabbia, 3], [P.legnoChiaro, 5], [P.legno, 32]]); speckle(g, r, P.sabbiaChiara, 8, 32, 36); },
  erba: (g, r) => {
    px(g, P.erba, 0, 0, 32, 32); speckle(g, r, P.erbaChiara, 26, 0, 32); speckle(g, r, P.erbaScura, 22, 0, 32, 1, 2);
    strata(g, [[P.erbaScura, 3], [P.legno, 7], [P.legnoScuro, 32]]);
    for (let x = 0; x < 32; x++) if (r.next() < 0.45) px(g, P.erbaScura, x, 35, 1, r.int(1, 2)); // frangia d'erba che scende sul fianco
    speckle(g, r, P.legnoChiaro, 10, 38, 48);
  },
  roccia: (g, r) => {
    px(g, P.pietra, 0, 0, 32, 32); speckle(g, r, P.pietraChiara, 30, 0, 32, 2, 1); speckle(g, r, P.pietraScura, 22, 0, 32, 1, 1);
    strata(g, [[P.pietra, 2], [P.pietraScura, 6], [P.roccia, 5], [P.pietraScura, 5], [P.roccia, 32]]);
    speckle(g, r, P.pietra, 14, 36, 60, 2, 1); speckle(g, r, P.roccia, 10, 34, 50, 1, 2);
  },
  molo: (g, r) => {
    for (let y = 0; y < 32; y += 4) { px(g, y % 8 ? P.legnoChiaro : P.legno, 0, y, 32, 3); px(g, P.legnoScuro, 0, y + 3, 32, 1); }
    speckle(g, r, P.legnoScuro, 10, 0, 32); px(g, P.legnoScuro, 3, 0, 1, 32); px(g, P.legnoScuro, 28, 0, 1, 32); // chiodi e travi
    strata(g, [[P.legno, 3], [P.legnoScuro, 32]]);
  },
  riva: (g, r) => { px(g, P.sabbiaChiara, 0, 0, 32, 32); speckle(g, r, P.sabbia, 60, 0, 32); strata(g, [[P.sabbia, 2], [P.legnoChiaro, 32]]); },
};

/** Blocco con UV per 16 texel/m: faccia sopra nella metà alta della texture, fianchi nella metà bassa (riga 0 = bordo superiore). */
function block(w: number, d: number, top: number, bottom: number): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(w, top - bottom, d); g.translate(0, (top + bottom) / 2, 0);
  const pos = g.attributes.position!, nor = g.attributes.normal!, uv = g.attributes.uv!;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i), nx = nor.getX(i), ny = nor.getY(i);
    if (ny > 0.5) uv.setXY(i, (x + w / 2) / 2, 1 - ((z + d / 2) / 2) * 0.5);
    else if (ny < -0.5) uv.setXY(i, 0.5, 0.02);
    else uv.setXY(i, ((Math.abs(nx) > 0.5 ? z : x) + 1) / 2, 0.5 - (top - y) / 4);
  }
  return g;
}

// ——— segnaposto dei prop (colori per vertice dalla palette, un materiale condiviso) ———
function painted(geo: THREE.BufferGeometry, color: string, m?: THREE.Matrix4): THREE.BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo;
  if (m) g.applyMatrix4(m);
  g.deleteAttribute('uv');
  const c = new THREE.Color(color), n = g.attributes.position!.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return g;
}
const M = (x: number, y: number, z: number, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) =>
  new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));
function propGeometry(kind: PropKind): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  if (kind === 'palma') {
    // Tronco a 3 segmenti leggermente curvi, ciuffo di 6 foglie cadenti, cocchi.
    parts.push(painted(new THREE.CylinderGeometry(0.15, 0.2, 1.2, 5), P.legnoChiaro, M(0, 0.6, 0)));
    parts.push(painted(new THREE.CylinderGeometry(0.13, 0.16, 1.2, 5), P.legno, M(0.08, 1.75, 0, 0, 0, -0.12)));
    parts.push(painted(new THREE.CylinderGeometry(0.11, 0.14, 1.1, 5), P.legnoChiaro, M(0.25, 2.85, 0, 0, 0, -0.2)));
    // Foglie a due tratti: la base sale appena, la punta ricade (più stretta). 7 foglie a raggiera, due verdi alternati.
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + (i % 2) * 0.2, c = i % 2 ? P.erbaScura : P.erba;
      const root = M(0.35, 3.4, 0, 0, a, 0);
      const base = new THREE.BoxGeometry(0.34, 0.05, 0.9); base.translate(0, 0, 0.45);
      parts.push(painted(base, c, root.clone().multiply(M(0, 0, 0, -0.25, 0, 0))));
      const tip = new THREE.BoxGeometry(0.22, 0.05, 0.85); tip.translate(0, 0, 0.42);
      parts.push(painted(tip, c, root.clone().multiply(M(0, 0.2, 0.87, 0.75, 0, 0))));
    }
    parts.push(painted(new THREE.IcosahedronGeometry(0.2, 0), P.legnoScuro, M(0.35, 3.2, 0)));
  } else if (kind === 'cespuglio') {
    parts.push(painted(new THREE.IcosahedronGeometry(0.55, 0), P.erbaScura, M(0, 0.35, 0, 0, 0, 0, 1, 0.75, 1)));
    parts.push(painted(new THREE.IcosahedronGeometry(0.38, 0), P.bosco, M(0.45, 0.25, 0.2, 0, 0.6, 0, 1, 0.8, 1)));
    parts.push(painted(new THREE.IcosahedronGeometry(0.3, 0), P.erba, M(-0.3, 0.45, -0.25)));
  } else if (kind === 'sasso') {
    parts.push(painted(new THREE.DodecahedronGeometry(0.5, 0), P.pietra, M(0, 0.22, 0, 0.3, 0, 0.2, 1.1, 0.65, 0.85)));
    parts.push(painted(new THREE.DodecahedronGeometry(0.28, 0), P.pietraScura, M(0.5, 0.12, 0.25, 0.5, 0.4, 0)));
  } else if (kind === 'cassa') {
    parts.push(painted(new THREE.BoxGeometry(0.8, 0.8, 0.8), P.legnoChiaro, M(0, 0.4, 0)));
    parts.push(painted(new THREE.BoxGeometry(0.84, 0.12, 0.84), P.legno, M(0, 0.62, 0)));
    parts.push(painted(new THREE.BoxGeometry(0.84, 0.12, 0.84), P.legno, M(0, 0.18, 0)));
  } else {
    parts.push(painted(new THREE.CylinderGeometry(0.34, 0.34, 0.95, 8), P.legno, M(0, 0.475, 0)));
    parts.push(painted(new THREE.CylinderGeometry(0.37, 0.37, 0.1, 8), P.legnoScuro, M(0, 0.25, 0)));
    parts.push(painted(new THREE.CylinderGeometry(0.37, 0.37, 0.1, 8), P.legnoScuro, M(0, 0.72, 0)));
  }
  const g = mergeGeometries(parts)!;
  for (const p of parts) p.dispose();
  return g;
}
type PropKind = 'palma' | 'cespuglio' | 'sasso' | 'cassa' | 'barile';
const PROP_MODEL: Partial<Record<PropKind, string>> = { palma: 'prop_palma', cassa: 'prop_cassa', barile: 'prop_barile' };

/** Quota della faccia rivolta in su con più area (il piano calpestabile di un modulo). */
function floorY(geos: THREE.BufferGeometry[]): number {
  const hist = new Map<number, number>();
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3();
  for (const g of geos) {
    const pos = g.attributes.position!, idx = g.index, tri = idx ? idx.count / 3 : pos.count / 3;
    for (let i = 0; i < tri; i++) {
      const i0 = idx ? idx.getX(i * 3) : i * 3, i1 = idx ? idx.getX(i * 3 + 1) : i * 3 + 1, i2 = idx ? idx.getX(i * 3 + 2) : i * 3 + 2;
      a.fromBufferAttribute(pos, i0); b.fromBufferAttribute(pos, i1); c.fromBufferAttribute(pos, i2);
      n.subVectors(c, b).cross(b.clone().sub(a).negate());
      const area = n.length() / 2; if (area < 1e-6) continue;
      if (Math.abs(n.y) / (2 * area) < 0.95) continue;
      const y = Math.round(((a.y + b.y + c.y) / 3) * 100) / 100;
      hist.set(y, (hist.get(y) ?? 0) + area);
    }
  }
  let best: number = ISLAND.TOP, bestA = -1;
  for (const [y, ar] of hist) if (ar > bestA) { bestA = ar; best = y; }
  return best;
}

// ——— moduli glTF → InstancedMesh (un InstancedMesh per sotto-mesh del modello) ———
type Fit = 'terrain' | 'prop';
async function fromModel(loader: Loader, name: string, mats: THREE.Matrix4[], fit: Fit): Promise<THREE.Object3D[] | null> {
  if (!mats.length || !loader.has(name)) return null;
  try {
    const { scene } = await loader.load(name);
    scene.updateMatrixWorld(true);
    const parts: { geo: THREE.BufferGeometry; mat: THREE.Material | THREE.Material[] }[] = [];
    scene.traverse((n) => { const m = n as THREE.Mesh; if (m.isMesh && !(m as THREE.SkinnedMesh).isSkinnedMesh) parts.push({ geo: m.geometry.clone().applyMatrix4(m.matrixWorld), mat: m.material }); });
    if (!parts.length) return null;
    const box = new THREE.Box3();
    for (const p of parts) { p.geo.computeBoundingBox(); box.union(p.geo.boundingBox!); }
    const size = box.getSize(new THREE.Vector3()), ctr = box.getCenter(new THREE.Vector3());
    const align = new THREE.Matrix4();
    if (fit === 'terrain') {
      // Moduli WP5: 2×2 m, pivot a terra (base a y = 0 = livello del mare). I moduli calpestabili si allineano per il piano
      // (la faccia in su più grande: 0,4 sabbia, 0,6 erba, 0,5 molo) a ISLAND.TOP, dove oggi sta l'avatar; la scogliera resta com'è.
      const sx = Math.abs(size.x - 2) > 0.3 ? 2 / size.x : 1, sz = Math.abs(size.z - 2) > 0.3 ? 2 / size.z : 1;
      const dy = name === 'mod_scogliera' ? -box.min.y : ISLAND.TOP - floorY(parts.map((q) => q.geo));
      align.makeScale(sx, 1, sz).premultiply(new THREE.Matrix4().makeTranslation(-ctr.x * sx, dy, -ctr.z * sz));
    } else align.makeTranslation(0, -box.min.y, 0); // prop: poggia a terra
    const out: THREE.Object3D[] = [];
    for (const p of parts) {
      p.geo.applyMatrix4(align);
      const im = new THREE.InstancedMesh(p.geo, p.mat, mats.length);
      mats.forEach((m, i) => im.setMatrixAt(i, m));
      im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere();
      im.castShadow = fit === 'prop' || name === 'mod_scogliera' || name === 'mod_molo'; im.receiveShadow = true; im.name = name;
      out.push(im);
    }
    return out;
  } catch (e) { console.warn(String((e as Error)?.message ?? e), '→ segnaposto'); return null; }
}

function instanced(geo: THREE.BufferGeometry, mat: THREE.Material, mats: THREE.Matrix4[], name: string, cast: boolean): THREE.InstancedMesh | null {
  if (!mats.length) return null;
  const im = new THREE.InstancedMesh(geo, mat, mats.length);
  mats.forEach((m, i) => im.setMatrixAt(i, m));
  im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere();
  im.castShadow = cast; im.receiveShadow = true; im.name = name;
  return im;
}

export type Island = { group: THREE.Group; groundY(x: number, z: number): number; props?: { kind: string; x: number; z: number }[]; drawCalls?: number };

export async function createIsland(o: { map: GridMap; loader: Loader }): Promise<Island> {
  const { map, loader } = o;
  const T = map.tile, TOP = ISLAND.TOP;
  const group = new THREE.Group(); group.name = 'island';
  setWaterMap(map); // adattatore: world.ts crea l'acqua senza mappa, qui le passiamo rive e schiuma
  const rng = createRng(map.id);
  const at = (cx: number, cz: number) => map.at(cx, cz);
  const lambert = (t: THREE.Texture) => new THREE.MeshLambertMaterial({ map: t, flatShading: true });

  // ——— celle ———
  const sand: THREE.Matrix4[] = [], sandEdge: THREE.Matrix4[] = [], grass: THREE.Matrix4[] = [], rock: THREE.Matrix4[] = [], dock: THREE.Matrix4[] = [];
  const steps: THREE.Matrix4[] = [], posts: THREE.Matrix4[] = [], rockMod: THREE.Matrix4[] = [];
  const hasMolo = loader.has('mod_molo'), hasRockMod = loader.has('mod_scogliera');
  const bordoSide = new Map<number, number>(); // celle di sabbia fatte col modulo di bordo → lato (indice in BORDO_PREF) verso l'acqua
  const rockTop = new Map<number, number>();
  const hasBordo = loader.has('mod_sabbia_bordo');
  const cellRng = rng.fork('celle');
  for (let cz = 0; cz < map.h; cz++) for (let cx = 0; cx < map.w; cx++) {
    const t = at(cx, cz), { x, z } = map.cellToWorld(cx, cz);
    const spin = cellRng.int(0, 3) * (Math.PI / 2); // rotazione a 90°: la texture non si ripete uguale
    if (t === '.' || t === 'P') {
      const water = BORDO_PREF.find(([dx, dz]) => isWater(at(cx + dx, cz + dz)));
      if (water && hasBordo) { sandEdge.push(M(x, 0, z, 0, Math.atan2(-water[0], -water[1]))); bordoSide.set(cz * map.w + cx, BORDO_PREF.indexOf(water)); }
      else sand.push(M(x, 0, z, 0, spin));
    } else if (t === 'g' || t === 'L') grass.push(M(x, 0, z, 0, spin));
    else if (t === 'r') {
      // Scogliera a gradoni: 1,0-2,4 m sopra il piano, a passi di 0,4 m.
      const h = 1.0 + cellRng.int(0, 3) * 0.45;
      rockTop.set(cz * map.w + cx, TOP + h);
      rock.push(M(x, 0, z, 0, spin, 0, 1, (TOP + h - ISLAND.BOTTOM) / (TOP + 2 - ISLAND.BOTTOM), 1));
      const wide = 1.2 + cellRng.next() * 0.15; // massi un po' più larghi della cella: si incastrano e chiudono le pieghe a V
      rockMod.push(M(x, 0, z, 0, spin + cellRng.next() * 0.5, 0, wide, (TOP + h) / 1.82, wide)); // modulo WP5 alto 1,82 m dalla base a y = 0
      if (hasRockMod) grass.push(M(x, -0.05, z, 0, spin)); // sotto i massi (che rientrano verso la cima) c'è prato, non acqua
    } else if (t === 'd') {
      dock.push(M(x, 0, z));
      const landN = N4.filter(([dx, dz]) => LAND.has(at(cx + dx, cz + dz))).length;
      if (landN >= 2) sand.push(M(x, -0.12, z)); // molo sopra la spiaggia: sotto c'è sabbia, non un buco d'acqua
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
        const wet = [at(cx + sx, cz), at(cx, cz + sz), at(cx + sx, cz + sz)].some(isWater);
        if (wet && !hasMolo) posts.push(M(x + sx * (T / 2 - 0.18), 0, z + sz * (T / 2 - 0.18)));
      }
    }
    // Scalino di sabbia verso l'acqua su ogni lato di terra che tocca l'acqua (niente sul molo, niente se c'è il modulo di bordo).
    if (LAND.has(t)) {
      for (const [dx, dz] of N4) {
        if (!isWater(at(cx + dx, cz + dz)) || bordoSide.has(cz * map.w + cx)) continue; // il modulo di bordo fa già la sua riva
        const along = dx !== 0 ? 'z' : 'x';
        // Angolo convesso: allunga lo scalino per chiudere lo spigolo.
        const ext0 = along === 'x' ? isWater(at(cx - 1, cz)) : isWater(at(cx, cz - 1));
        const ext1 = along === 'x' ? isWater(at(cx + 1, cz)) : isWater(at(cx, cz + 1));
        const len = T + (ext0 ? ISLAND.STEP_W : 0) + (ext1 ? ISLAND.STEP_W : 0);
        const shift = ((ext1 ? ISLAND.STEP_W : 0) - (ext0 ? ISLAND.STEP_W : 0)) / 2;
        const lift = dx !== 0 ? 0.012 : 0; // due quote diverse: niente z-fighting negli angoli concavi
        const ox = x + dx * (T / 2 + ISLAND.STEP_W / 2) + (along === 'x' ? shift : 0);
        const oz = z + dz * (T / 2 + ISLAND.STEP_W / 2) + (along === 'z' ? shift : 0);
        steps.push(along === 'x' ? M(ox, lift, oz, 0, 0, 0, len / T, 1, 1) : M(ox, lift, oz, 0, Math.PI / 2, 0, len / T, 1, 1));
      }
    }
  }

  // ——— scenografia: palme, cespugli, sassi, casse e barili; mai su slot L (e impronta dell'edificio), spawn, molo e vie di passaggio ———
  const blocked = new Set<number>();
  const block1 = (cx: number, cz: number, r: number) => { for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) blocked.add((cz + dz) * 1000 + cx + dx); };
  const maxW = Math.max(1, ...BUILDINGS.map((b) => b.size[0])), maxD = Math.max(1, ...BUILDINGS.map((b) => b.size[1]));
  for (const l of map.lots) for (let dz = -1; dz <= maxD; dz++) for (let dx = -1; dx <= maxW; dx++) blocked.add((l.cz + dz) * 1000 + l.cx + dx);
  const spawnC = map.worldToCell(map.spawn.x, map.spawn.z), boatC = map.worldToCell(map.boatSpawn.x, map.boatSpawn.z);
  block1(spawnC.cx, spawnC.cz, 2); block1(boatC.cx, boatC.cz, 1);
  const docks: { cx: number; cz: number }[] = [];
  for (let cz = 0; cz < map.h; cz++) for (let cx = 0; cx < map.w; cx++) if (at(cx, cz) === 'd') { docks.push({ cx, cz }); block1(cx, cz, 1); }
  // Corridoio spawn → molo libero.
  for (const d of docks.slice(0, 1)) {
    const n = Math.max(Math.abs(d.cx - spawnC.cx), Math.abs(d.cz - spawnC.cz));
    for (let i = 0; i <= n; i++) block1(Math.round(spawnC.cx + ((d.cx - spawnC.cx) * i) / Math.max(1, n)), Math.round(spawnC.cz + ((d.cz - spawnC.cz) * i) / Math.max(1, n)), 1);
  }
  const propRng = rng.fork('scenografia');
  const placed: Record<PropKind, THREE.Matrix4[]> = { palma: [], cespuglio: [], sasso: [], cassa: [], barile: [] };
  const propsOut: { kind: string; x: number; z: number }[] = [];
  const near = (cx: number, cz: number, set: (t: Tile) => boolean, r: number) => { for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) if (set(at(cx + dx, cz + dz))) return true; return false; };
  for (let cz = 0; cz < map.h; cz++) for (let cx = 0; cx < map.w; cx++) {
    const t = at(cx, cz);
    const roll = propRng.next(), jx = propRng.next() - 0.5, jz = propRng.next() - 0.5, rot = propRng.next() * Math.PI * 2, sc = 0.85 + propRng.next() * 0.35;
    if ((t !== '.' && t !== 'g') || blocked.has(cz * 1000 + cx)) continue;
    const shore = near(cx, cz, isWater, 1), byRock = near(cx, cz, (u) => u === 'r', 1), byDock = docks.some((d) => Math.abs(d.cx - cx) + Math.abs(d.cz - cz) <= 3);
    let kind: PropKind | null = null;
    if (t === '.') {
      if (byDock && roll < 0.28) kind = roll < 0.14 ? 'cassa' : 'barile';
      else if (!shore && roll < 0.16) kind = 'palma';
      else if (shore && roll < 0.05) kind = 'sasso';
    } else {
      if (byRock && roll < 0.3) kind = 'sasso';
      else if (roll < 0.07) kind = 'palma';
      else if (roll < 0.17) kind = 'cespuglio';
      else if (roll < 0.2) kind = 'sasso';
    }
    if (!kind) continue;
    const { x, z } = map.cellToWorld(cx, cz);
    const px0 = x + jx * 0.9, pz0 = z + jz * 0.9;
    const tilt = kind === 'palma' ? 0.1 : 0;
    placed[kind].push(M(px0, TOP, pz0, 0, rot, tilt, sc, sc, sc));
    propsOut.push({ kind, x: +px0.toFixed(2), z: +pz0.toFixed(2) });
  }

  // ——— mesh: glTF se c'è, altrimenti segnaposto ———
  const add = (objs: (THREE.Object3D | null)[] | null) => { for (const ob of objs ?? []) if (ob) group.add(ob); };
  const texSeed = map.id;
  const jobs: Promise<void>[] = [];
  const terrain = (name: string, mats: THREE.Matrix4[], fallback: () => THREE.Object3D | null) => {
    jobs.push(fromModel(loader, name, mats, 'terrain').then((r) => add(r ?? [fallback()])));
  };
  terrain('mod_sabbia', sand, () => instanced(block(T, T, TOP, ISLAND.BOTTOM), lambert(tex('sabbia', texSeed, PAINT.sabbia!)), sand, 'sabbia', false));
  terrain('mod_sabbia_bordo', sandEdge, () => instanced(block(T, T, TOP, ISLAND.BOTTOM), lambert(tex('sabbia', texSeed, PAINT.sabbia!)), sandEdge, 'sabbia_bordo', false));
  terrain('mod_erba', grass, () => instanced(block(T, T, TOP, ISLAND.BOTTOM), lambert(tex('erba', texSeed, PAINT.erba!)), grass, 'erba', false));
  jobs.push(fromModel(loader, 'mod_scogliera', rockMod, 'terrain').then((r) => add(r ?? [rockFallback()])));
  const rockFallback = () => {
    const g = block(T, T, TOP + 2, ISLAND.BOTTOM); g.translate(0, -ISLAND.BOTTOM, 0); // base a y=0 per la scala, poi giù
    return instanced(g, lambert(tex('roccia', texSeed, PAINT.roccia!)), rock.map((m) => m.clone().premultiply(new THREE.Matrix4().makeTranslation(0, ISLAND.BOTTOM, 0))), 'scogliera', true);
  };
  terrain('mod_molo', dock, () => instanced(block(T, T, TOP + 0.02, TOP - 0.28), lambert(tex('molo', texSeed, PAINT.molo!)), dock, 'molo', true));
  add([instanced(block(T, ISLAND.STEP_W, ISLAND.STEP, ISLAND.BOTTOM), lambert(tex('riva', texSeed, PAINT.riva!)), steps, 'riva', false)]);
  const propMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  add([instanced(painted(new THREE.CylinderGeometry(0.12, 0.14, 1.9, 6), P.legnoScuro, M(0, TOP + 0.15 - 0.95, 0)), propMat, posts, 'pali', true)]);
  for (const kind of Object.keys(placed) as PropKind[]) {
    const mats = placed[kind], model = PROP_MODEL[kind];
    jobs.push((model ? fromModel(loader, model, mats, 'prop') : Promise.resolve(null)).then((r) => add(r ?? [instanced(propGeometry(kind), propMat, mats, kind, true)])));
  }
  await Promise.all(jobs);

  let calls = 0; group.traverse((n) => { if ((n as THREE.Mesh).isMesh) calls++; });
  const groundY = (x: number, z: number): number => {
    const c = map.worldToCell(x, z), t = at(c.cx, c.cz);
    if (t === 'r') return rockTop.get(c.cz * map.w + c.cx) ?? TOP + 1;
    return LAND.has(t) || t === 'd' ? TOP : 0;
  };
  return { group, groundY, props: propsOut, drawCalls: calls };
}
