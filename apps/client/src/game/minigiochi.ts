// Minigiochi da solo (senza posta): ogni minigioco ha il suo posto su un'isola (la Regata al molo della Laguna, il via della gara;
// Scacco in 3 al Tavolo del Porto, quando le sfide con posta sono spente: ti siedi e si apre la scacchiera, niente premio;
// i «giochi a schermo» (SCHERMI: una schermata sopra il mondo, premio come la Regata) si scaricano solo quando parte la partita).
// Le Lanterne (#7) sono state tolte l'8 ott 2026 (Jack: «fa cagare»).
// Minigiochi universali (GDD §3): Consegne (in barca, nel mondo) e Ingorgo (a schermo) su ogni molo con un posto in content, a piedi.
// Nel mondo: boa grande e cartello «REGATA» che si vede da lontano; vicino compare il bottone GIOCA (A / E / Spazio sulla tastiera).
// Il seed lo sceglie il server, che poi rigioca gli input, decide la medaglia e paga il premio (balance.solo: Legno, Pietra, Perle).
// Alla fine una scheda con l'esito, il premio che vola nella barra e RIGIOCA.
import * as THREE from 'three';
import { MINIGAMES_CFG, SCACCHI } from '@marea/content';
import type { ArchPlace, Medal, Resources } from '@marea/sim';
import type { GameWorld } from './world.ts';
import type { Loader } from '../render/loader.ts';
import type { Hud } from '../ui/hud.ts';
import type { Api, SoloResult } from '../net/api.ts';
import { ApiError } from '../net/api.ts';
import { runRegata } from './regata.ts';
import { PAL, el, injectUiStyle } from '../ui/style.ts';
import { RES_IDS, pixIcon, resIcon } from '../ui/icons.ts';
import type { PixId } from '../ui/icons.ts';
import type { Scacchi } from '../ui/scacchi.ts';
import type { InputFrame, PackedInputs } from '@marea/sim';
import { createLabelLayer, flyResources, LABEL_NEAR_M } from '../ui/sheet.ts';
import { registerStateProvider, registerTestHook } from '../test/testapi.ts';
import { createPostoPesca } from './pesca.ts';
import { suona } from '../audio/ponte.ts';
import { createPostoPerle } from './perle.ts'; // Perle
import { temaAperta } from './temi.ts'; // Ghiacci e Giardino

/** `opzioni` = parametri della partita per il server (es. il mare della pesca); `posto` = molo dove si gioca ('porto', 'lotto:N':
 *  lo riceve il gioco); `aPiedi` = parte solo a piedi (in barca A accelera); `vista` = il cartello si vede solo entro tanti metri;
 *  `mete: false` = non va nella bussola; `model` = modello del manifest sul posto; `aperta` = il posto c'è solo quando è vera (minigiochi
 *  delle isole a tema: Ghiacci, Giardino), anche nella bussola. */
export type Spot = { id: string; nome: string; minigame: string; x: number; z: number; icon: PixId; near: number; boa: boolean; opzioni?: Record<string, string>; posto?: string; aPiedi?: boolean; vista?: number; mete?: boolean; model?: string; aperta?: () => boolean };
export type Minigiochi = {
  readonly spots: readonly Spot[];
  /** Un tick (60 Hz): vicino a un posto, il fronte di salita di A fa partire la partita. `f` = l'input intero (giochi in barca). */
  tick(a: boolean, f?: InputFrame): void;
  /** Ogni frame: boa, cartello, bottone. */
  update(t: number): void;
  /** Scheda dell'esito aperta o partita che sta partendo: il mondo sta fermo. */
  isBusy(): boolean;
  /** Partite finite in questa sessione (per la guida). */
  played(): number;
};

const NEAR_M = 16;
/** Gioco a schermo: la sua schermata sopra il mondo, restituisce gli input da far rigiocare al server (null = ritirato).
 *  `posto` = il molo dello spot. Un gioco che si gioca nel mondo (Consegne, in barca) ha anche `step` (un tick con l'input intero,
 *  mentre è aperto) e `update` (ogni frame). */
