// Passata finale (nata in provapixel #46/#50, usata dal gioco per le impostazioni #53): la scena si disegna in un'immagine piccola
// (render target, nearest), poi una sola passata a schermo intero fa contorni, foschia a bande, cielo, ritocco colore e palette.
// Il canvas ha la stessa misura dell'immagine piccola: l'ingrandimento lo fa il CSS (pixelated). Senza cielo il fondo è quello della scena.
// Contorni dalla profondità inversa (1/z): su un piano è lineare sullo schermo, quindi il laplaciano è zero ovunque tranne su bordi e spigoli.
//   - vicino molto più lontano del pixel → sagoma: inchiostro dello stile (o il colore stesso più scuro)
//   - laplaciano negativo piccolo → spigolo convesso: schiarito (o a inchiostro, per la stampa)
// Palette: ogni pixel va al colore più vicino della palette dello stile, con dithering Bayer 4×4 tra i due più vicini.
import * as THREE from 'three';

/** Quello che la passata prende da uno stile (provapixel/styles.ts lo soddisfa). */
export type PostLook = {
  palette: string[] | null; dither: number; grade: { exp: number; sat: number; con: number; tint: string }; paper: number;
  ink: { col: string; mix: number; crease: number };
  sky: { top: string; mid: string; hor: string; sun: string; glow: string; sunDir: [number, number, number]; sunSize: number; cloud: string; cloudDark: string;
    /** notte (#56): 0..1 stelle e luna; moonDir = dove sta la luna */ night?: number; moonDir?: [number, number, number] };
  fog: { col: string; near: number; far: number; max: number };
};
export type PostToggles = { contorni: boolean; foschia: boolean; cielo: boolean };
export type Post = {
  /** `world` = false (dungeon, scene a parte): niente cielo né foschia, resta il fondo della scena. */
  render(gl: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera, t: number, world?: boolean): void;
  setSize(w: number, h: number): void;
  setStyle(s: PostLook): void;
  toggles: PostToggles;
  /** Draw call della scena (senza la passata finale) dell'ultimo frame. */
  sceneCalls(): number; sceneTris(): number;
};

