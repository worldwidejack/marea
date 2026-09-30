// Minigiochi da solo (senza posta): ogni minigioco ha il suo posto su un'isola (la Regata al molo della Laguna, il via della gara).
// Nel mondo: boa grande e cartello «REGATA» che si vede da lontano; vicino compare il bottone GIOCA (A / E / Spazio sulla tastiera).
// Il seed lo sceglie il server, che poi rigioca gli input, decide la medaglia e paga il premio (balance.solo: Legno, Pietra, Perle).
// Alla fine una scheda con l'esito, il premio che vola nella barra e RIGIOCA.
import * as THREE from 'three';
import { MINIGAMES_CFG } from '@marea/content';
import type { Medal, Resources } from '@marea/sim';
import type { GameWorld } from './world.ts';
import type { Loader } from '../render/loader.ts';
import type { Hud } from '../ui/hud.ts';
import type { Api, SoloResult } from '../net/api.ts';
import { ApiError } from '../net/api.ts';
import { runRegata } from './regata.ts';
import { PAL, el, injectUiStyle } from '../ui/style.ts';
import { RES_IDS, pixIcon, resIcon } from '../ui/icons.ts';
import { createLabelLayer, flyResources } from '../ui/sheet.ts';
import { registerStateProvider, registerTestHook } from '../test/testapi.ts';

export type Spot = { id: string; nome: string; minigame: string; x: number; z: number };
export type Minigiochi = {
  readonly spots: readonly Spot[];
  /** Un tick (60 Hz): vicino a un posto, il fronte di salita di A fa partire la partita. */
  tick(a: boolean): void;
  /** Ogni frame: boa, cartello, bottone. */
  update(t: number): void;
  /** Scheda dell'esito aperta o partita che sta partendo: il mondo sta fermo. */
  isBusy(): boolean;
  /** Partite finite in questa sessione (per la guida). */
  played(): number;
};

const NEAR_M = 16;
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

