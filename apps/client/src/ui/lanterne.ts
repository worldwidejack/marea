// Lanterne (molo del Porto): schermata del minigioco. Le 6 lanterne si accendono in sequenza, poi le tocchi nello stesso ordine;
// ogni sequenza giusta ne aggiunge una. Fa girare la sim `lanterne` a 60 Hz (accumulatore suo, come gli Scacchi è una schermata sopra
// il mondo), registra un InputFrame quantizzato per tick e alla fine restituisce packInputs(frames): il punteggio lo decide il server.
// Tocco/clic sulla lanterna, oppure tasti 1-6 o Q W E / A S D. Esc = ritirati (null). Solo colori della palette, lanterne a pixel in SVG.
import { MINIGAMES_CFG } from '@marea/content';
import { LANTERNE_N, createRng, getMinigame, packInputs, quantize, tapFrame } from '@marea/sim';
import type { Difficulty, InputFrame, LanterneView, MinigameModule, PackedInputs } from '@marea/sim';
import { PAL, el, injectUiStyle } from './style.ts';
import { registerStateProvider, registerTestHook } from '../test/testapi.ts';

export type Lanterne = {
  /** Gioca una partita col seed dato: input log, o null se ti ritiri. */
  run(o: { seed: number; difficulty: number }): Promise<PackedInputs | null>;
  isOpen(): boolean;
};

const P = PAL;
const CFG = MINIGAMES_CFG.lanterne;
/** Un colore per lanterna: aiuta a ricordare la sequenza. */
const COLORS = [P.rosso, P.arancio, P.giallo, P.erba, P.acqua, P.rosaNeon] as const;
const KEYS = ['KeyQ', 'KeyW', 'KeyE', 'KeyA', 'KeyS', 'KeyD'];
const KEY_TXT = ['1·Q', '2·W', '3·E', '4·A', '5·S', '6·D'];
const INTRO = 90, END_HOLD = 84; // tick: «Guarda bene» prima di partire, esito a schermo prima di chiudere
const NO: InputFrame = { mx: 0, my: 0, a: false, b: false };

const CSS = `
.mz-lt { position: absolute; inset: 0; display: none; align-items: center; justify-content: center; background: rgba(22,63,115,.55); z-index: 28; touch-action: none; }
.mz-lt.on { display: flex; }
.mz-lt-box { width: min(420px, calc(100% - 16px)); max-height: calc(100% - 16px); overflow-y: auto; padding: 10px 10px 12px; background: rgba(46,30,20,.97); border: 3px solid ${P.legnoChiaro}; box-shadow: 0 5px 0 ${P.neroCaldo}; }
.mz-lt .rule { color: ${P.sabbia}; font-size: 13px; line-height: 1.3; margin: 0 0 8px; }
.mz-lt .time { height: 10px; background: ${P.legnoScuro}; border: 2px solid ${P.neroCaldo}; margin-bottom: 10px; }
.mz-lt .time i { display: block; height: 100%; background: ${P.arancio}; }
.mz-lt .time.low i { background: ${P.rosso}; }
.mz-lt .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; width: 100%; max-width: min(400px, 60vh); margin: 0 auto; }
.mz-lt .lt { --c: ${P.rosso}; --b: ${P.roccia}; --l: ${P.pietraScura}; position: relative; aspect-ratio: 3 / 4; min-height: 88px; display: flex; align-items: center; justify-content: center; padding: 0; background: ${P.legnoScuro}; border: 3px solid ${P.legnoChiaro}; box-shadow: 0 4px 0 ${P.neroCaldo}; cursor: pointer; }
.mz-lt .lt svg { width: 72%; height: 86%; display: block; pointer-events: none; }
.mz-lt .lt .b { fill: var(--b); } .mz-lt .lt .l { fill: var(--l); } .mz-lt .lt .c { fill: var(--c); } .mz-lt .lt .k { fill: ${P.neroCaldo}; } .mz-lt .lt .f { fill: var(--f, ${P.legnoScuro}); }
.mz-lt .lt.on { --b: var(--c); --l: ${P.sabbiaChiara}; --f: ${P.giallo}; border-color: var(--c); box-shadow: 0 0 0 4px var(--c), 0 4px 0 ${P.neroCaldo}; background: ${P.ombraCalda}; }
.mz-lt .lt.ok { box-shadow: 0 0 0 4px ${P.sabbiaChiara}, 0 4px 0 ${P.neroCaldo}; }
.mz-lt .lt.no { --b: ${P.rosso}; --c: ${P.rosso}; border-color: ${P.rosso}; box-shadow: 0 0 0 4px ${P.rosso}, 0 4px 0 ${P.neroCaldo}; }
.mz-lt .lt:active { transform: translateY(3px); }
.mz-lt .lt .key { position: absolute; left: 4px; top: 3px; font-size: 10px; font-weight: bold; color: ${P.sabbia}; opacity: .8; pointer-events: none; }
.mz-lt .status { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin: 10px 0 0; min-height: 30px; font-size: 16px; font-weight: bold; }
.mz-lt .pips { display: flex; gap: 4px; flex-wrap: wrap; justify-content: flex-end; }
.mz-lt .pip { width: 12px; height: 12px; border: 2px solid ${P.legnoChiaro}; background: ${P.legnoScuro}; }
.mz-lt .pip.on { background: ${P.giallo}; border-color: ${P.neroCaldo}; }
.mz-lt .msg.go { color: ${P.giallo}; } .mz-lt .msg.bad { color: ${P.rosso}; }
.mz-lt .goal { margin-top: 6px; color: ${P.sabbia}; font-size: 12px; }
`;

