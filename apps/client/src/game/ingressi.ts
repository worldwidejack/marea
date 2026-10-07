// Ingressi dei dungeon nel mondo (R-scena, CONTRACTS §15). Bundle iniziale: piccolo, niente import statici del GDR (solo `import type`).
// Nel mondo: modello `prop_ingresso_<stile>` sull'isola, cartello col nome che si vede da lontano, bottone ENTRA vicino (≤ 4 m, anche A/E/Spazio).
// Entrando: POST /api/dungeon/start → import('../rpg/index.ts') → startRun; alla fine POST /api/dungeon/finish (input compressi se la sim
// ha encodeDungeon) → scheda dell'esito del server → setLot → di nuovo all'ingresso. Esc nel dungeon = uscita senza consegna (finish non parte).
import * as THREE from 'three';
import type { InputFrame, LotState } from '@marea/sim';
import type { GameWorld } from './world.ts';
import type { Renderer } from '../render/scene.ts';
import type { Loader } from '../render/loader.ts';
import type { Hud } from '../ui/hud.ts';
import type { Api } from '../net/api.ts';
import { ApiError } from '../net/api.ts';
import type { PixId } from '../ui/icons.ts';
import { pixIcon } from '../ui/icons.ts';
import { PAL, el, injectUiStyle } from '../ui/style.ts';
import { createLabelLayer } from '../ui/sheet.ts';
import { FLAGS } from '../flags.ts';
import { registerStateProvider, registerTestHook } from '../test/testapi.ts';
import type { DungeonRun, RunCtx } from '../rpg/types.ts';
import type { PackedDungeon } from '@marea/sim/dungeon/types.ts';

export type Ingressi = {
  readonly spots: readonly { id: string; nome: string; x: number; z: number; icon: PixId }[];
  /** Fuori dal dungeon, un tick: vicino a un ingresso il fronte di A entra. */
  tick(a: boolean): void;
  /** Nel dungeon, un tick (al posto di world.step). */
  step(f: InputFrame): void;
  update(alpha: number, dt: number, t: number): void;
  readonly active: boolean;
  /** Spedizione che parte o scheda dell'esito aperta: il mondo sta fermo. */
  isBusy(): boolean;
  /** Il dungeon più facile non ancora completato (`difficolta`, `hero.completati`): l'unico che la bussola mostra. null = tutti fatti. */
  next(): string | null;
};

/**
 * Copia a mano di `ingresso`, `stile` e `difficolta` di packages/content/src/rpg/dungeons.json (il JSON è GDR: qui non si può importare).
 * Il test e2e m2_dungeon controlla che coincida con DUNGEONS: se un dungeon si sposta, aggiornare anche qui.
 */
export const INGRESSI = [
  { id: 'grotta', nome: 'Grotta della Marea', island: 'porto', at: [32, 7], stile: 'grotta', difficolta: 1 },
  { id: 'cripta', nome: 'Cripta delle Ossa', island: 'selvaggia', at: [18, 12], stile: 'cripta', difficolta: 2 },
  { id: 'vuoto', nome: 'Portale del Vuoto', island: 'neon', at: [20, 13], stile: 'vuoto', difficolta: 3 },
] as const;
const PER_DIFFICOLTA = [...INGRESSI].sort((a, b) => a.difficolta - b.difficolta);
/** Il dungeon più facile tra quelli non ancora completati (null = tutti completati). */
export function nextDungeon(completati: readonly string[]): string | null {
  return PER_DIFFICOLTA.find((d) => !completati.includes(d.id))?.id ?? null;
}

/** Stato condiviso col chunk GDR (dungeon_run.ts lo legge): autopilot dei test e vista corrente per state().dungeon. */
/** Ponte coi test (?test=1): autopilot (tick per frame), `altare` = cammina fino a quell'altare (-1 = no), stato della partita. */
/** posa: solo test (hook dungeonPosa), campi della vista dell'eroe forzati per la resa (anim, t, stile, carica, fx, fz): la sim non cambia. */
export const dungeonLink: { autopilot: number; altare: number; posa: Record<string, unknown> | null; state: (() => Record<string, unknown>) | null } = { autopilot: FLAGS.autopilot ? 4 : 0, altare: -1, posa: null, state: null };

