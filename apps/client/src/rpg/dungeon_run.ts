// Spedizione nel dungeon lato client (R-scena, CONTRACTS §15): prende il controllo del ciclo come la Regata. Carica il kit
// (manifest_rpg.json), costruisce scena, eroe e nemici, poi a ogni tick registra UN DungeonInput (mx, my, a, b dall'InputFrame di main.ts;
// c, d e la A in più dai controlli del chunk), sempre quantizzato con quantizeDungeon prima di dungeon.step: il server rigioca gli stessi
// input. A fine partita: packDungeon + hash di dungeon.result. Esc → «Uscire?» → abort: `done` risolve null (niente finish), o gli input
// fin lì se un altare è stato toccato (il server chiude la spedizione tenendo il bottino dell'altare). Toccando un altare: o.onAltare con
// gli input fin lì e l'hash, così il server li rigioca e tiene il salvataggio anche se la scheda si chiude (POST /api/dungeon/save).
// Autopilot (?autopilot=1 o hook dungeonAutopilot): gli input li dà dungeon.autopilot con un rng fisso e si registrano uguali.
import { createRng } from '@marea/sim';
import type { InputFrame, Rng } from '@marea/sim';
import type { RunHero } from '@marea/sim/rpg/types.ts';
import { dungeon } from '@marea/sim/dungeon/dungeon.ts';
import type { DungeonState } from '@marea/sim/dungeon/dungeon.ts';
import { packDungeon, quantizeDungeon } from '@marea/sim/dungeon/replay.ts';
import { bfs, cellCenter, cellOf, stepDown } from '@marea/sim/dungeon/map.ts';
import type { DungeonEvent, DungeonInput, DungeonView, PackedDungeon } from '@marea/sim/dungeon/types.ts';
import { PAL } from '../ui/style.ts';
import { dungeonLink } from '../game/ingressi.ts';
import type { DungeonFinish, DungeonRun, RunCtx } from './types.ts';
import { createDungeonScene } from './dungeon_scene.ts';
import type { DungeonScene } from './dungeon_scene.ts';
import { createHeroActor } from './dungeon_hero.ts';
import type { HeroActor } from './dungeon_hero.ts';
import { createActors } from './dungeon_actors.ts';
import type { Actors } from './dungeon_actors.ts';
import { createDungeonHud } from './dungeon_hud.ts';
import type { DungeonHud } from './dungeon_hud.ts';
import { createControls } from './dungeon_controls.ts';
import type { Controls } from './dungeon_controls.ts';
import { showDungeonResult } from './dungeon_result.ts';

type Phase = 'loading' | 'play' | 'end' | 'over';
const END_WAIT = 100; // tick di scritta finale prima di consegnare
const OUT: Record<string, [string, string]> = { uscito: ['SEI USCITO', PAL.erbaChiara], morto: ['SEI CADUTO', PAL.rosso], tempo: ['TEMPO SCADUTO', PAL.arancio] };

