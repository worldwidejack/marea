// Menù AVATAR a tutto schermo (#417): le voci di prima, ognuna apre il suo pannello toccando il bottone nascosto di sempre
// (Aspetto = #mzEditorBtn, Personaggio = #mzHeroBtn, Foto = #mzFotoBtn). Chunk a parte: lo scarica ui/hud_allegro.ts al primo tocco.
import { ALLEGRO as A, CONTORNO_ALLEGRO, FONT_ALLEGRO, TESTA_DI_RISERVA } from './stile_allegro.ts';
import { el } from './style.ts';

export type MenuAvatar = { apri(): void; chiudi(): void; isOpen(): boolean; voci(): string[]; setRitratto(url: string): void };

type Voce = { id: string; bottone: string; titolo: string; sotto: string; colore: string; scuro: string; icona: string };
/** Le voci del menù AVATAR, nell'ordine; una voce c'è solo se il suo bottone nascosto esiste (Personaggio vuole il login). */
const VOCI: readonly Voce[] = [
  { id: 'aspetto', bottone: 'mzEditorBtn', titolo: 'ASPETTO', sotto: 'Viso, capelli, vestiti, nome e la tua barca', colore: A.blu, scuro: A.bluScuro, icona: 'maglia' },
  { id: 'personaggio', bottone: 'mzHeroBtn', titolo: 'PERSONAGGIO', sotto: 'Zaino, armi, armature e abilità', colore: A.rosso, scuro: A.rossoScuro, icona: 'spada' },
  { id: 'foto', bottone: 'mzFotoBtn', titolo: 'FOTO', sotto: 'Scatta una foto al tuo personaggio', colore: A.oro, scuro: A.oroScuro, icona: 'foto' },
];
const ICONE: Record<string, string> = {
  maglia: `<path d='M8 3 3 6l2.2 4.2L7 9.3V21h10V9.3l1.8.9L21 6l-5-3c-.6 1.5-2.2 2.4-4 2.4S8.6 4.5 8 3z' fill='#fff' stroke='${A.notte}' stroke-width='1.5' stroke-linejoin='round'/>`,
  spada: `<path d='M19.5 3 21 4.5l-9.6 9.6-1.5-1.5z' fill='#fff' stroke='${A.notte}' stroke-width='1.4' stroke-linejoin='round'/><path d='m7.4 11.6 5 5-1.4 1.4-1.8-1.8-3.4 3.4a1.4 1.4 0 0 1-2-2l3.4-3.4-1.8-1.8z' fill='${A.oro}' stroke='${A.notte}' stroke-width='1.4' stroke-linejoin='round'/>`,
  foto: `<path d='M4 7.5h3.2L9 5h6l1.8 2.5H20a1 1 0 0 1 1 1V19a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8.5a1 1 0 0 1 1-1z' fill='#fff' stroke='${A.notte}' stroke-width='1.5' stroke-linejoin='round'/><circle cx='12' cy='13.3' r='3.6' fill='${A.blu}' stroke='${A.notte}' stroke-width='1.5'/>`,
};
const icona = (n: string) => `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'>${ICONE[n] ?? ''}</svg>`)}")`;

