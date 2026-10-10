// Isola delle Corse, il Gran Premio nel gioco (docs/CORSE.md Parte A, #173): chunk scaricato alla prima partita (game/minigiochi.ts →
// registraSchermo). Gira sul motore v2 (`@marea/sim/corse/gara.ts`, pista a nastro 3D): la stessa gara che il server rigioca.
// È un «gioco nel mondo» (SchermoGioco con step/update, come Consegne): minigiochi gli passa un input per tick e il mondo intanto sta
// fermo. Prima si sceglie la pista della Spiaggia e il veicolo (`scegli`, prima che il server apra la partita: le opzioni le
// normalizza e le ricorda lui), poi la gara parte col semaforo della sim; alla fine restituisce gli input compressi, che il server
// rigioca (stesso tempo, stessa posizione). La resa è `vista_gara.ts`: veicoli veri, animali piloti, l'avatar MAREA al volante.
// Comandi: il joystick (o A/D, frecce) sterza, in avanti (W, ↑) è il gas (o «gas automatico»), giù (S, ↓, B) frena, DRIFT = A (Spazio
// da PC); partenza razzo: tieni il gas quando compare l'1. Telefono: in orizzontale (avviso «ruota il telefono» in verticale).
import * as THREE from 'three';
import { CORSE, CORSE_PISTE } from '@marea/content/corse.ts';
import { packInputs, quantize } from '@marea/sim';
import type { InputFrame, PackedInputs } from '@marea/sim';
import { famiglieDi, garaCorse, opzioniGara, pilotaGara } from '@marea/sim/corse/gara.ts';
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
import { creaVistaGara } from './vista_gara.ts';
import type { Modo } from './prova/camera.ts';

const END_WAIT = 300, END_SKIP = 60;
const SCELTA_KEY = 'mz-corse-scelta';
const PISTE = Object.entries(CORSE_PISTE).filter(([id]) => id.startsWith('spiaggia_')).map(([id, d]) => ({ id, def: d }));
const CAMERE: { id: Modo; nome: string }[] = [{ id: 'dietro', nome: 'dietro' }, { id: 'alta', nome: 'alta' }, { id: 'cofano', nome: 'cofano' }];

