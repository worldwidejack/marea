// Schermata comune dei giochi a pixel «tieni premuto» (Arrembaggio sulla Tempesta, Perle): scena a pixel su
// <canvas>, barre, cartello delle regole (il tempo parte al primo tocco), messaggio, punti, bottone grande e soglie delle medaglie.
// Un pollice: si tiene premuto ovunque sulla schermata (o Spazio / Invio / E e i tasti del gioco); Esc o × = ritirati.
// Giro a 60 Hz, input per il server, apertura e chiusura: ui/schermo_motore.ts. Ogni gioco dà la sua scena, il disegno e i testi
// (DefSchermo). Solo colori di PAL.
import { getMinigame } from '@marea/sim';
import type { MinigameModule, PackedInputs } from '@marea/sim';
import { PAL, el, injectUiStyle } from './style.ts';
import { createMotore, rigaMedaglie } from './schermo_motore.ts';
import type { Partita } from './schermo_motore.ts';
import { registerStateProvider } from '../test/testapi.ts';
import { suona } from '../audio/ponte.ts';
import type { SuonoId } from '../audio/ponte.ts';

const P = PAL;
const END_HOLD = 90; // tick: «Tempo!» a schermo prima di chiudere

/** Quello che il gioco mostra fuori dalla tela a ogni frame. */
export type StatoSchermo = {
  msg: [string, string, '' | 'go' | 'bad' | 'ok'];
  bottone: [string, '' | 'giu' | 'wait' | 'bad'];
  /** Una per barra (in ordine): riempimento 0..1 e se lampeggia. */
  barre: { w: number; low: boolean }[];
  punti: number;
  medals: { oro: number; argento: number; bronzo: number };
};
export type DefSchermo<S, X> = {
  /** id del minigioco (sim) e nome delle chiavi dei test (`<id>Auto`, `<id>FinoA`, state().<id>). */
  id: string;
  domId: string; btnId: string; titolo: string;
  W: number; H: number;
  /** Colore del velo dietro la schermata e del bordo della scheda. */
  velo: string; bordo: string;
  /** Regole (HTML statico, solo numeri di content) e cosa dice il cartello per partire. */
  regole: string;
  barre: { nome: string; cls: string }[];
  tasti: string[];
  /** Suono al primo tocco (default 'via') e all'apertura (default 'apri'; null = niente). */
  suoni?: { via?: SuonoId; apri?: SuonoId | null };
  /** CSS in più solo di questo gioco (colori delle sue barre e del bottone): i selettori partono da `#<domId>`. */
  css?: string;
  /** Effetti solo del client per una partita nuova (dal seed). */
  scena(s: S, seed: number): X;
  pittore(cv: HTMLCanvasElement): (s: S, x: X, t: number, alpha: number, fermo: boolean) => void;
  /** Prima di ogni tick della sim (e dopo `<id>FinoA`, così la foto non resta a metà tra due tick): quello che serve a `dopoPasso`. */
  primaPasso?(s: S, x: X): void;
  /** Dopo ogni tick della sim: effetti e suoni. */
  dopoPasso(s: S, x: X): void;
  stato(s: S, x: X, o: { held: boolean; intro: boolean; auto: boolean }): StatoSchermo;
  /** Per i test (state().<id>.view). */
  vista(s: S): unknown;
  esito(detail: Record<string, unknown>): string;
};
export type SchermoPixel = {
  run(o: { seed: number; difficulty: number }): Promise<PackedInputs | null>;
  isOpen(): boolean;
  esito(detail: Record<string, unknown>): string;
};

