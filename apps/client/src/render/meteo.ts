// Meteo (#85), la resa: cosa cambia nella luce, nel cielo, nell'acqua e nella foschia per ogni stato, e la pioggia.
// Lo stato e l'intensità (a gradini) li decide la sim (`meteoAt` in @marea/sim/meteo.ts) dall'orologio: uguale per tutti.
// Colori di arrivo dalla palette (pietre e rocce); di notte gli stessi grigi scuriti, così la pioggia di notte resta notte.
// Pioggia: un solo LineSegments (1 draw call), trattini di 1 pixel che cadono nello shader (niente lavoro della CPU per goccia),
// ancorati al mondo e ripiegati in un cubo attorno a chi gioca. I cerchi sull'acqua li fa lo shader dell'acqua (water.ts).
import * as THREE from 'three';
import type { MeteoStato } from '@marea/content';
import type { Momento } from './ciclo.ts';

const ca = new THREE.Color(), cb = new THREE.Color();
/** a → b di k; b scurito di notte (n 0..1) così i grigi del meteo non schiariscono il buio. */
const verso = (a: string, b: string, k: number, n: number) => '#' + ca.set(a).lerp(cb.set(b).multiplyScalar(1 - 0.72 * n), k).getHexString();
const mixHex = (a: string, b: string, k: number) => '#' + ca.set(a).lerp(cb.set(b), k).getHexString();

/** Quanto pesa ogni stato su luce, cielo e acqua (0..1) e i grigi della palette verso cui va. */
type Peso = { sole: number; ambiente: number; grigio: string; cielo: [string, string, string, string]; alto: [string, string, string]; nuvole: [string, string]; nebbia: string; acqua: number; copertura: number; cieloK: number };
const PESI: Record<Exclude<MeteoStato, 'sereno'>, Peso> = {
  // nuvoloso: luce piatta (sole debole, più cielo), ombre leggere
  nuvoloso: { sole: 0.62, ambiente: -0.04, grigio: '#E8E1D6', cielo: ['#B9AFA3', '#E8E1D6', '#E8E1D6', '#B9AFA3'], alto: ['#7F7568', '#B9AFA3', '#E8E1D6'], nuvole: ['#E8E1D6', '#B9AFA3'], nebbia: '#B9AFA3', acqua: 0.22, copertura: 0.65, cieloK: 0.55 },
  // pioggia: luce grigia e bassa, acqua più scura
  pioggia: { sole: 0.75, ambiente: -0.18, grigio: '#B9AFA3', cielo: ['#7F7568', '#B9AFA3', '#B9AFA3', '#7F7568'], alto: ['#4A4340', '#7F7568', '#B9AFA3'], nuvole: ['#B9AFA3', '#7F7568'], nebbia: '#7F7568', acqua: 0.5, copertura: 1, cieloK: 0.75 },
  // nebbia: luce lattiginosa, la foschia fa il resto
  nebbia: { sole: 0.55, ambiente: 0.05, grigio: '#E8E1D6', cielo: ['#E8E1D6', '#E8E1D6', '#E8E1D6', '#B9AFA3'], alto: ['#B9AFA3', '#E8E1D6', '#E8E1D6'], nuvole: ['#E8E1D6', '#E8E1D6'], nebbia: '#E8E1D6', acqua: 0.15, copertura: 0.85, cieloK: 0.8 },
  // vento: luce di sempre, qualche nuvola che corre; le onde le muove l'acqua
  vento: { sole: 0.08, ambiente: 0, grigio: '#F4E3C1', cielo: ['#7FE3E0', '#E8E1D6', '#E8E1D6', '#F2A33A'], alto: ['#3FB9C9', '#7FE3E0', '#E8E1D6'], nuvole: ['#F4E3C1', '#E8E1D6'], nebbia: '#E8E1D6', acqua: 0.06, copertura: 0.3, cieloK: 0.15 },
};
/** Acqua sotto la pioggia: verso l'abisso e la roccia (più scura, meno azzurra). */
const ACQUA_SCURA = { abisso: '#163F73', profonda: '#163F73', acqua: '#163F73', bassa: '#2478A8', schiuma: '#B9AFA3' };