// lanterna di carta 12×16: k contorno, c fasce (colore della lanterna), b carta, l riflesso, f fiamma/nappa
const SHAPE = [
  '....kkkk....', '.....kk.....', '..kkkkkkkk..', '.kcccccccck.', 'kbbbbbbbbbbk', 'kbllbbbbbbbk', 'kbllbbbbbbbk', 'kkkkkkkkkkkk',
  'kbllbbbbbbbk', 'kbllbbbbbbbk', 'kbbbbbbbbbbk', '.kbbbbbbbbk.', '.kcccccccck.', '..kkkkkkkk..', '.....ff.....', '.....ff.....',
];
let svgCache = '';
function lanternSvg(): string {
  if (svgCache) return svgCache;
  let r = '';
  SHAPE.forEach((row, y) => { for (let x = 0; x < row.length; x++) { const ch = row[x]!; if (ch !== '.') r += `<rect class="${ch}" x="${x}" y="${y}" width="1" height="1"/>`; } });
  svgCache = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 12 16" shape-rendering="crispEdges">${r}</svg>`;
  return svgCache;
}

export function createLanterne(o: { root: HTMLElement }): Lanterne {
  injectUiStyle();
  if (!document.getElementById('mz-lanterne-style')) { const st = document.createElement('style'); st.id = 'mz-lanterne-style'; st.textContent = CSS; document.head.appendChild(st); }
  const mod = getMinigame('lanterne') as MinigameModule<unknown>;
  const wrap = el('div', 'mz mz-lt'); wrap.id = 'mzLanterne';
  const box = el('div', 'mz-lt-box'); wrap.appendChild(box);
  for (const ev of ['pointerdown', 'touchstart', 'wheel']) wrap.addEventListener(ev, (x) => x.stopPropagation());
  o.root.appendChild(wrap);

  // ---- scheletro fisso (si aggiorna solo lo stato: niente DOM nuovo a 60 Hz) ----
  const x = el('button', 'mz-x', '×'); x.type = 'button'; x.setAttribute('aria-label', 'Ritirati');
  const head = el('div', 'mz-head'); const title = el('div', 'mz-title', CFG.nome); head.append(title, x);
  const rule = el('p', 'rule', 'Guarda in che ordine si accendono, poi toccale uguali. Ogni sequenza giusta ne aggiunge una. Un errore e finisce.');
  const time = el('div', 'time'); const bar = document.createElement('i'); time.appendChild(bar);
  const grid = el('div', 'grid');
  const lts = Array.from({ length: LANTERNE_N }, (_, i) => {
    const b = el('button', 'lt'); b.type = 'button'; b.dataset['lt'] = String(i); b.setAttribute('aria-label', `Lanterna ${i + 1}`);
    b.style.setProperty('--c', COLORS[i % COLORS.length]!);
    b.insertAdjacentHTML('beforeend', lanternSvg()); // SVG statico generato qui
    b.appendChild(el('span', 'key', KEY_TXT[i] ?? ''));
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); tap(i); });
    grid.appendChild(b);
    return b;
  });
  const msg = el('span', 'msg'); const pips = el('div', 'pips');
  const status = el('div', 'status'); status.append(msg, pips);
  const goal = el('div', 'goal', `Bronzo ${CFG.medaglie.bronzo} · Argento ${CFG.medaglie.argento} · Oro ${CFG.medaglie.oro} sequenze`);
  box.append(head, rule, time, grid, status, goal);

  type Game = { s: unknown; frames: InputFrame[]; queue: number[]; prevA: boolean; intro: number; end: number; finish(v: PackedInputs | null): void };
  let g: Game | null = null, open = false, auto = false, raf = 0, last = 0, acc = 0, view: LanterneView | null = null;
  const autoRng = createRng('lanterne-auto');

  function tap(i: number): void { if (g && !auto && g.end < 0) g.queue.push(i); }
  const onKey = (e: KeyboardEvent) => {
    if (!open) return;
    e.stopImmediatePropagation();
    if (e.code === 'Escape') { e.preventDefault(); quit(); return; }
    const d = /^(?:Digit|Numpad)([1-6])$/.exec(e.code);
    const i = d ? Number(d[1]) - 1 : KEYS.indexOf(e.code);
    if (i >= 0 && i < LANTERNE_N && !e.repeat) { e.preventDefault(); tap(i); }
  };
  x.addEventListener('click', () => quit());

  function tick(): void {
    if (!g) return;
    if (g.intro > 0) { g.intro--; return; }
    if (g.end >= 0) { if (++g.end >= END_HOLD) close(packInputs(g.frames)); return; }
    let f: InputFrame = NO;
    if (auto) f = mod.autopilot(g.s, autoRng);
    else if (!g.prevA && g.queue.length) f = tapFrame(g.queue.shift()!);
    f = quantize(f); g.prevA = f.a;
    g.frames.push(f); mod.step(g.s, f);
    if (mod.result(g.s).done) g.end = 0;
  }
  function render(): void {
    if (!g) return;
    const v = view = mod.view(g.s) as LanterneView;
    title.textContent = `${CFG.nome} · sequenza ${v.len}`;
    bar.style.width = `${Math.max(0, 100 - (v.ms / v.maxMs) * 100)}%`;
    time.classList.toggle('low', v.maxMs - v.ms < 10_000);
    const want = v.done && v.expected >= 0 ? v.expected : -1, blink = Math.floor(performance.now() / 160) % 2 === 0;
    lts.forEach((b, i) => {
      b.classList.toggle('on', v.lit === i || (i === want && blink)); // dopo l'errore la giusta lampeggia
      b.classList.toggle('ok', v.lit === i && v.litKind === 'ok');
      b.classList.toggle('no', v.lit === i && v.litKind === 'no');
    });
    const [txt, cls] = g.intro > 0 ? ['Guarda bene…', ''] : v.done ? (v.timeUp ? ['Tempo!', 'go'] : ['Sbagliato! Era quella che lampeggia', 'bad'])
      : v.phase === 'mostra' ? ['Guarda…', ''] : [`Tocca! ${v.pos + 1}/${v.len}`, 'go'];
    if (msg.textContent !== txt) { msg.textContent = txt; msg.className = 'msg ' + cls; }
    if (pips.childElementCount !== v.completate) pips.replaceChildren(...Array.from({ length: v.completate }, () => el('span', 'pip on')));
  }
  function loop(now: number): void {
    if (!open) return;
    const dt = Math.min(0.25, (now - last) / 1000); last = now;
    if (auto) for (let i = 0; i < 120 && open; i++) tick(); // test: una partita intera in pochi secondi
    else { acc += dt; while (acc >= 1 / 60 && open) { acc -= 1 / 60; tick(); } }
    if (open) { render(); raf = requestAnimationFrame(loop); }
  }
  function close(v: PackedInputs | null): void {
    if (!open) return;
    open = false; cancelAnimationFrame(raf); wrap.classList.remove('on'); removeEventListener('keydown', onKey, true);
    const done = g; g = null; done?.finish(v);
  }
  function quit(): void { close(null); }

  registerStateProvider('lanterne', () => ({ open, auto, view, atteso: g && view && view.phase === 'tocca' ? (g.s as { seq: number[]; pos: number }).seq[(g.s as { pos: number }).pos] : null }));
  registerTestHook('lanterneAuto', (on) => { auto = on !== false; return auto; });

  return {
    run({ seed, difficulty }) {
      if (open) return Promise.resolve(null);
      const d = (Math.round(difficulty) >= 1 && Math.round(difficulty) <= 3 ? Math.round(difficulty) : 2) as Difficulty;
      return new Promise((finish) => {
        g = { s: mod.create({ seed, difficulty: d }), frames: [], queue: [], prevA: false, intro: auto ? 0 : INTRO, end: -1, finish };
        open = true; acc = 0; last = performance.now(); view = null;
        wrap.classList.add('on'); addEventListener('keydown', onKey, true);
        render(); raf = requestAnimationFrame(loop);
      });
    },
    isOpen: () => open,
  };
}