export type SchermoGioco = {
  run(o: { seed: number; difficulty: number; opzioni?: Record<string, string>; posto?: string }): Promise<PackedInputs | null>; isOpen(): boolean; esito?(detail: Record<string, unknown>): string;
  step?(f: InputFrame): void; update?(t: number): void;
};
/** I giochi a schermo per id del minigioco, scaricati alla prima partita (il JS iniziale ha un tetto, TECH §5). */
const SCHERMI: Record<string, (root: HTMLElement) => Promise<SchermoGioco>> = {};
/** Registra un gioco a schermo (dal modulo del minigioco: posto in `spots` più schermata qui). */
export function registraSchermo(id: string, load: (root: HTMLElement) => Promise<SchermoGioco>): void { SCHERMI[id] = load; }
const MEDAL_TXT: Record<string, string> = { oro: 'ORO', argento: 'ARGENTO', bronzo: 'BRONZO' };
const MEDAL_C: Record<string, string> = { oro: PAL.giallo, argento: PAL.pietraChiara, bronzo: PAL.arancio };
const CSS = `
.mz-play { position: absolute; left: 50%; top: 60%; transform: translateX(-50%); display: none; align-items: center; gap: 10px; min-height: 56px; padding: 0 18px; background: ${PAL.arancio}; color: ${PAL.neroCaldo}; border: 3px solid ${PAL.neroCaldo}; box-shadow: 0 5px 0 ${PAL.neroCaldo}; font: bold 18px ui-monospace, Menlo, monospace; z-index: 16; cursor: pointer; white-space: nowrap; }
.mz-play.on { display: flex; }
.mz-play:active { transform: translate(-50%, 3px); box-shadow: 0 2px 0 ${PAL.neroCaldo}; }
.mz-play small { font-size: 12px; opacity: .8; }
.mz-lbl.spot { border-color: ${PAL.rosso}; font-size: 15px; min-height: 34px; }
.mz-esito { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); width: min(340px, calc(100% - 32px)); display: none; padding: 16px; background: rgba(46,30,20,.97); border: 3px solid ${PAL.legnoChiaro}; box-shadow: 0 5px 0 ${PAL.neroCaldo}; z-index: 22; text-align: center; }
.mz-esito.on { display: block; }
.mz-esito h2 { margin: 0 0 4px; font-size: 34px; letter-spacing: .06em; }
.mz-esito .sub { color: ${PAL.sabbia}; font-size: 14px; margin-bottom: 12px; }
.mz-esito .premio { display: flex; justify-content: center; gap: 12px; flex-wrap: wrap; font-size: 20px; font-weight: bold; margin: 8px 0 4px; }
.mz-esito .premio span { display: inline-flex; align-items: center; gap: 6px; }
`;

