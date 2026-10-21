// La pesca (#457, Database_Pesci_GameDesign.xlsx di Riccardo), alla Animal Crossing ma più facile: con la canna in mano sulle rive di
// Borgo Marea (A) o dalla barca ferma in mare aperto (bottone PESCA o P) si entra nella pesca: il mondo sta fermo, si mira (telefono: il
// joystick di mira a destra, come nei dungeon, più lo spingi più lontano va l'esca; PC: il mouse) e si lancia (rilascio, clic, A).
// In acqua si vede solo l'ombra (la taglia del pesce): quella vicina all'esca la nota quasi sempre e viene, fa qualche finta (il
// galleggiante trema: chi tira adesso lo spaventa), poi il galleggiante va sotto e si tocca A più veloce che si può finché la barra non è
// piena. Le ombre sono uguali per tutti nel turno (@marea/sim economy/pesci.ts): quelle di riva stanno lungo le rive del Borgo, quelle
// della barca escono attorno a chi si ferma al largo. Il pesce lo tiene il server (rpg/pesci.ts). Esc o SMETTI per smettere.
// Sta nel chunk del negozio dei mobili (game/negozio.ts) con gli insetti: il JS iniziale non cambia. Due mesh rifatte a ogni frame
// (render/pennello.ts: canna, galleggiante, anelli, mirino; e le ombre trasparenti) più la lenza: 3 draw call.
import * as THREE from 'three';
import { PESCI_CFG, tagliaDi } from '@marea/content/pesci.ts';
import type { PesceDef } from '@marea/content/pesci.ts';
import type { LotState } from '@marea/sim';
import { barcaQui, ombreDelTurno, pesceDef, pesciAt, pesciOf, possiedeCanna, turnoPesciAt } from '@marea/sim/economy/pesci.ts';
import type { BarcaQui } from '@marea/sim/economy/pesci.ts';
import { notteAt, stagioneAt } from '@marea/sim/economy/insetti.ts';
import { canBoard } from '@marea/sim/world/boat.ts';
import type { GameWorld } from './world.ts';
import type { Hud } from '../ui/hud.ts';
import type { Api } from '../net/api.ts';
import { ApiError } from '../net/api.ts';
import { pennello } from '../render/pennello.ts';
import { ANELLO, CANNA, CANNA_L, GALLEGGIANTE, MIRINO, OMBRA_PESCE, SPRUZZO } from '../render/pesci_forme.ts';
import { createMiraStick } from '../rpg/mira_stick.ts';
import { pesceCanvas } from '../ui/pesci_sprite.ts';
import { PAL, el } from '../ui/style.ts';
import { pixIcon } from '../ui/icons.ts';
import { suona } from '../audio/ponte.ts';
import { registerStateProvider, registerTestHook } from '../test/testapi.ts';

const C = PESCI_CFG;
type Fase = 'spento' | 'mira' | 'volo' | 'attesa' | 'morso' | 'preso' | 'scappa';
type Stato = 'nuota' | 'viene' | 'finte' | 'morde' | 'via';
type Ombra = { k: string; def: PesceDef; x: number; z: number; h: number; hx: number; hz: number; seme: number; t: number; stato: Stato; alfa: number; ignora: boolean };
export type PescaBorgo = {
  tick(a: boolean): boolean; update(dt: number): void;
  /** Si sta pescando (il mondo sta fermo: main.ts). */
  attiva(): boolean;
  /** La scritta sotto A mentre si pesca o davanti all'acqua con la canna in mano (null = niente). */
  azione(): string | null;
};

