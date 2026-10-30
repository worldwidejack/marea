// Fuga dalla lava, le schede di testo: l'ingresso (regole e migliori di oggi) e la scheda dell'esito con premio e classifica.
// Il CSS della schermata a schermo intero sta qui (ui/lava.ts la usa). Solo colori della palette.
import { MINIGAMES_CFG } from '@marea/content';
import type { RispostaClassifica, VistaClassifica } from '../net/api.ts';
import type { SchedaEsito } from '../game/minigiochi.ts';
import { PAL, el } from './style.ts';
import { resIcon } from './icons.ts';
import { RIGHE_CLASSIFICA } from '@marea/sim/economy/classifica.ts';

const CFG = MINIGAMES_CFG.lava;
const MEDAL_TXT: Record<string, string> = { oro: 'Oro', argento: 'Argento', bronzo: 'Bronzo' };
const MEDAL_C: Record<string, string> = { oro: PAL.giallo, argento: PAL.pietraChiara, bronzo: PAL.arancio };

export const CSS_LAVA = `
.mz-lava { position: absolute; inset: 0; display: none; z-index: 28; overflow: hidden; touch-action: none; background: ${PAL.neroCaldo}; cursor: pointer; }
.mz-lava.on { display: block; }
.mz-lava canvas { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); image-rendering: pixelated; display: block; }
.lv-hud { position: absolute; left: 12px; top: max(10px, env(safe-area-inset-top)); pointer-events: none; color: ${PAL.sabbiaChiara}; text-shadow: 0 2px 0 ${PAL.neroCaldo}, 0 0 6px ${PAL.neroCaldo}; font: bold 13px ui-monospace, Menlo, monospace; line-height: 1.15; }
.lv-hud b { display: block; font-size: 34px; color: ${PAL.giallo}; letter-spacing: .02em; }
.lv-hud .m { color: ${PAL.sabbia}; font-size: 12px; }
.lv-hud .n { color: ${PAL.arancio}; font-size: 12px; }
.mz-lava .mz-x { position: absolute; right: 10px; top: max(10px, env(safe-area-inset-top)); z-index: 3; }
.lv-msg { position: absolute; left: 0; right: 0; top: 30%; text-align: center; pointer-events: none; z-index: 1; opacity: 0; font: bold 34px ui-monospace, Menlo, monospace; letter-spacing: .08em; text-shadow: 0 3px 0 ${PAL.neroCaldo}, 0 0 8px ${PAL.neroCaldo}; }
.lv-msg.fine { opacity: 1; color: ${PAL.rosso}; font-size: 40px; }
.lv-msg.medaglia { color: ${PAL.giallo}; animation: lvMed 1.5s steps(10) forwards; }
@keyframes lvMed { 0% { opacity: 1; transform: translateY(0); } 70% { opacity: 1; } 100% { opacity: 0; transform: translateY(-22px); } }
.lv-intro { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 7px; padding: 12px; background: rgba(35,32,31,.74); text-align: center; z-index: 2; }
.lv-intro h1 { margin: 0 0 4px; font-size: 26px; letter-spacing: .08em; color: ${PAL.arancio}; text-shadow: 0 3px 0 ${PAL.neroCaldo}; }
.lv-intro .r { width: min(92%, 340px); padding: 5px 8px; background: ${PAL.ombraCalda}; border: 2px solid ${PAL.legnoChiaro}; font: bold 13px ui-monospace, Menlo, monospace; color: ${PAL.sabbiaChiara}; }
.lv-intro .r b { color: ${PAL.giallo}; } .lv-intro .r i { color: ${PAL.acquaBassa}; font-style: normal; } .lv-intro .r u { color: ${PAL.rosso}; text-decoration: none; }
.lv-intro .go { margin-top: 8px; padding: 10px 18px; border: 3px solid ${PAL.giallo}; color: ${PAL.giallo}; font: bold 20px ui-monospace, Menlo, monospace; letter-spacing: .06em; animation: lvBlink 1s steps(2) infinite; }
@keyframes lvBlink { 50% { opacity: .45; } }
.lv-lista { width: min(92%, 340px); margin: 4px auto 0; text-align: left; font: bold 13px ui-monospace, Menlo, monospace; }
.lv-lista h3 { margin: 0 0 3px; font-size: 11px; letter-spacing: .1em; color: ${PAL.sabbia}; text-align: center; }
.lv-r { display: flex; gap: 8px; align-items: center; padding: 2px 8px; min-height: 22px; color: ${PAL.sabbiaChiara}; }
.lv-r:nth-child(even) { background: rgba(0,0,0,.18); }
.lv-r span:first-child { width: 2ch; color: ${PAL.sabbia}; text-align: right; } .lv-r span:nth-child(2) { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } .lv-r b { color: ${PAL.giallo}; }
.lv-r.me { background: ${PAL.legnoScuro}; outline: 2px solid ${PAL.giallo}; outline-offset: -2px; }
.lv-r.vuoto { color: ${PAL.sabbia}; justify-content: center; }
.lv-esito .big { font-size: 40px; font-weight: bold; color: ${PAL.giallo}; line-height: 1; margin: 2px 0; } .lv-esito .big small { font-size: 14px; color: ${PAL.sabbia}; }
.lv-esito .rec { margin: 6px 0 2px; font-size: 14px; font-weight: bold; color: ${PAL.acquaBassa}; }
.lv-tabs { display: flex; gap: 6px; margin: 10px 0 4px; }
.lv-tabs button { flex: 1; min-height: 34px; background: ${PAL.legnoScuro}; color: ${PAL.sabbia}; border: 2px solid ${PAL.legnoChiaro}; font: bold 12px ui-monospace, Menlo, monospace; cursor: pointer; }
.lv-tabs button.on { background: ${PAL.arancio}; color: ${PAL.neroCaldo}; border-color: ${PAL.neroCaldo}; }
`;

