// Impianto di Drenaggio (Epopea della Regata, dungeon 1): segnaposto in codice finché il Claude di Jack non genera i modelli in Blender
// (assets/blender/models_drenaggio.py). Kit dello stile (pavimento a grata, muri di lamiera chiodata col tubo d'ottone e la riga
// dell'acqua, colonne = tubi grossi, acqua dei bacini), forme dei 4 nemici del Collettivo Rottamautomi e gli effetti della scena:
// valvole da girare, geyser del Capoturno, fanghiglia sotto l'eroe rallentato. Solo colori della palette, texture a pixel nearest,
// facce piatte; quando arriva un modello vero nel manifest vince lui.
import * as THREE from 'three';
import type { DungeonView } from '@marea/sim/dungeon/types.ts';
import { M, block, merged, painted, px, speckle, strata, tex } from '../render/island_parts.ts';
import { PAL } from '../ui/style.ts';
import type { Part } from './dungeon_kit.ts';
import type { DungeonScene } from './dungeon_scene.ts';

const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
const cil = (r0: number, r1: number, h: number, s = 8) => new THREE.CylinderGeometry(r0, r1, h, s);
const vc = new Map<string, THREE.MeshLambertMaterial>();
/** Materiale a colori per vertice (uno per uso: i nemici lo clonano per lampeggiare). */
const colori = (k = 'base'): THREE.MeshLambertMaterial => {
  let m = vc.get(k);
  if (!m) { m = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }); m.name = 'mat_drenaggio_' + k; vc.set(k, m); }
  return m;
};
const texMat = (t: THREE.Texture, emissive?: string): THREE.MeshLambertMaterial =>
  new THREE.MeshLambertMaterial({ map: t, flatShading: true, ...(emissive ? { emissive, emissiveIntensity: 0.22 } : {}) });

// ——— kit dello stile ———
let kit: Record<'pavimento' | 'muro' | 'muro_basso' | 'colonna' | 'acqua', Part[]> | null = null;
/** Pezzi del kit `drenaggio` (cache): una geometria e un materiale per pezzo, 12 triangoli i blocchi. */
export function kitDrenaggio(top: number): NonNullable<typeof kit> {
  if (kit) return kit;
  const pav = tex('pav', 'drenaggio', (g, r) => {
    px(g, PAL.pietraScura, 0, 0, 32, 32);
    for (let i = 0; i < 32; i += 16) { px(g, PAL.roccia, i, 0, 1, 32); px(g, PAL.roccia, 0, i, 32, 1); } // lastre da 1 m
    for (let y = 5; y < 12; y += 2) px(g, PAL.neroCaldo, 20, y, 9, 1); // grata di scolo
    px(g, PAL.roccia, 19, 4, 11, 1); px(g, PAL.roccia, 19, 12, 11, 1);
    for (const [x, y] of [[2, 2], [13, 2], [2, 13], [13, 13], [18, 18], [29, 18], [18, 29], [29, 29]] as const) px(g, PAL.pietra, x, y); // chiodi
    speckle(g, r, PAL.legno, 10, 0, 32, 2, 1); speckle(g, r, PAL.legnoScuro, 8, 0, 32); speckle(g, r, PAL.pietra, 8, 0, 32); // ruggine
    strata(g, [[PAL.roccia, 4], [PAL.neroCaldo, 32]]);
  });
  const muro = tex('muro', 'drenaggio', (g, r) => {
    px(g, PAL.roccia, 0, 0, 32, 32); speckle(g, r, PAL.neroCaldo, 30, 0, 32); // la cima, vista dall'alto
    // fianco (32 righe = 2 m dall'alto): lamiere chiodate, tubo d'ottone, riga dell'acqua, ruggine che cola
    px(g, PAL.pietraScura, 0, 32, 32, 32);
    for (const x of [0, 16]) px(g, PAL.roccia, x, 32, 1, 32);
    for (let x = 2; x < 32; x += 4) { px(g, PAL.pietra, x, 34); px(g, PAL.pietra, x, 61); }
    px(g, PAL.legnoScuro, 0, 39, 32, 1); px(g, PAL.arancio, 0, 40, 32, 2); px(g, PAL.giallo, 0, 40, 32, 1); px(g, PAL.legno, 0, 42, 32, 1); // tubo
    for (const x of [7, 23]) px(g, PAL.legno, x, 39, 2, 4); // fascette
    for (let x = 0; x < 32; x++) if ((x + 1) % 2) px(g, PAL.acquaProfonda, x, 49); // riga dell'acqua di una volta
    px(g, PAL.roccia, 0, 50, 32, 14); speckle(g, r, PAL.erbaScura, 6, 52, 64); // sotto: bagnato, un po' di muschio
    for (let i = 0; i < 4; i++) { const x = r.int(1, 30); px(g, PAL.legno, x, 43, 1, r.int(3, 9)); } // ruggine colata dal tubo
  });
  const acqua = tex('acqua', 'drenaggio', (g, r) => {
    px(g, PAL.acqua, 0, 0, 32, 32); speckle(g, r, PAL.acquaBassa, 18, 0, 32, 3, 1); speckle(g, r, PAL.acquaProfonda, 14, 0, 32, 2, 1);
    strata(g, [[PAL.acqua, 2], [PAL.acquaProfonda, 32]]);
  });
  const colonna = merged([
    painted(cil(0.42, 0.42, 2.4, 8), PAL.legno, M(0, 1.2, 0)),
    painted(cil(0.5, 0.5, 0.14, 8), PAL.arancio, M(0, 0.4, 0)),
    painted(cil(0.5, 0.5, 0.14, 8), PAL.arancio, M(0, 1.9, 0)),
    painted(cil(0.47, 0.47, 0.3, 8), PAL.legnoScuro, M(0, 1.1, 0)),
    painted(box(0.18, 0.18, 0.4), PAL.giallo, M(0, 1.1, -0.55)), // manometro
  ]);
  kit = {
    pavimento: [{ geo: block(2, 2, top, top - 0.3), mat: texMat(pav) }],
    muro: [{ geo: block(2, 2, 2.4, 0), mat: texMat(muro) }],
    muro_basso: [{ geo: block(2, 2, 0.6, 0), mat: texMat(muro) }],
    colonna: [{ geo: colonna, mat: colori('kit') }],
    acqua: [{ geo: block(2, 2, 0.6, 0), mat: texMat(acqua, PAL.acquaProfonda) }],
  };
  return kit;
}

