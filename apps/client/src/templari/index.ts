// Partita a ondate dei Templari lato client (docs/TEMPLARI.md, CONTRACTS «Templari»): entry del chunk, scaricato entrando nella chiesa.
// Prende il controllo del ciclo come il dungeon: scena dell'arena, eroe (l'avatar con l'arma in pugno, rpg/dungeon_hero.ts), zombie, HUD e
// controlli; a ogni tick registra UN input (joystick e B da main.ts, A = attacca anche col clic o da solo con AUTO, C = SCAMBIA, D = AZIONE)
// quantizzato come lo rigioca il server. Pausa = nessun tick. Fine: scritta grande, poi consegna (input compressi, azioni, hash).
// Niente attacco automatico. Da PC, se non cammini, l'eroe guarda il mouse: il client manda il joystick «sfiorato» verso il puntatore
// (la sim lo gira sul posto, GIRA_SUL_POSTO) e il clic attacca lì; resta negli input, il server lo rigioca uguale.
// Autopilota dei test (templariLink.autopilot o ?autopilot=1): gli input li dà la sim, registrati uguali.
import * as THREE from 'three';
import type { InputFrame } from '@marea/sim';
import { createRng } from '@marea/sim';
import type { Rng } from '@marea/sim';
import { TEMPLARI, armaDef } from '@marea/content/templari.ts';
import { encodeDungeon, packDungeon, quantizeDungeon } from '@marea/sim/dungeon/replay.ts';
import type { DungeonInput } from '@marea/sim/dungeon/types.ts';
import { pugni } from '@marea/sim/dungeon/hero.ts';
import { stepTemplari, templari } from '@marea/sim/templari/templari.ts';
import type { TState } from '@marea/sim/templari/templari.ts';
import { daiArma, miraTiro } from '@marea/sim/templari/eroe.ts';
import { nuovoZombie } from '@marea/sim/templari/stato.ts';
import { apriPorta } from '@marea/sim/templari/porte.ts';
import type { TAzioni, TEvento, TView } from '@marea/sim/templari/types.ts';
import { createHeroActor } from '../rpg/dungeon_hero.ts';
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
import { oggettoArma } from './armi3d.ts';
import type { Controlli } from './controlli.ts';
import type { TemplariCtx, TemplariFine, TemplariRun } from './types.ts';

export { mostraEsito } from './esito.ts';

