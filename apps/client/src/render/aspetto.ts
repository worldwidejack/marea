// Aspetto del mondo scelto nelle impostazioni (#53): camera, ciclo giorno/notte, stampa giapponese, contorni.
// Con tutto spento qui non si tocca niente: render diretto, luce, cielo e acqua di sempre.
// - camera ≠ 45°: vista più bassa, camera.far più lungo, passata finale con cielo all'orizzonte (niente foschia dal 13 ott, #282)
// - contorni: passata finale con i contorni dalla profondità (il colore stesso più scuro)
// - stampa: palette giapponese, contorni a inchiostro, grana di carta
// - mare: sempre l'acqua a onde della stampa (water2.ts) al posto di quella di prima (Jack, 13 ott 2026, #286); ?pulito=0 = quella di prima
// - ciclo: ogni ~½ s luce, bande del cielo, acqua e foschia dal momento della giornata (ciclo.ts); di notte lanterne e insegne fanno luce (luci.ts, #60)
// - meteo (#361, a nuvole): le nuvole della sim (sim/meteo.ts, dall'orologio: uguali per tutti) si disegnano (nuvole.ts), fanno ombra
//   (passata finale), piovono e lampeggiano dove sono (meteo.ts, water2.ts); sopra il momento della giornata, la luce, il cielo e il suono
//   col tempo del posto dove sei (la nuvola che hai sopra, a gradini). ?nuvole=B la variante B per la scelta di Jack.
import * as THREE from 'three';
import type { GridMap } from '@marea/sim';
import type { Renderer } from './scene.ts';
import type { Lights } from './light.ts';
import type { Water } from './water.ts';
import { setWaterColors, setWaterMeteo, setWaterNight } from './water.ts';
import { createPost } from './post.ts';
import type { Post, PostLook } from './post.ts';
import { createWater2 } from './water2.ts';
import { FLAGS } from '../flags.ts';
import { createLuci } from './luci.ts';
import type { Luci } from './luci.ts';
import type { Water2 } from './water2.ts';
import { GIORNO, LUNA_DIR, LUCE_INTERNO, fase, momento } from './ciclo.ts';
import type { Momento } from './ciclo.ts';
import { MAXN, NUBI, OMBRA, conMeteo, coperturaMeteo, createPioggia } from './meteo.ts';
import type { Pioggia } from './meteo.ts';
import { STILI, createNuvole } from './nuvole.ts';
import type { Nuvole } from './nuvole.ts';
import { distanzaNuvola, lampoAt, meteoCfg, meteoQui, nuvoleAt } from '@marea/sim/meteo.ts';
import type { Lampo, MeteoQui, Nuvola } from '@marea/sim/meteo.ts';
import type { MeteoStato, NuvolaTipo } from '@marea/content';
import { setMeteo, suona } from '../audio/ponte.ts';

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
  /** Meteo (#361): il tempo dove sei ('spento' se l'impostazione è spenta), l'intensità a gradini, le gocce vicine disegnate, quanto
   *  piove e lampeggia dove sei, le nuvole vive (dalla sim) e quelle disegnate, i batuffoli, la variante (A di serie, B con ?nuvole=B). */
  readonly meteo: MeteoStato | 'spento'; readonly meteoK: number; readonly gocce: number;
  readonly nuvole: { variante: 'A' | 'B'; pioggia: number; lampi: number; vento: number; vive: number; vicine: number; disegnate: number; batuffoli: number; tende: number; lampo: boolean };
  /** Test e screenshot: una nuvola di quel tipo sopra chi gioca (lo segue), intensità k (di serie 1); 'sereno' = cielo senza nuvole; null = l'orologio. */
  forzaMeteo(stato: MeteoStato | null, k?: number): void;
  /** Test e screenshot: nuvole ferme nel mondo a (dx, dz) metri da chi gioca adesso, raggio r; [] = nessuna; null = l'orologio. */
  forzaNuvole(ns: readonly { tipo: NuvolaTipo; dx: number; dz: number; r?: number; k?: number }[] | null): void;
  /** Test e screenshot: un lampo acceso fisso nella nuvola di temporale più vicina (true) o quelli dell'orologio (false). */
  forzaLampo(on: boolean): void;
};
const SERENO: MeteoQui = { stato: 'sereno', k: 0, pioggia: 0, lampi: 0, vento: 0, tipi: { bianca: 0, grigia: 0, pioggia: 0, temporale: 0 } };
/** Nuvola finta dei test (ferma, già formata). */
const finta = (i: number, tipo: NuvolaTipo, x: number, z: number, r: number, k: number): Nuvola =>
  ({ id: `prova:${i}`, tipo, x, z, rx: r * 1.15, rz: r / 1.15, dx: 0.8, dz: 0.6, k, forma: 7919 * (i + 1), nata: 0, muore: Number.MAX_SAFE_INTEGER });

