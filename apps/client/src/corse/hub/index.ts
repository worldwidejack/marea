// Lo schermo dell'hub delle Corse (docs/CORSE.md A3, #185): l'isola aperta alla Diddy Kong Racing che si gira sempre col veicolo.
// Mondo a parte (`mappa.ts` → `creaHub()`, lo costruisce un altro pezzo di codice), guida libera (`guida.ts`), veicolo del kit con
// l'avatar MAREA al volante, camera dietro (una regia sua, morbida, che non entra nel terreno), effetti e suoni delle gare, minimappa,
// cartelli sopra porte, garage e molo. Lo usano il gioco (`corse/index.ts`: render nella scena del gioco) e il banco `provahub.html`
// (`prova.ts`: renderer suo). Non sa niente di rete né di gare: le porte aperte le passa a chi lo usa (`porta`), che apre la scelta
// della pista e poi rimette il veicolo davanti alla porta (`riprendi`).
// - porta aperta (la Spiaggia): entri nel raggio → il veicolo si ferma e parte `o.porta(p)`;
// - porta chiusa: «Porta sbarrata: <zona> arriva presto» e il veicolo rimbalza indietro;
// - garage: entri nel raggio → pannello dei veicoli (`pannelli.ts`), la scelta va a `o.veicolo(id)`;
// - molo: tornandoci compare «Torna in barca»; «Esc · Esci» in alto sempre → `o.esci()`.
import * as THREE from 'three';
import { CORSE } from '@marea/content/corse.ts';
import type { InputFrame } from '@marea/sim';
import { veicoloCorse } from '@marea/sim/corse/pista.ts';
import { livelloDrift } from '@marea/sim/corse/veicolo.ts';
import type { Veicolo } from '@marea/sim/corse/veicolo.ts';
import type { Look } from '@marea/protocol';
import { P } from '../../render/island_parts.ts';
import { createAvatar } from '../../game/avatar.ts';
import type { Avatar } from '../../game/avatar.ts';
import { creaLinee, creaParticelle, emettiVeicolo } from '../effetti.ts';
import { creaSuoni } from '../suoni.ts';
import { veicoloGeo } from '../veicoli3d.ts';
import { caricaKit, kitPronto, loaderCorse, postoAvatar } from '../veicoli_kit.ts';
import { stileProva } from '../prova/stile.ts';
import { creaHub } from './mappa.ts';
import type { IdPorta, MondoHub, PortaHub } from './mappa.ts';
import { guida, metti, nuovaAuto, respingi, yawDi } from './guida.ts';
import type { AutoHub } from './guida.ts';
import type { Pannelli } from './pannelli.ts';

