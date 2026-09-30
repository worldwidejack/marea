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
import { AVATAR, ISLANDS } from '@marea/content';
import type { EmoteId } from '@marea/protocol';
import { createEditor } from './ui/editor.ts';
import { createFeed } from './ui/feed.ts';
import { createEmotes } from './game/emote.ts';
import { setTopbarHidden } from './ui/topbar.ts';
import { createMinigiochi } from './game/minigiochi.ts';
import { createGuida } from './ui/guida.ts';
import type { GuidaStep } from './ui/guida.ts';

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
  let guideStep: string | null = null; // passo corrente della guida «Primi passi» (serve al lotto per lo slot suggerito)
  const world = await createGameWorld({ renderer, loader, flags: FLAGS, hud, build: __BUILD__, slot: me ? me.slot ?? null : undefined, ...(me ? { look: me.look } : {}) }); // senza login: ?slot=N dall'URL (test), altrimenti Porto
  renderer.diorama.setZoom(1.6); // si parte larghi: l'isola e i suoi cartelli si vedono subito
  // il proprio lotto (azioni) e quelli degli altri (sola lettura); la guida suggerisce dove costruire la Segheria
  const lots: LotView[] = [];
  const HIDE = FLAGS.sfide ? [] : ['tavolo']; // senza sfide con posta il Tavolo sull'isola non serve
  const segCell = ISLANDS.find((i) => i.id === 'lotto')?.slots?.find((sl) => sl.kind === 'segheria')?.at ?? null;
  const myLot = () => lots.find((lv) => !lv.readonly)?.state() ?? null;
  const freeCell = (prefer: readonly [number, number] | null): [number, number] | null => {
    const l = myLot(), tpl = ISLANDS.find((i) => i.id === 'lotto');
    if (!l || !tpl) return null;
    const busy = (c: readonly [number, number]) => l.buildings.some((b) => b.cell[0] === c[0] && b.cell[1] === c[1]) || l.decor.some((d) => d.cell[0] === c[0] && d.cell[1] === c[1]);
    if (prefer && !busy(prefer)) return [prefer[0], prefer[1]];
    const sl = (tpl.slots ?? []).find((x) => !busy(x.at) && x.kind !== 'tavolo');
    return sl ? [sl.at[0], sl.at[1]] : null;
  };
  const hint = (): { cell: [number, number]; building: string } | null => {
    if (guideStep !== 'segheria') return null;
    const c = freeCell(segCell);
    return c ? { cell: c, building: 'segheria' } : null;
  };
  for (const l of world.archipelago.lots) {
    const mine = !!me && l.slot === world.slot;
    const other = owners.find((w) => w.slot === l.slot && w.id !== me?.id);
    if (!mine && !other) continue;
    lots.push(createLotView({
      scene: world.scene, loader, origin: l.origin, tile: world.archipelago.tile, api, hud, camera: renderer.camera, canvas,
      template: l.template, groundY: world.groundY, readonly: !mine, owner: other?.id, ownerName: other?.nome, initial: mine ? me?.lotto ?? null : null,
      ...(mine ? { hint, hide: HIDE } : {}),
    }));
  }
  const arch = world.archipelago, targets: CompassTarget[] = [];
  if (world.slot !== null) targets.push({ id: 'casa', label: 'Casa', icon: 'casa', ...arch.spawnOf(world.slot) });
  targets.push({ id: 'porto', label: 'Porto', icon: 'porto', ...arch.spawnOf(null) });
  // Regata e Tavolo: E (o A) vicino al Tavolo del Porto apre il pannello; in gara la barca la muove la sim, l'avatar sta fermo.
  const regata = await setupRegata({ world, loader, hud, root, cameraYaw: () => renderer.diorama.yaw });
  // minigiochi da solo: ognuno al suo posto (la Regata al molo della Laguna), premio in risorse deciso dal server
  const giochi = createMinigiochi({ world, loader, api: me && api.enabled ? api : null, hud, root, camera: renderer.camera, canvas, onLot: () => refreshMyLot() });
  for (const sp of giochi.spots) targets.push({ id: sp.id, label: sp.nome, icon: 'regata', x: sp.x, z: sp.z });
  const compass = createCompass({ root, targets });
  const tavoloAt = arch.buildings.find((b) => b.kind === 'tavolo') ?? null;
  let closedAt = 0, nearWas = false, aWasT = false;
  /** Risorse cambiate fuori dal lotto (posta, esito di una sfida): la barra si aggiorna subito, non al poll dei 30 s. */
  const refreshMyLot = () => { void lots.find((lv) => !lv.readonly)?.refresh(); };
  const tavolo = FLAGS.sfide && me && api.enabled ? createTavolo({ api, me, root, play: (challenge) => runRegata({ challenge }), onClose: () => { closedAt = performance.now(); }, onLot: refreshMyLot }) : null;
  const nearTavolo = () => !!tavoloAt && world.mode === 'walk' && !world.race.on && Math.hypot(world.avatar.state.x - tavoloAt.x, world.avatar.state.z - tavoloAt.z) < TAVOLO_R;
  const openTavolo = () => {
    // un pannello alla volta: il foglio del lotto (#mzSheet) si chiude col suo bottone, così la vista del lotto lo sa
    if (tavolo) { document.querySelector<HTMLElement>('#mzSheet.on .mz-x')?.click(); if (!tavolo.isOpen()) tavolo.open(); return true; }
    hud.toast(me ? 'Le sfide con gli amici arrivano presto' : 'Per sfidare serve il tuo link personale', 2500);
    return false;
  };
  /** Un tick: vicino al Tavolo, A/E/Spazio (fronte di salita) lo apre; il suggerimento compare quando ci arrivi. */
  const tickTavolo = (a: boolean) => {
    const pressA = a && !aWasT; aWasT = a;
    if (!tavolo) return; // sfide con posta spente: il Tavolo del Porto è solo un edificio
    const near = nearTavolo(), open = tavolo.isOpen();
    if (near && !nearWas && !open) hud.toast('E · Tavolo delle Sfide', 2500);
    nearWas = near;
    if (near && pressA && !open && performance.now() - closedAt > 400) openTavolo();
  };
  registerStateProvider('tavolo', () => ({ exists: !!tavolo, near: nearTavolo(), open: !!tavolo?.isOpen(), at: tavoloAt ? { x: tavoloAt.x, z: tavoloAt.z } : null }));
  registerTestHook('openTavolo', () => openTavolo());
  // F3 (CONTRACTS §13): editor dell'avatar (C), feed (F), emote (1-4). Un pannello alla volta; niente con Tavolo aperto, foglio del lotto o gara.
  const editor = me && api.enabled ? createEditor({ api, me, root, avatar: { setLook: (l) => world.setLook(l) }, onSaved: () => hud.toast('Look salvato'), onLot: refreshMyLot }) : null;
  const feed = FLAGS.sfide && me && api.enabled ? createFeed({ api, hud, root, onNews: (news) => { if (news.some((n) => n.tipo !== 'sfida_ricevuta' && n.tipo !== 'sfida_accettata')) refreshMyLot(); } }) : null;
  const emotes = createEmotes({ world, camera: renderer.camera, canvas, root });
  const EMOTES = AVATAR.emote as EmoteId[];
  const panelsBusy = () => !!tavolo?.isOpen() || !!document.querySelector('#mzSheet.on') || regata.active || giochi.isBusy();
  const openEditor = () => { if (!editor || panelsBusy()) return false; feed?.close(); editor.open(); return true; };
  const openFeed = () => { if (!feed || panelsBusy()) return false; editor?.close(); feed.open(); return true; };
  // Un solo listener in bubble: i pannelli aperti fermano il keydown in capture, quindi qui arrivano solo i tasti «liberi».
  addEventListener('keydown', (e) => {
    if (e.repeat || e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.code === 'KeyC') { if (editor?.isOpen()) editor.close(); else openEditor(); return; }
    if (e.code === 'KeyF') { if (feed?.isOpen()) feed.close(); else openFeed(); return; }
    const m = /^(?:Digit|Numpad)([1-4])$/.exec(e.code);
    if (m && !panelsBusy() && !editor?.isOpen() && !feed?.isOpen()) { const id = EMOTES[Number(m[1]) - 1]; if (id) emotes.play(id); }
  });
  registerTestHook('openEditor', () => openEditor());
  registerTestHook('openFeed', () => openFeed());
  registerTestHook('emote', (id) => emotes.play(String(id) as EmoteId));
  // guida «Primi passi»: costruire → barca → minigioco → costruire col premio. Senza isola propria restano barca e minigioco.
  const home = world.slot !== null ? arch.spawnOf(world.slot) : null, homeDock = world.slot !== null ? arch.boatOf(world.slot) : null;
  const hasLot = !!me && world.slot !== null && lots.some((lv) => !lv.readonly);
  const cellTarget = (c: [number, number] | null) => { if (!c || world.slot === null) return null; const w = arch.lotCellToWorld(world.slot, c); return { x: w.x, y: world.groundY(w.x, w.z) + 1.2, z: w.z }; };
  const giocate = () => (myLot()?.solo?.giocate ?? 0) + giochi.played();
  const reg = giochi.spots[0] ?? null;
  const steps: GuidaStep[] = [
    ...(hasLot ? [{ id: 'segheria', titolo: 'Costruisci la Segheria', come: 'Tocca il cartello giallo sulla tua isola: la Segheria fa Legno anche quando non giochi.', done: () => !!myLot()?.buildings.some((b) => b.building === 'segheria'), target: () => cellTarget(hint()?.cell ?? null) }] : []),
    { id: 'barca', titolo: 'Sali in barca', come: 'Cammina fino alla barca e premi A: con la barca vai sulle altre isole.', done: () => world.mode === 'boat' || giocate() > 0, target: () => { const p = world.boat.object.position; return { x: p.x, y: 1.8, z: p.z }; } },
    ...(reg ? [{ id: reg.id, titolo: `Vai alla ${reg.nome}`, come: 'Segui la freccia gialla fino alla bandiera e gioca: con una medaglia vinci Legno, Pietra e Perle.', done: () => giocate() > 0, target: () => ({ x: reg.x, y: 4, z: reg.z }) }] : []),
    ...(hasLot ? [{ id: 'costruisci', titolo: 'Costruisci col premio', come: 'Torna a casa e tocca un cartello: Cava, Magazzino, Casa, Faro.', done: () => (myLot()?.buildings.filter((b) => b.building !== 'molo' && b.building !== 'segheria').length ?? 0) > 0, target: () => {
      const f = world.mode === 'walk' ? world.avatar.state : world.boat.state;
      if (home && homeDock && Math.hypot(f.x - home.x, f.z - home.z) > 45) return { x: homeDock.x, y: 2, z: homeDock.z };
      return cellTarget(freeCell(null));
    } }] : []),
  ];
  const guida = createGuida({
    root, camera: renderer.camera, canvas, steps, storeKey: `marea:guida:${me?.id ?? 'ospite'}`,
    hidden: () => regata.active || giochi.isBusy() || !!tavolo?.isOpen() || !!editor?.isOpen() || !!feed?.isOpen(),
    onFocus: (id) => compass.focus(id === 'segheria' || id === 'costruisci' ? 'casa' : id === 'barca' ? null : id),
  });
  let last = performance.now(), acc = 0, t = 0;
  const frame = (now: number) => {
    const dt = Math.min(0.1, (now - last) / 1000); last = now; acc += dt; t += dt;
    let steps = 0;
    while (acc >= DT && steps < 5) {
      const f = input.sample();
      if (regata.active) regata.step(f); else { tickTavolo(f.a); giochi.tick(f.a); }
      world.frozen = (!!tavolo?.isOpen() || !!editor?.isOpen() || !!feed?.isOpen() || giochi.isBusy()) && !regata.active;
      world.step(f); acc -= DT; steps++;
    }
    if (steps === 5) acc = 0;
    world.update(acc / DT, dt, t);
    regata.update(acc / DT, dt, t);
    emotes.update(dt); setTopbarHidden(regata.active);
    giochi.update(t); guideStep = guida.current(); guida.update(t);
    if (document.querySelector('#mzSheet.on')) { if (tavolo?.isOpen()) tavolo.close(); editor?.close(); feed?.close(); } // aperto un edificio: gli altri pannelli lasciano il posto
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
