// Partita a ondate dei Templari lato client (docs/TEMPLARI.md, CONTRACTS «Templari»): entry del chunk, scaricato entrando nella chiesa.
// Prende il controllo del ciclo come il dungeon: scena dell'arena, eroe (l'avatar con l'arma in pugno, rpg/dungeon_hero.ts), zombie, HUD e
// controlli; a ogni tick registra UN input (joystick e B da main.ts, A = attacca anche col clic o da solo con AUTO, C = SCAMBIA, D = AZIONE)
// quantizzato come lo rigioca il server. Pausa = nessun tick. Fine: scritta grande, poi consegna (input compressi, azioni, hash).
// AUTO (di serie): quando c'è uno zombie a portata e l'eroe è libero, la A la preme il client (resta negli input: il server la rigioca uguale).
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
import { aPortata } from '@marea/sim/templari/eroe.ts';
import type { TAzioni, TEvento, TView } from '@marea/sim/templari/types.ts';
import { createHeroActor } from '../rpg/dungeon_hero.ts';
import type { ArmaInMano, HeroActor } from '../rpg/dungeon_hero.ts';
import { suona } from '../audio/ponte.ts';
import { PAL } from '../ui/style.ts';
import { templariLink } from '../game/templari.ts';
import { createScena } from './scena.ts';
import type { Scena } from './scena.ts';
import { createZombi } from './zombi.ts';
import type { Zombi } from './zombi.ts';
import { createTplHud } from './hud.ts';
import type { TplHud } from './hud.ts';
import { createControlli } from './controlli.ts';
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

/** L'arma della sim come la vuole l'attore dell'eroe (modello del kit, colore della lama, portata per la scia). */
function armaVista(id: string): ArmaInMano {
  const a = armaDef(id), base = pugni();
  return { ...base, id: null, kind: a.tipo === 'arco' ? 'arco' : 'mischia', danno: a.danno, tempo: a.tempo, portata: a.portata ?? base.portata, ...(a.aspetto.modello ? { modello: a.aspetto.modello } : {}), colore: a.aspetto.colore };
}

