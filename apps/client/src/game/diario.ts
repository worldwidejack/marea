// Diario del capitano (#87), parte nel bundle iniziale (piccola): bottone col libro in topbar (ordine 5) e tasto J (in main.ts), numerino
// dei traguardi da riscuotere, avviso breve quando se ne compie uno, avvistamenti (animali passati vicino: li segnala game/animali.ts;
// isole dove entri, compresi i lotti degli amici) mandati al server a gruppi. L'album vero (pagine, RISCUOTI, titoli) sta nel chunk
// ui/diario_ui.ts, scaricato alla prima apertura. Quello che conta (pesci, perle, medaglie) lo scrive il server dopo il replay.
import { daRiscuotere, diarioOf, isolaValida, traguardiOf } from '@marea/sim/economy/diario.ts';
import type { LotState } from '@marea/sim';
import { DIARIO } from '@marea/content/diario.ts';
import type { Api, LotOwner, Me } from '../net/api.ts';
import type { GameWorld } from './world.ts';
import type { Hud } from '../ui/hud.ts';
import { PAL, el } from '../ui/style.ts';
import { topButton } from '../ui/topbar.ts';
import { registerStateProvider, registerTestHook } from '../test/testapi.ts';
import { suona } from '../audio/ponte.ts';

export type DiarioTab = 'pesci' | 'perle' | 'animali' | 'medaglie' | 'isole' | 'traguardi';
export const DIARIO_TABS: readonly DiarioTab[] = ['pesci', 'perle', 'animali', 'medaglie', 'isole', 'traguardi'];
export type Diario = {
  /** Un animale passato vicino (id di diario.json `animali`). */
  avvista(id: string): void;
  /** Ogni frame: isole visitate, traguardi appena compiuti, invio degli avvistamenti. */
  update(dt: number, focus: { x: number; z: number }): void;
  open(tab?: DiarioTab): void; close(): void; isOpen(): boolean;
};
/** Quello che serve al chunk dell'album (ui/diario_ui.ts). */
export type DiarioCtx = {
  root: HTMLElement; hud: Hud; api: Api | null; me: Me | null; world: GameWorld;
  /** Chi ha un'isola (me compreso): nomi delle visite e diario degli amici. */
  owners: readonly LotOwner[];
  getLot(): LotState | null; setLot(l: LotState): void;
  onClose(): void;
};
type Chunk = typeof import('../ui/diario_ui.ts');
type Ui = ReturnType<Chunk['createDiarioUi']>;

const FLUSH_S = 1.5, RIPROVA_S = 10, ISOLE_S = 0.5;

// libro 12×12: c copertina rossa, d dorso, p pagine, y fermaglio giallo; contorno nero caldo aggiunto dal disegno
const LIBRO = ['............', '..dccccccc..', '..dccccccc..', '..dcyyyycc..', '..dccccccc..', '..dccccccc..', '..dccccccc..', '..dcccccyc..', '..dccccccc..', '..dppppppp..', '..dddddddd..', '............'];
/** Il libro del diario 12×12 (bottone in alto, avviso, testata del pannello). */
export function libroIcon(): HTMLCanvasElement {
  const c = document.createElement('canvas'); c.width = 12; c.height = 12; c.className = 'mz-ico'; c.setAttribute('aria-hidden', 'true');
  c.style.width = c.style.height = '24px';
  const g = c.getContext('2d');
  if (!g) return c;
  const at = (x: number, y: number): string => LIBRO[y]?.[x] ?? '.';
  const col: Record<string, string> = { c: PAL.rosso, d: PAL.legnoScuro, p: PAL.sabbiaChiara, y: PAL.giallo };
  for (let y = 0; y < 12; y++) for (let x = 0; x < 12; x++) {
    const k = at(x, y);
    const fill = col[k] ?? ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => at(x + dx!, y + dy!) !== '.') ? PAL.neroCaldo : null);
    if (fill) { g.fillStyle = fill; g.fillRect(x, y, 1, 1); }
  }
  return c;
}

