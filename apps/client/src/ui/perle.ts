// Perle: la schermata del tuffo, sopra il mondo (chunk scaricato alla prima partita). Fondale a pixel visto di profilo (disegno in
// ui/perle_disegno.ts): la corrente porta il sub verso destra, TIENI PREMUTO = nuota giù, LASCIA = risale. Perle bianche, conchiglie,
// rosa nelle ostriche, nere in fondo ai crepacci; meduse e granchi tolgono aria; si respira a galla o nelle bolle. Fa girare la sim
// `perle` a 60 Hz (accumulatore suo), registra un InputFrame quantizzato per tick e alla fine restituisce packInputs(frames): punteggio e
// medaglia li decide il server. Un pollice: si tiene premuto ovunque sulla schermata (o Spazio / Invio / E / ↓ / S / T). Esc o × =
// ritirati. Il tempo parte al primo tocco (prima il cartello delle regole). Solo colori della palette (ART_BIBLE §2).
import { MINIGAMES_CFG } from '@marea/content';
import { createRng, getMinigame, packInputs, quantize } from '@marea/sim';
import type { Difficulty, InputFrame, MinigameModule, PackedInputs, PerleState, PerleView } from '@marea/sim';
import { PAL, el, injectUiStyle } from './style.ts';
import { H, W, createPittore, effetti } from './perle_disegno.ts';
import type { Scena } from './perle_disegno.ts';
import { registerStateProvider, registerTestHook } from '../test/testapi.ts';
import { suona } from '../audio/ponte.ts';

export type Perle = {
  run(o: { seed: number; difficulty: number }): Promise<PackedInputs | null>;
  isOpen(): boolean;
  esito(detail: Record<string, unknown>): string;
};

const P = PAL;
const CFG = MINIGAMES_CFG.perle;
const END_HOLD = 90; // tick: «Tempo!» a schermo prima di chiudere
const KEYS = new Set(['Space', 'Enter', 'NumpadEnter', 'KeyE', 'KeyT', 'ArrowDown', 'KeyS']);

const CSS = `
.mz-pr { position: absolute; inset: 0; display: none; align-items: center; justify-content: center; background: rgba(22,63,115,.6); z-index: 28; touch-action: none; }
.mz-pr.on { display: flex; }
.mz-pr-box { width: min(640px, calc(100% - 12px)); max-height: calc(100% - 12px); overflow-y: auto; padding: 8px 8px 10px; background: rgba(46,30,20,.97); border: 3px solid ${P.legnoChiaro}; box-shadow: 0 5px 0 ${P.neroCaldo}; }
.mz-pr .mz-head { margin-bottom: 6px; }
.mz-pr .mz-title { font-size: 15px; }
.mz-pr .bars { display: grid; grid-template-columns: auto 1fr; align-items: center; gap: 4px 8px; margin-bottom: 6px; font-size: 11px; font-weight: bold; color: ${P.sabbia}; }
.mz-pr .bar { height: 12px; background: ${P.legnoScuro}; border: 2px solid ${P.neroCaldo}; }
.mz-pr .bar i { display: block; height: 100%; }
.mz-pr .aria i { background: ${P.acquaBassa}; }
.mz-pr .aria.low i { background: ${P.rosso}; }
.mz-pr .aria.low { animation: mzPrBlink .4s steps(2) infinite; }
.mz-pr .tempo { height: 8px; }
.mz-pr .tempo i { background: ${P.arancio}; }
.mz-pr .tempo.low i { background: ${P.rosso}; }
@keyframes mzPrBlink { 50% { border-color: ${P.rosso}; } }
.mz-pr .scena { position: relative; border: 3px solid ${P.neroCaldo}; line-height: 0; cursor: pointer; }
.mz-pr canvas.sc { width: 100%; height: auto; aspect-ratio: ${W} / ${H}; image-rendering: pixelated; display: block; }
.mz-pr .rules { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; background: rgba(35,32,31,.7); line-height: 1.25; text-align: left; }
.mz-pr .rules div { width: min(90%, 340px); padding: 4px 8px; background: ${P.ombraCalda}; border: 2px solid ${P.legnoChiaro}; font-size: 13px; font-weight: bold; }
.mz-pr .rules b { color: ${P.giallo}; }
.mz-pr .rules .rosa { color: ${P.rosaNeon}; } .mz-pr .rules .nera { color: ${P.pietraChiara}; text-decoration: underline ${P.viola} 2px; }
.mz-pr .rules .go { width: auto; border-color: ${P.giallo}; color: ${P.giallo}; margin-top: 2px; }
.mz-pr .status { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin: 8px 0 0; min-height: 40px; }
.mz-pr .msg { font-size: 16px; font-weight: bold; line-height: 1.2; }
.mz-pr .msg small { display: block; font-size: 12px; font-weight: normal; color: ${P.sabbia}; }
.mz-pr .msg.go { color: ${P.giallo}; } .mz-pr .msg.bad { color: ${P.rosso}; } .mz-pr .msg.ok { color: ${P.acquaBassa}; }
.mz-pr .pts { flex: none; text-align: right; font-size: 22px; font-weight: bold; color: ${P.giallo}; line-height: 1; }
.mz-pr .pts small { display: block; font-size: 11px; color: ${P.sabbia}; }
.mz-pr .goal { margin-top: 4px; color: ${P.sabbia}; font-size: 12px; }
.mz-pr .goal b.on { color: ${P.giallo}; }
.mz-pr .act { width: 100%; min-height: 64px; margin-top: 8px; background: ${P.arancio}; color: ${P.neroCaldo}; border: 3px solid ${P.neroCaldo}; box-shadow: 0 5px 0 ${P.neroCaldo}; font: bold 20px ui-monospace, Menlo, monospace; letter-spacing: .06em; cursor: pointer; touch-action: none; }
.mz-pr .act.giu { background: ${P.acquaBassa}; transform: translateY(3px); box-shadow: 0 2px 0 ${P.neroCaldo}; }
.mz-pr .act.wait { background: ${P.legnoScuro}; color: ${P.sabbia}; border-color: ${P.legnoChiaro}; }
.mz-pr .act.bad { background: ${P.rosso}; color: ${P.sabbiaChiara}; }
`;

