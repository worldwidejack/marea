// Acqua a pixel (ART_BIBLE §8): piano piatto, 2 colori per fascia (acqua / acqua bassa) che scorrono lenti, quantizzati a 16 texel/m.
// Vicino alle rive i vertici ondeggiano appena; schiuma a pixel chiari lungo le rive e attorno a moli e scogli. Niente riflessi, niente trasparenze.
// Tutto in 1 shader non illuminato (colori esatti della palette): 2 draw call (griglia fitta attorno alla camera + cornice larga fino
// all'orizzonte, entrambe spostate a passi di 2 m con la camera: l'acqua è infinita e la mappa può essere grande quanto si vuole).
// Fasce di profondità dalla distanza dalla terra più vicina (canale A della maschera), non dal bordo della mappa: vale per l'arcipelago.
import * as THREE from 'three';
import type { GridMap, Tile } from '@marea/sim';

export const WATER_COLORS = { abisso: '#163F73', profonda: '#2478A8', acqua: '#3FB9C9', bassa: '#7FE3E0', schiuma: '#E8E1D6' } as const;
const LAND = new Set<Tile>(['.', 'g', 'r', 'd', 'P', 'L']);
const SHALLOW = new Set<Tile>([',', 'B']);
const FOAMY = new Set<Tile>(['d', 'r']);

// Uniform condivisi da tutte le acque: il tempo lo aggiorna update(t), la mappa setWaterMap(map) (la chiama island.ts).
const U = {
  uTime: { value: 0 },
  uMask: { value: null as THREE.Texture | null },
  uHasMap: { value: 0 },
  uMaskOrigin: { value: new THREE.Vector2() },
  uMaskSize: { value: new THREE.Vector2(1, 1) },
  uMapMin: { value: new THREE.Vector2(0, 0) },
  uMapMax: { value: new THREE.Vector2(0, 0) },
  uPattern: { value: null as THREE.Texture | null },
  cAbisso: { value: new THREE.Color(WATER_COLORS.abisso) },
  cProfonda: { value: new THREE.Color(WATER_COLORS.profonda) },
  cAcqua: { value: new THREE.Color(WATER_COLORS.acqua) },
  cBassa: { value: new THREE.Color(WATER_COLORS.bassa) },
  cSchiuma: { value: new THREE.Color(WATER_COLORS.schiuma) },
  // notte (#56): 0 = acqua di sempre; la direzione è quella in cui si vede la luna (bassa davanti alla camera)
  uNight: { value: 0 }, uMoonDir: { value: new THREE.Vector3(-0.66, 0.05, -0.75) }, cLuna: { value: new THREE.Color('#E8E1D6') },
};

/** Notte (#56): scia della luna e stelle riflesse, `night` 0..1 (0 = acqua di sempre). */
export function setWaterNight(night: number, moonDir?: readonly [number, number, number]): void {
  U.uNight.value = night; if (moonDir) U.uMoonDir.value.set(moonDir[0], moonDir[1], moonDir[2]).normalize();
}
/** Ciclo giorno/notte (#53): ricolora tutte le acque (uniform condivisi). Senza chiamarla restano i colori di WATER_COLORS. */
export function setWaterColors(c: { abisso: string; profonda: string; acqua: string; bassa: string; schiuma: string }): void {
  U.cAbisso.value.set(c.abisso); U.cProfonda.value.set(c.profonda); U.cAcqua.value.set(c.acqua); U.cBassa.value.set(c.bassa); U.cSchiuma.value.set(c.schiuma);
}

const VERT = /* glsl */ `
uniform float uTime; uniform sampler2D uMask; uniform float uHasMap; uniform vec2 uMaskOrigin; uniform vec2 uMaskSize;
varying vec3 vWorld;
void main() {
  vec3 w = (modelMatrix * vec4(position, 1.0)).xyz; // la griglia si sposta con la camera (a passi interi di cella)
  if (uHasMap > 0.5) {
    vec4 m = textureLod(uMask, (w.xz - uMaskOrigin) / uMaskSize, 0.0);
    float shore = smoothstep(0.02, 0.45, max(m.r, m.b)) * (1.0 - smoothstep(0.55, 0.8, m.r));
    w.y += shore * 0.07 * sin(uTime * 1.7 + (w.x + w.z) * 0.8) ;
  }
  vWorld = w;
  gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
}`;

