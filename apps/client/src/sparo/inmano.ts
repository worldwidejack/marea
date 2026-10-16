// L'arma in mano in prima persona (#355): figlia della camera, a metà grandezza e a metà distanza (la prospettiva è la stessa, ma
// sta dentro il raggio del corpo e non entra mai nei container). Si muove come in COD: ondeggia col passo, resta indietro quando giri
// il mouse, calcia indietro e in su a ogni colpo, in mira va al centro coi mirini allineati, correndo si piega di lato, ricaricando
// scende e ruota, cambiando arma va giù e torna su.
import * as THREE from 'three';
import { armaInMano, modelloArma } from './armi3d.ts';

export type InMano = {
  group: THREE.Group;
  arma(id: string): void;
  cambio(id: string, sec: number): void;
  sparo(forza: number): void;
  /** `muro` = metri liberi davanti agli occhi: contro un container l'arma si ritira e si abbassa invece di entrarci. */
  aggiorna(dt: number, o: { mira: boolean; vel: number; corre: boolean; aTerra: boolean; dy: number; dp: number; ricarica: number; atterra: number; muro: number }): void;
  bocca(out: THREE.Vector3): THREE.Vector3;
  espulsione(out: THREE.Vector3): THREE.Vector3;
  /** 0..1 quanto è in mira (per il campo visivo e la sensibilità). */
  readonly mira: number;
};

const K = 0.5;
const ANCA = new THREE.Vector3(0.15, -0.165, -0.43);

export function creaInMano(camera: THREE.Camera): InMano {
  const group = new THREE.Group(); group.scale.setScalar(K); camera.add(group);
  const mesh = new Map<string, THREE.Mesh>();
  let id = 'mitra', vicino = 0, ads = 0, fase = 0, swY = 0, swP = 0, kz = 0, kr = 0, corsa = 0, sw = 0, swDur = 1, salto = 0;
  const show = (k: string) => {
    if (!mesh.has(k)) { const m = armaInMano(k); mesh.set(k, m); group.add(m); }
    for (const [kk, m] of mesh) m.visible = kk === k;
    id = k;
  };
  const pos = new THREE.Vector3(), mira = new THREE.Vector3();
  const api: InMano = {
    group,
    get mira() { return ads; },
    arma: show,
    cambio(k, sec) { show(k); sw = 1; swDur = Math.max(0.05, sec); },
    sparo(f) { kz += 0.035 * f; kr += 0.07 * f; },
    bocca(out) { return mesh.get(id)!.localToWorld(out.copy(modelloArma(id).bocca)); },
    espulsione(out) { return mesh.get(id)!.localToWorld(out.copy(modelloArma(id).espulsione)); },
    aggiorna(dt, o) {
      ads += ((o.mira ? 1 : 0) - ads) * Math.min(1, dt * 14);
      corsa += ((o.corre ? 1 : 0) - corsa) * Math.min(1, dt * 9);
      const passo = o.aTerra ? Math.min(1.4, o.vel / 4.6) : 0;
      fase += dt * passo * (8.5 + corsa * 3);
      swY = (swY + o.dy) * Math.exp(-dt * 10); swP = (swP + o.dp) * Math.exp(-dt * 10);
      kz *= Math.exp(-dt * 16); kr *= Math.exp(-dt * 13);
      sw = Math.max(0, sw - dt / swDur);
      salto = (salto + o.atterra) * Math.exp(-dt * 9);
      const m = modelloArma(id), calma = 1 - 0.85 * ads;
      mira.set(0, -m.mirino, -0.4);
      pos.copy(ANCA).lerp(mira, ads);
      // passo, resto del mouse, rinculo, corsa, ricarica, cambio, atterraggio
      pos.x += Math.sin(fase) * 0.011 * passo * calma + Math.max(-0.04, Math.min(0.04, swY * 0.06)) * calma - corsa * 0.03;
      pos.y += -Math.abs(Math.cos(fase)) * 0.012 * passo * calma - Math.max(-0.03, Math.min(0.03, swP * 0.05)) * calma - corsa * 0.035 - 0.18 * sw - 0.04 * salto;
      pos.z += kz * (1 - 0.4 * ads);
      const r = o.ricarica >= 0 ? Math.sin(Math.PI * o.ricarica) : 0;
      pos.y -= 0.07 * r;
      vicino += (Math.max(0, Math.min(1, (1.1 - o.muro) / 0.7)) - vicino) * Math.min(1, dt * 12);
      pos.z += 0.22 * vicino; pos.y -= 0.06 * vicino;
      group.position.copy(pos).multiplyScalar(K);
      group.rotation.set(kr * (1 - 0.5 * ads) + 0.25 * r - 0.6 * sw - 0.15 * corsa - 0.5 * vicino, 0.035 * (1 - ads) + Math.max(-0.08, Math.min(0.08, -swY * 0.5)) * calma + 0.4 * corsa, -0.7 * r + 0.45 * corsa, 'YXZ');
    },
  };
  show(id);
  return api;
}
