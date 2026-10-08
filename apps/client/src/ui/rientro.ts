// «Mentre eri via» e libro degli ospiti (#86), chunk caricato con import() da game/libro.ts solo quando serve.
// - Cartolina (al rientro, se mancavi da abbastanza): da quanto mancavi, depositi pieni, cantiere finito, chi ha firmato il libro, novità
//   della campanella, missioni nuove. RACCOGLI TUTTO raccoglie tutti i depositi (l'azione di sempre, edificio per edificio) e chiude.
//   Un tocco fuori dalla cartolina, × o Esc la chiudono; Invio / Spazio / E = il bottone grande.
// - Libro: sull'isola di un amico FIRMA con una delle 8 emote (anche 1-8 sulla tastiera), una volta al giorno; sulla tua le ultime firme.
// Tastiera in capture su window solo a pannello aperto, con stopPropagation (mai keyup), come feed ed editor.
import { AVATAR, RIENTRO, building } from '@marea/content';
import { firmeRecenti } from '@marea/sim';
import type { LotState, Resources, Riepilogo } from '@marea/sim';
import type { EmoteId } from '@marea/protocol';
import type { Hud } from './hud.ts';
import { PAL, el, injectUiStyle } from './style.ts';
import { RES_IDS, RES_NOME, pixIcon, resIcon } from './icons.ts';
import { relTime } from './feed.ts';
import { EMOTE_WORDS, emoteIcon } from '../game/emote.ts';

export type LibroApri = {
  mine: boolean; ownerName: string; lot: LotState | null; now(): number;
  /** Puoi firmare adesso (isola di un amico, non hai ancora firmato oggi). */
  puoFirmare: boolean; firmato: boolean;
  firma(e: EmoteId): Promise<boolean>;
};
export type RientroUi = {
  readonly kind: 'libro' | 'cartolina' | null;
  libro(o: LibroApri): void;
  cartolina(r: Riepilogo, novita: number, raccogli: (() => void) | null): void;
  close(): void; isOpen(): boolean;
  state(): Record<string, unknown>;
};

const P = PAL;
const CSS = `
.mz-ri-bg { position: absolute; inset: 0; z-index: 27; display: none; background: rgba(35,32,31,.55); }
.mz-ri-bg.on { display: block; }
.mz-ri { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); z-index: 28; display: none; box-sizing: border-box; width: min(360px, calc(100% - 24px)); max-height: calc(100% - 120px); overflow-y: auto;
  padding: 16px 16px 14px; background: ${P.sabbiaChiara}; color: ${P.neroCaldo}; border: 3px solid ${P.legnoScuro}; box-shadow: 0 6px 0 ${P.neroCaldo}; outline: 2px dashed ${P.rosso}; outline-offset: -10px; }
.mz-ri.on { display: block; }
.mz-ri .stamp { position: absolute; right: 18px; top: 16px; width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; background: ${P.acquaBassa}; border: 2px solid ${P.legnoScuro}; outline: 2px dotted ${P.legnoScuro}; outline-offset: 2px; transform: rotate(4deg); }
.mz-ri h2 { margin: 2px 60px 2px 4px; font-size: 22px; line-height: 1.15; letter-spacing: .05em; color: ${P.legnoScuro}; }
.mz-ri .sub { margin: 0 60px 10px 4px; color: ${P.legno}; font-size: 14px; font-weight: bold; }
.mz-ri ul { list-style: none; margin: 0 4px; padding: 0; }
.mz-ri li { display: flex; align-items: flex-start; gap: 8px; padding: 7px 0; border-top: 2px solid ${P.sabbia}; font-size: 14px; line-height: 1.3; }
.mz-ri li > .ic { flex: none; display: flex; gap: 2px; margin-top: 1px; }
.mz-ri li b { display: block; }
.mz-ri li .n { display: inline-flex; align-items: center; gap: 3px; margin-right: 10px; font-weight: bold; white-space: nowrap; }
.mz-ri .firme { display: flex; flex-direction: column; gap: 2px; margin-top: 4px; }
.mz-ri .firme span { display: flex; align-items: center; gap: 6px; font-size: 13px; }
.mz-ri .firme i { font-style: normal; color: ${P.legno}; }
.mz-ri .acts { margin: 10px 4px 0; }
.mz-ri .mz-btn { justify-content: center; }
.mz-ri :focus { outline: none; } .mz-ri :focus-visible { outline: 3px solid ${P.giallo}; outline-offset: 2px; }
.mz-ri .mz-btn .tot { display: inline-flex; align-items: center; gap: 8px; }
.mz-ri .mz-btn .tot span { display: inline-flex; align-items: center; gap: 3px; }
.mz-sheet.mz-lb { box-sizing: border-box; }
.mz-lb .who { margin: 0 0 8px; color: ${P.sabbia}; font-size: 14px; }
.mz-lb .em { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin: 6px 0 4px; }
.mz-lb .em button { min-height: 64px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; padding: 4px 0; background: ${P.legnoScuro}; border: 2px solid ${P.legnoChiaro}; box-shadow: 0 3px 0 ${P.neroCaldo}; color: ${P.sabbiaChiara}; font: bold 12px ui-monospace, Menlo, monospace; cursor: pointer; }
.mz-lb .em button:active:not(:disabled) { transform: translateY(2px); box-shadow: 0 1px 0 ${P.neroCaldo}; }
.mz-lb .em button:disabled { border-color: ${P.pietraScura}; color: ${P.pietra}; cursor: default; }
.mz-lb .sec { margin: 12px 0 2px; padding-bottom: 2px; border-bottom: 2px solid ${P.legno}; color: ${P.sabbia}; font-size: 13px; font-weight: bold; text-transform: uppercase; letter-spacing: .06em; }
.mz-lb .fr { display: flex; align-items: center; gap: 8px; min-height: 40px; padding: 2px 0; border-bottom: 2px solid ${P.legnoScuro}; }
.mz-lb .fr b { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mz-lb .fr i { font-style: normal; font-size: 12px; color: ${P.pietra}; white-space: nowrap; }
.mz-lb .vuoto { margin: 8px 0; color: ${P.sabbia}; font-size: 14px; line-height: 1.35; }
`;

