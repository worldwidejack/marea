// Prova pixel 3D (#46): ritocchi ai materiali del gioco, solo su questa pagina.
// - luce a gradini: il sole su ogni faccia vale 1 / 0,62 / 0,3 invece di una sfumatura (con flat shading le facce simili si uniscono)
// - vento: palme e cespugli ondeggiano nel vertex shader (più in cima, meno alla base); zero draw call in più
// - isole lontane: sagome basse a 250-450 m che la foschia schiarisce, un draw call
import * as THREE from 'three';

// Il pezzo di shader Lambert di three: il prodotto N·L passa da una scala a gradini quando il materiale ha MAREA_CEL.
const LAMBERT = 'float dotNL = saturate( dot( geometryNormal, directLight.direction ) );';
if (THREE.ShaderChunk.lights_lambert_pars_fragment.includes(LAMBERT)) {
  THREE.ShaderChunk.lights_lambert_pars_fragment = THREE.ShaderChunk.lights_lambert_pars_fragment.replace(LAMBERT, `${LAMBERT}
#ifdef MAREA_CEL
	dotNL = dotNL > 0.55 ? 1.0 : dotNL > 0.2 ? 0.62 : 0.3;
#endif`);
} else console.warn('[provapixel] three ha cambiato lights_lambert_pars_fragment: luce a gradini spenta');

const lamberts = (root: THREE.Object3D) => {
  const out = new Set<THREE.MeshLambertMaterial>();
  root.traverse((o) => {
    const m = (o as THREE.Mesh).material;
    for (const x of Array.isArray(m) ? m : m ? [m] : []) if ((x as THREE.MeshLambertMaterial).isMeshLambertMaterial) out.add(x as THREE.MeshLambertMaterial);
  });
  return out;
};

/** Accende o spegne la luce a gradini su tutti i Lambert sotto `root` (ricompila: si fa solo al cambio). */
export function setCel(root: THREE.Object3D, on: boolean): void {
  for (const m of lamberts(root)) {
    const has = 'MAREA_CEL' in (m.defines ?? {});
    if (has === on) continue;
    m.defines = { ...(m.defines ?? {}) };
    if (on) m.defines['MAREA_CEL'] = ''; else delete m.defines['MAREA_CEL'];
    m.needsUpdate = true;
  }
}

const WIND = { uTime: { value: 0 }, uWind: { value: 1 } };
const PLANT = /palma|cespuglio|albero|pianta|erba/i;
const swayCache = new Map<THREE.Material, THREE.Material>();

/** Palme e cespugli (per nome della mesh) prendono una copia del materiale che ondeggia. */
export function addWind(root: THREE.Object3D): number {
  let n = 0;
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || !PLANT.test(mesh.name) || Array.isArray(mesh.material)) return;
    let m = swayCache.get(mesh.material);
    if (!m) {
      m = mesh.material.clone();
      m.onBeforeCompile = (sh) => {
        Object.assign(sh.uniforms, WIND);
        sh.vertexShader = 'uniform float uTime, uWind;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
  {
    float hh = max(0.0, position.y);
    #ifdef USE_INSTANCING
      vec2 base = instanceMatrix[3].xz;
    #else
      vec2 base = vec2(0.0);
    #endif
    float ph = base.x * 0.37 + base.y * 0.23;
    float k = 0.03 * hh * hh * uWind;
    transformed.x += (sin(uTime * 1.6 + ph) + 0.4 * sin(uTime * 3.7 + ph * 2.0)) * k;
    transformed.z += cos(uTime * 1.2 + ph) * k * 0.7;
  }`);
      };
      m.customProgramCacheKey = () => 'marea-vento';
      swayCache.set(mesh.material, m);
    }
    mesh.material = m; n++;
  });
  return n;
}
export function setWind(on: boolean, t: number): void { WIND.uWind.value = on ? 1 : 0; WIND.uTime.value = t % 3600; }

/** Sagome di isole all'orizzonte: tronchi di cono a 7 lati, verdi in cima e sabbia ai piedi. */
export function farIslands(cx: number, cz: number): THREE.Mesh {
  const parts: THREE.BufferGeometry[] = [];
  const spots: [number, number, number, number][] = [[-310, -120, 34, 9], [-260, -330, 48, 14], [40, -420, 40, 11], [-420, 60, 30, 7], [230, -300, 26, 8], [-120, -470, 60, 18]];
  const sand = new THREE.Color('#E2B97F'), green = new THREE.Color('#4E9A46');
  for (const [dx, dz, r, h] of spots) {
    const g = new THREE.CylinderGeometry(r * 0.55, r, h, 7, 1).toNonIndexed();
    g.translate(cx + dx, h / 2 - 1, cz + dz);
    const pos = g.getAttribute('position')!, c = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) (pos.getY(i) > h / 2 ? green : sand).toArray(c, i * 3);
    g.setAttribute('color', new THREE.BufferAttribute(c, 3));
    parts.push(g);
  }
  const merged = new THREE.BufferGeometry();
  const total = parts.reduce((s, g) => s + g.getAttribute('position')!.count, 0);
  const P = new Float32Array(total * 3), C = new Float32Array(total * 3);
  let o = 0;
  for (const g of parts) { P.set(g.getAttribute('position')!.array as Float32Array, o * 3); C.set(g.getAttribute('color')!.array as Float32Array, o * 3); o += g.getAttribute('position')!.count; }
  merged.setAttribute('position', new THREE.BufferAttribute(P, 3)); merged.setAttribute('color', new THREE.BufferAttribute(C, 3));
  merged.computeVertexNormals();
  const mesh = new THREE.Mesh(merged, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
  mesh.name = 'isole_lontane';
  return mesh;
}
