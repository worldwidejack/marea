// I cartelli della vetta (passo 3b, docs/ADRENALINA.md §7 e §9): il cartello delle piste (Snowboard → Verde; blu, rossa, nera, bici e lancio
// col lucchetto), il cartello delle regole (3 s, col fantasma da battere) e la scheda d'arrivo (tempo, abbuoni, tempo finale, posto in
// classifica, medaglia, premio) con ANCORA · IN VETTA · AL MOLO. Legno e corda come il resto di MAREA, colori della palette.
import { PAL, el } from '../ui/style.ts';
import { tempo } from './hud.ts';

const CSS = `
.mz-sb-cartello { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); width: min(360px, calc(100% - 28px)); max-height: calc(100% - 110px); overflow-y: auto;
  box-sizing: border-box; padding: 14px; z-index: 16; pointer-events: auto; font-family: ui-monospace, Menlo, monospace; color: ${PAL.sabbiaChiara};
  background: rgba(90,58,30,.97); border: 3px solid ${PAL.legnoChiaro}; box-shadow: 0 5px 0 ${PAL.neroCaldo}; }
.mz-sb-cartello h2 { margin: 0 0 4px; font-size: 22px; letter-spacing: .1em; text-align: center; color: ${PAL.giallo}; }
.mz-sb-cartello .sub { font-size: 12px; text-align: center; color: ${PAL.sabbia}; margin-bottom: 10px; }
.mz-sb-cartello .gioco { margin: 10px 0 4px; font-size: 14px; font-weight: bold; }
.mz-sb-cartello .piste { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }
.mz-sb-cartello .pista { min-height: 52px; border: 2px solid ${PAL.neroCaldo}; font: bold 12px ui-monospace, Menlo, monospace; color: ${PAL.neroCaldo}; cursor: pointer; padding: 2px; }
.mz-sb-cartello .pista[disabled] { opacity: .45; cursor: default; }
.mz-sb-cartello .pista small { display: block; font-size: 10px; font-weight: normal; }
.mz-sb-cartello .riga { font-size: 13px; line-height: 1.6; text-align: center; }
.mz-sb-cartello .big { font-size: 30px; font-weight: bold; text-align: center; margin: 2px 0; }
.mz-sb-cartello .bt { display: flex; gap: 6px; justify-content: center; margin-top: 12px; flex-wrap: wrap; }
.mz-sb-cartello .bt button { flex: 1; min-width: 90px; min-height: 46px; border: 2px solid ${PAL.neroCaldo}; font: bold 14px ui-monospace, Menlo, monospace; cursor: pointer; }
.mz-sb-cartello .esci { width: 100%; margin-top: 12px; min-height: 40px; background: ${PAL.pietra}; border: 2px solid ${PAL.neroCaldo}; font: bold 13px ui-monospace, Menlo, monospace; color: ${PAL.neroCaldo}; cursor: pointer; }
`;
const COLORE_PISTA = { verde: PAL.erba, blu: PAL.acquaProfonda, rossa: PAL.rosso, nera: PAL.neroCaldo } as const;
const MEDAGLIA = { oro: ['🥇 ORO', PAL.giallo], argento: ['🥈 ARGENTO', PAL.pietraChiara], bronzo: ['🥉 BRONZO', PAL.arancio] } as const;

function pannello(root: HTMLElement, id: string): HTMLElement {
  if (!document.getElementById('mz-sb-cartelli-style')) { const st = document.createElement('style'); st.id = 'mz-sb-cartelli-style'; st.textContent = CSS; document.head.appendChild(st); }
  document.getElementById(id)?.remove();
  const d = el('div', 'mz-sb-cartello'); d.id = id;
  for (const ev of ['pointerdown', 'touchstart']) d.addEventListener(ev, (e) => e.stopPropagation());
  root.append(d);
  return d;
}

export type InfoPista = { record: { nome: string; ms: number } | null; mio: number | null };

