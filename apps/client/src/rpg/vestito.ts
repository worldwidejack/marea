// Equipaggiamento che si vede addosso (#190): l'armatura o la veste sul corpo dell'avatar e, fuori dal dungeon, l'arma sulla schiena nella posa
// «riposta» dei videogiochi (solo da vedere: non si usa). Sta in rpg/ e si carica a richiesta (`import()` da game/avatar.ts): il bundle iniziale
// non si porta dietro il catalogo del GDR.
// Tutto l'equipaggiamento (armatura, arma sulla schiena, faretra) è UNA SOLA SkinnedMesh con colori di vertice: un draw call per avatar, niente texture.
// Armatura = scatole in colori di palette, ognuna pesata al 100 % su un osso del modello (il pezzo segue la clip e, nel dungeon, le braccia che l'IK porta
// sul pugno). Le coordinate dei pezzi sono quelle del corpo a riposo, in metri: x destra, y su, z indietro (avanti = −Z); `rest` (matrici del mondo delle
// ossa a riposo, prese da avatar.ts prima che parta una clip) serve a pesare l'insieme sulle ossa. Look: ART_BIBLE §2 (solo palette, flat shading, mai PBR).
// Nessun Blender: sono segnaposto in codice. Arma = il modello `arm_*` del dungeon (lo stesso che si impugna) «cotto» in colori di vertice (`cuoci`: il colore
// di ogni triangolo è il texel dell'atlas, la lama ha il colore del materiale) e pesato sull'osso Spine; la faretra (scatole) compare con arco + frecce anche
// dentro il dungeon.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Indossa } from '@marea/protocol';
import { RPG } from '@marea/content/rpg.ts';
import { hasItem, itemDef } from '@marea/sim/rpg/items.ts';
import { indossaDa } from '@marea/sim/rpg/indossa.ts';
import type { Loader } from '../render/loader.ts';
import { boxPart, parts } from './dungeon_kit.ts';
import type { Part } from './dungeon_kit.ts';
import { palColor } from './items_ui.ts';

export type Vestito = {
  /** Cambia quello che si vede. `schiena`: l'arma sta sulla schiena (overworld); falso = è in mano (dungeon) e resta solo la faretra. L'ultima chiamata vince. */
  set(i: Indossa | 'partenza' | undefined, schiena: boolean): Promise<void>;
  /** Materiali dell'equipaggiamento (lampo quando l'eroe è colpito). */
  materiali(): THREE.MeshLambertMaterial[];
  /** Cosa si vede adesso (per i test). */
  stato(): { corpo: string | null; arma: string | null; faretra: boolean; tri: number };
  dispose(): void;
};

// ---------- ossa e pezzi ----------
type Osso = 'Hips' | 'Spine' | 'UpperArm.L' | 'UpperArm.R' | 'LowerArm.L' | 'LowerArm.R' | 'UpperLeg.L' | 'UpperLeg.R' | 'LowerLeg.L' | 'LowerLeg.R';
const OSSA: readonly Osso[] = ['Hips', 'Spine', 'UpperArm.L', 'UpperArm.R', 'LowerArm.L', 'LowerArm.R', 'UpperLeg.L', 'UpperLeg.R', 'LowerLeg.L', 'LowerLeg.R'];
type V3 = [number, number, number];
/** b = base (il colore del materiale), d = scuro, l = chiaro, t = finitura. */
type Tinta = 'b' | 'd' | 'l' | 't';
type Hue = Record<Tinta, string>;
/** Una scatola: osso, dimensioni, centro, tinta, rotazione (Euler XYZ, rad) attorno al suo centro. */
type Pz = { o: Osso; s: V3; at: V3; c: Tinta; r?: V3 };
const lato = (b: 'UpperArm' | 'LowerArm' | 'UpperLeg' | 'LowerLeg', sx: number): Osso => `${b}.${sx > 0 ? 'R' : 'L'}` as Osso;
const SX = [-1, 1] as const;
/** Pezzo sull'avambraccio a quota `y`: nel modello l'avambraccio parte dal gomito (±0,215; 0,965) e scende aprendosi di 16° e andando un po' avanti. */
const avamb = (s: number, y: number, w: number, h: number, d: number, c: Tinta): Pz => {
  const k = 0.965 - y;
  return { o: lato('LowerArm', s), s: [w, h, d], at: [s * (0.215 + 0.28 * k), y, -0.17 * k], c, r: [0.17, 0, s * 0.273] };
};