const FRAG = /* glsl */ `
uniform float uTime; uniform sampler2D uMask; uniform float uHasMap; uniform vec2 uMaskOrigin; uniform vec2 uMaskSize;
uniform vec2 uMapMin; uniform vec2 uMapMax; uniform sampler2D uPattern;
uniform vec3 cAbisso; uniform vec3 cProfonda; uniform vec3 cAcqua; uniform vec3 cBassa; uniform vec3 cSchiuma;
uniform float uNight; uniform vec3 uMoonDir; uniform vec3 cLuna;
varying vec3 vWorld;
const float DIST_MAX = 128.0; // metri codificati in 0..1 nel canale A della maschera
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main() {
  vec2 px = floor(vWorld.xz * 16.0);            // 16 texel per metro
  vec2 p = (px + 0.5) / 16.0;
  float checker = mod(px.x + px.y, 2.0);        // per il dithering tra fasce (solo colori adiacenti)
  // Fasce di profondità dalla terra più vicina: acqua fino a 14 m, profonda oltre, abisso oltre 70 m (bordi netti a scacchi).
  vec4 m = uHasMap > 0.5 ? texture2D(uMask, (p - uMaskOrigin) / uMaskSize) : vec4(0.0);
  vec2 dd = max(max(uMapMin - p, p - uMapMax), vec2(0.0));
  float dist = uHasMap > 0.5 ? max(m.a * DIST_MAX, length(dd)) : 30.0;
  vec3 base = cAcqua, streak = cBassa;
  if (dist + checker * 1.5 > 14.0) { base = cProfonda; streak = cAcqua; }
  if (dist + checker * 3.0 > 70.0) { base = cAbisso; streak = cProfonda; }
  float shallow = max(m.g, m.r);
  if (shallow + checker * 0.06 > 0.5) { base = cBassa; streak = cAcqua; }
  // Due strati del motivo che scorrono in direzioni diverse: trattini chiari/scuri a pixel.
  float a = texture2D(uPattern, p / 7.0 + vec2(uTime * 0.035, uTime * 0.012)).r;
  float b = texture2D(uPattern, p.yx / 11.0 - vec2(uTime * 0.02, -uTime * 0.027)).g;
  vec3 c = (a > 0.5 || b > 0.5) ? streak : base;
  // Schiuma: una riga a pixel che respira lungo la riva (appena oltre lo scalino di sabbia) e attorno a moli e scogli.
  float breath = 0.035 * sin(uTime * 1.3 + (p.x - p.y) * 0.35);
  float n = hash(px + floor(uTime * 3.0));
  float shore = step(0.16 + breath, m.r) * step(m.r, 0.25 + breath);
  float ring = step(0.14 + breath, m.b) * step(m.b, 0.36 + breath);
  float spray = step(0.05, m.r + m.b) * step(m.r + m.b, 0.16 + breath) * step(0.93, n);
  if (uHasMap > 0.5 && (shore * step(0.25, n) + ring * step(0.35, n) + spray) > 0.5) c = cSchiuma;
  if (uNight > 0.01) {
    // scia della luna: i punti d'acqua nella direzione della luna (vista dall'alto, ±1,5°) luccicano a pixel, un po' più larga lontano
    vec2 toP = vWorld.xz - cameraPosition.xz;
    float al = dot(normalize(toP), normalize(uMoonDir.xz)), far = clamp(length(toP) / 70.0, 0.0, 1.0);
    if (al > 0.99965 - 0.0012 * far && hash(floor(p * 4.0) + floor(uTime * 3.0)) > 0.6) c = mix(c, cLuna, uNight);
    // stelle riflesse: pochi pixel fissi che tremolano
    float st = hash(floor(p * 1.5) + 17.0);
    if (st > 0.9965 && fract(uTime * 0.6 + st * 13.0) > 0.3) c = mix(c, cLuna, uNight * 0.85);
  }
  gl_FragColor = vec4(c, 1.0);
  #include <colorspace_fragment>
}`;

