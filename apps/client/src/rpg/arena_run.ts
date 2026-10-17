// Il duello dell'Arena lato client (docs/ARENA.md, PROTOCOL §10): prende il controllo del ciclo come la spedizione nel dungeon. Scena del
// colosseo (dungeon_scene.ts con la DungeonDef di arena.json, tutta in vista), i due eroi (dungeon_hero.ts: io col mirino, l'avversario col
// suo look), evocazioni e proiettili (dungeon_actors.ts), raggi e bombe (magie_fx.ts), numeri del danno e nome sopra l'avversario
// (dungeon_hud.ts, col riquadro delle barre nascosto), tabellone, barra degli slot e scheda finale (arena_hud.ts).
// Ogni tick un DungeonInput (joystick, A e B di game/input.ts più clic, joystick di mira, mouse), quantizzato come nei dungeon. Le azioni
// della barra (slot, pozione, resa) sono azioni del duello (actDuello).
// Online (`o.rete`): come i dungeon insieme, il mio input va al server una volta per turno (SQ_TICKS tick) se cambia, le azioni pure; il
// duello avanza SOLO coi turni del server (stessi per tutti e due), col cuscinetto contro i ritardi e la corsa per recuperare. Linea persa:
// la rete prova a ricollegarsi (arena_menu.ts) e il duello aspetta. Fine: il server manda `fine` con l'esito del suo replay e il premio.
// Stanza di prova (`o.bot`, ?net=0&arena=banco, o ALLENAMENTO dal colosseo): niente server, l'avversario è il bot (sim/arena/bot.ts), si
// gioca tick per tick come un dungeon da solo; la pausa ferma tutto.
import { createRng } from '@marea/sim';
import type { InputFrame, Rng } from '@marea/sim';
import type { Look } from '@marea/protocol';
import { ARENA_MAPPA } from '@marea/content/arena.ts';
import { actDuello, createDuello, hashDuello, stepDuello, viewDuello } from '@marea/sim/arena/duello.ts';
import type { ArenaAzione, DuelloEsito, DuelloState, DuelloView } from '@marea/sim/arena/duello.ts';
import { botArena } from '@marea/sim/arena/bot.ts';
import type { ArenaEroe } from '@marea/sim/rpg/arena.ts';
import { quantizeDungeon } from '@marea/sim/dungeon/replay.ts';
import { aim } from '@marea/sim/dungeon/hero.ts';
import { COS_CONO_ARCO, MAGIA_GITTATA } from '@marea/sim/dungeon/tuning.ts';
import type { CompagnoView, DungeonEvent, DungeonInput, DungeonView } from '@marea/sim/dungeon/types.ts';
import { NO_DUNGEON_INPUT } from '@marea/sim/dungeon/types.ts';
import { SQ_TICKS } from '@marea/protocol/arena.ts';
import type { ArClientMsg, ArTurno, SqInput } from '@marea/protocol/arena.ts';
import { PAL } from '../ui/style.ts';
import { dungeonEvento, dungeonPasso } from '../audio/ponte.ts';
import { registerStateProvider } from '../test/testapi.ts';
import type { RunCtx } from './types.ts';
import { createDungeonScene } from './dungeon_scene.ts';
import type { DungeonScene } from './dungeon_scene.ts';
import { createHeroActor } from './dungeon_hero.ts';
import type { HeroActor } from './dungeon_hero.ts';
import { createActors } from './dungeon_actors.ts';
import type { Actors } from './dungeon_actors.ts';
import { createDungeonHud } from './dungeon_hud.ts';
import type { DungeonHud } from './dungeon_hud.ts';
import { createMagieFx } from './magie_fx.ts';
import type { MagieFx } from './magie_fx.ts';
import { createMouse } from './dungeon_mouse.ts';
import type { Mouse } from './dungeon_mouse.ts';
import { createArenaHud } from './arena_hud.ts';
import type { ArenaControlli } from './arena_hud.ts';