/** Colori per materiale e per unico (solo palette). Gli oggetti non elencati prendono il loro colore come base. */
const HUE: Record<string, Hue> = {
  legno: { b: '#C98A4B', d: '#8E5A2B', l: '#E2B97F', t: '#F4E3C1' },
  bronzo: { b: '#F2A33A', d: '#8E5A2B', l: '#F5D547', t: '#F5D547' },
  ferro: { b: '#7F7568', d: '#4A4340', l: '#B9AFA3', t: '#B9AFA3' },
  argento: { b: '#E8E1D6', d: '#B9AFA3', l: '#F4E3C1', t: '#2478A8' },
  oro: { b: '#F5D547', d: '#F2A33A', l: '#F4E3C1', t: '#E8433F' },
  vetro: { b: '#7FE3E0', d: '#3FB9C9', l: '#F4E3C1', t: '#E8E1D6' },
  ossa: { b: '#F4E3C1', d: '#B9AFA3', l: '#E8E1D6', t: '#4A4340' },
  meteorite: { b: '#A64DFF', d: '#4A4340', l: '#8A5CFF', t: '#FF3DA6' },
  unico_corazza_marea: { b: '#3FB9C9', d: '#2478A8', l: '#7FE3E0', t: '#F4E3C1' },
  unico_armatura_moto: { b: '#7FE3E0', d: '#3FB9C9', l: '#F4E3C1', t: '#F5D547' },
  veste_apprendista: { b: '#2478A8', d: '#163F73', l: '#7FE3E0', t: '#F5D547' },
  veste_distruzione: { b: '#E8433F', d: '#4A4340', l: '#F2A33A', t: '#F5D547' },
  veste_evocazione: { b: '#A64DFF', d: '#4A4340', l: '#8A5CFF', t: '#7FE3E0' },
  unico_veste_arcimago: { b: '#8A5CFF', d: '#2E1E14', l: '#3DF5FF', t: '#F5D547' },
};
const hueDi = (id: string, materiale: string | undefined, colore: string): Hue =>
  HUE[id] ?? (materiale ? HUE[materiale] : undefined) ?? { b: palColor(colore), d: '#4A4340', l: '#F4E3C1', t: '#F4E3C1' };

type Forma = 'tela' | 'piastre' | 'cristalli' | 'ossa' | 'veste';
type Opz = { spalle: 1 | 2; bracci: boolean; gambe: 0 | 1 | 2; gonna: boolean; petto: boolean };
const FORMA: Record<string, { f: Forma; o?: Partial<Opz> }> = {
  legno: { f: 'tela' },
  bronzo: { f: 'piastre', o: { spalle: 1, gambe: 0 } },
  ferro: { f: 'piastre', o: { spalle: 1, gambe: 2 } },
  argento: { f: 'piastre', o: { spalle: 2, gambe: 2 } },
  oro: { f: 'piastre', o: { spalle: 2, gambe: 1 } },
  vetro: { f: 'cristalli', o: { spalle: 1 } },
  meteorite: { f: 'cristalli', o: { spalle: 2 } },
  ossa: { f: 'ossa' },
};

