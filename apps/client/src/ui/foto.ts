// Modalità foto (#109), parte nel bundle iniziale (piccola): bottone con la macchina fotografica a pixel nella barra in alto (ordine 6) e
// tasto O (in main.ts: P è della pesca). Tutto il resto (interfaccia che sparisce, camera che gira attorno all'avatar, SCATTA, cornice,
// SALVA / CONDIVIDI) sta nel chunk ui/foto_ui.ts, scaricato alla prima apertura. Il mondo resta vivo, l'avatar sta fermo (main.ts).
import { PAL } from './style.ts';
import { topButton } from './topbar.ts';
import { registerStateProvider, registerTestHook } from '../test/testapi.ts';
import type { DioramaCamera } from '../render/camera.ts';
import type { Hud } from './hud.ts';

/** Quello che serve al chunk (ui/foto_ui.ts). */
export type FotoCtx = {
  root: HTMLElement;
  /** Il canvas WebGL del gioco (alla risoluzione a pixel). */
  canvas: HTMLCanvasElement;
  diorama: DioramaCamera;
  /** Un render apposito subito prima di leggere il canvas (stesso frame: non dipende da preserveDrawingBuffer). */
  rendi(): void;
  /** Nome del posto dove sei («Porto», «Isola di Jack»), null in mare aperto. */
  posto(): string | null;
  onClose(): void;
};
type Chunk = typeof import('./foto_ui.ts');
type Ui = ReturnType<Chunk['createFotoUi']>;
export type Foto = { open(): void; close(): void; toggle(): void; isOpen(): boolean };

// macchina fotografica 14×11: c corpo, d fascia scura, o ghiera dell'obiettivo, v vetro, y flash; contorno nero caldo aggiunto dal disegno
const CAMERA = [
  '..............', '...cccc...yy..', '.cccccccccccc.', '.ccccoooocccc.', '.cccovvvvoccc.', '.ddovvvvvvodd.', '.ddovvvvvvodd.', '.cccovvvvoccc.', '.ccccoooocccc.', '.cccccccccccc.', '..............',
];
/** La macchina fotografica a pixel (bottone in alto e bottone SCATTA). */
export function cameraIcon(px = 28): HTMLCanvasElement {
  const W = 14, H = 11, c = document.createElement('canvas'); c.width = W; c.height = H; c.className = 'mz-ico'; c.setAttribute('aria-hidden', 'true');
  c.style.width = `${px}px`; c.style.height = `${Math.round((px * H) / W)}px`;
  const g = c.getContext('2d'); if (!g) return c;
  const at = (x: number, y: number) => CAMERA[y]?.[x] ?? '.';
  const col: Record<string, string> = { c: PAL.pietra, d: PAL.roccia, o: PAL.neroCaldo, v: PAL.acquaProfonda, y: PAL.giallo };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const k = at(x, y);
    const fill = col[k] ?? ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => at(x + dx!, y + dy!) !== '.') ? PAL.neroCaldo : null);
    if (fill) { g.fillStyle = fill; g.fillRect(x, y, 1, 1); }
  }
  g.fillStyle = PAL.acquaBassa; g.fillRect(5, 4, 1, 1); // riflesso sul vetro
  return c;
}

export function createFoto(o: Omit<FotoCtx, 'onClose'> & { hud: Hud;
  /** Si può entrare adesso? (niente gara, minigioco, dungeon) */ puo(): boolean;
  /** Prima di entrare: i pannelli aperti si chiudono. */ prima(): void }): Foto {
  let ui: Ui | null = null, loading: Promise<Ui> | null = null;
  const ctx: FotoCtx = { root: o.root, canvas: o.canvas, diorama: o.diorama, rendi: o.rendi, posto: o.posto, onClose: () => btn.setOn(false) };
  const load = (): Promise<Ui> => (loading ??= import('./foto_ui.ts').then((m) => (ui = m.createFotoUi(ctx)), (e: unknown) => { loading = null; o.hud.toast('Connessione lenta: riprova', 2500); throw e; }));
  const open = () => {
    if (ui?.isOpen()) return;
    if (!o.puo()) { o.hud.toast('Le foto dopo: adesso stai giocando', 2200); return; }
    o.prima(); btn.setOn(true);
    void load().then((u) => { if (o.puo()) u.open(); else btn.setOn(false); }).catch(() => { btn.setOn(false); });
  };
  const close = () => { ui?.close(); btn.setOn(false); };
  const btn = topButton({ root: o.root, id: 'mzFotoBtn', order: 6, label: '', title: 'Foto (O)', onClick: () => (ui?.isOpen() ? close() : open()) });
  btn.el.insertBefore(cameraIcon(28), btn.el.firstChild);
  registerStateProvider('foto', () => ({ caricata: !!ui, ...(ui ? ui.stato() : { aperta: false, anteprima: false, visibili: [] as string[] }) }));
  registerTestHook('foto', async (azione, ...n) => {
    const a = String(azione ?? 'apri');
    if (a === 'apri') { open(); await loading; return !!ui?.isOpen(); }
    if (a === 'chiudi') { close(); return true; }
    if (a === 'scatta') { const u = await load(); return u.scatta(); }
    if (a === 'indietro') { ui?.indietro(); return true; }
    if (a === 'gira') { ui?.gira(Number(n[0] ?? 0), Number(n[1] ?? 0), Number(n[2] ?? 1)); return true; } // dyaw, dpitch (rad), zoom ×
    if (a === 'dati') return ui?.dati() ?? null;
    throw new Error('azione foto sconosciuta: ' + a);
  });
  return { open, close, toggle: () => (ui?.isOpen() ? close() : open()), isOpen: () => !!ui?.isOpen() };
}
