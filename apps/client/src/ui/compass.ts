// Bussola dell'HUD (WP0): in mare aperto la camera diorama non mostra nessuna isola per decine di secondi, quindi
// una freccia per meta (Casa, Porto, Laguna) ruotata nello spazio dello schermo, con la distanza. Sparisce quando sei vicino.
export type CompassTarget = { id: string; label: string; x: number; z: number };
export type Compass = { update(me: { x: number; z: number }, cameraYaw: number): void; dispose(): void };

const NEAR_M = 45; // entro questa distanza la meta si vede già: niente freccia

export function createCompass(o: { root: HTMLElement; targets: CompassTarget[] }): Compass {
  const box = document.createElement('div');
  box.id = 'compass';
  box.style.cssText = 'position:absolute;right:8px;top:calc(max(6px, env(safe-area-inset-top)) + 56px);display:flex;flex-direction:column;gap:4px;pointer-events:none;';
  const rows = o.targets.map((t) => {
    const row = document.createElement('div');
    row.style.cssText = 'display:none;align-items:center;gap:6px;background:rgba(46,30,20,.85);border:2px solid #C98A4B;padding:3px 6px;color:#F4E3C1;font:bold 12px ui-monospace,monospace;';
    const arrow = document.createElement('span');
    arrow.textContent = '▲';
    arrow.style.cssText = 'display:inline-block;color:#F2A33A;font-size:14px;line-height:14px;';
    const text = document.createElement('span');
    row.append(arrow, text); box.appendChild(row);
    return { t, row, arrow, text, shown: false };
  });
  o.root.appendChild(box);
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
        r.text.textContent = `${r.t.label} ${Math.round(d)} m`;
      }
    },
    dispose() { box.remove(); },
  };
}
