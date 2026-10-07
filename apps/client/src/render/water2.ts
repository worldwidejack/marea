// Acqua degli stili (nata in provapixel #50; nel gioco con «stampa giapponese» #53). Un piano grande che segue il giocatore; il colore viene dalla distanza
// dalla riva (campo di distanza calcolato una volta dalla GridMap, una texture da una cella per texel, filtrata lineare).
// Modo 1 stampa: onde a linee chiare e creste di schiuma ricciute, schiuma bianca spessa sulla riva.
// Modo 2 giorno: fasce turchesi, scogli sott'acqua nel basso fondale, riflessi a linee, scintille bianche.
// Modo 3 tramonto: teal scuro, scia di luce arancio verso il sole, schiuma calda.
// Tutto quantizzato a 8 texel/m così resta a pixel anche da vicino.
import * as THREE from 'three';
import type { GridMap } from '@marea/sim';

const MAXD = 16; // m: oltre è mare aperto

/** Distanza (m) dalla terra più vicina per ogni cella d'acqua: chamfer 3-4 a due passate, 0 sulla terra. */
function distanceField(map: GridMap): THREE.DataTexture {
  const { w, h, tile } = map, INF = 1e9, d = new Float32Array(w * h);
  const water = (t: string) => t === '~' || t === ',' || t === 'B' || t === 'd'; // il molo sta sull'acqua: niente schiuma sotto
  for (let cz = 0; cz < h; cz++) for (let cx = 0; cx < w; cx++) d[cz * w + cx] = water(map.at(cx, cz)) ? INF : 0;
  const relax = (i: number, j: number, c: number) => { if (d[j]! + c < d[i]!) d[i] = d[j]! + c; };
  for (let cz = 0; cz < h; cz++) for (let cx = 0; cx < w; cx++) {
    const i = cz * w + cx;
    if (cx > 0) relax(i, i - 1, 3); if (cz > 0) relax(i, i - w, 3);
    if (cx > 0 && cz > 0) relax(i, i - w - 1, 4); if (cx < w - 1 && cz > 0) relax(i, i - w + 1, 4);
  }
  for (let cz = h - 1; cz >= 0; cz--) for (let cx = w - 1; cx >= 0; cx--) {
    const i = cz * w + cx;
    if (cx < w - 1) relax(i, i + 1, 3); if (cz < h - 1) relax(i, i + w, 3);
    if (cx < w - 1 && cz < h - 1) relax(i, i + w + 1, 4); if (cx > 0 && cz < h - 1) relax(i, i + w - 1, 4);
  }
  const px = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const m = d[i]! === 0 ? 0 : Math.max(0, (d[i]! / 3 - 0.5) * tile); // celle → metri dal bordo della terra
    const v = Math.round(Math.min(1, m / MAXD) * 255);
    px[i * 4] = v; px[i * 4 + 3] = 255;
  }
  const t = new THREE.DataTexture(px, w, h, THREE.RGBAFormat);
  t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearFilter; t.needsUpdate = true;
  return t;
}