const CSS = `
.mz-hub-esci { position: absolute; left: max(8px, env(safe-area-inset-left, 0px)); top: calc(max(8px, env(safe-area-inset-top)) + 8px); display: none; min-height: 40px; min-width: 40px; padding: 0 10px;
  align-items: center; justify-content: center; background: rgba(46,30,20,.82); color: ${P.sabbiaChiara}; border: 2px solid ${P.legno}; font: bold 12px ui-monospace, Menlo, monospace; border-radius: 6px; z-index: 15; cursor: pointer; }
.mz-hub-barca { position: absolute; left: 50%; bottom: calc(env(safe-area-inset-bottom, 0px) + 26px); transform: translateX(-50%); display: none; min-height: 50px; padding: 0 18px; align-items: center; gap: 8px;
  background: ${P.arancio}; color: ${P.neroCaldo}; border: 3px solid ${P.neroCaldo}; box-shadow: 0 5px 0 ${P.neroCaldo}; font: bold 17px ui-monospace, Menlo, monospace; z-index: 16; cursor: pointer; white-space: nowrap; border-radius: 4px; }
.mz-hub-mappa { position: absolute; right: max(8px, env(safe-area-inset-right)); top: calc(max(8px, env(safe-area-inset-top)) + 8px); width: 120px; height: 100px; background: rgba(46,30,20,.72); border: 2px solid ${P.legnoChiaro};
  image-rendering: pixelated; pointer-events: none !important; z-index: 3; display: none; }
.mz-hub-tag { position: absolute; left: 0; top: 0; transform: translate(-50%, -100%); padding: 2px 7px; background: rgba(46,30,20,.86); border: 2px solid ${P.legnoChiaro}; color: ${P.sabbiaChiara};
  font: bold 12px ui-monospace, Menlo, monospace; white-space: nowrap; pointer-events: none !important; z-index: 2; display: none; }
.mz-hub-tag.aperta { border-color: ${P.giallo}; color: ${P.giallo}; }
.mz-hub-tag.chiusa { color: ${P.pietra}; border-color: ${P.pietraScura}; }
.mz-hub-v { position: absolute; left: 50%; top: max(8px, env(safe-area-inset-top)); transform: translateX(-50%); display: none; gap: 6px; pointer-events: none !important; z-index: 3; font: bold 16px ui-monospace, Menlo, monospace; color: ${P.sabbiaChiara}; }
.mz-hub-v div { padding: 4px 9px; background: rgba(46,30,20,.88); border: 2px solid ${P.legnoChiaro}; white-space: nowrap; }
.mz-hub-v div.turbo { border-color: ${P.arancio}; color: ${P.arancio}; }
.mz-hub-v small { font-size: 11px; color: ${P.sabbia}; }
`;

export type OpzioniHub = {
  root: HTMLElement;
  camera: THREE.PerspectiveCamera;
  look: () => Look;
  pannelli: Pannelli;
  /** Porta aperta: chi usa l'hub apre la scelta della pista; poi `riprendi(p.id)` (annullata o gara finita). */
  porta(p: PortaHub): void;
  /** Veicolo scelto nel garage (va salvato nella scelta). */
  veicolo(id: string): void;
  /** «Torna in barca» al molo o «Esc · Esci». */
  esci(): void;
  /** Avatar MAREA al volante (di serie sì). */
  avatar?: boolean;
};

export type InfoHub = {
  aperto: boolean; sospeso: boolean; fermo: boolean; veicolo: string; x: number; y: number; z: number; quota: number; yaw: number; v: number;
  aria: boolean; drift: number; livello: number; turbo: number; sup: string; supId: string; salti: number; urti: number;
  kit: boolean; avatar: boolean; pannello: string | null; messaggio: string | null; barca: boolean; vicino: string | null; camera: number[];
};

export type Hub = {
  readonly scene: THREE.Scene;
  readonly mondo: MondoHub;
  readonly auto: AutoHub;
  /** Entra nell'hub col veicolo `veicolo`: al molo (di serie) o davanti a una porta. */
  apri(veicolo: string, dove?: 'molo' | IdPorta): void;
  /** Esce: interfaccia spenta, suoni zitti (la scena resta pronta per la prossima volta). */
  chiudi(): void;
  aperto(): boolean;
  /** Fermo (pannello aperto, gara che sta partendo): niente guida, il resto si disegna. */
  ferma(on: boolean): void;
  /** Durante la gara: interfaccia dell'hub spenta, niente guida né resa. */
  sospendi(): void;
  /** Di nuovo nell'hub: davanti alla porta `dove` (girati verso l'isola), interfaccia accesa, si guida. */
  riprendi(dove?: IdPorta): void;
  /** Un tick (60 Hz) con l'input già tradotto come in gara: mx sterzo, my gas (o −1 freno), a = DRIFT. */
  step(f: InputFrame): void;
  /** Un frame: veicolo, camera, effetti, suoni, minimappa, cartelli. */
  aggiorna(dt: number): void;
  /** Teletrasporto (test): in (x, z) col muso verso `yaw`. */
  vai(x: number, z: number, yaw?: number): void;
  /** Teletrasporto davanti a una porta, al garage o al molo, fuori dal raggio (`dentro` = nel raggio, girato verso dentro). */
  davantiA(dove: IdPorta | 'garage' | 'molo', dentro?: boolean): void;
  cambiaVeicolo(id: string): void;
  messaggio(t: string | null, sec?: number): void;
  /** Effetti spenti/accesi (per le foto dei test). */
  effetti: boolean;
  info(): InfoHub;
};

