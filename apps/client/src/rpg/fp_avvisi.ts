// Prima persona: quello che dall'alto si vedeva e dagli occhi no. Bordi rossi quando si è colpiti, una striscia sul lato di chi sta per colpire da
// fuori campo, il mirino sempre (un punto con le armi, la croce con l'arco e le magie; rosso sopra un nemico). Pezzi di interfaccia a colori pieni, niente sfumature.
import { lineOfSight } from '@marea/sim/dungeon/map.ts';
import type { DMap } from '@marea/sim/dungeon/map.ts';
import type { DungeonView } from '@marea/sim/dungeon/types.ts';
import { PAL } from '../ui/style.ts';

const LONTANO = 6, BORDO = 14;
const CSS = `
.mz-fp-bordo { position: absolute; background: ${PAL.rosso}; pointer-events: none; z-index: 12; opacity: 0; }
.mz-fp-bordo.su { left: 0; right: 0; top: 0; height: ${BORDO}px; } .mz-fp-bordo.giu { left: 0; right: 0; bottom: 0; height: ${BORDO}px; }
.mz-fp-bordo.sx { left: 0; top: 0; bottom: 0; width: ${BORDO}px; } .mz-fp-bordo.dx { right: 0; top: 0; bottom: 0; width: ${BORDO}px; }
.mz-fp-mirino { position: absolute; left: 50%; top: 50%; width: 4px; height: 4px; margin: -2px 0 0 -2px; background: ${PAL.sabbiaChiara}; box-shadow: 0 0 0 1px ${PAL.neroCaldo}; pointer-events: none; z-index: 12; }
.mz-fp-mirino.croce { box-shadow: 8px 0 0 ${PAL.sabbiaChiara}, -8px 0 0 ${PAL.sabbiaChiara}, 0 8px 0 ${PAL.sabbiaChiara}, 0 -8px 0 ${PAL.sabbiaChiara}, 0 0 0 1px ${PAL.neroCaldo}; }
.mz-fp-mirino.rosso { background: ${PAL.rosso}; } .mz-fp-mirino.croce.rosso { box-shadow: 8px 0 0 ${PAL.rosso}, -8px 0 0 ${PAL.rosso}, 0 8px 0 ${PAL.rosso}, 0 -8px 0 ${PAL.rosso}, 0 0 0 1px ${PAL.neroCaldo}; }
`;

export function creaAvvisi(root: HTMLElement): { update(dt: number, v: DungeonView, yaw: number, map: DMap, mirino: { croce: boolean; rosso: boolean }): void; colpito(): void; dispose(): void } {
  if (!document.getElementById('mz-fp-avvisi')) { const st = document.createElement('style'); st.id = 'mz-fp-avvisi'; st.textContent = CSS; document.head.appendChild(st); }
  const bordo = (k: string) => { const e = document.createElement('div'); e.className = `mz-fp-bordo ${k}`; root.appendChild(e); return e; };
  const su = bordo('su'), giu = bordo('giu'), sx = bordo('sx'), dx = bordo('dx'), lati = [su, giu, sx, dx];
  const mir = document.createElement('div'); mir.className = 'mz-fp-mirino'; root.appendChild(mir);
  let lampo = 0;
  return {
    update(dt, v, yaw, map, mirino) {
      lampo = Math.max(0, lampo - dt / 0.35);
      const fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
      let sin = 0, des = 0, die = 0;
      for (const n of v.nemici) {
        if (n.alleato || n.anim !== 'prepara') continue;
        const ex = n.x - v.hero.x, ez = n.z - v.hero.z, d = Math.sqrt(ex * ex + ez * ez);
        if (d > LONTANO || d < 1e-3 || !lineOfSight(map, v.hero.x, v.hero.z, n.x, n.z)) continue;
        const av = (ex * fx + ez * fz) / d, la = (ex * rx + ez * rz) / d;
        if (av > 0.6) continue; // davanti: si vede già
        if (av < -0.5) die = 1;
        if (la < 0) sin = 1; else des = 1;
      }
      const a = (k: number) => String(Math.max(k * 0.75, lampo > 0.66 ? 0.8 : lampo > 0.33 ? 0.5 : lampo > 0 ? 0.25 : 0));
      su.style.opacity = a(0); giu.style.opacity = a(die); sx.style.opacity = a(sin); dx.style.opacity = a(des);
      mir.classList.toggle('croce', mirino.croce); mir.classList.toggle('rosso', mirino.rosso);
    },
    colpito() { lampo = 1; },
    dispose() { for (const e of lati) e.remove(); mir.remove(); },
  };
}
