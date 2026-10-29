// Il pannello di acquisto dei mercanti ai moli delle isole (Casco all'Adrenalina, Lanterna al Vulcano).
// Kit dell'interfaccia (ui/kit.ts): carta crema col bordo d'oro, ritratto del venditore, battuta, scheda del pezzo.
import { AVATAR } from '@marea/content';
import { ownsHat } from '@marea/sim';
import type { LotState } from '@marea/sim';
import type { Look } from '@marea/protocol';
import type { Api, Me } from '../net/api.ts';
import type { Hud } from './hud.ts';
import { el } from './style.ts';
import { FONT_LIBRO, LIBRO as L, fermaTocchi, injectKit } from './kit.ts';
import { resIcon } from './icons.ts';
import { disegnoCappello } from '../game/abiti.ts';
import { suona } from '../audio/ponte.ts';
import { FLAGS } from '../flags.ts';

export type MercanteMoloInfo = {
  isola: 'adrenalina' | 'vulcano';
  nomeNpc: string;
  titolo: string;
  battuta: string;
  hatId: 'casco' | 'lanterna';
  hatNome: string;
  monete: number;
  descr: string;
};

export type MercanteMoloUiOpts = {
  root: HTMLElement;
  hud: Hud;
  api: Api | null;
  me: Me | null;
  getLot(): LotState | null;
  setLot(l: LotState): void;
  setLook(l: Look): void;
  look(): Look;
  onClose?: () => void;
};

export type MercanteMoloUi = {
  apri(info: MercanteMoloInfo): void;
  isOpen(): boolean;
  close(): void;
};

const CSS = `
#mzMercanteMolo .mk-carta { max-height: 80%; }
#mzMercanteMolo .mm-chi { display: flex; gap: 10px; align-items: center; margin-bottom: 10px; }
#mzMercanteMolo .mm-fig { width: 56px; height: 56px; border-radius: 10px; border: 2px solid ${L.oro}; background: ${L.cartaScura} center/contain no-repeat; flex: 0 0 auto; }
#mzMercanteMolo .mm-bolla { position: relative; flex: 1; padding: 8px 12px; border-radius: 12px; border: 1.5px solid ${L.oro}; background: ${L.cartaChiara}; font: italic 400 13px/1.25 ${FONT_LIBRO}; color: ${L.inchiostro}; }
#mzMercanteMolo .mm-bolla::before { content: ''; position: absolute; left: -6px; top: 50%; width: 8px; height: 8px; margin-top: -4px; background: ${L.cartaChiara}; border-left: 1.5px solid ${L.oro}; border-bottom: 1.5px solid ${L.oro}; transform: rotate(45deg); }
#mzMercanteMolo .mm-card { display: flex; gap: 12px; align-items: center; padding: 10px; border-radius: 12px; background: ${L.cartaChiara}; border: 1.5px solid ${L.filo}; margin-bottom: 12px; }
#mzMercanteMolo .mm-ico { width: 64px; height: 64px; border-radius: 10px; border: 1.5px solid ${L.filo}; background: ${L.cartaScura}; display: grid; place-items: center; flex: 0 0 auto; }
#mzMercanteMolo .mm-ico img { width: 56px; height: 56px; object-fit: contain; image-rendering: pixelated; }
#mzMercanteMolo .mm-info { flex: 1; min-width: 0; }
#mzMercanteMolo .mm-nome { font: 700 17px/1.15 ${FONT_LIBRO}; color: ${L.inchiostro}; }
#mzMercanteMolo .mm-descr { font: 400 12px/1.25 ${FONT_LIBRO}; color: ${L.inchiostro2}; margin-top: 3px; }
#mzMercanteMolo .mm-prezzo { display: inline-flex; align-items: center; gap: 4px; font: 700 15px ${FONT_LIBRO}; color: ${L.inchiostro}; margin-top: 5px; }
#mzMercanteMolo .mm-act { width: 100%; min-height: 44px; border-radius: 12px; border: 2px solid ${L.inchiostro}; background: ${L.acqua}; color: ${L.cartaChiara}; font: 700 15px ${FONT_LIBRO}; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; box-shadow: 0 3px 0 ${L.inchiostro}; }
#mzMercanteMolo .mm-act:active { transform: translateY(2px); box-shadow: 0 1px 0 ${L.inchiostro}; }
#mzMercanteMolo .mm-act:disabled { background: ${L.cartaScura}; color: ${L.inchiostro2}; cursor: default; border-color: ${L.filo}; box-shadow: none; transform: none; }
#mzMercanteMolo .mm-act.indossa { background: ${L.foglia}; }
#mzMercanteMolo .mm-monete { display: flex; align-items: center; justify-content: flex-end; gap: 5px; margin-top: 8px; font: 400 13px ${FONT_LIBRO}; color: ${L.inchiostro2}; }
`;

