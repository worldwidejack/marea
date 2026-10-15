// I segreti dell'isola (docs/TEMPLARI.md §9c, 15 ott 2026, scelte di birbasan), come gli easter egg di COD Zombies:
// - La cripta: il muro crepato della rotonda si rompe solo con un colpo pesante (un colpo caricato in mischia, un'esplosione, una cannonata,
//   il Giudizio); i colpi leggeri fanno solo polvere (l'indizio). Dietro una scala scende nella cripta: il muro rotto e la scala in fondo
//   alla cripta sono i due capi della stessa scala (mappa.ts `Cripta`), la sim ci porta eroi e zombie e il flow field li tiene vicini.
//   Sull'altare la Lancia di Longino: si libera con le anime di `cripta.anime` zombie uccisi DENTRO la cripta, poi AZIONE la prende.
// - Le campanelle: sparse per l'isola, si suonano con AZIONE nell'ordine scritto sul muro della sacrestia (l'ordine lo sceglie il seed, con
//   un rng a parte). Sbagli = si ricomincia; tutte giuste = una pozione che non hai, gratis, a ognuno della squadra. Una volta per partita.
// - I teschi: nascosti; AZIONE tenuto su ognuno (come i fuochi, fuochi.ts `lavora`); al terzo parte la canzone segreta (solo client).
// Tutto della squadra (insieme valgono per tutti), tutto deterministico: il server rigioca uguale.
import { TEMPLARI, armaDef } from '@marea/content/templari.ts';
import { createRng } from '../rng.ts';
import { bfs, cellOf } from '../dungeon/map.ts';
import type { Arena } from './mappa.ts';
import type { TState, Zombie } from './stato.ts';
import { ev, haPozione, inPiedi, secToTicks, usa } from './stato.ts';
import { bevi } from './bottega.ts';

const r2 = (v: number): number => Math.round(v * 100) / 100;
const d2 = (ax: number, az: number, bx: number, bz: number): number => (ax - bx) * (ax - bx) + (az - bz) * (az - bz);

/** Lo stato dei segreti a inizio partita: niente rotto, nessuna anima, l'ordine delle campanelle di questa partita, nessun teschio. */
export function segretiNuovi(a: Arena, seed: number): TState['segreti'] {
  // l'ordine: Fisher-Yates sugli id in ordine alfabetico (non dipende da come è scritta la mappa), con un rng a parte
  const ids = a.campanelle.map((c) => c.id).sort(), r = createRng((seed ^ 0x3c6ef372) >>> 0);
  for (let i = ids.length - 1; i > 0; i--) { const j = r.int(0, i), x = ids[i]!; ids[i] = ids[j]!; ids[j] = x; }
  return { muro: false, anime: 0, polvere: -9999, ordine: ids, giuste: 0, campane: false, teschi: Object.fromEntries(a.teschi.map((t) => [t.id, false])) };
}
/** Qualcosa dei segreti è cambiato (l'hash delle partite che non li toccano resta quello di prima). */
export function segretiToccati(s: TState): boolean {
  const g = s.segreti;
  return g.muro || g.giuste > 0 || g.campane || Object.values(g.teschi).some(Boolean);
}

// ---------------- la cripta ----------------
export const criptaLibera = (s: TState): boolean => s.segreti.anime >= TEMPLARI.cripta.anime;
/** Il punto (x, z) sta nella cripta. */
export function inCripta(s: TState, x: number, z: number): boolean {
  const c = s.arena.cripta, i = cellOf(s.gr.percorso, x, z);
  return !!c && i >= 0 && c.dentro[i] === 1;
}

