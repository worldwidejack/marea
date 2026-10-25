// Il palco del menù a rulli delle Corse (#271): la scena 3D dietro i pannelli di scelta.
// - pista: la pista vera (nastro, scenografia, mare) col suo fondale dipinto, e la camera che la sorvola piano, alta, guardando avanti;
// - veicolo: il veicolo con l'avatar al volante su una pedana che gira, davanti al fondale della pista scelta.
// Le piste costruite restano in memoria finché il palco è vivo (sono 3-4 per zona): scorrendo il rullo non si ricostruisce niente.
// Non ha un renderer suo: chi lo usa (corse/index.ts) disegna `scene` con la `camera` di sempre.
import * as THREE from 'three';
import { CORSE_PISTE } from '@marea/content/corse.ts';
import { punto } from '@marea/sim/corse/nastro.ts';
import { pistaCorse } from '@marea/sim/corse/pista.ts';
import type { Pista } from '@marea/sim/corse/pista.ts';
import type { Look } from '@marea/protocol';
import { P } from '../render/island_parts.ts';
import { createLights } from '../render/light.ts';
import { createAvatar } from '../game/avatar.ts';
import type { Avatar } from '../game/avatar.ts';
import { creaPista3d } from './nastro3d.ts';
import type { Pista3d } from './nastro3d.ts';
import { fondalePista } from './fondale_piste.ts';
import type { Fondale } from './discesa/fondale.ts';
import { veicoloMesh } from './veicoli3d.ts';
import { caricaKit, kitPronto, loaderCorse, modelloDi, postoAvatar } from './veicoli_kit.ts';
import { caricaVeicoloAi } from './veicoli_ai.ts';

export type Palco = {
  readonly scene: THREE.Scene;
  /** C'è qualcosa da guardare (una pista o un veicolo): chi disegna mostra `scene` invece della sua. */
  attivo(): boolean;
  /** Il volo sopra la pista `id`. */
  pista(id: string): void;
  /** Il veicolo `id` sulla pedana, davanti al fondale della pista `pista`; `verso` = dove sta sullo schermo (frazione della larghezza,
   *  + = a destra), per lasciare libero il posto dei pannelli. */
  veicolo(id: string, pista: string, verso?: number): void;
  /** La foto del veicolo per la lista (data URL, a bassa risoluzione: si vede a pixel come il gioco); '' se WebGL non c'è. Fatte una
   *  volta sola con un renderer a parte, poi buttato. */
  foto(id: string): Promise<string>;
  /** Spento: niente da disegnare (le piste restano in memoria). */
  spegni(): void;
  /** Camera e pedana: una volta per frame quando è attivo. */
  aggiorna(dt: number): void;
};

