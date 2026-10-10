// Il cielo e la luce dell'hub delle Corse (#185): tardo pomeriggio caldo come `corse_13_hub_arrivo`. Cielo a bande di palette
// (niente gradienti lisci) con il sole basso a est-sud-est, l'alone giallo-arancio dalla sua parte e nuvole piatte a pixel;
// nebbia di distanza a bande (vedi `nebbiaABande`); sole con una shadow map 1024 che segue il veicolo (render/light.ts).
import * as THREE from 'three';
import { P } from '../../render/island_parts.ts';
import { createLights } from '../../render/light.ts';
import type { NomeP } from './mondo_base.ts';
import { h01 } from './mondo_base.ts';

/** Il sole: azimut come render/light.ts (gradi: 0 = nord, 90 = est), elevazione bassa del tardo pomeriggio. */
export const SOLE = { azim: 112, elev: 26 } as const;
export const NEBBIA = { colore: P.sabbiaChiara, vicino: 140, lontano: 420 } as const;
const dirSole = (): THREE.Vector3 => {
  const el = (SOLE.elev * Math.PI) / 180, az = (SOLE.azim * Math.PI) / 180;
  return new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)).normalize();
};

/** Volta del cielo di raggio 1 (la scala la mette chi la segue): fasce per elevazione, spicchi per azimut, colori della palette. */
function voltaCielo(): THREE.BufferGeometry {
  const pos: number[] = [], col: number[] = [], C = new THREE.Color();
  const sole = dirSole(), azSole = Math.atan2(sole.x, -sole.z);
  // fasce dall'orizzonte in su: [elevazione bassa, alta, colore lontano dal sole, colore verso il sole]
  const FASCE: [number, number, NomeP, NomeP][] = [
    [-90, -1, 'sabbiaChiara', 'sabbiaChiara'], [-1, 1.5, 'sabbiaChiara', 'giallo'], [1.5, 4, 'pietraChiara', 'giallo'], [4, 9, 'acquaBassa', 'sabbiaChiara'],
    [9, 16, 'acquaBassa', 'acquaBassa'], [16, 26, 'acqua', 'acqua'], [26, 42, 'acqua', 'acqua'], [42, 90, 'acquaProfonda', 'acquaProfonda'],
  ];
  const N = 32, rad = Math.PI / 180;
  const pt = (el: number, az: number): [number, number, number] => [Math.cos(el * rad) * Math.sin(az), Math.sin(el * rad), -Math.cos(el * rad) * Math.cos(az)];
  FASCE.forEach(([e0, e1, lon, vic], fi) => {
    for (let i = 0; i < N; i++) {
      const a0 = (i / N) * Math.PI * 2, a1 = ((i + 1) / N) * Math.PI * 2, am = (a0 + a1) / 2;
      let d = Math.abs(am - azSole) % (Math.PI * 2); if (d > Math.PI) d = Math.PI * 2 - d;
      // verso il sole il colore caldo; al confine un spicchio sì e uno no (dithering a spicchi)
      const caldo = d < 0.45 || (d < 0.75 && (i + fi) % 2 === 0);
      C.set(P[caldo ? vic : lon]);
      const q = [pt(e0, a0), pt(e0, a1), pt(e1, a1), pt(e1, a0)];
      for (const k of [0, 2, 1, 0, 3, 2]) { pos.push(...q[k]!); col.push(C.r, C.g, C.b); }
    }
  });
  // il disco del sole (ottagono giallo con l'anello chiaro) e le nuvole piatte
  const disco = (el: number, az: number, r: number, c: NomeP, rientro: number) => {
    C.set(P[c]);
    const centro = new THREE.Vector3(...pt(el, az)).multiplyScalar(rientro), up = new THREE.Vector3(0, 1, 0), dx = new THREE.Vector3().crossVectors(centro, up).normalize(), dy = new THREE.Vector3().crossVectors(dx, centro).normalize();
    for (let k = 0; k < 8; k++) {
      const b0 = (k / 8) * Math.PI * 2, b1 = ((k + 1) / 8) * Math.PI * 2;
      const p0 = centro.clone().addScaledVector(dx, Math.cos(b0) * r).addScaledVector(dy, Math.sin(b0) * r), p1 = centro.clone().addScaledVector(dx, Math.cos(b1) * r).addScaledVector(dy, Math.sin(b1) * r);
      pos.push(centro.x, centro.y, centro.z, p1.x, p1.y, p1.z, p0.x, p0.y, p0.z); for (let j = 0; j < 3; j++) col.push(C.r, C.g, C.b);
    }
  };
  disco(SOLE.elev, azSole, 0.085, 'sabbiaChiara', 0.99); disco(SOLE.elev, azSole, 0.055, 'giallo', 0.985);
  const rett = (el: number, az: number, w: number, h: number, c: NomeP, rientro: number) => {
    C.set(P[c]);
    const centro = new THREE.Vector3(...pt(el, az)).multiplyScalar(rientro), dx = new THREE.Vector3().crossVectors(centro, new THREE.Vector3(0, 1, 0)).normalize(), dy = new THREE.Vector3().crossVectors(dx, centro).normalize();
    const v = (sx: number, sy: number) => centro.clone().addScaledVector(dx, sx * w).addScaledVector(dy, sy * h);
    const q = [v(-1, -1), v(1, -1), v(1, 1), v(-1, 1)];
    for (const k of [0, 2, 1, 0, 3, 2]) { pos.push(q[k]!.x, q[k]!.y, q[k]!.z); col.push(C.r, C.g, C.b); }
  };
  for (let k = 0; k < 16; k++) {
    const az = (k / 16) * Math.PI * 2 + h01(k, 1, 77) * 0.3, el = 6 + h01(k, 2, 77) * 13, w = 0.025 + h01(k, 3, 77) * 0.035;
    let d = Math.abs(az - azSole) % (Math.PI * 2); if (d > Math.PI) d = Math.PI * 2 - d;
    const sotto: NomeP = d < 0.9 ? 'arancio' : 'pietraChiara';
    rett(el, az, w, 0.006, sotto, 0.97);
    rett(el + 0.7, az + 0.004, w * 0.85, 0.007, 'pietraChiara', 0.968);
    rett(el + 1.4, az - w * 0.3, w * 0.45, 0.006, d < 0.9 ? 'sabbiaChiara' : 'pietraChiara', 0.966);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return g;
}

export type Atmosfera = { segui(x: number, z: number): void; cielo: THREE.Mesh; luci: THREE.Group };
export function creaAtmosfera(scene: THREE.Scene): Atmosfera {
  scene.background = new THREE.Color(NEBBIA.colore);
  scene.fog = new THREE.Fog(NEBBIA.colore, NEBBIA.vicino, NEBBIA.lontano);
  const luci = createLights();
  luci.set?.({ elev: SOLE.elev + 8, azim: SOLE.azim, color: 0xffd9a3, intensity: 2.75, sky: 0x9fd3ff, ground: 0x7a5a3a, hemiI: 1.55, amb: P.arancio, ambI: 0.22 });
  luci.group.name = 'hub_luci';
  scene.add(luci.group);
  const cielo = new THREE.Mesh(voltaCielo(), new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, depthWrite: false, depthTest: false, side: THREE.DoubleSide }));
  cielo.name = 'hub_cielo'; cielo.frustumCulled = false; cielo.renderOrder = -100;
  scene.add(cielo);
  return { cielo, luci: luci.group, segui: (x, z) => luci.follow?.(x, z) };
}

/** La texture dell'acqua: 64×64 (4 m), quasi bianca con increspature e luccichii a pixel; moltiplica i colori del mare. */
export function texAcqua(): THREE.Texture {
  const c = document.createElement('canvas'); c.width = 64; c.height = 64;
  const g = c.getContext('2d')!;
  g.fillStyle = P.pietraChiara; g.fillRect(0, 0, 64, 64); // base
  for (let i = 0; i < 16; i++) { const x = Math.floor(h01(i, 1, 9) * 64), y = Math.floor(h01(i, 2, 9) * 64), w = 2 + Math.floor(h01(i, 3, 9) * 4); g.fillStyle = P.pietra; g.fillRect(x, y, w, 1); }
  for (let i = 0; i < 12; i++) { const x = Math.floor(h01(i, 4, 9) * 64), y = Math.floor(h01(i, 5, 9) * 64); g.fillStyle = P.sabbiaChiara; g.fillRect(x, y, 2, 1); }
  const t = new THREE.CanvasTexture(c);
  t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
