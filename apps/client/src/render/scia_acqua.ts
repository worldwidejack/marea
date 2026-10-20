// Scia delle barche disegnata DENTRO l'acqua (water2.ts): non sprite appoggiati sopra, ma le stesse righe d'onda e la stessa schiuma
// del mare, a 8 texel/m, coi colori del mare. Ogni barca che si muove scrive la strada fatta dalla prua (fino a N punti, game/scia.ts)
// in una riga di una piccola texture float; lo shader, per i pixel vicini, trova il punto della strada più vicino e da lì sa quanto è
// indietro (s) e quanto è di lato (lat). Con s e lat disegna:
//  - i due bracci a V dell'onda di prua all'angolo di Kelvin (~20°), spezzati dal rumore, che sbiadiscono allontanandosi;
//  - le piume: creste corte e oblique dentro la V, vicino ai bracci;
//  - la schiuma rimestata dietro la poppa, che si allarga, si sbriciola e passa da schiuma a riga d'onda;
//  - i baffi di schiuma alla prua quando la barca corre.
// Le righe sono in coordinate della scia: seguono le curve della barca. Una barca ferma da un po' non ha più punti: niente scia.
import * as THREE from 'three';

export const SCIA_PUNTI = 32, SCIA_BARCHE = 4;
const BUF = new Float32Array(SCIA_PUNTI * SCIA_BARCHE * 4);
const TEX = new THREE.DataTexture(BUF, SCIA_PUNTI, SCIA_BARCHE, THREE.RGBAFormat, THREE.FloatType);
TEX.magFilter = TEX.minFilter = THREE.NearestFilter; TEX.generateMipmaps = false; TEX.needsUpdate = true;

/** Uniform condivisi con l'acqua: texture dei punti (x, z, età s, forza 0-1) e quanti punti ha ogni barca. */
export const SCIA = { tScia: { value: TEX }, uSciaN: { value: new THREE.Vector4() } };

const padroni: (object | null)[] = Array.from({ length: SCIA_BARCHE }, () => null);
const ultima = new Float64Array(SCIA_BARCHE);
const n = SCIA.uSciaN.value;
const setN = (b: number, v: number) => { if (b === 0) n.x = v; else if (b === 1) n.y = v; else if (b === 2) n.z = v; else n.w = v; };

/** La barca `chi` scrive i suoi punti (4 float l'uno, dalla prua indietro); `quanti` = 0 libera il posto. Oltre 4 barche in moto: niente scia. */
export function scriviScia(chi: object, punti: Float32Array, quanti: number): void {
  let b = padroni.indexOf(chi);
  if (quanti === 0) { if (b >= 0) { padroni[b] = null; setN(b, 0); } return; }
  if (b < 0) { b = padroni.indexOf(null); if (b < 0) return; padroni[b] = chi; }
  BUF.set(punti.subarray(0, quanti * 4), b * SCIA_PUNTI * 4);
  setN(b, quanti); ultima[b] = performance.now(); TEX.needsUpdate = true;
}

/** Ogni frame dall'acqua: una barca che non scrive più (nascosta, uscita) perde il posto, così la sua scia non resta lì ferma. */
export function tickScia(): void {
  const ora = performance.now();
  for (let b = 0; b < SCIA_BARCHE; b++) if (padroni[b] && ora - ultima[b]! > 400) { padroni[b] = null; setN(b, 0); }
}

/** GLSL: `sciaColore(q, c, uFoam, uLine)` ridà il colore del pixel q (m, già quantizzato) con la scia sopra. Serve vnoise e uTime. */
export const GLSL_SCIA = /* glsl */ `
uniform sampler2D tScia;
uniform vec4 uSciaN;
const float SCIA_POPPA = 3.7; // m dalla prua alla poppa
vec4 sciaPunto(int b, int i) { return texture2D(tScia, vec2((float(i) + 0.5) / ${SCIA_PUNTI.toFixed(1)}, (float(b) + 0.5) / ${SCIA_BARCHE.toFixed(1)})); }
vec3 sciaColore(vec2 q, vec3 c, vec3 foam, vec3 line) {
  for (int b = 0; b < ${SCIA_BARCHE}; b++) {
    float n = b == 0 ? uSciaN.x : b == 1 ? uSciaN.y : b == 2 ? uSciaN.z : uSciaN.w;
    if (n < 2.0) continue;
    vec4 p0 = sciaPunto(b, 0);
    if (distance(q, p0.xy) > 34.0) continue;
    // il punto della strada più vicino: s = metri dietro la prua, lat = metri di lato, età e forza lì
    float best = 1e9, s = 0.0, lat = 0.0, eta = 0.0, forza = 0.0, acc = 0.0;
    vec4 a = p0;
    for (int i = 1; i < ${SCIA_PUNTI}; i++) {
      if (float(i) >= n) break;
      vec4 bb = sciaPunto(b, i);
      vec2 ab = bb.xy - a.xy; float L = length(ab);
      if (L > 0.001) {
        vec2 dir = ab / L, ap = q - a.xy;
        float h = dot(ap, dir), hc = clamp(h, 0.0, L), dl = length(ap - dir * hc);
        if (dl < best && (i > 1 || h > -0.2)) { best = dl; s = acc + hc; lat = dl; float k = hc / L; eta = mix(a.z, bb.z, k); forza = mix(a.w, bb.w, k); }
        acc += L;
      }
      a = bb;
    }
    if (best > 14.0) continue;
    float e = forza * clamp(1.0 - eta / 6.0, 0.0, 1.0);
    if (e < 0.03) continue;
    float t = uTime;
    // bracci a V (Kelvin): partono larghi quanto la prua e si aprono di tan(19,5°) per metro
    float braccio = 0.55 + s * 0.36, spess = 0.08 + 0.006 * s;
    float rotto = vnoise(vec2(s * 0.7, lat * 0.4) + vec2(t * 0.25, 0.0));
    float vivo = e * 1.6 - s / 40.0;
    if (s > 0.25 && abs(lat - braccio) < spess && rotto < vivo) c = (s < 1.4 && e > 0.4) ? foam : line;
    // piume: creste oblique dentro la V, solo nella metà esterna
    else if (lat < braccio && lat > braccio * 0.55 && s > 2.0 && fract((s * 0.9 - lat * 0.7) / 1.3) < 0.1 && rotto < vivo - 0.15) c = line;
    // onde trasversali: archi larghi di traverso dietro la poppa, dentro la V
    else if (lat < braccio * 0.5 && s > SCIA_POPPA + 2.0 && fract(s / 2.4 + lat * lat * 0.03) < 0.07 && rotto < vivo - 0.3) c = line;
    // baffi di prua
    if (s < 1.2 && abs(lat - (0.55 + s * 0.3)) < 0.12 && e > 0.35) c = foam;
    // schiuma di poppa: banda che si allarga e si sbriciola, schiuma vicino alla barca, poi righe d'onda
    float ss = s - SCIA_POPPA, larga = 0.4 + 0.5 * forza + max(ss, 0.0) * 0.09;
    if (ss > -0.3 && lat < larga) {
      float tur = vnoise(q * 1.7 + vec2(t * 0.8, -t * 0.5)) * 0.6 + vnoise(q * 4.1 - vec2(t, t * 0.7)) * 0.4;
      float bordo = lat / larga, soglia = 0.12 + max(ss, 0.0) / (4.0 + 24.0 * e) + 0.3 * bordo * bordo;
      if (tur > soglia) c = (ss < 2.0 + 7.0 * e && tur > soglia + 0.1) ? foam : line;
    }
  }
  return c;
}`;
