// La scheda della storia (storia/: il tutorial, poi le missioni): un'azione alla volta, niente testo lungo. Una scheda con il passo corrente
// e una freccia gialla che punta la meta: sopra la cosa se è in vista, sul bordo dello schermo (verso la meta) se è fuori. Obbligatoria
// (VISIONE §1): niente SALTA né ×; i passi fatti li dice il server (letti da `done`, anche fuori ordine). `nota`: una riga in più sotto il
// passo (la missione del dungeon mentre fai le isole). Sul telefono la scheda sta in basso e lascia il posto ai bottoni GIOCA / PESCA / Porto
// quando le finirebbero sopra.
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
  /** Il passo da fare adesso (null = finita). */
  current(): string | null;
};

const CSS = `
.mz-guida { position: absolute; left: 8px; top: max(8px, env(safe-area-inset-top)); width: 260px; box-sizing: border-box; display: none; padding: 6px 8px 8px 10px; background: rgba(46,30,20,.93); border: 2px solid ${PAL.giallo}; box-shadow: 0 3px 0 ${PAL.neroCaldo}; z-index: 13; pointer-events: none !important; }
.mz-guida.on { display: block; }
.mz-guida.cede { visibility: hidden; }
.mz-guida small { display: block; color: ${PAL.giallo}; font-size: 11px; letter-spacing: .08em; }
.mz-guida b { display: block; font-size: 16px; margin: 2px 0; }
.mz-guida span { display: block; color: ${PAL.sabbia}; font-size: 13px; line-height: 1.3; }
.mz-guida i { display: none; margin-top: 4px; padding-top: 4px; border-top: 1px solid ${PAL.legno}; color: ${PAL.sabbiaChiara}; font-size: 12px; font-style: normal; }
.mz-guida i.on { display: block; }
.mz-guida.ok { border-color: ${PAL.erba}; }
.mz-guida.ok small { color: ${PAL.erba}; }
@media (max-width: 699px) {
  .mz-guida { top: auto; left: 8px; right: 8px; width: auto; bottom: calc(env(safe-area-inset-bottom, 0px) + 180px); }
  body:has(#mzAttrezzoBtn.on) .mz-guida { right: 84px; } /* il bottone dell'attrezzo in mano (Q), sopra la A */
}
.mz-guida-ptr { position: absolute; left: 0; top: 0; width: 32px; height: 40px; display: none; color: ${PAL.giallo}; z-index: 12; pointer-events: none !important; filter: drop-shadow(0 3px 0 ${PAL.neroCaldo}); }
.mz-guida-ptr.on { display: block; }
.mz-guida-ptr svg { width: 32px; height: 40px; }
#ui.mz-racing .mz-guida, #ui.mz-racing .mz-guida-ptr { visibility: hidden; }
`;

export function createGuida(o: {
  root: HTMLElement; camera: THREE.Camera; canvas: HTMLCanvasElement; steps: GuidaStep[]; hidden(): boolean; onFocus?(id: string | null): void;
  /** Davanti al contatore («Storia 3/8»), l'id della scheda, il nome nello stato dei test, titolo e testo a passi finiti. */
  nome: string; id: string; stato: string; fine: readonly [string, string];
  /** Una riga sotto il passo (null = niente). */
  nota?(): string | null;
}): Guida {
  const { nome, fine } = o;
  injectUiStyle();
  if (!document.getElementById('mz-guida-style')) { const st = document.createElement('style'); st.id = 'mz-guida-style'; st.textContent = CSS; document.head.appendChild(st); }
  const card = el('div', 'mz mz-guida'); card.id = o.id;
  const small = el('small'), tit = el('b'), come = el('span'), nota = el('i');
  card.append(small, tit, come, nota);
  const ptr = el('div', 'mz-guida-ptr'); ptr.id = card.id + 'Ptr'; ptr.innerHTML = ARROW_SVG; // SVG statico
  o.root.append(ptr, card);

  const ids = o.steps.map((s) => s.id), fatti = new Set<string>(), total = o.steps.length;
  const doneN = () => o.steps.filter((s) => fatti.has(s.id)).length;
  const next = () => o.steps.find((s) => !fatti.has(s.id)) ?? null;
  let okUntil = 0, byeUntil = 0, sig = '', lastDone: GuidaStep | null = null, cede = false, nextCede = 0, primo = true;

  const show = (sm: string, titolo: string, testo: string, ok: boolean, n: string | null = null) => {
    const s = `${sm}|${titolo}|${testo}|${ok}|${n}`;
    if (s === sig) return;
    sig = s;
    small.textContent = sm; tit.textContent = titolo; come.textContent = testo; nota.textContent = n ?? '';
    nota.classList.toggle('on', !!n);
    card.classList.toggle('ok', ok);
  };
  const place = (target: { x: number; y: number; z: number } | null, t: number) => {
    if (!target) { ptr.classList.remove('on'); return; }
    const r = o.canvas.getBoundingClientRect();
    const M = 44, TOP = 118; // margini dal bordo; in alto si sta sotto barra risorse e toast
    // in basso: sopra la scheda quando sta in basso (telefono), così la freccia non finisce sui bottoni A/B
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

  registerStateProvider(o.stato, () => ({ done: doneN(), total, current: next()?.id ?? null, pointer: ptr.classList.contains('on'), fatti: ids.filter((id) => fatti.has(id)), cede, visibile: card.classList.contains('on'), nota: nota.textContent || null }));
  return {
    current: () => next()?.id ?? null,
    update(t) {
      // ogni passo si controlla sempre, anche fuori ordine; quelli già fatti all'apertura non fanno festa
      for (const st of o.steps) {
        if (fatti.has(st.id) || !st.done()) continue;
        fatti.add(st.id); lastDone = st;
        if (!primo) { okUntil = t + 1.4; if (!next()) byeUntil = t + 7; }
      }
      primo = false;
      const hide = o.hidden();
      const ora = performance.now(); // tempo vero: a pochi fps il tempo del gioco va piano (dt ≤ 0,1 s)
      if (ora >= nextCede) { nextCede = ora + 150; cede = sopraUnBottone(); card.classList.toggle('cede', cede); }
      const st = next();
      if (!st) {
        o.onFocus?.(null); ptr.classList.remove('on');
        card.classList.toggle('on', t < byeUntil && !hide);
        show(`${nome} · Fatto!`, fine[0], fine[1], true);
        return;
      }
      card.classList.toggle('on', !hide);
      const n = doneN();
      if (t < okUntil && lastDone) show(`${nome} ${n}/${total} · Fatto!`, lastDone.titolo, `Prossimo: ${st.titolo}`, true);
      else show(`${nome} ${n + 1}/${total}`, st.titolo, st.come, false, o.nota?.() ?? null);
      o.onFocus?.(st.id);
      place(hide ? null : st.target(), t);
    },
  };
}