const CSS = `
body.mz-gp #compass, body.mz-gp #mzTop, body.mz-gp #mzGuida, body.mz-gp #mzGuidaPtr, body.mz-gp .mz-bar, body.mz-gp .mz-work, body.mz-gp .mz-labels,
body.mz-gp #mzPlay, body.mz-gp #mzEmoteRow, body.mz-gp #mzEmotes, body.mz-gp #mzSheet, body.mz-gp #mzMini, body.mz-gp #mzMetePtr, body.mz-gp #mzTarghe,
body.mz-gp #mzTrag, body.mz-gp .mz-play { display: none !important; }
.mz-gp-quit { position: absolute; left: max(8px, env(safe-area-inset-left, 0px)); top: calc(max(8px, env(safe-area-inset-top)) + 8px); display: none; min-height: 40px; min-width: 40px; padding: 0 10px;
  align-items: center; justify-content: center; background: rgba(46,30,20,.82); color: ${PAL.sabbiaChiara}; border: 2px solid ${PAL.legno}; font: bold 12px ui-monospace, Menlo, monospace; border-radius: 6px; z-index: 15; }
.mz-gp-quit.on { display: flex; }
.mz-gp-sc { position: absolute; inset: 0; z-index: 30; display: none; align-items: center; justify-content: center; padding: 10px; box-sizing: border-box; background: rgba(22,63,115,.55); }
.mz-gp-sc.on { display: flex; }
.mz-gp-sc .box { width: min(560px, 100%); max-height: 100%; overflow-y: auto; box-sizing: border-box; padding: 14px 16px; background: rgba(46,30,20,.96); border: 3px solid ${PAL.legnoChiaro}; box-shadow: 0 6px 0 ${PAL.neroCaldo};
  color: ${PAL.sabbiaChiara}; font-family: ui-monospace, Menlo, monospace; text-align: center; }
.mz-gp-sc h2 { margin: 0; font-size: 24px; letter-spacing: .06em; }
.mz-gp-sc .sub { color: ${PAL.sabbia}; font-size: 13px; margin: 3px 0 10px; }
.mz-gp-sc .lbl { font-size: 12px; color: ${PAL.sabbia}; margin: 8px 0 5px; letter-spacing: .08em; text-align: left; }
.mz-gp-sc .riga { display: flex; flex-wrap: wrap; gap: 6px; }
.mz-gp-sc .riga button { flex: 1 1 120px; min-height: 44px; padding: 4px 8px; background: ${PAL.legnoScuro}; color: ${PAL.sabbiaChiara}; border: 2px solid ${PAL.legnoChiaro}; font: bold 13px ui-monospace, Menlo, monospace; cursor: pointer; border-radius: 4px; }
.mz-gp-sc .riga button small { display: block; font-weight: normal; font-size: 10px; color: ${PAL.sabbia}; }
.mz-gp-sc .riga button.on { background: ${PAL.giallo}; color: ${PAL.neroCaldo}; border-color: ${PAL.neroCaldo}; }
.mz-gp-sc .riga button.on small { color: ${PAL.legnoScuro}; }
.mz-gp-sc .sez { display: block; }
.mz-gp-sc .cmd { font-size: 11px; color: ${PAL.sabbia}; line-height: 1.5; margin: 10px 0; text-align: left; }
.mz-gp-sc .cmd b { color: ${PAL.sabbiaChiara}; }
.mz-gp-sc .via { width: 100%; min-height: 52px; background: ${PAL.erbaChiara}; color: ${PAL.neroCaldo}; border: 3px solid ${PAL.neroCaldo}; box-shadow: 0 5px 0 ${PAL.neroCaldo}; font: bold 22px ui-monospace, Menlo, monospace; cursor: pointer; border-radius: 4px; }
.mz-gp-sc .esci { margin-top: 8px; background: none; border: none; color: ${PAL.sabbia}; font: 12px ui-monospace, Menlo, monospace; text-decoration: underline; cursor: pointer; min-height: 30px; }
@media (max-height: 520px) { .mz-gp-sc .box { padding: 6px 12px 4px; } .mz-gp-sc h2 { font-size: 17px; } .mz-gp-sc .sub { margin: 1px 0 4px; font-size: 11px; } .mz-gp-sc .cmd { display: none; }
  .mz-gp-sc .sez { display: flex; align-items: center; gap: 8px; margin-top: 4px; } .mz-gp-sc .sez .lbl { margin: 0; width: 62px; flex: none; font-size: 11px; } .mz-gp-sc .sez .riga { flex: 1; flex-wrap: nowrap; }
  .mz-gp-sc .riga button { min-height: 34px; flex-basis: 0; padding: 2px 4px; font-size: 12px; } .mz-gp-sc .riga button small { font-size: 9px; } .mz-gp-sc .via { min-height: 40px; font-size: 17px; margin-top: 6px; box-shadow: 0 3px 0 ${PAL.neroCaldo}; } .mz-gp-sc .esci { margin-top: 2px; min-height: 24px; } }
`;

type Scelta = { pista: string; veicolo: string; gasAuto: boolean; cam: Modo };
type Fase = 'gara' | 'fine';
type Run = {
  s: GaraState; frames: InputFrame[]; fase: Fase; wait: number; auto: boolean; speed: number; ritirato: boolean;
  esito: ReturnType<typeof garaCorse.result> | null; finish(v: PackedInputs | null): void;
};

