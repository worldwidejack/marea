// La luce del Grande Faro (game/porto_amici.ts) come quella di un faro vero, disegnata nello stile del mondo.
// - Ottica che gira: due pannelli opposti, un giro ogni GIRO s in senso orario, quindi un lampo ogni 5 s (carattere «Lampo bianco 5 s»).
//   La fase viene dall'orologio (Date.now): tutti vedono il faro nello stesso punto del giro.
// - Si accende al tramonto e si spegne all'alba (come la fotocellula dei fari), la lampada scalda in un paio di secondi.
// - Fasci: coni stretti (3° di lato, 4° in alto e in basso) che partono larghi quanto la lente. Si vedono perché la luce rimbalza
//   sull'aria (diffusione in avanti, Henyey-Greenstein): di lato sono fili tenui, verso di te molto più forti; si spengono piano con la
//   distanza (più in fretta con la pioggia, che però li fa vedere di più). Lo shader calcola quanto fascio attraversa ogni raggio di vista
//   e lo mette a gradini (niente sfumature lisce: ART_BIBLE).
// - Lampo: quando un fascio passa su di te, la lanterna si accende in una stella a pixel per un attimo (~0,2 s), grande uguale sullo schermo.
// - Mare (dentro water2.ts, come la scia della luna): il riflesso della lanterna a trattini orizzontali, ambra/giallo/crema, che si
//   accende quando il fascio ti guarda; lontano, dove il cono scende fino all'acqua (oltre ~70 m), trattini di luce sulle righe d'onda.
import * as THREE from 'three';
import { PALETTE as P } from './palette.ts';

/** Aspetto, non numeri di gioco. GIRO: secondi per giro; TAN: tangente della mezza apertura del fascio (di lato, in alto/basso);
 *  LUNGO: fin dove arriva il cono (m); SPEGNE: metri in cui la luce diffusa cala di e (sereno). */
const FARO_LUCE = { giro: 10, tanLato: 0.052, tanSu: 0.07, lungo: 240, spegne: 75 } as const;

/** Uniform condivisi con l'acqua: lanterna (x, z, quota, accesa 0-1), fascio (direzione x, z, buio 0-1, pioggia 0-1), colori del riflesso. */
export const FARO_ACQUA = {
  uFaro: { value: new THREE.Vector4(0, 0, 5, 0) }, uFaroFascio: { value: new THREE.Vector4(0, -1, 0, 0) },
  uFaroR0: { value: 0.4 },
  // riflesso della lanterna: crema, giallo, ambra (palette della stampa di notte, come la luna ma calda)
  uFaroA: { value: new THREE.Color('#f2e6c4') }, uFaroB: { value: new THREE.Color('#f5d547') }, uFaroC: { value: new THREE.Color('#e9a23b') },
};

