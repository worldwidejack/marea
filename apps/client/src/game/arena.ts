// Isola dell'Arena nel mondo (docs/ARENA.md §5): il portone del colosseo con il cartello che si vede da lontano e ENTRA (A vicino, ≤ 4 m)
// che apre il pannello del colosseo (set del duello, coda veloce, sala con codice, allenamento): rpg/arena_menu.ts, nel chunk GDR scaricato
// alla prima entrata. Il duello prende il ciclo come un dungeon (step e update al posto del mondo); finito, si torna davanti al portone e
// il pannello si riapre. Bundle iniziale: piccolo, niente import statici della sim (solo `import type`).
// Prove: ?arena=1 mette il bottone ⚔ (vai al colosseo), ?arena=banco entra subito nell'allenamento contro l'avversario automatico, senza
// server (con ?net=0).
import * as THREE from 'three';
import type { InputFrame, LotState } from '@marea/sim';
import { ARENA } from '@marea/content/arena.ts';
import type { GameWorld } from './world.ts';
import type { Renderer } from '../render/scene.ts';
import type { Loader } from '../render/loader.ts';
import type { Hud } from '../ui/hud.ts';
import type { Api } from '../net/api.ts';
import { pixIcon } from '../ui/icons.ts';
import { PAL, el, injectUiStyle } from '../ui/style.ts';
import { createLabelLayer, LABEL_NEAR_M } from '../ui/sheet.ts';
import { topButton } from '../ui/topbar.ts';
import { FLAGS } from '../flags.ts';
import { registerStateProvider, registerTestHook } from '../test/testapi.ts';
import type { Colosseo } from '../rpg/arena_menu.ts';

export type ArenaIsola = {
  /** Il portone del colosseo (bussola), null se l'isola non c'è. */
  readonly spot: { id: string; nome: string; x: number; z: number } | null;
  tick(a: boolean): void;
  step(f: InputFrame): void;
  update(alpha: number, dt: number, t: number): void;
  /** Duello in corso: il mondo sta fermo e la sua interfaccia sparisce. */
  readonly active: boolean;
  /** Pannello del colosseo aperto o in caricamento. */
  isBusy(): boolean;
};

const NEAR_M = 4;