const CSS = `
.mz-gp { position: absolute; inset: 0; display: none; align-items: center; justify-content: center; z-index: 28; touch-action: none; }
.mz-gp.on { display: flex; }
.mz-gp-box { width: min(640px, calc(100% - 12px)); max-height: calc(100% - 12px); overflow-y: auto; padding: 8px 8px 10px; background: rgba(46,30,20,.97); border: 3px solid ${P.legnoChiaro}; box-shadow: 0 5px 0 ${P.neroCaldo}; }
.mz-gp .mz-head { margin-bottom: 6px; }
.mz-gp .mz-title { font-size: 15px; }
.mz-gp .bars { display: grid; grid-template-columns: auto 1fr; align-items: center; gap: 4px 8px; margin-bottom: 6px; font-size: 11px; font-weight: bold; color: ${P.sabbia}; }
.mz-gp .bar { height: 12px; background: ${P.legnoScuro}; border: 2px solid ${P.neroCaldo}; }
.mz-gp .bar i { display: block; height: 100%; background: ${P.arancio}; }
.mz-gp .bar.tempo { height: 8px; }
.mz-gp .bar.potenza i { background: ${P.giallo}; }
.mz-gp .bar.palle i { background: ${P.pietra}; }
.mz-gp .bar.low i { background: ${P.rosso}; }
.mz-gp .bar.potenza.low i { background: ${P.rosso}; }
.mz-gp .bar.pronto { animation: mzGpBlink .5s steps(2) infinite; }
@keyframes mzGpBlink { 50% { border-color: ${P.giallo}; } }
.mz-gp .scena { position: relative; border: 3px solid ${P.neroCaldo}; line-height: 0; cursor: pointer; }
.mz-gp canvas.sc { width: 100%; height: auto; image-rendering: pixelated; display: block; }
.mz-gp .rules { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; background: rgba(35,32,31,.72); line-height: 1.25; text-align: left; }
.mz-gp .rules div { width: min(90%, 340px); padding: 4px 8px; background: ${P.ombraCalda}; border: 2px solid ${P.legnoChiaro}; font-size: 13px; font-weight: bold; }
.mz-gp .rules b { color: ${P.giallo}; }
.mz-gp .rules .r { color: ${P.rosso}; } .mz-gp .rules .o { color: ${P.arancio}; } .mz-gp .rules .v { color: ${P.viola}; } .mz-gp .rules .c { color: ${P.acquaBassa}; }
.mz-gp .rules .go { width: auto; border-color: ${P.giallo}; color: ${P.giallo}; margin-top: 2px; }
.mz-gp .status { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin: 8px 0 0; min-height: 40px; }
.mz-gp .msg { font-size: 16px; font-weight: bold; line-height: 1.2; }
.mz-gp .msg small { display: block; font-size: 12px; font-weight: normal; color: ${P.sabbia}; }
.mz-gp .msg.go { color: ${P.giallo}; } .mz-gp .msg.bad { color: ${P.rosso}; } .mz-gp .msg.ok { color: ${P.acquaBassa}; }
.mz-gp .pts { flex: none; text-align: right; font-size: 22px; font-weight: bold; color: ${P.giallo}; line-height: 1; }
.mz-gp .pts small { display: block; font-size: 11px; color: ${P.sabbia}; }
.mz-gp .goal { margin-top: 4px; color: ${P.sabbia}; font-size: 12px; }
.mz-gp .goal b.on { color: ${P.giallo}; }
.mz-gp .act { width: 100%; min-height: 64px; margin-top: 8px; background: ${P.arancio}; color: ${P.neroCaldo}; border: 3px solid ${P.neroCaldo}; box-shadow: 0 5px 0 ${P.neroCaldo}; font: bold 20px ui-monospace, Menlo, monospace; letter-spacing: .06em; cursor: pointer; touch-action: none; }
.mz-gp .act.giu { background: ${P.giallo}; transform: translateY(3px); box-shadow: 0 2px 0 ${P.neroCaldo}; }
.mz-gp .act.wait { background: ${P.legnoScuro}; color: ${P.sabbia}; border-color: ${P.legnoChiaro}; }
.mz-gp .act.bad { background: ${P.rosso}; color: ${P.sabbiaChiara}; }
`;

