// La scritta sotto A: il primo bottone di posto acceso, nell'ordine in cui main passa A ai moduli; se no, la barca (se c'è: la storia la fa comprare).
import { canBoard } from '@marea/sim';
import type { GameWorld } from '../game/world.ts';

const AZIONI: readonly (readonly [string, string])[] = [['mzPortaBtn', 'Entra'], ['mzNegozioBtn', 'Entra'], ['mzPortoBtn', 'Compra'], ['mzBottegaBtn', 'Compra'], ['mzLibroBtn', 'Leggi'], ['mzAmiciBtn', 'Guarda'],
  ['mzPlay', 'Gioca'], ['mzDngEntra', 'Entra'], ['mzTemplariEntra', 'Entra'], ['mzFunivia', 'Sali'], ['mzArenaEntra', 'Entra'], ['mzDifesaEntra', 'Entra']];
const VERBI: Record<string, string> = { BACHECA: 'Guarda', PARLA: 'Parla', GIOCA: 'Gioca', FIRMA: 'Firma', ESCI: 'Esci', ENTRA: 'Entra', TORNA: 'Entra', VAI: 'Entra' };

export function azioneA(world: GameWorld, senzaBarca = false): string | null {
  for (const [id, base] of AZIONI) {
    const b = document.getElementById(id);
    if (!b?.classList.contains('on')) continue;
    const parola = (b.textContent ?? '').trim().split(/[\s·]+/)[0]?.toUpperCase() ?? '';
    const v = Object.keys(VERBI).find((k) => parola.startsWith(k)); // il testo del bottone finisce con la «A» attaccata («BachecaA»)
    return v ? VERBI[v]! : base;
  }
  return world.mode === 'walk' && !senzaBarca && canBoard(world.avatar.state, world.boat.state, world.map) ? 'Sali' : null;
}
