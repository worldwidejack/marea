// Meteo (#361), la resa: la luce del posto dove sei, le nuvole condivise con gli shader, la pioggia.
// Le nuvole (tipo, posto, forma) le decide la sim dall'orologio (`nuvoleAt` in @marea/sim/meteo.ts): uguali per tutti. Qui:
// - `conMeteo`: luce, cielo e acqua col tempo del posto dove sei (la nuvola che hai sopra), a gradini. Colori di arrivo dalla palette
//   (pietre e rocce); di notte gli stessi grigi scuriti, così la pioggia di notte resta notte.
// - `NUBI`: le nuvole vicine come uniform condivisi da passata finale (ombre), pioggia (gocce) e mare (cerchi): un aggiornamento per frame.
// - pioggia: un solo LineSegments (1 draw call), trattini di 1 pixel che cadono nello shader. Due famiglie: le gocce vicine (un cubo
//   attorno a chi gioca, ancorato al mondo) cadono solo dove piove davvero; le «tende» di ogni nuvola di pioggia cadono sotto di lei
//   anche lontano, così si vede piovere là e non qui.
import * as THREE from 'three';
import type { MeteoStato, NuvolaTipo } from '@marea/content';
import type { Momento } from './ciclo.ts';

const ca = new THREE.Color(), cb = new THREE.Color();
/** a → b di k; b scurito di notte (n 0..1) così i grigi del meteo non schiariscono il buio. */
const verso = (a: string, b: string, k: number, n: number) => '#' + ca.set(a).lerp(cb.set(b).multiplyScalar(1 - 0.72 * n), k).getHexString();
const mixHex = (a: string, b: string, k: number) => '#' + ca.set(a).lerp(cb.set(b), k).getHexString();

/** Quanto pesa ogni tipo di nuvola su luce, cielo e acqua (0..1) e i grigi della palette verso cui va. La bianca fa solo ombra. */
type Peso = { sole: number; ambiente: number; grigio: string; cielo: [string, string, string, string]; alto: [string, string, string]; nuvole: [string, string]; acqua: number; copertura: number; cieloK: number };
const PESI: Record<Exclude<MeteoStato, 'sereno' | 'bianca'>, Peso> = {
  // grigia: luce piatta (sole debole, più cielo), ombre leggere
  grigia: { sole: 0.55, ambiente: -0.04, grigio: '#E8E1D6', cielo: ['#B9AFA3', '#E8E1D6', '#E8E1D6', '#B9AFA3'], alto: ['#7F7568', '#B9AFA3', '#E8E1D6'], nuvole: ['#E8E1D6', '#B9AFA3'], acqua: 0.2, copertura: 0.65, cieloK: 0.5 },
  // pioggia: luce grigia e bassa, acqua più scura
  pioggia: { sole: 0.72, ambiente: -0.16, grigio: '#B9AFA3', cielo: ['#7F7568', '#B9AFA3', '#B9AFA3', '#7F7568'], alto: ['#4A4340', '#7F7568', '#B9AFA3'], nuvole: ['#B9AFA3', '#7F7568'], acqua: 0.45, copertura: 1, cieloK: 0.75 },
  // temporale: ancora più buio, il cielo verso la roccia
  temporale: { sole: 0.82, ambiente: -0.26, grigio: '#7F7568', cielo: ['#4A4340', '#7F7568', '#7F7568', '#4A4340'], alto: ['#23201F', '#4A4340', '#7F7568'], nuvole: ['#7F7568', '#4A4340'], acqua: 0.6, copertura: 1, cieloK: 0.85 },
};
/** Acqua sotto la pioggia: verso l'abisso e la roccia (più scura, meno azzurra). */
const ACQUA_SCURA = { abisso: '#163F73', profonda: '#163F73', acqua: '#163F73', bassa: '#2478A8', schiuma: '#B9AFA3' };

