// Targhette sopra la testa (#87): il nome degli amici e, sotto, il titolo che hanno scelto nel Diario del capitano (arriva col Peer:
// `titolo` = id del traguardo). Sopra la propria testa la targhetta c'è solo con un titolo scelto (il tuo nome lo sai già).
// DOM proiettato ogni frame come i fumetti delle emote; lontano (> DIST m), fuori schermo o con un fumetto sopra la stessa testa sparisce.
import * as THREE from 'three';
import type { Camera } from 'three';
import { titoloDi } from '@marea/sim/economy/diario.ts';
import type { GameWorld } from './world.ts';
import { PAL, el } from '../ui/style.ts';
import { registerStateProvider } from '../test/testapi.ts';
import { LABEL_NEAR_M } from '../ui/sheet.ts';

export type Targhette = { update(): void };
const DIST = 40;
const STYLE = `
#mzTarghe { position: absolute; inset: 0; overflow: hidden; z-index: 5; pointer-events: none !important; }
#ui.mz-racing #mzTarghe, body.mz-sotto #mzTarghe { visibility: hidden; }
.mz-targa { position: absolute; left: 0; top: 0; display: flex; flex-direction: column; align-items: center; padding: 1px 6px 2px; background: rgba(46,30,20,.82); border: 2px solid ${PAL.legnoChiaro}; box-shadow: 0 2px 0 ${PAL.neroCaldo}; font: bold 12px/1.2 ui-monospace, Menlo, monospace; color: ${PAL.sabbiaChiara}; white-space: nowrap; pointer-events: none; will-change: transform; }
.mz-targa i { font-style: normal; font-size: 11px; color: ${PAL.giallo}; }
.mz-targa[data-who="me"] { border-color: ${PAL.giallo}; }
/* #129: da PC, oltre LABEL_NEAR_M la targhetta è più piccola e un po' trasparente; sul telefono resta com'è */
@media (hover: hover) and (pointer: fine) {
  .mz-targa { transition: opacity .2s; }
  .mz-targa.far { padding: 0 4px 1px; border-width: 1px; box-shadow: none; font-size: 10px; opacity: .75; }
  .mz-targa.far i { font-size: 9px; }
}
`;

type Tag = { el: HTMLElement; sig: string };

export function createTarghette(o: { world: GameWorld; camera: Camera; canvas: HTMLCanvasElement; root: HTMLElement; mio(): { nome: string; titolo: string | null } | null }): Targhette {
  if (!document.getElementById('mz-targhe-style')) { const st = document.createElement('style'); st.id = 'mz-targhe-style'; st.textContent = STYLE; document.head.appendChild(st); }
  const layer = el('div'); layer.id = 'mzTarghe'; o.root.prepend(layer); // sotto pannelli, barra e fumetti
  const tags = new Map<string, Tag>();
  const v = new THREE.Vector3();
  const seen: { who: string; nome: string; titolo: string | null; on: boolean }[] = [];

  const posa = (who: string, nome: string, titolo: string | null, me: { x: number; z: number }) => {
    let t = tags.get(who);
    const sig = nome + '|' + (titolo ?? '');
    if (!t) { t = { el: el('div', 'mz-targa'), sig: '' }; t.el.dataset['who'] = who; layer.appendChild(t.el); tags.set(who, t); }
    if (t.sig !== sig) { t.sig = sig; t.el.replaceChildren(el('span', '', nome), ...(titolo ? [el('i', '', titolo)] : [])); }
    const a = o.world.anchorOf(who);
    if (a) t.el.classList.toggle('far', who !== 'me' && Math.hypot(a.x - me.x, a.z - me.z) >= LABEL_NEAR_M);
    let on = !!a && (who === 'me' || Math.hypot(a.x - me.x, a.z - me.z) < DIST) &&!document.querySelector(`#mzEmotes .mz-emote[data-who="${who === 'me' ? 'me' : CSS.escape(who)}"]`);
    if (a && on) {
      v.set(a.x, a.y + 0.25, a.z).project(o.camera);
      on = v.z > -1 && v.z < 1 && Math.abs(v.x) < 1.05 && Math.abs(v.y) < 1.05;
      if (on) {
        const r = o.canvas.getBoundingClientRect(), rr = o.root.getBoundingClientRect();
        const x = Math.round(r.left - rr.left + ((v.x + 1) / 2) * r.width), y = Math.round(r.top - rr.top + ((1 - v.y) / 2) * r.height);
        t.el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
      }
    }
    t.el.style.visibility = on ? 'visible' : 'hidden';
    seen.push({ who, nome, titolo, on });
  };

  registerStateProvider('targhette', () => seen.map((s) => ({ ...s })));
  return {
    update() {
      seen.length = 0;
      const w = o.world, f = w.mode === 'walk' ? w.avatar.state : w.boat.state, live = new Set<string>();
      for (const p of w.net.peers()) { live.add(p.id); posa(p.id, p.nome, titoloDi(p.titolo), f); }
      const mio = o.mio();
      if (mio?.titolo) { live.add('me'); posa('me', mio.nome, mio.titolo, f); }
      for (const [id, t] of tags) if (!live.has(id)) { t.el.remove(); tags.delete(id); }
    },
  };
}
