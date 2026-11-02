// Menù AVATAR (#417): le voci di prima, ognuna apre il suo pannello toccando il bottone nascosto di sempre
// (Aspetto = #mzEditorBtn, Borsa = #mzBorsaBtn, Personaggio = #mzHeroBtn, Diario = #mzDiarioBtn, #457, Foto = #mzFotoBtn). Chunk a parte: lo scarica ui/hud_allegro.ts al primo tocco.
// Una carta del kit (ui/kit.ts) col ritratto e il nome, e una riga per voce: icona nel riquadro, titolo, sotto-titolo, freccia.
import { TESTA_DI_RISERVA } from './stile_allegro.ts';
import { cartaKit, fermaTocchi, injectKit } from './kit.ts';
import { FONT_LIBRO, LIBRO as L } from './libro_colori.ts';
import { el } from './style.ts';

export type MenuAvatar = { apri(): void; chiudi(): void; isOpen(): boolean; voci(): string[]; setRitratto(url: string): void };

type Voce = { id: string; bottone: string; titolo: string; sotto: string; icona: string };
/** Le voci del menù AVATAR, nell'ordine; una voce c'è solo se il suo bottone nascosto esiste (Personaggio vuole il login). */
const VOCI: readonly Voce[] = [
  { id: 'aspetto', bottone: 'mzEditorBtn', titolo: 'Aspetto', sotto: 'Viso, capelli, nome e la tua barca', icona: 'maglia' },
  { id: 'borsa', bottone: 'mzBorsaBtn', titolo: 'Borsa', sotto: 'Vestiti, cappelli, strumenti, insetti e mobili', icona: 'borsa' },
  { id: 'personaggio', bottone: 'mzHeroBtn', titolo: 'Personaggio', sotto: 'Zaino, armi, armature e abilità', icona: 'spada' },
  { id: 'diario', bottone: 'mzDiarioBtn', titolo: 'Diario', sotto: 'Pesci, insetti, perle, animali e isole trovati', icona: 'libro' },
  { id: 'foto', bottone: 'mzFotoBtn', titolo: 'Foto', sotto: 'Scatta una foto al tuo personaggio', icona: 'foto' },
];
const T = `stroke='${L.inchiostro}' stroke-width='1.5' stroke-linejoin='round'`;
const ICONE: Record<string, string> = {
  maglia: `<path d='M8 3 3 6l2.2 4.2L7 9.3V21h10V9.3l1.8.9L21 6l-5-3c-.6 1.5-2.2 2.4-4 2.4S8.6 4.5 8 3z' fill='${L.acquaChiara}' ${T}/>`,
  spada: `<path d='M19.5 3 21 4.5l-9.6 9.6-1.5-1.5z' fill='${L.cartaChiara}' ${T}/><path d='m7.4 11.6 5 5-1.4 1.4-1.8-1.8-3.4 3.4a1.4 1.4 0 0 1-2-2l3.4-3.4-1.8-1.8z' fill='${L.oro}' ${T}/>`,
  libro: `<path d='M4 4.5h6.5a2 2 0 0 1 2 2V20a2 2 0 0 0-2-1.6H4z' fill='${L.cartaChiara}' ${T}/><path d='M20 4.5h-6.5a2 2 0 0 0-2 2V20a2 2 0 0 1 2-1.6H20z' fill='${L.acquaChiara}' ${T}/>`,
  borsa: `<path d='M8 8V6.5a4 4 0 0 1 8 0V8' fill='none' stroke='${L.inchiostro}' stroke-width='1.6'/><path d='M4.5 8h15l-1.2 11.5a1.5 1.5 0 0 1-1.5 1.3H7.2a1.5 1.5 0 0 1-1.5-1.3z' fill='${L.oroChiaro}' ${T}/><path d='M9 12.5h6' stroke='${L.oroScuro}' stroke-width='2' stroke-linecap='round'/>`,
  foto: `<path d='M4 7.5h3.2L9 5h6l1.8 2.5H20a1 1 0 0 1 1 1V19a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8.5a1 1 0 0 1 1-1z' fill='${L.cartaChiara}' ${T}/><circle cx='12' cy='13.3' r='3.6' fill='${L.acqua}' ${T}/>`,
};
const icona = (n: string) => `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'>${ICONE[n] ?? ''}</svg>`)}")`;

