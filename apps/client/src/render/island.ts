// Isole dalle celle della mappa (CONTRACTS §4, §11): moduli glTF dal manifest quando esistono (mod_sabbia, mod_sabbia_bordo, mod_erba,
// mod_scogliera, mod_molo, prop_*, bld_*), altrimenti blocchi e segnaposto con texture a pixel dalla palette.
// Mappa grande (arcipelago, centinaia di metri): un gruppo per isola («chunk») con un InstancedMesh per tipo di modulo, così il frustum
// culling di three scarta le isole fuori vista (anche nel passo delle ombre, che segue la camera). L'acqua profonda non si istanzia mai.
// Stili per isola: porto (piazza lastricata), neon (piattaforma di cemento e torri con finestre accese), selvaggia (vegetazione fitta);
// isole a tema (#68: tempesta, ghiacci, vulcano, giardino) con terreni loro, montagne a colonne e decorazioni da island_temi.ts.
// Scenografia deterministica da createRng(map.id) + origine dell'isola.

/** Quota del piano calpestabile (sabbia, erba, molo) e fondo dei blocchi sott'acqua. */
import * as THREE from 'three';
import { BUILDINGS } from '@marea/content';
import type { IslandStyle } from '@marea/content';
import type { GridMap, Tile } from '@marea/sim';
import { createRng } from '@marea/sim';
import type { Loader } from './loader.ts';
import { setWaterMap } from './water.ts';
import { ISLAND, P, PAINT, PROP_KINDS, PROP_MODEL, MODEL_ONLY, M, block, merged, buildingGeometry, instanced, modelParts, painted, propGeometry, tex, towerGeometry } from './island_parts.ts';
import type { Fit, PropKind } from './island_parts.ts';
import { PAINT_TEMI, SCENA_TEMI, TEMA_GLOW, TEMA_PROPS, isTema, propTema, propTemaGlow, rocceTema } from './island_temi.ts';
import type { TemaProp } from './island_temi.ts';
export { ISLAND } from './island_parts.ts';