export function createSchermoPixel<S extends { tick: number; done: boolean }, X>(root: HTMLElement, def: DefSchermo<S, X>): SchermoPixel {
  injectUiStyle();
  if (!document.getElementById('mz-gp-style')) { const st = document.createElement('style'); st.id = 'mz-gp-style'; st.textContent = CSS; document.head.appendChild(st); }
  if (def.css && !document.getElementById(`mz-gp-style-${def.id}`)) { const st = document.createElement('style'); st.id = `mz-gp-style-${def.id}`; st.textContent = def.css; document.head.appendChild(st); }
  const TASTI = new Set(['Space', 'Enter', 'NumpadEnter', 'KeyE', ...def.tasti]);
  const wrap = el('div', 'mz mz-gp'); wrap.id = def.domId; wrap.style.background = def.velo;
  const box = el('div', 'mz-gp-box'); box.style.borderColor = def.bordo; wrap.appendChild(box);
  root.appendChild(wrap);

  // ---- scheletro fisso (a 60 Hz si aggiornano solo stati e la tela) ----
  const x = el('button', 'mz-x', '×'); x.type = 'button'; x.setAttribute('aria-label', 'Ritirati');
  const head = el('div', 'mz-head'); head.append(el('div', 'mz-title', def.titolo), x);
  const bars = el('div', 'bars');
  const barre = def.barre.map((b) => {
    const bar = el('div', `bar ${b.cls}`), i = document.createElement('i'); bar.appendChild(i);
    bars.append(el('span', '', b.nome), bar);
    return { bar, i };
  });
  const scena = el('div', 'scena');
  const cv = document.createElement('canvas'); cv.className = 'sc'; cv.style.aspectRatio = `${def.W} / ${def.H}`;
  const dipingi = def.pittore(cv);
  const rules = el('div', 'rules');
  rules.innerHTML = def.regole; // testo statico (solo numeri di content)
  scena.append(cv, rules);
  const msg = el('div', 'msg'); const pts = el('div', 'pts');
  const status = el('div', 'status'); status.append(msg, pts);
  const act = el('button', 'act', 'TIENI PREMUTO'); act.type = 'button'; act.id = def.btnId;
  const goal = el('div', 'goal');
  box.append(head, bars, scena, status, act, goal);

  const pointers = new Set<number>(), keys = new Set<string>();
  const held = () => pointers.size > 0 || keys.size > 0;

  function render(p: Partita<S, X>, alpha: number, t: number): void {
    dipingi(p.s, p.x, t, alpha, p.intro || p.end >= 0);
    const v = def.stato(p.s, p.x, { held: held(), intro: p.intro, auto: motore.auto });
    v.barre.forEach((b, i) => {
      const r = barre[i]; if (!r) return;
      const w = `${Math.round(Math.max(0, Math.min(1, b.w)) * 100)}%`;
      if (r.i.style.width !== w) r.i.style.width = w;
      r.bar.classList.toggle('low', b.low);
    });
    const [a, b, cls] = v.msg, key = `${a}|${b}|${cls}`;
    if (msg.dataset['h'] !== key) { msg.dataset['h'] = key; msg.replaceChildren(document.createTextNode(a), el('small', '', b)); msg.className = 'msg ' + cls; }
    const ptxt = String(v.punti);
    if (pts.dataset['p'] !== ptxt) { pts.dataset['p'] = ptxt; pts.replaceChildren(document.createTextNode(ptxt), el('small', '', 'PUNTI')); }
    rigaMedaglie(goal, v.punti, v.medals);
    const [lab, kind] = v.bottone;
    if (act.textContent !== lab) act.textContent = lab;
    act.className = 'act' + (kind ? ' ' + kind : '');
  }

  const motore = createMotore<S, X>({
    id: def.id, mod: getMinigame(def.id) as MinigameModule<S>, wrap, chiudi: x, endHold: END_HOLD, autoPerFrame: 60, partenza: 'tocco',
    ...(def.suoni?.via ? { via: def.suoni.via } : {}),
    scena: def.scena,
    input: () => ({ mx: 0, my: 0, a: held(), b: false }),
    ...(def.primaPasso ? { primaPasso: (p: Partita<S, X>) => def.primaPasso!(p.s, p.x) } : {}),
    dopoPasso: (p) => def.dopoPasso(p.s, p.x),
    render,
    tasto(e) { if (TASTI.has(e.code)) { e.preventDefault(); keys.add(e.code); motore.inizia(); } },
    alVia() { rules.style.display = 'none'; },
    alApri() {
      rules.style.display = motore.auto ? 'none' : '';
      pointers.clear(); keys.clear();
      const apri = def.suoni?.apri === undefined ? 'apri' : def.suoni.apri;
      if (apri) suona(apri);
    },
    alChiudi() { pointers.clear(); keys.clear(); },
  });

  // ---- input: tieni premuto ovunque sulla schermata (tranne la ×), o un tasto ----
  wrap.addEventListener('pointerdown', (e) => {
    if (!motore.isOpen() || e.target === x) return;
    e.preventDefault(); e.stopPropagation();
    pointers.add(e.pointerId);
    motore.inizia();
  });
  for (const ev of ['touchstart', 'wheel']) wrap.addEventListener(ev, (e) => e.stopPropagation());
  wrap.addEventListener('contextmenu', (e) => e.preventDefault());
  const up = (e: PointerEvent) => { pointers.delete(e.pointerId); };
  addEventListener('pointerup', up); addEventListener('pointercancel', up);
  addEventListener('blur', () => { pointers.clear(); keys.clear(); });
  // keyup senza fermarlo: anche input.ts deve vederlo (altrimenti i tasti restano incollati nel mondo)
  addEventListener('keyup', (e) => { keys.delete(e.code); });

  registerStateProvider(def.id, () => { const p = motore.partita(); return { open: motore.isOpen(), auto: motore.auto, intro: p?.intro ?? false, frames: p?.frames.length ?? 0, view: p ? def.vista(p.s) : null }; });

  return { run: motore.run, isOpen: motore.isOpen, esito: (d) => def.esito(d) };
}
