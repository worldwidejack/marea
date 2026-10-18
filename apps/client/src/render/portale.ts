// Portale interdimensionale (render/portale.ts): stile Rick & Morty (#404)
// Passaggio tra la stanza della casa e il giardino sopra al pontile.
// Look low-poly pixel-art: palette ufficiale (verdeNeon, erbe, bosco, pietraChiara), texture NearestFilter, facce piatte.
import * as THREE from 'three';
import { M, P, merged, painted } from './island_parts.ts';

let textureCondivisa: THREE.CanvasTexture | null = null;

const PAL = {
  verdeNeon: [182, 255, 61, 255] as const,
  erbaChiara: [217, 232, 114, 255] as const,
  erba: [143, 195, 91, 255] as const,
  erbaScura: [78, 154, 70, 255] as const,
  bosco: [44, 107, 63, 255] as const,
  boscoOmbra: [30, 74, 58, 255] as const,
  pietraChiara: [232, 225, 214, 255] as const,
  trans: [0, 0, 0, 0] as const,
};

type ColKey = keyof typeof PAL;

// Gocce e schizzi staccati attorno al perimetro
const GOCCE: readonly [number, number, number, ColKey][] = [
  [-0.8, 1.14, 0.045, 'verdeNeon'],
  [-0.65, 1.18, 0.035, 'pietraChiara'],
  [0.4, 1.12, 0.04, 'verdeNeon'],
  [1.2, 1.13, 0.042, 'erba'],
  [2.2, 1.15, 0.045, 'verdeNeon'],
  [2.4, 1.19, 0.03, 'pietraChiara'],
  [-2.2, 1.13, 0.04, 'verdeNeon'],
  [-1.7, 1.16, 0.035, 'erbaChiara'],
  [3.0, 1.12, 0.038, 'verdeNeon'],
];

/** Disegna la texture 128×128 pixel del vortice a spirale verde interdimensionale. */
export function getPortaleTexture(): THREE.CanvasTexture {
  if (textureCondivisa) return textureCondivisa;
  const W = 128, H = 128;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const imgData = ctx.createImageData(W, H);
  const data = imgData.data;

  const cx = 64, cy = 64;
  const rx = 38, ry = 56;

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const dx = (x - cx) / rx, dy = (y - cy) / ry;
      const u = Math.hypot(dx, dy);
      const theta = Math.atan2(dy, dx);

      let col: readonly [number, number, number, number] = PAL.trans;

      // Gocce staccate
      let insideDroplet = false;
      for (const [da, dd, dr, cKey] of GOCCE) {
        const tx = dd * Math.cos(da), ty = dd * Math.sin(da);
        if (Math.hypot(dx - tx, dy - ty) <= dr) {
          col = PAL[cKey];
          insideDroplet = true;
          break;
        }
      }

      if (!insideDroplet) {
        // Bordo organico liquido ondulato
        const wobble = 1.0
          + 0.05 * Math.sin(5 * theta)
          + 0.04 * Math.cos(8 * theta + 0.4)
          + 0.03 * Math.sin(13 * theta - 0.7)
          + 0.03 * Math.sin(3 * theta + 1.2);

        if (u <= wobble) {
          const distFromRim = wobble - u;
          if (distFromRim < 0.03) {
            col = PAL.bosco;
          } else if (distFromRim < 0.16) {
            const rimHash = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
            const rnd = rimHash - Math.floor(rimHash);
            if (distFromRim < 0.07 && rnd > 0.8) col = PAL.pietraChiara;
            else if (rnd > 0.88) col = PAL.pietraChiara;
            else if (rnd < 0.15) col = PAL.erba;
            else if (rnd < 0.05) col = PAL.bosco;
            else col = PAL.verdeNeon;
          } else {
            // Spirale interna
            const spiralArm = theta - 4.2 * Math.pow(u, 0.85);
            let s = (spiralArm / (2 * Math.PI)) % 1;
            if (s < 0) s += 1;

            if (u < 0.18) {
              const eyeTheta = (theta - 6.0 * u) % (2 * Math.PI);
              if (eyeTheta > 0 && eyeTheta < 1.5) col = PAL.verdeNeon;
              else if (u < 0.08) col = PAL.boscoOmbra;
              else col = PAL.bosco;
            } else {
              const hash = Math.sin(x * 37.1 + y * 91.7) * 43758.5453;
              const speckle = hash - Math.floor(hash);

              if (s < 0.35) {
                if (speckle > 0.85) col = PAL.pietraChiara;
                else if (s < 0.22) col = PAL.verdeNeon;
                else col = PAL.erbaChiara;
              } else if (s < 0.6) {
                if (speckle > 0.93) col = PAL.pietraChiara;
                else if (s < 0.45) col = PAL.erba;
                else col = PAL.erbaScura;
              } else if (s < 0.85) {
                if (s > 0.72) col = PAL.boscoOmbra;
                else col = PAL.bosco;
              } else {
                if (speckle > 0.8) col = PAL.verdeNeon;
                else col = PAL.erba;
              }
            }
          }
        }
      }

      const idx = (y * W + x) * 4;
      data[idx] = col[0];
      data[idx + 1] = col[1];
      data[idx + 2] = col[2];
      data[idx + 3] = col[3];
    }
  }

  ctx.putImageData(imgData, 0, 0);
  const t = new THREE.CanvasTexture(canvas);
  t.magFilter = t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.colorSpace = THREE.SRGBColorSpace;
  textureCondivisa = t;
  return t;
}