/** Tela, corazze e vesti: tutte le dimensioni sono quelle del corpo di chr_base (busto 0,95-1,30 m, spalle a ±0,2, cosce 0,46-0,85). */
function pezziArmatura(forma: Forma, op: Partial<Opz>): Pz[] {
  const o: Opz = { spalle: 1, bracci: true, gambe: 1, gonna: true, petto: true, ...op };
  const P: Pz[] = [];
  const add = (p: Pz) => { P.push(p); };
  switch (forma) {
    case 'tela': {
      add({ o: 'Spine', s: [0.37, 0.36, 0.23], at: [0, 1.12, 0], c: 'b' });
      add({ o: 'Spine', s: [0.2, 0.05, 0.2], at: [0, 1.31, 0], c: 'l' });
      add({ o: 'Hips', s: [0.385, 0.15, 0.25], at: [0, 0.87, 0], c: 'b' });
      add({ o: 'Hips', s: [0.39, 0.04, 0.255], at: [0, 0.96, 0], c: 'd' });
      add({ o: 'Hips', s: [0.06, 0.14, 0.02], at: [0.08, 0.86, -0.135], c: 't' });
      add({ o: 'Hips', s: [0.05, 0.1, 0.02], at: [0.12, 0.84, -0.135], c: 't', r: [0, 0, 0.3] });
      for (const s of SX) {
        add({ o: lato('UpperArm', s), s: [0.115, 0.2, 0.115], at: [s * 0.215, 1.12, 0], c: 'b' });
        add(avamb(s, 0.77, 0.1, 0.1, 0.1, 'd'));
        add({ o: lato('LowerLeg', s), s: [0.125, 0.1, 0.135], at: [s * 0.09, 0.37, 0], c: 'd' });
      }
      break;
    }
    case 'veste': {
      add({ o: 'Spine', s: [0.38, 0.33, 0.235], at: [0, 1.13, 0], c: 'b' });
      add({ o: 'Spine', s: [0.39, 0.05, 0.245], at: [0, 0.98, 0], c: 't' });
      add({ o: 'Spine', s: [0.1, 0.5, 0.02], at: [0, 1.04, -0.13], c: 'l' });
      add({ o: 'Spine', s: [0.47, 0.06, 0.29], at: [0, 1.31, 0], c: 'd' });
      add({ o: 'Spine', s: [0.2, 0.16, 0.07], at: [0, 1.32, 0.15], c: 'd' });
      add({ o: 'Hips', s: [0.39, 0.17, 0.265], at: [0, 0.8, 0], c: 'b' });
      add({ o: 'Hips', s: [0.43, 0.2, 0.3], at: [0, 0.625, 0], c: 'b' });
      add({ o: 'Hips', s: [0.44, 0.04, 0.31], at: [0, 0.505, 0], c: 't' });
      for (const s of SX) {
        add({ o: lato('UpperArm', s), s: [0.14, 0.22, 0.14], at: [s * 0.215, 1.11, 0], c: 'b' });
        add(avamb(s, 0.8, 0.165, 0.22, 0.165, 'b'));
        add(avamb(s, 0.7, 0.175, 0.04, 0.175, 't'));
      }
      break;
    }
    case 'ossa': {
      for (let k = 0; k < 4; k++) add({ o: 'Spine', s: [0.37 - k * 0.02, 0.04, 0.23 - k * 0.01], at: [0, 1.26 - k * 0.075, 0], c: k % 2 ? 'd' : 'b' });
      add({ o: 'Spine', s: [0.05, 0.32, 0.03], at: [0, 1.13, -0.12], c: 'l' });
      add({ o: 'Spine', s: [0.05, 0.34, 0.03], at: [0, 1.13, 0.12], c: 'l' });
      add({ o: 'Spine', s: [0.36, 0.28, 0.2], at: [0, 1.13, 0], c: 't' });
      add({ o: 'Hips', s: [0.39, 0.06, 0.26], at: [0, 0.93, 0], c: 'b' });
      for (const s of SX) {
        add({ o: 'Hips', s: [0.03, 0.2, 0.16], at: [s * 0.2, 0.8, 0], c: 'b' });
        add({ o: lato('UpperArm', s), s: [0.16, 0.12, 0.17], at: [s * 0.24, 1.27, 0], c: 'b', r: [0, 0, s * 0.2] }); // cranio-spallaccio
        add({ o: lato('UpperArm', s), s: [0.1, 0.04, 0.02], at: [s * 0.24, 1.27, -0.09], c: 't' });
        add({ o: lato('UpperArm', s), s: [0.04, 0.14, 0.04], at: [s * 0.27, 1.37, 0.02], c: 'l', r: [0, 0, s * 0.45] }); // corno
        add(avamb(s, 0.8, 0.1, 0.18, 0.1, 'b'));
        add(avamb(s, 0.88, 0.12, 0.035, 0.12, 'd'));
        add({ o: lato('LowerLeg', s), s: [0.13, 0.25, 0.14], at: [s * 0.09, 0.29, 0], c: 'b' });
        add({ o: lato('LowerLeg', s), s: [0.15, 0.06, 0.16], at: [s * 0.09, 0.46, 0], c: 'l' });
      }
      break;
    }
    case 'cristalli': {
      const grande = o.spalle === 2;
      add({ o: 'Spine', s: [0.375, 0.3, 0.23], at: [0, 1.14, 0], c: 'd' });
      add({ o: 'Spine', s: [0.11, 0.28, 0.05], at: [0, 1.15, -0.125], c: 'b', r: [0, 0, Math.PI / 4] });
      add({ o: 'Spine', s: [0.07, 0.2, 0.04], at: [-0.11, 1.1, -0.12], c: 'l', r: [0, 0, 0.45] });
      add({ o: 'Spine', s: [0.07, 0.2, 0.04], at: [0.11, 1.1, -0.12], c: 'l', r: [0, 0, -0.45] });
      add({ o: 'Spine', s: [0.12, 0.34, 0.06], at: [0, 1.2, 0.14], c: 'b', r: [0.35, 0, 0] }); // cresta dietro
      add({ o: 'Spine', s: [0.2, 0.05, 0.2], at: [0, 1.325, 0], c: 'd' });
      add({ o: 'Hips', s: [0.385, 0.09, 0.255], at: [0, 0.9, 0], c: 'd' });
      for (const s of SX) {
        add({ o: 'Hips', s: [0.07, 0.17, 0.05], at: [s * 0.14, 0.78, -0.13], c: 'b', r: [0, 0, s * 0.3] });
        add({ o: 'Hips', s: [0.07, 0.17, 0.05], at: [s * 0.14, 0.78, 0.13], c: 'b', r: [0, 0, s * 0.3] });
        add({ o: lato('UpperArm', s), s: [grande ? 0.13 : 0.1, grande ? 0.26 : 0.2, 0.1], at: [s * 0.25, 1.35, 0], c: 'b', r: [0, 0, s * 0.55] });
        add({ o: lato('UpperArm', s), s: [0.075, 0.15, 0.075], at: [s * 0.2, 1.36, -0.05], c: 'l', r: [0.45, 0, s * 0.2] });
        add({ o: lato('UpperArm', s), s: [0.16, 0.06, 0.17], at: [s * 0.24, 1.26, 0], c: 'd' });
        add(avamb(s, 0.82, 0.1, 0.19, 0.105, 'd'));
        add({ ...avamb(s, 0.72, 0.05, 0.15, 0.05, 'b'), r: [-0.1, 0, s * 0.62] });
        add({ o: lato('LowerLeg', s), s: [0.135, 0.26, 0.14], at: [s * 0.09, 0.29, 0], c: 'd' });
        add({ o: lato('LowerLeg', s), s: [0.06, 0.15, 0.06], at: [s * 0.09, 0.46, -0.09], c: 'b', r: [-0.5, 0, 0] });
      }
      break;
    }
    case 'piastre': {
      if (o.petto) {
        add({ o: 'Spine', s: [0.385, 0.31, 0.235], at: [0, 1.14, 0], c: 'b' });
        add({ o: 'Spine', s: [0.17, 0.19, 0.02], at: [0, 1.17, -0.125], c: 'l' });
        add({ o: 'Spine', s: [0.04, 0.29, 0.02], at: [0, 1.15, -0.145], c: 't' });
        add({ o: 'Spine', s: [0.2, 0.2, 0.02], at: [0, 1.15, 0.126], c: 'd' });
        add({ o: 'Spine', s: [0.39, 0.04, 0.24], at: [0, 0.99, 0], c: 'd' });
        add({ o: 'Spine', s: [0.075, 0.05, 0.03], at: [0, 0.99, -0.13], c: 't' });
        add({ o: 'Spine', s: [0.21, 0.06, 0.21], at: [0, 1.325, 0], c: 'd' });
      }
      if (o.gonna) {
        add({ o: 'Hips', s: [0.385, 0.07, 0.255], at: [0, 0.905, 0], c: 'b' });
        add({ o: 'Hips', s: [0.22, 0.13, 0.03], at: [0, 0.8, -0.128], c: 'd' });
        add({ o: 'Hips', s: [0.22, 0.13, 0.03], at: [0, 0.8, 0.128], c: 'd' });
        for (const s of SX) add({ o: 'Hips', s: [0.03, 0.12, 0.2], at: [s * 0.195, 0.82, 0], c: 'd' });
      }
      for (const s of SX) {
        add({ o: lato('UpperArm', s), s: [0.17, 0.07, 0.19], at: [s * 0.235, 1.295, 0], c: 'b', r: [0, 0, s * 0.2] });
        add({ o: lato('UpperArm', s), s: [0.15, 0.06, 0.17], at: [s * 0.245, 1.235, 0], c: 'd' });
        if (o.spalle === 2) {
          add({ o: lato('UpperArm', s), s: [0.04, 0.06, 0.2], at: [s * 0.3, 1.285, 0], c: 't' });
          add({ o: lato('UpperArm', s), s: [0.05, 0.1, 0.05], at: [s * 0.255, 1.37, 0], c: 'l', r: [0, 0, s * 0.3] });
        }
        if (o.bracci) {
          add(avamb(s, 0.82, 0.105, 0.2, 0.11, 'b'));
          add(avamb(s, 0.72, 0.115, 0.04, 0.12, 'd'));
          if (o.gambe === 2) add({ o: lato('UpperArm', s), s: [0.11, 0.1, 0.11], at: [s * 0.215, 1.09, 0], c: 'd' });
        }
        if (o.gambe >= 1) {
          add({ o: lato('UpperLeg', s), s: [0.16, 0.26, 0.17], at: [s * 0.09, 0.66, 0], c: 'b' });
          add({ o: lato('LowerLeg', s), s: [0.15, 0.07, 0.16], at: [s * 0.09, 0.47, -0.005], c: 'l' });
        }
        if (o.gambe === 2) {
          add({ o: lato('LowerLeg', s), s: [0.14, 0.27, 0.145], at: [s * 0.09, 0.28, 0], c: 'b' });
          add({ o: lato('LowerLeg', s), s: [0.15, 0.04, 0.155], at: [s * 0.09, 0.15, 0], c: 'd' });
        }
      }
      break;
    }
  }
  return P;
}

