// Eroe nel dungeon (R-scena): l'avatar del giocatore (`createAvatar`, look di world.look) mosso dalla vista della sim; clip idle/walk/run
// sotto e, sopra, una posa procedurale per ogni HeroAnim. La posa dice dove va il pugno (spazio del corpo) e dove punta l'arma: il braccio
// ci arriva con un'IK a due ossa e l'arma sta sempre nel pugno. I colpi di mischia seguono l'arco della sim (swing.ts, stesso angolo della
// lama a ogni fase: quel che si vede è quel che colpisce): fendente orizzontale da destra a sinistra, affondo della lancia, gancio dei
// pugni, giro completo del caricato. Carica: corpo girato, gambe piegate, arma bassa dietro, mano sinistra e testa verso il bersaglio,
// lama che si accende a gradini; al pieno lampo, tremito e lama che lampeggia. Scia, anello di carica, onda e stella in hero_fx.ts.
// Arco: corda verso chi tira; tendendo la corda segue la mano destra con la freccia incoccata (arco.ts) e, per l'eroe di questo client,
// una linea a trattini mostra per qualche metro dove partirà la freccia (la mira automatica della sim, se c'è un bersaglio).
// Le ossa del glTF arrivano senza punti nel nome (three toglie «.» dai nomi dei nodi: UpperArm.R → UpperArmR).
import * as THREE from 'three';
import type { Look } from '@marea/protocol';
import type { RunWeapon } from '@marea/sim/rpg/types.ts';
import type { DungeonView } from '@marea/sim/dungeon/types.ts';
import { COLPI, FRECCIA_Y } from '@marea/sim/dungeon/tuning.ts';
import { bladeAngle } from '@marea/sim/dungeon/swing.ts';
import type { SwingStyle } from '@marea/sim/dungeon/swing.ts';
import { pugni } from '@marea/sim/dungeon/hero.ts';
import { hasItem, itemDef } from '@marea/sim/rpg/items.ts';
import type { Loader } from '../render/loader.ts';
import { createAvatar } from '../game/avatar.ts';
import type { Avatar } from '../game/avatar.ts';
import { PAL } from '../ui/style.ts';
import { palColor } from './items_ui.ts';
import { boxes, materialsOf, object, tintBlade } from './dungeon_kit.ts';
import { createHeroFx } from './hero_fx.ts';
import { armaArco } from './arco.ts';
import type { Arco } from './arco.ts';
import type { HeroFx } from './hero_fx.ts';

/** Arma da montare: quella del GDR, o (Templari) con modello del kit e colore della lama dati direttamente, oppure un oggetto già fatto
 *  (`oggetto`: pistole, moschetto, vaso del fuoco greco; canna lungo +Y dall'impugnatura, sopra +Z) tenuto a due mani in avanti. */
export type ArmaInMano = RunWeapon & { modello?: string; colore?: string; oggetto?: () => THREE.Object3D };

export type HeroActor = {
  readonly avatar: Avatar;
  /** Un tick della sim (60 Hz): nuova posa di destinazione. */
  tick(h: DungeonView['hero']): void;
  /** Ogni frame, dopo l'interpolazione: ossa, arma, effetti. */
  update(alpha: number, dt: number): void;
  flash(): void;
  /** L'arma si è rotta (evento `rotto`): via il modello, si combatte coi pugni. */
  rotta(): void;
  /** Cambio d'arma dal menu dello zaino: modello nuovo nel pugno (o pugni), scia della portata nuova. */
  setArma(a: ArmaInMano): Promise<void>;
  /** Linea di mira (solo con `mirino`) mentre tende: direzione in cui partirà la freccia; null = davanti all'eroe. */
  mira(d: { x: number; z: number } | null): void;
  /** Punto sopra la testa (numeri del danno). */
  head(): THREE.Vector3;
  dispose(): void;
};

type V3 = THREE.Vector3;
type Kind = 'lama' | 'lancia' | 'pugni' | 'arco' | 'fuoco';
const v3 = (x = 0, y = 0, z = 0): V3 => new THREE.Vector3(x, y, z);
const X = v3(1, 0, 0), Y = v3(0, 1, 0), Z = v3(0, 0, 1);
const UPPER = 0.2754, FOREARM = 0.27; // m: spalla → gomito (glTF), gomito → pugno
const R_PUGNO = 0.45; // m dall'asse del corpo al pugno nei fendenti e nel giro
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const smooth = (a: number, b: number, t: number) => { const k = clamp((t - a) / (b - a), 0, 1); return k * k * (3 - 2 * k); };
const easeOut = (k: number) => 1 - (1 - k) * (1 - k);
const stepQ = (v: number, n: number) => Math.floor(v * n) / n; // valori a gradini (bagliore, caduta)
const wrapPi = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
/** Punto a angolo φ (+ = destra, 0 = avanti), raggio r, altezza h nello spazio del corpo (−Z avanti). */
const onCircle = (phi: number, r: number, h: number, out = v3()): V3 => out.set(r * Math.sin(phi), h, -r * Math.cos(phi));