// ——— forme dei nemici (−Z avanti, pivot a terra) ———
const FORME: Record<string, () => THREE.BufferGeometry> = {
  // Tubo-strisciante: fanghiglia di ruggine e olio che si trascina, un pezzo di tubo piantato dentro, due occhi gialli
  nem_tubo: () => merged([
    painted(cil(0.62, 0.7, 0.12, 8), PAL.neroCaldo, M(0, 0.06, 0)),
    painted(cil(0.45, 0.6, 0.3, 8), PAL.legnoScuro, M(0, 0.25, 0.05)),
    painted(cil(0.28, 0.45, 0.28, 7), PAL.legno, M(0, 0.52, 0.08)),
    painted(cil(0.12, 0.26, 0.2, 6), PAL.ombraCalda, M(0.05, 0.74, 0.1)),
    painted(cil(0.11, 0.11, 0.7, 6), PAL.pietraScura, M(-0.12, 0.75, 0.32, 0.5, 0, 0.3)),
    painted(cil(0.15, 0.15, 0.08, 6), PAL.arancio, M(-0.2, 1.05, 0.48, 0.5, 0, 0.3)),
    painted(box(0.1, 0.08, 0.06), PAL.giallo, M(-0.13, 0.5, -0.4)),
    painted(box(0.1, 0.08, 0.06), PAL.giallo, M(0.13, 0.5, -0.4)),
    painted(box(0.18, 0.05, 0.25), PAL.legno, M(0.4, 0.13, -0.3, 0, 0.4, 0)), // colature che avanzano
    painted(box(0.15, 0.05, 0.22), PAL.legno, M(-0.42, 0.13, -0.2, 0, -0.3, 0)),
  ]),
  // Operaio Arrugginito: automa operaio col barile per torso, fasce d'ottone, visiera gialla, comignolo e chiave inglese
  nem_operaio: () => merged([
    painted(box(0.18, 0.75, 0.22), PAL.roccia, M(-0.15, 0.38, 0)), painted(box(0.18, 0.75, 0.22), PAL.roccia, M(0.15, 0.38, 0)),
    painted(box(0.24, 0.1, 0.32), PAL.neroCaldo, M(-0.15, 0.05, -0.04)), painted(box(0.24, 0.1, 0.32), PAL.neroCaldo, M(0.15, 0.05, -0.04)),
    painted(cil(0.32, 0.28, 0.7, 7), PAL.legno, M(0, 1.1, 0)),
    painted(cil(0.335, 0.335, 0.08, 7), PAL.arancio, M(0, 0.85, 0)), painted(cil(0.335, 0.335, 0.08, 7), PAL.arancio, M(0, 1.35, 0)),
    painted(box(0.36, 0.28, 0.32), PAL.pietraScura, M(0, 1.6, 0)),
    painted(box(0.26, 0.06, 0.04), PAL.giallo, M(0, 1.62, -0.17)),
    painted(cil(0.06, 0.08, 0.35, 6), PAL.neroCaldo, M(0.12, 1.5, 0.28)), // comignolo sulla schiena
    painted(box(0.14, 0.6, 0.14), PAL.legnoScuro, M(-0.42, 1.08, 0)), painted(box(0.14, 0.6, 0.14), PAL.legnoScuro, M(0.42, 1.08, -0.1, -0.5, 0, 0)),
    painted(box(0.08, 0.7, 0.08), PAL.pietra, M(0.42, 1.0, -0.42, -1.1, 0, 0)), // chiave inglese
    painted(box(0.24, 0.1, 0.12), PAL.pietra, M(0.42, 1.3, -0.72, -1.1, 0, 0)),
  ]),
  // Valvola-SparaVapore: tubo che esce dal pavimento, volantino rosso, ugello d'ottone verso il bersaglio, manometro
  nem_valvola: () => merged([
    painted(cil(0.45, 0.5, 0.18, 8), PAL.pietraScura, M(0, 0.09, 0)),
    painted(cil(0.2, 0.2, 1.1, 8), PAL.legno, M(0, 0.7, 0)),
    painted(cil(0.27, 0.27, 0.1, 8), PAL.arancio, M(0, 1.05, 0)),
    painted(cil(0.2, 0.1, 0.55, 8), PAL.arancio, M(0, 1.05, -0.35, Math.PI / 2, 0, 0)), // ugello
    painted(cil(0.06, 0.06, 0.06, 6), PAL.neroCaldo, M(0, 1.05, -0.64, Math.PI / 2, 0, 0)),
    painted(cil(0.3, 0.3, 0.05, 8), PAL.rosso, M(0, 1.38, 0)), // volantino
    painted(box(0.62, 0.05, 0.06), PAL.rosso, M(0, 1.38, 0)), painted(box(0.06, 0.05, 0.62), PAL.rosso, M(0, 1.38, 0)),
    painted(cil(0.05, 0.05, 0.25, 6), PAL.pietraScura, M(0, 1.26, 0)),
    painted(cil(0.13, 0.13, 0.05, 8), PAL.sabbiaChiara, M(0.23, 0.8, -0.05, 0, 0, Math.PI / 2)), // manometro
    painted(box(0.02, 0.1, 0.02), PAL.rosso, M(0.26, 0.82, -0.05)),
  ]),
  // Il Capoturno: grosso automa logoro, caschetto giallo, fornace nel petto, martello pneumatico gigante nella destra
  nem_capoturno: () => merged([
    painted(box(0.34, 0.95, 0.34), PAL.roccia, M(-0.3, 0.48, 0)), painted(box(0.34, 0.95, 0.34), PAL.roccia, M(0.3, 0.48, 0)),
    painted(box(1.1, 0.95, 0.75), PAL.legno, M(0, 1.4, 0)),
    painted(box(1.16, 0.12, 0.8), PAL.arancio, M(0, 1.0, 0)), painted(box(1.16, 0.12, 0.8), PAL.arancio, M(0, 1.8, 0)),
    painted(box(0.5, 0.36, 0.06), PAL.neroCaldo, M(0, 1.38, -0.39)), painted(box(0.42, 0.06, 0.07), PAL.arancio, M(0, 1.3, -0.4)), painted(box(0.42, 0.06, 0.07), PAL.giallo, M(0, 1.42, -0.4)),
    painted(box(0.46, 0.36, 0.42), PAL.pietraScura, M(0, 2.06, -0.05)),
    painted(box(0.34, 0.06, 0.05), PAL.rosso, M(0, 2.08, -0.28)),
    painted(cil(0.32, 0.36, 0.16, 8), PAL.giallo, M(0, 2.3, -0.05)), painted(cil(0.42, 0.42, 0.04, 8), PAL.giallo, M(0, 2.23, -0.08)), // caschetto
    painted(cil(0.09, 0.11, 0.5, 6), PAL.neroCaldo, M(-0.32, 2.0, 0.32)), painted(cil(0.09, 0.11, 0.5, 6), PAL.neroCaldo, M(0.32, 2.0, 0.32)), // comignoli
    painted(box(0.3, 0.85, 0.3), PAL.legnoScuro, M(-0.72, 1.35, 0)),
    painted(box(0.3, 0.8, 0.3), PAL.legnoScuro, M(0.72, 1.45, -0.25, -0.6, 0, 0)),
    painted(cil(0.09, 0.09, 1.5, 6), PAL.pietraScura, M(0.72, 1.2, -0.85, -1.2, 0, 0)), // asta del martello
    painted(box(0.62, 0.5, 0.5), PAL.roccia, M(0.72, 0.85, -1.45, -1.2, 0, 0)), // testa
    painted(cil(0.13, 0.13, 0.4, 6), PAL.arancio, M(0.72, 1.32, -1.1, -1.2, 0, 0)), // pistone
  ]),
};
/** Segnaposto di un nemico del Drenaggio (null = non è uno dei loro). */
export function formaNemico(model: string): THREE.Object3D | null {
  const f = FORME[model];
  if (!f) return null;
  const m = new THREE.Mesh(f(), colori(model).clone()); m.name = model;
  const g = new THREE.Group(); g.name = model; g.add(m);
  return g;
}

