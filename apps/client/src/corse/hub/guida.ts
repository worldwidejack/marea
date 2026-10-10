// La guida libera nell'hub delle Corse (docs/CORSE.md A3, #185): il veicolo gira l'isola aperta, fuori dalle piste. Nell'hub non si vince
// niente, quindi gira solo nel client (niente sim, niente replay): qui si può usare Math.sin/cos. Deve sembrare la guida delle gare,
// quindi rifà le regole di `@marea/sim/corse/veicolo.ts` coi numeri di `packages/content/src/corse/motore.json` (stessa velocità,
// accelerazione, sterzo progressivo con la curva del joystick e la rampa, presa, drift a 3 livelli col turbo all'uscita, acrobazie,
// retromarcia), ma su terreno libero in coordinate del mondo:
// - quota da `MondoHub.quota` (le barche galleggiano sul mare), pendenza che frena in salita e spinge in discesa, inclinazione dalla
//   normale del terreno;
// - salti quando il terreno scende sotto le ruote più in fretta della gravità del motore (dossi, trampolini), atterraggi duri che frenano;
// - superfici del mondo → superfici del motore (strada = asfalto, erba, sabbia, neve = sabbia, legno, acqua), per famiglia;
// - ostacoli tondi e bordo `fuori`: si rimbalza (morbido, mai incastrati); gradini troppo alti = muro.
// Passo fisso 60 Hz. Convenzione: muso = (sin yaw, cos yaw) nel piano (x, z), destra = (−cos yaw, sin yaw).
// In fondo il pilota automatico (`creaPilota`): A* sul terreno guidabile (strade preferite) fino a una meta (per i test e le foto).
import { CORSE } from '@marea/content/corse.ts';
import type { CVeicoloDef } from '@marea/content/corse.ts';
import type { InputFrame } from '@marea/sim';
import { curvaSterzo } from '@marea/sim/corse/gara.ts';
import { effetto, veicoloCorse } from '@marea/sim/corse/pista.ts';
import { livelloDrift } from '@marea/sim/corse/veicolo.ts';
import type { MondoHub, Superficie } from './mappa.ts';

const DT = 1 / 60;
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
/** Raggio del veicolo contro ostacoli e bordo (m). */
const RAGGIO = CORSE.veicolo.raggio;
/** Quanto deve staccarsi il terreno sotto le ruote, in un tick, per volare (m): sotto si resta attaccati (niente saltelli sulle gobbe). */
const STACCO = 0.035;
/** Rimbalzo contro ostacoli e bordo: parte della velocità d'urto che torna indietro, e quanta velocità resta dopo. */
const RIMBALZO = 0.35, ATTRITO_URTO = 0.82;

export type AutoHub = {
  id: string;
  x: number; y: number; z: number;
  /** Muso e moto: versori nel piano (x, z). */
  hx: number; hz: number; mx: number; mz: number;
  /** Velocità lungo il moto (m/s, negativa = retro) e verticale (m/s). */
  v: number; vy: number;
  aria: boolean;
  /** Come `Veicolo` della sim (gli effetti e i suoni del client li leggono uguali). */
  drift: number; carica: number; daBottone: boolean; tenuto: number; st: number;
  turbo: number; livello: number; acro: number; fermo: number; scia: number;
  /** Superficie del mondo sotto e quella del motore che vale (asfalto, erba…). */
  sup: Superficie; supId: string;
  /** Normale del terreno sotto (smussata): l'inclinazione del veicolo. */
  nx: number; ny: number; nz: number;
  /** Ultimo urto (m/s contro ostacolo, bordo o muro) e ultimo atterraggio (m/s verticali): la resa li legge e li azzera. */
  urto: number; atterrato: number;
  salti: number; urti: number;
};

