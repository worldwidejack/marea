// Borgo Marea (#237): le porte delle case. Davanti alla porta di una casa (a piedi) A ti porta dentro: la stanza sta in fondo al
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
type Porta = { slot: number; x: number; z: number; dentro: { x: number; z: number }; nome: string | null; mia: boolean };

const RAGGIO = 2.2;

/** Dove sta la porta della casa `slot` nel mondo (m), null se non c'è il Borgo o la casa. `fuori` = metri lungo la via (lo spawn: fuori dal raggio della porta). */
export function portaDi(world: Pick<GameWorld, 'archipelago'>, slot: number, fuori = 0): { x: number; z: number } | null {
  const arch = world.archipelago, b = arch.places.find((p) => p.role === 'borgo'), c = BORGO.case[slot];
  if (!b || !c) return null;
  // lungo la via, non di traverso: dall'altra parte della via c'è la porta della casa di fronte
  const lungoX = c.porta[1] === c.at[1] ? 0 : 1, lungoZ = 1 - lungoX;
  return { x: (b.origin[0] + c.porta[0] + 0.5) * arch.tile + lungoX * fuori, z: (b.origin[1] + c.porta[1] + 0.5) * arch.tile + lungoZ * fuori };
}

export function createBorgo(o: { world: GameWorld; hud: Hud; root: HTMLElement; abitanti: readonly { slot: number | null; nome: string; mia: boolean }[] }): Borgo {
  const w = o.world, arch = w.archipelago;
  const porte: Porta[] = [];
  for (const l of arch.lots) {
    const p = portaDi(w, l.slot);
    if (!p) continue;
    const chi = o.abitanti.find((a) => a.slot === l.slot) ?? null;
    porte.push({ slot: l.slot, ...p, dentro: arch.spawnOf(l.slot), nome: chi?.nome ?? null, mia: !!chi?.mia });
  }
  type Vicino = { porta: Porta; esci: boolean };
  let near: Vicino | null = null, nearWas = '', aWas = false;
  const trova = (): Vicino | null => {
    if (w.mode !== 'walk' || w.frozen || w.race.on) return null;
    const f = w.avatar.state;
    for (const p of porte) {
      if (Math.hypot(f.x - p.x, f.z - p.z) < RAGGIO) return { porta: p, esci: false };
      if (Math.hypot(f.x - p.dentro.x, f.z - p.dentro.z) < RAGGIO) return { porta: p, esci: true };
    }
    return null;
  };
  const testo = (v: Vicino) => v.esci ? 'Esci in città' : v.porta.mia ? 'Entra in casa' : v.porta.nome ? `Casa di ${v.porta.nome}` : 'Casa libera';
  const vai = (v: Vicino) => {
    if (v.esci) { w.aPiedi(v.porta.x, v.porta.z); return; }
    if (!v.porta.nome) { o.hud.toast('Questa casa non è ancora di nessuno', 2200); return; }
    w.aPiedi(v.porta.dentro.x, v.porta.dentro.z);
    o.hud.toast(v.porta.mia ? 'Casa tua: il giardino è oltre la porta sul retro' : `Sei da ${v.porta.nome}: guarda pure, non si tocca`, 2600);
  };

  const btn = el('button', 'mz mz-play mz-libro-btn'); btn.id = 'mzPortaBtn'; btn.type = 'button';
  for (const ev of ['pointerdown', 'touchstart']) btn.addEventListener(ev, (x) => x.stopPropagation());
  btn.addEventListener('click', () => { if (near) vai(near); });
  o.root.appendChild(btn);

  registerStateProvider('borgo', () => ({ near: near ? { slot: near.porta.slot, esci: near.esci } : null, porte: porte.map((p) => ({ slot: p.slot, x: p.x, z: p.z, nome: p.nome, mia: p.mia })) }));
  registerTestHook('porta', (slot) => { const p = porte.find((x) => x.slot === Number(slot)); if (!p) return false; vai({ porta: p, esci: false }); return true; });
  registerTestHook('esciDiCasa', (slot) => { const p = porte.find((x) => x.slot === Number(slot)); if (!p) return false; vai({ porta: p, esci: true }); return true; });

  return {
    tick(a) {
      const pressA = a && !aWas; aWas = a;
      near = trova();
      const k = near ? `${near.porta.slot}:${near.esci}` : '';
      if (near && k !== nearWas) o.hud.toast(`${testo(near)}: premi A`, 2000);
      nearWas = k;
      if (near && pressA) { vai(near); return true; }
      return !!near;
    },
    update() {
      const show = !!near;
      const k = near ? `${near.porta.slot}:${near.esci}` : '';
      if (show && near && btn.dataset['k'] !== k) { btn.dataset['k'] = k; btn.replaceChildren(pixIcon('casa', 24), el('span', '', testo(near).toUpperCase()), el('small', '', 'A')); }
      btn.classList.toggle('on', show);
    },
  };
}