// ——— effetti della scena: valvole, geyser, fanghiglia ———
export type DrenaggioFx = { tick(v: DungeonView): void; update(t: number, hero: { x: number; z: number }, v: DungeonView): void; counts(): { valvole: number; geyser: number }; dispose(): void };

/** Volantino di una valvola sul tubo (si gira mentre l'acqua scende, poi resta verde). */
function valvolaObj(): { root: THREE.Group; ruota: THREE.Object3D; rosso: THREE.MeshLambertMaterial } {
  const root = new THREE.Group(); root.name = 'valvola';
  const tubo = new THREE.Mesh(merged([
    painted(cil(0.32, 0.36, 0.12, 8), PAL.pietraScura, M(0, 0.06, 0)),
    painted(cil(0.16, 0.16, 1.2, 8), PAL.legno, M(0, 0.6, 0)),
    painted(cil(0.22, 0.22, 0.1, 8), PAL.arancio, M(0, 0.95, 0)),
    painted(box(0.5, 0.3, 0.06), PAL.giallo, M(0, 0.55, -0.2)), // cartello d'ottone
  ]), colori('valvola'));
  const rosso = new THREE.MeshLambertMaterial({ color: PAL.rosso, flatShading: true, emissive: PAL.rosso, emissiveIntensity: 0.25 });
  const ruota = new THREE.Mesh(merged([
    painted(cil(0.42, 0.42, 0.06, 10), '#ffffff'), painted(box(0.84, 0.06, 0.07), '#ffffff'), painted(box(0.07, 0.06, 0.84), '#ffffff'),
    painted(cil(0.08, 0.08, 0.12, 6), '#ffffff'),
  ]), rosso);
  ruota.position.y = 1.28;
  const buco = new THREE.Mesh(painted(cil(0.32, 0.32, 0.07, 10), PAL.neroCaldo), colori('valvola')); buco.position.y = 1.28; buco.scale.set(1, 1.05, 1);
  root.add(tubo, buco, ruota);
  return { root, ruota, rosso };
}