/** Il motore → la superficie: chi ha l'acqua sotto (o è sotto il livello del mare) è in acqua. */
function supMotore(s: Superficie, acqua: boolean): string {
  if (acqua || s === 'acqua') return 'acqua';
  return s === 'strada' || s === 'roccia' ? 'asfalto' : s === 'neve' ? 'sabbia' : s;
}
/** Quota dove stanno le ruote: le barche (famiglia acqua) galleggiano, le ruote guadano (si vedono le ruote a mollo, non spariscono). */
export function suolo(m: MondoHub, x: number, z: number, galleggia: boolean): number {
  const q = m.quota(x, z);
  return galleggia ? Math.max(q, m.mare) : Math.max(q, m.mare - 0.45);
}

export function nuovaAuto(m: MondoHub, id: string, x: number, z: number, yaw: number): AutoHub {
  const a: AutoHub = {
    id, x, y: 0, z, hx: Math.sin(yaw), hz: Math.cos(yaw), mx: Math.sin(yaw), mz: Math.cos(yaw), v: 0, vy: 0, aria: false,
    drift: 0, carica: 0, daBottone: false, tenuto: -1, st: 0, turbo: 0, livello: 0, acro: 0, fermo: 0, scia: 0,
    sup: 'strada', supId: 'asfalto', nx: 0, ny: 1, nz: 0, urto: 0, atterrato: 0, salti: 0, urti: 0,
  };
  metti(m, a, x, z, yaw);
  return a;
}
/** Teletrasporto (partenza al molo, ritorno davanti a una porta, test): fermo, dritto, a terra. */
export function metti(m: MondoHub, a: AutoHub, x: number, z: number, yaw: number): void {
  const V = veicoloCorse(a.id);
  a.x = x; a.z = z; a.hx = a.mx = Math.sin(yaw); a.hz = a.mz = Math.cos(yaw);
  a.y = suolo(m, x, z, V.famiglia === 'acqua'); a.v = 0; a.vy = 0; a.aria = false;
  a.drift = 0; a.carica = 0; a.turbo = 0; a.livello = 0; a.acro = 0; a.st = 0;
  normale(m, a, 1);
}
export const yawDi = (a: AutoHub): number => Math.atan2(a.hx, a.hz);

