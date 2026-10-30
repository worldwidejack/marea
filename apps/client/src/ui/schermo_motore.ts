// Il motore comune dei giochi a schermo da solo (Arrembaggio e Perle via ui/schermo_pixel.ts; Lava, Koi, Pinguini, Ingorgo): apertura,
// attesa del primo tocco o conto alla rovescia, sim a 60 Hz (accumulatore), un InputFrame quantizzato per tick, «Tempo!» a schermo
// prima di chiudere, Esc / × = ritirati, e alla fine packInputs(frames): punteggio e medaglia li decide il server. Il pilota dei test:
// `<id>Auto` (una partita intera in pochi secondi) e `<id>FinoA` (fino al tick dato, per le foto a metà partita).
// Il disegno, i comandi e i testi restano del gioco: il motore chiama `render` a ogni fotogramma e `input` a ogni tick.
import { createRng, packInputs, quantize } from '@marea/sim';
import type { Difficulty, InputFrame, MinigameModule, PackedInputs } from '@marea/sim';
import { el } from './style.ts';
import { registerTestHook } from '../test/testapi.ts';
import { suona } from '../audio/ponte.ts';
import type { SuonoId } from '../audio/ponte.ts';

const FERMO: InputFrame = { mx: 0, my: 0, a: false, b: false };

/** Una partita aperta: lo stato della sim, gli effetti solo del client (`x`), gli input registrati. `intro` = si aspetta il primo tocco;
 *  `conto` = tick che mancano alla partenza; `end` = tick di «Tempo!» a schermo (−1 = si gioca). */
export type Partita<S, X> = { s: S; x: X; frames: InputFrame[]; intro: boolean; conto: number; end: number };

export type DefMotore<S, X> = {
  id: string;
  mod: MinigameModule<S>;
  /** La schermata: si accende con la classe `on`. `chiudi` = la ×. */
  wrap: HTMLElement; chiudi: HTMLElement;
  /** Tick di «Tempo!» a schermo prima di chiudere. */
  endHold: number;
  /** Col pilota dei test: tick per fotogramma. */
  autoPerFrame: number;
  /** Come parte: 'tocco' = cartello finché non tocchi (il tempo parte lì, col suono `via`); un numero = tick di conto alla rovescia. */
  partenza: 'tocco' | number;
  via?: SuonoId;
  /** Gli effetti solo del client per una partita nuova (dal seed). */
  scena(s: S, seed: number): X;
  /** L'input del giocatore per questo tick; `prima` = l'ultimo input registrato (per i fronti di salita). */
  input(p: Partita<S, X>, prima: InputFrame): InputFrame;
  primaPasso?(p: Partita<S, X>): void;
  dopoPasso?(p: Partita<S, X>): void;
  /** La partita è finita (default: `s.done`). */
  finita?(s: S): boolean;
  /** Un fotogramma; `alpha` = quanto manca al prossimo tick (0-1), `t` = secondi dall'apertura. */
  render(p: Partita<S, X>, alpha: number, t: number): void;
  /** I tasti del gioco (Esc lo gestisce il motore). Con la schermata aperta i tasti non arrivano al mondo. */
  tasto?(e: KeyboardEvent): void;
  /** Il cartello delle regole se ne va (partenza 'tocco'). */
  alVia?(): void;
  alApri?(): void;
  alChiudi?(): void;
};

export type Motore<S, X> = {
  run(o: { seed: number; difficulty: number }): Promise<PackedInputs | null>;
  isOpen(): boolean;
  readonly auto: boolean;
  partita(): Partita<S, X> | null;
  /** Primo tocco: via il cartello, parte il tempo. */
  inizia(): void;
  close(v: PackedInputs | null): void;
};

