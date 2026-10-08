// Forme degli animali (#67): geometria procedurale low-poly, colori della palette (ART_BIBLE §2), avanti = −Z, piedi a y = 0
// (in volo: corpo al centro). Ogni forma è una lista di triangoli con colore per vertice; i vertici col «canale» 1 o 2 prendono il
// mantello dell'esemplare (gatti, pesci), così una forma sola fa gatti di colori diversi. Le pose sono forme diverse (ala su/giù, gatto
// che dorme/si stiracchia/cammina): game/animali.ts le copia tutte in un'unica mesh per frame (una draw call per tutti gli animali).
import * as THREE from 'three';
import { P } from './island_parts.ts';
import { PAL } from '../ui/style.ts';

export type Forma = { pos: Float32Array; col: Float32Array; ch: Uint8Array; n: number };
/** Colore fisso (hex della palette) o canale del mantello: 1 = colore principale, 2 = secondario. */
type Tinta = string | 1 | 2;
type Pezzo = { g: THREE.BufferGeometry; c: Tinta; m: THREE.Matrix4 };

const E = new THREE.Euler(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), S = new THREE.Vector3(1, 1, 1);
/** Matrice: posizione, rotazione (XYZ) e scala. */
export const mat = (x: number, y: number, z: number, rx = 0, ry = 0, rz = 0, s = 1) =>
  new THREE.Matrix4().compose(V.set(x, y, z), Q.setFromEuler(E.set(rx, ry, rz)), S.set(s, s, s));
const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
/** Scatola appesa per la cima (perno in alto): zampe che ruotano attorno all'anca. */
const hang = (w: number, h: number, d: number) => box(w, h, d).translate(0, -h / 2, 0);
/** Scatola che parte dal perno verso +X (ali). */
const arm = (w: number, h: number, d: number) => box(w, h, d).translate(w / 2, 0, 0);
/** Scatola che parte dal perno verso +Z (code). */
const tailSeg = (w: number, h: number, d: number) => box(w, h, d).translate(0, 0, d / 2);
/** Specchio in X col verso dei triangoli raddrizzato (altrimenti il lato specchiato verrebbe scartato come retro). */
function mirrorX(g: THREE.BufferGeometry): THREE.BufferGeometry {
  g.scale(-1, 1, 1);
  const ix = g.index?.array;
  if (ix) for (let i = 0; i < ix.length; i += 3) { const t = ix[i]!; ix[i] = ix[i + 2]!; ix[i + 2] = t; }
  return g;
}

function forma(parti: Pezzo[]): Forma {
  let n = 0;
  const geos = parti.map((p) => { const g = (p.g.index ? p.g.toNonIndexed() : p.g).applyMatrix4(p.m); n += g.attributes.position!.count; return { g, c: p.c }; });
  const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), ch = new Uint8Array(n), c = new THREE.Color();
  let o = 0;
  for (const { g, c: tinta } of geos) {
    const a = g.attributes.position!.array as Float32Array, k = a.length / 3;
    pos.set(a, o * 3);
    if (typeof tinta === 'string') { c.set(tinta); for (let i = 0; i < k; i++) { col[(o + i) * 3] = c.r; col[(o + i) * 3 + 1] = c.g; col[(o + i) * 3 + 2] = c.b; } }
    else ch.fill(tinta, o, o + k);
    o += k; g.dispose();
  }
  return { pos, col, ch, n };
}
const pz = (g: THREE.BufferGeometry, c: Tinta, m: THREE.Matrix4): Pezzo => ({ g, c, m });