export function createCorse(o: { root: HTMLElement; renderer: Renderer; world: GameWorld }): SchermoGioco {
  if (!document.getElementById('mz-gp-style')) { const st = document.createElement('style'); st.id = 'mz-gp-style'; st.textContent = CSS; document.head.appendChild(st); }
  const stop = (e: Event) => e.stopPropagation();
  const ruota = avvisoRuota(o.root, false);

  // ---- scena ----
  const scene = new THREE.Scene(); scene.name = 'gran_premio';
  scene.background = o.renderer.sky.texture;
  const luci = createLights(); scene.add(luci.group);
  const vista = creaVistaGara({ root: o.root, camera: o.renderer.camera, look: () => o.world.look, onLuce: (x, z) => luci.follow?.(x, z) });
  scene.add(vista.gruppo);

  // ---- interfaccia ----
  const quit = el('button', 'mz-gp-quit', 'Esc · Ritirati') as HTMLButtonElement; quit.type = 'button'; quit.id = 'mzGpEsci';
  const sc = el('div', 'mz mz-gp-sc'); sc.id = 'mzGpIntro';
  for (const e of [quit, sc]) for (const ev of ['pointerdown', 'touchstart']) e.addEventListener(ev, stop);
  o.root.append(quit, sc);

  // ---- scelta della pista e del veicolo (prima che il server apra la partita) ----
  let scelta: Scelta = { pista: 'spiaggia_lungomare', veicolo: 'kart', gasAuto: false, cam: 'dietro' };
  try {
    const m = JSON.parse(localStorage.getItem(SCELTA_KEY) ?? 'null') as Partial<Scelta> | null;
    if (m) scelta = { pista: PISTE.some((p) => p.id === m.pista) ? m.pista! : scelta.pista, veicolo: m.veicolo ?? scelta.veicolo, gasAuto: !!m.gasAuto, cam: CAMERE.some((c) => c.id === m.cam) ? m.cam! : 'dietro' };
  } catch { /* niente memoria: di serie */ }
  const veicoliDi = (pista: string) => CORSE.veicoli.filter((v) => famiglieDi(CORSE_PISTE[pista]!).includes(v.famiglia));
  const sistema = () => { if (!veicoliDi(scelta.pista).some((v) => v.id === scelta.veicolo)) scelta.veicolo = veicoliDi(scelta.pista)[0]!.id; };
  const tocco = matchMedia('(pointer: coarse)').matches;
  let chiudiScelta: ((v: Record<string, string> | null) => void) | null = null;
  function disegnaScelta(): void {
    sistema();
    const riga = (titolo: string, voci: { id: string; nome: string; sub?: string; on: boolean; fai: () => void }[]) => {
      const r = el('div', 'riga');
      for (const v of voci) { const b = el('button', v.on ? 'on' : '', v.nome) as HTMLButtonElement; b.type = 'button'; b.dataset['id'] = v.id; if (v.sub) b.appendChild(el('small', '', v.sub)); b.addEventListener('click', () => { v.fai(); suona('click'); }); r.appendChild(b); }
      const sez = el('div', 'sez'); sez.append(el('div', 'lbl', titolo), r);
      return [sez];
    };
    const salva = () => { try { localStorage.setItem(SCELTA_KEY, JSON.stringify(scelta)); } catch { /* pazienza */ } disegnaScelta(); };
    const via = el('button', 'via', 'VIA!') as HTMLButtonElement; via.type = 'button'; via.id = 'mzGpVia';
    via.addEventListener('click', () => chiudiScelta?.({ ...opzioniGara({ pista: scelta.pista, veicolo: scelta.veicolo, bot: '1' }) }));
    const esci = el('button', 'esci', 'Torna all’isola') as HTMLButtonElement; esci.type = 'button'; esci.addEventListener('click', () => chiudiScelta?.(null));
    const cmd = el('div', 'cmd');
    cmd.innerHTML = tocco
      ? '<b>Joystick</b>: sterza · in avanti il gas · giù frena · <b>DRIFT</b> tenuto in curva (3 livelli di scintille), poi lascia e parti<br>Tieni il gas quando compare l\'<b>1</b> al semaforo: partenza razzo'
      : '<b>A D</b> o <b>← →</b> sterza · <b>W ↑</b> gas · <b>S ↓</b> freno · <b>Spazio</b> = DRIFT tenuto in curva, poi lascia e parti<br>Tieni il gas quando compare l\'<b>1</b> al semaforo: partenza razzo · <b>Esc</b> ti ritira';
    sc.replaceChildren(el('div', 'box'));
    sc.firstElementChild!.append(
      el('h2', '', '🏁 GRAN PREMIO'), el('div', 'sub', 'Isola delle Corse · Spiaggia e porto · tu e 4 avversari'),
      ...riga('PISTA', PISTE.map(({ id, def }) => ({ id, nome: def.nome, sub: def.tipo === 'fuga' ? 'fuga · corri o l\'onda ti prende' : `${def.giri} giri`, on: id === scelta.pista, fai: () => { scelta.pista = id; salva(); } }))),
      ...riga('VEICOLO', veicoliDi(scelta.pista).map((v) => ({ id: v.id, nome: v.nome, on: v.id === scelta.veicolo, fai: () => { scelta.veicolo = v.id; salva(); } }))),
      ...riga('GAS', [{ id: 'gas_man', nome: 'in mano', on: !scelta.gasAuto, fai: () => { scelta.gasAuto = false; salva(); } }, { id: 'gas_auto', nome: 'automatico', on: scelta.gasAuto, fai: () => { scelta.gasAuto = true; salva(); } }]),
      ...riga('CAMERA', CAMERE.map((c) => ({ id: c.id, nome: c.nome, on: c.id === scelta.cam, fai: () => { scelta.cam = c.id; salva(); } }))),
      cmd, via, esci,
    );
  }
  const scegli: NonNullable<SchermoGioco['scegli']> = (opz) => new Promise((resolve) => {
    if (opz?.['pista'] && PISTE.some((p) => p.id === opz['pista'])) scelta.pista = opz['pista'];
    ruota.attiva(true);
    disegnaScelta(); sc.classList.add('on');
    chiudiScelta = (v) => { chiudiScelta = null; sc.classList.remove('on'); if (!v) ruota.attiva(false); resolve(v); };
    if (FLAGS.autopilot) chiudiScelta({ ...opzioniGara({ pista: scelta.pista, veicolo: scelta.veicolo, bot: '1' }) });
  });

  // ---- partita ----
  let run: Run | null = null, autoSpeed = FLAGS.autopilot ? 4 : 0;
  let last: { ticks: number; rows: number; result: unknown; cancelled: boolean; pista: string } | null = null;
  let btnA: string | null = null, btnB: string | null = null, ultimo = performance.now();
  const fov0 = { fov: o.renderer.camera.fov, far: o.renderer.camera.far, near: o.renderer.camera.near };

  const quitRun = () => { const r = run; if (!r) return; r.ritirato = r.fase !== 'fine'; r.finish(r.fase === 'fine' ? packInputs(r.frames) : null); };
  quit.addEventListener('click', quitRun);
  const onKey = (e: KeyboardEvent) => {
    if (e.code === 'Escape' && (run || chiudiScelta)) { e.preventDefault(); e.stopImmediatePropagation(); if (run) quitRun(); else chiudiScelta?.(null); return; }
    if (run) {
      if (e.code === 'KeyC' && !e.repeat) { const i = CAMERE.findIndex((c) => c.id === scelta.cam); scelta.cam = CAMERE[(i + 1) % CAMERE.length]!.id; vista.cameraSalta(); }
      return;
    }
    if (chiudiScelta && e.code === 'Enter') { e.preventDefault(); (document.getElementById('mzGpVia') as HTMLButtonElement | null)?.click(); }
  };
  addEventListener('keydown', onKey, true);
  /** L'input del mondo (assi mondo, game/input.ts) → schermo: sterzo, gas (in avanti, o sempre), freno, drift. */
  const comandi = (f: InputFrame): InputFrame => {
    const yaw = o.renderer.diorama.yaw, rx = Math.cos(yaw), rz = -Math.sin(yaw), fx = -Math.sin(yaw), fz = -Math.cos(yaw);
    const sx = rx * f.mx + rz * f.my, sy = -(fx * f.mx + fz * f.my); // sy > 0 = giù
    const freno = f.b || sy > 0.5, gas = Math.max(0, Math.min(1, -sy / 0.6));
    return { mx: Math.max(-1, Math.min(1, sx / 0.7)), my: freno ? -1 : scelta.gasAuto ? 1 : gas, a: f.a, b: false };
  };
  const pulsanti = (on: boolean) => {
    const a = document.getElementById('btnA'), b = document.getElementById('btnB');
    if (on) { if (a) { btnA ??= a.textContent; a.textContent = 'DRIFT'; a.style.fontSize = '17px'; } if (b) { btnB ??= b.textContent; b.textContent = 'FRENO'; b.style.fontSize = '13px'; } }
    else { if (a && btnA !== null) { a.textContent = btnA; a.style.fontSize = ''; } if (b && btnB !== null) { b.textContent = btnB; b.style.fontSize = ''; } btnA = btnB = null; }
  };

  const g: SchermoGioco = {
    scegli,
    annulla() { ruota.attiva(false); },
    run({ seed, difficulty, opzioni }) {
      if (run) return Promise.resolve(null);
      const d = (Math.round(difficulty) >= 1 && Math.round(difficulty) <= 3 ? Math.round(difficulty) : 2) as 1 | 2 | 3;
      const s = garaCorse.create({ seed: seed >>> 0, difficulty: d, opzioni: opzioni ?? opzioniGara({ pista: scelta.pista, veicolo: scelta.veicolo, bot: '1' }) });
      return new Promise<PackedInputs | null>((resolve) => {
        const r: Run = {
          s, frames: [], fase: 'gara', wait: 0, auto: autoSpeed > 0, speed: Math.max(1, autoSpeed), ritirato: false, esito: null,
          finish(v) {
            if (run !== r) return;
            run = null;
            vista.chiudi(); ruota.attiva(false);
            quit.classList.remove('on');
            document.body.classList.remove('mz-gp'); setTopbarHidden(false); pulsanti(false);
            const c = o.renderer.camera; c.fov = fov0.fov; c.far = fov0.far; c.near = fov0.near; c.updateProjectionMatrix();
            o.renderer.setScene(null); o.renderer.diorama.snap?.();
            last = { ticks: r.frames.length, rows: v?.length ?? 0, result: r.esito ?? garaCorse.result(r.s), cancelled: !v, pista: r.s.pista };
            console.log(`[marea] gran premio ${v ? 'finito' : 'annullato'}: ${r.frames.length} tick, ${v?.length ?? 0} righe`);
            resolve(v);
          },
        };
        run = r;
        ruota.attiva(true);
        vista.mostra(s); vista.interfaccia(true);
        o.renderer.setScene(scene);
        document.body.classList.add('mz-gp'); pulsanti(true); quit.classList.add('on');
        ultimo = performance.now();
      });
    },
    isOpen: () => !!run || sc.classList.contains('on'),
    esito: (d) => {
      const n = (k: string) => (typeof d[k] === 'number' ? (d[k] as number) : 0);
      return n('giri') >= n('tot') && n('tot') > 0 ? `${n('pos')}° su 5 · ${tempoCorsa(n('ms'))} · giro migliore ${tempoCorsa(n('giro'))}` : 'Gara non finita';
    },
    step(f) {
      const r = run; if (!r || ruota.visibile()) return; // col telefono in verticale la gara aspetta (e non si registrano input)
      if (r.fase === 'gara') {
        for (let i = 0; i < r.speed && r.fase === 'gara'; i++) {
          const frame = quantize(r.auto ? pilotaGara(r.s) : comandi(f)); // quantizzato come nel replay del server
          r.frames.push(frame); garaCorse.step(r.s, frame);
          if (r.s.done) { r.fase = 'fine'; r.wait = END_WAIT; r.esito = garaCorse.result(r.s); vista.suoni.zitto(); suona(r.esito.detail['giri']! >= r.esito.detail['tot']! ? 'arrivo' : 'fine'); }
        }
        return;
      }
      r.wait--;
      if (r.wait <= 0 || (END_WAIT - r.wait > END_SKIP && f.a)) r.finish(packInputs(r.frames));
    },
    update() {
      const r = run; if (!r) return;
      setTopbarHidden(true); // main.ts la rimette a posto ogni frame prima di noi
      const now = performance.now(), dt = Math.min(0.1, (now - ultimo) / 1000); ultimo = now;
      vista.aggiorna(r.s, dt, { cam: scelta.cam, effetti: true, auto: r.auto, gasAuto: scelta.gasAuto, fine: r.fase === 'fine', ritirato: r.ritirato });
    },
  };

  registerStateProvider('corse', () => {
    const r = run;
    if (!r) return { active: false, scelta: sc.classList.contains('on'), last, pista: scelta.pista, veicolo: scelta.veicolo };
    const v = garaCorse.view(r.s) as GaraView, k = r.s.veicoli[0]!;
    return { active: true, fase: r.fase, auto: r.auto, pista: r.s.pista, veicolo: k.id, frames: r.frames.length, tick: r.s.tick, giro: v.giro, pos: v.posizioni[0], ms: v.ms, done: v.done, v: Math.round(k.v * 10) / 10, drift: k.drift, vista: vista.info(), last };
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
    sistema();
    return { ...scelta };
  });
  registerTestHook('corseVia', () => { (document.getElementById('mzGpVia') as HTMLButtonElement | null)?.click(); return !!chiudiScelta || !!run; });
  registerTestHook('corseEsci', () => { if (run) quitRun(); else chiudiScelta?.(null); return true; });
  return g;
}
