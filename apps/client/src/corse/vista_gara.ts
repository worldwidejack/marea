// La resa di una gara del motore v2 (docs/CORSE.md A11), riusabile: pista a nastro, veicoli (kit vero, animali piloti, avatar MAREA al
// volante), onda, effetti, camera, suoni, HUD, minimappa. La usa lo schermo delle Corse nel gioco (`index.ts`, #173). Non sa niente
// di input, rete o menù: riceve lo stato della gara (`GaraState`) a ogni frame e disegna. Porta di quanto sta nel banco di prova
// (`prova/main.ts`, che resta com'è per ora: pagina di sviluppo con le sue opzioni).
import * as THREE from 'three';
import { CORSE } from '@marea/content/corse.ts';
import type { GaraState, GaraView } from '@marea/sim/corse/gara.ts';
import { garaCorse } from '@marea/sim/corse/gara.ts';
import { nuovaTerna, terna } from '@marea/sim/corse/nastro.ts';
import { nastroDi, pistaCorse, veicoloCorse } from '@marea/sim/corse/pista.ts';
import type { Pista } from '@marea/sim/corse/pista.ts';
import { livelloDrift, nuovoVeicolo } from '@marea/sim/corse/veicolo.ts';
import type { Veicolo } from '@marea/sim/corse/veicolo.ts';
import type { Look } from '@marea/protocol';
import { P } from '../render/island_parts.ts';
import { createAvatar } from '../game/avatar.ts';
import type { Avatar } from '../game/avatar.ts';
import { creaLinee, creaMinimappa, creaParticelle, emettiVeicolo, urtoVeicolo } from './effetti.ts';
import { creaPista3d } from './nastro3d.ts';
import type { Pista3d } from './nastro3d.ts';
import { matOnda, ondaGeo } from './onda3d.ts';
import { creaSuoni } from './suoni.ts';
import { veicoloMesh } from './veicoli3d.ts';
import { PILOTI, caricaKit, kitPronto, loaderCorse, postoAvatar } from './veicoli_kit.ts';
import { creaRegia } from './regia.ts';
import type { Modo } from './regia.ts';
import { stileCorse } from './stile.ts';
import type { Amico } from './amici.ts';
import { creaOggetti3d, giroColpito } from './oggetti3d.ts';
import { fondalePista } from './fondale_piste.ts';
import { ICONA, stileKart } from './stile_kart.ts';
import { TICK_HZ } from '@marea/sim/constants.ts';
import type { Fondale } from './discesa/fondale.ts';

const COLORI = [P.rosso, P.giallo, P.acquaBassa, P.viola, P.erbaChiara];
const CASCHI = [P.pietraChiara, P.neroCaldo, P.neroCaldo, P.neroCaldo, P.neroCaldo];
/** Quello che serve alla resa per ogni veicolo: saltello del drift, angolo di traverso, e i valori di prima per vedere cosa è cambiato. */
type Vis = { hop: number; traverso: number; drift: number; lv: number; turbo: number; aria: boolean; vh: number; acro: number; scia: number; urti: number; rollio: number; becco: number; vPrima: number };
/** Dove stava un veicolo al tick prima (per disegnarlo a metà tra due tick, #277). */
type Posa0 = Pick<Veicolo, 'ramo' | 's' | 'lat' | 'h' | 'hf' | 'hl' | 'mf' | 'ml' | 'caduto'>;
const tempoGara = (ms: number) => { const t = Math.max(0, ms) / 1000, m = Math.floor(t / 60), sec = t - m * 60; return `${m}:${sec < 10 ? '0' : ''}${sec.toFixed(1).replace('.', ',')}`; };

/** `amici`: gara tra amici (corse/amici.ts): gli amici si disegnano come fantasmi e la posizione è quella tra amici.
 *  `succo` (prova A/B #277, la «B»): veicoli disegnati a metà tra due tick (`alpha`, 0-1), camera più pigra con l'obiettivo che si
 *  allarga con la velocità, veicolo che si piega in curva, beccheggia e vibra, fumo in drift. Come la prova Godot di Jack. */
export type OpzioniVista = { cam: Modo; effetti: boolean; auto: boolean; gasAuto: boolean; fine: boolean; ritirato?: boolean; amici?: Amico[]; succo?: boolean; alpha?: number };
/** Una riga della classifica d'arrivo (schermata dei risultati, #276). `ms` null = non arrivato; `stimato` = il tempo è una stima (bot ancora in pista). */
export type RigaArrivo = { nome: string; tu: boolean; ms: number | null; stimato: boolean; pilota: string | null; veicolo: string; look: Look | null };
export type VistaGara = {
  /** Costruisce la pista e i veicoli per la gara `s` (e comincia a caricare il kit dei veicoli veri). */
  mostra(s: GaraState): void;
  /** Prima di ogni tick della gara: si ricorda dove stavano i veicoli (per disegnarli a metà tra due tick). */
  primaDelPasso(s: GaraState): void;
  /** Un frame: posizioni, effetti, camera, suoni, HUD. `dt` in secondi. */
  aggiorna(s: GaraState, dt: number, o: OpzioniVista): void;
  /** Cambia camera, suoni e il resto senza ricostruire. */
  cameraSalta(): void;
  suoni: ReturnType<typeof creaSuoni>;
  /** Toglie tutto dalla scena e dallo schermo (la pista e i veicoli si buttano). */
  chiudi(): void;
  /** Mostra o nasconde l'interfaccia (HUD, mappa, linee). */
  interfaccia(on: boolean): void;
  /** Il tuo oggetto (gara CON OGGETTI, #250): cosa scrivere sul bottone USA e se si può usare. */
  readonly ogg: { etichetta: string; pronto: boolean; ogg: string };
  /** La classifica d'arrivo della gara in corso: tu, i tuoi bot e gli amici (`amici`), in ordine. */
  classificaFinale(amici?: Amico[]): RigaArrivo[];
  readonly gruppo: THREE.Group;
  /** Per i test: quanti veicoli, se l'avatar è seduto, dove sono la camera e il tuo veicolo. */
  info(): { veicoli: number; avatar: boolean; kit: boolean; camera: number[]; padre: string | null; tu: number[] | null; fantasmi: number; nomi: string[] };
};