const CSS = `
#mzTrag { position: absolute; left: 50%; top: calc(max(8px, env(safe-area-inset-top)) + 54px); transform: translate(-50%, -8px); z-index: 27; display: flex; align-items: center; gap: 8px; max-width: calc(100% - 24px); box-sizing: border-box; padding: 6px 10px; background: rgba(46,30,20,.96); border: 2px solid ${PAL.giallo}; box-shadow: 0 3px 0 ${PAL.neroCaldo}; opacity: 0; pointer-events: none; transition: opacity .15s steps(3), transform .15s steps(3); }
#mzTrag.on { opacity: 1; transform: translate(-50%, 0); pointer-events: auto; cursor: pointer; }
#mzTrag .t { display: flex; flex-direction: column; min-width: 0; font-size: 14px; font-weight: bold; line-height: 1.25; }
#mzTrag .t small { font-size: 12px; color: ${PAL.sabbia}; font-weight: bold; }
#mzTrag .t b { color: ${PAL.giallo}; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
#ui.mz-racing #mzTrag, body.mz-sotto #mzTrag { visibility: hidden; }
`;

export function createDiario(o: { root: HTMLElement; hud: Hud; api: Api | null; me: Me | null; world: GameWorld; owners: readonly LotOwner[]; getLot(): LotState | null; setLot(l: LotState): void; hidden(): boolean;
  /** Prima di aprire: gli altri pannelli si chiudono (uno alla volta). */ onOpen?(): void }): Diario {
  if (!document.getElementById('mz-diario-style')) { const st = document.createElement('style'); st.id = 'mz-diario-style'; st.textContent = CSS; document.head.appendChild(st); }
  const online = !!o.api?.enabled && !!o.me;
  const amici = () => o.owners.filter((w) => w.id !== o.me?.id).length;
  let m: Chunk | null = null, ui: Ui | null = null, loading: Promise<Ui> | null = null;
  const ctx: DiarioCtx = { root: o.root, hud: o.hud, api: o.api, me: o.me, world: o.world, owners: o.owners, getLot: o.getLot, setLot: o.setLot, onClose: () => btn.setOn(false) };
  const load = (): Promise<Ui> => (loading ??= import('../ui/diario_ui.ts').then((x) => { m = x; ui = x.createDiarioUi(ctx); return ui; }, (e: unknown) => { loading = null; o.hud.toast('Connessione lenta: riprova', 2500); throw e; }));
  const btn = topButton({ root: o.root, id: 'mzDiarioBtn', order: 5, label: '', title: 'Diario del capitano (J)', onClick: () => { if (api.isOpen()) api.close(); else api.open(); } });
  btn.el.insertBefore(libroIcon(), btn.el.firstChild);

  // ---- avviso «traguardo compiuto» (tocco = apre il diario sui traguardi) ----
  const avviso = el('div', 'mz'); avviso.id = 'mzTrag'; avviso.setAttribute('role', 'status');
  avviso.addEventListener('click', () => api.open('traguardi'));
  for (const ev of ['pointerdown', 'touchstart']) avviso.addEventListener(ev, (e) => e.stopPropagation());
  o.root.appendChild(avviso);
  let avvisoT = 0, ultimoAvviso = '';
  const mostra = (nome: string, quanti: number) => {
    const t = el('div', 't');
    t.append(el('small', '', quanti > 1 ? `${quanti} TRAGUARDI COMPIUTI` : 'TRAGUARDO COMPIUTO'), el('b', '', nome), el('small', '', 'Riscuoti nel diario' + (matchMedia('(pointer: coarse)').matches ? '' : ' (J)')));
    const ico = libroIcon();
    avviso.replaceChildren(ico, t); avviso.classList.add('on'); ultimoAvviso = nome;
    clearTimeout(avvisoT); avvisoT = window.setTimeout(() => avviso.classList.remove('on'), 3800);
    suona('notifica');
  };

  // ---- traguardi compiuti: badge e avviso solo per quelli nuovi (all'avvio niente avviso, solo il numerino) ----
  let visti: Set<string> | null = null, lastLot: LotState | null = null;
  const controlla = () => {
    const lot = o.getLot();
    if (!online || !lot || lot === lastLot) return;
    lastLot = lot;
    const pronti = daRiscuotere(lot, { amici: amici() });
    btn.setBadge(pronti.length);
    if (!visti) { visti = new Set(pronti); return; }
    const nuovi = pronti.filter((id) => !visti!.has(id));
    for (const id of pronti) visti.add(id);
    if (nuovi.length) {
      const t = traguardiOf(lot, { amici: amici() }).find((x) => x.id === nuovi[0]);
      if (t) mostra(t.nome, nuovi.length);
    }
  };

  // ---- avvistamenti: in coda finché il server non li ha (a gruppi, ritenta dopo un errore) ----
  const coda = { animali: new Set<string>(), isole: new Set<string>() };
  let attesa = -1, inVolo = false, isoleT = 0, inviati = 0;
  const giaNoto = (kind: 'animali' | 'isole', id: string) => { const l = o.getLot(); return !!l && diarioOf(l)[kind].includes(id); };
  const metti = (kind: 'animali' | 'isole', id: string) => {
    if (!online || coda[kind].has(id) || giaNoto(kind, id)) return;
    coda[kind].add(id);
    if (attesa < 0) attesa = FLUSH_S;
  };
  const flush = async (): Promise<void> => {
    if (inVolo || !o.api || (!coda.animali.size && !coda.isole.size)) return;
    const animali = [...coda.animali].slice(0, 20), isole = [...coda.isole].slice(0, 20);
    inVolo = true; attesa = -1;
    try {
      const r = await o.api.diarioVisto({ animali, isole });
      for (const a of animali) coda.animali.delete(a);
      for (const i of isole) coda.isole.delete(i);
      inviati++;
      o.setLot(r.lot);
      if (coda.animali.size || coda.isole.size) attesa = FLUSH_S;
    } catch { attesa = RIPROVA_S; } finally { inVolo = false; }
  };
  /** L'isola dove sei adesso, come id del diario (null = in mare o a casa tua). */
  const isolaQui = (x: number, z: number): string | null => {
    const p = o.world.archipelago.placeAt(x, z);
    if (!p) return null;
    if (p.role !== 'lotto') return p.island;
    if (p.slot === o.world.slot) return null;
    const w = o.owners.find((q) => q.slot === p.slot);
    return w && o.me && w.id !== o.me.id ? `lotto:${w.id}` : null;
  };

  const api: Diario = {
    avvista(id) { if (DIARIO.animali.some((a) => a.id === id)) metti('animali', id); },
    update(dt, focus) {
      controlla();
      if (!online) return;
      isoleT -= dt;
      if (isoleT <= 0) {
        isoleT = ISOLE_S;
        const id = isolaQui(focus.x, focus.z);
        if (id && o.me && isolaValida(id, o.me.id)) metti('isole', id);
      }
      if (attesa >= 0) { attesa -= dt; if (attesa < 0) void flush(); }
    },
    open(tab) {
      if (o.hidden()) return;
      if (!api.isOpen()) o.onOpen?.();
      btn.setOn(true);
      if (ui) ui.open(tab); else void load().then((u) => { if (btn.el.classList.contains('on')) u.open(tab); }, () => btn.setOn(false));
    },
    close() { btn.setOn(false); ui?.close(); },
    isOpen: () => !!ui?.isOpen(),
  };
  registerStateProvider('diario', () => {
    const lot = o.getLot(), d = lot ? diarioOf(lot) : null;
    return {
      caricato: !!m, open: api.isOpen(), ui: ui?.state() ?? null, badge: lot && online ? daRiscuotere(lot, { amici: amici() }).length : 0,
      coda: { animali: [...coda.animali], isole: [...coda.isole] }, inviati, avviso: avviso.classList.contains('on') ? ultimoAvviso : null,
      animali: d?.animali ?? [], isole: d?.isole ?? [], pesci: d?.pesci ?? {}, perle: d?.perle ?? {}, medaglie: d?.medaglie ?? {}, riscossi: d?.riscossi ?? [], titolo: d?.titolo ?? null,
    };
  });
  registerTestHook('diarioApri', (tab) => { api.open(typeof tab === 'string' ? (tab as DiarioTab) : undefined); return load().then(() => true); });
  registerTestHook('diarioChiudi', () => api.close());
  registerTestHook('diarioAvvista', (id) => api.avvista(String(id)));
  registerTestHook('diarioFlush', () => flush());
  return api;
}
