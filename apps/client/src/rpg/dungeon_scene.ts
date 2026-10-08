// Scena del dungeon (R-scena, CONTRACTS §15): pavimenti, muri, colonne, torce e scala dal kit dello stile, tutto in InstancedMesh (poche
// draw call). Muri tra camera ed eroe: la camera guarda da sud-est, quindi i muri a sud/est di un pavimento sono sempre `muro_basso` e i
// muri alti in una fascia davanti all'eroe (verso la camera) si abbassano mentre ci passi. Buio a scatti (niente nebbia liscia): ogni cella
// ha un livello di luce a gradini (vista diretta vicina / media / lontana / già vista); quelle mai viste non si disegnano.
// Luci: emisferica scura + direzionale debole + lanterna sull'eroe + 4 PointLight spostate sulle torce/scala più vicine.
// Drenaggio: kit in codice (rpg/drenaggio.ts) finché mancano i modelli, e l'acqua dei bacini (un blocco per cella, alto 0,6 m) che scende
// a gradini quando si gira la valvola (`setAcque`).
import * as THREE from 'three';
import { dungeonDef } from '@marea/content/rpg.ts';
import type { DungeonDef } from '@marea/content/rpg.ts';
import { lineOfSight, parseDungeon } from '@marea/sim/dungeon/map.ts';
import type { DMap } from '@marea/sim/dungeon/map.ts';
import type { Loader } from '../render/loader.ts';
import { PAL } from '../ui/style.ts';
import { boxPart, cellHash, parts } from './dungeon_kit.ts';
import type { Part } from './dungeon_kit.ts';
import { kitDrenaggio } from './drenaggio.ts';

export type DungeonScene = {
  scene: THREE.Scene; map: DMap; def: DungeonDef; floorY: number;
  /** Ogni frame: luce, muri, torce. */
  update(hx: number, hz: number, t: number): void;
  /** Altare acceso (l'ultimo toccato, -1 = nessuno): il suo cristallo si illumina. */
  setAltare(n: number): void;
  /** SALVA riuscito sulla lanterna n: lampo di luce che torna normale in un secondo, a scatti. */
  pulse(n: number): void;
  /** Livello di luce della cella in (x, z): 0 = mai vista, 0.25 = vista prima, ≥ 0.45 = in vista ora. */
  light(x: number, z: number): number;
  /** Drenaggio: livello dell'acqua di ogni bacino (1 pieno, 0 asciutto), dalla vista. */
  setAcque(a: readonly { n: number; livello: number }[]): void;
  stats(): { floors: number; walls: number; low: number; lights: number; seen: number; altari: number; altareAcceso: number };
  dispose(): void;
};

const LV = { near: 1, mid: 0.72, far: 0.46, seen: 0.24 } as const;
const R_NEAR = 8, R_MID = 13, R_FAR = 19; // m
const STYLE: Record<string, { floor: string; wall: string; top: number; lantern: string; hemi: [string, string, number] }> = {
  grotta: { floor: PAL.roccia, wall: PAL.pietraScura, top: 0.05, lantern: PAL.arancio, hemi: [PAL.pietraScura, PAL.ombraCalda, 1.3] },
  cripta: { floor: PAL.pietraScura, wall: PAL.pietra, top: 0.01, lantern: PAL.arancio, hemi: [PAL.pietra, PAL.ombraCalda, 1.2] },
  vuoto: { floor: PAL.abisso, wall: PAL.viola, top: 0.1, lantern: PAL.viola, hemi: [PAL.abisso, PAL.neroCaldo, 1.4] },
  drenaggio: { floor: PAL.pietraScura, wall: PAL.roccia, top: 0.05, lantern: PAL.arancio, hemi: [PAL.acquaProfonda, PAL.ombraCalda, 1.35] },
};