/** Il cartello delle piste in vetta: risolve con l'id della pista scelta, o null per tornare giù in funivia. */
export function cartelloPiste(root: HTMLElement, info: InfoPista): Promise<string | null> {
  const d = pannello(root, 'mzSbPiste');
  return new Promise((ok) => {
    const chiudi = (v: string | null) => { d.remove(); ok(v); };
    const fila = (titolo: string, aperta: boolean) => {
      const g = el('div', 'piste');
      for (const c of ['verde', 'blu', 'rossa', 'nera'] as const) {
        const b = el('button', 'pista') as HTMLButtonElement; b.type = 'button'; b.style.background = COLORE_PISTA[c]; if (c === 'nera') b.style.color = PAL.sabbiaChiara;
        const apri = aperta && c === 'verde';
        b.append(el('span', '', c.toUpperCase()), el('small', '', apri ? (info.record ? `record ${tempo(info.record.ms)}` : 'nessun record') : '🔒'));
        if (apri) { b.dataset['pista'] = 'snowboard_verde'; b.addEventListener('click', () => chiudi('snowboard_verde')); } else b.disabled = true;
        g.append(b);
      }
      return [el('div', 'gioco', titolo), g];
    };
    const esci = el('button', 'esci', '🚡 Torna giù in funivia') as HTMLButtonElement; esci.type = 'button'; esci.id = 'mzSbPisteEsci';
    esci.addEventListener('click', () => chiudi(null));
    d.append(el('h2', '', 'LE PISTE'), el('div', 'sub', 'La vetta · le blu si apriranno con le medaglie'),
      ...fila('🏂 Snowboard', true), ...fila('🚵 Bici downhill · presto', false), ...fila('🪂 Lancio dalla vetta · presto', false),
      ...(info.mio !== null ? [el('div', 'riga', `Il tuo tempo migliore sulla verde: ${tempo(info.mio)}`)] : []), esci);
  });
}

/** Il cartello delle regole (sparisce da solo dopo `ms`). */
export function cartelloRegole(root: HTMLElement, fantasma: { nome: string; ms: number } | null, conPremio: boolean, ms = 3200): Promise<void> {
  const d = pannello(root, 'mzSbRegole');
  d.append(el('h2', '', 'SNOWBOARD · VERDE'),
    el('div', 'riga', fantasma ? `Batti il fantasma di ${fantasma.nome}: ${tempo(fantasma.ms)}` : 'Nessuno è ancora sceso: arrivi in fondo e l’oro è tuo'),
    el('div', 'riga', 'Porte, salti e trick tolgono secondi · porta mancata +2 s'),
    el('div', 'riga', '1° oro · 2° argento · 3° bronzo'),
    ...(conPremio ? [] : [el('div', 'riga', 'Senza il tuo link personale si scende senza premio')]));
  return new Promise((ok) => setTimeout(() => { d.remove(); ok(); }, ms));
}

export type Arrivo = {
  arrivato: boolean; ms: number; abbuono: number; penalita: number; finale: number;
  medal: 'oro' | 'argento' | 'bronzo' | null; posizione: number | null; classificati: number | null; record: { nome: string; ms: number } | null; nuovoRecord: boolean;
  premio: string | null; nota: string | null;
};
/** La scheda d'arrivo: risolve con il bottone premuto. */
export function schedaArrivo(root: HTMLElement, a: Arrivo): Promise<'ancora' | 'vetta' | 'molo'> {
  const d = pannello(root, 'mzSbFine');
  return new Promise((ok) => {
    const chiudi = (v: 'ancora' | 'vetta' | 'molo') => { d.remove(); removeEventListener('keydown', tasti); ok(v); };
    const tasti = (e: KeyboardEvent) => { if (!e.repeat && (e.code === 'Enter' || e.code === 'Space')) chiudi('ancora'); };
    addEventListener('keydown', tasti);
    const m = a.medal ? MEDAGLIA[a.medal] : null;
    const titolo = el('h2', '', m ? m[0] : a.arrivato ? 'ARRIVATO' : 'TEMPO SCADUTO'); if (m) titolo.style.color = m[1];
    const righe: HTMLElement[] = [];
    if (a.arrivato) {
      righe.push(el('div', 'big', tempo(a.finale)));
      righe.push(el('div', 'riga', `discesa ${tempo(a.ms)} · abbuoni −${(a.abbuono / 1000).toFixed(1)} s${a.penalita ? ` · porte mancate +${(a.penalita / 1000).toFixed(0)} s` : ''}`));
      if (a.posizione) righe.push(el('div', 'riga', a.nuovoRecord ? `🏆 NUOVO RECORD della pista!` : `${a.posizione}° su ${Math.max(a.posizione, (a.classificati ?? 0) + 1)}${a.record ? ` · record di ${a.record.nome} ${tempo(a.record.ms)}` : ''}`));
    }
    if (a.premio) righe.push(el('div', 'riga', a.premio));
    if (a.nota) righe.push(el('div', 'riga', a.nota));
    const bt = el('div', 'bt');
    for (const [k, t, c] of [['ancora', 'ANCORA', PAL.arancio], ['vetta', 'IN VETTA', PAL.erbaChiara], ['molo', 'AL MOLO', PAL.pietra]] as const) {
      const b = el('button', '', t) as HTMLButtonElement; b.type = 'button'; b.style.background = c; b.style.color = PAL.neroCaldo; b.dataset['act'] = k;
      b.addEventListener('click', () => chiudi(k)); bt.append(b);
    }
    d.append(titolo, ...righe, bt);
  });
}
