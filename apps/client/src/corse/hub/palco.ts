// Il palco del menù a rulli delle Corse (#271): la scena 3D dietro i pannelli di scelta.
// - pista: la pista vera (nastro, scenografia, mare) col suo fondale dipinto, e la camera che la sorvola piano, alta, guardando avanti;
// - veicolo: il veicolo con l'avatar al volante su una pedana che gira, davanti al fondale della pista scelta.
// Le piste costruite restano in memoria finché il palco è vivo (sono 3-4 per zona): scorrendo il rullo non si ricostruisce niente.
// Non ha un renderer suo: chi lo usa (corse/index.ts nel gioco, hub/prova.ts al banco) disegna `scene` con la `camera` di sempre.
import * as THREE from 'three';
import { CORSE_PISTE } from '@marea/content/corse.ts';
import { punto } from '@marea/sim/corse/nastro.ts';
import { pistaCorse } from '@marea/sim/corse/pista.ts';
import type { Pista } from '@marea/sim/corse/pista.ts';
import type { Look } from '@marea/protocol';
import { P } from '../../render/island_parts.ts';
import { createLights } from '../../render/light.ts';
import { createAvatar } from '../../game/avatar.ts';
import type { Avatar } from '../../game/avatar.ts';
import { creaPista3d } from '../nastro3d.ts';
import type { Pista3d } from '../nastro3d.ts';
import { fondalePista } from '../fondale_piste.ts';
import type { Fondale } from '../discesa/fondale.ts';
import { veicoloGeo } from '../veicoli3d.ts';
import { caricaKit, kitPronto, loaderCorse, postoAvatar } from '../veicoli_kit.ts';

export type Palco = {
  readonly scene: THREE.Scene;
  /** C'è qualcosa da guardare (una pista o un veicolo): chi disegna mostra `scene` invece della sua. */
  attivo(): boolean;
  /** Il volo sopra la pista `id`. */
  pista(id: string): void;
  /** Il veicolo `id` sulla pedana, davanti al fondale della pista `pista`; `verso` = dove sta sullo schermo (frazione della larghezza,
   *  + = a destra), per lasciare libero il posto dei pannelli. */
  veicolo(id: string, pista: string, verso?: number): void;
  /** Spento: niente da disegnare (le piste restano in memoria). */
  spegni(): void;
  /** Camera e pedana: una volta per frame quando è attivo. */
  aggiorna(dt: number): void;
};

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
  const disco = (r: number, h: number, y: number, colore: string) => {
    const g = new THREE.CylinderGeometry(r, r, h, 8).toNonIndexed(), c = new THREE.Color(colore), col: number[] = [];
    for (let i = 0; i < g.attributes['position']!.count; i++) col.push(c.r, c.g, c.b);
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    const m = new THREE.Mesh(g, matPiatto); m.position.y = y; m.receiveShadow = true; return m;
  };
  pedana.add(disco(1.9, 0.3, -0.15, P.pietraScura), disco(1.7, 0.12, 0.06, P.legno));
  const giostra = new THREE.Group(); giostra.position.y = 0.12; pedana.add(giostra);
  const matVeicolo = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  let mezzo: THREE.Mesh | null = null, mezzoId = '', avatar: Avatar | null = null, avatarP: Promise<Avatar | null> | null = null;
  const avatarCaricato = () => (avatarP ??= loaderCorse().then((l) => createAvatar({ loader: l, look: o.look(), x: 0, z: 0 })).catch(() => null));
  function metti(id: string) {
    if (mezzo) { giostra.remove(mezzo); mezzo.geometry.dispose(); }
    if (avatar) { avatar.attachTo(null); avatar.object.removeFromParent(); avatar.visible = false; }
    const kit = kitPronto();
    mezzo = new THREE.Mesh(veicoloGeo(id, P.rosso, P.pietraChiara, null, null, kit), matVeicolo);
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
        const w = Math.round(100 * cam.aspect), su = verso > 0.2 ? 24 : cam.aspect > 1.6 ? 17 : 15, sx = Math.round(-w * verso);
        if (!cam.view || cam.view.offsetY !== su || cam.view.offsetX !== sx || cam.view.fullWidth !== w) cam.setViewOffset(w, 100, sx, su, w, 100);
        cam.position.set(-5.2, 1.5, 0); cam.up.set(0, 1, 0); cam.lookAt(0, 0.7, 0); // bassa, da eroe: l'orizzonte dietro il veicolo
        avatar?.update(1, dt);
        luci.follow?.(0, 0);
      }
      fondale?.segui(cam);
    },
  };
}