const CSS = `
#mzAvatarMenu .mk-testa .ritr { width: 48px; height: 48px; flex: none; box-sizing: border-box; border-radius: 50%; border: 2px solid ${L.oro}; box-shadow: 0 0 0 1.5px ${L.inchiostro}; background: ${L.blu} ${TESTA_DI_RISERVA} center 70% / 82% no-repeat; overflow: hidden; }
#mzAvatarMenu .ritr img { width: 100%; height: 100%; display: block; object-fit: cover; image-rendering: pixelated; background: ${L.blu}; }
#mzAvatarMenu .voce { width: 100%; box-sizing: border-box; min-height: 60px; text-align: left; cursor: pointer; color: ${L.inchiostro}; font: 700 15px ${FONT_LIBRO}; }
#mzAvatarMenu .voce:active { transform: translateY(2px); }
#mzAvatarMenu .voce:focus { outline: none; } #mzAvatarMenu .voce:focus-visible { outline: 3px solid ${L.acqua}; outline-offset: 2px; }
#mzAvatarMenu .voce .mk-ico { background-color: ${L.cartaScura}; background-repeat: no-repeat; background-position: center; background-size: 66%; }
#mzAvatarMenu .voce .mk-nome { font-size: 18px; }
#mzAvatarMenu .voce b { flex: none; font: 700 26px/1 ${FONT_LIBRO}; color: ${L.acqua}; }
`;

export function createMenuAvatar(o: { root: HTMLElement; nome: string; ritratto(): string; onChiuso(): void }): MenuAvatar {
  injectKit();
  if (!document.getElementById('mz-avatar-menu-style')) { const st = document.createElement('style'); st.id = 'mz-avatar-menu-style'; st.textContent = CSS; document.head.appendChild(st); }
  const menu = fermaTocchi(el('div', 'mk-velo mz')); menu.id = 'mzAvatarMenu'; menu.setAttribute('role', 'dialog'); menu.setAttribute('aria-label', 'Avatar');
  const ritr = el('div', 'ritr'), rImg = document.createElement('img');
  rImg.alt = ''; rImg.style.display = 'none'; ritr.appendChild(rImg);
  const { carta, corpo } = cartaKit(o.nome, () => chiudi(), ritr);
  menu.appendChild(carta); o.root.appendChild(menu);
  let aperto = false;
  const setRitratto = (u: string) => { if (u) { rImg.src = u; rImg.style.display = ''; } else { rImg.removeAttribute('src'); rImg.style.display = 'none'; } };
  setRitratto(o.ritratto());
  function apri(): void {
    corpo.replaceChildren();
    for (const v of VOCI) {
      if (!document.getElementById(v.bottone)) continue;
      const b = el('button', 'mk-riga voce'); b.type = 'button'; b.dataset['voce'] = v.id;
      const ic = el('div', 'mk-ico'); ic.style.backgroundImage = icona(v.icona);
      const d = el('div', 'mk-dati'); d.append(el('div', 'mk-nome', v.titolo), el('div', 'mk-sotto', v.sotto));
      b.append(ic, d, el('b', '', '›'));
      b.addEventListener('click', (e) => { e.preventDefault(); chiudi(); document.getElementById(v.bottone)?.click(); });
      corpo.appendChild(b);
    }
    aperto = true; menu.classList.add('on');
    corpo.querySelector<HTMLElement>('.voce')?.focus({ preventScroll: true });
  }
  function chiudi(): void { if (!aperto) return; aperto = false; menu.classList.remove('on'); o.onChiuso(); }
  menu.addEventListener('click', (e) => { if (e.target === menu) chiudi(); });
  addEventListener('keydown', (e) => { if (aperto && e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); chiudi(); } }, true);
  return { apri, chiudi, isOpen: () => aperto, voci: () => [...corpo.querySelectorAll<HTMLElement>('.voce')].map((b) => b.dataset['voce'] ?? ''), setRitratto };
}