// ---------- faretra e frecce (colori fissi: cuoio e piume) ----------
const FARETRA: { o: Osso; s: V3; at: V3; col: string; r?: V3 }[] = [
  { o: 'Spine', s: [0.09, 0.4, 0.09], at: [-0.075, 1.03, 0.17], col: '#8E5A2B', r: [0, 0, 0.32] },
  { o: 'Spine', s: [0.105, 0.04, 0.105], at: [-0.135, 1.215, 0.17], col: '#5A3A1E', r: [0, 0, 0.32] },
  { o: 'Spine', s: [0.014, 0.2, 0.014], at: [-0.15, 1.32, 0.165], col: '#C98A4B', r: [0, 0, 0.3] },
  { o: 'Spine', s: [0.014, 0.22, 0.014], at: [-0.12, 1.33, 0.18], col: '#C98A4B', r: [0, 0, 0.36] },
  { o: 'Spine', s: [0.014, 0.19, 0.014], at: [-0.135, 1.32, 0.15], col: '#C98A4B', r: [0, 0, 0.27] },
  { o: 'Spine', s: [0.03, 0.05, 0.03], at: [-0.17, 1.43, 0.165], col: '#E8433F', r: [0, 0, 0.3] },
  { o: 'Spine', s: [0.03, 0.05, 0.03], at: [-0.135, 1.45, 0.18], col: '#F4E3C1', r: [0, 0, 0.36] },
];

