// La schermata «Comandi e controller», dentro le Impostazioni: per ogni azione due tasti della tastiera e un pulsante del
// controller. Tocchi uno slot, poi premi il tasto (o il pulsante del controller) che vuoi: Esc annulla, ⌫ lo svuota. Se il tasto era
// di un'altra azione, quella lo perde e te lo dico. Si usa col dito come col mouse: i controller Bluetooth si collegano al telefono.
import { AZIONI, GRUPPI, SLOT, nomePad, nomeTasto } from '../comandi/azioni.ts';
import { azzeraComandi, impostaPad, impostaTasto, padDi, personalizzati, setCattura, tastoDi } from '../comandi/mappa.ts';
import { aspettaPulsante, cambiaPad, padCollegato } from '../comandi/pad.ts';
import { el } from './style.ts';
import { FONT_LIBRO, LIBRO as L } from './libro_colori.ts';

const CSS = `
#mzSet .mz-cmd-top { display: flex; align-items: center; gap: 8px; margin: 2px 0 8px; }
#mzSet .mz-cmd-top .mz-set-cam { min-width: 0; padding: 0 12px; }
#mzSet .mz-cmd-pad { margin: 0 0 10px; padding: 6px 10px; background: ${L.cartaScura}; border: 2px solid ${L.filo}; font: 700 14px ${FONT_LIBRO}; color: ${L.inchiostro2}; }
#mzSet .mz-cmd-pad.on { border-color: ${L.acqua}; color: ${L.inchiostro}; }
#mzSet .mz-cmd-pad small { display: block; font-weight: normal; font-size: 12px; margin-top: 2px; }
#mzSet .mz-cmd-gr { margin: 12px 0 4px; font: 700 13px ${FONT_LIBRO}; color: ${L.inchiostro2}; letter-spacing: .06em; text-transform: uppercase; }
#mzSet .mz-cmd-row { margin-top: 6px; padding: 6px 8px 8px; background: ${L.cartaChiara}; border: 2px solid ${L.filo}; }
#mzSet .mz-cmd-nome { font: 700 15px ${FONT_LIBRO}; color: ${L.inchiostro}; margin-bottom: 5px; }
#mzSet .mz-cmd-slots { display: flex; gap: 6px; }
#mzSet .mz-cmd-slot { flex: 1 1 0; min-width: 0; min-height: 44px; padding: 0 4px; background: ${L.carta}; border: 2px solid ${L.oro}; color: ${L.inchiostro}; font: 700 15px ${FONT_LIBRO}; cursor: pointer; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
#mzSet .mz-cmd-slot.pad { border-color: ${L.acquaScura}; }
#mzSet .mz-cmd-slot.vuoto { color: ${L.inchiostro2}; font-weight: normal; }
#mzSet .mz-cmd-slot.attesa { background: ${L.acqua}; border-color: ${L.acqua}; color: ${L.cartaChiara}; }
#mzSet .mz-cmd-slot.fisso { cursor: default; background: ${L.cartaScura}; border-color: ${L.filo}; color: ${L.inchiostro2}; font-weight: normal; font-size: 13px; }
#mzSet .mz-cmd-msg { min-height: 18px; margin: 8px 0 0; font: 700 13px ${FONT_LIBRO}; color: ${L.rosso}; }
`;

type Attesa = { id: string; tipo: 'k' | 'p'; slot: number };