const MAXPAL = 32;
const VERT = /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const FRAG = /* glsl */ `
#include <packing>
varying vec2 vUv;
uniform sampler2D tColor, tDepth;
uniform vec2 uRes;
uniform float uNear, uFar, uTime, uOutline, uFog, uSky;
uniform mat4 uInvProj, uCamWorld;
uniform vec3 uFogCol, uInk, uInkCol, uTint;
uniform float uInkMix, uCrease, uFogNear, uFogFar, uFogMax, uPaper, uDither, uExp, uSat, uCon, uSunSize;
uniform vec3 uSkyTop, uSkyMid, uSkyHor, uSun, uGlow, uSunDir, uCloud, uCloudDark, uMoonDir, uMoonCol;
uniform float uNight;
uniform vec3 uPal[${MAXPAL}];
uniform int uPalN;

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
vec3 skyCol(vec2 uv, vec2 px) {
  vec4 v = uInvProj * vec4(uv * 2.0 - 1.0, 1.0, 1.0); v /= v.w;
  vec3 dir = normalize((uCamWorld * vec4(normalize(v.xyz), 0.0)).xyz);
  float e = degrees(asin(clamp(dir.y, -1.0, 1.0))) + (bayer(px) - 0.5) * 1.6; // bordi delle bande a dente di sega
  vec3 c = e < 2.5 ? uSkyHor : e < 10.0 ? uSkyMid : uSkyTop;
  if (uSunSize > 0.0) {
    float a = degrees(acos(clamp(dot(dir, normalize(uSunDir)), -1.0, 1.0)));
    if (a < uSunSize * 2.2 + (bayer(px) - 0.5) * 1.5) c = uGlow;
    if (a < uSunSize) c = uSun;
  }
  if (uNight > 0.01) {
    // stelle: celle di ~0,15° in azimut × altezza, una su 40 accesa, tremolano; più rade vicino all'orizzonte
    vec2 sc = floor(vec2(atan(dir.x, dir.z), asin(clamp(dir.y, -1.0, 1.0))) * 380.0);
    float h = hash(sc);
    if (e > 1.2 && h > 0.975 + (1.0 - smoothstep(1.2, 6.0, e)) * 0.01 && fract(uTime * 0.5 + h * 17.0) > 0.2) c = mix(c, uMoonCol, uNight * (0.75 + 0.25 * fract(h * 91.0)));
    // luna: alone a pixel, poi falce (disco meno un disco spostato)
    vec3 md = normalize(uMoonDir);
    float a = degrees(acos(clamp(dot(dir, md), -1.0, 1.0)));
    if (a < 3.6 + (bayer(px) - 0.5) * 1.5) c = mix(c, min(c * 1.6 + 0.05, vec3(1.0)), uNight * 0.5);
    float b = degrees(acos(clamp(dot(dir, normalize(md + vec3(0.02, 0.008, -0.014))), -1.0, 1.0)));
    if (a < 1.6 && b > 1.35) c = mix(c, uMoonCol, uNight);
  }
  if (dir.y > 0.02) {
    // nuvole su un piano a 220 m: due ottave di rumore a soglia, pancia di un altro colore; scorrono col vento
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
  vec3 c;
  if (d >= 0.99999) c = uSky > 0.5 ? skyCol(vUv, px) : texture2D(tColor, vUv).rgb;
  else {
    c = texture2D(tColor, vUv).rgb;
    float z = viewZ(vUv);
    if (uOutline > 0.5) {
      float w = 1.0 / z;
      float wl = 1.0 / viewZ(vUv - vec2(t.x, 0.0)), wr = 1.0 / viewZ(vUv + vec2(t.x, 0.0));
      float wd = 1.0 / viewZ(vUv - vec2(0.0, t.y)), wu = 1.0 / viewZ(vUv + vec2(0.0, t.y));
      float far = max(max(w - wl, w - wr), max(w - wd, w - wu)) / w;
      float lap = min(wl + wr - 2.0 * w, wd + wu - 2.0 * w) / w;
      if (far > 0.12 && z < 160.0) c = mix(c * uInk, uInkCol, uInkMix);
      else if (lap < -0.006 && z < 90.0) c = uCrease >= 0.0 ? min(c * (1.0 + uCrease * 0.56) + 0.04 * uCrease, vec3(1.0)) : mix(c, uInkCol, -uCrease);
    }
    if (uFog > 0.5) {
      // fino a uFogMax entro uFogFar, poi piano fino al 100% a 700 m: le sagome lontane restano visibili, pallide
      float f = uFogMax * clamp((z - uFogNear) / (uFogFar - uFogNear), 0.0, 1.0) + (1.0 - uFogMax) * clamp((z - uFogFar) / 500.0, 0.0, 1.0);
      float b = f * 5.0, fr = fract(b); // 5 bande piene, dithering solo sulle cuciture
      f = min(1.0, (floor(b) + (fr > 0.75 + 0.25 * bayer(px) ? 1.0 : 0.0)) / 5.0);
      c = mix(c, uFogCol, f);
    }
  }
  // ritocco colore dello stile (in lineare), poi in sRGB per la palette
  c *= uExp * uTint;
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = max(mix(vec3(l), c, uSat), 0.0);
  vec3 s = clamp(sRGBTransferOETF(vec4(c, 1.0)).rgb, 0.0, 1.0);
  s = clamp((s - 0.5) * uCon + 0.5, 0.0, 1.0);
  if (uPalN > 0) {
    vec3 b1 = s, b2 = s; float d1 = 1e9, d2 = 1e9;
    for (int i = 0; i < ${MAXPAL}; i++) {
      if (i >= uPalN) break;
      vec3 dd = s - uPal[i];
      float e = dot(dd * dd, vec3(2.0, 4.0, 3.0));
      if (e < d1) { d2 = d1; b2 = b1; d1 = e; b1 = uPal[i]; } else if (e < d2) { d2 = e; b2 = uPal[i]; }
    }
    float r = sqrt(d1) / max(1e-5, sqrt(d1) + sqrt(d2)); // 0 = sul primo, 0,5 = a metà
    s = bayer(px) < r * uDither ? b2 : b1;
  }
  if (uPaper > 0.0) {
    // carta: fibre larghe e grana fine, solo un poco più scura (come inchiostro assorbito)
    float g = vnoise(px * vec2(0.08, 0.5)) * 0.6 + hash(px) * 0.4;
    s *= 1.0 - uPaper * 0.07 * g;
  }
  gl_FragColor = vec4(s, 1.0);
}`;

const col = (hex: string) => new THREE.Color(hex);
const srgb = (hex: string) => { const c = new THREE.Color(hex); c.convertLinearToSRGB(); return new THREE.Vector3(c.r, c.g, c.b); };

