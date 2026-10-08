// Meteo (#85): il tempo che fa, uguale per tutti perché deriva solo dall'orologio (ms dall'epoca, passati dal chiamante) e da un seed
// fisso dei contenuti. Il tempo è diviso in cicli di `cicloMin` minuti; ogni ciclo ha la sua sequenza di periodi, estratta da
// createRng(`${seed}:${ciclo}`): così basta il numero del ciclo per sapere che tempo fa, senza simulare il passato.
// L'intensità `k` (0..1) sale e scende a gradini (es. 5 passi in 40 s) all'inizio e alla fine di ogni periodo: niente passaggi lisci.
import { METEO } from '@marea/content';
import type { MeteoCfg, MeteoStato } from '@marea/content';
import { createRng } from './rng.ts';

export const METEO_STATI: readonly MeteoStato[] = ['sereno', 'nuvoloso', 'pioggia', 'nebbia', 'vento'];
/** Un periodo del ciclo, in ms dall'epoca: [da, a). */
export type MeteoPeriodo = { stato: MeteoStato; da: number; a: number };
export type MeteoOra = {
  stato: MeteoStato;
  /** 0..1 a gradini: quanto è forte (0 col sereno, e all'inizio e alla fine di ogni periodo). */
  k: number;
  da: number; a: number;
  /** Lo stato del periodo dopo (per i test e per chi vuole annunciarlo). */
  prossimo: MeteoStato;
};

const MIN = 60_000;
const cache = new Map<string, MeteoPeriodo[]>();

/** I periodi del ciclo numero `c` (dall'epoca). Deterministico: stesso cfg e stesso c, stessi periodi. */
export function periodiMeteo(c: number, cfg: MeteoCfg = METEO): MeteoPeriodo[] {
  const key = `${cfg.seed}:${c}`;
  const hit = cache.get(key);
  if (hit && cfg === METEO) return hit;
  const rng = createRng(key);
  const L = cfg.cicloMin * MIN, t0 = c * L, fine = t0 + L, minimo = cfg.minimoMin * MIN;
  const dur = (s: MeteoStato) => { const [a, b] = cfg.stati[s].durataMin; return Math.round((a + rng.next() * (b - a)) * 6) * 10_000; }; // a passi di 10 s
  const out: MeteoPeriodo[] = [];
  let t = t0, prev: MeteoStato = 'sereno';
  const push = (s: MeteoStato, d: number) => { const last = out[out.length - 1]; if (last && last.stato === s) last.a = t + d; else out.push({ stato: s, da: t, a: t + d }); t += d; prev = s; };
  push('sereno', dur('sereno')); // ogni ciclo parte sereno: i bordi tra cicli sono sempre puliti
  while (t < fine) {
    const resta = fine - t;
    if (resta < minimo) { push('sereno', resta); break; }
    const scelte = METEO_STATI.filter((s) => s !== prev);
    const tot = scelte.reduce((n, s) => n + cfg.stati[s].peso, 0);
    let r = rng.next() * tot, s: MeteoStato = scelte[scelte.length - 1]!;
    for (const x of scelte) { r -= cfg.stati[x].peso; if (r < 0) { s = x; break; } }
    push(s, Math.min(dur(s), resta));
  }
  if (cfg === METEO) { if (cache.size > 64) cache.clear(); cache.set(key, out); }
  return out;
}

/** Il tempo che fa all'istante `ms` (Date.now del chiamante). */
export function meteoAt(ms: number, cfg: MeteoCfg = METEO): MeteoOra {
  const L = cfg.cicloMin * MIN, c = Math.floor(ms / L);
  const ps = periodiMeteo(c, cfg);
  let i = ps.findIndex((p) => ms >= p.da && ms < p.a);
  if (i < 0) i = ps.length - 1;
  const p = ps[i]!;
  const next = ps[i + 1] ?? periodiMeteo(c + 1, cfg)[0]!;
  if (p.stato === 'sereno') return { stato: 'sereno', k: 0, da: p.da, a: p.a, prossimo: next.stato };
  const T = cfg.transizioneS * 1000, n = Math.max(1, cfg.gradini);
  const raw = Math.max(0, Math.min(1, (ms - p.da) / T, (p.a - ms) / T));
  return { stato: p.stato, k: Math.floor(raw * n + 1e-9) / n, da: p.da, a: p.a, prossimo: next.stato };
}
