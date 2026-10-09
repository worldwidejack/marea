// Isola dei Templari nel mondo (docs/TEMPLARI.md §2): la porta della chiesa con ENTRA (A vicino), il bottone ⚔ delle prove (?templari=1:
// subito nelle ondate, da ovunque), il server che apre e chiude la partita. Bundle iniziale: piccolo, niente import statici della sim o dei
// dati delle ondate (solo `import type`): la partita vera è il chunk apps/client/src/templari/ scaricato entrando.
// Giro: ENTRA → POST /api/templari/start (seed) → import('../templari/index.ts') → startTemplari → a fine partita POST /api/templari/finish
// (input compressi, azioni) → scheda dell'esito del server → setLot → davanti alla porta. Senza link personale si gioca senza premio.
// Lo sblocco (§2): sull'Isola della Tempesta, sotto il faro, lo scheletro di fra' Guillaume col calice in grembo (luccica, un fascio di luce
// lo segnala da lontano): A vicino lo prende (POST /api/templari/reliquia → nel lotto, la nebbia rossa si dirada) e si legge il biglietto,
// che si può rileggere dopo. Senza link personale il calice resta finché non ricarichi.
import * as THREE from 'three';
import type { InputFrame, LotState } from '@marea/sim';
import { ISLANDS } from '@marea/content';
import type { GameWorld } from './world.ts';
import type { Renderer } from '../render/scene.ts';
import type { Loader } from '../render/loader.ts';
import type { Hud } from '../ui/hud.ts';
import type { Api } from '../net/api.ts';
import { ApiError } from '../net/api.ts';
import { CHIESA } from '../render/island_templari.ts';
import { M, merged, painted } from '../render/island_parts.ts';
import { suona } from '../audio/ponte.ts';
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
  /** Lo scheletro col calice sotto il faro della Tempesta (per la bussola), null se l'isola non c'è. */
  readonly relitto: { x: number; z: number } | null;
  /** Il calice è tuo (la nebbia rossa si è diradata). */
  calice(): boolean;
};

/** Il biglietto di fra' Guillaume (docs/TEMPLARI.md §1-2): la fuga da La Rochelle, la rotta verso l'isola, l'avvertimento. */
export const BIGLIETTO = [
  'Anno del Signore 1307, d’ottobre.',
  'La notte di venerdì tredici il re di Francia ci ha fatti prendere tutti. Noi di La Rochelle siamo salpati prima dell’alba: diciotto navi, e nelle stive il tesoro del Tempio.',
  'La tempesta ci ha spaccati su questi scogli, sotto il faro. Io solo sono vivo, e non per molto.',
  'Le altre navi tenevano la rotta di libeccio, verso l’isola tra la montagna di fuoco e il giardino: là i fratelli alzeranno Santa Maria del Tempio e aspetteranno il Gran Maestro.',
  'Porta loro il calice. Posalo sull’altare.',
  'Ma se senti gridare «Deus vult» sotto la terra, scappa.',
  '— fra’ Guillaume, sergente del Tempio',
];
const CSS_BIGLIETTO = `
#mzBiglietto { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); width: min(440px, calc(100% - 32px)); max-height: calc(100% - 120px); overflow-y: auto; box-sizing: border-box; padding: 16px 16px 12px; z-index: 31; display: none;
  background: ${PAL.sabbiaChiara}; color: ${PAL.ombraCalda}; border: 3px solid ${PAL.legnoChiaro}; box-shadow: 0 4px 0 ${PAL.neroCaldo}, inset 0 0 0 2px ${PAL.sabbia}; font-size: 14px; line-height: 1.45; }
#mzBiglietto.on { display: block; }
#mzBiglietto b { display: block; margin-bottom: 8px; font-size: 13px; letter-spacing: .1em; color: ${PAL.rosso}; text-align: center; }
#mzBiglietto p { margin: 0 0 8px; }
#mzBiglietto p.firma { text-align: right; font-style: italic; }
#mzBiglietto button { display: block; margin: 10px auto 0; min-width: 120px; min-height: 44px; background: ${PAL.legnoScuro}; color: ${PAL.sabbiaChiara}; border: 2px solid ${PAL.legnoChiaro}; font: bold 15px ui-monospace, Menlo, monospace; cursor: pointer; }
`;

const NEAR_M = 4;
/** Stato condiviso col chunk (test): autopilota (tick per frame) e vista corrente per state().templari. */
/** `prova`: solo test, mette nella partita un'arma, lo scudo, punti o uno zombie davanti (la partita così non si rigioca uguale: solo senza server). */
export const templariLink: { autopilot: number; state: (() => Record<string, unknown>) | null; prova: ((o: Record<string, unknown>) => unknown) | null } = { autopilot: FLAGS.autopilot ? 4 : 0, state: null, prova: null };

