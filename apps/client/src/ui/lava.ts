// Fuga dalla lava (Isola Vulcano): la schermata a schermo intero (chunk scaricato alla prima partita). Un dito solo, ovunque sullo schermo:
// TOCCA = salto, TIENI = salto più alto, in aria tocca ancora = giravolta; da tastiera Spazio / Su / W. Il motore comune (ui/schermo_motore.ts)
// gira a 60 Hz e registra gli input per il server; il disegno è ui/lava_vista.ts, gli effetti ui/lava_effetti.ts, le schede ui/lava_scheda.ts.
import { MINIGAMES_CFG } from '@marea/content';
import { lava, metriDi } from '@marea/sim/minigames/lava.ts';
import type { LavaState } from '@marea/sim/minigames/lava.ts';
import type { Api } from '../net/api.ts';
import type { SchedaEsito, SchermoGioco } from '../game/minigiochi.ts';
import { registerStateProvider } from '../test/testapi.ts';
import { suona } from '../audio/ponte.ts';
import { createMotore } from './schermo_motore.ts';
import { el, injectUiStyle } from './style.ts';
import { effettiLava, primaPassoLava } from './lava_effetti.ts';
import { CSS_LAVA, vestiEsito, vestiIngresso } from './lava_scheda.ts';
import { createPittoreLava, scenaLava } from './lava_vista.ts';

const CFG = MINIGAMES_CFG.lava;
const TASTI = new Set(['Space', 'Enter', 'NumpadEnter', 'KeyE', 'ArrowUp', 'KeyW', 'KeyJ']);
/** Tick di «Bruciato!» a schermo (il muro di lava ti inonda) prima della scheda. */
const FINE_TICK = 110;

