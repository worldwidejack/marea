// Prova pixel 3D (#46): la scena si disegna in un'immagine piccola (render target, nearest), poi una sola passata a schermo intero
// aggiunge contorni, foschia a bande e cielo. Il canvas ha la stessa misura dell'immagine piccola: l'ingrandimento lo fa il CSS (pixelated).
// Contorni dalla profondità inversa (1/z): su un piano è lineare sullo schermo, quindi il laplaciano è zero ovunque tranne su bordi e spigoli.
//   - vicino più lontano del pixel di molto → sagoma: il pixel si scurisce (tono più scuro dello stesso colore, verso il viola delle ombre)
//   - laplaciano negativo piccolo → spigolo convesso: il pixel si schiarisce (la riga di luce sul bordo di blocchi, tetti, moli)
// Foschia e cielo a gradini con dithering Bayer 4×4: niente sfumature lisce (ART_BIBLE §3).
import * as THREE from 'three';

export type PostToggles = { contorni: boolean; foschia: boolean; cielo: boolean };
export type Post = {
  render(gl: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera, t: number): void;
  setSize(w: number, h: number): void;
  toggles: PostToggles;
  /** Draw call della scena (senza la passata finale) dell'ultimo frame. */
  sceneCalls(): number; sceneTris(): number;
};

const VERT = /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const FRAG = /* glsl */ `
#include <packing>
varying vec2 vUv;
uniform sampler2D tColor, tDepth;
uniform vec2 uRes;
uniform float uNear, uFar, uTime, uOutline, uFog, uSky;
uniform mat4 uInvProj, uCamWorld;
uniform vec3 uFogCol, uInk;
uniform vec3 uSky0, uSky1, uCloud, uCloudDark;

float viewZ(vec2 uv) { float d = texture2D(tDepth, uv).x; return -perspectiveDepthToViewZ(d, uNear, uFar); }
float bayer(vec2 p) {
  ivec2 i = ivec2(mod(p, 4.0));
  int k = i.x + i.y * 4;
  float m[16] = float[16](0.,8.,2.,10.,12.,4.,14.,6.,3.,11.,1.,9.,15.,7.,13.,5.);
  return (m[k] + 0.5) / 16.0;
}
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
vec3 sky(vec2 uv, vec2 px) {
  vec4 v = uInvProj * vec4(uv * 2.0 - 1.0, 1.0, 1.0); v /= v.w;
  vec3 dir = normalize((uCamWorld * vec4(normalize(v.xyz), 0.0)).xyz);
  float e = degrees(asin(clamp(dir.y, -1.0, 1.0))) + (bayer(px) - 0.5) * 1.2; // bordi delle bande a dente di sega di un pixel
  vec3 c = e < 2.0 ? uFogCol : e < 9.0 ? uSky1 : uSky0; // all'orizzonte lo stesso colore della foschia: il mare lontano ci sfuma dentro
  if (dir.y > 0.02) {
    // nuvole su un piano a 220 m: due ottave di rumore a soglia, pancia più scura; scorrono col vento
    vec2 q = dir.xz / dir.y * 220.0 / 60.0 + vec2(uTime * 0.012, uTime * 0.004);
    float n = vnoise(q) * 0.65 + vnoise(q * 2.3 + 7.1) * 0.35;
    float edge = 0.62 + (1.0 - smoothstep(0.0, 0.25, dir.y)) * 0.04;
    if (n > edge + 0.06) c = uCloud; else if (n > edge) c = uCloudDark;
  }
  return c;
}
void main() {
  vec2 px = floor(vUv * uRes), t = 1.0 / uRes;
  float d = texture2D(tDepth, vUv).x;
  if (d >= 0.99999) { gl_FragColor = vec4(uSky > 0.5 ? sky(vUv, px) : uSky1, 1.0); gl_FragColor = linearToOutputTexel(gl_FragColor); return; }
  vec3 c = texture2D(tColor, vUv).rgb;
  float z = viewZ(vUv);
  if (uOutline > 0.5) {
    float w = 1.0 / z;
    float wl = 1.0 / viewZ(vUv - vec2(t.x, 0.0)), wr = 1.0 / viewZ(vUv + vec2(t.x, 0.0));
    float wd = 1.0 / viewZ(vUv - vec2(0.0, t.y)), wu = 1.0 / viewZ(vUv + vec2(0.0, t.y));
    // sagoma: un vicino è molto più lontano di me (w più piccolo); solo per oggetti non lontanissimi
    float far = max(max(w - wl, w - wr), max(w - wd, w - wu)) / w;
    float lap = min(wl + wr - 2.0 * w, wd + wu - 2.0 * w) / w;
    if (far > 0.12 && z < 160.0) c = c * uInk;
    else if (lap < -0.006 && z < 90.0) c = min(c * 1.28 + 0.04, vec3(1.0));
  }
  if (uFog > 0.5) {
    // fino all'80% entro ~200 m, poi piano fino al 100% a ~700 m: le sagome lontane restano visibili, pallide
    float f = 0.8 * clamp((z - 35.0) / 165.0, 0.0, 1.0) + 0.2 * clamp((z - 200.0) / 500.0, 0.0, 1.0);
    // 5 bande piene (0, 20, 40, 60, 80, 100%); il dithering solo nell'ultimo quarto di ogni banda, come cucitura con la successiva
    float b = f * 5.0, fr = fract(b);
    f = min(1.0, (floor(b) + (fr > 0.75 + 0.25 * bayer(px) ? 1.0 : 0.0)) / 5.0);
    c = mix(c, uFogCol, f);
  }
  gl_FragColor = vec4(c, 1.0);
  #include <colorspace_fragment>
}`;

