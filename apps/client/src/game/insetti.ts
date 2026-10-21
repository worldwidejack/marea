// Gli insetti di Borgo Marea (#445, Database_Insetti_GameDesign.xlsx di Riccardo): l'attrezzo in mano (niente, pala, retino: bottone o
// tasto Q), i sassi da colpire con la pala, gli alberi da scuotere, gli insetti in giro (uguali per tutti nel turno, @marea/sim
// economy/insetti.ts) e quelli usciti da sassi e alberi (li estrae il server), il colpo di retino e il cartello «Hai preso…».
// Come si muovono: game/insetti_vita.ts; forme: render/insetti_forme.ts; disegni: ui/insetti_sprite.ts. Si carica col chunk del
// negozio dei mobili (game/negozio.ts) come la pala: il JS iniziale non cambia. Tutti gli insetti, i sassi e gli attrezzi in mano
// finiscono in una mesh rifatta a ogni frame (render/pennello.ts) più una per le lucciole che brillano: 2 draw call.
import * as THREE from 'three';
import { INSETTI, RETINO as RETINO_CFG } from '@marea/content/insetti.ts';
import type { InsettoDef } from '@marea/content/insetti.ts';
import type { LotState } from '@marea/sim';
import { ALBERI_BORGO, SASSI_BORGO, insettiOf, insettoDef, liberiDelTurno, notteAt, possiedeRetino, stagioneAt, turnoAt } from '@marea/sim/economy/insetti.ts';
import { possiedePala } from '@marea/sim/economy/pala.ts';
import { possiedeCanna } from '@marea/sim/economy/pesci.ts';
import type { GameWorld } from './world.ts';
import type { Hud } from '../ui/hud.ts';
import type { Api } from '../net/api.ts';
import { ApiError } from '../net/api.ts';
import { pennello } from '../render/pennello.ts';
import { FILO, FOGLIA_CADE, LUME, NIDO, OMBRA, PALA, RETINO, SASSO, SCHEGGIA_SASSO, TERRA_CLOD, formeInsetto } from '../render/insetti_forme.ts';
import { creaRetinoAnim } from './retino_anim.ts';
import { daAlbero, daSasso, nuovoAttore, prendibile, vive } from './insetti_vita.ts';
import type { Attore, Chi, Mondo } from './insetti_vita.ts';
import { insettoCanvas } from '../ui/insetti_sprite.ts';
import { PAL, el } from '../ui/style.ts';
import { suona } from '../audio/ponte.ts';
import { registerStateProvider, registerTestHook } from '../test/testapi.ts';

export type Attrezzo = 'nulla' | 'pala' | 'retino' | 'canna';
export type InsettiBorgo = {
  tick(a: boolean): boolean; update(dt: number): void;
  /** Cosa hai in mano (la pala scava solo se è in mano). */
  attrezzo(): Attrezzo;
  /** Vicino a un sasso o a un albero: il bottone della pala si fa da parte. */
  occupato(): boolean;
  /** Mette in mano l'attrezzo (appena comprato). */
  prendi(a: Attrezzo): void;
  /** Particelle di terra smosse dalla pala. */
  zolle(x: number, y: number, z: number, n?: number): void;
};
type Ctx = 'retino' | 'sasso' | 'albero' | null;