export function createMercanteMoloUi(o: MercanteMoloUiOpts): MercanteMoloUi {
  injectKit();
  if (!document.getElementById('mz-mercante-molo-style')) {
    const st = document.createElement('style'); st.id = 'mz-mercante-molo-style'; st.textContent = CSS; document.head.appendChild(st);
  }
  const box = fermaTocchi(el('div', 'mk-velo'));
  box.id = 'mzMercanteMolo';
  box.setAttribute('role', 'dialog');
  box.addEventListener('wheel', (e) => e.stopPropagation(), { passive: true });
  box.addEventListener('click', (e) => { if (e.target === box) close(); });
  o.root.appendChild(box);

  let cur: MercanteMoloInfo | null = null, busy = false;
  let testLot: { monete: number; posseduti?: string[] } | null = null;

  const currentLot = (): { monete: number; posseduti?: string[] } | null =>
    o.getLot() ?? (FLAGS.test ? (testLot ??= { monete: 1000, posseduti: [] }) : null);

  function onKey(e: KeyboardEvent): void {
    if (!cur) return;
    if (e.key === 'Escape') { e.preventDefault(); close(); }
  }

  function close(): void {
    if (!cur) return;
    cur = null;
    box.classList.remove('on');
    box.replaceChildren();
    removeEventListener('keydown', onKey);
    o.onClose?.();
  }

  async function compra(info: MercanteMoloInfo): Promise<void> {
    if (busy) return;
    const lot = currentLot(), monete = lot?.monete ?? 0;
    if (monete < info.monete) {
      o.hud.toast(`Ti mancano ${info.monete - monete} monete!`, 2500);
      return;
    }
    busy = true;
    render(info);
    try {
      const api = o.api && FLAGS.token ? o.api : null;
      if (api) {
        const nuovoLot = await api.buyHat(info.hatId);
        o.setLot(nuovoLot);
      } else if (lot) {
        lot.monete -= info.monete;
        const posseduti = lot.posseduti ? [...lot.posseduti] : [];
        if (!posseduti.includes(info.hatId)) posseduti.push(info.hatId);
        lot.posseduti = posseduti;
        if (o.getLot()) o.setLot({ ...o.getLot()!, monete: lot.monete, posseduti });
      }
      const hatIdx = AVATAR.cappelli.findIndex((h) => h.id === info.hatId);
      const look = { ...o.look(), cappello: hatIdx };
      if (api) await api.look(look).catch(() => undefined);
      if (o.me) o.me.look = { ...o.me.look, ...look };
      o.setLook(look);
      suona('medaglia_bronzo');
      o.hud.toast(`${info.hatNome}: acquistato e indossato!`, 3200);
    } catch (e) {
      o.hud.toast(e instanceof Error ? e.message : 'Acquisto non riuscito, riprova', 3000);
    } finally {
      busy = false;
      if (cur) render(cur);
    }
  }

  async function indossa(info: MercanteMoloInfo): Promise<void> {
    if (busy) return;
    busy = true;
    render(info);
    try {
      const hatIdx = AVATAR.cappelli.findIndex((h) => h.id === info.hatId);
      const look = { ...o.look(), cappello: hatIdx };
      const api = o.api && FLAGS.token ? o.api : null;
      if (api) await api.look(look).catch(() => undefined);
      if (o.me) o.me.look = { ...o.me.look, ...look };
      o.setLook(look);
      suona('click');
      o.hud.toast(`${info.hatNome}: indossato!`, 2500);
    } finally {
      busy = false;
      if (cur) render(cur);
    }
  }

  function render(info: MercanteMoloInfo): void {
    const lot = currentLot(), monete = lot?.monete ?? 0;
    const posseduto = !!lot && ((lot.posseduti?.includes(info.hatId) ?? false) || ownsHat(lot as LotState, info.hatId));
    const hatIdx = AVATAR.cappelli.findIndex((h) => h.id === info.hatId);
    const inTesta = o.look().cappello === hatIdx;

    const carta = el('div', 'mk-carta');
    const testa = el('div', 'mk-testa');
    const nomebox = el('div', 'mk-nomebox');
    nomebox.appendChild(el('div', 'mk-titolo', info.titolo));
    const btnX = el('button', 'mk-x', '×') as HTMLButtonElement;
    btnX.type = 'button';
    btnX.setAttribute('aria-label', 'Chiudi');
    btnX.addEventListener('click', () => close());
    testa.append(nomebox, btnX);

    const chi = el('div', 'mm-chi');
    const fig = el('div', 'mm-fig');
    fig.style.backgroundImage = `url("${disegnoCappello(info.hatId)}")`;
    const bolla = el('div', 'mm-bolla', `«${info.battuta}»`);
    chi.append(fig, bolla);

    const card = el('div', 'mm-card');
    const ico = el('div', 'mm-ico');
    const im = document.createElement('img'); im.src = disegnoCappello(info.hatId); im.alt = info.hatNome;
    ico.appendChild(im);
    const inf = el('div', 'mm-info');
    inf.appendChild(el('div', 'mm-nome', info.hatNome));
    inf.appendChild(el('div', 'mm-descr', info.descr));
    if (!posseduto) {
      const pr = el('div', 'mm-prezzo');
      pr.append(resIcon('monete', 16), String(info.monete));
      inf.appendChild(pr);
    }
    card.append(ico, inf);

    const actBtn = el('button', 'mm-act') as HTMLButtonElement;
    actBtn.type = 'button';
    if (inTesta) {
      actBtn.textContent = 'In testa';
      actBtn.disabled = true;
    } else if (posseduto) {
      actBtn.textContent = 'Indossa';
      actBtn.classList.add('indossa');
      actBtn.disabled = busy;
      actBtn.addEventListener('click', () => { void indossa(info); });
    } else {
      actBtn.disabled = busy || monete < info.monete;
      if (monete < info.monete) {
        actBtn.textContent = `Ti mancano ${info.monete - monete} monete`;
      } else {
        actBtn.replaceChildren(document.createTextNode('Compra per '), resIcon('monete', 16), document.createTextNode(` ${info.monete}`));
        actBtn.addEventListener('click', () => { void compra(info); });
      }
    }

    const bilancio = el('div', 'mm-monete');
    bilancio.append(document.createTextNode('Le tue monete: '), resIcon('monete', 16), document.createTextNode(` ${monete}`));

    carta.append(testa, chi, card, actBtn, bilancio);
    box.replaceChildren(carta);
  }

  return {
    apri(info) {
      cur = info;
      busy = false;
      render(info);
      box.classList.add('on');
      addEventListener('keydown', onKey);
    },
    isOpen: () => cur !== null && box.classList.contains('on'),
    close,
  };
}
