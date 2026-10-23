// «La tua barca»: cartellino sopra la tua barca ormeggiata, solo per te e solo a piedi. Al molo del Porto stanno ormeggiate le barche di
// tutti gli amici, tutte simili: senza segno uno nuovo va alla prima che vede e il «Sali» non arriva mai (canBoard guarda solo la tua).
// Quando sei abbastanza vicino per salire il cartellino dice il tasto, che sul PC il bottone A a schermo non lo spiega.
// DOM proiettato ogni frame come le targhette; lontano (> DIST m), fuori schermo, in gara o sotto terra sparisce.
import * as THREE from 'three';
import type { Camera } from 'three';
import { canBoard } from '@marea/sim';
import type { GameWorld } from './world.ts';
import { el } from '../ui/style.ts';
import { ALLEGRO as A, FONT_ALLEGRO } from '../ui/stile_allegro.ts';
import { registerStateProvider } from '../test/testapi.ts';

export type MiaBarca = { update(t: number): void };
// DIST m: oltre non si mostra; SOPRA_Y m: la punta tocca lo scafo (più in alto, vista dall'alto, cadrebbe su un'altra barca); MARGINE px dal bordo
const DIST = 45, SOPRA_Y = 1.2, MARGINE = 8;
const STYLE = `
#mzMiaBarca { position: absolute; left: 0; top: 0; z-index: 5; pointer-events: none; visibility: hidden; will-change: transform; }
#ui.mz-racing #mzMiaBarca, body.mz-sotto #mzMiaBarca { display: none; }
#mzMiaBarca .t { position: relative; display: block; padding: 4px 12px 5px; border-radius: 999px; background: ${A.oro}; color: ${A.notte}; border: 2px solid ${A.bianco};
  box-shadow: 0 0 0 2px ${A.notte}, 0 4px 0 2px ${A.notte}; font: 15px/1.1 ${FONT_ALLEGRO}; white-space: nowrap; }
#mzMiaBarca .t::after { content: ''; position: absolute; left: 50%; bottom: -7px; width: 10px; height: 10px; background: ${A.oro};
  border-right: 2px solid ${A.bianco}; border-bottom: 2px solid ${A.bianco}; box-shadow: 2px 2px 0 0 ${A.notte}; transform: translateX(calc(-50% + var(--coda, 0px))) rotate(45deg); }
#mzMiaBarca.sali .t { background: ${A.bianco}; } #mzMiaBarca.sali .t::after { background: ${A.bianco}; border-color: ${A.oro}; }
@media (min-width: 700px) { #mzMiaBarca .t { font-size: 17px; padding: 5px 14px 6px; } }
`;

export function createMiaBarca(o: { world: GameWorld; camera: Camera; canvas: HTMLCanvasElement; root: HTMLElement }): MiaBarca {
  if (!document.getElementById('mz-miabarca-style')) { const st = document.createElement('style'); st.id = 'mz-miabarca-style'; st.textContent = STYLE; document.head.appendChild(st); }
  const box = el('div'); box.id = 'mzMiaBarca';
  const testo = el('span', 't'); box.appendChild(testo); o.root.prepend(box); // sotto pannelli, barra e fumetti
  const touch = matchMedia('(pointer: coarse)').matches;
  const v = new THREE.Vector3();
  let scritta = '', on = false, mezzo = 0;
  const visibile = (ob: THREE.Object3D | null): boolean => { for (; ob; ob = ob.parent) if (!ob.visible) return false; return true; };

  registerStateProvider('miaBarca', () => ({ on, scritta }));
  return {
    update(t) {
      const w = o.world, b = w.boat.object.position, a = w.avatar.state;
      on = w.mode === 'walk' && !w.race.on && !w.frozen && visibile(w.boat.object) && Math.hypot(b.x - a.x, b.z - a.z) < DIST;
      if (on) {
        v.set(b.x, b.y + SOPRA_Y, b.z).project(o.camera);
        on = v.z > -1 && v.z < 1 && Math.abs(v.x) < 1.05 && Math.abs(v.y) < 1.05;
      }
      box.style.visibility = on ? 'visible' : 'hidden';
      if (!on) return;
      const sali = canBoard(a, w.boat.state, w.map), s = sali ? (touch ? 'Tocca A per salire' : 'Premi E per salire') : 'La tua barca';
      if (s !== scritta) { scritta = s; testo.textContent = s; box.classList.toggle('sali', sali); mezzo = box.offsetWidth / 2; }
      const r = o.canvas.getBoundingClientRect(), rr = o.root.getBoundingClientRect();
      const x = r.left - rr.left + ((v.x + 1) / 2) * r.width, y = Math.round(r.top - rr.top + ((1 - v.y) / 2) * r.height - Math.abs(Math.sin(t * 3)) * 6);
      // sul bordo dello schermo il cartellino resta dentro e la punta si sposta verso la barca
      const cx = Math.min(Math.max(x, mezzo + MARGINE), rr.width - mezzo - MARGINE), coda = Math.max(-mezzo + 14, Math.min(mezzo - 14, x - cx));
      box.style.setProperty('--coda', `${Math.round(coda)}px`);
      box.style.transform = `translate(${Math.round(cx - mezzo)}px, ${y}px) translateY(-100%)`;
    },
  };
}