export function createMinigiochi(o: { world: GameWorld; loader: Loader; api: Api | null; hud: Hud; root: HTMLElement; camera: THREE.Camera; canvas: HTMLCanvasElement; onLot(): void; tavolo?: { x: number; z: number } | null }): Minigiochi {
  injectUiStyle();
  if (!document.getElementById('mz-minigiochi-style')) { const st = document.createElement('style'); st.id = 'mz-minigiochi-style'; st.textContent = CSS; document.head.appendChild(st); }
  const arch = o.world.archipelago;
  // la Regata parte dal molo (B) dell'isola del percorso
  const cfg = MINIGAMES_CFG.regata, lag = arch.places.find((p) => p.island === cfg.course.island) ?? arch.places.find((p) => p.role === 'laguna');
  const spots: Spot[] = lag ? [{ id: 'regata', nome: cfg.nome, minigame: 'regata', x: lag.boat.x, z: lag.boat.z, icon: 'regata', near: NEAR_M, boa: true }] : [];
  if (o.tavolo) spots.push({ id: 'scacchi', nome: SCACCHI.nome, minigame: 'scacchi', x: o.tavolo.x, z: o.tavolo.z, icon: 'scacchi', near: 5, boa: false });
  /** Molo di un'isola, come lo chiamano i minigiochi universali: 'porto', 'laguna', 'lotto:N'. */
  const moloDi = (p: ArchPlace) => (p.role === 'lotto' ? `lotto:${p.slot}` : p.role);
  /** Posto di un minigioco universale su ogni isola che ne ha uno in content (`posti`: cella locale per id dell'isola). */
  const universali = (minigame: 'consegne' | 'ingorgo', icon: PixId, model?: string) => {
    const c = MINIGAMES_CFG[minigame];
    for (const p of arch.places) {
      const at = c.posti[p.island];
      if (!at) continue;
      spots.push({
        id: `${minigame}:${moloDi(p)}`, nome: c.nome, minigame, x: (p.origin[0] + at[0] + 0.5) * arch.tile, z: (p.origin[1] + at[1] + 0.5) * arch.tile,
        icon, near: 3, boa: false, posto: moloDi(p), aPiedi: true, vista: 45, mete: p.role === 'porto', ...(model ? { model } : {}),
      });
    }
  };
  // Consegne (minigioco universale): il corriere sta su ogni molo (Porto e lotti), a piedi, lontano dalla barca; nella bussola solo quello
  // del Porto. Si gioca in barca nel mondo (game/consegne.ts, gioco «a schermo» con step/update), scaricato alla prima partita.
  universali('consegne', 'consegne', 'prop_cassa');
  registraSchermo('consegne', (root) => import('./consegne.ts').then((m) => m.createConsegne({ root, world: o.world, loader: o.loader, hud: o.hud, camera: o.camera, canvas: o.canvas, api: o.api })));
  // Ingorgo (minigioco universale): sull'altro lato di ogni molo; schermata a pixel (ui/ingorgo.ts) scaricata alla prima partita.
  universali('ingorgo', 'ingorgo', 'prop_barile');
  registraSchermo('ingorgo', (root) => import('../ui/ingorgo.ts').then((m) => m.createIngorgo({ root })));
  /** Posto del minigioco di un'isola a tema: la cella `posto` (locale) dell'isola `isola` del suo json; c'è solo quando l'isola è aperta
   *  (regola di @marea/sim/world/temi.ts, via game/temi.ts), a piedi, nella bussola solo da aperta. */
  const diIsola = (minigame: string, icon: PixId) => {
    const c = (MINIGAMES_CFG as unknown as Record<string, { nome: string; isola?: string; posto?: [number, number] }>)[minigame];
    const p = c?.isola && c.posto ? arch.places.find((q) => q.island === c.isola) : undefined;
    if (!c || !p || !c.posto) return;
    const isola = p.island;
    spots.push({
      id: `${minigame}:${isola}`, nome: c.nome, minigame, x: (p.origin[0] + c.posto[0] + 0.5) * arch.tile, z: (p.origin[1] + c.posto[1] + 0.5) * arch.tile,
      icon, near: 3, boa: false, aPiedi: true, vista: 50, aperta: () => temaAperta(isola),
    });
  };
  // Ghiacci: Pinguini sul ghiaccio, vicino agli igloo; schermata a pixel (ui/pinguini.ts) scaricata alla prima partita
  diIsola('pinguini', 'pinguini');
  registraSchermo('pinguini', (root) => import('../ui/pinguini.ts').then((m) => m.createPinguini({ root })));
  // fine Ghiacci
  // Giardino: Carpe koi, sul ponticello rosso dello stagno; schermata a pixel (ui/koi.ts) scaricata alla prima partita
  diIsola('koi', 'koi');
  registraSchermo('koi', (root) => import('../ui/koi.ts').then((m) => m.createKoi({ root })));
  // fine Giardino
  // Tempesta: Arrembaggio, il cannone sul promontorio del faro in rovina; schermata a pixel (ui/arrembaggio.ts) scaricata alla prima partita
  diIsola('arrembaggio', 'arrembaggio');
  registraSchermo('arrembaggio', (root) => import('../ui/arrembaggio.ts').then((m) => m.createArrembaggio({ root })));
  // fine Tempesta
  // Vulcano: Fuga dalla lava, tra le capanne e il cratere; schermata a pixel (ui/lava.ts) scaricata alla prima partita
  diIsola('lava', 'lava');
  registraSchermo('lava', (root) => import('../ui/lava.ts').then((m) => m.createLava({ root })));
  // fine Vulcano
  let chClosedAt = 0, scacchi: Scacchi | null = null;
  const schermi = new Map<string, SchermoGioco>();
  /** Una schermata (scacchi o gioco a schermo) è aperta: il mondo sta fermo. */
  const schermoAperto = () => !!scacchi?.isOpen() || [...schermi.values()].some((g) => g.isOpen());

  // ---- nel mondo: boa grande al via + cartello DOM che si vede anche da lontano ----
  const group = new THREE.Group(); group.name = 'minigiochi'; o.world.scene.add(group);
  const layer = createLabelLayer(o.root);
  const marks = spots.map((s) => {
    const holder = new THREE.Group(); holder.name = 'spot_' + s.id; holder.position.set(s.x, 0, s.z); holder.scale.setScalar(s.boa ? 1.8 : 1.2); group.add(holder);
    const name = s.model && o.loader.has(s.model) ? s.model : s.boa && o.loader.has('prop_boa_next') ? 'prop_boa_next' : null;
    if (name) void o.loader.load(name).then((g) => holder.add(g.scene)).catch(() => {});
    const label = layer.add(() => { void play(s); });
    label.set('bubble', [pixIcon(s.icon, 16), el('span', '', s.nome.toUpperCase())], 'spot');
    label.el.classList.add('spot');
    return { s, holder, label };
  });

  // ---- bottone GIOCA (vicino al posto) e scheda dell'esito ----
  const btn = el('button', 'mz mz-play'); btn.id = 'mzPlay'; btn.type = 'button';
  const esito = el('div', 'mz mz-esito'); esito.id = 'mzEsito';
  for (const e of [btn, esito]) for (const ev of ['pointerdown', 'touchstart']) e.addEventListener(ev, (x) => x.stopPropagation());
  o.root.append(btn, esito);
  let near: Spot | null = null, nearWas: Spot | null = null, aWas = false, busy = false, open = false, playedN = 0, last: (SoloResult & { spot: string }) | null = null, esitoSpot: Spot | null = null;
  btn.addEventListener('click', () => { if (near) void play(near); });

  const v = new THREE.Vector3();
  const screenOf = (x: number, y: number, z: number) => {
    v.set(x, y, z).project(o.camera);
    const r = o.canvas.getBoundingClientRect(), rr = o.root.getBoundingClientRect();
    return { x: r.left - rr.left + ((v.x + 1) / 2) * r.width, y: r.top - rr.top + ((1 - v.y) / 2) * r.height, on: v.z < 1 && Math.abs(v.x) < 1.05 && Math.abs(v.y) < 1.05 };
  };

  function closeEsito(): void { if (!open) return; open = false; esito.classList.remove('on'); removeEventListener('keydown', onKey, true); }
  const onKey = (e: KeyboardEvent) => {
    if (!open) return;
    if (['Enter', 'Space', 'Escape', 'KeyE'].includes(e.code)) { e.preventDefault(); e.stopImmediatePropagation(); closeEsito(); }
    else if (e.code === 'KeyR') { e.preventDefault(); e.stopImmediatePropagation(); const s = esitoSpot ?? spots.find((x) => x.id === last?.spot) ?? spots[0]; closeEsito(); if (s) void play(s); }
  };
  function showEsito(s: Spot, medal: Medal, sub: string, premio: Resources | null, note: string | null): void {
    esitoSpot = s; // RIGIOCA (R) rigioca questo, anche se il posto è mobile (pesca)
    const title = el('h2', '', medal ? MEDAL_TXT[medal]! : SCHERMI[s.minigame] ? 'FINITA' : 'ARRIVATO');
    title.style.color = medal ? MEDAL_C[medal]! : PAL.sabbiaChiara;
    esito.style.borderColor = medal ? MEDAL_C[medal]! : PAL.legnoChiaro;
    const body: Node[] = [title, el('div', 'sub', sub)];
    if (premio) {
      const row = el('div', 'premio');
      for (const id of RES_IDS) if (premio[id] > 0) { const c = el('span'); c.append(resIcon(id, 24), el('b', '', `+${premio[id]}`)); row.appendChild(c); }
      if (row.childElementCount) body.push(row);
    }
    if (note) body.push(el('div', 'sub', note));
    const r = el('div', 'mz-row');
    const again = el('button', 'mz-btn ghost', 'RIGIOCA'); again.dataset['act'] = 'rigioca';
    again.addEventListener('click', () => { closeEsito(); void play(s); });
    const ok = el('button', 'mz-btn', 'OK'); ok.dataset['act'] = 'ok';
    ok.addEventListener('click', () => closeEsito());
    r.append(again, ok); body.push(r);
    esito.replaceChildren(...body);
    esito.classList.add('on'); open = true;
    suona(medal ? `medaglia_${medal}` : 'fine');
    addEventListener('keydown', onKey, true);
  }
  function fly(premio: Resources): void {
    const from = { x: o.root.clientWidth / 2, y: o.root.clientHeight / 2 };
    for (const id of RES_IDS) if (premio[id] > 0) flyResources(o.root, from, o.hud.resAnchor?.(id) ?? null, id, premio[id], () => o.hud.bump?.(id));
  }

  async function play(s: Spot): Promise<void> {
    if (busy || open || o.world.race.on || schermoAperto()) return;
    if (s.aperta && !s.aperta()) return; // Ghiacci e Giardino: isola ancora chiusa
    if (s.minigame === 'scacchi') {
      btn.classList.remove('on');
      if (performance.now() - chClosedAt <= 400) return;
      busy = true;
      try { scacchi ??= (await import('../ui/scacchi.ts')).createScacchi({ root: o.root, onClose: () => { chClosedAt = performance.now(); } }); playedN++; scacchi.open(); }
      catch { o.hud.toast('Scacchiera non caricata: riprova', 2500); }
      finally { busy = false; }
      return;
    }
    busy = true; btn.classList.remove('on');
    try {
      let seed = 0, difficulty = 2, opzioni = s.opzioni;
      const online = !!o.api?.enabled;
      if (online) {
        try { const st = await o.api!.soloStart(s.minigame, s.opzioni); seed = st.seed; difficulty = st.difficulty; if (s.opzioni) opzioni = st.opzioni; }
        catch (e) { o.hud.toast(e instanceof ApiError ? e.message : 'Niente connessione, riprova tra poco', 3000); return; }
      } else seed = (Math.random() * 0x7fffffff) >>> 0; // senza link si gioca lo stesso, ma il premio non si salva
      busy = false; // da qui la gara tiene fermo il mondo da sé
      const load = SCHERMI[s.minigame];
      let schermo: SchermoGioco | null = null;
      if (load) {
        schermo = schermi.get(s.minigame) ?? null;
        if (!schermo) { try { schermo = await load(o.root); schermi.set(s.minigame, schermo); } catch { o.hud.toast('Gioco non caricato: riprova', 2500); return; } }
      }
      const inputs = schermo ? await schermo.run({ seed, difficulty, ...(opzioni ? { opzioni } : {}), ...(s.posto ? { posto: s.posto } : {}) }) : await runRegata({ challenge: { id: 'solo', minigame: s.minigame, difficulty, seed } });
      if (!inputs) { o.hud.toast('Ritirato', 1500); return; }
      if (!online) { playedN++; showEsito(s, null, 'Partita di prova', null, 'Con il tuo link personale vinci Legno, Pietra e Perle'); return; }
      busy = true;
      try {
        const r = await o.api!.soloPlay(inputs);
        playedN++; last = { ...r, spot: s.id };
        const secs = typeof r.detail['ms'] === 'number' ? ` · ${(r.detail['ms'] / 1000).toFixed(1)} s` : '';
        const extra = schermo?.esito?.(r.detail);
        const sub = extra ? `${s.nome} · ${extra}` : `${s.nome}${secs}`;
        showEsito(s, r.medal, sub, r.premiata ? r.premio : null, r.premiata ? null : 'Per oggi i premi sono finiti: domani si riparte');
        if (r.premiata) fly(r.premio);
        o.onLot();
      } catch (e) {
        o.hud.toast(e instanceof ApiError ? e.message : 'Partita non salvata, riprova', 3200);
      }
    } finally { busy = false; }
  }

  // ---- Pesca (#66): minigioco universale, posto mobile (in barca, ferma, in mare aperto): bottone PESCA e tasto P in game/pesca.ts;
  // la schermata (ui/pesca.ts) si scarica alla prima partita. Non sta in `spots` (niente boa, niente riga nella bussola).
  registraSchermo('pesca', (root) => import('../ui/pesca.ts').then((m) => m.createPesca({ root })));
  const pesca = createPostoPesca({ world: o.world, root: o.root, hud: o.hud, libero: () => !(busy || open || o.world.race.on || schermoAperto()), gioca: (sp) => { void play(sp); } });
  // Perle: minigioco universale, posto mobile (in barca, ferma, su acqua bassa vicino a una costa, lontano dai moli): bottone TUFFATI e
  // tasto T in game/perle.ts; la schermata (ui/perle.ts) si scarica alla prima partita. Non sta in `spots` (niente boa né bussola).
  registraSchermo('perle', (root) => import('../ui/perle.ts').then((m) => m.createPerle({ root })));
  const perle = createPostoPerle({ world: o.world, root: o.root, hud: o.hud, libero: () => !(busy || open || o.world.race.on || schermoAperto() || near), gioca: (sp) => { void play(sp); } });
  // fine Perle

  registerStateProvider('minigiochi', () => ({ spots, near: near?.id ?? null, busy, open, played: playedN, last }));
  registerTestHook('playSpot', (id) => { const s = spots.find((x) => x.id === String(id ?? 'regata')); if (s) void play(s); return !!s; });
  registerTestHook('closeEsito', () => { closeEsito(); return true; });
  /** Test: a piedi davanti al posto di un minigioco (isole a tema comprese). Tempesta e Vulcano */
  registerTestHook('spotVai', (id) => {
    const s = spots.find((x) => x.id === String(id)); if (!s) return null;
    (window as unknown as { __game: { test: Record<string, (...a: unknown[]) => unknown> } }).__game.test['setMode']?.('walk');
    o.world.avatar.teleport(s.x - 1.5, s.z + 1.5);
    return { x: s.x, z: s.z, aperta: !s.aperta || s.aperta() };
  });

  return {
    spots: spots.filter((s) => s.mete !== false), // nella bussola: dei giochi universali solo il posto del Porto
    isBusy: () => busy || open || schermoAperto(),
    played: () => playedN,
    tick(a, input) {
      const pressA = a && !aWas; aWas = a;
      if (input) for (const g of schermi.values()) if (g.isOpen()) g.step?.(input); // giochi nel mondo (Consegne): la loro sim gira qui
      if (o.world.race.on || busy || open || schermoAperto()) { near = null; return; }
      const f = o.world.mode === 'walk' ? o.world.avatar.state : o.world.boat.state;
      near = spots.find((s) => Math.hypot(f.x - s.x, f.z - s.z) < s.near && (!s.aPiedi || o.world.mode === 'walk') && (!s.aperta || s.aperta())) ?? null;
      if (near && near !== nearWas) o.hud.toast(`${near.nome}: premi A o tocca GIOCA`, 2500);
      nearWas = near;
      if (near && pressA) void play(near);
      pesca.tick(); // Pesca (#66)
      perle.tick(); // Perle
    },
    update(t) {
      const show = !!near && !busy && !open && !o.world.race.on && !schermoAperto();
      if (show && near && btn.dataset['spot'] !== near.id) { btn.dataset['spot'] = near.id; btn.replaceChildren(pixIcon(near.icon, 24), el('span', '', `GIOCA · ${near.nome.toUpperCase()}`), el('small', '', 'A')); }
      btn.classList.toggle('on', show);
      pesca.update(); // Pesca (#66)
      perle.update(); // Perle
      for (const g of schermi.values()) g.update?.(t);
      const me = o.world.mode === 'walk' ? o.world.avatar.state : o.world.boat.state;
      for (const m of marks) {
        if (m.s.boa) { m.holder.position.y = 0.1 * Math.sin(t * 2); m.holder.rotation.y = t * 0.5; }
        else m.holder.position.y = o.world.groundY(m.s.x, m.s.z);
        const p = screenOf(m.s.x, m.s.boa ? 4.2 : 3.4, m.s.z);
        const vicino = (!m.s.vista || Math.hypot(me.x - m.s.x, me.z - m.s.z) < m.s.vista) && (!m.s.aperta || m.s.aperta()); // i posti dei giochi universali si vedono solo da vicino; quelli delle isole a tema solo da aperte
        m.label.place(p.x, p.y, p.on && vicino && !o.world.race.on, Math.hypot(me.x - m.s.x, me.z - m.s.z) < LABEL_NEAR_M);
      }
    },
  };
}