// ---------- arma sulla schiena ----------
/** Dove sta sulla schiena: punto di presa (m, spazio del corpo a riposo), roll attorno a Z (0 = lama verso l'alto; positivo = la punta va a sinistra) e
 *  `centro`: il modello è simmetrico (arco, nunchaku) e si appende per il mezzo. */
type PosaSchiena = { p: V3; rz: number; ry?: number; centro?: boolean; s?: number };
const DEG = Math.PI / 180;
const SCHIENA: Record<string, PosaSchiena> = {
  katana: { p: [0.13, 1.3, 0.18], rz: 148 * DEG, s: 1.15 },
  spadone: { p: [0.12, 1.34, 0.19], rz: 158 * DEG, s: 0.76 },
  lancia: { p: [0.14, 0.6, 0.17], rz: 12 * DEG, s: 0.75 },
  martello: { p: [-0.1, 0.78, 0.18], rz: -36 * DEG, s: 0.9 },
  ascia: { p: [-0.06, 0.74, 0.18], rz: -32 * DEG, s: 1.1 },
  nunchaku: { p: [0, 0.99, 0.15], rz: 82 * DEG, centro: true },
  arco: { p: [0.02, 1.1, 0.17], rz: -34 * DEG, centro: true },
};

// ---------- scatole pesate sulle ossa ----------
/** Pezzi e scatole fisse → una geometria non indicizzata a colori di vertice, ogni scatola pesata al 100 % sul suo osso. Senza la faccia di sotto delle scatole dritte
 *  (la camera sta sempre sopra l'orizzonte): ~17 % di triangoli in meno. */