export function creaSchermoHub(o: OpzioniHub): Hub {
  stileProva();
  if (!document.getElementById('mz-hub-style')) { const st = document.createElement('style'); st.id = 'mz-hub-style'; st.textContent = CSS; document.head.appendChild(st); }
  const stop = (e: Event) => e.stopPropagation();
  const avatarOn = o.avatar !== false;

  // ---- mondo e scena ----
  const scene = new THREE.Scene(); scene.name = 'corse_hub';
  const mondo = creaHub(); scene.add(mondo.gruppo);
  const atm = mondo.atmosfera(scene);
  const fx = creaParticelle(); scene.add(fx.mesh);
  const suoni = creaSuoni();
  const auto = nuovaAuto(mondo, 'kart', mondo.molo.x, mondo.molo.z, mondo.molo.yaw);

  // ---- il veicolo (kit vero appena scaricato) con l'avatar MAREA al volante ----
  const matVeicoli = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  let mesh: THREE.Mesh | null = null, avatar: Avatar | null = null, avatarP: Promise<Avatar | null> | null = null;
  const avatarCaricato = (): Promise<Avatar | null> => (avatarP ??= loaderCorse().then((l) => createAvatar({ loader: l, look: o.look(), x: 0, z: 0 })).catch((e) => { console.warn('[hub] avatar non caricato, resta il segnaposto', e); return null; }));
  async function siediAvatar(m: THREE.Mesh, id: string) {
    const a = await avatarCaricato(); if (!a || mesh !== m) return;
    const { seat, scala } = postoAvatar(id, null);
    a.setLook(o.look()); a.attachTo(m, seat, 0); a.object.scale.setScalar(scala); a.visible = true; avatar = a;
  }
  function veicoloMesh() {
    if (mesh) { if (avatar) { avatar.attachTo(null); avatar.object.removeFromParent(); } scene.remove(mesh); mesh.geometry.dispose(); }
    const kit = kitPronto();
    mesh = new THREE.Mesh(veicoloGeo(auto.id, P.rosso, P.pietraChiara, null, null, avatarOn && kit), matVeicoli);
    mesh.castShadow = true; mesh.matrixAutoUpdate = false; mesh.name = 'hub_tu'; mesh.frustumCulled = false; scene.add(mesh);
    if (avatarOn && kit) void siediAvatar(mesh, auto.id);
  }
  veicoloMesh();
  void caricaKit().then(() => veicoloMesh());

  // ---- interfaccia ----
  const esci = document.createElement('button'); esci.type = 'button'; esci.className = 'mz-hub-esci'; esci.id = 'mzHubEsci'; esci.textContent = 'Esc · Esci';
  const barca = document.createElement('button'); barca.type = 'button'; barca.className = 'mz-hub-barca'; barca.id = 'mzHubBarca'; barca.textContent = '⛵ Torna in barca';
  const hud = document.createElement('div'); hud.className = 'mz-hub-v';
  const tst = document.createElement('div'); tst.className = 'pp-toast'; tst.style.display = 'none'; tst.style.zIndex = '6'; tst.id = 'mzHubMsg';
  const linee = creaLinee(o.root); linee.el.style.display = 'none';
  const mappa = creaMappa(o.root, mondo);
  for (const e of [esci, barca]) { for (const ev of ['pointerdown', 'touchstart']) e.addEventListener(ev, stop); }
  esci.addEventListener('click', () => o.esci());
  barca.addEventListener('click', () => o.esci());
  o.root.append(esci, barca, hud, tst);
  // i cartelli sopra porte, garage e molo
  const posti: { id: string; nome: string; cls: string; x: number; z: number; alto: number; el: HTMLDivElement }[] = [
    ...mondo.porte.map((p) => ({ id: p.id, nome: p.aperta ? `🏁 ${p.nome.toUpperCase()}` : `🔒 ${p.nome}`, cls: p.aperta ? 'aperta' : 'chiusa', x: p.x, z: p.z, alto: 7.5 })),
    { id: 'garage', nome: '🔧 GARAGE', cls: '', x: mondo.garage.x, z: mondo.garage.z, alto: 5.5 },
    { id: 'molo', nome: '⛵ BARCA', cls: '', x: mondo.molo.x, z: mondo.molo.z, alto: 3.5 },
  ].map((q) => { const e = document.createElement('div'); e.className = `mz-hub-tag ${q.cls}`; e.textContent = q.nome; e.dataset['posto'] = q.id; o.root.appendChild(e); return { ...q, el: e }; });
  const ui = [esci, hud, mappa.el, linee.el];
  const mostraUi = (on: boolean) => {
    for (const e of ui) e.style.display = on ? (e === esci || e === hud ? 'flex' : 'block') : 'none';
    if (!on) { barca.style.display = 'none'; tst.style.display = 'none'; for (const q of posti) q.el.style.display = 'none'; }
  };
  mostraUi(false);

  let aperto = false, sospeso = false, fermo = false, effetti = true, tstT = 0;
  /** Entrate «armate»: si scatta entrando nel raggio, poi bisogna uscirne prima di riscattare. */
  const armato = new Map<string, boolean>();
  let moloArmato = false;
  function messaggio(t: string | null, sec = 2.2) {
    tst.style.display = t ? 'block' : 'none'; if (!t) return;
    tst.textContent = t; tst.style.color = P.sabbiaChiara; tstT = sec;
  }

  // ---- regia: dietro al veicolo, morbida, mai dentro il terreno ----
  const regia = { ok: false, ang: 0, y: 0, pugno: 0, scossa: 0 };
  const vP = new THREE.Vector3(), vF = new THREE.Vector3(), vU = new THREE.Vector3(), vR = new THREE.Vector3(), vM = new THREE.Vector3(), tmp = new THREE.Vector3(), M4 = new THREE.Matrix4();
  const fov0 = { fov: o.camera.fov, near: o.camera.near, far: o.camera.far };
  function segui(dt: number) {
    const c = o.camera, tel = c.aspect < 0.8, lungo = c.aspect > 1.8, v = Math.max(0, auto.v);
    regia.scossa *= Math.exp(-dt * 9); regia.pugno *= Math.exp(-dt * 2.2);
    // dietro al muso e al moto (in drift si vede il veicolo di traverso); in retromarcia resta dietro al muso
    const fx = auto.hx * 0.45 + (auto.v >= 0 ? auto.mx : auto.hx) * 0.55, fz = auto.hz * 0.45 + (auto.v >= 0 ? auto.mz : auto.hz) * 0.55;
    const meta = Math.atan2(fx, fz);
    if (!regia.ok) regia.ang = meta;
    // segue la svolta con un filo di ritardo (si vede la curva), ma non troppo: in drift il veicolo resta di tre quarti, mai di fianco
    else { let d = meta - regia.ang; d -= Math.round(d / (Math.PI * 2)) * Math.PI * 2; regia.ang += d * (1 - Math.exp(-dt * (4 + v * 0.16))); }
    const dist = (tel ? 7.8 : lungo ? 7.4 : 6.6) + v * 0.05, alt = tel ? 3.4 : lungo ? 3.3 : 2.8;
    const sx = Math.sin(regia.ang), sz = Math.cos(regia.ang);
    const cx = vP.x - sx * dist, cz = vP.z - sz * dist;
    const pavimento = (x: number, z: number) => Math.max(mondo.quota(x, z), mondo.mare);
    const qc = pavimento(cx, cz), qm = pavimento((cx + vP.x) / 2, (cz + vP.z) / 2);
    const cy = Math.max(vP.y + alt, qc + 1.3, qm + 1.2);
    regia.y = regia.ok ? regia.y + (cy - regia.y) * (1 - Math.exp(-dt * 7)) : cy;
    regia.y = Math.max(regia.y, qc + 0.9);
    c.position.set(cx, regia.y, cz);
    const sc = effetti ? regia.scossa : 0;
    if (sc > 0.005) c.position.add(tmp.set((Math.random() - 0.5) * sc, (Math.random() - 0.5) * sc, (Math.random() - 0.5) * sc));
    c.up.set(0, 1, 0);
    c.lookAt(vP.x + sx * 4, vP.y + (lungo ? 1.4 : 1), vP.z + sz * 4);
    const fov = (tel ? 76 : lungo ? 60 : 64) + (auto.turbo > 0 ? 6 : 0) + Math.max(0, v - 15) * 0.3 + (effetti ? regia.pugno : 0);
    // oltre la nebbia non si vede niente: il piano lontano finisce lì (meno triangoli da disegnare)
    const far = scene.fog instanceof THREE.Fog ? Math.min(900, scene.fog.far + 40) : 900;
    if (Math.abs(c.fov - fov) > 0.05 || c.near !== 0.3 || c.far !== far) { c.fov = regia.ok ? c.fov + (fov - c.fov) * Math.min(1, dt * 8) : fov; c.near = 0.3; c.far = far; c.updateProjectionMatrix(); }
    regia.ok = true;
  }

  // ---- posa del veicolo: normale del terreno, traverso del drift, saltello, avvitamento ----
  const vis = { hop: 0, traverso: 0, drift: 0, lv: 0, turbo: 0, aria: false };
  function posa(dt: number) {
    if (auto.drift && !vis.drift) vis.hop = 0.001;
    if (vis.hop > 0) { vis.hop += dt; if (vis.hop > 0.26) vis.hop = 0; }
    vis.traverso += (auto.drift * 0.32 - vis.traverso) * Math.min(1, dt * 10);
    const hop = vis.hop > 0 ? 4 * 0.38 * (vis.hop / 0.26) * (1 - vis.hop / 0.26) : 0;
    vU.set(auto.nx, auto.ny, auto.nz);
    // il muso nel piano del terreno, poi girato del traverso intorno al sopra (destra = avanti × sopra)
    vF.set(auto.hx, 0, auto.hz).addScaledVector(vU, -(auto.hx * vU.x + auto.hz * vU.z)).normalize();
    vR.crossVectors(vF, vU).normalize();
    const c = Math.cos(vis.traverso), s = Math.sin(vis.traverso);
    tmp.copy(vF).multiplyScalar(c).addScaledVector(vR, s); vF.copy(tmp); vR.crossVectors(vF, vU).normalize();
    if (auto.acro > 0) { // l'acrobazia: un avvitamento intorno al muso
      const a = Math.PI * 2 * Math.min(1, auto.acro / 0.42), ca = Math.cos(a), sa = Math.sin(a);
      tmp.copy(vU).multiplyScalar(ca).addScaledVector(vR, sa); vU.copy(tmp); vR.crossVectors(vF, vU).normalize();
    }
    vM.set(auto.mx, 0, auto.mz);
    vP.set(auto.x, auto.y + hop, auto.z);
    M4.makeBasis(vR, vU, tmp.copy(vF).negate()).setPosition(vP);
    if (mesh) { mesh.matrix.copy(M4); mesh.matrixWorldNeedsUpdate = true; }
    vP.y = auto.y + hop * 0.4; // la camera sente il saltello solo un po'
  }
  /** Suoni, scossa e FOV quando cambia qualcosa (livelli del drift, turbo, atterraggi, urti). */
  function eventi() {
    const lv = auto.drift ? livelloDrift(auto.carica) : 0;
    if (lv > vis.lv) suoni.livello(lv);
    if (auto.turbo > vis.turbo + 0.05) { suoni.turbo(auto.livello); regia.pugno = 8 + 2 * Math.min(3, auto.livello); regia.scossa = Math.max(regia.scossa, 0.1); }
    if (auto.atterrato > 0) { if (auto.atterrato > 3) { suoni.atterra(auto.atterrato); regia.scossa = Math.max(regia.scossa, Math.min(0.35, auto.atterrato * 0.025)); } auto.atterrato = 0; }
    if (auto.urto > 0) { if (auto.urto > 3) { suoni.atterra(auto.urto * 0.6); regia.scossa = Math.max(regia.scossa, Math.min(0.3, auto.urto * 0.02)); } auto.urto = 0; }
    vis.drift = auto.drift; vis.turbo = auto.turbo; vis.aria = auto.aria; vis.lv = lv;
  }

  // ---- porte, garage, molo ----
  const fuoriDa = (x: number, z: number, yaw: number, r: number): [number, number, number] => [x - Math.sin(yaw) * (r + 5), z - Math.cos(yaw) * (r + 5), yaw + Math.PI];
  function luoghi() {
    for (const p of mondo.porte) {
      const d = Math.hypot(auto.x - p.x, auto.z - p.z), dentro = d < p.raggio;
      if (!dentro) { if (d > p.raggio + 3) armato.set(p.id, true); continue; }
      if (!p.aperta) { // porta sbarrata: rimbalzo (a ogni tick finché sei dentro) e messaggio una volta
        respingi(auto, p.x, p.z, 7, -Math.sin(p.yaw), -Math.cos(p.yaw));
        if (armato.get(p.id) !== false) { messaggio(`Porta sbarrata: ${p.nome} arriva presto`); armato.set(p.id, false); auto.urto = Math.max(auto.urto, 4); }
        continue;
      }
      if (armato.get(p.id) === false) continue;
      armato.set(p.id, false);
      auto.v = 0; auto.drift = 0; auto.carica = 0; fermo = true;
      o.porta(p);
      return;
    }
    const g = mondo.garage, dg = Math.hypot(auto.x - g.x, auto.z - g.z);
    if (dg < g.raggio && armato.get('garage') !== false) {
      armato.set('garage', false);
      auto.v = 0; auto.drift = 0; fermo = true;
      void o.pannelli.garage(auto.id).then((id) => {
        if (id && id !== auto.id) { cambiaVeicolo(id); o.veicolo(id); messaggio(veicoloCorse(id).nome.toUpperCase(), 1.4); }
        fermo = false;
      });
    } else if (dg > g.raggio + 3) armato.set('garage', true);
    const m = mondo.molo, dm = Math.hypot(auto.x - m.x, auto.z - m.z);
    if (dm > m.raggio * 1.5 + 4) moloArmato = true;
    barca.style.display = moloArmato && dm < m.raggio * 1.5 && !fermo ? 'flex' : 'none';
  }

  function cambiaVeicolo(id: string) {
    if (id === auto.id) return;
    const yaw = yawDi(auto);
    auto.id = id;
    metti(mondo, auto, auto.x, auto.z, yaw);
    veicoloMesh(); regia.ok = false;
  }
  function davantiA(dove: IdPorta | 'garage' | 'molo', dentro = false) {
    const p = dove === 'garage' ? mondo.garage : dove === 'molo' ? mondo.molo : mondo.porte.find((x) => x.id === dove);
    if (!p) return;
    if (dove !== 'molo') armato.set(dove, true);
    if (dentro) metti(mondo, auto, p.x - Math.sin(p.yaw) * p.raggio * 0.4, p.z - Math.cos(p.yaw) * p.raggio * 0.4, p.yaw);
    else if (dove === 'molo') metti(mondo, auto, p.x, p.z, p.yaw);
    else { const [x, z, yaw] = fuoriDa(p.x, p.z, p.yaw, p.raggio); metti(mondo, auto, x, z, yaw); }
    regia.ok = false; fx.svuota();
  }

  // ---- un frame ----
  let tempo = 0;
  function aggiorna(dt: number) {
    if (!aperto || sospeso) return;
    tempo += dt;
    posa(dt);
    avatar?.update(1, dt); fx.aggiorna(dt);
    if (effetti) emettiVeicolo(fx, auto as unknown as Veicolo, false, Math.max(0, auto.v), vP, vF, vU, vR, vM);
    segui(dt);
    eventi();
    mondo.aggiorna(tempo, o.camera);
    atm.segui(auto.x, auto.z);
    if (!fermo) suoni.motore(auto.v, veicoloCorse(auto.id).velocita, auto.turbo > 0, auto.drift !== 0, !auto.aria); else suoni.zitto();
    linee.disegna(effetti ? (auto.turbo > 0 ? 1 : 0) : 0, P.sabbiaChiara);
    hud.innerHTML = `<div class="${auto.turbo > 0 ? 'turbo' : ''}">${Math.round(Math.abs(auto.v) * 3.6)}<small> km/h</small></div>`;
    tstT -= dt; if (tstT <= 0 && tst.style.display !== 'none') messaggio(null);
    mappa.disegna(auto);
    // cartelli: i posti vicini (entro 70 m) davanti alla camera
    const r = o.root.getBoundingClientRect();
    for (const q of posti) {
      const d = Math.hypot(q.x - auto.x, q.z - auto.z);
      if (d > 70 || d < 2) { q.el.style.display = 'none'; continue; }
      tmp.set(q.x, Math.max(mondo.quota(q.x, q.z), mondo.mare) + q.alto, q.z).project(o.camera);
      if (tmp.z >= 1 || Math.abs(tmp.x) > 1.05 || Math.abs(tmp.y) > 1.05) { q.el.style.display = 'none'; continue; }
      q.el.style.display = 'block';
      q.el.style.left = `${Math.round(((tmp.x + 1) / 2) * r.width)}px`; q.el.style.top = `${Math.round(((1 - tmp.y) / 2) * r.height)}px`;
    }
  }

  const hub: Hub = {
    scene, mondo, auto,
    get effetti() { return effetti; },
    set effetti(v: boolean) { effetti = v; if (!v) fx.svuota(); },
    apri(veicolo, dove = 'molo') {
      if (veicolo !== auto.id && CORSE.veicoli.some((v) => v.id === veicolo)) { auto.id = veicolo; veicoloMesh(); }
      aperto = true; sospeso = false; fermo = false; moloArmato = false;
      for (const p of mondo.porte) armato.set(p.id, true);
      armato.set('garage', true);
      davantiA(dove);
      mostraUi(true); messaggio(null);
    },
    chiudi() { aperto = false; sospeso = false; fermo = false; mostraUi(false); suoni.zitto(); fx.svuota(); const c = o.camera; c.fov = fov0.fov; c.near = fov0.near; c.far = fov0.far; c.updateProjectionMatrix(); },
    aperto: () => aperto,
    ferma(on) { fermo = on; if (on) { auto.v = 0; auto.drift = 0; } },
    sospendi() { sospeso = true; mostraUi(false); suoni.zitto(); fx.svuota(); },
    riprendi(dove) {
      if (!aperto) return;
      sospeso = false; fermo = false;
      if (dove) davantiA(dove);
      mostraUi(true); regia.ok = false;
    },
    step(f) {
      if (!aperto || sospeso || fermo) return;
      guida(mondo, auto, f);
      luoghi();
    },
    aggiorna,
    vai(x, z, yaw) { metti(mondo, auto, x, z, yaw ?? yawDi(auto)); regia.ok = false; fx.svuota(); },
    davantiA, cambiaVeicolo, messaggio,
    info: () => {
      let vicino: string | null = null, dv = 30;
      for (const q of posti) { const d = Math.hypot(q.x - auto.x, q.z - auto.z); if (d < dv) { dv = d; vicino = q.id; } }
      return {
        aperto, sospeso, fermo, veicolo: auto.id, x: r1(auto.x), y: r2(auto.y), z: r1(auto.z), quota: r2(mondo.quota(auto.x, auto.z)), yaw: r2(yawDi(auto)), v: r1(auto.v),
        aria: auto.aria, drift: auto.drift, livello: auto.drift ? livelloDrift(auto.carica) : 0, turbo: r2(auto.turbo), sup: auto.sup, supId: auto.supId, salti: auto.salti, urti: auto.urti,
        kit: kitPronto(), avatar: !!avatar?.attached, pannello: o.pannelli.aperto(), messaggio: tst.style.display !== 'none' ? tst.textContent : null,
        barca: barca.style.display !== 'none', vicino, camera: o.camera.position.toArray().map(r1),
      };
    },
  };
  return hub;
}
const r1 = (x: number) => Math.round(x * 10) / 10, r2 = (x: number) => Math.round(x * 100) / 100;

