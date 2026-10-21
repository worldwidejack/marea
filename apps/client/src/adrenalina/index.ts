// Snowboard dell'Isola dell'Adrenalina nel client (docs/ADRENALINA.md §7-§10, passi 3a e 3b; CONTRACTS §42). Chunk scaricato dalla funivia
// (game/adrenalina_funivia.ts). Il giro (3b, birbasan 12 ott 2026): il viaggio in funivia (`viaggio.ts`) → il cartello delle piste in vetta
// (`cartelli.ts`) → il cartello delle regole col fantasma da battere → 3-2-1 → la discesa (un tick della sim per tick del gioco) col fantasma
// del record (`fantasma.ts`) → il server rigioca e paga: medaglia dalla classifica a tempo → la scheda d'arrivo (ANCORA · IN VETTA · AL MOLO).
// Resa: la montagna (`pista3d.ts`), la tavola col tuo avatar vero (`tavola3d.ts`), la follow cam (`regia.ts`), la neve (`neve.ts`), i comandi
// (`comandi.ts`), l'HUD (`hud.ts`). Senza link personale si scende lo stesso, senza premio e senza fantasma. Il mondo intanto sta fermo.
import * as THREE from 'three';
import type { InputFrame, LotState, PackedInputs } from '@marea/sim';
import { packInputs, quantize } from '@marea/sim';
import type { Look } from '@marea/protocol';
import { AVATAR } from '@marea/content';
import { BARRA, SNOWBOARD } from '@marea/content/adrenalina.ts';
import { pilotaSnowboard, snowboard, tempiSnowboard, TRICKS } from '@marea/sim/minigames/snowboard.ts';
import type { SnowState, SnowView } from '@marea/sim/minigames/snowboard.ts';
import { bordoA, fuoripistaA, pistaSnowboard } from '@marea/sim/adrenalina/pista.ts';
import type { PistaNeve } from '@marea/sim/adrenalina/pista.ts';
import { nuovaTerna, punto, terna } from '@marea/sim/corse/nastro.ts';
import type { Renderer } from '../render/scene.ts';
import type { Loader } from '../render/loader.ts';
import type { Fantasma, SoloResult } from '../net/api.ts';
import { createAvatar } from '../game/avatar.ts';
import type { Avatar } from '../game/avatar.ts';
import { createLights } from '../render/light.ts';
import { pixelTexture } from '../render/loader.ts';
import { PAL } from '../ui/style.ts';
import { registerStateProvider, registerTestHook } from '../test/testapi.ts';
import { FLAGS } from '../flags.ts';
import { creaComandi } from './comandi.ts';
import { creaHud, tempo } from './hud.ts';
import { creaPista3d } from './pista3d.ts';
import { creaSfondo } from './sfondo.ts';
import { creaRegia } from './regia.ts';
import { creaNeve } from './neve.ts';
import { creaTavola } from './tavola3d.ts';
import type { Tavola } from './tavola3d.ts';
import { corsaFantasma } from './fantasma.ts';
import type { CorsaFantasma, PassoFantasma } from './fantasma.ts';
import { creaViaggio, VIAGGIO_S } from './viaggio.ts';
import { cartelloPiste, cartelloRegole, schedaArrivo } from './cartelli.ts';
import type { Arrivo } from './cartelli.ts';

/** Il server delle discese (null = senza link personale: niente premio, niente fantasma). */
export type SnowServer = { start(pista: string): Promise<{ seed: number }>; play(inputs: PackedInputs, pista: string): Promise<SoloResult>; fantasma(pista: string): Promise<Fantasma | null> };
export type SnowCtx = { renderer: Renderer; root: HTMLElement; look(): Look; loader: Loader | null; server: SnowServer | null; setLot(l: LotState): void; toast(t: string, ms?: number): void };
export type SnowRun = {
  readonly active: boolean;
  step(f: InputFrame): void;
  update(alpha: number, dt: number, t: number): void;
  /** Via subito (Esc, errori): `done` risolve. */
  esci(): void;
  /** Risolve quando si esce, col risultato dell'ultima discesa finita (null = nessuna). */
  readonly done: Promise<ReturnType<typeof snowboard.result> | null>;
};
type Fase = 'funivia' | 'cartello' | 'regole' | 'via' | 'gara' | 'invio' | 'fine' | 'chiuso';