export function createPost(): Post {
  const depth = new THREE.DepthTexture(1, 1); depth.type = THREE.UnsignedIntType;
  const rt = new THREE.WebGLRenderTarget(1, 1, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthTexture: depth, depthBuffer: true, colorSpace: THREE.SRGBColorSpace });
  const toggles: PostToggles = { contorni: true, foschia: true, cielo: true };
  const U = {
    tColor: { value: rt.texture }, tDepth: { value: depth }, uRes: { value: new THREE.Vector2(1, 1) },
    uNear: { value: 1 }, uFar: { value: 900 }, uTime: { value: 0 }, uOutline: { value: 1 }, uFog: { value: 1 }, uSky: { value: 1 },
    uInvProj: { value: new THREE.Matrix4() }, uCamWorld: { value: new THREE.Matrix4() },
    // contorno «gioco»: lo stesso colore più scuro e spinto verso il viola (#A64DFF) delle ombre, non nero
    uInk: { value: new THREE.Vector3(0.5, 0.42, 0.62) }, uInkCol: { value: col('#000') }, uInkMix: { value: 0 }, uCrease: { value: 1 },
    uFogCol: { value: col('#E8E1D6') }, uFogNear: { value: 35 }, uFogFar: { value: 200 }, uFogMax: { value: 0.8 },
    uTint: { value: col('#fff') }, uExp: { value: 1 }, uSat: { value: 1 }, uCon: { value: 1 }, uPaper: { value: 0 }, uDither: { value: 0 },
    uSkyTop: { value: col('#3FB9C9') }, uSkyMid: { value: col('#7FE3E0') }, uSkyHor: { value: col('#E8E1D6') },
    uSun: { value: col('#fff') }, uGlow: { value: col('#fff') }, uSunDir: { value: new THREE.Vector3(0, -1, 0) }, uSunSize: { value: 0 },
    uCloud: { value: col('#F4E3C1') }, uCloudDark: { value: col('#E8E1D6') },
    uNight: { value: 0 }, uMoonDir: { value: new THREE.Vector3(-0.66, 0.05, -0.75) }, uMoonCol: { value: col('#E8E1D6') },
    uPal: { value: Array.from({ length: MAXPAL }, () => new THREE.Vector3()) }, uPalN: { value: 0 },
  };
  const mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: U, depthTest: false, depthWrite: false });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat); quad.frustumCulled = false;
  const ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  let calls = 0, tris = 0;
  return {
    toggles,
    setSize: (w, h) => { rt.setSize(w, h); U.uRes.value.set(w, h); },
    setStyle: (s) => {
      U.uInkCol.value.set(s.ink.col); U.uInkMix.value = s.ink.mix; U.uCrease.value = s.ink.crease;
      U.uFogCol.value.set(s.fog.col); U.uFogNear.value = s.fog.near; U.uFogFar.value = s.fog.far; U.uFogMax.value = s.fog.max;
      U.uTint.value.set(s.grade.tint); U.uExp.value = s.grade.exp; U.uSat.value = s.grade.sat; U.uCon.value = s.grade.con;
      U.uPaper.value = s.paper; U.uDither.value = s.dither;
      U.uSkyTop.value.set(s.sky.top); U.uSkyMid.value.set(s.sky.mid); U.uSkyHor.value.set(s.sky.hor);
      U.uSun.value.set(s.sky.sun); U.uGlow.value.set(s.sky.glow); U.uSunDir.value.set(...s.sky.sunDir).normalize(); U.uSunSize.value = s.sky.sunSize;
      U.uCloud.value.set(s.sky.cloud); U.uCloudDark.value.set(s.sky.cloudDark);
      U.uNight.value = s.sky.night ?? 0; if (s.sky.moonDir) U.uMoonDir.value.set(...s.sky.moonDir).normalize();
      const pal = (s.palette ?? []).slice(0, MAXPAL);
      pal.forEach((h, i) => U.uPal.value[i]!.copy(srgb(h)));
      U.uPalN.value = pal.length;
    },
    sceneCalls: () => calls, sceneTris: () => tris,
    render: (gl, scene, camera, t, world = true) => {
      gl.setRenderTarget(rt); gl.render(scene, camera);
      calls = gl.info.render.calls; tris = gl.info.render.triangles;
      U.uNear.value = camera.near; U.uFar.value = camera.far; U.uTime.value = t % 3600;
      U.uInvProj.value.copy(camera.projectionMatrixInverse); U.uCamWorld.value.copy(camera.matrixWorld);
      U.uOutline.value = toggles.contorni ? 1 : 0; U.uFog.value = toggles.foschia && world ? 1 : 0; U.uSky.value = toggles.cielo && world ? 1 : 0;
      gl.setRenderTarget(null); gl.render(quad, ortho);
    },
  };
}