/** Un tipo di modulo istanziato su più celle: una InstancedMesh per parte, stessa numerazione; nascondere = scala 0. */
type Batch = { meshes: THREE.InstancedMesh[]; cells: number[]; base: THREE.Matrix4[]; shown: boolean[]; scaleY: number[]; dirty: boolean };
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);

function makeBatch(ps: Part[], cells: number[], base: THREE.Matrix4[], name: string, group: THREE.Group): Batch {
  const meshes = ps.map((p) => {
    const im = new THREE.InstancedMesh(p.geo, p.mat, Math.max(1, cells.length));
    im.count = cells.length; im.name = name; im.castShadow = false; im.receiveShadow = false; im.frustumCulled = false;
    for (let i = 0; i < cells.length; i++) { im.setMatrixAt(i, ZERO); im.setColorAt(i, new THREE.Color(0, 0, 0)); }
    group.add(im); return im;
  });
  return { meshes, cells, base, shown: cells.map(() => false), scaleY: cells.map(() => 1), dirty: true };
}
const tmp = new THREE.Matrix4(), sc = new THREE.Matrix4(), col = new THREE.Color();
function setInst(b: Batch, i: number, level: number, scaleY = 1): void {
  const show = level > 0;
  if (show !== b.shown[i] || scaleY !== b.scaleY[i]) {
    b.shown[i] = show; b.scaleY[i] = scaleY;
    const m = show ? (scaleY === 1 ? b.base[i]! : tmp.multiplyMatrices(b.base[i]!, sc.makeScale(1, scaleY, 1))) : ZERO;
    for (const im of b.meshes) im.setMatrixAt(i, m);
  }
  col.setScalar(level);
  for (const im of b.meshes) im.setColorAt(i, col);
  b.dirty = true;
}
function flush(b: Batch): void {
  if (!b.dirty) return;
  b.dirty = false;
  for (const im of b.meshes) { im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; }
}

