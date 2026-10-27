// Viaggio rapido (GDD §9, al posto del teletrasporto di prova #264): il bottone col vortice in alto, un elenco di posti, un tocco e ci sei.
// Ci sono il Borgo e le isole che hai scoperto con Capitan Remo (`viaggiDisponibili` della sim); chi non ha ancora la storia (e coi test, o
// per chi sviluppa MAREA) li vede tutti. Senza barca main.ts non lo apre nemmeno. Chunk caricato al primo tocco del bottone.
import { viaggiDisponibili } from '@marea/sim/economy/storia.ts';
import type { LotState } from '@marea/sim';
import type { GameWorld } from '../game/world.ts';
import type { Hud } from '../ui/hud.ts';
import { PAL, el } from '../ui/style.ts';

export type ViaggioCtx = { root: HTMLElement; hud: Hud; world: GameWorld; getLot(): LotState | null; tutto: boolean; onClose(): void };

const CSS = `
#mzTele { position: absolute; left: 8px; right: 8px; bottom: calc(env(safe-area-inset-bottom, 0px) + 8px); max-height: 62%; overflow-y: auto; padding: 12px; background: rgba(46,30,20,.96); border: 2px solid ${PAL.legnoChiaro}; box-shadow: 0 4px 0 ${PAL.neroCaldo}; z-index: 21; display: none; touch-action: pan-y; }
#mzTele.on { display: block; }
@media (min-width: 700px) { #mzTele { left: 50%; right: auto; width: 520px; transform: translateX(-50%); } }
#mzTele h3 { margin: 0 0 8px; font-size: 16px; color: ${PAL.giallo}; }
#mzTele p { margin: 8px 0 0; font-size: 13px; color: ${PAL.sabbia}; }
#mzTele .g { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 8px; }
#mzTele button { min-height: 44px; padding: 6px 8px; background: rgba(0,0,0,.25); border: 2px solid ${PAL.legnoChiaro}; color: ${PAL.sabbiaChiara}; font: bold 14px ui-monospace, Menlo, monospace; cursor: pointer; text-align: left; }
#mzTele button:active { border-color: ${PAL.giallo}; }
#mzTele .x { margin-top: 10px; width: 100%; text-align: center; }
body.mz-sotto #mzTele { display: none; }
`;

export function createViaggio(ctx: ViaggioCtx) {
  const st = document.createElement('style'); st.id = 'mz-tele-style'; st.textContent = CSS; document.head.appendChild(st);
  const box = el('div', 'mz'); box.id = 'mzTele'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-label', 'Viaggio rapido');
  ctx.root.appendChild(box);
  /** I posti dell'elenco (il Borgo prima) e se ne mancano ancora da scoprire. */
  const posti = () => {
    const ok = ctx.tutto ? null : viaggiDisponibili(ctx.getLot());
    const tutti = ctx.world.archipelago.places
      .filter((p) => p.role !== 'negozio' && p.role !== 'lotto') // il negozio dei mobili e le case si raggiungono dalla porta
      .sort((a, b) => Number(b.role === 'porto') - Number(a.role === 'porto') || a.index - b.index);
    const lista = ok ? tutti.filter((p) => ok.includes(p.island)) : tutti;
    return { lista, mancano: lista.length < tutti.length };
  };
  const close = () => { box.classList.remove('on'); ctx.onClose(); };
  const draw = () => {
    box.textContent = '';
    box.appendChild(el('h3', undefined, 'Viaggio rapido'));
    const g = el('div', 'g'), { lista, mancano } = posti();
    for (const p of lista) {
      const b = el('button', undefined, p.nome); b.type = 'button'; b.dataset['isola'] = p.island;
      b.addEventListener('click', () => { b.blur(); if (ctx.world.vai(p.island)) { ctx.hud.toast(p.nome, 1500); close(); } else ctx.hud.toast('Non adesso', 1500); });
      g.appendChild(b);
    }
    box.appendChild(g);
    if (mancano) box.appendChild(el('p', undefined, 'Le altre isole: prima scoprile con Capitan Remo, al Porto.'));
    const x = el('button', 'x', 'Chiudi'); x.type = 'button'; x.addEventListener('click', () => { x.blur(); close(); });
    box.appendChild(x);
  };
  return {
    open() { draw(); box.classList.add('on'); },
    close,
    isOpen: () => box.classList.contains('on'),
  };
}