/** Posa sopra la clip, nello spazio del corpo. yaw/twist/headYaw: + = verso destra. */
type Pose = {
  yaw: number; twist: number; lean: number; crouch: number; headUp: number; headYaw: number;
  wR: number; fR: V3; wL: number; fL: V3;
  /** Arma: punta voluta (la direzione si prende dal pugno vero, così la punta sta sull'angolo della sim) o, se null, direzione `dir`. */
  punta: V3 | null; dir: V3; piatto: V3;
  /** 0 = arma perpendicolare all'avambraccio come nelle clip, 1 = come dice la posa. */
  wA: number;
};
const newPose = (): Pose => ({ yaw: 0, twist: 0, lean: 0, crouch: 0, headUp: 0, headYaw: 0, wR: 0, fR: v3(), wL: 0, fL: v3(), punta: null, dir: v3(0, 1, 0), piatto: v3(1, 0, 0), wA: 0 });
function copyPose(o: Pose, a: Pose): Pose {
  o.yaw = a.yaw; o.twist = a.twist; o.lean = a.lean; o.crouch = a.crouch; o.headUp = a.headUp; o.headYaw = a.headYaw;
  o.wR = a.wR; o.fR.copy(a.fR); o.wL = a.wL; o.fL.copy(a.fL); o.dir.copy(a.dir); o.piatto.copy(a.piatto); o.wA = a.wA;
  o.punta = a.punta ? (o.punta ?? v3()).copy(a.punta) : null;
  return o;
}
/** Direzione dell'arma risolta (dalla punta se c'è). */
const dirOf = (p: Pose, out: V3): V3 => (p.punta ? out.subVectors(p.punta, p.fR).normalize() : out.copy(p.dir));
const tmpA = v3(), tmpB = v3();
function mixPose(o: Pose, a: Pose, b: Pose, k: number): Pose {
  if (k >= 1) return copyPose(o, b);
  const da = dirOf(a, tmpA), db = dirOf(b, tmpB);
  o.yaw = lerp(a.yaw, b.yaw, k); o.twist = lerp(a.twist, b.twist, k); o.lean = lerp(a.lean, b.lean, k); o.crouch = lerp(a.crouch, b.crouch, k);
  o.headUp = lerp(a.headUp, b.headUp, k); o.headYaw = lerp(a.headYaw, b.headYaw, k);
  o.wR = lerp(a.wR, b.wR, k); o.fR.lerpVectors(a.fR, b.fR, k); o.wL = lerp(a.wL, b.wL, k); o.fL.lerpVectors(a.fL, b.fL, k);
  o.punta = null; o.dir.lerpVectors(da, db, k).normalize(); o.piatto.lerpVectors(a.piatto, b.piatto, k).normalize(); o.wA = lerp(a.wA, b.wA, k);
  return o;
}

