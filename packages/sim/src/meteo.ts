// Meteo (#361, rifatto il 16 ott 2026 sulla decisione di Jack del 14 ott; prima #85 era uno stato solo per tutto il mondo).
// Nuvole che si muovono sopra l'arcipelago e decidono il meteo del posto dove sono: piove sotto la nuvola di pioggia, non ovunque.
// Uguale per tutti: posizione, tipo e forma di ogni nuvola dipendono solo dall'orologio (ms dall'epoca, passati dal chiamante) e dal
// seed dei contenuti. Niente stato da simulare: le nuvole vivono in `corsie`; ogni corsia ogni `cicloMin` minuti estrae da
// createRng(`seed:n:corsia:giro`) se nasce una nuvola, quando, quanto vive, tipo, grandezza e punto di partenza. La strada fatta è
// velocità di base × tempo più il vento (livello a gradini ogni `periodoMin`, integrato esattamente): col vento corrono tutte insieme.
// Il campo è un toro: chi esce da un lato rientra dall'altro, e vicino al bordo la nuvola si scioglie (lì non c'è nessuno a guardare).
// Tutto a gradini (`gradini` passi): la nuvola che nasce e si scioglie, il meteo del posto che sale e scende entrando e uscendo.
// Solo + − × ÷ e Math.sqrt; seno e coseno da trig.ts (stessi bit su ogni motore).
import { METEO } from '@marea/content';
import type { MeteoCfg, MeteoStato, NuvolaTipo } from '@marea/content';
import { createRng } from './rng.ts';
import { atan2, cos, sin } from './trig.ts';

export const NUVOLA_TIPI: readonly NuvolaTipo[] = ['bianca', 'grigia', 'pioggia', 'temporale'];
export const METEO_STATI: readonly MeteoStato[] = ['sereno', ...NUVOLA_TIPI];

/** Una nuvola all'istante chiesto. L'ellisse ha il semiasse `rx` nel verso in cui va (dx, dz) e `rz` di traverso. */
export type Nuvola = {
  /** `corsia:giro`: lo stesso per tutti, cambia a ogni nuvola nuova. */
  id: string;
  tipo: NuvolaTipo;
  x: number; z: number; rx: number; rz: number;
  /** Verso in cui va (versore): è anche l'asse lungo dell'ellisse. */
  dx: number; dz: number;
  /** 0..1 a gradini: cresce quando nasce, si scioglie quando muore e vicino al bordo del campo. */
  k: number;
  /** Seme a 32 bit della forma (i batuffoli li dispone il client, uguali per tutti). */
  forma: number;
  nata: number; muore: number;
};
/** Il tempo che fa in un punto. */
export type MeteoQui = {
  /** La nuvola che ci sta sopra di più ('sereno' se nessuna); a pari intensità vince la più pesante. */
  stato: MeteoStato;
  /** 0..1 a gradini: quanto ci sei dentro (sale attraversando il bordo della nuvola). */
  k: number;
  /** 0..1 a gradini: quanto piove (nuvole di pioggia e temporale, entro `pioggiaR` del raggio). */
  pioggia: number;
  /** 0..1 a gradini: quanto sei dentro un temporale (lampi vicini, tuoni forti). */
  lampi: number;
  /** 0..1 a gradini: vento (quello di tutto il mondo, più forte nei temporali). */
  vento: number;
  /** Per tipo, quanto ci sei dentro. */
  tipi: Record<NuvolaTipo, number>;
};
export type Lampo = { x: number; z: number; da: number; a: number; seme: number };

const MIN = 60_000;
const gradino = (v: number, n: number): number => Math.floor((v <= 0 ? 0 : v >= 1 ? 1 : v) * n + 1e-9) / n;
const wrap = (v: number, a: number, b: number): number => { const w = b - a, r = (v - a) % w; return a + (r < 0 ? r + w : r); };
const scegli = (r: number, pesi: readonly number[]): number => {
  let t = r * pesi.reduce((s, p) => s + p, 0);
  for (let i = 0; i < pesi.length; i++) { t -= pesi[i]!; if (t < 0) return i; }
  return pesi.length - 1;
};