// ———— gabbiano: bianco, ali grigie lunghe e strette con le punte nere, becco giallo; apertura alare ~1,5 m (più grande del vero: deve leggersi) ————
function testaGabbiano(t: THREE.Matrix4): Pezzo[] {
  const at = (m: THREE.Matrix4) => t.clone().multiply(m);
  return [
    pz(box(0.15, 0.15, 0.17), P.pietraChiara, t),
    pz(box(0.045, 0.045, 0.13), P.giallo, at(mat(0, -0.02, -0.14))),
    pz(box(0.03, 0.03, 0.03), P.rosso, at(mat(0, -0.035, -0.19))),   // la macchia rossa sul becco
    pz(box(0.16, 0.035, 0.035), P.neroCaldo, at(mat(0, 0.025, -0.04))), // occhi: una riga scura da lato a lato
  ];
}
function corpoGabbiano(): Pezzo[] {
  return [
    pz(new THREE.CylinderGeometry(0.11, 0.06, 0.44, 6), P.pietraChiara, mat(0, 0, 0, -Math.PI / 2)),
    ...testaGabbiano(mat(0, 0.08, -0.26)),
    pz(box(0.14, 0.03, 0.13), P.pietraChiara, mat(0, 0.01, 0.27)),     // coda
  ];
}
/** Ala in volo: segmento interno (angolo `a` dalla spalla) e esterno (angolo `b`), punta nera. Lato +1 destra, −1 sinistra. */
function ala(lato: 1 | -1, a: number, b: number): Pezzo[] {
  const spalla = mat(lato * 0.08, 0.05, -0.05);
  const interno = spalla.clone().multiply(mat(0, 0, 0, 0, lato * -0.1, lato * a));
  const gomito = interno.clone().multiply(mat(lato * 0.36, 0, 0)).multiply(mat(0, 0, 0, 0, lato * -0.3, lato * (b - a)));
  const g = (w: number, h: number, d: number) => (lato > 0 ? arm(w, h, d) : mirrorX(arm(w, h, d)));
  return [
    pz(g(0.37, 0.035, 0.2), P.pietra, interno),
    pz(g(0.27, 0.03, 0.15), P.pietra, gomito),
    pz(g(0.15, 0.03, 0.12), P.neroCaldo, gomito.clone().multiply(mat(lato * 0.26, 0, 0.01))),
  ];
}
const gabbianoVolo = (a: number, b: number) => forma([...corpoGabbiano(), ...ala(1, a, b), ...ala(-1, a, b)]);
/** Posato: petto in su, testa alta, ali chiuse sul dorso con le punte nere incrociate sulla coda, zampe arancio; piedi a y = 0. */
function gabbianoPosato(): Forma {
  const T = 0.5; // inclinazione del corpo (petto in su)
  return forma([
    pz(new THREE.CylinderGeometry(0.11, 0.07, 0.38, 6), P.pietraChiara, mat(0, 0.25, 0.02, -Math.PI / 2 + T)),
    ...testaGabbiano(mat(0, 0.47, -0.13)),
    pz(box(0.12, 0.03, 0.12), P.pietraChiara, mat(0, 0.15, 0.22, T)),
    ...[-1, 1].flatMap((s) => [
      pz(box(0.04, 0.1, 0.28), P.pietra, mat(s * 0.085, 0.27, 0.06, T)),
      pz(box(0.035, 0.05, 0.13), P.neroCaldo, mat(s * 0.05, 0.17, 0.24, T, s * -0.2)),
      pz(box(0.03, 0.15, 0.03), P.arancio, mat(s * 0.045, 0.075, 0.03)),
      pz(box(0.05, 0.02, 0.07), P.arancio, mat(s * 0.045, 0.01, -0.0)),
    ]),
  ]);
}

