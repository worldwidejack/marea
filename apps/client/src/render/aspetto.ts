// Aspetto del mondo scelto nelle impostazioni (#53): camera, ciclo giorno/notte, stampa giapponese, contorni.
// Con tutto spento qui non si tocca niente: render diretto, luce, cielo e acqua di sempre.
// - camera ≠ 45°: vista più bassa, camera.far più lungo, passata finale con cielo all'orizzonte e foschia (copre il bordo del mondo)
// - contorni: passata finale con i contorni dalla profondità (il colore stesso più scuro)
// - stampa: palette giapponese, contorni a inchiostro, grana di carta, acqua a onde (water2.ts) al posto di quella del gioco
// - ciclo: ogni ~½ s luce, bande del cielo, acqua e foschia dal momento della giornata (ciclo.ts); di notte lanterne e insegne fanno luce (luci.ts, #60)
// - meteo (#85): sopra il momento della giornata, il tempo che fa (sim/meteo.ts dall'orologio): luce, cielo, acqua, foschia, pioggia (meteo.ts)
import * as THREE from 'three';
import type { GridMap } from '@marea/sim';
import type { Renderer } from './scene.ts';
import type { Lights } from './light.ts';
import type { Water } from './water.ts';
import { setWaterColors, setWaterMeteo, setWaterNight } from './water.ts';
import { createPost } from './post.ts';
import type { Post, PostLook } from './post.ts';
import { createWater2 } from './water2.ts';
import { createLuci } from './luci.ts';
import type { Luci } from './luci.ts';
import type { Water2 } from './water2.ts';
import { GIORNO, LUNA_DIR, fase, momento } from './ciclo.ts';
import type { Momento } from './ciclo.ts';
import { conMeteo, coperturaMeteo, createPioggia, foschiaMeteo, serveFoschia } from './meteo.ts';
import type { Pioggia } from './meteo.ts';
import { meteoAt } from '@marea/sim/meteo.ts';
import type { MeteoStato } from '@marea/content';
import { setMeteo } from '../audio/ponte.ts';

import { SPENTO, VISTE } from './viste.ts';
import type { Impostazioni } from './viste.ts';
/** Stampa giapponese: indaco e blu di Prussia, carta crema, ocra, verde muschio, vermiglio, inchiostro (anche provapixel/styles.ts). */
export const PALETTE_STAMPA = ['#1b1d2b', '#1f3b6e', '#2f5f9e', '#5f8fbf', '#9cc0d8', '#f2ead6', '#e3d5b4', '#d9b07a', '#a8774a', '#6b4a33', '#3d5a3a', '#6f8f4e', '#a3b46a', '#c8402e', '#8a8478', '#bdb4a2', '#e9a23b'];
/** Stampa giapponese di notte (#61), come le notti di Hiroshige: tanti indaco per leggere le forme al buio, luna e carta crema,
 *  lanterne ambra e fiamma, vermiglio, verdi e legni spenti. Prende il posto di quella del giorno da metà tramonto a metà alba. */
export const PALETTE_STAMPA_NOTTE = ['#0d0f1c', '#141a33', '#1c2647', '#25345e', '#324777', '#435d91', '#5a77a8', '#7891bd', '#9fb2cf', '#d9d0b0', '#f2e6c4', '#e9a23b', '#f5d547', '#c8402e', '#7a2a24', '#2a3a34', '#3e5446', '#3a2c2a', '#5e4636'];
/** Acqua a onde della stampa (water2): dal chiaro allo scuro, schiuma, riga delle onde; di giorno e di notte. */
const ACQUA_STAMPA = { c: ['#9cc0d8', '#5f8fbf', '#2f5f9e', '#1f3b6e'], foam: '#f2ead6', line: '#9cc0d8' };
const ACQUA_STAMPA_NOTTE = { c: ['#5a77a8', '#324777', '#25345e', '#1c2647'], foam: '#d9d0b0', line: '#5a77a8' };
const ca = new THREE.Color(), cb = new THREE.Color();
const mixHex = (a: string, b: string, k: number) => '#' + ca.set(a).lerp(cb.set(b), k).getHexString();