type Base = Omit<Nuvola, 'x' | 'z' | 'k'> & { x0: number; z0: number };
type Cache = { corsie: Map<string, Base | null>; livelli: Map<number, number>; versi: Map<number, number> };
const cache = new WeakMap<MeteoCfg, Cache>();
const dellaCfg = (cfg: MeteoCfg): Cache => {
  let c = cache.get(cfg);
  if (!c) { c = { corsie: new Map(), livelli: new Map(), versi: new Map() }; cache.set(cfg, c); }
  if (c.corsie.size > 512) c.corsie.clear();
  if (c.livelli.size > 256) c.livelli.clear();
  if (c.versi.size > 64) c.versi.clear();
  return c;
};

const variantiCache = new Map<string, MeteoCfg>();
/** I numeri del meteo: quelli di serie (A) o la variante B della prova per Jack (#361), uguale per tutti quelli che la scelgono. */
export function meteoCfg(variante: 'A' | 'B' = 'A', cfg: MeteoCfg = METEO): MeteoCfg {
  if (variante === 'A' || !cfg.provaB) return cfg;
  let b = variantiCache.get(cfg.seed);
  if (!b) { b = { ...cfg, nuvole: { ...cfg.nuvole, ...cfg.provaB } }; variantiCache.set(cfg.seed, b); }
  return b;
}

// ---------- vento ----------
/** Livello del vento nel periodo `p` (0..1, uno dei `livelli` estratto per `pesi`). */
function livello(p: number, cfg: MeteoCfg): number {
  const c = dellaCfg(cfg), hit = c.livelli.get(p);
  if (hit !== undefined) return hit;
  const v = cfg.vento.livelli[scegli(createRng(`${cfg.seed}:v:${p}`).next(), cfg.vento.pesi)] ?? 0;
  c.livelli.set(p, v);
  return v;
}
/** Angolo (rad, 0 = +x, π/2 = +z) del verso in cui soffia il vento nell'ora `h`. */
function verso(h: number, cfg: MeteoCfg): number {
  const c = dellaCfg(cfg), hit = c.versi.get(h);
  if (hit !== undefined) return hit;
  const [vx, vz] = cfg.vento.verso, sb = (cfg.vento.sbandamentoGradi * Math.PI) / 180;
  const a = atan2(vz, vx) + (createRng(`${cfg.seed}:d:${h}`).next() * 2 - 1) * sb;
  c.versi.set(h, a);
  return a;
}
/** Integrale del vento da inizio periodo per `tau` ms (livello × s): rampa di `gradini` passi da `l0` a `l1`, poi `l1`. */
function integraPeriodo(tau: number, l0: number, l1: number, cfg: MeteoCfg): number {
  const n = Math.max(1, cfg.gradini), T = cfg.vento.transizioneS * 1000, h = T / n, d = l1 - l0;
  const rampa = (m: number, resto: number) => (h * (m * l0 + (d * m * (m + 1)) / (2 * n)) + resto * (l0 + (d * Math.min(n, m + 1)) / n)) / 1000;
  if (tau <= T) { const m = Math.floor(tau / h); return rampa(m, tau - m * h); }
  return rampa(n, 0) + ((tau - T) * l1) / 1000;
}
/** ∫ vento dt tra `a` e `b` (ms), in livello × secondi. */
export function ventoIntegrale(a: number, b: number, cfg: MeteoCfg = METEO): number {
  if (b <= a) return 0;
  const P = cfg.vento.periodoMin * MIN;
  let s = 0;
  for (let p = Math.floor(a / P); p * P < b; p++) {
    const t0 = p * P, l0 = livello(p - 1, cfg), l1 = livello(p, cfg);
    s += integraPeriodo(Math.min(b, t0 + P) - t0, l0, l1, cfg) - integraPeriodo(Math.max(a, t0) - t0, l0, l1, cfg);
  }
  return s;
}
/** Il vento all'istante `ms`: livello a gradini (0..1) e verso (versore) dell'ora. */
export function ventoMeteoAt(ms: number, cfg: MeteoCfg = METEO): { k: number; dx: number; dz: number } {
  const P = cfg.vento.periodoMin * MIN, p = Math.floor(ms / P), l0 = livello(p - 1, cfg), l1 = livello(p, cfg);
  const n = Math.max(1, cfg.gradini), T = cfg.vento.transizioneS * 1000, dt = ms - p * P;
  const k = dt >= T ? l1 : l0 + ((l1 - l0) * Math.min(n, Math.floor(dt / (T / n)) + 1)) / n;
  const a = verso(Math.floor(ms / (cfg.vento.direzioneMin * MIN)), cfg);
  return { k, dx: cos(a), dz: sin(a) };
}