/** Un duellante come lo vede il client: nome, look, la fotografia del set. */
export type ArenaDuellante = { nome: string; look: Look; eroe: ArenaEroe };
/** La rete del duello vista dal duello: i turni arrivati e non ancora giocati, `attesa` (l'avversario ha perso la linea: fino a quando), la
 *  fine mandata dal server (esito e premio), linea chiusa per sempre. */
export type ArenaRete = {
  turni: ArTurno[];
  manda(m: ArClientMsg): void;
  readonly chiusa: boolean;
  readonly attesa: { chi: number; fino: number } | null;
  readonly fine: { esito: DuelloEsito | null; premio: number; tetto: boolean } | null;
};
export type ArenaRun = {
  readonly active: boolean;
  step(f: InputFrame): void;
  update(alpha: number, dt: number, t: number): void;
  abort(): void;
  /** Fine: l'esito (null = annullato o lasciato), `rivincita` se nella stanza di prova si vuole rigiocare. */
  readonly done: Promise<{ esito: DuelloEsito | null; rivincita: boolean }>;
};

type Phase = 'loading' | 'play' | 'end' | 'over';
/** Test (hook arenaAuto): il mio eroe lo guida l'avversario automatico, input e azioni registrati come quelli di un giocatore. */
export const arenaLink = { auto: false };
const CUSCINETTO = 2 * SQ_TICKS, SVELTO = 4 * SQ_TICKS, RECUPERO = 30 * SQ_TICKS;
const END_WAIT = 90; // tick di scritta finale prima della scheda
const bitsOf = (f: DungeonInput) => (f.a ? 1 : 0) | (f.b ? 2 : 0) | (f.c ? 4 : 0) | (f.d ? 8 : 0) | (f.e ? 16 : 0);
const frameOf = (x: SqInput): DungeonInput => ({ mx: x[0] / 8, my: x[1] / 8, a: (x[2] & 1) !== 0, b: (x[2] & 2) !== 0, c: (x[2] & 4) !== 0, d: (x[2] & 8) !== 0, ...((x[2] & 16) !== 0 ? { e: true } : {}), ...(x[3] ? { m: x[3] } : {}) });

