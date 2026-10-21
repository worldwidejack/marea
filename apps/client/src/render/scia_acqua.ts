// Scia delle barche disegnata DENTRO l'acqua (water2.ts): non sprite appoggiati sopra, ma le stesse righe d'onda e la stessa schiuma
// del mare, a 8 texel/m, coi colori del mare. Ogni barca che si muove scrive la strada fatta dalla prua (fino a N punti, game/scia.ts)
// in una riga di una piccola texture float; lo shader, per i pixel vicini, trova il punto della strada più vicino e da lì sa quanto è
// indietro (s) e quanto è di lato (lat).
// La scia è una goccia, come una barca vera vista dall'alto: dalla punta della prua i due bracci si aprono all'angolo di Kelvin (~20°),
// poi il risucchio li richiude e a metà strada si uniscono alla strada liscia della coda, che arriva a SCIA_LUNGA metri. Tutta la goccia
// cancella il mare: dentro le sue righe d'onda non ci sono, restano solo quelle della scia (bracci, piume, schiuma di poppa, bordi
// sfrangiati della coda). Appena fuori il mare è spinto di lato (sciaSpinta) e le sue righe si ammucchiano contro il bordo.
// Le righe sono in coordinate della scia: seguono le curve della barca. Le onde dei bracci si spengono in SCIA_VITA_V secondi, la goccia
// in SCIA_VITA: il mare si richiude piano, a chiazze, dalla coda. Una barca ferma da un po' non ha più punti: niente scia.
import * as THREE from 'three';

export const SCIA_PUNTI = 32, SCIA_BARCHE = 4;
/** Secondi di vita di un punto della strada (la strada liscia), e delle onde a V. */
export const SCIA_VITA = 12, SCIA_VITA_V = 6;
/** Metri di strada che la scia si ricorda dietro la prua. */
export const SCIA_LUNGA = 35;
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

/** GLSL, in tre pezzi chiamati da water2: `sciaTrova` (una volta per pixel: la scia più forte lì), `sciaSpinta` (di quanto spostare
 *  il punto dove si legge il campo d'onde del mare) e `sciaColore` (la goccia che cancella il mare, con le righe e la schiuma della scia).
 *  Serve vnoise e uTime. */
