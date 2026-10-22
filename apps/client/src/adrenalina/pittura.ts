// Gli abeti a pixel dello snowboard, come il panorama (sfondo.ts): dipinti da Codex sul panorama come riferimento, poi portati nelle regole
// di MAREA (ART_BIBLE §2-3: 16 texel per metro, solo colori della palette, nearest, niente mipmap). assets/adrenalina/abeti.png: 4 abeti in
// fila su fondo trasparente, celle 56×112.
// Un rettangolo per albero che guarda sempre la camera girando solo attorno alla verticale, tutti in un'InstancedMesh; la variante (0-3) è
// un attributo per istanza. Finché l'immagine non è arrivata (o con ?dipinto=0) restano gli abeti a coni.
import * as THREE from 'three';

export type Pittura = { abetiMat: THREE.Material; dispose(): void };

/** Quanto è grande un abete a scala 1 (m): come l'abete a coni, ~6 m di chioma su 7 di cella. */
const ABETE = { alto: 7, largo: 3.5, varianti: 4 } as const;

export async function caricaPittura(): Promise<Pittura | null> {
  try {
    const t = await new THREE.TextureLoader().loadAsync('/assets/adrenalina/abeti.png');
    t.colorSpace = THREE.SRGBColorSpace; t.generateMipmaps = false; t.minFilter = THREE.NearestFilter; t.magFilter = THREE.NearestFilter;
    const abetiMat = materialeAbeti(t);
    return { abetiMat, dispose() { t.dispose(); abetiMat.dispose(); } };
  } catch (e) { console.warn('[marea] abeti a pixel non caricati', e); return null; }
}

function materialeAbeti(t: THREE.Texture): THREE.Material {
  const mat = new THREE.MeshBasicMaterial({ map: t, alphaTest: 0.5 });
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aVar;')
      .replace('#include <uv_vertex>', `#include <uv_vertex>\nvMapUv = vec2((uv.x + aVar) / ${ABETE.varianti}.0, uv.y);`)
      // il centro dell'albero dove dice la sua matrice; il rettangolo di lato alla camera e in verticale nel mondo (gira solo attorno a y)
      .replace('#include <project_vertex>', `
        vec4 centro = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        float sx = length(instanceMatrix[0].xyz), sy = length(instanceMatrix[1].xyz);
        vec4 mvPosition = centro + vec4(position.x * sx * ${ABETE.largo.toFixed(1)}, 0.0, 0.0, 0.0) + viewMatrix * vec4(0.0, position.y * sy * ${ABETE.alto.toFixed(1)}, 0.0, 0.0);
        gl_Position = projectionMatrix * mvPosition;`);
  };
  return mat;
}

/** Gli abeti a pixel nei posti di `matrici` (posizione e scala; la rotazione non conta), varianti a caso ma fisse. */
export function abetiDipinti(pt: Pittura, matrici: THREE.Matrix4[], seme: number): THREE.InstancedMesh {
  const g = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0);
  const v = new Float32Array(matrici.length);
  for (let i = 0; i < v.length; i++) v[i] = Math.floor(caso(seme, i) * ABETE.varianti);
  g.setAttribute('aVar', new THREE.InstancedBufferAttribute(v, 1));
  const im = new THREE.InstancedMesh(g, pt.abetiMat, matrici.length);
  matrici.forEach((m, i) => im.setMatrixAt(i, m));
  im.computeBoundingSphere(); im.name = 'snowboard_abeti_dipinti';
  return im;
}

const caso = (a: number, b: number) => { let x = (a * 374761393 + b * 668265263) | 0; x = (x ^ (x >>> 13)) * 1274126177; return ((x ^ (x >>> 16)) >>> 0) / 4294967296; };