/** Le righe di una classifica; la tua è quella al posto `v.posto` (o l'ultima, se sei fuori dalle prime). */
function lista(v: VistaClassifica, titolo: string | null, max = 99): HTMLElement {
  const box = el('div', 'lv-lista');
  if (titolo) box.appendChild(el('h3', '', titolo));
  const righe = v.righe.slice(0, max);
  if (!righe.length) { box.appendChild(el('div', 'lv-r vuoto', 'Nessuno ha ancora corso: sii il primo!')); return box; }
  const fuori = v.posto > RIGHE_CLASSIFICA, mio = v.posto <= 0 ? -1 : fuori ? v.righe.length - 1 : v.posto - 1;
  righe.forEach((r, i) => {
    const row = el('div', 'lv-r' + (i === mio ? ' me' : ''));
    row.append(el('span', '', String(i === mio && fuori ? v.posto : i + 1)), el('span', '', r.nome), el('b', '', String(r.score)));
    box.appendChild(row);
  });
  return box;
}

/** Il cartello dell'ingresso: regole e i primi tre di oggi (se il server risponde). */
export function vestiIngresso(box: HTMLElement, c: RispostaClassifica | null): void {
  box.replaceChildren(
    el('h1', '', CFG.nome.toUpperCase()),
    ...([
      '<b>TOCCA</b> salta · <b>TIENI</b> salta più in alto',
      '<i>IN ARIA</i> tocca ancora: giravolta',
      'Gli ostacoli bassi li scavalchi da solo · salta sui <u>nemici</u>',
      'Il <u>muro di lava</u> ti insegue: colpi e tuffi lo avvicinano',
    ].map((h) => { const d = el('div', 'r'); d.innerHTML = h; return d; })), // testo fisso scritto qui sopra
    ...(c && c.oggi.totale ? [lista(c.oggi, 'I MIGLIORI DI OGGI', 3)] : []),
    el('div', 'go', 'TOCCA PER PARTIRE'),
  );
}

/** La scheda dell'esito (dentro #mzEsito): medaglia, punti, premio, record battuti, classifica di oggi e di sempre, RIGIOCA / OK. */
export function vestiEsito(card: HTMLElement, d: SchedaEsito): void {
  const n = (k: string) => d.detail[k] ?? 0, c = d.classifica;
  const col = d.medal ? MEDAL_C[d.medal]! : PAL.sabbiaChiara;
  card.classList.add('lv-esito'); card.style.borderColor = col;
  const titolo = el('h2', '', d.medal ? MEDAL_TXT[d.medal]! : n('arrivato') ? 'Traguardo!' : 'Bruciato!'); titolo.style.color = col;
  const big = el('div', 'big'); big.append(document.createTextNode(String(n('punti'))), el('small', '', ' punti'));
  const sub = el('div', 'sub', `${n('metri')} m · ${n('gemme')} gemme · ${n('nemici')} nemici`);
  const corpo: Node[] = [titolo, big, sub];
  const rec = c?.migliorato?.sempre ? 'La tua corsa migliore!' : c?.migliorato?.oggi ? 'La tua migliore di oggi!' : '';
  if (rec) corpo.push(el('div', 'rec', rec));
  if (d.premio) { const r = el('div', 'premio'), s = el('span'); s.append(resIcon('monete', 24), el('b', '', `+${d.premio} monete`)); r.appendChild(s); corpo.push(r); }
  if (d.note) corpo.push(el('div', 'sub', d.note));
  if (c) {
    const tabs = el('div', 'lv-tabs'), sede = el('div');
    const mostra = (k: 'oggi' | 'sempre') => { sede.replaceChildren(lista(c[k], null)); tabs.querySelectorAll('button').forEach((b) => b.classList.toggle('on', (b as HTMLElement).dataset['k'] === k)); };
    for (const [k, nome] of [['oggi', 'OGGI'], ['sempre', 'DI SEMPRE']] as const) {
      const b = el('button', '', nome); b.type = 'button'; b.dataset['k'] = k; b.addEventListener('click', () => mostra(k)); tabs.appendChild(b);
    }
    corpo.push(tabs, sede); mostra(c.oggi.totale ? 'oggi' : 'sempre');
  }
  const riga = el('div', 'mz-row'); riga.append(d.again, d.ok);
  card.replaceChildren(...corpo, riga);
}
