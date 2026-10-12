// La tavola e chi ci sta sopra (docs/ADRENALINA.md §7): un omino a box stile PS1 coi colori del tuo avatar (pelle e vestito) e il casco
// arancio con la striscia bianca, di traverso sulla tavola. Pose: piegato in curva, accucciato quando carica, la mano alla tavola nella
// presa, il giro intero nei trick (mortale avanti/indietro, 360), la caduta buffa (rotola, resta lungo disteso, si rialza).
// Assi del gruppo: x = destra, y = su, z = avanti (lo orienta index.ts lungo la pista).
import * as THREE from 'three';
import { AVATAR } from '@marea/content';
import type { Look } from '@marea/protocol';
import { M, merged, painted } from '../render/island_parts.ts';
import { PAL } from '../ui/style.ts';

export type Tavola = {
  gruppo: THREE.Group;
  /** Posa del frame: `carica` 0-1, `piega` (rad, + = a destra), trick (−1 = nessuno) con avanzamento 0-1, presa, caduta (0-1 dall'inizio, null = in piedi). */
  posa(o: { carica: number; piega: number; trick: number; k: number; presa: boolean; caduta: number | null; aria: boolean; t: number }): void;
  dispose(): void;
};

const ANCA = 0.78;

export function creaTavola(look: Look): Tavola {
  const pelle = AVATAR.pelle[look.pelle] ?? AVATAR.pelle[0]!, giacca = AVATAR.vestiti[look.vestito] ?? PAL.acqua;
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  const mesh = (g: THREE.BufferGeometry, nome: string) => { const m = new THREE.Mesh(g, mat); m.name = nome; m.castShadow = true; return m; };

  const gruppo = new THREE.Group(); gruppo.name = 'snowboard_tavola';
  // perno dei trick e della caduta: all'altezza della pancia
  // la piega in curva (attorno all'asse avanti, ai piedi); il gruppo lo orienta index.ts lungo la pista
  const piega = new THREE.Group(); gruppo.add(piega);
  const perno = new THREE.Group(); perno.position.y = 0.75; piega.add(perno);
  const dentro = new THREE.Group(); dentro.position.y = -0.75; perno.add(dentro);
  // la tavola: lunga lungo z, punte rialzate, attacchi
  const tavola = mesh(merged([
    painted(new THREE.BoxGeometry(0.3, 0.05, 1.3), PAL.arancio, M(0, 0.04, 0)),
    painted(new THREE.BoxGeometry(0.3, 0.05, 0.22), PAL.arancio, M(0, 0.08, 0.72, -0.35)),
    painted(new THREE.BoxGeometry(0.3, 0.05, 0.22), PAL.arancio, M(0, 0.08, -0.72, 0.35)),
    painted(new THREE.BoxGeometry(0.31, 0.02, 1.3), PAL.neroCaldo, M(0, 0.01, 0)),
    painted(new THREE.BoxGeometry(0.32, 0.08, 0.16), PAL.neroCaldo, M(0, 0.1, 0.25)),
    painted(new THREE.BoxGeometry(0.32, 0.08, 0.16), PAL.neroCaldo, M(0, 0.1, -0.25)),
  ]), 'tavola');
  dentro.add(tavola);
  // il corpo: di traverso (guarda verso +x), il piede sinistro avanti
  const anca = new THREE.Group(); anca.position.y = ANCA; dentro.add(anca);
  const gamba = (z: number) => {
    const g = new THREE.Group(); g.position.set(0, 0, z);
    const m = mesh(merged([
      painted(new THREE.BoxGeometry(0.17, 0.42, 0.17), PAL.ombraCalda, M(0, -0.21, 0)),
      painted(new THREE.BoxGeometry(0.16, 0.36, 0.16), PAL.ombraCalda, M(0, -0.58, 0)),
      painted(new THREE.BoxGeometry(0.2, 0.1, 0.24), PAL.neroCaldo, M(0.02, -0.74, 0)),
    ]), 'gamba');
    g.add(m); anca.add(g); return g;
  };
  const gambe = [gamba(0.24), gamba(-0.24)];
  const busto = new THREE.Group(); anca.add(busto);
  busto.add(mesh(merged([
    painted(new THREE.BoxGeometry(0.26, 0.5, 0.38), giacca, M(0, 0.28, 0)),
    painted(new THREE.BoxGeometry(0.27, 0.08, 0.39), PAL.neroCaldo, M(0, 0.05, 0)),
    // testa, casco arancio con la striscia bianca, visiera scura (guarda verso +x)
    painted(new THREE.BoxGeometry(0.24, 0.24, 0.24), pelle, M(0, 0.68, 0)),
    painted(new THREE.BoxGeometry(0.29, 0.17, 0.29), PAL.arancio, M(-0.01, 0.8, 0)),
    painted(new THREE.BoxGeometry(0.3, 0.05, 0.08), PAL.pietraChiara, M(-0.01, 0.86, 0)),
    painted(new THREE.BoxGeometry(0.06, 0.08, 0.26), PAL.neroCaldo, M(0.14, 0.7, 0)),
  ]), 'busto'));
  const braccio = (z: number) => {
    const g = new THREE.Group(); g.position.set(0, 0.48, z);
    g.add(mesh(merged([
      painted(new THREE.BoxGeometry(0.12, 0.44, 0.12), giacca, M(0, -0.2, 0)),
      painted(new THREE.BoxGeometry(0.13, 0.12, 0.13), PAL.neroCaldo, M(0, -0.45, 0)),
    ]), 'braccio'));
    busto.add(g); return g;
  };
  const braccia = [braccio(0.23), braccio(-0.23)];

  return {
    gruppo,
    posa(o) {
      const giu = o.carica * 0.22 + (o.presa ? 0.3 : 0) + (o.aria ? 0.08 : 0);
      anca.position.y = ANCA - giu;
      for (const g of gambe) g.scale.y = (ANCA - giu) / ANCA;
      // il busto si gira verso valle (+z), come chi scende davvero: da dietro si leggono spalle e casco
      busto.rotation.set(0, -0.65, o.presa ? -0.6 : -0.12 - o.carica * 0.25);
      // braccia larghe in equilibrio, che oscillano un filo; nella presa la mano davanti va alla tavola
      const sv = Math.sin(o.t * 3) * 0.08;
      braccia[0]!.rotation.set(-0.55 + sv, 0, o.presa ? 0.9 : 0.45);
      braccia[1]!.rotation.set(0.55 - sv, 0, 0.45);
      if (o.presa) braccia[0]!.rotation.x = -0.4;
      perno.rotation.set(0, 0, 0); perno.position.y = 0.75;
      piega.rotation.set(0, 0, 0);
      if (o.caduta !== null) {
        // caduta buffa: rotola per 0,7 s (un giro e mezzo di traverso, un rimbalzo), lungo disteso, poi si rialza
        const c = o.caduta, rot = Math.min(1, c / 0.35);
        if (c < 0.35) { perno.rotation.z = rot * Math.PI * 3; perno.position.y = 0.75 + Math.sin(rot * Math.PI) * 0.7; }
        else if (c < 0.82) { perno.rotation.z = Math.PI / 2; perno.position.y = 0.25; braccia[0]!.rotation.set(-2.6, 0, 0.3); braccia[1]!.rotation.set(2.6, 0, 0.3); }
        else { const k = (c - 0.82) / 0.18; perno.rotation.z = (Math.PI / 2) * (1 - k); perno.position.y = 0.25 + 0.5 * k; }
        return;
      }
      piega.rotation.z = o.piega; // la destra è −x: piegarsi a destra è ruotare il su verso −x (z positivo)
      if (o.trick >= 0) {
        const k = o.k * o.k * (3 - 2 * o.k), giro = Math.PI * 2 * k;
        if (o.trick === 0) perno.rotation.x = giro; else if (o.trick === 1) perno.rotation.x = -giro;
        else perno.rotation.y = o.trick === 2 ? -giro : giro;
      }
    },
    dispose() { gruppo.traverse((x) => { if (x instanceof THREE.Mesh) x.geometry.dispose(); }); mat.dispose(); },
  };
}