const VERT = /* glsl */ `
varying vec3 vW;
void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const FRAG = /* glsl */ `
uniform sampler2D tDist;
uniform vec2 uMapSize;
uniform float uTime;
uniform int uMode;
uniform vec3 uC0, uC1, uC2, uC3, uFoam, uLine, uSunDir, uTint, uMoonDir;
uniform float uNight;
varying vec3 vW;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
void main() {
  vec2 q = (floor(vW.xz * 8.0) + 0.5) / 8.0; // 8 texel/m
  vec2 uv = q / uMapSize;
  float d = (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) ? ${MAXD.toFixed(1)} : texture2D(tDist, uv).r * ${MAXD.toFixed(1)};
  float t = uTime;
  float wob = vnoise(q * 0.35 + vec2(t * 0.15, 0.0)) - 0.5; // riva che respira
  float dd = d + wob * 0.9;
  vec3 c = dd < 1.6 ? uC0 : dd < 4.5 ? uC1 : dd < 10.0 ? uC2 : uC3;
  if (uMode == 1) {
    // stampa: campo d'onde che scorre; linee di livello chiare, creste ricciute di schiuma dove il campo è alto
    float w = vnoise(q * vec2(0.11, 0.17) + vec2(t * 0.05, t * 0.02)) * 0.65 + vnoise(q * 0.33 + vec2(-t * 0.04, t * 0.03)) * 0.35;
    float l = fract(w * 6.0);
    if (l < 0.09 && dd > 2.0) c = uLine;
    if (w > 0.68 && l > 0.9 && dd > 2.0) c = uFoam; // cresta: solo il filo alto dell'onda
    float shore = 1.1 + 0.45 * sin(t * 1.3 + vnoise(q * 0.5) * 6.0);
    if (dd < shore) c = uFoam;
    float ring = 1.8 + fract(t * 0.18) * 2.6;
    if (abs(dd - ring) < 0.16 && dd < 4.2) c = uFoam;
  } else if (uMode == 2) {
    // giorno: scogli e sabbia sotto il pelo dell'acqua, riflessi a reticolo, scintille
    if (dd > 1.0 && dd < 7.0 && vnoise(q * 0.45 + 3.0) > 0.7) c = mix(c, uC3, 0.35);
    float k = vnoise(q * 0.9 + vec2(t * 0.25, -t * 0.18));
    if (dd < 6.0 && abs(fract(k * 4.0) - 0.5) < 0.05) c = mix(c, uLine, 0.6);
    else if (abs(fract(k * 3.0) - 0.5) < 0.025) c = mix(c, uLine, 0.3); // al largo increspature più rade
    if (hash(floor(q * 2.0) + floor(t * 3.0)) > 0.996) c = uFoam;
    float shore = 0.7 + 0.3 * sin(t * 1.6 + vnoise(q * 0.6) * 6.0);
    if (dd < shore) c = uFoam;
    float ring = 1.2 + fract(t * 0.22) * 2.0;
    if (abs(dd - ring) < 0.1 && dd < 3.2) c = mix(c, uFoam, 0.7);
  } else if (uMode == 3) {
    // tramonto: increspature scure, scia di luce verso il sole (riflesso del sole su onde a pixel)
    vec3 V = normalize(cameraPosition - vW);
    vec2 g = vec2(vnoise(q * 0.6 + t * 0.3) - 0.5, vnoise(q * 0.6 + 9.0 - t * 0.25) - 0.5);
    vec3 N = normalize(vec3(g.x * 0.5, 1.0, g.y * 0.5));
    float spec = dot(reflect(-V, N), normalize(uSunDir));
    float sp = hash(floor(q * 8.0) + floor(t * 5.0));
    if (spec > 0.992 && sp > 0.55) c = uLine;
    else if (spec > 0.98 && sp > 0.85) c = uFoam;
    if (abs(fract(vnoise(q * vec2(0.1, 0.3) + t * 0.08) * 5.0) - 0.5) < 0.04 && dd > 3.0) c = mix(c, uC3, 0.6);
    float shore = 0.9 + 0.35 * sin(t * 1.4 + vnoise(q * 0.5) * 6.0);
    if (dd < shore) c = uFoam;
  }
  c *= uTint;
  if (uNight > 0.01) { // notte (#56): scia della luna e stelle riflesse, come nell'acqua del gioco
    vec2 toP = vW.xz - cameraPosition.xz;
    float al = dot(normalize(toP), normalize(uMoonDir.xz)), far = clamp(length(toP) / 70.0, 0.0, 1.0);
    if (al > 0.99965 - 0.0012 * far && hash(floor(q * 4.0) + floor(t * 3.0)) > 0.6) c = mix(c, uFoam, uNight);
    float st = hash(floor(q * 1.5) + 17.0);
    if (st > 0.9965 && fract(t * 0.6 + st * 13.0) > 0.3) c = mix(c, uFoam, uNight * 0.85);
  }
  gl_FragColor = vec4(c, 1.0); // uTint: il ciclo giorno/notte scurisce l'acqua (non è illuminata)
  #include <colorspace_fragment>
}`;

export type Water2 = { mesh: THREE.Mesh; follow(x: number, z: number): void; update(t: number): void; set(mode: number, c: string[], foam: string, line: string, sunDir: [number, number, number]): void; tint(c: THREE.Color): void; night(n: number, moonDir: readonly [number, number, number]): void };

export function createWater2(map: GridMap): Water2 {
  const col = (h: string) => new THREE.Color(h);
  const U = {
    tDist: { value: distanceField(map) }, uMapSize: { value: new THREE.Vector2(map.w * map.tile, map.h * map.tile) }, uTime: { value: 0 }, uMode: { value: 1 },
    uC0: { value: col('#fff') }, uC1: { value: col('#fff') }, uC2: { value: col('#fff') }, uC3: { value: col('#fff') }, uFoam: { value: col('#fff') }, uLine: { value: col('#fff') },
    uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uTint: { value: new THREE.Color(1, 1, 1) },
    uNight: { value: 0 }, uMoonDir: { value: new THREE.Vector3(0, 0, -1) },
  };
  const mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: U });
  // 1,6 km di lato a 64 quadrati: la foschia copre il bordo; la griglia serve solo a non avere triangoli enormi
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1600, 1600, 8, 8).rotateX(-Math.PI / 2), mat);
  mesh.name = 'acqua_stile'; mesh.frustumCulled = false; mesh.receiveShadow = false;
  return {
    mesh,
    follow: (x, z) => mesh.position.set(Math.round(x / 4) * 4, 0, Math.round(z / 4) * 4),
    update: (t) => { U.uTime.value = t % 3600; },
    tint: (c) => { U.uTint.value.copy(c); },
    night: (n, d) => { U.uNight.value = n; U.uMoonDir.value.set(d[0], d[1], d[2]).normalize(); },
    set: (mode, c, foam, line, sunDir) => {
      U.uMode.value = mode; U.uC0.value.set(c[0]!); U.uC1.value.set(c[1]!); U.uC2.value.set(c[2]!); U.uC3.value.set(c[3]!);
      U.uFoam.value.set(foam); U.uLine.value.set(line); U.uSunDir.value.set(...sunDir).normalize();
    },
  };
}