// ———— gatto: mantello (canale 1) e pancia/muso/zampe/punta della coda (canale 2); ~0,7 m col muso ————
const OCCHI_APERTI = P.giallo, OCCHI_CHIUSI = P.neroCaldo;
function testaGatto(x: number, y: number, z: number, rx = 0, ry = 0, rz = 0, chiusi = false): Pezzo[] {
  const t = mat(x, y, z, rx, ry, rz);
  const at = (m: THREE.Matrix4) => t.clone().multiply(m);
  const occhi = chiusi ? box(0.05, 0.015, 0.02) : box(0.04, 0.045, 0.02);
  return [
    pz(box(0.22, 0.18, 0.18), 1, t),
    pz(box(0.12, 0.07, 0.05), 2, at(mat(0, -0.05, -0.1))),
    pz(box(0.035, 0.03, 0.03), P.rosso, at(mat(0, -0.02, -0.125))),
    pz(occhi.clone(), chiusi ? OCCHI_CHIUSI : OCCHI_APERTI, at(mat(-0.055, 0.03, -0.092))),
    pz(occhi, chiusi ? OCCHI_CHIUSI : OCCHI_APERTI, at(mat(0.055, 0.03, -0.092))),
    pz(new THREE.ConeGeometry(0.055, 0.11, 4), 1, at(mat(-0.065, 0.13, 0.01, 0, Math.PI / 4))),
    pz(new THREE.ConeGeometry(0.055, 0.11, 4), 1, at(mat(0.065, 0.13, 0.01, 0, Math.PI / 4))),
  ];
}
/** Zampa dall'anca (x, y, z) ruotata in avanti di `rx`; zampino chiaro. */
function zampa(x: number, y: number, z: number, rx: number, h = 0.2): Pezzo[] {
  const anca = mat(x, y, z, rx);
  return [pz(hang(0.07, h - 0.04, 0.07), 1, anca), pz(hang(0.075, 0.04, 0.085), 2, anca.clone().multiply(mat(0, -(h - 0.04), -0.005)))];
}
/** Coda a catena verso +Z: angoli cumulativi [beccheggio (negativo = su), imbardata]; l'ultimo segmento col colore secondario. */
function coda(x: number, y: number, z: number, angoli: [number, number][], len = 0.13): Pezzo[] {
  let m = mat(x, y, z);
  const out: Pezzo[] = [];
  angoli.forEach(([rx, ry], i) => {
    m = m.clone().multiply(mat(0, 0, 0, rx, ry));
    out.push(pz(tailSeg(0.05, 0.05, len), i === angoli.length - 1 ? 2 : 1, m));
    m = m.clone().multiply(mat(0, 0, len));
  });
  return out;
}
function gattoCammina(passo: 0 | 1): Forma {
  const sw = passo ? 0.38 : -0.38;
  return forma([
    pz(box(0.22, 0.19, 0.42), 1, mat(0, 0.29, 0)), pz(box(0.18, 0.04, 0.34), 2, mat(0, 0.18, 0)),
    ...testaGatto(0, 0.41, -0.27, 0.05),
    ...zampa(-0.07, 0.24, -0.15, sw), ...zampa(0.07, 0.24, -0.15, -sw), ...zampa(-0.07, 0.24, 0.15, -sw), ...zampa(0.07, 0.24, 0.15, sw),
    ...coda(0, 0.34, 0.2, [[-0.9, 0], [-0.5, 0], [0.4, 0]]),
  ]);
}
function gattoSeduto(fusa: boolean): Forma {
  return forma([
    pz(box(0.22, 0.2, 0.36), 1, mat(0, 0.24, 0.06, 0.75)), pz(box(0.16, 0.04, 0.24), 2, mat(0, 0.24, -0.06, 0.75)),
    ...testaGatto(0, 0.5, -0.1, fusa ? -0.15 : 0, fusa ? 0 : 0.15, fusa ? 0.22 : 0, fusa),
    ...zampa(-0.06, 0.26, -0.12, 0, 0.26), ...zampa(0.06, 0.26, -0.12, 0, 0.26),
    pz(box(0.08, 0.13, 0.2), 1, mat(-0.11, 0.07, 0.1)), pz(box(0.08, 0.13, 0.2), 1, mat(0.11, 0.07, 0.1)),
    ...(fusa
      ? coda(0, 0.14, 0.24, [[-1.35, 0], [-0.15, 0], [0.35, 0]])      // coda dritta in su: contento
      : coda(0.04, 0.035, 0.22, [[0, 0.9], [0, 0.9], [0, 0.8]], 0.12)), // coda arrotolata a terra
  ]);
}
function gattoDorme(): Forma {
  return forma([
    pz(box(0.26, 0.15, 0.4), 1, mat(0, 0.075, 0, 0, 0.15)), pz(box(0.2, 0.03, 0.3), 2, mat(0.01, 0.015, 0.0, 0, 0.15)),
    ...testaGatto(-0.05, 0.12, -0.24, 0.35, 0.55, 0.15, true),
    ...coda(0.05, 0.03, 0.17, [[0, 1.3], [0, 0.55], [0, 0.55], [0, 0.55], [0, 0.4]], 0.1),
  ]);
}
function gattoStira(): Forma {
  return forma([
    pz(box(0.22, 0.18, 0.42), 1, mat(0, 0.25, 0.02, -0.38)), pz(box(0.17, 0.04, 0.32), 2, mat(0, 0.15, 0.0, -0.38)),
    ...testaGatto(0, 0.19, -0.3, 0.25),
    pz(box(0.07, 0.06, 0.26), 1, mat(-0.06, 0.04, -0.36)), pz(box(0.07, 0.06, 0.26), 1, mat(0.06, 0.04, -0.36)),
    pz(box(0.075, 0.04, 0.06), 2, mat(-0.06, 0.02, -0.5)), pz(box(0.075, 0.04, 0.06), 2, mat(0.06, 0.02, -0.5)),
    ...zampa(-0.07, 0.36, 0.17, 0, 0.36), ...zampa(0.07, 0.36, 0.17, 0, 0.36),
    ...coda(0, 0.4, 0.22, [[-1.2, 0], [-0.4, 0], [0.3, 0]]),
  ]);
}