/** La pedana alla Mario Kart: pietra chiara a lastre con l'anello a scacchi bianco e blu e il fianco di pietra. r 1.95 m, alta 0.47. */
function pedanaGeo(): THREE.BufferGeometry {
  const pos: number[] = [], col: number[] = [], c = new THREE.Color(), N = 32, R = 1.95, R2 = 1.55, H = 0.12, B = -0.35;
  const tri = (a: number[], b: number[], d: number[], colore: string) => { pos.push(...a, ...b, ...d); c.set(colore); for (let k = 0; k < 3; k++) col.push(c.r, c.g, c.b); };
  for (let k = 0; k < N; k++) {
    const a0 = (k / N) * Math.PI * 2, a1 = ((k + 1) / N) * Math.PI * 2, s0 = Math.sin(a0), c0 = Math.cos(a0), s1 = Math.sin(a1), c1 = Math.cos(a1);
    const o0 = [R * c0, H, R * s0], o1 = [R * c1, H, R * s1], i0 = [R2 * c0, H, R2 * s0], i1 = [R2 * c1, H, R2 * s1];
    const m0 = [R2 * 0.55 * c0, H, R2 * 0.55 * s0], m1 = [R2 * 0.55 * c1, H, R2 * 0.55 * s1];
    const piano = k % 4 < 2 ? P.pietraChiara : '#d9d2c6';
    tri([0, H, 0], m1, m0, '#cfc8bb'); tri(m0, m1, i1, piano); tri(m0, i1, i0, piano);   // il piano
    const anello = k % 2 ? P.acquaProfonda : P.pietraChiara;
    tri(i0, i1, o1, anello); tri(i0, o1, o0, anello);                                                                    // l'anello
    const b0 = [R * c0, B, R * s0], b1 = [R * c1, B, R * s1], fianco = k % 2 ? P.pietra : P.pietraChiara;
    tri(o0, o1, b1, fianco); tri(o0, b1, b0, fianco);                                                                    // il fianco
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.computeVertexNormals();
  return g;
}

/** Le foto dei veicoli: un renderer piccolo a parte, usato per tutte quelle chieste nello stesso momento e poi buttato (sul telefono un
 *  secondo WebGL acceso pesa). 168×100 px: nella lista si vedono a pixel, come il resto del gioco. */
const foto = new Map<string, Promise<string>>();
let coda: { id: string; fatto: (url: string) => void }[] = [];
function fotoVeicolo(id: string): Promise<string> {
  let f = foto.get(id);
  if (!f) {
    f = new Promise<string>((fatto) => { coda.push({ id, fatto }); if (coda.length === 1) void caricaKit().catch(() => {}).then(() => Promise.all(coda.map((x) => caricaVeicoloAi(modelloDi(x.id))))).then(() => setTimeout(scatta, 0)); });
    foto.set(id, f);
  }
  return f;
}
function scatta(): void {
  const lista = coda; coda = [];
  if (!lista.length) return;
  let gl: THREE.WebGLRenderer | null = null;
  try { gl = new THREE.WebGLRenderer({ alpha: true, antialias: false, preserveDrawingBuffer: true }); } catch { for (const x of lista) x.fatto(''); return; }
  gl.setPixelRatio(1); gl.setSize(168, 100, false); gl.outputColorSpace = THREE.SRGBColorSpace; gl.setClearColor(0x000000, 0);
  const scena = new THREE.Scene();
  scena.add(new THREE.HemisphereLight(0xffffff, 0x88aacc, 1.6));
  const sole = new THREE.DirectionalLight(0xfff0d8, 2.2); sole.position.set(-6, 10, 6); scena.add(sole);
  const cam = new THREE.PerspectiveCamera(24, 168 / 100, 0.1, 100); cam.position.set(0, 2.3, 5.6); cam.lookAt(0, 0.45, 0);
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  for (const x of lista) {
    const m = veicoloMesh(x.id, P.rosso, P.pietraChiara, null, null, kitPronto(), mat);
    m.rotation.y = (150 * Math.PI) / 180; scena.add(m);
    gl.render(scena, cam); x.fatto(gl.domElement.toDataURL('image/png'));
    scena.remove(m); m.geometry.dispose();
  }
  mat.dispose(); gl.dispose(); gl.forceContextLoss();
}

/** Volo: m/s lungo la pista, quota e anticipo dello sguardo (m), oscillazione di lato (m). */
const VOLO = { v: 13, alto: 11, avanti: 30, lato: 7 };

export function creaPalco(o: { camera: THREE.PerspectiveCamera; look: () => Look }): Palco {
  const scene = new THREE.Scene(); scene.name = 'corse_palco';
  scene.background = new THREE.Color(P.acquaBassa);
  const luci = createLights(); scene.add(luci.group);
  const piste = new Map<string, { p: Pista; p3d: Pista3d }>();
  let modo: 'pista' | 'veicolo' | null = null, ora: { p: Pista; p3d: Pista3d } | null = null, fondale: Fondale | null = null;
  let s = 0, t = 0, verso = -0.17;
  const A: [number, number, number] = [0, 0, 0], B: [number, number, number] = [0, 0, 0];

  // ---- la pedana del veicolo: un ottagono di legno con l'orlo di pietra, sotto il veicolo che gira ----
  const pedana = new THREE.Group(); pedana.name = 'corse_pedana'; pedana.visible = false; scene.add(pedana);
  const matPiatto = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  const piedistallo = new THREE.Mesh(pedanaGeo(), matPiatto); piedistallo.receiveShadow = true; pedana.add(piedistallo);
  const giostra = new THREE.Group(); giostra.position.y = 0.12; pedana.add(giostra);
  const matVeicolo = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  let mezzo: THREE.Mesh | null = null, mezzoId = '', avatar: Avatar | null = null, avatarP: Promise<Avatar | null> | null = null;
  const avatarCaricato = () => (avatarP ??= loaderCorse().then((l) => createAvatar({ loader: l, look: o.look(), x: 0, z: 0 })).catch(() => null));
  function metti(id: string) {
    if (mezzo) { giostra.remove(mezzo); mezzo.geometry.dispose(); }
    if (avatar) { avatar.attachTo(null); avatar.object.removeFromParent(); avatar.visible = false; }
    const kit = kitPronto();
    mezzo = veicoloMesh(id, P.rosso, P.pietraChiara, null, null, kit, matVeicolo);
    mezzo.castShadow = true; mezzo.name = 'corse_palco_' + id; mezzoId = id; giostra.add(mezzo);
    if (!kit) { void caricaKit().then(() => { if (mezzoId === id && modo === 'veicolo') metti(id); }); return; }
    const m = mezzo;
    void avatarCaricato().then((a) => {
      if (!a || mezzo !== m) return;
      const { seat, scala } = postoAvatar(id, null);
      a.setLook(o.look()); a.attachTo(m, seat, 0); a.object.scale.setScalar(scala); a.visible = true; avatar = a;
    });
  }

  /** La camera è quella del gioco: l'inquadratura spostata del veicolo non deve restarle addosso. */
  function senzaOffset() { if (o.camera.view?.enabled) o.camera.clearViewOffset(); }
  function costruita(id: string) {
    let x = piste.get(id);
    if (!x) {
      const p = pistaCorse(id), p3d = creaPista3d(p);
      p3d.group.visible = false; scene.add(p3d.group);
      piste.set(id, (x = { p, p3d }));
    }
    return x;
  }
  function sfondo(id: string) {
    const d = CORSE_PISTE[id];
    const f = d ? fondalePista(id, d.zona) : null;
    if (fondale && fondale !== f) scene.remove(fondale.mesh);
    fondale = f; if (f) scene.add(f.mesh); // un fondale sta in una scena sola: la gara lo riprende alla sua `mostra`
  }

  return {
    scene,
    foto: (id) => fotoVeicolo(id),
    attivo: () => modo !== null,
    pista(id) {
      senzaOffset();
      const x = costruita(id);
      if (ora !== x) { if (ora) ora.p3d.group.visible = false; ora = x; x.p3d.group.visible = true; s = x.p.def.via ?? 0; t = 0; }
      pedana.visible = false; modo = 'pista'; sfondo(id);
    },
    veicolo(id, pista, v = -0.17) {
      verso = v;
      if (ora) { ora.p3d.group.visible = false; ora = null; }
      pedana.visible = true; modo = 'veicolo'; sfondo(pista);
      if (id !== mezzoId || !mezzo) metti(id);
    },
    spegni() { modo = null; senzaOffset(); if (fondale) { scene.remove(fondale.mesh); fondale = null; } },
    aggiorna(dt) {
      const cam = o.camera; t += dt;
      if (modo === 'pista' && ora) {
        const n = ora.p.n;
        s += dt * VOLO.v; if (s > n.len) s -= n.len;
        const sa = n.chiuso ? (s + VOLO.avanti) % n.len : Math.min(n.len, s + VOLO.avanti);
        punto(n, s, Math.sin(t * 0.25) * VOLO.lato, 0, A); punto(n, sa, 0, 0, B);
        // quota sopra il più alto dei due punti: nei giri della morte e sui tornanti alti la camera non entra nella pista
        const y = Math.max(A[1], B[1]) + VOLO.alto;
        cam.position.set(A[0], y, A[2]); cam.up.set(0, 1, 0); cam.lookAt(B[0], B[1] + 1, B[2]);
        luci.follow?.(B[0], B[2]);
      } else if (modo === 'veicolo') {
        giostra.rotation.y += dt * 0.6;
        // si guarda verso +x, il centro del panorama (di lato c'è la cucitura dello specchio), quasi in piano; il veicolo sale nella metà
        // alta dello schermo spostando l'inquadratura (sotto c'è il pannello coi numeri: in orizzontale sul telefono è metà schermo)
        // e verso sinistra: a destra c'è la scheda coi numeri
        const w = Math.round(100 * cam.aspect), su = -3, sx = Math.round(-w * verso);
        if (!cam.view || cam.view.offsetY !== su || cam.view.offsetX !== sx || cam.view.fullWidth !== w) cam.setViewOffset(w, 100, sx, su, w, 100);
        cam.position.set(-4.9, 1.75, 0); cam.up.set(0, 1, 0); cam.lookAt(0, 0.5, 0); // bassa, da eroe: l'orizzonte dietro il veicolo
        avatar?.update(1, dt);
        luci.follow?.(0, 0);
      }
      fondale?.segui(cam);
    },
  };
}