export type Portale = THREE.Group & {
  update(tempo: number): void;
};

/** Crea un portale interdimensionale posizionato in coordinate mondo o locali. */
export function creaPortale(o: { x: number; y: number; z: number; ry?: number }): Portale {
  const group = new THREE.Group() as Portale;
  group.position.set(o.x, o.y + 1.35, o.z);
  group.rotation.y = o.ry ?? 0;

  // Piano bifacciale con la texture a pixel del vortice
  const w = 2.0, h = 2.7;
  const mat = new THREE.MeshBasicMaterial({
    map: getPortaleTexture(),
    transparent: true,
    alphaTest: 0.15,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  plane.castShadow = false;
  plane.receiveShadow = false;
  group.add(plane);

  // Particelle e gocce 3D low-poly orbitanti (palette: verdeNeon, erbaChiara, pietraChiara)
  const motesGeo: THREE.BufferGeometry[] = [];
  const motesCount = 10;
  const rx = w * 0.45, ry = h * 0.46;
  const motesAngles: number[] = [];

  for (let i = 0; i < motesCount; i++) {
    const angle = (i / motesCount) * Math.PI * 2 + (i % 2 ? 0.2 : -0.15);
    motesAngles.push(angle);
    const px = Math.cos(angle) * (rx + 0.12 * ((i % 3) - 1));
    const py = Math.sin(angle) * (ry + 0.12 * (((i + 1) % 3) - 1));
    const size = 0.08 + (i % 3) * 0.03;
    const col = i % 4 === 0 ? P.pietraChiara : i % 2 === 0 ? P.verdeNeon : P.erbaChiara;
    const m = M(px, py, (i % 2 ? 0.04 : -0.04), 0.3 * i, 0.4 * i, 0.5 * i);
    motesGeo.push(painted(new THREE.BoxGeometry(size, size, size), col, m));
  }

  const motesMesh = new THREE.Mesh(merged(motesGeo), new THREE.MeshBasicMaterial({ vertexColors: true }));
  group.add(motesMesh);

  group.update = (tempo: number) => {
    // Leggera pulsazione organica interdimensionale
    const scale = 1.0 + 0.02 * Math.sin(tempo * 3);
    plane.scale.set(scale, 1.0 + 0.015 * Math.cos(tempo * 2.5), 1.0);
    // Oscillazione delle gocce 3D attorno
    motesMesh.position.y = 0.02 * Math.sin(tempo * 2);
  };

  return group;
}
