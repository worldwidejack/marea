// Il Mercante in piazza a Borgo Marea: ogni giorno di Roma vende `mercante.cappelli` cappelli e `mercante.abiti` vestiti a pagamento
// (avatar.json), scelti a caso; uno uscito oggi non torna per `mercante.riposo` giorni. Cappelli e vestiti si scelgono ognuno per sé (niente set).
// Puro e deterministico: la vetrina dipende solo dal giorno e da avatar.json, così client e server vedono la stessa cosa. Per rispettare il
// riposo la scelta di un giorno guarda i giorni prima: si calcola in avanti da `mercante.dal` (pochi giorni, e il risultato resta in memoria).
// I vestiti comprati stanno in `LotState.posseduti` come «abito:<id>» (accanto ai cappelli, senza campi nuovi).
import { AVATAR } from '@marea/content';
import { createRng } from '../rng.ts';
import { advance } from './advance.ts';
import { giornoRoma } from './giorno.ts';
import { spendi } from './monete.ts';
import { EconomyError } from './types.ts';
import type { LotState } from './types.ts';

export type VetrinaMercante = { cappelli: string[]; abiti: string[] };
type Tipo = 'cappelli' | 'abiti';

const pool = (t: Tipo): string[] => (t === 'cappelli' ? AVATAR.cappelli : AVATAR.abiti).filter((x) => x.monete > 0).map((x) => x.id);
const memo: Record<Tipo, string[][]> = { cappelli: [], abiti: [] };

/** `n` id a caso dal pool, saltando quelli usciti negli ultimi `riposo` giorni (se non bastano, si riprende da quelli). */
function scegli(t: Tipo, g: number, prima: string[][]): string[] {
  const n = AVATAR.mercante[t], tutti = pool(t), vietati = new Set(prima.flat());
  const liberi = tutti.filter((id) => !vietati.has(id)), resto = tutti.filter((id) => vietati.has(id));
  const rng = createRng(`mercante:${t}:${g}`), out: string[] = [];
  for (const lista of [liberi, resto]) {
    const a = [...lista];
    while (out.length < n && a.length) out.push(a.splice(rng.int(0, a.length - 1), 1)[0]!);
  }
  return out;
}

function delGiorno(t: Tipo, g: number): string[] {
  const dal = AVATAR.mercante.dal, riposo = AVATAR.mercante.riposo;
  if (g < dal) return scegli(t, g, []);
  const m = memo[t];
  for (let d = dal + m.length; d <= g; d++) m.push(scegli(t, d, m.slice(Math.max(0, m.length - riposo))));
  return m[g - dal]!;
}

/** La vetrina del Mercante il giorno `g` di Roma. */
export const vetrinaMercanteDel = (g: number): VetrinaMercante => ({ cappelli: [...delGiorno('cappelli', g)], abiti: [...delGiorno('abiti', g)] });
export const vetrinaMercante = (ms: number): VetrinaMercante => vetrinaMercanteDel(giornoRoma(ms));

/** Il vestito è tuo: gratis per tutti, o comprato. */
export function ownsAbito(lot: LotState | null, id: string): boolean {
  const a = AVATAR.abiti.find((x) => x.id === id);
  return !!a && (a.monete <= 0 || (lot?.posseduti ?? []).includes(`abito:${id}`));
}

/** Compra un vestito dal Mercante, una volta sola, solo il giorno che è in vetrina: monete spese, «abito:<id>» in `posseduti`. */
export function buyAbito(lot0: LotState, id: string, nowMs: number): LotState {
  let lot = advance(lot0, nowMs);
  const a = AVATAR.abiti.find((x) => x.id === id);
  if (!a) throw new EconomyError('sconosciuto', 'Vestito sconosciuto');
  if (a.monete <= 0) throw new EconomyError('cappello', `${a.nome}: è gratis, non serve comprarlo`);
  if (ownsAbito(lot, id)) throw new EconomyError('unico', `Hai già: ${a.nome}`);
  if (!vetrinaMercante(nowMs).abiti.includes(id)) throw new EconomyError('requisito', `${a.nome}: oggi il Mercante non ce l’ha`);
  lot = spendi(lot, a.monete);
  return { ...lot, version: lot.version + 1, posseduti: [...(lot.posseduti ?? []), `abito:${id}`] };
}
