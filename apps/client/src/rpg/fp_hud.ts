// Prima persona: l'interfaccia alla Skyrim (docs/PRIMA_PERSONA.md). In alto al centro la barra del nemico che hai sotto il mirino o che hai
// appena colpito (il capo col suo nome e la corona). Le tre barre scendono in basso al centro (Magicka, Vita, Stamina), senza le barre sopra
// le teste dei nemici. L'occhio accanto al mirino: chiuso = nessuno ti ha visto (l'attacco furtivo fa il doppio). Vita bassa: bordi rossi
// che pulsano e il cuore che batte. Mano ferma: lo schermo si tinge mentre il mondo rallenta. Colori di palette, niente sfumature.
// La mappa con la nebbia sta in fp_mappa.ts.
import { ENEMIES } from '@marea/content/rpg.ts';
import { lineOfSight } from '@marea/sim/dungeon/map.ts';
import type { DMap } from '@marea/sim/dungeon/map.ts';
import type { DungeonView } from '@marea/sim/dungeon/types.ts';
import { suona } from '../audio/ponte.ts';
import { registerStateProvider } from '../test/testapi.ts';
import { FONT_LIBRO, LIBRO as L } from '../ui/libro_colori.ts';
import { PAL } from '../ui/style.ts';

const NOMI = new Map(ENEMIES.map((d) => [d.id, d.nome]));
/** Il bersaglio sotto il mirino (coseno, m); quanto resta quello colpito (s). */
const COS_MIRINO = Math.cos((7 * Math.PI) / 180), MIRINO_M = 30, RESTA = 3.5;
/** Vita bassa (frazione) e molto bassa: il cuore batte più forte e più in fretta. */
const BASSA = 0.3, BASSISSIMA = 0.15;
const ATTIVI = new Set(['insegue', 'prepara', 'colpisce', 'recupera', 'scappa', 'colpito']);
const CSS = `
.mz-fp-on .mz-dng-hud { left: 50%; right: auto; top: auto; bottom: calc(env(safe-area-inset-bottom, 0px) + 8px); transform: translateX(-50%); width: min(600px, 62vw); display: grid;
  grid-template-columns: 1fr 1.3fr 1fr; column-gap: 14px; background: transparent; border: 0; box-shadow: none; padding: 0; }
.mz-fp-on .mz-dng-hud .r { margin: 0 !important; color: ${L.cartaChiara}; text-shadow: 1px 1px 0 ${L.inchiostro}, -1px 1px 0 ${L.inchiostro}; }
.mz-fp-on .mz-dng-hud .r:nth-child(1) { order: 2; } .mz-fp-on .mz-dng-hud .r:nth-child(2) { order: 1; } .mz-fp-on .mz-dng-hud .r:nth-child(3) { order: 3; }
.mz-fp-on .mz-dng-hud .row2 { order: 4; grid-column: 1 / -1; justify-content: center; margin-top: 4px; color: ${L.cartaChiara}; text-shadow: 1px 1px 0 ${L.inchiostro}; }
.mz-fp-on .mz-dng-hud .n { min-width: 0; font-size: 11px; }
.mz-fp-ber { position: absolute; left: 50%; top: max(8px, env(safe-area-inset-top)); transform: translateX(-50%); display: none; z-index: 13; pointer-events: none; text-align: center;
  font: 700 14px ${FONT_LIBRO}; color: ${L.cartaChiara}; text-shadow: 1px 1px 0 ${L.inchiostro}, -1px 1px 0 ${L.inchiostro}; }
.mz-fp-ber.on { display: block; } .mz-fp-ber.capo b { color: ${PAL.giallo}; font-size: 16px; }
.mz-fp-ber i { display: block; width: 220px; height: 9px; margin: 3px auto 0; background: ${L.inchiostro}; border: 2px solid ${L.inchiostro}; }
.mz-fp-ber.capo i { width: min(420px, 50vw); height: 11px; border-color: ${L.oro}; }
.mz-fp-ber i u { display: block; height: 100%; background: ${L.rosso}; }
.mz-fp-occhio { position: absolute; left: 50%; top: calc(50% + 14px); width: 22px; height: 10px; margin-left: -11px; z-index: 12; pointer-events: none; display: none; }
.mz-fp-occhio.on { display: block; }
.mz-fp-occhio::before { content: ''; position: absolute; left: 1px; right: 1px; top: 4px; height: 2px; background: ${L.cartaChiara}; box-shadow: 0 0 0 1px ${L.inchiostro}; }
.mz-fp-occhio.visto::before { top: 0; height: 10px; background: ${L.rosso}; border-radius: 50%; }
.mz-fp-occhio.visto::after { content: ''; position: absolute; left: 8px; top: 2px; width: 6px; height: 6px; background: ${L.inchiostro}; }
.mz-fp-cuore { position: absolute; inset: 0; pointer-events: none; z-index: 11; display: none; box-shadow: inset 0 0 0 18px ${PAL.rosso}; opacity: .3; }
.mz-fp-cuore.on { display: block; } .mz-fp-cuore.battito { opacity: .55; box-shadow: inset 0 0 0 26px ${PAL.rosso}; }
.mz-fp-lento { position: absolute; inset: 0; pointer-events: none; z-index: 10; display: none; background: ${L.acquaScura}; opacity: .16; box-shadow: inset 0 0 0 10px ${L.acquaChiara}; }
.mz-fp-lento.on { display: block; }
`;