const VIA_S = 2.4, AIUTO_S = 7;
/** Oltre questa distanza (m) gli abeti si spengono (il terreno resta: da lassù si vede fino in valle). */
const LONTANO = 420;
const NOMI_CADUTA: Record<string, string> = { abete: 'CONTRO L’ABETE!', roccia: 'CONTRO LA ROCCIA!', bosco: 'NEL BOSCO!', storto: 'ATTERRAGGIO STORTO!', presa: 'ANCORA IN PRESA!', tronco: 'CONTRO IL TRONCO!', botta: 'ATTERRAGGIO TROPPO DURO!' };
const CASCO = AVATAR.cappelli.findIndex((h) => h.id === 'casco');
const PANNELLI = ['mzSbPiste', 'mzSbRegole', 'mzSbFine'];
/** Per i test: la discesa aperta adesso. */
let corrente: { stato(): Record<string, unknown>; auto(n: number): number; metti(o: Record<string, unknown>): unknown; salta(): void; pista(id: string): boolean; fantasmaProva(): unknown; foto(k: number): string; esci(): void } | null = null;
registerStateProvider('snowboard', () => (corrente ? corrente.stato() : { active: false }));
registerTestHook('snowboardAuto', (n) => corrente?.auto(Number(n ?? 1)) ?? null);
registerTestHook('snowboardMetti', (o) => (corrente && o && typeof o === 'object' ? corrente.metti(o as Record<string, unknown>) : null));
registerTestHook('snowboardSalta', () => { corrente?.salta(); return !!corrente; });
registerTestHook('snowboardPista', (id) => corrente?.pista(String(id ?? 'snowboard_verde')) ?? false);
registerTestHook('snowboardFantasmaProva', () => corrente?.fantasmaProva() ?? null);
registerTestHook('snowboardEsci', () => { corrente?.esci(); return true; });
/** Prove: il modellino delle montagne da un lato (k = 0-5), per il dipinto. */
registerTestHook('snowboardFoto', (k) => corrente?.foto(Number(k ?? 0)) ?? null);

/** Cielo di montagna a tre bande piatte (ART_BIBLE §7): azzurro, azzurro chiaro, chiaro all'orizzonte. */
function cielo(): THREE.Texture {
  const c = document.createElement('canvas'); c.width = 1; c.height = 32;
  const g = c.getContext('2d')!;
  for (const [col, y0, y1] of [[PAL.acqua, 0, 12], [PAL.acquaBassa, 12, 22], [PAL.pietraChiara, 22, 32]] as const) { g.fillStyle = col; g.fillRect(0, y0, 1, y1 - y0); }
  return pixelTexture(new THREE.CanvasTexture(c));
}