export function creaVistaGara(o: { root: HTMLElement; camera: THREE.PerspectiveCamera; look: () => Look; onLuce?: (x: number, z: number) => void }): VistaGara {
  stileCorse(); stileKart();
  const gruppo = new THREE.Group(); gruppo.name = 'corse_gara';
  const matVeicoli = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  const materialeOnda = matOnda();
  const fx = creaParticelle(); gruppo.add(fx.mesh);
  const suoni = creaSuoni();
  const ogg3d = creaOggetti3d(o.root); gruppo.add(ogg3d.gruppo);
  let ogg = { etichetta: '', pronto: false, ogg: '' };
  const regia = creaRegia(o.camera);
  const linee = creaLinee(o.root), mappa = creaMinimappa(o.root, true);
  const hud = document.createElement('div'); hud.className = 'pp-hud'; o.root.appendChild(hud);
  const big = document.createElement('div'); big.className = 'pp-big'; big.style.display = 'none'; o.root.appendChild(big);
  const tst = document.createElement('div'); tst.className = 'pp-toast'; tst.style.display = 'none'; o.root.appendChild(tst);
  for (const e of [hud, big, tst, mappa.el, linee.el]) e.style.display = 'none';
  const classifica = document.createElement('div'); classifica.className = 'pp-amici'; classifica.style.display = 'none'; o.root.appendChild(classifica);
  if (!document.getElementById('pp-amici-style')) {
    const st = document.createElement('style'); st.id = 'pp-amici-style';
    st.textContent = `.pp-amici { position: absolute; left: max(8px, env(safe-area-inset-left, 0px)); top: calc(max(8px, env(safe-area-inset-top)) + 58px); pointer-events: none; z-index: 3; font: bold 12px ui-monospace, Menlo, monospace; color: ${P.sabbiaChiara}; }
.pp-amici div { padding: 2px 7px; margin-bottom: 3px; background: rgba(46,30,20,.82); border-left: 4px solid ${P.legnoChiaro}; white-space: nowrap; }
.pp-amici div.tu { color: ${P.giallo}; }
.pp-tag { position: absolute; left: 0; top: 0; transform: translate(-50%, -100%); padding: 1px 6px; background: rgba(46,30,20,.82); border: 2px solid ${P.legnoChiaro}; color: ${P.sabbiaChiara};
  font: bold 11px ui-monospace, Menlo, monospace; white-space: nowrap; pointer-events: none; z-index: 2; display: none; }`;
    document.head.appendChild(st);
  }

  let s: GaraState | null = null, p: Pista | null = null, p3d: Pista3d | null = null, fondale: Fondale | null = null;
  let meshes: THREE.Mesh[] = [], ondaMesh: THREE.Mesh | null = null, vis: Vis[] = [];
  let avatar: Avatar | null = null, avatarP: Promise<Avatar | null> | null = null;
  let contoPrima = 0, viaFlash = 0, tstT = 0, uiOn = true;
  /** Gli amici in pista (gara tra amici): veicolo stimato, mesh, avatar (il loro look), cartellino col nome. */
  type Fantasma = { a: Amico; k: Veicolo; mesh: THREE.Mesh; avatar: Avatar | null; tag: HTMLDivElement; visto: boolean; kit: boolean };
  let fantasmi: Fantasma[] = [];
  const T3 = nuovaTerna(), M4 = new THREE.Matrix4();
  let prima: Posa0[] = [], primaTick = -1, tVis = 0;
  const p0 = new THREE.Vector3(), f0 = new THREE.Vector3(), u0 = new THREE.Vector3(), m0 = new THREE.Vector3();
  const camW = new THREE.Vector3(), posT = new THREE.Vector3(), vF = new THREE.Vector3(), vU = new THREE.Vector3(), vR = new THREE.Vector3(), vP = new THREE.Vector3(), vM = new THREE.Vector3(), tmp = new THREE.Vector3();

  function toast(t: string | null, colore: string = P.sabbiaChiara) {
    tst.style.display = t ? 'block' : 'none'; if (!t) return;
    tst.textContent = t; tst.style.color = colore; tstT = 1.1;
  }
  const avatarCaricato = (): Promise<Avatar | null> => (avatarP ??= loaderCorse().then((l) => createAvatar({ loader: l, look: o.look(), x: 0, z: 0 })).catch((e) => { console.warn('[corse] avatar non caricato, resta il segnaposto', e); return null; }));
  async function siediAvatar(mesh: THREE.Mesh, id: string) {
    const a = await avatarCaricato(); if (!a || meshes[0] !== mesh) return;
    const { seat, scala } = postoAvatar(id, null);
    a.setLook(o.look()); a.attachTo(mesh, seat, 0); a.object.scale.setScalar(scala); a.visible = true; avatar = a;
  }
  /** I veicoli in scena: si rifanno anche quando arriva il kit, senza toccare la gara. */
  function veicoliMesh() {
    if (!s) return;
    for (const m of meshes) { gruppo.remove(m); m.geometry.dispose(); }
    const kit = kitPronto();
    meshes = s.veicoli.map((k, i) => {
      const m = veicoloMesh(k.id, COLORI[i % COLORI.length]!, CASCHI[i % CASCHI.length]!, null, i ? PILOTI[(i - 1) % PILOTI.length]! : null, !i && kit, matVeicoli);
      m.castShadow = true; m.matrixAutoUpdate = false; m.name = i ? `corse_bot_${i}` : 'corse_tu'; gruppo.add(m);
      return m;
    });
    if (kit) void siediAvatar(meshes[0]!, s.veicoli[0]!.id);
  }

  function mostra(gara: GaraState) {
    chiudiPista();
    document.body.classList.add('mz-kh'); document.body.classList.remove('mz-kh-fine');
    s = gara; p = pistaCorse(gara.pista); p3d = creaPista3d(p); gruppo.add(p3d.group);
    mappa.pista(p);
    fondale = fondalePista(p.def.id, p.def.zona); if (fondale) gruppo.add(fondale.mesh); // il panorama dipinto dietro (#258)
    veicoliMesh();
    if (p.def.inseguitore) {
      ondaMesh = new THREE.Mesh(ondaGeo(p.def.larghezza + p.def.bordo + 8), materialeOnda);
      ondaMesh.matrixAutoUpdate = false; ondaMesh.name = 'corse_onda'; ondaMesh.frustumCulled = false; gruppo.add(ondaMesh);
    }
    vis = gara.veicoli.map((k) => ({ hop: 0, traverso: 0, drift: 0, lv: 0, turbo: 0, aria: false, vh: 0, acro: 0, scia: 0, urti: k.urti, rollio: 0, becco: 0, vPrima: k.v }));
    prima = []; primaTick = -1;
    regia.st.ok = false; fx.svuota(); toast(null); contoPrima = 0; viaFlash = 0;
    void caricaKit().then(() => { if (s === gara) veicoliMesh(); }); // i veicoli veri arrivano appena i glb sono scaricati: intanto i segnaposto
  }
  function chiudiPista() {
    togliFantasmi();
    if (avatar) { avatar.attachTo(null); avatar.object.removeFromParent(); }
    for (const m of meshes) { gruppo.remove(m); m.geometry.dispose(); }
    meshes = [];
    if (ondaMesh) { gruppo.remove(ondaMesh); ondaMesh.geometry.dispose(); ondaMesh = null; }
    if (p3d) { gruppo.remove(p3d.group); p3d.group.traverse((x) => { const m = x as THREE.Mesh; if (m.isMesh) m.geometry.dispose(); }); p3d = null; }
    if (fondale) { gruppo.remove(fondale.mesh); fondale = null; } // resta in memoria per la prossima gara della zona
    s = null; p = null; fx.svuota(); ogg3d.chiudi(); ogg = { etichetta: '', pronto: false, ogg: '' };
  }

  /** Dove sta il veicolo `i` nel mondo: posizione, avanti (muso), sopra (la pista sotto di lui), destra e moto. */
  function posa(i: number | Posa0, pos: THREE.Vector3, fwd: THREE.Vector3, up: THREE.Vector3, moto?: THREE.Vector3) {
    const k = typeof i === 'number' ? s!.veicoli[i]! : i, n = nastroDi(p!, k.ramo);
    terna(n, k.s, T3);
    up.set(T3.ux, T3.uy, T3.uz).normalize();
    pos.set(T3.x + T3.rx * k.lat + up.x * k.h, T3.y + T3.ry * k.lat + up.y * k.h, T3.z + T3.rz * k.lat + up.z * k.h);
    fwd.set(T3.tx * k.hf + T3.rx * k.hl, T3.ty * k.hf + T3.ry * k.hl, T3.tz * k.hf + T3.rz * k.hl).normalize();
    moto?.set(T3.tx * k.mf + T3.rx * k.ml, T3.ty * k.mf + T3.ry * k.ml, T3.tz * k.mf + T3.rz * k.ml).normalize();
    if (k.caduto) pos.addScaledVector(up, -Math.min(6, k.caduto * 8)); // chi è caduto sprofonda
  }
  /** Come `posa`, ma con `succo` a metà tra il tick prima e questo (`alpha`): sullo schermo a 120 Hz il veicolo non va più a scatti
   *  (la gara fa 60 tick al secondo). Si disegna al massimo un tick indietro; dopo un salto di posto (caduta, ramo) niente mezzo. */
  function posaFluida(i: number, o2: OpzioniVista, pos: THREE.Vector3, fwd: THREE.Vector3, up: THREE.Vector3, moto: THREE.Vector3) {
    posa(i, pos, fwd, up, moto);
    const a = o2.alpha ?? 1, k0 = prima[i];
    if (!o2.succo || !k0 || primaTick !== s!.tick - 1 || a >= 1) return;
    posa(k0, p0, f0, u0, m0);
    if (p0.distanceToSquared(pos) > 100) return;
    pos.lerpVectors(p0, pos, a); fwd.lerpVectors(f0, fwd, a).normalize(); up.lerpVectors(u0, up, a).normalize(); moto.lerpVectors(m0, moto, a).normalize();
  }
  function togliFantasmi() {
    for (const f of fantasmi) { if (f.avatar) { f.avatar.attachTo(null); f.avatar.object.removeFromParent(); } gruppo.remove(f.mesh); f.mesh.geometry.dispose(); f.tag.remove(); }
    fantasmi = [];
  }
  function meshFantasma(f: { a: Amico; k: Veicolo }): THREE.Mesh {
    const kit = kitPronto(), m = veicoloMesh(f.k.id, COLORI[(f.a.i + 1) % COLORI.length]!, P.pietraChiara, null, null, kit, matVeicoli);
    m.castShadow = true; m.matrixAutoUpdate = false; m.name = `corse_amico_${f.a.i}`; gruppo.add(m);
    return m;
  }
  /** L'avatar MAREA dell'amico (il suo look) al volante: uno a testa, caricato una volta. */
  function siediAmico(f: Fantasma) {
    if (!f.kit) return;
    void loaderCorse().then((l) => createAvatar({ loader: l, look: f.a.look, x: 0, z: 0 })).then((a) => {
      if (!fantasmi.includes(f) || !f.kit) { a.object.removeFromParent(); return; }
      const { seat, scala } = postoAvatar(f.k.id, null);
      a.attachTo(f.mesh, seat, 0); a.object.scale.setScalar(scala); a.visible = true; f.avatar = a;
    }).catch(() => { /* resta il veicolo senza pilota */ });
  }
  /** Dove sta un amico adesso: l'ultima posizione ricevuta portata avanti con la sua velocità (al massimo 0,3 s), poi ammorbidita. */
  function muoviFantasma(f: Fantasma, dt: number) {
    const q = f.a.q, pp = p!; if (!q) { f.visto = false; return; }
    const [prog, ramo, sQ, lat, h, hf, hl, v, drift, giro, caduto] = q;
    const n = nastroDi(pp, ramo < 0 ? -1 : ramo), age = f.a.fine !== null ? 0 : Math.min(0.3, (performance.now() - f.a.t) / 1000);
    let sv = sQ + v * hf * age;
    if (n.chiuso) sv = ((sv % n.len) + n.len) % n.len; else sv = Math.max(0, Math.min(n.len, sv));
    const k = f.k, nuovo = !f.visto || k.ramo !== ramo;
    let ds = sv - k.s;
    if (n.chiuso) { if (ds > n.len / 2) ds -= n.len; else if (ds < -n.len / 2) ds += n.len; }
    const a = nuovo || Math.abs(ds) > 15 ? 1 : 1 - Math.exp(-dt * 14);
    k.ramo = ramo; k.s = k.s + ds * a; if (n.chiuso) k.s = ((k.s % n.len) + n.len) % n.len;
    k.lat += (lat - k.lat) * a; k.h += (h - k.h) * a; k.hf = hf; k.hl = hl; k.mf = hf; k.ml = hl; k.v = v; k.drift = drift; k.giro = giro; k.prog = prog; k.caduto = caduto ? 1 : 0;
    f.visto = true;
  }
  function aggiornaFantasmi(dt: number, lista: Amico[] | undefined) {
    if (!lista?.length) { if (fantasmi.length) togliFantasmi(); return; }
    // nuovi amici (o il kit appena arrivato: si rifà il veicolo vero)
    for (const a of lista) {
      let f = fantasmi.find((x) => x.a === a);
      if (!f) {
        const k = nuovoVeicolo(p!, CORSE.veicoli.some((v) => v.id === a.veicolo) ? a.veicolo : 'kart', 0, 0);
        const tag = document.createElement('div'); tag.className = 'pp-tag'; tag.textContent = a.nome; tag.style.borderColor = COLORI[(a.i + 1) % COLORI.length]!; o.root.appendChild(tag);
        f = { a, k, mesh: null as unknown as THREE.Mesh, avatar: null, tag, visto: false, kit: kitPronto() };
        f.mesh = meshFantasma(f); fantasmi.push(f); siediAmico(f);
      } else if (!f.kit && kitPronto()) {
        gruppo.remove(f.mesh); f.mesh.geometry.dispose(); f.kit = true; f.mesh = meshFantasma(f); siediAmico(f);
      }
    }
    for (const f of fantasmi) {
      muoviFantasma(f, dt);
      f.mesh.visible = f.visto && !f.k.caduto;
      if (!f.visto) continue;
      posa(f.k, vP, vF, vU, vM);
      vR.crossVectors(vF, vU).normalize();
      const tr = f.k.drift * 0.32, c = Math.cos(tr), sn = Math.sin(tr);
      tmp.copy(vF).multiplyScalar(c).addScaledVector(vR, sn); vF.copy(tmp); vR.crossVectors(vF, vU).normalize();
      M4.makeBasis(vR, vU, tmp.copy(vF).negate()).setPosition(vP);
      f.mesh.matrix.copy(M4); f.mesh.matrixWorldNeedsUpdate = true;
      f.avatar?.update(1, dt);
    }
  }
  /** Il nome sopra la testa degli amici davanti alla camera e non troppo lontani: dopo la regia (nel gioco il mondo sposta la camera prima di noi). */
  function cartellini() {
    if (!fantasmi.length) return;
    o.camera.updateMatrixWorld();
    const r = o.root.getBoundingClientRect(), cam = o.camera.getWorldPosition(camW);
    for (const f of fantasmi) {
      if (!f.visto || f.k.caduto) { f.tag.style.display = 'none'; continue; }
      const e = f.mesh.matrix.elements;
      posT.set(e[12]!, e[13]!, e[14]!);
      tmp.set(e[4]!, e[5]!, e[6]!).multiplyScalar(2.4).add(posT).project(o.camera);
      if (cam.distanceToSquared(posT) > 140 * 140 || tmp.z >= 1 || Math.abs(tmp.x) > 1.05 || Math.abs(tmp.y) > 1.05) { f.tag.style.display = 'none'; continue; }
      f.tag.style.display = 'block';
      f.tag.style.left = `${Math.round(((tmp.x + 1) / 2) * r.width)}px`; f.tag.style.top = `${Math.round(((1 - tmp.y) / 2) * r.height)}px`;
    }
  }
  /** La posizione tra amici: davanti chi è arrivato prima, poi chi ha fatto più strada. */
  function posTraAmici(lista: Amico[], k: Veicolo, msMio: number): { pos: number; tot: number; righe: { nome: string; tu: boolean; fine: number | null }[] } {
    const fineMio = k.fine ? msMio : null;
    const tutti = [{ nome: 'TU', tu: true, fine: fineMio, prog: k.prog }, ...lista.map((a) => ({ nome: a.nome, tu: false, fine: a.fine !== null && a.fine >= 0 ? a.fine : null, prog: a.q ? a.q[0] : -1e9 }))];
    tutti.sort((a, b) => (a.fine !== null || b.fine !== null ? (a.fine ?? Infinity) - (b.fine ?? Infinity) : b.prog - a.prog));
    return { pos: tutti.findIndex((x) => x.tu) + 1, tot: tutti.length, righe: tutti };
  }

  function classificaFinale(amici: Amico[] = []): RigaArrivo[] {
    const gs = s, pp = p; if (!gs || !pp) return [];
    const strada = pp.def.tipo === 'fuga' ? pp.arrivo : pp.arrivo * pp.def.giri, ms = (t: number) => Math.round((t / TICK_HZ) * 1000);
    type R = RigaArrivo & { prog: number };
    const righe: R[] = gs.veicoli.map((k, i) => {
      const pilota = i ? PILOTI[(i - 1) % PILOTI.length]! : null;
      return { nome: pilota ? pilota.replace('cs_p_', '') : 'TU', tu: !i, ms: k.fine ? ms(k.fine) : null, stimato: false, pilota, veicolo: k.id, look: i ? null : o.look(), prog: k.prog };
    });
    for (const a of amici) righe.push({ nome: a.nome, tu: false, ms: a.fine !== null && a.fine >= 0 ? a.fine : null, stimato: false, pilota: null, veicolo: a.veicolo, look: a.look, prog: a.q ? a.q[0] : -1e9 });
    // prima chi è arrivato (per tempo), poi chi è ancora in pista (per strada fatta): i bot hanno un tempo stimato dalla loro andatura
    righe.sort((x, y) => (x.ms !== null || y.ms !== null ? (x.ms ?? Infinity) - (y.ms ?? Infinity) : y.prog - x.prog));
    let ultimo = 0;
    for (const r of righe) {
      if (r.ms === null && r.pilota && gs.tick > 0 && r.prog > 0) { r.ms = Math.max(ultimo + 100, ms(gs.tick + Math.max(0, strada - r.prog) / (r.prog / gs.tick))); r.stimato = true; }
      if (r.ms !== null) ultimo = r.ms;
    }
    return righe.map(({ prog: _p, ...r }) => r);
  }

  function aggiornaVeicoli(dt: number, o2: OpzioniVista) {
    const gs = s!, pp = p!;
    if (ondaMesh) { // l'onda sta sul nastro principale, al centro, col muso (la cresta) verso l'arrivo
      const so = Math.max(0, Math.min(pp.n.len, pp.def.via + gs.onda));
      terna(pp.n, so, T3);
      vU.set(T3.ux, T3.uy, T3.uz).normalize(); vR.set(T3.rx, T3.ry, T3.rz); vF.set(-T3.tx, -T3.ty, -T3.tz);
      M4.makeBasis(vR, vU, vF).setPosition(T3.x, T3.y, T3.z);
      ondaMesh.matrix.copy(M4); ondaMesh.matrixWorldNeedsUpdate = true;
    }
    tVis += dt;
    for (let i = 0; i < meshes.length; i++) {
      const k = gs.veicoli[i]!, w = vis[i]!;
      posaFluida(i, o2, vP, vF, vU, vM);
      vR.crossVectors(vF, vU).normalize();
      // il saltello quando parte il drift, e il veicolo di traverso (un po' più di quanto dice la sim: si deve vedere)
      if (k.drift && !w.drift) w.hop = 0.001;
      if (w.hop > 0) { w.hop += dt; if (w.hop > 0.26) w.hop = 0; }
      w.traverso += (k.drift * 0.32 - w.traverso) * Math.min(1, dt * 10);
      const hop = w.hop > 0 ? 4 * 0.38 * (w.hop / 0.26) * (1 - w.hop / 0.26) : 0;
      const c = Math.cos(w.traverso), sn = Math.sin(w.traverso);
      tmp.copy(vF).multiplyScalar(c).addScaledVector(vR, sn); vF.copy(tmp); vR.crossVectors(vF, vU).normalize();
      const gc = giroColpito(gs, i);
      if (gc) { const c2 = Math.cos(gc), s2 = Math.sin(gc); tmp.copy(vF).multiplyScalar(c2).addScaledVector(vR, s2); vF.copy(tmp); vR.crossVectors(vF, vU).normalize(); } // colpito da un oggetto: gira su sé stesso
      if (k.acro > 0) { // l'acrobazia: un avvitamento intorno al muso
        const a = Math.PI * 2 * Math.min(1, k.acro / 0.42), ca = Math.cos(a), sa = Math.sin(a);
        tmp.copy(vU).multiplyScalar(ca).addScaledVector(vR, sa); vU.copy(tmp); vR.crossVectors(vF, vU).normalize();
      }
      if (k.spinta) { const r = -k.spinta * 0.04; tmp.copy(vU).multiplyScalar(Math.cos(r)).addScaledVector(vR, Math.sin(r)); vU.copy(tmp).normalize(); vR.crossVectors(vF, vU).normalize(); } // la botta di un urto: si piega
      if (o2.succo) { // la «B» (#277): in curva si piega verso fuori, accelerando alza il muso (frenando lo abbassa), il motore vibra
        const corre = Math.min(1, Math.max(0, k.v) / 30), acc = dt > 0 ? (k.v - w.vPrima) / dt : 0;
        w.vPrima = k.v;
        w.rollio += (-k.st * corre * (k.drift ? 0.2 : 0.11) - w.rollio) * (1 - Math.exp(-dt * 8));
        w.becco += (Math.max(-0.06, Math.min(0.06, acc * 0.004)) - w.becco) * (1 - Math.exp(-dt * 6));
        const r = w.rollio, b = w.becco;
        tmp.copy(vU).multiplyScalar(Math.cos(r)).addScaledVector(vR, Math.sin(r)); vU.copy(tmp).normalize(); vR.crossVectors(vF, vU).normalize();
        tmp.copy(vF).multiplyScalar(Math.cos(b)).addScaledVector(vU, Math.sin(b)); vU.addScaledVector(vF, -Math.sin(b)).normalize(); vF.copy(tmp).normalize(); vR.crossVectors(vF, vU).normalize();
        if (!k.aria) vP.addScaledVector(vU, 0.035 * Math.sin(tVis * 38 + i * 1.7) * corre);
        if (k.drift && !k.aria && o2.effetti && Math.random() < dt * 30) { // fumo delle gomme in drift, dalla ruota dietro di fuori
          tmp.copy(vP).addScaledVector(vF, -0.9).addScaledVector(vR, (k.drift > 0 ? -1 : 1) * 0.7).addScaledVector(vU, 0.2);
          fx.fumo(tmp, posT.copy(vM).multiplyScalar(Math.max(0, k.v) * 0.25).addScaledVector(vU, 0.9), P.pietraChiara, 0.4, 0.12);
        }
      }
      vP.addScaledVector(vU, hop);
      if (k.fermo > 0 && !gc) vP.addScaledVector(vR, (Math.random() - 0.5) * 0.08); // motore ingolfato: trema
      M4.makeBasis(vR, vU, tmp.copy(vF).negate()).setPosition(vP);
      meshes[i]!.matrix.copy(M4); meshes[i]!.matrixWorldNeedsUpdate = true;
      if (k.urti > w.urti && o2.effetti && o.camera.position.distanceToSquared(vP) < 60 * 60) urtoVeicolo(fx, k, vP, vU, vR, vM); // urto con un altro veicolo (#255)
      if (o2.effetti && !k.caduto && (i === 0 || o.camera.position.distanceToSquared(vP) < 60 * 60)) emettiVeicolo(fx, k, i === 0 && k.scia > 0.15 && w.scia <= k.scia, o2.fine ? 0 : Math.max(0, k.v), vP, vF, vU, vR, vM);
    }
  }
  /** Messaggi e suoni quando cambia qualcosa (livello del drift, turbo, acrobazia, scia, atterraggi). */
  function eventi() {
    const gs = s!, k = gs.veicoli[0]!, w = vis[0]!, lv = k.drift ? livelloDrift(k.carica) : 0;
    if (lv > w.lv) suoni.livello(lv);
    if (k.turbo > w.turbo + 0.05) {
      suoni.turbo(k.livello); regia.st.pugno = 8 + 2 * Math.min(3, k.livello); regia.st.scossa = Math.max(regia.st.scossa, 0.1);
      if (w.scia > CORSE.scia.secondi * 0.6 && k.scia === 0) { toast('SCIA!', P.pietraChiara); suoni.scia(); }
      else if (w.acro > 0 && k.acro === 0) toast('ACROBAZIA!', P.ambraNeon);
    }
    if (k.acro > 0 && w.acro === 0) suoni.acrobazia();
    if (w.aria && !k.aria && !k.caduto) { const urto = Math.max(0, -w.vh); suoni.atterra(urto); regia.st.scossa = Math.max(regia.st.scossa, Math.min(0.35, urto * 0.025)); }
      if (k.urti > w.urti) { suoni.urto(k.botta); regia.st.scossa = Math.max(regia.st.scossa, Math.min(0.4, 0.12 + k.botta * 0.025)); } // urto con un altro veicolo (#255)
    for (let i = 0; i < vis.length; i++) {
      const x = gs.veicoli[i]!, y = vis[i]!;
      y.drift = x.drift; y.turbo = x.turbo; y.aria = x.aria; y.vh = x.vh; y.acro = x.acro; y.scia = x.scia; y.urti = x.urti;
    }
    w.lv = lv;
  }
  function aggiornaHud(v: GaraView, dt: number, o2: OpzioniVista) {
    const gs = s!, pp = p!, k = gs.veicoli[0]!;
    const ta = o2.amici?.length ? posTraAmici(o2.amici, k, v.ms) : null;
    // tra amici coi bot: la posizione tra i miei bot più gli amici davanti; senza bot solo tra amici
    const pos = ta ? (gs.veicoli.length > 1 ? v.posizioni[0]! + ta.pos - 1 : ta.pos) : v.posizioni[0], tot = ta ? gs.veicoli.length + ta.tot - 1 : gs.veicoli.length;
    classifica.style.display = ta ? 'block' : 'none';
    if (ta) classifica.innerHTML = ta.righe.map((x, i) => `<div class="${x.tu ? 'tu' : ''}">${i + 1}° ${x.nome.replace(/[<>&]/g, '')}${x.fine !== null ? ' · ' + tempoGara(x.fine) : ''}</div>`).join('');
    // il look kart (#276, hud_5_sonic_bis.jpg): «2°» in alto a sinistra, giro e tempo al centro, velocità in basso a destra
    const kmh = Math.round(Math.abs(k.v) * 3.6), pieno = Math.max(0, Math.min(1, Math.abs(k.v) / veicoloCorse(k.id).velocita));
    const tacche = Array.from({ length: 7 }, (_, i) => `<u class="${i < Math.round(pieno * 7) ? 'on' : ''}${i === 6 ? ' c' : ''}"></u>`).join('');
    const giro = pp.def.tipo === 'fuga' ? '<span>FUGA</span>' : `<span>GIRO</span><em>${v.giro}/${v.giri}</em>`;
    const onda = v.onda === null ? '' : `<div class="kh-pill${v.ondaDist < 25 ? ' onda' : ''}"><span>ONDA</span><em>${v.ondaDist < 0 ? '!!' : Math.round(v.ondaDist) + ' m'}</em></div>`;
    hud.dataset['pos'] = String(pos); hud.dataset['tot'] = String(tot);
    hud.innerHTML = `<div class="kh-pos"><b>${pos}<sup>°</sup></b></div>`
      + `<div class="kh-su"><div class="kh-pill giro"><i>${ICONA.bandiera}</i>${giro}</div><div class="kh-pill tempo"><i>${ICONA.cronometro}</i><span>${tempoGara(v.ms)}</span></div>${onda}</div>`
      + `<div class="kh-vel${k.turbo > 0 ? ' turbo' : ''}"><b>${kmh}</b><small>km/h</small><i class="seg">${tacche}</i></div>`;
    // il semaforo: 3, 2, 1, VIA (coi bip), e com'è andata la partenza
    const conto = Math.ceil(v.via);
    if (conto !== contoPrima) {
      if (conto > 0) suoni.bip(false);
      else if (contoPrima > 0 && gs.tick < 30) {
        suoni.bip(true); viaFlash = 0.8;
        if (k.partenza === 2) toast('PARTENZA RAZZO!', P.violaNeon);
        else if (k.partenza === 1) toast('BUONA PARTENZA', P.cianoNeon);
        else if (k.partenza === -1) { toast('MOTORE INGOLFATO!', P.rosso); suoni.ingolfato(); }
      }
      contoPrima = conto;
    }
    viaFlash = Math.max(0, viaFlash - dt);
    tstT -= dt; if (tstT <= 0 && tst.style.display !== 'none') toast(null);
    const scritta = (t: string, colore: string, sotto = '') => {
      big.style.display = 'block'; big.style.color = colore; big.classList.toggle('lungo', t.length > 3);
      big.innerHTML = `${t}${sotto ? `<small>${sotto}</small>` : ''}`;
    };
    if (v.via > 0) scritta(String(conto), conto > 1 ? '#ff5a4a' : '#ffd21f', `${gs.regole.partenza ? (o2.auto ? 'pilota automatico' : 'dai GAS quando compare l\'1') : pp.def.nome}${o2.gasAuto ? ' · il gas è automatico' : ''}`);
    else if (viaFlash > 0) scritta('VIA!', '#7be35a');
    else if (o2.fine) scritta(o2.ritirato ? 'RITIRATO' : v.finished ? 'ARRIVO!' : 'TEMPO SCADUTO', '#ffffff', o2.ritirato ? '' : v.finished ? `${pos}° · ${tempoGara(v.ms)}` : '');
    else if (k.caduto) scritta('CADUTO!', '#ffffff', 'si riparte');
    else if (v.onda !== null && v.ondaDist < 0 && v.ondaDist > -(pp.def.inseguitore?.spessore ?? 0)) scritta('TRAVOLTO!', '#ffffff', 'l\'onda ti ha preso');
    else { big.style.display = 'none'; big.classList.remove('lungo'); }
    if (p3d) for (const e of p3d.eventi) e.mesh.visible = k.giro + 1 >= e.daGiro !== !!e.sparisce;
    mappa.disegna(gs.veicoli.map((x, i) => {
      terna(nastroDi(pp, x.ramo), x.s, T3);
      return { x: T3.x + T3.rx * x.lat, z: T3.z + T3.rz * x.lat, colore: COLORI[i % COLORI.length]!, tu: i === 0 };
    }).concat(fantasmi.filter((f) => f.visto).map((f) => {
      terna(nastroDi(pp, f.k.ramo), f.k.s, T3);
      return { x: T3.x + T3.rx * f.k.lat, z: T3.z + T3.rz * f.k.lat, colore: COLORI[(f.a.i + 1) % COLORI.length]!, tu: false };
    })));
    linee.disegna(o2.effetti && !o2.fine ? (k.turbo > 0 ? 1 : k.scia > 0.2 ? 0.35 : 0) : 0, k.turbo > 0 ? P.sabbiaChiara : P.pietraChiara);
  }

  return {
    gruppo, suoni,
    mostra,
    primaDelPasso(gara) {
      if (gara !== s) return;
      prima = gara.veicoli.map((k, i) => { const x = prima[i] ?? ({} as Posa0); x.ramo = k.ramo; x.s = k.s; x.lat = k.lat; x.h = k.h; x.hf = k.hf; x.hl = k.hl; x.mf = k.mf; x.ml = k.ml; x.caduto = k.caduto; return x; });
      primaTick = gara.tick;
    },
    aggiorna(gara, dt, o2) {
      if (!s || gara !== s || !p) return;
      aggiornaVeicoli(dt, o2);
      aggiornaFantasmi(dt, o2.amici);
      ogg = ogg3d.aggiorna(gara, p, dt, o2.fine ? null : suoni, o.camera);
      avatar?.update(1, dt); fx.aggiorna(dt);
      posaFluida(0, o2, vP, vF, vU, vM);
      const w = vis[0]!, hop = w.hop > 0 ? 1.52 * (w.hop / 0.26) * (1 - w.hop / 0.26) : 0;
      regia.segui(o2.cam, { pos: vP, fwd: vF, up: vU, moto: vM, k: gara.veicoli[0]!, p, onda: gara.onda, hop, effetti: o2.effetti, dt, ...(o2.succo ? { succo: veicoloCorse(gara.veicoli[0]!.id).velocita } : {}) });
      fondale?.segui(o.camera);
      cartellini();
      eventi();
      const k = gara.veicoli[0]!;
      if (!o2.fine && gara.tick > 0) suoni.motore(k.v, veicoloCorse(k.id).velocita, k.turbo > 0, k.drift !== 0, !k.aria);
      o.onLuce?.(vP.x, vP.z);
      if (uiOn) aggiornaHud(garaCorse.view(gara) as GaraView, dt, o2); // sotto i risultati (#276) la gara resta ferma, senza HUD
    },
    get ogg() { return ogg; },
    classificaFinale,
    cameraSalta() { regia.st.ok = false; },
    chiudi() { chiudiPista(); suoni.zitto(); document.body.classList.remove('mz-kh', 'mz-kh-fine'); for (const e of [hud, big, tst, mappa.el, linee.el, classifica]) e.style.display = 'none'; },
    interfaccia(on) { uiOn = on; ogg3d.interfaccia(on); for (const e of [hud, mappa.el, linee.el]) e.style.display = on ? '' : 'none'; if (!on) { big.style.display = 'none'; tst.style.display = 'none'; classifica.style.display = 'none'; } },
    info: () => ({ veicoli: meshes.length, avatar: !!avatar?.attached, kit: kitPronto(), camera: o.camera.getWorldPosition(new THREE.Vector3()).toArray().map((x) => Math.round(x * 10) / 10), padre: o.camera.parent?.type ?? null, tu: meshes[0] ? meshes[0].matrix.elements.slice(12, 15).map((x) => Math.round(x * 10) / 10) : null, fantasmi: fantasmi.filter((f) => f.visto).length, nomi: fantasmi.filter((f) => f.tag.style.display === 'block').map((f) => f.a.nome) }),
  };
}
