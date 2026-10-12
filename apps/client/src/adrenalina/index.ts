// Snowboard dell'Isola dell'Adrenalina, la discesa nel client (docs/ADRENALINA.md §7, passo 3a; CONTRACTS §42). Chunk scaricato dalla
// funivia (game/adrenalina_funivia.ts) quando sali con ?adrenalina=1: la scena a parte (la montagna vista da vicino, `pista3d.ts`), la
// tavola, la camera che ti segue come nei video di freeride (`regia.ts`, la A scelta da birbasan), la neve che vola (`neve.ts`), i comandi (`comandi.ts`), l'HUD (`hud.ts`). La sim è `@marea/sim/minigames/snowboard.ts`, la stessa
// che il server rigiocherà al 3b (medaglie e premio): qui si gioca senza server, a fine discesa la scheda coi punti, ANCORA o ESCI.
// Giro: 3-2-1 (la sim ferma), la discesa (un tick della sim per tick del gioco), l'arrivo. Il mondo intanto sta fermo (main.ts: adr.active).
import * as THREE from 'three';
import type { InputFrame } from '@marea/sim';
import { quantize } from '@marea/sim';
import type { Look } from '@marea/protocol';
import { BARRA, SNOWBOARD } from '@marea/content/adrenalina.ts';
import { pilotaSnowboard, snowboard, TRICKS } from '@marea/sim/minigames/snowboard.ts';
import type { SnowState, SnowView } from '@marea/sim/minigames/snowboard.ts';
import { bordoA, fuoripistaA, pistaSnowboard } from '@marea/sim/adrenalina/pista.ts';
import { nuovaTerna, punto, terna } from '@marea/sim/corse/nastro.ts';
import type { Renderer } from '../render/scene.ts';
import { createLights } from '../render/light.ts';
import { pixelTexture } from '../render/loader.ts';
import { PAL } from '../ui/style.ts';
import { registerStateProvider, registerTestHook } from '../test/testapi.ts';
import { creaComandi } from './comandi.ts';
import { creaHud } from './hud.ts';
import { creaPista3d } from './pista3d.ts';
import { creaRegia } from './regia.ts';
import { creaNeve } from './neve.ts';
import { creaTavola } from './tavola3d.ts';

export type SnowCtx = { renderer: Renderer; root: HTMLElement; look(): Look };
export type SnowRun = {
  readonly active: boolean;
  step(f: InputFrame): void;
  update(alpha: number, dt: number, t: number): void;
  /** Via subito (Esc, errori): `done` risolve. */
  esci(): void;
  /** Risolve quando si esce, col risultato dell'ultima discesa finita (null = nessuna). */
  readonly done: Promise<ReturnType<typeof snowboard.result> | null>;
};

const VIA_S = 2.4, AIUTO_S = 7;
/** Oltre questa distanza (m) gli abeti si spengono (il terreno resta: da lassù si vede fino in valle). */
const NEBBIA = 420;
const NOMI_CADUTA: Record<string, string> = { abete: 'CONTRO L’ABETE!', roccia: 'CONTRO LA ROCCIA!', bosco: 'NEL BOSCO!', storto: 'ATTERRAGGIO STORTO!', presa: 'ANCORA IN PRESA!', tronco: 'CONTRO IL TRONCO!', botta: 'ATTERRAGGIO TROPPO DURO!' };
/** Per i test: la discesa aperta adesso. */
let corrente: { stato(): Record<string, unknown>; auto(n: number): number; metti(o: Record<string, unknown>): unknown; esci(): void } | null = null;
registerStateProvider('snowboard', () => (corrente ? corrente.stato() : { active: false }));
registerTestHook('snowboardAuto', (n) => corrente?.auto(Number(n ?? 1)) ?? null);
registerTestHook('snowboardMetti', (o) => (corrente && o && typeof o === 'object' ? corrente.metti(o as Record<string, unknown>) : null));
registerTestHook('snowboardEsci', () => { corrente?.esci(); return true; });

