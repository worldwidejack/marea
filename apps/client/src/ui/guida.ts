// Guida «Primi passi» (GDD §9, anticipata): un'azione alla volta, niente testo lungo. Una scheda con il passo corrente e una freccia
// gialla che punta la meta: sopra la cosa se è in vista, sul bordo dello schermo (verso la meta) se è fuori. I passi e le loro
// condizioni li passa main.ts; un passo fatto resta fatto (localStorage, per persona). Alla fine un saluto e la guida sparisce.
import * as THREE from 'three';
import { ARROW_SVG } from './compass.ts';
import { PAL, el, injectUiStyle } from './style.ts';
import { registerStateProvider } from '../test/testapi.ts';

export type GuidaStep = {
  id: string;
  titolo: string;
  come: string;
  /** Il passo è compiuto (letto a ogni frame). */
  done(): boolean;
  /** Dove punta la freccia (coordinate mondo), null = nessuna freccia. */
  target(): { x: number; y: number; z: number } | null;
};
export type Guida = { update(t: number): void; current(): string | null };

const CSS = `
.mz-guida { position: absolute; left: 8px; top: max(8px, env(safe-area-inset-top)); width: 250px; display: none; padding: 8px 10px; background: rgba(46,30,20,.93); border: 2px solid ${PAL.giallo}; box-shadow: 0 3px 0 ${PAL.neroCaldo}; z-index: 13; pointer-events: none !important; }
.mz-guida.on { display: block; }
.mz-guida small { display: block; color: ${PAL.giallo}; font-size: 11px; letter-spacing: .08em; }
.mz-guida b { display: block; font-size: 16px; margin: 2px 0; }
.mz-guida span { display: block; color: ${PAL.sabbia}; font-size: 13px; line-height: 1.3; }
.mz-guida.ok { border-color: ${PAL.erba}; }
.mz-guida.ok small { color: ${PAL.erba}; }
@media (max-width: 699px) { .mz-guida { top: auto; left: 8px; right: 8px; width: auto; bottom: calc(env(safe-area-inset-bottom, 0px) + 180px); } }
.mz-guida-ptr { position: absolute; left: 0; top: 0; width: 32px; height: 40px; display: none; color: ${PAL.giallo}; z-index: 12; pointer-events: none !important; filter: drop-shadow(0 3px 0 ${PAL.neroCaldo}); }
.mz-guida-ptr.on { display: block; }
.mz-guida-ptr svg { width: 32px; height: 40px; }
#ui.mz-racing .mz-guida, #ui.mz-racing .mz-guida-ptr { visibility: hidden; }
`;