const MAX_V = 20000, MAX_V_OMBRE = 6000;
/** Le ombre si vedono entro VISTA m; quelle della barca si rifanno se la barca si è spostata di più di SPOSTA m. */
const VISTA = 48, SPOSTA = 14;
/** Davanti all'acqua: la canna arriva a un'acqua entro ACQUA_M m davanti (cono di ±55°). */
const ACQUA_M = 5.5;
const NUOTO = 0.45, GIRO = 2.2;
const AVVISO_MS = 20_000;
/** Altri bottoni di posto accesi (GIOCA al molo, Porto, botteghe, porte…): lì la A è loro, non della canna. */
const ALTRI = '.mz-play.on:not(#mzPescaBtn), #mzPortoBtn.on, #mzAmiciBtn.on, #mzLibroBtn.on, #mzBottegaBtn.on, #mzPortaBtn.on';
const CSS = `
#mzPescaPanel { position: absolute; left: 50%; top: calc(max(8px, env(safe-area-inset-top)) + 58px); transform: translateX(-50%); z-index: 17; display: none; flex-direction: column; gap: 4px; width: min(320px, calc(100% - 128px)); box-sizing: border-box; padding: 6px 8px; background: rgba(46,30,20,.94); border: 2px solid ${PAL.legnoChiaro}; box-shadow: 0 3px 0 ${PAL.neroCaldo}; color: ${PAL.sabbiaChiara}; font: bold 13px ui-monospace, Menlo, monospace; }
#mzPescaPanel.on { display: flex; }
/* telefono: sotto la minimappa e le METE, dove la striscia in alto è libera */
@media (max-width: 699px) { #mzPescaPanel { top: calc(max(8px, env(safe-area-inset-top)) + 206px); width: calc(100% - 32px); font-size: 12px; } }
#mzPescaPanel.tira { border-color: ${PAL.giallo}; }
#mzPescaPanel .r { display: flex; align-items: center; gap: 6px; }
#mzPescaPanel .t { flex: 1; min-width: 0; line-height: 1.25; }
#mzPescaPanel .t small { display: block; color: ${PAL.sabbia}; font-size: 11px; }
#mzPescaPanel button { flex: none; min-width: 44px; min-height: 40px; padding: 0 8px; background: ${PAL.legnoScuro}; border: 2px solid ${PAL.legnoChiaro}; color: ${PAL.sabbiaChiara}; font: bold 12px ui-monospace, Menlo, monospace; cursor: pointer; }
#mzPescaPanel .bar { position: relative; height: 14px; background: ${PAL.pietraScura}; border: 2px solid ${PAL.neroCaldo}; display: none; }
#mzPescaPanel.tira .bar { display: block; }
#mzPescaPanel .bar i { position: absolute; left: 0; top: 0; bottom: 0; background: ${PAL.giallo}; }
#mzPescaPanel .bar u { position: absolute; right: 0; top: 0; bottom: 0; background: ${PAL.rosso}; text-decoration: none; }
#mzPescePreso { position: absolute; left: 50%; top: 30%; transform: translate(-50%, -50%) scale(.9); z-index: 26; display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 12px 18px; background: rgba(46,30,20,.96); border: 3px solid ${PAL.giallo}; box-shadow: 0 4px 0 ${PAL.neroCaldo}; color: ${PAL.sabbiaChiara}; font: bold 15px ui-monospace, Menlo, monospace; text-align: center; opacity: 0; pointer-events: none; transition: opacity .15s steps(3), transform .15s steps(3); max-width: calc(100% - 32px); box-sizing: border-box; }
#mzPescePreso.on { opacity: 1; transform: translate(-50%, -50%) scale(1); }
#mzPescePreso b { color: ${PAL.giallo}; font-size: 17px; }
#mzPescePreso small { color: ${PAL.sabbia}; font-size: 12px; }
.mz-pesca-mira #btnA, .mz-pesca-mira #btnAzione { display: none !important; }
`;
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const LANCIO_MEDIO = 0.6;