/** Decorazioni fisse (coordinate mondo) per le luci di notte, e la quota del terreno sotto di loro. */
type Scena = { props: readonly { k: string; x: number; z: number; rot: number }[]; groundY(x: number, z: number): number };

export function createAspetto(o: { renderer: Renderer; lights: Lights; water: Water; map: GridMap; scena?: Scena }): Aspetto {
  let imp: Impostazioni = { ...SPENTO }, post: Post | null = null, water2: Water2 | null = null;
  let m: Momento = GIORNO, cicloWas = false, nextTick = 0, forzata: number | null = null, luci: Luci | null = null;
  let alChiusoWas = false;
  // meteo (#361): `vis` = il momento col tempo del posto, quello che si dipinge; `met` = il tempo dove sei adesso
  let vis: Momento = GIORNO, met: MeteoQui = SERENO, meteoWas = false;
  let pioggia: Pioggia | null = null, postOn = false, nuvole: Nuvole | null = null;
  const variante = FLAGS.nuvole, cfg = meteoCfg(variante), stile = STILI[variante];
  NUBI.uPioggiaR.value = cfg.nuvole.pioggiaR; NUBI.uQuota.value = stile.quota;
  /** Forzate dai test: `segue` = sopra chi gioca (forzaMeteo), altrimenti ferme nel mondo (forzaNuvole). */
  let forzate: { segue: boolean; ns: { tipo: NuvolaTipo; x: number; z: number; r: number; k: number }[] } | null = null, lampoForzato = false;
  let foco: { x: number; z: number } | null = null, tutte: Nuvola[] = [], vicine: Nuvola[] = [], lampo: Lampo | null = null, lampoSeme = -1, lampoVicino = 0, lampoWas = false, tende = 0;
  const tint = new THREE.Color(), avanti = new THREE.Vector3();
  const look = (): PostLook => {
    const dentro = o.renderer.alChiuso;
    const st = imp.stampa, n = dentro ? 0 : m.notte; // cielo e nuvole col meteo (vis); dentro niente notte per la passata finale (#490)
    return {
      palette: st ? (n >= 0.5 ? PALETTE_STAMPA_NOTTE : PALETTE_STAMPA) : null, paper: st ? 1 : 0,
      grade: { ...(st ? { exp: 1.05 + 0.55 * n, sat: 0.8 + 0.15 * n, con: 1.1 + 0.05 * n, tint: mixHex('#fff2dc', '#e4e8ff', n) } : { exp: 1, sat: 1, con: 1, tint: '#ffffff' }), ...(lampoWas ? { exp: (st ? 1.05 + 0.55 * n : 1) * (1 + 0.9 * lampoVicino) } : {}) }, // il lampo vicino illumina tutto per un attimo
      ink: st ? { col: n >= 0.5 ? '#0d0f1c' : '#1b1d2b', mix: 1, crease: -0.55 } : { col: '#000000', mix: 0, crease: 1 },
      sky: { top: vis.sky3[0], mid: vis.sky3[1], hor: vis.sky3[2], sun: '#ffffff', glow: '#ffffff', sunDir: [0, -1, 0], sunSize: 0, cloud: vis.clouds[0], cloudDark: vis.clouds[1], night: dentro ? 0 : vis.notte, moonDir: LUNA_DIR,
        cover: coperturaMeteo(met.stato, met.k), wind: met.vento },
      fog: { col: vis.fog, near: 0, far: 1, max: 0 }, // foschia spenta (#282)
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
    const dentro = o.renderer.alChiuso;
    vis = conMeteo(m, met.stato, met.k);
    const luna = dentro ? 0 : m.notte * (1 - coperturaMeteo(met.stato, met.k)); // sotto le nuvole o dentro niente scia della luna
    o.lights.set?.(dentro ? LUCE_INTERNO : vis.sun);
    if (!dentro) {
      o.renderer.sky.setBands(vis.bands); setWaterColors(vis.water); setWaterNight(luna, LUNA_DIR);
    acquaStampa(); water2?.night(luna, LUNA_DIR);
    setWaterMeteo(met.vento, met.pioggia);
    pioggia?.set(met.pioggia, m.notte, met.vento);
    // suono: la pioggia dove piove, se no il vento quando soffia forte
      setMeteo(met.pioggia > 0 ? 'pioggia' : met.vento >= 0.4 ? 'vento' : 'sereno', met.pioggia > 0 ? met.pioggia : met.vento >= 0.4 ? met.vento : 0);
    } else {
      pioggia?.set(0, 0, 0);
      setMeteo('sereno', 0);
    }
    aggiornaPost();
  };
  /** Le nuvole adesso (dall'orologio o forzate dai test) e le più vicine a chi gioca, spostate sull'immagine più vicina del campo (toro). */
  const nuvoleAdesso = (nowMs: number, fx: number, fz: number) => {
    if (forzate) {
      if (forzate.segue) for (const n of forzate.ns) { n.x = fx; n.z = fz; }
      tutte = forzate.ns.map((n, i) => finta(i, n.tipo, n.x, n.z, n.r, n.k));
    } else tutte = nuvoleAt(nowMs, cfg);
    const [X0, Z0, X1, Z1] = cfg.campo, W = X1 - X0, H = Z1 - Z0;
    const con = tutte.map((n) => {
      const x = n.x - W * Math.round((n.x - fx) / W), z = n.z - H * Math.round((n.z - fz) / H);
      return { n: x === n.x && z === n.z ? n : { ...n, x, z }, d: Math.max(0, Math.sqrt((x - fx) ** 2 + (z - fz) ** 2) - Math.max(n.rx, n.rz)) };
    });
    con.sort((a, b) => a.d - b.d);
    vicine = con.slice(0, MAXN).map((c) => c.n);
  };
  /** Le nuvole vicine negli uniform condivisi (ombre, pioggia, mare). L'ombra della nuvola dove sei cala quanto ci sei dentro: la luce
   *  del posto (conMeteo) la fa già scura, così non si scurisce due volte. */
  const aggiornaNubi = (fx: number, fz: number) => {
    const A = NUBI.uNubiA.value, B = NUBI.uNubiB.value, bordo = cfg.nuvole.bordo;
    tende = 0;
    vicine.forEach((n, i) => {
      const r = distanzaNuvola(n, fx, fz, cfg), dentro = r < 1 ? Math.min(n.k, Math.floor(Math.min(1, (1 - r) / bordo) * cfg.gradini + 1e-9) / cfg.gradini) : 0;
      const piove = n.tipo === 'pioggia' || n.tipo === 'temporale' ? n.k : 0;
      if (piove > 0) tende++;
      A[i]!.set(n.x, n.z, n.dx, n.dz); B[i]!.set(1 / n.rx, 1 / n.rz, OMBRA[n.tipo] * n.k * (1 - 0.8 * dentro), piove);
    });
    NUBI.uNubiN.value = vicine.length;
  };
  /** Il lampo acceso adesso: nella nuvola di temporale più vicina che ne ha uno (o fisso, dai test). */
  const lampoAdesso = (nowMs: number): Lampo | null => {
    for (const n of vicine) {
      if (n.tipo !== 'temporale') continue;
      if (lampoForzato) { // davanti alla camera, così si vede
        const d = o.renderer.camera.getWorldDirection(avanti), l = Math.hypot(d.x, d.z) || 1, r = Math.min(n.rx, n.rz) * 0.15;
        return { x: n.x + (d.x / l) * r, z: n.z + (d.z / l) * r, da: 0, a: Number.MAX_SAFE_INTEGER, seme: 4242 };
      }
      const l = lampoAt(nowMs, n, cfg);
      if (l) return l;
    }
    return null;
  };
  /** Passata finale: serve per camera bassa, contorni, stampa e ombre delle nuvole. Foschia mai (#282, Jack 13 ott: «elimina la foschia definitivamente»). */
  const aggiornaPost = (sempre = false) => {
    const need = imp.contorni || imp.stampa || imp.cam > 0 || imp.meteo;
    if (need && !post) post = createPost();
    if (post) { post.toggles.contorni = imp.contorni; post.toggles.foschia = false; post.toggles.cielo = imp.cam > 0; post.setStyle(look()); }
    if (sempre || need !== postOn) { o.renderer.setPost(need ? post : null); postOn = need; }
  };
  const api: Aspetto = {
    get momento() { return o.renderer.alChiuso ? 'interno' : (imp.ciclo ? m.nome : 'giorno'); },
    get luci() { return luci?.accese ?? 0; },
    get buio() { return o.renderer.alChiuso ? 0 : (imp.ciclo ? m.luci : 0); },
    get attivo() { return postOn; },
    get meteo() { return imp.meteo ? met.stato : 'spento'; },
    get meteoK() { return imp.meteo ? met.k : 0; },
    get gocce() { return pioggia?.gocce ?? 0; },
    get nuvole() {
      const on = imp.meteo;
      return { variante, pioggia: on ? met.pioggia : 0, lampi: on ? met.lampi : 0, vento: on ? met.vento : 0, vive: on ? tutte.length : 0, vicine: on ? vicine.length : 0,
        disegnate: on ? nuvole?.disegnate ?? 0 : 0, batuffoli: on ? nuvole?.batuffoli ?? 0 : 0, tende: on ? tende : 0, lampo: on && !!lampo };
    },
    set(s) {
      imp = { ...s, cam: Math.max(0, Math.min(VISTE.length - 1, Math.round(s.cam) || 0)) };
      o.renderer.setView(imp.cam > 0 ? VISTE[imp.cam]! : null);
      aggiornaPost(true);
      const onde = imp.stampa || FLAGS.pulito; // il mare della stampa di serie (#286)
      if (onde && !water2) {
        water2 = createWater2(o.map);
        water2.set(1, ACQUA_STAMPA.c, ACQUA_STAMPA.foam, ACQUA_STAMPA.line, [0, 1, 0]);
        o.renderer.scene.add(water2.mesh);
      }
      if (water2) water2.mesh.visible = onde;
      o.water.mesh.visible = !onde;
      if (!imp.meteo) { met = SERENO; tutte = []; vicine = []; lampo = null; NUBI.uNubiN.value = 0; tende = 0; }
      if (imp.meteo && !pioggia) { pioggia = createPioggia(); o.renderer.scene.add(pioggia.object); }
      if (imp.meteo && !nuvole) { nuvole = createNuvole(stile); o.renderer.scene.add(nuvole.group); }
      if (nuvole) nuvole.group.visible = imp.meteo;
      if (pioggia && !imp.meteo) pioggia.object.visible = false;
      // spenti: torna esattamente al giorno di sempre (luce, cielo, acqua, niente pioggia né suono di pioggia)
      if ((!imp.ciclo && cicloWas) || (!imp.meteo && meteoWas)) { if (!imp.ciclo) m = GIORNO; paint(); }
      if (imp.ciclo && !luci && o.scena) luci = createLuci(o.scena);
      if (luci) { if (imp.ciclo) o.renderer.scene.add(luci.group); else { luci.set(0, 0, 0, 0); luci.group.removeFromParent(); } }
      cicloWas = imp.ciclo; meteoWas = imp.meteo; nextTick = 0;
      acquaStampa();
    },
    update(nowMs, t, focus) {
      if (focus) foco = { x: focus.x, z: focus.z };
      if (water2?.mesh.visible) { const p = o.renderer.camera.position; water2.follow(p.x, p.z); water2.update(t); }
      const dentro = o.renderer.alChiuso;
      if (imp.ciclo && luci) { const f = focus ?? o.renderer.camera.position; luci.set(dentro ? 0 : m.luci, f.x, f.z, nowMs); }
      if (imp.meteo && nuvole && pioggia) {
        // ogni frame: le nuvole si muovono piano ma si vedono muovere (posto e forma dalla sim, uguali per tutti)
        const f = focus ?? o.renderer.camera.position, fuori = !dentro;
        nuvoleAdesso(nowMs, f.x, f.z); aggiornaNubi(f.x, f.z);
        nuvole.group.visible = !fuori;
        if (!fuori) nuvole.update(vicine, o.renderer.camera, { x: f.x, y: o.scena?.groundY(f.x, f.z) ?? 0, z: f.z });
        lampo = fuori ? lampoAdesso(nowMs) : null; nuvole.lampo(lampo);
        if (lampo && lampo.seme !== lampoSeme) { // un lampo nuovo: il tuono, più forte quanto è vicino
          lampoSeme = lampo.seme;
          lampoVicino = Math.max(0, 1 - Math.sqrt((lampo.x - f.x) ** 2 + (lampo.z - f.z) ** 2) / 260);
          if (lampoVicino > 0) suona('tuono', lampoVicino);
        }
        const flash = !!lampo && lampoVicino > 0.25;
        if (flash !== lampoWas) { lampoWas = flash; aggiornaPost(); }
        pioggia.object.visible = !fuori && (met.pioggia > 0 || tende > 0);
        if (pioggia.object.visible) pioggia.update(t, f.x, f.z);
      }
      const chiusoCambiato = dentro !== alChiusoWas;
      alChiusoWas = dentro;
      if (!chiusoCambiato && ((!imp.ciclo && !imp.meteo) || nowMs < nextTick)) return;
      nextTick = nowMs + 500; // due volte al secondo bastano: un passaggio dura minuti, un gradino del meteo secondi
      if (imp.ciclo) m = momento(forzata ?? fase(nowMs));
      if (imp.meteo) { const f = focus ?? o.renderer.camera.position; met = dentro ? SERENO : meteoQui(nowMs, f.x, f.z, cfg, tutte); } // al chiuso non piove
      paint();
    },
    forzaFase(f) { forzata = f; nextTick = 0; },
    forzaMeteo(stato, k = 1) {
      const kk = Math.max(0, Math.min(1, k));
      forzate = stato === null ? null : { segue: true, ns: stato === 'sereno' || kk <= 0 ? [] : [{ tipo: stato, x: 0, z: 0, r: 70, k: kk }] };
      nextTick = 0;
    },
    forzaNuvole(ns) {
      const f = o.renderer.camera.position, c = foco ?? { x: f.x, z: f.z };
      forzate = ns === null ? null : { segue: false, ns: ns.map((n) => ({ tipo: n.tipo, x: c.x + n.dx, z: c.z + n.dz, r: n.r ?? 60, k: n.k ?? 1 })) };
      nextTick = 0;
    },
    forzaLampo(on) { lampoForzato = on; },
  };
  return api;
}