function scatole(pz: Pz[], hue: Hue, extra: typeof FARETRA): THREE.BufferGeometry | null {
  const gs: THREE.BufferGeometry[] = [];
  const push = (os: Osso, s: V3, at: V3, col: string, r?: V3) => {
    const g = new THREE.BoxGeometry(s[0], s[1], s[2]); g.deleteAttribute('uv');
    if (!r) { const ix = Array.from(g.getIndex()!.array); g.setIndex([...ix.slice(0, 18), ...ix.slice(24)]); } // BoxGeometry: +x −x +y −y +z −z, 6 indici l'una
    else g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(r[0], r[1], r[2])));
    g.translate(at[0], at[1], at[2]);
    const flat = g.toNonIndexed(); g.dispose();
    const c = new THREE.Color(col), cnt = flat.getAttribute('position').count, rgb = new Float32Array(cnt * 3), si = new Uint16Array(cnt * 4), sw = new Float32Array(cnt * 4), idx = OSSA.indexOf(os);
    for (let k = 0; k < cnt; k++) { rgb[k * 3] = c.r; rgb[k * 3 + 1] = c.g; rgb[k * 3 + 2] = c.b; si[k * 4] = idx; sw[k * 4] = 1; }
    flat.setAttribute('color', new THREE.BufferAttribute(rgb, 3));
    flat.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
    flat.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
    gs.push(flat);
  };
  for (const p of pz) push(p.o, p.s, p.at, hue[p.c], p.r);
  for (const p of extra) push(p.o, p.s, p.at, p.col, p.r);
  if (!gs.length) return null;
  const m = mergeGeometries(gs, false); for (const g of gs) g.dispose();
  return m;
}

// ---------- il modello dell'arma → scatole di vertici colorati ----------
type Pixel = { w: number; h: number; d: Uint8ClampedArray };
const pixelCache = new WeakMap<THREE.Texture, Pixel | null>();
/** Pixel di una texture (l'atlas: si legge una volta sola per sessione); null se non si possono leggere. */
function pixelDi(t: THREE.Texture): Pixel | null {
  if (pixelCache.has(t)) return pixelCache.get(t)!;
  let p: Pixel | null = null;
  try {
    const img = t.image as CanvasImageSource & { width: number; height: number };
    const c = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(img.width, img.height) : Object.assign(document.createElement('canvas'), { width: img.width, height: img.height });
    const g = (c as OffscreenCanvas).getContext('2d') as OffscreenCanvasRenderingContext2D;
    g.drawImage(img, 0, 0);
    p = { w: img.width, h: img.height, d: g.getImageData(0, 0, img.width, img.height).data };
  } catch { p = null; }
  pixelCache.set(t, p);
  return p;
}
/** Le parti di un modello (matrice del nodo già applicata) in una geometria sola non indicizzata a colori di vertice, messa con `m` nello spazio del corpo a
 *  riposo e pesata sull'osso `idx`: l'arma costa così zero draw call in più. Ogni triangolo prende il colore del texel dell'atlas sotto il suo centro (le facce
 *  stanno su celle piatte); `mat_lama` ha il colore della lama. */
