// Tratti delle magie SOLO nel dungeon (docs/RPG.md §Magie, spells.json → `tratto`): in Arena (`s.pvp`) non esistono, così lo stato delle partite
// resta quello di sempre. Proiettili: incendia (chiazza di fuoco dove colpisce), rinculo (butta indietro), trapassa (attraversa nemici), abbaglia
// (stordisce un attimo). Raggi: pozze (la Colata lascia metallo fuso in fondo), concentra (la Bussola fa sempre più male sullo stesso nemico).
// Bombe: brace a terra, pioggia (si divide in braci sparse), risucchio (tira al centro), secondo giro. Determinismo: solo + − × ÷ e Math.sqrt.
import { SPELLS } from '@marea/content/rpg.ts';
import type { TrattoMagia } from '@marea/content/rpg_magie_types.ts';
import type { DungeonState, Enemy, Proj } from './state.ts';
import { secToTicks } from './state.ts';
import { cellOf, isOpaque, moveCircle } from './map.ts';
import { grigliaDi } from './muove.ts';
import { fuocoAmico } from './fuoco.ts';
import { CANALE_OGNI, HZ } from './tuning.ts';

const TRATTI = new Map<string, TrattoMagia>(SPELLS.filter((x) => x.tratto).map((x) => [x.id, x.tratto!]));

/** Il tratto della magia `id` (undefined in Arena, o se la magia non ne ha). */
export const tratto = (s: DungeonState, id: string | undefined): TrattoMagia | undefined => (s.pvp || !id ? undefined : TRATTI.get(id));
/** L'id della magia da scrivere sul proiettile o sul raggio: solo nel dungeon (in Arena niente, lo stato non cambia). */
export const magiaDi = (s: DungeonState, id: string): { magia?: string } => (s.pvp ? {} : { magia: id });

/** Chi non si sposta né si stordisce: capi, torrette, anelli dell'Astrolabio, morti. */
const fermo = (e: Enemy): boolean => !!e.def.boss || e.st === 'morto' || e.def.comportamento === 'torretta' || e.def.comportamento === 'anello';
const sposta = (s: DungeonState, e: Enemy, dx: number, dz: number): void => { if (!fermo(e)) moveCircle(grigliaDi(s, e), e, dx, dz, e.def.raggio); };

/** Chiazza di fuoco amica in (x, z); se il punto è dentro un muro arretra di `indietro` (versore) finché trova terra. */
function chiazza(s: DungeonState, x: number, z: number, ux: number, uz: number, c: { raggio: number; secondi: number; dps: number }): void {
  for (let d = 0; d <= 1.2; d += 0.3) {
    const px = x - ux * d, pz = z - uz * d, i = cellOf(s.map, px, pz);
    if (i >= 0 && !s.map.solid[i]) { fuocoAmico(s, px, pz, c.raggio, c.secondi, c.dps); return; }
  }
}

/** Un proiettile magico dell'eroe è a segno su `e` (o contro un muro, `e` null). true = il proiettile prosegue (trapassa). */
export function impattoMagia(s: DungeonState, p: Proj, e: Enemy | null): boolean {
  const T = tratto(s, p.magia);
  if (!T) return false;
  const v = Math.sqrt(p.vx * p.vx + p.vz * p.vz) || 1, ux = p.vx / v, uz = p.vz / v;
  if (T.incendia) chiazza(s, p.x, p.z, ux, uz, T.incendia);
  if (!e) return false;
  if (T.rinculo) sposta(s, e, ux * T.rinculo, uz * T.rinculo);
  if (T.abbaglia && !fermo(e)) {
    e.stordito = Math.max(e.stordito ?? 0, s.tick + secToTicks(T.abbaglia));
    if (e.st === 'prepara' || e.st === 'colpisce') { e.st = 'insegue'; e.stT = 0; e.area = false; e.tiro = false; }
  }
  if (!T.trapassa) return false;
  p.buchi = (p.buchi ?? T.trapassa) - 1;
  p.colpiti.push(e.id);
  return p.buchi >= 0;
}

// ---------- raggi ----------

