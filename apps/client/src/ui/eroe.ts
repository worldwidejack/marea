// Scheda del personaggio (R-pannelli, bundle iniziale: piccolo): bottone #mzHeroBtn in topbar (scudo a pixel, ordine 4) e tasto I (in main.ts);
// i pannelli veri stanno nel chunk GDR, caricato col primo tocco. setEroeForPanels: i fogli degli edifici (lotpanels) aprono Banco & co.
import type { BuildingKind, PanelCtx } from '../rpg/types.ts';
import { PAL } from './style.ts';
import { topButton } from './topbar.ts';
import { registerStateProvider } from '../test/testapi.ts';

export type Eroe = { open(): void; close(): void; isOpen(): boolean; openBuilding(kind: BuildingKind): void };
type Chunk = typeof import('../rpg/index.ts');

let forPanels: Eroe | null = null;
/** Chi apre i pannelli degli edifici GDR dai fogli dell'isola (null senza link personale). */
export function eroeForPanels(): Eroe | null { return forPanels; }
export function setEroeForPanels(e: Eroe | null): void { forPanels = e; }

// scudo 12×12: r rosso, y giallo, p bordo chiaro; il contorno nero caldo lo aggiunge il disegno
const SHIELD = ['............', '.pppppppppp.', '.pyyyyrrrrp.', '.pyyyyrrrrp.', '.pyyyyrrrrp.', '.prrrryyyyp.', '.prrrryyyyp.', '..prrryyyp..', '...prryyp...', '....pryp....', '.....pp.....', '............'];
function shieldIcon(): HTMLCanvasElement {
  const c = document.createElement('canvas'); c.width = 12; c.height = 12; c.className = 'mz-ico'; c.setAttribute('aria-hidden', 'true');
  const g = c.getContext('2d');
  if (!g) return c;
  const at = (x: number, y: number): string => SHIELD[y]?.[x] ?? '.';
  const col: Record<string, string> = { r: PAL.rosso, y: PAL.giallo, p: PAL.pietraChiara };
  for (let y = 0; y < 12; y++) for (let x = 0; x < 12; x++) {
    const k = at(x, y);
    const fill = col[k] ?? ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => at(x + dx!, y + dy!) !== '.') ? PAL.neroCaldo : null);
    if (fill) { g.fillStyle = fill; g.fillRect(x, y, 1, 1); }
  }
  return c;
}

export function createEroe(o: PanelCtx): Eroe {
  let m: Chunk | null = null, loading: Promise<Chunk> | null = null;
  const load = (): Promise<Chunk> => (loading ??= import('../rpg/index.ts').then((x) => (m = x), (e: unknown) => { loading = null; o.hud.toast('Connessione lenta: riprova', 2500); throw e; }));
  const run = (f: (c: Chunk) => void): void => { if (m) f(m); else void load().then(f, () => {}); };
  const btn = topButton({ root: o.root, id: 'mzHeroBtn', order: 4, label: '', title: 'Personaggio (I)', onClick: () => { if (btn.el.classList.contains('on')) e.close(); else e.open(); } });
  btn.el.insertBefore(shieldIcon(), btn.el.firstChild);
  const cv = btn.el.querySelector('canvas');
  if (cv) cv.style.width = cv.style.height = '24px';
  const e: Eroe = {
    open() { run((c) => c.openHero(o)); },
    close() { m?.closePanels(); },
    isOpen: () => !!m?.isPanelOpen(),
    openBuilding(kind) { run((c) => c.openBuilding(o, kind)); },
  };
  // finché il chunk non c'è, uno stato minimo (il chunk lo sostituisce col suo)
  registerStateProvider('eroe', () => { const h = o.getLot()?.hero; return { loaded: false, open: false, view: null, tab: null, livello: h?.livello ?? 1, carico: null, scelte: h?.scelte ?? 0 }; });
  setEroeForPanels(e);
  return e;
}
