// Effetti della guida del motore v2 (#170): le scintille del drift (dalle ruote dietro, blu → arancio → viola come Mario Kart 8
// Deluxe), le fiammate del turbo, il fumo del motore ingolfato (cubetti, un solo InstancedMesh come nel Gran Premio), le linee di
// velocità a schermo (solo col turbo e nella scia: legate a un momento del gioco, non alla velocità) e la minimappa nell'angolo.
import * as THREE from 'three';
import { P } from '../render/island_parts.ts';
import type { Pista } from '@marea/sim/corse/pista.ts';
import { livelloDrift } from '@marea/sim/corse/veicolo.ts';
import type { Veicolo } from '@marea/sim/corse/veicolo.ts';

const MAX = 260;

export type Particelle = {
  mesh: THREE.InstancedMesh;
  /** `n` cubetti in `pos`, con la velocità `vel` (m/s) più uno sparpaglio di `sparpaglio` m/s; vivono `vita` s. */
  emetti(pos: THREE.Vector3, vel: THREE.Vector3, colore: string, n: number, sparpaglio: number, vita: number, gravita?: number, grande?: number): void;
  aggiorna(dt: number): void;
  svuota(): void;
};

export function creaParticelle(): Particelle {
  const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), new THREE.MeshBasicMaterial({ color: 0xffffff }), MAX);
  mesh.name = 'corse_scintille'; mesh.frustumCulled = false; mesh.count = 0;
  const parts: { x: number; y: number; z: number; vx: number; vy: number; vz: number; t: number; g: number; s: number; c: string }[] = [];
  const m4 = new THREE.Matrix4(), cc = new THREE.Color(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), pv = new THREE.Vector3();
  return {
    mesh,
    emetti(pos, vel, colore, n, sparpaglio, vita, gravita = 9, grande = 1) {
      for (let j = 0; j < n && parts.length < MAX; j++) {
        parts.push({
          x: pos.x, y: pos.y, z: pos.z,
          vx: vel.x + (Math.random() * 2 - 1) * sparpaglio, vy: vel.y + Math.random() * sparpaglio, vz: vel.z + (Math.random() * 2 - 1) * sparpaglio,
          t: vita * (0.6 + Math.random() * 0.6), g: gravita, s: grande, c: colore,
        });
      }
    },
    aggiorna(dt) {
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i]!; p.t -= dt;
        if (p.t <= 0) { parts.splice(i, 1); continue; }
        p.vy -= p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      }
      let n = 0;
      for (const p of parts) {
        const s = p.s * Math.min(1, p.t * 6); // si rimpiccioliscono sparendo
        m4.compose(pv.set(p.x, p.y, p.z), q, sc.set(s, s, s));
        mesh.setMatrixAt(n, m4); mesh.setColorAt(n, cc.set(p.c)); n++;
      }
      mesh.count = n; mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    },
    svuota() { parts.length = 0; mesh.count = 0; },
  };
}

/** Colore delle scintille per livello del drift (0 = sta caricando: fumo chiaro). */
export const COLORE_LIVELLO = [P.pietraChiara, P.cianoNeon, P.ambraNeon, P.viola] as const;

const A = new THREE.Vector3(), B = new THREE.Vector3();
/** Scintille dalle ruote dietro in drift, fiammate dal tubo col turbo, fumo se ingolfato, vento ai lati se `scia` (sta caricando).
 *  Posizione, muso, sopra, destra e moto nel mondo (dopo il traverso della resa); `v` = velocità (0 in pausa: le scintille restano lì). */
export function emettiVeicolo(fx: Particelle, k: Veicolo, scia: boolean, v: number, pos: THREE.Vector3, fwd: THREE.Vector3, up: THREE.Vector3, dx: THREE.Vector3, moto: THREE.Vector3): void {
  if (k.drift && !k.aria) {
    const lv = livelloDrift(k.carica), col = COLORE_LIVELLO[lv]!;
    for (const lato of [-1, 1]) {
      A.copy(pos).addScaledVector(fwd, -0.9).addScaledVector(dx, lato * 0.75).addScaledVector(up, 0.2);
      B.copy(moto).multiplyScalar(v * 0.9).addScaledVector(dx, lato * 2.6).addScaledVector(up, 2.2).addScaledVector(fwd, -1.5);
      fx.emetti(A, B, col, lv ? 3 : 1, lv ? 1.6 : 0.6, lv ? 0.3 : 0.18, 12, lv === 3 ? 1.5 : lv ? 1.2 : 0.7);
    }
  }
  if (k.turbo > 0) {
    A.copy(pos).addScaledVector(fwd, -1.05).addScaledVector(up, 0.4);
    B.copy(moto).multiplyScalar(v * 0.75).addScaledVector(fwd, -4).addScaledVector(up, 0.6);
    fx.emetti(A, B, P.arancio, 2, 0.8, 0.16, 0, 1.6);
    fx.emetti(A, B, k.livello >= 1 && k.livello <= 3 ? COLORE_LIVELLO[k.livello]! : P.rosso, 1, 0.8, 0.2, 0, 1.3);
  }
  if (k.fermo > 0) { A.copy(pos).addScaledVector(fwd, -1).addScaledVector(up, 0.5); fx.emetti(A, B.set(0, 1.5, 0), P.pietra, 1, 0.6, 0.6, -2, 2.2); }
  if (scia) {
    for (const lato of [-1, 1]) {
      A.copy(pos).addScaledVector(dx, lato * (1.1 + Math.random() * 0.6)).addScaledVector(up, 0.4 + Math.random()).addScaledVector(fwd, 2 + Math.random() * 3);
      fx.emetti(A, B.copy(moto).multiplyScalar(v * 0.2), P.pietraChiara, 1, 0.2, 0.2, 0, 0.7);
    }
  }
}