export async function createDungeonScene(loader: Loader, id: string): Promise<DungeonScene> {
  const def = dungeonDef(id), map = parseDungeon(def), T = map.tile, W = map.w, H = map.h;
  const st = STYLE[def.stile] ?? STYLE['grotta']!;
  const scene = new THREE.Scene(); scene.name = 'dungeon_' + id;
  scene.background = new THREE.Color(PAL.neroCaldo);
  const group = new THREE.Group(); group.name = 'kit'; scene.add(group);
  const ch = (cx: number, cz: number): string => def.rows[cz]?.[cx] ?? ' ';
  const isFloor = (cx: number, cz: number) => cx >= 0 && cz >= 0 && cx < W && cz < H && ch(cx, cz) !== '#' && ch(cx, cz) !== ' ';
  const isCol = (cx: number, cz: number) => !!def.legenda[ch(cx, cz)]?.colonna;
  const center = (cx: number, cz: number) => new THREE.Vector3((cx + 0.5) * T, 0, (cz + 0.5) * T);
  const place = (cx: number, cz: number, rotQ: number) => new THREE.Matrix4().compose(center(cx, cz), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotQ * Math.PI / 2), new THREE.Vector3(1, 1, 1));

  // ---- celle ----
  const floors: number[] = [], walls: number[] = [], cols: number[] = [], lightsAt: number[] = [], bones: number[] = [];
  for (let cz = 0; cz < H; cz++) for (let cx = 0; cx < W; cx++) {
    const i = cz * W + cx, c = ch(cx, cz);
    if (isFloor(cx, cz)) {
      floors.push(i);
      if (isCol(cx, cz)) cols.push(i);
      if (def.legenda[c]?.luce) lightsAt.push(i);
      if (c === '.' && def.stile !== 'vuoto' && cellHash(cx, cz, 7) < 0.035 && Math.abs(cx - map.exit.cx) + Math.abs(cz - map.exit.cz) > 3) bones.push(i);
    } else if (c === '#') {
      let touches = false;
      for (let dz = -1; dz <= 1 && !touches; dz++) for (let dx = -1; dx <= 1; dx++) if (isFloor(cx + dx, cz + dz)) { touches = true; break; }
      if (touches) walls.push(i);
    }
  }
  // muro basso fisso: il pavimento sta a nord o a ovest del muro (il muro è tra la camera e chi cammina lì)
  const lowFixed = walls.map((i) => { const cx = i % W, cz = (i - cx) / W; return isFloor(cx, cz - 1) || isFloor(cx - 1, cz) || isFloor(cx - 1, cz - 1); });

  const k = def.stile;
  const [pFloor, pWall, pLow, pCol, pTorch, pExit, pBones] = await Promise.all([
    parts(loader, `dng_${k}_pavimento`), parts(loader, `dng_${k}_muro`), parts(loader, `dng_${k}_muro_basso`),
    parts(loader, k === 'vuoto' ? 'dng_cristallo' : 'dng_colonna'), parts(loader, 'dng_torcia'), parts(loader, 'dng_scala'), parts(loader, 'dng_ossa'),
  ]);
  const rot = (i: number) => Math.floor(cellHash(i % W, Math.floor(i / W), 3) * 4);
  const mats = (list: number[], r: (i: number) => number) => list.map((i) => place(i % W, Math.floor(i / W), r(i)));
  const dk = k === 'drenaggio' ? kitDrenaggio(st.top) : null; // segnaposto in codice finché non ci sono i modelli dng_drenaggio_*
  const bFloor = makeBatch(pFloor ?? dk?.pavimento ?? [boxPart(T, 0.3, T, -0.3 + st.top, st.floor)], floors, mats(floors, rot), 'pavimento', group);
  const bWall = makeBatch(pWall ?? dk?.muro ?? [boxPart(T, 2.4, T, 0, st.wall)], walls, mats(walls, rot), 'muro', group);
  const bLow = makeBatch(pLow ?? dk?.muro_basso ?? [boxPart(T, 0.6, T, 0, st.wall)], walls, mats(walls, rot), 'muro_basso', group);
  const bCol = makeBatch((dk ? dk.colonna : pCol) ?? [boxPart(0.9, 2.4, 0.9, 0, st.wall)], cols, mats(cols, rot), 'colonna', group);
  // acqua dei bacini: un batch per bacino, scala in altezza = livello a gradini (0 = asciutto, non si disegna)
  const acque = map.bacini.map((b) => {
    const base = b.celle.map((i) => place(i % W, Math.floor(i / W), rot(i)).multiply(new THREE.Matrix4().makeTranslation(0, st.top, 0)));
    return { n: b.n, celle: b.celle, scala: 1, batch: makeBatch(dk?.acqua ?? [boxPart(T, 0.6, T, 0, PAL.acqua)], b.celle, base, 'acqua_' + b.n, group) };
  });
  const bBones = makeBatch(pBones ?? [boxPart(0.6, 0.12, 0.3, 0, PAL.pietraChiara)], bones, mats(bones, (i) => cellHash(i, 0, 9) * 4), 'ossa', group);

  // ---- torce: sul muro accanto alla cella «luce» (meglio nord/ovest, che restano alti), altrimenti un braciere a terra ----
  const torchMats: THREE.Matrix4[] = [], braziers: THREE.Vector3[] = [];
  const sources: { x: number; z: number; c: string; i: number; cell: number }[] = [];
  for (const i of lightsAt) {
    const cx = i % W, cz = (i - cx) / W;
    const side = ([[0, -1], [-1, 0], [1, 0], [0, 1]] as const).find(([dx, dz]) => ch(cx + dx, cz + dz) === '#');
    if (side && pTorch) {
      const [dx, dz] = side, pos = center(cx, cz).add(new THREE.Vector3(dx * T / 2, 0, dz * T / 2));
      torchMats.push(new THREE.Matrix4().compose(pos, new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(dx, dz)), new THREE.Vector3(1, 1, 1)));
      sources.push({ x: pos.x - dx * 0.5, z: pos.z - dz * 0.5, c: PAL.arancio, i: 1, cell: i });
    } else { braziers.push(center(cx, cz)); sources.push({ x: (cx + 0.5) * T, z: (cz + 0.5) * T, c: PAL.arancio, i: 1, cell: i }); }
  }
  const torchCells = lightsAt.filter((i) => { const cx = i % W, cz = (i - cx) / W; return !!pTorch && ([[0, -1], [-1, 0], [1, 0], [0, 1]] as const).some(([dx, dz]) => ch(cx + dx, cz + dz) === '#'); });
  const bTorch = makeBatch(pTorch ?? [boxPart(0.2, 0.5, 0.2, 1.5, PAL.arancio, true)], torchCells, torchMats, 'torcia', group);
  const bBraz = makeBatch([boxPart(0.7, 0.55, 0.7, 0, PAL.roccia), boxPart(0.42, 0.3, 0.42, 0.55, PAL.arancio, true), boxPart(0.22, 0.25, 0.22, 0.85, PAL.giallo, true)],
    lightsAt.filter((i) => !torchCells.includes(i)), braziers.map((p) => new THREE.Matrix4().makeTranslation(p.x, 0, p.z)), 'braciere', group);

  // ---- scala d'uscita, girata verso lo spawn, con la sua luce gialla sempre tra le candidate ----
  const exitCell = map.exit.cz * W + map.exit.cx;
  const sdx = Math.round((map.spawn.x - map.exit.x) / T), sdz = Math.round((map.spawn.z - map.exit.z) / T);
  const exitM = new THREE.Matrix4().compose(center(map.exit.cx, map.exit.cz), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(-sdx, -sdz)), new THREE.Vector3(1, 1, 1));
  const bExit = makeBatch(pExit ?? [boxPart(1.4, 0.4, 1.8, 0, PAL.legno), boxPart(1.4, 0.4, 1.2, 0.4, PAL.legno), boxPart(1.4, 0.4, 0.6, 0.8, PAL.legnoChiaro)], [exitCell], [exitM], 'scala', group);
  sources.push({ x: map.exit.x, z: map.exit.z, c: PAL.giallo, i: 1.3, cell: exitCell });

  // ---- altari di salvataggio: piedistallo di pietra e cristallo (spento abisso; acceso, l'ultimo toccato, acqua bassa luminosa) ----
  // segnaposto fatto di box finché non c'è un modello dng_altare; si vedono sempre, come la scala: sono i punti sicuri del dungeon
  const altarCells = map.altari.map((a) => a.cz * W + a.cx), altarM = altarCells.map((i) => place(i % W, Math.floor(i / W), 0));
  const bAltare = makeBatch([boxPart(1.1, 0.3, 1.1, 0, PAL.pietraScura), boxPart(0.7, 0.5, 0.7, 0.3, PAL.pietra)], altarCells, altarM, 'altare', group);
  const bCristOff = makeBatch([boxPart(0.3, 0.6, 0.3, 0.8, PAL.abisso)], altarCells, altarM, 'altare_spento', group);
  const bCristOn = makeBatch([boxPart(0.36, 0.75, 0.36, 0.8, PAL.acquaBassa, true)], altarCells, altarM, 'altare_acceso', group);
  const altarSrc = map.altari.map((a, n) => { const src = { x: a.x, z: a.z, c: PAL.acquaBassa, i: 0.4, cell: altarCells[n]! }; sources.push(src); return src; });
  let altarOn = -1, pulseN = -1, pulseT0 = -1;
  const batches = [bFloor, bWall, bLow, bCol, bBones, bTorch, bBraz, bExit, bAltare, bCristOff, bCristOn, ...acque.map((a) => a.batch)];
  const acquaSu = (a: (typeof acque)[number], lv: (i: number) => number) => a.celle.forEach((i, n) => setInst(a.batch, n, a.scala > 0 ? lv(i) : 0, a.scala));

  // ---- luci ----
  const hemi = new THREE.HemisphereLight(st.hemi[0], st.hemi[1], st.hemi[2]);
  const amb = new THREE.AmbientLight(PAL.viola, 0.12);
  const dir = new THREE.DirectionalLight(PAL.sabbia, 0.55); dir.position.set(14, 30, 18); scene.add(dir, dir.target);
  const lantern = new THREE.PointLight(st.lantern, 14, 9, 1.6); lantern.position.set(0, 2.4, 0);
  const pool = [0, 1, 2, 3].map(() => { const l = new THREE.PointLight(PAL.arancio, 0, 10, 1.6); scene.add(l); return l; });
  scene.add(hemi, amb, lantern);

  // ---- luce a gradini per cella ----
  const level = new Float32Array(W * H), seen = new Uint8Array(W * H);
  let lastCell = -1, seenN = 0, lowN = 0;
  const cellOfXZ = (x: number, z: number) => { const cx = Math.floor(x / T), cz = Math.floor(z / T); return cx < 0 || cz < 0 || cx >= W || cz >= H ? -1 : cz * W + cx; };
  function relight(hx: number, hz: number, hc: number): void {
    const hcx = hc % W, hcz = (hc - hcx) / W, R = Math.ceil(R_FAR / T);
    level.fill(0);
    for (let cz = Math.max(0, hcz - R); cz <= Math.min(H - 1, hcz + R); cz++) for (let cx = Math.max(0, hcx - R); cx <= Math.min(W - 1, hcx + R); cx++) {
      if (!isFloor(cx, cz)) continue;
      const x = (cx + 0.5) * T, z = (cz + 0.5) * T, d = Math.sqrt((x - hx) ** 2 + (z - hz) ** 2);
      if (d > R_FAR) continue;
      // le colonne sono opache: la loro cella si vede se si vede quella accanto (le prova da quattro lati)
      const i = cz * W + cx;
      const vis = isCol(cx, cz) ? [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => isFloor(cx + dx!, cz + dz!) && !isCol(cx + dx!, cz + dz!) && lineOfSight(map, hx, hz, x + dx! * T, z + dz! * T)) : lineOfSight(map, hx, hz, x, z);
      if (!vis) continue;
      level[i] = d < R_NEAR ? LV.near : d < R_MID ? LV.mid : LV.far;
      if (!seen[i]) { seen[i] = 1; seenN++; }
    }
    // muri: luce del pavimento vicino più luminoso (o «già visto»)
    for (const i of walls) {
      const cx = i % W, cz = (i - cx) / W; let best = 0;
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) { const j = (cz + dz) * W + cx + dx; if (cx + dx >= 0 && cz + dz >= 0 && cx + dx < W && cz + dz < H && isFloor(cx + dx, cz + dz)) best = Math.max(best, level[j]!); }
      level[i] = best; if (best > 0 && !seen[i]) { seen[i] = 1; seenN++; }
    }
    const lv = (i: number) => level[i]! > 0 ? level[i]! : seen[i] ? LV.seen : 0;
    floors.forEach((i, n) => setInst(bFloor, n, lv(i)));
    lowN = 0;
    walls.forEach((i, n) => {
      const cx = i % W, cz = (i - cx) / W, dx = cx - hcx, dz = cz - hcz;
      // fascia verso la camera (sud-est dell'eroe): anche i muri alti lì diventano bassi
      const low = lowFixed[n]! || (dx + dz >= 1 && dx + dz <= 6 && Math.abs(dx - dz) <= 3);
      if (low) lowN++;
      setInst(bWall, n, low ? 0 : lv(i)); setInst(bLow, n, low ? lv(i) : 0);
    });
    cols.forEach((i, n) => { const cx = i % W, cz = (i - cx) / W, dx = cx - hcx, dz = cz - hcz; setInst(bCol, n, lv(i), dx + dz >= 1 && dx + dz <= 4 && Math.abs(dx - dz) <= 2 ? 0.3 : 1); });
    bones.forEach((i, n) => setInst(bBones, n, lv(i)));
    torchCells.forEach((i, n) => setInst(bTorch, n, Math.max(lv(i), seen[i] ? 1 : 0)));
    bBraz.cells.forEach((i, n) => setInst(bBraz, n, seen[i] ? 1 : 0));
    setInst(bExit, 0, Math.max(lv(exitCell), LV.seen)); // la scala si vede sempre: è da lì che si esce
    altarCells.forEach((i, n) => {
      const l = Math.max(lv(i), LV.seen);
      setInst(bAltare, n, l); setInst(bCristOff, n, n === altarOn ? 0 : l); setInst(bCristOn, n, n === altarOn ? 1 : 0);
    });
    for (const a of acque) acquaSu(a, lv);
    for (const b of batches) flush(b);
  }
  const lvOra = (i: number) => (level[i]! > 0 ? level[i]! : seen[i] ? LV.seen : 0);

  let poolT = -1;
  const api: DungeonScene = {
    scene, map, def, floorY: st.top,
    update(hx, hz, t) {
      const hc = cellOfXZ(hx, hz);
      if (hc >= 0 && hc !== lastCell) { lastCell = hc; relight(hx, hz, hc); }
      lantern.position.set(hx, 2.4, hz);
      if (pulseN >= 0 && altarSrc[pulseN]) {
        if (pulseT0 < 0) pulseT0 = t;
        const k = Math.ceil((1 - (t - pulseT0)) * 6) / 6; // 6 gradini
        altarSrc[pulseN]!.i = k > 0 ? 1.1 + 3.5 * k : pulseN === altarOn ? 1.1 : 0.4;
        if (k <= 0) pulseN = -1;
        poolT = -1;
      }
      dir.target.position.set(hx, 0, hz); dir.position.set(hx + 14, 30, hz + 18);
      // fiamme che tremano a scatti (8 al secondo), non in modo liscio
      const step = Math.floor(t * 8);
      if (step !== poolT) {
        poolT = step;
        const near = sources.filter((s) => seen[s.cell]).map((s) => ({ s, d: (s.x - hx) ** 2 + (s.z - hz) ** 2 })).sort((a, b) => a.d - b.d).slice(0, pool.length);
        pool.forEach((l, n) => {
          const q = near[n];
          if (!q || q.d > 26 * 26) { l.intensity = 0; return; }
          l.color.set(q.s.c); l.position.set(q.s.x, 1.9, q.s.z);
          l.intensity = 22 * q.s.i * (0.9 + 0.2 * cellHash(step, n, 5));
        });
      }
    },
    setAltare(n) {
      if (n === altarOn) return;
      altarOn = n;
      altarSrc.forEach((src, k) => (src.i = k === n ? 1.1 : 0.4));
      lastCell = -1; poolT = -1; // rifà luce e lampade al prossimo update
    },
    pulse(n) { pulseN = n; pulseT0 = -1; },
    setAcque(liv) {
      for (const a of acque) {
        const l = liv.find((x) => x.n === a.n)?.livello ?? 1, scala = Math.ceil(Math.max(0, Math.min(1, l)) * 6) / 6; // 6 gradini
        if (scala === a.scala) continue;
        a.scala = scala; acquaSu(a, lvOra); flush(a.batch);
      }
    },
    light: (x, z) => { const i = cellOfXZ(x, z); return i < 0 ? 0 : level[i]! > 0 ? level[i]! : seen[i] ? LV.seen : 0; },
    stats: () => ({ floors: floors.length, walls: walls.length, low: lowN, lights: pool.filter((l) => l.intensity > 0).length, seen: seenN, altari: altarCells.length, altareAcceso: altarOn }),
    dispose() {
      for (const b of batches) for (const im of b.meshes) im.dispose(); // le geometrie restano nella cache del kit (prossima discesa)
      scene.clear();
    },
  };
  return api;
}