/** Il momento della giornata `m` col tempo del posto dove sei (tipo e intensità k 0..1). Sereno, bianca o k = 0: `m` così com'è. */
export function conMeteo(m: Momento, stato: MeteoStato, k: number): Momento {
  if (stato === 'sereno' || stato === 'bianca' || k <= 0) return m;
  const p = PESI[stato], n = m.notte, s = m.sun;
  const w = m.water, kw = p.acqua * k;
  return {
    ...m,
    sun: { ...s, intensity: s.intensity * (1 - p.sole * k), color: verso(s.color, p.grigio, 0.6 * k, n), sky: verso(s.sky, p.grigio, 0.45 * k, n), hemiI: s.hemiI * (1 + p.ambiente * k) },
    bands: m.bands.map((c, i) => verso(c, p.cielo[i]!, p.cieloK * k, n)) as Momento['bands'],
    sky3: m.sky3.map((c, i) => verso(c, p.alto[i]!, p.cieloK * k, n)) as Momento['sky3'],
    clouds: [verso(m.clouds[0], p.nuvole[0], 0.8 * k, n), verso(m.clouds[1], p.nuvole[1], 0.8 * k, n)],
    water: { abisso: mixHex(w.abisso, ACQUA_SCURA.abisso, kw), profonda: mixHex(w.profonda, ACQUA_SCURA.profonda, kw), acqua: mixHex(w.acqua, ACQUA_SCURA.acqua, kw), bassa: mixHex(w.bassa, ACQUA_SCURA.bassa, kw), schiuma: verso(w.schiuma, ACQUA_SCURA.schiuma, kw, n) },
    tint: verso(m.tint, p.grigio, 0.3 * k, n),
  };
}
/** Quanto è coperto il cielo sopra di te (per il cielo della camera bassa e la scia della luna). */
export const coperturaMeteo = (stato: MeteoStato, k: number): number => (stato === 'sereno' ? 0 : stato === 'bianca' ? 0.3 * k : PESI[stato].copertura * k);

/** Quanto scurisce l'ombra di ogni nuvola (0..1, verso il blu-viola delle ombre: ART_BIBLE §7). */
export const OMBRA: Record<NuvolaTipo, number> = { bianca: 0.45, grigia: 0.6, pioggia: 0.75, temporale: 0.9 };

// ---------- nuvole condivise dagli shader ----------
/** Nuvole passate agli shader: le più vicine a chi gioca. */
export const MAXN = 24;
/** Una nuvola per gli shader: A = (x, z, dx, dz) centro e verso; B = (1/rx, 1/rz, ombra 0..1, pioggia 0..1). */
export const NUBI = {
  uNubiA: { value: Array.from({ length: MAXN }, () => new THREE.Vector4()) },
  uNubiB: { value: Array.from({ length: MAXN }, () => new THREE.Vector4()) },
  uNubiN: { value: 0 },
  /** Frazione del raggio dove piove (meteo.json, `pioggiaR`). */
  uPioggiaR: { value: 0.75 },
  /** Quota della pancia delle nuvole (m): da lì cadono le gocce; sopra niente ombra (le nuvole non si fanno ombra da sole). */
  uQuota: { value: 6 },
};
/** GLSL delle nuvole: `nubeD2` = distanza normalizzata al quadrato (1 sul bordo), `pioggiaIn` = quanto piove in p. */
export const GLSL_NUBI = /* glsl */ `
uniform vec4 uNubiA[${MAXN}], uNubiB[${MAXN}];
uniform int uNubiN;
uniform float uPioggiaR, uQuota;
float nubeD2(vec4 a, vec4 b, vec2 p) { vec2 e = p - a.xy; vec2 q = vec2(dot(e, a.zw) * b.x, (e.y * a.z - e.x * a.w) * b.y); return dot(q, q); }
float pioggiaIn(vec2 p) {
  float r = 0.0;
  for (int i = 0; i < ${MAXN}; i++) { if (i >= uNubiN) break; vec4 b = uNubiB[i]; if (b.w > r && nubeD2(uNubiA[i], b, p) < uPioggiaR * uPioggiaR) r = b.w; }
  return r;
}`;

// ---------- pioggia ----------
/** Gocce vicine (a k = 1, nel cubo attorno a chi gioca) e gocce per nuvola (le tende). Trattini da 2 vertici: una draw call. */
export const GOCCE = 1400, TENDA = 90;
const BOX = 44, LUNGA = 0.55, LUNGA_TENDA = 1.4, VEL = 16;