export function startArenaRun(ctx: RunCtx, o: { seed: number; eroi: [ArenaDuellante, ArenaDuellante]; io: number; rete?: ArenaRete; bot?: boolean }): ArenaRun {
  const rete = o.rete ?? null, io = o.io, lui = 1 - io;
  const d: DuelloState = createDuello({ seed: o.seed, eroi: o.eroi.map((e) => e.eroe) });
  const nomi: [string, string] = [o.eroi[io]!.nome, o.eroi[lui]!.nome];
  let phase: Phase = 'loading', wait = 0, view: DuelloView = viewDuello(d, io), auto: Rng | null = null;
  const botRng: Rng = createRng(o.seed).fork('bot');
  let sc: DungeonScene | null = null, me: HeroActor | null = null, lei: HeroActor | null = null, actors: Actors | null = null, hud: DungeonHud | null = null, ahud: ArenaControlli | null = null, gfx: MagieFx | null = null, mouse: Mouse | null = null;
  let resolve!: (v: { esito: DuelloEsito | null; rivincita: boolean }) => void;
  const done = new Promise<{ esito: DuelloEsito | null; rivincita: boolean }>((r) => (resolve = r));
  const win = { mx: 0, my: 0, bits: 0, m: 0, n: 0 };
  let contaVista = -1, mandato = '0,0,0', inTurno = 0, attesa = true, armaIo: string | null = null, armaLui: string | null = null, tapT = 0, finaleAperto = false, premioVisto = false;
  const firme: Record<number, number> = {};

  const cleanup = () => {
    phase = 'over';
    mouse?.dispose(); ctx.canvas.style.cursor = ''; ahud?.dispose(); hud?.dispose(); actors?.dispose(); gfx?.dispose(); me?.dispose(); lei?.dispose(); sc?.dispose();
    ctx.renderer.setScene(null);
  };
  const chiudi = (esito: DuelloEsito | null, rivincita: boolean) => { if (phase === 'over') return; cleanup(); resolve({ esito, rivincita }); };
  const abort = () => {
    if (phase === 'over') return;
    if (rete) rete.manda({ t: 'esco' }); // in duello vale come resa
    chiudi(null, false);
  };
  /** Azione della barra adesso: online va al server (torna nel turno), da solo si applica subito. */
  const azione = (a: ArenaAzione) => {
    if (phase !== 'play') return;
    if (rete) { rete.manda({ t: 'az', a }); return; }
    const ev = actDuello(d, io, a);
    if (ev) for (const e of ev) onEvent(e);
  };

  ctx.hud.toast('Si entra nel colosseo…', 1500);
  void (async () => {
    try {
      await ctx.loader.extend('manifest_rpg.json');
      sc = await createDungeonScene(ctx.loader, ARENA_MAPPA, ctx.renderer.camera);
      const v = view.dungeon, c = v.compagni[0]!;
      me = await createHeroActor({ loader: ctx.loader, look: o.eroi[io]!.look, hero: d.s.eroi[io]!.runHero, scene: sc.scene, floorY: sc.floorY, x: v.hero.x, z: v.hero.z, mirino: true });
      lei = await createHeroActor({ loader: ctx.loader, look: o.eroi[lui]!.look, hero: d.s.eroi[lui]!.runHero, scene: sc.scene, floorY: sc.floorY, x: c.x, z: c.z });
      actors = createActors({ loader: ctx.loader, scene: sc });
      gfx = createMagieFx(sc.scene, sc.floorY);
      if ((phase as Phase) === 'over') { cleanup(); return; }
      hud = createDungeonHud({ root: ctx.root, canvas: ctx.canvas, camera: ctx.renderer.camera, hero: d.s.eroi[io]!.runHero, stile: 'colosseo' });
      ahud = createArenaHud({ root: ctx.root, canvas: ctx.canvas, yaw: () => ctx.renderer.diorama.yaw, slot: o.eroi[io]!.eroe.varianti, pozioni: o.eroi[io]!.eroe.pozioni, insieme: !!rete, onResa: () => azione({ t: 'resa' }) });
      mouse = createMouse({ canvas: ctx.canvas, camera: ctx.renderer.camera, floorY: sc.floorY });
      tickAttori();
      ctx.renderer.setScene(sc.scene);
      ctx.renderer.diorama.setZoom(ctx.canvas.clientHeight > ctx.canvas.clientWidth * 1.2 ? 1.45 : 1.15); // un po' più larghi che nei dungeon: l'avversario si deve vedere
      ctx.renderer.diorama.follow(v.hero.x, sc.floorY + 0.9, v.hero.z); ctx.renderer.diorama.snap?.();
      if (rete) rete.manda({ t: 'carico' });
      phase = 'play';
    } catch (e) {
      console.error('[marea] colosseo non caricato', e);
      ctx.hud.toast('Il colosseo non si è caricato, riprova', 3000);
      abort();
    }
  })();

  const testa = (i: number | undefined) => (i === lui ? lei!.head() : me!.head());
  function onEvent(e: DungeonEvent): void {
    if (!hud || !actors || !me || !lei) return;
    const mio = e.eroe === undefined || e.eroe === io;
    if (mio || e.t === 'colpo' || e.t === 'morte') dungeonEvento(e);
    if (e.t === 'colpo') {
      if (e.su === 'nemico') { if (e.id !== undefined) actors.hit(e.id); const p = e.id !== undefined ? actors.posOf(e.id) : null; if (p) hud.number(p, `${Math.round(e.danno)}`, 'dato', !!e.caricato); }
      else { (e.eroe === lui ? lei : me).flash(); hud.number(testa(e.eroe), `-${Math.round(e.danno)}`, e.eroe === lui ? 'dato' : 'preso', !!e.caricato); }
    } else if (e.t === 'pozione' || e.t === 'cura') hud.number(testa(e.eroe), '+', 'cura', true);
    else if (mio && (e.t === 'senzaMagicka' || e.t === 'senzaFrecce')) hud.event(e);
  }
  function onDuello(): void {
    if (!ahud) return;
    for (const e of d.eventi) {
      if (e.t === 'via') ahud.grande('VIA!', PAL.giallo, `Round ${e.round + 1}`, 900);
      else if (e.t === 'round') {
        const w = e.esito.vincitore, txt = w === null ? 'PARI' : w === io ? 'ROUND VINTO' : 'ROUND PERSO';
        ahud.grande(txt, w === null ? PAL.pietra : w === io ? PAL.erbaChiara : PAL.rosso, e.esito.perche === 'tempo' ? 'tempo scaduto: vince chi ha più vita' : e.esito.perche === 'pari' ? 'nessun punto' : `${d.vinti[io]} a ${d.vinti[lui]}`, 2400);
      } else if (e.t === 'fine') toEnd();
    }
  }
  const toEnd = () => {
    if (phase !== 'play') return;
    phase = 'end'; wait = END_WAIT; ahud?.hide();
    const es = d.esito, w = es?.vincitore;
    ahud?.grande(w === undefined || w === null ? 'PAREGGIO' : w === io ? 'VITTORIA!' : 'SCONFITTA', w === io ? PAL.giallo : w === null || w === undefined ? PAL.pietra : PAL.rosso, '', 0);
  };
  async function scheda(): Promise<void> {
    if (finaleAperto || !ahud) return;
    finaleAperto = true;
    const f = rete?.fine ?? null;
    premioVisto = !!f;
    const v = await ahud.finale(d.esito, io, f ? { monete: f.premio, tetto: f.tetto } : null, !rete);
    chiudi(d.esito, v === 'rivincita');
  }

  /** L'avversario nella forma della vista dell'eroe (l'attore legge solo posizione, direzione, animazione, fase, carica, stile, mano). */
  const posaDi = (c: CompagnoView): DungeonView['hero'] => {
    const p: DungeonView['hero'] = { ...view.dungeon.hero, x: c.x, z: c.z, fx: c.fx, fz: c.fz, anim: c.anim, t: c.t, carica: c.carica, vita: c.vita, protetto: c.protetto, arma: c.arma };
    if (c.stile) p.stile = c.stile; else delete p.stile;
    if (c.magia) p.magia = c.magia; else delete p.magia;
    if (c.canale) p.canale = c.canale; else delete p.canale;
    return p;
  };
  function tickAttori(): void {
    view = viewDuello(d, io);
    const v = view.dungeon, c = v.compagni[0];
    const ai = d.s.eroi[io]!, al = d.s.eroi[lui]!;
    if (ai.hero.arma.id !== armaIo) { armaIo = ai.hero.arma.id; void me!.setArma(ai.hero.arma); }
    if (al.hero.arma.id !== armaLui) { armaLui = al.hero.arma.id; void lei!.setArma(al.hero.arma); }
    me!.equip(ai.runHero); lei!.equip(al.runHero);
    me!.tick(v.hero);
    if (c) lei!.tick(posaDi(c));
    actors!.tick(v); gfx!.tick(v);
    miraOra();
  }
  /** Arco teso: verso chi prenderà la freccia (la stessa `aim` della sim), per la linea di mira. */
  const miraArco = (): { x: number; z: number } | null => {
    const h = d.s.eroi[io]!.hero;
    if (h.act !== 'tende') return null;
    const prima = d.s.cur; d.s.cur = io;
    const e = aim(d.s, MAGIA_GITTATA * 2, COS_CONO_ARCO, 0, true);
    d.s.cur = prima;
    const dx = e ? e.x - h.x : 0, dz = e ? e.z - h.z : 0, l = Math.sqrt(dx * dx + dz * dz);
    return l > 1e-6 ? { x: dx / l, z: dz / l } : null;
  };
  const mira = () => { const h = d.s.eroi[io]!.hero; return h.incanta || h.arma.kind === 'arco'; };
  const miraOra = (): void => {
    const h = d.s.eroi[io]!.hero, t = ahud?.miraDir() ?? null, v = t ?? (mira() && !ahud?.paused ? mouse?.verso(h.x, h.z) ?? null : null);
    if (!v) { me!.mira(miraArco()); return; }
    me!.mira({ x: v.x, z: v.z }, true);
  };

  /** L'input di adesso: autopilota (test), o tastiera/joystick più clic, mira e barra. Le scelte della barra diventano azioni. */
  function inputOra(f: InputFrame): DungeonInput {
    const c = ahud!.sample();
    if (c.slot !== null) azione({ t: 'slot', n: c.slot });
    if (c.pozione !== null) azione({ t: 'pozione', n: c.pozione });
    if (auto) { const b = botArena(d, io, auto); if (b.azione) azione(b.azione); return b.input; }
    const h = d.s.eroi[io]!.hero;
    if (c.tap && mira()) tapT = 120;
    let aTap = false;
    if (tapT > 0) {
      tapT--;
      if (h.act === 'tende') aTap = h.carica < 1; else if (h.act === 'punta') aTap = false; else aTap = h.act === 'idle' && tapT >= 118;
      if (h.act === 'tira' || h.act === 'lancia') tapT = 0;
    }
    const a = f.a || c.a || aTap, punta = mouse && mira() ? mouse.verso(h.x, h.z)?.m ?? 0 : 0;
    const m = aTap ? 0 : c.m || (a || h.act === 'tende' || h.act === 'punta' ? punta : 0);
    return { mx: f.mx, my: f.my, a, b: f.b, c: false, d: false, ...(c.e ? { e: true } : {}), ...(m ? { m } : {}) };
  }

  // ---- da solo (stanza di prova): un tick per frame, il bot fa l'altro ----
  function tickSolo(f: InputFrame): void {
    const q = quantizeDungeon(inputOra(f));
    const b = botArena(d, lui, botRng);
    if (b.azione) actDuello(d, lui, b.azione);
    stepDuello(d, [io === 0 ? q : quantizeDungeon(b.input), io === 0 ? quantizeDungeon(b.input) : q]);
    dungeonPasso(d.s.eroi[io]!.hero.x, d.s.eroi[io]!.hero.z);
    for (const e of d.s.eventi) onEvent(e);
    onDuello();
  }

  // ---- online: coi turni del server ----
  function stepRete(f: InputFrame): void {
    const r = rete!;
    if (phase === 'play' && d.fase !== 'finita') {
      const q = quantizeDungeon(ahud!.paused && !auto ? { ...NO_DUNGEON_INPUT } : inputOra(f));
      win.mx = q.mx; win.my = q.my; win.bits |= bitsOf(q); if (q.m) win.m = q.m;
      if (++win.n >= SQ_TICKS) {
        const x: SqInput = win.m ? [Math.round(win.mx * 8) || 0, Math.round(win.my * 8) || 0, win.bits, win.m] : [Math.round(win.mx * 8) || 0, Math.round(win.my * 8) || 0, win.bits], k = x.join(',');
        if (k !== mandato) { mandato = k; r.manda({ t: 'in', f: x }); }
        win.bits = 0; win.m = 0; win.n = 0;
      }
    }
    ahud?.attesa(r.attesa ? `${nomi[1]} ha perso la linea: lo aspetto ancora ${Math.max(0, Math.ceil((r.attesa.fino - Date.now()) / 1000))} s` : null);
    if (r.chiusa && phase === 'play' && d.fase !== 'finita' && !r.turni.length) { ctx.hud.toast('Duello interrotto: connessione persa', 3000); chiudi(null, false); return; }
    const pronti = r.turni.length * SQ_TICKS - inTurno;
    if (pronti <= 0) { attesa = true; return; }
    if (attesa && pronti < CUSCINETTO) return;
    attesa = false;
    const n = pronti > RECUPERO ? pronti - CUSCINETTO : pronti > SVELTO ? 2 : 1;
    for (let k = 0; k < n && phase !== 'over'; k++) tickRete(n > 2);
  }
  /** Un tick del turno in testa: al primo tick le azioni del turno (come le ha messe il server), poi il passo dei due. */
  function tickRete(muto: boolean): void {
    const r = rete!, t = r.turni[0]!;
    if (inTurno === 0) for (const [i, a] of t.az ?? []) { const ev = actDuello(d, i, a); if (ev && !muto) for (const e of ev) onEvent(e); }
    stepDuello(d, t.f.map(frameOf));
    if (d.tick % 300 === 0) firme[d.tick] = hashDuello(d); // test: ogni 5 s lo stato, uguale per tutti e due i giocatori
    if (!muto) { dungeonPasso(d.s.eroi[io]!.hero.x, d.s.eroi[io]!.hero.z); for (const e of d.s.eventi) onEvent(e); }
    onDuello();
    if (++inTurno >= SQ_TICKS) { r.turni.shift(); inTurno = 0; }
  }

  const run: ArenaRun = {
    get active() { return phase !== 'over'; },
    step(f) {
      if (phase === 'loading' || phase === 'over' || !ahud) return;
      if (rete?.fine && finaleAperto && !premioVisto) { premioVisto = true; ahud.premio({ monete: rete.fine.premio, tetto: rete.fine.tetto }); }
      if (phase === 'end') {
        if (rete && d.fase !== 'finita') stepRete(f); // il turno della fine può arrivare dopo
        if (--wait <= 0 || (wait < END_WAIT - 40 && f.a)) void scheda();
        return;
      }
      if (arenaLink.auto && !auto) auto = createRng(o.seed + io).fork('autopilot');
      if (!arenaLink.auto) auto = null;
      if (rete) stepRete(f);
      else if (!ahud.paused) tickSolo(f);
      if ((phase as Phase) === 'over') return;
      tickAttori();
      // conto alla rovescia: il numero grande (cambia una volta al secondo)
      const conta = d.fase === 'conta' ? view.secondi : -1;
      if (conta !== contaVista) { contaVista = conta; if (conta > 0) ahud.grande(String(conta), PAL.giallo, d.round ? `Round ${d.round + 1}` : 'Si comincia', 0); }
      ahud.setMira(phase === 'play' && mira() && d.fase === 'gioca');
      // la rete chiusa a duello finito: la scheda arriva lo stesso
      if (rete?.fine && d.fase !== 'finita' && rete.turni.length === 0) { ctx.hud.toast('Il server ha chiuso il duello', 2500); phase = 'play'; toEnd(); }
    },
    update(alpha, dt, t) {
      if (!sc || !me || !lei || !actors || !hud || !ahud || phase === 'over' || phase === 'loading') return;
      me.update(alpha, dt); lei.update(alpha, dt);
      const p = me.avatar.object.position;
      ctx.renderer.diorama.follow(p.x, sc.floorY + 0.9, p.z); ctx.renderer.diorama.update(dt);
      sc.update(p.x, p.z, t);
      actors.update(alpha, dt, t, { x: p.x, z: p.z });
      gfx?.update(t, { x: p.x, z: p.z }, view.dungeon);
      ahud.set(view, nomi);
      hud.bars(actors.bars());
      const c = view.dungeon.compagni[0];
      if (c && !c.done) { const pos = lei.head().clone(); pos.y += 0.35; hud.compagni([{ pos, nome: nomi[1], frac: c.vita / Math.max(1, c.max) }]); } else hud.compagni([]);
      const cur = mouse?.attivo && mira() ? 'crosshair' : '';
      if (ctx.canvas.style.cursor !== cur) ctx.canvas.style.cursor = cur;
    },
    abort,
    done,
  };

  registerStateProvider('arenaDuello', () => (phase === 'over' ? null : {
    phase, fase: d.fase, round: d.round, vinti: [...d.vinti], esito: d.esito, tick: d.tick, io, slot: view.slot, secondi: view.secondi,
    vita: d.s.eroi.map((r) => Math.round(r.hero.vita * 10) / 10), pos: d.s.eroi.map((r) => [Math.round(r.hero.x * 100) / 100, Math.round(r.hero.z * 100) / 100]),
    turni: rete?.turni.length ?? 0, firme: { ...firme }, auto: !!auto, pausa: !!ahud?.paused, finale: finaleAperto,
  }));
  return run;
}
