// HUD «Allegro» (#417, scelte del gruppo del 18 ott 2026): i pezzi nuovi che il vecchio HUD non aveva.
// - AVATAR: un bottone solo col ritratto della tua testa; apre un menù a tutto schermo coi sottomenù di prima (Aspetto = editor,
//   Personaggio = zaino e armi, Foto). I bottoni vecchi (maglietta, scudo, macchina foto) restano nel DOM nascosti: il menù li «tocca».
// - Bandierina sul bordo della minimappa: apre e chiude l'elenco delle mete (la pillola sotto la minimappa fa lo stesso).
// - «Albi è online»: fumetto accanto alla campanella quando un amico entra nel mondo (evento `join` della Zone).
// Lo stile sta in ui/stile_allegro.ts.
import type { WebGLRenderer } from 'three';
import type { Look } from '@marea/protocol';
import type { NetClient } from '../net/client.ts';
import type { Loader } from '../render/loader.ts';
import { registerStateProvider, registerTestHook } from '../test/testapi.ts';
import { injectAllegro, testaSvg } from './stile_allegro.ts';
import { el } from './style.ts';
import { topButton } from './topbar.ts';

export type HudAllegro = { setLook(look: Look | null): void; update(): void; chiudi(): void; isOpen(): boolean };

export function createHudAllegro(o: { root: HTMLElement; net: NetClient; loader: Loader; gl: WebGLRenderer; look: Look | null; nome: string }): HudAllegro {
  injectAllegro();
  let look = o.look, url = '';
  const ritratti = (): Promise<typeof import('./ritratto_avatar.ts')> => import('./ritratto_avatar.ts');

  // ——— bottone AVATAR e menù ———
  const btn = topButton({ root: o.root, id: 'mzAvatarBtn', order: 2, label: '', title: 'Avatar', onClick: () => (menu?.isOpen() ? chiudi() : apri()) });
  const img = document.createElement('img'); img.alt = ''; img.decoding = 'async'; img.style.display = 'none'; btn.el.prepend(img);
  // il menù a tutto schermo sta in un chunk a parte (ui/menu_avatar.ts): si scarica al primo tocco, non pesa sull'avvio
  type Menu = import('./menu_avatar.ts').MenuAvatar;
  let menu: Menu | null = null, caricando: Promise<Menu> | null = null;
  const prendiMenu = (): Promise<Menu> => (caricando ??= import('./menu_avatar.ts').then((m) => (menu = m.createMenuAvatar({ root: o.root, nome: o.nome, ritratto: () => url, onChiuso: () => btn.setOn(false) }))));
  function apri(): void { btn.setOn(true); void prendiMenu().then((m) => m.apri()).catch(() => btn.setOn(false)); }
  function chiudi(): void { menu?.chiudi(); }
  const mostra = (u: string) => {
    url = u;
    if (u) { img.src = u; img.style.display = ''; } else { img.removeAttribute('src'); img.style.display = 'none'; }
    menu?.setRitratto(u);
  };
  // il ritratto vero (ui/ritratto_avatar.ts, col renderer del gioco) si fa una volta per look, 8 s dopo l'avvio quando il browser
  // respira, e si tiene in localStorage; intanto il bottone mostra la testa disegnata coi colori del look
  const CHIAVE = 'mz-ritratto:';
  const disegna = () => {
    const l = look;
    btn.el.style.setProperty('--mz-testa', testaSvg(l));
    if (!l) { mostra(''); return; }
    const k = CHIAVE + JSON.stringify(l);
    try { const u = localStorage.getItem(k); if (u) { mostra(u); return; } } catch { /* storage bloccato: si rifà */ }
    mostra('');
    const via = () => void ritratti().then((m) => m.ritrattoAvatar(l, o.loader, o.gl)).then((u) => {
      if (look !== l || !u) return;
      mostra(u);
      try { for (const x of Object.keys(localStorage)) if (x.startsWith(CHIAVE)) localStorage.removeItem(x); localStorage.setItem(k, u); } catch { /* pieno o bloccato: pazienza */ }
    }).catch(() => {});
    setTimeout(() => { if ('requestIdleCallback' in window) requestIdleCallback(via, { timeout: 4000 }); else via(); }, 8000);
  };
  disegna();

  // ——— bandierina delle mete sul bordo della minimappa ———
  const flag = el('button', 'mz'); flag.id = 'mzMiniMete'; flag.type = 'button'; flag.title = 'Mete'; flag.setAttribute('aria-label', 'Mete');
  flag.addEventListener('click', (e) => { e.preventDefault(); flag.blur(); document.getElementById('mzMete')?.click(); });
  o.root.appendChild(flag);

  // ——— «X è online» ———
  const bolla = el('div', 'mz'); bolla.id = 'mzOnline'; bolla.setAttribute('role', 'status');
  o.root.appendChild(bolla);
  let bollaT: ReturnType<typeof setTimeout> | null = null, ultimo = '';
  const visto = new Map<string, number>();
  const annuncia = (id: string, chi: string, suo: Look | null) => {
    const ora = Date.now();
    if (ora - (visto.get(id) ?? -Infinity) < 5 * 60_000) return; // chi si ricollega di continuo non riempie lo schermo
    visto.set(id, ora); ultimo = chi;
    const faccia = el('i'); faccia.style.backgroundImage = testaSvg(suo); // niente WebGL per gli amici: la testa coi loro colori
    bolla.replaceChildren(faccia, el('span', '', `${chi} è online`));
    bolla.classList.add('on');
    if (bollaT) clearTimeout(bollaT);
    bollaT = setTimeout(() => { bolla.classList.remove('on'); bollaT = null; }, 5000);
  };
  o.net.on('join', (m) => { if (m.peer.id !== o.net.me?.id) annuncia(m.peer.id, m.peer.nome, m.peer.look); });

  registerStateProvider('hudAllegro', () => ({ menu: !!menu?.isOpen(), voci: menu?.voci() ?? [], ritratto: !!url, online: bolla.classList.contains('on') ? ultimo : null }));
  registerTestHook('hudAllegroOnline', (nome) => { annuncia('test:' + String(nome), String(nome), look); return true; });

  return {
    setLook(l) { if (JSON.stringify(l) === JSON.stringify(look)) return; look = l; disegna(); },
    update() { const c = document.getElementById('compass'); flag.classList.toggle('on', !!c?.classList.contains('open')); },
    chiudi,
    isOpen: () => !!menu?.isOpen(),
  };
}