const MAX_V = 60000, MAX_V_LUCI = 3000;
const R_SASSO = 1.9, R_ALBERO = 2.2, CHIOMA = 2.6;
/** Quanto più grandi del vero (le forme sono già grandi): dalla camera diorama si devono vedere. */
const SCALA = 1.7;
/** Il retino: prende quello che sta entro PORTATA m davanti a te (±70°) o entro VICINO m tutto attorno; i volanti si prendono sull'ombra. */
const PORTATA = 1.7, VICINO = 0.8, CONO = 1.22, COLPO_S = 0.42;
const SALVA = 'mz-attrezzo';
const CSS = `
#mzInsettiBtn, #mzAttrezzoBtn { position: absolute; bottom: calc(max(14px, env(safe-area-inset-bottom)) + 16px); z-index: 16; display: none; align-items: center; gap: 6px; min-height: 44px; padding: 8px 14px; background: rgba(46,30,20,.94); border: 2px solid ${PAL.legnoChiaro}; color: ${PAL.sabbiaChiara}; font: bold 13px ui-monospace, Menlo, monospace; cursor: pointer; border-radius: 6px; box-shadow: 0 3px 0 ${PAL.neroCaldo}; }
#mzInsettiBtn { left: 50%; transform: translateX(-50%); } #mzInsettiBtn.on, #mzAttrezzoBtn.on { display: inline-flex; } #mzInsettiBtn b { color: ${PAL.giallo}; }
#mzAttrezzoBtn { right: 35px; bottom: calc(max(14px, env(safe-area-inset-bottom)) + 132px); min-width: 44px; padding: 6px 8px; flex-direction: column; gap: 0; font-size: 10px; } #mzAttrezzoBtn canvas { width: 24px; height: 24px; image-rendering: pixelated; }
@media (max-width: 699px) { #mzInsettiBtn { left: calc(50% + 21px); padding: 8px 10px; } #mzInsettiBtn .lungo { display: none; } }
#mzInsettoPreso { position: absolute; left: 50%; top: 30%; transform: translate(-50%, -50%) scale(.9); z-index: 26; display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 12px 18px; background: rgba(46,30,20,.96); border: 3px solid ${PAL.giallo}; box-shadow: 0 4px 0 ${PAL.neroCaldo}; color: ${PAL.sabbiaChiara}; font: bold 15px ui-monospace, Menlo, monospace; text-align: center; opacity: 0; pointer-events: none; transition: opacity .15s steps(3), transform .15s steps(3); max-width: calc(100% - 32px); box-sizing: border-box; }
#mzInsettoPreso.on { opacity: 1; transform: translate(-50%, -50%) scale(1); } #mzInsettoPreso b { color: ${PAL.giallo}; font-size: 17px; } #mzInsettoPreso small { color: ${PAL.sabbia}; font-size: 12px; }
`;
// icone 8×8 degli attrezzi: m legno, w chiaro, p pietra, d scuro
const ICONE: Record<Attrezzo, string[]> = {
  nulla: ['........', '..m.m...', '.mmmmm..', '.mmmmmm.', '.mmmmmm.', '..mmmm..', '..mmmm..', '........'],
  pala: ['.....dd.', '.....md.', '....m...', '...m....', '.ppm....', 'pwppd...', 'pppd....', '.dd.....'],
  retino: ['..wwww..', '.w....w.', '.w....w.', '..wwww..', '...m....', '..m.....', '.m......', 'm.......'],
  canna: ['.......m', '......mw', '.....m.w', '....m..w', '...m...w', '.pm....w', 'dm.....d', 'd.......'],
};
function iconaAttrezzo(a: Attrezzo): HTMLCanvasElement {
  const c = document.createElement('canvas'); c.width = c.height = 8; c.setAttribute('aria-hidden', 'true');
  const g = c.getContext('2d'), col: Record<string, string> = { m: PAL.legnoChiaro, w: PAL.pietraChiara, p: PAL.pietra, d: PAL.legnoScuro };
  if (g) ICONE[a].forEach((r, y) => [...r].forEach((k, x) => { const f = col[k]; if (f) { g.fillStyle = f; g.fillRect(x, y, 1, 1); } }));
  return c;
}
const NOME_ATTREZZO: Record<Attrezzo, string> = { nulla: 'Mani', pala: 'Pala', retino: 'Retino', canna: 'Canna' };

