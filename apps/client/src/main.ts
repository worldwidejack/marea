// Avvio del client: renderer, mondo, ciclo a 60 Hz con interpolazione, test API. Unico modulo con side effect.
import { DT } from '@marea/sim';
import { FLAGS } from './flags.ts';
import { createRenderer } from './render/scene.ts';
import { createLoader } from './render/loader.ts';
import { createInput } from './game/input.ts';
import { createGameWorld } from './game/world.ts';
import { createHud } from './ui/hud.ts';
import { createCompass } from './ui/compass.ts';
import type { CompassTarget } from './ui/compass.ts';
import { createApi } from './net/api.ts';
import { createLotView } from './game/lot.ts';
import type { LotView } from './game/lot.ts';
import { installTestApi, registerPerfProvider, registerStateProvider, registerTestHook, setReady } from './test/testapi.ts';
import { runRegata, setupRegata } from './game/regata.ts';
import { createTavolo } from './ui/tavolo.ts';

const TAVOLO_R = 3.5; // m: quanto vicino al Tavolo per aprirlo con E / A

async function boot(): Promise<void> {
  installTestApi(__BUILD__);
  const canvas = document.getElementById('gl') as HTMLCanvasElement;
  const root = document.getElementById('ui') as HTMLElement;
  const hud = createHud({ root, flags: FLAGS });
  const renderer = createRenderer({ canvas, flags: FLAGS });
  registerPerfProvider(() => renderer.stats());
  const loader = await createLoader({ base: '/assets/' });
  const input = createInput({ canvas, root, cameraYaw: () => renderer.diorama.yaw });
  // chi sei e dove abiti (slot del lotto), prima del mondo: lo spawn è sul molo della tua isola
  const api = createApi({ token: FLAGS.token });
  const me = api.enabled && FLAGS.net ? await api.me().catch((e: Error) => { hud.banner?.(e.message); return null; }) : null;
  const owners = me ? await api.lots().catch(() => []) : [];
  const world = await createGameWorld({ renderer, loader, flags: FLAGS, hud, build: __BUILD__, slot: me ? me.slot ?? null : undefined }); // senza login: ?slot=N dall'URL (test), altrimenti Porto
  // il proprio lotto (azioni) e quelli degli altri (sola lettura)
  const lots: LotView[] = [];
  for (const l of world.archipelago.lots) {
    const mine = !!me && l.slot === world.slot;
    const other = owners.find((w) => w.slot === l.slot && w.id !== me?.id);
    if (!mine && !other) continue;
    lots.push(createLotView({
      scene: world.scene, loader, origin: l.origin, tile: world.archipelago.tile, api, hud, camera: renderer.camera, canvas,
      template: l.template, groundY: world.groundY, readonly: !mine, owner: other?.id, ownerName: other?.nome, initial: mine ? me?.lotto ?? null : null,
    }));
  }
  const arch = world.archipelago, targets: CompassTarget[] = [];
  if (world.slot !== null) targets.push({ id: 'casa', label: 'Casa', ...arch.spawnOf(world.slot) });
  targets.push({ id: 'porto', label: 'Porto', ...arch.spawnOf(null) });
  const lag = arch.places.find((p) => p.role === 'laguna');
  if (lag) targets.push({ id: 'laguna', label: 'Laguna', x: (lag.origin[0] + lag.w / 2) * arch.tile, z: (lag.origin[1] + lag.h / 2) * arch.tile });
  const compass = createCompass({ root, targets });
  // Regata e Tavolo: E (o A) vicino al Tavolo del Porto apre il pannello; in gara la barca la muove la sim, l'avatar sta fermo.
  const regata = await setupRegata({ world, loader, hud, root, cameraYaw: () => renderer.diorama.yaw });
  const tavoloAt = arch.buildings.find((b) => b.kind === 'tavolo') ?? null;
  let closedAt = 0, nearWas = false, aWasT = false;
  const tavolo = me && api.enabled ? createTavolo({ api, me, root, play: (challenge) => runRegata({ challenge }), onClose: () => { closedAt = performance.now(); } }) : null;
  const nearTavolo = () => !!tavoloAt && world.mode === 'walk' && !world.race.on && Math.hypot(world.avatar.state.x - tavoloAt.x, world.avatar.state.z - tavoloAt.z) < TAVOLO_R;
  const openTavolo = () => {
    // un pannello alla volta: il foglio del lotto (#mzSheet) si chiude col suo bottone, così la vista del lotto lo sa
    if (tavolo) { document.querySelector<HTMLElement>('#mzSheet.on .mz-x')?.click(); if (!tavolo.isOpen()) tavolo.open(); return true; }
    hud.toast(me ? 'Il Tavolo delle Sfide arriva presto' : 'Per sfidare serve il tuo link personale', 2500);
    return false;
  };
  /** Un tick: vicino al Tavolo, A/E/Spazio (fronte di salita) lo apre; il suggerimento compare quando ci arrivi. */
  const tickTavolo = (a: boolean) => {
    const pressA = a && !aWasT; aWasT = a;
    const near = nearTavolo(), open = !!tavolo?.isOpen();
    if (near && !nearWas && !open) hud.toast('E · Tavolo delle Sfide', 2500);
    nearWas = near;
    if (near && pressA && !open && performance.now() - closedAt > 400) openTavolo();
  };
  registerStateProvider('tavolo', () => ({ exists: !!tavolo, near: nearTavolo(), open: !!tavolo?.isOpen(), at: tavoloAt ? { x: tavoloAt.x, z: tavoloAt.z } : null }));
  registerTestHook('openTavolo', () => openTavolo());
  let last = performance.now(), acc = 0, t = 0;
  const frame = (now: number) => {
    const dt = Math.min(0.1, (now - last) / 1000); last = now; acc += dt; t += dt;
    let steps = 0;
    while (acc >= DT && steps < 5) {
      const f = input.sample();
      if (regata.active) regata.step(f); else tickTavolo(f.a);
      world.frozen = !!tavolo?.isOpen() && !regata.active;
      world.step(f); acc -= DT; steps++;
    }
    if (steps === 5) acc = 0;
    world.update(acc / DT, dt, t);
    regata.update(acc / DT, dt, t);
    if (tavolo?.isOpen() && document.querySelector('#mzSheet.on')) tavolo.close(); // aperto un edificio: il Tavolo lascia il posto
    const focus = world.mode === 'walk' ? world.avatar.state : world.boat.state;
    for (const lv of lots) lv.update(dt, focus); // rilettura ogni 30 s solo per l'isola dove sei; timer ed etichette ogni frame
    compass.update(focus, renderer.diorama.yaw);
    renderer.render(acc / DT, t);
    hud.setPerf(renderer.stats());
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  // chiusura pulita della rete (il server vede subito il leave); tornando indietro dalla cache del browser si riparte da capo
  addEventListener('pagehide', () => { for (const lv of lots) lv.dispose(); world.dispose(); });
  addEventListener('pageshow', (e) => { if (e.persisted) location.reload(); });
  setReady();
  hud.toast(me ? `Ciao ${me.nome}` : 'MAREA', 2500);
  console.log(`[marea] build ${__BUILD__} · isola ${world.map.id} ${world.map.w}×${world.map.h}`);
}
boot().catch((e) => { console.error('[marea] avvio fallito', e); document.body.insertAdjacentHTML('beforeend', `<pre style="color:#F4E3C1;padding:16px">Qualcosa è andato storto all'avvio.\n${String(e)}</pre>`); });