// ———— pesce, spruzzo, granchio, delfino, lucciola ————
function pesce(): Forma {
  return forma([
    pz(box(0.09, 0.09, 0.32), 1, mat(0, 0.03, 0)), pz(box(0.08, 0.06, 0.28), 2, mat(0, -0.04, -0.01)),
    pz(box(0.02, 0.16, 0.11), 1, mat(0, 0.0, 0.2)), pz(box(0.02, 0.05, 0.12), 1, mat(0, 0.09, 0.02)),
    pz(box(0.1, 0.025, 0.025), P.neroCaldo, mat(0, 0.04, -0.12)),
  ]);
}
/** Spruzzo a pixel in tre fotogrammi (0 = parte, 1 = in alto, 2 = ricade): cubetti bianchi e acqua bassa in cerchio. */
function spruzzo(f: 0 | 1 | 2): Forma {
  const parti: Pezzo[] = [];
  const anello = [[6, 0.16, 0.05], [8, 0.32, 0.07], [10, 0.46, 0.02]][f]!;
  for (let i = 0; i < anello[0]!; i++) {
    const a = (i / anello[0]!) * Math.PI * 2 + f * 0.3;
    parti.push(pz(box(0.09, 0.09, 0.09), i % 2 ? PAL.acquaBassa : P.pietraChiara, mat(Math.cos(a) * anello[1]!, anello[2]!, Math.sin(a) * anello[1]!, 0, a)));
  }
  const gocce = [[[0, 0.18], [0.05, 0.34], [-0.04, 0.46]], [[0.12, 0.52], [-0.1, 0.62], [0.02, 0.78], [-0.16, 0.4]], [[0.2, 0.26], [-0.18, 0.18]]][f]!;
  gocce.forEach(([x, y], i) => parti.push(pz(box(0.08, 0.08, 0.08), i % 2 ? PAL.acquaBassa : P.pietraChiara, mat(x!, y!, (i - 1) * 0.06))));
  return forma(parti);
}
function granchio(passo: 0 | 1): Forma {
  const parti: Pezzo[] = [
    pz(box(0.28, 0.08, 0.2), P.rosso, mat(0, 0.1, 0)), pz(box(0.2, 0.04, 0.14), P.rosso, mat(0, 0.16, 0.0)),
    pz(box(0.24, 0.03, 0.03), P.sabbiaChiara, mat(0, 0.07, -0.1)), // pancia chiara che si vede di fronte
  ];
  for (const s of [-1, 1]) {
    parti.push(pz(box(0.025, 0.09, 0.025), P.rosso, mat(s * 0.05, 0.2, -0.07)), pz(box(0.04, 0.04, 0.04), P.neroCaldo, mat(s * 0.05, 0.26, -0.07)));
    parti.push(pz(box(0.07, 0.04, 0.1), P.rosso, mat(s * 0.15, 0.1, -0.13, 0, s * 0.4)), pz(box(0.09, 0.07, 0.11), P.arancio, mat(s * 0.18, 0.12, -0.21, 0, s * 0.3)));
    [-0.05, 0.02, 0.09].forEach((z, i) => {
      const su = (i + passo) % 2 ? 0.25 : 0.75;
      parti.push(pz(s > 0 ? arm(0.13, 0.025, 0.03) : mirrorX(arm(0.13, 0.025, 0.03)), P.rosso, mat(s * 0.13, 0.1, z, 0, 0, -s * su)));
    });
  }
  return forma(parti);
}
function delfino(): Forma {
  // dorso grigio scuro, pancia chiara, pinna dorsale ricurva, coda a mezzaluna; ~2 m
  return forma([
    pz(new THREE.CylinderGeometry(0.14, 0.27, 0.8, 6), P.pietraScura, mat(0, 0, -0.38, -Math.PI / 2)),
    pz(new THREE.CylinderGeometry(0.27, 0.07, 1.0, 6), P.pietraScura, mat(0, 0, 0.52, -Math.PI / 2)),
    pz(box(0.3, 0.1, 1.15), P.pietraChiara, mat(0, -0.17, -0.08)),
    pz(box(0.1, 0.08, 0.24), P.pietra, mat(0, -0.06, -0.88)),
    pz(box(0.29, 0.035, 0.035), P.neroCaldo, mat(0, 0.06, -0.62)),
    pz(box(0.05, 0.24, 0.2), P.pietraScura, mat(0, 0.3, 0.12, 0.5)), pz(box(0.05, 0.12, 0.14), P.pietraScura, mat(0, 0.42, 0.24, 1.0)),
    pz(box(0.22, 0.035, 0.15), P.pietraScura, mat(-0.13, 0, 1.08, 0, -0.45)), pz(box(0.22, 0.035, 0.15), P.pietraScura, mat(0.13, 0, 1.08, 0, 0.45)),
    pz(box(0.24, 0.03, 0.11), P.pietraScura, mat(-0.26, -0.13, -0.25, 0, 0.3, 0.4)), pz(box(0.24, 0.03, 0.11), P.pietraScura, mat(0.26, -0.13, -0.25, 0, -0.3, -0.4)),
  ]);
}
const lucciola = () => forma([pz(new THREE.OctahedronGeometry(0.11, 0), 1, mat(0, 0, 0))]);

