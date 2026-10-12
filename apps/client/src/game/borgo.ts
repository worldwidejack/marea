// Borgo Marea (#237, #247): le porte delle case, attorno alla piazza del Porto (un'isola sola). Davanti alla porta di una casa (a piedi) A ti porta dentro: la stanza sta in fondo al
// giardino di quello slot (template `lotto`, nella fascia oltre il mare che la barca non raggiunge); dalla stanza si esce nel
// giardino dalla porta sul retro (il varco nel muro) o si torna in città con A accanto al punto d'arrivo.
// Base: niente scena separata né dissolvenza, è un teletrasporto. Casa di un amico = il suo giardino, in sola lettura come prima.
import { BORGO } from '@marea/content';
import type { GameWorld } from './world.ts';
import type { Hud } from '../ui/hud.ts';
import { el } from '../ui/style.ts';
import { pixIcon } from '../ui/icons.ts';
import { registerStateProvider, registerTestHook } from '../test/testapi.ts';

export type Borgo = {
  /** Un tick (60 Hz): vicino a una porta il fronte di salita di A entra/esce. true = A è delle porte. */
  tick(a: boolean): boolean;
  update(): void;
};
type XZ = { x: number; z: number };
/** Una casa: porta in città (x, z), punto d'arrivo nella stanza (`dentro`), porta in fondo alla stanza (`retro`) e porta del giardino (`giardino`). */
type Porta = { slot: number; x: number; z: number; dentro: XZ; retro: XZ; giardino: XZ; nome: string | null; mia: boolean };

const RAGGIO = 2.2;

/** Dove sta la porta della casa `slot` nel mondo (m), null se non c'è il Borgo o la casa. `fuori` = metri lungo la via (lo spawn: fuori dal raggio della porta). */
export function portaDi(world: Pick<GameWorld, 'archipelago'>, slot: number, fuori = 0): { x: number; z: number } | null {
  const arch = world.archipelago, b = arch.places.find((p) => p.role === 'porto'), c = BORGO.case[slot];
  if (!b || !c) return null;
  // lungo la via, non di traverso (dall'altra parte della via c'è la porta della casa di fronte): perpendicolare a casa → porta
  const dx = c.porta[0] - c.at[0], dz = c.porta[1] - c.at[1], l = Math.hypot(dx, dz) || 1;
  return { x: (b.origin[0] + c.porta[0] + 0.5) * arch.tile - (dz / l) * fuori, z: (b.origin[1] + c.porta[1] + 0.5) * arch.tile + (dx / l) * fuori };
}