const col = (hex: string) => new THREE.Color(hex);

export function createPost(): Post {
  const depth = new THREE.DepthTexture(1, 1); depth.type = THREE.UnsignedIntType;
  const rt = new THREE.WebGLRenderTarget(1, 1, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthTexture: depth, depthBuffer: true, colorSpace: THREE.SRGBColorSpace });
  const toggles: PostToggles = { contorni: true, foschia: true, cielo: true };
  // palette ART_BIBLE §2: cielo di giorno, dall'alto in basso acqua media → acqua bassa → pietra chiara (foschia) sull'orizzonte
  const U = {
    tColor: { value: rt.texture }, tDepth: { value: depth }, uRes: { value: new THREE.Vector2(1, 1) },
    uNear: { value: 1 }, uFar: { value: 900 }, uTime: { value: 0 }, uOutline: { value: 1 }, uFog: { value: 1 }, uSky: { value: 1 },
    uInvProj: { value: new THREE.Matrix4() }, uCamWorld: { value: new THREE.Matrix4() },
    uFogCol: { value: col('#E8E1D6') },
    // contorno: lo stesso colore più scuro e spinto verso il viola (#A64DFF) delle ombre, non nero
    uInk: { value: new THREE.Vector3(0.5, 0.42, 0.62) },
    uSky0: { value: col('#3FB9C9') }, uSky1: { value: col('#7FE3E0') },
    uCloud: { value: col('#F4E3C1') }, uCloudDark: { value: col('#E8E1D6') },
  };
  const mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: U, depthTest: false, depthWrite: false });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat); quad.frustumCulled = false;
  const ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  let calls = 0, tris = 0;
  return {
    toggles,
    setSize: (w, h) => { rt.setSize(w, h); U.uRes.value.set(w, h); },
    sceneCalls: () => calls, sceneTris: () => tris,
    render: (gl, scene, camera, t) => {
      gl.setRenderTarget(rt); gl.render(scene, camera);
      calls = gl.info.render.calls; tris = gl.info.render.triangles;
      U.uNear.value = camera.near; U.uFar.value = camera.far; U.uTime.value = t % 3600;
      U.uInvProj.value.copy(camera.projectionMatrixInverse); U.uCamWorld.value.copy(camera.matrixWorld);
      U.uOutline.value = toggles.contorni ? 1 : 0; U.uFog.value = toggles.foschia ? 1 : 0; U.uSky.value = toggles.cielo ? 1 : 0;
      gl.setRenderTarget(null); gl.render(quad, ortho);
    },
  };
}
