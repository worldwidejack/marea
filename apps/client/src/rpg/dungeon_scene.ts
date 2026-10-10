// Scena del dungeon (R-scena, CONTRACTS §15; motore rifatto in #208): pavimenti, muri, colonne, torce e scala dal kit dello stile, tutto in
// InstancedMesh (poche draw call) e tutto FERMO: mentre cammini niente cambia forma né sparisce.
// - Muri: la camera guarda da sud-est, quindi i muri a sud/est di un pavimento sono sempre `muro_basso`; gli altri sono alti, sempre.
//   Quello che sta tra la camera e l'eroe lo apre la finestra (render/finestra.ts): un cerchio a retino attorno all'eroe, continuo.
// - Buio: nebbia a celle in una texture (rpg/dungeon_luce.ts): mai visto = nero, già visto = scuro, in vista = chiaro; cambia con una
//   dissolvenza a pixel. Solo i muri fermano la vista (dietro una colonna il pavimento c'è).
// - Luci: emisferica scura + direzionale debole + lanterna sull'eroe (luci vere, sempre le stesse: niente luci che saltano da una torcia
//   all'altra); torce, bracieri, scala e altari sono cotti nella texture a gradini, col tremolio a scatti. L'altare acceso e il lampo del
//   SALVA hanno una luce vera in più.
// Ogni stile ha il suo kit (dng_<stile>_*); se mancano i modelli, segnaposto in codice: Drenaggio (rpg/drenaggio.ts: acqua dei bacini che
// scende a gradini con la valvola, `setAcque`), Archivio (rpg/archivio.ts: scaffali al posto delle colonne, rastrelliere a grata sulle celle
// `grata`), Fucina (rpg/fucina.ts: presse a vapore, la Colata Maestra è un bacino di lava), Mausoleo (rpg/mausoleo.ts: colonne di marmo con
// l'ingranaggio, il cancello del Santuario è un bacino di sbarre). Per un dungeon nuovo: una riga in STYLE e, se serve, un kit in codice.
import * as THREE from 'three';
import { dungeonDef } from '@marea/content/rpg.ts';
import type { DungeonDef } from '@marea/content/rpg.ts';
import { parseDungeon } from '@marea/sim/dungeon/map.ts';
import type { DMap } from '@marea/sim/dungeon/map.ts';
import type { Loader } from '../render/loader.ts';
import { createFinestra } from '../render/finestra.ts';
import type { Finestra, Ritocco } from '../render/finestra.ts';
import { PAL } from '../ui/style.ts';
import { boxPart, cellHash, parts } from './dungeon_kit.ts';
import type { Part } from './dungeon_kit.ts';
import { createLuce, RES } from './dungeon_luce.ts';
import type { Sorgente } from './dungeon_luce.ts';
import { kitDrenaggio } from './drenaggio.ts';
import { kitArchivio } from './archivio.ts';
import { kitFucina } from './fucina.ts';
import { kitMausoleo } from './mausoleo.ts';

export type DungeonScene = {
  scene: THREE.Scene; map: DMap; def: DungeonDef; floorY: number;
  /** Ogni frame: vista, nebbia, finestra sull'eroe, tremolio delle torce. */
  update(hx: number, hz: number, t: number): void;
  /** Altare acceso (l'ultimo toccato, -1 = nessuno): il suo cristallo si illumina. */
  setAltare(n: number): void;
  /** SALVA riuscito sulla lanterna n: lampo di luce che torna normale in un secondo, a scatti. */
  pulse(n: number): void;
  /** Livello di luce della cella in (x, z): 0 = mai vista, 0.28 = vista prima, ≥ 0.55 = in vista ora. */
  light(x: number, z: number): number;
  /** Drenaggio: livello dell'acqua di ogni bacino (1 pieno, 0 asciutto), dalla vista. */
  setAcque(a: readonly { n: number; livello: number }[]): void;
  /** Ritocca i materiali di un oggetto di scena aggiunto dopo (effetti dei dungeon) con la luce delle torce e la nebbia. */
  ritocca(o: THREE.Object3D, k?: Ritocco): void;
  stats(): { floors: number; walls: number; low: number; lights: number; seen: number; altari: number; altareAcceso: number };
  dispose(): void;
};

