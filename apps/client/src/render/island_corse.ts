// Isola delle Corse (docs/CORSE.md) nell'arcipelago: l'hub in piccolo, fedele alla concept (assets/concept/corse/corse_13_hub_arrivo e
// corse_01_hub). Molo con i pali e le lanterne, paese dei piloti (garage con la chiave inglese, podio 1-2-3 con la statua gigante del
// manichino col cappellino rosso e il trofeo, torre di controllo a scacchi, bancarelle, festoni, lampioni), rotatoria col trofeo dorato,
// strade d'asfalto coi cordoli rossi e bianchi e le porte dei quartieri (neve, giungla, neon, luna park, spiaggia) con le loro insegne;
// nei quartieri ruota panoramica, tendoni, tempio, palazzi al neon, faro, ombrelloni, alberi. Decorazioni procedurali: solo colori della
// palette, facce piatte, pivot a terra al centro, −Z avanti. Le parti che brillano (lanterne, finestre, neon) stanno in `propCorseGlow`
// (materiale non illuminato). L'hub vero, da girare col veicolo, è un mondo a parte (apps/client/src/corse/hub/).
// `kartGeo` e `scacchi` servono anche al chunk delle Corse. Il file sta in un chunk a parte (island_temi.ts lo carica all'avvio: `corsePronta`).
import * as THREE from 'three';
import { M, P, merged, painted } from './island_parts.ts';
import type { TemaProp } from './island_temi.ts';

type G = THREE.BufferGeometry;
// Le decorazioni dell'isola si guardano sempre dall'alto (camera a 22-45°): cubi e cilindri senza la faccia di sotto (2 triangoli su 12
// in meno per cubo); il kart, che in gara si vede da dietro e da vicino, li ha interi.
const boxPieno = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
const cylPieno = (r0: number, r1: number, h: number, n = 6) => new THREE.CylinderGeometry(r0, r1, h, n);
function senzaFondo(g: THREE.BufferGeometry, gruppo: number): G {
  const gr = g.groups[gruppo]!, ix = Array.from(g.index!.array);
  ix.splice(gr.start, gr.count); g.setIndex(ix); g.clearGroups();
  return g;
}
const box = (w: number, h: number, d: number) => senzaFondo(new THREE.BoxGeometry(w, h, d), 3); // gruppi: +x −x +y −y +z −z
const cyl = (r0: number, r1: number, h: number, n = 6) => senzaFondo(new THREE.CylinderGeometry(r0, r1, h, n), 2); // fianco, sopra, sotto
const otto = (r: number) => new THREE.OctahedronGeometry(r, 0);
const cono = (r: number, h: number, n = 6) => new THREE.ConeGeometry(r, h, n);
const ico = (r: number, d = 0) => new THREE.IcosahedronGeometry(r, d);

/** Scacchiera di cubetti bianchi e neri: `nx` × `ny` caselle da `q` m, centrata in (x, y, z), piatta su XY (ruotata di `ry`). */
export function scacchi(parts: G[], nx: number, ny: number, q: number, x: number, y: number, z: number, ry = 0, d = 0.12): void {
  for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
    const ox = (i - (nx - 1) / 2) * q, oy = (j - (ny - 1) / 2) * q;
    parts.push(painted(box(q, q, d), (i + j) % 2 ? P.neroCaldo : P.pietraChiara, M(x + Math.cos(ry) * ox, y + oy, z - Math.sin(ry) * ox, 0, ry, 0)));
  }
}

/** Il kart (un posto, muso verso −Z, ~1,6 × 2,4 m): telaio, scocca col colore, ruote nere, volante e roll-bar. Il pilota lo mette chi lo usa. */
export function kartGeo(colore: string, numero = 0): G {
  const parts: G[] = [];
  parts.push(painted(boxPieno(1.2, 0.18, 2.3), P.roccia, M(0, 0.28, 0))); // telaio
  parts.push(painted(boxPieno(1.0, 0.32, 0.9), colore, M(0, 0.5, -0.7))); // muso
  parts.push(painted(boxPieno(1.3, 0.14, 0.35), colore, M(0, 0.42, -1.2))); // paraurti davanti
  parts.push(painted(boxPieno(0.5, 0.42, 0.7), colore, M(0, 0.55, 0.55))); // schienale e motore
  parts.push(painted(boxPieno(1.5, 0.12, 0.3), colore, M(0, 0.95, 1.05))); // alettone
  for (const s of [-1, 1]) parts.push(painted(boxPieno(0.08, 0.4, 0.12), P.roccia, M(s * 0.6, 0.75, 1.05)));
  parts.push(painted(boxPieno(0.35, 0.08, 0.08), P.neroCaldo, M(0, 0.82, -0.3, 0.5, 0, 0))); // volante
  parts.push(painted(boxPieno(0.06, 0.32, 0.06), P.roccia, M(0, 0.66, -0.2, 0.5, 0, 0)));
  parts.push(painted(boxPieno(0.7, 0.05, 0.24), numero % 2 ? P.pietraChiara : P.giallo, M(0, 0.67, -0.95))); // targhetta col numero
  for (const [x, z, r] of [[-0.72, -0.8, 0.27], [0.72, -0.8, 0.27], [-0.75, 0.8, 0.33], [0.75, 0.8, 0.33]] as const) {
    parts.push(painted(cylPieno(r, r, 0.32, 8), P.neroCaldo, M(x, r, z, 0, 0, Math.PI / 2)));
    parts.push(painted(cylPieno(r * 0.45, r * 0.45, 0.34, 6), P.pietra, M(x, r, z, 0, 0, Math.PI / 2)));
  }
  return merged(parts);
}

// ——— attrezzi ———
/** Colore per triangolo da normale e baricentro (facce piatte, niente sfumature). */
function tinta(geo: G, m: THREE.Matrix4, f: (n: THREE.Vector3, c: THREE.Vector3) => string): G {
  const g = (geo.index ? geo.toNonIndexed() : geo).applyMatrix4(m);
  g.deleteAttribute('uv');
  const pos = g.attributes.position!, a = new Float32Array(pos.count * 3), col = new THREE.Color();
  const p0 = new THREE.Vector3(), p1 = new THREE.Vector3(), p2 = new THREE.Vector3(), n = new THREE.Vector3(), c = new THREE.Vector3();
  for (let i = 0; i < pos.count; i += 3) {
    p0.fromBufferAttribute(pos, i); p1.fromBufferAttribute(pos, i + 1); p2.fromBufferAttribute(pos, i + 2);
    n.subVectors(p1, p0).cross(p2.clone().sub(p0)).normalize();
    c.copy(p0).add(p1).add(p2).multiplyScalar(1 / 3);
    col.set(f(n, c));
    for (let k = 0; k < 3; k++) { a[(i + k) * 3] = col.r; a[(i + k) * 3 + 1] = col.g; a[(i + k) * 3 + 2] = col.b; }
  }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return g;
}
/** A spicchi: colori alterni attorno all'asse Y (tendoni, ombrelloni). `n` spicchi, `off` = rotazione degli spicchi. */
const spicchi = (cols: string[], n: number, off = 0) => (_n: THREE.Vector3, c: THREE.Vector3) => cols[((Math.floor(((Math.atan2(c.z, c.x) + Math.PI + off) / (Math.PI * 2)) * n) % n) + n) % cols.length]!;
/** Piastrella sottile (2 triangoli) verso −Z, poi `m`: scritte, scacchi e insegne senza i 12 triangoli di un cubo. */
const piastra = (w: number, h: number, col: string, m: THREE.Matrix4) => painted(new THREE.PlaneGeometry(w, h).rotateY(Math.PI), col, m);
/**
 * Disegno a pixel su una faccia verticale: `rows` dall'alto, `pal` carattere → colore ('.' vuoto), pixel da `q` m, centrato in
 * (x, y, z) e girato di `ry` (a ry = 0 guarda verso −Z). Le file dello stesso colore diventano una piastra sola.
 */
