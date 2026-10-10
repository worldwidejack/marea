// Isola delle Corse nel gioco (docs/CORSE.md Parte A, #173, #185): chunk scaricato alla prima partita (game/minigiochi.ts →
// registraSchermo). Il bottone del posto all'isola apre l'HUB (`hub/index.ts`): l'isola aperta alla Diddy Kong Racing che si gira col
// veicolo (si parte dal molo, avatar MAREA al volante). Alla porta della Spiaggia si sceglie la pista (`hub/pannelli.ts`) e parte la
// gara (`gioca`, da minigiochi: il server apre la partita e la rigioca); finita la gara, dopo la scheda dell'esito, si è di nuovo
// nell'hub davanti alla porta. Garage = cambio veicolo; «Torna in barca» al molo o Esc = di nuovo nell'arcipelago.
// La gara gira sul motore v2 (`@marea/sim/corse/gara.ts`, pista a nastro 3D): la stessa che il server rigioca. È un «gioco nel mondo»
// (SchermoGioco con step/update, come Consegne): minigiochi gli passa un input per tick e il mondo intanto sta fermo (hub compreso).
// La resa della gara è `vista_gara.ts`: veicoli veri, animali piloti, l'avatar MAREA al volante.
// Comandi (gara e hub): da PC A/D o frecce sterzano, W/↑ gas (o «gas automatico»), S/↓ frena, Spazio DRIFT. Col dito (10 ott, Riccardo)
// lo stick sterza e basta: GAS grande nell'angolo, DRIFT accanto (tiene anche il gas), FRENO sopra. Partenza razzo: tieni il gas
// quando compare l'1. Telefono: in orizzontale (avviso «ruota il telefono»).
import * as THREE from 'three';
import { CORSE_PISTE } from '@marea/content/corse.ts';
import { packInputs, quantize } from '@marea/sim';
import type { InputFrame, PackedInputs } from '@marea/sim';
import { garaCorse, opzioniGara, pilotaGara } from '@marea/sim/corse/gara.ts';
import type { GaraState, GaraView } from '@marea/sim/corse/gara.ts';
import type { SchermoGioco } from '../game/minigiochi.ts';
import type { GameWorld } from '../game/world.ts';
import type { Renderer } from '../render/scene.ts';
import { createLights } from '../render/light.ts';
import { suona } from '../audio/ponte.ts';
import { PAL, el } from '../ui/style.ts';
import { setTopbarHidden } from '../ui/topbar.ts';
import { tempoCorsa } from '../ui/porto_amici_ui.ts';
import { FLAGS } from '../flags.ts';
import { registerStateProvider, registerTestHook } from '../test/testapi.ts';
import { avvisoRuota } from './avviso_ruota.ts';
import { creaSalaAmici } from './amici.ts';
import { creaVistaGara } from './vista_gara.ts';
import { creaSchermoHub } from './hub/index.ts';
import type { IdPorta } from './hub/mappa.ts';
import { CAMERE, PISTE, creaPannelli, leggiScelta, salvaScelta, veicoloPer } from './hub/pannelli.ts';
import type { Scelta } from './hub/pannelli.ts';

const END_WAIT = 300, END_SKIP = 60, END_AMICI = 60 * 45;