/** La minimappa dell'hub (in alto a destra): la costa, le strade, le porte (gialle aperte, grigie chiuse), il garage, il molo e tu. */
function creaMappa(root: HTMLElement, m: MondoHub): { el: HTMLCanvasElement; disegna(a: AutoHub): void } {
  const W = 120, H = 100, el = document.createElement('canvas');
  el.width = W; el.height = H; el.id = 'mzHubMappa'; el.className = 'mz-hub-mappa';
  root.appendChild(el);
  const g = el.getContext('2d');
  const pi = m.pianta, dx = Math.max(1, pi.max[0] - pi.min[0]), dz = Math.max(1, pi.max[1] - pi.min[1]);
  const k = Math.min((W - 8) / dx, (H - 8) / dz), ox = (W - dx * k) / 2, oz = (H - dz * k) / 2;
  const mx = (x: number) => ox + (x - pi.min[0]) * k, mz = (z: number) => oz + (z - pi.min[1]) * k;
  let fondo: ImageData | null = null;
  const quadro = (x: number, z: number, r: number, c: string, bordo = P.neroCaldo) => {
    if (!g) return;
    g.fillStyle = bordo; g.fillRect(Math.round(mx(x)) - r - 1, Math.round(mz(z)) - r - 1, r * 2 + 2, r * 2 + 2);
    g.fillStyle = c; g.fillRect(Math.round(mx(x)) - r, Math.round(mz(z)) - r, r * 2, r * 2);
  };
  function sfondo() {
    if (!g) return;
    g.clearRect(0, 0, W, H);
    if (pi.costa.length > 2) {
      g.fillStyle = P.erbaScura; g.beginPath();
      pi.costa.forEach(([x, z], i) => (i ? g.lineTo(mx(x), mz(z)) : g.moveTo(mx(x), mz(z))));
      g.closePath(); g.fill();
    }
    g.strokeStyle = P.pietraChiara; g.lineWidth = 2; g.lineCap = 'round'; g.lineJoin = 'round';
    for (const s of pi.strade) { g.beginPath(); s.forEach(([x, z], i) => (i ? g.lineTo(mx(x), mz(z)) : g.moveTo(mx(x), mz(z)))); g.stroke(); }
    for (const p of m.porte) quadro(p.x, p.z, 3, p.aperta ? P.giallo : P.pietraScura);
    quadro(m.garage.x, m.garage.z, 2, P.arancio);
    quadro(m.molo.x, m.molo.z, 2, P.legnoChiaro);
    fondo = g.getImageData(0, 0, W, H);
  }
  return {
    el,
    disegna(a) {
      if (!g) return;
      if (!fondo) sfondo();
      g.putImageData(fondo!, 0, 0);
      quadro(a.x, a.z, 3, P.rosso);
      // il muso: due pixel davanti
      g.fillStyle = P.pietraChiara; g.fillRect(Math.round(mx(a.x + a.hx * 7)) - 1, Math.round(mz(a.z + a.hz * 7)) - 1, 2, 2);
    },
  };
}
