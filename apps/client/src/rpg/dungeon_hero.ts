// Eroe nel dungeon (R-scena): l'avatar del giocatore (`createAvatar`, look di world.look) mosso dalla vista della sim; clip idle/walk/run
// sotto e, sopra, pose procedurali sulle ossa per HeroAnim (swing, carica col braccio indietro e la lama che si accende a gradini, colpo
// caricato più ampio, arco teso, tiro, lancio della magia, bevuta, colpito con flash, morto a terra). Arma in mano dal catalogo (itemDef:
// modello `arm_*`, `mat_lama` tinto col colore del materiale), sempre perpendicolare all'avambraccio nel piano dello swing.
import * as THREE from 'three';
import type { Look } from '@marea/protocol';
import type { RunHero } from '@marea/sim/rpg/types.ts';
import type { DungeonView, HeroAnim } from '@marea/sim/dungeon/types.ts';
import { hasItem, itemDef } from '@marea/sim/rpg/items.ts';
import type { Loader } from '../render/loader.ts';
import { createAvatar } from '../game/avatar.ts';
import type { Avatar } from '../game/avatar.ts';
import { PAL } from '../ui/style.ts';
import { palColor } from './items_ui.ts';
import { boxes, materialsOf, object, tintBlade } from './dungeon_kit.ts';

export type HeroActor = {
  readonly avatar: Avatar;
  /** Un tick della sim (60 Hz): nuova posa di destinazione. */
  tick(h: DungeonView['hero']): void;
  /** Ogni frame, dopo l'interpolazione: ossa, arma, flash. */
  update(alpha: number, dt: number): void;
  flash(): void;
  /** Punto sopra la testa (numeri del danno). */
  head(): THREE.Vector3;
  dispose(): void;
};

const X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0), UP = new THREE.Vector3(0, 1, 0);
const FOREARM = 0.27; // m dal gomito al pugno
const smooth = (a: number, b: number, t: number) => { const k = Math.max(0, Math.min(1, (t - a) / (b - a))); return k * k * (3 - 2 * k); };
const stepQ = (v: number, n: number) => Math.floor(v * n) / n; // valori a gradini (bagliore, caduta)