export function createMinigiochi(o: { world: GameWorld; loader: Loader; api: Api | null; hud: Hud; root: HTMLElement; camera: THREE.Camera; canvas: HTMLCanvasElement; onLot(): void }): Minigiochi {
  injectUiStyle();
  if (!document.getElementById('mz-minigiochi-style')) { const st = document.createElement('style'); st.id = 'mz-minigiochi-style'; st.textContent = CSS; document.head.appendChild(st); }
  const arch = o.world.archipelago;
  // la Regata parte dal molo (B) dell'isola del percorso
  const cfg = MINIGAMES_CFG.regata, lag = arch.places.find((p) => p.island === cfg.course.island) ?? arch.places.find((p) => p.role === 'laguna');
  const spots: Spot[] = lag ? [{ id: 'regata', nome: cfg.nome, minigame: 'regata', x: lag.boat.x, z: lag.boat.z }] : [];

  // ---- nel mondo: boa grande al via + cartello DOM che si vede anche da lontano ----
  const group = new THREE.Group(); group.name = 'minigiochi'; o.world.scene.add(group);
  const layer = createLabelLayer(o.root);
  const marks = spots.map((s) => {
    const holder = new THREE.Group(); holder.name = 'spot_' + s.id; holder.position.set(s.x, 0, s.z); holder.scale.setScalar(1.8); group.add(holder);
    const name = o.loader.has('prop_boa_next') ? 'prop_boa_next' : null;
    if (name) void o.loader.load(name).then((g) => holder.add(g.scene)).catch(() => {});
    const label = layer.add(() => { void play(s); });
    label.set('bubble', [pixIcon('regata', 16), el('span', '', s.nome.toUpperCase())], 'spot');
    label.el.classList.add('spot');
    return { s, holder, label };
  });

  // ---- bottone GIOCA (vicino al posto) e scheda dell'esito ----
  const btn = el('button', 'mz mz-play'); btn.id = 'mzPlay'; btn.type = 'button';
  const esito = el('div', 'mz mz-esito'); esito.id = 'mzEsito';
  for (const e of [btn, esito]) for (const ev of ['pointerdown', 'touchstart']) e.addEventListener(ev, (x) => x.stopPropagation());
  o.root.append(btn, esito);
  let near: Spot | null = null, nearWas: Spot | null = null, aWas = false, busy = false, open = false, playedN = 0, last: (SoloResult & { spot: string }) | null = null;
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
    else if (e.code === 'KeyR') { e.preventDefault(); e.stopImmediatePropagation(); const s = spots.find((x) => x.id === last?.spot) ?? spots[0]; closeEsito(); if (s) void play(s); }
  };
  function showEsito(s: Spot, medal: Medal, sub: string, premio: Resources | null, note: string | null): void {
    const title = el('h2', '', medal ? MEDAL_TXT[medal]! : 'ARRIVATO');
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
    addEventListener('keydown', onKey, true);
  }
  function fly(premio: Resources): void {
    const from = { x: o.root.clientWidth / 2, y: o.root.clientHeight / 2 };
    for (const id of RES_IDS) if (premio[id] > 0) flyResources(o.root, from, o.hud.resAnchor?.(id) ?? null, id, premio[id], () => o.hud.bump?.(id));
  }

  async function play(s: Spot): Promise<void> {
    if (busy || open || o.world.race.on) return;
    busy = true; btn.classList.remove('on');
    try {
      let seed = 0, difficulty = 2;
      const online = !!o.api?.enabled;
      if (online) {
        try { const st = await o.api!.soloStart(s.minigame); seed = st.seed; difficulty = st.difficulty; }
        catch (e) { o.hud.toast(e instanceof ApiError ? e.message : 'Niente connessione, riprova tra poco', 3000); return; }
      } else seed = (Math.random() * 0x7fffffff) >>> 0; // senza link si gioca lo stesso, ma il premio non si salva
      busy = false; // da qui la gara tiene fermo il mondo da sé
      const inputs = await runRegata({ challenge: { id: 'solo', minigame: s.minigame, difficulty, seed } });
      if (!inputs) { o.hud.toast('Ritirato', 1500); return; }
      if (!online) { playedN++; showEsito(s, null, 'Partita di prova', null, 'Con il tuo link personale vinci Legno, Pietra e Perle'); return; }
      busy = true;
      try {
        const r = await o.api!.soloPlay(inputs);
        playedN++; last = { ...r, spot: s.id };
        const secs = typeof r.detail['ms'] === 'number' ? ` · ${(r.detail['ms'] / 1000).toFixed(1)} s` : '';
        showEsito(s, r.medal, `${s.nome}${secs}`, r.premiata ? r.premio : null, r.premiata ? null : 'Per oggi i premi sono finiti: domani si riparte');
        if (r.premiata) fly(r.premio);
        o.onLot();
      } catch (e) {
        o.hud.toast(e instanceof ApiError ? e.message : 'Partita non salvata, riprova', 3200);
      }
    } finally { busy = false; }
  }

  registerStateProvider('minigiochi', () => ({ spots, near: near?.id ?? null, busy, open, played: playedN, last }));
  registerTestHook('playSpot', (id) => { const s = spots.find((x) => x.id === String(id ?? 'regata')); if (s) void play(s); return !!s; });
  registerTestHook('closeEsito', () => { closeEsito(); return true; });

  return {
    spots,
    isBusy: () => busy || open,
    played: () => playedN,
    tick(a) {
      const pressA = a && !aWas; aWas = a;
      if (o.world.race.on || busy || open) { near = null; return; }
      const f = o.world.mode === 'walk' ? o.world.avatar.state : o.world.boat.state;
      near = spots.find((s) => Math.hypot(f.x - s.x, f.z - s.z) < NEAR_M) ?? null;
      if (near && near !== nearWas) o.hud.toast(`${near.nome}: premi A o tocca GIOCA`, 2500);
      nearWas = near;
      if (near && pressA) void play(near);
    },
    update(t) {
      const show = !!near && !busy && !open && !o.world.race.on;
      if (show && near && btn.dataset['spot'] !== near.id) { btn.dataset['spot'] = near.id; btn.replaceChildren(pixIcon('regata', 24), el('span', '', `GIOCA · ${near.nome.toUpperCase()}`), el('small', '', 'A')); }
      btn.classList.toggle('on', show);
      for (const m of marks) {
        m.holder.position.y = 0.1 * Math.sin(t * 2); m.holder.rotation.y = t * 0.5;
        const p = screenOf(m.s.x, 4.2, m.s.z);
        m.label.place(p.x, p.y, p.on && !o.world.race.on);
      }
    },
  };
}