export async function createHeroActor(o: { loader: Loader; look: Look; hero: { arma: ArmaInMano }; scene: THREE.Scene; floorY: number; x: number; z: number;
  /** Eroe di questo client: mentre tende si vede la linea di mira (i compagni no). */
  mirino?: boolean;
}): Promise<HeroActor> {
  const avatar = await createAvatar({ loader: o.loader, look: o.look, x: o.x, z: o.z });
  avatar.setGround(() => o.floorY);
  o.scene.add(avatar.object);
  const bone = (n: string) => avatar.object.getObjectByName(THREE.PropertyBinding.sanitizeNodeName(n)) ?? avatar.object.getObjectByName(n) ?? null;
  const B = {
    armR: bone('UpperArm.R'), foreR: bone('LowerArm.R'), armL: bone('UpperArm.L'), foreL: bone('LowerArm.L'), spine: bone('Spine'), head: bone('Head'),
    thighR: bone('UpperLeg.R'), thighL: bone('UpperLeg.L'), shinR: bone('LowerLeg.R'), shinL: bone('LowerLeg.L'),
  };
  const inner = avatar.object.children[0] ?? avatar.object;
  const bodyMats = materialsOf(avatar.object);

  // ---- arma: nel pugno, ingrandita perché la punta arrivi vicino alla portata (quel che si vede ≈ dove colpisce) ----
  let bow = false, arco: Arco | null = null, weapon: THREE.Object3D | null = null, bladeMats: THREE.MeshLambertMaterial[] = [], bladeLen = 0, kind: Kind = 'pugni', mountN = 0;
  const fxFor = (portata: number) => createHeroFx(o.scene, { portata, rin: kind === 'pugni' ? 0.3 : R_PUGNO + 0.15 });
  let fx: HeroFx = fxFor(pugni().portata);
  /** Monta l'arma nel pugno (all'inizio e a ogni cambio dal menu); se nel frattempo ne arriva un'altra, vince l'ultima. */
  async function mount(arma: ArmaInMano): Promise<void> {
    const my = ++mountN, b = arma.kind === 'arco';
    const def = arma.id && hasItem(arma.id) ? itemDef(arma.id) : null;
    let w: THREE.Object3D | null = null, mats: THREE.MeshLambertMaterial[] = [], len = 0;
    const model = arma.modello ?? def?.model, colore = arma.colore ?? def?.colore;
    if (arma.oggetto) { w = arma.oggetto(); mats = materialsOf(w); len = Math.max(0.2, new THREE.Box3().setFromObject(w).max.y); }
    else if (model) {
      w = await object(o.loader, model, () => boxes(b ? [[0.05, 1.2, 0.05, 0, 0, 0.08, PAL.legno]] : [[0.05, 0.2, 0.05, 0, 0.05, 0, PAL.legnoScuro], [0.08, 0.75, 0.03, 0, 0.55, 0, PAL.pietra]]));
      if (my !== mountN) return;
      tintBlade(w, palColor(colore || PAL.pietra));
      mats = materialsOf(w).filter((m) => /^mat_lama/.test(m.name));
      if (!mats.length) mats = materialsOf(w);
      const tip = Math.max(0.3, new THREE.Box3().setFromObject(w).max.y);
      const s = b ? 1 : clamp((arma.portata - R_PUGNO) / tip, 1, 1.5);
      w.scale.set(s * (b ? 1 : 1.6), s, s * (b ? 1 : 1.6)); len = tip * s; // più spessa: si legge da lontano
    }
    weapon?.removeFromParent();
    weapon = w; bow = b; bladeMats = mats; bladeLen = len;
    arco = b && w ? armaArco(w, o.loader, false, 1.8) : null;
    if (w) o.scene.add(w);
    kind = bow ? 'arco' : arma.oggetto ? 'fuoco' : !weapon || arma.kind === 'pugni' ? 'pugni' : def?.tipo === 'lancia' ? 'lancia' : 'lama';
    fx.dispose(); fx = fxFor(kind === 'pugni' ? pugni().portata : arma.portata);
  }
  await mount(o.hero.arma);

  // ---- rotazioni nello spazio del corpo (inner: asse X = destra, −Z = avanti) applicate sopra la clip ----
  const qa = new THREE.Quaternion(), qp = new THREE.Quaternion(), qr = new THREE.Quaternion(), qi = new THREE.Quaternion(), ql = new THREE.Quaternion(), qid = new THREE.Quaternion();
  function rot(b: THREE.Object3D | null, axis: V3, ang: number): void {
    if (!b || !b.parent || Math.abs(ang) < 1e-4) return;
    b.parent.updateWorldMatrix(true, false);
    inner.getWorldQuaternion(qr);
    b.parent.getWorldQuaternion(qp);
    qi.copy(qr).invert().multiply(qp); // genitore nello spazio del corpo
    qa.setFromAxisAngle(axis, ang);
    b.quaternion.premultiply(ql.copy(qi).invert().multiply(qa).multiply(qi));
  }
  /** Gira l'osso (che guarda lungo il suo +Y) verso `dirW` (mondo), col peso w: la torsione della clip resta. */
  const boneDir = v3();
  function aim(b: THREE.Object3D, dirW: V3, w: number): void {
    b.getWorldQuaternion(qa);
    boneDir.set(0, 1, 0).applyQuaternion(qa);
    const dq = new THREE.Quaternion().setFromUnitVectors(boneDir, dirW);
    if (w < 1) dq.slerp(qid, 1 - w);
    b.parent!.getWorldQuaternion(qp);
    b.quaternion.premultiply(ql.copy(qp).invert().multiply(dq).multiply(qp));
    b.updateMatrixWorld(true);
  }
  /** IK a due ossa: pugno su `target` (mondo), gomito verso `pole` (mondo). Fuori portata il braccio si tende verso il bersaglio. */
  const S = v3(), D = v3(), P = v3(), E = v3(), E2 = v3(), T2 = v3(), tmp = v3();
  function ik(up: THREE.Object3D | null, lo: THREE.Object3D | null, target: V3, pole: V3, w: number): void {
    if (!up || !lo || !up.parent || w < 1e-3) return;
    up.getWorldPosition(S);
    D.subVectors(target, S); let d = D.length(); if (d < 1e-4) return; D.divideScalar(d);
    d = clamp(d, 0.1, UPPER + FOREARM - 1e-3);
    const a = (UPPER * UPPER - FOREARM * FOREARM + d * d) / (2 * d), hh = Math.sqrt(Math.max(0, UPPER * UPPER - a * a));
    P.copy(pole).addScaledVector(D, -pole.dot(D));
    if (P.lengthSq() < 1e-6) P.set(0, -1, 0).addScaledVector(D, D.y);
    P.normalize();
    E.copy(S).addScaledVector(D, a).addScaledVector(P, hh);
    aim(up, tmp.subVectors(E, S).normalize(), w);
    lo.getWorldPosition(E2);
    T2.copy(S).addScaledVector(D, d);
    aim(lo, tmp.subVectors(T2, E2).normalize(), w);
  }

  // ---- pose (spazio del corpo) ----
  const G_LAMA = 0.2; // angolo della lama in guardia: avanti, appena a destra
  function guard(p: Pose): void {
    Object.assign(p, { yaw: 0, twist: 0, lean: 0, crouch: 0, headUp: 0, headYaw: 0, wR: 0, wL: 0, punta: null, wA: 0 });
    switch (kind) {
      case 'lama': p.wR = 1; p.fR.set(0.27, 0.97, -0.2); p.dir.set(0.12, 0.62, -0.78).normalize(); p.piatto.set(1, 0, 0); p.wA = 1; break;
      case 'lancia': p.wR = 1; p.fR.set(0.24, 1.0, -0.04); p.dir.set(0, 0.32, -1).normalize(); p.piatto.set(0, 1, 0); p.wA = 1; p.wL = 1; p.fL.copy(p.fR).addScaledVector(p.dir, 0.42); break;
      case 'pugni': p.wR = p.wL = 1; p.fR.set(0.15, 1.27, -0.25); p.fL.set(-0.15, 1.3, -0.22); break;
      case 'fuoco': p.wR = 1; p.fR.set(0.17, 1.2, -0.34); p.dir.set(0, 0.04, -1).normalize(); p.piatto.set(0, 1, 0); p.wA = 1; p.wL = 1; p.fL.copy(p.fR).addScaledVector(p.dir, Math.min(0.32, bladeLen * 0.5)).add(tmp.set(-0.06, -0.04, 0)); break;
      default: p.dir.set(0, 1, -0.12).normalize(); p.piatto.set(0, 0, 1); p.wA = 1; // arco dritto nella sinistra, corda verso di sé, braccia della clip
    }
  }
  /** Fendente (lama) o gancio (pugni): presa all'indietro, arco della sim a velocità costante, accompagnamento, ritorno in guardia. */
  function slash(p: Pose, st: SwingStyle, t: number): void {
    guard(p);
    const c = COLPI[st], rate = c.arco / (c.a - c.da), pg = kind === 'pugni';
    const lead = pg ? 0.5 : 0.85, follow = pg ? 0.3 : 0.5, back = c.inizio + lead;
    const tc = Math.max(0.06, c.da - lead / rate), end = c.inizio - c.arco, tf = Math.min(0.92, c.a + 0.14);
    let phi: number;
    if (t < tc) phi = lerp(G_LAMA, back, smooth(0, tc * 0.75, t));
    else if (t < c.da) phi = lerp(back, c.inizio, (t - tc) / (c.da - tc));
    else if (t <= c.a) phi = bladeAngle(st, t);
    else if (t < tf) phi = end - follow * easeOut((t - c.a) / (tf - c.a));
    else phi = lerp(end - follow, G_LAMA, smooth(tf, 1, t));
    const up = clamp((phi - c.inizio) / lead, 0, 1), e = smooth(0, tc * 0.8, t) * (1 - smooth(tf, 1, t));
    const h = (pg ? 1.24 : 1.1) + 0.22 * up, r = pg ? 0.4 : R_PUGNO;
    p.fR.lerp(onCircle(phi, r, h, tmp), e);
    if (!pg) {
      const tipP = onCircle(phi, r + bladeLen, h + 0.32 * up - 0.04);
      if (e > 0.999) p.punta = tipP;
      else p.dir.lerp(tmp.subVectors(tipP, onCircle(phi, r, h)).normalize(), e).normalize();
      p.piatto.lerp(Y, e).normalize();
      // sinistra: avanti mentre la destra carica, indietro a sinistra a fine colpo (equilibrio)
      const s = clamp((back - phi) / (back - end + follow), 0, 1);
      p.wL = 0.85 * e; p.fL.lerpVectors(v3(-0.2, 1.15, -0.4), v3(-0.4, 1.0, 0.16), s);
    }
    p.twist = clamp(0.5 * phi, -0.75, 0.95) * e;
    p.lean = (0.1 + 0.12 * Math.sin(Math.PI * clamp((t - c.da) / (c.a - c.da), 0, 1))) * e;
    p.crouch = 0.3 * e;
  }
  /** Affondo della lancia: tira indietro, spinge avanti lungo l'arco stretto della sim, resta teso, torna. */
  function thrust(p: Pose, t: number): void {
    guard(p);
    const c = COLPI.affondo;
    const pull = smooth(0, c.da - 0.04, t) * (1 - smooth(c.da - 0.04, c.a, t)), ext = smooth(c.da - 0.04, c.a, t) * (1 - smooth(c.a + 0.2, 1, t));
    const phi = t < c.da ? c.inizio * smooth(0, c.da, t) : t <= c.a ? bladeAngle('affondo', t) : lerp(c.inizio - c.arco, 0, smooth(c.a + 0.2, 1, t));
    p.fR.lerp(tmp.set(0.3, 1.02, 0.26), pull).lerp(onCircle(phi, 0.6, 1.14, tmp), ext);
    const tilt = lerp(0.32, 0.05, Math.max(pull, ext));
    p.dir.set(Math.sin(phi), tilt, -Math.cos(phi)).normalize();
    p.fL.copy(p.fR).addScaledVector(p.dir, 0.42);
    p.lean = 0.25 * ext - 0.08 * pull; p.twist = 0.4 * pull - 0.25 * ext; p.crouch = 0.35 * Math.max(pull, ext);
  }
  /** Giro del colpo caricato: il corpo intero ruota con il braccio teso a destra, la lama sull'angolo della sim. */
  function spin(p: Pose, t: number): void {
    guard(p);
    const c = COLPI.giro, end = c.inizio - c.arco, tf = Math.min(0.9, c.a + 0.12), follow = 0.6, side = Math.PI / 2;
    let phi: number, beta = side;
    if (t < c.da) phi = c.inizio + 0.18 * Math.sin((Math.PI * t) / c.da); // un filo di slancio all'indietro
    else if (t <= c.a) phi = bladeAngle('giro', t);
    else if (t < tf) phi = end - follow * easeOut((t - c.a) / (tf - c.a));
    else { const k = smooth(tf, 1, t); phi = lerp(end - follow, G_LAMA - 2 * Math.PI, k); beta = lerp(side, G_LAMA, k); }
    const e = 1 - smooth(tf, 1, t), pg = kind === 'pugni';
    p.yaw = phi - beta;
    p.fR.lerp(onCircle(beta, R_PUGNO, 1.12, tmp), e);
    if (!pg) {
      const tipP = onCircle(beta, R_PUGNO + bladeLen, 1.06);
      if (e > 0.999) p.punta = tipP; else p.dir.lerp(tmp.subVectors(tipP, onCircle(beta, R_PUGNO, 1.12)).normalize(), e).normalize();
      p.piatto.lerp(Y, e).normalize();
    }
    p.wR = 1; p.wL = Math.max(p.wL, 0.8 * e); p.fL.lerp(tmp.set(-0.42, 1.1, 0.06), e);
    p.lean = 0.2 * e; p.crouch = 0.55 * e; p.twist = -0.15 * e;
  }
  /** Carica: corpo girato a destra (verso dove partirà il giro), gambe piegate, arma bassa dietro, sinistra e testa verso il bersaglio. */
  function charge(p: Pose, c: number): void {
    guard(p);
    p.yaw = lerp(0.42, Math.PI / 4, c); p.twist = 0.12 + 0.12 * c; p.lean = 0.18; p.crouch = 0.45 + 0.45 * c;
    p.headYaw = -(p.yaw + p.twist) * 0.85;
    p.wR = 1; onCircle(1.05, 0.42, 0.98, p.fR);
    if (kind !== 'pugni') { p.punta = onCircle(COLPI.giro.inizio - p.yaw, 0.42 + bladeLen, 0.72); p.piatto.copy(Y); p.wA = 1; }
    p.wL = 1; onCircle(-p.yaw, 0.5, 1.3, p.fL);
  }
  function pose(p: Pose, h: DungeonView['hero'], t: number, c: number): void {
    switch (h.anim) {
      case 'carica': charge(p, c); break;
      case 'attacca': {
        const st = h.stile ?? 'fendente';
        if (st === 'giro') spin(p, t); else if (st === 'affondo') thrust(p, t); else slash(p, st, t);
        break;
      }
      case 'tende': // arciere di fianco: sinistra tesa verso il bersaglio, la destra tira la corda alla guancia
        guard(p); p.yaw = 1.0; p.headYaw = -0.9; p.wL = 1; onCircle(-1.0, 0.54, 1.33, p.fL);
        p.wR = 1; p.fR.lerpVectors(onCircle(-1.0, 0.4, 1.33), tmp.set(0.08, 1.4, 0.06), c); p.dir.set(0, 1, 0); onCircle(-1.0, -1, 0, p.piatto); // corda verso chi tira
        break;
      case 'tira': {
        const full = newPose(); guard(p); copyPose(full, p);
        full.yaw = 1.0; full.headYaw = -0.9; full.wL = 1; onCircle(-1.0, 0.54, 1.33, full.fL); full.wR = 1; full.fR.set(0.14, 1.42, 0.26 * smooth(0, 0.2, t)); full.dir.set(0, 1, 0); onCircle(-1.0, -1, 0, full.piatto);
        const g = newPose(); guard(g); mixPose(p, full, g, smooth(0.35, 1, t));
        break;
      }
      case 'lancia': { // magia: due mani avanti
        guard(p);
        if (kind === 'fuoco') { // sparo: rinculo all'indietro e in su, poi torna
          const k = t < 0.12 ? t / 0.12 : Math.max(0, 1 - (t - 0.12) / 0.6);
          p.fR.add(tmp.set(0, 0.06 * k, 0.14 * k)); p.dir.set(0, 0.04 + 0.45 * k, -1).normalize(); p.fL.copy(p.fR).addScaledVector(p.dir, Math.min(0.32, bladeLen * 0.5)); p.lean = -0.08 * k;
          break;
        } const e = Math.sin(Math.PI * Math.min(1, t * 1.3));
        p.wR = Math.max(p.wR, e); p.fR.lerp(tmp.set(0.13, 1.3, -0.5), e); p.wL = e; p.fL.set(-0.13, 1.3, -0.5); p.lean = 0.12 * e;
        break;
      }
      case 'beve': { // la mano libera (la sinistra, la destra con l'arco) porta la pozione alla bocca, testa all'indietro
        guard(p); const e = Math.sin(Math.PI * Math.min(1, t * 1.15));
        if (kind === 'arco') { p.wR = e; p.fR.set(0.05, 1.47, -0.17); } else { p.wL = e; p.fL.set(-0.05, 1.47, -0.17); }
        p.headUp = 0.45 * e;
        break;
      }
      case 'colpito': guard(p); p.lean = -0.28; p.twist = 0.15; break;
      default: guard(p);
    }
  }

  // ---- stato ----
  let cur: DungeonView['hero'] | null = null, key = '', prevT = 0, curT = 0, prevC = 0, curC = 0, pieno = false;
  let px = o.x, pz = o.z, speed = 0, flashT = 0, fullT = 0, deadT = 0, clock = 0, blendT = 1;
  const target = newPose(), from = newPose(), final = newPose();
  const wrist = v3(), fdir = v3(), def0 = v3(), want = v3(), piatto = v3(), xA = v3(), headP = v3(), m3 = new THREE.Matrix4();
  const POLE_R = v3(0.35, -1, 0.45), POLE_L = v3(-0.35, -1, 0.45), wpR = v3(), wpL = v3();

  function placeWeapon(p: Pose): void {
    if (!weapon || !weapon.visible) return;
    const fore = bow ? B.foreL : B.foreR;
    if (!fore) { weapon.position.copy(avatar.object.position).add(v3(0.3, 0.9, 0).applyQuaternion(avatar.object.quaternion)); weapon.quaternion.copy(avatar.object.quaternion); return; }
    fore.getWorldPosition(wrist);
    fdir.set(0, 1, 0).applyQuaternion(fore.getWorldQuaternion(qp)).normalize(); // l'osso guarda lungo +Y (convenzione Blender)
    wrist.addScaledVector(fdir, FOREARM); // pugno
    inner.getWorldQuaternion(qr);
    // come nelle clip: perpendicolare all'avambraccio, Rx(+90°) nello spazio del corpo
    def0.copy(fdir).applyQuaternion(qi.copy(qr).invert()).applyAxisAngle(X, Math.PI / 2).applyQuaternion(qr).normalize();
    if (p.punta) want.copy(p.punta).applyMatrix4(inner.matrixWorld).sub(wrist).normalize();
    else want.copy(p.dir).applyQuaternion(qr);
    const yA = def0.lerp(want, p.wA).normalize();
    piatto.copy(p.piatto).applyQuaternion(qr).addScaledVector(yA, -piatto.dot(yA));
    if (piatto.lengthSq() < 1e-4) piatto.set(0, 0, 1).applyQuaternion(qr).addScaledVector(yA, -piatto.dot(yA));
    piatto.normalize();
    xA.crossVectors(yA, piatto);
    weapon.position.copy(wrist);
    weapon.quaternion.setFromRotationMatrix(m3.makeBasis(xA, yA, piatto));
  }

  function apply(p: Pose, dt: number): void {
    // corpo intero: giro, accucciata, tremito al pieno, caduta da morto
    const dead = cur?.anim === 'morto';
    if (dead) deadT += dt; else deadT = 0;
    const kd = stepQ(Math.min(1, deadT / 0.3), 3); // a terra a scatti (3 gradini in 0,3 s)
    const shake = cur?.anim === 'carica' && pieno ? 0.014 : 0, sk = Math.floor(clock * 30);
    inner.rotation.set(-1.45 * kd, -p.yaw, 0);
    inner.position.set(shake * Math.sin(sk * 12.9898), 0.15 * kd - 0.1 * p.crouch, shake * Math.sin(sk * 78.233));
    avatar.object.updateMatrixWorld(true);
    rot(B.spine, Y, -p.twist); rot(B.spine, X, -p.lean);
    rot(B.head, Y, -p.headYaw); rot(B.head, X, p.headUp);
    // gambe piegate e un po' aperte
    const k = p.crouch;
    rot(B.thighR, X, 0.55 * k); rot(B.thighL, X, 0.55 * k); rot(B.shinR, X, -1.0 * k); rot(B.shinL, X, -1.0 * k);
    rot(B.thighR, Z, 0.14 * k); rot(B.thighL, Z, -0.14 * k);
    avatar.object.updateMatrixWorld(true);
    // braccia sul pugno voluto
    inner.getWorldQuaternion(qr);
    ik(B.armR, B.foreR, wpR.copy(p.fR).applyMatrix4(inner.matrixWorld), tmp.copy(POLE_R).applyQuaternion(qr), p.wR);
    ik(B.armL, B.foreL, wpL.copy(p.fL).applyMatrix4(inner.matrixWorld), tmp.copy(POLE_L).applyQuaternion(qr), p.wL);
    placeWeapon(p);
  }

  // ---- arco teso: corda alla mano destra, freccia incoccata; linea di mira davanti ----
  const cocca = v3();
  function corda(h: DungeonView['hero']): void {
    if (!arco || !weapon?.visible) return;
    if (h.anim !== 'tende' || !B.foreR) { arco.tendi(null, false); return; }
    B.foreR.getWorldPosition(cocca);
    cocca.addScaledVector(fdir.set(0, 1, 0).applyQuaternion(B.foreR.getWorldQuaternion(qp)).normalize(), FOREARM);
    weapon.updateMatrixWorld(true); weapon.worldToLocal(cocca);
    cocca.z = clamp(cocca.z, 0.17, 0.8); // mai davanti alla corda a riposo, mai oltre l'allungo
    arco.tendi(cocca, true);
  }
  const MIRA = (() => { // 6 trattini piatti per ~4 m lungo −Z
    const p: number[] = [], w = 0.035;
    for (let k = 0; k < 6; k++) {
      const z0 = -0.2 - k * 0.66, z1 = z0 - 0.42;
      p.push(-w, 0, z0, w, 0, z0, w, 0, z1, -w, 0, z0, w, 0, z1, -w, 0, z1);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: PAL.sabbiaChiara, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide }));
    m.name = 'mira'; m.visible = false; m.renderOrder = 2; o.scene.add(m);
    return m;
  })();
  const miraMat = MIRA.material as THREE.MeshBasicMaterial, miraCol = { su: new THREE.Color(PAL.sabbiaChiara), pieno: new THREE.Color(PAL.giallo) };
  let miraDir: { x: number; z: number } | null = null;
  function mira(h: DungeonView['hero'], c: number): void {
    MIRA.visible = !!o.mirino && h.anim === 'tende' && !!arco && !!weapon?.visible;
    if (!MIRA.visible) return;
    const dx = miraDir ? miraDir.x : h.fx, dz = miraDir ? miraDir.z : h.fz, p = avatar.object.position;
    MIRA.position.set(p.x + dx * 0.4, o.floorY + FRECCIA_Y, p.z + dz * 0.4); // dove nasce la freccia nella sim
    MIRA.rotation.set(0, Math.atan2(-dx, -dz), 0);
    miraMat.color.copy(c >= 1 ? miraCol.pieno : miraCol.su); // gialla quando l'arco è teso del tutto
  }

  function glow(h: DungeonView['hero'], t: number, c: number): number {
    if (h.anim === 'carica') return c >= 1 ? 0.6 + 0.4 * (Math.floor(clock * 8) % 2) : stepQ(c, 4) * 0.7; // giallo che cresce a gradini
    if (h.anim === 'attacca' && h.stile === 'giro') return 0.9 * (1 - stepQ(smooth(COLPI.giro.a, 1, t), 4));
    if (h.anim === 'tende') return c >= 1 ? 0.5 : 0;
    return 0;
  }

  return {
    avatar,
    tick(h) {
      const k = h.anim + (h.stile ?? '');
      if (k !== key) {
        // nuova azione: si parte dalla posa di adesso e si va alla nuova in un attimo (niente scatti)
        copyPose(from, final); from.yaw = wrapPi(from.yaw); blendT = 0; key = k;
        prevT = h.t; prevC = h.carica;
      } else { prevT = curT; prevC = curC; }
      curT = h.t; curC = h.carica;
      if (h.anim === 'carica' && h.carica >= 1 && !pieno) { pieno = true; fullT = 0.1; fx.pieno(); }
      if (h.anim !== 'carica') pieno = false;
      const d = Math.sqrt((h.x - px) ** 2 + (h.z - pz) ** 2) * 60; px = h.x; pz = h.z;
      speed = speed * 0.7 + d * 0.3;
      const anim = h.anim === 'morto' ? 'idle' : speed > 4.6 ? 'run' : speed > 0.4 ? 'walk' : 'idle';
      avatar.setPose({ x: h.x, z: h.z, yaw: Math.atan2(h.fx, -h.fz), anim });
      cur = h;
    },
    update(alpha, dt) {
      clock += dt;
      avatar.update(alpha, dt);
      if (cur) {
        const t = lerp(prevT, curT, alpha), c = lerp(prevC, curC, alpha);
        pose(target, cur, t, c);
        blendT += dt;
        mixPose(final, from, target, smooth(0, 0.09, blendT));
        apply(final, dt);
        corda(cur); mira(cur, c);
        const g = glow(cur, t, c);
        for (const m of bladeMats) m.emissive.setRGB(g, g * 0.85, g * 0.3);
        const p = avatar.object.position, st = cur.anim === 'attacca' ? cur.stile ?? 'fendente' : null;
        fx.update({
          x: p.x, y: o.floorY, z: p.z, fx: cur.fx, fz: cur.fz, dt,
          carica: cur.anim === 'carica' ? c : null,
          colpo: st ? { stile: st, t, h: st === 'pugno' ? 1.24 : st === 'affondo' ? 1.14 : 1.08 } : null,
        });
      }
      flashT = Math.max(0, flashT - dt); fullT = Math.max(0, fullT - dt);
      if (flashT > 0) for (const m of bodyMats) m.emissive.setRGB(0.85, 0.79, 0.68);
      else if (fullT > 0) for (const m of bodyMats) m.emissive.setRGB(0.55, 0.45, 0.08); // lampo giallo del pieno
      else for (const m of bodyMats) m.emissive.setRGB(0, 0, 0);
    },
    flash() { flashT = 0.12; },
    setArma: (a) => mount(a),
    mira(d) { miraDir = d; },
    rotta() {
      if (weapon) weapon.visible = false;
      if (kind === 'pugni' || kind === 'arco') return;
      kind = 'pugni'; fx.dispose(); fx = fxFor(pugni().portata);
    },
    head() { return headP.copy(avatar.object.position).setY(avatar.object.position.y + 2.05); },
    dispose() { avatar.object.removeFromParent(); weapon?.removeFromParent(); fx.dispose(); MIRA.removeFromParent(); MIRA.geometry.dispose(); miraMat.dispose(); },
  };
}
