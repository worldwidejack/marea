// I segreti dell'isola (docs/TEMPLARI.md §9c, 15 ott 2026, scelte di birbasan), come gli easter egg di COD Zombies:
// - La cripta: il muro crepato della rotonda si rompe solo con un colpo pesante (un colpo caricato in mischia, un'esplosione, una cannonata,
//   il Giudizio); i colpi leggeri fanno solo polvere (l'indizio). Dietro una scala scende nella cripta: il muro rotto e la scala in fondo
//   alla cripta sono i due capi della stessa scala (mappa.ts `Cripta`), la sim ci porta eroi e zombie e il flow field li tiene vicini.
//   Sull'altare la Lancia di Longino: si libera con le anime di `cripta.anime` zombie uccisi DENTRO la cripta, poi AZIONE la prende.
// - Le campanelle: sparse per l'isola, si suonano con AZIONE nell'ordine scritto sul muro della taverna (l'ordine lo sceglie il seed, con
//   un rng a parte). Sbagli = si ricomincia; tutte giuste = una pozione che non hai, gratis, a ognuno della squadra. Una volta per partita.
// - I teschi: nascosti; AZIONE tenuto su ognuno (come i fuochi, fuochi.ts `lavora`); al terzo parte la canzone segreta (solo client).
// Tutto della squadra (insieme valgono per tutti), tutto deterministico: il server rigioca uguale.
import { TEMPLARI, armaDef } from '@marea/content/templari.ts';
import { createRng } from '../rng.ts';
import { bfs, cellOf } from '../dungeon/map.ts';
import type { Arena, Passaggio } from './mappa.ts';
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
/** Il punto (x, z) sta nel piano di sotto (la cripta o le catacombe, §12b punto 3). */
export function inCripta(s: TState, x: number, z: number): boolean {
  const c = s.arena.cripta, i = cellOf(s.gr.percorso, x, z);
  return !!c && i >= 0 && c.dentro[i] === 1;
}
/** Il punto (x, z) sta nella sala della cripta (lì le anime vanno all'altare; nelle catacombe no, scelta di birbasan). */
export function inSala(s: TState, x: number, z: number): boolean {
  const c = s.arena.cripta, i = cellOf(s.gr.percorso, x, z);
  return !!c && i >= 0 && c.sala[i] === 1;
}
/** La scala si usa: la cripta col muro rotto, le grate delle catacombe comprate. */
export const passaggioAperto = (s: TState, p: Passaggio): boolean => (p.porta ? !!s.porte[p.porta] : s.segreti.muro);
const aperti = (s: TState): Passaggio[] => s.arena.passaggi.filter((p) => passaggioAperto(s, p));

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

/** Il flow field degli zombie (zombie.ts) verso le celle `from`, passando dalle scale aperte (i due capi di una scala sono a un passo).
 *  Si rilassa scala per scala finché non migliora più (con tre scale la strada più corta ne usa al massimo tre). */
export function flusso(s: TState, from: number | readonly number[]): void {
  const g = s.gr.percorso;
  bfs(g, from, s.flow);
  const ap = aperti(s);
  if (!ap.length) return;
  const da = new Map<number, Int32Array>(), dist = (c: number) => { let d = da.get(c); if (!d) { d = bfs(g, c); da.set(c, d); } return d; };
  for (let giro = 0; giro <= ap.length; giro++) {
    let meglio = false;
    for (const p of ap) for (const [x, y] of [[p.a, p.b], [p.b, p.a]] as const) {
      const dx = s.flow[x.cella] ?? -1;
      if (dx < 0) continue;
      const d = dist(y.cella);
      for (let i = 0; i < d.length; i++) { const v = d[i]!; if (v >= 0 && (s.flow[i]! < 0 || dx + 1 + v < s.flow[i]!)) { s.flow[i] = dx + 1 + v; meglio = true; } }
    }
    if (!meglio) break;
  }
}
/** L'altro capo della scala aperta che ha un capo nella cella `qui`, o null. */
function altroCapo(s: TState, qui: number): { p: Passaggio; da: Passaggio['a']; a: Passaggio['a'] } | null {
  if (qui < 0) return null;
  for (const p of s.arena.passaggi) {
    if (qui !== p.a.cella && qui !== p.b.cella) continue;
    if (!passaggioAperto(s, p)) return null;
    return qui === p.a.cella ? { p, da: p.a, a: p.b } : { p, da: p.b, a: p.a };
  }
  return null;
}
/** Lo zombie sta su un capo di una scala e il flow field dice di passare dall'altro: ci va (true = si è spostato, il passo è fatto). */
export function scalaZombie(s: TState, z: Zombie, qui: number): boolean {
  const k = altroCapo(s, qui);
  if (!k) return false;
  const dq = s.flow[qui] ?? -1, da = s.flow[k.a.cella] ?? -1;
  if (da < 0 || (dq >= 0 && da >= dq)) return false;
  z.x = k.a.x; z.z = k.a.z;
  ev(s, { t: 'scala', id: z.id, x: k.a.x, z: k.a.z });
  return true;
}
/** L'eroe di turno entra in un capo di una scala: arriva davanti all'altro (scende sotto o torna sopra). `via` = quale scala. */
export function scalaEroe(s: TState): void {
  const h = s.eroe, k = altroCapo(s, cellOf(s.gr.eroe, h.x, h.z));
  if (!k) return;
  const dove = k.a.davanti;
  h.x = dove.x; h.z = dove.z; h.fx = dove.fx; h.fz = dove.fz;
  ev(s, { t: 'scala', giu: k.a === k.p.b, via: k.p.id, x: dove.x, z: dove.z });
}
/** L'altare è libero per l'eroe di turno: le anime della squadra bastano per il suo sigillo (5, e 5 in più per ogni Lancia persa cadendo). */
export const lanciaLibera = (s: TState): boolean => s.segreti.anime >= s.eroe.sigillo;
/** Uno zombie è morto (colpi.ts `uccidi`): se era nella cripta e l'altare è ancora sigillato per qualcuno, la sua anima va all'altare. */
export function anima(s: TState, z: Zombie): void {
  const g = s.segreti, attesa = s.eroi.filter((h) => !h.fuori && g.anime < h.sigillo).map((h) => h.sigillo);
  if (!attesa.length || !inSala(s, z.x, z.z)) return; // nella sala della cripta (§12b punto 3: nelle catacombe no)
  g.anime++;
  ev(s, { t: 'anima', x: r2(z.x), z: r2(z.z), n: g.anime, tutte: Math.min(...attesa) });
  if (attesa.includes(g.anime)) ev(s, { t: 'cripta', fase: 'libera' });
}
/** L'eroe di turno è all'altare della cripta. */
export function vicinoAltareCripta(s: TState): boolean {
  const c = s.arena.cripta, h = s.eroe, r = TEMPLARI.cripta.raggio;
  return !!c && d2(c.altare.x, c.altare.z, h.x, h.z) <= r * r; // ci si arriva anche dalle grate delle catacombe
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
/** Lo scheletro col biglietto a portata (§12b punto 4), il più vicino, o null. Leggerlo non cambia la partita (solo un evento). */
export function scheletroVicino(s: TState): string | null {
  const h = s.eroe, r = TEMPLARI.indizi.raggio;
  let best: string | null = null, bd = r * r;
  for (const k of s.arena.scheletri) { const d = d2(k.x, k.z, h.x, h.z); if (d <= bd) { bd = d; best = k.id; } }
  return best;
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