export function createPescaBorgo(o: {
  world: GameWorld; root: HTMLElement; hud: Hud; api: Api | null; camera: THREE.Camera; canvas: HTMLCanvasElement; yaw(): number;
  getLot(): LotState | null; setLot(l: LotState): void; negozioDentro(): boolean;
  /** Cosa hai in mano a piedi (game/insetti.ts): da riva si pesca con la canna in mano. */
  inMano(): string;
}): PescaBorgo {
  const w = o.world, arch = w.archipelago, T = arch.tile, porto = arch.places.find((p) => p.role === 'porto');
  if (!document.getElementById('mz-pesca-style')) { const st = document.createElement('style'); st.id = 'mz-pesca-style'; st.textContent = CSS; document.head.appendChild(st); }
  const [ox, oz] = porto?.origin ?? [0, 0];
  const adesso = () => o.api?.serverNow() ?? Date.now();
  const acqua = (x: number, z: number): boolean => { const c = w.map.worldToCell(x, z), t = w.map.at(c.cx, c.cz); return t === '~' || t === ','; }; // anche l'acqua bassa
  const corpi = pennello(MAX_V, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }), 'pesca');
  const ombreM = pennello(MAX_V_OMBRE, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.5, depthWrite: false }), 'pesca_ombre');
  ombreM.mesh.renderOrder = 2;
  const LENZA_N = 10, lenzaPos = new Float32Array(LENZA_N * 3), lenzaG = new THREE.BufferGeometry();
  lenzaG.setAttribute('position', new THREE.BufferAttribute(lenzaPos, 3).setUsage(THREE.DynamicDrawUsage));
  const lenza = new THREE.Line(lenzaG, new THREE.LineBasicMaterial({ color: PAL.pietraChiara })); lenza.name = 'pesca_lenza'; lenza.frustumCulled = false; lenza.visible = false;
  w.scene.add(corpi.mesh, ombreM.mesh, lenza);
  const scuro = new THREE.Color(PAL.neroCaldo), giallo = new THREE.Color(PAL.giallo), rosso = new THREE.Color(PAL.rosso);

  // ——— dove sei ———
  const inBorgo = (): boolean => {
    if (w.mode !== 'walk' || w.race.on || o.negozioDentro() || document.body.classList.contains('mz-casa')) return false;
    const f = w.avatar.state;
    return arch.placeAt(f.x, f.z)?.role === 'porto';
  };
  const avanti = () => { const f = w.avatar.state; return { x: Math.sin(f.yaw), z: -Math.cos(f.yaw) }; };
  /** Con la canna in mano davanti all'acqua del Borgo. */
  const davantiAcqua = (): boolean => {
    if (!inBorgo() || o.inMano() !== 'canna') return false;
    if (canBoard(w.avatar.state, w.boat.state, w.map) || document.querySelector(ALTRI)) return false; // vicino alla barca A fa salire
    const f = w.avatar.state, a = avanti();
    for (const da of [0, -0.5, 0.5, -0.95, 0.95]) {
      const c = Math.cos(da), s = Math.sin(da), dx = a.x * c - a.z * s, dz = a.x * s + a.z * c;
      for (let d = 1; d <= ACQUA_M; d += 0.75) if (acqua(f.x + dx * d, f.z + dz * d)) return true;
    }
    return false;
  };
  let q: BarcaQui = { ok: false, perche: 'terra' }, qN = 0;
  const inBarca = (): boolean => w.mode === 'boat' && !w.race.on;
  const centro = (): { x: number; z: number } => (w.mode === 'boat' ? { x: w.boat.state.x, z: w.boat.state.z } : { x: w.avatar.state.x, z: w.avatar.state.z });

  // ——— le ombre ———
  const ombre = new Map<string, Ombra>(), andati = new Set<string>();
  let turno = -1, barcaC: { x: number; z: number } | null = null, mostra: Ombra[] = [];
  const nuova = (k: string, def: PesceDef, x: number, z: number, seme: number): Ombra => ({ k, def, x, z, h: seme * 6.28, hx: x, hz: z, seme, t: seme * 10, stato: 'nuota', alfa: 0, ignora: false });
  const syncRiva = (now: number) => {
    const t = turnoPesciAt(now);
    if (t === turno) return;
    turno = t;
    for (const a of ombre.values()) if (Number(a.k.split(':')[1]) !== t && a !== preda) { a.stato = 'via'; a.t = 0; }
    const presi = new Set(pesciOf(o.getLot(), now).presi);
    for (const s of ombreDelTurno(t)) {
      if (s.zona !== 'riva' || !s.cell || ombre.has(s.k) || andati.has(s.k) || presi.has(s.k)) continue;
      const d = pesceDef(s.id);
      if (d) ombre.set(s.k, nuova(s.k, d, (ox + s.cell[0] + 0.5) * T, (oz + s.cell[1] + 0.5) * T, s.seme));
    }
    barcaC = null; // le ombre della barca del turno nuovo escono alla prossima sosta
  };
  /** Le ombre della barca del turno attorno al punto (x, z), ognuna su un'acqua lontana dalla barca. */
  const spargiBarca = (x: number, z: number, now: number) => {
    for (const [k, a] of ombre) if (k.startsWith('b:') && a !== preda) ombre.delete(k);
    barcaC = { x, z };
    const presi = new Set(pesciOf(o.getLot(), now).presi);
    for (const s of ombreDelTurno(turnoPesciAt(now))) {
      if (s.zona !== 'barca' || andati.has(s.k) || presi.has(s.k)) continue;
      const d = pesceDef(s.id);
      if (!d) continue;
      for (let i = 0; i < 8; i++) {
        const ang = s.seme * 6.283 + i * 0.8, r = 3.5 + ((s.seme * 7.3 + i * 0.37) % 1) * 4.5, px = x + Math.sin(ang) * r, pz = z + Math.cos(ang) * r;
        if (acqua(px, pz)) { ombre.set(s.k, nuova(s.k, d, px, pz, s.seme)); break; }
      }
    }
  };

  // ——— la pesca ———
  let fase: Fase = 'spento', faseT = 0, dove: 'riva' | 'barca' = 'riva';
  let preda: Ombra | null = null, finte = 0, prossima = 0, barra = 0, tiraT = 0, attesaT = 0, scegliT = 0, rollT = 0;
  const esca = { x: 0, z: 0, y: 0, x0: 0, y0: 0, z0: 0, dip: 0, ok: false };
  let mira = { x: 0, z: 0, ok: false };
  const anelli: { x: number; z: number; t: number; s: number }[] = [], spruzzi: { x: number; z: number; t: number }[] = [];
  const anello = (x: number, z: number, s: number) => { if (anelli.length < 12) anelli.push({ x, z, t: 0, s }); };
  const metti = (f: Fase) => { fase = f; faseT = 0; };

  // ——— UI ———
  const btn = el('button', 'mz mz-play'); btn.id = 'mzPescaBtn'; btn.type = 'button'; // come GIOCA e TUFFATI (la guida gli cede il posto)
  const panel = el('div', 'mz'); panel.id = 'mzPescaPanel';
  const riga = el('div', 'r'), testo = el('div', 't'), smetti = el('button', '', '× SMETTI'); smetti.type = 'button'; smetti.dataset['act'] = 'smetti';
  const barEl = el('div', 'bar'), barFill = el('i'), barTempo = el('u'); barEl.append(barFill, barTempo);
  riga.append(testo, smetti); panel.append(riga, barEl);
  const preso = el('div', 'mz'); preso.id = 'mzPescePreso';
  o.root.append(btn, panel, preso);
  for (const e of [btn, panel]) for (const ev of ['pointerdown', 'touchstart']) e.addEventListener(ev, (x) => x.stopPropagation());
  const stick = createMiraStick({ id: 'mzPescaMira', yaw: o.yaw, blocked: () => fase !== 'mira' });
  o.root.appendChild(stick.el);
  let presoFino = 0, avvisoAt = -AVVISO_MS, okWas = false, cannaAvviso = false;
  const cartello = (d: PesceDef, nuovo: boolean) => {
    preso.replaceChildren(pesceCanvas(d, 4), el('small', '', 'Hai preso'), el('b', '', d.nome + '!'), el('small', '', nuovo ? 'Non è ancora nel Diario: portalo a Fulvio per registrarlo' : 'È nello zaino'));
    preso.classList.add('on'); presoFino = performance.now() + 2800;
  };
  const coarse = () => typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;

  // ——— entrare, uscire ———
  const puoi = (): 'riva' | 'barca' | null => {
    if (!possiedeCanna(o.getLot())) return null;
    if (davantiAcqua()) return 'riva';
    if (inBarca() && q.ok) return 'barca';
    return null;
  };
  const entra = (): boolean => {
    const d = puoi();
    if (!d) {
      if (inBarca() && possiedeCanna(o.getLot())) o.hud.toast(q.perche === 'veloce' ? 'Ferma la barca per pescare' : 'Troppo vicino alla riva: allontanati un po’ in mare aperto', 2200);
      return false;
    }
    dove = d; preda = null; metti('mira'); suona('click');
    if (d === 'barca') { const b = w.boat.state; if (!barcaC || Math.hypot(b.x - barcaC.x, b.z - barcaC.z) > 2) spargiBarca(b.x, b.z, adesso()); }
    const a = d === 'barca' ? { x: Math.sin(w.boat.state.yaw), z: -Math.cos(w.boat.state.yaw) } : avanti(), c = centro();
    mira = { x: c.x + a.x * (C.lancio.min + (C.lancio.max - C.lancio.min) * LANCIO_MEDIO), z: c.z + a.z * (C.lancio.min + (C.lancio.max - C.lancio.min) * LANCIO_MEDIO), ok: true };
    mouseMosso = false;
    if (dove === 'barca' && !ombre.size) o.hud.toast('Qui adesso non si vede niente: riprova al prossimo giro', 2200);
    return true;
  };
  const esci = () => {
    if (preda && preda.stato !== 'via') { preda.stato = 'nuota'; preda.ignora = false; }
    preda = null; metti('spento'); stick.cancel(); lenza.visible = false;
  };
  const scappa = (msg: string) => {
    if (preda) { preda.stato = 'via'; preda.t = 0; andati.add(preda.k); }
    preda = null; suona('scappato'); o.hud.toast(msg, 2000); metti('scappa');
  };

  // ——— mira e lancio ———
  let mouseX = 0, mouseY = 0, mouseMosso = false;
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), hit = new THREE.Vector3(), piano = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse') { mouseX = e.clientX; mouseY = e.clientY; mouseMosso = true; } });
  const limita = (x: number, z: number) => {
    const c = centro(), dx = x - c.x, dz = z - c.z, d = Math.hypot(dx, dz) || 1, k = Math.max(C.lancio.min, Math.min(C.lancio.max, d)) / d;
    const px = c.x + dx * k, pz = c.z + dz * k;
    return { x: px, z: pz, ok: acqua(px, pz) };
  };
  const miraMouse = () => {
    if (!mouseMosso) return;
    const r = o.canvas.getBoundingClientRect();
    if (r.width < 1) return;
    ndc.set(((mouseX - r.left) / r.width) * 2 - 1, -(((mouseY - r.top) / r.height) * 2 - 1));
    ray.setFromCamera(ndc, o.camera);
    if (ray.ray.intersectPlane(piano, hit)) mira = limita(hit.x, hit.z);
  };
  const miraStick = (): boolean => {
    const d = stick.dir();
    if (!d) return false;
    const c = centro(), f = Math.max(0, Math.min(1, (stick.forza() - 0.3) / 0.7)), dist = C.lancio.min + (C.lancio.max - C.lancio.min) * f;
    mira = limita(c.x + d.x * dist, c.z + d.z * dist);
    return true;
  };
  const guarda = (x: number, z: number) => {
    if (w.mode !== 'walk') return;
    const f = w.avatar.state, y = Math.atan2(x - f.x, -(z - f.z));
    f.yaw = y; w.avatar.prev.yaw = y;
  };
  const punta = (): THREE.Vector3 => {
    const m = mano(), p = pitchCanna();
    return new THREE.Vector3(m.x + Math.sin(m.h) * -Math.sin(p) * CANNA_L, m.y + Math.cos(p) * CANNA_L, m.z - Math.cos(m.h) * -Math.sin(p) * CANNA_L);
  };
  const lancia = () => {
    if (fase !== 'mira') return;
    const p = punta();
    Object.assign(esca, { x0: p.x, y0: p.y, z0: p.z, x: mira.x, z: mira.z, y: p.y, dip: 0, ok: mira.ok });
    guarda(mira.x, mira.z); metti('volo'); suona('lancio');
  };
  // clic sinistro sul canvas (solo mouse): lancia, o vale come A
  let clic = false;
  o.canvas.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse' || e.button !== 0 || fase === 'spento') return;
    mouseX = e.clientX; mouseY = e.clientY; mouseMosso = true;
    if (fase === 'mira') { miraMouse(); lancia(); } else clic = true;
  });
  addEventListener('keydown', (e) => {
    if (e.repeat || e.altKey || e.ctrlKey || e.metaKey) return;
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
    if (e.code === 'Escape' && fase !== 'spento') { e.stopPropagation(); esci(); return; }
    if (e.code === 'KeyP' && fase === 'spento' && inBarca()) entra();
  });
  btn.addEventListener('click', () => { if (fase === 'spento') entra(); });
  smetti.addEventListener('click', () => esci());

  // ——— il pesce che viene, le finte, il morso ———
  const scegli = () => {
    let best: Ombra | null = null, bd = C.attira.raggio;
    for (const a of ombre.values()) {
      if (a.stato !== 'nuota' || a.ignora) continue;
      const d = Math.hypot(a.x - esca.x, a.z - esca.z);
      if (d < bd) { bd = d; best = a; }
    }
    if (!best) return;
    if (Math.random() > C.attira.vista) { best.ignora = true; return; } // questa volta non l'ha vista
    preda = best; best.stato = 'viene';
  };
  const premi = () => {
    if (fase === 'mira') { lancia(); return; }
    if (fase === 'attesa') {
      if (preda && (preda.stato === 'viene' || preda.stato === 'finte')) { scappa('Troppo presto: il pesce si è spaventato!'); return; }
      metti('mira'); suona('click'); return; // tira su l'esca vuota
    }
    if (fase === 'morso') { barra += 1; esca.dip = 1; if (Math.random() < 0.35) spruzzi.push({ x: esca.x, z: esca.z, t: 0 }); }
  };
  async function tieni(a: Ombra): Promise<void> {
    if (!o.api) { o.hud.toast('Serve il collegamento per tenere i pesci', 2200); andati.add(a.k); ombre.delete(a.k); return; }
    const nuovo = !pesciOf(o.getLot(), adesso()).posseduti.includes(a.def.id); // non ancora registrato da Fulvio
    try {
      const r = await o.api.pesci('cattura', { k: a.k });
      o.setLot(r.lot); cartello(a.def, nuovo); suona('pesce');
    } catch (e) { o.hud.toast(e instanceof ApiError || e instanceof Error ? e.message : 'Qualcosa non va, riprova', 2400); }
    finally { andati.add(a.k); ombre.delete(a.k); }
  }

  // ——— disegno ———
  const bone = (n: string) => w.avatar.object.getObjectByName(THREE.PropertyBinding.sanitizeNodeName(n)) ?? w.avatar.object.getObjectByName(n) ?? null;
  const V = new THREE.Vector3();
  const mano = (): { x: number; y: number; z: number; h: number } => {
    const f = w.avatar.state, h = w.mode === 'boat' ? w.boat.state.yaw : f.yaw, fx = Math.sin(h), fz = -Math.cos(h);
    const b = bone('Hand.R') ?? bone('LowerArm.R');
    if (b && w.avatar.visible) { b.getWorldPosition(V); return { x: V.x + fx * 0.08, y: V.y - 0.05, z: V.z + fz * 0.08, h }; }
    const c = centro();
    return { x: c.x + Math.cos(h) * 0.28 + fx * 0.15, y: w.mode === 'boat' ? 0.95 : w.groundY(c.x, c.z) + 0.85, z: c.z + Math.sin(h) * 0.28 + fz * 0.15, h }; // in barca: seduto a bordo, sopra l'acqua
  };
  /** Inclinazione della canna (rad, negativa = verso avanti): ferma in su, indietro e giù nel lancio, che trema quando tira. */
  const pitchCanna = (): number => {
    if (fase === 'volo') { const k = Math.min(1, faseT / C.lancio.secondi); return k < 0.25 ? -0.3 + k * 2.4 : 0.3 - (k - 0.25) * 2.2; }
    if (fase === 'morso') return -0.75 + Math.sin(faseT * 40) * 0.08 + Math.min(0.5, barra * 0.03);
    if (fase === 'attesa') return -1.0 + (preda?.stato === 'finte' && esca.dip > 0.5 ? -0.08 : 0);
    if (fase === 'mira' || fase === 'preso' || fase === 'scappa') return -0.45;
    return -0.3;
  };
  const inInterno = (): boolean => o.negozioDentro() || arch.placeAt(w.avatar.state.x, w.avatar.state.z)?.role === 'negozio' || document.body.classList.contains('mz-casa');
  const puoImpugnare = (): boolean => w.mode === 'walk' && !w.race.on && (inBorgo() || inInterno());
  const conCanna = (): boolean => fase !== 'spento' || (w.avatar.visible && puoImpugnare() && o.inMano() === 'canna');
  const disegna = (dt: number, tempo: number) => {
    corpi.begin(); ombreM.begin();
    const c = centro();
    for (const a of [...ombre.values(), ...mostra]) {
      if (Math.hypot(a.x - c.x, a.z - c.z) > VISTA) continue;
      const s = tagliaDi(a.def).lungo, guizzo = a.stato === 'morde' ? Math.sin(tempo * 30) * 0.25 : a.stato === 'finte' ? Math.sin(tempo * 9) * 0.1 : 0;
      const col = scuro.clone().lerp(new THREE.Color(PAL.abisso), 1 - a.alfa);
      ombreM.put(OMBRA_PESCE, a.x, 0.05, a.z, a.h + guizzo, 0, 0, s * (a.stato === 'via' ? Math.max(0.4, a.alfa) : 1), col);
    }
    if (conCanna()) { const m = mano(); corpi.put(CANNA, m.x, m.y - 0.25, m.z, m.h, pitchCanna(), 0, 1); }
    const sott = fase === 'morso' ? -0.12 + Math.sin(tempo * 25) * 0.04 : -esca.dip * 0.07;
    if (fase === 'attesa' || fase === 'morso' || fase === 'volo') corpi.put(GALLEGGIANTE, esca.x, esca.y + (fase === 'volo' ? 0 : sott), esca.z, 0, 0, 0, 1.6);
    if (fase === 'mira') {
      corpi.put(MIRINO, mira.x, 0.08, mira.z, tempo * 0.8, 0, 0, 1 + Math.sin(tempo * 5) * 0.06, mira.ok ? giallo : rosso);
    }
    for (let i = anelli.length - 1; i >= 0; i--) { const r = anelli[i]!; r.t += dt; if (r.t > 0.8) { anelli.splice(i, 1); continue; } corpi.put(ANELLO, r.x, 0.06, r.z, 0, 0, 0, r.s * (0.25 + r.t * 1.1)); }
    for (let i = spruzzi.length - 1; i >= 0; i--) { const p = spruzzi[i]!; p.t += dt; if (p.t > 0.45) { spruzzi.splice(i, 1); continue; } corpi.put(SPRUZZO, p.x, 0.1 + p.t * 1.6 - p.t * p.t * 4, p.z, p.t * 5, 0, 0, 1.4); }
    corpi.end(); ombreM.end();
    // la lenza: dalla punta della canna al galleggiante, un po' molle
    lenza.visible = fase === 'volo' || fase === 'attesa' || fase === 'morso';
    if (lenza.visible) {
      const p = punta(), ey = esca.y + (fase === 'volo' ? 0 : sott), molle = fase === 'morso' ? 0.05 : 0.6;
      for (let i = 0; i < LENZA_N; i++) {
        const k = i / (LENZA_N - 1);
        lenzaPos[i * 3] = p.x + (esca.x - p.x) * k; lenzaPos[i * 3 + 1] = p.y + (ey - p.y) * k - Math.sin(k * Math.PI) * molle; lenzaPos[i * 3 + 2] = p.z + (esca.z - p.z) * k;
      }
      (lenzaG.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    }
  };

  // ——— il nuoto delle ombre ———
  const nuota = (a: Ombra, dt: number) => {
    a.t += dt;
    if (a.stato === 'via') { a.alfa = Math.max(0, a.alfa - dt * 1.5); const v = 3; a.x += Math.sin(a.h) * v * dt; a.z -= Math.cos(a.h) * v * dt; return; }
    a.alfa = Math.min(1, a.alfa + dt * 0.8);
    let tx: number, tz: number, v: number;
    if (a.stato === 'nuota') {
      tx = a.hx + Math.sin(a.t * 0.31 + a.seme * 10) * GIRO; tz = a.hz + Math.cos(a.t * 0.23 + a.seme * 7) * GIRO; v = NUOTO;
    } else {
      // davanti all'esca, col muso verso di lei
      const dx = a.x - esca.x, dz = a.z - esca.z, d = Math.hypot(dx, dz) || 1, st = tagliaDi(a.def).lungo * 0.5 + 0.12;
      tx = esca.x + (dx / d) * st; tz = esca.z + (dz / d) * st; v = C.attira.velocita;
      if (a.stato !== 'viene') { a.h = Math.atan2(esca.x - a.x, -(esca.z - a.z)); return; }
    }
    const dx = tx - a.x, dz = tz - a.z, d = Math.hypot(dx, dz);
    if (d < 0.06) { if (a.stato === 'viene') { a.stato = 'finte'; finte = Math.round(rnd(C.finte.quante[0], C.finte.quante[1])); prossima = rnd(C.finte.secondi[0], C.finte.secondi[1]); } return; }
    const passo = Math.min(d, v * dt), nx = a.x + (dx / d) * passo, nz = a.z + (dz / d) * passo;
    if (!acqua(nx, nz) && a.stato === 'nuota') { a.hx = a.x; a.hz = a.z; return; } // non sale a riva: si gira
    a.x = nx; a.z = nz;
    const h = Math.atan2(dx, -dz); let dh = h - a.h; while (dh > Math.PI) dh -= Math.PI * 2; while (dh < -Math.PI) dh += Math.PI * 2;
    a.h += dh * Math.min(1, dt * 4);
  };

  // ——— test ———
  registerStateProvider('pesca', () => {
    const now = adesso();
    return {
      fase, dove, puoi: puoi(), canna: possiedeCanna(o.getLot()), barca: q, turno, stagione: stagioneAt(now), notte: notteAt(now), barra, tiraT, finte,
      esca: fase === 'spento' || fase === 'mira' ? null : { x: esca.x, z: esca.z, ok: esca.ok }, mira, preda: preda ? { k: preda.k, id: preda.def.id, stato: preda.stato } : null,
      bottone: btn.classList.contains('on') ? btn.textContent : null, pannello: panel.classList.contains('on') ? testo.textContent : null, cartello: preso.classList.contains('on') ? preso.textContent : null,
      stick: stick.on, ombre: [...ombre.values()].map((a) => ({ k: a.k, id: a.def.id, taglia: a.def.taglia, stato: a.stato, x: a.x, z: a.z })),
      pool: { riva: pesciAt('riva', now).map((d) => d.id), barca: pesciAt('barca', now).map((d) => d.id) },
      collezione: pesciOf(o.getLot(), now),
    };
  });
  registerTestHook('pescaEntra', () => entra());
  registerTestHook('pescaEsci', () => { esci(); return true; });
  /** Lancia l'esca nel punto (x, z) del mondo (dentro i limiti del lancio). */
  registerTestHook('pescaLancia', (x, z) => { if (fase !== 'mira') return false; mira = limita(Number(x), Number(z)); lancia(); return mira.ok; });
  registerTestHook('pescaA', (n) => { for (let i = 0; i < (Number(n) || 1); i++) premi(); return barra; });
  /** Porta l'avatar sulla terra del Borgo più vicina all'ombra di riva `k` (la prima se manca), girato verso di lei: {k, x, z} dell'ombra. */
  registerTestHook('pescaVai', (k) => {
    syncRiva(adesso());
    const lista = typeof k === 'string' ? [ombre.get(k)].flatMap((x) => x ?? []) : [...ombre.values()].filter((x) => x.k.startsWith('r:') && x.stato === 'nuota');
    for (const a of lista) {
      let best: { x: number; z: number } | null = null, bd = Infinity;
      for (let dz = -6; dz <= 6; dz++) for (let dx = -6; dx <= 6; dx++) {
        const c = w.map.worldToCell(a.hx, a.hz), cx = c.cx + dx, cz = c.cz + dz, p = { x: (cx + 0.5) * T, z: (cz + 0.5) * T };
        if (!w.map.walkable(p.x, p.z) || canBoard({ ...w.avatar.state, x: p.x, z: p.z }, w.boat.state, w.map)) continue; // vicino alla barca la A fa salire
        const d = Math.hypot(p.x - a.hx, p.z - a.hz);
        if (d < bd) { bd = d; best = p; }
      }
      if (!best) continue;
      w.avatar.teleport(best.x, best.z, Math.atan2(a.hx - best.x, -(a.hz - best.z)));
      a.x = a.hx; a.z = a.hz; a.t = 0;
      return { k: a.k, x: a.hx, z: a.hz };
    }
    return null;
  });
  /** Test: porta la barca (serve essere già in barca: setMode('boat')) nel punto da pesca più vicino, ferma. */
  registerTestHook('pescaBarcaVai', () => {
    const b = w.boat.state;
    for (let r = 8; r < 300; r += 4) for (let a = 0; a < 6.28; a += 0.25) {
      const x = b.x + Math.sin(a) * r, z = b.z + Math.cos(a) * r;
      if (barcaQui(arch, x, z, 0).ok) { w.boat.teleport(x, z); w.avatar.teleport(x, z); b.speed = 0; return { x, z }; }
    }
    return null;
  });
  /** Foto: le ombre (o i pesci `ids`) ferme in fila davanti a te, solo da guardare. */
  registerTestHook('pescaMostra', (ids) => {
    const c = centro(), list = Array.isArray(ids) && ids.length ? (ids as string[]).flatMap((id) => pesceDef(id) ?? []) : [1, 2, 3, 4, 5].flatMap((t) => C.pesci.find((p) => p.taglia === t) ?? []);
    mostra = list.map((d, i) => { const a = nuova('mostra:' + d.id, d, c.x - 4 + i * 2.2, c.z - 5, 0.2); a.alfa = 1; a.h = Math.PI / 2; return a; });
    return mostra.length;
  });

  let aWas = false, lastBtn = '', lastPanel = '';
  return {
    attiva: () => fase !== 'spento',
    azione() {
      if (fase === 'spento') return btn.classList.contains('on') && w.mode === 'walk' ? 'Pesca' : null;
      return fase === 'mira' ? 'Lancia' : fase === 'morso' ? 'Tira!' : fase === 'attesa' ? 'Tira su' : null;
    },
    tick(a) {
      const pa = (a && !aWas) || clic; aWas = a; clic = false;
      if (fase === 'spento') {
        if (pa && w.mode === 'walk' && possiedeCanna(o.getLot()) && davantiAcqua()) { entra(); return true; }
        return w.mode === 'walk' && possiedeCanna(o.getLot()) && davantiAcqua();
      }
      if (pa) premi();
      return true;
    },
    update(dt) {
      const now = adesso(), tempo = performance.now() / 1000;
      if (presoFino && performance.now() > presoFino) { preso.classList.remove('on'); presoFino = 0; }
      if (++qN % 6 === 0 || fase !== 'spento') { const b = w.boat.state; q = inBarca() ? barcaQui(arch, b.x, b.z, b.speed) : { ok: false, perche: 'terra' }; }
      syncRiva(now);
      // la barca: le sue ombre escono quando si ferma al largo, spariscono quando va via
      if (inBarca()) {
        const b = w.boat.state;
        if (q.ok && (!barcaC || Math.hypot(b.x - barcaC.x, b.z - barcaC.z) > SPOSTA)) spargiBarca(b.x, b.z, now);
        if (q.ok && !okWas && performance.now() - avvisoAt > AVVISO_MS) {
          avvisoAt = performance.now();
          if (possiedeCanna(o.getLot())) o.hud.toast(`Qui si pesca · ${coarse() ? 'tocca PESCA' : 'P'}`, 2500);
          else if (!cannaAvviso) { cannaAvviso = true; o.hud.toast('Con una canna da pesca (al negozio dei mobili) qui potresti pescare', 2800); }
        }
        okWas = q.ok;
      } else okWas = false;
      if (barcaC && Math.hypot(centro().x - barcaC.x, centro().z - barcaC.z) > VISTA) { for (const [k, a] of ombre) if (k.startsWith('b:') && a !== preda) ombre.delete(k); barcaC = null; }
      // uscire da soli: cambiato attrezzo, scesi dalla barca, entrati in casa…
      if (fase !== 'spento' && (dove === 'riva' ? !inBorgo() || o.inMano() !== 'canna' : !inBarca())) esci();
      faseT += dt;
      // le fasi
      if (fase === 'mira') {
        if (!miraStick()) miraMouse();
        if (w.mode === 'walk') guarda(mira.x, mira.z);
        const s = stick.sample();
        if (s.rel) lancia();
        else if (s.tap) { const c = centro(), a = w.mode === 'boat' ? { x: Math.sin(w.boat.state.yaw), z: -Math.cos(w.boat.state.yaw) } : avanti(), d = C.lancio.min + (C.lancio.max - C.lancio.min) * LANCIO_MEDIO; mira = limita(c.x + a.x * d, c.z + a.z * d); lancia(); }
      } else if (fase === 'volo') {
        const k = Math.min(1, faseT / C.lancio.secondi);
        esca.y = esca.y0 + (0 - esca.y0) * k + Math.sin(k * Math.PI) * 2.2;
        if (k >= 1) {
          esca.y = 0;
          if (!esca.ok) { o.hud.toast('Lì non c’è acqua: lancia in mare', 1800); metti('mira'); }
          else { suona('plop'); anello(esca.x, esca.z, 1); metti('attesa'); attesaT = 0; scegliT = 0; for (const a of ombre.values()) a.ignora = false; }
        }
      } else if (fase === 'attesa') {
        attesaT += dt; scegliT -= dt;
        if (!preda && scegliT <= 0) { scegliT = 1; scegli(); }
        if (preda?.stato === 'finte') {
          prossima -= dt;
          if (prossima <= 0) {
            if (finte > 0) { finte--; esca.dip = 1; anello(esca.x, esca.z, 0.6); suona('plop', 0.4); prossima = finte > 0 ? rnd(C.finte.secondi[0], C.finte.secondi[1]) : rnd(C.morso.secondi[0], C.morso.secondi[1]); }
            else { preda.stato = 'morde'; barra = 0; tiraT = C.tira.secondi; metti('morso'); suona('abbocca'); anello(esca.x, esca.z, 1.4); for (let i = 0; i < 3; i++) spruzzi.push({ x: esca.x, z: esca.z, t: i * 0.08 }); }
          }
        }
        if (!preda && attesaT > 7 && attesaT - dt <= 7) o.hud.toast('Lancia l’esca vicino a un’ombra', 2000);
      } else if (fase === 'morso' && preda) {
        const tg = tagliaDi(preda.def);
        barra = Math.max(0, barra - tg.cala * dt); tiraT -= dt;
        rollT += dt; if (rollT > 0.5) { rollT = 0; anello(esca.x, esca.z, 0.7); }
        if (barra >= tg.strappi) { const a = preda; preda = null; metti('preso'); a.stato = 'via'; a.alfa = 0; void tieni(a); for (let i = 0; i < 4; i++) spruzzi.push({ x: esca.x, z: esca.z, t: i * 0.06 }); }
        else if (tiraT <= 0) scappa('È scappato! Tocca più veloce');
      } else if ((fase === 'preso' && faseT > 1.2) || (fase === 'scappa' && faseT > 0.9)) metti('mira');
      esca.dip = Math.max(0, esca.dip - dt * 4);
      for (const [k, a] of ombre) { nuota(a, dt); if (a.stato === 'via' && a.alfa <= 0 && a !== preda) { ombre.delete(k); andati.add(k); } }
      disegna(dt, tempo);
      // bottoni e pannello
      const mostraBtn = fase === 'spento' && !!puoi() && !w.frozen;
      const bk = !mostraBtn ? '' : w.mode === 'walk' ? 'r' : 'b';
      if (bk !== lastBtn) { lastBtn = bk; btn.classList.toggle('on', mostraBtn); { const tasto = bk === 'b' ? (coarse() ? '' : 'P') : 'A'; btn.replaceChildren(pixIcon('pesca', 24), el('span', '', 'Pesca'), ...(tasto ? [el('small', '', tasto)] : [])); } }
      const stickOn = stick.setOn(fase === 'mira');
      o.root.classList.toggle('mz-pesca-mira', stickOn);
      if (fase === 'spento') { if (lastPanel) { lastPanel = ''; panel.classList.remove('on', 'tira'); } return; }
      const tg = preda ? tagliaDi(preda.def) : null;
      const pk = fase === 'mira' ? (coarse() ? 'Trascina il joystick di destra, lascia e l’esca parte' : 'Mira col mouse, clic (o A) per lanciare')
        : fase === 'volo' ? 'Lancio…'
        : fase === 'attesa' ? (preda ? 'Qualcosa si avvicina… aspetta che vada sotto!' : 'Aspetta che un’ombra si avvicini · A per tirare su')
        : fase === 'morso' ? 'Tira! Tocca A più veloce che puoi'
        : fase === 'preso' ? 'Preso!' : 'Scappato…';
      if (pk !== lastPanel) { lastPanel = pk; testo.replaceChildren(el('span', '', pk), el('small', '', (dove === 'barca' ? 'Dalla barca' : 'Da riva') + (coarse() ? '' : ' · Esc per smettere'))); }
      panel.classList.add('on'); panel.classList.toggle('tira', fase === 'morso');
      if (fase === 'morso' && tg) { barFill.style.width = `${Math.min(100, (barra / tg.strappi) * 100)}%`; barTempo.style.width = `${Math.max(0, 100 - (tiraT / C.tira.secondi) * 100) * 0.25}%`; }
    },
  };
}
