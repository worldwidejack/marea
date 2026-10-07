// Aspetto del mondo scelto nelle impostazioni (#53): camera, ciclo giorno/notte, stampa giapponese, contorni.
// Con tutto spento qui non si tocca niente: render diretto, luce, cielo e acqua di sempre.
// - camera ≠ 45°: vista più bassa, camera.far più lungo, passata finale con cielo all'orizzonte e foschia (copre il bordo del mondo)
// - contorni: passata finale con i contorni dalla profondità (il colore stesso più scuro)
// - stampa: palette giapponese, contorni a inchiostro, grana di carta, acqua a onde (water2.ts) al posto di quella del gioco
// - ciclo: ogni ~½ s luce, bande del cielo, acqua e foschia dal momento della giornata (ciclo.ts)
import * as THREE from 'three';
import type { GridMap } from '@marea/sim';
import type { Renderer } from './scene.ts';
import type { Lights } from './light.ts';
import type { Water } from './water.ts';
import { setWaterColors, setWaterNight } from './water.ts';
import { createPost } from './post.ts';
import type { Post, PostLook } from './post.ts';
import { createWater2 } from './water2.ts';
import type { Water2 } from './water2.ts';
import { GIORNO, LUNA_DIR, fase, momento } from './ciclo.ts';
import type { Momento } from './ciclo.ts';

import { SPENTO, VISTE } from './viste.ts';
import type { Impostazioni } from './viste.ts';
/** Stampa giapponese: indaco e blu di Prussia, carta crema, ocra, verde muschio, vermiglio, inchiostro (anche provapixel/styles.ts). */
export const PALETTE_STAMPA = ['#1b1d2b', '#1f3b6e', '#2f5f9e', '#5f8fbf', '#9cc0d8', '#f2ead6', '#e3d5b4', '#d9b07a', '#a8774a', '#6b4a33', '#3d5a3a', '#6f8f4e', '#a3b46a', '#c8402e', '#8a8478', '#bdb4a2', '#e9a23b'];

export type Aspetto = {
  set(s: Impostazioni): void; update(nowMs: number, t: number): void; readonly momento: string; readonly attivo: boolean;
  /** Test e screenshot: fissa il momento del giro (0 giorno … 0,75 notte); null = l'orologio. */
  forzaFase(f: number | null): void;
};

export function createAspetto(o: { renderer: Renderer; lights: Lights; water: Water; map: GridMap }): Aspetto {
  let imp: Impostazioni = { ...SPENTO }, post: Post | null = null, water2: Water2 | null = null;
  let m: Momento = GIORNO, cicloWas = false, nextTick = 0, forzata: number | null = null;
  const tint = new THREE.Color();
  const look = (): PostLook => {
    const st = imp.stampa;
    return {
      palette: st ? PALETTE_STAMPA : null, dither: st ? 0.08 : 0, paper: st ? 1 : 0,
      grade: st ? { exp: 1.05, sat: 0.8, con: 1.1, tint: '#fff2dc' } : { exp: 1, sat: 1, con: 1, tint: '#ffffff' },
      ink: st ? { col: '#1b1d2b', mix: 1, crease: -0.55 } : { col: '#000000', mix: 0, crease: 1 },
      sky: { top: m.sky3[0], mid: m.sky3[1], hor: m.sky3[2], sun: '#ffffff', glow: '#ffffff', sunDir: [0, -1, 0], sunSize: 0, cloud: m.clouds[0], cloudDark: m.clouds[1], night: m.notte, moonDir: LUNA_DIR },
      fog: { col: m.fog, near: 35, far: 200, max: 0.8 },
    };
  };
  /** Luce, cielo e acqua dal momento `m` (anche per tornare al giorno di serie quando si spegne il ciclo). */
  const paint = () => {
    o.lights.set?.(m.sun); o.renderer.sky.setBands(m.bands); setWaterColors(m.water); setWaterNight(m.notte, LUNA_DIR);
    water2?.tint(tint.set(m.tint)); water2?.night(m.notte, LUNA_DIR);
    post?.setStyle(look());
  };
  const api: Aspetto = {
    get momento() { return imp.ciclo ? m.nome : 'giorno'; },
    get attivo() { return post !== null && (imp.contorni || imp.stampa || imp.cam > 0); },
    set(s) {
      imp = { ...s, cam: Math.max(0, Math.min(VISTE.length - 1, Math.round(s.cam) || 0)) };
      o.renderer.setView(imp.cam > 0 ? VISTE[imp.cam]! : null);
      const needPost = imp.contorni || imp.stampa || imp.cam > 0;
      if (needPost && !post) post = createPost();
      if (post) {
        post.toggles.contorni = imp.contorni; post.toggles.foschia = imp.cam > 0; post.toggles.cielo = imp.cam > 0;
        post.setStyle(look());
      }
      o.renderer.setPost(needPost ? post : null);
      if (imp.stampa && !water2) {
        water2 = createWater2(o.map);
        water2.set(1, ['#9cc0d8', '#5f8fbf', '#2f5f9e', '#1f3b6e'], '#f2ead6', '#9cc0d8', [0, 1, 0]);
        o.renderer.scene.add(water2.mesh);
      }
      if (water2) water2.mesh.visible = imp.stampa;
      o.water.mesh.visible = !imp.stampa;
      if (!imp.ciclo && cicloWas) { m = GIORNO; paint(); } // spento: torna esattamente al giorno di sempre
      cicloWas = imp.ciclo; nextTick = 0;
      if (water2) water2.tint(tint.set(m.tint));
    },
    update(nowMs, t) {
      if (water2?.mesh.visible) { const p = o.renderer.camera.position; water2.follow(p.x, p.z); water2.update(t); }
      if (!imp.ciclo || nowMs < nextTick) return;
      nextTick = nowMs + 500; // due volte al secondo bastano: un passaggio dura minuti
      m = momento(forzata ?? fase(nowMs)); paint();
    },
    forzaFase(f) { forzata = f; nextTick = 0; },
  };
  return api;
}