/** Stile di un dungeon: colori dei segnaposto, quota del pavimento, colore della lanterna, luce emisferica (cielo, terra, forza), coperchio
 *  dei muri tagliati dalla finestra. */
type Stile = { floor: string; wall: string; top: number; lantern: string; hemi: [string, string, number]; coperchio: string };
const STYLE: Record<string, Stile> = {
  grotta: { floor: PAL.roccia, wall: PAL.pietraScura, top: 0.05, lantern: PAL.arancio, hemi: [PAL.pietraScura, PAL.ombraCalda, 1.3], coperchio: PAL.ombraCalda },
  cripta: { floor: PAL.pietraScura, wall: PAL.pietra, top: 0.01, lantern: PAL.arancio, hemi: [PAL.pietra, PAL.ombraCalda, 1.2], coperchio: PAL.ombraCalda },
  vuoto: { floor: PAL.abisso, wall: PAL.viola, top: 0.1, lantern: PAL.viola, hemi: [PAL.abisso, PAL.neroCaldo, 1.4], coperchio: PAL.abisso },
  drenaggio: { floor: PAL.pietraScura, wall: PAL.roccia, top: 0.05, lantern: PAL.arancio, hemi: [PAL.acquaProfonda, PAL.ombraCalda, 1.35], coperchio: PAL.ombraCalda },
  archivio: { floor: PAL.legno, wall: PAL.legnoScuro, top: 0.05, lantern: PAL.giallo, hemi: [PAL.sabbia, PAL.ombraCalda, 1.25], coperchio: PAL.ombraCalda },
  fucina: { floor: PAL.roccia, wall: PAL.legnoScuro, top: 0.05, lantern: PAL.arancio, hemi: [PAL.legno, PAL.neroCaldo, 1.3], coperchio: PAL.neroCaldo },
  mausoleo: { floor: PAL.pietraChiara, wall: PAL.pietra, top: 0.05, lantern: PAL.acquaBassa, hemi: [PAL.pietraChiara, PAL.abisso, 0.9], coperchio: PAL.ombraCalda },
};
/** Finestra sull'eroe: raggio (m) e quota sotto cui non si taglia (sopra il muretto basso da 0,6 m). */
const FIN = { raggio: 1.7, altezza: 0.68 } as const;
/** Luce cotta: raggio (m) e forza per tipo di sorgente. */
const LUCI = { torcia: { r: 10, i: 2 }, braciere: { r: 10, i: 2.2 }, scala: { r: 7, i: 1 }, altare: { r: 5, i: 0.5 } } as const;

/** Un tipo di modulo istanziato su più celle: una InstancedMesh per parte, stessa numerazione; nascondere = scala 0. */
type Batch = { meshes: THREE.InstancedMesh[]; base: THREE.Matrix4[]; shown: boolean[]; scaleY: number[] };
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
const tmp = new THREE.Matrix4(), sc = new THREE.Matrix4();

