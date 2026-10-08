// Pesca (#66): il «posto mobile» del primo minigioco universale. Non sta su un'isola: si pesca ovunque in mare aperto, dalla barca
// ferma su acqua profonda lontano dalla riva (regola pura in @marea/sim `pescaQui`). Lì compare il bottone PESCA (e vale il tasto P;
// la A resta l'acceleratore della barca). Il mare (Porto, Laguna, mare aperto…) viene dall'isola più vicina e decide i pesci.
// La schermata del gioco è ui/pesca.ts, scaricata alla prima partita (registraSchermo in game/minigiochi.ts).
import { MINIGAMES_CFG } from '@marea/content';
import { cercaPesca, pescaQui } from '@marea/sim';
import type { PescaQui } from '@marea/sim';
import type { GameWorld } from './world.ts';
import type { Hud } from '../ui/hud.ts';
import type { Spot } from './minigiochi.ts';
import { el } from '../ui/style.ts';
import { pixIcon } from '../ui/icons.ts';
import { registerStateProvider, registerTestHook } from '../test/testapi.ts';

const CFG = MINIGAMES_CFG.pesca;
/** Ogni quanti tick si ricontrolla il posto (la regola guarda le celle attorno alla barca). */
const OGNI = 6;
const AVVISO_MS = 20_000;

export type PostoPesca = { tick(): void; update(): void; readonly ok: boolean };

export function createPostoPesca(o: { world: GameWorld; root: HTMLElement; hud: Hud; libero(): boolean; gioca(s: Spot): void }): PostoPesca {
  const arch = o.world.archipelago;
  let q: PescaQui = { ok: false, mare: CFG.mareDiSerie, perche: 'terra' }, n = 0, ok = false, okWas = false, avvisoAt = -AVVISO_MS;
  const btn = el('button', 'mz mz-play'); btn.id = 'mzPesca'; btn.type = 'button';
  for (const ev of ['pointerdown', 'touchstart']) btn.addEventListener(ev, (x) => x.stopPropagation());
  o.root.appendChild(btn);
  let label = '';

  const controlla = () => {
    const b = o.world.boat.state;
    q = pescaQui(arch, b.x, b.z, b.speed);
    ok = o.world.mode === 'boat' && !o.world.race.on && q.ok && o.libero();
  };
  const spot = (): Spot => {
    const b = o.world.boat.state;
    return { id: 'pesca', nome: CFG.nome, minigame: 'pesca', x: b.x, z: b.z, icon: 'pesca', near: 0, boa: false, opzioni: { mare: q.mare } };
  };
  /** Bottone o tasto P: parte se si può, altrimenti dice perché no. */
  const prova = (): boolean => {
    controlla();
    if (ok) { o.gioca(spot()); return true; }
    if (!o.libero() || o.world.race.on) return false;
    o.hud.toast(o.world.mode !== 'boat' ? 'Si pesca dalla barca, in mare aperto'
      : q.perche === 'veloce' ? 'Ferma la barca per pescare'
      : 'Troppo vicino alla riva: allontanati in mare aperto', 2200);
    return false;
  };
  btn.addEventListener('click', () => { prova(); });
  addEventListener('keydown', (e) => {
    if (e.code !== 'KeyP' || e.repeat || e.altKey || e.ctrlKey || e.metaKey) return;
    prova();
  });

  registerStateProvider('pescaPosto', () => ({ ok, mare: q.mare, perche: q.perche, bottone: btn.classList.contains('on') }));
  registerTestHook('pesca', () => prova());
  /** Test: porta la barca (serve essere già in barca: setMode('boat')) nel punto da pesca più vicino del mare dato. */
  registerTestHook('pescaVai', (mare) => {
    const b = o.world.boat.state, p = cercaPesca(arch, String(mare ?? CFG.mareDiSerie), b.x, b.z);
    if (!p) return null;
    o.world.boat.teleport(p.x, p.z); o.world.avatar.teleport(p.x, p.z);
    controlla();
    return p;
  });

  return {
    get ok() { return ok; },
    tick() {
      if (++n % OGNI === 0 || ok) controlla();
      if (ok && !okWas && performance.now() - avvisoAt > AVVISO_MS) { avvisoAt = performance.now(); o.hud.toast(`${CFG.mari[q.mare]?.nome ?? 'Mare aperto'}: qui si pesca · ${matchMedia('(pointer: coarse)').matches ? 'tocca PESCA' : 'P'}`, 2500); }
      okWas = ok;
    },
    update() {
      const show = ok && o.libero();
      const want = `${q.mare}`;
      if (show && label !== want) {
        label = want;
        btn.replaceChildren(pixIcon('pesca', 24), el('span', '', `PESCA · ${(CFG.mari[q.mare]?.nome ?? '').toUpperCase()}`), el('small', '', 'P'));
      }
      btn.classList.toggle('on', show);
    },
  };
}