export function createLava(o: { root: HTMLElement; api: Api | null }): SchermoGioco {
  injectUiStyle();
  if (!document.getElementById('mz-lava-style')) { const st = document.createElement('style'); st.id = 'mz-lava-style'; st.textContent = CSS_LAVA + '.lv-esito { max-height: calc(100% - 24px); overflow-y: auto; }'; document.head.appendChild(st); }
  const wrap = el('div', 'mz mz-lava'); wrap.id = 'mzLava';
  const cv = document.createElement('canvas');
  const hud = el('div', 'lv-hud'), pt = document.createElement('b'), metri = el('div', 'm'), prossimo = el('div', 'n');
  hud.append(pt, metri, prossimo);
  const x = el('button', 'mz-x', '×'); x.type = 'button'; x.setAttribute('aria-label', 'Ritirati');
  const intro = el('div', 'lv-intro'), msg = el('div', 'lv-msg');
  wrap.append(cv, hud, msg, x, intro);
  o.root.appendChild(wrap);
  const pittore = createPittoreLava(cv);

  const pointers = new Set<number>(), keys = new Set<string>();
  /** Un tocco più corto di un tick non deve perdersi: resta in sospeso fino al prossimo tick. */
  let tocco = false, medaglia = 0;
  /** Il tocco o il tasto che avvia la corsa non fa saltare: conta solo dal tocco dopo. */
  const ignorati = new Set<number>(), ignoratiTasti = new Set<string>();
  const held = () => pointers.size > 0 || keys.size > 0;
  const ridimensiona = () => pittore.ridimensiona(wrap.clientWidth || innerWidth, wrap.clientHeight || innerHeight);

  const motore = createMotore<LavaState, ReturnType<typeof scenaLava>>({
    id: 'lava', mod: lava, wrap, chiudi: x, endHold: FINE_TICK, autoPerFrame: 60, partenza: 'tocco',
    scena: (s) => scenaLava(s),
    input: () => { const a = held() || tocco; tocco = false; return { mx: 0, my: 0, a, b: false }; },
    primaPasso: (p) => primaPassoLava(p.s, p.x),
    dopoPasso: (p) => effettiLava(p.s, p.x),
    render(p, alpha, t) {
      pittore.disegna(p.s, p.x, t, alpha, p.intro || p.end >= 0);
      const v = String(p.s.punti);
      if (pt.dataset['v'] !== v) { pt.dataset['v'] = v; pt.textContent = v; }
      const m = `${metriDi(p.s.c.x)} m · ${p.s.prese.ossidiana + p.s.prese.scintilla + p.s.prese.rubino} gemme`;
      if (metri.dataset['v'] !== m) { metri.dataset['v'] = m; metri.textContent = m; }
      const mm = CFG.medaglie, pr = p.s.punti < mm.bronzo ? ['BRONZO', mm.bronzo] : p.s.punti < mm.argento ? ['ARGENTO', mm.argento] : p.s.punti < mm.oro ? ['ORO', mm.oro] : null;
      const txt = pr ? `${pr[0]} ${pr[1]}` : 'ORO!';
      if (prossimo.dataset['v'] !== txt) { prossimo.dataset['v'] = txt; prossimo.textContent = txt; }
      if (p.s.done) { if (msg.className !== 'lv-msg fine') { msg.className = 'lv-msg fine'; msg.textContent = p.s.fine === 'traguardo' ? 'TRAGUARDO!' : 'BRUCIATO!'; } }
      else {
        const k = p.s.punti >= mm.oro ? 3 : p.s.punti >= mm.argento ? 2 : p.s.punti >= mm.bronzo ? 1 : 0;
        if (k > medaglia) { medaglia = k; msg.className = 'lv-msg'; void msg.offsetWidth; msg.textContent = ['', 'BRONZO!', 'ARGENTO!', 'ORO!'][k]!; msg.className = 'lv-msg medaglia'; suona(k === 3 ? 'medaglia_oro' : k === 2 ? 'medaglia_argento' : 'medaglia_bronzo'); }
      }
    },
    tasto(e) {
      if (!TASTI.has(e.code)) return;
      e.preventDefault();
      if (motore.partita()?.intro) { ignoratiTasti.add(e.code); motore.inizia(); return; }
      if (ignoratiTasti.has(e.code)) return;
      if (!e.repeat) tocco = true;
      keys.add(e.code);
    },
    alVia() { intro.style.display = 'none'; },
    alApri() {
      pointers.clear(); keys.clear(); ignorati.clear(); ignoratiTasti.clear(); tocco = false; medaglia = 0; msg.className = 'lv-msg'; msg.textContent = '';
      ridimensiona();
      vestiIngresso(intro, null);
      intro.style.display = motore.auto ? 'none' : '';
      void o.api?.classifica('lava').then((c) => { if (c && motore.isOpen() && motore.partita()?.intro) vestiIngresso(intro, c); });
      suona('apri');
    },
    alChiudi() { pointers.clear(); keys.clear(); const p = motore.partita(); if (p) giocata = lava.result(p.s).detail; },
  });

  // ---- un dito: tieni premuto ovunque (tranne la ×), o un tasto ----
  wrap.addEventListener('pointerdown', (e) => {
    if (!motore.isOpen() || e.target === x) return;
    e.preventDefault(); e.stopPropagation();
    if (motore.partita()?.intro) ignorati.add(e.pointerId); else { pointers.add(e.pointerId); tocco = true; }
    motore.inizia();
  });
  for (const ev of ['touchstart', 'wheel']) wrap.addEventListener(ev, (e) => e.stopPropagation());
  wrap.addEventListener('contextmenu', (e) => e.preventDefault());
  const su = (e: PointerEvent) => { pointers.delete(e.pointerId); ignorati.delete(e.pointerId); };
  addEventListener('pointerup', su); addEventListener('pointercancel', su);
  addEventListener('blur', () => { pointers.clear(); keys.clear(); });
  addEventListener('keyup', (e) => { keys.delete(e.code); ignoratiTasti.delete(e.code); }); // senza fermarlo: anche input.ts deve vederlo
  addEventListener('resize', () => { if (motore.isOpen()) ridimensiona(); });

  registerStateProvider('lava', () => {
    const p = motore.partita(), s = p?.s;
    return {
      open: motore.isOpen(), auto: motore.auto, intro: p?.intro ?? false, frames: p?.frames.length ?? 0,
      view: s ? { punti: s.punti, tick: s.tick, done: s.done, fine: s.fine, y: +s.c.y.toFixed(2), terra: s.c.terra, salti: s.salti, colpi: s.colpi, margine: Math.round(s.c.margine), prese: s.prese } : null,
    };
  });

  let scheda: HTMLElement | null = null, giocata: Record<string, number> = {};
  return {
    run: motore.run, isOpen: motore.isOpen,
    esito(d) { const n = (k: string) => (typeof d[k] === 'number' ? (d[k] as number) : 0); return `${n('metri')} m · ${n('gemme')} gemme · ${n('punti')} punti`; },
    scheda(card: HTMLElement, d: SchedaEsito) { scheda = card; vestiEsito(card, Object.keys(d.detail).length ? d : { ...d, detail: giocata }); return true; }, // senza link il server non rigioca: i numeri sono quelli della partita
    esitoChiuso() { scheda?.classList.remove('lv-esito'); scheda = null; },
  };
}
