// Guida «Primi passi» (GDD §9): un'azione alla volta, niente testo lungo. Una scheda con il passo corrente e una freccia gialla che punta
// la meta: sopra la cosa se è in vista, sul bordo dello schermo (verso la meta) se è fuori. I passi e le loro condizioni li passa main.ts.
// Un passo fatto resta fatto, **anche fuori ordine** (sei salito in barca prima della Segheria? vale lo stesso): progresso per persona in
// localStorage `marea:guida:<id>` = `{ fatti: [id…], chiusa }`. Il vecchio formato (un numero N = i primi N passi fatti) si legge ancora:
// chi aveva finito i passi di prima riparte da quelli nuovi, non da capo. SALTA salta il passo, × chiude la guida (si riaccende dalle
// Impostazioni). Sul telefono la scheda sta in basso e lascia il posto ai bottoni GIOCA / PESCA / Porto quando le finirebbero sopra.
import type * as THREE from 'three';
import { ARROW_SVG } from './compass.ts';
import { pointerPose } from './pointer.ts';
import { PAL, el, injectUiStyle } from './style.ts';
import { registerStateProvider } from '../test/testapi.ts';

export type GuidaStep = {
  id: string;
  titolo: string;
  come: string;
  /** Il passo è compiuto (letto a ogni frame, anche quando non è il passo corrente). */
  done(): boolean;
  /** Dove punta la freccia (coordinate mondo), null = nessuna freccia. */
  target(): { x: number; y: number; z: number } | null;
};
export type Guida = {
  update(t: number): void;
  /** Il passo da fare adesso (null = finita o chiusa). */
  current(): string | null;
  chiusa(): boolean;
  /** × e la riga delle Impostazioni. */
  setChiusa(v: boolean): void;
};

const CSS = `
.mz-guida { position: absolute; left: 8px; top: max(8px, env(safe-area-inset-top)); width: 260px; box-sizing: border-box; display: none; padding: 6px 8px 8px 10px; background: rgba(46,30,20,.93); border: 2px solid ${PAL.giallo}; box-shadow: 0 3px 0 ${PAL.neroCaldo}; z-index: 13; pointer-events: none !important; }
.mz-guida.on { display: block; }
.mz-guida.cede { visibility: hidden; }
.mz-guida .hd { display: flex; align-items: center; gap: 6px; }
.mz-guida small { flex: 1; color: ${PAL.giallo}; font-size: 11px; letter-spacing: .08em; }
.mz-guida b { display: block; font-size: 16px; margin: 2px 0; }
.mz-guida span { display: block; color: ${PAL.sabbia}; font-size: 13px; line-height: 1.3; }
.mz-guida button { pointer-events: auto; cursor: pointer; flex: none; min-height: 30px; min-width: 30px; padding: 0 8px; margin: 0; background: ${PAL.legnoScuro}; border: 2px solid ${PAL.legno}; color: ${PAL.sabbiaChiara}; font: bold 11px ui-monospace, Menlo, monospace; }
.mz-guida button[data-act="chiudi"] { padding: 0; font-size: 16px; }
.mz-guida button:active { transform: translateY(2px); }
.mz-guida button:focus { outline: none; } .mz-guida button:focus-visible { outline: 3px solid ${PAL.giallo}; outline-offset: 1px; }
.mz-guida.ok { border-color: ${PAL.erba}; }
.mz-guida.ok small { color: ${PAL.erba}; }
.mz-guida.ok button { display: none; }
.mz-guida.ok .hd { min-height: 30px; }
@media (max-width: 699px) {
  .mz-guida { top: auto; left: 8px; right: 8px; width: auto; bottom: calc(env(safe-area-inset-bottom, 0px) + 180px); }
  .mz-guida button { min-height: 36px; min-width: 36px; }
  .mz-guida.ok .hd { min-height: 36px; }
}
.mz-guida-ptr { position: absolute; left: 0; top: 0; width: 32px; height: 40px; display: none; color: ${PAL.giallo}; z-index: 12; pointer-events: none !important; filter: drop-shadow(0 3px 0 ${PAL.neroCaldo}); }
.mz-guida-ptr.on { display: block; }
.mz-guida-ptr svg { width: 32px; height: 40px; }
#ui.mz-racing .mz-guida, #ui.mz-racing .mz-guida-ptr { visibility: hidden; }
`;