export function startTemplari(ctx: TemplariCtx, o: { seed: number; subito: boolean }): TemplariRun {
  const s: TState = templari.create({ seed: o.seed, opzioni: o.subito ? { subito: true } : {} });
  const frames: DungeonInput[] = [], azioni: TAzioni = [];
  let fase: Fase = 'carica', wait = 0, view: TView = templari.view(s), auto: Rng | null = null, armaOra = view.eroe.arma;
  let sc: Scena | null = null, hero: HeroActor | null = null, zombi: Zombi | null = null, hud: TplHud | null = null, ctl: Controlli | null = null;
  let resolve!: (v: TemplariFine | null) => void;
  const done = new Promise<TemplariFine | null>((r) => (resolve = r));

  const pulisci = () => {
    fase = 'finita'; templariLink.state = null;
    ctl?.dispose(); hud?.dispose(); zombi?.dispose(); hero?.dispose(); sc?.dispose();
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
    suona('fine');
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
      hero = await createHeroActor({ loader: ctx.loader, look: ctx.world.look, hero: { arma: armaVista(view.eroe.arma) }, scene: sc.scene, floorY: 0, x: view.eroe.x, z: view.eroe.z });
      zombi = createZombi(sc.scene);
      if ((fase as Fase) === 'finita') { pulisci(); return; }
      hud = createTplHud(ctx.root, (id) => armaDef(id).nome);
      ctl = createControlli({ root: ctx.root, canvas: ctx.canvas, onEsci: esci });
      hero.tick(view.posa); zombi.tick(view);
      ctx.renderer.setScene(sc.scene);
      ctx.renderer.diorama.setZoom(innerWidth < innerHeight ? 1.3 : 1.05); // al telefono in verticale un po' più largo: si vedono le finestre
      ctx.renderer.diorama.follow(view.eroe.x, 0.9, view.eroe.z); ctx.renderer.diorama.snap?.();
      hud.grande('✠', PAL.rosso, o.subito ? 'Le ondate stanno per cominciare' : 'Porta la reliquia sull’altare (AZIONE)', 2600);
      fase = 'gioca';
    } catch (e) {
      console.error('[marea] templari non caricata', e);
      ctx.hud.toast('La chiesa non si è caricata, riprova', 3000);
      abort();
    }
  })();

  const evento = (e: TEvento) => {
    if (!hud || !zombi || !hero) return;
    switch (e.t) {
      case 'colpo': zombi.colpito(e.id); suona(e.uccide ? 'nemico_ko' : 'colpo_dato'); break;
      case 'ferito': hero.flash(); suona('colpo_preso'); break;
      case 'punti': hud.punti(e.n); break;
      case 'ondata': hud.grande(String(e.n), PAL.rosso, e.n === 1 ? 'I Templari si svegliano' : 'Arrivano', 2400); suona('via'); break;
      case 'ondataFinita': hud.grande(`ONDATA ${e.n}`, PAL.giallo, 'superata', 2200); suona('medaglia_bronzo'); break;
      case 'reliquia': hud.grande('LA RELIQUIA', PAL.giallo, 'La terra trema. Qualcosa si muove sotto il sagrato.', 3200); suona('altare'); break;
      case 'asse': if (e.da === 'eroe') suona('martello'); break;
      case 'mancato': suona('schivato'); break;
      default:
    }
  };

  /** L'input di adesso: autopilota (test), o tastiera/joystick + bottoni del chunk + AUTO. */
  function inputOra(f: InputFrame): DungeonInput {
    const c = ctl!.sample();
    if (auto) return templari.autopilot(s, auto);
    const a = f.a || c.a || (ctl!.auto && aPortata(s) && s.eroe.act === 'idle' && !s.eroe.prevA);
    return { mx: f.mx, my: f.my, a, b: f.b, c: c.c, d: c.d };
  }
  function tickUno(f: InputFrame): void {
    const q = quantizeDungeon(inputOra(f));
    frames.push(q); stepTemplari(s, q);
    for (const e of s.eventi) evento(e);
  }

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
      hero!.tick(view.posa); zombi!.tick(view);
      if (s.done) versoFine();
    },
    update(alpha, dt, t) {
      if (!sc || !hero || !zombi || !hud || !ctl || fase === 'finita' || fase === 'carica') return;
      hero.update(alpha, dt);
      zombi.update(alpha, dt, t);
      const p = hero.avatar.object.position;
      ctx.renderer.diorama.follow(p.x, 0.9, p.z); ctx.renderer.diorama.update(dt);
      sc.update(p.x, p.z, t, s.assi);
      hud.set(view);
      ctl.setPrompt(fase === 'gioca' ? view.prompt : null);
      ctl.setScambia(fase === 'gioca' && view.eroe.armi.filter(Boolean).length > 1);
    },
    abort,
    done,
  };

  const pos = new THREE.Vector3();
  templariLink.state = () => ({
    active: fase !== 'finita', fase, sim: view.fase, tick: view.tick, ondata: view.ondata, restano: view.restano, done: view.done, esito: view.esito,
    eroe: { x: view.eroe.x, z: view.eroe.z, vita: view.eroe.vita, punti: view.eroe.punti, arma: view.eroe.arma }, zombie: view.zombie.length,
    uccisioni: view.uccisioni, assi: [...s.assi], prompt: view.prompt?.cosa ?? null, frames: frames.length, auto: !!auto, pausa: !!ctl?.paused, mira: ctl?.auto ?? true,
    scena: sc?.stats() ?? null, attori: zombi?.counts() ?? null, camera: hero ? pos.copy(hero.avatar.object.position).toArray() : null,
    max: TEMPLARI.ondate.insieme,
  });
  return run;
}