/** GLSL per water2: `faroAcqua(q, c, t)` ridà il colore del pixel d'acqua q (m, quantizzato) con la luce del faro. */
export const GLSL_FARO = /* glsl */ `
float hash(vec2 p);
float vnoise(vec2 p);
uniform vec4 uFaro, uFaroFascio;
uniform vec3 uFaroA, uFaroB, uFaroC;
uniform float uFaroR0;
const vec2 FARO_TAN = vec2(${FARO_LUCE.tanLato}, ${FARO_LUCE.tanSu});
/** Quanta luce dei due fasci opposti va nella direzione orizzontale d (versore), 0-1: il profilo del fascio di lato. */
float faroVerso(vec2 d) {
  float co = abs(dot(d, uFaroFascio.xy)), si = abs(d.x * uFaroFascio.y - d.y * uFaroFascio.x);
  float a = atan(si, co) / FARO_TAN.x;
  return exp(-a * a);
}
vec3 faroAcqua(vec2 q, vec3 c, float t) {
  if (uFaro.w < 0.01) return c;
  vec2 rel = q - uFaro.xy;
  float r = length(rel), H = uFaro.z;
  if (r < 1.0) return c;
  // 1) dove il cono tocca il mare: sezione ellittica larga R0 + d·tan, il pelo dell'acqua sta H sotto l'asse
  float al = abs(dot(rel, uFaroFascio.xy)), lat = abs(rel.x * uFaroFascio.y - rel.y * uFaroFascio.x);
  float ah = uFaroR0 + al * FARO_TAN.x, av = uFaroR0 + al * FARO_TAN.y;
  float m = (lat * lat) / (ah * ah) + (H * H) / (av * av);
  float k = m < 1.0 ? (1.0 - m) * min(1.0, 95.0 / al) * min(1.0, 95.0 / al) : 0.0;
  k *= uFaro.w * (1.0 - 0.5 * uFaroFascio.w);
  if (k > 0.04) {
    float g = k > 0.4 ? 3.0 : k > 0.15 ? 2.0 : 1.0; // a gradini: tre forze di luce
    float w = vnoise(q * vec2(0.11, 0.17) + vec2(t * 0.05, t * 0.02)) * 0.65 + vnoise(q * 0.33 + vec2(-t * 0.04, t * 0.03)) * 0.35;
    float l = fract(w * 6.0);
    if (g > 1.0 && l < 0.03 && hash(floor(q * 2.0) + floor(t * 3.0)) > 0.5) c = g > 2.0 ? uFaroB : uFaroC; // trattini di luce sulle righe d'onda
  }
  // 2) il riflesso della lanterna, come la scia della luna (water2.ts): un'onda ti manda la lanterna solo se ha la pendenza giusta (mezzo
  // vettore tra camera e lanterna, che qui è vicina: cambia da onda a onda). Trattini orizzontali a gradini ambra, giallo, crema; la
  // lanterna manda poca luce di lato (la lampada dietro la lente) e tantissima nel fascio: la colonna si accende quando il fascio ti guarda.
  vec3 P3 = vec3(q.x, 0.0, q.y), L = normalize(vec3(uFaro.x, H, uFaro.y) - P3), V = normalize(cameraPosition - P3), Hv = normalize(V + L);
  vec2 md = normalize(L.xz), mb = vec2(-md.y, md.x);
  vec2 z = vec2(dot(Hv.xz, md), dot(Hv.xz, mb)) / Hv.y / vec2(0.2, 0.12);
  float Pw = exp(-0.5 * dot(z, z));
  if (Pw < 0.01) return c;
  // quanta luce parte dalla lanterna verso q: profilo del fascio di lato × apertura in alto/basso (q è sotto l'asse di H/r), più il chiarore
  float giu = H / r / FARO_TAN.y, E = 0.15 + 1.1 * faroVerso(-md) * exp(-giu * giu);
  E *= uFaro.w * (0.4 + 0.6 * uFaroFascio.z);
  float dist = length(q - cameraPosition.xz), cell = 0.125 * exp2(floor(log2(max(1.0, dist / 30.0))));
  vec2 p = vec2(dot(q, md), dot(q, mb));
  p.y += hash(vec2(floor(p.x / cell), 5.0)) * cell * 6.0; // righe sfalsate: trattini a mattoncino
  vec2 kc = floor(p / vec2(cell, cell * 6.0)), pc = (kc + 0.5) * vec2(cell, cell * 6.0);
  float rr = 0.6 * vnoise(pc * vec2(1.6, 0.3) + vec2(t * 1.3, 0.0)) + 0.4 * vnoise(pc * vec2(3.7, 0.55) + vec2(-t * 1.9, 7.0));
  rr += (hash(kc + floor(t * 2.0) * 0.17) - 0.5) * 0.3;
  float kk = Pw * E * (1.7 * rr - 0.3), sp = hash(floor(pc / cell) + floor(t * 4.0));
  if (kk > 0.9) return uFaroA;
  if (kk > 0.55) return sp > 0.5 ? uFaroA : uFaroB;
  if (kk > 0.3) return sp > 0.3 ? uFaroB : uFaroC;
  if (kk > 0.16 && sp > 0.4) return uFaroC;
  return c;
}`;

