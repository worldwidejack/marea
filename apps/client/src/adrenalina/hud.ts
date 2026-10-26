// L'interfaccia dello snowboard (docs/ADRENALINA.md §6-7): punti e tempo in alto, sotto la barra Adrenalina col gradino (sempre nello
// stesso posto, la useranno anche bici e lancio), le scritte grandi al centro (trick, porte, salto grande, caduta, fuoripista), il 3-2-1,
// l'aiuto dei comandi all'inizio, la scheda d'arrivo (3a: punti e numeri; medaglie e premio al 3b), Esc.
// Sotto tutto, la zona dei tocchi (`zona`) a schermo intero: col dito si gioca ovunque.
import { PAL, el } from '../ui/style.ts';
import type { SnowView } from '@marea/sim/minigames/snowboard.ts';
import { SNOWBOARD } from '@marea/content/adrenalina.ts';

const CSS = `
body.mz-sb #compass, body.mz-sb #mzTop, body.mz-sb #mzGuida, body.mz-sb #mzGuidaPtr, body.mz-sb .mz-bar, body.mz-sb .mz-work, body.mz-sb .mz-labels,
body.mz-sb #mzPlay, body.mz-sb #mzEmoteRow, body.mz-sb #mzEmotes, body.mz-sb #mzSheet, body.mz-sb #mzMini, body.mz-sb #mzMetePtr, body.mz-sb #mzTarghe,
body.mz-sb #mzTrag, body.mz-sb .mz-play, body.mz-sb #joystick, body.mz-sb #btnA, body.mz-sb #btnB, body.mz-sb #mzFunivia, body.mz-sb #mzTemaFumetto { display: none !important; }
#mzSbTocco { position: absolute; inset: 0; z-index: 13; touch-action: none; -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; -webkit-tap-highlight-color: transparent; }
.mz-sb-ui { position: absolute; inset: 0; z-index: 14; pointer-events: none; font-family: ui-monospace, Menlo, monospace; color: ${PAL.sabbiaChiara}; }
.mz-sb-ui button { pointer-events: auto; }
#mzSbTesta { position: absolute; top: calc(max(8px, env(safe-area-inset-top)) + 4px); left: 50%; transform: translateX(-50%); display: flex; flex-direction: column; align-items: center; gap: 4px; }
#mzSbPunti { font-size: 30px; font-weight: bold; text-shadow: 0 3px 0 ${PAL.neroCaldo}; line-height: 1; }
#mzSbFant { font-size: 14px; font-weight: bold; text-shadow: 0 2px 0 ${PAL.neroCaldo}; display: none; }
#mzSbTempo { font-size: 13px; text-shadow: 0 2px 0 ${PAL.neroCaldo}; }
#mzSbBarra { position: relative; width: min(220px, 56vw); height: 16px; background: rgba(46,30,20,.85); border: 2px solid ${PAL.legnoChiaro}; box-shadow: 0 3px 0 ${PAL.neroCaldo}; }
#mzSbBarra i { position: absolute; left: 0; top: 0; bottom: 0; background: ${PAL.arancio}; }
#mzSbBarra.x3 i { background: ${PAL.rosso}; }
#mzSbBarra s { position: absolute; top: 0; bottom: 0; width: 2px; background: ${PAL.neroCaldo}; text-decoration: none; }
#mzSbBarra b { position: absolute; right: -44px; top: -5px; font-size: 18px; color: ${PAL.giallo}; text-shadow: 0 2px 0 ${PAL.neroCaldo}; }
#mzSbBarra em { position: absolute; left: -2px; top: 18px; font-size: 10px; font-style: normal; letter-spacing: .12em; opacity: .85; text-shadow: 0 1px 0 ${PAL.neroCaldo}; }
#mzSbPop { position: absolute; left: 0; right: 0; top: 30%; display: flex; flex-direction: column; align-items: center; gap: 4px; }
#mzSbPop div { font-size: 22px; font-weight: bold; text-shadow: 0 3px 0 ${PAL.neroCaldo}; white-space: nowrap; animation: mzSbSu 1.3s steps(8) forwards; }
@keyframes mzSbSu { 0% { transform: translateY(8px); opacity: 1; } 70% { opacity: 1; } 100% { transform: translateY(-24px); opacity: 0; } }
#mzSbVia { position: absolute; left: 0; right: 0; top: 38%; text-align: center; font-size: 64px; font-weight: bold; color: ${PAL.giallo}; text-shadow: 0 5px 0 ${PAL.neroCaldo}; display: none; }
#mzSbAiuto { position: absolute; left: 12px; right: 12px; bottom: calc(env(safe-area-inset-bottom, 0px) + 22px); text-align: center; font-size: 13px; line-height: 1.5; padding: 8px 10px;
  background: rgba(46,30,20,.82); border: 2px solid ${PAL.legnoChiaro}; display: none; }
#mzSbAiuto.on { display: block; }
#mzSbEsci { position: absolute; top: calc(max(8px, env(safe-area-inset-top)) + 8px); min-width: 44px; min-height: 40px; padding: 0 10px; background: rgba(46,30,20,.82); color: ${PAL.sabbiaChiara};
  border: 2px solid ${PAL.legno}; font: bold 13px ui-monospace, Menlo, monospace; border-radius: 6px; cursor: pointer; }
#mzSbEsci { left: max(8px, env(safe-area-inset-left, 0px)); }
`;

