// Partita a ondate dei Templari lato client (docs/TEMPLARI.md, CONTRACTS «Templari»): entry del chunk, scaricato entrando nella chiesa.
// Prende il controllo del ciclo come il dungeon: scena dell'arena, eroe (l'avatar con l'arma in pugno, rpg/dungeon_hero.ts), zombie, HUD e
// controlli; a ogni tick registra UN input (joystick e B da main.ts, A = attacca anche col clic o da solo con AUTO, C = SCAMBIA, D = AZIONE)
// quantizzato come lo rigioca il server. Pausa = nessun tick. Fine: scritta grande, poi consegna (input compressi, azioni, hash).
// Niente attacco automatico. Da PC, se non cammini, l'eroe guarda il mouse: il client manda il joystick «sfiorato» verso il puntatore
// (la sim lo gira sul posto, GIRA_SUL_POSTO) e il clic attacca lì; resta negli input, il server lo rigioca uguale.
// Mira (come nel dungeon, rpg/dungeon_mouse.ts e mira_stick.ts): con arco, pistole, moschetto, trombone o fuoco greco in mano il mouse porta
// l'indice d'angolo del cursore (DungeonInput.m) mentre premi (e al rilascio dell'arco); dal telefono al posto di A c'è il joystick di mira
// (arco: tieni per tendere, lascia per tirare; le armi da fuoco e il vaso partono al rilascio, un tocco veloce spara come prima, assistito).
// Autopilota dei test (templariLink.autopilot o ?autopilot=1): gli input li dà la sim, registrati uguali.
// Insieme (PROTOCOL §9, `o.rete`): la sim ha un eroe per membro della sala (opzioni.eroi, io = il mio). Il mio input va al server una volta per
// turno (SQ_TICKS tick: joystick dell'ultimo tick, bottoni di qualunque tick del turno, mira se c'è), solo se cambia; la sim avanza SOLO coi
// turni del server (stessi input per tutti = stessa partita), con un cuscinetto contro i ritardi e una corsa per recuperare. Gli acquisti dal
// Mercante e dalla Strega vanno al server e si fanno quando tornano nel turno. Niente pausa (il menu non ferma niente, l'eroe sta fermo).
// Compagni: il loro avatar (look e arma), nome e vita sopra la testa; chi cade resta a terra fino all'ondata dopo. Fine (tutti giù, alba, o
// Esci): `done` risolve { insieme: true }, l'esito lo calcola il server dal log della squadra.
import * as THREE from 'three';
import type { InputFrame } from '@marea/sim';
import { createRng } from '@marea/sim';
import type { Rng } from '@marea/sim';
import { TEMPLARI, armaDef } from '@marea/content/templari.ts';
import { encodeDungeon, packDungeon, quantizeDungeon } from '@marea/sim/dungeon/replay.ts';
import type { DungeonInput } from '@marea/sim/dungeon/types.ts';
import { pugni } from '@marea/sim/dungeon/hero.ts';
import { stepTemplari, stepTemplariInsieme, templari } from '@marea/sim/templari/templari.ts';
import type { TState } from '@marea/sim/templari/templari.ts';
import { daiArma, miraTiro } from '@marea/sim/templari/eroe.ts';
import { armaIn, nuovoZombie, quantiOndata, usa } from '@marea/sim/templari/stato.ts';
import { vicinoRaggiungibile } from '@marea/sim/templari/raggiungi.ts';
import { apriPorta } from '@marea/sim/templari/porte.ts';
import type { TAzione, TAzioni, TEvento, TEventoDi, TInput, TView } from '@marea/sim/templari/types.ts';
import { SQ_TICKS } from '@marea/protocol/templari_insieme.ts';
import type { SqInput } from '@marea/protocol/templari_insieme.ts';
import { createHeroActor } from '../rpg/dungeon_hero.ts';
import { createMouse } from '../rpg/dungeon_mouse.ts';
import type { Mouse } from '../rpg/dungeon_mouse.ts';
import type { ArmaInMano, HeroActor } from '../rpg/dungeon_hero.ts';
import { suona, tensione } from '../audio/ponte.ts';
import type { SuonoId } from '../audio/ponte.ts';
import { SUOLO } from '@marea/sim/templari/mappa.ts';
import { PAL } from '../ui/style.ts';
import { templariLink } from '../game/templari.ts';
import { createScena } from './scena.ts';
import type { Scena } from './scena.ts';
import { createZombi } from './zombi.ts';
import type { Zombi } from './zombi.ts';
import { createTplHud } from './hud.ts';
import type { TplHud } from './hud.ts';
import { createControlli } from './controlli.ts';
import { createEffetti } from './effetti.ts';
import type { Effetti } from './effetti.ts';
import { armaVista } from './armi3d.ts';
import { TESTA_TEMPLARI, corpoTemplari } from '../rpg/vestito_templari.ts';
import { salvaEroe } from './scelta.ts';
import type { TClasse } from '@marea/content/templari.ts';
import type { Controlli } from './controlli.ts';
import { createPersonaggi } from './personaggi.ts';
import type { Personaggi } from './personaggi.ts';
import { createBottegaUi } from './bottega_ui.ts';
import type { BottegaUi } from './bottega_ui.ts';
import { offerteMercante, offerteStrega } from '@marea/sim/templari/bottega.ts';
import { createBanco } from './banco.ts';
import { createFuochi3d } from './fuochi3d.ts';
import type { Fuochi3d } from './fuochi3d.ts';
import { postoPezzo } from '@marea/sim/templari/fuochi.ts';
import type { Banco, BancoAzioni } from './banco.ts';
import type { TemplariCtx, TemplariFine, TemplariRete, TemplariRun } from './types.ts';

export { mostraEsito } from './esito.ts';
export { apriScelta, eroeSalvato } from './scelta.ts';

type Fase = 'carica' | 'gioca' | 'fine' | 'finita';
const FINE_TICK = 200; // scritta finale prima di consegnare (A la salta dopo un attimo)
/** Insieme: tick di turni da avere in coda prima di ripartire dopo un vuoto; oltre RECUPERO si corre, oltre SVELTO due tick per frame. */
const CUSCINETTO = SQ_TICKS * 2, SVELTO = SQ_TICKS * 4, RECUPERO = SQ_TICKS * 20;
/** Eventi che riguardano un eroe solo: insieme si mostrano (scritte, suoni, lampi) solo a chi è successo. */
const PERSONALI = new Set<TEvento['t']>(['punti', 'fendente', 'mancato', 'ferito', 'vuoto', 'ricarica', 'parato', 'scudo', 'scudoRotto', 'compra', 'potenziata', 'pozione', 'risorto', 'brucia', 'caduto', 'rialzato', 'sparo', 'superPronto']);
const BIT = (f: TInput): number => (f.a ? 1 : 0) | (f.b ? 2 : 0) | (f.c ? 4 : 0) | (f.d ? 8 : 0) | (f.e ? 16 : 0);
/** Un input del turno del server come lo legge la sim. */
const frameDi = (x: SqInput): TInput => ({ mx: x[0] / 8, my: x[1] / 8, a: (x[2] & 1) !== 0, b: (x[2] & 2) !== 0, c: (x[2] & 4) !== 0, d: (x[2] & 8) !== 0, ...((x[2] & 16) !== 0 ? { e: true } : {}), ...(x[3] ? { m: x[3] } : {}) });
const FINE: Record<string, [string, string, string]> = {
  morto: ['SEI CADUTO', PAL.rosso, 'Deus vult…'],
  alba: ['È L’ALBA', PAL.giallo, 'I morti tornano sotto terra. Sei sopravvissuto.'],
  uscito: ['SEI USCITO', PAL.sabbiaChiara, 'La chiesa ti aspetta.'],
  /** insieme: caduti tutti */
  tutti: ['SIETE CADUTI', PAL.rosso, 'Tutti a terra. Deus vult…'],
};