export const GLSL_SCIA = /* glsl */ `
uniform sampler2D tScia;
uniform vec4 uSciaN;
const float SCIA_POPPA = 3.7; // m dalla prua alla poppa
const float SCIA_GOCCIA = 20.0; // m dalla prua a dove i bracci, richiusi dal risucchio, si uniscono alla strada della coda
vec4 sciaPunto(int b, int i) { return texture2D(tScia, vec2((float(i) + 0.5) / ${SCIA_PUNTI.toFixed(1)}, (float(b) + 0.5) / ${SCIA_BARCHE.toFixed(1)})); }
// La scia più forte che passa da q. Ridà e = forza della goccia (0 = niente scia; sbiadisce con l'età e verso la fine della coda) e,
// nel punto della strada più vicino: s = metri dietro la prua, lat = metri di lato, la forza, l'età (s) e il versore verso fuori.
float sciaTrova(vec2 q, out float s, out float lat, out float forza, out float eta, out vec2 fuori) {
  float eMax = 0.0; s = 0.0; lat = 0.0; forza = 0.0; eta = 0.0; fuori = vec2(0.0);
  for (int b = 0; b < ${SCIA_BARCHE}; b++) {
    float n = b == 0 ? uSciaN.x : b == 1 ? uSciaN.y : b == 2 ? uSciaN.z : uSciaN.w;
    if (n < 2.0) continue;
    vec4 p0 = sciaPunto(b, 0);
    if (distance(q, p0.xy) > ${(SCIA_LUNGA + 8).toFixed(1)}) continue;
    float best = 1e9, bs = 0.0, be = 0.0, bf = 0.0, acc = 0.0;
    vec2 bo = vec2(0.0);
    vec4 a = p0;
    for (int i = 1; i < ${SCIA_PUNTI}; i++) {
      if (float(i) >= n) break;
      vec4 bb = sciaPunto(b, i);
      vec2 ab = bb.xy - a.xy; float L = length(ab);
      if (L > 0.001) {
        vec2 dir = ab / L, ap = q - a.xy;
        float h = dot(ap, dir), hc = clamp(h, 0.0, L);
        vec2 lato = ap - dir * hc; float dl = length(lato);
        if (dl < best && (i > 1 || h > -0.2)) {
          best = dl; bs = acc + hc; float k = hc / L; be = mix(a.z, bb.z, k); bf = mix(a.w, bb.w, k);
          bo = dl > 0.001 ? lato / dl : vec2(-dir.y, dir.x);
        }
        acc += L;
      }
      a = bb;
    }
    if (best > 9.0) continue;
    float e = bf * clamp(1.0 - be / ${SCIA_VITA.toFixed(1)}, 0.0, 1.0) * (1.0 - smoothstep(${(SCIA_LUNGA * 0.7).toFixed(1)}, ${SCIA_LUNGA.toFixed(1)}, bs));
    if (e > eMax) { eMax = e; s = bs; lat = best; forza = bf; eta = be; fuori = bo; }
  }
  return eMax < 0.03 ? 0.0 : eMax;
}
// Mezza larghezza (m) della goccia a s metri dalla prua: la strada della coda (poco più della barca, si allarga piano) più la pancia
// dei bracci, che parte dalla punta con la pendenza di Kelvin, è larga a metà goccia e si richiude in SCIA_GOCCIA.
float sciaLarga(float s, float forza) {
  float coda = 0.75 + 0.35 * forza + max(s - SCIA_POPPA, 0.0) * 0.03;
  float pancia = (0.9 + 1.6 * forza) * sin(3.14159 * clamp(s / SCIA_GOCCIA, 0.0, 1.0));
  return mix(0.5, coda, smoothstep(0.0, SCIA_POPPA, s)) + pancia;
}
// Quanto (m, verso fuori) la barca ha spinto il mare in q: dentro la goccia non conta (il mare lì è cancellato), appena fuori cade in
// fretta: le righe del mare si ammucchiano contro il bordo. Il mare si legge in q - fuori * spinta.
float sciaSpinta(float s, float lat, float e, float forza) {
  if (e <= 0.0) return 0.0;
  float W = sciaLarga(s, forza), amp = min(0.6 * W, 2.4) * e * clamp(s / 0.6, 0.0, 1.0);
  return amp * smoothstep(0.0, W, lat) * (1.0 - smoothstep(W, W + 0.8 + 0.05 * s, lat));
}
// Il colore del pixel q (m, già quantizzato) con la scia sopra. c0 = l'acqua senza righe, quella dentro la goccia.
vec3 sciaColore(vec2 q, vec3 c, vec3 c0, vec3 foam, vec3 line, float e, float s, float lat, float forza, float eta) {
  if (e <= 0.0) return c;
  float t = uTime, ev = forza * clamp(1.0 - eta / ${SCIA_VITA_V.toFixed(1)}, 0.0, 1.0); // ev: forza delle onde dei bracci, che si spengono prima
  float W = sciaLarga(s, forza), r = lat / W;
  // la goccia cancella il mare; quando è vecchia il mare torna a chiazze, prima sul bordo
  if (lat < W && vnoise(q * 0.7 + 4.0) < 1.9 * e + 0.15 - 0.6 * r * r) c = c0;
  // bordo della goccia: i bracci (righe piene, schiuma alla punta) che man mano si sfrangiano nei bordi della coda
  float spess = 0.08 + 0.004 * s, rotto = vnoise(vec2(s * 0.7, lat * 0.4) + vec2(t * 0.25, 0.0)), vivo = ev * 1.6 - s / 30.0;
  float sfrangia = vnoise(q * 2.3 + vec2(7.0, t * 0.3));
  if (s > 0.25 && abs(lat - W) < spess && (rotto < vivo || (s > SCIA_POPPA && sfrangia > 0.62 - 0.35 * e)))
    c = (s < 1.4 && ev > 0.4) || (s > SCIA_POPPA && s < 10.0 + 10.0 * e && sfrangia > 0.8 - 0.3 * e) ? foam : line;
  // piume: creste oblique nella pancia, vicino ai bracci
  else if (r < 1.0 && r > 0.6 && s > 2.0 && s < SCIA_GOCCIA * 0.8 && fract((s * 0.9 - lat * 0.7) / 1.3) < 0.1 && rotto < vivo - 0.15) c = line;
  // baffi di prua
  if (s < 1.2 && abs(lat - (0.55 + s * 0.3)) < 0.12 && ev > 0.35) c = foam;
  // schiuma di poppa: banda che si allarga e si sbriciola, schiuma vicino alla barca, poi righe d'onda
  float ss = s - SCIA_POPPA, larga = 0.4 + 0.5 * forza + max(ss, 0.0) * 0.06;
  if (ss > -0.3 && lat < larga) {
    float tur = vnoise(q * 1.7 + vec2(t * 0.8, -t * 0.5)) * 0.6 + vnoise(q * 4.1 - vec2(t, t * 0.7)) * 0.4;
    float bordo = lat / larga, soglia = 0.12 + max(ss, 0.0) / (4.0 + 24.0 * ev) + 0.3 * bordo * bordo;
    if (tur > soglia) c = (ss < 2.0 + 7.0 * ev && tur > soglia + 0.1) ? foam : line;
  }
  return c;
}`;