/** Il muro si rompe: la sua cella si apre per tutti (da lì si scende), gli zombie ricalcolano la strada. */
export function rompiMuro(s: TState): void {
  const c = s.arena.cripta;
  if (!c || s.segreti.muro) return;
  s.segreti.muro = true;
  const i = c.muro.cella;
  s.gr.eroe.solid[i] = 0; s.gr.zombie.solid[i] = 0; s.gr.percorso.solid[i] = 0;
  s.flowCell = -1; s.flowTick = -999; s.flowCelle = [];
  ev(s, { t: 'cripta', fase: 'muro' });
}
/** Un colpo arriva in (x, z) con raggio `r`: se tocca il muro crepato, pesante lo rompe, leggero fa polvere (non più di una ogni tanto). */
export function colpoMuro(s: TState, x: number, z: number, r: number, pesante: boolean): void {
  const c = s.arena.cripta;
  if (!c || s.segreti.muro || d2(x, z, c.muro.x, c.muro.z) > (r + 0.5) * (r + 0.5)) return;
  if (pesante) { rompiMuro(s); return; }
  if (s.tick - s.segreti.polvere < secToTicks(TEMPLARI.cripta.polvere)) return;
  s.segreti.polvere = s.tick;
  ev(s, { t: 'cripta', fase: 'polvere' });
}
/** Fine di un colpo in mischia dell'eroe di turno (eroe.ts): il muro a portata davanti (il giro: tutto attorno) prende il colpo; pesante =
 *  caricato. */
export function fendenteMuro(s: TState, portata: number, caricato: boolean, giro: boolean): void {
  const c = s.arena.cripta, h = s.eroe;
  if (!c || s.segreti.muro) return;
  const dx = c.muro.x - h.x, dz = c.muro.z - h.z, d = Math.sqrt(dx * dx + dz * dz);
  if (d > portata + 0.6 || (!giro && d > 1e-6 && (dx * h.fx + dz * h.fz) / d < 0.35)) return;
  colpoMuro(s, c.muro.x, c.muro.z, 0, caricato);
}

/** Il flow field degli zombie (zombie.ts) verso le celle `from`: col muro rotto i due capi della scala sono vicini (un passo). Con una scala
 *  sola, la strada più corta la usa al massimo una volta: distanza = min(dritta, fino a un capo + 1 + dall'altro capo). */
export function flusso(s: TState, from: number | readonly number[]): void {
  const g = s.gr.percorso, c = s.arena.cripta;
  bfs(g, from, s.flow);
  if (!c || !s.segreti.muro) return;
  const a = c.muro.cella, b = c.scala.cella, da = s.flow[a] ?? -1, db = s.flow[b] ?? -1;
  const via = (capo: number, dCapo: number) => {
    if (dCapo < 0) return;
    const d = bfs(g, capo);
    for (let i = 0; i < d.length; i++) { const x = d[i]!; if (x >= 0 && (s.flow[i]! < 0 || dCapo + 1 + x < s.flow[i]!)) s.flow[i] = dCapo + 1 + x; }
  };
  via(b, da); via(a, db);
}
/** Lo zombie sta su un capo della scala e il flow field dice di passare dall'altro: ci va (true = si è spostato, il passo è fatto). */
export function scalaZombie(s: TState, z: Zombie, qui: number): boolean {
  const c = s.arena.cripta;
  if (!c || !s.segreti.muro || qui < 0) return false;
  const altro = qui === c.muro.cella ? c.scala : qui === c.scala.cella ? c.muro : null;
  if (!altro) return false;
  const dq = s.flow[qui] ?? -1, da = s.flow[altro.cella] ?? -1;
  if (da < 0 || (dq >= 0 && da >= dq)) return false;
  z.x = altro.x; z.z = altro.z;
  ev(s, { t: 'scala', id: z.id, x: altro.x, z: altro.z });
  return true;
}
/** L'eroe di turno entra in un capo della scala: arriva davanti all'altro (scende nella cripta o torna in chiesa). */
export function scalaEroe(s: TState): void {
  const c = s.arena.cripta, h = s.eroe;
  if (!c || !s.segreti.muro) return;
  const i = cellOf(s.gr.eroe, h.x, h.z), dove = i === c.muro.cella ? c.giu : i === c.scala.cella ? c.su : null;
  if (!dove) return;
  h.x = dove.x; h.z = dove.z; h.fx = dove.fx; h.fz = dove.fz;
  ev(s, { t: 'scala', giu: dove === c.giu, x: dove.x, z: dove.z });
}
/** Uno zombie è morto (colpi.ts `uccidi`): se era nella cripta e l'altare è ancora sigillato, la sua anima va all'altare. */
export function anima(s: TState, z: Zombie): void {
  if (!s.segreti.muro || criptaLibera(s) || !inCripta(s, z.x, z.z)) return;
  s.segreti.anime++;
  ev(s, { t: 'anima', x: r2(z.x), z: r2(z.z), n: s.segreti.anime, tutte: TEMPLARI.cripta.anime });
  if (criptaLibera(s)) ev(s, { t: 'cripta', fase: 'libera' });
}
/** L'eroe di turno è all'altare della cripta. */
export function vicinoAltareCripta(s: TState): boolean {
  const c = s.arena.cripta, h = s.eroe, r = TEMPLARI.cripta.raggio;
  return !!c && s.segreti.muro && d2(c.altare.x, c.altare.z, h.x, h.z) <= r * r;
}
/** L'eroe di turno ha già l'arma della cripta. */
export const haLancia = (s: TState): boolean => s.eroe.armi.some((x) => x?.id === TEMPLARI.cripta.arma);
export const nomeLancia = (): string => armaDef(TEMPLARI.cripta.arma).nome;