const CSS = `
#mzAvatarMenu { position: absolute; inset: 0; z-index: 40; display: none; align-items: center; justify-content: center; padding: max(14px, env(safe-area-inset-top)) 14px max(14px, env(safe-area-inset-bottom)); box-sizing: border-box; background: rgba(27, 35, 64, .62); }
#mzAvatarMenu.on { display: flex; }
#mzAvatarMenu .pan { position: relative; width: min(440px, 100%); max-height: 100%; overflow-y: auto; box-sizing: border-box; padding: 0 16px 18px; border-radius: 30px; background: ${A.crema}; border: 4px solid ${A.notte}; box-shadow: 0 7px 0 ${A.notte}; }
#mzAvatarMenu .testa { display: flex; align-items: center; gap: 14px; margin: 0 -16px 16px; padding: 16px 16px 14px; border-radius: 26px 26px 0 0; background: ${A.blu}; border-bottom: 4px solid ${A.notte}; }
#mzAvatarMenu .ritr { width: 84px; height: 84px; flex: none; box-sizing: border-box; border-radius: 50%; border: 4px solid ${A.bianco}; box-shadow: 0 0 0 3px ${A.notte}, 0 5px 0 3px ${A.notte}; background: ${A.bluScuro} ${TESTA_DI_RISERVA} center 70% / 82% no-repeat; overflow: hidden; }
#mzAvatarMenu .ritr img { width: 100%; height: 100%; display: block; object-fit: cover; image-rendering: pixelated; background: ${A.bluScuro}; }
#mzAvatarMenu .tit { flex: 1; min-width: 0; color: ${A.bianco}; font: 30px ${FONT_ALLEGRO}; text-shadow: ${CONTORNO_ALLEGRO}; letter-spacing: .02em; }
#mzAvatarMenu .tit small { display: block; margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: ${A.oroChiaro}; font-size: 17px; letter-spacing: 0; }
#mzAvatarMenu .x { width: 46px; height: 46px; flex: none; align-self: flex-start; padding: 0; cursor: pointer; box-sizing: border-box; border-radius: 50%; background: ${A.rosso}; border: 3px solid ${A.bianco}; box-shadow: 0 0 0 2.5px ${A.notte}, 0 4px 0 2.5px ${A.notte}; color: ${A.bianco}; font: 22px / 1 ${FONT_ALLEGRO}; text-shadow: 0 2px 0 ${A.notte}; }
#mzAvatarMenu .x:active { transform: translateY(3px); box-shadow: 0 0 0 2.5px ${A.notte}, 0 1px 0 2.5px ${A.notte}; }
#mzAvatarMenu .voce { display: flex; align-items: center; gap: 14px; width: 100%; min-height: 84px; margin-top: 14px; padding: 10px 16px 10px 12px; box-sizing: border-box; cursor: pointer; text-align: left;
  border-radius: 22px; border: 4px solid ${A.bianco}; box-shadow: 0 0 0 3px ${A.notte}, 0 6px 0 3px ${A.notte}; color: ${A.bianco}; font: 24px ${FONT_ALLEGRO}; text-shadow: ${CONTORNO_ALLEGRO}; }
#mzAvatarMenu .voce:active { transform: translateY(4px); box-shadow: 0 0 0 3px ${A.notte}, 0 2px 0 3px ${A.notte}; }
#mzAvatarMenu .voce:focus { outline: none; } #mzAvatarMenu .voce:focus-visible { outline: 4px solid ${A.oro}; outline-offset: 4px; }
#mzAvatarMenu .voce i { width: 56px; height: 56px; flex: none; box-sizing: border-box; border-radius: 50%; background: rgba(27, 35, 64, .25) center / 66% no-repeat; border: 3px solid rgba(255, 255, 255, .7); }
#mzAvatarMenu .voce span { flex: 1; min-width: 0; }
#mzAvatarMenu .voce small { display: block; margin-top: 3px; font-size: 14px; line-height: 1.2; text-shadow: 0 1.5px 0 ${A.notte}; opacity: .95; }
#mzAvatarMenu .voce b { font-weight: 400; font-size: 30px; }
`;

export function createMenuAvatar(o: { root: HTMLElement; nome: string; ritratto(): string; onChiuso(): void }): MenuAvatar {
  if (!document.getElementById('mz-avatar-menu-style')) { const st = document.createElement('style'); st.id = 'mz-avatar-menu-style'; st.textContent = CSS; document.head.appendChild(st); }
  const menu = el('div', 'mz'); menu.id = 'mzAvatarMenu'; menu.setAttribute('role', 'dialog'); menu.setAttribute('aria-label', 'Avatar');
  const pan = el('div', 'pan');
  const testa = el('div', 'testa'), ritr = el('div', 'ritr'), rImg = document.createElement('img'), tit = el('div', 'tit', 'AVATAR'), nome = el('small', '', o.nome);
  rImg.alt = ''; rImg.style.display = 'none'; ritr.appendChild(rImg); tit.appendChild(nome);
  const x = el('button', 'x', '×'); x.type = 'button'; x.setAttribute('aria-label', 'Chiudi');
  testa.append(ritr, tit, x);
  const voci = el('div', 'voci');
  pan.append(testa, voci); menu.appendChild(pan); o.root.appendChild(menu);
  let aperto = false;
  const setRitratto = (u: string) => { if (u) { rImg.src = u; rImg.style.display = ''; } else { rImg.removeAttribute('src'); rImg.style.display = 'none'; } };
  setRitratto(o.ritratto());
  function apri(): void {
    voci.replaceChildren();
    for (const v of VOCI) {
      if (!document.getElementById(v.bottone)) continue;
      const b = el('button', 'voce'); b.type = 'button'; b.dataset['voce'] = v.id;
      b.style.background = v.colore; b.style.boxShadow = `0 0 0 3px ${A.notte}, inset 0 -6px 0 ${v.scuro}, 0 6px 0 3px ${A.notte}`;
      const ic = el('i'); ic.style.backgroundImage = icona(v.icona);
      const t = el('span'); t.append(el('b', '', v.titolo), el('small', '', v.sotto));
      b.append(ic, t);
      b.addEventListener('click', (e) => { e.preventDefault(); chiudi(); document.getElementById(v.bottone)?.click(); });
      voci.appendChild(b);
    }
    aperto = true; menu.classList.add('on');
    voci.querySelector<HTMLElement>('.voce')?.focus({ preventScroll: true });
  }
  function chiudi(): void { if (!aperto) return; aperto = false; menu.classList.remove('on'); o.onChiuso(); }
  x.addEventListener('click', (e) => { e.preventDefault(); chiudi(); });
  menu.addEventListener('click', (e) => { if (e.target === menu) chiudi(); });
  addEventListener('keydown', (e) => { if (aperto && e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); chiudi(); } }, true);
  return { apri, chiudi, isOpen: () => aperto, voci: () => [...voci.querySelectorAll<HTMLElement>('.voce')].map((b) => b.dataset['voce'] ?? ''), setRitratto };
}