export type HudNeve = {
  zona: HTMLElement;
  /** Un frame: il tempo (grande), gli abbuoni, la barra, il distacco dal fantasma (null = niente fantasma). */
  aggiorna(v: SnowView, ms: number, fantasma: string | null): void;
  pop(testo: string, colore?: string): void;
  via(testo: string | null): void;
  aiuto(on: boolean): void;
  onEsci: () => void;
  /** In gara (3-2-1 compreso) tempo, barra e distacco; nel viaggio e ai cartelli no. */
  gara(on: boolean): void;
  dispose(): void;
};

export const tempo = (ms: number) => { const s = Math.max(0, ms) / 1000, m = Math.floor(s / 60); return `${m}:${(s - m * 60).toFixed(1).padStart(4, '0')}`; };

export function creaHud(root: HTMLElement, dito: boolean, soglie: readonly [number, number]): HudNeve {
  if (!document.getElementById('mz-sb-style')) { const st = document.createElement('style'); st.id = 'mz-sb-style'; st.textContent = CSS; document.head.appendChild(st); }
  const zona = el('div'); zona.id = 'mzSbTocco';
  const ui = el('div', 'mz-sb-ui');
  const punti = el('div', '', '0'); punti.id = 'mzSbPunti';
  const ora = el('div', '', '0:00.0'); ora.id = 'mzSbTempo';
  const barra = el('div'); barra.id = 'mzSbBarra';
  const pieno = el('i'), gradino = el('b', '', '×1');
  barra.append(pieno, ...soglie.filter((v) => v < 1).map((v) => { const x = el('s'); x.style.left = `${v * 100}%`; return x; }), gradino, el('em', '', 'Adrenalina'));
  const testa = el('div'); testa.id = 'mzSbTesta'; testa.append(punti, ora, barra);
  const pop = el('div'); pop.id = 'mzSbPop';
  const via = el('div'); via.id = 'mzSbVia';
  const aiuto = el('div', '', dito
    ? 'Trascina a destra e sinistra: curvi · Lascia il dito sul bordo del trampolino: salti · In aria un colpo su, giù o di lato: trick · Dito fermo: presa'
    : 'A/D o ←/→: curvi · Spazio: tieni e lascia sul bordo del trampolino · In aria frecce: trick · Spazio tenuto: presa'); aiuto.id = 'mzSbAiuto';
  const esci = el('button', '', 'Esc ✕') as HTMLButtonElement; esci.id = 'mzSbEsci'; esci.type = 'button';
  const fant = el('div', '', ''); fant.id = 'mzSbFant';
  testa.append(fant);
  ui.append(testa, pop, via, aiuto, esci);
  for (const b of [esci]) for (const ev of ['pointerdown', 'touchstart']) b.addEventListener(ev, (e) => e.stopPropagation());
  root.append(zona, ui);
  document.body.classList.add('mz-sb');
  const h: HudNeve = {
    zona,
    onEsci: () => {},
    gara(on) { testa.style.display = on ? 'flex' : 'none'; },
    aggiorna(v, ms, f) {
      // la classifica è a tempo (3b): grande il tempo, sotto gli abbuoni che i punti ti hanno dato e le porte mancate
      punti.textContent = tempo(ms);
      const ab = Math.max(0, v.punti) / SNOWBOARD.tempo.puntiAlSecondo, pen = v.mancate * SNOWBOARD.tempo.portaMancata;
      ora.textContent = `abbuoni −${ab.toFixed(1)} s${pen ? ` · +${pen} s` : ''}`;
      fant.textContent = f ?? ''; fant.style.display = f ? 'block' : 'none';
      fant.style.color = f && f.includes('+') ? PAL.rosso : PAL.erbaChiara;
      pieno.style.width = `${Math.round(v.barra.v * 100)}%`;
      gradino.textContent = `×${v.molt}`;
      barra.classList.toggle('x3', v.molt === 3);
    },
    pop(testo, colore = PAL.sabbiaChiara) {
      const d = el('div', '', testo); d.style.color = colore; pop.append(d);
      while (pop.children.length > 3) pop.firstChild!.remove();
      setTimeout(() => d.remove(), 1400);
    },
    via(t) { via.style.display = t ? 'block' : 'none'; via.textContent = t ?? ''; },
    aiuto(on) { aiuto.classList.toggle('on', on); },
    dispose() { zona.remove(); ui.remove(); document.body.classList.remove('mz-sb'); },
  };
  esci.addEventListener('click', () => h.onEsci());
  return h;
}
