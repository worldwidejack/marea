// Accendere l'isola e montare la campana (docs/TEMPLARI.md §9b, 14 ott 2026, scelte di birbasan), come la corrente e i pezzi da costruire di
// COD Zombies. Tre fuochi da accendere con AZIONE tenuto (gratis, ci vuole tempo mentre gli zombie arrivano): il coro accende il rogo,
// il cimitero sveglia la Strega, il falò dei pirati fa attraccare la nave del Mercante; tutti e tre = punti e un power-up. La campana
// della trappola sta a terra finché la squadra non trova i suoi tre pezzi (ognuno in uno dei suoi posti, scelto dal seed: stato.ts) e
// la monta alla leva (AZIONE tenuto). I pezzi sono della squadra.
import { TEMPLARI } from '@marea/content/templari.ts';
import type { TState } from './stato.ts';
import { ev, secToTicks } from './stato.ts';
import { daiTutti, lasciaPotere } from './colpi.ts';
import { trovaTeschio } from './segreti.ts';

const d2 = (ax: number, az: number, bx: number, bz: number): number => (ax - bx) * (ax - bx) + (az - bz) * (az - bz);

/** Il fuoco che accende questa cosa è acceso (senza un fuoco per lei nella mappa: sì). */
export function acceso(s: TState, apre: 'rogo' | 'strega' | 'mercante'): boolean {
  const id = Object.entries(TEMPLARI.fuochi.lista).find(([, f]) => f.apre === apre)?.[0];
  return !id || !(id in s.fuochi) || !!s.fuochi[id];
}
/** Il fuoco che accende questa cosa (per dirlo nel bottone). */
export const fuocoPer = (apre: 'rogo' | 'strega' | 'mercante') => Object.values(TEMPLARI.fuochi.lista).find((f) => f.apre === apre) ?? null;

/** Il fuoco spento a portata dell'eroe di turno, o null. */
export function fuocoVicino(s: TState): string | null {
  const h = s.eroe, r = TEMPLARI.fuochi.raggio;
  for (const f of s.arena.fuochi) if (!s.fuochi[f.id] && d2(f.x, f.z, h.x, h.z) <= r * r) return f.id;
  return null;
}
/** Dove sta il pezzo in questa partita. */
export function postoPezzo(s: TState, id: string): { x: number; z: number } | null {
  const p = s.arena.pezzi.find((x) => x.id === id), st = s.pezzi[id];
  return p && st ? p.posti[st.posto] ?? null : null;
}
/** Il pezzo della campana ancora a terra a portata, o null. */
export function pezzoVicino(s: TState): string | null {
  const h = s.eroe, r = TEMPLARI.campana.raggio;
  for (const id in s.pezzi) {
    if (s.pezzi[id]!.preso) continue;
    const p = postoPezzo(s, id);
    if (p && d2(p.x, p.z, h.x, h.z) <= r * r) return id;
  }
  return null;
}
export const pezziPresi = (s: TState): number => Object.values(s.pezzi).filter((p) => p.preso).length;
export const pezziTutti = (s: TState): boolean => Object.values(s.pezzi).every((p) => p.preso);

/** Prende il pezzo (AZIONE, un tocco). */
export function prendiPezzo(s: TState, id: string): void {
  const st = s.pezzi[id];
  if (!st || st.preso) return;
  st.preso = true;
  ev(s, { t: 'pezzo', id, presi: pezziPresi(s), tutti: Object.keys(s.pezzi).length });
}

/** Secondi di AZIONE tenuto per un lavoro. */
const durata = (cosa: string): number => (cosa === 'monta' ? TEMPLARI.campana.monta : cosa.startsWith('teschio:') ? TEMPLARI.teschi.tieni : TEMPLARI.fuochi.accendi);
/** AZIONE tenuto su un lavoro (accendere il fuoco `fuoco:<id>`, montare la campana `monta`, prendere un teschio dei segreti
 *  `teschio:<id>`, §9c): conta i tick, a tempo pieno lo fa. `cosa` '' = niente sotto le mani (si ricomincia da zero). */
export function lavora(s: TState, cosa: string): void {
  const h = s.eroe;
  if (!cosa) { h.lavoro = ''; h.lavoroT = 0; return; }
  if (h.lavoro !== cosa) { h.lavoro = cosa; h.lavoroT = 0; ev(s, { t: 'lavoro', cosa }); }
  h.lavoroT++;
  if (h.lavoroT < secToTicks(durata(cosa))) return;
  h.lavoro = ''; h.lavoroT = 0;
  if (cosa.startsWith('teschio:')) { trovaTeschio(s, cosa.slice('teschio:'.length)); return; }
  if (cosa === 'monta') {
    if (s.campana || !pezziTutti(s)) return;
    s.campana = true;
    ev(s, { t: 'campana' });
    return;
  }
  const id = cosa.slice('fuoco:'.length);
  if (!(id in s.fuochi) || s.fuochi[id]) return;
  s.fuochi[id] = true;
  ev(s, { t: 'fuoco', id });
  if (Object.values(s.fuochi).every(Boolean)) {
    // tutta l'isola accesa: punti e un power-up a due passi da chi ha acceso l'ultimo (non sotto i piedi: si deve vedere)
    ev(s, { t: 'fuochiTutti' });
    daiTutti(s, TEMPLARI.fuochi.tutti, 'potere');
    lasciaPotere(s, h.x - h.fx * 2.5, h.z - h.fz * 2.5, true);
  }
}
/** Quanto manca al lavoro in corso (0..1) per la barra sul bottone. */
export function lavoroK(s: TState): number {
  const h = s.eroe;
  if (!h.lavoro) return 0;
  return Math.min(1, h.lavoroT / secToTicks(durata(h.lavoro)));
}