function cuoci(ps: Part[], lama: string, atlante: Pixel | null, m: THREE.Matrix4, idx: number): THREE.BufferGeometry | null {
  const tmp = new THREE.Color(), gs: THREE.BufferGeometry[] = [];
  for (const p of ps) {
    const src = p.geo.index ? p.geo.toNonIndexed() : p.geo.clone(), pos = src.getAttribute('position'), uv = src.getAttribute('uv'), cnt = pos.count;
    const g = new THREE.BufferGeometry(), rgb = new Float32Array(cnt * 3), si = new Uint16Array(cnt * 4), sw = new Float32Array(cnt * 4);
    const isLama = /^mat_lama/.test(p.mat.name), base = isLama ? new THREE.Color(lama) : p.mat.color.clone(), tex = !isLama && p.mat.map && uv && atlante ? atlante : null; // la lama è tinta piatta (come tintBlade)
    for (let t = 0; t < cnt; t += 3) {
      let c = base;
      if (tex && uv) {
        const u = (uv.getX(t) + uv.getX(t + 1) + uv.getX(t + 2)) / 3, v = (uv.getY(t) + uv.getY(t + 1) + uv.getY(t + 2)) / 3;
        const k = (Math.min(tex.h - 1, Math.max(0, Math.floor(v * tex.h))) * tex.w + Math.min(tex.w - 1, Math.max(0, Math.floor(u * tex.w)))) * 4;
        c = tmp.setRGB(tex.d[k]! / 255, tex.d[k + 1]! / 255, tex.d[k + 2]! / 255, THREE.SRGBColorSpace);
      }
      for (let k = 0; k < 3; k++) { rgb[(t + k) * 3] = c.r; rgb[(t + k) * 3 + 1] = c.g; rgb[(t + k) * 3 + 2] = c.b; }
    }
    for (let k = 0; k < cnt; k++) { si[k * 4] = idx; sw[k * 4] = 1; }
    g.setAttribute('position', pos); g.setAttribute('normal', src.getAttribute('normal') ?? pos);
    g.setAttribute('color', new THREE.BufferAttribute(rgb, 3));
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4)); g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
    gs.push(g);
  }
  const out = gs.length ? mergeGeometries(gs, false) : null;
  for (const g of gs) g.dispose();
  return out?.applyMatrix4(m) ?? null;
}