export function createTemplari(o: { world: GameWorld; renderer: Renderer; loader: Loader; api: Api | null; hud: Hud; root: HTMLElement; canvas: HTMLCanvasElement; getLot(): LotState | null; setLot(l: LotState): void }): Templari {
  injectUiStyle();
  const arch = o.world.archipelago, place = arch.places.find((p) => p.island === 'templari') ?? null;
  const def = ISLANDS.find((i) => i.id === 'templari'), chiesa = def?.props?.find((p) => p.k === 'chiesa_templare');
  const spot = place && chiesa ? {
    id: 'templari', nome: 'Chiesa dei Templari',
    x: (place.origin[0] + chiesa.at[0] + 0.5) * arch.tile - CHIESA.portale - 0.8, z: (place.origin[1] + chiesa.at[1] + 0.5) * arch.tile,
  } : null;
  const aperta = () => FLAGS.templari || temaAperta('templari');

  // ---- lo scheletro e il calice sotto il faro della Tempesta ----
  const tPlace = arch.places.find((p) => p.island === 'tempesta') ?? null;
  const osso = ISLANDS.find((i) => i.id === 'tempesta')?.props?.find((p) => p.k === 'scheletro');
  const relitto = tPlace && osso ? { x: (tPlace.origin[0] + osso.at[0] + 0.5) * arch.tile, z: (tPlace.origin[1] + osso.at[1] + 0.5) * arch.tile } : null;
  let caliceQui = false; // senza link personale: preso solo per questa visita
  const haCalice = () => caliceQui || (o.getLot()?.reliquie ?? []).includes('templari');
  const calice = new THREE.Group(); calice.name = 'calice_templare'; calice.visible = false;
  if (relitto) {
    const oro = merged([
      painted(new THREE.CylinderGeometry(0.13, 0.15, 0.05, 8), PAL.arancio, M(0, 0.025, 0)),
      painted(new THREE.CylinderGeometry(0.03, 0.04, 0.2, 6), PAL.giallo, M(0, 0.15, 0)),
      painted(new THREE.OctahedronGeometry(0.06, 0), PAL.arancio, M(0, 0.16, 0)),
      painted(new THREE.CylinderGeometry(0.12, 0.05, 0.16, 8), PAL.giallo, M(0, 0.33, 0)),
      painted(new THREE.CylinderGeometry(0.125, 0.125, 0.025, 8), PAL.arancio, M(0, 0.41, 0)),
      ...[0, 2.1, 4.2].map((a) => painted(new THREE.BoxGeometry(0.035, 0.035, 0.035), PAL.rosso, M(Math.cos(a) * 0.1, 0.32, Math.sin(a) * 0.1))),
    ]);
    const corpo = new THREE.Mesh(oro, new THREE.MeshBasicMaterial({ vertexColors: true })); corpo.scale.setScalar(1.4);
    const fascio = new THREE.Mesh(new THREE.BoxGeometry(0.35, 9, 0.35).translate(0, 4.5, 0), new THREE.MeshBasicMaterial({ color: PAL.giallo, transparent: true, opacity: 0.22, depthWrite: false }));
    fascio.renderOrder = 2;
    calice.add(corpo, fascio);
    calice.position.set(relitto.x, o.world.groundY(relitto.x, relitto.z) + 0.45, relitto.z);
    o.world.scene.add(calice);
  }
  if (!document.getElementById('mz-biglietto-style')) { const st = document.createElement('style'); st.id = 'mz-biglietto-style'; st.textContent = CSS_BIGLIETTO; document.head.appendChild(st); }
  const biglietto = el('div', 'mz'); biglietto.id = 'mzBiglietto';
  const chiudi = el('button', '', 'Chiudi') as HTMLButtonElement; chiudi.type = 'button'; chiudi.dataset['act'] = 'chiudi';
  biglietto.append(el('b', '', '✠ IL BIGLIETTO DELLO SCHELETRO'), ...BIGLIETTO.map((r, i) => el('p', i === BIGLIETTO.length - 1 ? 'firma' : '', r)), chiudi);
  for (const ev of ['pointerdown', 'touchstart']) biglietto.addEventListener(ev, (x) => x.stopPropagation());
  chiudi.addEventListener('click', () => { biglietto.classList.remove('on'); nearRWas = true; });
  o.root.append(biglietto);
  const btnR = el('button', 'mz mz-play'); btnR.id = 'mzTemplariCalice'; btnR.type = 'button';
  btnR.style.background = PAL.giallo; btnR.style.color = PAL.ombraCalda;
  for (const ev of ['pointerdown', 'touchstart']) btnR.addEventListener(ev, (x) => x.stopPropagation());
  btnR.addEventListener('click', () => { void usaRelitto(); });
  o.root.append(btnR);
  let nearR = false, nearRWas = false, busyR = false, prese = 0;
  async function usaRelitto(): Promise<void> {
    if (busyR) return;
    if (haCalice()) { biglietto.classList.add('on'); return; }
    busyR = true;
    try {
      const api = o.api && FLAGS.token ? o.api : null;
      if (api) { const r = await api.templariReliquia(); o.setLot(r.lot); }
      else { caliceQui = true; o.hud.toast('Senza il tuo link personale il calice resta tuo solo per questa visita', 3200); }
      prese++;
      suona('medaglia_oro');
      biglietto.classList.add('on');
      o.hud.toast('Il calice dei Templari è tuo: la nebbia rossa a sud-ovest si dirada', 4200);
    } catch (e) { fail(e, 'Il calice non si stacca dalle ossa, riprova'); } finally { busyR = false; }
  }

  const btn = el('button', 'mz mz-play'); btn.id = 'mzTemplariEntra'; btn.type = 'button';
  btn.style.background = PAL.rosso; btn.style.color = PAL.sabbiaChiara;
  btn.replaceChildren(el('span', '', '✠ ENTRA NELLA CHIESA'), el('small', '', 'A'));
  for (const ev of ['pointerdown', 'touchstart']) btn.addEventListener(ev, (x) => x.stopPropagation());
  btn.addEventListener('click', () => { void entra(false); });
  o.root.append(btn);
  // prove (?templari=1): subito nelle ondate, senza reliquia e senza barca; ⛪ a piedi davanti alla porta della chiesa
  if (FLAGS.templari) topButton({ root: o.root, id: 'mzTemplariProva', order: 9, label: '⚔', title: 'Templari: ondate subito (prova)', onClick: () => { void entra(true); } });
  if (FLAGS.templari) topButton({ root: o.root, id: 'mzTemplariVai', order: 9, label: '⛪', title: 'Templari: vai all’isola, davanti alla chiesa (prova)', onClick: () => { vaiChiesa(); } });
  function vaiChiesa(): void {
    if (busy || run || !spot || !o.world.vai('templari')) return;
    o.world.avatar.teleport(spot.x - 1.5, spot.z + 2);
    o.renderer.diorama.follow(spot.x - 1.5, o.world.groundY(spot.x, spot.z), spot.z + 2); o.renderer.diorama.snap?.();
    o.hud.toast('L’Isola dei Templari: la porta della chiesa è qui davanti (A per entrare)', 3200);
  }

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
  registerTestHook('templariProva', (o) => (templariLink.prova && o && typeof o === 'object' ? templariLink.prova(o as Record<string, unknown>) : null));
  registerTestHook('templariAutopilot', (on, speed) => { templariLink.autopilot = on ? Math.max(1, Math.min(30, Math.round(Number(speed ?? 4)) || 4)) : 0; return templariLink.autopilot; });
  /** Test: a piedi davanti alla porta della chiesa. */
  registerTestHook('templariPorta', () => { if (!spot) return null; o.world.avatar.teleport(spot.x - 1.5, spot.z + 1); return spot; });
  /** Test: a piedi accanto allo scheletro sotto il faro della Tempesta. */
  registerTestHook('templariRelitto', () => { if (!relitto) return null; o.world.avatar.teleport(relitto.x - 1.2, relitto.z + 0.8); return relitto; });
  registerStateProvider('templariRelitto', () => ({ relitto, calice: haCalice(), visibile: calice.visible, near: nearR, prese, biglietto: biglietto.classList.contains('on') }));

  return {
    spot,
    relitto,
    calice: haCalice,
    get active() { return !!run && run.active; },
    isBusy: () => busy || (!!run && !run.active),
    tick(a) {
      const pressA = a && !aWas; aWas = a;
      // lo scheletro della Tempesta: A vicino prende il calice o rilegge il biglietto
      if (relitto && !busy && !run) {
        const f = o.world.avatar.state;
        nearR = o.world.mode === 'walk' && !o.world.race.on && !biglietto.classList.contains('on') && Math.hypot(f.x - relitto.x, f.z - relitto.z) < NEAR_M;
        if (nearR && !nearRWas) o.hud.toast(haCalice() ? 'Lo scheletro del Templare: premi A per rileggere il biglietto' : 'Uno scheletro con un calice d’oro in grembo: premi A', 2800);
        nearRWas = nearR;
        if (nearR && pressA) { void usaRelitto(); return; }
      } else nearR = false;
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
      const mio = haCalice();
      btnR.classList.toggle('on', nearR && !busyR);
      const testo = mio ? '📜 LEGGI IL BIGLIETTO' : '✠ PRENDI IL CALICE';
      if (btnR.firstChild?.textContent !== testo) btnR.replaceChildren(el('span', '', testo), el('small', '', 'A'));
      // il calice gira piano e sale e scende a scatti (6 al secondo) finché non è tuo
      calice.visible = !!relitto && !mio;
      if (calice.visible) { const st = Math.floor(t * 6); calice.rotation.y = st * 0.2; calice.children[0]!.position.y = 0.06 * Math.sin(st * 0.5); }
    },
  };
}