/** Disegna la schermata dentro `body`. `indietro` torna alle Impostazioni. Restituisce come smontarla. */
export function creaComandi(body: HTMLElement, indietro: () => void): { dispose(): void } {
  if (!document.getElementById('mz-cmd-style')) { const s = document.createElement('style'); s.id = 'mz-cmd-style'; s.textContent = CSS; document.head.appendChild(s); }
  let attesa: Attesa | null = null, msg = '', morta = false;
  const finito = () => { attesa = null; setCattura(false); aspettaPulsante(null); removeEventListener('keydown', tasto, true); };
  const dopo = (perso: string | null, cosa: string) => { msg = perso ? `${cosa} era di «${perso}»: ora quell'azione non ce l'ha più` : ''; };
  function tasto(e: KeyboardEvent): void {
    if (!attesa || attesa.tipo !== 'k') return;
    e.preventDefault(); e.stopImmediatePropagation();
    if (e.repeat) return;
    const { id, slot } = attesa; finito();
    if (e.code === 'Escape') { msg = ''; } else if (e.code === 'Backspace' || e.code === 'Delete') { impostaTasto(id, slot, null); msg = ''; } else dopo(impostaTasto(id, slot, e.code), `«${nomeTasto(e.code)}»`);
    render();
  }
  function aspetta(a: Attesa): void {
    const stessa = attesa && attesa.id === a.id && attesa.tipo === a.tipo && attesa.slot === a.slot;
    finito(); msg = '';
    if (stessa) { render(); return; }
    attesa = a; setCattura(true);
    if (a.tipo === 'k') addEventListener('keydown', tasto, true);
    else aspettaPulsante((b) => { if (morta) return; const { id } = a; finito(); dopo(impostaPad(id, b), `«${nomePad(b)}»`); render(); });
    render();
  }
  const slot = (id: string, tipo: 'k' | 'p', i: number, testo: string, titolo: string) => {
    const b = el('button', 'mz-cmd-slot' + (tipo === 'p' ? ' pad' : '') + (testo === '—' ? ' vuoto' : '') + (attesa && attesa.id === id && attesa.tipo === tipo && attesa.slot === i ? ' attesa' : ''), attesa && attesa.id === id && attesa.tipo === tipo && attesa.slot === i ? (tipo === 'k' ? 'premi un tasto…' : 'premi un pulsante…') : testo);
    b.type = 'button'; b.title = titolo; b.dataset['cmd'] = `${id}:${tipo}${i}`;
    b.addEventListener('click', () => aspetta({ id, tipo, slot: i }));
    return b;
  };
  function render(): void {
    if (morta) return;
    body.replaceChildren();
    const top = el('div', 'mz-cmd-top'), back = el('button', 'mz-set-cam', '‹ Impostazioni'); back.type = 'button'; back.addEventListener('click', indietro);
    top.append(back);
    if (personalizzati()) {
      const r = el('button', 'mz-set-cam', 'Ripristina'); r.type = 'button'; r.title = 'Rimette i tasti e i pulsanti di serie';
      r.addEventListener('click', () => { finito(); azzeraComandi(); msg = ''; render(); }); top.append(r);
    }
    const c = padCollegato(), st = el('div', 'mz-cmd-pad' + (c ? ' on' : ''), c ? `Controller: ${c}` : 'Nessun controller collegato');
    st.append(el('small', '', c ? 'Stick sinistro o croce per muoverti, stick destro per mirare. Tocca un pulsante e premi quello nuovo.' : 'Collegalo (cavo o Bluetooth, anche al telefono) e premi un suo pulsante: lo trovo da solo.'));
    body.append(top, st);
    for (const g of GRUPPI) {
      body.append(el('div', 'mz-cmd-gr', g));
      for (const a of AZIONI.filter((x) => x.gruppo === g)) {
        const row = el('div', 'mz-cmd-row'), s = el('div', 'mz-cmd-slots');
        row.append(el('div', 'mz-cmd-nome', a.nome));
        for (let i = 0; i < SLOT; i++) s.append(slot(a.id, 'k', i, nomeTasto(tastoDi(a.id, i)), 'Tasto della tastiera'));
        if (a.senzaPad) { const f = el('div', 'mz-cmd-slot fisso', 'stick · croce'); s.append(f); } else s.append(slot(a.id, 'p', 0, nomePad(padDi(a.id)), 'Pulsante del controller'));
        row.append(s); body.append(row);
      }
    }
    const m = el('div', 'mz-cmd-msg', msg); m.setAttribute('role', 'status'); body.append(m);
  }
  const off = cambiaPad(render);
  render();
  return { dispose() { morta = true; finito(); off(); } };
}