const NEAR_M = 4;
const ICON: PixId = 'ingresso';
const CSS = `.mz-lbl.dng { border-color: ${PAL.viola}; font-size: 15px; min-height: 34px; }
body.mz-sotto #mzDngEntra { display: none; }`;

export function createIngressi(o: { world: GameWorld; renderer: Renderer; loader: Loader; api: Api | null; hud: Hud; root: HTMLElement; canvas: HTMLCanvasElement; getLot(): LotState | null; setLot(l: LotState): void }): Ingressi {
  injectUiStyle();
  if (!document.getElementById('mz-ingressi-style')) { const st = document.createElement('style'); st.id = 'mz-ingressi-style'; st.textContent = CSS; document.head.appendChild(st); }
  const arch = o.world.archipelago;
  const spots = INGRESSI.flatMap((d) => {
    const p = arch.places.find((q) => q.island === d.island);
    if (!p) return [];
    return [{ id: d.id, nome: d.nome, stile: d.stile, x: (p.origin[0] + d.at[0] + 0.5) * arch.tile, z: (p.origin[1] + d.at[1] + 0.5) * arch.tile, icon: ICON }];
  });
  type Spot = (typeof spots)[number];
  const next = () => nextDungeon(o.getLot()?.hero?.completati ?? []);

  // ---- nel mondo: portale + cartello ----
  const group = new THREE.Group(); group.name = 'ingressi'; o.world.scene.add(group);
  const layer = createLabelLayer(o.root);
  const marks = spots.map((s) => {
    const holder = new THREE.Group(); holder.name = 'ingresso_' + s.id;
    holder.position.set(s.x, o.world.groundY(s.x, s.z), s.z);
    holder.rotation.y = -Math.PI * 0.75; // la bocca (−Z) guarda verso la camera (sud-est)
    group.add(holder);
    const name = `prop_ingresso_${s.stile}`;
    if (o.loader.has(name)) void o.loader.load(name).then((g) => holder.add(g.scene)).catch(() => holder.add(placeholder()));
    else holder.add(placeholder());
    const label = layer.add(() => { void enter(s); });
    label.set('bubble', [pixIcon(s.icon, 16), el('span', '', s.nome.toUpperCase())], 'dng');
    label.el.classList.add('dng');
    return { s, holder, label };
  });

  // ---- bottone ENTRA ----
  const btn = el('button', 'mz mz-play'); btn.id = 'mzDngEntra'; btn.type = 'button';
  for (const ev of ['pointerdown', 'touchstart']) btn.addEventListener(ev, (x) => x.stopPropagation());
  btn.addEventListener('click', () => { if (near) void enter(near); });
  o.root.append(btn);

  let near: Spot | null = null, nearWas: Spot | null = null, aWas = false, busy = false, run: DungeonRun | null = null;
  let entered = 0, finishes = 0, aborts = 0, lastErr: string | null = null, lastResult: unknown = null, current: string | null = null;
  /** Salvataggi all'altare confermati dal server in questa sessione, e l'ultima spedizione interrotta recuperata alla discesa. */
  let salvataggi = 0, recuperato: unknown = null;
  const ctx: RunCtx = { world: o.world, renderer: o.renderer, loader: o.loader, hud: o.hud, root: o.root, canvas: o.canvas };

  const v = new THREE.Vector3();
  const screenOf = (x: number, y: number, z: number) => {
    v.set(x, y, z).project(o.renderer.camera);
    const r = o.canvas.getBoundingClientRect(), rr = o.root.getBoundingClientRect();
    return { x: r.left - rr.left + ((v.x + 1) / 2) * r.width, y: r.top - rr.top + ((1 - v.y) / 2) * r.height, on: v.z < 1 && Math.abs(v.x) < 1.05 && Math.abs(v.y) < 1.05 };
  };

  async function enter(s: Spot): Promise<void> {
    if (busy || run || o.world.race.on) return;
    const api = o.api;
    if (!api) { o.hud.toast('Per scendere serve il tuo link personale', 3000); return; }
    busy = true; btn.classList.remove('on'); lastErr = null;
    const zoom0 = o.renderer.diorama.zoom;
    try {
      let st;
      try { st = await api.dungeonStart(s.id); } catch (e) { fail(e, 'Niente connessione, riprova tra poco'); return; }
      o.setLot(st.lot);
      const rec = st.recuperato, recN = rec ? Object.values(rec.tenuto).reduce((a, b) => a + b, 0) : 0;
      if (rec) recuperato = rec;
      if (rec && (recN > 0 || rec.monete > 0)) o.hud.toast(`Dalla spedizione interrotta hai tenuto ${recN} oggetti e ${rec.monete} monete (altare)`, 3500);
      else o.hud.toast(`${s.nome}…`, 1500);
      const mod = await import('../rpg/index.ts');
      const { encodeDungeon } = await import('@marea/sim/dungeon/replay.ts');
      // altare toccato: input fin lì al server, che li rigioca e tiene il salvataggio anche se la scheda si chiude
      const onAltare = (sv: { inputs: PackedDungeon; hash: number }) => {
        api.dungeonSave(encodeDungeon(sv.inputs), sv.hash).then(() => { salvataggi++; }, (e: unknown) => console.warn('[marea] salvataggio all’altare non riuscito', e));
      };
      run = mod.startRun(ctx, { dungeon: st.dungeon, seed: st.seed, hero: st.hero, onAltare });
      entered++; current = s.id; busy = false;
      const done = await run.done;
      run = null; busy = true;
      backToEntrance(s, zoom0);
      if (!done) { aborts++; o.hud.toast('Sei risalito senza bottino', 2500); return; }
      try {
        const prima = next();
        const r = await api.dungeonFinish(encodeDungeon(done.inputs), done.hash);
        finishes++; lastResult = { outcome: r.result.outcome, tenuto: r.tenuto, monete: r.monete, livelliSu: r.livelliSu, capo: r.result.capo ?? false, hash: r.result.hash, clientHash: done.hash };
        o.setLot(r.lot);
        await mod.showResult(ctx, r);
        // capo ucciso la prima volta: la bussola passa al dungeon dopo, e lo si dice
        const dopo = next();
        if (dopo !== prima && (r.lot.hero?.completati ?? []).includes(s.id)) {
          const n = INGRESSI.find((d) => d.id === dopo);
          o.hud.toast(n ? `${s.nome} completata! Prossimo dungeon: ${n.nome}` : `${s.nome} completato! Hai finito tutti i dungeon`, 4500);
        }
      } catch (e) { fail(e, 'Spedizione non salvata, riprova'); }
    } catch (e) {
      console.error('[marea] dungeon', e); fail(e, 'Qualcosa è andato storto nel dungeon');
      if (run) { run.abort(); run = null; }
      backToEntrance(s, zoom0);
    } finally { busy = false; current = null; }
  }
  function fail(e: unknown, fallback: string): void {
    lastErr = e instanceof ApiError ? e.message : fallback;
    o.hud.toast(lastErr, 3200);
  }
  function backToEntrance(s: Spot, zoom: number): void {
    o.renderer.setScene(null);
    const a = o.world.avatar;
    if (o.world.mode === 'walk') a.teleport(s.x, s.z + 3); // davanti alla bocca, a sud: la camera (da sud-est) lo vede
    o.renderer.diorama.setZoom(zoom);
    o.renderer.diorama.follow(a.state.x, o.world.groundY(a.state.x, a.state.z), a.state.z);
    o.renderer.diorama.snap?.();
    nearWas = s; // di nuovo davanti alla bocca: niente «premi A», che coprirebbe il toast dell'esito
  }

  /** La scenografia casuale (palme, sassi) non sa degli ingressi: quella entro 6 m si toglie, se no copre la bocca vista dalla camera.
   *  TODO: farlo in render/island.ts bloccando le celle come per edifici e prop (chiesto in tests/out/richieste/r-scena.md). */
  let cleared = 0, clearPasses = 0;
  const clearScenery = () => {
    const m4 = new THREE.Matrix4(), p = new THREE.Vector3(), zero = new THREE.Matrix4().makeScale(0, 0, 0);
    o.world.scene.traverse((n) => {
      const im = n as THREE.InstancedMesh;
      if (!im.isInstancedMesh || /^mod_|cemento|boa|regata|ingresso/.test(im.name)) return;
      let hit = false;
      for (let i = 0; i < im.count; i++) {
        im.getMatrixAt(i, m4); p.setFromMatrixPosition(m4).applyMatrix4(im.matrixWorld);
        if (spots.some((s) => Math.hypot(p.x - s.x, p.z - s.z) < 6) && m4.determinant() !== 0) { im.setMatrixAt(i, zero); hit = true; cleared++; }
      }
      if (hit) im.instanceMatrix.needsUpdate = true;
    });
  };

  registerStateProvider('ingressi', () => ({ spots: spots.map(({ id, nome, x, z }) => ({ id, nome, x, z })), models: marks.map((m) => m.holder.children.length), cleared, near: near?.id ?? null, next: next(), busy, active: !!run?.active, entered, finishes, aborts, salvataggi, recuperato, lastErr, lastResult }));
  registerStateProvider('dungeon', () => (run && dungeonLink.state ? { ...dungeonLink.state(), busy } : { active: false, dungeon: current, busy, tick: 0, outcome: null, hero: null, nemici: 0, vivi: 0 }));
  registerTestHook('enterDungeon', (id) => {
    const s = spots.find((x) => x.id === String(id ?? 'grotta'));
    if (!s || busy || run) return false;
    if (o.world.mode === 'walk') o.world.avatar.teleport(s.x, s.z + 3);
    void enter(s);
    return true;
  });
  registerTestHook('dungeonAltare', (n) => { dungeonLink.altare = Number.isInteger(n) ? Number(n) : -1; return dungeonLink.altare; });
  registerTestHook('dungeonPosa', (p) => { dungeonLink.posa = p && typeof p === 'object' ? { ...(p as Record<string, unknown>) } : null; return dungeonLink.posa; });
  registerTestHook('dungeonAutopilot', (on, speed) => { dungeonLink.autopilot = on ? Math.max(1, Math.min(20, Math.round(Number(speed ?? 4)) || 4)) : 0; return dungeonLink.autopilot; });

  return {
    spots: spots.map(({ id, nome, x, z, icon }) => ({ id, nome, x, z, icon })),
    get active() { return !!run && run.active; },
    isBusy: () => busy || (!!run && !run.active),
    next,
    tick(a) {
      const pressA = a && !aWas; aWas = a;
      if (busy || run || o.world.race.on || o.world.mode !== 'walk') { near = null; return; }
      const f = o.world.avatar.state;
      near = spots.find((s) => Math.hypot(f.x - s.x, f.z - s.z) < NEAR_M) ?? null;
      if (near && near !== nearWas) o.hud.toast(`${near.nome}: premi A o tocca ENTRA`, 2500);
      nearWas = near;
      if (near && pressA) void enter(near);
    },
    step(f) { run?.step(f); },
    update(alpha, dt, t) {
      if (run) { run.update(alpha, dt, t); return; }
      if (clearPasses === 0 || (clearPasses === 1 && t > 4)) { clearPasses++; clearScenery(); } // la scenografia può arrivare dopo
      const show = !!near && !busy;
      if (show && near && btn.dataset['spot'] !== near.id) { btn.dataset['spot'] = near.id; btn.replaceChildren(pixIcon(near.icon, 24), el('span', '', `ENTRA · ${near.nome.toUpperCase()}`), el('small', '', 'A')); }
      btn.classList.toggle('on', show);
      for (const m of marks) { const p = screenOf(m.s.x, m.holder.position.y + 3.6, m.s.z); m.label.place(p.x, p.y, p.on && !o.world.race.on); }
    },
  };
}

/** Segnaposto se il modello manca: arco di pietra scura con la bocca nera (colori di palette). */
function placeholder(): THREE.Object3D {
  const g = new THREE.Group(), stone = new THREE.MeshLambertMaterial({ color: '#4A4340', flatShading: true }), dark = new THREE.MeshLambertMaterial({ color: '#23201F' });
  for (const sx of [-1.3, 1.3]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.8, 2.6, 1.2), stone); p.position.set(sx, 1.3, 0); g.add(p); }
  const top = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.7, 1.2), stone); top.position.y = 2.9; g.add(top);
  const hole = new THREE.Mesh(new THREE.BoxGeometry(1.8, 2.5, 0.2), dark); hole.position.set(0, 1.25, -0.2); g.add(hole);
  return g;
}