export type Forme = ReturnType<typeof creaForme>;
/** Tutte le pose, costruite una volta (pochi kB). */
export function creaForme() {
  return {
    gabbiano: { su: gabbianoVolo(0.8, 1.05), mezzo: gabbianoVolo(0.18, -0.12), giu: gabbianoVolo(-0.42, -0.62), posato: gabbianoPosato() },
    gatto: { cammina: [gattoCammina(0), gattoCammina(1)] as const, seduto: gattoSeduto(false), fusa: gattoSeduto(true), dorme: gattoDorme(), stira: gattoStira() },
    pesce: pesce(), spruzzo: [spruzzo(0), spruzzo(1), spruzzo(2)] as const,
    granchio: [granchio(0), granchio(1)] as const, delfino: delfino(), lucciola: lucciola(),
  };
}

/** Mantelli dei gatti (principale, secondario): solo colori della palette. */
export const MANTELLI: readonly [string, string][] = [
  [P.arancio, P.sabbiaChiara], [P.neroCaldo, P.pietraChiara], [P.pietraScura, P.pietraChiara], [P.sabbiaChiara, P.legnoChiaro], [P.legno, P.sabbia], [P.roccia, P.pietraScura],
];
/** Pesci: dorso, pancia. */
export const SQUAME: readonly [string, string][] = [[PAL.acquaProfonda, P.pietraChiara], [P.arancio, P.giallo], [P.pietra, P.pietraChiara]];
/** Lucciole: due gialli-verdi (neon permessi: sono luci). */
export const LUCI_LUCCIOLA: readonly string[] = ['#B6FF3D', P.giallo];
