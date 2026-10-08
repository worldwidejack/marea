// Spedizione nel dungeon lato client (R-scena, CONTRACTS §15): prende il controllo del ciclo come la Regata. Carica il kit
// (manifest_rpg.json), costruisce scena, eroe e nemici, poi a ogni tick registra UN DungeonInput (mx, my, a, b dall'InputFrame di main.ts;
// c, d e la A in più dai controlli del chunk), sempre quantizzato con quantizeDungeon prima di dungeon.step: il server rigioca gli stessi
// input. Le azioni dal menu (dungeon v5: cambio d'equipaggiamento e Butta via dalla scheda dello zaino, SALVA ed ESCI sulla lanterna) si
// applicano subito con dungeon.act e si registrano col tick: il server le rigioca con gli input. A fine partita: packDungeon + azioni + hash
// di dungeon.result. Pausa (Esc) e scheda dello zaino aperta = nessun tick. Esc → Pausa → Esci → «Uscire?» → abort: `done` risolve null
// (niente finish), o gli input fin lì se hai salvato a una lanterna (il server chiude la spedizione tenendo quel bottino). SALVA: o.onAltare
// con input e azioni fin lì, così il server tiene il salvataggio anche se la scheda si chiude (POST /api/dungeon/save).
// Autopilot (?autopilot=1 o hook dungeonAutopilot): gli input li dà dungeon.autopilot con un rng fisso e si registrano uguali.
import { createRng } from '@marea/sim';
import type { InputFrame, Rng } from '@marea/sim';
import type { HeroState, RunHero } from '@marea/sim/rpg/types.ts';
import { dungeon } from '@marea/sim/dungeon/dungeon.ts';
import type { DungeonState } from '@marea/sim/dungeon/dungeon.ts';
import { packDungeon, quantizeDungeon } from '@marea/sim/dungeon/replay.ts';
import { bfs, cellCenter, cellOf, stepDown } from '@marea/sim/dungeon/map.ts';
import { heroNow } from '@marea/sim/dungeon/zaino.ts';
import type { DungeonAzione, DungeonAzioni, DungeonEvent, DungeonInput, DungeonView } from '@marea/sim/dungeon/types.ts';
import { PAL } from '../ui/style.ts';
import { dungeonLink } from '../game/ingressi.ts';
import { dungeonEvento, dungeonPasso } from '../audio/ponte.ts';
import type { DungeonFinish, DungeonRun, PanelCtx, RunBag, RunCtx } from './types.ts';
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
import { closePanels, isPanelOpen, openHero } from './panels.ts';

type Phase = 'loading' | 'play' | 'end' | 'over';
type Out = { inputs: ReturnType<typeof packDungeon>; hash: number; azioni: DungeonAzioni };
const END_WAIT = 100; // tick di scritta finale prima di consegnare
const OUT: Record<string, [string, string]> = { uscito: ['SEI USCITO', PAL.erbaChiara], morto: ['SEI CADUTO', PAL.rosso], tempo: ['TEMPO SCADUTO', PAL.arancio] };
const NO_ACT: Record<DungeonAzione['t'], string> = { equip: 'Non si può mettere qui', butta: 'Non ce l’hai nello zaino', salva: 'Qui è già tutto al sicuro', esci: 'Serve una lanterna' };
const nOggetti = (b: Record<string, number>) => Object.values(b).reduce((a, n) => a + n, 0);