/** Il momento della giornata `m` col tempo che fa (stato, intensità k 0..1). Sereno o k = 0: `m` così com'è. */
export function conMeteo(m: Momento, stato: MeteoStato, k: number): Momento {
  if (stato === 'sereno' || k <= 0) return m;
  const p = PESI[stato], n = m.notte, s = m.sun;
  const w = m.water, kw = p.acqua * k;
  return {
    ...m,
    sun: { ...s, intensity: s.intensity * (1 - p.sole * k), color: verso(s.color, p.grigio, 0.6 * k, n), sky: verso(s.sky, p.grigio, 0.45 * k, n), hemiI: s.hemiI * (1 + p.ambiente * k) },
    bands: m.bands.map((c, i) => verso(c, p.cielo[i]!, p.cieloK * k, n)) as Momento['bands'],
    sky3: m.sky3.map((c, i) => verso(c, p.alto[i]!, p.cieloK * k, n)) as Momento['sky3'],
    clouds: [verso(m.clouds[0], p.nuvole[0], 0.8 * k, n), verso(m.clouds[1], p.nuvole[1], 0.8 * k, n)],
    fog: verso(m.fog, p.nebbia, 0.7 * k, n),
    water: { abisso: mixHex(w.abisso, ACQUA_SCURA.abisso, kw), profonda: mixHex(w.profonda, ACQUA_SCURA.profonda, kw), acqua: mixHex(w.acqua, ACQUA_SCURA.acqua, kw), bassa: mixHex(w.bassa, ACQUA_SCURA.bassa, kw), schiuma: verso(w.schiuma, ACQUA_SCURA.schiuma, kw, n) },
    tint: verso(m.tint, p.grigio, 0.3 * k, n),
  };
}

/** Foschia della passata finale (quella di sempre: da 35 a 200 m, fino all'80%): la nebbia la porta a pochi metri, la pioggia un po'. */
export function foschiaMeteo(stato: MeteoStato, k: number): { near: number; far: number; max: number } {
  const f = stato === 'nebbia' ? { near: 8, far: 70, max: 0.84 } : stato === 'pioggia' ? { near: 16, far: 120, max: 0.8 } : null;
  if (!f || k <= 0) return { near: 35, far: 200, max: 0.8 };
  return { near: 35 + (f.near - 35) * k, far: 200 + (f.far - 200) * k, max: 0.8 + (f.max - 0.8) * k };
}
/** La nebbia ha bisogno della passata finale anche con la camera di sempre. */
export const serveFoschia = (stato: MeteoStato, k: number): boolean => (stato === 'nebbia' || stato === 'pioggia') && k > 0;
export const coperturaMeteo = (stato: MeteoStato, k: number): number => (stato === 'sereno' ? 0 : PESI[stato].copertura * k);

/** Gocce al massimo (a k = 1). Sono trattini da 2 vertici: pochi KB di attributi, una draw call. */
export const GOCCE = 1400;
const BOX = 44, ALTO = 20, LUNGA = 0.55, VEL = 16;

const VERT = /* glsl */ `
attribute vec4 aSeme; // x, z (0..1) nel cubo, fase di caduta, 0 = testa / 1 = coda
uniform float uTime; uniform vec2 uCenter; uniform float uWind;
varying float vTono;
void main() {
  vec2 xz = uCenter + (fract(aSeme.xy - uCenter / ${BOX.toFixed(1)}) - 0.5) * ${BOX.toFixed(1)};
  float y = ${ALTO.toFixed(1)} * (1.0 - fract(uTime * ${(VEL / ALTO).toFixed(4)} + aSeme.z));
  float coda = aSeme.w * ${LUNGA.toFixed(2)};
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

export type Pioggia = { object: THREE.LineSegments; set(k: number, notte: number, vento: number): void; update(t: number, x: number, z: number): void; readonly gocce: number };

export function createPioggia(): Pioggia {
  const pos = new Float32Array(GOCCE * 2 * 3), seme = new Float32Array(GOCCE * 2 * 4);
  let s = 85;
  const r = () => ((s = (Math.imul(s, 1103515245) + 12345) >>> 0) / 4294967296); // sequenza fissa: la stessa pioggia per tutti
  for (let i = 0; i < GOCCE; i++) {
    const x = r(), z = r(), f = r();
    for (let e = 0; e < 2; e++) seme.set([x, z, f, e], (i * 2 + e) * 4);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aSeme', new THREE.BufferAttribute(seme, 4));
  const U = { uTime: { value: 0 }, uCenter: { value: new THREE.Vector2() }, uWind: { value: 0.25 }, cA: { value: new THREE.Color('#E8E1D6') }, cB: { value: new THREE.Color('#7FE3E0') } };
  // niente scrittura di profondità: la passata finale non ci disegna i contorni attorno (sarebbero viola) né la foschia
  const mat = new THREE.ShaderMaterial({ uniforms: U, vertexShader: VERT, fragmentShader: FRAG, fog: false, lights: false, depthWrite: false });
  mat.name = 'pioggia';
  const object = new THREE.LineSegments(geo, mat);
  object.name = 'pioggia'; object.frustumCulled = false; object.visible = false;
  let n = 0;
  return {
    object,
    get gocce() { return object.visible ? n : 0; },
    set(k, notte, vento) {
      n = Math.round(GOCCE * Math.max(0, Math.min(1, k)));
      geo.setDrawRange(0, n * 2); object.visible = n > 0;
      // pietra chiara e acqua bassa; di notte scure come il resto
      const d = 1 - 0.6 * notte;
      U.cA.value.set('#E8E1D6').multiplyScalar(d); U.cB.value.set('#7FE3E0').multiplyScalar(d);
      U.uWind.value = 0.25 + 0.6 * vento;
    },
    update(t, x, z) { U.uTime.value = t % 3600; U.uCenter.value.set(x, z); },
  };
}