function pixel(dst: G[], rows: string[], pal: Record<string, string>, q: number, x: number, y: number, z: number, ry = 0): void {
  const h = rows.length, w = Math.max(...rows.map((r) => r.length)), base = M(x, y, z, 0, ry, 0);
  for (let j = 0; j < h; j++) {
    const r = rows[j]!;
    for (let i = 0; i < r.length;) {
      const ch = r[i]!; let k = i; while (k < r.length && r[k] === ch) k++;
      const col = pal[ch];
      if (col) dst.push(piastra((k - i) * q, q, col, base.clone().multiply(M(-((i + k) / 2 - w / 2) * q, (h / 2 - j - 0.5) * q, 0)))); // la piastra guarda −Z: la destra del disegno è −X
      i = k;
    }
  }
}
/** Scacchiera leggera: fondo bianco + caselle nere a piastre, `nx` × `ny` da `q`, centrata in (x, y, z), girata di `ry` (guarda −Z). */
function scacchiera(dst: G[], nx: number, ny: number, q: number, x: number, y: number, z: number, ry = 0): void {
  const base = M(x, y, z, 0, ry, 0);
  dst.push(piastra(nx * q, ny * q, P.pietraChiara, base.clone().multiply(M(0, 0, 0.012))));
  for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) if ((i + j) % 2) dst.push(piastra(q, q, P.neroCaldo, base.clone().multiply(M((i - (nx - 1) / 2) * q, (j - (ny - 1) / 2) * q, 0))));
}
/** Triangolo a due facce (bandierine dei festoni): base in alto larga `w`, punta in giù a `h`, sul piano XY. */
function triangolo(w: number, h: number, col: string, m: THREE.Matrix4): G {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([-w / 2, 0, 0, 0, -h, 0, w / 2, 0, 0, -w / 2, 0, 0, w / 2, 0, 0, 0, -h, 0], 3));
  g.computeVertexNormals();
  return painted(g, col, m);
}
/** Trave da (x0, y0) a (x1, y1) sul piano z, sezione `s`. */
function trave(col: string, x0: number, y0: number, x1: number, y1: number, z: number, s = 0.1): G {
  const dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy);
  return painted(boxPieno(l, s, s), col, M((x0 + x1) / 2, (y0 + y1) / 2, z, 0, 0, Math.atan2(dy, dx)));
}
/** Applica `m` a tutte le parti aggiunte da `fn` (sotto-gruppi: la statua in scala, la ruota girata). */
function gruppo(dst: G[], m: THREE.Matrix4, fn: (p: G[]) => void): void {
  const p: G[] = []; fn(p);
  for (const g of p) dst.push(g.applyMatrix4(m));
}
const CIFRE: Record<string, string[]> = { '1': ['.X.', 'XX.', '.X.', '.X.', 'XXX'], '2': ['XX.', '..X', '.X.', 'X..', 'XXX'], '3': ['XX.', '..X', '.X.', '..X', 'XX.'] };
const FESTA = [P.rosso, P.giallo, P.acqua, P.erba, P.arancio, P.viola];

// ——— insegne delle porte (9 × 9 pixel) ———
type Zona = 'neve' | 'giungla' | 'neon' | 'luna' | 'spiaggia';
const INSEGNE: Record<Zona, { rows: string[]; pal: Record<string, string> }> = {
  neve: { rows: ['....W....', '.W..W..W.', '..W.W.W..', '...WWW...', 'WWWWAWWWW', '...WWW...', '..W.W.W..', '.W..W..W.', '....W....'], pal: { W: P.pietraChiara, A: P.acquaBassa } },
  giungla: { rows: ['......LLL', '....LLLLL', '...LLLDLL', '..LLLDLLL', '.LLLDLLL.', '.LLDLLL..', '..DLLL...', '.D.......', 'D........'], pal: { L: P.erbaChiara, D: P.erbaScura } },
  neon: { rows: ['.....C...', '.R...C...', '.R..CCC.V', 'RRR.CCC.V', 'RRR.CCCVV', 'RRRVCCCVV', 'RRRVCCCVV', 'CCCCCCCCC'], pal: { C: P.cianoNeon, R: P.rosaNeon, V: P.violaNeon } },
  luna: { rows: ['....Y....', '....R....', '...RWR...', '..RWRWR..', '.RWRWRWR.', 'RWRWRWRWR', '.W.RKR.W.', '.W.RKR.W.', '.W.RKR.W.'], pal: { R: P.rosso, W: P.pietraChiara, Y: P.giallo, K: P.neroCaldo } },
  spiaggia: { rows: ['.WW...WW.', 'W..W.W..W', '....W....', '.........', '.AA...AA.', 'A..A.A..A', '....A....', '.........', 'YYYYYYYYY'], pal: { W: P.pietraChiara, A: P.acquaBassa, Y: P.sabbia } },
};
/** Porta di un quartiere: due pilastri, trave a scacchi, insegna col simbolo della zona sopra; la strada passa lungo Z. */
function porta(b: G[], l: G[], zona: Zona): void {
  const ins = INSEGNE[zona];
  const stile = ({
    neve: { pil: P.pietra, base: P.pietraScura, trave: P.legnoScuro, fondo: P.abisso, cornice: P.legnoScuro },
    giungla: { pil: P.pietraScura, base: P.roccia, trave: P.pietraScura, fondo: P.bosco, cornice: P.pietra },
    neon: { pil: P.neroCaldo, base: P.roccia, trave: P.neroCaldo, fondo: P.neroCaldo, cornice: P.roccia },
    luna: { pil: P.pietraChiara, base: P.rosso, trave: P.giallo, fondo: P.rosso, cornice: P.giallo },
    spiaggia: { pil: P.legnoChiaro, base: P.legno, trave: P.legno, fondo: P.acquaProfonda, cornice: P.legnoChiaro },
  } satisfies Record<Zona, Record<string, string>>)[zona];
  for (const s of [-1, 1]) {
    const x = s * 3.8;
    b.push(painted(box(1.6, 0.6, 1.6), stile.base, M(x, 0.3, 0)));
    if (zona === 'luna') for (let i = 0; i < 6; i++) b.push(painted(box(1.1, 0.8, 1.1), i % 2 ? P.rosso : P.pietraChiara, M(x, 1.0 + i * 0.8, 0)));
    else b.push(painted(box(1.1, 4.8, 1.1), stile.pil, M(x, 3.0, 0)));
    b.push(painted(box(1.45, 0.4, 1.45), stile.base, M(x, 5.6, 0)));
    if (zona === 'giungla') { // muschio e liane
      for (const y of [1.4, 3.6]) b.push(painted(box(1.18, 0.35, 1.18), P.erbaScura, M(x, y, 0)));
      for (const [dx, dz, h] of [[0.3, -0.58, 2.2], [-0.35, -0.58, 1.4], [0.58, 0.2, 1.8]] as const) b.push(painted(box(0.12, h, 0.08), P.bosco, M(x + dx * s, 5.4 - h / 2, dz)));
      b.push(painted(cyl(0.45, 0.3, 0.4, 6), P.roccia, M(x, 6.0, 0))); // braciere
      l.push(painted(cono(0.38, 0.9, 5), P.arancio, M(x, 6.6, 0)), painted(cono(0.2, 0.6, 4), P.giallo, M(x + 0.08, 6.5, -0.05)));
    } else if (zona === 'neve') {
      b.push(painted(box(1.6, 0.3, 1.6), P.pietraChiara, M(x, 5.95, 0)), painted(ico(0.55, 0), P.pietraChiara, M(x, 6.15, 0, 0.3, 0.4, 0, 1.3, 0.6, 1.3)));
      for (const [dx, dz] of [[0.6, -0.2], [-0.55, 0.3]] as const) b.push(painted(ico(0.4, 0), P.pietraChiara, M(x + dx, 0.75, dz, 0, dx, 0, 1, 0.5, 1)));
    } else if (zona === 'neon') { // tubi al neon sugli spigoli
      for (const [dx, dz, c] of [[-0.58, -0.58, P.rosaNeon], [0.58, -0.58, P.cianoNeon], [0.58, 0.58, P.rosaNeon], [-0.58, 0.58, P.cianoNeon]] as const) l.push(painted(box(0.1, 4.6, 0.1), c, M(x + dx, 3.0, dz)));
      l.push(painted(box(0.5, 0.5, 0.5), P.violaNeon, M(x, 6.05, 0)));
    } else if (zona === 'luna') {
      l.push(painted(ico(0.32, 0), P.giallo, M(x, 6.05, 0)));
    } else { // spiaggia: corda e lanterna
      for (const y of [1.2, 4.6]) b.push(painted(cyl(0.62, 0.62, 0.22, 8), P.sabbia, M(x, y, 0)));
      b.push(painted(box(0.6, 0.1, 0.6), P.neroCaldo, M(x, 5.85, 0)), painted(cono(0.45, 0.4, 4), P.neroCaldo, M(x, 6.45, 0, 0, Math.PI / 4, 0)));
      l.push(painted(box(0.42, 0.5, 0.42), P.giallo, M(x, 6.1, 0)));
    }
  }
  // trave con la fascia a scacchi davanti e dietro
  b.push(painted(box(9.2, 0.9, 0.8), stile.trave, M(0, 5.0, 0)));
  for (const s of [-1, 1]) scacchiera(b, 22, 2, 0.34, 0, 5.0, s * 0.43, s < 0 ? 0 : Math.PI);
  if (zona === 'luna') for (let i = 0; i < 12; i++) for (const s of [-1, 1]) l.push(painted(box(0.16, 0.16, 0.06), i % 2 ? P.giallo : P.rosaNeon, M(-3.85 + i * 0.7, 5.62, s * 0.42)));
  if (zona === 'neon') for (const s of [-1, 1]) l.push(painted(box(8.4, 0.08, 0.06), P.cianoNeon, M(0, 5.5, s * 0.43)), painted(box(8.4, 0.08, 0.06), P.rosaNeon, M(0, 4.5, s * 0.43)));
  // insegna sopra la trave: cornice, fondo, simbolo davanti e dietro
  b.push(painted(box(3.3, 0.5, 0.4), stile.cornice, M(0, 5.6, 0)));
  b.push(painted(box(3.6, 3.3, 0.35), stile.cornice, M(0, 7.4, 0)), painted(box(3.1, 2.8, 0.42), stile.fondo, M(0, 7.4, 0)));
  const dst = zona === 'neon' ? l : b;
  for (const s of [-1, 1]) pixel(dst, ins.rows, ins.pal, 0.3, 0, 7.4, s * 0.22, s < 0 ? 0 : Math.PI);
  if (zona === 'neon') for (const s of [-1, 1]) for (const [w, h, x, y] of [[3.4, 0.08, 0, 9.0], [3.4, 0.08, 0, 5.8], [0.08, 3.2, -1.7, 7.4], [0.08, 3.2, 1.7, 7.4]] as const) l.push(painted(box(w, h, 0.06), P.violaNeon, M(x, y, s * 0.2)));
}