export function startRun(ctx: RunCtx, o: {
  dungeon: string; seed: number; hero: RunHero; stato?: HeroState | null; partenza?: number | null;
  /** Per aprire la scheda dello zaino nel dungeon (senza: niente Zaino). */
  panel?: PanelCtx;
  onAltare?: (sv: Out) => void;
}): DungeonRun {
  const s: DungeonState = dungeon.create({ seed: o.seed, dungeon: o.dungeon, hero: o.hero, stato: o.stato ?? null, partenza: o.partenza ?? null });
  const frames: DungeonInput[] = [], azioni: DungeonAzioni = [];
  let phase: Phase = 'loading', wait = 0, view: DungeonView = dungeon.view(s), auto: Rng | null = null, arma = view.hero.arma;
  let sc: DungeonScene | null = null, hero: HeroActor | null = null, actors: Actors | null = null, hud: DungeonHud | null = null, controls: Controls | null = null;
  let resolve!: (v: Out | null) => void;
  const done = new Promise<Out | null>((r) => (resolve = r));
  const out = (): Out => ({ inputs: packDungeon(frames), hash: dungeon.result(s).hash, azioni: azioni.map(([t, a]) => [t, a]) });

  const cleanup = () => {
    phase = 'over'; dungeonLink.state = null; dungeonLink.act = null;
    closePanels();
    controls?.dispose(); hud?.dispose(); actors?.dispose(); hero?.dispose(); sc?.dispose();
    ctx.renderer.setScene(null);
  };
  const finish = () => { if (phase === 'over') return; const r = out(); cleanup(); console.log(`[marea] dungeon ${o.dungeon} finito: ${frames.length} tick, ${r.inputs.length} righe, ${r.azioni.length} azioni`); resolve(r); };
  const abort = () => {
    if (phase === 'over') return;
    // dopo un salvataggio alla lanterna si consegna lo stesso: la partita lasciata a metà tiene il bottino salvato
    const r = s.salvato ? out() : null;
    cleanup(); console.log(`[marea] dungeon ${o.dungeon} abbandonato a ${frames.length} tick${r ? ' (con lanterna)' : ''}`); resolve(r);
  };

  /** Fine partita (esito della sim): scritta grande, poi consegna dopo END_WAIT tick. */
  const toEnd = () => {
    if (phase !== 'play') return;
    phase = 'end'; wait = END_WAIT; controls?.hide(); closePanels();
    const [txt, col] = OUT[s.outcome ?? 'tempo'] ?? OUT['tempo']!;
    hud?.big(txt, col, s.uscitaLanterna >= 0 ? 'dalla lanterna: la prossima volta puoi ripartire da qui' : 'il server conferma il bottino');
  };
  /** Dopo un'azione o un passo: vista nuova, icone e arma in mano se l'equipaggiamento è cambiato. */
  const refresh = () => {
    view = dungeon.view(s);
    if (view.hero.arma !== arma) { arma = view.hero.arma; void hero?.setArma(s.hero.arma); }
  };
  /** Azione dal menu adesso: si applica alla sim, si registra col tick (= passi fatti) e si mostra. null = fatta, se no il motivo. */
  const act = (a: DungeonAzione): string | null => {
    if (phase !== 'play') return 'Adesso no';
    const ev = dungeon.act(s, a);
    if (!ev) return NO_ACT[a.t] ?? 'Non si può';
    azioni.push([frames.length, a]);
    for (const e of ev) onEvent(e);
    if (a.t === 'equip' || a.t === 'butta') { hud?.setHero(s.runHero); const ic = hud?.icons(); if (ic) controls?.setIcons(ic.c, ic.d, ic.key); }
    refresh();
    if (s.done) toEnd();
    return null;
  };
  const bag: RunBag = { hero: () => heroNow(s), peso: () => ({ peso: view.zaino.peso, max: view.zaino.max }), act };
  const openZaino = () => {
    if (phase !== 'play') return;
    if (!o.panel) { ctx.hud.toast('Lo zaino si apre col tuo link personale', 2500); return; }
    openHero(o.panel, bag);
  };

  ctx.hud.toast('Scendi…', 1500);
  void (async () => {
    try {
      await ctx.loader.extend('manifest_rpg.json');
      sc = await createDungeonScene(ctx.loader, o.dungeon);
      hero = await createHeroActor({ loader: ctx.loader, look: ctx.world.look, hero: o.hero, scene: sc.scene, floorY: sc.floorY, x: view.hero.x, z: view.hero.z });
      actors = createActors({ loader: ctx.loader, scene: sc });
      if ((phase as Phase) === 'over') { cleanup(); return; }
      hud = createDungeonHud({ root: ctx.root, canvas: ctx.canvas, camera: ctx.renderer.camera, hero: s.runHero });
      controls = createControls({
        root: ctx.root, canvas: ctx.canvas, blocked: () => isPanelOpen(),
        onAbort: () => (phase === 'end' ? finish() : abort()),
        onZaino: openZaino,
        onSalva: () => { const e = act({ t: 'salva' }); if (e) ctx.hud.toast(e, 1800); },
        onEsciLanterna: () => { const e = act({ t: 'esci' }); if (e) ctx.hud.toast(e, 1800); },
      });
      const ic = hud.icons(); controls.setIcons(ic.c, ic.d, ic.key);
      if (s.salvato) controls.setSalvato(true);
      hero.tick(view.hero); actors.tick(view);
      ctx.renderer.setScene(sc.scene);
      ctx.renderer.diorama.setZoom(1.0);
      ctx.renderer.diorama.follow(view.hero.x, sc.floorY + 0.9, view.hero.z); ctx.renderer.diorama.snap?.();
      if (s.partenza >= 0) { sc.setAltare(s.partenza); hud.flash('LANTERNA', PAL.giallo, 'riparti da dove eri uscito', 1800); }
      phase = 'play';
    } catch (e) {
      console.error('[marea] dungeon non caricato', e);
      ctx.hud.toast('Il dungeon non si è caricato, riprova', 3000);
      abort();
    }
  })();

  const onEvent = (e: DungeonEvent) => {
    if (!hud || !actors || !hero) return;
    dungeonEvento(e);
    if (e.t === 'colpo') {
      if (e.su === 'nemico') { if (e.id !== undefined) actors.hit(e.id); const p = (e.id !== undefined ? actors.posOf(e.id) : null); if (p) hud.number(p, `${Math.round(e.danno)}${e.critico ? '!' : ''}`, 'dato', !!e.caricato || !!e.critico); }
      else { hero.flash(); hud.number(hero.head(), `-${Math.round(e.danno)}`, 'preso'); }
    } else if (e.t === 'schivato') hud.number(hero.head(), 'schivato', 'info');
    else if (e.t === 'pozione') hud.number(hero.head(), '+', 'cura', true);
    else hud.event(e);
    if (e.t === 'altare') {
      controls?.setSalvato(true); sc?.setAltare(e.n); sc?.pulse(e.n);
      const n = nOggetti(s.bottino), m = s.monete;
      hud.flash('SALVATO', PAL.giallo, n || m ? `al sicuro: ${[n ? `${n} ${n === 1 ? 'oggetto' : 'oggetti'}` : '', m ? `${m} monete` : ''].filter(Boolean).join(' e ')}` : 'se cadi, ti risvegli qui', 1800);
      o.onAltare?.(out());
    }
    if (e.t === 'risveglio') hero.flash();
    if (e.t === 'rotto') hero.rotta();
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
    frames.push(q); dungeon.step(s, q); dungeonPasso(s.hero.x, s.hero.z);
    for (const e of s.eventi) onEvent(e);
  }

  const run: DungeonRun = {
    get active() { return phase !== 'over'; },
    step(f) {
      if (phase === 'end') { if (--wait <= 0 || (wait < END_WAIT - 40 && f.a)) finish(); return; }
      if (phase !== 'play' || !controls || controls.paused || isPanelOpen()) return;
      if (dungeonLink.autopilot > 0 && !auto) auto = createRng(o.seed).fork('autopilot');
      if (dungeonLink.autopilot === 0) auto = null;
      const n = auto ? dungeonLink.autopilot : dungeonLink.altare >= 0 ? 8 : 1;
      for (let i = 0; i < n && !s.done; i++) tickOnce(f);
      refresh();
      hero!.tick(dungeonLink.posa ? { ...view.hero, ...dungeonLink.posa } as DungeonView['hero'] : view.hero); actors!.tick(view);
      if (s.done) toEnd();
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
      controls.setLanterna(phase === 'play' && view.lanterna >= 0 ? { salvatoQui: view.salvatoQui, oggetti: nOggetti(view.zaino.bottino), monete: view.zaino.monete } : null);
      sc.setAltare(view.altari.findIndex((a) => a.attivo));
      const h = view.hero, rh = s.runHero, spell = rh.magia !== null ? rh.magie[rh.magia] : null;
      controls.setState(spell ? 1 - h.ricaricaMagia / Math.max(0.01, spell.ricarica) : 0, h.pozioni, !!spell && h.magicka >= spell.costo);
    },
    abort,
    done,
  };

  dungeonLink.act = (a) => act(a);
  dungeonLink.state = () => {
    const v = view, vivi = v.nemici.filter((n) => !n.alleato && n.anim !== 'morto').length;
    return {
      active: phase !== 'over', phase, dungeon: o.dungeon, tick: v.tick, outcome: v.outcome, frames: frames.length, auto: !!auto, paused: !!controls?.paused, zaino: v.zaino,
      hero: { x: v.hero.x, z: v.hero.z, vita: v.hero.vita, magicka: v.hero.magicka, stamina: v.hero.stamina, anim: v.hero.anim, arma: v.hero.arma, frecce: v.hero.frecce },
      nemici: v.nemici.filter((n) => !n.alleato).length, vivi, vicinoUscita: v.vicinoUscita,
      altari: v.altari, salvato: v.salvato, cadute: s.cadute, protetto: v.hero.protetto, lanterna: v.lanterna, salvatoQui: v.salvatoQui, partenza: s.partenza,
      equip: { ...s.equip }, azioni: azioni.length, pannello: isPanelOpen(),
      scene: sc?.stats() ?? null, actors: actors?.counts() ?? null,
    };
  };
  return run;
}

/** Scheda dell'esito (quello del server): bottino tenuto, monete, xp, livelli. Risolve quando il giocatore chiude. */
export async function showResult(ctx: RunCtx, r: DungeonFinish): Promise<void> { return showDungeonResult(ctx.root, r); }