const VERT = /* glsl */ `
varying vec3 vW;
void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
// un fascio: il raggio di vista incontra l'asse del cono; quanto ci passa vicino (rispetto alla larghezza lì) = quanta luce attraversa
const FRAG = /* glsl */ `
uniform vec3 uO, uD, uCol, uCuore;
uniform vec2 uTan;
uniform float uR0, uK, uSpegne, uLungo;
varying vec3 vW;
void main() {
  vec3 R = normalize(vW - cameraPosition), w0 = cameraPosition - uO;
  float b = dot(R, uD), d = dot(R, w0), e = dot(uD, w0), den = max(1.0 - b * b, 1e-4);
  float s = (b * e - d) / den, t = clamp((e - b * d) / den, 0.0, uLungo);
  if (s < 0.0) discard;
  vec3 off = cameraPosition + R * max(s, 0.0) - (uO + uD * t);
  vec3 lato = normalize(vec3(-uD.z, 0.0, uD.x));
  float rh = uR0 + t * uTan.x, rv = uR0 + t * uTan.y;
  float h = dot(off, lato) / rh, v = off.y / rv, m2 = h * h + v * v;
  if (m2 >= 1.0) discard;
  // spessore attraversato (più lungo guardando lungo il fascio) × luce per m² (cala come 1/sezione: l'occhio la sente meno, radice)
  // × diffusione verso la camera × aria che la spegne
  float corda = sqrt(1.0 - m2), sez = sqrt(uR0 / rh);
  float g = 0.55, ct = dot(uD, -R), hg = (1.0 - g * g) / pow(1.0 + g * g - 2.0 * g * ct, 1.5) / 0.47;
  // l'aria attorno alla camera non si dipinge: dentro il fascio resta il lampo della lanterna, non un velo su tutto lo schermo
  // e visto di fronte il fascio è la stella del lampo (sprite), non un disco
  float vicino = clamp((s - 12.0) / 30.0, 0.0, 1.0) * clamp((1.0 - abs(b)) * 12.0, 0.0, 1.0);
  float I = uK * corda * sez * min(hg, 2.2) * exp(-t / uSpegne) * min(1.0, t / 0.6) * vicino;
  // a gradini: niente sfumature lisce; il gradino più forte è il cuore del fascio, più caldo
  float a = I > 1.4 ? 0.45 : I > 0.7 ? 0.22 : I > 0.3 ? 0.1 : 0.0;
  if (a <= 0.0) discard;
  gl_FragColor = vec4(I > 1.6 ? uCuore : uCol, a);
  #include <colorspace_fragment>
}`;

/** Il cono di un fascio lungo +X da x = 0 (lente, sezione r0) a x = LUNGO, sezione ellittica: aperto ai lati, poligoni a basso numero. */
function cono(r0: number): THREE.BufferGeometry {
  const N = 10, L = FARO_LUCE.lungo, pos: number[] = [], idx: number[] = [];
  for (const x of [0, L]) for (let j = 0; j < N; j++) {
    const a = (j / N) * Math.PI * 2, k = 1.1; // un filo più largo del fascio vero: lo shader taglia il resto
    pos.push(x, (r0 + x * FARO_LUCE.tanSu) * k * Math.sin(a), (r0 + x * FARO_LUCE.tanLato) * k * Math.cos(a));
  }
  for (let j = 0; j < N; j++) { const a = j, b2 = (j + 1) % N, c = N + j, d = N + ((j + 1) % N); idx.push(a, c, b2, b2, c, d); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
  return g;
}

/** Stella a pixel del lampo (16×16, nearest): centro chiaro, croce lunga, diagonali corte, coi colori della palette. */
function stella(): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = c.height = 16;
  const x = c.getContext('2d');
  if (x) {
    const px = (col: string, a: number, b: number, w = 1, h = 1) => { x.fillStyle = col; x.fillRect(a, b, w, h); };
    px(P.giallo, 7, 0, 2, 16); px(P.giallo, 0, 7, 16, 2); // croce
    for (let i = 3; i < 6; i++) { px(P.arancio, i, i); px(P.arancio, 15 - i, i); px(P.arancio, i, 15 - i); px(P.arancio, 15 - i, 15 - i); }
    px(P.sabbiaChiara, 5, 5, 6, 6); px(P.sabbiaChiara, 4, 6, 8, 4); px(P.sabbiaChiara, 6, 4, 4, 8); px(P.pietraChiara, 6, 6, 4, 4);
  }
  const t = new THREE.CanvasTexture(c); t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export type FaroLuce = {
  readonly group: THREE.Group;
  /** Ogni frame: `buio` 0-1 (ciclo: 0 giorno, 0,35 tramonto, 1 notte), `pioggia` 0-1 dove sei, la camera per il lampo. */
  update(nowMs: number, dt: number, buio: number, pioggia: number, camera: THREE.Camera): void;
  readonly accesa: boolean;
  /** 0-1: quanto il lampo punta verso la camera adesso (test). */
  readonly lampo: number;
  /** Angolo del fascio (rad, da nord in senso orario). */
  readonly angolo: number;
  /** Test e screenshot: fascio fermo a quell'angolo (rad); null = l'orologio. */
  ferma(angolo: number | null): void;
};

/** La luce del faro con la lanterna in (x, y, z) mondo e la lente larga r0 (m). */
export function createFaroLuce(o: { x: number; y: number; z: number; r0: number }): FaroLuce {
  const group = new THREE.Group(); group.name = 'faro_luce'; group.visible = false;
  const O = new THREE.Vector3(o.x, o.y, o.z), geo = cono(o.r0);
  const fasci = [1, -1].map((verso) => {
    const U = {
      uO: { value: O }, uD: { value: new THREE.Vector3(0, 0, -verso) }, uCol: { value: new THREE.Color(P.sabbiaChiara) }, uCuore: { value: new THREE.Color(P.giallo) },
      uTan: { value: new THREE.Vector2(FARO_LUCE.tanLato, FARO_LUCE.tanSu) }, uR0: { value: o.r0 }, uK: { value: 0 },
      uSpegne: { value: FARO_LUCE.spegne as number }, uLungo: { value: FARO_LUCE.lungo },
    };
    const mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: U, transparent: true, depthWrite: false,
      side: THREE.BackSide, blending: THREE.AdditiveBlending });
    const mesh = new THREE.Mesh(geo, mat); mesh.name = 'faro_fascio'; mesh.position.copy(O); mesh.frustumCulled = false;
    group.add(mesh);
    return { verso, mesh, U };
  });
  const stellaMat = new THREE.SpriteMaterial({ map: stella(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
  const lampoS = new THREE.Sprite(stellaMat); lampoS.name = 'faro_lampo'; group.add(lampoS);
  FARO_ACQUA.uFaro.value.set(o.x, o.z, o.y, 0); FARO_ACQUA.uFaroR0.value = o.r0;

  let acc = 0, lampo = 0, angolo = 0, fermo: number | null = null;
  const cam = new THREE.Vector3(), dir = new THREE.Vector3();
  return {
    group,
    get accesa() { return acc > 0.02; },
    get lampo() { return lampo; },
    get angolo() { return angolo; },
    ferma(a) { fermo = a; },
    update(nowMs, dt, buio, pioggia, camera) {
      // la fotocellula: acceso dal tramonto all'alba; la lampada scalda e si spegne in un paio di secondi
      const vuole = buio >= 0.3 ? 1 : 0;
      acc += Math.sign(vuole - acc) * Math.min(Math.abs(vuole - acc), dt * 0.6);
      group.visible = acc > 0.02;
      FARO_ACQUA.uFaro.value.w = acc;
      if (!group.visible) { lampo = 0; return; }
      const giro = FARO_LUCE.giro * 1000;
      angolo = fermo ?? ((nowMs % giro) / giro) * Math.PI * 2;
      const dx = Math.sin(angolo), dz = -Math.cos(angolo);
      const vis = Math.min(1, Math.max(0, (buio - 0.2) / 0.8)); // i fasci nell'aria si vedono solo col buio
      for (const f of fasci) {
        f.U.uD.value.set(dx * f.verso, 0, dz * f.verso);
        f.mesh.rotation.y = Math.atan2(-dz * f.verso, dx * f.verso); // il cono è lungo +X
        f.U.uK.value = acc * vis * (1 + 1.2 * pioggia);
        f.U.uSpegne.value = FARO_LUCE.spegne / (1 + 1.5 * pioggia);
      }
      FARO_ACQUA.uFaroFascio.value.set(dx, dz, vis, pioggia);
      // lampo: quanto uno dei due fasci punta (di lato) verso la camera
      camera.getWorldPosition(cam);
      dir.set(cam.x - O.x, 0, cam.z - O.z);
      const dist = dir.length() || 1;
      const co = Math.abs((dir.x * dx + dir.z * dz) / dist), si = Math.abs((dir.x * dz - dir.z * dx) / dist);
      const a = Math.atan2(si, co) / (FARO_LUCE.tanLato * 1.3);
      lampo = Math.exp(-a * a) * acc;
      // la stella: piccola sempre (la lampada dietro la lente), grande nel lampo; un passo più vicina alla camera per non finire nel vetro
      const s = Math.max(0.5, (0.012 + 0.05 * lampo) * Math.hypot(dist, cam.y - O.y)); // grande uguale sullo schermo, vicino o lontano
      lampoS.scale.set(s, s, 1);
      lampoS.position.copy(O).addScaledVector(dir.set(cam.x - O.x, cam.y - O.y, cam.z - O.z).normalize(), 0.9);
      stellaMat.opacity = Math.min(1, 0.35 + lampo) * acc;
    },
  };
}