/** Il manichino della statua (in piedi, ~1,9 m, guarda −Z): braccio destro alzato col trofeo, sinistro sul fianco, cappellino rosso. */
function manichino(p: G[]): void {
  const pelle = P.pietraChiara, giunto = P.pietra;
  for (const s of [-1, 1]) {
    p.push(painted(box(0.14, 0.08, 0.28), giunto, M(s * 0.15, 0.04, -0.04)));
    p.push(painted(cyl(0.06, 0.07, 0.42, 6), pelle, M(s * 0.15, 0.29, 0, 0, 0, s * 0.05)));
    p.push(painted(ico(0.075, 0), giunto, M(s * 0.14, 0.52, 0)));
    p.push(painted(cyl(0.08, 0.09, 0.42, 6), pelle, M(s * 0.13, 0.74, 0, 0, 0, s * 0.04)));
    p.push(painted(ico(0.08, 0), giunto, M(s * 0.25, 1.6, 0)));
  }
  p.push(painted(box(0.36, 0.2, 0.22), pelle, M(0, 0.98, 0)));
  p.push(painted(cyl(0.12, 0.14, 0.14, 6), giunto, M(0, 1.14, 0)));
  p.push(painted(cyl(0.22, 0.15, 0.4, 6), pelle, M(0, 1.38, 0)));
  p.push(painted(box(0.48, 0.16, 0.26), pelle, M(0, 1.56, 0)));
  // fascia a scacchi sul petto, dalla spalla sinistra al fianco destro
  for (let i = 0; i < 7; i++) for (const j of [0, 1]) p.push(piastra(0.075, 0.075, (i + j) % 2 ? P.neroCaldo : P.pietraChiara, M(-0.18 + i * 0.06 + j * 0.05, 1.6 - i * 0.075 + j * 0.04, -0.135, 0, 0, -0.75)));
  p.push(painted(cyl(0.05, 0.06, 0.1, 6), giunto, M(0, 1.7, 0)));
  p.push(painted(ico(0.13, 1), pelle, M(0, 1.86, 0, 0, 0, 0, 1, 1.22, 1.05)));
  // cappellino rosso con la visiera
  p.push(painted(ico(0.145, 1), P.rosso, M(0, 1.95, 0.01, 0, 0, 0, 1, 0.6, 1.05)));
  p.push(painted(box(0.22, 0.03, 0.18), P.rosso, M(0, 1.93, -0.17, -0.12, 0, 0)));
  // braccio destro alzato col trofeo
  p.push(painted(cyl(0.05, 0.06, 0.32, 6), pelle, M(0.33, 1.75, 0, 0, 0, -0.5)));
  p.push(painted(ico(0.06, 0), giunto, M(0.41, 1.9, 0)));
  p.push(painted(cyl(0.045, 0.05, 0.3, 6), pelle, M(0.44, 2.06, 0, 0, 0, -0.15)));
  p.push(painted(ico(0.06, 0), giunto, M(0.46, 2.23, 0)));
  p.push(painted(cyl(0.06, 0.08, 0.05, 8), P.arancio, M(0.46, 2.29, 0)));
  p.push(painted(cyl(0.02, 0.03, 0.1, 6), P.giallo, M(0.46, 2.36, 0)));
  p.push(painted(cyl(0.14, 0.05, 0.2, 8), P.giallo, M(0.46, 2.5, 0)));
  for (const s of [-1, 1]) p.push(painted(box(0.03, 0.12, 0.03), P.arancio, M(0.46 + s * 0.15, 2.5, 0)));
  // braccio sinistro sul fianco
  p.push(painted(cyl(0.05, 0.06, 0.32, 6), pelle, M(-0.33, 1.47, 0, 0, 0, -0.5)));
  p.push(painted(ico(0.06, 0), giunto, M(-0.4, 1.33, 0)));
  p.push(painted(cyl(0.045, 0.05, 0.28, 6), pelle, M(-0.32, 1.2, -0.02, 0, 0, 0.6)));
  p.push(painted(ico(0.06, 0), giunto, M(-0.22, 1.08, -0.02)));
}