export function createGuida(o: { root: HTMLElement; camera: THREE.Camera; canvas: HTMLCanvasElement; steps: GuidaStep[]; storeKey: string; hidden(): boolean; onFocus?(id: string | null): void }): Guida {
  injectUiStyle();
  if (!document.getElementById('mz-guida-style')) { const st = document.createElement('style'); st.id = 'mz-guida-style'; st.textContent = CSS; document.head.appendChild(st); }
  const card = el('div', 'mz mz-guida'); card.id = 'mzGuida';
  const ptr = el('div', 'mz-guida-ptr'); ptr.id = 'mzGuidaPtr'; ptr.innerHTML = ARROW_SVG; // SVG statico
  o.root.append(ptr, card);
  const read = () => { try { return Math.max(0, Number(localStorage.getItem(o.storeKey) ?? 0) || 0); } catch { return 0; } };
  const write = (n: number) => { try { localStorage.setItem(o.storeKey, String(n)); } catch { /* storage bloccato: la guida riparte al prossimo avvio */ } };
  let doneN = read(), okUntil = 0, byeUntil = 0, sig = '', lastDone: GuidaStep | null = null;
  const total = o.steps.length;
  const v = new THREE.Vector3();

  const show = (small: string, titolo: string, come: string, ok: boolean) => {
    const s = `${small}|${titolo}|${come}|${ok}`;
    if (s === sig) return;
    sig = s;
    card.replaceChildren(el('small', '', small), el('b', '', titolo), el('span', '', come));
    card.classList.toggle('ok', ok);
  };
  const place = (target: { x: number; y: number; z: number } | null, t: number) => {
    if (!target) { ptr.classList.remove('on'); return; }
    v.set(target.x, target.y, target.z).project(o.camera);
    const r = o.canvas.getBoundingClientRect(), rr = o.root.getBoundingClientRect();
    const W = r.width, H = r.height, ox = r.left - rr.left, oy = r.top - rr.top;
    const behind = v.z > 1;
    let px = ((v.x + 1) / 2) * W, py = ((1 - v.y) / 2) * H;
    const M = 44, TOP = 118; // margini dal bordo; in alto si sta sotto barra risorse e toast
    // in basso: sopra la scheda della guida quando sta in basso (telefono), così la freccia non finisce sui bottoni A/B
    const cr = card.classList.contains('on') ? card.getBoundingClientRect() : null;
    const BOT = cr && cr.top - rr.top - oy > H / 2 ? cr.top - rr.top - oy - 12 : H - M;
    if (!behind && px > M && px < W - M && py > TOP && py < BOT) {
      // in vista: freccia che punta giù sopra la meta, e rimbalza
      const b = Math.abs(Math.sin(t * 4)) * 10;
      ptr.style.transform = `translate(${Math.round(ox + px - 16)}px, ${Math.round(oy + py - 52 - b)}px) rotate(180deg)`;
    } else {
      // fuori: sul bordo, nella direzione della meta vista dal centro della zona libera dello schermo
      const cx = W / 2, cy = (TOP + BOT) / 2;
      let dx = px - cx, dy = py - cy;
      if (behind) { dx = -dx; dy = -dy; }
      const k = Math.min((W / 2 - M) / Math.max(1e-6, Math.abs(dx)), (dy < 0 ? cy - TOP : BOT - cy) / Math.max(1e-6, Math.abs(dy)));
      px = cx + dx * k; py = cy + dy * k;
      const ang = Math.atan2(dx, -dy);
      ptr.style.transform = `translate(${Math.round(ox + px - 16)}px, ${Math.round(oy + Math.min(py, BOT - 20) - 20)}px) rotate(${ang.toFixed(3)}rad)`;
    }
    ptr.classList.add('on');
  };

  registerStateProvider('guida', () => ({ done: doneN, total, current: doneN < total ? o.steps[doneN]!.id : null, pointer: ptr.classList.contains('on') }));
  return {
    current: () => (doneN < total ? o.steps[doneN]!.id : null),
    update(t) {
      // i passi già compiuti (anche fuori ordine) avanzano la guida; un passo fatto resta fatto
      while (doneN < total && o.steps[doneN]!.done()) { lastDone = o.steps[doneN]!; doneN++; write(doneN); okUntil = t + 1.4; if (doneN === total) byeUntil = t + 7; }
      const hide = o.hidden();
      if (doneN >= total) {
        o.onFocus?.(null); ptr.classList.remove('on');
        const on = t < byeUntil && !hide;
        card.classList.toggle('on', on);
        if (on) show('PRIMI PASSI · FATTO!', 'Ora sai tutto', 'Costruisci, gioca ai minigiochi, visita le isole degli amici.', true);
        return;
      }
      const st = o.steps[doneN]!;
      card.classList.toggle('on', !hide);
      if (t < okUntil && lastDone) show(`PRIMI PASSI ${doneN}/${total} · FATTO!`, lastDone.titolo, `Prossimo: ${st.titolo}`, true);
      else show(`PRIMI PASSI ${doneN + 1}/${total}`, st.titolo, st.come, false);
      o.onFocus?.(st.id);
      place(hide ? null : st.target(), t);
    },
  };
}