export function createMotore<S extends { tick: number }, X>(def: DefMotore<S, X>): Motore<S, X> {
  const { mod } = def;
  const autoRng = createRng(def.id + '-auto');
  const finita = def.finita ?? ((s: S) => !!(s as unknown as { done?: boolean }).done);
  let p: Partita<S, X> | null = null, finish: ((v: PackedInputs | null) => void) | null = null, prima = FERMO;
  let open = false, auto = false, raf = 0, last = 0, acc = 0, tAnim = 0;

  function inizia(): void { if (p?.intro) { p.intro = false; def.alVia?.(); suona(def.via ?? 'via'); } }
  function passo(f: InputFrame): void {
    if (!p) return;
    def.primaPasso?.(p);
    const q = quantize(f); prima = q;
    p.frames.push(q); mod.step(p.s, q);
    def.dopoPasso?.(p);
  }
  function tick(): void {
    if (!p || p.intro) return;
    if (p.conto > 0) { p.conto--; return; }
    if (p.end >= 0) { if (++p.end >= def.endHold) close(packInputs(p.frames)); return; }
    passo(auto ? mod.autopilot(p.s, autoRng) : def.input(p, prima));
    if (p && finita(p.s)) p.end = 0;
  }
  const disegna = () => { if (p) def.render(p, Math.min(1, acc * 60), tAnim); };
  function loop(now: number): void {
    if (!open) return;
    const dt = Math.max(0, Math.min(0.25, (now - last) / 1000)); last = now; tAnim += dt; // il primo rAF può avere un orario prima di run()
    if (auto) { for (let i = 0; i < def.autoPerFrame && open; i++) tick(); acc = 0; } // test: veloce
    else { acc += dt; while (acc >= 1 / 60 && open) { acc -= 1 / 60; tick(); } }
    if (open) { disegna(); raf = requestAnimationFrame(loop); }
  }
  const onKey = (e: KeyboardEvent) => {
    if (!open) return;
    e.stopImmediatePropagation();
    if (e.code === 'Escape') { e.preventDefault(); close(null); return; }
    def.tasto?.(e);
  };
  def.chiudi.addEventListener('click', () => close(null));
  function close(v: PackedInputs | null): void {
    if (!open) return;
    open = false; cancelAnimationFrame(raf); def.wrap.classList.remove('on'); removeEventListener('keydown', onKey, true);
    def.alChiudi?.();
    const fine = finish; p = null; finish = null; fine?.(v);
  }

  registerTestHook(def.id + 'Auto', (on) => { auto = on !== false; if (auto) inizia(); return auto; });
  /** Test: gioca col pilota (o senza toccare niente, `fermo`) fino al tick dato e ferma lì (per gli screenshot a metà partita). */
  registerTestHook(def.id + 'FinoA', (n, fermo) => {
    if (!p) return false;
    inizia(); p.conto = 0;
    const fino = Math.max(1, Math.min(mod.maxTicks - 1, Number(n) || 1));
    while (p.s.tick < fino && !finita(p.s)) passo(fermo ? FERMO : mod.autopilot(p.s, autoRng));
    def.primaPasso?.(p); acc = 0; disegna();
    return p.s.tick;
  });

  return {
    run({ seed, difficulty }) {
      if (open) return Promise.resolve(null);
      const d = (Math.round(difficulty) >= 1 && Math.round(difficulty) <= 3 ? Math.round(difficulty) : 2) as Difficulty;
      return new Promise((f) => {
        const s = mod.create({ seed, difficulty: d });
        p = { s, x: def.scena(s, seed), frames: [], intro: def.partenza === 'tocco' && !auto, conto: def.partenza === 'tocco' || auto ? 0 : def.partenza, end: -1 };
        finish = f; prima = FERMO;
        open = true; acc = 0; last = performance.now(); tAnim = 0;
        def.alApri?.();
        def.wrap.classList.add('on'); addEventListener('keydown', onKey, true);
        disegna(); raf = requestAnimationFrame(loop);
      });
    },
    isOpen: () => open,
    get auto() { return auto; },
    partita: () => p,
    inizia,
    close,
  };
}

/** La riga delle soglie sotto la schermata («Bronzo 40 · Argento 80 · Oro 120 punti»): le soglie già passate in giallo. */
export function rigaMedaglie(goal: HTMLElement, punti: number, m: { oro: number; argento: number; bronzo: number }): void {
  const g = `${punti >= m.bronzo}${punti >= m.argento}${punti >= m.oro}${m.oro}`;
  if (goal.dataset['g'] === g) return;
  goal.dataset['g'] = g;
  const b = (n: string, p: number) => el('b', punti >= p ? 'on' : '', `${n} ${p}`);
  goal.replaceChildren(b('Bronzo', m.bronzo), document.createTextNode(' · '), b('Argento', m.argento), document.createTextNode(' · '), b('Oro', m.oro), document.createTextNode(' punti'));
}