/** «20 min», «6 h 20 min», «1 giorno e 4 h», «3 giorni». */
export function durata(ms: number): string {
  const min = Math.max(1, Math.round(ms / 60_000));
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60), m = min % 60;
  if (h < 24) return m ? `${h} h ${m} min` : `${h} h`;
  const g = Math.floor(h / 24), hh = h % 24;
  if (g >= 2) return `${g} giorni`;
  return hh ? `1 giorno e ${hh} h` : '1 giorno';
}
const isEmote = (e: string): e is EmoteId => AVATAR.emote.includes(e);
const nomi = (xs: string[]): string => (xs.length <= 1 ? xs[0] ?? '' : xs.slice(0, -1).join(', ') + ' e ' + xs[xs.length - 1]);
function resSpans(r: Resources): HTMLElement[] {
  return RES_IDS.filter((k) => r[k] > 0).map((k) => { const s = el('span', 'n'); s.append(resIcon(k, 16), el('span', '', `+${r[k]} ${RES_NOME[k]}`)); return s; });
}

/** `now` = ora del server stimata (per «2 h fa»). */
export function createRientroUi(o: { root: HTMLElement; hud: Hud; now(): number; onClose?(): void }): RientroUi {
  injectUiStyle();
  if (!document.getElementById('mz-rientro-style')) { const s = document.createElement('style'); s.id = 'mz-rientro-style'; s.textContent = CSS; document.head.appendChild(s); }
  const bg = el('div', 'mz mz-ri-bg'); bg.id = 'mzRientroBg';
  const card = el('div', 'mz mz-ri'); card.id = 'mzRientro'; card.setAttribute('role', 'dialog'); card.setAttribute('aria-label', 'Mentre eri via');
  const sheet = el('div', 'mz mz-sheet mz-side mz-lb'); sheet.id = 'mzLibro'; sheet.setAttribute('role', 'dialog'); sheet.setAttribute('aria-label', 'Libro degli ospiti');
  for (const e of [bg, card, sheet]) for (const ev of ['pointerdown', 'touchstart']) e.addEventListener(ev, (x) => x.stopPropagation());
  bg.addEventListener('click', () => close());
  o.root.append(bg, card, sheet);
  let kind: RientroUi['kind'] = null, primary: (() => void) | null = null, firma: ((e: EmoteId) => void) | null = null;
  let st: Record<string, unknown> = {};

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (kind === 'cartolina' && !e.repeat && (e.code === 'Enter' || e.code === 'Space' || e.code === 'KeyE')) { e.preventDefault(); primary?.(); }
    else if (kind === 'libro' && !e.repeat && (e.code === 'KeyE' || e.code === 'Space')) { e.preventDefault(); close(); }
    else if (kind === 'libro' && firma) {
      const m = /^(?:Digit|Numpad)([1-8])$/.exec(e.code), id = m ? AVATAR.emote[Number(m[1]) - 1] : undefined;
      if (id && isEmote(id)) { e.preventDefault(); firma(id); }
    }
    e.stopPropagation(); // a pannello aperto i tasti non arrivano al gioco
  };
  function show(k: 'libro' | 'cartolina'): void {
    if (kind) close(true);
    kind = k;
    if (k === 'cartolina') { bg.classList.add('on'); card.classList.add('on'); } else sheet.classList.add('on');
    addEventListener('keydown', onKey, true);
  }
  function close(silent = false): void {
    if (!kind) return;
    kind = null; primary = null; firma = null;
    for (const e of [bg, card, sheet]) e.classList.remove('on');
    removeEventListener('keydown', onKey, true);
    if (!silent) o.onClose?.();
  }
  const xBtn = (): HTMLButtonElement => { const x = el('button', 'mz-x', '×'); x.type = 'button'; x.title = 'Chiudi (Esc)'; x.dataset['act'] = 'chiudi'; x.addEventListener('click', () => close()); return x; };

  function cartolina(r: Riepilogo, novita: number, raccogli: (() => void) | null): void {
    show('cartolina');
    const stamp = el('div', 'stamp'); stamp.append(pixIcon('casa', 32));
    const list = el('ul');
    const riga = (id: string, icons: HTMLElement[], ...body: (HTMLElement | string)[]) => {
      const li = el('li'); li.dataset['riga'] = id;
      const ic = el('span', 'ic'); ic.append(...icons);
      const tx = el('div'); tx.append(...body);
      li.append(ic, tx); list.appendChild(li);
    };
    const dep = r.depositi.legno + r.depositi.pietra + r.depositi.perle;
    if (dep > 0) { const d = el('div'); d.append(...resSpans(r.depositi)); riga('depositi', [resIcon(r.depositi.legno > 0 ? 'legno' : r.depositi.pietra > 0 ? 'pietra' : 'perle', 24)], el('b', '', 'Nei depositi della tua isola'), d); }
    if (r.cantiere) {
      const nome = building(r.cantiere.building).nome + (r.cantiere.level > 1 ? ` L${r.cantiere.level}` : '');
      riga('cantiere', [pixIcon('martello', 24)], el('b', '', `Cantiere finito: ${nome}`));
    }
    if (r.ospitiTot > 0) {
      const chi = [...new Set(r.ospiti.map((f) => f.nome))];
      const testa = chi.length > 3 ? `${chi.slice(0, 3).join(', ')} e altri ${chi.length - 3}` : nomi(chi);
      const fr = el('div', 'firme');
      for (const f of r.ospiti.slice(0, 3)) {
        const s = el('span'); if (isEmote(f.emote)) s.append(emoteIcon(f.emote, 20));
        s.append(el('span', '', `${f.nome}: «${isEmote(f.emote) ? EMOTE_WORDS[f.emote] : '…'}»`), el('i', '', relTime(o.now() - f.quando)));
        fr.appendChild(s);
      }
      riga('ospiti', [pixIcon('libro', 24)], el('b', '', `${testa} ${chi.length === 1 ? 'è passato' : 'sono passati'} sulla tua isola`), fr);
    }
    if (novita > 0) riga('novita', [pixIcon('parla', 24)], el('b', '', novita === 1 ? '1 novità nella campanella' : `${novita} novità nella campanella`));
    if (r.missioniNuove > 0) riga('missioni', [pixIcon('bacheca', 24)], el('b', '', `${r.missioniNuove} missioni nuove alla Bacheca del Porto`));
    const acts = el('div', 'acts');
    const go = el('button', 'mz-btn green'); go.type = 'button';
    if (dep > 0 && raccogli) {
      go.dataset['act'] = 'raccogli';
      const tot = el('span', 'tot'); tot.append(el('span', '', 'RACCOGLI TUTTO'));
      for (const k of RES_IDS) if (r.depositi[k] > 0) { const sp = el('span'); sp.append(resIcon(k, 16), el('span', '', String(r.depositi[k]))); tot.append(sp); }
      go.append(tot);
      primary = () => { close(); raccogli(); };
    } else { go.dataset['act'] = 'avanti'; go.textContent = 'AVANTI'; primary = () => close(); }
    go.addEventListener('click', () => primary?.());
    acts.append(go);
    if (dep > 0 && raccogli) { const later = el('button', 'mz-btn ghost', 'Dopo'); later.type = 'button'; later.dataset['act'] = 'chiudi'; later.addEventListener('click', () => close()); acts.append(later); }
    card.replaceChildren(stamp, el('h2', '', 'Mentre eri via'), el('div', 'sub', `Mancavi da ${durata(r.assenteMs)}`), list, acts);
    st = { righe: [...list.children].map((x) => (x as HTMLElement).dataset['riga']), raccogli: go.dataset['act'] === 'raccogli' };
    card.scrollTop = 0;
  }

  function libro(a: LibroApri): void {
    show('libro');
    const head = el('div', 'mz-head'); head.append(el('div', 'mz-title', 'Libro degli ospiti'), xBtn());
    const body: HTMLElement[] = [head, el('p', 'who', a.mine ? 'Chi è passato dalla tua isola' : `Isola di ${a.ownerName}`)];
    if (!a.mine) {
      if (a.puoFirmare) {
        body.push(el('div', 'sec', 'Firma con un saluto'));
        const row = el('div', 'em');
        const btns = AVATAR.emote.filter(isEmote).map((id, i) => {
          const b = el('button'); b.type = 'button'; b.dataset['emote'] = id; b.title = `${EMOTE_WORDS[id]} (${i + 1})`;
          b.append(emoteIcon(id, 32), el('span', '', EMOTE_WORDS[id]));
          b.addEventListener('click', () => firma?.(id));
          return b;
        });
        row.append(...btns); body.push(row);
        let inCorso = false;
        firma = (id) => {
          if (inCorso) return;
          inCorso = true; for (const b of btns) b.disabled = true;
          void a.firma(id).then((ok) => { if (!ok && kind === 'libro') { inCorso = false; for (const b of btns) b.disabled = false; } });
        };
      } else if (a.firmato) body.push(el('div', 'mz-note ok', 'Hai firmato oggi. Torna domani per un altro saluto.'));
    }
    const firme = a.lot ? firmeRecenti(a.lot, a.mine ? RIENTRO.firme.mostra : 5) : [];
    body.push(el('div', 'sec', a.mine ? `Ultime firme (${a.lot?.ospiti?.length ?? 0})` : 'Le ultime firme'));
    if (!firme.length) body.push(el('div', 'vuoto', a.mine ? 'Ancora nessuna firma. Quando un amico passa dalla tua isola, il suo saluto resta qui.' : 'Nessuno ha ancora firmato: sii il primo.'));
    const now = a.now();
    for (const f of firme) {
      const r = el('div', 'fr'); r.dataset['firma'] = f.chi;
      if (isEmote(f.emote)) r.append(emoteIcon(f.emote, 24));
      r.append(el('b', '', f.nome), el('i', '', relTime(now - f.quando)));
      body.push(r);
    }
    sheet.replaceChildren(...body);
    st = { mine: a.mine, puoFirmare: a.puoFirmare, firmato: a.firmato, firme: firme.map((f) => f.nome) };
  }

  return {
    get kind() { return kind; },
    libro, cartolina,
    close: () => close(),
    isOpen: () => kind !== null,
    state: () => ({ kind, ...st }),
  };
}
