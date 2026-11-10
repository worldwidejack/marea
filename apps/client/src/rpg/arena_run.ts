// La partita dell'Arena lato client (docs/ARENA.md, PROTOCOL §10). Ogni eroe ha un gruppo suo: posa, equipaggiamento ed effetti.
// Da terra la camera segue un compagno o chi mi ha buttato giù. Ogni tick usa un DungeonInput quantizzato.
// Online (`o.rete`): il mio input va al server una volta per turno (SQ_TICKS tick) se cambia, le azioni pure; la partita avanza SOLO coi turni
// del server, col cuscinetto contro i ritardi e la corsa per recuperare; alla fine il server manda `fine` con l'esito del suo replay e il premio.
import * as THREE from 'three';
import { createRng } from '@marea/sim';
import type { InputFrame, Rng } from '@marea/sim';
import type { Look } from '@marea/protocol';
import { ARENA, arenaMappa, arenaModo, arenaUlti } from '@marea/content/arena.ts';
import type { ArenaModo } from '@marea/content/arena.ts';
import { actPartita, createPartita, hashPartita, stepPartita, viewPartita } from '@marea/sim/arena/partita.ts';
import type { ArenaAzione, PartitaEsito, PartitaState, PartitaView } from '@marea/sim/arena/partita.ts';
import { botArena } from '@marea/sim/arena/bot.ts';
import type { ArenaEroe } from '@marea/sim/rpg/arena.ts';
import { quantizeDungeon } from '@marea/sim/dungeon/replay.ts';
import { aim, aimBomba } from '@marea/sim/dungeon/hero.ts';
import { distanzaBomba } from '@marea/sim/dungeon/magie.ts';
import { COS_CONO_ARCO, MAGIA_GITTATA } from '@marea/sim/dungeon/tuning.ts';
import type { CompagnoView, DungeonEvent, DungeonInput, DungeonView } from '@marea/sim/dungeon/types.ts';
import { NO_DUNGEON_INPUT } from '@marea/sim/dungeon/types.ts';
import { SQ_TICKS } from '@marea/protocol/arena.ts';
import type { ArClientMsg, ArTurno, SqInput } from '@marea/protocol/arena.ts';
import { PAL } from '../ui/style.ts';
import { dungeonEvento, dungeonPasso } from '../audio/ponte.ts';
import { registerStateProvider, registerTestHook } from '../test/testapi.ts';
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
import { createArenaFx } from './arena_fx.ts';
import type { ArenaFx } from './arena_fx.ts';
import type { ArenaControlli } from './arena_hud.ts';
import { creaMiraBomba } from './arena_mira.ts';
import { creaVisibilitaArena } from './arena_visibilita.ts';
import { createArenaSegni } from './arena_segni.ts';
import type { ArenaSegni } from './arena_segni.ts';

/** Un giocatore come lo vede il client: nome, look, la fotografia del set. */
export type ArenaDuellante = { nome: string; look: Look; eroe: ArenaEroe };
/** La rete vista dalla partita: i turni arrivati e non giocati, `attesa` (chi ha perso la linea e fino a quando), la fine del server, linea chiusa. */
export type ArenaRete = {
  turni: ArTurno[];
  manda(m: ArClientMsg): void;
  readonly chiusa: boolean;
  readonly attesa: { chi: number; fino: number } | null;
  readonly fine: { esito: PartitaEsito | null; premio: number; tetto: boolean } | null;
};
export type ArenaRun = {
  readonly active: boolean;
  step(f: InputFrame): void;
  update(alpha: number, dt: number, t: number): void;
  abort(): void;
  /** Fine: l'esito (null = annullata o lasciata), `rivincita` se nell'allenamento si vuole rigiocare. */
  readonly done: Promise<{ esito: PartitaEsito | null; rivincita: boolean }>;
};
/** Chi gioca (`eroi` in ordine di squadra, `io` = il mio indice), la modalità, gli eroi per squadra, la mappa, la rete (senza: allenamento). */
export type ArenaOpz = { seed: number; eroi: ArenaDuellante[]; io: number; modo: ArenaModo; per: number; mappa: string; rete?: ArenaRete };