/** Cielo di montagna a tre bande piatte (ART_BIBLE §7): azzurro, azzurro chiaro, foschia all'orizzonte. */
function cielo(): THREE.Texture {
  const c = document.createElement('canvas'); c.width = 1; c.height = 32;
  const g = c.getContext('2d')!;
  for (const [col, y0, y1] of [[PAL.acqua, 0, 12], [PAL.acquaBassa, 12, 22], [PAL.pietraChiara, 22, 32]] as const) { g.fillStyle = col; g.fillRect(0, y0, 1, y1 - y0); }
  return pixelTexture(new THREE.CanvasTexture(c));
}

export function startSnowboard(ctx: SnowCtx, o: { pista?: string; seed?: number } = {}): SnowRun {
  const pista = o.pista ?? 'snowboard_verde', p = pistaSnowboard(pista);
  const cam0 = ctx.renderer.camera, salva = { fov: cam0.fov, near: cam0.near, far: cam0.far };
  const dito = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;

  // ---- la scena ----
  const scene = new THREE.Scene(); scene.name = 'snowboard';
  scene.userData.near = 0.5;
  const sfondo = cielo(); scene.background = sfondo;
  scene.fog = new THREE.Fog(PAL.pietraChiara, 350, 5200); // aria di montagna: limpida vicino, sempre più chiara lontano (la valle, le cime)
  const luci = createLights(), luciSu = new THREE.Group(); luciSu.add(luci.group); scene.add(luciSu);
  // luce di montagna: sole bianco e alto, cielo freddo nelle ombre (la neve resta neve, non rosa)
  luci.set?.({ elev: 48, azim: 200, color: 0xfff6e8, intensity: 2.4, sky: 0xdff4ff, ground: 0xc8d4e0, hemiI: 2.5, amb: 0x7fe3e0, ambI: 0.15 });
  const pista3d = creaPista3d(p); scene.add(pista3d.gruppo);
  const tavola = creaTavola(ctx.look()); scene.add(tavola.gruppo);
  ctx.renderer.setScene(scene);
  cam0.far = 7000; cam0.near = 0.5; cam0.updateProjectionMatrix();

  const hud = creaHud(ctx.root, dito, BARRA.soglie);
  const comandi = creaComandi(hud.zona);
  const regia = creaRegia(cam0, p);
  const neve = creaNeve(); scene.add(neve.gruppo);

  let s: SnowState = snowboard.create({ seed: o.seed ?? 1, difficulty: 1, opzioni: { pista } });
  let prima = { s: s.s, lat: s.lat, y: s.y }, fase: 'via' | 'gara' | 'fine' | 'chiuso' = 'via', viaT = 0, gara = 0, visto = 0, auto = 0, cadutoA = 0;
  let ultimo: ReturnType<typeof snowboard.result> | null = null, frames: InputFrame[] = [], scatto = true, discese = 0, nuvolaA = false;
  let fine!: (r: ReturnType<typeof snowboard.result> | null) => void;
  const done = new Promise<ReturnType<typeof snowboard.result> | null>((r) => { fine = r; });

  const ricomincia = () => {
    s = snowboard.create({ seed: o.seed ?? 1, difficulty: 1, opzioni: { pista } });
    prima = { s: s.s, lat: s.lat, y: s.y }; fase = 'via'; viaT = 0; gara = 0; visto = 0; frames = []; scatto = true;
    hud.fine(null); hud.aiuto(true);
    pista3d.tronco?.cade(0); neve.pulisci();
  };
  const chiudi = () => {
    if (fase === 'chiuso') return;
    fase = 'chiuso';
    comandi.dispose(); hud.dispose();
    ctx.renderer.setScene(null);
    cam0.fov = salva.fov; cam0.near = salva.near; cam0.far = salva.far; cam0.updateProjectionMatrix();
    scene.remove(pista3d.gruppo); pista3d.dispose(); tavola.dispose(); neve.dispose(); sfondo.dispose();
    corrente = null;
    fine(ultimo);
  };
  hud.onEsci = chiudi;
  hud.onAncora = ricomincia;
  const tasti = (e: KeyboardEvent) => {
    if (fase === 'chiuso') { removeEventListener('keydown', tasti); return; }
    if (e.code === 'Escape') chiudi();
    else if (fase === 'fine' && (e.code === 'Enter' || e.code === 'Space') && !e.repeat) ricomincia();
  };
  addEventListener('keydown', tasti);
  hud.aiuto(true);

  /** Le novità della sim (eventi dopo l'ultimo letto) diventano scritte grandi. */
  const leggiEventi = () => {
    for (const e of s.eventi) {
      if (e.t <= visto) continue;
      if (e.k === 'porta') hud.pop(`PORTA +${e.n}`, PAL.erbaChiara);
      else if (e.k === 'mancata') hud.pop(`PORTA MANCATA ${e.n}`, PAL.rosso);
      else if (e.k === 'trick') hud.pop(`${e.x!.toUpperCase()} +${e.n}`, PAL.giallo);
      else if (e.k === 'presa') hud.pop(`PRESA +${e.n}`, PAL.giallo);
      else if (e.k === 'atterra') { nuvolaA = true; hud.pop(`ATTERRATO +${e.n}${e.x ? ' ' + e.x : ''}`, PAL.arancio); }
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
    if (s.done) {
      fase = 'fine'; ultimo = snowboard.result(s); discese++;
      const d = ultimo.detail;
      hud.fine({ punti: ultimo.score, ms: d['ms']!, porte: d['porte']!, porteTot: p.def.porte.length, trick: d['trick']!, combo: d['combo']!, cadute: d['cadute']!, arrivato: !!d['arrivato'] });
    }
  };

  // ---- resa ----
  const T = nuovaTerna(), P3: [number, number, number] = [0, 0, 0];
  const pos = new THREE.Vector3(), avanti = new THREE.Vector3(), destra = new THREE.Vector3(), su = new THREE.Vector3(), fwd = new THREE.Vector3(), x = new THREE.Vector3(), base = new THREE.Matrix4();
  const fh = new THREE.Vector3(), rh = new THREE.Vector3(), coda = new THREE.Vector3();
  const bordo = (q: number) => bordoA(p, q) + (fuoripistaA(p, q) ? -10 : 0); // nel fuoripista tutta neve fresca
  const tronco = p.def.fuoripista;
  function rendi(alpha: number, dt: number, t: number): void {
    const ss = prima.s + (s.s - prima.s) * alpha, lat = prima.lat + (s.lat - prima.lat) * alpha, y = prima.y + (s.y - prima.y) * alpha;
    punto(p.n, ss, lat, 0, P3); terna(p.n, ss, T);
    pos.set(P3[0], y, P3[2]);
    // la tavola guarda dove va: la pista più la velocità di lato
    avanti.set(T.tx, T.ty, T.tz).normalize(); destra.set(T.rx, T.ry, T.rz).normalize(); su.set(T.ux, T.uy, T.uz).normalize();
    const v = s.v > 1 ? s.v : 1;
    fwd.copy(avanti).multiplyScalar(v).addScaledVector(destra, s.vl).normalize();
    if (s.aria) fwd.y *= 0.5;
    x.crossVectors(su, fwd).normalize(); su.crossVectors(fwd, x).normalize();
    base.makeBasis(x, su, fwd).setPosition(pos);
    tavola.gruppo.position.copy(pos); tavola.gruppo.quaternion.setFromRotationMatrix(base);
    const tr = s.trick >= 0 ? SNOWBOARD.trick[TRICKS[s.trick]!] : null;
    tavola.posa({
      carica: s.aria ? 0 : s.carica, piega: s.aria ? 0 : Math.max(-0.5, Math.min(0.5, (s.vl / v) * 1.4)), trick: s.trick, k: tr ? Math.min(1, s.trickT / tr.durata) : 0,
      presa: s.presa, caduta: s.caduta > 0 ? 1 - s.caduta / SNOWBOARD.caduta : null, aria: s.aria, t,
    });
    // camera: chi filma ti segue sul pendio
    regia.segui({ s: ss, lat, y, v: s.v, aria: s.aria }, dt, scatto); scatto = false;
    // la neve: polvere dalla coda (più in curva e nella neve fresca), la scia, la nuvola quando atterri o cadi
    fh.set(fwd.x, 0, fwd.z).normalize(); rh.set(-fh.z, 0, fh.x);
    coda.copy(pos).addScaledVector(fwd, -0.6);
    const fresca = Math.abs(s.lat) > bordo(ss) ? 0.5 : 0;
    neve.aggiorna({ coda, avanti: fh, destra: rh, v: s.v, spruzzo: Math.min(1, Math.abs(s.vl) / 5 + fresca + s.carica * 0.2), aTerra: !s.aria && s.caduta <= 0 }, dt);
    if (nuvolaA) { nuvolaA = false; neve.nuvola(pos, s.caduta > 0 ? 1 : 0.6); }
    pista3d.aggiorna(cam0.position, NEBBIA + 20);
    // il sole segue la tavola (anche in quota: il gruppo delle luci sale e scende con lei)
    luciSu.position.y = Math.round(pos.y); luci.follow?.(pos.x, pos.z);
    // l'abete che cade sulla pista chiusa quando arrivi al bivio
    if (tronco && pista3d.tronco) pista3d.tronco.cade((ss - (tronco.da - 70)) / 22);
    hud.aggiorna(snowboard.view(s) as SnowView, (gara * 1000) / 60);
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
      if (fase === 'via') {
        viaT += dt;
        const n = Math.ceil((VIA_S - viaT) / (VIA_S / 3));
        hud.via(viaT < VIA_S ? String(Math.max(1, n)) : 'VIA!');
        if (viaT >= VIA_S) fase = 'gara';
      } else if (viaT < VIA_S + 0.6) { viaT += dt; if (viaT >= VIA_S + 0.6) hud.via(null); }
      if (fase === 'gara' && gara / 60 > AIUTO_S) hud.aiuto(false);
      rendi(fase === 'gara' ? alpha : 1, dt, t);
    },
  };
  corrente = {
    stato: () => {
      const v = snowboard.view(s) as SnowView, st = ctx.renderer.stats();
      return {
        active: fase !== 'chiuso', fase, pista, auto, discese, frames: frames.length,
        s: +v.s.toFixed(1), lat: +v.lat.toFixed(2), v: +v.v.toFixed(1), aria: v.aria, h: +v.h.toFixed(2), punti: v.punti, barra: +v.barra.v.toFixed(2), molt: v.molt,
        porte: v.porte, mancate: v.mancate, cadute: v.cadute, trick: v.trickFatti, salti: v.salti, caduta: v.caduta > 0, ultimaCaduta: cadutoA,
        eventi: v.eventi.map((e) => e.k), done: v.done, arrivato: v.arrivato, risultato: ultimo, scena: pista3d.numeri(), drawCalls: st.drawCalls, triangoli: st.triangles,
        dito: comandi.dito,
      };
    },
    auto: (n) => { auto = Math.max(0, Math.min(30, Math.round(n) || 0)); return auto; },
    /** Solo prove: mette la tavola a `s` (e `lat`, `v`), salta il 3-2-1; `pausa` ferma la sim (per gli screenshot). */
    metti: (q) => {
      if (typeof q['s'] === 'number') {
        const at = q['s'] as number, l = typeof q['lat'] === 'number' ? (q['lat'] as number) : 0;
        s.s = at; s.lat = l; s.v = typeof q['v'] === 'number' ? (q['v'] as number) : 15; s.aria = false; s.vl = 0; s.caduta = 0; s.trick = -1; s.presa = false; s.vy = 0; s.h = 0;
        punto(p.n, at, l, 0, P3); s.y = P3[1];
        s.porta = p.def.porte.findIndex((g) => g.s > at); if (s.porta < 0) s.porta = p.def.porte.length;
        prima = { s: s.s, lat: s.lat, y: s.y }; scatto = true;
      }
      if (fase === 'via') { fase = 'gara'; viaT = VIA_S + 0.6; hud.via(null); }
      return { s: s.s, lat: s.lat };
    },
    esci: chiudi,
  };
  return run;
}