/** Lo sterzo del giocatore: curva del joystick e rampa per i tasti, come `sterzoGiocatore` di gara.ts. */
function sterzoGiocatore(a: AutoHub, mx: number): number {
  const S = CORSE.sterzo, x = curvaSterzo(mx), ab = Math.abs(mx);
  if (ab > 0.001 && ab < 0.999) return (a.st = x);
  const sale = Math.abs(x) > Math.abs(a.st) && x * a.st >= 0, passo = (sale ? S.rampa : S.ritorno) * DT;
  a.st += clamp(x - a.st, -passo, passo);
  return a.st;
}
/** Gira il versore (f) verso destra di `ang` rad. */
function giraDestra(fx: number, fz: number, ang: number): [number, number] {
  const c = Math.cos(ang), s = Math.sin(ang);
  // destra = (−fz, fx)
  const nx = fx * c - fz * s, nz = fz * c + fx * s, n = Math.hypot(nx, nz) || 1;
  return [nx / n, nz / n];
}
function normale(m: MondoHub, a: AutoHub, k: number): void {
  const g = veicoloCorse(a.id).famiglia === 'acqua', d = 0.9;
  const dx = (suolo(m, a.x + d, a.z, g) - suolo(m, a.x - d, a.z, g)) / (2 * d), dz = (suolo(m, a.x, a.z + d, g) - suolo(m, a.x, a.z - d, g)) / (2 * d);
  let nx = -dx, ny = 1, nz = -dz;
  const n = Math.hypot(nx, ny, nz); nx /= n; ny /= n; nz /= n;
  a.nx += (nx - a.nx) * k; a.ny += (ny - a.ny) * k; a.nz += (nz - a.nz) * k;
  const l = Math.hypot(a.nx, a.ny, a.nz) || 1; a.nx /= l; a.ny /= l; a.nz /= l;
}
/** Rimbalzo della velocità contro una parete di normale (nx, nz) (verso fuori dalla parete). */
function rimbalza(a: AutoHub, nx: number, nz: number, minimo = 0): void {
  let vx = a.mx * a.v, vz = a.mz * a.v;
  const vn = vx * nx + vz * nz;
  if (vn < 0) {
    vx -= (1 + RIMBALZO) * vn * nx; vz -= (1 + RIMBALZO) * vn * nz;
    vx *= ATTRITO_URTO; vz *= ATTRITO_URTO;
    a.urto = Math.max(a.urto, -vn); a.urti++;
    if (a.drift) a.carica = 0; // contro il muro la carica del drift si perde (come in gara)
  }
  // un minimo di spinta verso fuori (porte chiuse): non si resta mai appoggiati
  const vn2 = vx * nx + vz * nz;
  if (minimo > 0 && vn2 < minimo) { vx += (minimo - vn2) * nx; vz += (minimo - vn2) * nz; }
  const sp = Math.hypot(vx, vz);
  if (sp < 0.01) { a.v = 0; return; }
  // il moto prende la direzione nuova; se va contro il muso è retromarcia
  if (vx * a.hx + vz * a.hz >= 0) { a.mx = vx / sp; a.mz = vz / sp; a.v = sp; } else { a.mx = -vx / sp; a.mz = -vz / sp; a.v = -sp; }
}
/** Respinge il veicolo da un punto (porte chiuse): normale dal punto verso il veicolo, almeno `forza` m/s verso fuori. */
export function respingi(a: AutoHub, px: number, pz: number, forza: number, nxDi = 0, nzDi = 1): void {
  let nx = a.x - px, nz = a.z - pz;
  const d = Math.hypot(nx, nz);
  if (d < 0.3) { nx = nxDi; nz = nzDi; } else { nx /= d; nz /= d; }
  rimbalza(a, nx, nz, forza);
  a.drift = 0; a.carica = 0;
}
/** Direzione verso dentro da un punto fuori (o sul bordo): media delle direzioni libere intorno. */
function versoDentro(m: MondoHub, x: number, z: number, vx: number, vz: number): [number, number] {
  let sx = 0, sz = 0;
  for (const r of [2.5, 6, 14]) {
    for (let i = 0; i < 12; i++) {
      const t = (i / 12) * Math.PI * 2, dx = Math.cos(t), dz = Math.sin(t);
      if (!m.fuori(x + dx * r, z + dz * r)) { sx += dx; sz += dz; }
    }
    if (sx * sx + sz * sz > 0.01) break;
  }
  const n = Math.hypot(sx, sz);
  if (n < 0.01) { const l = Math.hypot(vx, vz) || 1; return [-vx / l, -vz / l]; }
  return [sx / n, sz / n];
}