/** Corpo (illuminato) e parti che brillano di una decorazione delle Corse. */
function costruisci(kind: TemaProp): { b: G[]; l: G[] } {
  const b: G[] = [], l: G[] = [];
  switch (kind) {
    case 'arco_via': {
      // portale sopra la pista: due piloni a bande rosse e bianche, traversa a scacchi, semaforo
      for (const s of [-1, 1]) {
        for (let i = 0; i < 5; i++) b.push(painted(box(0.5, 0.9, 0.5), i % 2 ? P.pietraChiara : P.rosso, M(s * 3.2, 0.45 + i * 0.9, 0)));
        b.push(painted(box(0.8, 0.3, 0.8), P.roccia, M(s * 3.2, 0.15, 0)));
      }
      b.push(painted(box(7.0, 1.0, 0.4), P.roccia, M(0, 4.8, 0)));
      scacchiera(b, 12, 2, 0.5, 0, 4.8, -0.22); scacchiera(b, 12, 2, 0.5, 0, 4.8, 0.22, Math.PI);
      b.push(painted(box(1.6, 0.5, 0.3), P.neroCaldo, M(0, 5.6, -0.1)));
      for (let i = 0; i < 3; i++) l.push(painted(box(0.3, 0.3, 0.1), i === 2 ? P.verdeNeon : P.rossoNeon, M(-0.5 + i * 0.5, 5.6, -0.3)));
      for (let i = 0; i < 3; i++) l.push(painted(box(0.3, 0.3, 0.1), i === 2 ? P.verdeNeon : P.rossoNeon, M(-0.5 + i * 0.5, 5.6, 0.1)));
      break;
    }
    case 'tribuna': {
      // gradinata di legno con la tettoia a strisce, piena di manichini (alcuni col cappellino)
      for (let i = 0; i < 4; i++) b.push(painted(box(7, 0.45, 0.9), i % 2 ? P.legno : P.legnoChiaro, M(0, 0.25 + i * 0.45, -1.2 + i * 0.9)));
      b.push(painted(box(7, 1.9, 0.2), P.legnoScuro, M(0, 0.95, 2.3)));
      const cappelli = [P.rosso, P.giallo, P.acqua, P.viola];
      for (let i = 1; i < 4; i++) for (let j = 0; j < 8; j++) if ((i * 7 + j * 3) % 4) {
        const x = -2.9 + j * 0.83, y = 0.47 + i * 0.45, z = -1.2 + i * 0.9;
        b.push(painted(box(0.34, 0.42, 0.26), P.pietraChiara, M(x, y + 0.21, z)));
        b.push(painted(otto(0.16), P.pietraChiara, M(x, y + 0.6, z, 0, 0.4, 0, 1, 1.25, 1)));
        if ((i + j) % 3 === 0) b.push(painted(box(0.28, 0.09, 0.3), cappelli[(i + j) % 4]!, M(x, y + 0.74, z - 0.03)));
      }
      for (const s of [-1, 1]) b.push(painted(box(0.18, 3.4, 0.18), P.roccia, M(s * 3.4, 1.7, 2.2)));
      for (let i = 0; i < 7; i++) b.push(painted(box(1.0, 0.14, 3.6), i % 2 ? P.pietraChiara : P.rosso, M(-3 + i, 3.5, 0.6, 0.18, 0, 0)));
      break;
    }
    case 'gomme': {
      // pila di gomme a muretto (3 colonne × 3), una bianca ogni tanto
      for (let c = 0; c < 3; c++) for (let h = 0; h < 3; h++) b.push(painted(cyl(0.42, 0.42, 0.3, 6), (c + h) % 3 === 1 ? P.pietraChiara : P.neroCaldo, M((c - 1) * 0.86, 0.15 + h * 0.3, 0)));
      break;
    }
    case 'kart_fermo': b.push(kartGeo(P.rosso, 7)); break;
    case 'bandierina': {
      // asta con la bandiera a scacchi
      b.push(painted(cyl(0.05, 0.06, 3.2, 5), P.pietra, M(0, 1.6, 0)));
      scacchiera(b, 4, 3, 0.3, 0.65, 2.75, -0.02); scacchiera(b, 4, 3, 0.3, 0.65, 2.75, 0.02, Math.PI);
      break;
    }
    case 'strada': {
      // pezzo di strada da 4 m (lungo Z), 5 m d'asfalto, linee bianche ai bordi, riga tratteggiata, cordoli rossi e bianchi
      const su = (w: number, d: number, col: string, x: number) => painted(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2), col, M(x, 0.085, 0));
      b.push(painted(new THREE.PlaneGeometry(5, 4.04).rotateX(-Math.PI / 2), P.roccia, M(0, 0.07, 0)));
      b.push(su(0.14, 4.04, P.pietraChiara, -2.2), su(0.14, 4.04, P.pietraChiara, 2.2), su(0.2, 1.5, P.pietraChiara, 0));
      // cordoli: un blocco per lato a 4 spicchi da 1 m, rossi e bianchi
      for (const s of [-1, 1]) b.push(tinta(senzaFondo(new THREE.BoxGeometry(0.5, 0.16, 4.0, 1, 1, 4), 3), M(s * 2.74, 0.08, 0), (_n, c) => ((Math.floor(c.z + 2) % 2) ? P.rosso : P.pietraChiara)));
      break;
    }
    case 'rotatoria': {
      // anello d'asfalto attorno all'aiuola tonda: cordolo rosso e bianco, riga tratteggiata, fiori e quattro stendardi
      const anello = (r0: number, r1: number, y: number, col: string) => painted(new THREE.RingGeometry(r0, r1, 28, 1).rotateX(-Math.PI / 2), col, M(0, y, 0));
      b.push(anello(4.4, 9.3, 0.075, P.roccia), anello(8.8, 8.95, 0.085, P.pietraChiara));
      for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; b.push(painted(new THREE.PlaneGeometry(0.18, 1.1).rotateX(-Math.PI / 2), P.pietraChiara, M(Math.cos(a) * 6.8, 0.09, Math.sin(a) * 6.8, 0, -a, 0))); }
      for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2; b.push(painted(box(0.5, 0.22, 1.2), i % 2 ? P.rosso : P.pietraChiara, M(Math.cos(a) * 4.65, 0.11, Math.sin(a) * 4.65, 0, -a, 0))); }
      b.push(painted(cyl(4.4, 4.5, 0.3, 16), P.erba, M(0, 0.15, 0)));
      const fiori = [P.rosso, P.giallo, P.pietraChiara, P.rosaNeon, P.arancio];
      for (let i = 0; i < 18; i++) { const a = (i / 18) * Math.PI * 2 + 0.1; b.push(painted(otto(0.24), fiori[i % 5]!, M(Math.cos(a) * 3.7, 0.4, Math.sin(a) * 3.7, 0, a, 0, 1, 0.7, 1))); }
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4, x = Math.cos(a) * 3.3, z = Math.sin(a) * 3.3;
        b.push(painted(cyl(0.05, 0.06, 3.4, 5), P.pietra, M(x, 2.0, z)));
        b.push(painted(box(0.06, 1.2, 0.7), i % 2 ? P.rosso : P.giallo, M(x, 3.0, z + 0.36)));
        b.push(painted(box(0.07, 0.3, 0.3), P.pietraChiara, M(x, 3.1, z + 0.36)));
      }
      break;
    }
    case 'trofeo': {
      // basamento a gradoni con la fascia a scacchi e la coppa dorata gigante (sta in mezzo all'aiuola della rotatoria)
      b.push(painted(cyl(2.2, 2.4, 0.4, 8), P.pietra, M(0, 0.5, 0)));
      b.push(painted(box(2.4, 1.8, 2.4), P.pietraChiara, M(0, 1.6, 0)));
      b.push(painted(box(2.9, 0.3, 2.9), P.pietra, M(0, 2.6, 0)));
      for (let k = 0; k < 4; k++) { const a = (k * Math.PI) / 2; scacchiera(b, 8, 2, 0.28, Math.sin(a) * 1.23, 2.1, -Math.cos(a) * 1.23, -a); }
      const oro = (n: THREE.Vector3, c: THREE.Vector3) => (n.y > 0.5 ? P.giallo : (n.x + n.z > 0.2 ? P.giallo : (c.y % 0.8 < 0.4 ? P.arancio : P.giallo)));
      b.push(tinta(cyl(0.95, 1.15, 0.45, 8), M(0, 2.97, 0), oro));
      b.push(tinta(cyl(0.25, 0.45, 1.1, 8), M(0, 3.7, 0), oro));
      b.push(painted(cyl(0.5, 0.5, 0.25, 8), P.arancio, M(0, 4.3, 0)));
      b.push(tinta(cyl(1.4, 0.55, 1.7, 10), M(0, 5.3, 0), oro));
      b.push(painted(cyl(1.5, 1.5, 0.2, 10), P.arancio, M(0, 6.2, 0)));
      b.push(painted(cyl(1.25, 1.25, 0.05, 10), P.legno, M(0, 6.3, 0)));
      for (const s of [-1, 1]) {
        b.push(painted(box(0.24, 1.1, 0.24), P.giallo, M(s * 1.75, 5.3, 0)));
        b.push(painted(box(0.6, 0.22, 0.24), P.arancio, M(s * 1.5, 5.85, 0)));
        b.push(painted(box(0.6, 0.22, 0.24), P.arancio, M(s * 1.35, 4.75, 0)));
      }
      b.push(painted(box(0.5, 0.5, 0.06), P.pietraChiara, M(0, 5.2, -1.03, -0.3, 0, 0))); // targa con la stella
      b.push(painted(box(0.24, 0.24, 0.07), P.rosso, M(0, 5.2, -1.05, -0.3, 0, Math.PI / 4)));
      break;
    }
    case 'statua_trofeo': {
      // podio 1-2-3 e la statua gigante del manichino col cappellino rosso che alza il trofeo
      b.push(painted(box(7.6, 0.25, 3.4), P.pietra, M(0, 0.12, 0)));
      for (const [n, x, h] of [['2', -2.35, 1.3], ['1', 0, 2.0], ['3', 2.35, 0.9]] as const) {
        b.push(painted(box(2.3, h, 2.4), P.pietraChiara, M(x, 0.25 + h / 2, 0)));
        b.push(painted(box(2.42, 0.14, 2.52), P.pietra, M(x, 0.25 + h - 0.07, 0)));
        pixel(b, CIFRE[n]!, { X: P.neroCaldo }, 0.16, x, 0.25 + h * 0.5, -1.215);
      }
      const fiori = [P.rosso, P.giallo, P.rosaNeon, P.pietraChiara];
      for (let i = 0; i < 12; i++) b.push(painted(otto(0.22), i % 3 ? fiori[i % 4]! : P.erbaScura, M(-3.5 + i * 0.64, 0.38, -1.95 + (i % 2) * 0.25, 0, i, 0)));
      gruppo(b, M(0, 2.25, 0, 0, 0, 0, 3.3, 3.3, 3.3), manichino);
      break;
    }
    case 'torre_corse': {
      // torre di controllo: fusto di pietra chiara, fascia a scacchi, cabina vetrata accesa, tetto rosso a punta, altoparlanti
      b.push(painted(box(3.6, 6.6, 3.6), P.pietraChiara, M(0, 3.3, 0)));
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.push(painted(box(0.45, 6.6, 0.45), P.pietra, M(sx * 1.7, 3.3, sz * 1.7)));
      b.push(painted(box(1.1, 2.0, 0.08), P.legnoScuro, M(0, 1.0, -1.82)));
      for (let k = 0; k < 4; k++) {
        const a = (k * Math.PI) / 2, sx = Math.sin(a), sz = -Math.cos(a);
        scacchiera(b, 8, 2, 0.4, sx * 1.95, 5.9, sz * 1.95, -a);
        for (const y of [3.0, 4.4]) b.push(painted(box(0.6, 0.8, 0.06), P.roccia, M(sx * 1.82, y, sz * 1.82, 0, -a, 0)));
        l.push(painted(box(3.0, 1.2, 0.06), P.giallo, M(sx * 2.03, 7.9, sz * 2.03, 0, -a, 0)));
        for (const o of [-0.75, 0, 0.75]) b.push(painted(box(0.1, 1.3, 0.1), P.roccia, M(sx * 2.07 + Math.cos(a) * o, 7.9, sz * 2.07 + Math.sin(a) * o)));
      }
      b.push(painted(box(5.0, 0.25, 5.0), P.pietra, M(0, 6.75, 0)));
      for (const s of [-1, 1]) { b.push(painted(box(5.0, 0.08, 0.08), P.roccia, M(0, 7.3, s * 2.45)), painted(box(0.08, 0.08, 5.0), P.roccia, M(s * 2.45, 7.3, 0))); }
      b.push(painted(box(4.0, 0.5, 4.0), P.pietraChiara, M(0, 7.1, 0)), painted(box(4.0, 0.4, 4.0), P.pietraChiara, M(0, 8.7, 0)));
      b.push(painted(box(4.6, 0.2, 4.6), P.rosso, M(0, 9.0, 0)), painted(cono(3.4, 1.9, 4), P.rosso, M(0, 10.05, 0, 0, Math.PI / 4, 0)));
      b.push(painted(cyl(0.05, 0.05, 1.4, 5), P.pietra, M(0, 11.5, 0)));
      scacchi(b, 3, 2, 0.28, 0.45, 11.9, 0, 0, 0.04);
      for (const s of [-1, 1]) { // altoparlanti agli angoli davanti
        b.push(painted(box(0.12, 0.12, 0.5), P.roccia, M(s * 2.05, 8.75, -2.05, 0, s * Math.PI / 4, 0)));
        b.push(painted(cono(0.32, 0.6, 6), P.pietraScura, M(s * 2.3, 8.75, -2.3, Math.PI / 2, -s * Math.PI / 4, 0)));
      }
      break;
    }
    case 'garage_corse': {
      // garage dei piloti: muri chiari, tetto a due falde scuro, portone aperto sull'officina, insegna con la chiave inglese
      b.push(painted(box(9.6, 0.16, 7.6), P.pietra, M(0, 0.08, 0)));
      b.push(painted(box(9.0, 4.2, 0.3), P.pietraChiara, M(0, 2.1, 3.4)));
      for (const s of [-1, 1]) {
        b.push(painted(box(0.3, 4.2, 7.1), P.pietraChiara, M(s * 4.35, 2.1, 0)));
        b.push(painted(box(1.6, 4.2, 0.3), P.pietraChiara, M(s * 3.7, 2.1, -3.4)));
        b.push(painted(box(0.4, 4.2, 0.4), P.pietra, M(s * 4.4, 2.1, -3.45)));
      }
      b.push(painted(box(5.8, 1.0, 0.3), P.pietraChiara, M(0, 3.7, -3.4)));
      b.push(painted(box(8.3, 3.2, 0.05), P.roccia, M(0, 1.75, 3.2)), painted(box(8.2, 0.03, 6.5), P.pietraScura, M(0, 0.18, 0)));
      // officina: armadi rossi degli attrezzi, banco, gomme, kart in riparazione
      for (const x of [-3.2, -1.8, 2.6]) {
        b.push(painted(box(1.3, 1.1, 0.6), P.rosso, M(x, 0.75, 2.8)));
        for (const y of [0.55, 0.8, 1.05]) b.push(painted(box(1.1, 0.04, 0.05), P.neroCaldo, M(x, y, 2.48)));
      }
      b.push(painted(box(1.8, 0.1, 0.8), P.legno, M(0.2, 1.0, 2.75)), painted(box(0.5, 0.4, 0.3), P.giallo, M(0.6, 1.25, 2.75)));
      for (let h = 0; h < 3; h++) b.push(painted(cyl(0.4, 0.4, 0.28, 8), P.neroCaldo, M(3.6, 0.3 + h * 0.28, 1.2)));
      b.push(painted(box(1.2, 0.5, 2.0), P.giallo, M(-0.6, 0.45, 0.4, 0, 0.4, 0)), painted(box(0.9, 0.35, 0.6), P.roccia, M(-0.75, 0.85, 0.9, 0, 0.4, 0))); // kart sotto il telo
      // timpani e tetto
      const prisma = new THREE.CylinderGeometry(1, 1, 1, 3, 1, false, Math.PI / 2).rotateZ(Math.PI / 2);
      b.push(painted(prisma, P.pietraChiara, M(0, 4.2 + 0.5 * (1.5 / 1.5), 0, 0, 0, 0, 8.9, 1.5 / 1.5, 7.0 / 1.732)));
      for (const s of [-1, 1]) b.push(painted(box(10.0, 0.25, 4.3), P.roccia, M(0, 5.0, s * 1.85, s * 0.4, 0, 0)));
      b.push(painted(box(10.1, 0.3, 0.4), P.pietraScura, M(0, 5.75, 0)));
      // insegna: pannello scuro con la chiave inglese, due lampade sopra
      b.push(painted(box(3.6, 1.2, 0.15), P.pietra, M(0, 3.7, -3.6)), painted(box(3.3, 0.95, 0.1), P.neroCaldo, M(0, 3.7, -3.66)));
      pixel(b, ['X.X.........X.X', 'XXX.........XXX', '.XXXXXXXXXXXXX.', 'XXX.........XXX', 'X.X.........X.X'], { X: P.pietraChiara }, 0.16, 0, 3.7, -3.72);
      for (const s of [-1, 1]) { b.push(painted(box(0.08, 0.08, 0.6), P.neroCaldo, M(s * 1.2, 4.45, -3.8))); l.push(painted(box(0.3, 0.18, 0.3), P.giallo, M(s * 1.2, 4.35, -4.05))); }
      l.push(painted(box(5.4, 0.12, 0.12), P.giallo, M(0, 3.1, -3.0))); // luce dell'officina
      // finestra accesa sul fianco destro (+X) e sul retro
      l.push(painted(box(0.05, 1.0, 2.0), P.giallo, M(4.52, 2.4, 0.4)), painted(box(2.0, 1.0, 0.05), P.giallo, M(-1.5, 2.4, 3.57)));
      b.push(painted(box(0.1, 0.12, 2.3), P.legnoScuro, M(4.55, 1.85, 0.4)), painted(box(0.1, 1.1, 0.12), P.legnoScuro, M(4.56, 2.4, 0.4)));
      // fuori: gomme, coni, casse, bandiera a scacchi
      for (let c = 0; c < 2; c++) for (let h = 0; h < 4 - c; h++) b.push(painted(cyl(0.42, 0.42, 0.3, 8), (c + h) % 3 === 1 ? P.pietraChiara : P.neroCaldo, M(5.3 + c * 0.9, 0.15 + h * 0.3, -3.2)));
      for (const [x, z] of [[-5.0, -4.3], [3.4, -4.9]] as const) {
        b.push(painted(box(0.5, 0.06, 0.5), P.arancio, M(x, 0.03, z)), painted(cono(0.24, 0.75, 6), P.arancio, M(x, 0.43, z)), painted(cyl(0.15, 0.18, 0.12, 6), P.pietraChiara, M(x, 0.45, z)));
      }
      for (const [x, z, h] of [[-5.3, -2.6, 0], [-5.3, -2.1, 1]] as const) b.push(painted(box(0.9, 0.9, 0.9), P.legnoChiaro, M(x, 0.45 + h * 0.9, z, 0, x + z, 0)), painted(box(0.92, 0.12, 0.92), P.legno, M(x, 0.45 + h * 0.9, z, 0, x + z, 0)));
      b.push(painted(cyl(0.06, 0.07, 5.0, 5), P.pietra, M(4.9, 2.5, -4.2)));
      scacchi(b, 4, 3, 0.36, 5.66, 4.4, -4.2, 0, 0.04);
      break;
    }
    case 'bancarella': {
      // banco di legno con la tenda a strisce rosse e bianche e la merce colorata
      b.push(painted(box(3.0, 1.0, 1.0), P.legnoChiaro, M(0, 0.5, -0.3)), painted(box(3.04, 0.12, 1.04), P.legno, M(0, 1.02, -0.3)));
      for (const s of [-1, 1]) for (const z of [-0.75, 0.75]) b.push(painted(box(0.12, 2.6, 0.12), P.legnoScuro, M(s * 1.45, 1.3, z)));
      for (let i = 0; i < 6; i++) b.push(painted(box(0.5, 0.08, 2.0), i % 2 ? P.pietraChiara : P.rosso, M(-1.25 + i * 0.5, 2.62, -0.2, -0.22, 0, 0)));
      for (let i = 0; i < 6; i++) b.push(painted(box(0.5, 0.28, 0.04), i % 2 ? P.rosso : P.pietraChiara, M(-1.25 + i * 0.5, 2.25, -1.2)));
      const merce = [P.giallo, P.arancio, P.rosso, P.erba, P.acquaBassa, P.viola];
      for (let i = 0; i < 9; i++) b.push(painted(i % 2 ? otto(0.17) : box(0.24, 0.22, 0.24), merce[i % 6]!, M(-1.25 + i * 0.31, 1.2, -0.45 + (i % 3) * 0.2, 0, i, 0)));
      b.push(painted(box(0.8, 0.8, 0.8), P.legno, M(1.0, 0.4, 0.75)), painted(box(0.6, 0.6, 0.6), P.legnoChiaro, M(-1.1, 0.3, 0.8, 0, 0.4, 0)));
      break;
    }
    case 'festone': {
      // due pali e il filo di bandierine colorate (9 m lungo X)
      for (const s of [-1, 1]) b.push(painted(cyl(0.07, 0.09, 4.2, 5), P.legnoScuro, M(s * 4.5, 2.1, 0)), painted(ico(0.12, 0), P.giallo, M(s * 4.5, 4.25, 0)));
      const yAt = (x: number) => 3.95 - 0.75 * (1 - (x / 4.5) * (x / 4.5));
      for (let i = 0; i < 4; i++) { const x0 = -4.5 + i * 2.25, x1 = x0 + 2.25; b.push(trave(P.neroCaldo, x0, yAt(x0), x1, yAt(x1), 0, 0.04)); }
      for (let i = 0; i < 12; i++) { const x = -4.1 + i * 0.745; b.push(triangolo(0.55, 0.7, FESTA[i % FESTA.length]!, M(x, yAt(x) - 0.02, 0))); }
      break;
    }
    case 'lampione': {
      // lampione scuro con la lanterna accesa e lo stendardo rosso
      b.push(painted(box(0.5, 0.3, 0.5), P.neroCaldo, M(0, 0.15, 0)));
      b.push(painted(cyl(0.08, 0.11, 3.6, 6), P.neroCaldo, M(0, 1.95, 0)));
      b.push(painted(box(0.3, 0.12, 0.3), P.roccia, M(0, 3.72, 0)), painted(box(0.5, 0.08, 0.5), P.neroCaldo, M(0, 3.82, 0)));
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.push(painted(box(0.05, 0.5, 0.05), P.neroCaldo, M(sx * 0.2, 4.1, sz * 0.2)));
      b.push(painted(cono(0.4, 0.38, 4), P.neroCaldo, M(0, 4.52, 0, 0, Math.PI / 4, 0)));
      l.push(painted(box(0.34, 0.44, 0.34), P.giallo, M(0, 4.08, 0)));
      b.push(painted(box(0.7, 0.05, 0.05), P.neroCaldo, M(0.35, 3.35, 0)));
      b.push(painted(box(0.5, 1.1, 0.04), P.rosso, M(0.45, 2.75, 0)), painted(box(0.22, 0.22, 0.06), P.giallo, M(0.45, 2.85, 0, 0, 0, Math.PI / 4)));
      break;
    }
    case 'palo_molo': {
      // palo del molo che esce dall'acqua, con la lanterna in cima
      b.push(painted(cyl(0.2, 0.23, 2.7, 6), P.legnoScuro, M(0, -0.25, 0)));
      b.push(painted(cyl(0.24, 0.24, 0.12, 6), P.legno, M(0, 0.6, 0)));
      b.push(painted(box(0.36, 0.08, 0.36), P.neroCaldo, M(0, 1.14, 0)), painted(cono(0.3, 0.3, 4), P.neroCaldo, M(0, 1.6, 0, 0, Math.PI / 4, 0)));
      l.push(painted(box(0.28, 0.32, 0.28), P.giallo, M(0, 1.34, 0)));
      break;
    }
    case 'porta_neve': porta(b, l, 'neve'); break;
    case 'porta_giungla': porta(b, l, 'giungla'); break;
    case 'porta_neon': porta(b, l, 'neon'); break;
    case 'porta_luna': porta(b, l, 'luna'); break;
    case 'porta_spiaggia': porta(b, l, 'spiaggia'); break;
    case 'ruota_panoramica': {
      // ruota panoramica (piano XY, asse lungo Z): basamento, cavalletti, due cerchioni rossi, raggi, cabine colorate, lampadine
      const C = 8.2, R = 6, N = 8;
      b.push(painted(box(8.0, 0.4, 4.2), P.pietra, M(0, 0.2, 0)), painted(box(2.4, 1.2, 1.6), P.rosso, M(0, 0.9, -1.4)));
      for (const z of [-1.2, 1.2]) for (const s of [-1, 1]) b.push(trave(P.pietraChiara, s * 3.4, 0.4, 0, C, z, 0.32));
      for (const z of [-1.2, 1.2]) b.push(trave(P.pietraChiara, -2.4, 2.6, 2.4, 2.6, z, 0.2));
      b.push(painted(cylPieno(0.4, 0.4, 2.8, 8), P.roccia, M(0, C, 0, Math.PI / 2, 0, 0)));
      for (const z of [-0.5, 0.5]) {
        for (let i = 0; i < 16; i++) { const a0 = (i / 16) * Math.PI * 2, a1 = ((i + 1) / 16) * Math.PI * 2; b.push(trave(P.rosso, Math.cos(a0) * R, C + Math.sin(a0) * R, Math.cos(a1) * R, C + Math.sin(a1) * R, z, 0.26)); }
        for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 + 0.2; b.push(trave(P.pietraChiara, 0, C, Math.cos(a) * R, C + Math.sin(a) * R, z, 0.1)); }
        for (let i = 0; i < 16; i++) { const a = ((i + 0.5) / 16) * Math.PI * 2; l.push(painted(otto(0.14), i % 2 ? P.giallo : P.rosaNeon, M(Math.cos(a) * R, C + Math.sin(a) * R, z * 1.35))); }
      }
      const cab = [P.rosso, P.giallo, P.acqua, P.viola, P.arancio, P.erba];
      for (let i = 0; i < N; i++) {
        const a = (i / N) * Math.PI * 2 + 0.31, x = Math.cos(a) * R, y = C + Math.sin(a) * R;
        b.push(painted(box(0.08, 0.6, 0.08), P.roccia, M(x, y - 0.3, 0)));
        b.push(painted(box(1.1, 0.85, 1.0), cab[i % 6]!, M(x, y - 1.0, 0)), painted(box(1.3, 0.14, 1.2), P.pietraChiara, M(x, y - 0.52, 0)));
        b.push(painted(box(1.12, 0.22, 1.02), P.neroCaldo, M(x, y - 0.85, 0)));
      }
      b.push(painted(cyl(0.04, 0.04, 1.6, 4), P.pietra, M(0, C + 1.1, -1.4)), painted(box(0.7, 0.4, 0.04), P.rosso, M(0.35, C + 1.7, -1.4)));
      break;
    }
    case 'tendone': case 'tendone_piccolo': {
      // tendone del circo: parete e tetto a spicchi rossi e bianchi (gialli e rossi il piccolo), festoncini, bandiera, ingresso
      const k = kind === 'tendone' ? 1 : 0.6, cols = kind === 'tendone' ? [P.rosso, P.pietraChiara] : [P.giallo, P.rosso];
      b.push(tinta(cyl(4.2 * k, 4.2 * k, 2.4 * k, 12), M(0, 1.2 * k, 0), spicchi(cols, 12)));
      b.push(tinta(cono(4.7 * k, 3.4 * k, 12), M(0, 2.4 * k + 1.7 * k, 0), spicchi(cols, 12)));
      for (let i = 0; i < 12; i++) { const a = ((i + 0.5) / 12) * Math.PI * 2; b.push(painted(box(1.9 * k, 0.32 * k, 0.06), i % 2 ? cols[1]! : cols[0]!, M(Math.cos(a) * 4.62 * k, 2.3 * k, Math.sin(a) * 4.62 * k, 0, -a + Math.PI / 2, 0))); }
      b.push(painted(cyl(0.06, 0.06, 1.4 * k, 4), P.legnoScuro, M(0, 5.8 * k + 0.3, 0)), painted(box(0.8 * k, 0.45 * k, 0.04), cols[0] === P.rosso ? P.giallo : P.rosso, M(0.4 * k, 6.3 * k + 0.3, 0)));
      b.push(painted(box(1.8 * k, 1.9 * k, 0.6), P.neroCaldo, M(0, 0.95 * k, -4.0 * k)), painted(box(2.2 * k, 0.3 * k, 0.9), cols[0]!, M(0, 2.0 * k, -4.2 * k)));
      for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; l.push(painted(box(0.18, 0.18, 0.18), i % 2 ? P.giallo : P.ambraNeon, M(Math.cos(a) * 4.75 * k, 2.4 * k, Math.sin(a) * 4.75 * k))); }
      break;
    }
    case 'tempio_giungla': {
      // piramide a gradoni coperta di muschio, scalinata, tempietto in cima con gli occhi accesi, bracieri
      const pietra = (n: THREE.Vector3, c: THREE.Vector3) => (n.y > 0.5 ? (Math.sin(c.x * 1.7 + c.z * 2.3) > -0.2 ? P.erbaScura : P.pietra) : (Math.floor(c.y / 0.5) % 3 === 0 ? P.pietraScura : P.pietra));
      for (const [w, y, h] of [[10, 0.75, 1.5], [8, 2.25, 1.5], [6, 3.75, 1.5], [4.2, 5.1, 1.2]] as const) b.push(tinta(new THREE.BoxGeometry(w, h, w, 2, 1, 2), M(0, y, 0), pietra));
      for (let i = 0; i < 10; i++) { const h = 0.57 * (i + 1); b.push(painted(box(2.4, h, 0.36), i % 2 ? P.pietraChiara : P.pietra, M(0, h / 2, -5.4 + 0.35 * i))); }
      b.push(painted(box(3.0, 2.0, 3.0), P.pietra, M(0, 6.7, 0)), painted(box(3.6, 0.45, 3.6), P.pietraScura, M(0, 7.9, 0)), painted(cono(2.0, 1.2, 4), P.pietraScura, M(0, 8.7, 0, 0, Math.PI / 4, 0)));
      b.push(painted(box(1.2, 1.4, 0.06), P.neroCaldo, M(0, 6.4, -1.53)), painted(box(1.8, 0.25, 0.2), P.pietraScura, M(0, 7.6, -1.58)));
      for (const s of [-1, 1]) { l.push(painted(box(0.36, 0.22, 0.06), P.rossoNeon, M(s * 0.5, 7.3, -1.55))); b.push(painted(box(0.6, 0.12, 0.12), P.roccia, M(s * 0.5, 7.47, -1.58, 0, 0, s * 0.3))); }
      for (const s of [-1, 1]) {
        b.push(painted(cyl(0.25, 0.32, 0.9, 6), P.pietraScura, M(s * 2.2, 1.95, -4.4)), painted(cyl(0.5, 0.3, 0.35, 6), P.roccia, M(s * 2.2, 2.55, -4.4)));
        l.push(painted(cono(0.38, 0.9, 5), P.arancio, M(s * 2.2, 3.1, -4.4)), painted(cono(0.2, 0.6, 4), P.giallo, M(s * 2.2 + 0.08, 3.0, -4.45)));
      }
      for (const [x, y, z, h] of [[-3.2, 2.4, -4.03, 1.6], [3.6, 2.6, -4.03, 1.2], [-2.0, 4.0, -3.03, 1.4], [2.4, 3.9, -3.03, 1.8], [-1.6, 5.4, -2.13, 1.0], [5.03, 2.5, 1.0, 1.4], [4.03, 3.8, -1.5, 1.2]] as const) {
        b.push(painted(box(0.14, h, 0.1), P.bosco, M(x, y - h / 2 + 0.6, z, 0, Math.abs(x) > 4.5 ? Math.PI / 2 : 0, 0)));
      }
      for (const [x, y, z, r] of [[-4.6, 1.5, -4.6, 0.55], [4.4, 1.5, 3.8, 0.6], [-3.6, 3.0, 2.8, 0.5], [2.8, 4.5, -2.8, 0.4]] as const) b.push(painted(ico(r, 0), P.erbaScura, M(x, y + r * 0.3, z, x, z, 0, 1.3, 0.7, 1.3)));
      break;
    }
    case 'palazzo_neon': case 'palazzo_neon_basso': {
      // palazzo della città al neon: corpo scuro a piani, finestre accese ambra e ciano, tubi rosa sugli spigoli, insegna sul tetto
      const alto = kind === 'palazzo_neon', H = alto ? 14 : 8, L = alto ? 4.2 : 4.6, piani = alto ? 4 : 2;
      const corpo = alto ? P.roccia : P.viola;
      b.push(painted(box(L, H, L), corpo, M(0, H / 2, 0)));
      for (let f = 1; f <= piani; f++) b.push(painted(box(L + 0.12, 0.18, L + 0.12), P.neroCaldo, M(0, f * (H / (piani + 0.4)), 0)));
      const vetri = [P.ambraNeon, P.cianoNeon, P.ambraNeon, P.rosaNeon];
      for (let k = 0; k < 4; k++) {
        const a = (k * Math.PI) / 2, sx = Math.sin(a), sz = -Math.cos(a), cx = Math.cos(a), cz = Math.sin(a);
        for (let f = 0; f < piani; f++) for (let c = 0; c < 3; c++) {
          const y = 1.8 + f * (H / (piani + 0.4)), o = (c - 1) * (L / 3.2), acceso = (f * 3 + c + k) % 5 !== 2;
          const g = painted(box(0.8, 1.2, 0.06), acceso ? vetri[(f + c + k) % 4]! : P.neroCaldo, M(sx * (L / 2 + 0.02) + cx * o, y, sz * (L / 2 + 0.02) + cz * o, 0, -a, 0));
          (acceso ? l : b).push(g);
        }
      }
      for (const [dx, dz, c] of [[-1, -1, P.rosaNeon], [1, -1, P.cianoNeon], [1, 1, P.rosaNeon]] as const) l.push(painted(box(0.12, H - 1, 0.12), c, M(dx * (L / 2 + 0.05), H / 2, dz * (L / 2 + 0.05))));
      b.push(painted(box(L + 0.3, 0.4, L + 0.3), P.neroCaldo, M(0, H + 0.2, 0)));
      if (alto) {
        b.push(painted(cyl(0.05, 0.08, 3.0, 4), P.pietraScura, M(1.2, H + 1.9, 1.2)));
        l.push(painted(box(0.25, 0.25, 0.25), P.rossoNeon, M(1.2, H + 3.4, 1.2)));
        b.push(painted(box(3.4, 1.8, 0.2), P.neroCaldo, M(-0.2, H + 1.4, -0.6)));
        for (const s of [-1, 1]) {
          l.push(painted(box(3.0, 1.4, 0.06), P.violaNeon, M(-0.2, H + 1.4, -0.6 + s * 0.13)));
          pixel(l, ['.C.C.', 'CCCCC', 'CCCCC', '.CCC.', '..C..'], { C: P.rosaNeon }, 0.22, -0.2, H + 1.4, -0.6 + s * 0.17, s < 0 ? 0 : Math.PI);
        }
      } else {
        b.push(painted(box(L * 0.8, 0.12, 1.0), P.cianoNeon, M(0, 2.9, -L / 2 - 0.5, -0.25, 0, 0)));
        l.push(painted(box(L * 0.7, 0.6, 0.08), P.cianoNeon, M(0, 3.5, -L / 2 - 0.06)), painted(box(L * 0.7, 0.6, 0.08), P.rosaNeon, M(L / 2 + 0.06, 3.5, 0, 0, Math.PI / 2, 0)));
        b.push(painted(box(1.2, 0.6, 1.2), P.pietraScura, M(-0.8, H + 0.7, 0.8)));
      }
      break;
    }
    case 'faro': {
      // faro a fasce bianche e rosse sugli scogli, lanterna accesa, cappello rosso, casetta del guardiano
      for (const [x, z, r] of [[1.6, 0.8, 1.0], [-1.4, 1.2, 0.9], [0.4, -1.8, 0.8], [-1.6, -1.0, 0.7], [2.0, -0.8, 0.6]] as const) b.push(tinta(new THREE.DodecahedronGeometry(r, 0), M(x, r * 0.4, z, x, z, 0.2), (n) => (n.y > 0.5 ? P.pietra : P.pietraScura)));
      b.push(painted(cyl(1.9, 2.1, 1.0, 8), P.pietra, M(0, 0.5, 0)));
      for (let i = 0; i < 5; i++) b.push(painted(cyl(1.45 - (i + 1) * 0.08, 1.45 - i * 0.08, 1.5, 8), i % 2 ? P.rosso : P.pietraChiara, M(0, 1.75 + i * 1.5, 0)));
      b.push(painted(box(0.6, 1.2, 0.1), P.legnoScuro, M(0, 1.6, -1.42)));
      for (const y of [4.2, 6.6]) b.push(painted(box(0.35, 0.5, 0.08), P.roccia, M(0, y, -1.28 + (y - 4.2) * -0.04)));
      b.push(painted(cyl(1.55, 1.55, 0.25, 8), P.roccia, M(0, 8.62, 0)));
      for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; b.push(painted(box(0.06, 0.5, 0.06), P.roccia, M(Math.cos(a) * 1.45, 8.95, Math.sin(a) * 1.45))); }
      l.push(painted(cyl(0.8, 0.8, 1.0, 8), P.giallo, M(0, 9.25, 0)));
      for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2 + 0.4; b.push(painted(box(0.08, 1.0, 0.08), P.neroCaldo, M(Math.cos(a) * 0.82, 9.25, Math.sin(a) * 0.82))); }
      b.push(painted(cono(1.15, 1.0, 8), P.rosso, M(0, 10.25, 0)), painted(ico(0.15, 0), P.neroCaldo, M(0, 10.8, 0)));
      b.push(painted(box(2.2, 1.6, 2.0), P.pietraChiara, M(2.6, 0.8, 1.8)), painted(cono(1.75, 1.0, 4), P.rosso, M(2.6, 2.1, 1.8, 0, Math.PI / 4, 0)));
      l.push(painted(box(0.6, 0.5, 0.05), P.giallo, M(2.6, 0.9, 0.78)));
      break;
    }
    case 'ombrellone': {
      // ombrellone a spicchi rossi e bianchi con l'asciugamano
      b.push(painted(cyl(0.05, 0.05, 2.4, 5), P.pietraChiara, M(0, 1.2, 0, 0.08, 0, 0)));
      b.push(tinta(cono(1.5, 0.6, 8), M(0, 2.5, 0.1), spicchi([P.rosso, P.pietraChiara], 8)));
      b.push(painted(box(0.9, 0.04, 1.8), P.giallo, M(1.1, 0.02, 0.2, 0, 0.2, 0)), painted(box(0.9, 0.05, 0.3), P.acqua, M(1.1, 0.03, 0.2, 0, 0.2, 0)));
      b.push(painted(cyl(0.18, 0.14, 0.25, 6), P.acqua, M(-0.7, 0.12, 0.6)));
      break;
    }
    case 'albero_tondo': {
      b.push(painted(cyl(0.15, 0.22, 1.8, 5), P.legno, M(0, 0.9, 0)));
      b.push(painted(ico(1.35, 0), P.erba, M(0, 2.7, 0, 0.3, 0, 0, 1, 0.9, 1)));
      b.push(painted(otto(1.0), P.erbaScura, M(0.6, 2.2, 0.4, 0, 0.5, 0)));
      b.push(painted(otto(0.75), P.erbaChiara, M(-0.35, 3.35, -0.3, 0.4, 0.2, 0)));
      break;
    }
    case 'albero_giungla': {
      // albero della giungla: tronco storto, chioma larga a piani, liane
      b.push(painted(cyl(0.16, 0.26, 2.8, 5), P.legnoScuro, M(0.1, 1.4, 0, 0, 0, -0.08)));
      b.push(painted(cyl(0.12, 0.16, 2.4, 5), P.legnoScuro, M(0.05, 3.8, 0.1, 0.12, 0, 0.1)));
      b.push(painted(ico(1.8, 0), P.bosco, M(0, 5.0, 0, 0.2, 0.3, 0, 1.4, 0.55, 1.4)));
      b.push(painted(otto(1.4), P.erbaScura, M(0.3, 5.7, -0.2, 0, 0.8, 0, 1.3, 0.55, 1.3)));
      b.push(painted(otto(1.0), P.erba, M(-0.6, 6.15, 0.3, 0.3, 0.4, 0, 1.2, 0.6, 1.2)));
      for (const [x, z, h] of [[1.6, 0.6, 1.8], [-1.4, -0.8, 1.4], [0.4, 1.7, 2.0]] as const) b.push(painted(box(0.08, h, 0.08), P.bosco, M(x, 4.7 - h / 2, z)));
      break;
    }
    case 'chiazza_neve': {
      b.push(painted(cyl(3.0, 3.1, 0.06, 7), P.pietraChiara, M(0, 0.03, 0, 0, 0, 0, 1, 1, 0.75)));
      b.push(painted(cyl(1.7, 1.8, 0.08, 6), P.sabbiaChiara, M(0.7, 0.05, 0.3, 0, 0.5, 0)));
      for (const [x, z, r] of [[-1.6, 0.4, 0.5], [1.8, -0.6, 0.4]] as const) b.push(painted(otto(r), P.pietraChiara, M(x, r * 0.2, z, 0, x, 0, 1.3, 0.5, 1.3)));
      break;
    }
    default: break;
  }
  return { b, l };
}

/** Decorazioni dell'Isola delle Corse (corpo, materiale illuminato). */
export function propCorse(kind: TemaProp): G {
  const { b, l } = costruisci(kind);
  for (const g of l) g.dispose();
  return merged(b);
}
/** Parte che brilla (materiale non illuminato: lanterne, finestre, neon, lampadine, fuochi); quali kind ce l'hanno: CORSE_GLOW in island_temi.ts. */
export function propCorseGlow(kind: TemaProp): G | null {
  const { b, l } = costruisci(kind);
  for (const g of b) g.dispose();
  return l.length ? merged(l) : null;
}
