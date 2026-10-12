// L'interfaccia dello snowboard (docs/ADRENALINA.md §6-7): punti e tempo in alto, sotto la barra Adrenalina col gradino (sempre nello
// stesso posto, la useranno anche bici e lancio), le scritte grandi al centro (trick, porte, salto grande, caduta, fuoripista), il 3-2-1,
// l'aiuto dei comandi all'inizio, la scheda d'arrivo (3a: punti e numeri; medaglie e premio al 3b), Esc e il cambio camera A/B.
// Sotto tutto, la zona dei tocchi (`zona`) a schermo intero: col dito si gioca ovunque.
import { PAL, el } from '../ui/style.ts';
import type { SnowView } from '@marea/sim/minigames/snowboard.ts';
import type { CameraId } from './regia.ts';

const CSS = `
body.mz-sb #compass, body.mz-sb #mzTop, body.mz-sb #mzGuida, body.mz-sb #mzGuidaPtr, body.mz-sb .mz-bar, body.mz-sb .mz-work, body.mz-sb .mz-labels,
body.mz-sb #mzPlay, body.mz-sb #mzEmoteRow, body.mz-sb #mzEmotes, body.mz-sb #mzSheet, body.mz-sb #mzMini, body.mz-sb #mzMetePtr, body.mz-sb #mzTarghe,
body.mz-sb #mzTrag, body.mz-sb .mz-play, body.mz-sb #joystick, body.mz-sb #btnA, body.mz-sb #btnB, body.mz-sb #mzFunivia, body.mz-sb #mzTemaFumetto { display: none !important; }
#mzSbTocco { position: absolute; inset: 0; z-index: 13; touch-action: none; -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; -webkit-tap-highlight-color: transparent; }
.mz-sb-ui { position: absolute; inset: 0; z-index: 14; pointer-events: none; font-family: ui-monospace, Menlo, monospace; color: ${PAL.sabbiaChiara}; }
.mz-sb-ui button { pointer-events: auto; }
#mzSbTesta { position: absolute; top: calc(max(8px, env(safe-area-inset-top)) + 4px); left: 50%; transform: translateX(-50%); display: flex; flex-direction: column; align-items: center; gap: 4px; }
#mzSbPunti { font-size: 30px; font-weight: bold; text-shadow: 0 3px 0 ${PAL.neroCaldo}; line-height: 1; }
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
#mzSbEsci, #mzSbCam { position: absolute; top: calc(max(8px, env(safe-area-inset-top)) + 8px); min-width: 44px; min-height: 40px; padding: 0 10px; background: rgba(46,30,20,.82); color: ${PAL.sabbiaChiara};
  border: 2px solid ${PAL.legno}; font: bold 13px ui-monospace, Menlo, monospace; border-radius: 6px; cursor: pointer; }
#mzSbEsci { left: max(8px, env(safe-area-inset-left, 0px)); }
#mzSbCam { right: max(8px, env(safe-area-inset-right, 0px)); }
#mzSbFine { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); width: min(340px, calc(100% - 32px)); box-sizing: border-box; padding: 16px; display: none; text-align: center; pointer-events: auto;
  background: rgba(46,30,20,.97); border: 3px solid ${PAL.legnoChiaro}; box-shadow: 0 5px 0 ${PAL.neroCaldo}; }
#mzSbFine.on { display: block; }
#mzSbFine h2 { margin: 0 0 2px; font-size: 30px; letter-spacing: .08em; color: ${PAL.giallo}; }
#mzSbFine .tot { font-size: 34px; font-weight: bold; margin: 4px 0 8px; }
#mzSbFine .righe { font-size: 14px; line-height: 1.6; color: ${PAL.sabbia}; margin-bottom: 12px; }
#mzSbFine .bt { display: flex; gap: 8px; justify-content: center; }
#mzSbFine button { min-width: 120px; min-height: 48px; border: 2px solid ${PAL.neroCaldo}; font: bold 16px ui-monospace, Menlo, monospace; cursor: pointer; }
#mzSbAncora { background: ${PAL.arancio}; color: ${PAL.neroCaldo}; }
#mzSbFineEsci { background: ${PAL.pietra}; color: ${PAL.neroCaldo}; }
`;