export async function createHeroActor(o: { loader: Loader; look: Look; hero: RunHero; scene: THREE.Scene; floorY: number; x: number; z: number }): Promise<HeroActor> {
  const avatar = await createAvatar({ loader: o.loader, look: o.look, x: o.x, z: o.z });
  avatar.setGround(() => o.floorY);
  o.scene.add(avatar.object);
  const bone = (n: string) => avatar.object.getObjectByName(n) ?? null;
  const B = { armR: bone('UpperArm.R'), foreR: bone('LowerArm.R'), armL: bone('UpperArm.L'), foreL: bone('LowerArm.L'), spine: bone('Spine'), head: bone('Head'), hips: bone('Hips') };
  const inner = avatar.object.children[0] ?? avatar.object;
  const bodyMats = materialsOf(avatar.object);

  // ---- arma ----
  const arma = o.hero.arma, bow = arma.kind === 'arco';
  const def = arma.id && hasItem(arma.id) ? itemDef(arma.id) : null;
  let weapon: THREE.Object3D | null = null, bladeMats: THREE.MeshLambertMaterial[] = [];
  if (def?.model) {
    weapon = await object(o.loader, def.model, () => boxes(bow ? [[0.05, 1.2, 0.05, 0, 0, 0.08, PAL.legno]] : [[0.05, 0.2, 0.05, 0, 0.05, 0, PAL.legnoScuro], [0.08, 0.75, 0.03, 0, 0.55, 0, PAL.pietra]]));
    tintBlade(weapon, palColor(def.colore || PAL.pietra));
    bladeMats = materialsOf(weapon).filter((m) => /^mat_lama/.test(m.name));
    if (!bladeMats.length) bladeMats = materialsOf(weapon);
    o.scene.add(weapon);
  }

  // pose: rotazione nello spazio della radice dell'avatar (asse X = destra, −Z = avanti) applicata sopra la clip
  const qa = new THREE.Quaternion(), qp = new THREE.Quaternion(), qr = new THREE.Quaternion(), qi = new THREE.Quaternion();
  function rot(b: THREE.Object3D | null, axis: THREE.Vector3, ang: number): void {
    if (!b || !b.parent || Math.abs(ang) < 1e-4) return;
    b.parent.updateWorldMatrix(true, false);
    avatar.object.getWorldQuaternion(qr);
    b.parent.getWorldQuaternion(qp);
    qi.copy(qr).invert().multiply(qp); // genitore nello spazio della radice
    qa.setFromAxisAngle(axis, ang);
    const d = qi.clone().invert().multiply(qa).multiply(qi);
    b.quaternion.premultiply(d);
  }

  let cur: DungeonView['hero'] | null = null, prevAnim: HeroAnim = 'fermo', charged = false, lastCarica = 0;
  let px = o.x, pz = o.z, speed = 0, flashT = 0, deadT = 0;
  const wrist = new THREE.Vector3(), fdir = new THREE.Vector3(), bdir = new THREE.Vector3(), headP = new THREE.Vector3();

  function pose(h: DungeonView['hero'], dt: number): void {
    const t = h.t;
    let aR = 0, aL = 0, twist = 0, lean = 0, headUp = 0, glow = 0;
    switch (h.anim) {
      case 'carica': aR = -0.35 - 0.75 * h.carica; twist = -0.45 * h.carica; lean = -0.12 * h.carica; glow = h.carica >= 1 ? 0.6 + 0.4 * (Math.floor(performance.now() / 120) % 2) : stepQ(h.carica, 4) * 0.7; break;
      case 'attacca': {
        const big = charged ? 1.35 : 1;
        aR = t < 0.42 ? 0.3 + 2.2 * big * smooth(0, 0.42, t) : t < 0.58 ? 0.3 + 2.2 * big - (2.2 * big + 0.1) * smooth(0.42, 0.58, t) : 0.2 * (1 - smooth(0.58, 1, t));
        twist = (t < 0.5 ? -0.3 : 0.45) * big * (1 - smooth(0.6, 1, t)); lean = t > 0.42 && t < 0.7 ? -0.18 * big : 0;
        glow = charged ? 0.8 * (1 - smooth(0.5, 1, t)) : 0;
        break;
      }
      case 'tende': aL = 1.5; aR = 1.4; twist = -0.25 - 0.25 * h.carica; glow = h.carica >= 1 ? 0.5 : 0; break;
      case 'tira': aL = 1.5; aR = 1.4 - 1.6 * smooth(0, 0.4, t); twist = -0.5 * (1 - t); break;
      case 'lancia': aR = aL = 1.6 * Math.sin(Math.PI * Math.min(1, t * 1.3)); lean = -0.15 * Math.sin(Math.PI * t); break;
      case 'beve': aR = 2.4 * Math.sin(Math.PI * Math.min(1, t * 1.15)); headUp = 0.45 * Math.sin(Math.PI * t); break;
      case 'colpito': lean = 0.3; aL = -0.3; aR = -0.3; break;
      default:
    }
    rot(B.spine, Y, twist); rot(B.spine, X, -lean);
    rot(B.armR, X, aR); rot(B.armL, X, aL);
    if (h.anim === 'tende') rot(B.foreR, Y, 0.9 * h.carica); // la mano destra tira la corda verso il petto
    rot(B.head, X, headUp);
    // morto: a terra a scatti (3 gradini in 0,3 s)
    if (h.anim === 'morto') { deadT += dt; const k = stepQ(Math.min(1, deadT / 0.3), 3); inner.rotation.x = -1.45 * k; inner.position.y = 0.15 * k; }
    for (const m of bladeMats) m.emissive.setRGB(glow, glow * 0.85, glow * 0.3); // giallo che cresce a gradini
  }

  function placeWeapon(): void {
    if (!weapon) return;
    const fore = bow ? B.foreL : B.foreR;
    avatar.object.updateMatrixWorld(true);
    if (!fore) { weapon.position.copy(avatar.object.position).add(new THREE.Vector3(0.3, 0.9, 0).applyQuaternion(avatar.object.quaternion)); weapon.quaternion.copy(avatar.object.quaternion); return; }
    fore.getWorldPosition(wrist);
    fdir.set(0, 1, 0).applyQuaternion(fore.getWorldQuaternion(qp)).normalize(); // l'osso guarda lungo +Y (convenzione Blender)
    wrist.addScaledVector(fdir, FOREARM);
    // lama perpendicolare all'avambraccio nel piano dello swing: Rx(+90°) nello spazio della radice
    avatar.object.getWorldQuaternion(qr);
    bdir.copy(fdir).applyQuaternion(qi.copy(qr).invert()).applyAxisAngle(X, Math.PI / 2).applyQuaternion(qr).normalize();
    weapon.position.copy(wrist);
    weapon.quaternion.setFromUnitVectors(UP, bdir);
  }

  return {
    avatar,
    tick(h) {
      if (prevAnim === 'carica' && h.anim === 'attacca') charged = lastCarica >= 1;
      else if (h.anim !== 'attacca') charged = false;
      if (h.anim === 'carica') lastCarica = h.carica;
      prevAnim = h.anim;
      const d = Math.sqrt((h.x - px) ** 2 + (h.z - pz) ** 2) * 60; px = h.x; pz = h.z;
      speed = speed * 0.7 + d * 0.3;
      const anim = h.anim === 'morto' ? 'idle' : speed > 4.6 ? 'run' : speed > 0.4 ? 'walk' : 'idle';
      avatar.setPose({ x: h.x, z: h.z, yaw: Math.atan2(h.fx, -h.fz), anim });
      cur = h;
    },
    update(alpha, dt) {
      avatar.update(alpha, dt);
      if (cur) pose(cur, dt);
      placeWeapon();
      flashT = Math.max(0, flashT - dt);
      const f = flashT > 0 ? 0.85 : 0;
      for (const m of bodyMats) m.emissive.setRGB(f, f * 0.93, f * 0.8);
    },
    flash() { flashT = 0.12; },
    head() { return headP.copy(avatar.object.position).setY(avatar.object.position.y + 2.05); },
    dispose() { avatar.object.removeFromParent(); weapon?.removeFromParent(); },
  };
}