export function creaVestito(o: { loader: Loader; root: THREE.Object3D; rest: ReadonlyMap<string, THREE.Matrix4> }): Vestito {
  const nome = (n: string) => THREE.PropertyBinding.sanitizeNodeName(n);
  const osso = (n: string) => o.root.getObjectByName(nome(n)) ?? o.root.getObjectByName(n) ?? null;
  const bones = OSSA.map((n) => osso(n) as THREE.Bone | null);
  const restOf = (n: string) => o.rest.get(nome(n)) ?? o.rest.get(n) ?? null;
  const ok = bones.every(Boolean) && OSSA.every((n) => restOf(n));
  const mat = new THREE.MeshLambertMaterial({ name: 'mat_indossa', vertexColors: true, flatShading: true }); // proprio: il lampo dell'eroe colpito non deve accendere gli altri
  const lista: THREE.MeshLambertMaterial[] = [mat]; // sempre la stessa lista (l'eroe la rilegge a ogni frame)
  // le tre parti (armatura, faretra, arma) sono geometrie non indicizzate pesate sulle ossa: `compone` le fonde in UNA SkinnedMesh (un draw call)
  let skin: THREE.SkinnedMesh | null = null, corpoGeo: THREE.BufferGeometry | null = null, armaGeo: THREE.BufferGeometry | null = null, faretraGeo: THREE.BufferGeometry | null = null;
  let fOpt = '', tri = 0, corpo: string | null = null, armaId: string | null = null, armaVoluta: string | undefined, n = 0;

  function compone(): void {
    if (skin) { skin.geometry.dispose(); skin.removeFromParent(); skin = null; }
    tri = 0;
    const gs = [corpoGeo, faretraGeo, armaGeo].filter((g): g is THREE.BufferGeometry => !!g);
    if (!gs.length || !ok) return;
    const g = mergeGeometries(gs, false);
    if (!g) return;
    skin = new THREE.SkinnedMesh(g, mat);
    skin.name = 'indossa'; skin.frustumCulled = false; skin.castShadow = false;
    o.root.add(skin);
    skin.bind(new THREE.Skeleton(bones as THREE.Bone[], OSSA.map((n) => restOf(n)!.clone().invert())), new THREE.Matrix4());
    tri = g.getAttribute('position').count / 3;
  }

  function vestiCorpo(id: string | undefined, conFaretra: boolean): void {
    const chiave = (id ?? '') + (conFaretra ? '+f' : '');
    if (chiave === fOpt) return;
    fOpt = chiave; corpo = null;
    corpoGeo?.dispose(); corpoGeo = null;
    if (id && hasItem(id)) {
      const it = itemDef(id), f = it.kind === 'veste' ? { f: 'veste' as Forma } : FORMA[it.materiale ?? ''] ?? { f: 'piastre' as Forma };
      corpoGeo = scatole(pezziArmatura(f.f, f.o ?? {}), hueDi(id, it.materiale, it.colore), []); corpo = id;
    }
    faretraGeo?.dispose(); faretraGeo = conFaretra ? scatole([], HUE['ferro']!, FARETRA) : null;
    compone();
  }

  /** Il modello dell'arma nello spazio del corpo: `p` punto di presa, `rz` roll, scala; `centro` lo appende per il mezzo. */
  function posa(ps: Part[], pos: PosaSchiena): THREE.Matrix4 {
    const box = new THREE.Box3();
    for (const p of ps) { p.geo.computeBoundingBox(); box.union(p.geo.boundingBox!); }
    const m = new THREE.Matrix4().compose(new THREE.Vector3(...pos.p), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, pos.ry ?? 0, pos.rz, 'ZYX')), new THREE.Vector3(1, 1, 1).multiplyScalar(pos.s ?? 1));
    if (pos.centro) m.multiply(new THREE.Matrix4().makeTranslation(0, -(box.min.y + box.max.y) / 2, 0));
    return m;
  }

  /** `my` = numero della chiamata: se ne arriva un'altra mentre il modello si carica, vince l'ultima. */
  async function vestiArma(i: Indossa | undefined, schiena: boolean, my: number): Promise<void> {
    const id = schiena ? i?.arma : undefined;
    if (id === armaVoluta && (armaGeo || !id)) return; // già a posto, o niente da mettere
    armaVoluta = id; armaId = null;
    if (armaGeo) { armaGeo.dispose(); armaGeo = null; compone(); }
    if (!id || !hasItem(id) || !ok) return;
    const it = itemDef(id), arco = it.kind === 'arco', lama = palColor(it.colore);
    await o.loader.extend('manifest_rpg.json');
    if (my !== n) return;
    const [ps, atlante] = await Promise.all([parts(o.loader, it.model ?? (arco ? 'arm_arco' : 'arm_katana')), o.loader.texture(o.loader.manifest.atlas || 'atlas.png').then(pixelDi).catch(() => null)]);
    if (my !== n) return;
    const pezzi = ps ?? (arco ? [boxPart(0.05, 1.2, 0.05, -0.6, '#8E5A2B')] : [boxPart(0.05, 0.2, 0.05, 0, '#5A3A1E'), boxPart(0.08, 0.75, 0.03, 0.2, lama)]);
    armaGeo = cuoci(pezzi, lama, atlante, posa(pezzi, SCHIENA[arco ? 'arco' : it.tipo ?? 'katana'] ?? SCHIENA['katana']!), OSSA.indexOf('Spine'));
    armaId = armaGeo ? id : null;
    compone();
  }

  return {
    async set(equip, schiena) {
      const my = ++n, i = equip === 'partenza' ? indossaDa(RPG.partenza.equip as Record<string, string>) : equip;
      const conFaretra = !!i?.frecce && !!i.arma && hasItem(i.arma) && itemDef(i.arma).kind === 'arco';
      vestiCorpo(i?.corpo, conFaretra);
      if (my === n) await vestiArma(i, schiena, my);
    },
    materiali: () => lista,
    stato: () => ({ corpo, arma: armaId, faretra: !!faretraGeo, tri }),
    dispose() { n++; skin?.geometry.dispose(); skin?.removeFromParent(); corpoGeo?.dispose(); armaGeo?.dispose(); faretraGeo?.dispose(); mat.dispose(); },
  };
}