export type Aspetto = {
  set(s: Impostazioni): void; update(nowMs: number, t: number, focus?: { x: number; z: number }): void; readonly momento: string; readonly attivo: boolean;
  /** Luci vere accese adesso (#60), per i test. */
  readonly luci: number;
  /** 0..1: quanto è buio (0 di giorno o col ciclo spento, 1 a notte piena): lucciole (#67). */
  readonly buio: number;
  /** Test e screenshot: fissa il momento del giro (0 giorno … 0,75 notte); null = l'orologio. */
  forzaFase(f: number | null): void;
  /** Meteo (#85): lo stato adesso ('spento' se l'impostazione è spenta), l'intensità a gradini e le gocce disegnate. */
  readonly meteo: MeteoStato | 'spento'; readonly meteoK: number; readonly gocce: number;
  /** Test e screenshot: fissa il tempo (intensità k, di serie 1); null = l'orologio. */
  forzaMeteo(stato: MeteoStato | null, k?: number): void;
};

/** Decorazioni fisse (coordinate mondo) per le luci di notte, e la quota del terreno sotto di loro. */
type Scena = { props: readonly { k: string; x: number; z: number; rot: number }[]; groundY(x: number, z: number): number };

export function createAspetto(o: { renderer: Renderer; lights: Lights; water: Water; map: GridMap; scena?: Scena }): Aspetto {
  let imp: Impostazioni = { ...SPENTO }, post: Post | null = null, water2: Water2 | null = null;
  let m: Momento = GIORNO, cicloWas = false, nextTick = 0, forzata: number | null = null, luci: Luci | null = null;
  // meteo (#85): `vis` = il momento col tempo che fa, quello che si dipinge; `met` = stato e intensità adesso
  let vis: Momento = GIORNO, met: { stato: MeteoStato; k: number } = { stato: 'sereno', k: 0 }, meteoWas = false, meteoForzato: { stato: MeteoStato; k: number } | null = null;
  let pioggia: Pioggia | null = null, postOn = false;
  const tint = new THREE.Color();
  const look = (): PostLook => {
    const st = imp.stampa, n = m.notte, fo = foschiaMeteo(met.stato, met.k); // cielo, nuvole e foschia col meteo (vis) // di notte la stampa schiarisce un po' la scena buia e la porta sui suoi indaco
    return {
      palette: st ? (n >= 0.5 ? PALETTE_STAMPA_NOTTE : PALETTE_STAMPA) : null, dither: st ? 0.08 : 0, paper: st ? 1 : 0,
      grade: st ? { exp: 1.05 + 0.55 * n, sat: 0.8 + 0.15 * n, con: 1.1 + 0.05 * n, tint: mixHex('#fff2dc', '#e4e8ff', n) } : { exp: 1, sat: 1, con: 1, tint: '#ffffff' },
      ink: st ? { col: n >= 0.5 ? '#0d0f1c' : '#1b1d2b', mix: 1, crease: -0.55 } : { col: '#000000', mix: 0, crease: 1 },
      sky: { top: vis.sky3[0], mid: vis.sky3[1], hor: vis.sky3[2], sun: '#ffffff', glow: '#ffffff', sunDir: [0, -1, 0], sunSize: 0, cloud: vis.clouds[0], cloudDark: vis.clouds[1], night: vis.notte, moonDir: LUNA_DIR,
        cover: coperturaMeteo(met.stato, met.k), wind: met.stato === 'vento' ? met.k : met.stato === 'pioggia' ? 0.3 * met.k : 0 },
      fog: { col: vis.fog, near: fo.near, far: fo.far, max: fo.max },
    };
  };
  /** Acqua della stampa: colori suoi di notte (invece di scurire quelli del giorno, che finirebbero tutti sullo stesso blu). */
  const acquaStampa = () => {
    if (!water2) return;
    const n = m.notte, d = ACQUA_STAMPA, k = ACQUA_STAMPA_NOTTE;
    water2.set(1, d.c.map((c, i) => mixHex(c, k.c[i]!, n)), mixHex(d.foam, k.foam, n), mixHex(d.line, k.line, n), [0, 1, 0]);
    water2.tint(tint.set(mixHex(vis.tint, '#ffffff', n)));
  };
  /** Luce, cielo e acqua dal momento `m` (anche per tornare al giorno di serie quando si spegne il ciclo). */
  const paint = () => {
    vis = conMeteo(m, met.stato, met.k);
    const luna = m.notte * (1 - coperturaMeteo(met.stato, met.k)); // sotto le nuvole niente scia della luna
    o.lights.set?.(vis.sun); o.renderer.sky.setBands(vis.bands); setWaterColors(vis.water); setWaterNight(luna, LUNA_DIR);
    acquaStampa(); water2?.night(luna, LUNA_DIR);
    setWaterMeteo(met.stato === 'vento' ? met.k : met.stato === 'pioggia' ? 0.25 * met.k : 0, met.stato === 'pioggia' ? met.k : 0);
    pioggia?.set(met.stato === 'pioggia' ? met.k : 0, m.notte, 0.3);
    setMeteo(met.stato === 'pioggia' ? 'pioggia' : met.stato === 'vento' ? 'vento' : 'sereno', met.stato === 'pioggia' || met.stato === 'vento' ? met.k : 0);
    aggiornaPost();
  };
  /** Passata finale: serve per camera bassa, contorni, stampa, e per la foschia del meteo (nebbia, pioggia) anche con la camera di sempre. */
  const aggiornaPost = (sempre = false) => {
    const nebbia = imp.meteo && serveFoschia(met.stato, met.k);
    const need = imp.contorni || imp.stampa || imp.cam > 0 || nebbia;
    if (need && !post) post = createPost();
    if (post) { post.toggles.contorni = imp.contorni; post.toggles.foschia = imp.cam > 0 || nebbia; post.toggles.cielo = imp.cam > 0; post.setStyle(look()); }
    if (sempre || need !== postOn) { o.renderer.setPost(need ? post : null); postOn = need; }
  };
  const api: Aspetto = {
    get momento() { return imp.ciclo ? m.nome : 'giorno'; },
    get luci() { return luci?.accese ?? 0; },
    get buio() { return imp.ciclo ? m.luci : 0; },
    get attivo() { return postOn; },
    get meteo() { return imp.meteo ? met.stato : 'spento'; },
    get meteoK() { return imp.meteo ? met.k : 0; },
    get gocce() { return pioggia?.gocce ?? 0; },
    set(s) {
      imp = { ...s, cam: Math.max(0, Math.min(VISTE.length - 1, Math.round(s.cam) || 0)) };
      o.renderer.setView(imp.cam > 0 ? VISTE[imp.cam]! : null);
      aggiornaPost(true);
      if (imp.stampa && !water2) {
        water2 = createWater2(o.map);
        water2.set(1, ACQUA_STAMPA.c, ACQUA_STAMPA.foam, ACQUA_STAMPA.line, [0, 1, 0]);
        o.renderer.scene.add(water2.mesh);
      }
      if (water2) water2.mesh.visible = imp.stampa;
      o.water.mesh.visible = !imp.stampa;
      if (!imp.meteo) met = { stato: 'sereno', k: 0 };
      if (imp.meteo && !pioggia) { pioggia = createPioggia(); o.renderer.scene.add(pioggia.object); }
      // spenti: torna esattamente al giorno di sempre (luce, cielo, acqua, niente pioggia né suono di pioggia)
      if ((!imp.ciclo && cicloWas) || (!imp.meteo && meteoWas)) { if (!imp.ciclo) m = GIORNO; paint(); }
      if (imp.ciclo && !luci && o.scena) luci = createLuci(o.scena);
      if (luci) { if (imp.ciclo) o.renderer.scene.add(luci.group); else { luci.set(0, 0, 0, 0); luci.group.removeFromParent(); } }
      cicloWas = imp.ciclo; meteoWas = imp.meteo; nextTick = 0;
      acquaStampa();
    },
    update(nowMs, t, focus) {
      if (water2?.mesh.visible) { const p = o.renderer.camera.position; water2.follow(p.x, p.z); water2.update(t); }
      if (imp.ciclo && luci) { const f = focus ?? o.renderer.camera.position; luci.set(m.luci, f.x, f.z, nowMs); }
      if (pioggia?.object.visible) { const f = focus ?? o.renderer.camera.position; pioggia.update(t, f.x, f.z); }
      if ((!imp.ciclo && !imp.meteo) || nowMs < nextTick) return;
      nextTick = nowMs + 500; // due volte al secondo bastano: un passaggio dura minuti, un gradino del meteo secondi
      if (imp.ciclo) m = momento(forzata ?? fase(nowMs));
      if (imp.meteo) met = meteoForzato ?? (({ stato, k }) => ({ stato, k }))(meteoAt(nowMs));
      paint();
    },
    forzaFase(f) { forzata = f; nextTick = 0; },
    forzaMeteo(stato, k = 1) { meteoForzato = stato ? { stato, k: Math.max(0, Math.min(1, k)) } : null; nextTick = 0; },
  };
  return api;
}