type Fase = 'carica' | 'gioca' | 'fine' | 'finita';
const FINE_TICK = 200; // scritta finale prima di consegnare (A la salta dopo un attimo)
const FINE: Record<string, [string, string, string]> = {
  morto: ['SEI CADUTO', PAL.rosso, 'Deus vult…'],
  alba: ['È L’ALBA', PAL.giallo, 'I morti tornano sotto terra. Sei sopravvissuto.'],
  uscito: ['SEI USCITO', PAL.sabbiaChiara, 'La chiesa ti aspetta.'],
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

/** L'arma della sim come la vuole l'attore dell'eroe (modello del kit, colore della lama, portata per la scia; pistole, moschetto e vaso
 *  fatti qui). Con lo scudo in mano niente arma (lo scudo lo disegna effetti.ts). */
function armaVista(id: string): ArmaInMano {
  const base = pugni();
  if (id === 'scudo') return { ...base, id: null };
  const a = armaDef(id), forma = a.aspetto.forma;
  return {
    ...base, id: null, kind: a.tipo === 'arco' ? 'arco' : 'mischia', danno: a.danno, tempo: a.tempo, portata: a.portata ?? base.portata,
    ...(forma ? { oggetto: () => oggettoArma(forma), lama: a.tipo === 'mischia' } : a.aspetto.modello ? { modello: a.aspetto.modello } : {}), colore: a.aspetto.colore,
  };
}

export function startTemplari(ctx: TemplariCtx, o: { seed: number; subito: boolean }): TemplariRun {
  const s: TState = templari.create({ seed: o.seed, opzioni: o.subito ? { subito: true } : {} });
  const frames: DungeonInput[] = [], azioni: TAzioni = [];
  let fase: Fase = 'carica', wait = 0, view: TView = templari.view(s), auto: Rng | null = null, armaOra = view.eroe.arma;
  let sc: Scena | null = null, hero: HeroActor | null = null, zombi: Zombi | null = null, hud: TplHud | null = null, ctl: Controlli | null = null, fx: Effetti | null = null;
  let resolve!: (v: TemplariFine | null) => void;
  const done = new Promise<TemplariFine | null>((r) => (resolve = r));

  const pulisci = () => {
    fase = 'finita'; templariLink.state = null; templariLink.prova = null; tensione(0);
    ctl?.dispose(); hud?.dispose(); fx?.dispose(); zombi?.dispose(); hero?.dispose(); sc?.dispose();
    ctx.renderer.setScene(null);
  };
  const consegna = () => {
    if (fase === 'finita') return;
    const out: TemplariFine = { inputs: encodeDungeon(packDungeon(frames)), hash: templari.result(s).hash, azioni: azioni.map(([t, a]) => [t, a]), result: templari.result(s) };
    pulisci();
    console.log(`[marea] templari finita: ${frames.length} tick, ondata ${s.ondata}, ${s.uccisioni} uccisioni`);
    resolve(out);
  };
  const abort = () => { if (fase === 'finita') return; pulisci(); resolve(null); };
  const versoFine = () => {
    if (fase !== 'gioca') return;
    fase = 'fine'; wait = FINE_TICK; ctl?.hide();
    const [t, c, sub] = FINE[s.esito ?? 'uscito'] ?? FINE['uscito']!;
    hud?.grande(t, c, `Ondata ${Math.max(1, s.ondata)} · ${sub}`, 0);
    suona(s.esito === 'morto' ? 'tpl_caduto' : s.esito === 'alba' ? 'tpl_ondata_fine' : 'fine');
  };
  const esci = () => {
    if (fase !== 'gioca') return;
    const ev = templari.act(s, { t: 'esci' });
    if (!ev) return;
    azioni.push([frames.length, { t: 'esci' }]);
    view = templari.view(s);
    versoFine();
  };

  ctx.hud.toast('Entri nella chiesa…', 1500);
  void (async () => {
    try {
      await ctx.loader.extend('manifest_rpg.json'); // modelli delle armi (kit GDR)
      sc = createScena(s.arena);
      hero = await createHeroActor({ loader: ctx.loader, look: ctx.world.look, hero: { arma: armaVista(view.eroe.arma) }, scene: sc.scene, floorY: 0, x: view.eroe.x, z: view.eroe.z, mirino: true });
      zombi = createZombi(sc.scene);
      fx = createEffetti({ scene: sc.scene, arena: s.arena, loader: ctx.loader, root: ctx.root, canvas: ctx.canvas, camera: ctx.renderer.camera });
      if ((fase as Fase) === 'finita') { pulisci(); return; }
      hud = createTplHud(ctx.root, (id) => armaDef(id).nome, (id) => armaDef(id).tipo !== 'mischia');
      ctl = createControlli({ root: ctx.root, canvas: ctx.canvas, onEsci: esci });
      hero.tick(view.posa); zombi.tick(view); fx.tick(view);
      sc.setPorte(s.porte); sc.setCalice(s.fase !== 'altare');
      ctx.renderer.setScene(sc.scene);
      ctx.renderer.diorama.setZoom(innerWidth < innerHeight ? 1.3 : 1.05); // al telefono in verticale un po' più largo: si vedono le finestre
      ctx.renderer.diorama.follow(view.eroe.x, 0.9, view.eroe.z); ctx.renderer.diorama.snap?.();
      hud.grande('✠', PAL.rosso, o.subito ? 'Le ondate stanno per cominciare' : 'Porta il calice sull’altare (AZIONE)', 2600);
      fase = 'gioca';
    } catch (e) {
      console.error('[marea] templari non caricata', e);
      ctx.hud.toast('La chiesa non si è caricata, riprova', 3000);
      abort();
    }
  })();

  /** Volume di un verso con la distanza dall'eroe (1 vicino … 0 oltre ~22 m). */
  const vicino = (x: number, z: number) => Math.max(0, 1 - Math.sqrt((x - s.eroe.x) * (x - s.eroe.x) + (z - s.eroe.z) * (z - s.eroe.z)) / 22);
  const evento = (e: TEvento) => {
    if (!hud || !zombi || !hero) return;
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
      case 'scudo': suona('raccolto'); hud.grande('SCUDO', PAL.sabbiaChiara, 'Sulle spalle para da dietro · SCAMBIA per impugnarlo', 2400); break;
      case 'scudoRotto': suona('colpo_critico'); hud.grande('', PAL.rosso, 'Lo scudo si è spaccato', 1600); break;
      case 'compra': suona('moneta'); break;
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

  /** L'input di adesso: autopilota (test), o tastiera/joystick + bottoni del chunk + AUTO. */
  function inputOra(f: InputFrame): DungeonInput {
    const c = ctl!.sample();
    if (auto) return templari.autopilot(s, auto);
    const a = f.a || c.a;
    let mx = f.mx, my = f.my;
    // da PC, fermo: guarda il puntatore (il punto del pavimento sotto il mouse)
    const m = ctl!.mouse;
    if (m && Math.abs(mx) < 0.05 && Math.abs(my) < 0.05) {
      const r = ctx.canvas.getBoundingClientRect();
      ray.setFromCamera(nd.set((m.x / r.width) * 2 - 1, -(m.y / r.height) * 2 + 1), ctx.renderer.camera);
      if (ray.ray.intersectPlane(suolo, hit)) {
        const dx = hit.x - s.eroe.x, dz = hit.z - s.eroe.z, d = Math.sqrt(dx * dx + dz * dz);
        if (d > 0.6) { mx = (dx / d) * 0.25; my = (dz / d) * 0.25; }
      }
    }
    return { mx, my, a, b: f.b, c: c.c, d: c.d };
  }
  // passi sul suolo sotto i piedi (ogni ~1 m, 1,5 m di corsa) e la tensione della musica (boss in campo, tanti zombie vicini)
  let px = NaN, pz = NaN, strada = 0;
  function tickUno(f: InputFrame): void {
    const q = quantizeDungeon(inputOra(f));
    frames.push(q); stepTemplari(s, q);
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

  const ray = new THREE.Raycaster(), nd = new THREE.Vector2(), suolo = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.9), hit = new THREE.Vector3();
  const run: TemplariRun = {
    get active() { return fase !== 'finita'; },
    step(f) {
      if (fase === 'fine') { if (--wait <= 0 || (wait < FINE_TICK - 60 && f.a)) consegna(); return; }
      if (fase !== 'gioca' || !ctl || ctl.paused) return;
      if (templariLink.autopilot > 0 && !auto) auto = createRng(o.seed).fork('autopilot');
      if (templariLink.autopilot === 0) auto = null;
      const n = auto ? templariLink.autopilot : 1;
      for (let i = 0; i < n && !s.done; i++) tickUno(f);
      view = templari.view(s);
      if (view.eroe.arma !== armaOra) { armaOra = view.eroe.arma; void hero?.setArma(armaVista(armaOra)); }
      hero!.tick(view.posa); zombi!.tick(view); fx!.tick(view);
      // arco teso: la linea di mira verso chi prenderà la freccia
      const t0 = s.eroe.act === 'tende' ? miraTiro(s, armaDef(view.eroe.arma === 'scudo' ? 'spada' : view.eroe.arma).gittata ?? 20) : null;
      if (t0) { const dx = t0.x - s.eroe.x, dz = t0.z - s.eroe.z, d = Math.sqrt(dx * dx + dz * dz) || 1; hero!.mira({ x: dx / d, z: dz / d }); } else hero!.mira(null);
      if (s.done) versoFine();
    },
    update(alpha, dt, t) {
      if (!sc || !hero || !zombi || !hud || !ctl || fase === 'finita' || fase === 'carica') return;
      hero.update(alpha, dt);
      zombi.update(alpha, dt, t);
      fx?.update(alpha, dt, t, hero.avatar.object, view);
      const p = hero.avatar.object.position;
      ctx.renderer.diorama.follow(p.x, 0.9, p.z); ctx.renderer.diorama.update(dt);
      sc.update(p.x, p.z, t, s.assi, view.trappole);
      hud.set(view);
      ctl.setPrompt(fase === 'gioca' ? view.prompt : null);
      ctl.setScambia(fase === 'gioca' && view.eroe.armi.filter(Boolean).length + (view.eroe.scudo ? 1 : 0) > 1);
    },
    abort,
    done,
  };

  // test (hook templariProva): arma, scudo (in mano), punti, uno zombie davanti fermo, porte aperte, eroe spostato (`dove`), power-up davanti
  // o sotto i piedi, trappola accesa, campo pulito, vita; solo per guardare la resa, senza server
  templariLink.prova = (p) => {
    if (typeof p['arma'] === 'string') daiArma(s, p['arma']);
    if (p['scudo']) { s.eroe.scudo = { vita: TEMPLARI.scudo.vita }; s.eroe.inMano = p['scudo'] === 'mano'; }
    if (typeof p['punti'] === 'number') s.punti = p['punti'];
    if (typeof p['dove'] === 'object' && p['dove']) { const d = p['dove'] as { x: number; z: number }; s.eroe.x = d.x; s.eroe.z = d.z; }
    if (Array.isArray(p['porte'])) for (const id of p['porte'] as string[]) { const q = s.arena.porte.find((x) => x.id === id); if (q && !s.porte[id]) { s.punti += TEMPLARI.porte[id]?.prezzo ?? 0; apriPorta(s, q); } }
    if (p['pulisci']) { s.zombie = []; s.tiri = []; s.fiamme = []; s.boss = null; }
    if (typeof p['vita'] === 'number') { s.eroe.vita = s.eroe.max = p['vita']; }
    if (typeof p['potere'] === 'string') s.drops.push({ id: s.nextId++, tipo: p['potere'] as 'ira', x: s.eroe.x + s.eroe.fx * 2.5, z: s.eroe.z + s.eroe.fz * 2.5, fine: s.tick + 60 * 25 });
    if (typeof p['potereQui'] === 'string') s.drops.push({ id: s.nextId++, tipo: p['potereQui'] as 'ira', x: s.eroe.x, z: s.eroe.z, fine: s.tick + 60 * 25 });
    if (typeof p['trappola'] === 'string') { const i = s.arena.trappole.findIndex((x) => x.id === p['trappola']); const st = s.trappole[i]; if (st) { st.fine = s.tick + 600; st.pronta = st.fine + 600; } }
    if (p['porte'] || p['dove']) sc?.setPorte(s.porte);
    if (typeof p['zombie'] === 'string') {
      const dist = typeof p['dist'] === 'number' ? p['dist'] : 2.2, lato = typeof p['lato'] === 'number' ? p['lato'] : 0;
      const z = nuovoZombie(s, p['zombie'], s.eroe.x + s.eroe.fx * dist - s.eroe.fz * lato, s.eroe.z + s.eroe.fz * dist + s.eroe.fx * lato, 0);
      z.st = 'insegue'; z.fx = -s.eroe.fx; z.fz = -s.eroe.fz;
    }
    view = templari.view(s);
    return { arma: view.eroe.arma, scudo: view.eroe.scudo, zombie: view.zombie.length };
  };
  const pos = new THREE.Vector3();
  templariLink.state = () => ({
    active: fase !== 'finita', fase, sim: view.fase, tick: view.tick, ondata: view.ondata, restano: view.restano, done: view.done, esito: view.esito,
    eroe: { x: view.eroe.x, z: view.eroe.z, vita: view.eroe.vita, punti: view.eroe.punti, arma: view.eroe.arma }, zombie: view.zombie.length,
    uccisioni: view.uccisioni, assi: [...s.assi], prompt: view.prompt?.cosa ?? null, frames: frames.length, auto: !!auto, pausa: !!ctl?.paused, mira: false, faccia: [s.eroe.fx, s.eroe.fz],
    scena: sc?.stats() ?? null, attori: zombi?.counts() ?? null, effetti: fx?.stats() ?? null, armi: view.eroe.armi, scudo: view.eroe.scudo, cassa: { fase: view.cassa.fase, arma: view.cassa.arma }, porte: { ...s.porte }, trappole: view.trappole, poteri: view.poteri, drops: view.drops.map((d) => d.tipo), camera: hero ? pos.copy(hero.avatar.object.position).toArray() : null,
    max: TEMPLARI.ondate.insieme,
  });
  return run;
}
