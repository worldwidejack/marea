// Isole a tema (#68, GDD §3): chi ci può entrare e la barriera in mare che ferma chi non può. Pura e deterministica: niente DOM,
// niente orologio, niente casualità. Il client la usa a ogni tick della barca (game/temi.ts); i numeri stanno in archipelago.json.
//   Tempesta → Molo della tua isola al livello N (la tempesta ti respinge)
//   Ghiacci  → personaggio GDR al livello N (il mare gela, la barca si ferma)
//   Vulcano  → un cappello indosso (niente barriera: sbarchi, gli abitanti ti cacciano e ti rimettono in barca)
//   Giardino → una mappa (la nebbia ti fa girare in tondo e tornare indietro); la regala la prima medaglia d'oro da solo
//   Templari → la reliquia del relitto templare sotto il faro della Tempesta (nebbia rossa, come il Giardino)
import { ARCHIPELAGO, AVATAR } from '@marea/content';
import type { TemaSblocco } from '@marea/content';
import type { LotState } from '../economy/types.ts';
import type { ArchPlace } from './archipelago.ts';
import type { BoatState } from './boat.ts';
import type { GridMap } from './grid.ts';
import * as trig from '../trig.ts';

/** Quel che serve per decidere: livello del Molo (0 = nessuna isola), livello del personaggio, cappello indosso (id), mappe possedute. */
export type Viaggiatore = { molo: number; livello: number; cappello: string | null; mappe: readonly string[]; reliquie: readonly string[] };
export const NESSUNO: Viaggiatore = { molo: 0, livello: 1, cappello: null, mappe: [], reliquie: [] };
/** `motivo`: la frase che vede chi viene respinto; `manca`: cosa serve, corto (minimappa, bussola). */
export type Sblocco = { aperta: boolean; motivo: string; manca: string };

/** Viaggiatore dal lotto (Molo, personaggio, mappe) e dal cappello indosso (indice di avatar.json come in Look, o id). */
export function viaggiatore(lot: LotState | null, cappello: number | string | null): Viaggiatore {
  const molo = lot ? lot.buildings.reduce((m, b) => (b.building === 'molo' ? Math.max(m, b.level) : m), 0) : 0;
  const hat = typeof cappello === 'number' ? AVATAR.cappelli[cappello]?.id ?? null : cappello;
  return { molo, livello: lot?.hero?.livello ?? 1, cappello: hat && hat !== 'nessuno' ? hat : null, mappe: lot?.mappe ?? [], reliquie: lot?.reliquie ?? [] };
}

const hatOf = (id: string) => AVATAR.cappelli.find((c) => c.id === id);
/** Nome dell'isola che una mappa apre (per «la mappa dell'Isola Giardino»). */
function isolaDellaMappa(mappa: string): string {
  const e = ARCHIPELAGO.islands.find((i) => i.tema?.sblocco.tipo === 'mappa' && i.tema.sblocco.mappa === mappa);
  return e ? e.island.charAt(0).toUpperCase() + e.island.slice(1) : mappa;
}

/** Un'isola a tema è aperta per questo viaggiatore? Con il motivo in italiano se no. */
export function sbloccoTema(s: TemaSblocco, v: Viaggiatore): Sblocco {
  switch (s.tipo) {
    case 'molo': {
      const ok = v.molo >= s.livello;
      return { aperta: ok, motivo: ok ? 'Aperta' : `La tempesta ti respinge: serve il Molo al livello ${s.livello}${v.molo ? ` (il tuo è al ${v.molo})` : ' (della tua isola)'}`, manca: `Molo al livello ${s.livello}` };
    }
    case 'livello': {
      const ok = v.livello >= s.livello;
      return { aperta: ok, motivo: ok ? 'Aperta' : `Il mare gela e la barca si ferma: serve un personaggio di livello ${s.livello} (sei al ${v.livello})`, manca: `Personaggio al livello ${s.livello}` };
    }
    case 'cappello': {
      const ok = v.cappello === s.cappello, h = hatOf(s.cappello), nome = h?.nome ?? s.cappello;
      return { aperta: ok, motivo: ok ? 'Aperta' : `Gli abitanti ti cacciano: senza ${nome} qui non si entra`, manca: `${nome}${h?.perle ? ` (${h.perle} Perle)` : ''}` };
    }
    case 'mappa': {
      const ok = v.mappe.includes(s.mappa), isola = isolaDellaMappa(s.mappa);
      return { aperta: ok, motivo: ok ? 'Aperta' : `Ti perdi nella nebbia: serve la mappa del ${isola} (te la regala la prima medaglia d'oro in un minigioco)`, manca: `Mappa del ${isola}` };
    }
    case 'libera': return { aperta: true, motivo: 'Aperta', manca: '' }; // Isola delle Corse: aperta a tutti
    case 'reliquia': {
      const ok = (v.reliquie ?? []).includes(s.reliquia);
      return { aperta: ok, motivo: ok ? 'Aperta' : 'Una nebbia rossa ti fa girare al largo: qualcosa, sotto il faro della Tempesta, apre la strada', manca: 'La reliquia dei Templari' };
    }
  }
}