export function createBorgo(o: { world: GameWorld; hud: Hud; root: HTMLElement; abitanti: readonly { slot: number | null; nome: string; mia: boolean }[] }): Borgo {
  const w = o.world, arch = w.archipelago;
  const porte: Porta[] = [];
  for (const l of arch.lots) {
    const p = portaDi(w, l.slot);
    if (!p) continue;
    const chi = o.abitanti.find((a) => a.slot === l.slot) ?? null;
    const cella = (cx: number, cz: number): XZ => ({ x: (l.origin[0] + cx + 0.5) * arch.tile, z: (l.origin[1] + cz + 0.5) * arch.tile });
    porte.push({ slot: l.slot, ...p, dentro: arch.spawnOf(l.slot), retro: cella(BORGO.stanza.retro[0], BORGO.stanza.retro[1]), giardino: cella(BORGO.stanza.giardino[0], BORGO.stanza.giardino[1]), nome: chi?.nome ?? null, mia: !!chi?.mia });
  }
  // entra: dalla città nella stanza · esci: dalla stanza in città · retro: dalla stanza al giardino · giardino: dal giardino alla stanza (#240)
  type Vicino = { porta: Porta; esci: boolean; dove: 'entra' | 'esci' | 'retro' | 'giardino' };
  let near: Vicino | null = null, nearWas = '', aWas = false;
  const trova = (): Vicino | null => {
    if (w.mode !== 'walk' || w.frozen || w.race.on) return null;
    const f = w.avatar.state;
    for (const p of porte) {
      if (Math.hypot(f.x - p.x, f.z - p.z) < RAGGIO) return { porta: p, esci: false, dove: 'entra' };
      if (Math.hypot(f.x - p.dentro.x, f.z - p.dentro.z) < RAGGIO) return { porta: p, esci: true, dove: 'esci' };
      if (Math.hypot(f.x - p.retro.x, f.z - p.retro.z) < RAGGIO) return { porta: p, esci: false, dove: 'retro' };
      if (Math.hypot(f.x - p.giardino.x, f.z - p.giardino.z) < RAGGIO) return { porta: p, esci: false, dove: 'giardino' };
    }
    return null;
  };
  const testo = (v: Vicino) => v.dove === 'retro' ? 'Vai in giardino' : v.dove === 'giardino' ? 'Torna in casa' : v.esci ? 'Esci in città' : v.porta.mia ? 'Entra in casa' : v.porta.nome ? `Casa di ${v.porta.nome}` : 'Casa libera';
  const vai = (v: Vicino) => {
    if (v.esci) { w.aPiedi(v.porta.x, v.porta.z); return; }
    // dalla porta in fondo si esce un passo nel giardino (davanti alla sua porta, a sud), dal giardino si entra un passo dentro la stanza
    if (v.dove === 'retro') { w.aPiedi(v.porta.giardino.x, v.porta.giardino.z + 2.6); return; }
    if (v.dove === 'giardino') { w.aPiedi(v.porta.retro.x, v.porta.retro.z + 2.6); return; }
    if (!v.porta.nome) { o.hud.toast('Questa casa non è ancora di nessuno', 2200); return; }
    w.aPiedi(v.porta.dentro.x, v.porta.dentro.z);
    o.hud.toast(v.porta.mia ? 'Casa tua: il giardino è oltre la porta in fondo' : `Sei da ${v.porta.nome}: guarda pure, non si tocca`, 2600);
  };

  const btn = el('button', 'mz mz-play mz-libro-btn'); btn.id = 'mzPortaBtn'; btn.type = 'button';
  for (const ev of ['pointerdown', 'touchstart']) btn.addEventListener(ev, (x) => x.stopPropagation());
  btn.addEventListener('click', () => { if (near) vai(near); });
  o.root.appendChild(btn);

  registerStateProvider('borgo', () => ({ near: near ? { slot: near.porta.slot, esci: near.esci, dove: near.dove } : null, porte: porte.map((p) => ({ slot: p.slot, x: p.x, z: p.z, nome: p.nome, mia: p.mia })) }));
  registerTestHook('porta', (slot) => { const p = porte.find((x) => x.slot === Number(slot)); if (!p) return false; vai({ porta: p, esci: false, dove: 'entra' }); return true; });
  registerTestHook('esciDiCasa', (slot) => { const p = porte.find((x) => x.slot === Number(slot)); if (!p) return false; vai({ porta: p, esci: true, dove: 'esci' }); return true; });
  registerTestHook('portaRetro', (slot, verso) => { const p = porte.find((x) => x.slot === Number(slot)); if (!p) return false; vai({ porta: p, esci: false, dove: verso === 'stanza' ? 'giardino' : 'retro' }); return true; });

  return {
    tick(a) {
      const pressA = a && !aWas; aWas = a;
      near = trova();
      const k = near ? `${near.porta.slot}:${near.dove}` : '';
      if (near && k !== nearWas) o.hud.toast(`${testo(near)}: premi A`, 2000);
      nearWas = k;
      if (near && pressA) { vai(near); return true; }
      return !!near;
    },
    update() {
      const show = !!near;
      const k = near ? `${near.porta.slot}:${near.dove}` : '';
      if (show && near && btn.dataset['k'] !== k) { btn.dataset['k'] = k; btn.replaceChildren(pixIcon('casa', 24), el('span', '', testo(near).toUpperCase()), el('small', '', 'A')); }
      btn.classList.toggle('on', show);
    },
  };
}