const WATER = new Set<Tile>(['~', ',', 'B']);
const LAND = new Set<Tile>(['.', 'g', 'r', 'P', 'L']);
const isWater = (t: Tile) => WATER.has(t);
const N4: readonly [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
// Negli angoli il modulo di bordo guarda di preferenza verso la camera (sud, est): la discesa si vede, il fianco dritto resta dietro.
const BORDO_PREF: readonly [number, number][] = [[0, 1], [1, 0], [-1, 0], [0, -1]];
const key = (cx: number, cz: number) => cz * 4096 + cx;

/** Un'isola della mappa da rendere come gruppo a sé: rettangolo di celle, stile, densità della scenografia. */
export type IslandArea = { id: string; x0: number; z0: number; w: number; h: number; style?: IslandStyle | null; scenery?: number };
/** Decorazione fissa (coordinate mondo, m): `k` in torii, lanterna, insegna_neon, palma, cassa, barile, sasso, cespuglio. */
export type StaticProp = { k: string; x: number; z: number; rot: number };
/** Edificio fisso (Porto): modello `bld_<kind>_l1`. */
export type StaticBuilding = { kind: string; x: number; z: number; rot: number };
export type Island = {
  group: THREE.Group;
  groundY(x: number, z: number): number;
  props?: { kind: string; x: number; z: number }[];
  drawCalls?: number;
  chunks?: { id: string; group: THREE.Group; tris: number }[];
};

export async function createIsland(o: { map: GridMap; loader: Loader; areas?: IslandArea[]; props?: StaticProp[]; buildings?: StaticBuilding[]; paved?: readonly (readonly [number, number, number, number])[] }): Promise<Island> {
  const { map, loader } = o;
  const T = map.tile, TOP = ISLAND.TOP;
  const group = new THREE.Group(); group.name = 'island';
  setWaterMap(map); // adattatore: world.ts crea l'acqua senza mappa, qui le passiamo rive e schiuma
  const at = (cx: number, cz: number) => map.at(cx, cz);
  const areas: IslandArea[] = o.areas?.length ? o.areas : [{ id: map.id, x0: 0, z0: 0, w: map.w, h: map.h, style: null, scenery: 1 }];

  // ——— risorse condivise: texture, materiali, geometrie dei segnaposto, parti dei modelli glTF ———
  const texSeed = map.id;
  const matCache = new Map<string, THREE.Material>();
  const lambertOf = (paint: string) => {
    let m = matCache.get(paint);
    if (!m) { m = new THREE.MeshLambertMaterial({ map: tex(paint, texSeed, (PAINT[paint] ?? PAINT_TEMI[paint])!), flatShading: true }); matCache.set(paint, m); }
    return m;
  };
  const propMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  const glowMat = new THREE.MeshBasicMaterial({ vertexColors: true });
  const blockGeo = block(T, T, TOP, ISLAND.BOTTOM);
  const rockGeo = block(T, T, TOP + 2, ISLAND.BOTTOM); rockGeo.translate(0, -ISLAND.BOTTOM, 0); // base a y=0 per la scala, poi giù
  const dockGeo = block(T, T, TOP + 0.02, TOP - 0.28);
  const stepGeo = block(T, ISLAND.STEP_W, ISLAND.STEP, ISLAND.BOTTOM);
  const postGeo = painted(new THREE.CylinderGeometry(0.12, 0.14, 1.9, 6), P.legnoScuro, M(0, TOP + 0.15 - 0.95, 0));
  const propGeoCache = new Map<string, THREE.BufferGeometry>();
  const propGeo = (k: string) => { let g = propGeoCache.get(k); if (!g) { g = TEMA_PROPS.has(k) ? propTema(k as TemaProp) : propGeometry(k as PropKind); propGeoCache.set(k, g); } return g; };
  const glowGeoCache = new Map<string, THREE.BufferGeometry | null>();
  const glowGeo = (k: string) => { if (!glowGeoCache.has(k)) glowGeoCache.set(k, propTemaGlow(k as TemaProp)); return glowGeoCache.get(k) ?? null; };
  const knownProp = (k: string) => PROP_KINDS.has(k) || TEMA_PROPS.has(k);
  const bldGeoCache = new Map<string, THREE.BufferGeometry>();
  const bldGeo = (k: string) => { let g = bldGeoCache.get(k); if (!g) { g = buildingGeometry(k); bldGeoCache.set(k, g); } return g; };
  const hasMolo = loader.has('mod_molo'), hasRockMod = loader.has('mod_scogliera'), hasBordo = loader.has('mod_sabbia_bordo');

  const rockTop = new Map<number, number>();
  const pavedAll = new Set<number>();
  for (const [x0, z0, x1, z1] of o.paved ?? []) for (let cz = z0; cz <= z1; cz++) for (let cx = x0; cx <= x1; cx++) pavedAll.add(key(cx, cz));
  const blockedGlobal = new Set<number>();
  const block1 = (set: Set<number>, cx: number, cz: number, r: number) => { for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) set.add(key(cx + dx, cz + dz)); };
  // Decorazioni fisse ed edifici bloccano la scenografia casuale attorno a sé.
  for (const p of o.props ?? []) { const c = map.worldToCell(p.x, p.z); block1(blockedGlobal, c.cx, c.cz, 0); }
  for (const b of o.buildings ?? []) { const c = map.worldToCell(b.x, b.z); block1(blockedGlobal, c.cx, c.cz, 1); }
  const areaOf = (x: number, z: number) => {
    const c = map.worldToCell(x, z);
    return areas.findIndex((a) => c.cx >= a.x0 && c.cz >= a.z0 && c.cx < a.x0 + a.w && c.cz < a.z0 + a.h);
  };
  const propsOut: { kind: string; x: number; z: number }[] = [];
  const jobs: Promise<void>[] = [];
  const chunks: { id: string; group: THREE.Group; tris: number }[] = [];

  const groundY = (x: number, z: number): number => {
    const c = map.worldToCell(x, z), t = at(c.cx, c.cz);
    if (t === 'r') return rockTop.get(c.cz * map.w + c.cx) ?? TOP + 1;
    return LAND.has(t) || t === 'd' ? TOP : 0;
  };

  for (const [ai, area] of areas.entries()) {
    const style = area.style ?? null, dens = area.scenery ?? 1;
    const chunk = new THREE.Group(); chunk.name = 'isola_' + area.id + (areas.length > 1 ? '_' + ai : '');
    group.add(chunk);
    const add = (objs: (THREE.Object3D | null)[] | null) => { for (const ob of objs ?? []) if (ob) chunk.add(ob); };
    const model = (name: string, mats: THREE.Matrix4[], fit: Fit, cast: boolean, fallback: () => THREE.Object3D | null) => {
      if (!mats.length) return;
      jobs.push(modelParts(loader, name, fit).then((parts) => {
        if (!parts) { add([fallback()]); return; }
        add(parts.map((q) => instanced(q.geo, q.mat, mats, name, cast)));
      }));
    };
    const rng = createRng(`${map.id}:${area.x0},${area.z0}`);
    const cellRng = rng.fork('celle');
    const inArea = (cx: number, cz: number) => cx >= area.x0 && cz >= area.z0 && cx < area.x0 + area.w && cz < area.z0 + area.h;

    // ——— celle ———
    const sand: THREE.Matrix4[] = [], sandEdge: THREE.Matrix4[] = [], grass: THREE.Matrix4[] = [], rock: THREE.Matrix4[] = [], dock: THREE.Matrix4[] = [];
    const steps: THREE.Matrix4[] = [], posts: THREE.Matrix4[] = [], rockMod: THREE.Matrix4[] = [], paved: THREE.Matrix4[] = [], concrete: THREE.Matrix4[] = [];
    const towerCells: { cx: number; cz: number }[] = [];
    const tema = isTema(style) ? style : null; // isole a tema: blocchi dipinti (niente moduli glTF del villaggio) e montagne a colonne
    const tSand: THREE.Matrix4[] = [], tGrass: THREE.Matrix4[] = [], tRock: { cx: number; cz: number }[] = [];
    const bordoCells = new Set<number>(), pavedCells = new Set<number>();
    for (let cz = area.z0; cz < area.z0 + area.h; cz++) for (let cx = area.x0; cx < area.x0 + area.w; cx++) {
      const t = at(cx, cz);
      if (t === '~') continue; // acqua profonda: la fa lo shader dell'acqua, niente istanze
      const { x, z } = map.cellToWorld(cx, cz);
      const spin = cellRng.int(0, 3) * (Math.PI / 2); // rotazione a 90°: la texture non si ripete uguale
      if ((t === '.' || t === 'P' || t === 'L') && pavedAll.has(key(cx, cz))) { paved.push(M(x, 0, z, 0, spin)); pavedCells.add(key(cx, cz)); }
      else if (tema && (t === '.' || t === 'P' || t === 'g' || t === 'L')) { (t === 'g' || t === 'L' ? tGrass : tSand).push(M(x, 0, z, 0, spin)); }
      else if (tema && t === 'r') { tRock.push({ cx, cz }); rockTop.set(cz * map.w + cx, TOP + 2); continue; }
      else if (t === '.' || t === 'P') {
        if (style === 'neon') { concrete.push(M(x, 0, z, 0, spin)); continue; } // banchina: niente scalino di sabbia
        const water = BORDO_PREF.find(([dx, dz]) => isWater(at(cx + dx, cz + dz)));
        if (water && hasBordo) { sandEdge.push(M(x, 0, z, 0, Math.atan2(-water[0], -water[1]))); bordoCells.add(key(cx, cz)); }
        else sand.push(M(x, 0, z, 0, spin));
      } else if (t === 'g' || t === 'L') grass.push(M(x, 0, z, 0, spin));
      else if (t === 'r') {
        if (style === 'neon') { towerCells.push({ cx, cz }); rockTop.set(cz * map.w + cx, TOP + 6); continue; }
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
      if (LAND.has(t) && style !== 'neon') {
        for (const [dx, dz] of N4) {
          if (!isWater(at(cx + dx, cz + dz)) || bordoCells.has(key(cx, cz))) continue; // il modulo di bordo fa già la sua riva
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

    // ——— scenografia casuale: palme, cespugli, sassi, casse e barili; mai su slot L (e impronta dell'edificio), spawn, molo, lastricato ———
    const blocked = new Set<number>();
    const maxW = Math.max(1, ...BUILDINGS.map((b) => b.size[0])), maxD = Math.max(1, ...BUILDINGS.map((b) => b.size[1]));
    const docks: { cx: number; cz: number }[] = [], spawns: { cx: number; cz: number }[] = [], boats: { cx: number; cz: number }[] = [];
    for (let cz = area.z0; cz < area.z0 + area.h; cz++) for (let cx = area.x0; cx < area.x0 + area.w; cx++) {
      const t = at(cx, cz);
      if (t === 'L') for (let dz = -1; dz <= maxD; dz++) for (let dx = -1; dx <= maxW; dx++) blocked.add(key(cx + dx, cz + dz));
      else if (t === 'd') { docks.push({ cx, cz }); block1(blocked, cx, cz, 1); }
      else if (t === 'P') { spawns.push({ cx, cz }); block1(blocked, cx, cz, 2); }
      else if (t === 'B') { boats.push({ cx, cz }); block1(blocked, cx, cz, 1); }
    }
    // Corridoio spawn → molo più vicino libero.
    for (const s of spawns) {
      let d = docks[0]; for (const q of docks) if (d && Math.abs(q.cx - s.cx) + Math.abs(q.cz - s.cz) < Math.abs(d.cx - s.cx) + Math.abs(d.cz - s.cz)) d = q;
      if (!d) continue;
      const n = Math.max(Math.abs(d.cx - s.cx), Math.abs(d.cz - s.cz));
      for (let i = 0; i <= n; i++) block1(blocked, Math.round(s.cx + ((d.cx - s.cx) * i) / Math.max(1, n)), Math.round(s.cz + ((d.cz - s.cz) * i) / Math.max(1, n)), 1);
    }
    const propRng = rng.fork('scenografia');
    const placed: Record<string, THREE.Matrix4[]> = {};
    for (const k of [...PROP_KINDS, ...TEMA_PROPS]) placed[k] = [];
    // montagne delle isole a tema: quota per distanza dalla riva della montagna (prima della scenografia, che poggia su groundY)
    if (tema && tRock.length) {
      const dist = new Map<number, number>(), q: { cx: number; cz: number }[] = [];
      for (const c of tRock) if (N4.some(([dx, dz]) => at(c.cx + dx, c.cz + dz) !== 'r')) { dist.set(key(c.cx, c.cz), 1); q.push(c); }
      for (let i = 0; i < q.length; i++) {
        const c = q[i]!, d = dist.get(key(c.cx, c.cz))!;
        for (const [dx, dz] of N4) { const n = { cx: c.cx + dx, cz: c.cz + dz }; if (at(n.cx, n.cz) === 'r' && inArea(n.cx, n.cz) && !dist.has(key(n.cx, n.cz))) { dist.set(key(n.cx, n.cz), d + 1); q.push(n); } }
      }
      const cells = tRock.map((c) => { const w = map.cellToWorld(c.cx, c.cz); return { x: w.x, z: w.z, d: dist.get(key(c.cx, c.cz)) ?? 1, key: c.cz * map.w + c.cx }; });
      const rr = rocceTema(tema, cells, rng.fork('montagne'));
      for (const [k, h] of rr.tops) rockTop.set(k, h);
      if (rr.body) { const m = new THREE.Mesh(rr.body, propMat); m.castShadow = m.receiveShadow = true; m.name = 'montagne_' + tema; chunk.add(m); }
      if (rr.glow) { const m = new THREE.Mesh(rr.glow, glowMat); m.name = 'lava'; chunk.add(m); }
    }
    const near = (cx: number, cz: number, set: (t: Tile) => boolean, r: number) => { for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) if (set(at(cx + dx, cz + dz))) return true; return false; };
    if (dens > 0) for (let cz = area.z0; cz < area.z0 + area.h; cz++) for (let cx = area.x0; cx < area.x0 + area.w; cx++) {
      const t = at(cx, cz);
      if (t !== '.' && t !== 'g') continue;
      const roll = propRng.next(), jx = propRng.next() - 0.5, jz = propRng.next() - 0.5, rot = propRng.next() * Math.PI * 2, sc = 0.85 + propRng.next() * 0.35;
      const k0 = key(cx, cz);
      if (blocked.has(k0) || blockedGlobal.has(k0) || pavedCells.has(k0)) continue;
      const shore = near(cx, cz, isWater, 1), byRock = near(cx, cz, (u) => u === 'r', 1), byDock = docks.some((d) => Math.abs(d.cx - cx) + Math.abs(d.cz - cz) <= 3);
      const k = Math.min(dens, 3);
      let kind: string | null = null;
      if (tema) {
        let acc = 0;
        for (const [k2, p2] of SCENA_TEMI[tema][t === '.' ? 'sabbia' : 'erba']) { acc += p2 * Math.min(dens, 3); if (roll < acc) { kind = k2; break; } }
        if (kind === 'sasso' && !shore && !byRock && t === '.') kind = null;
      } else if (t === '.') {
        if (byDock && roll < 0.28 * Math.min(1, k)) kind = roll < 0.14 * Math.min(1, k) ? 'cassa' : 'barile';
        else if (!shore && roll < 0.16 * k) kind = 'palma';
        else if (shore && roll < 0.05 * k) kind = 'sasso';
      } else {
        if (byRock && roll < 0.3 * Math.min(1, k)) kind = 'sasso';
        else if (roll < 0.07 * k) kind = 'palma';
        else if (roll < 0.17 * k) kind = 'cespuglio';
        else if (roll < 0.2 * k) kind = 'sasso';
      }
      if (!kind) continue;
      const { x, z } = map.cellToWorld(cx, cz);
      const px0 = x + jx * 0.9, pz0 = z + jz * 0.9;
      const tilt = kind === 'palma' || kind === 'albero_secco' ? 0.1 : 0;
      placed[kind]?.push(M(px0, TOP, pz0, 0, rot, tilt, sc, sc, sc));
      propsOut.push({ kind, x: +px0.toFixed(2), z: +pz0.toFixed(2) });
    }
    // Decorazioni fisse di quest'isola.
    for (const p of o.props ?? []) {
      if (!knownProp(p.k) || areaOf(p.x, p.z) !== ai) continue;
      placed[p.k]!.push(M(p.x, groundY(p.x, p.z), p.z, 0, p.rot));
    }

    // ——— mesh: glTF se c'è, altrimenti segnaposto ———
    const blk = (paint: string, mats: THREE.Matrix4[], name: string, geo = blockGeo, cast = false) => () => instanced(geo, lambertOf(paint), mats, name, cast);
    model('mod_sabbia', sand, 'terrain', false, blk('sabbia', sand, 'sabbia'));
    model('mod_sabbia_bordo', sandEdge, 'terrain', false, blk('sabbia', sandEdge, 'sabbia_bordo'));
    model('mod_erba', grass, 'terrain', false, blk('erba', grass, 'erba'));
    model('mod_scogliera', rockMod, 'terrain', true, () => instanced(rockGeo, lambertOf('roccia'), rock.map((m) => m.clone().premultiply(new THREE.Matrix4().makeTranslation(0, ISLAND.BOTTOM, 0))), 'scogliera', true));
    model('mod_molo', dock, 'terrain', true, blk('molo', dock, 'molo', dockGeo, true));
    add([instanced(blockGeo, lambertOf('lastricato'), paved, 'lastricato', false), instanced(blockGeo, lambertOf('cemento'), concrete, 'cemento', false)]);
    if (tema) add([instanced(blockGeo, lambertOf(tema + '_sabbia'), tSand, tema + '_sabbia', false), instanced(blockGeo, lambertOf(tema + '_erba'), tGrass, tema + '_erba', false)]);
    add([instanced(stepGeo, lambertOf(tema ? tema + '_riva' : 'riva'), steps, 'riva', false)]);
    add([instanced(postGeo, propMat, posts, 'pali', true)]);
    // isole a tema: le decorazioni procedurali sono ferme, quindi una sola geometria (più una che brilla) per isola: 2 draw call invece di ~15
    if (tema) {
      const body: THREE.BufferGeometry[] = [], hot: THREE.BufferGeometry[] = [];
      for (const kind of Object.keys(placed)) {
        if (!TEMA_PROPS.has(kind) && kind !== 'sasso' && kind !== 'cespuglio') continue;
        const gg = TEMA_GLOW.has(kind) ? glowGeo(kind) : null;
        for (const m of placed[kind]!) { body.push(propGeo(kind).clone().applyMatrix4(m)); if (gg) hot.push(gg.clone().applyMatrix4(m)); }
        placed[kind] = [];
      }
      if (body.length) { const m = new THREE.Mesh(merged(body), propMat); m.castShadow = m.receiveShadow = true; m.name = 'decorazioni_' + tema; chunk.add(m); }
      if (hot.length) { const m = new THREE.Mesh(merged(hot), glowMat); m.name = 'luci_' + tema; chunk.add(m); }
    }
    for (const kind of Object.keys(placed)) {
      const mats = placed[kind]!, name = PROP_MODEL[kind as PropKind];
      if (!mats.length) continue;
      if (name) model(name, mats, 'prop', true, () => (MODEL_ONLY.has(kind) ? null : instanced(propGeo(kind), propMat, mats, kind, true)));
      else add([instanced(propGeo(kind), propMat, mats, kind, true)]);
      const gg = TEMA_GLOW.has(kind) ? glowGeo(kind) : null;
      if (gg) add([instanced(gg, glowMat, mats, kind + '_luce', false)]);
    }
    // Edifici fissi (Porto): un InstancedMesh per tipo.
    const bld = new Map<string, THREE.Matrix4[]>();
    for (const b of o.buildings ?? []) {
      if (areaOf(b.x, b.z) !== ai) continue;
      const list = bld.get(b.kind) ?? []; list.push(M(b.x, TOP, b.z, 0, b.rot)); bld.set(b.kind, list);
    }
    for (const [kind, mats] of bld) {
      // Modelli del Porto (M1-asset) se ci sono, poi l'edificio L1 dello stesso tipo, poi il segnaposto.
      const name = [`bld_porto_${kind}`, `bld_${kind}_l1`, `bld_${kind.replace(/_[a-z]$/, '')}_l1`].find((n) => loader.has(n)) ?? `bld_${kind}_l1`;
      model(name, mats, 'prop', true, () => instanced(bldGeo(kind), propMat, mats, 'bld_' + kind, true));
    }
    // Distretto Neon: torri per blocco (altezza di base per blocco, ±1 piano per cella), finestre accese non illuminate.
    if (towerCells.length) {
      const blockId = new Map<number, number>(); let nb = 0;
      for (const c of towerCells) {
        if (blockId.has(key(c.cx, c.cz))) continue;
        const q = [c]; blockId.set(key(c.cx, c.cz), nb);
        while (q.length) { const u = q.pop()!; for (const [dx, dz] of N4) { const v = { cx: u.cx + dx, cz: u.cz + dz }; if (at(v.cx, v.cz) === 'r' && inArea(v.cx, v.cz) && !blockId.has(key(v.cx, v.cz))) { blockId.set(key(v.cx, v.cz), nb); q.push(v); } } }
        nb++;
      }
      const tr = rng.fork('torri');
      const base = Array.from({ length: nb }, () => tr.int(2, 5));
      const tone = Array.from({ length: nb }, () => tr.int(0, 1));
      const cells = towerCells.map((c) => {
        const b = blockId.get(key(c.cx, c.cz))!, w = map.cellToWorld(c.cx, c.cz), floors = base[b]! + (tr.next() < 0.3 ? 1 : 0);
        rockTop.set(c.cz * map.w + c.cx, TOP + floors * 3);
        return { x: w.x, z: w.z, floors, tone: tone[b]! };
      });
      const g = towerGeometry(cells, tr);
      if (g.body) { const m = new THREE.Mesh(g.body, propMat); m.castShadow = m.receiveShadow = true; m.name = 'torri'; chunk.add(m); }
      if (g.lights) { const m = new THREE.Mesh(g.lights, glowMat); m.name = 'luci_neon'; chunk.add(m); }
    }
    chunks.push({ id: area.id, group: chunk, tris: 0 });
  }
  await Promise.all(jobs);

  let calls = 0;
  for (const c of chunks) c.group.traverse((n) => {
    const m = n as THREE.Mesh; if (!m.isMesh) return; calls++;
    const g = m.geometry, tri = (g.index ? g.index.count : g.attributes.position!.count) / 3;
    c.tris += Math.round(tri * ((m as THREE.InstancedMesh).isInstancedMesh ? (m as THREE.InstancedMesh).count : 1));
  });
  return { group, groundY, props: propsOut, drawCalls: calls, chunks };
}