/** Un tick di guida (60 Hz). `f` come in gara: mx sterzo (−1..1, + destra), my gas (0..1) o freno/retro (−1), a = DRIFT tenuto. */
export function guida(m: MondoHub, a: AutoHub, f: InputFrame): void {
  const C = CORSE, K = C.veicolo, D = C.drift, S = C.sterzo, G = C.gravita;
  const V: CVeicoloDef = veicoloCorse(a.id), F = C.famiglie[V.famiglia], galleggia = V.famiglia === 'acqua';
  a.tenuto = f.a ? (a.tenuto >= 0 ? a.tenuto + DT : 0) : -1;
  let sterzo = sterzoGiocatore(a, clamp(f.mx, -1, 1));
  const gas = clamp(f.my, -1, 1), btn = f.a;
  // DRIFT premuto in aria = acrobazia (turbo all'atterraggio)
  if (a.aria) a.acro = a.acro > 0 ? a.acro + DT : btn && a.tenuto === 0 && !a.drift ? DT : 0;
  const q = m.quota(a.x, a.z);
  a.sup = m.superficie(a.x, a.z);
  a.supId = supMotore(a.sup, q < m.mare - 0.05);
  const E = effetto(V, a.supId);
  if (V.tira) sterzo = clamp(sterzo + V.tira, -1, 1);
  const terra = !a.aria;
  // ---- drift: come la sim (bottone, lato scelto entro `pronto` s, 3 livelli, turbo lasciando) ----
  const sa = Math.abs(sterzo);
  if (terra) {
    if (!a.drift) {
      if (btn && a.tenuto >= 0 && a.tenuto <= D.pronto && sa >= D.tieniSterzo && a.v >= D.velocitaMin) { a.drift = sterzo > 0 ? 1 : -1; a.carica = 0; a.daBottone = true; }
    } else {
      const tiene = btn && a.v >= D.velocitaMin * 0.7 && gas > 0;
      if (!tiene) {
        const lv = livelloDrift(a.carica);
        if (lv) daiTurbo(a, D.spinta[lv - 1]!, lv);
        a.drift = 0; a.carica = 0;
      } else a.carica += DT * (1 + D.stringi * clamp(sterzo * a.drift, -1, 1));
    }
  }
  // ---- velocità ----
  let top = V.velocita * E.velocita;
  if (a.turbo > 0) { top *= 1 + D.turbo; a.turbo = Math.max(0, a.turbo - DT); if (a.turbo === 0) a.livello = 0; }
  if (terra) {
    const acc = a.turbo > 0 ? D.turboAccelerazione : V.accelerazione * E.accelerazione * (a.v < 0 ? 2 : 1);
    if (gas > 0.05) {
      const t = top * gas;
      if (a.v < t) a.v = Math.min(t, a.v + acc * DT);
      else a.v = Math.max(t, a.v - (E.velocita < 0.9 ? K.frenata : K.folle * 2) * DT);
    } else if (gas < -0.3) {
      a.v = a.v > 0 ? Math.max(0, a.v - K.frenata * DT) : Math.max(-K.retro, a.v - V.accelerazione * 0.5 * DT);
    } else a.v = a.v > 0 ? Math.max(0, a.v - K.folle * DT) : Math.min(0, a.v + K.folle * DT);
    // la pendenza lungo il moto: in salita frena, in discesa spinge (come la sim)
    const d = 0.8, dh = (suolo(m, a.x + a.mx * d, a.z + a.mz * d, galleggia) - suolo(m, a.x - a.mx * d, a.z - a.mz * d, galleggia)) / (2 * d);
    a.v -= G * (dh / Math.sqrt(1 + dh * dh)) * F.pendenza * DT;
  }
  // ---- sterzo ----
  const presa = Math.min(1, Math.abs(a.v) / K.sterzoPieno) * (a.v < 0 ? -1 : 1);
  const alto = 1 - (F.sterzoAlto ?? S.alto) * clamp((Math.abs(a.v) - S.da) / Math.max(1, V.velocita - S.da), 0, 1);
  const giri = a.drift ? a.drift * V.sterzo * V.drift * D.giro * (D.tieni[0] + D.tieni[1] * sterzo * a.drift) : sterzo * V.sterzo * S.normale * alto;
  if (terra) {
    [a.hx, a.hz] = giraDestra(a.hx, a.hz, giri * presa * DT);
    const g = Math.min(0.45, (a.drift ? V.presaDrift : V.presa) * E.presa * DT);
    const nx = a.mx + (a.hx - a.mx) * g, nz = a.mz + (a.hz - a.mz) * g, n = Math.hypot(nx, nz);
    if (n > 1e-6) { a.mx = nx / n; a.mz = nz / n; }
  } else [a.hx, a.hz] = giraDestra(a.hx, a.hz, giri * presa * 0.3 * DT); // in aria il muso si gira un filo, il moto no
  // ---- moto nel piano, con ostacoli, bordo e gradini ----
  let nx = a.x + a.mx * a.v * DT, nz = a.z + a.mz * a.v * DT;
  if (m.fuori(a.x, a.z)) { // già fuori (un teletrasporto): verso dentro piano piano
    const [dx, dz] = versoDentro(m, a.x, a.z, a.mx * a.v, a.mz * a.v);
    nx = a.x + dx * 0.5; nz = a.z + dz * 0.5; rimbalza(a, dx, dz, 2);
  } else if (m.fuori(nx, nz)) {
    const [dx, dz] = versoDentro(m, nx, nz, a.mx * a.v, a.mz * a.v);
    rimbalza(a, dx, dz, 1.5);
    nx = a.x + dx * 0.05; nz = a.z + dz * 0.05;
    if (m.fuori(nx, nz)) { nx = a.x; nz = a.z; }
  }
  for (const o of m.ostacoli(nx, nz, RAGGIO + 4)) {
    const dx = nx - o.x, dz = nz - o.z, d = Math.hypot(dx, dz), min = o.r + RAGGIO;
    if (d >= min) continue;
    const ux = d > 1e-4 ? dx / d : -a.mx, uz = d > 1e-4 ? dz / d : -a.mz;
    nx = o.x + ux * (min + 0.01); nz = o.z + uz * (min + 0.01);
    rimbalza(a, ux, uz);
  }
  const g1 = suolo(m, nx, nz, galleggia), passo = Math.hypot(nx - a.x, nz - a.z);
  if (g1 - a.y > Math.max(0.5, passo * 1.4 + 0.25) && !(a.aria && a.y > g1)) {
    // un gradino troppo alto (un muro, il bordo di un molo alto): si rimbalza indietro, si resta qui
    const l = Math.hypot(nx - a.x, nz - a.z) || 1;
    rimbalza(a, -(nx - a.x) / l, -(nz - a.z) / l, 1);
    nx = a.x; nz = a.z;
  } else { a.x = nx; a.z = nz; }
  // ---- in verticale: a terra si segue il terreno finché non scende più in fretta della gravità, poi si vola ----
  const g = suolo(m, a.x, a.z, galleggia);
  if (!a.aria) {
    const yb = a.y + a.vy * DT - 0.5 * G * DT * DT;
    if (g < yb - STACCO && a.v > 4) { a.aria = true; a.y = yb; a.vy -= G * DT; a.salti++; }
    else {
      // la velocità verticale a terra = velocità × pendenza del tratto appena fatto (2 m): su un trampolino si stacca con quella della
      // rampa, un gradino (il bordo di un molo) dà al massimo un saltello invece di sparare il veicolo in cielo
      const verso = a.v < 0 ? -1 : 1, dietro = suolo(m, a.x - a.mx * verso * 2, a.z - a.mz * verso * 2, galleggia);
      a.vy = clamp(Math.abs(a.v) * (g - dietro) / 2, -30, 30); a.y = g;
    }
  } else {
    a.vy -= G * DT; a.y += a.vy * DT;
    if (a.y <= g) {
      const urto = -a.vy;
      a.y = g; a.vy = 0; a.aria = false; a.atterrato = Math.max(a.atterrato, urto);
      if (urto > C.atterraggio.duro) a.v *= C.atterraggio.perdita;
      if (a.acro > 0) daiTurbo(a, C.acrobazia.turbo, 2);
      a.acro = 0;
    }
  }
  normale(m, a, a.aria ? 0.04 : 0.3);
}