/** Profilo a colline separate da tratti vuoti (isole all'orizzonte, scogli lontani): solo estetica, dal seed. */
function colline(seed: number, label: string, n: number, gap: [number, number], largo: [number, number], alto: [number, number], vuoto: number, pieno: (u: number, h: number) => number): number[] {
  const r = createRng(seed).fork(label), out: number[] = [];
  while (out.length < n) {
    const g = r.int(gap[0], gap[1]), w = r.int(largo[0], largo[1]), h = r.int(alto[0], alto[1]);
    for (let i = 0; i < g; i++) out.push(vuoto);
    for (let i = 0; i < w; i++) out.push(pieno(1 - (2 * (i / (w - 1)) - 1) ** 2, h) + (r.next() < 0.2 ? 1 : 0));
  }
  return out;
}

export function createPerle(o: { root: HTMLElement }): Perle {
  injectUiStyle();
  if (!document.getElementById('mz-perle-style')) { const st = document.createElement('style'); st.id = 'mz-perle-style'; st.textContent = CSS; document.head.appendChild(st); }
  const mod = getMinigame('perle') as MinigameModule<PerleState>;
  const wrap = el('div', 'mz mz-pr'); wrap.id = 'mzPerleGioco';
  const box = el('div', 'mz-pr-box'); wrap.appendChild(box);
  o.root.appendChild(wrap);

  // ---- scheletro fisso (a 60 Hz si aggiornano solo stati e la tela) ----
  const x = el('button', 'mz-x', '×'); x.type = 'button'; x.setAttribute('aria-label', 'Ritirati');
  const head = el('div', 'mz-head'); head.append(el('div', 'mz-title', `${CFG.nome} · tuffo`), x);
  const bars = el('div', 'bars');
  const aria = el('div', 'bar aria'); const ariaI = document.createElement('i'); aria.appendChild(ariaI);
  const tempo = el('div', 'bar tempo'); const tempoI = document.createElement('i'); tempo.appendChild(tempoI);
  bars.append(el('span', '', 'ARIA'), aria, el('span', '', 'TEMPO'), tempo);
  const scena = el('div', 'scena');
  const cv = document.createElement('canvas'); cv.className = 'sc';
  const dipingi = createPittore(cv);
  const rules = el('div', 'rules');
  rules.innerHTML = '<div><b>TIENI PREMUTO</b>: nuoti giù · <b>LASCIA</b>: risali</div>'
    + `<div>Perle ${CFG.punti.bianca} · conchiglie ${CFG.punti.conchiglia} · <span class="rosa">rosa ${CFG.punti.rosa}</span> (ostrica aperta) · <span class="nera">nere ${CFG.punti.nera}</span></div>`
    + '<div>Meduse e granchi ti tolgono aria: respira a galla o nelle bolle</div>'
    + '<div class="go">TIENI PREMUTO PER TUFFARTI</div>'; // testo statico (solo numeri di content)
  scena.append(cv, rules);
  const msg = el('div', 'msg'); const pts = el('div', 'pts');
  const status = el('div', 'status'); status.append(msg, pts);
  const act = el('button', 'act', 'TIENI PREMUTO'); act.type = 'button'; act.id = 'mzPerleGiu';
  const goal = el('div', 'goal');
  box.append(head, bars, scena, status, act, goal);

  type Game = Scena & { frames: InputFrame[]; finish(v: PackedInputs | null): void };
  let gm: Game | null = null, open = false, auto = false, raf = 0, last = 0, acc = 0, tAnim = 0, view: PerleView | null = null;
  const autoRng = createRng('perle-auto');
  const pointers = new Set<number>(), keys = new Set<string>();
  const held = () => pointers.size > 0 || keys.size > 0;

  // ---- input: tieni premuto ovunque sulla schermata (tranne la ×), o un tasto ----
  wrap.addEventListener('pointerdown', (e) => {
    if (!open || e.target === x) return;
    e.preventDefault(); e.stopPropagation();
    pointers.add(e.pointerId);
    inizia();
  });
  for (const ev of ['touchstart', 'wheel']) wrap.addEventListener(ev, (e) => e.stopPropagation());
  wrap.addEventListener('contextmenu', (e) => e.preventDefault());
  const up = (e: PointerEvent) => { pointers.delete(e.pointerId); };
  addEventListener('pointerup', up); addEventListener('pointercancel', up);
  addEventListener('blur', () => { pointers.clear(); keys.clear(); });
  const onKey = (e: KeyboardEvent) => {
    if (!open) return;
    e.stopImmediatePropagation();
    if (e.code === 'Escape') { e.preventDefault(); close(null); return; }
    if (KEYS.has(e.code)) { e.preventDefault(); keys.add(e.code); inizia(); }
  };
  // keyup senza fermarlo: anche input.ts deve vederlo (altrimenti i tasti restano incollati nel mondo)
  addEventListener('keyup', (e) => { keys.delete(e.code); });
  x.addEventListener('click', () => close(null));
  function inizia(): void { if (gm?.intro) { gm.intro = false; rules.style.display = 'none'; suona('plop'); } }

  function passo(f: InputFrame): void {
    if (!gm) return;
    gm.prevY = gm.s.y;
    const q = quantize(f), s = gm.s, rare = s.prese.rosa + s.prese.nera, prima = { punti: s.punti, bolle: s.prese.bolla, colpi: s.colpi };
    gm.frames.push(q); mod.step(s, q);
    effetti(gm);
    if (s.colpi > prima.colpi) suona('colpo_preso');
    else if (s.prese.rosa + s.prese.nera > rare) suona('moneta');
    else if (s.punti > prima.punti) suona('raccolto');
    else if (s.prese.bolla > prima.bolle) suona('goccia');
  }
  function tick(): void {
    if (!gm || gm.intro) return;
    if (gm.end >= 0) { if (++gm.end >= END_HOLD) close(packInputs(gm.frames)); return; }
    passo(auto ? mod.autopilot(gm.s, autoRng) : { mx: 0, my: 0, a: held(), b: false });
    if (gm.s.done) gm.end = 0;
  }

  function render(): void {
    if (!gm) return;
    dipingi(gm, tAnim, Math.min(1, acc * 60));
    const v = view = mod.view(gm.s) as PerleView;
    ariaI.style.width = `${Math.round(v.aria * 100)}%`;
    aria.classList.toggle('low', !gm.intro && (v.aria < 0.3 || v.affanno));
    tempoI.style.width = `${Math.max(0, 100 - (v.ms / v.maxMs) * 100)}%`;
    tempo.classList.toggle('low', v.maxMs - v.ms < 10_000);
    const [a, b, cls] = gm.intro ? ['Pronti?', 'il tempo parte quando ti tuffi', 'go']
      : v.done ? ['Tempo!', `${v.prese.bianca + v.prese.conchiglia + v.prese.rosa + v.prese.nera} perle nel sacchetto`, 'go']
      : v.affanno ? ['Senz\'aria!', 'risali da solo…', 'bad']
      : v.aria < 0.3 && v.y > 2 ? ['Poca aria!', 'lascia e risali', 'bad']
      : v.y <= 2 ? ['A galla', 'tieni premuto per tuffarti', 'ok']
      : v.hold ? ['Giù…', 'lascia per risalire', ''] : ['Su…', 'tieni premuto per scendere', ''];
    const key = `${a}|${b}|${cls}`;
    if (msg.dataset['h'] !== key) { msg.dataset['h'] = key; msg.replaceChildren(document.createTextNode(a), el('small', '', b)); msg.className = 'msg ' + cls; }
    const ptxt = String(v.punti);
    if (pts.dataset['p'] !== ptxt) { pts.dataset['p'] = ptxt; pts.replaceChildren(document.createTextNode(ptxt), el('small', '', 'PUNTI')); }
    const m = v.medals, gtxt = `${v.punti >= m.bronzo}${v.punti >= m.argento}${v.punti >= m.oro}${m.oro}`;
    if (goal.dataset['g'] !== gtxt) {
      goal.dataset['g'] = gtxt;
      const b1 = (n: string, p: number) => el('b', v.punti >= p ? 'on' : '', `${n} ${p}`);
      goal.replaceChildren(b1('Bronzo', m.bronzo), document.createTextNode(' · '), b1('Argento', m.argento), document.createTextNode(' · '), b1('Oro', m.oro), document.createTextNode(' punti'));
    }
    const [lab, kind] = gm.intro ? ['TIENI PREMUTO', ''] : v.done ? ['FINE', 'wait'] : v.affanno ? ['SENZ\'ARIA', 'bad'] : held() || (auto && v.hold) ? ['▼ GIÙ ▼', 'giu'] : ['TIENI PREMUTO', ''];
    if (act.textContent !== lab) act.textContent = lab;
    act.className = 'act' + (kind ? ' ' + kind : '');
  }
  function loop(now: number): void {
    if (!open) return;
    const dt = Math.max(0, Math.min(0.25, (now - last) / 1000)); last = now; tAnim += dt; // il primo rAF può avere un orario prima di run()
    if (auto) { for (let i = 0; i < 60 && open; i++) tick(); acc = 0; } // test: una partita intera in pochi secondi
    else { acc += dt; while (acc >= 1 / 60 && open) { acc -= 1 / 60; tick(); } }
    if (open) { render(); raf = requestAnimationFrame(loop); }
  }
  function close(v: PackedInputs | null): void {
    if (!open) return;
    open = false; cancelAnimationFrame(raf); wrap.classList.remove('on'); removeEventListener('keydown', onKey, true);
    pointers.clear(); keys.clear();
    const done = gm; gm = null; done?.finish(v);
  }

  registerStateProvider('perle', () => ({
    open, auto, intro: gm?.intro ?? false, frames: gm?.frames.length ?? 0,
    view: view && { punti: view.punti, totale: view.totale, aria: +view.aria.toFixed(3), y: +view.y.toFixed(2), tick: view.tick, done: view.done, prese: view.prese, colpi: view.colpi, medals: view.medals },
  }));
  registerTestHook('perleAuto', (on) => { auto = on !== false; if (auto) inizia(); return auto; });
  /** Test: gioca col pilota fino al tick dato e ferma lì (per gli screenshot a metà partita). */
  registerTestHook('perleFinoA', (n) => {
    if (!gm) return false;
    inizia();
    const fino = Math.max(1, Math.min(mod.maxTicks - 1, Number(n) || 1));
    while (gm.s.tick < fino) passo(mod.autopilot(gm.s, autoRng));
    gm.prevY = gm.s.y; acc = 0; render();
    return gm.s.tick;
  });

  return {
    run({ seed, difficulty }) {
      if (open) return Promise.resolve(null);
      const dd = (Math.round(difficulty) >= 1 && Math.round(difficulty) <= 3 ? Math.round(difficulty) : 2) as Difficulty;
      return new Promise((finish) => {
        const isole = colline(seed, 'isole', 640, [30, 90], [18, 44], [3, 7], 0, (u, h) => Math.max(1, Math.round(h * u)));
        const scogli = colline(seed, 'scogli', 900, [10, 50], [30, 80], [20, 40], 999, (u, h) => Math.round(96 - h * u));
        gm = { s: mod.create({ seed, difficulty: dd }), frames: [], intro: !auto, end: -1, finish, prevY: 0, preso: new Set(), colpi: 0, fx: [], bolle: [], shake: 0, isole, scogli };
        open = true; acc = 0; last = performance.now(); view = null;
        rules.style.display = auto ? 'none' : '';
        pointers.clear(); keys.clear();
        wrap.classList.add('on'); addEventListener('keydown', onKey, true);
        render(); raf = requestAnimationFrame(loop);
      });
    },
    isOpen: () => open,
    esito(detail) {
      const n = (k: string) => (typeof detail[k] === 'number' ? (detail[k] as number) : 0);
      const rare = [n('nere') ? `${n('nere')} ner${n('nere') === 1 ? 'a' : 'e'}` : '', n('rosa') ? `${n('rosa')} rosa` : ''].filter(Boolean).join(', ');
      return `${n('perle')} prese${rare ? ` (${rare})` : ''} · ${n('punti')} punti`;
    },
  };
}
