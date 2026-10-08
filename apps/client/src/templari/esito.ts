// Esito della partita a ondate (docs/TEMPLARI.md §10): scheda al centro con l'esito del server (SEI CADUTO / È L'ALBA / SEI USCITO), l'ondata
// raggiunta, le uccisioni, i punti, il premio per le ondate superate (o il tetto di oggi raggiunto) e il record. TORNA (o Invio/Spazio/Esc)
// chiude e risolve.
import { PAL, el, injectUiStyle } from '../ui/style.ts';
import { resIcon } from '../ui/icons.ts';
import { registerStateProvider, registerTestHook } from '../test/testapi.ts';
import type { EsitoVista } from './types.ts';

const CSS = `
.mz-tpl-esito { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); width: min(360px, calc(100% - 24px)); max-height: calc(100% - 40px); overflow-y: auto; padding: 16px 14px 12px; background: rgba(35,32,31,.97); border: 3px solid ${PAL.rosso}; box-shadow: 0 5px 0 ${PAL.neroCaldo}; z-index: 22; text-align: center; }
.mz-tpl-esito h2 { margin: 0 0 4px; font: bold 24px/1.2 'Press Start 2P', ui-monospace, monospace; letter-spacing: .02em; }
.mz-tpl-esito .ond { font: bold 50px/1 'Press Start 2P', ui-monospace, monospace; color: ${PAL.rosso}; text-shadow: 3px 3px 0 ${PAL.neroCaldo}; margin: 8px 0 2px; }
.mz-tpl-esito .sub { color: ${PAL.sabbia}; font-size: 13px; margin-bottom: 10px; }
.mz-tpl-esito .sec { margin: 10px 0 4px; font-size: 12px; color: ${PAL.sabbia}; text-align: left; border-bottom: 2px solid ${PAL.roccia}; padding-bottom: 2px; }
.mz-tpl-esito .pr { display: flex; justify-content: center; gap: 14px; font-size: 18px; font-weight: bold; margin: 6px 0; }
.mz-tpl-esito .pr span { display: flex; align-items: center; gap: 5px; }
.mz-tpl-esito .nota { font-size: 13px; color: ${PAL.arancio}; margin: 6px 0; }
.mz-tpl-esito .rec { margin: 10px 0 2px; padding: 8px; border: 2px solid ${PAL.giallo}; color: ${PAL.giallo}; font-weight: bold; font-size: 15px; background: ${PAL.ombraCalda}; }
.mz-tpl-esito .mz-btn { justify-content: center; margin-top: 12px; }
`;
const TITOLO: Record<string, [string, string]> = { morto: ['SEI CADUTO', PAL.rosso], alba: ['È L’ALBA', PAL.giallo], uscito: ['SEI USCITO', PAL.sabbiaChiara] };
let ultimo: Record<string, unknown> | null = null, chiudi: (() => void) | null = null, registrato = false;

export function mostraEsito(root: HTMLElement, v: EsitoVista): Promise<void> {
  injectUiStyle();
  if (!document.getElementById('mz-tpl-esito-style')) { const st = document.createElement('style'); st.id = 'mz-tpl-esito-style'; st.textContent = CSS; document.head.appendChild(st); }
  if (!registrato) { registrato = true; registerStateProvider('templariEsito', () => ultimo); registerTestHook('chiudiTemplariEsito', () => { chiudi?.(); return true; }); }
  const r = v.result, [titolo, colore] = TITOLO[r.esito ?? 'uscito'] ?? TITOLO['uscito']!;
  const box = el('div', 'mz mz-tpl-esito'); box.id = 'mzTplEsito'; box.style.borderColor = colore;
  for (const ev of ['pointerdown', 'touchstart']) box.addEventListener(ev, (x) => x.stopPropagation());
  const h = el('h2', '', titolo); h.style.color = colore;
  const secs = Math.round(r.ticks / 60);
  box.append(h, el('div', 'ond', String(Math.max(1, r.ondata))), el('div', 'sub', `ondata raggiunta · ${r.uccisioni} templari abbattuti · ${r.punti} punti · ${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`));
  box.append(el('div', 'sec', `PREMIO · ${r.superate} ${r.superate === 1 ? 'ondata superata' : 'ondate superate'}`));
  if (!v.premio) box.append(el('div', 'nota', 'Senza il tuo link personale non c’è premio'));
  else if (v.premio.legno + v.premio.pietra + v.premio.perle === 0) box.append(el('div', 'nota', v.tetto ? 'Per oggi hai preso tutto il premio dell’isola: domani si ricomincia' : r.superate ? 'Niente stavolta' : 'Supera almeno un’ondata per portare a casa qualcosa'));
  else {
    const pr = el('div', 'pr');
    for (const k of ['legno', 'pietra', 'perle'] as const) if (v.premio[k] > 0) { const s = el('span'); s.append(resIcon(k, 18), el('b', '', `+${v.premio[k]}`)); pr.append(s); }
    box.append(pr);
    if (v.tetto) box.append(el('div', 'nota', 'Hai raggiunto il tetto di oggi: il resto domani'));
  }
  if (v.record) box.append(el('div', 'rec', `Nuovo record: ondata ${r.ondata}!`));
  const ok = el('button', 'mz-btn', 'TORNA SULL’ISOLA'); ok.type = 'button'; ok.dataset['act'] = 'ok';
  box.append(ok);
  root.append(box);
  ultimo = { esito: r.esito, ondata: r.ondata, superate: r.superate, uccisioni: r.uccisioni, punti: r.punti, premio: v.premio, tetto: !!v.tetto, record: !!v.record, aperto: true };
  return new Promise((res) => {
    const fine = () => { removeEventListener('keydown', kd, true); box.remove(); chiudi = null; if (ultimo) ultimo['aperto'] = false; res(); };
    const kd = (e: KeyboardEvent) => { if (['Enter', 'Space', 'Escape', 'KeyE'].includes(e.code)) { e.preventDefault(); e.stopImmediatePropagation(); fine(); } };
    addEventListener('keydown', kd, true);
    ok.addEventListener('click', fine);
    chiudi = fine;
  });
}
