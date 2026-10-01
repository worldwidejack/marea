// Ingresso dal link di gruppo (`?invito=codice`, senza token): «Come ti chiami?» → POST /api/entra → il server crea la persona con la sua
// isola e risponde col token → si riparte con `?t=token` (flags.ts lo salva: riaprendo il link sullo stesso telefono si rientra come sé).
import { PAL, el, injectUiStyle } from './style.ts';

const CSS = `
.mz-entra { position: fixed; inset: 0; display: flex; align-items: center; justify-content: center; padding: 16px; background: ${PAL.abisso}; z-index: 40; }
.mz-entra form { width: min(360px, 100%); padding: 18px 16px 14px; background: rgba(46,30,20,.97); border: 3px solid ${PAL.legnoChiaro}; box-shadow: 0 5px 0 ${PAL.neroCaldo}; text-align: center; }
.mz-entra h1 { margin: 0 0 4px; font-size: 34px; letter-spacing: .12em; color: ${PAL.giallo}; }
.mz-entra p { margin: 0 0 14px; color: ${PAL.sabbia}; font-size: 14px; line-height: 1.4; }
.mz-entra input { width: 100%; box-sizing: border-box; min-height: 52px; padding: 0 12px; background: ${PAL.sabbiaChiara}; color: ${PAL.neroCaldo}; border: 3px solid ${PAL.neroCaldo}; font: bold 20px ui-monospace, Menlo, monospace; text-align: center; -webkit-user-select: text; user-select: text; }
.mz-entra input:focus { outline: 3px solid ${PAL.giallo}; }
.mz-entra .err { min-height: 18px; margin: 8px 0 0; color: ${PAL.rosso}; font-size: 13px; font-weight: bold; }
.mz-entra .mz-btn { justify-content: center; font-size: 18px; }
`;

/** Mostra il modulo; non ritorna (al successo la pagina riparte col token). */
export function entraConInvito(codice: string): Promise<never> {
  injectUiStyle();
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  const box = el('div', 'mz mz-entra'); box.id = 'mzEntra';
  const form = document.createElement('form');
  const input = document.createElement('input');
  input.name = 'nome'; input.maxLength = 16; input.placeholder = 'il tuo nome'; input.setAttribute('autocomplete', 'nickname'); input.setAttribute('aria-label', 'Il tuo nome');
  const err = el('div', 'err');
  const btn = el('button', 'mz-btn', 'ENTRA'); btn.type = 'submit';
  form.append(el('h1', '', 'MAREA'), el('p', '', 'Un arcipelago tra amici. Avrai la tua isola: come ti chiami?'), input, err, btn);
  box.appendChild(form); document.body.appendChild(box);
  // i tasti non devono arrivare al gioco (WASD, E, Spazio) mentre si scrive
  for (const ev of ['keydown', 'keyup', 'pointerdown', 'touchstart']) box.addEventListener(ev, (e) => e.stopPropagation());
  setTimeout(() => input.focus(), 50);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nome = input.value.trim();
    if (nome.length < 2) { err.textContent = 'Scrivi almeno 2 lettere'; return; }
    btn.disabled = true; err.textContent = '';
    try {
      const r = await fetch('/api/entra', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ invito: codice, nome }) });
      const d = (await r.json().catch(() => ({}))) as { token?: string; error?: string };
      if (!r.ok || !d.token) { err.textContent = d.error ?? 'Non è andata, riprova'; btn.disabled = false; return; }
      const q = new URLSearchParams(location.search); q.delete('invito'); q.set('t', d.token); // gli altri parametri (es. ?fps=1) restano
      location.replace(`/?${q.toString()}`);
    } catch { err.textContent = 'Niente connessione, riprova'; btn.disabled = false; }
  });
  return new Promise<never>(() => {});
}
