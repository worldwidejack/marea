// Spedizione nel dungeon lato client (R-scena, CONTRACTS §15): prende il controllo del ciclo come la Regata. Carica il kit
// (manifest_rpg.json), costruisce scena, eroe e nemici, poi a ogni tick registra UN DungeonInput (mx, my, a, b dall'InputFrame di main.ts;
// c, d e la A in più dai controlli del chunk), sempre quantizzato con quantizeDungeon prima di dungeon.step: il server rigioca gli stessi
// input. Le azioni dal menu (dungeon v5: cambio d'equipaggiamento e Butta via dalla scheda dello zaino, SALVA ed ESCI sulla lanterna) si
// applicano subito con dungeon.act e si registrano col tick: il server le rigioca con gli input. A fine partita: packDungeon + azioni + hash
// di dungeon.result. Pausa (Esc) e scheda dello zaino aperta = nessun tick. Esc → Pausa → Esci → «Uscire?» → abort: `done` risolve null
// (niente finish), o gli input fin lì se hai salvato a una lanterna (il server chiude la spedizione tenendo quel bottino). SALVA: o.onAltare
// con input e azioni fin lì, così il server tiene il salvataggio anche se la scheda si chiude (POST /api/dungeon/save).
// Autopilot (?autopilot=1 o hook dungeonAutopilot): gli input li dà dungeon.autopilot con un rng fisso e si registrano uguali.
// Mira col mouse (v6, dungeon_mouse.ts): con l'arco o una magia in mano e un mouse vero, mentre la A è giù (o l'arco è teso) l'input porta anche
// l'indice d'angolo del cursore (DungeonInput.m); senza mouse, o con la mischia, la sim usa la mira assistita. Il C alterna arma e magia.
// Insieme (#118, `o.rete`): la sim ha un eroe per membro della squadra (createPartyRun, s.cur = il mio). Il mio input va al server una volta
// per turno (SQ_TICKS tick: joystick dell'ultimo tick, bottoni premuti in qualunque tick del turno), solo se cambia; la sim avanza SOLO coi
// turni del server (stessi input e azioni per tutti = stessa partita), con un piccolo cuscinetto contro i ritardi della rete e una corsa per
// recuperare dopo uno stacco. Le azioni dal menu vanno al server e si applicano quando tornano nel turno. Niente pausa: il menu non ferma
// niente e con la scheda aperta l'eroe sta fermo. Compagni: il loro avatar (look e arma), nome e vita sopra la testa. A fine spedizione
// (mia: uscito, a terra, tempo, o Esci) `done` risolve { insieme: true }: l'esito lo calcola il server dal log della squadra.
import { createRng } from '@marea/sim';
import type { InputFrame, Rng } from '@marea/sim';
import type { HeroState, RunHero } from '@marea/sim/rpg/types.ts';
import { actParty, createPartyRun, dungeon, stepParty } from '@marea/sim/dungeon/dungeon.ts';
import type { DungeonState } from '@marea/sim/dungeon/dungeon.ts';
import { packDungeon, quantizeDungeon } from '@marea/sim/dungeon/replay.ts';
import { bfs, cellCenter, cellOf, stepDown } from '@marea/sim/dungeon/map.ts';
import { heroNow } from '@marea/sim/dungeon/zaino.ts';
import { aim } from '@marea/sim/dungeon/hero.ts';
import { COS_CONO_ARCO, MAGIA_GITTATA } from '@marea/sim/dungeon/tuning.ts';
import type { CompagnoView, DungeonAzione, DungeonAzioni, DungeonEvent, DungeonInput, DungeonView } from '@marea/sim/dungeon/types.ts';
import { NO_DUNGEON_INPUT } from '@marea/sim/dungeon/types.ts';
import { SQ_TICKS } from '@marea/protocol/squadra.ts';
import type { SqInput } from '@marea/protocol/squadra.ts';
import { PAL } from '../ui/style.ts';
import { dungeonLink } from '../game/ingressi.ts';
import { dungeonEvento, dungeonPasso } from '../audio/ponte.ts';
import type { DungeonFinish, DungeonRun, PanelCtx, RunBag, RunCtx, SquadraRete } from './types.ts';
import { createDungeonScene } from './dungeon_scene.ts';
import type { DungeonScene } from './dungeon_scene.ts';
import { createHeroActor } from './dungeon_hero.ts';
import type { HeroActor } from './dungeon_hero.ts';
import { createActors } from './dungeon_actors.ts';
import type { Actors } from './dungeon_actors.ts';
import { createDungeonHud } from './dungeon_hud.ts';
import { createMouse } from './dungeon_mouse.ts';
import type { Mouse } from './dungeon_mouse.ts';
import { createDrenaggioFx } from './drenaggio.ts';
import type { DrenaggioFx } from './drenaggio.ts';
import { createFucinaFx } from './fucina.ts';
import type { FucinaFx } from './fucina.ts';
import { createArchivioFx } from './archivio.ts';
import type { ArchivioFx } from './archivio.ts';
import { createMausoleoFx } from './mausoleo_fx.ts';
import type { MausoleoFx } from './mausoleo_fx.ts';
import { createUniciFx } from './unici_fx.ts';
import type { UniciFx } from './unici_fx.ts';
import { createTesti } from './dungeon_testi.ts';
import type { DungeonTestiUi } from './dungeon_testi.ts';
import type { DungeonHud } from './dungeon_hud.ts';
import { createControls } from './dungeon_controls.ts';
import type { Controls, MagiaUi } from './dungeon_controls.ts';
import { showDungeonResult } from './dungeon_result.ts';
import { closePanels, isPanelOpen, openHero, refreshBag } from './panels.ts';