const VERT = /* glsl */ `
attribute vec4 aSeme; // x, z (0..1), fase di caduta, 0 = testa / 1 = coda
attribute float aSlot; // -1 = goccia vicina; ≥ 0 = goccia della tenda della nuvola numero aSlot
uniform float uTime; uniform vec2 uCenter; uniform float uWind; uniform float uVicine;
${GLSL_NUBI}
varying float vTono;
void main() {
  float lunga, y, tieni;
  vec2 xz;
  if (aSlot < 0.0) {
    xz = uCenter + (fract(aSeme.xy - uCenter / ${BOX.toFixed(1)}) - 0.5) * ${BOX.toFixed(1)};
    y = uQuota * (1.0 - fract(uTime * ${VEL.toFixed(1)} / uQuota + aSeme.z));
    lunga = ${LUNGA.toFixed(2)};
    // tante gocce quanto piove lì (a gradini come la nuvola): fuori dalla nuvola niente
    tieni = step(fract(aSeme.z * 7.31 + aSeme.x * 3.7), min(pioggiaIn(xz), uVicine));
  } else {
    int i = int(aSlot);
    vec4 a = uNubiA[i], b = uNubiB[i];
    float r = sqrt(aSeme.x) * uPioggiaR, an = 6.2831853 * aSeme.y;
    vec2 d = vec2(cos(an), sin(an)) * r / b.xy;
    xz = a.xy + d.x * a.zw + d.y * vec2(-a.w, a.z);
    y = uQuota * (1.0 - fract(uTime * ${VEL.toFixed(1)} / uQuota + aSeme.z));
    lunga = ${LUNGA_TENDA.toFixed(2)};
    tieni = (i < uNubiN ? 1.0 : 0.0) * step(fract(aSeme.z * 5.17), b.w);
  }
  if (tieni < 0.5) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); vTono = 0.0; return; } // fuori dallo schermo: niente pixel
  float coda = aSeme.w * lunga;
  vec3 w = vec3(xz.x - coda * uWind, y + coda, xz.y - coda * uWind * 0.4);
  vTono = step(0.6, fract(aSeme.z * 13.0));
  gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
}`;
const FRAG = /* glsl */ `
uniform vec3 cA; uniform vec3 cB;
varying float vTono;
void main() { gl_FragColor = vec4(vTono > 0.5 ? cB : cA, 1.0);
  #include <colorspace_fragment>
}`;

export type Pioggia = {
  object: THREE.LineSegments;
  /** `vicine` 0..1 = quanto piove dove sei (per contare le gocce dei test); `notte` 0..1; `vento` 0..1. */
  set(vicine: number, notte: number, vento: number): void;
  update(t: number, x: number, z: number): void;
  /** Gocce vicine che cadono adesso (stima: quante ne passano il filtro della nuvola dove sei). */
  readonly gocce: number;
};

export function createPioggia(): Pioggia {
  const N = GOCCE + MAXN * TENDA;
  const pos = new Float32Array(N * 2 * 3), seme = new Float32Array(N * 2 * 4), slot = new Float32Array(N * 2);
  let s = 85;
  const r = () => ((s = (Math.imul(s, 1103515245) + 12345) >>> 0) / 4294967296); // sequenza fissa: la stessa pioggia per tutti
  for (let i = 0; i < N; i++) {
    const x = r(), z = r(), f = r(), sl = i < GOCCE ? -1 : Math.floor((i - GOCCE) / TENDA);
    for (let e = 0; e < 2; e++) { seme.set([x, z, f, e], (i * 2 + e) * 4); slot[i * 2 + e] = sl; }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aSeme', new THREE.BufferAttribute(seme, 4));
  geo.setAttribute('aSlot', new THREE.BufferAttribute(slot, 1));
  const U = { ...NUBI, uTime: { value: 0 }, uCenter: { value: new THREE.Vector2() }, uWind: { value: 0.25 }, uVicine: { value: 1 }, cA: { value: new THREE.Color('#E8E1D6') }, cB: { value: new THREE.Color('#7FE3E0') } };
  // niente scrittura di profondità: la passata finale non ci disegna i contorni attorno (sarebbero viola) né le ombre
  const mat = new THREE.ShaderMaterial({ uniforms: U, vertexShader: VERT, fragmentShader: FRAG, fog: false, lights: false, depthWrite: false });
  mat.name = 'pioggia';
  const object = new THREE.LineSegments(geo, mat);
  object.name = 'pioggia'; object.frustumCulled = false; object.visible = false;
  let qui = 0;
  return {
    object,
    get gocce() { return object.visible ? Math.round(GOCCE * qui) : 0; },
    set(vicine, notte, vento) {
      qui = Math.max(0, Math.min(1, vicine));
      // pietra chiara e acqua bassa; di notte scure come il resto
      const d = 1 - 0.6 * notte;
      U.cA.value.set('#E8E1D6').multiplyScalar(d); U.cB.value.set('#7FE3E0').multiplyScalar(d);
      U.uWind.value = 0.25 + 0.6 * vento;
    },
    update(t, x, z) { U.uTime.value = t % 3600; U.uCenter.value.set(x, z); },
  };
}