export function createInsettiBorgo(o: { world: GameWorld; root: HTMLElement; hud: Hud; api: Api | null; getLot(): LotState | null; setLot(l: LotState): void; negozioDentro(): boolean }): InsettiBorgo {
  const w = o.world, arch = w.archipelago, T = arch.tile, porto = arch.places.find((p) => p.role === 'porto');
  if (!porto) return { tick: () => false, update: () => {}, attrezzo: () => 'nulla', occupato: () => false, prendi: () => {}, zolle: () => {} };
  if (!document.getElementById('mz-insetti-style')) { const st = document.createElement('style'); st.id = 'mz-insetti-style'; st.textContent = CSS; document.head.appendChild(st); }
  const [ox, oz] = porto.origin;
  const cellWorld = (c: readonly [number, number]) => ({ x: (ox + c[0] + 0.5) * T, z: (oz + c[1] + 0.5) * T });
  const adesso = () => o.api?.serverNow() ?? Date.now();
  const sassi = SASSI_BORGO.map((c) => ({ ...cellWorld(c), scossa: 0 }));
  const alberi = ALBERI_BORGO.map((a) => ({ ...cellWorld(a.at), scossa: 0 }));
  // ogni albero → la sua istanza nel BatchedMesh «alberi_borgo» (render/verde.ts: l'istanza i è l'albero i)
  let meshAlberi: THREE.BatchedMesh | null = null;
  const baseMats: THREE.Matrix4[] = [], tmpM = new THREE.Matrix4(), r1 = new THREE.Matrix4(), r2 = new THREE.Matrix4();
  const particelle: { x: number; y: number; z: number; vx: number; vy: number; vz: number; t: number; tipo: 'terra' | 'scintilla' }[] = [];
  const emettiParticelle = (x: number, y: number, z: number, tipo: 'terra' | 'scintilla', n = 5) => {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + (Math.random() - 0.5) * 0.5, sp = (tipo === 'terra' ? 0.7 : 1.4) + Math.random() * 0.6;
      particelle.push({ x, y, z, vx: Math.cos(a) * sp, vy: 1.5 + Math.random() * 1.2, vz: Math.sin(a) * sp, t: 0, tipo });
    }
  };
  const corpi = pennello(MAX_V, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }), 'insetti');
  corpi.mesh.castShadow = true;
  const luci = pennello(MAX_V_LUCI, new THREE.MeshBasicMaterial({ vertexColors: true }), 'insetti_luci');
  w.scene.add(corpi.mesh, luci.mesh);
  const giallo = new THREE.Color(PAL.giallo);

  const CAMMINA = new Set(['.', 'g', 'd', 'P']);
  const mondo: Mondo = {
    terra: (x, z) => { const c = w.map.worldToCell(x, z); return CAMMINA.has(w.map.at(c.cx, c.cz)) && arch.placeAt(x, z)?.role === 'porto'; },
    y: (x, z) => w.groundY(x, z),
    acqua: (x, z) => {
      if (arch.placeAt(x, z)?.role !== 'porto') return true;
      const c = w.map.worldToCell(x, z), t = w.map.at(c.cx, c.cz);
      return t === '~' || t === ',' || t === 'B' || w.groundY(x, z) <= 0.05;
    },
  };

  // ——— cosa hai in mano ———
  const leggi = (): Attrezzo => { try { const v = localStorage.getItem(SALVA); return v === 'pala' || v === 'retino' || v === 'canna' || v === 'nulla' ? v : 'pala'; } catch { return 'pala'; } };
  let scelta: Attrezzo = leggi();
  const hai = (a: Attrezzo): boolean => a === 'nulla' || (a === 'pala' ? possiedePala(o.getLot()) : a === 'canna' ? possiedeCanna(o.getLot()) : possiedeRetino(o.getLot()));
  const inMano = (): Attrezzo => (hai(scelta) ? scelta : scelta === 'nulla' ? 'nulla' : hai('retino') ? 'retino' : hai('pala') ? 'pala' : hai('canna') ? 'canna' : 'nulla');
  const metti = (a: Attrezzo) => { scelta = a; try { localStorage.setItem(SALVA, a); } catch { /* niente */ } };
  const cambia = (): void => {
    const giro: Attrezzo[] = ['nulla', 'pala', 'retino', 'canna'].filter((x) => hai(x as Attrezzo)) as Attrezzo[];
    if (giro.length < 2) { o.hud.toast(hai('retino') || hai('pala') || hai('canna') ? 'Hai un attrezzo solo' : 'Gli attrezzi (pala, retino e canna da pesca) si comprano al negozio dei mobili', 2200); return; }
    const i = giro.indexOf(inMano()), next = giro[(i + 1) % giro.length]!;
    metti(next); colpo = 0; suona('click');
  };

  const inBorgo = (): boolean => (w.mode === 'walk' && !w.race.on && !o.negozioDentro() && !document.body.classList.contains('mz-casa') && arch.placeAt(w.avatar.state.x, w.avatar.state.z)?.role === 'porto');
  const inInterno = (): boolean => o.negozioDentro() || arch.placeAt(w.avatar.state.x, w.avatar.state.z)?.role === 'negozio' || document.body.classList.contains('mz-casa');
  const puoImpugnare = (): boolean => w.mode === 'walk' && !w.race.on && (inBorgo() || inInterno());

  // ——— gli insetti ———
  const attori = new Map<string, Attore>(), andati = new Set<string>();
  let turno = -1, mostra: Attore[] = [];
  const syncLiberi = (now: number) => {
    const t = turnoAt(now);
    if (t === turno) return;
    turno = t;
    for (const a of attori.values()) if (a.k.startsWith('p:') && Number(a.k.split(':')[1]) !== t && a.stato !== 'preso') { a.stato = 'via'; a.t = 0; }
    const presi = new Set(insettiOf(o.getLot(), now).presi);
    for (const l of liberiDelTurno(t)) {
      if (attori.has(l.k) || andati.has(l.k) || presi.has(l.k)) continue;
      const d = insettoDef(l.id);
      if (!d) continue;
      const c = cellWorld(l.cell), j = Number(l.k.split(':')[3] ?? 0);
      const a = nuovoAttore(l.k, d, c.x + Math.sin(l.seme * 40) * 0.6 + j * 0.35, c.z + Math.cos(l.seme * 40) * 0.6 + j * 0.2, l.seme, c.x, c.z);
      if (d.comportamento === 'cerchi') { const lamp = arch.props.filter((q) => q.k === 'lampioncino').sort((p, q) => Math.hypot(p.x - c.x, p.z - c.z) - Math.hypot(q.x - c.x, q.z - c.z))[0]; if (lamp) { a.cx = lamp.x; a.cz = lamp.z; } }
      if (d.comportamento === 'diagonale') a.z = c.z - 20;
      attori.set(l.k, a);
    }
  };

  // ——— il cartello «Hai preso…» ———
  const preso = el('div', 'mz'); preso.id = 'mzInsettoPreso';
  const azioneBtn = el('button', 'mz'); azioneBtn.id = 'mzInsettiBtn'; azioneBtn.type = 'button';
  const attrBtn = el('button', 'mz'); attrBtn.id = 'mzAttrezzoBtn'; attrBtn.type = 'button'; attrBtn.title = 'Cambia attrezzo (Q)';
  o.root.append(preso, azioneBtn, attrBtn);
  for (const e of [azioneBtn, attrBtn]) for (const ev of ['pointerdown', 'touchstart']) e.addEventListener(ev, (x) => x.stopPropagation());
  let presoFino = 0;
  const cartello = (d: InsettoDef, nuovo: boolean) => {
    preso.replaceChildren(insettoCanvas(d, 4), el('small', '', 'Hai preso'), el('b', '', d.nome + '!'), el('small', '', nuovo ? 'Non è ancora nel Diario: portalo a Fulvio per registrarlo' : 'È nello zaino'));
    preso.classList.add('on'); presoFino = performance.now() + 2600;
  };

  // ——— server ———
  let busy = false;
  const errore = (e: unknown) => (e instanceof ApiError || e instanceof Error ? e.message : 'Qualcosa non va, riprova');
  async function cattura(a: Attore): Promise<boolean> {
    if (!o.api) { o.hud.toast('Serve il collegamento per tenere gli insetti', 2200); a.stato = 'via'; a.t = 0; return false; }
    const nuovo = !insettiOf(o.getLot(), adesso()).posseduti.includes(a.def.id); // non ancora registrato da Fulvio
    try {
      const r = await o.api.insetti('cattura', { k: a.k });
      o.setLot(r.lot); attori.delete(a.k); andati.add(a.k);
      cartello(a.def, nuovo); suona('raccolto');
      return true;
    } catch (e) { o.hud.toast(errore(e), 2400); attori.delete(a.k); andati.add(a.k); return false; }
  }
  async function cerca(tipo: 'sasso' | 'albero', idx: number): Promise<{ uscito: { k: string; id: string } | null; gia: boolean } | null> {
    if (busy) return null;
    const lot = o.getLot();
    if (tipo === 'sasso' && !possiedePala(lot)) { o.hud.toast('Serve la pala per colpire i sassi', 2200); return null; }
    const p = tipo === 'sasso' ? sassi[idx] : alberi[idx];
    if (!p) return null;
    const dur = tipo === 'sasso' ? 0.45 : 0.85;
    w.avatar.avviaAzione(tipo === 'sasso' ? 'pala_sasso' : 'scuoti', dur, { x: p.x, z: p.z });
    w.frozen = true; congelato = dur;
    p.scossa = dur;
    suona(tipo === 'sasso' ? 'martello' : 'plop');
    if (tipo === 'sasso') emettiParticelle(p.x, w.groundY(p.x, p.z) + 0.35, p.z, 'scintilla', 6);
    if (tipo === 'albero') for (let i = 0; i < 6; i++) foglie.push({ x: p.x + Math.sin(i * 2.3) * 1.1, y: CHIOMA + Math.sin(i * 1.7) * 0.4, z: p.z + Math.cos(i * 2.3) * 1.1, t: 0, s: i * 1.3 });
    if (!o.api) { o.hud.toast('Serve il collegamento', 2000); return null; }
    busy = true;
    try {
      const r = await o.api.insetti(tipo, { idx });
      o.setLot(r.lot);
      if (r.gia) { o.hud.toast(tipo === 'sasso' ? 'Questo sasso l’hai già colpito oggi' : 'Quest’albero l’hai già scosso oggi', 2000); return { uscito: null, gia: true }; }
      if (!r.uscito) { o.hud.toast(tipo === 'sasso' ? 'Sotto il sasso non c’è niente' : 'Dall’albero non cade niente', 1800); return { uscito: null, gia: false }; }
      const d = insettoDef(r.uscito.id);
      if (d) {
        // esce sul lato del sasso (o dell'albero) che guarda verso di te, così la chioma non lo copre
        const f = w.avatar.state, dx = f.x - p.x, dz = f.z - p.z, l = Math.hypot(dx, dz) || 1, r0 = tipo === 'sasso' ? 0.8 : 1.0;
        const a = nuovoAttore(r.uscito.k, d, p.x + (dx / l) * r0, p.z + (dz / l) * r0, (idx * 0.37) % 1, p.x, p.z);
        if (tipo === 'sasso') daSasso(a); else { daAlbero(a, CHIOMA); a.cx = a.x; a.cz = a.z; }
        attori.set(a.k, a);
        if (tipo === 'albero' && d.comportamento === 'nido') o.hud.toast('È caduto un nido di vespe!', 1800);
      }
      return { uscito: r.uscito, gia: false };
    } catch (e) { o.hud.toast(errore(e), 2400); return null; } finally { busy = false; }
  }

  // ——— il colpo di retino ———
  let colpo = 0, colpito = false;
  const chiVicino = (): Attore | null => {
    const f = w.avatar.state, fx = Math.sin(f.yaw), fz = -Math.cos(f.yaw);
    let best: Attore | null = null, bd = Infinity;
    for (const a of attori.values()) {
      if (!prendibile(a)) continue;
      const dx = a.x - f.x, dz = a.z - f.z, d = Math.hypot(dx, dz);
      const davanti = d < PORTATA && (dx * fx + dz * fz) / (d || 1) > Math.cos(CONO);
      if ((d < VICINO || davanti) && d < bd) { bd = d; best = a; }
    }
    return best;
  };
  const retinata = () => {
    if (colpo > 0) return;
    colpo = COLPO_S; colpito = false; suona('lancio');
  };
  const chiudiColpo = () => {
    colpito = true;
    const a = chiVicino();
    if (a) { a.stato = 'preso'; a.t = 0; void cattura(a); return; }
    // mancato: chi sta lì vicino scappa allontanandosi a varie velocità (non sparisce)
    const f = w.avatar.state;
    let via = false;
    for (const b of attori.values()) {
      if (b.stato !== 'preso' && b.stato !== 'acqua' && b.stato !== 'cade' && Math.hypot(b.x - f.x, b.z - f.z) < 1.8 + PORTATA) {
        if (b.stato !== 'scappa') { b.stato = 'scappa'; b.t = 0; via = true; }
      }
    }
    if (via) suona('scappato');
  };

  // ——— dove sei: cosa fa la A ———
  const vicinoA = (list: { x: number; z: number }[], r: number): number => {
    const f = w.avatar.state; let best = -1, bd = r;
    list.forEach((p, i) => { const d = Math.hypot(p.x - f.x, p.z - f.z); if (d < bd) { bd = d; best = i; } });
    return best;
  };
  let ctx: Ctx = null, ctxIdx = -1;
  const contesto = (): void => {
    ctx = null; ctxIdx = -1; if (!inBorgo()) return;
    const mano = inMano();
    if (mano === 'retino' && chiVicino()) { ctx = 'retino'; return; }
    if (mano === 'pala') { const s = vicinoA(sassi, R_SASSO); if (s >= 0) { ctx = 'sasso'; ctxIdx = s; return; } }
    const a = vicinoA(alberi, R_ALBERO); if (a >= 0) { ctx = 'albero'; ctxIdx = a; return; }
    if (mano === 'retino') ctx = 'retino';
  };
  const agisci = () => { if (ctx === 'retino') retinata(); else if (ctx === 'sasso' && ctxIdx >= 0) void cerca('sasso', ctxIdx); else if (ctx === 'albero' && ctxIdx >= 0) void cerca('albero', ctxIdx); };
  azioneBtn.addEventListener('click', agisci); attrBtn.addEventListener('click', cambia);
  addEventListener('keydown', (e) => {
    if (e.code !== 'KeyQ' || e.repeat || e.altKey || e.ctrlKey || e.metaKey || !puoImpugnare() || w.frozen) return;
    const t = e.target as HTMLElement | null; if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
    cambia();
  });

  // ——— chi gioca, visto dagli insetti; punture ———
  let fermoDa = 0, congelato = 0;
  const chi = (): Chi => {
    const f = w.avatar.state, v = Math.hypot(f.vx, f.vz);
    return { x: f.x, z: f.z, v, corre: f.anim === 'run', fermoDa, retino: inMano() === 'retino' };
  };
  const punto = (msg: string) => { o.hud.toast(msg, 2400); suona('colpo_preso'); if (!w.frozen) { w.frozen = true; congelato = 1.2; } };

  // ——— resa ———
  const foglie: { x: number; y: number; z: number; t: number; s: number }[] = [];
  const bone = (n: string) => w.avatar.object.getObjectByName(THREE.PropertyBinding.sanitizeNodeName(n)) ?? w.avatar.object.getObjectByName(n) ?? null;
  const V = new THREE.Vector3();
  const retinoAnim = creaRetinoAnim(w);
  const disegnaMano = (mano: Attrezzo) => {
    if (mano === 'nulla' || mano === 'canna' || !puoImpugnare() || !w.avatar.visible) return; // la canna la disegna game/pesca.ts
    if (mano === 'retino') {
      if (!retinoAnim.attivo()) return;
      const p = retinoAnim.posa();
      corpi.put(RETINO, p.x, p.y, p.z, p.h, p.pitch, p.roll, 1);
      return;
    }
    const f = w.avatar.state, h = f.yaw, rx = Math.cos(h), rz = Math.sin(h), fx = Math.sin(h), fz = -Math.cos(h);
    const b = bone('Hand.R') ?? bone('LowerArm.R');
    let x: number, y: number, z: number;
    if (b) { b.getWorldPosition(V); x = V.x + fx * 0.08; y = V.y - 0.05; z = V.z + fz * 0.08; }
    else { x = f.x + rx * 0.28 + fx * 0.15; y = w.groundY(f.x, f.z) + 0.85; z = f.z + rz * 0.28 + fz * 0.15; }
    let pitch = -0.25, roll = 0.1, dy = -0.35;
    const az = w.avatar.azioneInCorso, p = w.avatar.azioneProgresso;
    if (az === 'pala_sasso') { if (p < 0.35) { const t = p / 0.35; pitch = -0.25 + t * 0.7; roll = 0.1 - t * 0.3; dy -= t * 0.05; } else if (p < 0.55) { const t = (p - 0.35) / 0.2; pitch = 0.45 - t * 1.4; roll = -0.2 + t * 0.4; dy += t * 0.1; } else { const t = (p - 0.55) / 0.45; pitch = -0.95 + t * 0.7; roll = 0.2 - t * 0.1; } }
    else if (az === 'pala_scava') { if (p < 0.4) { const t = p / 0.4; pitch = -0.25 - t * 0.75; roll = 0.1 + t * 0.2; dy -= t * 0.15; } else if (p < 0.7) { const t = (p - 0.4) / 0.3; pitch = -1.0 + t * 1.2; roll = 0.3 - t * 0.4; dy += t * 0.1; } else { const t = (p - 0.7) / 0.3; pitch = 0.2 - t * 0.45; roll = -0.1 + t * 0.2; } }
    else if (az === 'pala_chiudi') { if (p < 0.5) { const t = p / 0.5; pitch = -0.25 - t * 0.6; roll = 0.1 + t * 0.3; } else { const t = (p - 0.5) / 0.5; pitch = -0.85 + t * 0.6; roll = 0.4 - t * 0.3; } }
    corpi.put(PALA, x, y + dy, z, h, pitch, roll);
  };
  const disegna = (now: number, dt: number) => {
    corpi.begin(); luci.begin();
    const f = w.avatar.state, notte = notteAt(now);
    if (!meshAlberi) w.scene.traverse((o) => { if (o instanceof THREE.BatchedMesh && o.name === 'alberi_borgo') { meshAlberi = o; for (let i = 0; i < Math.min(alberi.length, o.instanceCount); i++) { const m = new THREE.Matrix4(); o.getMatrixAt(i, m); baseMats.push(m); } } });
    alberi.forEach((a, i) => {
      if (a.scossa <= 0) return;
      a.scossa = Math.max(0, a.scossa - dt);
      if (Math.random() < 0.3) foglie.push({ x: a.x + (Math.random() - 0.5) * 1.8, y: CHIOMA + (Math.random() - 0.5) * 0.5, z: a.z + (Math.random() - 0.5) * 1.8, t: 0, s: Math.random() * 6.28 });
      if (meshAlberi && baseMats[i]) {
        const env = a.scossa / 0.85, fq = (0.85 - a.scossa) * 30;
        tmpM.multiplyMatrices(baseMats[i]!, r1.makeRotationX(Math.sin(fq) * 0.14 * env).multiply(r2.makeRotationZ(Math.cos(fq * 0.8) * 0.08 * env)));
        meshAlberi.setMatrixAt(i, a.scossa > 0 ? tmpM : baseMats[i]!);
      }
    });
    sassi.forEach((s) => {
      if (Math.hypot(s.x - f.x, s.z - f.z) > 70) return;
      s.scossa = Math.max(0, s.scossa - dt);
      const j = s.scossa > 0 ? Math.sin(s.scossa * 50) * 0.06 : 0;
      corpi.put(SASSO, s.x + j, w.groundY(s.x, s.z), s.z, 0.6, 0, 0, 1.25);
    });
    for (let i = particelle.length - 1; i >= 0; i--) {
      const p = particelle[i]!; p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.vy -= 9.8 * dt;
      if (p.y <= w.groundY(p.x, p.z) || p.t > 0.8) { particelle.splice(i, 1); continue; }
      corpi.put(p.tipo === 'terra' ? TERRA_CLOD : SCHEGGIA_SASSO, p.x, p.y, p.z, p.t * 4, p.t * 3, 0, (p.tipo === 'terra' ? 1.0 : 0.8) * (1 - p.t / 0.8));
    }
    for (let i = foglie.length - 1; i >= 0; i--) {
      const l = foglie[i]!; l.t += dt; l.y -= dt * 1.1;
      if (l.y <= w.groundY(l.x, l.z)) { foglie.splice(i, 1); continue; }
      corpi.put(FOGLIA_CADE, l.x + Math.sin(l.t * 3 + l.s) * 0.4, l.y, l.z, l.t * 2 + l.s, Math.sin(l.t * 4) * 0.5, 0);
    }
    for (const a of [...attori.values(), ...mostra]) {
      if (Math.hypot(a.x - f.x, a.z - f.z) > 50) continue;
      const g = w.groundY(a.x, a.z), fm = formeInsetto(a.def), b = a.def.comportamento, volante = a.def.tipo === 'volante' || (a.stato === 'via' && a.y > 0.2);
      if (a.alfa <= 0.05) continue;
      const passo = Math.floor(a.vita * (volante ? 14 : 7) + a.seme * 5) % 2 === 0;
      let posa = passo ? fm.a : fm.b, roll = 0, pitch = 0;
      if ((a.stato === 'fermo' && (b === 'pausa' || b === 'guscio' || b === 'foglia' || b === 'fissa' || b === 'chele')) || (b === 'chele' && a.stato === 'carica') || a.stato === 'salta') posa = fm.c;
      if (a.stato === 'stordito') { roll = Math.PI; posa = fm.b; }
      if (b === 'nido' && (a.stato === 'cade' || a.stato === 'fermo')) { corpi.put(NIDO, a.x, g + Math.max(0, a.y - 0.3), a.z, 0); if (a.stato === 'cade') continue; }
      if (b === 'nido' && a.stato !== 'cade') corpi.put(NIDO, a.cx, g, a.cz, 0);
      if (a.stato === 'appeso') { corpi.put(FILO, a.x, g + a.y, a.z, 0, 0, 0, 1); corpi.put(FILO, a.x, g + a.y + 1, a.z, 0, 0, 0, Math.max(0.01, a.filo - 1)); }
      const s = SCALA * (a.def.id === 'regina' ? 1.35 : a.def.forma === 'ercole' ? 1 : a.def.forma === 'formica' ? 0.85 : 1);
      const y = g + (a.stato === 'stordito' ? 0.12 : 0) + a.y;
      corpi.put(posa, a.x, y, a.z, a.h, pitch, roll, s * (a.stato === 'via' || a.stato === 'acqua' ? Math.max(0.3, a.alfa) : 1));
      if (volante && a.stato !== 'via' && a.stato !== 'acqua') corpi.put(OMBRA, a.x, g + 0.02, a.z, 0, 0, 0, s * 0.7);
      if (a.def.comportamento === 'lucciola' && notte && (a.vita + a.seme * 3) % 2.2 < 1.4) luci.put(LUME, a.x - Math.sin(a.h) * 0.12, y, a.z + Math.cos(a.h) * 0.12, 0, 0, 0, 1, giallo, giallo);
    }
    disegnaMano(inMano());
    corpi.end(); luci.end();
  };

  // ——— test ———
  registerStateProvider('insetti', () => {
    const now = adesso();
    return {
      attrezzo: inMano(), scelta, ctx, ctxIdx, retino: possiedeRetino(o.getLot()), inBorgo: inBorgo(), turno, stagione: stagioneAt(now), notte: notteAt(now), colpo,
      bottone: azioneBtn.classList.contains('on') ? azioneBtn.textContent : null, attrezzoBtn: attrBtn.classList.contains('on'), cartello: preso.classList.contains('on') ? preso.textContent : null,
      attori: [...attori.values()].map((a) => ({ k: a.k, id: a.def.id, stato: a.stato, x: a.x, z: a.z, y: a.y, prendibile: prendibile(a) })),
      sassi: sassi.map((s) => ({ x: s.x, z: s.z })), alberi: alberi.map((a) => ({ x: a.x, z: a.z })),
      collezione: insettiOf(o.getLot(), now),
    };
  });
  registerTestHook('insettiAttrezzo', (a) => { if (a === 'nulla' || a === 'pala' || a === 'retino') metti(a); return inMano(); });
  registerTestHook('insettiRetino', () => { retinata(); return true; });
  registerTestHook('insettiSasso', (i) => cerca('sasso', Number(i))); registerTestHook('insettiAlbero', (i) => cerca('albero', Number(i))); registerTestHook('insettiCattura', (k) => { const a = attori.get(String(k)); return a ? cattura(a) : false; });
  registerTestHook('insettiMostra', (ids, passo) => {
    const f = w.avatar.state, list = Array.isArray(ids) && ids.length ? INSETTI.filter((d) => (ids as string[]).includes(d.id)) : [...INSETTI], p = Number(passo) || 0.9, n = list.length <= 8 ? list.length : Math.ceil(Math.sqrt(list.length));
    mostra = list.map((d, i) => { const a = nuovoAttore('mostra:' + d.id, d, f.x + ((i % n) - (n - 1) / 2) * p, f.z - 1.5 - Math.floor(i / n) * p, 0.3); a.h = 0.4; if (d.tipo === 'volante') a.y = 0.9; return a; }); return mostra.length;
  });

  let aWas = false, lastBtn = '', lastAttr = '';
  return {
    attrezzo: inMano, occupato: () => ctx === 'sasso' || ctx === 'albero', prendi: metti,
    zolle: (x, y, z, n) => emettiParticelle(x, y, z, 'terra', n),
    tick(a) { const pa = a && !aWas; aWas = a; contesto(); if (!ctx) return false; if (pa) agisci(); return true; },
    update(dt) {
      const now = adesso();
      if (presoFino && performance.now() > presoFino) { preso.classList.remove('on'); presoFino = 0; }
      if (congelato > 0) { congelato -= dt; if (congelato <= 0 && !w.avatar.azioneInCorso) w.frozen = false; }
      const f = w.avatar.state; fermoDa = Math.hypot(f.vx, f.vz) < 0.2 ? fermoDa + dt : 0;
      const c = chi(), dentro = inBorgo(), mano = inMano();
      retinoAnim.aggiorna(dt, colpo, COLPO_S, puoImpugnare() && mano === 'retino');
      if (colpo > 0) { colpo = Math.max(0, colpo - dt); if (!colpito && colpo <= COLPO_S * 0.52) chiudiColpo(); }
      syncLiberi(now);
      for (const [k, a] of attori) {
        if (Math.hypot(a.x - c.x, a.z - c.z) > 60 && a.stato !== 'via' && a.stato !== 'acqua') continue;
        const ev = vive(a, c, dt, mondo);
        if (ev.punto && dentro) punto(ev.punto); if (ev.tonfo) suona('colpo_dato'); if (ev.plop) suona('plop');
        if (a.stato === 'via' && a.t > 1.6) { attori.delete(k); andati.add(k); }
        if (a.stato === 'acqua' && a.t > 1.2) { attori.delete(k); andati.add(k); }
      }
      disegna(now, dt); contesto();
      const show = dentro && !!ctx, key = !show ? '' : ctx === 'retino' ? 'r' : ctx === 'sasso' ? 's' : 'a';
      if (key !== lastBtn) {
        lastBtn = key; azioneBtn.classList.toggle('on', show);
        if (key === 'r') azioneBtn.replaceChildren(iconaAttrezzo('retino'), el('span', '', 'Retino'), el('b', '', 'A'));
        else if (key === 's') azioneBtn.replaceChildren(iconaAttrezzo('pala'), el('span', '', 'Colpisci'), el('span', 'lungo', 'Il sasso'), el('b', '', 'A'));
        else if (key === 'a') azioneBtn.replaceChildren(el('span', '', 'Scuoti'), el('span', 'lungo', 'L’albero'), el('b', '', 'A'));
        for (const cv of azioneBtn.querySelectorAll('canvas')) { (cv as HTMLCanvasElement).style.width = (cv as HTMLCanvasElement).style.height = '20px'; (cv as HTMLCanvasElement).style.imageRendering = 'pixelated'; }
      }
      const attr = puoImpugnare() && (hai('pala') || hai('retino') || hai('canna')) ? mano : '';
      if (attr !== lastAttr) { lastAttr = attr; attrBtn.classList.toggle('on', !!attr); if (attr) attrBtn.replaceChildren(iconaAttrezzo(attr as Attrezzo), el('span', '', NOME_ATTREZZO[attr as Attrezzo])); }
    },
  };
}
/** Il prezzo del retino (per il negozio). */
export const RETINO_MONETE = RETINO_CFG.monete;
