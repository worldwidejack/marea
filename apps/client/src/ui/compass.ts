// Bussola dell'HUD: una riga per luogo (Casa, Porto, Regata…) con icona, freccia e distanza. La freccia ha l'asta (un triangolo quasi
// equilatero non dice da che parte punta) e gira nello spazio dello schermo. Sparisce quando il luogo è vicino (si vede già).
// `focus(id)` evidenzia la meta della guida «Primi passi».
import { pixIcon } from './icons.ts';
import type { PixId } from './icons.ts';
import { PAL } from './style.ts';

export type CompassTarget = { id: string; label: string; x: number; z: number; icon?: PixId };
export type Compass = { update(me: { x: number; z: number }, cameraYaw: number): void; focus(id: string | null): void; dispose(): void };

const NEAR_M = 30; // entro questa distanza la meta si vede già: niente freccia
/** Freccia a pixel con asta, punta in su a 0 rad (stesso disegno dell'HUD di gara). */
export const ARROW_SVG = '<svg viewBox="0 0 14 18" width="16" height="20" shape-rendering="crispEdges" style="display:block"><path d="M7 0L14 8H9.5V18H4.5V8H0Z" fill="currentColor" stroke="#23201F" stroke-width="1"/></svg>';

// sul telefono la bussola scende sotto chip del cantiere e toast, e perde il nome del luogo (resta l'icona)
const CSS = `
#compass { position: absolute; right: 8px; top: calc(max(6px, env(safe-area-inset-top)) + 56px); display: flex; flex-direction: column; align-items: flex-end; gap: 4px; pointer-events: none; z-index: 13; }
@media (max-width: 699px) { #compass { top: calc(max(6px, env(safe-area-inset-top)) + 168px); } #compass .nome { display: none; } }
`;

export function createCompass(o: { root: HTMLElement; targets: CompassTarget[] }): Compass {
  if (!document.getElementById('mz-compass-style')) { const st = document.createElement('style'); st.id = 'mz-compass-style'; st.textContent = CSS; document.head.appendChild(st); }
  const box = document.createElement('div');
  box.id = 'compass';
  const rows = o.targets.map((t) => {
    const row = document.createElement('div');
    row.dataset['id'] = t.id;
    row.style.cssText = `display:none;align-items:center;gap:6px;min-height:32px;background:rgba(46,30,20,.88);border:2px solid ${PAL.legnoChiaro};box-shadow:0 3px 0 ${PAL.neroCaldo};padding:2px 8px 2px 6px;color:${PAL.sabbiaChiara};font:bold 13px ui-monospace,monospace;`;
    const arrow = document.createElement('span');
    arrow.innerHTML = ARROW_SVG; // SVG statico
    arrow.style.cssText = `display:inline-block;color:${PAL.giallo};width:16px;height:20px;`;
    const nome = document.createElement('span'); nome.className = 'nome'; nome.textContent = t.label;
    const text = document.createElement('span');
    row.append(...(t.icon ? [pixIcon(t.icon, 16)] : []), nome, text, arrow);
    box.appendChild(row);
    return { t, row, arrow, text, shown: false };
  });
  o.root.appendChild(box);
  let focused: string | null = null;
  return {
    update(me, yaw) {
      // stessa convenzione di input.ts: su schermo «su» = (−sin yaw, −cos yaw), «destra» = (cos yaw, −sin yaw) in assi mondo
      const fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
      for (const r of rows) {
        const dx = r.t.x - me.x, dz = r.t.z - me.z, d = Math.hypot(dx, dz);
        const show = d > NEAR_M;
        if (show !== r.shown) { r.row.style.display = show ? 'flex' : 'none'; r.shown = show; }
        if (!show) continue;
        const ang = Math.atan2(dx * rx + dz * rz, dx * fx + dz * fz);
        r.arrow.style.transform = `rotate(${ang.toFixed(3)}rad)`;
        r.text.textContent = `${Math.round(d)} m`;
      }
    },
    focus(id) {
      if (id === focused) return;
      focused = id;
      for (const r of rows) r.row.style.borderColor = r.t.id === id ? PAL.giallo : PAL.legnoChiaro;
    },
    dispose() { box.remove(); },
  };
}
