// Isola dei Templari nel mondo (docs/TEMPLARI.md §2): la porta della chiesa con ENTRA (A vicino), il bottone ⚔ delle prove (?templari=1:
// subito nelle ondate, da ovunque), il server che apre e chiude la partita. Bundle iniziale: piccolo, niente import statici della sim o dei
// dati delle ondate (solo `import type`): la partita vera è il chunk apps/client/src/templari/ scaricato entrando.
// Giro: ENTRA → POST /api/templari/start (seed) → import('../templari/index.ts') → startTemplari → a fine partita POST /api/templari/finish
// (input compressi, azioni) → scheda dell'esito del server → setLot → davanti alla porta. Senza link personale si gioca senza premio.
import type { InputFrame, LotState } from '@marea/sim';
import { ISLANDS } from '@marea/content';
import type { GameWorld } from './world.ts';
import type { Renderer } from '../render/scene.ts';
import type { Loader } from '../render/loader.ts';
import type { Hud } from '../ui/hud.ts';
import type { Api } from '../net/api.ts';
import { ApiError } from '../net/api.ts';
import { CHIESA } from '../render/island_templari.ts';
import { PAL, el, injectUiStyle } from '../ui/style.ts';
import { topButton } from '../ui/topbar.ts';
import { FLAGS } from '../flags.ts';
import { temaAperta } from './temi.ts';
import { registerStateProvider, registerTestHook } from '../test/testapi.ts';
import type { TemplariRun } from '../templari/types.ts';

export type Templari = {
  /** La porta della chiesa (per la bussola), null se l'isola non c'è. */
  readonly spot: { id: string; nome: string; x: number; z: number } | null;
  /** Fuori dalla partita, un tick: davanti alla porta il fronte di A entra. */
  tick(a: boolean): void;
  /** Nella partita, un tick (al posto di world.step). */
  step(f: InputFrame): void;
  update(alpha: number, dt: number, t: number): void;
  readonly active: boolean;
  /** Partita che parte o scheda dell'esito aperta: il mondo sta fermo. */
  isBusy(): boolean;
};

const NEAR_M = 4;
/** Stato condiviso col chunk (test): autopilota (tick per frame) e vista corrente per state().templari. */
export const templariLink: { autopilot: number; state: (() => Record<string, unknown>) | null } = { autopilot: FLAGS.autopilot ? 4 : 0, state: null };

