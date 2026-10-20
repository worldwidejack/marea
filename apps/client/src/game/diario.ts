// Diario del capitano, parte nel bundle iniziale (piccola): bottone col libro in topbar (ordine 5) e tasto J (in main.ts),
// avvistamenti (animali passati vicino: li segnala game/animali.ts; isole dove entri, compresi i lotti degli amici) mandati al server a
// gruppi. L'album vero (le pagine) sta nel chunk ui/diario_ui.ts, scaricato alla prima apertura. Quello che conta (pesci, perle, medaglie)
// lo scrive il server dopo il replay. I traguardi coi titoli sono stati tolti (tag archivio/spenti-traguardi).
import { diarioOf, isolaValida } from '@marea/sim/economy/diario.ts';
import type { LotState } from '@marea/sim';
import { DIARIO } from '@marea/content/diario.ts';
import type { Api, LotOwner, Me } from '../net/api.ts';
import type { GameWorld } from './world.ts';
import type { Hud } from '../ui/hud.ts';
import { PAL } from '../ui/style.ts';
import { topButton } from '../ui/topbar.ts';
import { registerStateProvider, registerTestHook } from '../test/testapi.ts';

export type DiarioTab = 'pesci' | 'insetti' | 'perle' | 'animali' | 'medaglie' | 'isole';
export const DIARIO_TABS: readonly DiarioTab[] = ['pesci', 'insetti', 'perle', 'animali', 'medaglie', 'isole'];
export type Diario = {
  /** Un animale passato vicino (id di diario.json `animali`). */
  avvista(id: string): void;
  /** Ogni frame: isole visitate, invio degli avvistamenti. */
  update(dt: number, focus: { x: number; z: number }): void;
  open(tab?: DiarioTab): void; close(): void; isOpen(): boolean;
};
/** Quello che serve al chunk dell'album (ui/diario_ui.ts). */
export type DiarioCtx = {
  root: HTMLElement; hud: Hud; api: Api | null; me: Me | null; world: GameWorld;
  /** Chi abita il Borgo (me compreso): il diario degli amici. */
  owners: readonly LotOwner[];
  getLot(): LotState | null; setLot(l: LotState): void;
  onClose(): void;
};
type Chunk = typeof import('../ui/diario_ui.ts');
type Ui = ReturnType<Chunk['createDiarioUi']>;

const FLUSH_S = 1.5, RIPROVA_S = 10, ISOLE_S = 0.5;

// libro 12×12: c copertina rossa, d dorso, p pagine, y fermaglio giallo; contorno nero caldo aggiunto dal disegno
const LIBRO = ['............', '..dccccccc..', '..dccccccc..', '..dcyyyycc..', '..dccccccc..', '..dccccccc..', '..dccccccc..', '..dcccccyc..', '..dccccccc..', '..dppppppp..', '..dddddddd..', '............'];
/** Il libro del diario 12×12 (bottone in alto, testata del pannello). */
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

export function createDiario(o: { root: HTMLElement; hud: Hud; api: Api | null; me: Me | null; world: GameWorld; owners: readonly LotOwner[]; getLot(): LotState | null; setLot(l: LotState): void; hidden(): boolean;
  /** Pannelli aperti (scheda dell'eroe, edifici…): gli avvistamenti aspettano, perché il lotto nuovo li farebbe ridisegnare sotto il dito. */
  pausa?(): boolean;
  /** Prima di aprire: gli altri pannelli si chiudono (uno alla volta). */ onOpen?(): void }): Diario {
  const online = !!o.api?.enabled && !!o.me;
  let m: Chunk | null = null, ui: Ui | null = null, loading: Promise<Ui> | null = null;
  const ctx: DiarioCtx = { root: o.root, hud: o.hud, api: o.api, me: o.me, world: o.world, owners: o.owners, getLot: o.getLot, setLot: o.setLot, onClose: () => btn.setOn(false) };
  const load = (): Promise<Ui> => (loading ??= import('../ui/diario_ui.ts').then((x) => { m = x; ui = x.createDiarioUi(ctx); return ui; }, (e: unknown) => { loading = null; o.hud.toast('Connessione lenta: riprova', 2500); throw e; }));
  const btn = topButton({ root: o.root, id: 'mzDiarioBtn', order: 5, label: '', title: 'Diario del capitano (J)', nascosto: true, onClick: () => { if (api.isOpen()) api.close(); else api.open(); } });
  btn.el.insertBefore(libroIcon(), btn.el.firstChild);

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
  /** L'isola dove sei adesso, come id del diario (null = in mare, in una casa o nel negozio dei mobili: non sono isole). */
  const isolaQui = (x: number, z: number): string | null => {
    const p = o.world.archipelago.placeAt(x, z);
    return p && p.role !== 'negozio' && p.role !== 'lotto' ? p.island : null;
  };

  const api: Diario = {
    avvista(id) { if (DIARIO.animali.some((a) => a.id === id)) metti('animali', id); },
    update(dt, focus) {
      if (!online) return;
      isoleT -= dt;
      if (isoleT <= 0) {
        isoleT = ISOLE_S;
        const id = isolaQui(focus.x, focus.z);
        if (id && o.me && isolaValida(id, o.me.id)) metti('isole', id);
      }
      if (attesa >= 0) { if (o.pausa?.()) attesa = Math.max(attesa, 0.5); else { attesa -= dt; if (attesa < 0) void flush(); } }
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
      caricato: !!m, open: api.isOpen(), ui: ui?.state() ?? null, tabs: DIARIO_TABS,
      coda: { animali: [...coda.animali], isole: [...coda.isole] }, inviati,
      animali: d?.animali ?? [], isole: d?.isole ?? [], pesci: d?.pesci ?? {}, perle: d?.perle ?? {}, medaglie: d?.medaglie ?? {},
    };
  });
  registerTestHook('diarioApri', (tab) => { api.open(typeof tab === 'string' ? (tab as DiarioTab) : undefined); return load().then(() => true); });
  registerTestHook('diarioChiudi', () => api.close());
  registerTestHook('diarioAvvista', (id) => api.avvista(String(id)));
  registerTestHook('diarioFlush', () => flush());
  return api;
}