/** Per ogni isola a tema dell'arcipelago (chiave = id dell'isola): aperta sì/no e perché. */
export function sblocchi(places: readonly ArchPlace[], v: Viaggiatore): Record<string, Sblocco & { nome: string }> {
  const out: Record<string, Sblocco & { nome: string }> = {};
  for (const p of places) if (p.tema) out[p.island] = { nome: p.nome, ...sbloccoTema(p.tema.sblocco, v) };
  return out;
}

/** Mappe che la prima medaglia d'oro in un minigioco da solo regala (sblocco `{ tipo: 'mappa', come: 'oro' }`). */
export function mappeDaOro(): string[] {
  const out: string[] = [];
  for (const e of ARCHIPELAGO.islands) { const s = e.tema?.sblocco; if (s?.tipo === 'mappa' && s.come === 'oro' && !out.includes(s.mappa)) out.push(s.mappa); }
  return out;
}

/** Distanza (m) del punto dal rettangolo dell'isola (0 dentro) e verso «fuori» (versore). Dentro: verso il lato più vicino. */
export function distanzaIsola(p: ArchPlace, tile: number, x: number, z: number): { d: number; nx: number; nz: number; qx: number; qz: number } {
  const x0 = p.origin[0] * tile, z0 = p.origin[1] * tile, x1 = x0 + p.w * tile, z1 = z0 + p.h * tile;
  const qx = Math.min(x1, Math.max(x0, x)), qz = Math.min(z1, Math.max(z0, z));
  const dx = x - qx, dz = z - qz, d = Math.sqrt(dx * dx + dz * dz);
  if (d > 1e-9) return { d, nx: dx / d, nz: dz / d, qx, qz };
  // dentro: il lato più vicino
  const l = x - x0, r = x1 - x, t = z - z0, b = z1 - z, m = Math.min(l, r, t, b);
  if (m === l) return { d: 0, nx: -1, nz: 0, qx: x0, qz: z };
  if (m === r) return { d: 0, nx: 1, nz: 0, qx: x1, qz: z };
  if (m === t) return { d: 0, nx: 0, nz: -1, qx: x, qz: z0 };
  return { d: 0, nx: 0, nz: 1, qx: x, qz: z1 };
}

/**
 * La barca (stato `next`, dopo stepBoat; `prev` = il tick prima) è entrata nella barriera di un'isola chiusa? → lo stato respinto,
 * altrimenti null. Tempesta: l'onda ti ributta indietro e ti ferma; Ghiacci: la barca si ferma contro il ghiaccio; Giardino: nella
 * nebbia ti giri e torni da dove sei venuto. Se il punto respinto non è navigabile (un'altra isola) resta dov'era, ferma.
 */
export function respingi(prev: BoatState, next: BoatState, place: ArchPlace, map: GridMap): BoatState | null {
  const t = place.tema;
  if (!t || t.barriera <= 0) return null;
  const b = distanzaIsola(place, map.tile, next.x, next.z);
  if (b.d >= t.barriera) return null;
  const tipo = t.sblocco.tipo;
  const fuori = t.barriera + (tipo === 'molo' ? 2.5 : 0.05); // la tempesta ti butta un po' più in là
  let out: BoatState;
  if (tipo === 'mappa' || tipo === 'reliquia') out = { ...next, x: b.qx + b.nx * fuori, z: b.qz + b.nz * fuori, yaw: trig.atan2(b.nx, -b.nz), speed: next.speed * 0.6, rudder: 0 };
  else out = { ...next, x: b.qx + b.nx * fuori, z: b.qz + b.nz * fuori, speed: 0, wake: tipo === 'molo' ? 1 : 0 };
  if (!map.navigable(out.x, out.z)) out = { ...prev, speed: 0 };
  return out;
}