export function createArena(o: { world: GameWorld; renderer: Renderer; loader: Loader; api: Api | null; hud: Hud; root: HTMLElement; canvas: HTMLCanvasElement; getLot(): LotState | null; setLot(l: LotState): void; nome(): string }): ArenaIsola {
  injectUiStyle();
  const arch = o.world.archipelago, place = arch.places.find((p) => p.island === ARENA.isola.island) ?? null;
  const [ix, iz] = ARENA.isola.ingresso;
  const spot = place ? { id: 'arena', nome: 'Colosseo dell’Arena', x: (place.origin[0] + ix + 0.5) * arch.tile, z: (place.origin[1] + iz + 0.5) * arch.tile } : null;
  let col: Colosseo | null = null, carica: Promise<Colosseo | null> | null = null, near = false, nearWas = false, aWas = false, zoom0 = 1, entrate = 0;

  // ---- cartello sopra il portone e bottone ENTRA ----
  const layer = createLabelLayer(o.root);
  const label = spot ? layer.add(() => { void entra(); }) : null;
  label?.set('bubble', [pixIcon('arena', 16), el('span', '', 'Colosseo dell’Arena')], 'dng');
  label?.el.classList.add('dng');
  const btn = el('button', 'mz mz-play'); btn.id = 'mzArenaEntra'; btn.type = 'button';
  btn.style.background = PAL.giallo; btn.style.color = PAL.ombraCalda;
  btn.replaceChildren(pixIcon('arena', 24), el('span', '', 'ENTRA NEL COLOSSEO'), el('small', '', 'A'));
  for (const ev of ['pointerdown', 'touchstart']) btn.addEventListener(ev, (x) => x.stopPropagation());
  btn.addEventListener('click', () => { void entra(); });
  o.root.append(btn);

  /** Il chunk del colosseo (pannello e duello), una volta sola. */
  const colosseo = (): Promise<Colosseo | null> => (carica ??= import('../rpg/index.ts').then((m) => {
    col = m.createColosseo({
      world: o.world, renderer: o.renderer, loader: o.loader, hud: o.hud, root: o.root, canvas: o.canvas,
      api: o.api, getLot: o.getLot, setLot: o.setLot, nome: o.nome, look: () => o.world.look, tornaAllIngresso,
    });
    return col;
  }).catch((e: unknown) => { console.error('[marea] colosseo', e); o.hud.toast('Il colosseo non si apre: niente connessione, riprova', 3000); carica = null; return null; }));
  async function entra(): Promise<void> {
    if (col?.aperto || col?.active) return;
    zoom0 = o.renderer.diorama.zoom;
    const c = await colosseo();
    if (!c) return;
    entrate++;
    c.apri();
  }
  /** Dopo il duello: di nuovo nel mondo, davanti al portone. */
  function tornaAllIngresso(): void {
    o.renderer.setScene(null);
    const a = o.world.avatar;
    if (spot && o.world.mode === 'walk') a.teleport(spot.x, spot.z + 2);
    o.renderer.diorama.setZoom(zoom0);
    o.renderer.diorama.follow(a.state.x, o.world.groundY(a.state.x, a.state.z), a.state.z);
    o.renderer.diorama.snap?.();
    nearWas = true;
  }
  const vai = () => { const p = o.world.vai(ARENA.isola.island); if (p && spot) o.world.avatar.teleport(spot.x, spot.z + 2); return !!p; };
  if (FLAGS.arena === 'si') topButton({ root: o.root, id: 'mzArenaVai', order: 9, label: '⚔', title: 'Arena: vai al colosseo (prova)', onClick: () => { vai(); } });
  // stanza di prova: subito nell'allenamento contro l'avversario automatico (il mondo c'è già: si parte dal portone)
  let banco = FLAGS.arena === 'banco';

  registerStateProvider('arena', () => ({ spot, near, entrate, aperto: !!col?.aperto, attivo: !!col?.active, caricato: !!col }));
  registerTestHook('arenaVai', () => vai());
  registerTestHook('arenaEntra', () => { void entra(); return true; });

  const v = new THREE.Vector3();
  return {
    spot,
    get active() { return !!col?.active; },
    isBusy: () => !!col?.aperto || (!!carica && !col),
    tick(a) {
      const pressA = a && !aWas; aWas = a;
      if (banco) { banco = false; vai(); void colosseo().then((c) => c?.allenamento()); return; }
      if (!spot || col?.active || col?.aperto) { near = false; return; }
      const f = o.world.avatar.state;
      near = o.world.mode === 'walk' && !o.world.race.on && Math.hypot(f.x - spot.x, f.z - spot.z) < NEAR_M;
      if (near && !nearWas) o.hud.toast('Il Colosseo dell’Arena: premi A o tocca ENTRA', 2500);
      nearWas = near;
      if (near && pressA) void entra();
    },
    step(f) { col?.step(f); },
    update(alpha, dt, t) {
      if (col?.active) { btn.classList.remove('on'); col.update(alpha, dt, t); return; }
      btn.classList.toggle('on', near && !col?.aperto);
      if (spot && label) {
        const y = o.world.groundY(spot.x, spot.z) + 9.5;
        v.set(spot.x, y, spot.z - 4).project(o.renderer.camera);
        const r = o.canvas.getBoundingClientRect(), rr = o.root.getBoundingClientRect();
        const f = o.world.mode === 'walk' ? o.world.avatar.state : o.world.boat.state;
        label.place(r.left - rr.left + ((v.x + 1) / 2) * r.width, r.top - rr.top + ((1 - v.y) / 2) * r.height, v.z < 1 && Math.abs(v.x) < 1.05 && Math.abs(v.y) < 1.05 && !o.world.race.on && !col?.aperto, Math.hypot(f.x - spot.x, f.z - spot.z) < LABEL_NEAR_M);
      }
    },
  };
}
