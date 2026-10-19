// Mesh dinamica (#67): le forme (render/animali_forme.ts) scritte girate e spostate in un unico buffer a ogni frame, una draw call per
// tutti. La usano gli animali (game/animali.ts) e gli insetti di Borgo Marea (game/insetti.ts, #445).
import * as THREE from 'three';
import type { Disegna } from '../game/animali_vita.ts';

/** Mesh dinamica: le forme vengono scritte (girate e spostate) in un unico buffer a ogni frame. */
export function pennello(max: number, mat: THREE.Material, nome: string) {
  const pos = new Float32Array(max * 3), col = new Float32Array(max * 3);
  const g = new THREE.BufferGeometry();
  const pa = new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage), ca = new THREE.BufferAttribute(col, 3).setUsage(THREE.DynamicDrawUsage);
  g.setAttribute('position', pa); g.setAttribute('color', ca); g.setDrawRange(0, 0);
  const mesh = new THREE.Mesh(g, mat); mesh.name = nome; mesh.frustumCulled = false;
  let n = 0;
  const put: Disegna = (f, x, y, z, h, pitch = 0, roll = 0, s = 1, c1, c2) => {
    if (n + f.n > max) return;
    // R = Ry(−h) · Rx(pitch) · Rz(roll) · s
    const cy = Math.cos(-h), sy = Math.sin(-h), cp = Math.cos(pitch), sp = Math.sin(pitch), cr = Math.cos(roll), sr = Math.sin(roll);
    const a00 = cr, a01 = -sr, a10 = cp * sr, a11 = cp * cr, a12 = -sp, a20 = sp * sr, a21 = sp * cr, a22 = cp; // Rx·Rz (a02 = 0)
    const m00 = (cy * a00 + sy * a20) * s, m01 = (cy * a01 + sy * a21) * s, m02 = sy * a22 * s;
    const m10 = a10 * s, m11 = a11 * s, m12 = a12 * s;
    const m20 = (-sy * a00 + cy * a20) * s, m21 = (-sy * a01 + cy * a21) * s, m22 = cy * a22 * s;
    const P = f.pos, C = f.col, K = f.ch;
    for (let i = 0, o = n * 3; i < f.n; i++, o += 3) {
      const px = P[i * 3]!, py = P[i * 3 + 1]!, pz = P[i * 3 + 2]!;
      pos[o] = x + m00 * px + m01 * py + m02 * pz; pos[o + 1] = y + m10 * px + m11 * py + m12 * pz; pos[o + 2] = z + m20 * px + m21 * py + m22 * pz;
      const k = K[i], c = k === 1 ? c1 : k === 2 ? c2 : null;
      if (c) { col[o] = c.r; col[o + 1] = c.g; col[o + 2] = c.b; } else { col[o] = C[i * 3]!; col[o + 1] = C[i * 3 + 1]!; col[o + 2] = C[i * 3 + 2]!; }
    }
    n += f.n;
  };
  return {
    mesh, put,
    begin() { n = 0; },
    end() {
      g.setDrawRange(0, n); mesh.visible = n > 0;
      if (!n) return;
      pa.clearUpdateRanges(); pa.addUpdateRange(0, n * 3); pa.needsUpdate = true;
      ca.clearUpdateRanges(); ca.addUpdateRange(0, n * 3); ca.needsUpdate = true;
    },
    get n() { return n; },
  };
}

