// La camera dello snowboard: la A scelta da birbasan (12 ott 2026), fatta come le follow cam dei video di freeride (Powder Mountain «one
// take», i Raw Files GoPro): chi filma scende sul pendio ~10 m dietro di te, con la camera all'altezza delle mani (~1,8 m sopra la sua
// neve), e guarda giù verso di te. Così il pendio scende davanti, l'orizzonte resta dritto, la valle si vede in fondo. Segue la tua linea
// di lato con un po' di ritardo; nei salti si alza un po' con te; più vai forte, più si apre l'inquadratura.
import * as THREE from 'three';
import type { PistaNeve } from '@marea/sim/adrenalina/pista.ts';
import { quotaA } from '@marea/sim/adrenalina/pista.ts';
import { nuovaTerna, punto, terna } from '@marea/sim/corse/nastro.ts';

export type Regia = {
  /** La tavola a (s, lat) con la quota `y`; `scatto` = senza smussare (all'inizio, dopo un salto di posizione). */
  segui(o: { s: number; lat: number; y: number; v: number; aria: boolean }, dt: number, scatto?: boolean): void;
};

/** Metri dietro lungo la pista, altezza sopra la neve di chi filma, quanto avanti guarda, quanto della pendenza segue lo sguardo, campo
 *  visivo da fermo e in più a tutta velocità. `pendio` < 1: la camera si inclina meno della pista (inclinata come lei sembrava di andare
 *  in piano), così il pendio si vede scendere davanti e in alto resta il panorama. */
const CAM = { dietro: 10, su: 2.4, guarda: 12, pendio: 0.55, fov: 66, fovVeloce: 12, vVeloce: 24 } as const;

export function creaRegia(camera: THREE.PerspectiveCamera, p: PistaNeve): Regia {
  const occhio = new THREE.Vector3(), mira = new THREE.Vector3(), T = nuovaTerna(), P3: [number, number, number] = [0, 0, 0];
  let latC = 0, yC = 0, fov: number = CAM.fov, primo = true;
  const k = (forza: number, dt: number) => 1 - Math.exp(-forza * dt);
  return {
    segui(o, dt, scatto) {
      const subito = scatto || primo;
      primo = false;
      // chi filma: dietro lungo la pista, la sua linea segue la tua con un po' di ritardo
      latC = subito ? o.lat : latC + (o.lat - latC) * k(2.2, dt);
      const sC = Math.max(0, o.s - CAM.dietro);
      punto(p.n, sC, latC, 0, P3);
      const neve = quotaA(p, sC, latC) + CAM.su + (o.s < CAM.dietro ? (CAM.dietro - o.s) * 0.4 : 0);
      // in un salto si alza con te (mai più di qualche metro sopra la sua neve), poi torna giù morbido
      const voluto = Math.max(neve, Math.min(o.y + 1.2, neve + 6));
      yC = subito ? voluto : yC + (voluto - yC) * k(o.aria ? 3 : 6, dt);
      occhio.set(P3[0], Math.max(yC, neve - 0.5), P3[2]);
      // guarda poco oltre la tavola, lungo la pista (che scende): la camera si inclina con una parte del pendio, l'orizzonte resta dritto
      terna(p.n, o.s, T);
      punto(p.n, o.s, o.lat, 0, P3);
      mira.set(P3[0] + T.tx * CAM.guarda, o.y + 0.5 + T.ty * CAM.guarda * CAM.pendio, P3[2] + T.tz * CAM.guarda);
      camera.position.copy(occhio); camera.up.set(0, 1, 0); camera.lookAt(mira);
      const f = CAM.fov + CAM.fovVeloce * Math.min(1, Math.max(0, (o.v - 10) / (CAM.vVeloce - 10)));
      fov = subito ? f : fov + (f - fov) * k(2, dt);
      if (Math.abs(camera.fov - fov) > 0.05) { camera.fov = fov; camera.updateProjectionMatrix(); }
    },
  };
}