/** Concentra (Bussola Fulminante): moltiplicatore del danno su `e` mentre il raggio resta su di lui. */
export function moltConcentra(s: DungeonState, id: string, e: Enemy): number {
  const C = tratto(s, id)?.concentra, h = s.hero;
  return C && e.id === h.bussolaId ? 1 + Math.min(C.max, (C.perSecondo * (h.bussolaT ?? 0)) / HZ) : 1;
}
/** Dopo un colpo di raggio: chi è il primo preso (per Concentra) e, ogni tanto, la pozza della Colata in fondo al raggio. */
export function dopoRaggio(s: DungeonState, id: string, primo: Enemy | null): void {
  const T = tratto(s, id), h = s.hero;
  if (!T) return;
  if (T.concentra) {
    if (primo && primo.id === h.bussolaId) h.bussolaT = (h.bussolaT ?? 0) + CANALE_OGNI;
    else { h.bussolaId = primo?.id; h.bussolaT = 0; }
  }
  if (T.pozze && (h.canale - 1) % secToTicks(T.pozze.ogni) === 0) {
    const c = h.alzo ? h.alzo[0] : 1, d = Math.max(0.5, (h.canaleFin ?? h.canaleLen) * c - 0.2);
    chiazza(s, h.x + h.fx * d, h.z + h.fz * d, h.fx, h.fz, T.pozze);
  }
}
/** Il raggio si spegne: Concentra riparte da zero. */
export function fineRaggio(s: DungeonState): void { delete s.hero.bussolaId; delete s.hero.bussolaT; }

// ---------- bombe ----------

/** Dove cadono le braci della Pioggia (attorno al punto di mira, nel verso del lancio): la prima al centro. */
const SPARSE: readonly (readonly [number, number])[] = [[0, 0], [0.7, 0.7], [-0.7, 0.7], [0.7, -0.7], [-0.7, -0.7], [1, 0], [-1, 0], [0, 1], [0, -1]];
/** Pioggia di Braci: i punti di caduta (x, z), quanto tardano (tick) e il danno/raggio di ognuna. Null = la bomba è una sola. */
export function braci(s: DungeonState, id: string, tx: number, tz: number): { x: number; z: number; ritardo: number }[] | null {
  const P = tratto(s, id)?.pioggia, h = s.hero;
  if (!P) return null;
  const out: { x: number; z: number; ritardo: number }[] = [];
  for (let i = 0; i < Math.min(P.n, SPARSE.length); i++) {
    const [a, b] = SPARSE[i]!, x = tx + (h.fx * a - h.fz * b) * P.sparse, z = tz + (h.fz * a + h.fx * b) * P.sparse;
    const muro = isOpaque(s.map, Math.floor(x / s.map.tile), Math.floor(z / s.map.tile));
    out.push({ x: muro ? tx : x, z: muro ? tz : z, ritardo: Math.round(i * P.ritardo * HZ) });
  }
  return out;
}

/** La bomba è scoppiata (`colpiti` = i nemici presi): brace a terra, risucchio verso il centro, secondo giro. */
export function dopoScoppio(s: DungeonState, p: Proj, colpiti: Enemy[]): void {
  const T = tratto(s, p.magia);
  if (!T) return;
  if (T.brace) chiazza(s, p.x, p.z, 0, 0, { raggio: p.raggio * T.brace.frazione, secondi: T.brace.secondi, dps: T.brace.dps });
  if (T.risucchio) {
    for (const e of colpiti) {
      const dx = p.x - e.x, dz = p.z - e.z, d = Math.sqrt(dx * dx + dz * dz), k = Math.min(T.risucchio, Math.max(0, d - 0.3));
      if (d > 1e-3 && k > 0) sposta(s, e, (dx / d) * k, (dz / d) * k);
    }
  }
  if (T.secondoGiro && !p.giro) { // una bomba ferma a terra che scoppia di nuovo fra poco, nello stesso punto
    s.proj.push({ ...p, id: s.nextId++, y: 0.01, vx: 0, vy: 0, vz: 0, g: 0, life: Math.max(1, secToTicks(T.secondoGiro.dopo)), danno: p.danno * T.secondoGiro.frazione, colpiti: [], traits: { ...p.traits }, giro: true });
  }
}