function daiTurbo(a: AutoHub, sec: number, livello: number): void {
  a.turbo = Math.min(CORSE.turbo.max, a.turbo + sec); // sommati, come in gara (regola «somma» di serie accesa)
  a.livello = livello;
}

// ---------- pilota automatico: percorso sul terreno guidabile fino a una meta ----------
export type Pilota = {
  /** Calcola il percorso verso (x, z) dal punto dove sta il veicolo. */
  verso(a: AutoHub, x: number, z: number): void;
  /** L'input del prossimo tick (come un giocatore: sterzo, gas, drift nelle curve prese forte). */
  comandi(a: AutoHub): InputFrame;
  /** Il percorso rimasto (per i test). */
  readonly punti: [number, number][];
};

export function creaPilota(m: MondoHub): Pilota {
  // Il percorso: A* su una griglia di celle da 3 m del mondo intero. Si passa dove c'è terra (niente mare, niente bordo `fuori`, niente
  // ostacoli, niente gradini oltre ~1 m tra celle vicine); strade e moli costano meno di prati e sabbia, così le strade si seguono da sé
  // (anche dove la pianta non le disegna, come il molo). La griglia si calcola alla prima rotta (il mondo è fermo).
  const C = 3, [x0, z0] = m.pianta.min, nx = Math.max(1, Math.ceil((m.pianta.max[0] - x0) / C)), nz = Math.max(1, Math.ceil((m.pianta.max[1] - z0) / C));
  let costo: Float32Array | null = null, alto: Float32Array | null = null;
  const cx0 = (i: number) => x0 + (i + 0.5) * C, cz0 = (j: number) => z0 + (j + 0.5) * C;
  function griglia(): void {
    costo = new Float32Array(nx * nz); alto = new Float32Array(nx * nz);
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const x = cx0(i), z = cz0(j), k = j * nx + i, q = m.quota(x, z);
      alto[k] = q;
      if (m.fuori(x, z) || q < m.mare - 0.2 || m.ostacoli(x, z, 1.4).some((o) => Math.hypot(o.x - x, o.z - z) < o.r + 1.4)) { costo[k] = 0; continue; }
      const sup = m.superficie(x, z);
      costo[k] = sup === 'strada' || sup === 'legno' ? 1 : sup === 'acqua' ? 6 : 2.2;
    }
  }
  const cella = (x: number, z: number) => [Math.min(nx - 1, Math.max(0, Math.floor((x - x0) / C))), Math.min(nz - 1, Math.max(0, Math.floor((z - z0) / C)))] as const;
  /** La cella libera più vicina a (x, z) (anche la meta: la porta può stare sul bordo di un ostacolo). */
  function libera(x: number, z: number): number {
    const [ci, cj] = cella(x, z);
    for (let r = 0; r < 12; r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
      if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
      const i = ci + di, j = cj + dj;
      if (i >= 0 && j >= 0 && i < nx && j < nz && costo![j * nx + i]! > 0) return j * nx + i;
    }
    return -1;
  }
  function astar(da: number, a: number): number[] {
    const n = nx * nz, g = new Float32Array(n).fill(Infinity), prima = new Int32Array(n).fill(-1), chiusa = new Uint8Array(n);
    const ai = a % nx, aj = Math.floor(a / nx), h = (k: number) => Math.hypot((k % nx) - ai, Math.floor(k / nx) - aj);
    // coda a priorità (heap binario) di [f, cella]
    const heap: [number, number][] = [];
    const push = (f: number, k: number) => { heap.push([f, k]); let c = heap.length - 1; while (c > 0) { const p = (c - 1) >> 1; if (heap[p]![0] <= heap[c]![0]) break; [heap[p], heap[c]] = [heap[c]!, heap[p]!]; c = p; } };
    const pop = () => { const top = heap[0]!, last = heap.pop()!; if (heap.length) { heap[0] = last; let c = 0; for (;;) { const l = 2 * c + 1, r = l + 1; let m2 = c; if (l < heap.length && heap[l]![0] < heap[m2]![0]) m2 = l; if (r < heap.length && heap[r]![0] < heap[m2]![0]) m2 = r; if (m2 === c) break; [heap[m2], heap[c]] = [heap[c]!, heap[m2]!]; c = m2; } } return top; };
    g[da] = 0; push(h(da), da);
    while (heap.length) {
      const [, u] = pop();
      if (chiusa[u]) continue;
      chiusa[u] = 1;
      if (u === a) break;
      const ui = u % nx, uj = Math.floor(u / nx);
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue;
        const i = ui + di, j = uj + dj; if (i < 0 || j < 0 || i >= nx || j >= nz) continue;
        const w = j * nx + i, cw = costo![w]!;
        if (!cw || chiusa[w] || Math.abs(alto![w]! - alto![u]!) > 1.1) continue;
        if (di && dj && (!costo![uj * nx + i] || !costo![j * nx + ui])) continue; // niente diagonali tra due celle chiuse
        const d = g[u]! + (di && dj ? 1.414 : 1) * (cw + costo![u]!) / 2;
        if (d < g[w]!) { g[w] = d; prima[w] = u; push(d + h(w), w); }
      }
    }
    if (prima[a]! < 0 && a !== da) return [];
    const out: number[] = [];
    for (let u = a; u >= 0; u = prima[u]!) out.push(u);
    return out.reverse();
  }
  let punti: [number, number][] = [];
  let retro = 0, retroSterzo = 0, controllo = 0, cx = 0, cz = 0;

  return {
    get punti() { return punti; },
    verso(a, x, z) {
      punti = [];
      if (!costo) griglia();
      const da = libera(a.x, a.z), meta = libera(x, z);
      // un punto ogni due celle (6 m): il pilota guarda avanti e smussa da sé
      if (da >= 0 && meta >= 0) astar(da, meta).forEach((k, i, l) => { if (i % 2 === 0 || i === l.length - 1) punti.push([cx0(k % nx), cz0(Math.floor(k / nx))]); });
      punti.push([x, z]);
      retro = 0; controllo = 0; cx = a.x; cz = a.z;
    },
    comandi(a) {
      // i punti già passati si tolgono (anche quelli che si raggiungono tagliando)
      while (punti.length > 1 && Math.hypot(punti[0]![0] - a.x, punti[0]![1] - a.z) < 5) punti.shift();
      if (!punti.length) return { mx: 0, my: -1, a: false, b: false };
      // incastrato (fermo contro un ostacolo, o che rimbalza contro un muro senza andare avanti): retromarcia sterzando, poi si riprova
      if (retro > 0) { retro--; return { mx: retroSterzo, my: -1, a: false, b: false }; }
      if (++controllo >= 75) {
        if (Math.hypot(a.x - cx, a.z - cz) < 4) { retro = 50; retroSterzo = Math.random() < 0.5 ? -1 : 1; }
        controllo = 0; cx = a.x; cz = a.z;
      }
      // punta un punto più avanti lungo il percorso (più lontano quando si va forte)
      const guarda = 5 + Math.abs(a.v) * 0.35;
      let tx = punti[0]![0], tz = punti[0]![1];
      for (let i = 0; i < punti.length - 1; i++) {
        if (Math.hypot(punti[i]![0] - a.x, punti[i]![1] - a.z) >= guarda) break;
        tx = punti[i + 1]![0]; tz = punti[i + 1]![1];
      }
      let dx = tx - a.x, dz = tz - a.z;
      // gli ostacoli davanti: si scarta dalla parte libera
      for (const o of m.ostacoli(a.x + a.hx * 6, a.z + a.hz * 6, 8)) {
        const ox = o.x - a.x, oz = o.z - a.z, av = ox * a.hx + oz * a.hz, lat = ox * -a.hz + oz * a.hx; // lat > 0 = a destra
        if (av > 0 && av < 12 && Math.abs(lat) < o.r + RAGGIO + 1.2) { const s = lat > 0 ? -1 : 1; dx += -a.hz * s * 6; dz += a.hx * s * 6; }
      }
      // l'angolo verso la meta, col segno: > 0 = a destra (destra del muso = (−fz, fx)); il muso conta metà, il moto l'altra metà
      const fx = 0.5 * a.hx + 0.5 * a.mx, fz = 0.5 * a.hz + 0.5 * a.mz;
      const angD = Math.atan2(dx * -fz + dz * fx, dx * fx + dz * fz), quanto = Math.abs(angD);
      const ultimo = punti.length === 1 && Math.hypot(dx, dz) < 14;
      const sterzo = clamp(angD * 2.4, -1, 1);
      const gas = quanto > 1.9 && a.v > 6 ? -1 : ultimo ? 0.55 : quanto > 0.9 ? 0.6 : 1;
      // drift nelle curve prese forte (come il pilota delle gare): si tiene finché la curva non è finita
      const drift = a.drift ? Math.abs(angD) > 0.12 && Math.sign(angD) === a.drift : Math.abs(angD) > 0.45 && Math.abs(angD) < 1.4 && a.v > 12 && !ultimo;
      return { mx: sterzo, my: gas, a: drift, b: false };
    },
  };
}