// ---------- nuvole ----------
/** La nuvola del giro `g` della corsia `j` (null se in quel giro non nasce). */
function base(j: number, g: number, cfg: MeteoCfg): Base | null {
  const c = dellaCfg(cfg), key = `${j}:${g}`;
  const hit = c.corsie.get(key);
  if (hit !== undefined) return hit;
  const N = cfg.nuvole, C = N.cicloMin * MIN, inizio = (j / N.corsie) * C + g * C;
  const rng = createRng(`${cfg.seed}:n:${key}`);
  let out: Base | null = null;
  if (rng.next() < N.nasce) {
    const nata = Math.floor(inizio + rng.next() * N.nasceEntroMin * MIN);
    const vita = Math.min(Math.floor(inizio + C) - nata, Math.floor((N.vitaMin[0] + rng.next() * (N.vitaMin[1] - N.vitaMin[0])) * MIN));
    const tipo = NUVOLA_TIPI[scegli(rng.next(), NUVOLA_TIPI.map((t) => cfg.tipi[t].peso))]!;
    const [r0, r1] = cfg.tipi[tipo].raggio, R = r0 + rng.next() * (r1 - r0);
    const [a0, a1] = N.allungamento, e = Math.sqrt(a0 + rng.next() * (a1 - a0));
    const [X0, Z0, X1, Z1] = cfg.campo;
    const x0 = X0 + rng.next() * (X1 - X0), z0 = Z0 + rng.next() * (Z1 - Z0);
    const a = verso(Math.floor(nata / (cfg.vento.direzioneMin * MIN)), cfg) + (rng.next() * 2 - 1) * 0.17; // ±10° dal vento dell'ora
    out = { id: key, tipo, rx: R * e, rz: R / e, dx: cos(a), dz: sin(a), forma: Math.floor(rng.next() * 4294967296), nata, muore: nata + vita, x0, z0 };
  }
  c.corsie.set(key, out);
  return out;
}
/** La nuvola `b` all'istante `ms` (presenza 0 fuori dalla sua vita). */
function adesso(b: Base, ms: number, cfg: MeteoCfg): Nuvola {
  const n = Math.max(1, cfg.gradini), T = cfg.nuvole.transizioneS * 1000;
  const vita = gradino(Math.min((ms - b.nata) / T, (b.muore - ms) / T), n);
  const s = (cfg.vento.nuvolaMs * (ms - b.nata)) / 1000 + cfg.vento.ventoMs * ventoIntegrale(b.nata, ms, cfg);
  const [X0, Z0, X1, Z1] = cfg.campo;
  const x = wrap(b.x0 + b.dx * s, X0, X1), z = wrap(b.z0 + b.dz * s, Z0, Z1);
  const bordo = gradino(Math.min(x - X0, X1 - x, z - Z0, Z1 - z) / cfg.bordoCampoM, n);
  return { id: b.id, tipo: b.tipo, x, z, rx: b.rx, rz: b.rz, dx: b.dx, dz: b.dz, k: Math.min(vita, bordo), forma: b.forma, nata: b.nata, muore: b.muore };
}
/** Le nuvole vive all'istante `ms` (Date.now del chiamante), con k > 0. Stesso istante e stessi numeri: stesse nuvole per tutti. */
export function nuvoleAt(ms: number, cfg: MeteoCfg = METEO): Nuvola[] {
  const C = cfg.nuvole.cicloMin * MIN, out: Nuvola[] = [];
  for (let j = 0; j < cfg.nuvole.corsie; j++) {
    const g = Math.floor((ms - (j / cfg.nuvole.corsie) * C) / C), b = base(j, g, cfg);
    if (!b || ms < b.nata || ms >= b.muore) continue;
    const n = adesso(b, ms, cfg);
    if (n.k > 0) out.push(n);
  }
  return out;
}
/** Distanza normalizzata di (x, z) dal centro della nuvola: 0 al centro, 1 sul bordo dell'ellisse (sul toro, l'immagine più vicina). */
export function distanzaNuvola(n: Nuvola, x: number, z: number, cfg: MeteoCfg = METEO): number {
  const [X0, Z0, X1, Z1] = cfg.campo, W = X1 - X0, H = Z1 - Z0;
  let ex = x - n.x, ez = z - n.z;
  ex -= W * Math.round(ex / W); ez -= H * Math.round(ez / H);
  const u = (ex * n.dx + ez * n.dz) / n.rx, v = (ez * n.dx - ex * n.dz) / n.rz;
  return Math.sqrt(u * u + v * v);
}
/** Il tempo che fa nel punto (x, z) all'istante `ms`. `nuvole` = nuvoleAt(ms, cfg) se già calcolate (o finte, nei test). */
export function meteoQui(ms: number, x: number, z: number, cfg: MeteoCfg = METEO, nuvole?: readonly Nuvola[]): MeteoQui {
  const n = Math.max(1, cfg.gradini), N = cfg.nuvole;
  const tipi: Record<NuvolaTipo, number> = { bianca: 0, grigia: 0, pioggia: 0, temporale: 0 };
  let pioggia = 0, lampi = 0;
  for (const c of nuvole ?? nuvoleAt(ms, cfg)) {
    if (c.k <= 0) continue;
    const r = distanzaNuvola(c, x, z, cfg);
    if (r >= 1) continue;
    const k = Math.min(c.k, gradino((1 - r) / N.bordo, n));
    if (k > tipi[c.tipo]) tipi[c.tipo] = k;
    if (c.tipo === 'pioggia' || c.tipo === 'temporale') {
      const kp = Math.min(c.k, gradino((N.pioggiaR - r) / (N.bordo * N.pioggiaR), n));
      if (kp > pioggia) pioggia = kp;
      if (c.tipo === 'temporale' && kp > lampi) lampi = kp;
    }
  }
  let stato: MeteoStato = 'sereno', k = 0;
  for (const t of NUVOLA_TIPI) if (tipi[t] > 0 && tipi[t] >= k) { stato = t; k = tipi[t]; } // a pari k vince la più pesante (ultima)
  return { stato, k, pioggia, lampi, vento: Math.max(ventoMeteoAt(ms, cfg).k, lampi), tipi };
}
/** Il lampo della nuvola `n` acceso all'istante `ms`, se c'è: solo i temporali formati (k = 1), uno ogni tanto, dentro la pioggia. */
export function lampoAt(ms: number, n: Nuvola, cfg: MeteoCfg = METEO): Lampo | null {
  if (n.tipo !== 'temporale' || n.k < 1) return null;
  const L = cfg.lampi.ogniS * 1000, s = Math.floor(ms / L);
  const rng = createRng(`${cfg.seed}:l:${n.id}:${s}`);
  if (rng.next() >= cfg.lampi.prob) return null;
  const da = s * L + Math.floor(rng.next() * (L - cfg.lampi.durataMs)), a = da + cfg.lampi.durataMs;
  if (ms < da || ms >= a) return null;
  let u = 0, v = 0;
  do { u = rng.next() * 2 - 1; v = rng.next() * 2 - 1; } while (u * u + v * v > 1);
  const f = cfg.nuvole.pioggiaR * 0.8, ux = u * f * n.rx, vz = v * f * n.rz;
  return { x: n.x + ux * n.dx - vz * n.dz, z: n.z + ux * n.dz + vz * n.dx, da, a, seme: Math.floor(rng.next() * 4294967296) };
}
