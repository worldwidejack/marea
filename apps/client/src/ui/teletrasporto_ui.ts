// Teletrasporto (#264, strumento di sviluppo per tutti): elenco delle isole, un tocco e ci sei. Chunk caricato al primo tocco del bottone.
import type { ArchPlace } from '@marea/sim/world/archipelago.ts';
import type { GameWorld } from '../game/world.ts';
import type { Hud } from './hud.ts';
import { PAL, el } from './style.ts';

export type TeletrasportoCtx = { root: HTMLElement; hud: Hud; world: GameWorld; slots: readonly number[]; onClose(): void };

const CSS = `
#mzTele { position: absolute; left: 8px; right: 8px; bottom: calc(env(safe-area-inset-bottom, 0px) + 8px); max-height: 62%; overflow-y: auto; padding: 12px; background: rgba(46,30,20,.96); border: 2px solid ${PAL.legnoChiaro}; box-shadow: 0 4px 0 ${PAL.neroCaldo}; z-index: 21; display: none; touch-action: pan-y; }
#mzTele.on { display: block; }
@media (min-width: 700px) { #mzTele { left: 50%; right: auto; width: 520px; transform: translateX(-50%); } }
#mzTele h3 { margin: 0 0 8px; font-size: 16px; color: ${PAL.giallo}; }
#mzTele .g { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 8px; }
#mzTele button { min-height: 44px; padding: 6px 8px; background: rgba(0,0,0,.25); border: 2px solid ${PAL.legnoChiaro}; color: ${PAL.sabbiaChiara}; font: bold 14px ui-monospace, Menlo, monospace; cursor: pointer; text-align: left; }
#mzTele button:active { border-color: ${PAL.giallo}; }
#mzTele .x { margin-top: 10px; width: 100%; text-align: center; }
body.mz-sotto #mzTele { display: none; }
`;

export function createTeletrasportoUi(ctx: TeletrasportoCtx) {
  const st = document.createElement('style'); st.id = 'mz-tele-style'; st.textContent = CSS; document.head.appendChild(st);
  const box = el('div', 'mz'); box.id = 'mzTele'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-label', 'Teletrasporto');
  ctx.root.appendChild(box);
  const chiave = (p: ArchPlace) => (p.role === 'lotto' ? `lotto:${p.slot}` : p.island);
  const ordine = (p: ArchPlace) => (p.role === 'porto' ? 0 : p.role === 'lotto' ? 2 : 1);
  const posti = () => ctx.world.archipelago.places
    .filter((p) => p.role !== 'negozio' && (p.role !== 'lotto' || (p.slot !== null && ctx.slots.includes(p.slot)))) // il negozio dei mobili (#265) si raggiunge dalla porta
    .sort((a, b) => ordine(a) - ordine(b) || a.index - b.index);
  const close = () => { box.classList.remove('on'); ctx.onClose(); };
  const draw = () => {
    box.textContent = '';
    box.appendChild(el('h3', undefined, 'Teletrasporto'));
    const g = el('div', 'g');
    for (const p of posti()) {
      const b = el('button', undefined, p.nome); b.type = 'button';
      b.addEventListener('click', () => { b.blur(); if (ctx.world.vai(chiave(p))) { ctx.hud.toast(p.nome, 1500); close(); } else ctx.hud.toast('Non adesso', 1500); });
      g.appendChild(b);
    }
    box.appendChild(g);
    const x = el('button', 'x', 'Chiudi'); x.type = 'button'; x.addEventListener('click', () => { x.blur(); close(); });
    box.appendChild(x);
  };
  return {
    open() { draw(); box.classList.add('on'); },
    close,
    isOpen: () => box.classList.contains('on'),
  };
}
