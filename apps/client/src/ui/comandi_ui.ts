import { CON_STICK, PROFILI, SLOT, azioni, nomePad, nomeTasto } from '../comandi/azioni.ts';
import type { Profilo } from '../comandi/azioni.ts';
import { azzeraComandi, impostaPad, impostaTasto, padDi, personalizzati, profiloAttivo, impostaStick, setCattura, stickInvertiti, tastoDi } from '../comandi/mappa.ts';
import { aspettaPulsante, cambiaPad, padCollegato } from '../comandi/pad.ts';
import { el } from './style.ts';
import { FONT_LIBRO, LIBRO as L } from './libro_colori.ts';

const CSS = `
#mzSet .mz-cmd-top { display: flex; align-items: center; gap: 8px; margin: 2px 0 8px; }
#mzSet .mz-cmd-top .mz-set-cam { min-width: 0; padding: 0 12px; }
#mzSet .mz-cmd-pad { margin: 0 0 10px; padding: 6px 10px; background: ${L.cartaScura}; border: 2px solid ${L.filo}; font: 700 14px ${FONT_LIBRO}; color: ${L.inchiostro2}; }
#mzSet .mz-cmd-pad.on { border-color: ${L.acqua}; color: ${L.inchiostro}; }
#mzSet .mz-cmd-pad small { display: block; font-weight: normal; font-size: 12px; margin-top: 2px; }
#mzSet .mz-cmd-profilo { display: block; box-sizing: border-box; width: 100%; min-height: 44px; margin: 0 0 6px; padding: 0 8px; background: ${L.cartaChiara}; border: 2px solid ${L.oro}; color: ${L.inchiostro}; font: 700 15px ${FONT_LIBRO}; }
@media (max-width: 699px) { #mzSet.mz-cmd-open { max-height: 70%; } }
#mzSet .mz-cmd-row { margin-top: 6px; padding: 6px 8px 8px; background: ${L.cartaChiara}; border: 2px solid ${L.filo}; }
#mzSet .mz-cmd-nome { font: 700 15px ${FONT_LIBRO}; color: ${L.inchiostro}; margin-bottom: 5px; }
#mzSet .mz-cmd-slots { display: flex; gap: 6px; }
#mzSet .mz-cmd-slot { flex: 1 1 0; min-width: 0; min-height: 44px; padding: 0 4px; background: ${L.carta}; border: 2px solid ${L.oro}; color: ${L.inchiostro}; font: 700 15px ${FONT_LIBRO}; cursor: pointer; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
#mzSet .mz-cmd-slot.pad { border-color: ${L.acquaScura}; }
#mzSet .mz-cmd-slot.vuoto { color: ${L.inchiostro2}; font-weight: normal; }
#mzSet .mz-cmd-slot.attesa { background: ${L.acqua}; border-color: ${L.acqua}; color: ${L.cartaChiara}; }
#mzSet .mz-cmd-msg:empty { display: none; }
#mzSet .mz-cmd-msg { min-height: 18px; margin: 8px 0 0; font: 700 13px ${FONT_LIBRO}; color: ${L.rosso}; }
`;

type Attesa = { id: string; tipo: 'k' | 'p'; slot: number };