function patternTexture(): THREE.Texture {
  const c = document.createElement('canvas'); c.width = c.height = 32;
  const g = c.getContext('2d')!;
  g.fillStyle = '#000000'; g.fillRect(0, 0, 32, 32);
  let s = 1234567;
  const r = () => ((s = (s * 1103515245 + 12345) >>> 0) / 4294967296);
  // Canale R: trattini orizzontali; canale G: trattini più corti (secondo strato).
  for (let i = 0; i < 9; i++) { g.fillStyle = '#FF0000'; g.fillRect(Math.floor(r() * 32), Math.floor(r() * 32), 2 + Math.floor(r() * 4), 1); }
  g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 7; i++) { g.fillStyle = '#00FF00'; g.fillRect(Math.floor(r() * 32), Math.floor(r() * 32), 2 + Math.floor(r() * 2), 1); }
  const t = new THREE.CanvasTexture(c);
  t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.NoColorSpace;
  return t;
}

let material: THREE.ShaderMaterial | null = null;
function getMaterial(): THREE.ShaderMaterial {
  if (!material) {
    U.uPattern.value = patternTexture();
    material = new THREE.ShaderMaterial({ uniforms: U, vertexShader: VERT, fragmentShader: FRAG, fog: false, lights: false });
    material.name = 'water';
  }
  return material;
}

/** Griglia fitta (1 m) sul rettangolo [x0,x1]×[z0,z1] in coordinate mondo. */
function grid(x0: number, z0: number, x1: number, z1: number, step: number): THREE.BufferGeometry {
  const w = x1 - x0, h = z1 - z0;
  const g = new THREE.PlaneGeometry(w, h, Math.round(w / step), Math.round(h / step)); g.rotateX(-Math.PI / 2); g.translate(x0 + w / 2, 0, z0 + h / 2); return g;
}
/** Cornice larga attorno al rettangolo interno (4 quad, niente sovrapposizioni con la griglia fitta). */
function frame(x0: number, z0: number, x1: number, z1: number, R: number): THREE.BufferGeometry {
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  const X0 = cx - R, X1 = cx + R, Z0 = cz - R, Z1 = cz + R;
  const rects: [number, number, number, number][] = [[X0, Z0, X1, z0], [X0, z1, X1, Z1], [X0, z0, x0, z1], [x1, z0, X1, z1]];
  const pos: number[] = [], idx: number[] = [];
  for (const [a, b, c, d] of rects) {
    const i = pos.length / 3;
    pos.push(a, 0, b, c, 0, b, c, 0, d, a, 0, d);
    idx.push(i, i + 2, i + 1, i, i + 3, i + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
  return g;
}

/** Griglia fitta: lato NEAR m a passi di 1 m attorno al punto guardato (la vista diorama copre < 80 m); oltre, la cornice fino a HORIZON. */
const NEAR = 96, HORIZON = 1500, SNAP = 2;
const DIST_MAX_CELLS = 64; // = 128 m con celle da 2 m (DIST_MAX nello shader)

/** Maschera per cella (bordo di 1 cella): R terra, G acqua bassa, B schiuma (molo, scogli), A distanza dalla terra più vicina. */
function buildMask(map: GridMap): THREE.DataTexture {
  const W = map.w + 2, H = map.h + 2;
  const data = new Uint8Array(W * H * 4);
  // Distanza (in celle, chamfer a 8 vicini con passi 1 e 1,41) dalla cella di terra più vicina.
  const dist = new Float32Array(W * H).fill(Infinity);
  for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) {
    const t = map.at(x - 1, z - 1), i = (z * W + x) * 4;
    data[i] = LAND.has(t) && t !== 'd' ? 255 : 0; // il molo sta sull'acqua: non è riva
    data[i + 1] = SHALLOW.has(t) ? 255 : 0;
    data[i + 2] = FOAMY.has(t) ? 255 : 0;
    if (LAND.has(t)) dist[z * W + x] = 0;
  }
  // Due passate (avanti e indietro): veloce anche su 560×560 celle.
  const D = Math.SQRT2;
  for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) {
    const i = z * W + x; let d = dist[i]!;
    if (x > 0) d = Math.min(d, dist[i - 1]! + 1);
    if (z > 0) { d = Math.min(d, dist[i - W]! + 1); if (x > 0) d = Math.min(d, dist[i - W - 1]! + D); if (x < W - 1) d = Math.min(d, dist[i - W + 1]! + D); }
    dist[i] = d;
  }
  for (let z = H - 1; z >= 0; z--) for (let x = W - 1; x >= 0; x--) {
    const i = z * W + x; let d = dist[i]!;
    if (x < W - 1) d = Math.min(d, dist[i + 1]! + 1);
    if (z < H - 1) { d = Math.min(d, dist[i + W]! + 1); if (x < W - 1) d = Math.min(d, dist[i + W + 1]! + D); if (x > 0) d = Math.min(d, dist[i + W - 1]! + D); }
    dist[i] = d;
  }
  for (let i = 0; i < W * H; i++) data[i * 4 + 3] = Math.round(Math.min(1, dist[i]! / DIST_MAX_CELLS) * 255);
  const tex = new THREE.DataTexture(data, W, H, THREE.RGBAFormat);
  tex.magFilter = tex.minFilter = THREE.LinearFilter; tex.generateMipmaps = false;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping; tex.colorSpace = THREE.NoColorSpace; tex.flipY = false; tex.needsUpdate = true;
  return tex;
}