type Phase = 'loading' | 'play' | 'end' | 'over';
type Out = { inputs: ReturnType<typeof packDungeon>; hash: number; azioni: DungeonAzioni };
const END_WAIT = 100; // tick di scritta finale prima di consegnare
const OUT: Record<string, [string, string]> = { uscito: ['SEI USCITO', PAL.erbaChiara], morto: ['SEI CADUTO', PAL.rosso], tempo: ['TEMPO SCADUTO', PAL.arancio] };
const NO_ACT: Record<DungeonAzione['t'], string> = { equip: 'Non si può mettere qui', butta: 'Non ce l’hai nello zaino', salva: 'Qui è già tutto al sicuro', esci: 'Serve una lanterna', ritira: 'Non si può' };
const nOggetti = (b: Record<string, number>) => Object.values(b).reduce((a, n) => a + n, 0);
/** Per i test (Fucina): il Mastro Forgiatore, se c'è. */
/** Per i test (Mausoleo): il Custode dell'Egida, se c'è. */
const custode = (v: DungeonView) => { const k = v.nemici.find((n) => n.tipo === 'custode_egida'); return k ? { x: k.x, z: k.z, vita: k.vita, max: k.max, anim: k.anim, attacco: k.attacco ?? null, fase: k.fase ?? 0, cariche: k.cariche ?? null, mira: k.mira ?? null } : null; };
const mastro = (v: DungeonView) => { const k = v.nemici.find((n) => n.tipo === 'mastro_forgiatore'); return k ? { x: k.x, z: k.z, vita: k.vita, max: k.max, anim: k.anim, attacco: k.attacco ?? null, mira: k.mira ?? null, spento: !!k.spento } : null; };
/** Insieme: tick in cuscinetto prima di ripartire dopo uno stallo, oltre cui si va a 2 tick per frame, oltre cui si recupera di corsa. */
const CUSCINETTO = 2 * SQ_TICKS, SVELTO = 4 * SQ_TICKS, RECUPERO = 30 * SQ_TICKS;
const bitsOf = (f: DungeonInput) => (f.a ? 1 : 0) | (f.b ? 2 : 0) | (f.c ? 4 : 0) | (f.d ? 8 : 0);
const frameOf = (x: SqInput): DungeonInput => ({ mx: x[0] / 8, my: x[1] / 8, a: (x[2] & 1) !== 0, b: (x[2] & 2) !== 0, c: (x[2] & 4) !== 0, d: (x[2] & 8) !== 0, ...(x[3] ? { m: x[3] } : {}) });

type Amico = { i: number; nome: string; actor: HeroActor | null; arma: string | null; done: boolean };

