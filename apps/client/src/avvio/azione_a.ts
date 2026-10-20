// La scritta sotto A: il primo bottone di posto acceso, nell'ordine in cui main passa A ai moduli; se no, la barca.
import { canBoard } from '@marea/sim';
import type { GameWorld } from '../game/world.ts';

const AZIONI: readonly (readonly [string, string])[] = [['mzPortaBtn', 'Entra'], ['mzNegozioBtn', 'Entra'], ['mzPortoBtn', 'Guarda'], ['mzBottegaBtn', 'Compra'], ['mzLibroBtn', 'Leggi'], ['mzAmiciBtn', 'Guarda'],
  ['mzPlay', 'Gioca'], ['mzDngEntra', 'Entra'], ['mzTemplariEntra', 'Entra'], ['mzFunivia', 'Sali'], ['mzArenaEntra', 'Entra'], ['mzDifesaEntra', 'Entra']];
const VERBI: Record<string, string> = { PARLA: 'Parla', GIOCA: 'Gioca', FIRMA: 'Firma', ESCI: 'Esci', ENTRA: 'Entra', TORNA: 'Entra', VAI: 'Entra' };

export function azioneA(world: GameWorld): string | null {
  for (const [id, base] of AZIONI) {
    const b = document.getElementById(id);
    if (!b?.classList.contains('on')) continue;
    const parola = (b.textContent ?? '').trim().split(/[\s·]+/)[0]?.toUpperCase() ?? '';
    return VERBI[parola] ?? base;
  }
  return world.mode === 'walk' && canBoard(world.avatar.state, world.boat.state, world.map) ? 'Sali' : null;
}