type Phase = 'loading' | 'play' | 'end' | 'over';
/** Test (hook arenaAuto): il mio eroe lo guida il gladiatore automatico, input e azioni registrati come quelli di un giocatore. */
export const arenaLink = { auto: false };
const CUSCINETTO = 2 * SQ_TICKS, SVELTO = 4 * SQ_TICKS, RECUPERO = 30 * SQ_TICKS;
const END_WAIT = 90; // tick di scritta finale prima della scheda
const CAM_VERSO = 5;
const bitsOf = (f: DungeonInput) => (f.a ? 1 : 0) | (f.b ? 2 : 0) | (f.c ? 4 : 0) | (f.d ? 8 : 0) | (f.e ? 16 : 0) | (f.roll ? 32 : 0);
const frameOf = (x: SqInput): DungeonInput => ({ mx: x[0] / 8, my: x[1] / 8, a: (x[2] & 1) !== 0, b: (x[2] & 2) !== 0, c: (x[2] & 4) !== 0, d: (x[2] & 8) !== 0, ...((x[2] & 16) !== 0 ? { e: true } : {}), ...((x[2] & 32) !== 0 ? { roll: true } : {}), ...(x[3] ? { m: x[3] } : {}) });

export function startArenaRun(ctx: RunCtx, o: ArenaOpz): ArenaRun {
  const rete = o.rete ?? null, io = o.io;
  const d: PartitaState = createPartita({ seed: o.seed, eroi: o.eroi.map((e) => e.eroe), modo: o.modo, per: o.per, mappa: o.mappa });
  const mia = d.squadre[io]!, nomi = o.eroi.map((e) => e.nome), mappa = arenaMappa(d.mappa), modo = arenaModo(d.modo);
  let phase: Phase = 'loading', wait = 0, view: PartitaView = viewPartita(d, io), auto: Rng | null = null, chiMiHa = -1;
  const botRng: Rng[] = o.eroi.map((_, j) => createRng(o.seed).fork('bot' + j));
  let sc: DungeonScene | null = null, actors: Actors | null = null, hud: DungeonHud | null = null, ahud: ArenaControlli | null = null, gfx: MagieFx | null = null, mouse: Mouse | null = null, afx: ArenaFx | null = null, segni: ArenaSegni | null = null;
  /** Gli eroi: ognuno in un gruppo suo (si nasconde intero: avatar, arma, scie). */
  const eroi: (HeroActor | null)[] = [], gruppi: THREE.Scene[] = [], armi: (string | null)[] = o.eroi.map(() => null);
  const visibilita = o.eroi.map(creaVisibilitaArena), miraBomba = creaMiraBomba();
  let resolve!: (v: { esito: PartitaEsito | null; rivincita: boolean }) => void;
  const done = new Promise<{ esito: PartitaEsito | null; rivincita: boolean }>((r) => (resolve = r));
  const win = { mx: 0, my: 0, bits: 0, m: 0, n: 0 };
  let ombra: ReturnType<typeof ombraDi> = null; // l'ombra di mira di adesso (anche per i test)
  let contaVista = -1, mandato = '0,0,0', inTurno = 0, attesa = true, tapT = 0, finaleAperto = false, premioVisto = false;
  const firme: Record<number, number> = {};

  const cleanup = () => {
    phase = 'over'; mouse?.dispose(); ctx.canvas.style.cursor = ''; ahud?.dispose(); afx?.dispose(); segni?.dispose(); hud?.dispose(); actors?.dispose(); gfx?.dispose();
    for (const e of eroi) e?.dispose(); for (const g of gruppi) g.removeFromParent(); sc?.dispose(); ctx.renderer.setScene(null);
  };
  const chiudi = (esito: PartitaEsito | null, rivincita: boolean) => { if (phase === 'over') return; cleanup(); resolve({ esito, rivincita }); };
  const abort = () => { if (phase === 'over') return; if (rete) rete.manda({ t: 'esco' }); chiudi(null, false); }; // in partita `esco` vale come resa
  /** Azione della barra adesso: online va al server (torna nel turno), da solo si applica subito. Allenamento: con la resa si arrendono anche
   *  i gladiatori della mia squadra; tutti contro tutti si esce e basta. */
  const azione = (a: ArenaAzione) => {
    if (phase !== 'play') return;
    if (rete) { rete.manda({ t: 'az', a }); return; }
    for (const e of actPartita(d, io, a) ?? []) onEvent(e);
    if (a.t === 'resa') { d.squadre.forEach((q, j) => { if (q === mia && j !== io) actPartita(d, j, a); }); if (d.fase !== 'finita') chiudi(null, false); }
  };

  ctx.hud.toast('Si entra nell’arena…', 1500);
  void (async () => {
    try {
      await ctx.loader.extend('manifest_rpg.json');
      sc = await createDungeonScene(ctx.loader, mappa, ctx.renderer.camera);
      const scena = sc;
      await Promise.all(o.eroi.map(async (e, j) => {
        const g = new THREE.Scene(); scena.scene.add(g); gruppi[j] = g;
        const h = d.s.eroi[j]!;
        eroi[j] = await createHeroActor({ loader: ctx.loader, look: e.look, hero: h.runHero, scene: g, floorY: scena.floorY, x: h.hero.x, z: h.hero.z, mirino: j === io });
      }));
      actors = createActors({ loader: ctx.loader, scene: sc });
      gfx = createMagieFx(sc.scene, sc.floorY);
      afx = createArenaFx(sc.scene, sc.floorY, d.eroi.map((e) => e.dote));
      const m = sc.map;
      segni = createArenaSegni({ scene: sc.scene, floorY: sc.floorY, root: ctx.root, canvas: ctx.canvas, camera: ctx.renderer.camera, mia, io, mappa: { w: m.w, h: m.h, tile: m.tile, stile: mappa.stile, solido: (cx, cz) => cx < 0 || cz < 0 || cx >= m.w || cz >= m.h || mappa.rows[cz]![cx] === '#' } });
      if ((phase as Phase) === 'over') { cleanup(); return; }
      hud = createDungeonHud({ root: ctx.root, canvas: ctx.canvas, camera: ctx.renderer.camera, hero: d.s.eroi[io]!.runHero, stile: 'colosseo' });
      ahud = createArenaHud({ root: ctx.root, canvas: ctx.canvas, yaw: () => ctx.renderer.diorama.yaw, slot: d.eroi[io]!.varianti, ulti: d.eroi[io]!.ulti, insieme: !!rete, squadre: d.squadre, io, modo: d.modo, onResa: () => azione({ t: 'resa' }) });
      mouse = createMouse({ canvas: ctx.canvas, camera: ctx.renderer.camera, floorY: sc.floorY });
      tickAttori();
      ctx.renderer.setScene(sc.scene);
      ctx.renderer.diorama.setZoom(ctx.canvas.clientHeight > ctx.canvas.clientWidth * 1.2 ? 1.9 : 1.3); // più larghi che nei dungeon: gli avversari si devono vedere
      const v = view.dungeon;
      ctx.renderer.diorama.follow(v.hero.x, sc.floorY + 0.9, v.hero.z); ctx.renderer.diorama.snap?.();
      if (rete) rete.manda({ t: 'carico' });
      phase = 'play';
    } catch (e) {
      console.error('[marea] arena non caricata', e); ctx.hud.toast('L’arena non si è caricata, riprova', 3000); abort();
    }
  })();

  const testa = (i: number | undefined) => (eroi[i ?? io] ?? eroi[io]!).head();
  const visto = (j: number) => j === io || !!gruppi[j]?.visible;
  function onEvent(e: DungeonEvent): void {
    if (!hud || !actors || !eroi[io]) return;
    const mio = e.eroe === undefined || e.eroe === io;
    if (mio || e.t === 'colpo' || e.t === 'morte') dungeonEvento(e);
    if (e.t === 'colpo') {
      if (e.su === 'nemico') { if (e.id !== undefined) actors.hit(e.id); const p = e.id !== undefined ? actors.posOf(e.id) : null; if (p) hud.number(p, `${Math.round(e.danno)}`, 'dato', !!e.caricato); }
      else { const j = e.eroe ?? io; if (!visto(j)) return; eroi[j]?.flash(); hud.number(testa(j), `-${Math.round(e.danno)}`, d.squadre[j] === mia ? 'preso' : 'dato', !!e.caricato); }
    } else if (e.t === 'pozione' || e.t === 'cura') hud.number(testa(e.eroe), '+', 'cura', true);
    else if (mio && (e.t === 'senzaMagicka' || e.t === 'senzaFrecce')) hud.event(e);
  }
  function onPartita(): void {
    if (!ahud || !hud) return;
    for (const e of d.eventi) {
      if (e.t === 'via') ahud.grande('VIA!', PAL.giallo, modo.nome, 900);
      else if (e.t === 'ulti') { const p = eroi[e.i]; if (p && visto(e.i)) hud.number(p.head(), arenaUlti(e.id).nome.toUpperCase(), d.squadre[e.i] === mia ? 'cura' : 'dato', true); }
      else if (e.t === 'ko') {
        if (e.i === io) chiMiHa = e.da;
        if (e.da === io) hud.number(testa(e.i), 'KO!', 'dato', true);
      } else if (e.t === 'stelle') { if (visto(e.da)) hud.number(testa(e.da), `+${e.n} ★`, e.q === mia ? 'cura' : 'dato', true); }
      else if (e.t === 'rosse') { if (visto(e.i)) hud.number(testa(e.i), `+${e.n} moneta rossa`, d.squadre[e.i] === mia ? 'cura' : 'dato', true); }
      else if (e.t === 'zona') ahud.grande(e.q === mia ? 'ZONA PRESA!' : 'ZONA PERSA', e.q === mia ? PAL.erbaChiara : PAL.rosso, d.zone.some((z) => z.di < 0) ? `Zona ${e.z + 1}: tutti all'altra!` : `Zona ${e.z + 1}`, 2200);
      else if (e.t === 'fuori') { if (e.q === mia) ahud.grande('SEI FUORI', PAL.rosso, `${e.posto}° posto`, 2600); else hud.say(`Una squadra è fuori: ne restano ${e.posto - 1}`, 1600); }
      else if (e.t === 'fine') toEnd();
    }
  }
  const toEnd = () => {
    if (phase !== 'play') return;
    phase = 'end'; wait = END_WAIT; ahud?.hide();
    const w = d.esito?.vincitore;
    ahud?.grande(w === undefined || w === null ? 'PAREGGIO' : w === mia ? 'VITTORIA!' : 'SCONFITTA', w === mia ? PAL.giallo : w === null || w === undefined ? PAL.pietra : PAL.rosso, '', 0);
  };
  async function scheda(): Promise<void> {
    if (finaleAperto || !ahud) return;
    finaleAperto = true;
    const f = rete?.fine ?? null;
    premioVisto = !!f;
    const v = await ahud.finale(d.esito, mia, f ? { monete: f.premio, tetto: f.tetto } : null, !rete);
    chiudi(d.esito, v === 'rivincita');
  }

  /** Un altro eroe nella forma della vista dell'eroe (l'attore legge solo posizione, direzione, animazione, fase, carica, stile, mano). */
  const posaDi = (c: CompagnoView): DungeonView['hero'] => {
    const p: DungeonView['hero'] = { ...view.dungeon.hero, x: c.x, z: c.z, fx: c.fx, fz: c.fz, anim: c.anim, t: c.t, carica: c.carica, vita: c.vita, protetto: c.protetto, arma: c.arma };
    if (c.stile) p.stile = c.stile; else delete p.stile;
    if (c.magia) p.magia = c.magia; else delete p.magia;
    if (c.canale) p.canale = c.canale; else delete p.canale;
    return p;
  };
  /** Gli attori dalla vista: la mia posa, quella degli altri che vedo (gli altri spariscono: a terra, o nascosti nell'erba alta). */
  function tickAttori(): void {
    view = viewPartita(d, io);
    const v = view.dungeon;
    d.eroi.forEach((_, j) => {
      const a = eroi[j], r = d.s.eroi[j]!;
      if (!a) return;
      if (r.hero.arma.id !== armi[j]) { armi[j] = r.hero.arma.id; void a.setArma(r.hero.arma); }
      a.equip(r.runHero);
      const c = j === io ? null : v.compagni.find((x) => x.i === j);
      const posa = r.done ? null : j === io ? v.hero : c ? posaDi(c) : null;
      visibilita[j]!.tick(gruppi[j]!, a, posa);
    });
    actors!.tick(v); gfx!.tick(v);
    miraOra(); ombraOra();
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
  const bombaInMano = () => { const { hero, runHero: rh } = d.s.eroi[io]!; return hero.incanta && rh.magia !== null && rh.magie[rh.magia]?.forma === 'bomba'; };
  const miraManuale = () => { const h = d.s.eroi[io]!.hero; return bombaInMano() && h.act === 'punta' ? miraBomba.dir() : ahud?.miraDir() ?? (mira() && !ahud?.paused ? mouse?.verso(h.x, h.z) ?? null : null); };
  const miraOra = (): void => {
    const v = miraManuale();
    if (!v) { eroi[io]!.mira(miraArco()); return; }
    eroi[io]!.mira({ x: v.x, z: v.z }, true);
  };
  /** Mentre punto una bomba: a terra, solo per me, dove atterrerebbe (la distanza è quella della sim). Senza una mira a mano al rilascio l'eroe si
   *  gira verso il bersaglio più vicino, e l'ombra fa lo stesso. */
  const ombraDi = (): { x: number; z: number; r: number; el?: 'fuoco' | 'elettricita' | 'cura' | 'furia' } | null => {
    const r = d.s.eroi[io]!, h = r.hero, rh = r.runHero, sp = rh.magia !== null ? rh.magie[rh.magia] : undefined;
    if (phase !== 'play' || d.fase !== 'gioca' || r.done || h.act !== 'punta' || sp?.forma !== 'bomba') return null;
    const prima = d.s.cur; d.s.cur = io;
    const manuale = miraManuale();
    let fx = manuale?.x ?? h.fx, fz = manuale?.z ?? h.fz;
    if (!manuale) {
      const e = aimBomba(d.s, sp);
      const dx = e ? e.x - h.x : 0, dz = e ? e.z - h.z : 0, l = Math.sqrt(dx * dx + dz * dz);
      if (l > 1e-6) { fx = dx / l; fz = dz / l; }
    }
    const dist = distanzaBomba(d.s, sp, fx, fz);
    d.s.cur = prima;
    return { x: h.x + fx * dist, z: h.z + fz * dist, r: sp.raggio, ...(sp.elemento ? { el: sp.elemento as 'fuoco' | 'elettricita' | 'cura' | 'furia' } : {}) };
  };
  const ombraOra = (): void => { ombra = ombraDi(); gfx?.ombra(ombra); };

  /** L'input di adesso: autopilota (test), o tastiera/joystick più clic, mira e barra. Le scelte della barra diventano azioni. */
  function inputOra(f: InputFrame): DungeonInput {
    const c = ahud!.sample();
    if (c.slot !== null) azione({ t: 'slot', n: c.slot });
    if (c.ulti) azione({ t: 'ulti' });
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
    const stabile = miraBomba.campiona(m, a, !aTap && bombaInMano() && (a || h.act === 'punta'));
    return { mx: f.mx, my: f.my, a, b: f.b, c: false, d: false, ...(c.e ? { e: true } : {}), ...(f.roll ? { roll: true } : {}), ...(stabile ? { m: stabile } : {}) };
  }

  // ---- da solo (allenamento): un tick per frame, i gladiatori fanno gli altri ----
  function tickSolo(f: InputFrame): void {
    const inputs = d.eroi.map((_, j) => {
      if (j === io) return quantizeDungeon(inputOra(f));
      const b = botArena(d, j, botRng[j]!);
      if (b.azione) actPartita(d, j, b.azione);
      return quantizeDungeon(b.input);
    });
    stepPartita(d, inputs);
    dungeonPasso(d.s.eroi[io]!.hero.x, d.s.eroi[io]!.hero.z);
    for (const e of d.s.eventi) onEvent(e);
    onPartita();
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
    ahud?.attesa(r.attesa ? `${nomi[r.attesa.chi] ?? 'Un giocatore'} ha perso la linea: lo aspetto ancora ${Math.max(0, Math.ceil((r.attesa.fino - Date.now()) / 1000))} s` : null);
    if (r.chiusa && phase === 'play' && d.fase !== 'finita' && !r.turni.length) { ctx.hud.toast('Partita interrotta: connessione persa', 3000); chiudi(null, false); return; }
    const pronti = r.turni.length * SQ_TICKS - inTurno;
    if (pronti <= 0) { attesa = true; return; }
    if (attesa && pronti < CUSCINETTO) return;
    attesa = false;
    const n = pronti > RECUPERO ? pronti - CUSCINETTO : pronti > SVELTO ? 2 : 1;
    for (let k = 0; k < n && phase !== 'over'; k++) tickRete(n > 2);
  }
  /** Un tick del turno in testa: al primo tick le azioni del turno (come le ha messe il server), poi il passo di tutti. */
  function tickRete(muto: boolean): void {
    const r = rete!, t = r.turni[0]!;
    if (inTurno === 0) for (const [i, a] of t.az ?? []) { const ev = actPartita(d, i, a); if (ev && !muto) for (const e of ev) onEvent(e); }
    stepPartita(d, t.f.map(frameOf));
    if (d.tick % 300 === 0) firme[d.tick] = hashPartita(d); // test: ogni 5 s lo stato, uguale per tutti i giocatori
    if (!muto) { dungeonPasso(d.s.eroi[io]!.hero.x, d.s.eroi[io]!.hero.z); for (const e of d.s.eventi) onEvent(e); }
    onPartita();
    if (++inTurno >= SQ_TICKS) { r.turni.shift(); inTurno = 0; }
  }

  /** Chi seguire con la camera: io; se sono a terra il primo compagno in piedi, o chi mi ha buttato giù, o il primo ancora in piedi. */
  const fuoco = (): number => {
    if (!d.s.eroi[io]!.done) return io;
    const su = (j: number) => j >= 0 && !d.s.eroi[j]!.done;
    const c = d.squadre.findIndex((q, j) => q === mia && su(j));
    return c >= 0 ? c : su(chiMiHa) ? chiMiHa : Math.max(0, d.s.eroi.findIndex((r) => !r.done));
  };

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
      if (d.fase === 'finita' && phase === 'play') toEnd(); // anche la resa (un'azione: il suo evento non passa da stepPartita)
      tickAttori();
      // conto alla rovescia: il numero grande (cambia una volta al secondo)
      const conta = d.fase === 'conta' ? view.secondi : -1;
      if (conta !== contaVista) { contaVista = conta; if (conta > 0) ahud.grande(String(conta), PAL.giallo, `${modo.nome} · ${mappa.nome}`, 0); }
      ahud.setMira(phase === 'play' && mira() && d.fase === 'gioca' && !d.s.eroi[io]!.done);
      // la rete chiusa a partita finita: la scheda arriva lo stesso
      if (rete?.fine && d.fase !== 'finita' && rete.turni.length === 0) { ctx.hud.toast('Il server ha chiuso la partita', 2500); phase = 'play'; toEnd(); }
    },
    update(alpha, dt, t) {
      if (!sc || !actors || !hud || !ahud || phase === 'over' || phase === 'loading') return;
      eroi.forEach((e, j) => { if (e) visibilita[j]!.update(gruppi[j]!, e, alpha, dt, j === io && view.nascosto); });
      const p = eroi[fuoco()]!.avatar.object.position;
      // la camera guarda un po' verso gli avversari che si vedono (il più vicino, al massimo CAM_VERSO m): si vedono tutti finché si è vicini
      let ox = 0, oz = 0, vicino = Infinity;
      for (const a of view.altri) {
        const q = eroi[a.i]?.avatar.object.position;
        if (!q || a.squadra === mia || a.giu || a.nascosto) continue;
        const dx = q.x - p.x, dz = q.z - p.z, dd = dx * dx + dz * dz;
        if (dd < vicino && dd < 12 * 12) { vicino = dd; ox = dx * 0.35; oz = dz * 0.35; }
      }
      const ol = Math.sqrt(ox * ox + oz * oz);
      if (ol > CAM_VERSO) { ox *= CAM_VERSO / ol; oz *= CAM_VERSO / ol; }
      ctx.renderer.diorama.follow(p.x + ox, sc.floorY + 0.9, p.z + oz); ctx.renderer.diorama.update(dt);
      sc.update(p.x, p.z, t);
      actors.update(alpha, dt, t, { x: p.x, z: p.z });
      gfx?.update(t, { x: p.x, z: p.z }, view.dungeon);
      const pos = eroi.map((e, j) => (e && gruppi[j]?.visible && (j === io || visibilita[j]!.opacita === 1) ? e.avatar.object.position : null));
      afx?.update(t, pos, view);
      segni?.update(view, t, eroi.map((e, j) => (e && pos[j] ? e.head() : null)));
      ahud.set(view, nomi);
      hud.bars(actors.bars());
      // nomi e vita: i compagni in verde, gli avversari che si vedono in rosso
      hud.compagni(view.altri.flatMap((a) => {
        const g = gruppi[a.i];
        if (a.giu || a.nascosto || !g?.visible || !pos[a.i]) return [];
        const testa = eroi[a.i]!.head().clone(); testa.y += 0.35;
        return [{ pos: testa, nome: nomi[a.i]!, frac: a.vita / Math.max(1, a.max), nemico: a.squadra !== mia }];
      }));
      const cur = mouse?.attivo && mira() ? 'crosshair' : '';
      if (ctx.canvas.style.cursor !== cur) ctx.canvas.style.cursor = cur;
    },
    abort,
    done,
  };

  // test (hook arenaPosa): mette l'eroe j al centro della cella (cx, cz), per provare l'erba alta e le zone
  registerTestHook('arenaPosa', (j, cx, cz) => {
    const r = d.s.eroi[Number(j)];
    if (!r || phase === 'over') return false;
    r.hero.x = (Number(cx) + 0.5) * d.s.map.tile; r.hero.z = (Number(cz) + 0.5) * d.s.map.tile; return true;
  });
  registerTestHook('arenaCarica', (j) => { const u = d.ul[Number(j)]; if (!u || rete || phase === 'over') return false; u.carica = ARENA.ulti.carica.max; return true; });
  registerTestHook('arenaTempo', (s) => { if (rete || phase === 'over' || d.fase !== 'gioca') return false; d.faseT += Math.round(Number(s) * 60); return true; });
  registerStateProvider('arenaPartita', () => (phase === 'over' ? null : {
    phase, fase: d.fase, modo: d.modo, per: d.per, esito: d.esito, tick: d.tick, io, slot: view.slot, ulti: view.ulti, secondi: view.secondi, mappa: d.mappa, squadre: [...d.squadre],
    punti: [...d.punti], torna: view.torna, fuori: view.fuori, segno: view.segno, nube: view.nube, zone: view.zone, casseforti: view.casseforti, mucchi: view.mucchi.length, vive: view.vive,
    vita: d.s.eroi.map((r) => Math.round(r.hero.vita * 10) / 10), pos: d.s.eroi.map((r) => [Math.round(r.hero.x * 100) / 100, Math.round(r.hero.z * 100) / 100]),
    nascosto: view.nascosto, nascosti: view.altri.filter((a) => a.nascosto).map((a) => a.i), visibili: gruppi.map((g) => !!g?.visible), opacita: visibilita.map((v) => v.opacita),
    turni: rete?.turni.length ?? 0, ombra, firme: { ...firme }, auto: !!auto, pausa: !!ahud?.paused, finale: finaleAperto,
  }));
  return run;
}