export async function createDungeonScene(loader: Loader, id: string, camera: THREE.Camera): Promise<DungeonScene> {
  const def = dungeonDef(id), map = parseDungeon(def), T = map.tile, W = map.w, H = map.h;
  const st = STYLE[def.stile] ?? STYLE['grotta']!;
  const scene = new THREE.Scene(); scene.name = 'dungeon_' + id; scene.userData.near = 4; // render/scene.ts: piano vicino
  scene.background = new THREE.Color(PAL.neroCaldo);
  const group = new THREE.Group(); group.name = 'kit'; scene.add(group);
  const ch = (cx: number, cz: number): string => def.rows[cz]?.[cx] ?? ' ';
  const isFloor = (cx: number, cz: number) => cx >= 0 && cz >= 0 && cx < W && cz < H && ch(cx, cz) !== '#' && ch(cx, cz) !== ' ';
  const isCol = (cx: number, cz: number) => !!def.legenda[ch(cx, cz)]?.colonna;
  const center = (cx: number, cz: number) => new THREE.Vector3((cx + 0.5) * T, 0, (cz + 0.5) * T);
  const place = (cx: number, cz: number, rotQ: number) => new THREE.Matrix4().compose(center(cx, cz), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotQ * Math.PI / 2), new THREE.Vector3(1, 1, 1));

  // ---- celle ----
  const floors: number[] = [], walls: number[] = [], cols: number[] = [], lightsAt: number[] = [], bones: number[] = [];
  const muro = new Uint8Array(W * H);
  for (let cz = 0; cz < H; cz++) for (let cx = 0; cx < W; cx++) {
    const i = cz * W + cx, c = ch(cx, cz);
    if (isFloor(cx, cz)) {
      floors.push(i);
      if (isCol(cx, cz)) cols.push(i);
      if (def.legenda[c]?.luce) lightsAt.push(i);
      if (c === '.' && def.stile !== 'vuoto' && def.stile !== 'archivio' && def.stile !== 'fucina' && def.stile !== 'mausoleo' && cellHash(cx, cz, 7) < 0.035 && Math.abs(cx - map.exit.cx) + Math.abs(cz - map.exit.cz) > 3) bones.push(i);
    } else if (c === '#') {
      let touches = false;
      for (let dz = -1; dz <= 1 && !touches; dz++) for (let dx = -1; dx <= 1; dx++) if (isFloor(cx + dx, cz + dz)) { touches = true; break; }
      if (touches) { walls.push(i); muro[i] = 1; }
    }
  }
  // muro basso fisso: il pavimento sta a nord o a ovest del muro (il muro è tra la camera e chi cammina lì); gli altri restano alti
  const isLow = (i: number) => { const cx = i % W, cz = (i - cx) / W; return isFloor(cx, cz - 1) || isFloor(cx - 1, cz) || isFloor(cx - 1, cz - 1); };
  const lowWalls = walls.filter(isLow), highWalls = walls.filter((i) => !isLow(i));

  const k = def.stile;
  const [pFloor, pWall, pLow, pCol, pTorch, pExit, pBones] = await Promise.all([
    parts(loader, `dng_${k}_pavimento`), parts(loader, `dng_${k}_muro`), parts(loader, `dng_${k}_muro_basso`),
    parts(loader, k === 'vuoto' ? 'dng_cristallo' : k === 'fucina' || k === 'mausoleo' ? `dng_${k}_colonna` : 'dng_colonna'), parts(loader, 'dng_torcia'), parts(loader, 'dng_scala'), parts(loader, 'dng_ossa'),
  ]);

  // ---- sorgenti di luce: torce sul muro accanto alla cella «luce» (meglio nord/ovest, che restano alti), altrimenti un braciere a terra ----
  const sorgenti: Sorgente[] = [];
  const torchMats: THREE.Matrix4[] = [], braziers: THREE.Vector3[] = [], torchCells: number[] = [], brazCells: number[] = [];
  for (const i of lightsAt) {
    const cx = i % W, cz = (i - cx) / W;
    const side = ([[0, -1], [-1, 0], [1, 0], [0, 1]] as const).find(([dx, dz]) => ch(cx + dx, cz + dz) === '#');
    if (side && pTorch) {
      const [dx, dz] = side, pos = center(cx, cz).add(new THREE.Vector3(dx * T / 2, 0, dz * T / 2));
      torchMats.push(new THREE.Matrix4().compose(pos, new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(dx, dz)), new THREE.Vector3(1, 1, 1)));
      torchCells.push(i);
      sorgenti.push({ x: pos.x - dx * 0.5, z: pos.z - dz * 0.5, c: PAL.arancio, ...LUCI.torcia });
    } else {
      braziers.push(center(cx, cz)); brazCells.push(i);
      sorgenti.push({ x: (cx + 0.5) * T, z: (cz + 0.5) * T, c: PAL.arancio, ...LUCI.braciere });
    }
  }
  sorgenti.push({ x: map.exit.x, z: map.exit.z, c: PAL.giallo, ...LUCI.scala });
  for (const a of map.altari) sorgenti.push({ x: a.x, z: a.z, c: PAL.acquaBassa, ...LUCI.altare });

  // ---- luce cotta e nebbia, finestra sull'eroe ----
  const luce = createLuce(map, { isFloor, muro: (cx, cz) => cx >= 0 && cz >= 0 && cx < W && cz < H && muro[cz * W + cx] === 1, sorgenti });
  const fin: Finestra = createFinestra({ raggio: FIN.raggio, altezza: st.top + FIN.altezza, coperchio: st.coperchio, griglia: { luce: luce.luce, nebbia: luce.nebbia, w: W, h: H, tile: T, res: RES, buio: PAL.neroCaldo } });

  const makeBatch = (ps: Part[], cells: number[], base: THREE.Matrix4[], name: string, rit: Ritocco, show = true): Batch => {
    const meshes = ps.map((p) => {
      const im = new THREE.InstancedMesh(p.geo, fin.materiale(p.mat, rit), Math.max(1, cells.length));
      im.count = cells.length; im.name = name; im.castShadow = false; im.receiveShadow = false; im.frustumCulled = false;
      for (let i = 0; i < cells.length; i++) im.setMatrixAt(i, show ? base[i]! : ZERO);
      group.add(im); return im;
    });
    return { meshes, base, shown: cells.map(() => show), scaleY: cells.map(() => 1) };
  };
  /** Mostra o nasconde l'istanza i (e ne cambia l'altezza): solo per quello che cambia col gioco (cristalli degli altari, acqua). */
  const setInst = (b: Batch, i: number, show: boolean, scaleY = 1) => {
    if (show === b.shown[i] && scaleY === b.scaleY[i]) return;
    b.shown[i] = show; b.scaleY[i] = scaleY;
    const m = show ? (scaleY === 1 ? b.base[i]! : tmp.multiplyMatrices(b.base[i]!, sc.makeScale(1, scaleY, 1))) : ZERO;
    for (const im of b.meshes) { im.setMatrixAt(i, m); im.instanceMatrix.needsUpdate = true; }
  };

  const rot = (i: number) => Math.floor(cellHash(i % W, Math.floor(i / W), 3) * 4);
  const mats = (list: number[], r: (i: number) => number) => list.map((i) => place(i % W, Math.floor(i / W), r(i)));
  const PIENO: Ritocco = { taglia: true, griglia: true }, TERRA: Ritocco = { griglia: true };
  // scala, altari e bracieri sono bassi: la finestra non li tocca
  const ACCESO: Ritocco = { taglia: true, griglia: true, minimo: 'acceso' }, SEMPRE: Ritocco = { griglia: true, minimo: 'sempre' }, BASSO: Ritocco = { griglia: true, minimo: 'acceso' };
  // segnaposto in codice finché non ci sono i modelli dng_drenaggio_* / dng_archivio_* / dng_fucina_* / dng_mausoleo_*
  const dk = k === 'drenaggio' ? kitDrenaggio(st.top) : k === 'archivio' ? kitArchivio(st.top) : k === 'fucina' ? kitFucina(st.top) : k === 'mausoleo' ? kitMausoleo(st.top) : null, ak = k === 'archivio' ? kitArchivio(st.top) : null;
  makeBatch(pFloor ?? dk?.pavimento ?? [boxPart(T, 0.3, T, -0.3 + st.top, st.floor)], floors, mats(floors, rot), 'pavimento', TERRA);
  makeBatch(pWall ?? dk?.muro ?? [boxPart(T, 2.4, T, 0, st.wall)], highWalls, mats(highWalls, rot), 'muro', PIENO);
  makeBatch(pLow ?? dk?.muro_basso ?? [boxPart(T, 0.6, T, 0, st.wall)], lowWalls, mats(lowWalls, rot), 'muro_basso', PIENO);
  // Fucina e Mausoleo cercano la loro colonna (dng_<stile>_colonna) prima del segnaposto; Drenaggio e Archivio le hanno solo in codice
  makeBatch((k === 'fucina' || k === 'mausoleo' ? pCol ?? dk?.colonna : dk ? dk.colonna : pCol) ?? [boxPart(0.9, 2.4, 0.9, 0, st.wall)], cols, mats(cols, rot), 'colonna', PIENO);
  // acqua dei bacini: un batch per bacino, scala in altezza = livello a gradini (0 = asciutto, non si disegna)
  const acque = map.bacini.map((b) => {
    const base = b.celle.map((i) => place(i % W, Math.floor(i / W), rot(i)).multiply(new THREE.Matrix4().makeTranslation(0, st.top, 0)));
    return { n: b.n, celle: b.celle, scala: 1, batch: makeBatch((dk && 'acqua' in dk ? dk.acqua : null) ?? [boxPart(T, 0.6, T, 0, PAL.acqua)], b.celle, base, 'acqua_' + b.n, PIENO) };
  });
  makeBatch(pBones ?? [boxPart(0.6, 0.12, 0.3, 0, PAL.pietraChiara)], bones, mats(bones, (i) => cellHash(i, 0, 9) * 4), 'ossa', TERRA);
  // Archivio: rastrelliere a grata, girate lungo il lato lungo della grata (orizzontale o verticale)
  const grate = map.grate, rotGrata = (i: number) => (map.grata[i - 1] || map.grata[i + 1] ? 0 : 1);
  makeBatch(ak?.grata ?? [boxPart(T * 0.9, 2, 0.15, 0, PAL.roccia)], grate, mats(grate, rotGrata), 'grata', PIENO);
  // torce e bracieri: una volta visti restano accesi anche nel buio (sono i punti di riferimento)
  makeBatch(pTorch ?? [boxPart(0.2, 0.5, 0.2, 1.5, PAL.arancio, true)], torchCells, torchMats, 'torcia', ACCESO);
  makeBatch([boxPart(0.7, 0.55, 0.7, 0, PAL.roccia), boxPart(0.42, 0.3, 0.42, 0.55, PAL.arancio, true), boxPart(0.22, 0.25, 0.22, 0.85, PAL.giallo, true)],
    brazCells, braziers.map((p) => new THREE.Matrix4().makeTranslation(p.x, 0, p.z)), 'braciere', BASSO);

  // ---- scala d'uscita, girata verso lo spawn: si vede sempre, è da lì che si esce ----
  const exitCell = map.exit.cz * W + map.exit.cx;
  const sdx = Math.round((map.spawn.x - map.exit.x) / T), sdz = Math.round((map.spawn.z - map.exit.z) / T);
  const exitM = new THREE.Matrix4().compose(center(map.exit.cx, map.exit.cz), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(-sdx, -sdz)), new THREE.Vector3(1, 1, 1));
  makeBatch(pExit ?? [boxPart(1.4, 0.4, 1.8, 0, PAL.legno), boxPart(1.4, 0.4, 1.2, 0.4, PAL.legno), boxPart(1.4, 0.4, 0.6, 0.8, PAL.legnoChiaro)], [exitCell], [exitM], 'scala', SEMPRE);

  // ---- altari di salvataggio: piedistallo di pietra e cristallo (spento abisso; acceso, l'ultimo toccato, acqua bassa luminosa) ----
  // segnaposto fatto di box finché non c'è un modello dng_altare; si vedono sempre, come la scala: sono i punti sicuri del dungeon
  const altarCells = map.altari.map((a) => a.cz * W + a.cx), altarM = altarCells.map((i) => place(i % W, Math.floor(i / W), 0));
  makeBatch([boxPart(1.1, 0.3, 1.1, 0, PAL.pietraScura), boxPart(0.7, 0.5, 0.7, 0.3, PAL.pietra)], altarCells, altarM, 'altare', SEMPRE);
  const bCristOff = makeBatch([boxPart(0.3, 0.6, 0.3, 0.8, PAL.abisso)], altarCells, altarM, 'altare_spento', SEMPRE);
  const bCristOn = makeBatch([boxPart(0.36, 0.75, 0.36, 0.8, PAL.acquaBassa, true)], altarCells, altarM, 'altare_acceso', SEMPRE, false);
  let altarOn = -1, pulseN = -1, pulseT0 = -1;

  // ---- luci vere: sempre le stesse ----
  const hemi = new THREE.HemisphereLight(st.hemi[0], st.hemi[1], st.hemi[2]);
  const amb = new THREE.AmbientLight(PAL.viola, 0.12);
  const dir = new THREE.DirectionalLight(PAL.sabbia, 0.55); dir.position.set(14, 30, 18); scene.add(dir, dir.target);
  const lantern = new THREE.PointLight(st.lantern, 14, 9, 1.6); lantern.position.set(0, 2.4, 0);
  const altarLight = new THREE.PointLight(PAL.acquaBassa, 0, 10, 1.6);
  scene.add(hemi, amb, lantern, altarLight);

  const cellOfXZ = (x: number, z: number) => { const cx = Math.floor(x / T), cz = Math.floor(z / T); return cx < 0 || cz < 0 || cx >= W || cz >= H ? -1 : cz * W + cx; };
  let lastCell = -1, fiammaT = -1, fiamma = 1, t0 = -1;
  const api: DungeonScene = {
    scene, map, def, floorY: st.top,
    update(hx, hz, t) {
      const hc = cellOfXZ(hx, hz);
      if (hc >= 0 && hc !== lastCell) { lastCell = hc; luce.vista(hc); }
      luce.passo(t0 < 0 ? 0 : t - t0); t0 = t;
      lantern.position.set(hx, 2.4, hz);
      dir.target.position.set(hx, 0, hz); dir.position.set(hx + 14, 30, hz + 18);
      // fiamme che tremano a scatti (8 al secondo), non in modo liscio
      const step = Math.floor(t * 8);
      if (step !== fiammaT) { fiammaT = step; fiamma = 0.92 + 0.16 * cellHash(step, 1, 5); }
      fin.aggiorna(camera, hx, st.top + 1, hz, fiamma);
      // altare acceso: luce vera; lampo del SALVA in 6 gradini
      let lampo = 0;
      if (pulseN >= 0) {
        if (pulseT0 < 0) pulseT0 = t;
        lampo = Math.ceil((1 - (t - pulseT0)) * 6) / 6;
        if (lampo <= 0) { pulseN = -1; lampo = 0; }
      }
      const a = map.altari[pulseN >= 0 ? pulseN : altarOn];
      if (a) { altarLight.position.set(a.x, 1.9, a.z); altarLight.intensity = 22 * (lampo > 0 ? 1.1 + 3.5 * lampo : 1.1) * fiamma; } else altarLight.intensity = 0;
    },
    setAltare(n) {
      if (n === altarOn) return;
      altarOn = n;
      altarCells.forEach((_, i) => { setInst(bCristOff, i, i !== n); setInst(bCristOn, i, i === n); });
    },
    pulse(n) { pulseN = n; pulseT0 = -1; },
    setAcque(liv) {
      for (const a of acque) {
        const l = liv.find((x) => x.n === a.n)?.livello ?? 1, scala = Math.ceil(Math.max(0, Math.min(1, l)) * 6) / 6; // 6 gradini
        if (scala === a.scala) continue;
        a.scala = scala;
        a.celle.forEach((_, n) => setInst(a.batch, n, scala > 0, scala));
      }
    },
    ritocca(o, rit = TERRA) { fin.applica(o, rit); },
    light: (x, z) => luce.livello(cellOfXZ(x, z)),
    stats: () => ({ floors: floors.length, walls: walls.length, low: lowWalls.length, lights: 2 + (altarLight.intensity > 0 ? 1 : 0), seen: luce.viste, altari: altarCells.length, altareAcceso: altarOn }),
    dispose() {
      for (const c of group.children) (c as THREE.InstancedMesh).dispose(); // le geometrie restano nella cache del kit (prossima discesa)
      fin.dispose(); luce.dispose();
      scene.clear();
    },
  };
  return api;
}