/** Collega l'acqua alla mappa: rive, acqua bassa, schiuma e ondeggiamento. Idempotente; vale anche per le acque create dopo. */
export function setWaterMap(map: GridMap): void {

  U.uMask.value?.dispose();
  U.uMask.value = buildMask(map);
  U.uHasMap.value = 1;
  // Il texel (0,0) della maschera è la cella (−1,−1): i centri cadono al centro delle celle con filtro lineare.
  U.uMaskOrigin.value.set(-map.tile, -map.tile);
  U.uMaskSize.value.set((map.w + 2) * map.tile, (map.h + 2) * map.tile);
  U.uMapMin.value.set(0, 0); U.uMapMax.value.set(map.w * map.tile, map.h * map.tile);
}

export type Water = { mesh: THREE.Object3D; update(t: number): void; setMap?(map: GridMap): void; follow(x: number, z: number): void };

export function createWater(o: { size: number; map?: GridMap }): Water {
  const mat = getMaterial();
  const group = new THREE.Group(); group.name = 'water';
  // Griglia fitta centrata nell'origine del gruppo + cornice attorno; il gruppo segue il punto guardato a passi di SNAP m.
  const h = NEAR / 2;
  const far = new THREE.Mesh(frame(-h, -h, h, h, HORIZON), mat);
  const near = new THREE.Mesh(grid(-h, -h, h, h, 1), mat);
  for (const m of [far, near]) { m.frustumCulled = false; m.name = m === far ? 'acqua_lontana' : 'acqua_vicina'; group.add(m); }
  if (o.map) setWaterMap(o.map);
  const follow = (x: number, z: number) => { group.position.set(Math.round(x / SNAP) * SNAP, 0, Math.round(z / SNAP) * SNAP); };
  follow(o.size / 2, o.size / 2);
  return {
    mesh: group,
    update: (t) => { U.uTime.value = t % 3600; },
    setMap: (m) => setWaterMap(m),
    follow,
  };
}