export function createTemplari(o: { world: GameWorld; renderer: Renderer; loader: Loader; api: Api | null; hud: Hud; root: HTMLElement; canvas: HTMLCanvasElement; getLot(): LotState | null; setLot(l: LotState): void }): Templari {
  injectUiStyle();
  const arch = o.world.archipelago, place = arch.places.find((p) => p.island === 'templari') ?? null;
  const def = ISLANDS.find((i) => i.id === 'templari'), chiesa = def?.props?.find((p) => p.k === 'chiesa_templare');
  const spot = place && chiesa ? {
    id: 'templari', nome: 'Chiesa dei Templari',
    x: (place.origin[0] + chiesa.at[0] + 0.5) * arch.tile - CHIESA.portale - 0.8, z: (place.origin[1] + chiesa.at[1] + 0.5) * arch.tile,
  } : null;
  const aperta = () => FLAGS.templari || temaAperta('templari');

  const btn = el('button', 'mz mz-play'); btn.id = 'mzTemplariEntra'; btn.type = 'button';
  btn.style.background = PAL.rosso; btn.style.color = PAL.sabbiaChiara;
  btn.replaceChildren(el('span', '', '✠ ENTRA NELLA CHIESA'), el('small', '', 'A'));
  for (const ev of ['pointerdown', 'touchstart']) btn.addEventListener(ev, (x) => x.stopPropagation());
  btn.addEventListener('click', () => { void entra(false); });
  o.root.append(btn);
  // prove (?templari=1): subito nelle ondate, senza reliquia e senza barca
  if (FLAGS.templari) topButton({ root: o.root, id: 'mzTemplariProva', order: 9, label: '⚔', title: 'Templari: ondate subito (prova)', onClick: () => { void entra(true); } });

  let near = false, nearWas = false, aWas = false, busy = false, run: TemplariRun | null = null;
  let entrate = 0, finite = 0, lastErr: string | null = null, lastResult: unknown = null;

  async function entra(subito: boolean): Promise<void> {
    if (busy || run || o.world.race.on) return;
    busy = true; btn.classList.remove('on'); lastErr = null;
    const zoom0 = o.renderer.diorama.zoom, api = o.api && FLAGS.token ? o.api : null;
    try {
      let seed: number;
      if (api) {
        try { const st = await api.templariStart(subito); seed = st.seed; o.setLot(st.lot); } catch (e) { fail(e, 'Niente connessione, riprova tra poco'); return; }
      } else {
        seed = (Math.random() * 2 ** 31) >>> 0;
        o.hud.toast('Senza il tuo link personale si gioca senza premio', 3000);
      }
      const mod = await import('../templari/index.ts');
      run = mod.startTemplari({ world: o.world, renderer: o.renderer, loader: o.loader, hud: o.hud, root: o.root, canvas: o.canvas }, { seed, subito });
      entrate++; busy = false;
      const done = await run.done;
      run = null; busy = true;
      fuori(zoom0);
      if (!done) return;
      if (!api) { await mod.mostraEsito(o.root, { result: done.result, premio: null }); return; }
      try {
        const r = await api.templariFinish(done.inputs, done.hash, done.azioni);
        finite++; lastResult = { ...r.result, premio: r.premio, tetto: r.tetto, record: r.record, clientHash: done.hash };
        o.setLot(r.lot);
        await mod.mostraEsito(o.root, { result: r.result, premio: r.premio, tetto: r.tetto, record: r.record });
      } catch (e) { fail(e, 'Partita non salvata, riprova'); }
    } catch (e) {
      console.error('[marea] templari', e); fail(e, 'Qualcosa è andato storto nella chiesa');
      if (run) { run.abort(); run = null; }
      fuori(zoom0);
    } finally { busy = false; }
  }
  function fail(e: unknown, fallback: string): void {
    lastErr = e instanceof ApiError ? e.message : fallback;
    o.hud.toast(lastErr, 3200);
  }
  /** Di nuovo nel mondo, davanti alla porta della chiesa (se eri sull'isola). */
  function fuori(zoom: number): void {
    o.renderer.setScene(null);
    const a = o.world.avatar;
    if (spot && o.world.mode === 'walk' && Math.hypot(a.state.x - spot.x, a.state.z - spot.z) < 30) a.teleport(spot.x - 1.5, spot.z + 2);
    o.renderer.diorama.setZoom(zoom);
    o.renderer.diorama.follow(a.state.x, o.world.groundY(a.state.x, a.state.z), a.state.z);
    o.renderer.diorama.snap?.();
    nearWas = true; // niente «premi A» sopra la scheda dell'esito
  }

  registerStateProvider('templari', () => (run && templariLink.state
    ? { ...templariLink.state(), busy, entrate, finite, lastErr, lastResult }
    : { active: false, busy, entrate, finite, lastErr, lastResult, near, aperta: aperta(), spot }));
  /** Test: dentro subito (come il bottone ⚔), da ovunque. */
  registerTestHook('templariEntra', (subito) => { if (busy || run) return false; void entra(subito !== false); return true; });
  registerTestHook('templariAutopilot', (on, speed) => { templariLink.autopilot = on ? Math.max(1, Math.min(30, Math.round(Number(speed ?? 4)) || 4)) : 0; return templariLink.autopilot; });
  /** Test: a piedi davanti alla porta della chiesa. */
  registerTestHook('templariPorta', () => { if (!spot) return null; o.world.avatar.teleport(spot.x - 1.5, spot.z + 1); return spot; });

  return {
    spot,
    get active() { return !!run && run.active; },
    isBusy: () => busy || (!!run && !run.active),
    tick(a) {
      const pressA = a && !aWas; aWas = a;
      if (busy || run || !spot) { near = false; return; }
      const f = o.world.avatar.state;
      near = o.world.mode === 'walk' && !o.world.race.on && aperta() && Math.hypot(f.x - spot.x, f.z - spot.z) < NEAR_M;
      if (near && !nearWas) o.hud.toast('La chiesa dei Templari: premi A o tocca ENTRA', 2500);
      nearWas = near;
      if (near && pressA) void entra(false);
    },
    step(f) { run?.step(f); },
    update(alpha, dt, t) {
      if (run) { run.update(alpha, dt, t); return; }
      btn.classList.toggle('on', near && !busy);
    },
  };
}
