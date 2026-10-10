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
import { creaLinee, creaMinimappa, creaParticelle, emettiVeicolo } from './effetti.ts';
import { creaPista3d } from './nastro3d.ts';
import type { Pista3d } from './nastro3d.ts';
import { matOnda, ondaGeo } from './onda3d.ts';
import { creaSuoni } from './suoni.ts';
import { veicoloGeo } from './veicoli3d.ts';
import { PILOTI, caricaKit, kitPronto, loaderCorse, postoAvatar } from './veicoli_kit.ts';
import { creaRegia } from './prova/camera.ts';
import type { Modo } from './prova/camera.ts';
import { stileProva } from './prova/stile.ts';
import type { Amico } from './amici.ts';

const COLORI = [P.rosso, P.giallo, P.acquaBassa, P.viola, P.erbaChiara];
const CASCHI = [P.pietraChiara, P.neroCaldo, P.neroCaldo, P.neroCaldo, P.neroCaldo];
/** Quello che serve alla resa per ogni veicolo: saltello del drift, angolo di traverso, e i valori di prima per vedere cosa è cambiato. */
type Vis = { hop: number; traverso: number; drift: number; lv: number; turbo: number; aria: boolean; vh: number; acro: number; scia: number };
export const tempoGara = (ms: number) => { const t = Math.max(0, ms) / 1000, m = Math.floor(t / 60), sec = t - m * 60; return `${m}:${sec < 10 ? '0' : ''}${sec.toFixed(1).replace('.', ',')}`; };

/** `amici`: gara tra amici (corse/amici.ts): gli amici si disegnano come fantasmi e la posizione è quella tra amici. */
export type OpzioniVista = { cam: Modo; effetti: boolean; auto: boolean; gasAuto: boolean; fine: boolean; ritirato?: boolean; amici?: Amico[] };
export type VistaGara = {
  /** Costruisce la pista e i veicoli per la gara `s` (e comincia a caricare il kit dei veicoli veri). */
  mostra(s: GaraState): void;
  /** Un frame: posizioni, effetti, camera, suoni, HUD. `dt` in secondi. */
  aggiorna(s: GaraState, dt: number, o: OpzioniVista): void;
  /** Cambia camera, suoni e il resto senza ricostruire. */
  cameraSalta(): void;
  suoni: ReturnType<typeof creaSuoni>;
  /** Toglie tutto dalla scena e dallo schermo (la pista e i veicoli si buttano). */
  chiudi(): void;
  /** Mostra o nasconde l'interfaccia (HUD, mappa, linee). */
  interfaccia(on: boolean): void;
  readonly gruppo: THREE.Group;
  /** Per i test: quanti veicoli, se l'avatar è seduto, dove sono la camera e il tuo veicolo. */
  info(): { veicoli: number; avatar: boolean; kit: boolean; camera: number[]; padre: string | null; tu: number[] | null; fantasmi: number; nomi: string[] };
};