export type FineDati = { punti: number; ms: number; porte: number; porteTot: number; trick: number; combo: number; cadute: number; arrivato: boolean };
export type HudNeve = {
  zona: HTMLElement;
  aggiorna(v: SnowView, ms: number, cam: CameraId): void;
  pop(testo: string, colore?: string): void;
  via(testo: string | null): void;
  aiuto(on: boolean): void;
  fine(d: FineDati | null): void;
  onEsci: () => void; onCamera: () => void; onAncora: () => void;
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
  barra.append(pieno, ...soglie.filter((v) => v < 1).map((v) => { const x = el('s'); x.style.left = `${v * 100}%`; return x; }), gradino, el('em', '', 'ADRENALINA'));
  const testa = el('div'); testa.id = 'mzSbTesta'; testa.append(punti, ora, barra);
  const pop = el('div'); pop.id = 'mzSbPop';
  const via = el('div'); via.id = 'mzSbVia';
  const aiuto = el('div', '', dito
    ? 'Trascina a destra e sinistra: curvi · Lascia il dito sul bordo del trampolino: salti · In aria un colpo su, giù o di lato: trick · Dito fermo: presa'
    : 'A/D o ←/→: curvi · Spazio: tieni e lascia sul bordo del trampolino · In aria frecce: trick · Spazio tenuto: presa'); aiuto.id = 'mzSbAiuto';
  const esci = el('button', '', 'Esc ✕') as HTMLButtonElement; esci.id = 'mzSbEsci'; esci.type = 'button';
  const cam = el('button', '', '📷 A') as HTMLButtonElement; cam.id = 'mzSbCam'; cam.type = 'button';
  const fine = el('div'); fine.id = 'mzSbFine';
  const ancora = el('button', '', 'ANCORA') as HTMLButtonElement; ancora.id = 'mzSbAncora'; ancora.type = 'button';
  const fineEsci = el('button', '', 'ESCI') as HTMLButtonElement; fineEsci.id = 'mzSbFineEsci'; fineEsci.type = 'button';
  ui.append(testa, pop, via, aiuto, esci, cam, fine);
  for (const b of [esci, cam, ancora, fineEsci, fine]) for (const ev of ['pointerdown', 'touchstart']) b.addEventListener(ev, (e) => e.stopPropagation());
  root.append(zona, ui);
  document.body.classList.add('mz-sb');
  const h: HudNeve = {
    zona,
    onEsci: () => {}, onCamera: () => {}, onAncora: () => {},
    aggiorna(v, ms, c) {
      punti.textContent = String(Math.max(0, v.punti));
      ora.textContent = tempo(ms);
      pieno.style.width = `${Math.round(v.barra.v * 100)}%`;
      gradino.textContent = `×${v.molt}`;
      barra.classList.toggle('x3', v.molt === 3);
      cam.textContent = `📷 ${c.toUpperCase()}`;
    },
    pop(testo, colore = PAL.sabbiaChiara) {
      const d = el('div', '', testo); d.style.color = colore; pop.append(d);
      while (pop.children.length > 3) pop.firstChild!.remove();
      setTimeout(() => d.remove(), 1400);
    },
    via(t) { via.style.display = t ? 'block' : 'none'; via.textContent = t ?? ''; },
    aiuto(on) { aiuto.classList.toggle('on', on); },
    fine(d) {
      fine.classList.toggle('on', !!d);
      if (!d) return;
      const righe = el('div', 'righe');
      righe.append(el('div', '', `${tempo(d.ms)} · porte ${d.porte}/${d.porteTot}`), el('div', '', `trick ${d.trick}${d.combo > 1 ? ` · combo ×${d.combo}` : ''} · cadute ${d.cadute}`));
      const bt = el('div', 'bt'); bt.append(ancora, fineEsci);
      fine.replaceChildren(el('h2', '', d.arrivato ? 'ARRIVO' : 'TEMPO SCADUTO'), el('div', 'tot', `${Math.max(0, d.punti)} punti`), righe, bt);
    },
    dispose() { zona.remove(); ui.remove(); document.body.classList.remove('mz-sb'); },
  };
  esci.addEventListener('click', () => h.onEsci());
  cam.addEventListener('click', () => h.onCamera());
  ancora.addEventListener('click', () => h.onAncora());
  fineEsci.addEventListener('click', () => h.onEsci());
  return h;
}
