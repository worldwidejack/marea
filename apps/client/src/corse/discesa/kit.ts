// I pezzi della discesa (#229): i glb `cs_d_*` di assets/blender/models_discesa.py (manifest_corse.json) trasformati in geometria a colori
// per vertice (il texel piatto dell'atlas sotto la UV), come i veicoli delle Corse: un solo materiale per tutto, si fondono per riquadri.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { float32, loaderCorse } from '../veicoli_kit.ts';

const geos = new Map<string, THREE.BufferGeometry>();
let promessa: Promise<void> | null = null;

/** Carica una volta i pezzi `nomi`; poi `pezzo(nome)` è sincrono (null se il modello non c'è). */
export function caricaPezzi(nomi: readonly string[]): Promise<void> {
  return (promessa ??= (async () => {
    const l = await loaderCorse();
    const tex = await l.texture('atlas.png');
    const img = tex.image as CanvasImageSource & { width: number; height: number };
    const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height;
    const cx = cv.getContext('2d', { willReadFrequently: true })!; cx.drawImage(img, 0, 0);
    const px = cx.getImageData(0, 0, cv.width, cv.height).data, col = new THREE.Color();
    await Promise.all(nomi.filter((n) => l.has(n)).map(async (nome) => {
      const { scene } = await l.load(nome);
      scene.updateMatrixWorld(true);
      const parts: THREE.BufferGeometry[] = [];
      scene.traverse((o) => {
        const m = o as THREE.Mesh; if (!m.isMesh) return;
        const g = float32(m.geometry); g.applyMatrix4(m.matrixWorld);
        const uv = g.attributes.uv, n = g.attributes.position!.count, c = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) {
          if (uv) {
            const x = Math.min(cv.width - 1, Math.max(0, Math.floor(uv.getX(i) * cv.width))), y = Math.min(cv.height - 1, Math.max(0, Math.floor(uv.getY(i) * cv.height)));
            const k = (y * cv.width + x) * 4;
            col.setRGB(px[k]! / 255, px[k + 1]! / 255, px[k + 2]! / 255, THREE.SRGBColorSpace);
          } else col.set(0xff00ff);
          c[i * 3] = col.r; c[i * 3 + 1] = col.g; c[i * 3 + 2] = col.b;
        }
        g.setAttribute('color', new THREE.BufferAttribute(c, 3)); if (uv) g.deleteAttribute('uv');
        parts.push(g);
      });
      if (parts.length) { const g = mergeGeometries(parts)!; g.computeBoundingBox(); geos.set(nome, g); }
    }));
  })().catch((e) => { console.warn('[discesa] pezzi non caricati', e); }));
}
export const pezzo = (nome: string): THREE.BufferGeometry | null => geos.get(nome) ?? null;
