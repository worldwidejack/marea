// Mira in alto e in basso (prima persona, docs/PRIMA_PERSONA.md): come l'angolo della mira (mira.ts) la pendenza dello sguardo viaggia
// nell'input come un indice, ALZO_N passi da −ALZO_MAX a +ALZO_MAX (1,5° l'uno), solo mentre si mira. 0 o assente = mira piatta (terza
// persona, Arena): frecce e magie partono e volano all'altezza di sempre e colpiscono chiunque sotto ALTEZZA_BERSAGLIO. Con l'alzo tutto
// parte dagli occhi (OCCHI_Y) e va dove punta il mirino: i nemici diventano cilindri alti quanto il loro modello (`altezza`, chi vola a
// `quota`), il soffitto e il pavimento fermano i colpi. Solo + − × ÷ e Math.sqrt: la tabella dei seni sta in trig.ts.
import { cos, sin } from '../trig.ts';
import type { DungeonState, Enemy, Proj } from './state.ts';
import { alto } from './muove.ts';

const GRADO = 0.017453292519943295;
/** Passo e pendenza massima (°), quanti indici in tutto (il centro, 0°, è il (ALZO_N + 1) / 2). */
const ALZO_PASSO = 1.5, ALZO_MAX = 60;
export const ALZO_N = 2 * (ALZO_MAX / ALZO_PASSO) + 1;
const MEZZO = (ALZO_N - 1) / 2;
const TAB: readonly (readonly [number, number])[] = Array.from({ length: ALZO_N }, (_, i) => [cos((i - MEZZO) * ALZO_PASSO * GRADO), sin((i - MEZZO) * ALZO_PASSO * GRADO)] as const);

/** Altezza degli occhi (m): da qui partono frecce e magie mirate in alto o in basso. Il soffitto della prima persona, dove i colpi si fermano. */
export const OCCHI_Y = 1.4, SOFFITTO_Y = 2.6;
/** Altezza di chi non la dice e di un capo; quanto sta su chi vola basso (scende a colpire) e chi è aggrappato alle grate. */
const ALTEZZA_BASE = 1.8, ALTEZZA_CAPO = 3.2, VOLO_BASSO = 0.35, SU_GRATA = 1.0;
/** Tolleranza in altezza (m) per i colpi dell'eroe: meglio un colpo regalato che uno che sembra preso e non conta. */
const MARGINE_Y = 0.2;

/** [coseno, seno] della pendenza dell'indice, null se non c'è (0, assente, fuori scala o non intero). */
export function alzoDir(p: number | undefined): readonly [number, number] | null {
  return p !== undefined && Number.isInteger(p) && p >= 1 && p <= ALZO_N ? TAB[p - 1]! : null;
}

/** Indice (1..ALZO_N) per una pendenza in radianti (+ = in su), tagliata a ±ALZO_MAX. Lo sceglie il client. */
export function alzoIndex(rad: number): number {
  const passi = Math.round(rad / (ALZO_PASSO * GRADO));
  return Math.max(-MEZZO, Math.min(MEZZO, passi)) + MEZZO + 1;
}

/** Un proiettile appena tirato dall'eroe di turno con l'alzo: parte dagli occhi e prende la pendenza (la velocità resta quella, divisa tra
 *  piano e alto). Senza alzo non cambia niente. */
export function alza(s: DungeonState, p: Proj): void {
  const A = s.hero.alzo;
  if (!A) return;
  const v = Math.sqrt(p.vx * p.vx + p.vz * p.vz);
  p.vx *= A[0]; p.vz *= A[0]; p.vy += v * A[1]; p.y = OCCHI_Y; p.alzo = true;
}

/** Da dove a dove (m da terra) sta il corpo di un nemico adesso: chi vola alto sta a `quota`, chi scende a colpire più giù. */
export function quotaNemico(s: DungeonState, e: Enemy): readonly [number, number] {
  const d = e.def, h = d.altezza ?? (d.boss ? ALTEZZA_CAPO : ALTEZZA_BASE);
  const base = d.muove === 'vola' ? (alto(s, e) ? d.quota ?? 1.5 : VOLO_BASSO) : d.muove === 'grate' && s.map.grata[Math.floor(e.z / s.map.tile) * s.map.w + Math.floor(e.x / s.map.tile)] ? SU_GRATA : 0;
  return [base, base + h];
}

/** Un colpo all'altezza `y` (con `largo` m di grossezza sua) prende il nemico? */
export function inAltezza(s: DungeonState, e: Enemy, y: number, largo: number): boolean {
  const [a, b] = quotaNemico(s, e);
  return y >= a - MARGINE_Y - largo && y <= b + MARGINE_Y + largo;
}

/** Sul raggio dell'eroe di turno (fx, fz e, se c'è, la pendenza): a che distanza in piano sta un bersaglio in (x, z) largo `r` e alto da
 *  `ab[0]` a `ab[1]`, se il raggio (lungo `len` lungo la sua strada, largo `w` per lato) lo prende; null = fuori. */
export function lungoRaggio(s: DungeonState, x: number, z: number, r: number, ab: readonly [number, number], len: number, w: number): number | null {
  const h = s.hero, A = h.alzo, c = A ? A[0] : 1;
  const dx = x - h.x, dz = z - h.z, lungo = dx * h.fx + dz * h.fz;
  if (lungo < -0.2 || lungo > len * c + r || Math.abs(dx * h.fz - dz * h.fx) > w + r) return null;
  if (A) { // in alto e in basso il raggio è grosso la metà che di lato (la fiamma si allarga, non sale)
    const y = OCCHI_Y + Math.max(0, lungo) * (c > 1e-3 ? A[1] / c : 0), sp = w * 0.5;
    if (y < ab[0] - MARGINE_Y - sp || y > ab[1] + MARGINE_Y + sp) return null;
  }
  return lungo;
}
/** Il corpo di un eroe (compagno, avversario in Arena) per lungoRaggio. */
export const ALTEZZA_EROE: readonly [number, number] = [0, 1.8];

/** Il dungeon ha un soffitto (in prima persona si vede): il Portale del Vuoto e le arene sono all'aperto. */
export const haSoffitto = (s: DungeonState): boolean => !APERTI.has(s.def.stile);
const APERTI = new Set(['vuoto', 'colosseo', 'giardino', 'rovine']);

/** Quanti metri (lungo il colpo) può fare un colpo mirato con la pendenza [c, n] dagli occhi prima del pavimento o del soffitto. */
export function finoAlTetto(s: DungeonState, n: number): number {
  if (n < -1e-6) return OCCHI_Y / -n;
  if (n > 1e-6 && haSoffitto(s)) return (SOFFITTO_Y - OCCHI_Y) / n;
  return Infinity;
}