/** Il suono dell'arma che spara (docs/TEMPLARI.md §11). */
const SPARO: Record<string, SuonoId> = { pistola: 'tpl_pistola', pistola_doppia: 'tpl_pistola', moschetto: 'tpl_moschetto', trombone: 'tpl_trombone', arco: 'tpl_freccia', arco_lungo: 'tpl_freccia', fuoco_greco: 'lancio' };
/** Passi sul suolo dell'arena. */
const PASSO: Record<number, SuonoId> = { [SUOLO.pietra]: 'passo_pietra', [SUOLO.ciottoli]: 'passo_pietra', [SUOLO.terra]: 'passo_erba', [SUOLO.erba]: 'passo_erba', [SUOLO.sabbia]: 'passo_sabbia', [SUOLO.assi]: 'passo_legno' };
const ORDINE_POTERI = ['faretra', 'ira', 'campane', 'decima', 'muratori'];
/** Nome, cosa fa e colore dei power-up (la scritta grande quando li prendi). */
const POTERI: Record<string, [string, string, string]> = {
  faretra: ['FARETRA PIENA', 'Munizioni piene a tutte le armi', PAL.giallo],
  ira: ['IRA DI DIO', 'Per 30 secondi ogni colpo uccide', PAL.rosso],
  campane: ['CAMPANE A MARTELLO', 'Tutti i morti tornano sotto terra', PAL.giallo],
  decima: ['DECIMA', 'Per 30 secondi punti doppi', PAL.arancio],
  muratori: ['MURATORI', 'Tutte le finestre sbarrate di nuovo', PAL.sabbiaChiara],
};

/** Nome dell'arma come lo dice l'HUD (potenziata: quello nuovo). */
const nomeArma = (id: string, pot?: boolean): string => (pot ? armaDef(id).nomePot : armaDef(id).nome);
/** Chiave dell'arma in mano (cambia anche quando la potenzi). */
const chiaveArma = (v: TView): string => v.eroe.arma + (v.eroe.arma !== 'scudo' && v.eroe.armi[v.eroe.cur]?.pot ? '+' : '');
/** Nome e colore delle pozioni bevute (scritta grande e HUD). */
const POZIONI: Record<string, [string, string]> = { pietra: ['ZUPPA DI PIETRA', PAL.pietraChiara], viandante: ['BRODO DEL VIANDANTE', PAL.erba], lesto: ['INFUSO LESTO', PAL.acqua], bombardiere: ['GRAPPA DEL BOMBARDIERE', PAL.arancio], risorto: ['ELISIR DEL RISORTO', PAL.rosaNeon], fonte: ['ACQUA DI FONTE SANTA', PAL.acquaBassa] };

/** Il vestito dell'eroe del menù sull'avatar (niente = com'è). */
const vestito = (c: TClasse | null) => (c ? { armatura: { id: corpoTemplari(c) } } : {});
/** L'icona dell'eroe sul bottone SUPER. */
const ICONA_SUPER: Record<string, string> = { crociato: '⚔', bucaniera: '💣', arciere: '🏹' };
/** Il super appena usato: la scritta. */
const SUPER_TESTO: Record<string, [string, string]> = { giudizio: ['GIUDIZIO', 'Deus vult!'], bordata: ['BORDATA', 'Fuoco dalla nave!'], pioggia: ['PIOGGIA DI FRECCE', 'Il cielo si oscura'] };

/** Nomi corti delle armi per il banco di prova. */
const CORTO: Record<string, string> = { spada: 'Spada', pistola: 'Pistola', pistola_doppia: 'Pistola doppia', spada_molay: 'Spada di Molay', mazza: 'Mazza', ascia: 'Ascia' };