export function startRun(ctx: RunCtx, o: {
  dungeon: string; seed: number; hero: RunHero; stato?: HeroState | null; partenza?: number | null;
  /** Per aprire la scheda dello zaino nel dungeon (senza: niente Zaino). */
  panel?: PanelCtx;
  onAltare?: (sv: Out) => void;
  /** Dungeon insieme (#118): la squadra (WebSocket del DO Spedizioni). */
  rete?: SquadraRete;
}): DungeonRun {
  const rete = o.rete ?? null, io = rete?.io ?? 0;
  const s: DungeonState = rete
    ? createPartyRun({ seed: o.seed, dungeon: o.dungeon, eroi: rete.eroi.map((e) => ({ hero: e.hero, stato: e.stato })) })
    : dungeon.create({ seed: o.seed, dungeon: o.dungeon, hero: o.hero, stato: o.stato ?? null, partenza: o.partenza ?? null });
  s.cur = io;
  const frames: DungeonInput[] = [], azioni: DungeonAzioni = [];
  let phase: Phase = 'loading', wait = 0, view: DungeonView = dungeon.view(s), auto: Rng | null = null, arma = view.hero.arma;
  let sc: DungeonScene | null = null, hero: HeroActor | null = null, actors: Actors | null = null, hud: DungeonHud | null = null, controls: Controls | null = null, fx: DrenaggioFx | null = null, afx: ArchivioFx | null = null, ffx: FucinaFx | null = null, mfx: MausoleoFx | null = null, ufx: UniciFx | null = null;
  let testi: DungeonTestiUi | null = null, mouse: Mouse | null = null, magieUi: MagiaUi[] = [], cursore = '';
  let resolve!: (v: Out | { insieme: true } | null) => void;
  const done = new Promise<Out | { insieme: true } | null>((r) => (resolve = r));
  const out = (): Out => ({ inputs: packDungeon(frames), hash: dungeon.result(s).hash, azioni: azioni.map(([t, a]) => [t, a]) });
  // insieme: compagni, finestra del turno (joystick dell'ultimo tick, bottoni di tutti i tick), ultimo input mandato, turno a metà
  const amici: Amico[] = rete ? rete.eroi.map((e, i) => ({ i, nome: e.nome, actor: null, arma: e.hero.arma.id, done: false })).filter((a) => a.i !== io) : [];
  const win = { mx: 0, my: 0, bits: 0, m: 0, n: 0 };
  let mandato = '0,0,0', inTurno = 0, attesa = true, rotto = false;
  const firme: Record<number, number> = {};

  const cleanup = () => {
    phase = 'over'; dungeonLink.state = null; dungeonLink.act = null;
    closePanels();
    mouse?.dispose(); ctx.canvas.style.cursor = ''; controls?.dispose(); testi?.dispose(); hud?.dispose(); actors?.dispose(); fx?.dispose(); afx?.dispose(); ffx?.dispose(); mfx?.dispose(); ufx?.dispose(); hero?.dispose(); sc?.dispose();
    for (const a of amici) a.actor?.dispose();
    ctx.renderer.setScene(null);
  };
  const finish = () => {
    if (phase === 'over') return;
    if (rete) { rete.manda({ t: 'esco' }); cleanup(); console.log(`[marea] dungeon ${o.dungeon} insieme finito: ${s.tick} tick`); resolve({ insieme: true }); return; }
    const r = out(); cleanup(); console.log(`[marea] dungeon ${o.dungeon} finito: ${frames.length} tick, ${r.inputs.length} righe, ${r.azioni.length} azioni`); resolve(r);
  };
  const abort = () => {
    if (phase === 'over') return;
    // insieme: il server ti toglie dalla squadra (ritira) e l'esito lo calcola lui; da solo, dopo un salvataggio alla lanterna si consegna
    // lo stesso: la partita lasciata a metà tiene il bottino salvato
    if (rete) { rete.manda({ t: 'esco' }); cleanup(); console.log(`[marea] dungeon ${o.dungeon} insieme: esco a ${s.tick} tick`); resolve({ insieme: true }); return; }
    const r = s.salvato ? out() : null;
    cleanup(); console.log(`[marea] dungeon ${o.dungeon} abbandonato a ${frames.length} tick${r ? ' (con lanterna)' : ''}`); resolve(r);
  };

  /** Fine partita (esito della sim): scritta grande, poi consegna dopo END_WAIT tick. */
  const toEnd = () => {
    if (phase !== 'play') return;
    phase = 'end'; wait = END_WAIT; controls?.hide(); testi?.hide(); closePanels();
    const [txt, col] = OUT[s.outcome ?? 'tempo'] ?? OUT['tempo']!;
    hud?.big(txt, col, s.uscitaLanterna >= 0 ? 'dalla lanterna: la prossima volta puoi ripartire da qui' : 'il server conferma il bottino');
  };
  /** Dopo un'azione o un passo: vista nuova, icone e arma in mano se l'equipaggiamento è cambiato. */
  const refresh = () => {
    view = dungeon.view(s);
    if (view.hero.arma !== arma) { arma = view.hero.arma; void hero?.setArma(s.hero.arma); }
    hero?.equip(s.runHero); // armatura o veste cambiata dal menu, faretra con arco e frecce
  };
  /** Equipaggiamento cambiato (mio): barre, icone di C e D. */
  const nuovoEquip = () => { hud?.setHero(s.runHero); magieUi = hud?.magie() ?? []; const ic = hud?.icons(); if (ic) controls?.setIcons(ic.c, ic.d, ic.key); };
  /** Azione dal menu adesso: si applica alla sim, si registra col tick (= passi fatti) e si mostra. null = fatta, se no il motivo.
   *  Insieme va al server (torna nel turno, la sim la rifà lì): qui solo i controlli che si vedono dalla vista. */
  const act = (a: DungeonAzione): string | null => {
    if (phase !== 'play') return 'Adesso no';
    if (rete) {
      if (s.done || a.t === 'ritira') return 'Adesso no';
      if ((a.t === 'salva' || a.t === 'esci') && view.lanterna < 0) return NO_ACT.esci;
      if (a.t === 'salva' && view.salvatoQui) return NO_ACT.salva;
      rete.manda({ t: 'az', a });
      return null;
    }
    const ev = dungeon.act(s, a);
    if (!ev) return NO_ACT[a.t] ?? 'Non si può';
    azioni.push([frames.length, a]);
    for (const e of ev) onEvent(e);
    if (a.t === 'equip' || a.t === 'butta') nuovoEquip();
    refresh();
    if (s.done) toEnd();
    return null;
  };
  const bag: RunBag = { hero: () => heroNow(s), peso: () => ({ peso: view.zaino.peso, max: view.zaino.max }), act, ...(rete ? { insieme: true } : {}) };
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
      hero = await createHeroActor({ loader: ctx.loader, look: ctx.world.look, hero: s.runHero, scene: sc.scene, floorY: sc.floorY, x: view.hero.x, z: view.hero.z, mirino: true });
      for (const a of amici) {
        const r = s.eroi[a.i]!;
        a.actor = await createHeroActor({ loader: ctx.loader, look: rete!.eroi[a.i]!.look, hero: r.runHero, scene: sc.scene, floorY: sc.floorY, x: r.hero.x, z: r.hero.z });
      }
      actors = createActors({ loader: ctx.loader, scene: sc });
      // Fucina prima: anche lei ha una valvola (la chiusa) e un bacino (la Colata Maestra), ma i suoi effetti sono lava, cascate e fuoco
      if (sc.def.stile === 'fucina') ffx = createFucinaFx({ sc, loader: ctx.loader, say: (txt, ms) => hud?.say(txt, ms), occupato: () => !!testi?.stato().voce });
      // Mausoleo prima del Drenaggio: anche lui ha una valvola (la chiave di carica) e un bacino (il cancello)
      else if (sc.def.stile === 'mausoleo') mfx = createMausoleoFx({ sc, loader: ctx.loader, say: (txt, ms) => hud?.say(txt, ms), occupato: () => !!testi?.stato().voce });
      else if (sc.map.valvole.length || sc.map.bacini.length || o.dungeon === 'drenaggio') fx = createDrenaggioFx({ sc }); else if (sc.map.venti.length || o.dungeon === 'archivio') afx = createArchivioFx({ sc, say: (txt, ms) => hud?.say(txt, ms), occupato: () => !!testi?.stato().voce });
      ufx = createUniciFx(sc.scene, sc.floorY); // gli unici della Regina si portano in ogni dungeon
      if ((phase as Phase) === 'over') { cleanup(); return; }
      hud = createDungeonHud({ root: ctx.root, canvas: ctx.canvas, camera: ctx.renderer.camera, hero: s.runHero, stile: sc.def.stile });
      controls = createControls({
        root: ctx.root, canvas: ctx.canvas, blocked: () => isPanelOpen() || !!testi?.aperta, insieme: !!rete, ...(sc.def.stile === 'fucina' ? { valvola: 'A · Apri la chiusa' } : sc.def.stile === 'mausoleo' ? { valvola: 'A · Gira la chiave di carica' } : {}),
        onAbort: () => (phase === 'end' ? finish() : abort()),
        onZaino: openZaino,
        onSalva: () => { const e = act({ t: 'salva' }); if (e) ctx.hud.toast(e, 1800); },
        onEsciLanterna: () => { const e = act({ t: 'esci' }); if (e) ctx.hud.toast(e, 1800); },
        // menù rapido: la magia scelta va in mano (stessa azione dello zaino, quindi vale anche in squadra)
        onMagia: (id) => { if (view.hero.magia === id) return; const e = act({ t: 'equip', slot: 'magia', item: id }); if (e) ctx.hud.toast(e, 1500); },
      });
      mouse = createMouse({ canvas: ctx.canvas, camera: ctx.renderer.camera, floorY: sc.floorY });
      magieUi = hud.magie();
      if (sc.def.testi) testi = createTesti({ root: ctx.root, camera: ctx.renderer.camera, canvas: ctx.canvas, sc, insieme: !!rete, capoMorto: () => view.nemici.some((n) => n.capo && n.anim === 'morto') });
      const ic = hud.icons(); controls.setIcons(ic.c, ic.d, ic.key);
      if (s.salvato) controls.setSalvato(true);
      hero.tick(view.hero); actors.tick(view); fx?.tick(view); afx?.tick(view); ffx?.tick(view); mfx?.tick(view); ufx.tick(view); sc.setAcque(view.acque); tickAmici();
      ctx.renderer.setScene(sc.scene);
      ctx.renderer.diorama.setZoom(1.0);
      ctx.renderer.diorama.follow(view.hero.x, sc.floorY + 0.9, view.hero.z); ctx.renderer.diorama.snap?.();
      if (s.partenza >= 0) { sc.setAltare(s.partenza); hud.flash('LANTERNA', PAL.giallo, 'riparti da dove eri uscito', 1800); }
      if (rete) { rete.manda({ t: 'carico' }); hud.flash('INSIEME', PAL.erbaChiara, `${rete.eroi.map((e) => e.nome).join(', ')}: si parte quando ci siete tutti`, 2200); }
      phase = 'play';
    } catch (e) {
      console.error('[marea] dungeon non caricato', e);
      ctx.hud.toast('Il dungeon non si è caricato, riprova', 3000);
      abort();
    }
  })();

  const amicoDi = (i: number | undefined): Amico | null => (i === undefined ? null : amici.find((a) => a.i === i) ?? null);
  const testaDi = (i: number | undefined) => (i === undefined || i === io ? hero!.head() : amicoDi(i)?.actor?.head() ?? hero!.head());
  const onEvent = (e: DungeonEvent) => {
    if (!hud || !actors || !hero) return;
    const mio = e.eroe === undefined || e.eroe === io;
    if (mio || (e.t === 'colpo' && e.su === 'nemico') || e.t === 'morte') dungeonEvento(e);
    if (e.t === 'colpo') {
      if (e.su === 'nemico') { if (e.id !== undefined) actors.hit(e.id); const p = (e.id !== undefined ? actors.posOf(e.id) : null); if (p) hud.number(p, `${Math.round(e.danno)}${e.critico ? '!' : ''}`, 'dato', !!e.caricato || !!e.critico); }
      else { (mio ? hero : amicoDi(e.eroe)?.actor)?.flash(); hud.number(testaDi(e.eroe), `-${Math.round(e.danno)}`, 'preso'); }
    } else if (e.t === 'schivato') hud.number(testaDi(e.eroe), 'schivato', 'info');
    else if (e.t === 'pozione') hud.number(testaDi(e.eroe), '+', 'cura', true);
    else if (mio) hud.event(e);
    if (!mio) {
      const a = amicoDi(e.eroe);
      if (a && e.t === 'rotto') a.actor?.rotta();
      if (a && e.t === 'risveglio') { a.actor?.flash(); hud.say(`${a.nome} si risveglia alla lanterna`, 2200); }
      return;
    }
    if (e.t === 'altare') {
      controls?.setSalvato(true); sc?.setAltare(e.n); sc?.pulse(e.n);
      const n = nOggetti(s.bottino), m = s.monete;
      hud.flash('SALVATO', PAL.giallo, n || m ? `al sicuro: ${[n ? `${n} ${n === 1 ? 'oggetto' : 'oggetti'}` : '', m ? `${m} monete` : ''].filter(Boolean).join(' e ')}` : 'se cadi, ti risvegli qui', 1800);
      if (!rete) o.onAltare?.(out());
    }
    if (e.t === 'risveglio') hero.flash();
    if (e.t === 'rotto') hero.rotta();
  };

  /** Arco teso: verso il nemico che la sim prenderà al rilascio (la stessa `aim` di shoot), null se non c'è (la freccia va dritta). */
  const miraArco = (): { x: number; z: number } | null => {
    const h = s.hero;
    if (h.act !== 'tende') return null;
    const e = aim(s, MAGIA_GITTATA * 2, COS_CONO_ARCO, 0, true);
    const dx = e ? e.x - h.x : 0, dz = e ? e.z - h.z : 0, d = Math.sqrt(dx * dx + dz * dz);
    return d > 1e-6 ? { x: dx / d, z: dz / d } : null;
  };
  /** Linea di mira dell'eroe di questo client: col mouse (arco o magia in mano) sempre verso il cursore, se no solo l'arco teso, verso chi prenderà. */
  const miraOra = (): void => {
    const h = s.hero, v = (h.incanta || h.arma.kind === 'arco') && !controls?.paused ? mouse?.verso(h.x, h.z) ?? null : null;
    if (!v) { hero!.mira(miraArco()); return; }
    hero!.mira({ x: v.x, z: v.z }, true);
  };
  /** Indice di mira del mouse mentre si punta con qualcosa che si mira (arco, magia in mano) e il cursore c'è; 0 = mira assistita della sim. */
  const puntaMouse = (): number => {
    const h = s.hero;
    return mouse && (h.incanta || h.arma.kind === 'arco') ? mouse.verso(h.x, h.z)?.m ?? 0 : 0;
  };
  /** Compagni: posa dalla vista, arma nuova se è cambiata, spariscono quando escono (con un avviso). */
  function tickAmici(): void {
    for (const c of view.compagni) {
      const a = amicoDi(c.i);
      if (!a?.actor) continue;
      if (c.done) {
        if (!a.done) { a.done = true; a.actor.avatar.object.visible = false; hud?.say(fineDi(a.nome, c), 2600); }
        continue;
      }
      const w = s.eroi[c.i]!.hero.arma;
      if (w.id !== a.arma) { a.arma = w.id; if (w.id) void a.actor.setArma(w); }
      a.actor.equip(s.eroi[c.i]!.runHero);
      a.actor.tick(posaDi(c));
    }
  }
  const fineDi = (nome: string, c: CompagnoView) => (c.outcome === 'uscito' ? `${nome} è fuori dal dungeon` : c.outcome === 'morto' ? `${nome} è a terra` : c.outcome === 'tempo' ? 'Tempo scaduto' : `${nome} ha lasciato il dungeon`);
  /** La posa del compagno nella forma della vista dell'eroe (l'attore legge solo posizione, direzione, animazione, fase, carica, stile). */
  const posaDi = (c: CompagnoView): DungeonView['hero'] => {
    const p: DungeonView['hero'] = { ...view.hero, x: c.x, z: c.z, fx: c.fx, fz: c.fz, anim: c.anim, t: c.t, carica: c.carica, vita: c.vita, protetto: c.protetto, arma: c.arma };
    if (c.stile) p.stile = c.stile; else delete p.stile;
    if (c.magia) p.magia = c.magia; else delete p.magia;
    return p;
  };

  // test (hook dungeonAltare / dungeonVai): cammina fino all'altare n o a una cella lungo le distanze BFS, input registrati come gli altri
  let walkField: { to: number; field: Int32Array } | null = null;
  function walkToAltare(n: number): DungeonInput {
    const a = s.map.altari[n];
    if (!a || s.altare === n) { dungeonLink.altare = -1; return { ...NO_DUNGEON_INPUT }; }
    return walkTo(a.cz * s.map.w + a.cx, a.x, a.z);
  }
  function walkToCella([cx, cz]: [number, number]): DungeonInput {
    const m = s.map, c = { x: (cx + 0.5) * m.tile, z: (cz + 0.5) * m.tile };
    if (Math.abs(c.x - s.hero.x) + Math.abs(c.z - s.hero.z) < 0.3) { dungeonLink.vai = null; return { ...NO_DUNGEON_INPUT }; }
    return walkTo(cz * m.w + cx, c.x, c.z);
  }
  function walkTo(to: number, x: number, z: number): DungeonInput {
    const m = s.map;
    if (walkField?.to !== to) walkField = { to, field: bfs(m, to) };
    const cur = cellOf(m, s.hero.x, s.hero.z), next = cur === to ? to : stepDown(m, walkField.field, cur);
    const p = next >= 0 && next !== to ? cellCenter(m, next) : { x, z };
    const dx = p.x - s.hero.x, dz = p.z - s.hero.z, d = Math.sqrt(dx * dx + dz * dz) || 1;
    return { mx: dx / d, my: dz / d, a: false, b: false, c: false, d: false };
  }
  /** L'input di adesso (autopilot, test, o tastiera/joystick più i bottoni del chunk). */
  function inputOra(f: InputFrame): DungeonInput {
    const c = controls!.sample();
    if (auto) return dungeon.autopilot(s, auto);
    if (dungeonLink.altare >= 0) return walkToAltare(dungeonLink.altare);
    if (dungeonLink.vai) return walkToCella(dungeonLink.vai);
    const a = f.a || c.a, m = a || s.hero.act === 'tende' ? puntaMouse() : 0; // la mira solo mentre si preme (e al rilascio dell'arco): il log resta corto
    return { mx: f.mx, my: f.my, a, b: f.b, c: c.c, d: c.d, ...(m ? { m } : {}) };
  }

  function tickOnce(f: InputFrame): void {
    const q = quantizeDungeon(inputOra(f));
    frames.push(q); dungeon.step(s, q); dungeonPasso(s.hero.x, s.hero.z);
    for (const e of s.eventi) onEvent(e);
  }

  // ---- insieme ----
  /** Un frame del ciclo: il mio input nella finestra del turno (al server se è cambiato), poi i tick dei turni arrivati. */
  function stepInsieme(f: InputFrame): void {
    const r = rete!;
    if (dungeonLink.autopilot > 0 && !auto) auto = createRng(o.seed + io).fork('autopilot');
    if (dungeonLink.autopilot === 0) auto = null;
    if (phase === 'play' && !s.done) {
      const fermo = !!controls?.paused || isPanelOpen() || !!testi?.aperta;
      const q = quantizeDungeon(fermo && !auto ? { ...NO_DUNGEON_INPUT } : inputOra(f));
      win.mx = q.mx; win.my = q.my; win.bits |= bitsOf(q); if (q.m) win.m = q.m;
      if (++win.n >= SQ_TICKS) {
        const x: SqInput = win.m ? [Math.round(win.mx * 8) || 0, Math.round(win.my * 8) || 0, win.bits, win.m] : [Math.round(win.mx * 8) || 0, Math.round(win.my * 8) || 0, win.bits], k = x.join(',');
        if (k !== mandato) { mandato = k; r.manda({ t: 'in', f: x }); }
        win.bits = 0; win.m = 0; win.n = 0;
      }
    }
    if (r.chiusa && !rotto && phase === 'play') { rotto = true; ctx.hud.toast('Connessione con la squadra persa', 3000); finish(); return; }
    // quanti tick giocare adesso: niente se il cuscinetto si è svuotato (finché non si riempie), di più se si resta indietro
    const pronti = r.turni.length * SQ_TICKS - inTurno;
    if (pronti <= 0) { attesa = true; return; }
    if (attesa && pronti < CUSCINETTO) return;
    attesa = false;
    const n = pronti > RECUPERO ? pronti - CUSCINETTO : pronti > SVELTO ? 2 : 1;
    for (let k = 0; k < n && phase !== 'over'; k++) tickRete(n > 2);
    refresh();
    hero!.tick(view.hero); miraOra(); actors!.tick(view); mfx?.tick(view); ufx?.tick(view); tickAmici();
    if (s.done && phase === 'play') toEnd();
  }
  /** Un tick del turno in testa: al primo tick le azioni del turno (eroe per eroe, come il server le ha messe), poi il passo di tutti. */
  function tickRete(muto: boolean): void {
    const r = rete!, t = r.turni[0]!;
    if (inTurno === 0 && t.az?.length) {
      let mie = false;
      for (const [i, a] of t.az) {
        const ev = actParty(s, i, a);
        if (!ev) continue;
        if (i === io) { mie = true; azioni.push([s.tick, a]); }
        for (const e of ev) onEvent(e);
      }
      if (mie) { nuovoEquip(); refresh(); refreshBag(); }
    }
    stepParty(s, t.f.map(frameOf));
    if (s.tick % 300 === 0) firme[s.tick] = dungeon.result(s).hash; // test: ogni 5 s lo stato di tutti, uguale per ogni giocatore
    if (!muto) { dungeonPasso(s.hero.x, s.hero.z); for (const e of s.eventi) onEvent(e); }
    if (++inTurno >= SQ_TICKS) { r.turni.shift(); inTurno = 0; }
  }

  const run: DungeonRun = {
    get active() { return phase !== 'over'; },
    step(f) {
      if (rete) {
        if (phase === 'end' && (--wait <= 0 || (wait < END_WAIT - 40 && f.a))) { finish(); return; }
        if (phase === 'play' || phase === 'end') stepInsieme(f);
        return;
      }
      if (phase === 'end') { if (--wait <= 0 || (wait < END_WAIT - 40 && f.a)) finish(); return; }
      if (phase !== 'play' || !controls || controls.paused || isPanelOpen() || testi?.aperta) return;
      if (dungeonLink.autopilot > 0 && !auto) auto = createRng(o.seed).fork('autopilot');
      if (dungeonLink.autopilot === 0) auto = null;
      const n = auto ? dungeonLink.autopilot : dungeonLink.altare >= 0 || dungeonLink.vai ? 8 : 1;
      for (let i = 0; i < n && !s.done; i++) tickOnce(f);
      refresh();
      hero!.tick(dungeonLink.posa ? { ...view.hero, ...dungeonLink.posa } as DungeonView['hero'] : view.hero); miraOra(); actors!.tick(view); fx?.tick(view); afx?.tick(view); ffx?.tick(view); mfx?.tick(view); ufx?.tick(view);
      if (s.done) toEnd();
    },
    update(alpha, dt, t) {
      if (!sc || !hero || !actors || !hud || !controls || phase === 'over' || phase === 'loading') return;
      hero.update(alpha, dt);
      for (const a of amici) if (a.actor && !a.done) a.actor.update(alpha, dt);
      const p = hero.avatar.object.position;
      ctx.renderer.diorama.follow(p.x, sc.floorY + 0.9, p.z); ctx.renderer.diorama.update(dt);
      sc.update(p.x, p.z, t);
      actors.update(alpha, dt, t, { x: p.x, z: p.z });
      if (fx) { fx.update(t, { x: p.x, z: p.z }, view); sc.setAcque(view.acque); }
      afx?.update(t, { x: p.x, z: p.z }, view, phase === 'play');
      if (ffx) { ffx.update(t, { x: p.x, z: p.z }, view, phase === 'play'); sc.setAcque(view.acque); }
      if (mfx) { mfx.update(t, { x: p.x, z: p.z }, view, phase === 'play'); sc.setAcque(view.acque); }
      ufx?.update({ x: p.x, z: p.z }, view);
      testi?.update({ x: p.x, z: p.z }, phase === 'play' && !controls.paused, dt);
      hud.set(view, dungeon.maxTicks); hud.bars(actors.bars());
      if (rete) hud.compagni(amici.filter((a) => a.actor && !a.done).map((a) => {
        const c = view.compagni.find((x) => x.i === a.i), pos = a.actor!.head().clone();
        pos.y += 0.35;
        return { pos, nome: a.nome, frac: c ? c.vita / Math.max(1, c.max) : 0 };
      }));
      controls.setExit(phase === 'play' && view.vicinoUscita);
      controls.setValvola(phase === 'play' && view.vicinoValvola); controls.setTimone(phase === 'play' && view.vicinoTimone);
      controls.setLanterna(phase === 'play' && view.lanterna >= 0 ? { salvatoQui: view.salvatoQui, oggetti: nOggetti(view.zaino.bottino), monete: view.zaino.monete } : null);
      sc.setAltare(view.altari.findIndex((a) => a.attivo));
      const h = view.hero, rh = s.runHero, spell = rh.magia !== null ? rh.magie[rh.magia] : null;
      controls.setState(spell ? 1 - h.ricaricaMagia / Math.max(0.01, spell.ricarica) : 0, h.pozioni, !!spell);
      controls.setMagie(magieUi, phase === 'play' ? h.magia ?? null : null, h.magicka);
      const cur = mouse?.attivo && (!!h.magia || s.hero.arma.kind === 'arco') ? 'crosshair' : ''; // il cursore diventa un mirino
      if (cur !== cursore) { cursore = cur; ctx.canvas.style.cursor = cur; }
    },
    abort,
    done,
  };

  dungeonLink.act = (a) => act(a);
  dungeonLink.state = () => {
    const v = view, vivi = v.nemici.filter((n) => !n.alleato && n.anim !== 'morto').length, n0 = s.enemies.find((e) => !e.alleato);
    return {
      active: phase !== 'over', phase, dungeon: o.dungeon, tick: v.tick, outcome: v.outcome, frames: frames.length, auto: !!auto, paused: !!controls?.paused, zaino: v.zaino,
      hero: { x: v.hero.x, z: v.hero.z, vita: v.hero.vita, magicka: v.hero.magicka, stamina: v.hero.stamina, anim: v.hero.anim, arma: v.hero.arma, frecce: v.hero.frecce, magia: v.hero.magia ?? null, fx: v.hero.fx, fz: v.hero.fz }, mouse: mouse?.attivo ?? false,
      nemici: v.nemici.filter((n) => !n.alleato).length, vivi, vicinoUscita: v.vicinoUscita, vicinoTimone: v.vicinoTimone, afx: afx?.counts() ?? null,
      acque: v.acque, valvole: v.valvole, vicinoValvola: v.vicinoValvola, geyser: v.geyser.length, rallentato: !!v.hero.rallentato, fx: fx?.counts() ?? null,
      lave: v.lave, fuochi: v.fuochi.length, brucia: !!v.hero.brucia, bagnato: !!v.hero.bagnato, ffx: ffx?.counts() ?? null, mastro: mastro(v),
      mfx: mfx?.counts() ?? null, ufx: ufx?.counts() ?? null, custode: custode(v), lancette: v.lancette.length, onde: v.onde.length, sarcofago: v.sarcofago ?? null, barriera: v.hero.barriera ?? null, carico: v.hero.carico ?? null,
      venti: v.venti, timoni: v.timoni, vento: !!v.hero.vento, riparo: !!v.hero.riparo, spinto: !!v.hero.spinto, testi: testi?.stato() ?? null, altari: v.altari, salvato: v.salvato, cadute: s.cadute, protetto: v.hero.protetto, lanterna: v.lanterna, salvatoQui: v.salvatoQui, partenza: s.partenza,
      equip: { ...s.equip }, indossa: hero?.avatar.indossaStato() ?? null, azioni: azioni.length, pannello: isPanelOpen(),
      scene: sc?.stats() ?? null, actors: actors?.counts() ?? null,
      insieme: rete ? {
        io, eroi: s.eroi.length, turni: rete.turni.length, firme: { ...firme }, vitaNemici: n0 ? n0.max / n0.def.vita : 1,
        compagni: v.compagni.map((c) => ({ i: c.i, x: c.x, z: c.z, vita: c.vita, done: c.done, outcome: c.outcome, visibile: !!amicoDi(c.i)?.actor?.avatar.object.visible })),
      } : null,
    };
  };
  return run;
}

/** Scheda dell'esito (quello del server): bottino tenuto, monete, xp, livelli. Risolve quando il giocatore chiude. */
export async function showResult(ctx: RunCtx, r: DungeonFinish): Promise<void> { return showDungeonResult(ctx.root, r); }