const TERNA = nuovaTerna();
const V = { av: new THREE.Vector3(), de: new THREE.Vector3(), su: new THREE.Vector3(), fw: new THREE.Vector3(), x: new THREE.Vector3(), m: new THREE.Matrix4() };
/** Mette una tavola (tua o del fantasma) dove sta nella pista, orientata lungo la sua corsa, nella posa del frame. Torna il suo avanti. */
function piazza(p: PistaNeve, tav: Tavola, q: PassoFantasma, y: number, ss: number, lat: number, t: number, out: THREE.Vector3): THREE.Vector3 {
  const P3: [number, number, number] = [0, 0, 0];
  punto(p.n, ss, lat, 0, P3); terna(p.n, ss, TERNA);
  out.set(P3[0], y, P3[2]);
  V.av.set(TERNA.tx, TERNA.ty, TERNA.tz).normalize(); V.de.set(TERNA.rx, TERNA.ry, TERNA.rz).normalize(); V.su.set(TERNA.ux, TERNA.uy, TERNA.uz).normalize();
  const v = q.v > 1 ? q.v : 1;
  V.fw.copy(V.av).multiplyScalar(v).addScaledVector(V.de, q.vl).normalize();
  if (q.aria) V.fw.y *= 0.5;
  V.x.crossVectors(V.su, V.fw).normalize(); V.su.crossVectors(V.fw, V.x).normalize();
  V.m.makeBasis(V.x, V.su, V.fw).setPosition(out);
  tav.gruppo.position.copy(out); tav.gruppo.quaternion.setFromRotationMatrix(V.m);
  const tr = q.trick >= 0 ? SNOWBOARD.trick[TRICKS[q.trick]!] : null;
  tav.posa({
    carica: q.aria ? 0 : q.carica, piega: q.aria ? 0 : Math.max(-0.5, Math.min(0.5, (q.vl / v) * 1.4)), trick: q.trick, k: tr ? Math.min(1, q.trickT / tr.durata) : 0,
    presa: q.presa, caduta: q.caduta > 0 ? 1 - q.caduta / SNOWBOARD.caduta : null, aria: q.aria, t,
  });
  return V.fw;
}