/** `classe`: l'eroe del menù d'ingresso (da solo); insieme quello di ciascuno sta nei membri della sala. */
export function startTemplari(ctx: TemplariCtx, o: { seed: number; subito: boolean; banco?: boolean; rete?: TemplariRete; classe?: TClasse | null }): TemplariRun {
  const rete = o.rete ?? null, io = rete?.io ?? 0;
  const classi = rete ? rete.membri.map((m) => m.classe ?? null) : [o.classe ?? null];
  const s: TState = templari.create({ seed: o.seed, opzioni: { ...(rete || o.subito ? { subito: true } : {}), ...(rete ? { eroi: rete.membri.length } : {}), ...(classi.some(Boolean) ? { classi } : {}) } });
  // insieme: tra un tick e l'altro s.eroe è il mio (la sim lo cambia solo dentro il tick), così tutto il client sotto guarda il mio eroe
  if (rete) usa(s, io);
  const vista = (): TView => templari.view(s, io);
  const frames: DungeonInput[] = [], azioni: TAzioni = [];
  let fase: Fase = 'carica', wait = 0, view: TView = vista(), auto: Rng | null = null, armaOra = chiaveArma(view);
  /** Insieme: i compagni (attore, arma in mano, uscito); la finestra del turno; l'ultimo input mandato; turno a metà; firme dello stato. */
  const amici = rete ? rete.membri.map((m, i) => ({ i, nome: m.nome, look: m.look, actor: null as HeroActor | null, arma: '', fuori: false, giu: false })).filter((a) => a.i !== io) : [];
  const win = { mx: 0, my: 0, bits: 0, m: 0, n: 0 };
  let mandato = '', inTurno = 0, attesa = true, rotto = false, ioGiu = false;
  const firme: Record<number, number> = {};
  let banco: Banco | null = null, pers: Personaggi | null = null, bott: BottegaUi | null = null, fuo: Fuochi3d | null = null, isolaOra = '';
  /** AZIONE premuto in questo frame (fronte): vicino al Mercante o alla Strega apre il loro menù. */
  let azionePrima = false, azioneGiu = false;
  /** Banco di prova: immortale, ondate ferme, zombie fermi (velocità di prima per id), rallentatore (un tick ogni 4 frame). */
  const bk = { immortale: false, ferme: false, fermi: false, lento: false, frame: 0, vel: new Map<number, number>() };
  let sc: Scena | null = null, hero: HeroActor | null = null, zombi: Zombi | null = null, hud: TplHud | null = null, ctl: Controlli | null = null, fx: Effetti | null = null, mouse: Mouse | null = null, mUltima = 0;
  let resolve!: (v: TemplariFine | { insieme: true } | null) => void;
  const done = new Promise<TemplariFine | { insieme: true } | null>((r) => (resolve = r));

  const pulisci = () => {
    fase = 'finita'; templariLink.state = null; templariLink.prova = null; tensione(0);
    banco?.dispose(); bott?.dispose(); pers?.dispose(); fuo?.dispose(); mouse?.dispose(); ctx.canvas.style.cursor = ''; ctl?.dispose(); hud?.dispose(); fx?.dispose(); zombi?.dispose(); hero?.dispose(); sc?.dispose();
    for (const a of amici) a.actor?.dispose();
    ctx.renderer.setScene(null);
  };
  const consegna = () => {
    if (fase === 'finita') return;
    if (rete) { rete.manda({ t: 'esco' }); pulisci(); console.log(`[marea] templari insieme finita: ${s.tick} tick, ondata ${s.ondata}`); resolve({ insieme: true }); return; }
    const out: TemplariFine = { inputs: encodeDungeon(packDungeon(frames)), hash: templari.result(s).hash, azioni: azioni.map(([t, a]) => [t, a]), result: templari.result(s) };
    pulisci();
    console.log(`[marea] templari finita: ${frames.length} tick, ondata ${s.ondata}, ${s.uccisioni} uccisioni`);
    resolve(out);
  };
  const abort = () => { if (fase === 'finita') return; if (rete) { rete.manda({ t: 'esco' }); pulisci(); resolve({ insieme: true }); return; } pulisci(); resolve(null); };
  const versoFine = () => {
    if (fase !== 'gioca') return;
    fase = 'fine'; wait = FINE_TICK; ctl?.hide();
    const [t, c, sub] = FINE[rete && s.esito === 'morto' ? 'tutti' : s.esito ?? 'uscito'] ?? FINE['uscito']!;
    hud?.grande(t, c, `Ondata ${Math.max(1, s.ondata)} · ${sub}`, 0);
    suona(s.esito === 'morto' ? 'tpl_caduto' : s.esito === 'alba' ? 'tpl_ondata_fine' : 'fine');
  };
  const esci = () => {
    if (fase !== 'gioca') return;
    // insieme: esco io, gli altri continuano (il server mi mette in `via` nel turno dopo)
    if (rete) { fase = 'fine'; wait = 1; return; }
    const ev = templari.act(s, { t: 'esci' });
    if (!ev) return;
    azioni.push([frames.length, { t: 'esci' }]);
    view = vista();
    versoFine();
  };

  ctx.hud.toast('Entri nella chiesa…', 1500);
  void (async () => {
    try {
      await ctx.loader.extend('manifest_rpg.json'); // modelli delle armi (kit GDR)
      sc = createScena(s.arena, ctx.renderer.camera);
      hero = await createHeroActor({ loader: ctx.loader, look: rete?.membri[io]?.look ?? ctx.world.look, hero: { arma: armaVista(view.eroe.arma, chiaveArma(view).endsWith('+')), ...vestito(view.eroe.classe) }, scene: sc.scene, floorY: 0, x: view.eroe.x, z: view.eroe.z, mirino: true, soloBusto: true });
      hero.avatar.setCappello(view.eroe.classe ? TESTA_TEMPLARI[view.eroe.classe] ?? null : null);
      zombi = createZombi(sc.scene);
      fx = createEffetti({ scene: sc.scene, arena: s.arena, loader: ctx.loader, root: ctx.root, canvas: ctx.canvas, camera: ctx.renderer.camera });
      if ((fase as Fase) === 'finita') { pulisci(); return; }
      hud = createTplHud(ctx.root, nomeArma, (id) => armaDef(id).tipo !== 'mischia');
      pers = createPersonaggi(sc.scene, s.arena);
      fuo = createFuochi3d(sc.scene, s.arena);
      bott = createBottegaUi(ctx.root, compraDalMenu);
      ctl = createControlli({ root: ctx.root, canvas: ctx.canvas, yaw: () => ctx.renderer.diorama.yaw, onEsci: esci, insieme: !!rete });
      for (const a of amici) {
        const c = view.compagni.find((x) => x.i === a.i);
        if (!c) continue;
        a.arma = c.arma;
        a.actor = await createHeroActor({ loader: ctx.loader, look: a.look, hero: { arma: armaVista(c.arma), ...vestito(c.classe) }, scene: sc.scene, floorY: 0, x: c.posa.x, z: c.posa.z, soloBusto: true });
        a.actor.avatar.setCappello(c.classe ? TESTA_TEMPLARI[c.classe] ?? null : null);
        a.actor.tick(c.posa);
      }
      mouse = createMouse({ canvas: ctx.canvas, camera: ctx.renderer.camera, floorY: 0 });
      hero.tick(view.posa); zombi.tick(view); fx.tick(view);
      sc.setPorte(s.porte); sc.setCalice(s.fase !== 'altare');
      ctx.renderer.setScene(sc.scene);
      ctx.renderer.diorama.setZoom(innerWidth < innerHeight ? 1.3 : 1.05); // al telefono in verticale un po' più largo: si vedono le finestre
      ctx.renderer.diorama.follow(view.eroe.x, 0.9, view.eroe.z); ctx.renderer.diorama.snap?.();
      if (o.banco && !rete) banco = createBanco(ctx.root, TEMPLARI.armi.map((a) => [a.id, CORTO[a.id] ?? a.nome]), bancoAzioni());
      hud.grande('✠', PAL.rosso, rete ? `Insieme: ${rete.membri.map((m) => m.nome).join(', ')}` : o.banco ? 'Stanza di prova' : o.subito ? 'Le ondate stanno per cominciare' : 'Porta il calice sull’altare (AZIONE)', 2600);
      if (rete) rete.manda({ t: 'carico' });
      fase = 'gioca';
    } catch (e) {
      console.error('[marea] templari non caricata', e);
      ctx.hud.toast('La chiesa non si è caricata, riprova', 3000);
      abort();
    }
  })();

  /** Volume di un verso con la distanza dall'eroe (1 vicino … 0 oltre ~22 m). */
  const vicino = (x: number, z: number) => Math.max(0, 1 - Math.sqrt((x - s.eroe.x) * (x - s.eroe.x) + (z - s.eroe.z) * (z - s.eroe.z)) / 22);
  const nomeDi = (i: number) => rete?.membri[i]?.nome ?? 'Un compagno';
  const evento = (e: TEventoDi) => {
    if (!hud || !zombi || !hero) return;
    // insieme: di quello che succede agli altri solo cadute e rialzate (il resto lo vedi sui loro avatar) e i loro spari, più piano
    if (rete && e.e !== undefined && e.e !== io && PERSONALI.has(e.t)) {
      if (e.t === 'caduto') { suona('tpl_caduto', 0.5); hud.grande('', PAL.rosso, `${nomeDi(e.e)} è a terra: si rialza all’ondata dopo`, 2600); }
      else if (e.t === 'rialzato') hud.grande('', PAL.erbaChiara, `${nomeDi(e.e)} è di nuovo in piedi`, 2000);
      else if (e.t === 'risorto') hud.grande('', PAL.rosaNeon, `${nomeDi(e.e)} si rialza con l’Elisir`, 2000);
      else if (e.t === 'sparo') { const h = s.eroi[e.e]; suona(SPARO[e.arma] ?? 'tpl_pistola', h ? vicino(h.x, h.z) : 0.4); }
      return;
    }
    if (rete && e.e === io && e.t === 'caduto') { ioGiu = true; suona('tpl_caduto'); hud.grande('SEI A TERRA', PAL.rosso, 'Ti rialzi all’ondata dopo, se gli altri resistono', 3200); return; }
    if (rete && e.e === io && e.t === 'rialzato') { ioGiu = false; suona('altare'); hud.grande('IN PIEDI', PAL.erbaChiara, 'Nuova ondata: sei di nuovo in partita', 2400); return; }
    fx?.evento(e);
    switch (e.t) {
      case 'grido': { const z = s.zombie.find((x) => x.id === e.id); if (z) suona(e.tipo === 'deus' ? 'tpl_deus' : e.tipo === 'urlo' ? 'tpl_urlo' : 'tpl_rantolo', vicino(z.x, z.z)); break; }
      case 'sorge': suona('tpl_sorge', vicino(e.x, e.z)); break;
      case 'fendente': suona('tpl_fendente', e.caricato ? 1 : 0); break;
      case 'colpo': zombi.colpito(e.id); suona(e.uccide ? 'nemico_ko' : 'colpo_dato'); break;
      case 'ferito': hero.flash(); suona('colpo_preso'); break;
      case 'punti': hud.punti(e.n); break;
      case 'ondata': hud.grande(String(e.n), PAL.rosso, e.n === 1 ? 'I Templari si svegliano' : 'Arrivano', 2400); suona('tpl_ondata'); break;
      case 'ondataFinita': hud.grande(`ONDATA ${e.n}`, PAL.giallo, 'superata', 2200); suona('tpl_ondata_fine'); break;
      case 'reliquia': sc?.setCalice(true); hud.grande('IL CALICE', PAL.giallo, 'La terra trema. Qualcosa si muove sotto il sagrato.', 3200); suona('altare'); break;
      case 'asse': { if (e.da === 'eroe') { suona('martello'); break; } const f = s.arena.finestre[e.finestra]; suona('tpl_asse', f ? vicino(f.x, f.z) : 0.5); break; }
      case 'mancato': suona('schivato'); break;
      case 'sparo': suona(SPARO[e.arma] ?? (armaDef(e.arma).tipo === 'fuoco' ? 'tpl_pistola' : 'lancio')); break;
      case 'vuoto': suona('click'); hud.grande('', PAL.sabbiaChiara, 'Niente munizioni: comprale sul muro o scambia arma', 1600); break;
      case 'ricarica': suona('martello'); break;
      case 'esplosione': suona('tuono'); break;
      case 'parato': suona('schivato'); break;
      case 'scudoSpaccato': zombi.colpito(e.id); suona('colpo_critico', vicino(e.x, e.z)); hud.grande('', PAL.sabbiaChiara, 'Scudo spaccato: adesso è scoperto', 1200); break;
      case 'scudo': suona('raccolto'); hud.grande('SCUDO', PAL.sabbiaChiara, 'Sulle spalle para da dietro · SCAMBIA per impugnarlo', 2400); break;
      case 'scudoRotto': suona('colpo_critico'); hud.grande('', PAL.rosso, 'Lo scudo si è spaccato', 1600); break;
      case 'compra': suona('moneta'); break;
      case 'potenziata': suona('medaglia_oro'); suona('tpl_potere_preso', 1); hud.grande('✦', PAL.giallo, `Il Mercante ha potenziato l’arma: ${e.nome}`, 2600); break;
      case 'pozione': { const [nome, colore] = POZIONI[e.id] ?? ['', PAL.giallo]; suona('pozione'); hud.grande(nome, colore, TEMPLARI.strega.pozioni.find((p) => p.id === e.id)?.descr ?? '', 2400); break; }
      case 'risorto': suona('altare'); suona('tpl_campana', 1); hud.grande('TI RIALZI', PAL.rosaNeon, 'L’Elisir del risorto ti rimette in piedi (le pozioni sono finite)', 2800); break;
      case 'porta': sc?.setPorte(s.porte); suona('tpl_porta'); hud.grande('', PAL.giallo, `Si apre: ${TEMPLARI.porte[e.id]?.nome ?? e.id}`, 2000); break;
      case 'trappola':
        if (e.fase === 'accesa') { suona(e.id === 'rogo' ? 'tpl_rogo' : 'tpl_campana', 1); hud.grande('', PAL.arancio, e.id === 'rogo' ? 'Il rogo di de Molay brucia la navata' : 'La campana grande si stacca e oscilla', 2200); }
        else if (e.fase === 'pronta') suona('click');
        break;
      case 'potere':
        if (!e.preso) suona('tpl_potere');
        else {
          const [nome, sub, colore] = POTERI[e.tipo] ?? ['', '', PAL.giallo];
          suona('tpl_potere_preso', Math.max(0, ORDINE_POTERI.indexOf(e.tipo)) / 4); if (e.tipo === 'campane') suona('tpl_campana', 1);
          hud.grande(nome, colore, sub, 2200);
        }
        break;
      case 'boss':
        if (e.tipo === 'cavaliere') { suona('tpl_corno', 1); suona('tuono', 0.6); hud.grande('TEMPLARE A CAVALLO', PAL.rosso, 'La terra trema: arriva al galoppo', 3000); }
        else { suona('tpl_rogo'); suona('tpl_risata', 1); hud.grande('JACQUES DE MOLAY', PAL.arancio, 'L’ultimo Gran Maestro esce dalle fiamme', 3400); }
        break;
      case 'corno': { const z = s.zombie.find((x) => x.id === e.id); suona('tpl_corno', z ? vicino(z.x, z.z) : 0.6); break; }
      case 'risata': suona('tpl_risata', 1); hud.grande('', PAL.arancio, 'De Molay ride e scappa: non è ancora il suo momento', 3000); break;
      case 'scompare': hud.grande('', PAL.giallo, 'De Molay è sparito nella notte', 2200); break;
      case 'bomba': suona('lancio'); break;
      case 'superPronto': suona('medaglia_oro'); hud.grande('SUPER PRONTO', PAL.giallo, 'Tocca SUPER (o R) quando sono tanti', 2200); break;
      case 'super': { const [nome, sub] = SUPER_TESTO[e.tipo] ?? ['SUPER', '']; suona(e.tipo === 'pioggia' ? 'tpl_freccia' : e.tipo === 'bordata' ? 'tpl_moschetto' : 'colpo_critico', 1); if (e.tipo === 'giudizio') suona('tuono', 0.8); hud.grande(nome, PAL.giallo, sub, 1800); break; }
      case 'cannonata': suona('tuono', vicino(e.x, e.z)); break;
      case 'lavoro': suona(e.cosa === 'monta' ? 'martello' : 'sfrigola', 0.6); break;
      case 'fuoco': { const f = TEMPLARI.fuochi.lista[e.id]; suona('tpl_rogo'); suona('medaglia_bronzo'); hud.grande(f?.nome.toUpperCase() ?? 'FUOCO', PAL.arancio, f?.dice ?? '', 2800); break; }
      case 'fuochiTutti': suona('medaglia_oro'); suona('tpl_campana', 1); hud.grande('L’ISOLA BRUCIA', PAL.giallo, `Tutti i fuochi accesi: +${TEMPLARI.fuochi.tutti} punti e un dono`, 3200); break;
      case 'pezzo': suona('raccolto'); hud.grande(`${e.presi}/${e.tutti}`, PAL.giallo, e.presi < e.tutti ? `${TEMPLARI.campana.pezzi[e.id] ?? e.id} della campana: ne mancano ${e.tutti - e.presi}` : 'Tutti i pezzi: monta la campana alla sua leva', 2600); break;
      case 'campana': suona('tpl_campana', 1); suona('medaglia_argento'); hud.grande('LA CAMPANA', PAL.giallo, 'È montata: la leva la fa oscillare sul passaggio', 2800); break;
      case 'brucia': suona('sfrigola'); break;
      case 'cassa':
        if (e.fase === 'gira') { suona('apri'); suona('tpl_cassa'); }
        else if (e.fase === 'arma' && e.arma) { suona(armaDef(e.arma).miracolosa ? 'medaglia_oro' : 'notifica'); if (armaDef(e.arma).miracolosa) hud.grande('✦', PAL.giallo, armaDef(e.arma).nome, 2200); }
        else if (e.fase === 'teschio') { suona('tpl_teschio'); hud.grande('☠', PAL.pietraChiara, 'Il teschio ride: la cassa se ne va', 2400); }
        else if (e.fase === 'qui') hud.grande('', PAL.giallo, 'La cassa è ricomparsa da un’altra parte', 2000);
        else if (e.fase === 'presa') suona('raccolto');
        break;
      default:
    }
  };

  /** Arma a distanza in mano (si mira): arco, pistole, moschetto, trombone, fuoco greco; con lo scudo in mano no. */
  const miraArma = (): 'arco' | 'tiro' | null => {
    if (s.eroe.inMano) return null;
    const t = armaIn(s).tipo;
    return t === 'arco' ? 'arco' : t === 'mischia' ? null : 'tiro';
  };
  /** L'input di adesso: autopilota (test), o tastiera/joystick + bottoni del chunk. */
  function inputOra(f: InputFrame): DungeonInput {
    const c = ctl!.sample();
    azioneGiu = azioneGiu || (c.d && !azionePrima); azionePrima = c.d;
    if (auto) return templari.autopilot(s, auto);
    // insieme non ci si ferma: in pausa, a terra o col menù del Mercante aperto l'eroe sta fermo
    if (rete && (ctl!.paused || ioGiu || bott?.aperta)) return { mx: 0, my: 0, a: false, b: false, c: false, d: false };
    let a = f.a || c.a, m = 0;
    let mx = f.mx, my = f.my;
    const h = s.eroe, tipo = miraArma();
    if (tipo) {
      // telefono: joystick di mira. Arco: tenuto = teso, lasciato = tira. Armi da fuoco e vaso: partono al rilascio, un tocco veloce spara assistito
      const st = c.mira;
      a = a || (tipo === 'arco' ? st.held : st.rel || st.tap);
      m = tipo === 'arco' || st.rel ? st.m : 0;
      // mouse: l'indice del cursore mentre premi (e al rilascio dell'arco, che parte nel tick in cui lasci)
      if (!m && mouse?.attivo && (a || h.act === 'tende')) m = mouse.verso(h.x, h.z)?.m ?? 0;
    }
    // da PC, fermo: guarda il puntatore (il punto sotto il mouse)
    const v = mouse && Math.abs(mx) < 0.05 && Math.abs(my) < 0.05 ? mouse.verso(h.x, h.z) : null;
    if (v) { mx = v.x * 0.25; my = v.z * 0.25; }
    // SUPER: col mouse va dove punta il cursore
    if (c.e && !m && mouse?.attivo) m = mouse.verso(h.x, h.z)?.m ?? 0;
    mUltima = m;
    return { mx, my, a, b: f.b, c: c.c, d: c.d, ...(c.e ? { e: true } : {}), ...(m ? { m } : {}) };
  }
  // passi sul suolo sotto i piedi (ogni ~1 m, 1,5 m di corsa) e la tensione della musica (boss in campo, tanti zombie vicini)
  let px = NaN, pz = NaN, strada = 0;
  function tickUno(f: InputFrame): void {
    const q = quantizeDungeon(inputOra(f));
    if (o.banco) bancoPrima();
    frames.push(q); stepTemplari(s, q);
    if (o.banco && bk.immortale) s.eroe.vita = s.eroe.max;
    dopoPasso();
  }
  /** Dopo un passo della sim: eventi, passi sotto i piedi del mio eroe, tensione della musica. */
  function dopoPasso(): void {
    for (const e of s.eventi) evento(e);
    const h = s.eroe, d = Number.isNaN(px) ? 0 : Math.sqrt((h.x - px) * (h.x - px) + (h.z - pz) * (h.z - pz));
    px = h.x; pz = h.z;
    if (d > 2 || !h.moving) strada = 0;
    else if ((strada += d) >= (h.corre ? 1.5 : 1.05)) { strada = 0; suona(PASSO[s.arena.suolo[Math.floor(h.z / s.arena.tile) * s.arena.w + Math.floor(h.x / s.arena.tile)] ?? 0] ?? 'passo_pietra'); }
    if (s.tick % 30 === 0) {
      const vivi = s.zombie.filter((z) => z.st !== 'morto').length;
      tensione(s.fase !== 'combatti' ? 0.1 : s.zombie.some((z) => z.def.boss && z.st !== 'morto') ? 1 : Math.min(0.75, vivi / 16));
    }
  }

  /** Un acquisto dal menù del Mercante o della Strega: la sim lo prova (vicino, punti, si può) e, se vale, lo registra per il server. */
  function compraDalMenu(a: TAzione): void {
    if (fase !== 'gioca') return;
    // insieme: al server, che lo mette nel turno dopo (la sim lo fa lì, per tutti)
    if (rete) { rete.manda({ t: 'az', a }); return; }
    const ev = templari.act(s, a);
    if (!ev) { suona('vuoto'); return; }
    azioni.push([frames.length, a]);
    for (const e of ev) evento(e);
    view = vista();
  }
  /** Banco di prova: prima di ogni tick tiene ferme le ondate e gli zombie e rende l'eroe immortale. */
  function bancoPrima(): void {
    if (bk.immortale) s.eroe.vita = 1e6;
    if (bk.ferme) { s.prossima = s.tick + 600; if (s.boss && !s.boss.uscito) s.boss.at = s.tick + 600; }
    for (const z of s.zombie) {
      if (bk.fermi && z.vel > 0) { bk.vel.set(z.id, z.vel); z.vel = 0; }
      else if (!bk.fermi && z.vel === 0 && bk.vel.has(z.id)) { z.vel = bk.vel.get(z.id)!; bk.vel.delete(z.id); }
    }
  }
  function bancoAzioni(): BancoAzioni {
    const h = s.eroe;
    return {
      ondata(n) {
        s.ondata = n; s.fase = 'combatti'; s.faseT = 0; s.quanti = quantiOndata(n); s.usciti = 0; s.tipiUsciti = {}; s.prossima = s.tick + 60; s.boss = null; s.poteri.ondata = 0;
        hud?.grande(String(n), PAL.rosso, 'Ondata scelta dal banco', 1200);
        return n;
      },
      zombie(tipo) {
        const p = vicinoRaggiungibile(s, h.x + h.fx * 3.2, h.z + h.fz * 3.2, 3) ?? { x: h.x + h.fx * 3.2, z: h.z + h.fz * 3.2 };
        const def = TEMPLARI.nemici.find((n) => n.id === tipo);
        const z = nuovoZombie(s, tipo, p.x, p.z, def?.velocita.cammina ?? 1);
        z.st = 'insegue'; z.fx = -h.fx; z.fz = -h.fz;
      },
      arma(id) { daiArma(s, id); const i = h.armi.findIndex((x) => x?.id === id); if (i >= 0) { h.cur = i; h.inMano = false; } },
      punti(n) { s.eroe.punti += n; hud?.punti(n); },
      pulisci() { s.zombie = []; s.tiri = []; s.fiamme = []; s.boss = null; },
      immortale(on) { bk.immortale = on; if (!on) h.vita = Math.min(h.vita, h.max); },
      ferme(on) { bk.ferme = on; if (!on) s.prossima = s.tick + 30; },
      fermi(on) { bk.fermi = on; },
      lento(on) { bk.lento = on; },
      vicino(on) { ctx.renderer.diorama.setZoom(on ? 0.6 : innerWidth < innerHeight ? 1.3 : 1.05); },
      extra: [
        // l'eroe del menù: si ricomincia con quello (la stanza di prova rientra da sola), e il super pieno subito
        { titolo: 'Eroe (si ricomincia)', voci: TEMPLARI.eroi.map((e): [string, () => void] => [e.nome.replace(/^(Il|La|L’|L')\s*/, ''), () => { salvaEroe(e.id); esci(); }]) },
        { titolo: 'Isola', voci: [
          ['Accendi i fuochi', () => { for (const k in s.fuochi) s.fuochi[k] = true; }],
          ['Pezzi della campana', () => { for (const k in s.pezzi) s.pezzi[k]!.preso = true; }],
          ['Vai a un pezzo', () => { const id = Object.keys(s.pezzi).find((k) => !s.pezzi[k]!.preso); const q = id ? postoPezzo(s, id) : null; if (q) { for (const p of s.arena.porte) if (!s.porte[p.id]) { s.eroe.punti += TEMPLARI.porte[p.id]?.prezzo ?? 0; apriPorta(s, p); } sc?.setPorte(s.porte); h.x = q.x; h.z = q.z + 1; } }],
        ] },
        { titolo: 'Super', voci: [['Carica pieno', () => { if (h.classe) { h.superK = 1; hud?.grande('SUPER PRONTO', PAL.giallo, 'Dal banco', 1200); } }]] },
        { titolo: 'Vai da', voci: (['mercante', 'strega'] as const).map((id): [string, () => void] => [id === 'mercante' ? 'Mercante' : 'Strega', () => {
          const p = s.arena.personaggi.find((x) => x.id === id);
          if (!p) return;
          for (const q of s.arena.porte) if (!s.porte[q.id]) { s.eroe.punti += TEMPLARI.porte[q.id]?.prezzo ?? 0; apriPorta(s, q); }
          sc?.setPorte(s.porte);
          h.x = p.x - p.fx * 1.2; h.z = p.z - p.fz * 1.2; h.fx = p.fx; h.fz = p.fz;
        }]) },
      ],
    };
  }

  // ---- insieme ----
  /** Un frame: il mio input nella finestra del turno (al server se è cambiato), poi i tick dei turni arrivati. */
  function stepInsieme(f: InputFrame): void {
    const r = rete!;
    if (templariLink.autopilot > 0 && !auto) auto = createRng(o.seed + io).fork('autopilot');
    if (templariLink.autopilot === 0) auto = null;
    if (fase === 'gioca' && !s.done) {
      const q = quantizeDungeon(inputOra(f));
      win.mx = q.mx; win.my = q.my; win.bits |= BIT(q); if (q.m) win.m = q.m;
      if (++win.n >= SQ_TICKS) {
        const mx = Math.round(win.mx * 8) || 0, my = Math.round(win.my * 8) || 0;
        const x: SqInput = win.m ? [mx, my, win.bits, win.m] : [mx, my, win.bits], k = x.join(',');
        if (k !== mandato) { mandato = k; r.manda({ t: 'in', f: x }); }
        win.bits = 0; win.m = 0; win.n = 0;
      }
    }
    if (r.chiusa && !rotto && fase === 'gioca') { rotto = true; ctx.hud.toast('Connessione con la squadra persa', 3000); consegna(); return; }
    // quanti tick giocare adesso: niente se il cuscinetto si è svuotato (finché non si riempie), di più se si resta indietro
    const pronti = r.turni.length * SQ_TICKS - inTurno;
    if (pronti <= 0) { attesa = true; return; }
    if (attesa && pronti < CUSCINETTO) return;
    attesa = false;
    const n = pronti > RECUPERO ? pronti - CUSCINETTO : pronti > SVELTO ? 2 : 1;
    for (let k = 0; k < n && !s.done; k++) tickRete(n > 2);
    dopoTick();
  }
  /** Un tick del turno in testa: al primo tick chi esce e gli acquisti (come li ha messi il server), poi il passo di tutti. */
  function tickRete(muto: boolean): void {
    const r = rete!, t = r.turni[0]!;
    if (inTurno === 0) {
      for (const i of t.via ?? []) templari.act(s, { t: 'ritira', eroe: i });
      for (const [i, a] of t.az ?? []) { const ev = templari.act(s, a, i); if (ev && i === io && !muto) for (const e of ev) evento(e); }
    }
    stepTemplariInsieme(s, t.f.map(frameDi));
    usa(s, io);
    if (s.tick % 300 === 0) firme[s.tick] = templari.result(s).hash; // test: ogni 5 s lo stato di tutti, uguale per ogni giocatore
    if (!muto) dopoPasso();
    if (++inTurno >= SQ_TICKS) { r.turni.shift(); inTurno = 0; }
  }
  /** Compagni: posa e arma dalla vista, a terra o usciti (spariscono con un avviso). */
  function tickAmici(): void {
    for (const a of amici) {
      const c = view.compagni.find((x) => x.i === a.i);
      if (!c || !a.actor) continue;
      if (c.fuori) { if (!a.fuori) { a.fuori = true; a.actor.avatar.object.visible = false; hud?.grande('', PAL.sabbiaChiara, `${a.nome} è uscito dalla chiesa`, 2200); } continue; }
      if (c.arma !== a.arma) { a.arma = c.arma; void a.actor.setArma(armaVista(c.arma)); }
      a.giu = c.giu;
      a.actor.tick(c.posa);
    }
  }

  const run: TemplariRun = {
    get active() { return fase !== 'finita'; },
    step(f) {
      if (fase === 'fine') { if (--wait <= 0 || (wait < FINE_TICK - 60 && f.a)) consegna(); return; }
      if (rete) { if (fase === 'gioca' && ctl) stepInsieme(f); return; }
      if (fase !== 'gioca' || !ctl || ctl.paused) return;
      if (templariLink.autopilot > 0 && !auto) auto = createRng(o.seed).fork('autopilot');
      if (templariLink.autopilot === 0) auto = null;
      const n = auto ? templariLink.autopilot : 1;
      if (bk.lento && bk.frame++ % 4 !== 0) return;
      for (let i = 0; i < n && !s.done; i++) tickUno(f);
      dopoTick();
    },
    update(alpha, dt, t) { aggiorna(alpha, dt, t); },
    abort,
    done,
  };

  /** Dopo i tick di un frame: vista, arma in mano, menù del Mercante e della Strega, attori, mira; in fondo la fine. */
  function dopoTick(): void {
    if (!ctl) return;
    view = vista();
    if (chiaveArma(view) !== armaOra) { armaOra = chiaveArma(view); void hero?.setArma(armaVista(view.eroe.arma, armaOra.endsWith('+'))); }
    // AZIONE vicino al Mercante o alla Strega: il loro menù
    const chi = view.prompt?.cosa === 'mercante' || view.prompt?.cosa === 'strega' ? view.prompt.cosa : null;
    if (azioneGiu && chi && view.prompt?.puoi && bott?.aperta !== chi) { bott?.apri(chi); suona('apri'); }
    azioneGiu = false;
    hero!.tick(view.posa); zombi!.tick(view); fx!.tick(view); fuo?.tick(view);
    // l'isola (§9b): Strega sveglia e nave attraccata coi loro fuochi, la campana montata
    const io2 = view.fuochi.map((f) => +f.acceso).join('') + +view.campana;
    if (io2 !== isolaOra) {
      isolaOra = io2;
      const fu = (apre: string) => view.fuochi.find((f) => TEMPLARI.fuochi.lista[f.id]?.apre === apre)?.acceso ?? true;
      pers?.setSvegli(fu('strega'), fu('mercante'));
      sc?.setCampana(view.campana);
    }
    // linea di mira: dove punta il dito (joystick) o il cursore con un'arma a distanza in mano; sennò, con l'arco teso, verso chi prenderà la freccia
    const tipo = miraArma(), vm = ctl.miraDir() ?? (tipo && !ctl.paused ? mouse?.verso(s.eroe.x, s.eroe.z) ?? null : null);
    ctx.canvas.style.cursor = tipo && mouse?.attivo ? 'crosshair' : '';
    const t0 = !vm && s.eroe.act === 'tende' ? miraTiro(s, armaDef(view.eroe.arma === 'scudo' ? 'spada' : view.eroe.arma).gittata ?? 20) : null;
    if (vm) hero!.mira({ x: vm.x, z: vm.z }, true);
    else if (t0) { const dx = t0.x - s.eroe.x, dz = t0.z - s.eroe.z, d = Math.sqrt(dx * dx + dz * dz) || 1; hero!.mira({ x: dx / d, z: dz / d }); } else hero!.mira(null);
    tickAmici();
    if (s.done) versoFine();
  }
  function aggiorna(alpha: number, dt: number, t: number): void {
    if (!sc || !hero || !zombi || !hud || !ctl || fase === 'finita' || fase === 'carica') return;
    hero.update(alpha, dt);
    for (const a of amici) if (a.actor && !a.fuori) a.actor.update(alpha, dt);
    if (rete) hud.compagni(amici.flatMap((a) => {
      if (!a.actor || a.fuori) return [];
      const c = view.compagni.find((x) => x.i === a.i), hp = a.actor.head(), [x, y] = schermo3(hp.x, hp.y + 0.35, hp.z);
      return [{ x, y, nome: a.nome, frac: c ? c.vita / Math.max(1, c.max) : 0, giu: a.giu, punti: c?.punti ?? 0 }];
    }));
    zombi.update(alpha, dt, t);
    fx?.update(alpha, dt, t, hero.avatar.object, view);
    const p = hero.avatar.object.position;
    ctx.renderer.diorama.follow(p.x, 0.9, p.z); ctx.renderer.diorama.update(dt);
    sc.update(p.x, p.z, t, s.assi, view.trappole);
    hud.set(view);
    ctl.setPrompt(fase === 'gioca' ? view.prompt : null);
    // Mercante e Strega: si muovono, e il loro menù resta aperto finché sei lì
    const chi = fase === 'gioca' && (view.prompt?.cosa === 'mercante' || view.prompt?.cosa === 'strega') ? view.prompt.cosa : null;
    pers?.update(t, chi);
    fuo?.update(t);
    if (bott?.aperta) {
      // le offerte e i punti sono i tuoi (insieme dopo un tick l'eroe di turno può essere un altro)
      if (bott.aperta !== chi) bott.chiudi();
      else { const prima = s.chi; usa(s, io); bott.aggiorna(chi === 'mercante' ? offerteMercante(s) : offerteStrega(s), s.eroe.punti); usa(s, prima); }
    }
    ctl.setMira(fase === 'gioca' && miraArma() !== null);
    ctl.setScambia(fase === 'gioca' && view.eroe.armi.filter(Boolean).length + (view.eroe.scudo ? 1 : 0) > 1);
    ctl.setSuper(fase === 'gioca' && view.eroe.classe ? view.eroe.super : null, view.eroe.classe ? ICONA_SUPER[view.eroe.classe] : undefined);
  }

  // test (hook templariProva): armi da capo (`armi`), arma, scudo (in mano), punti, uno zombie davanti fermo, porte aperte, eroe spostato
  // (`dove`), power-up davanti o sotto i piedi, trappola accesa, campo pulito, vita; solo per guardare la resa, senza server
  templariLink.prova = (p) => {
    if (Array.isArray(p['armi'])) { s.eroe.armi = s.eroe.armi.map(() => null); s.eroe.cur = 0; for (const id of p['armi'] as string[]) daiArma(s, id); }
    if (typeof p['arma'] === 'string') daiArma(s, p['arma']);
    if (p['scudo']) { s.eroe.scudo = { vita: TEMPLARI.scudo.vita }; s.eroe.inMano = p['scudo'] === 'mano'; }
    if (typeof p['punti'] === 'number') s.eroe.punti = p['punti'];
    if (typeof p['dove'] === 'object' && p['dove']) { const d = p['dove'] as { x: number; z: number }; s.eroe.x = d.x; s.eroe.z = d.z; }
    if (typeof p['faccia'] === 'object' && p['faccia']) { const d = p['faccia'] as { x: number; z: number }, n = Math.sqrt(d.x * d.x + d.z * d.z) || 1; s.eroe.fx = d.x / n; s.eroe.fz = d.z / n; }
    if (Array.isArray(p['porte'])) for (const id of p['porte'] as string[]) { const q = s.arena.porte.find((x) => x.id === id); if (q && !s.porte[id]) { s.eroe.punti += TEMPLARI.porte[id]?.prezzo ?? 0; apriPorta(s, q); } }
    if (p['pulisci']) { s.zombie = []; s.tiri = []; s.fiamme = []; s.boss = null; }
    if (p['ferma']) { s.quanti = 1e6; s.usciti = 0; s.prossima = 1e9; } // niente altri zombie dall'ondata in corso (le prove di mira ne vogliono uno solo)
    if (typeof p['vita'] === 'number') { s.eroe.vita = s.eroe.max = p['vita']; }
    if (p['super']) s.eroe.superK = 1;
    if (p['fuochi']) for (const k in s.fuochi) s.fuochi[k] = true;
    if (p['pezzi']) for (const k in s.pezzi) s.pezzi[k]!.preso = true;
    if (typeof p['posti'] === 'object' && p['posti']) for (const [k, v] of Object.entries(p['posti'] as Record<string, number>)) if (s.pezzi[k]) s.pezzi[k]!.posto = v; // dove stanno i pezzi (prove)
    if (typeof p['pezzo'] === 'string') { const q = postoPezzo(s, p['pezzo']); if (q) { s.eroe.x = q.x; s.eroe.z = q.z + 0.4; } }
    if (typeof p['fuoco'] === 'string') { const f = s.arena.fuochi.find((x) => x.id === p['fuoco']); if (f) { const g = s.gr.eroe, cx = Math.floor(f.x), cz = Math.floor(f.z), d = [[0, -1], [0, 1], [-1, 0], [1, 0]].find(([dx, dz]) => !g.solid[(cz + dz!) * g.w + cx + dx!]) ?? [0, -1]; s.eroe.x = cx + d[0]! + 0.5; s.eroe.z = cz + d[1]! + 0.5; } }
    if (typeof p['ondata'] === 'number') s.ondata = p['ondata']; // la vita degli zombie che escono adesso (le prove di mira la vogliono bassa)
    if (typeof p['potere'] === 'string') s.drops.push({ id: s.nextId++, tipo: p['potere'] as 'ira', x: s.eroe.x + s.eroe.fx * 2.5, z: s.eroe.z + s.eroe.fz * 2.5, fine: s.tick + 60 * 25 });
    if (typeof p['potereQui'] === 'string') s.drops.push({ id: s.nextId++, tipo: p['potereQui'] as 'ira', x: s.eroe.x, z: s.eroe.z, fine: s.tick + 60 * 25 });
    if (typeof p['trappola'] === 'string') { const i = s.arena.trappole.findIndex((x) => x.id === p['trappola']); const st = s.trappole[i]; if (st) { st.fine = s.tick + 600; st.pronta = st.fine + 600; } }
    if (p['porte'] || p['dove']) sc?.setPorte(s.porte);
    if (typeof p['zombie'] === 'string') {
      const dist = typeof p['dist'] === 'number' ? p['dist'] : 2.2, lato = typeof p['lato'] === 'number' ? p['lato'] : 0;
      const z = nuovoZombie(s, p['zombie'], s.eroe.x + s.eroe.fx * dist - s.eroe.fz * lato, s.eroe.z + s.eroe.fz * dist + s.eroe.fx * lato, 0);
      z.st = 'insegue'; z.fx = -s.eroe.fx; z.fz = -s.eroe.fz;
    }
    view = vista();
    return { arma: view.eroe.arma, scudo: view.eroe.scudo, zombie: view.zombie.length };
  };
  const pos = new THREE.Vector3(), pr = new THREE.Vector3();
  /** Dove cade sullo schermo (px della pagina) un punto del pavimento: per i test, che mirano col mouse e col dito. */
  const schermo = (x: number, z: number): [number, number] => schermo3(x, 1.2, z);
  function schermo3(x: number, y: number, z: number): [number, number] {
    const r = ctx.canvas.getBoundingClientRect();
    pr.set(x, y, z).project(ctx.renderer.camera);
    return [Math.round(r.left + ((pr.x + 1) / 2) * r.width), Math.round(r.top + ((1 - pr.y) / 2) * r.height)];
  }
  /** Dove si mette l'eroe per aprire la cassa (la cella davanti al posto di adesso): per i test. */
  const cassaDavanti = () => { const c = s.arena.casse[s.cassa.posto]; return c ? { x: c.x + c.fx, z: c.z + c.fz } : null; };
  templariLink.state = () => ({
    active: fase !== 'finita', fase, sim: view.fase, tick: view.tick, ondata: view.ondata, restano: view.restano, done: view.done, esito: view.esito,
    isola: { fuochi: view.fuochi.filter((f) => f.acceso).map((f) => f.id), pezzi: view.pezzi.filter((x) => x.preso).map((x) => x.id), campana: view.campana, disegno: fuo?.stats() ?? null, azioneTenuta: s.eroe.prevD },
    eroe: { x: view.eroe.x, z: view.eroe.z, vita: view.eroe.vita, punti: view.eroe.punti, arma: view.eroe.arma, classe: view.eroe.classe, super: view.eroe.super, vestito: hero?.avatar.indossaStato()?.corpo ?? null }, zombie: view.zombie.length,
    uccisioni: view.uccisioni, assi: [...s.assi], prompt: view.prompt?.cosa ?? null, frames: frames.length, auto: !!auto, pausa: !!ctl?.paused, mira: mUltima, act: s.eroe.act, mouse: mouse?.attivo ?? false, faccia: [s.eroe.fx, s.eroe.fz], yaw: ctx.renderer.diorama.yaw, eroeSchermo: schermo(s.eroe.x, s.eroe.z), zombiePos: s.zombie.filter((z) => z.st !== 'morto').slice(0, 6).map((z) => ({ x: z.x, z: z.z, schermo: schermo(z.x, z.z) })),
    scena: sc?.stats() ?? null, attori: zombi?.counts() ?? null, effetti: fx?.stats() ?? null, armi: view.eroe.armi, scudo: view.eroe.scudo, cassa: { fase: view.cassa.fase, arma: view.cassa.arma, davanti: cassaDavanti() }, porte: { ...s.porte }, trappole: view.trappole, poteri: view.poteri, drops: view.drops.map((d) => d.tipo), camera: hero ? pos.copy(hero.avatar.object.position).toArray() : null,
    max: TEMPLARI.ondate.insieme,
    insieme: rete ? {
      io, eroi: s.eroi.length, turni: rete.turni.length, giu: ioGiu, firme: { ...firme },
      compagni: view.compagni.map((c) => ({ i: c.i, x: c.posa.x, z: c.posa.z, vita: c.vita, giu: c.giu, fuori: c.fuori, visibile: !!amici.find((a) => a.i === c.i)?.actor?.avatar.object.visible })),
    } : null,
  });
  return run;
}