export function creaComandi(body: HTMLElement, indietro: () => void): { dispose(): void } {
  if (!document.getElementById('mz-cmd-style')) {
    const s = el('style'); s.id = 'mz-cmd-style'; s.textContent = CSS; document.head.append(s);
  }
  let profilo = profiloAttivo(), attesa: Attesa | null = null, msg = '', timer = 0;
  const finito = () => {
    clearTimeout(timer); attesa = null; setCattura(false); aspettaPulsante(null);
    removeEventListener('keydown', tasto, true);
  };
  function tasto(e: KeyboardEvent): void {
    if (!attesa) return;
    e.preventDefault(); e.stopImmediatePropagation();
    if (e.repeat) return;
    const { id, slot, tipo } = attesa;
    if (tipo === 'p' && e.code !== 'Escape' && e.code !== 'Delete' && e.code !== 'Backspace') return;
    finito();
    if (e.code !== 'Escape') {
      const vuoto = e.code === 'Delete' || e.code === 'Backspace';
      if (tipo === 'p') svuotaPad(id);
      else {
        const perso = impostaTasto(profilo, id, slot, vuoto ? null : e.code);
        msg = perso ? 'Tasto rimosso da «' + perso + '».' : '';
      }
    }
    render();
  }
  const svuotaPad = (id: string) => {
    if ((profilo === 'menu' || profilo === 'scacchi') && ['conferma', 'indietro', 'chiudi'].includes(id)) return;
    impostaPad(profilo, id, null); msg = '';
  };
  function aspetta(a: Attesa): void {
    const stessa = attesa && attesa.id === a.id && attesa.tipo === a.tipo && attesa.slot === a.slot;
    finito(); msg = '';
    if (stessa) { render(); return; }
    attesa = a; setCattura(true); addEventListener('keydown', tasto, true);
    timer = window.setTimeout(() => { finito(); msg = 'Assegnazione annullata.'; render(); }, 10000);
    if (a.tipo === 'p') aspettaPulsante((b) => {
      finito();
      const precedente = padDi(profilo, a.id), altro = impostaPad(profilo, a.id, b);
      msg = padDi(profilo, a.id) !== b ? 'Questo pulsante serve a navigare. Scambialo da quell’azione.' :
        altro ? '«' + altro + '» ora usa ' + nomePad(precedente) + '.' : '';
      render();
    });
    render();
  }
  const slot = (id: string, tipo: 'k' | 'p', i: number, testo: string, azione: string) => {
    const inAttesa = attesa?.id === id && attesa.tipo === tipo && attesa.slot === i;
    const b = el('button', 'mz-cmd-slot' + (tipo === 'p' ? ' pad' : '') + (testo === '—' ? ' vuoto' : '') + (inAttesa ? ' attesa' : ''),
      inAttesa ? (tipo === 'k' ? 'Premi un tasto…' : 'Premi un pulsante…') : testo);
    b.type = 'button'; b.dataset['cmd'] = id + ':' + tipo + i;
    b.setAttribute('aria-label', azione + ' · ' + (tipo === 'p' ? 'Controller' : 'Tastiera ' + (i + 1)) + ' · ' + testo);
    b.addEventListener('click', () => aspetta({ id, tipo, slot: i }));
    b.addEventListener('pad-rimuovi', () => {
      if (tipo === 'p') svuotaPad(id); else impostaTasto(profilo, id, i, null);
      render();
    });
    return b;
  };

  function render(): void {
    body.replaceChildren();
    const top = el('div', 'mz-cmd-top'), back = el('button', 'mz-set-cam', '‹ Impostazioni');
    back.type = 'button'; back.dataset['padBack'] = ''; back.addEventListener('click', indietro); top.append(back);
    const r = el('button', 'mz-set-cam', 'Ripristina profilo'); r.type = 'button'; r.disabled = !personalizzati(profilo);
    r.addEventListener('click', () => { finito(); azzeraComandi(profilo); msg = ''; render(); }); top.append(r);
    const c = padCollegato(), st = el('div', 'mz-cmd-pad' + (c ? ' on' : ''), c ? 'Controller · ' + c : 'Nessun controller collegato');
    const rimuovi = nomePad(padDi('menu', 'rimuovi'));
    st.append(el('small', '', c ? 'Seleziona un binding e premi il nuovo pulsante. ' + (rimuovi !== '—' ? rimuovi + ' svuota il binding selezionato.' : '') :
      'Collega un controller via cavo o Bluetooth, poi premi un suo pulsante.'));
    const modi = el('select', 'mz-cmd-profilo'); modi.id = 'mzCmdModo'; modi.dataset['padInizio'] = ''; modi.setAttribute('aria-label', 'Modalità di gioco');
    for (const [id, p] of Object.entries(PROFILI)) { const opt = el('option', '', p.nome); opt.value = id; modi.append(opt); }
    modi.value = profilo;
    modi.addEventListener('change', () => { finito(); profilo = modi.value as Profilo; msg = ''; render(); });
    const m = el('div', 'mz-cmd-msg', msg); m.setAttribute('role', 'status');
    body.append(top, st, modi);
    if (CON_STICK.has(profilo)) {
      const stick = el('select', 'mz-cmd-profilo'); stick.id = 'mzCmdStick';
      const funzione = profilo === 'menu' ? 'Naviga' : 'Movimento';
      stick.setAttribute('aria-label', funzione + ' con lo stick');
      for (const [id, nome] of [['0', 'sinistro'], ['1', 'destro']]) {
        const o = el('option', '', funzione + ' con lo stick ' + nome); o.value = id!; stick.append(o);
      }
      stick.value = stickInvertiti(profilo) ? '1' : '0';
      stick.addEventListener('change', () => { impostaStick(profilo, stick.value === '1'); render(); });
      body.append(stick);
    }
    body.append(m);
    for (const a of azioni(profilo)) {
      const row = el('div', 'mz-cmd-row'), s = el('div', 'mz-cmd-slots');
      row.append(el('div', 'mz-cmd-nome', a.nome));
      if (profilo !== 'menu' && a.tasti.length) for (let i = 0; i < SLOT; i++) s.append(slot(a.id, 'k', i, nomeTasto(tastoDi(profilo, a.id, i)), a.nome));
      s.append(slot(a.id, 'p', 0, nomePad(padDi(profilo, a.id)), a.nome));
      row.append(s); body.append(row);
    }
  }
  const sheet = body.parentElement;
  sheet?.classList.add('mz-cmd-open');
  const off = cambiaPad(render);
  render();
  sheet?.scrollTo({ top: 0 });
  return { dispose() { finito(); off(); sheet?.classList.remove('mz-cmd-open'); } };
}