const CSS = `
body.mz-gp #compass, body.mz-gp #mzTop, body.mz-gp #mzGuida, body.mz-gp #mzGuidaPtr, body.mz-gp .mz-bar, body.mz-gp .mz-work, body.mz-gp .mz-labels,
body.mz-gp #mzPlay, body.mz-gp #mzEmoteRow, body.mz-gp #mzEmotes, body.mz-gp #mzSheet, body.mz-gp #mzMini, body.mz-gp #mzMetePtr, body.mz-gp #mzTarghe,
body.mz-gp #mzTrag, body.mz-gp .mz-play { display: none !important; }
.mz-gp-quit { position: absolute; left: max(8px, env(safe-area-inset-left, 0px)); top: calc(max(8px, env(safe-area-inset-top)) + 8px); display: none; min-height: 40px; min-width: 40px; padding: 0 10px;
  align-items: center; justify-content: center; background: rgba(46,30,20,.82); color: ${PAL.sabbiaChiara}; border: 2px solid ${PAL.legno}; font: bold 12px ui-monospace, Menlo, monospace; border-radius: 6px; z-index: 15; }
.mz-gp-quit.on { display: flex; }
/* Telefono (Riccardo, 10 ott): lo stick sterza e basta; a destra GAS grande nell'angolo, DRIFT accanto (tiene anche il gas), FRENO sopra */
.mz-gp-gas { position: absolute; right: max(16px, env(safe-area-inset-right, 0px)); bottom: calc(env(safe-area-inset-bottom, 0px) + 18px); width: 100px; height: 100px; border-radius: 50%;
  display: none; align-items: center; justify-content: center; background: rgba(110,170,60,.82); border: 3px solid rgba(244,227,193,.75); color: #F4E3C1;
  font: bold 20px ui-monospace, Menlo, monospace; z-index: 14; touch-action: none; -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; -webkit-tap-highlight-color: transparent; }
.mz-gp-gas.giu { transform: scale(.92); filter: brightness(1.25); }
body.mz-gp.mz-dito .mz-gp-gas { display: flex; }
body.mz-gp.mz-dito #btnA { right: calc(max(16px, env(safe-area-inset-right, 0px)) + 110px) !important; bottom: calc(env(safe-area-inset-bottom, 0px) + 18px) !important;
  width: 82px !important; height: 82px !important; font-size: 15px !important; }
body.mz-gp.mz-dito #btnB { right: calc(max(16px, env(safe-area-inset-right, 0px)) + 22px) !important; bottom: calc(env(safe-area-inset-bottom, 0px) + 128px) !important;
  width: 60px !important; height: 60px !important; font-size: 11px !important; }
`;

type Fase = 'gara' | 'fine';
type Run = {
  s: GaraState; frames: InputFrame[]; fase: Fase; wait: number; dopo: number; auto: boolean; speed: number; ritirato: boolean;
  /** Gara tra amici (corse/amici.ts): si manda la posizione, gli amici si vedono come fantasmi, alla fine si aspettano i loro arrivi. */
  amici: boolean;
  esito: ReturnType<typeof garaCorse.result> | null; finish(v: PackedInputs | null): void;
};