/** Linee di velocità: righe radiali verso i bordi dello schermo, a mezza risoluzione (pixel come il resto). */
export function creaLinee(root: HTMLElement): { disegna(forza: number, colore: string): void; el: HTMLCanvasElement } {
  const el = document.createElement('canvas');
  el.className = 'pp-linee';
  root.prepend(el);
  const g = el.getContext('2d');
  const righe = Array.from({ length: 34 }, () => ({ a: Math.random() * Math.PI * 2, r: Math.random(), v: 0.6 + Math.random() }));
  let vista = 0;
  return {
    el,
    disegna(forza, colore) {
      const w = Math.max(1, Math.round(el.clientWidth / 3)), h = Math.max(1, Math.round(el.clientHeight / 3));
      if (el.width !== w || el.height !== h) { el.width = w; el.height = h; }
      vista += (forza - vista) * 0.25;
      if (!g) return;
      g.clearRect(0, 0, w, h);
      if (vista < 0.03) return;
      const cx = w / 2, cy = h * 0.45, R = Math.hypot(w, h) / 2;
      g.strokeStyle = colore; g.lineWidth = 1; g.globalAlpha = Math.min(0.85, vista);
      g.beginPath();
      for (const l of righe) {
        l.r += l.v * 0.06; if (l.r > 1) { l.r = 0; l.a = Math.random() * Math.PI * 2; l.v = 0.6 + Math.random(); }
        const r0 = R * (0.42 + l.r * 0.5), r1 = r0 + R * (0.1 + 0.2 * vista);
        const c = Math.cos(l.a), s = Math.sin(l.a);
        g.moveTo(Math.round(cx + c * r0), Math.round(cy + s * r0)); g.lineTo(Math.round(cx + c * r1), Math.round(cy + s * r1));
      }
      g.stroke(); g.globalAlpha = 1;
    },
  };
}

/** La minimappa nell'angolo (come #mzGpMappa del Gran Premio): la pista vista dall'alto, Nord in alto, e un quadratino per veicolo. */
export function creaMinimappa(root: HTMLElement): { pista(p: Pista): void; disegna(punti: { x: number; z: number; colore: string; tu: boolean }[]): void; el: HTMLCanvasElement } {
  const W = 112, H = 86, el = document.createElement('canvas');
  el.width = W; el.height = H; el.id = 'ppMappa'; el.className = 'pp-mappa';
  root.appendChild(el);
  const g = el.getContext('2d');
  let fondo: ImageData | null = null, mx = (x: number) => x, mz = (z: number) => z;
  return {
    el,
    pista(p) {
      if (!g) return;
      const linee = [p.n, ...p.rami.map((r) => r.n)];
      let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
      for (const n of linee) for (let i = 0; i < n.n; i++) { x0 = Math.min(x0, n.x[i]!); x1 = Math.max(x1, n.x[i]!); z0 = Math.min(z0, n.z[i]!); z1 = Math.max(z1, n.z[i]!); }
      const k = Math.min((W - 12) / Math.max(1, x1 - x0), (H - 12) / Math.max(1, z1 - z0));
      const ox = (W - (x1 - x0) * k) / 2, oz = (H - (z1 - z0) * k) / 2;
      mx = (x) => ox + (x - x0) * k; mz = (z) => oz + (z - z0) * k;
      g.clearRect(0, 0, W, H);
      linee.forEach((n, j) => {
        g.strokeStyle = j ? P.sabbia : P.pietraChiara; g.lineWidth = j ? 2 : 3; g.beginPath();
        for (let i = 0; i < n.n; i += 2) { if (i) g.lineTo(mx(n.x[i]!), mz(n.z[i]!)); else g.moveTo(mx(n.x[i]!), mz(n.z[i]!)); }
        if (n.chiuso) g.closePath();
        g.stroke();
      });
      // il traguardo
      const v = p.n, iv = Math.round(p.def.via / v.passo) % v.n;
      g.fillStyle = P.giallo; g.fillRect(Math.round(mx(v.x[iv]!)) - 2, Math.round(mz(v.z[iv]!)) - 2, 4, 4);
      fondo = g.getImageData(0, 0, W, H);
    },
    disegna(punti) {
      if (!g || !fondo) return;
      g.putImageData(fondo, 0, 0);
      for (let i = punti.length - 1; i >= 0; i--) {
        const q = punti[i]!, r = q.tu ? 3 : 2;
        g.fillStyle = q.tu ? P.neroCaldo : q.colore; g.fillRect(Math.round(mx(q.x)) - r - (q.tu ? 1 : 0), Math.round(mz(q.z)) - r - (q.tu ? 1 : 0), r * 2 + (q.tu ? 2 : 0), r * 2 + (q.tu ? 2 : 0));
        if (q.tu) { g.fillStyle = q.colore; g.fillRect(Math.round(mx(q.x)) - r, Math.round(mz(q.z)) - r, r * 2, r * 2); }
      }
    },
  };
}