export function startRun(ctx: RunCtx, o: { dungeon: string; seed: number; hero: RunHero; onAltare?: (sv: { inputs: PackedDungeon; hash: number }) => void }): DungeonRun {
  const s: DungeonState = dungeon.create({ seed: o.seed, dungeon: o.dungeon, hero: o.hero });
  const frames: DungeonInput[] = [];
  let phase: Phase = 'loading', wait = 0, view: DungeonView = dungeon.view(s), auto: Rng | null = null;
  let sc: DungeonScene | null = null, hero: HeroActor | null = null, actors: Actors | null = null, hud: DungeonHud | null = null, controls: Controls | null = null;
  let resolve!: (v: { inputs: ReturnType<typeof packDungeon>; hash: number } | null) => void;
  const done = new Promise<{ inputs: ReturnType<typeof packDungeon>; hash: number } | null>((r) => (resolve = r));

  const cleanup = () => {
    phase = 'over'; dungeonLink.state = null;
    controls?.dispose(); hud?.dispose(); actors?.dispose(); hero?.dispose(); sc?.dispose();
    ctx.renderer.setScene(null);
  };
  const finish = () => { if (phase === 'over') return; const out = { inputs: packDungeon(frames), hash: dungeon.result(s).hash }; cleanup(); console.log(`[marea] dungeon ${o.dungeon} finito: ${frames.length} tick, ${out.inputs.length} righe`); resolve(out); };
  const abort = () => {
    if (phase === 'over') return;
    // dopo un altare si consegna lo stesso: la partita lasciata a metà tiene il bottino salvato
    const out = s.salvato ? { inputs: packDungeon(frames), hash: dungeon.result(s).hash } : null;
    cleanup(); console.log(`[marea] dungeon ${o.dungeon} abbandonato a ${frames.length} tick${out ? ' (con altare)' : ''}`); resolve(out);
  };

  ctx.hud.toast('Scendi…', 1500);
  void (async () => {
    try {
      await ctx.loader.extend('manifest_rpg.json');
      sc = await createDungeonScene(ctx.loader, o.dungeon);
      hero = await createHeroActor({ loader: ctx.loader, look: ctx.world.look, hero: o.hero, scene: sc.scene, floorY: sc.floorY, x: view.hero.x, z: view.hero.z });
      actors = createActors({ loader: ctx.loader, scene: sc });
      if ((phase as Phase) === 'over') { cleanup(); return; }
      hud = createDungeonHud({ root: ctx.root, canvas: ctx.canvas, camera: ctx.renderer.camera, hero: o.hero });
      controls = createControls({ root: ctx.root, canvas: ctx.canvas, onAbort: () => (phase === 'end' ? finish() : abort()) });
      const ic = hud.icons(); controls.setIcons(ic.c, ic.d);
      hero.tick(view.hero); actors.tick(view);
      ctx.renderer.setScene(sc.scene);
      ctx.renderer.diorama.setZoom(1.0);
      ctx.renderer.diorama.follow(view.hero.x, sc.floorY + 0.9, view.hero.z); ctx.renderer.diorama.snap?.();
      phase = 'play';
    } catch (e) {
      console.error('[marea] dungeon non caricato', e);
      ctx.hud.toast('Il dungeon non si è caricato, riprova', 3000);
      abort();
    }
  })();

  const onEvent = (e: DungeonEvent) => {
    if (!hud || !actors || !hero) return;
    if (e.t === 'colpo') {
      if (e.su === 'nemico') { if (e.id !== undefined) actors.hit(e.id); const p = (e.id !== undefined ? actors.posOf(e.id) : null); if (p) hud.number(p, `${Math.round(e.danno)}${e.critico ? '!' : ''}`, 'dato', !!e.caricato || !!e.critico); }
      else { hero.flash(); hud.number(hero.head(), `-${Math.round(e.danno)}`, 'preso'); }
    } else if (e.t === 'schivato') hud.number(hero.head(), 'schivato', 'info');
    else if (e.t === 'pozione') hud.number(hero.head(), '+', 'cura', true);
    else hud.event(e);
    if (e.t === 'altare') { controls?.setSalvato(true); o.onAltare?.({ inputs: packDungeon(frames), hash: dungeon.result(s).hash }); }
    if (e.t === 'risveglio') hero.flash();
  };

  // test (hook dungeonAltare): cammina fino all'altare n lungo le distanze BFS, input registrati come gli altri (il server li rigioca)
  let walkField: { n: number; to: number; field: Int32Array } | null = null;
  function walkToAltare(n: number): DungeonInput {
    const m = s.map, a = m.altari[n];
    if (!a || s.altare === n) { dungeonLink.altare = -1; return { mx: 0, my: 0, a: false, b: false, c: false, d: false }; }
    if (walkField?.n !== n) { const to = a.cz * m.w + a.cx; walkField = { n, to, field: bfs(m, to) }; }
    const cur = cellOf(m, s.hero.x, s.hero.z), next = cur === walkField.to ? walkField.to : stepDown(m, walkField.field, cur);
    const p = next >= 0 && next !== walkField.to ? cellCenter(m, next) : { x: a.x, z: a.z };
    const dx = p.x - s.hero.x, dz = p.z - s.hero.z, d = Math.sqrt(dx * dx + dz * dz) || 1;
    return { mx: dx / d, my: dz / d, a: false, b: false, c: false, d: false };
  }

  function tickOnce(f: InputFrame): void {
    const c = controls!.sample();
    const raw: DungeonInput = auto ? dungeon.autopilot(s, auto) : dungeonLink.altare >= 0 ? walkToAltare(dungeonLink.altare) : { mx: f.mx, my: f.my, a: f.a || c.a, b: f.b, c: c.c, d: c.d };
    const q = quantizeDungeon(raw);
    frames.push(q); dungeon.step(s, q);
    for (const e of s.eventi) onEvent(e);
  }

  const run: DungeonRun = {
    get active() { return phase !== 'over'; },
    step(f) {
      if (phase === 'end') { if (--wait <= 0 || (wait < END_WAIT - 40 && f.a)) finish(); return; }
      if (phase !== 'play' || !controls || controls.paused) return;
      if (dungeonLink.autopilot > 0 && !auto) auto = createRng(o.seed).fork('autopilot');
      if (dungeonLink.autopilot === 0) auto = null;
      const n = auto ? dungeonLink.autopilot : dungeonLink.altare >= 0 ? 8 : 1;
      for (let i = 0; i < n && !s.done; i++) tickOnce(f);
      view = dungeon.view(s);
      hero!.tick(view.hero); actors!.tick(view);
      if (s.done) {
        phase = 'end'; wait = END_WAIT; controls.hide();
        const [txt, col] = OUT[s.outcome ?? 'tempo'] ?? OUT['tempo']!;
        hud!.big(txt, col, 'il server conferma il bottino');
      }
    },
    update(alpha, dt, t) {
      if (!sc || !hero || !actors || !hud || !controls || phase === 'over' || phase === 'loading') return;
      hero.update(alpha, dt);
      const p = hero.avatar.object.position;
      ctx.renderer.diorama.follow(p.x, sc.floorY + 0.9, p.z); ctx.renderer.diorama.update(dt);
      sc.update(p.x, p.z, t);
      actors.update(alpha, dt, t, { x: p.x, z: p.z });
      hud.set(view, dungeon.maxTicks); hud.bars(actors.bars());
      controls.setExit(phase === 'play' && view.vicinoUscita);
      sc.setAltare(view.altari.findIndex((a) => a.attivo));
      const h = view.hero, spell = o.hero.magia !== null ? o.hero.magie[o.hero.magia] : null;
      controls.setState(spell ? 1 - h.ricaricaMagia / Math.max(0.01, spell.ricarica) : 0, h.pozioni, !!spell && h.magicka >= spell.costo);
    },
    abort,
    done,
  };

  dungeonLink.state = () => {
    const v = view, vivi = v.nemici.filter((n) => !n.alleato && n.anim !== 'morto').length;
    return {
      active: phase !== 'over', phase, dungeon: o.dungeon, tick: v.tick, outcome: v.outcome, frames: frames.length, auto: !!auto, paused: !!controls?.paused,
      hero: { x: v.hero.x, z: v.hero.z, vita: v.hero.vita, magicka: v.hero.magicka, stamina: v.hero.stamina, anim: v.hero.anim },
      nemici: v.nemici.filter((n) => !n.alleato).length, vivi, vicinoUscita: v.vicinoUscita, zaino: v.zaino,
      altari: v.altari, salvato: v.salvato, cadute: s.cadute, protetto: v.hero.protetto,
      scene: sc?.stats() ?? null, actors: actors?.counts() ?? null,
    };
  };
  return run;
}

/** Scheda dell'esito (quello del server): bottino tenuto, monete, xp, livelli. Risolve quando il giocatore chiude. */
export async function showResult(ctx: RunCtx, r: DungeonFinish): Promise<void> { return showDungeonResult(ctx.root, r); }