export function startSnowboard(ctx: SnowCtx, o: { pista?: string } = {}): SnowRun {
  let pista = o.pista ?? 'snowboard_verde', p = pistaSnowboard(pista);
  const cam0 = ctx.renderer.camera, salva = { fov: cam0.fov, near: cam0.near, far: cam0.far };
  const dito = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;

  // ---- la scena ----
  const scene = new THREE.Scene(); scene.name = 'snowboard';
  scene.userData.near = 0.5;
  const sfondo = cielo(); scene.background = sfondo;
  const luci = createLights(), luciSu = new THREE.Group(); luciSu.add(luci.group); scene.add(luciSu);
  // luce di montagna: sole bianco e alto, cielo freddo nelle ombre (la neve resta neve, non rosa)
  luci.set?.({ elev: 48, azim: 200, color: 0xfffaf2, intensity: 2.5, sky: 0xd6e8ff, ground: 0xb4c6e2, hemiI: 2.8, amb: 0x9fc4ff, ambI: 0.2 });
  const pista3d = creaPista3d(p); scene.add(pista3d.gruppo);
  const monti = creaSfondo(p); scene.add(monti.gruppo);
  if (FLAGS.dipinto !== 'no') void monti.dipinto(scene, dito); // le Alpi dipinte (?dipinto=0 il modellino a blocchi)
  const look = { ...ctx.look(), ...(CASCO >= 0 ? { cappello: CASCO } : {}) }; // sulla pista si scende col casco
  const tavola = creaTavola(look); scene.add(tavola.gruppo);
  const viaggio = creaViaggio(p); scene.add(viaggio.gruppo);
  ctx.renderer.setScene(scene);
  cam0.far = 16000; cam0.near = 0.5; cam0.updateProjectionMatrix();

  const hud = creaHud(ctx.root, dito, BARRA.soglie);
  const comandi = creaComandi(hud.zona);
  const regia = creaRegia(cam0, p);
  const neve = creaNeve(); scene.add(neve.gruppo);
  // il fantasma: la tavola semitrasparente coi colori di chi ha il record, col nome sopra
  let fantasma: Fantasma | null = null, corsaF: CorsaFantasma | null = null, tavF: Tavola | null = null;
  const tag = document.createElement('div'); tag.id = 'mzSbFantTag';
  tag.style.cssText = `position:absolute;left:0;top:0;transform:translate(-50%,-100%);padding:1px 6px;background:rgba(46,30,20,.82);border:2px solid ${PAL.acquaBassa};color:${PAL.sabbiaChiara};font:bold 11px ui-monospace,Menlo,monospace;white-space:nowrap;pointer-events:none;z-index:14;display:none`;
  ctx.root.append(tag);
  const usaFantasma = (f: Fantasma | null) => {
    fantasma = f; corsaF = f ? corsaFantasma(f) : null;
    if (tavF) { scene.remove(tavF.gruppo); tavF.dispose(); tavF = null; }
    if (f) { tavF = creaTavola({ ...(f.look ?? look), cappello: CASCO >= 0 ? CASCO : 0 }, { fantasma: true }); scene.add(tavF.gruppo); tag.textContent = `👻 ${f.nome} ${tempo(f.ms)}`; }
  };

  let s: SnowState = snowboard.create({ seed: 1, difficulty: 1, opzioni: { pista } });
  let prima = { s: s.s, lat: s.lat, y: s.y }, fase: Fase = 'funivia', faseT = 0, gara = 0, visto = 0, auto = 0, cadutoA = 0;
  let ultimo: ReturnType<typeof snowboard.result> | null = null, frames: InputFrame[] = [], scatto = true, discese = 0, nuvolaA = false, conServer = false;
  let esito: Arrivo | null = null, errore: string | null = null, avatar: Avatar | null = null;
  let fine!: (r: ReturnType<typeof snowboard.result> | null) => void;
  const done = new Promise<ReturnType<typeof snowboard.result> | null>((r) => { fine = r; });
  // il tuo avatar vero sulla tavola (finché non è pronto c'è l'omino a box)
  if (ctx.loader) void createAvatar({ loader: ctx.loader, look, x: 0, z: 0 }).then((a) => { if (fase === 'chiuso') return; avatar = a; tavola.monta(a.object); }).catch((e) => console.warn('[snowboard] avatar non caricato, resta l’omino', e));

  const nuovaDiscesa = (seed: number) => {
    s = snowboard.create({ seed, difficulty: 1, opzioni: { pista } });
    prima = { s: s.s, lat: s.lat, y: s.y }; gara = 0; visto = 0; frames = []; scatto = true;
    pista3d.tronco?.cade(0); neve.pulisci();
  };
  /** In vetta davanti al cartello delle piste. */
  const inVetta = () => {
    fase = 'cartello'; faseT = 0; nuovaDiscesa(1); hud.aiuto(false); scatto = true;
    void cartelloPiste(ctx.root, { record: fantasma ? { nome: fantasma.nome, ms: fantasma.ms } : null, mio: null }).then((id) => { if (fase !== 'cartello') return; if (id) void scegli(id); else chiudi(); });
  };
  /** Pista scelta: la partita sul server (seed), il fantasma del record, il cartello delle regole, poi il 3-2-1. */
  async function scegli(id: string): Promise<void> {
    document.getElementById('mzSbPiste')?.remove();
    pista = id; p = pistaSnowboard(id); fase = 'regole'; faseT = 0; errore = null; conServer = false;
    let seed = 1;
    if (ctx.server) {
      const [st, fa] = await Promise.allSettled([ctx.server.start(pista), ctx.server.fantasma(pista)]);
      if (st.status === 'fulfilled') { seed = st.value.seed; conServer = true; } else ctx.toast('Niente connessione col server: si scende senza premio', 3200);
      if (fa.status === 'fulfilled') usaFantasma(fa.value);
    }
    if (fase !== 'regole') return;
    nuovaDiscesa(seed);
    await cartelloRegole(ctx.root, fantasma ? { nome: fantasma.nome, ms: fantasma.ms } : null, conServer);
    if (fase !== 'regole') return;
    fase = 'via'; faseT = 0; hud.aiuto(true);
  }
  /** La discesa è finita: il server la rigioca e paga, poi la scheda d'arrivo. */
  async function arrivo(): Promise<void> {
    fase = 'invio';
    ultimo = snowboard.result(s); discese++;
    const t = tempiSnowboard(s), rec = fantasma ? { nome: fantasma.nome, ms: fantasma.ms } : null;
    const a: Arrivo = { arrivato: s.arrivato, ms: t.ms, abbuono: t.abbuono, penalita: t.penalita, finale: s.arrivato ? t.finale : 0, medal: null, posizione: null, classificati: null, record: rec, nuovoRecord: false, premio: null, nota: null };
    if (conServer && ctx.server) {
      try {
        const r = await ctx.server.play(packInputs(frames), pista);
        ctx.setLot(r.lot);
        a.medal = r.medal; a.posizione = r.posizione || null; a.classificati = r.classificati ?? null; a.nuovoRecord = !!r.discesa?.record;
        a.premio = r.premio > 0 ? `Premio: +${r.premio} monete` : null;
        if (!r.premiata) a.nota = 'Partite premiate di oggi finite: questa vale per la classifica';
      } catch (e) {
        errore = String((e as Error)?.message ?? e);
        a.nota = 'Il server non ha risposto: la discesa non è stata salvata';
      }
    } else a.nota = ctx.server ? 'Senza connessione: niente premio' : 'Senza il tuo link personale: niente premio né classifica';
    if (fase !== 'invio') return;
    esito = a; fase = 'fine';
    const scelta = await schedaArrivo(ctx.root, a);
    if (fase !== 'fine') return;
    if (scelta === 'ancora') await scegli(pista); else if (scelta === 'vetta') inVetta(); else chiudi();
  }
  const chiudi = () => {
    if (fase === 'chiuso') return;
    fase = 'chiuso';
    for (const id of PANNELLI) document.getElementById(id)?.remove();
    comandi.dispose(); hud.dispose(); tag.remove();
    ctx.renderer.setScene(null);
    cam0.fov = salva.fov; cam0.near = salva.near; cam0.far = salva.far; cam0.updateProjectionMatrix();
    avatar?.object.removeFromParent();
    scene.remove(pista3d.gruppo); pista3d.dispose(); tavola.dispose(); tavF?.dispose(); neve.dispose(); viaggio.dispose(); sfondo.dispose(); monti.dispose();
    corrente = null;
    fine(ultimo);
  };
  hud.onEsci = chiudi;
  const tasti = (e: KeyboardEvent) => { if (fase === 'chiuso') { removeEventListener('keydown', tasti); return; } if (e.code === 'Escape') chiudi(); };
  addEventListener('keydown', tasti);

  /** Le novità della sim (eventi dopo l'ultimo letto) diventano scritte grandi. */
  const leggiEventi = () => {
    for (const e of s.eventi) {
      if (e.t <= visto) continue;
      if (e.k === 'porta') hud.pop(`PORTA −${(e.n / SNOWBOARD.tempo.puntiAlSecondo).toFixed(1)} s`, PAL.erbaChiara);
      else if (e.k === 'mancata') hud.pop(`PORTA MANCATA +${SNOWBOARD.tempo.portaMancata} s`, PAL.rosso);
      else if (e.k === 'trick') hud.pop(`${e.x!.toUpperCase()}`, PAL.giallo);
      else if (e.k === 'presa') hud.pop('PRESA', PAL.giallo);
      else if (e.k === 'atterra') { nuvolaA = true; hud.pop(`ATTERRATO −${(e.n / SNOWBOARD.tempo.puntiAlSecondo).toFixed(1)} s${e.x ? ' ' + e.x : ''}`, PAL.arancio); }
      else if (e.k === 'grande') hud.pop('SALTO GRANDE!', PAL.arancio);
      else if (e.k === 'rasente') hud.pop('RASENTE!', PAL.arancio);
      else if (e.k === 'caduta') { hud.pop(NOMI_CADUTA[e.x ?? ''] ?? 'CADUTO!', PAL.rosso); cadutoA = s.tick; nuvolaA = true; }
      else if (e.k === 'fuoripista') hud.pop('← FUORIPISTA!', PAL.arancio);
      else if (e.k === 'rientro') hud.pop('DI NUOVO IN PISTA', PAL.erbaChiara);
    }
    visto = s.tick;
  };
  const passo = (f: InputFrame) => {
    prima = { s: s.s, lat: s.lat, y: s.y };
    const q = quantize(f); frames.push(q);
    snowboard.step(s, q);
    gara++;
    leggiEventi();
    if (s.done) void arrivo();
  };

  // ---- resa ----
  const pos = new THREE.Vector3(), posF = new THREE.Vector3(), fh = new THREE.Vector3(), rh = new THREE.Vector3(), coda = new THREE.Vector3(), sc = new THREE.Vector3();
  const bordo = (q: number) => bordoA(p, q) + (fuoripistaA(p, q) ? -10 : 0); // nel fuoripista tutta neve fresca
  function rendi(alpha: number, dt: number, t: number): void {
    const ss = prima.s + (s.s - prima.s) * alpha, lat = prima.lat + (s.lat - prima.lat) * alpha, y = prima.y + (s.y - prima.y) * alpha;
    avatar?.update(alpha, dt); // anima l'avatar (fermo, in piedi); dove sta e come si piega lo decide la tavola subito dopo
    const fw = piazza(p, tavola, s, y, ss, lat, t, pos);
    // il fantasma, allo stesso tick dalla partenza (prima del VIA fermo al via)
    if (tavF && corsaF) {
      const g = corsaF.a(fase === 'gara' || fase === 'invio' || fase === 'fine' ? gara : 0);
      piazza(p, tavF, g, g.y, g.s, g.lat, t, posF);
      tavF.gruppo.visible = fase !== 'funivia';
      sc.copy(posF); sc.y += 2.3; sc.project(cam0);
      const vis = tavF.gruppo.visible && sc.z < 1 && Math.abs(sc.x) < 1.1 && Math.abs(sc.y) < 1.1 && posF.distanceTo(cam0.position) < 160;
      tag.style.display = vis ? 'block' : 'none';
      if (vis) { const r = ctx.renderer.gl.domElement.getBoundingClientRect(); tag.style.left = `${((sc.x + 1) / 2) * r.width}px`; tag.style.top = `${((1 - sc.y) / 2) * r.height}px`; }
    } else tag.style.display = 'none';
    if (fase === 'funivia') viaggio.vai(Math.min(1, faseT / VIAGGIO_S), cam0, t);
    else { regia.segui({ s: ss, lat, y, v: s.v, aria: s.aria }, dt, scatto); scatto = false; }
    // la neve: polvere dalla coda (più in curva e nella neve fresca), la scia, la nuvola quando atterri o cadi
    fh.set(fw.x, 0, fw.z).normalize(); rh.set(-fh.z, 0, fh.x);
    coda.copy(pos).addScaledVector(fw, -0.6);
    const fresca = Math.abs(s.lat) > bordo(ss) ? 0.5 : 0;
    neve.aggiorna({ coda, avanti: fh, destra: rh, v: s.v, spruzzo: Math.min(1, Math.abs(s.vl) / 5 + fresca + s.carica * 0.2), aTerra: fase === 'gara' && !s.aria && s.caduta <= 0 }, dt);
    if (nuvolaA) { nuvolaA = false; neve.nuvola(pos, s.caduta > 0 ? 1 : 0.6); }
    pista3d.aggiorna(cam0.position, LONTANO + 20); monti.segui(cam0.position);
    luciSu.position.y = Math.round(pos.y); luci.follow?.(pos.x, pos.z); // il sole segue la tavola, anche in quota
    const fp = p.def.fuoripista;
    if (fp && pista3d.tronco) pista3d.tronco.cade((ss - (fp.da - 70)) / 22); // l'abete che cade sulla pista chiusa
    const d = corsaF && fase === 'gara' ? corsaF.distacco(s.s, gara) : null;
    hud.aggiorna(snowboard.view(s) as SnowView, (gara * 1000) / 60, d === null || !fantasma ? null : `👻 ${fantasma.nome} ${d > 0 ? '+' : '−'}${Math.abs(d).toFixed(1)} s`);
  }

  const run: SnowRun = {
    get active() { return fase !== 'chiuso'; },
    done,
    esci: chiudi,
    step(_f) {
      if (fase === 'gara') {
        if (auto > 0) { for (let i = 0; i < auto && fase === 'gara'; i++) passo(pilotaSnowboard(s)); }
        else passo(comandi.campione(s.aria));
      }
    },
    update(alpha, dt, t) {
      if (fase === 'chiuso') return;
      faseT += dt;
      if (fase === 'funivia' && faseT >= VIAGGIO_S) inVetta();
      if (fase === 'via') {
        const n = Math.ceil((VIA_S - faseT) / (VIA_S / 3));
        hud.via(faseT < VIA_S ? String(Math.max(1, n)) : 'VIA!');
        if (faseT >= VIA_S) { fase = 'gara'; faseT = 0; }
      } else if (fase === 'gara' && faseT > 0.6) hud.via(null);
      if (fase === 'gara' && gara / 60 > AIUTO_S) hud.aiuto(false);
      hud.gara(fase === 'via' || fase === 'gara' || fase === 'invio');
      rendi(fase === 'gara' ? alpha : 1, dt, t);
    },
  };
  corrente = {
    stato: () => {
      const v = snowboard.view(s) as SnowView, st = ctx.renderer.stats();
      return {
        active: fase !== 'chiuso', fase, pista, auto, discese, frames: frames.length, server: conServer, errore,
        fantasma: fantasma ? { nome: fantasma.nome, ms: fantasma.ms, ticks: corsaF?.ticks ?? 0 } : null, avatar: !!avatar, esito,
        s: +v.s.toFixed(1), lat: +v.lat.toFixed(2), v: +v.v.toFixed(1), aria: v.aria, h: +v.h.toFixed(2), punti: v.punti, barra: +v.barra.v.toFixed(2), molt: v.molt,
        porte: v.porte, mancate: v.mancate, cadute: v.cadute, trick: v.trickFatti, salti: v.salti, caduta: v.caduta > 0, ultimaCaduta: cadutoA,
        eventi: v.eventi.map((e) => e.k), done: v.done, arrivato: v.arrivato, risultato: ultimo, scena: pista3d.numeri(), drawCalls: st.drawCalls, triangoli: st.triangles,
        dito: comandi.dito,
      };
    },
    auto: (n) => { auto = Math.max(0, Math.min(30, Math.round(n) || 0)); return auto; },
    salta: () => { if (fase === 'funivia') inVetta(); },
    pista: (id) => { if (fase !== 'cartello') return false; void scegli(id); return true; },
    /** Solo prove: un fantasma fatto dal pilota automatico (per vederlo senza server). */
    fantasmaProva: () => {
      const g = snowboard.create({ seed: 1, difficulty: 1, opzioni: { pista } }), log: InputFrame[] = [];
      while (!g.done) { const f = quantize(pilotaSnowboard(g, true)); log.push(f); snowboard.step(g, f); }
      usaFantasma({ chi: 'prova', nome: 'Maestro', ms: tempiSnowboard(g).finale, seed: 1, opzioni: { pista }, inputs: packInputs(log), look: null });
      return { ms: tempiSnowboard(g).finale };
    },
    foto: (k) => monti.foto(ctx.renderer.gl, k),
    /** Solo prove: mette la tavola a `s` (e `lat`, `v`), salta funivia, cartelli e 3-2-1 (la discesa così non vale per il server). */
    metti: (q) => {
      for (const id of PANNELLI) document.getElementById(id)?.remove();
      if (typeof q['s'] === 'number') {
        const at = q['s'] as number, l = typeof q['lat'] === 'number' ? (q['lat'] as number) : 0;
        s.s = at; s.lat = l; s.v = typeof q['v'] === 'number' ? (q['v'] as number) : 15; s.aria = false; s.vl = 0; s.caduta = 0; s.trick = -1; s.presa = false; s.vy = 0; s.h = 0; s.done = false;
        const P3: [number, number, number] = [0, 0, 0];
        punto(p.n, at, l, 0, P3); s.y = P3[1];
        s.porta = p.def.porte.findIndex((g) => g.s > at); if (s.porta < 0) s.porta = p.def.porte.length;
        prima = { s: s.s, lat: s.lat, y: s.y }; scatto = true;
      }
      if (fase !== 'gara') { fase = 'gara'; faseT = 1; hud.via(null); conServer = false; }
      return { s: s.s, lat: s.lat };
    },
    esci: chiudi,
  };
  return run;
}