// ---------------- le campanelle ----------------
/** La campanella a portata (la più vicina), o null. */
export function campanellaVicina(s: TState): string | null {
  const h = s.eroe, r = TEMPLARI.campanelle.raggio;
  let best: string | null = null, bd = r * r;
  for (const c of s.arena.campanelle) { const d = d2(c.x, c.z, h.x, h.z); if (d <= bd) { bd = d; best = c.id; } }
  return best;
}
/** AZIONE su una campanella: giusta = un passo avanti nell'ordine, sbagliata = si ricomincia; tutte giuste = il premio (una volta sola). */
export function suonaCampanella(s: TState, id: string): void {
  const g = s.segreti;
  if (g.campane) return;
  const giusta = g.ordine[g.giuste] === id;
  g.giuste = giusta ? g.giuste + 1 : 0;
  ev(s, { t: 'campanella', id, giusta, n: g.giuste, tutte: g.ordine.length });
  if (!giusta || g.giuste < g.ordine.length) return;
  g.campane = true;
  ev(s, { t: 'campaneGiuste' });
  // il premio: a ognuno in piedi una pozione che non ha (a caso dal seed), anche oltre il limite della Strega
  const prima = s.chi;
  for (const i of inPiedi(s)) {
    usa(s, i);
    const h = s.eroe, libere = TEMPLARI.strega.pozioni.filter((p) => !haPozione(s, p.id) && !(p.volte !== undefined && h.elisir >= p.volte));
    if (libere.length) bevi(s, libere[s.rng.int(0, libere.length - 1)]!.id);
  }
  usa(s, prima);
}

// ---------------- i teschi ----------------
/** Il teschio non ancora trovato a portata, o null. */
export function teschioVicino(s: TState): string | null {
  const h = s.eroe, r = TEMPLARI.teschi.raggio;
  for (const t of s.arena.teschi) if (!s.segreti.teschi[t.id] && d2(t.x, t.z, h.x, h.z) <= r * r) return t.id;
  return null;
}
export const teschiTrovati = (s: TState): number => Object.values(s.segreti.teschi).filter(Boolean).length;
/** Un teschio trovato (fuochi.ts `lavora`, AZIONE tenuto fino in fondo); col terzo la canzone. */
export function trovaTeschio(s: TState, id: string): void {
  const g = s.segreti;
  if (!(id in g.teschi) || g.teschi[id]) return;
  g.teschi[id] = true;
  const n = teschiTrovati(s), tutti = Object.keys(g.teschi).length;
  ev(s, { t: 'teschio', id, n, tutti });
  if (n === tutti) ev(s, { t: 'canzone' });
}