type Saved = { fatti: string[]; chiusa: boolean };

/** `vecchi`: quanti passi in testa a `steps` c'erano già col vecchio formato (un numero): il numero salvato vale solo per loro. */
export function createGuida(o: { root: HTMLElement; camera: THREE.Camera; canvas: HTMLCanvasElement; steps: GuidaStep[]; vecchi?: number; storeKey: string; hidden(): boolean; onFocus?(id: string | null): void }): Guida {
  injectUiStyle();
  if (!document.getElementById('mz-guida-style')) { const st = document.createElement('style'); st.id = 'mz-guida-style'; st.textContent = CSS; document.head.appendChild(st); }
  const card = el('div', 'mz mz-guida'); card.id = 'mzGuida';
  const small = el('small'), tit = el('b'), come = el('span');
  const btn = (act: string, text: string, title: string) => {
    const b = el('button', 'mz', text); b.type = 'button'; b.dataset['act'] = act; b.title = title; b.setAttribute('aria-label', title);
    for (const ev of ['pointerdown', 'touchstart']) b.addEventListener(ev, (x) => x.stopPropagation()); // niente joystick né tocchi sul mondo
    return b;
  };
  const salta = btn('salta', 'SALTA ▸', 'Salta questo passo'), chiudi = btn('chiudi', '×', 'Chiudi la guida');
  const hd = el('div', 'hd'); hd.append(small, salta, chiudi);
  card.append(hd, tit, come);
  const ptr = el('div', 'mz-guida-ptr'); ptr.id = 'mzGuidaPtr'; ptr.innerHTML = ARROW_SVG; // SVG statico
  o.root.append(ptr, card);

  const ids = o.steps.map((s) => s.id);
  const read = (): Saved => {
    try {
      const raw = localStorage.getItem(o.storeKey);
      if (!raw) return { fatti: [], chiusa: false };
      if (/^\d+$/.test(raw.trim())) return { fatti: ids.slice(0, Math.min(Number(raw), o.vecchi ?? ids.length)), chiusa: false }; // formato di prima: i primi N passi
      const v = JSON.parse(raw) as Partial<Saved>;
      return { fatti: Array.isArray(v.fatti) ? v.fatti.filter((x): x is string => typeof x === 'string') : [], chiusa: v.chiusa === true };
    } catch { return { fatti: [], chiusa: false }; }
  };
  const saved = read();
  const fatti = new Set(saved.fatti);
  let chiusa = saved.chiusa;
  const write = () => { try { localStorage.setItem(o.storeKey, JSON.stringify({ fatti: [...fatti], chiusa })); } catch { /* storage bloccato: la guida riparte al prossimo avvio */ } };
  const total = o.steps.length;
  const doneN = () => o.steps.filter((s) => fatti.has(s.id)).length;
  const next = () => o.steps.find((s) => !fatti.has(s.id)) ?? null;
  let tNow = 0, okUntil = 0, byeUntil = 0, closedUntil = 0, sig = '', lastDone: GuidaStep | null = null, cede = false, nextCede = 0;

  salta.addEventListener('click', (e) => { e.preventDefault(); salta.blur(); const st = next(); if (!st) return; fatti.add(st.id); write(); okUntil = 0; if (!next()) byeUntil = tNow + 5; });
  chiudi.addEventListener('click', (e) => { e.preventDefault(); chiudi.blur(); setChiusa(true); });
  function setChiusa(v: boolean): void {
    if (v === chiusa) return;
    chiusa = v; write();
    closedUntil = v ? tNow + 3.5 : 0;
    if (!v && !next()) byeUntil = tNow + 5;
  }

  const show = (sm: string, titolo: string, testo: string, ok: boolean) => {
    const s = `${sm}|${titolo}|${testo}|${ok}`;
    if (s === sig) return;
    sig = s;
    small.textContent = sm; tit.textContent = titolo; come.textContent = testo;
    card.classList.toggle('ok', ok);
  };
  const place = (target: { x: number; y: number; z: number } | null, t: number) => {
    if (!target) { ptr.classList.remove('on'); return; }
    const r = o.canvas.getBoundingClientRect();
    const M = 44, TOP = 118; // margini dal bordo; in alto si sta sotto barra risorse e toast
    // in basso: sopra la scheda della guida quando sta in basso (telefono), così la freccia non finisce sui bottoni A/B
    const cr = card.classList.contains('on') ? card.getBoundingClientRect() : null;
    const BOT = cr && cr.top - r.top > r.height / 2 ? cr.top - r.top - 12 : r.height - M;
    const p = pointerPose({ camera: o.camera, canvas: o.canvas, root: o.root, target, top: TOP, bottom: BOT, m: M });
    if (p.inView) {
      // in vista: freccia che punta giù sopra la meta, e rimbalza
      const b = Math.abs(Math.sin(t * 4)) * 10;
      ptr.style.transform = `translate(${Math.round(p.ox + p.x - 16)}px, ${Math.round(p.oy + p.y - 52 - b)}px) rotate(180deg)`;
    } else {
      // fuori: sul bordo, nella direzione della meta vista dal centro della zona libera dello schermo
      ptr.style.transform = `translate(${Math.round(p.ox + p.x - 16)}px, ${Math.round(p.oy + Math.min(p.y, BOT - 20) - 20)}px) rotate(${p.ang.toFixed(3)}rad)`;
    }
    ptr.classList.add('on');
  };
  /** La scheda è sopra un bottone GIOCA / PESCA / TUFFATI / Porto acceso? Allora si fa da parte (visibility: la misura resta). */
  const sopraUnBottone = () => {
    if (!card.classList.contains('on')) return false;
    const c = card.getBoundingClientRect();
    for (const b of document.querySelectorAll<HTMLElement>('.mz-play.on')) {
      const r = b.getBoundingClientRect();
      if (r.width > 0 && r.left < c.right && r.right > c.left && r.top < c.bottom && r.bottom > c.top) return true;
    }
    return false;
  };

  registerStateProvider('guida', () => ({ done: doneN(), total, current: chiusa ? null : next()?.id ?? null, pointer: ptr.classList.contains('on'), chiusa, fatti: ids.filter((id) => fatti.has(id)), cede }));
  return {
    current: () => (chiusa ? null : next()?.id ?? null),
    chiusa: () => chiusa,
    setChiusa,
    update(t) {
      tNow = t;
      // ogni passo si controlla sempre, anche fuori ordine e a guida chiusa (se la riapri, quello che hai fatto vale)
      for (const st of o.steps) {
        if (fatti.has(st.id) || !st.done()) continue;
        fatti.add(st.id); write(); lastDone = st;
        if (!chiusa) { okUntil = t + 1.4; if (!next()) byeUntil = t + 7; }
      }
      const hide = o.hidden();
      const ora = performance.now(); // tempo vero: a pochi fps il tempo del gioco va piano (dt ≤ 0,1 s)
      if (ora >= nextCede) { nextCede = ora + 150; cede = sopraUnBottone(); card.classList.toggle('cede', cede); }
      const st = next();
      if (chiusa || !st) {
        o.onFocus?.(null); ptr.classList.remove('on');
        const msg = chiusa ? t < closedUntil : t < byeUntil;
        card.classList.toggle('on', msg && !hide);
        if (chiusa) show('PRIMI PASSI · CHIUSA', 'Guida chiusa', 'Se ti manca, la riaccendi dalle Impostazioni (ingranaggio).', true);
        else show('PRIMI PASSI · FATTO!', 'Ora sai tutto', 'Il resto lo scopri da solo. O te lo spiega Nonna Pina, che non aspetta altro.', true);
        return;
      }
      card.classList.toggle('on', !hide);
      const n = doneN();
      if (t < okUntil && lastDone) show(`PRIMI PASSI ${n}/${total} · FATTO!`, lastDone.titolo, `Prossimo: ${st.titolo}`, true);
      else show(`PRIMI PASSI ${n + 1}/${total}`, st.titolo, st.come, false);
      o.onFocus?.(st.id);
      place(hide ? null : st.target(), t);
    },
  };
}