/** `gioca(opzioni)` (da minigiochi.ts): fa partire una gara dall'hub, con le opzioni scelte alla porta (server, replay, premio come sempre). */
export function createCorse(o: { root: HTMLElement; renderer: Renderer; world: GameWorld; gioca?: (opzioni: Record<string, string>) => Promise<void> }): SchermoGioco {
  if (!document.getElementById('mz-gp-style')) { const st = document.createElement('style'); st.id = 'mz-gp-style'; st.textContent = CSS; document.head.appendChild(st); }
  const stop = (e: Event) => e.stopPropagation();
  const ruota = avvisoRuota(o.root, false);

  // ---- scena della gara ----
  const scene = new THREE.Scene(); scene.name = 'gran_premio';
  scene.background = o.renderer.sky.texture;
  const luci = createLights(); scene.add(luci.group);
  const vista = creaVistaGara({ root: o.root, camera: o.renderer.camera, look: () => o.world.look, onLuce: (x, z) => luci.follow?.(x, z) });
  scene.add(vista.gruppo);

  // ---- interfaccia ----
  const quit = el('button', 'mz-gp-quit', 'Esc · Ritirati') as HTMLButtonElement; quit.type = 'button'; quit.id = 'mzGpEsci';
  for (const ev of ['pointerdown', 'touchstart']) quit.addEventListener(ev, stop);
  o.root.append(quit);
  // ---- GAS (solo col dito): tenuto = gas a fondo; DRIFT tenuto dà gas anche lui (un pollice solo scivola da GAS a DRIFT) ----
  const dito = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  const gasBtn = el('button', 'mz-gp-gas', 'GAS') as HTMLButtonElement; gasBtn.type = 'button'; gasBtn.id = 'mzGpGas';
  const gasGiu = new Set<number>();
  const gasPinta = () => gasBtn.classList.toggle('giu', gasGiu.size > 0);
  gasBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); gasGiu.add(e.pointerId); try { gasBtn.setPointerCapture(e.pointerId); } catch { /* sintetico */ } gasPinta(); });
  const gasSu = (e: PointerEvent) => { if (gasGiu.delete(e.pointerId)) gasPinta(); };
  for (const ev of ['pointerup', 'pointercancel']) { gasBtn.addEventListener(ev, gasSu as EventListener); addEventListener(ev, gasSu as EventListener); }
  for (const ev of ['touchstart', 'touchmove', 'contextmenu']) gasBtn.addEventListener(ev, (e) => { e.preventDefault(); e.stopPropagation(); }, { passive: false });
  o.root.append(gasBtn);
  if (dito) document.body.classList.add('mz-dito');
  const pannelli = creaPannelli(o.root);
  const scelta: Scelta = leggiScelta();
  // ---- gara tra amici (10 ott): la sala alla porta della Spiaggia; quando qualcuno preme VIA parte la gara di tutti ----
  const sala = creaSalaAmici({ root: o.root, token: () => FLAGS.token });
  sala.onEsci = () => { if (hub.aperto() && !run) hub.riprendi(portaGara); };
  sala.onParte = (pt) => {
    if (run || !o.gioca) return;
    const opz = opzioniGara({ pista: pt.pista, veicolo: veicoloPer({ ...scelta, pista: pt.pista }), bot: pt.bot ? '1' : '0', posto: String(pt.io) });
    hub.messaggio('Si parte…', 30);
    void o.gioca(opz).finally(() => { if (hub.aperto() && !run && hub.info().fermo) { sala.chiudi(); hub.riprendi(portaGara); } });
  };

  // ---- l'hub (#185): l'isola aperta che si gira col veicolo; dalla porta della Spiaggia partono le gare ----
  let portaGara: IdPorta = 'spiaggia', ultimo = performance.now();
  const hub = creaSchermoHub({
    root: o.root, camera: o.renderer.camera, look: () => o.world.look, pannelli,
    porta: (p) => {
      portaGara = p.id;
      void pannelli.piste(scelta, { sottotitolo: `${p.nome} · tu e 4 avversari, o con gli amici`, esci: 'Torna all’isola delle Corse', amici: true }).then((opz) => {
        if (!opz || !o.gioca) { hub.riprendi(p.id); return; }
        if (opz['amici']) { sala.apri(opz['pista']!, scelta.veicolo); return; } // la sala: la gara la fa partire `onParte`
        hub.messaggio('Si parte…', 30);
        // la partita: minigiochi apre la gara sul server e chiama `run`; se non parte (server giù) `annulla` rimette l'hub
        void o.gioca(opz).finally(() => { if (hub.aperto() && !run && hub.info().fermo) hub.riprendi(p.id); });
      });
    },
    veicolo: (id) => { scelta.veicolo = id; salvaScelta(scelta); },
    esci: () => esciHub(),
  });
  function apriHub(): void {
    hub.apri(scelta.veicolo, 'molo');
    o.renderer.setScene(hub.scene);
    document.body.classList.add('mz-gp'); pulsanti(true); ruota.attiva(true);
    ultimo = performance.now();
  }
  function esciHub(): void {
    if (run) return;
    pannelli.chiudi(); sala.chiudi(); hub.chiudi();
    o.renderer.setScene(null); o.renderer.diorama.snap?.();
    document.body.classList.remove('mz-gp'); setTopbarHidden(false); pulsanti(false); ruota.attiva(false);
  }

  // Si entra nell'hub e basta: le gare le fa partire la porta della Spiaggia (`gioca`). Il pilota automatico dei bot (?autopilot=1)
  // salta l'hub e corre subito la pista della scelta.
  const scegli: NonNullable<SchermoGioco['scegli']> = (opz) => {
    if (opz?.['pista'] && PISTE.some((p) => p.id === opz['pista'])) scelta.pista = opz['pista'];
    if (FLAGS.autopilot || !o.gioca) return Promise.resolve({ ...opzioniGara({ pista: scelta.pista, veicolo: veicoloPer(scelta), bot: '1' }) });
    apriHub();
    return Promise.resolve(null);
  };

  // ---- partita ----
  let run: Run | null = null, autoSpeed = FLAGS.autopilot ? 4 : 0;
  let last: { ticks: number; rows: number; result: unknown; cancelled: boolean; pista: string } | null = null;
  let btnA: string | null = null, btnB: string | null = null;
  /** La riga dell'esito di una gara tra amici («2° su 3 tra amici»), letta una volta da `esito`. */
  let ultimaAmici: string | null = null;
  const classificaAmici = (r: Run): string => {
    const ms = Number(r.esito?.detail['ms'] ?? 0), arrivato = Number(r.esito?.detail['giri'] ?? 0) >= Number(r.esito?.detail['tot'] ?? 1);
    const altri = sala.amici(), prima = altri.filter((a) => a.fine !== null && a.fine >= 0 && (!arrivato || a.fine < ms)).length;
    return `${prima + 1}° su ${altri.length + 1} tra amici`;
  };
  const fov0 = { fov: o.renderer.camera.fov, far: o.renderer.camera.far, near: o.renderer.camera.near };

  const quitRun = () => { const r = run; if (!r) return; r.ritirato = r.fase !== 'fine'; if (r.ritirato && r.amici) sala.fine(-1); r.finish(r.fase === 'fine' ? packInputs(r.frames) : null); };
  quit.addEventListener('click', quitRun);
  // Esc: si ritira dalla gara, chiude il pannello aperto (pista o garage), esce dall'hub; con la scheda dell'esito aperta la chiude lei (minigiochi)
  const onKey = (e: KeyboardEvent) => {
    if (e.code === 'Escape') {
      if (document.querySelector('#mzEsito.on')) return;
      if (run) quitRun();
      else if (pannelli.aperto()) pannelli.chiudi();
      else if (sala.aperta()) { sala.chiudi(); sala.onEsci?.(); }
      else if (hub.aperto()) esciHub();
      else return;
      e.preventDefault(); e.stopImmediatePropagation(); return;
    }
    if (run) {
      if (e.code === 'KeyC' && !e.repeat) { const i = CAMERE.findIndex((c) => c.id === scelta.cam); scelta.cam = CAMERE[(i + 1) % CAMERE.length]!.id; vista.cameraSalta(); }
      return;
    }
    if (pannelli.aperto() === 'piste' && e.code === 'Enter') { e.preventDefault(); pannelli.via(); }
  };
  addEventListener('keydown', onKey, true);
  /** L'input del mondo (assi mondo, game/input.ts) → schermo: sterzo, gas (in avanti, o sempre), freno, drift.
   *  Col dito lo stick sterza e basta: gas = GAS (o DRIFT) tenuto, freno = FRENO. Da tastiera come prima (↑ gas, ↓ freno). */
  const comandi = (f: InputFrame): InputFrame => {
    const yaw = o.renderer.diorama.yaw, rx = Math.cos(yaw), rz = -Math.sin(yaw), fx = -Math.sin(yaw), fz = -Math.cos(yaw);
    const sx = rx * f.mx + rz * f.my, sy = -(fx * f.mx + fz * f.my); // sy > 0 = giù
    const mx = Math.max(-1, Math.min(1, sx / 0.7));
    if (dito) return { mx, my: f.b ? -1 : scelta.gasAuto || gasGiu.size > 0 || f.a ? 1 : 0, a: f.a, b: false };
    const freno = f.b || sy > 0.5, gas = Math.max(0, Math.min(1, -sy / 0.6));
    return { mx, my: freno ? -1 : scelta.gasAuto ? 1 : gas, a: f.a, b: false };
  };
  const pulsanti = (on: boolean) => {
    const a = document.getElementById('btnA'), b = document.getElementById('btnB');
    if (on) { if (a) { btnA ??= a.textContent; a.textContent = 'DRIFT'; a.style.fontSize = '17px'; } if (b) { btnB ??= b.textContent; b.textContent = 'FRENO'; b.style.fontSize = '13px'; } }
    else {
      gasGiu.clear(); gasPinta(); if (a && btnA !== null) { a.textContent = btnA; a.style.fontSize = ''; } if (b && btnB !== null) { b.textContent = btnB; b.style.fontSize = ''; } btnA = btnB = null; }
  };

  const g: SchermoGioco = {
    scegli,
    annulla() { if (hub.aperto()) { hub.messaggio(null); hub.riprendi(portaGara); } else ruota.attiva(false); },
    run({ seed, difficulty, opzioni }) {
      if (run) return Promise.resolve(null);
      const d = (Math.round(difficulty) >= 1 && Math.round(difficulty) <= 3 ? Math.round(difficulty) : 2) as 1 | 2 | 3;
      const s = garaCorse.create({ seed: seed >>> 0, difficulty: d, opzioni: opzioni ?? opzioniGara({ pista: scelta.pista, veicolo: veicoloPer(scelta), bot: '1' }) });
      return new Promise<PackedInputs | null>((resolve) => {
        const r: Run = {
          s, frames: [], fase: 'gara', wait: 0, dopo: 0, auto: autoSpeed > 0, speed: Math.max(1, autoSpeed), ritirato: false, esito: null,
          amici: !!sala.info().gara && opzioni?.['posto'] !== undefined,
          finish(v) {
            if (run !== r) return;
            run = null;
            vista.chiudi();
            if (r.amici) sala.chiudi(); // si esce dalla sala: per la rivincita si rientra dalla porta
            quit.classList.remove('on');
            const c = o.renderer.camera; c.fov = fov0.fov; c.far = fov0.far; c.near = fov0.near; c.updateProjectionMatrix();
            if (hub.aperto()) { // di nuovo nell'hub, davanti alla porta (la scheda dell'esito arriva sopra)
              hub.messaggio(null); hub.riprendi(portaGara); o.renderer.setScene(hub.scene); ultimo = performance.now();
            } else {
              ruota.attiva(false); document.body.classList.remove('mz-gp'); setTopbarHidden(false); pulsanti(false);
              o.renderer.setScene(null); o.renderer.diorama.snap?.();
            }
            last = { ticks: r.frames.length, rows: v?.length ?? 0, result: r.esito ?? garaCorse.result(r.s), cancelled: !v, pista: r.s.pista };
            console.log(`[marea] gran premio ${v ? 'finito' : 'annullato'}: ${r.frames.length} tick, ${v?.length ?? 0} righe`);
            resolve(v);
          },
        };
        run = r;
        if (hub.aperto()) hub.sospendi();
        ruota.attiva(true);
        vista.mostra(s); vista.interfaccia(true);
        o.renderer.setScene(scene);
        document.body.classList.add('mz-gp'); pulsanti(true); quit.classList.add('on');
        ultimo = performance.now();
      });
    },
    isOpen: () => !!run || !!pannelli.aperto() || sala.aperta() || hub.aperto(),
    esito: (d) => {
      const n = (k: string) => (typeof d[k] === 'number' ? (d[k] as number) : 0);
      const amici = ultimaAmici; ultimaAmici = null;
      if (amici) return n('giri') >= n('tot') && n('tot') > 0 ? `${amici} · ${tempoCorsa(n('ms'))}` : 'Gara non finita';
      return n('giri') >= n('tot') && n('tot') > 0 ? `${n('pos')}° su 5 · ${tempoCorsa(n('ms'))} · giro migliore ${tempoCorsa(n('giro'))}` : 'Gara non finita';
    },
    step(f) {
      if (ruota.visibile()) return; // col telefono in verticale gara e hub aspettano (e non si registrano input)
      const r = run;
      if (!r) { if (hub.aperto()) hub.step(comandi(f)); return; }
      if (r.fase === 'gara') {
        for (let i = 0; i < r.speed && r.fase === 'gara'; i++) {
          const frame = quantize(r.auto ? pilotaGara(r.s) : comandi(f)); // quantizzato come nel replay del server
          r.frames.push(frame); garaCorse.step(r.s, frame);
          if (r.amici) sala.manda(r.s.veicoli[0]!);
          if (r.s.done) {
            r.fase = 'fine'; r.wait = r.amici ? END_AMICI : END_WAIT; r.esito = garaCorse.result(r.s); vista.suoni.zitto();
            const arrivato = r.esito.detail['giri']! >= r.esito.detail['tot']!;
            suona(arrivato ? 'arrivo' : 'fine');
            if (r.amici) { sala.manda(r.s.veicoli[0]!); sala.fine(arrivato ? r.esito.detail['ms']! : -1); }
          }
        }
        return;
      }
      r.wait--; r.dopo++;
      // tra amici si aspetta che arrivino tutti (al massimo END_AMICI): intanto si vedono arrivare e la classifica si riempie
      const tutti = !r.amici || sala.amici().every((a) => a.fine !== null);
      if (r.amici && tutti && r.wait > END_WAIT) r.wait = END_WAIT;
      if (r.wait <= 0 || (r.dopo > END_SKIP && f.a)) {
        if (r.amici) ultimaAmici = classificaAmici(r);
        r.finish(packInputs(r.frames));
      }
    },
    update() {
      const r = run; if (!r && !hub.aperto()) return;
      setTopbarHidden(true); // main.ts la rimette a posto ogni frame prima di noi
      const now = performance.now(), dt = Math.min(0.1, (now - ultimo) / 1000); ultimo = now;
      if (!r) { hub.aggiorna(dt); return; }
      vista.aggiorna(r.s, dt, { cam: scelta.cam, effetti: true, auto: r.auto, gasAuto: scelta.gasAuto, fine: r.fase === 'fine', ritirato: r.ritirato, ...(r.amici ? { amici: sala.amici() } : {}) });
    },
  };

  registerStateProvider('corse', () => {
    const r = run;
    if (!r) return { active: false, scelta: pannelli.aperto() === 'piste', garage: pannelli.aperto() === 'garage', hub: hub.info(), last, pista: scelta.pista, veicolo: scelta.veicolo, sala: sala.info() };
    const v = garaCorse.view(r.s) as GaraView, k = r.s.veicoli[0]!;
    return { active: true, hub: { aperto: hub.aperto() }, amici: r.amici, sala: sala.info(), fase: r.fase, auto: r.auto, pista: r.s.pista, veicolo: k.id, frames: r.frames.length, tick: r.s.tick, giro: v.giro, pos: v.posizioni[0], ms: v.ms, done: v.done, v: Math.round(k.v * 10) / 10, drift: k.drift, vista: vista.info(), last };
  });
  /** Le gare le corre il pilota automatico (`speed` tick di sim per tick del ciclo, 1-20; 0 = di nuovo a mano). */
  registerTestHook('corseAuto', (speed) => {
    autoSpeed = Math.max(0, Math.min(20, Number(speed) || 0));
    if (run) { run.auto = autoSpeed > 0; run.speed = Math.max(1, autoSpeed); }
    return autoSpeed;
  });
  /** Pista e veicolo della prossima partita (id) senza passare dalla scelta. */
  registerTestHook('corseScelta', (v) => {
    const x = (v ?? {}) as Partial<Scelta>;
    if (x.pista && CORSE_PISTE[x.pista]) scelta.pista = x.pista;
    if (x.veicolo) scelta.veicolo = x.veicolo;
    if (x.cam) scelta.cam = x.cam;
    if (x.gasAuto !== undefined) scelta.gasAuto = !!x.gasAuto;
    salvaScelta(scelta);
    return { ...scelta };
  });
  registerTestHook('corseVia', () => { pannelli.via(); return !!pannelli.aperto() || !!run; });
  /** GAS tenuto (col dito il gas è solo sul bottone): true = premuto, false = lasciato. Risponde se il bottone c'è (telefono). */
  registerTestHook('corseGas', (on) => { if (on) gasGiu.add(-1); else gasGiu.delete(-1); gasPinta(); return dito; });
  /** Esce: dalla gara (ritirato, si torna nell'hub), se no da pannello e hub insieme (di nuovo nell'arcipelago). */
  registerTestHook('corseEsci', () => { if (run) quitRun(); else { pannelli.chiudi(); esciHub(); } return true; });
  /** Lo stato dell'hub (posizione, quota, velocità, drift, pannello, messaggio…). */
  registerTestHook('corseHub', () => hub.info());
  /** Hub: teletrasporto in (x, z, yaw), oppure dentro il raggio di una porta / del garage / del molo ('spiaggia', 'garage', …). */
  registerTestHook('corseHubVai', (x, z, yaw) => {
    if (!hub.aperto()) return null;
    if (typeof x === 'string') hub.davantiA(x as IdPorta | 'garage' | 'molo', z !== false);
    else hub.vai(Number(x), Number(z), yaw === undefined ? undefined : Number(yaw));
    return hub.info();
  });
  return g;
}