export type HudFp = {
  update(v: DungeonView, t: number, yaw: number, cam: { x: number; z: number }): void;
  /** Un colpo dato a questo nemico: la sua barra resta per un po'. */
  colpito(id: number): void;
  /** L'id del nemico sotto il mirino (per il mirino rosso), -1 = nessuno. */
  readonly mirato: number;
  dispose(): void;
};

export function creaHudFp(o: { root: HTMLElement; map: DMap }): HudFp {
  if (!document.getElementById('mz-fp-hud')) { const st = document.createElement('style'); st.id = 'mz-fp-hud'; st.textContent = CSS; document.head.appendChild(st); }
  o.root.classList.add('mz-fp-on');
  const mk = (cls: string) => { const e = document.createElement('div'); e.className = cls; o.root.appendChild(e); return e; };
  const ber = mk('mz-fp-ber'), occhio = mk('mz-fp-occhio'), cuore = mk('mz-fp-cuore'), lento = mk('mz-fp-lento');
  const nome = document.createElement('b'), barra = document.createElement('i'), riemp = document.createElement('u'); barra.appendChild(riemp); ber.append(nome, barra);
  let ultimo = -1, ultimoT = -99, nuovo = false, mirato = -1, battito = 0, eraLento = false;
  const togliStato = registerStateProvider('hudFp', () => ({ mirato, bersaglio: ber.classList.contains('on') ? nome.textContent : null, nascosto: occhio.classList.contains('on') && !occhio.classList.contains('visto') }));

  return {
    get mirato() { return mirato; },
    update(v, t, yaw, cam) {
      const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
      if (nuovo) { ultimoT = t; nuovo = false; }
      // il nemico sotto il mirino (o l'ultimo colpito, o il capo che ti ha visto)
      let best = -1, bc = COS_MIRINO;
      for (const e of v.nemici) {
        if (e.alleato || e.anim === 'morto' || e.invisibile) continue;
        const dx = e.x - cam.x, dz = e.z - cam.z, d = Math.hypot(dx, dz);
        if (d > MIRINO_M || d < 0.2) continue;
        const c = (dx * fx + dz * fz) / d + Math.min(0.03, 0.4 / d); // da vicino il corpo copre più mirino
        if (c > bc && lineOfSight(o.map, cam.x, cam.z, e.x, e.z)) { bc = c; best = e.id; }
      }
      mirato = best;
      const capo = v.nemici.find((e) => e.capo && e.anim !== 'morto' && ATTIVI.has(e.anim) && Math.hypot(e.x - cam.x, e.z - cam.z) < 30);
      const id = capo ? capo.id : best >= 0 ? best : t - ultimoT < RESTA ? ultimo : -1, b = v.nemici.find((e) => e.id === id && e.anim !== 'morto');
      ber.classList.toggle('on', !!b); ber.classList.toggle('capo', !!b?.capo || !!b?.boss);
      if (b) { const nm = NOMI.get(b.tipo) ?? b.tipo; if (nome.textContent !== nm) nome.textContent = nm; riemp.style.width = `${Math.round((100 * Math.max(0, b.vita)) / Math.max(1, b.max))}%`; }
      // l'occhio: nascosto (nessuno ti ha visto e qualcuno è vicino) o visto (qualcuno ti sta addosso)
      let vicini = 0, svegli = 0;
      for (const e of v.nemici) {
        if (e.alleato || e.anim === 'morto' || Math.hypot(e.x - cam.x, e.z - cam.z) > 16) continue;
        vicini++; if (ATTIVI.has(e.anim)) svegli++;
      }
      occhio.classList.toggle('on', vicini > 0); occhio.classList.toggle('visto', svegli > 0);
      // vita bassa: il cuore batte
      const f = v.hero.vita / Math.max(1, v.hero.max.vita), basso = f < BASSA && v.hero.vita > 0;
      cuore.classList.toggle('on', basso);
      if (basso && t >= battito) { battito = t + (f < BASSISSIMA ? 0.55 : 0.85); suona('cuore', f < BASSISSIMA ? 1 : 0); cuore.classList.add('battito'); }
      if (basso && t > battito - (f < BASSISSIMA ? 0.42 : 0.65)) cuore.classList.remove('battito');
      // Mano ferma: il mondo rallenta
      const ora = !!v.hero.rallenty;
      lento.classList.toggle('on', ora);
      if (ora && !eraLento) suona('rallenty');
      eraLento = ora;
    },
    colpito(id) { ultimo = id; nuovo = true; },
    dispose() { togliStato(); o.root.classList.remove('mz-fp-on'); for (const e of [ber, occhio, cuore, lento]) e.remove(); },
  };
}