export function createDrenaggioFx(o: { sc: DungeonScene }): DrenaggioFx {
  const root = new THREE.Group(); root.name = 'drenaggio_fx'; o.sc.scene.add(root);
  const fy = o.sc.floorY;
  const valvole = o.sc.map.valvole.map((v) => { const x = valvolaObj(); x.root.position.set(v.x, fy, v.z); root.add(x.root); return { ...x, n: v.n, aperta: false, girata: -1 }; });
  // geyser: cerchio d'avviso (bianco, si riempie a scatti) e colonna di vapore (blocchi che salgono e tremano)
  const ringGeo = new THREE.RingGeometry(0.9, 1, 16, 1); ringGeo.rotateX(-Math.PI / 2);
  const discGeo = new THREE.CircleGeometry(1, 16); discGeo.rotateX(-Math.PI / 2);
  const ringMat = new THREE.MeshBasicMaterial({ color: PAL.sabbiaChiara, transparent: true, opacity: 0.85, depthWrite: false });
  const discMat = new THREE.MeshBasicMaterial({ color: PAL.acquaBassa, transparent: true, opacity: 0.35, depthWrite: false });
  const vapGeo = merged([
    painted(cil(0.55, 0.7, 0.7, 7), PAL.pietraChiara, M(0, 0.35, 0)), painted(cil(0.45, 0.6, 0.7, 7), PAL.sabbiaChiara, M(0.05, 1.05, 0.04)),
    painted(cil(0.5, 0.5, 0.7, 7), PAL.pietraChiara, M(-0.05, 1.75, -0.03)), painted(cil(0.3, 0.55, 0.6, 7), PAL.sabbiaChiara, M(0, 2.4, 0)),
  ]);
  const vapMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, emissive: PAL.sabbiaChiara, emissiveIntensity: 0.35, transparent: true, opacity: 0.85 });
  const geyser = new Map<number, { g: THREE.Group; ring: THREE.Mesh; disc: THREE.Mesh; vap: THREE.Mesh }>();
  // fanghiglia sotto l'eroe rallentato
  const fango = new THREE.Mesh(merged([painted(cil(0.75, 0.8, 0.04, 8), PAL.legnoScuro), painted(cil(0.35, 0.4, 0.05, 7), PAL.neroCaldo, M(0.25, 0.01, 0.2))]), colori('fango'));
  fango.visible = false; root.add(fango);
  const steps = (v: number, n: number) => Math.floor(Math.max(0, Math.min(1, v)) * n) / n;

  return {
    tick(v) {
      for (const k of valvole) {
        const a = v.valvole.find((x) => x.n === k.n)?.aperta ?? false;
        if (a && !k.aperta) k.girata = performance.now() / 1000;
        k.aperta = a;
      }
      const seen = new Set<number>();
      for (const gv of v.geyser) {
        seen.add(gv.id);
        let r = geyser.get(gv.id);
        if (!r) {
          const g = new THREE.Group(); g.position.set(gv.x, fy + 0.04, gv.z); root.add(g);
          const ring = new THREE.Mesh(ringGeo, ringMat), disc = new THREE.Mesh(discGeo, discMat), vap = new THREE.Mesh(vapGeo, vapMat);
          ring.scale.setScalar(gv.r); disc.scale.setScalar(gv.r); vap.scale.set(gv.r, 0, gv.r);
          g.add(ring, disc, vap); r = { g, ring, disc, vap }; geyser.set(gv.id, r);
        }
        r.disc.scale.setScalar(gv.r * Math.max(0.05, gv.getto ? 1 : steps(gv.t, 5)));
        r.ring.visible = !gv.getto; r.vap.visible = gv.getto;
        if (gv.getto) r.vap.scale.set(gv.r * 0.9, Math.max(0.1, steps(Math.min(1, gv.t * 3), 4)) * (1 - 0.6 * steps(Math.max(0, gv.t - 0.6) / 0.4, 3)), gv.r * 0.9);
      }
      for (const [id, r] of geyser) if (!seen.has(id)) { r.g.removeFromParent(); geyser.delete(id); }
    },
    update(t, hero, v) {
      for (const k of valvole) {
        const lit = o.sc.light(k.root.position.x, k.root.position.z);
        k.root.visible = lit > 0;
        if (!k.root.visible) continue;
        // chiusa: rossa che pulsa piano (è da girare); girata: gira a scatti mentre l'acqua scende, poi verde
        const scende = k.aperta && (v.acque.find((a) => a.n === k.n)?.livello ?? 0) > 0;
        if (scende) k.ruota.rotation.y = Math.floor((t - k.girata) * 12) * (Math.PI / 6);
        const c = k.aperta ? (scende ? PAL.arancio : PAL.erbaChiara) : PAL.rosso;
        if (k.rosso.color.getHexString() !== c.slice(1).toLowerCase()) { k.rosso.color.set(c); k.rosso.emissive.set(c); }
        k.rosso.emissiveIntensity = k.aperta ? 0.2 : 0.15 + 0.25 * (Math.floor(t * 3) % 2);
      }
      for (const r of geyser.values()) if (r.vap.visible) { r.vap.rotation.y = Math.floor(t * 10) * 0.6; r.vap.position.x = 0.05 * ((Math.floor(t * 14) % 3) - 1); }
      fango.visible = !!v.hero.rallentato;
      if (fango.visible) { fango.position.set(hero.x, fy + 0.02, hero.z); fango.rotation.y = Math.floor(t * 4) * 0.4; }
    },
    counts: () => ({ valvole: valvole.length, geyser: geyser.size }),
    dispose() { root.removeFromParent(); ringGeo.dispose(); discGeo.dispose(); vapGeo.dispose(); },
  };
}
