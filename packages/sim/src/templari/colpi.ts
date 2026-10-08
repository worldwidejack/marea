// Danni e punti: colpo dell'eroe su uno zombie (+10, all'uccisione +60 o +100 in mischia), colpo di uno zombie sull'eroe (caduto a zero).
import { TEMPLARI } from '@marea/content/templari.ts';
import { moveCircle } from '../dungeon/map.ts';
import type { TState, Zombie } from './stato.ts';
import { COLPITO_TICKS, ev } from './stato.ts';

const r2 = (v: number): number => Math.round(v * 100) / 100;

export function dai(s: TState, n: number, perche: 'colpo' | 'uccisione' | 'mischia' | 'asse'): void {
  if (n <= 0) return;
  s.punti += n; s.guadagnati += n;
  ev(s, { t: 'punti', n, perche });
}
/** Spende punti; false (e niente spesa) se non bastano. */
export function spendi(s: TState, n: number): boolean {
  if (s.punti < n) return false;
  s.punti -= n;
  ev(s, { t: 'punti', n: -n, perche: 'spesa' });
  return true;
}

export type Colpo = { danno: number; mischia: boolean; caricato: boolean; dirX: number; dirZ: number; spinta: number };
/** Colpo su uno zombie: danno, spinta, punti, morte. Ritorna true se lo uccide. */
export function colpisci(s: TState, z: Zombie, c: Colpo): boolean {
  if (z.st === 'morto' || z.st === 'sorge') return false;
  const d = Math.min(z.vita, c.danno);
  z.vita -= c.danno;
  z.hurt = COLPITO_TICKS;
  const uccide = z.vita <= 0;
  ev(s, { t: 'colpo', id: z.id, x: r2(z.x), z: r2(z.z), danno: Math.round(d), uccide, caricato: c.caricato });
  if (c.spinta > 0 && !uccide) moveCircle(s.gr.zombie, z, c.dirX * c.spinta, c.dirZ * c.spinta, z.def.raggio);
  if (!uccide) { dai(s, TEMPLARI.punti.colpo, 'colpo'); return false; }
  uccidi(s, z);
  dai(s, c.mischia ? TEMPLARI.punti.mischia : TEMPLARI.punti.uccisione, c.mischia ? 'mischia' : 'uccisione');
  return true;
}

export function uccidi(s: TState, z: Zombie): void {
  z.vita = 0; z.st = 'morto'; z.stT = 0; z.finestra = -1;
  s.uccisioni++;
  ev(s, { t: 'morte', id: z.id, tipo: z.tipo, x: r2(z.x), z: r2(z.z) });
}

/** Colpo sull'eroe: a zero è caduto (fine partita). */
export function ferisci(s: TState, danno: number, x: number, z: number): void {
  const h = s.eroe;
  if (s.done) return;
  h.vita -= danno; h.quiete = 0; h.hurt = COLPITO_TICKS;
  ev(s, { t: 'ferito', danno: Math.round(danno), x: r2(x), z: r2(z) });
  if (h.vita <= 0) { h.vita = 0; s.done = true; s.esito = 'morto'; ev(s, { t: 'caduto' }); }
}