export function creaVistaGara(o: { root: HTMLElement; camera: THREE.PerspectiveCamera; look: () => Look; onLuce?: (x: number, z: number) => void }): VistaGara {
  stileProva();
  const gruppo = new THREE.Group(); gruppo.name = 'corse_gara';
  const matVeicoli = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  const materialeOnda = matOnda();
  const fx = creaParticelle(); gruppo.add(fx.mesh);
  const suoni = creaSuoni();
  const regia = creaRegia(o.camera);
  const linee = creaLinee(o.root), mappa = creaMinimappa(o.root);
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

  let s: GaraState | null = null, p: Pista | null = null, p3d: Pista3d | null = null;
  let meshes: THREE.Mesh[] = [], ondaMesh: THREE.Mesh | null = null, vis: Vis[] = [];
  let avatar: Avatar | null = null, avatarP: Promise<Avatar | null> | null = null;
  let contoPrima = 0, viaFlash = 0, tstT = 0;
  /** Gli amici in pista (gara tra amici): veicolo stimato, mesh, avatar (il loro look), cartellino col nome. */
  type Fantasma = { a: Amico; k: Veicolo; mesh: THREE.Mesh; avatar: Avatar | null; tag: HTMLDivElement; visto: boolean; kit: boolean };
  let fantasmi: Fantasma[] = [];
  const T3 = nuovaTerna(), M4 = new THREE.Matrix4();
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
      const m = new THREE.Mesh(veicoloGeo(k.id, COLORI[i % COLORI.length]!, CASCHI[i % CASCHI.length]!, null, i ? PILOTI[(i - 1) % PILOTI.length]! : null, !i && kit), matVeicoli);
      m.castShadow = true; m.matrixAutoUpdate = false; m.name = i ? `corse_bot_${i}` : 'corse_tu'; gruppo.add(m);
      return m;
    });
    if (kit) void siediAvatar(meshes[0]!, s.veicoli[0]!.id);
  }

  function mostra(gara: GaraState) {
    chiudiPista();
    s = gara; p = pistaCorse(gara.pista); p3d = creaPista3d(p); gruppo.add(p3d.group);
    mappa.pista(p);
    veicoliMesh();
    if (p.def.inseguitore) {
      ondaMesh = new THREE.Mesh(ondaGeo(p.def.larghezza + p.def.bordo + 8), materialeOnda);
      ondaMesh.matrixAutoUpdate = false; ondaMesh.name = 'corse_onda'; ondaMesh.frustumCulled = false; gruppo.add(ondaMesh);
    }
    vis = gara.veicoli.map(() => ({ hop: 0, traverso: 0, drift: 0, lv: 0, turbo: 0, aria: false, vh: 0, acro: 0, scia: 0 }));
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
    s = null; p = null; fx.svuota();
  }

  /** Dove sta il veicolo `i` nel mondo: posizione, avanti (muso), sopra (la pista sotto di lui), destra e moto. */
  function posa(i: number | Veicolo, pos: THREE.Vector3, fwd: THREE.Vector3, up: THREE.Vector3, moto?: THREE.Vector3) {
    const k = typeof i === 'number' ? s!.veicoli[i]! : i, n = nastroDi(p!, k.ramo);
    terna(n, k.s, T3);
    up.set(T3.ux, T3.uy, T3.uz).normalize();
    pos.set(T3.x + T3.rx * k.lat + up.x * k.h, T3.y + T3.ry * k.lat + up.y * k.h, T3.z + T3.rz * k.lat + up.z * k.h);
    fwd.set(T3.tx * k.hf + T3.rx * k.hl, T3.ty * k.hf + T3.ry * k.hl, T3.tz * k.hf + T3.rz * k.hl).normalize();
    moto?.set(T3.tx * k.mf + T3.rx * k.ml, T3.ty * k.mf + T3.ry * k.ml, T3.tz * k.mf + T3.rz * k.ml).normalize();
    if (k.caduto) pos.addScaledVector(up, -Math.min(6, k.caduto * 8)); // chi è caduto sprofonda
  }
  function togliFantasmi() {
    for (const f of fantasmi) { if (f.avatar) { f.avatar.attachTo(null); f.avatar.object.removeFromParent(); } gruppo.remove(f.mesh); f.mesh.geometry.dispose(); f.tag.remove(); }
    fantasmi = [];
  }
  function meshFantasma(f: { a: Amico; k: Veicolo }): THREE.Mesh {
    const kit = kitPronto(), m = new THREE.Mesh(veicoloGeo(f.k.id, COLORI[(f.a.i + 1) % COLORI.length]!, P.pietraChiara, null, null, kit), matVeicoli);
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

  function aggiornaVeicoli(dt: number, o2: OpzioniVista) {
    const gs = s!, pp = p!;
    if (ondaMesh) { // l'onda sta sul nastro principale, al centro, col muso (la cresta) verso l'arrivo
      const so = Math.max(0, Math.min(pp.n.len, pp.def.via + gs.onda));
      terna(pp.n, so, T3);
      vU.set(T3.ux, T3.uy, T3.uz).normalize(); vR.set(T3.rx, T3.ry, T3.rz); vF.set(-T3.tx, -T3.ty, -T3.tz);
      M4.makeBasis(vR, vU, vF).setPosition(T3.x, T3.y, T3.z);
      ondaMesh.matrix.copy(M4); ondaMesh.matrixWorldNeedsUpdate = true;
    }
    for (let i = 0; i < meshes.length; i++) {
      const k = gs.veicoli[i]!, w = vis[i]!;
      posa(i, vP, vF, vU, vM);
      vR.crossVectors(vF, vU).normalize();
      // il saltello quando parte il drift, e il veicolo di traverso (un po' più di quanto dice la sim: si deve vedere)
      if (k.drift && !w.drift) w.hop = 0.001;
      if (w.hop > 0) { w.hop += dt; if (w.hop > 0.26) w.hop = 0; }
      w.traverso += (k.drift * 0.32 - w.traverso) * Math.min(1, dt * 10);
      const hop = w.hop > 0 ? 4 * 0.38 * (w.hop / 0.26) * (1 - w.hop / 0.26) : 0;
      const c = Math.cos(w.traverso), sn = Math.sin(w.traverso);
      tmp.copy(vF).multiplyScalar(c).addScaledVector(vR, sn); vF.copy(tmp); vR.crossVectors(vF, vU).normalize();
      if (k.acro > 0) { // l'acrobazia: un avvitamento intorno al muso
        const a = Math.PI * 2 * Math.min(1, k.acro / 0.42), ca = Math.cos(a), sa = Math.sin(a);
        tmp.copy(vU).multiplyScalar(ca).addScaledVector(vR, sa); vU.copy(tmp); vR.crossVectors(vF, vU).normalize();
      }
      vP.addScaledVector(vU, hop);
      if (k.fermo > 0) vP.addScaledVector(vR, (Math.random() - 0.5) * 0.08); // motore ingolfato: trema
      M4.makeBasis(vR, vU, tmp.copy(vF).negate()).setPosition(vP);
      meshes[i]!.matrix.copy(M4); meshes[i]!.matrixWorldNeedsUpdate = true;
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
    for (let i = 0; i < vis.length; i++) {
      const x = gs.veicoli[i]!, y = vis[i]!;
      y.drift = x.drift; y.turbo = x.turbo; y.aria = x.aria; y.vh = x.vh; y.acro = x.acro; y.scia = x.scia;
    }
    w.lv = lv;
  }
  function aggiornaHud(v: GaraView, dt: number, o2: OpzioniVista) {
    const gs = s!, pp = p!, k = gs.veicoli[0]!;
    const tipo = pp.def.tipo === 'fuga' ? 'FUGA' : `GIRO ${v.giro}/${v.giri}`;
    const onda = v.onda === null ? '' : `<div style="${v.ondaDist < 25 ? `background:${P.rosso};color:${P.pietraChiara}` : ''}">ONDA ${v.ondaDist < 0 ? '!!' : Math.round(v.ondaDist) + '<small> m</small>'}</div>`;
    const ta = o2.amici?.length ? posTraAmici(o2.amici, k, v.ms) : null;
    const pos = ta ? ta.pos : v.posizioni[0], tot = ta ? ta.tot : gs.veicoli.length;
    classifica.style.display = ta ? 'block' : 'none';
    if (ta) classifica.innerHTML = ta.righe.map((x, i) => `<div class="${x.tu ? 'tu' : ''}">${i + 1}° ${x.nome.replace(/[<>&]/g, '')}${x.fine !== null ? ' · ' + tempoGara(x.fine) : ''}</div>`).join('');
    hud.innerHTML = `<div>${pos}°<small>/${tot}</small></div><div>${tipo}</div><div>${tempoGara(v.ms)}</div><div class="${k.turbo > 0 ? 'turbo' : ''}">${Math.round(Math.abs(k.v) * 3.6)}<small> km/h</small></div>${onda}`;
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
    if (v.via > 0) {
      big.style.display = 'block'; big.style.color = conto > 1 ? P.rosso : P.giallo;
      big.innerHTML = `${conto}<small>${gs.regole.partenza ? (o2.auto ? 'pilota automatico' : 'dai GAS quando compare l\'1') : pp.def.nome}${o2.gasAuto ? ' · il gas è automatico' : ''}</small>`;
    } else if (viaFlash > 0) { big.style.display = 'block'; big.style.color = P.erbaChiara; big.innerHTML = 'VIA!'; }
    else if (o2.fine) {
      big.style.display = 'block'; big.style.color = P.sabbiaChiara;
      big.innerHTML = o2.ritirato ? 'RITIRATO' : v.finished ? `${pos}° · ${tempoGara(v.ms)}<small>giro migliore ${tempoGara(v.bestMs)} · il server conferma</small>` : 'TEMPO SCADUTO';
    } else if (k.caduto) { big.style.display = 'block'; big.style.color = P.sabbiaChiara; big.innerHTML = 'CADUTO!<small>si riparte</small>'; }
    else if (v.onda !== null && v.ondaDist < 0 && v.ondaDist > -(pp.def.inseguitore?.spessore ?? 0)) { big.style.display = 'block'; big.style.color = P.sabbiaChiara; big.innerHTML = 'TRAVOLTO!<small>l\'onda ti ha preso</small>'; }
    else big.style.display = 'none';
    if (p3d) for (const e of p3d.eventi) e.mesh.visible = k.giro + 1 >= e.daGiro;
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
    aggiorna(gara, dt, o2) {
      if (!s || gara !== s || !p) return;
      aggiornaVeicoli(dt, o2);
      aggiornaFantasmi(dt, o2.amici);
      avatar?.update(1, dt); fx.aggiorna(dt);
      posa(0, vP, vF, vU, vM);
      const w = vis[0]!, hop = w.hop > 0 ? 1.52 * (w.hop / 0.26) * (1 - w.hop / 0.26) : 0;
      regia.segui(o2.cam, { pos: vP, fwd: vF, up: vU, moto: vM, k: gara.veicoli[0]!, p, onda: gara.onda, hop, effetti: o2.effetti, dt });
      cartellini();
      eventi();
      const k = gara.veicoli[0]!;
      if (!o2.fine && gara.tick > 0) suoni.motore(k.v, veicoloCorse(k.id).velocita, k.turbo > 0, k.drift !== 0, !k.aria);
      o.onLuce?.(vP.x, vP.z);
      aggiornaHud(garaCorse.view(gara) as GaraView, dt, o2);
    },
    cameraSalta() { regia.st.ok = false; },
    chiudi() { chiudiPista(); suoni.zitto(); for (const e of [hud, big, tst, mappa.el, linee.el, classifica]) e.style.display = 'none'; },
    interfaccia(on) { for (const e of [hud, mappa.el, linee.el]) e.style.display = on ? '' : 'none'; if (!on) { big.style.display = 'none'; tst.style.display = 'none'; classifica.style.display = 'none'; } },
    info: () => ({ veicoli: meshes.length, avatar: !!avatar?.attached, kit: kitPronto(), camera: o.camera.getWorldPosition(new THREE.Vector3()).toArray().map((x) => Math.round(x * 10) / 10), padre: o.camera.parent?.type ?? null, tu: meshes[0] ? meshes[0].matrix.elements.slice(12, 15).map((x) => Math.round(x * 10) / 10) : null, fantasmi: fantasmi.filter((f) => f.visto).length, nomi: fantasmi.filter((f) => f.tag.style.display === 'block').map((f) => f.a.nome) }),
  };
}
