// Barca (WP2): modello `boat_barca` dal manifest o scafo di legno procedurale (4,5 m, prua alta, sedili, remi); beccheggio e rollio
// dolci in funzione di velocità e timone; scia a pixel (sprite piatti in un solo InstancedMesh, pool riusato, 1,5 s di vita);
// guidatore seduto a bordo (un avatar interno, mostrato da setDriver). La fisica resta in stepBoat (@marea/sim).
import * as THREE from 'three';
import { newBoat, stepBoat } from '@marea/sim';
import type { AvatarState, BoatState, GridMap, InputFrame } from '@marea/sim';
import type { Look } from '@marea/protocol';
import { BALANCE } from '@marea/content';
import type { Loader } from '../render/loader.ts';
import { createAvatar, facing, mergeBoxes, vertexMat } from './avatar.ts';
import type { Avatar } from './avatar.ts';
import type { Box } from './avatar.ts';
import { registerStateProvider } from '../test/testapi.ts';

export type Boat = {
  object: THREE.Object3D; state: BoatState; prev: BoatState;
  step(input: InputFrame, map: GridMap): void; update(alpha: number, dt: number, t: number): void;
  /** Con un AvatarState mostra il guidatore seduto a bordo (avatar interno); `look` opzionale. `null` lo nasconde. */
  setDriver(a: AvatarState | null, look?: Look): void;
  setYaw(yaw: number): void; driving: boolean;
  /** Sposta la barca ferma in (x, z) con la prua a `yaw` (ormeggio, teletrasporto dei test). */
  teleport(x: number, z: number, yaw?: number): void;
  // ---- aggiunte WP2 (vedi tests/out/richieste/wp2.md) ----
  /** Punto di seduta (bacino) in coordinate locali della barca: per `avatar.attachTo(boat.object, boat.seat)`. */
  readonly seat: THREE.Vector3;
  /** Avatar seduto interno usato da setDriver (nascosto quando non si guida). */
  readonly driver: Avatar;
  /** Sprite di scia vivi in questo momento (test/debug). */
  wakeCount(): number;
};

const DEFAULT_LOOK: Look = { pelle: 2, capelli: 0, coloreCapelli: 0, vestito: 0, cappello: 1 };
const SEAT = new THREE.Vector3(0, 0.36, 0.55); // sopra la panca di poppa
const HALF_LEN = 2.25;
const WAKE_POOL = 96, WAKE_LIFE = 1.5;
const C = { legno: '#8E5A2B', chiaro: '#C98A4B', scuro: '#5A3A1E', rosso: '#E8433F', sabbia: '#E2B97F', bianco: '#F4E3C1', schiuma: '#FFFFFF', bassa: '#7FE3E0' };
const wrapPi = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const ease = (dt: number, rate: number) => 1 - Math.exp(-dt * rate);
let registered = false;

// ---------- scafo procedurale: loft di sezioni (chiglia, spigolo, murata) ----------
function hullGeometry(): THREE.BufferGeometry {
  // stazioni: z, semilarghezza della murata, quota della murata (prua rialzata), quota della chiglia
  const st: [number, number, number, number][] = [
    [-2.25, 0.03, 0.86, -0.06], [-1.75, 0.3, 0.74, -0.15], [-1.05, 0.58, 0.63, -0.21], [-0.2, 0.73, 0.56, -0.23],
    [0.65, 0.76, 0.54, -0.23], [1.5, 0.69, 0.56, -0.2], [2.25, 0.54, 0.62, -0.15],
  ];
  const pos: number[] = [], col: number[] = [];
  const cc = (h: string) => new THREE.Color(h);
  const tri = (a: number[], b: number[], c: number[], h: string) => { const k = cc(h); for (const p of [a, b, c]) { pos.push(p[0]!, p[1]!, p[2]!); col.push(k.r, k.g, k.b); } };
  const quad = (a: number[], b: number[], c: number[], d: number[], h: string) => { tri(a, b, c, h); tri(a, c, d, h); };
  const t = 0.07; // spessore della murata
  const outer = st.map(([z, w, gh, kh]) => ({ z, k: [0, kh, z], cl: [-0.55 * w, kh + 0.13, z], cr: [0.55 * w, kh + 0.13, z], gl: [-w, gh, z], gr: [w, gh, z] }));
  const inner = st.map(([z, w, gh, kh], i) => { const zi = z + (i === 0 ? 0.12 : i === st.length - 1 ? -t : 0), wi = Math.max(0.005, w - t), fl = -0.03; return { gl: [-wi, gh, zi], gr: [wi, gh, zi], fl: [-0.55 * wi, fl, zi], fr: [0.55 * wi, fl, zi] }; });
  for (let i = 0; i < st.length - 1; i++) {
    const a = outer[i]!, b = outer[i + 1]!, ia = inner[i]!, ib = inner[i + 1]!;
    // esterno: fasciame basso scuro + alto chiaro
    quad(a.k, b.k, b.cl, a.cl, C.scuro); quad(a.k, a.cr, b.cr, b.k, C.scuro);
    quad(a.cl, b.cl, b.gl, a.gl, C.legno); quad(a.cr, a.gr, b.gr, b.cr, C.legno);
    // bordo superiore (falchetta) rosso lanterna
    quad(a.gl, b.gl, ib.gl, ia.gl, C.rosso); quad(a.gr, ia.gr, ib.gr, b.gr, C.rosso);
    // interno: fianchi chiari e fondo
    quad(ia.gl, ib.gl, ib.fl, ia.fl, C.chiaro); quad(ia.gr, ia.fr, ib.fr, ib.gr, C.chiaro);
    quad(ia.fl, ib.fl, ib.fr, ia.fr, C.sabbia);
  }
  // specchio di poppa (esterno)
  const s = outer[outer.length - 1]!;
  quad(s.cl, s.k, s.cr, s.gr, C.legno); tri(s.cl, s.cr, s.gl, C.legno); tri(s.gl, s.cr, s.gr, C.legno);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}
function fittingsGeometry(): THREE.BufferGeometry {
  const boxes: Box[] = [
    { s: [1.3, 0.07, 0.34], at: [0, 0.325, 0.55], c: C.chiaro }, { s: [1.05, 0.07, 0.3], at: [0, 0.33, -0.55], c: C.chiaro },
    { s: [0.08, 0.2, 0.08], at: [0, 0.75, -2.15], c: C.rosso }, { s: [0.1, 0.05, 0.1], at: [0, 0.88, -2.15], c: '#F5D547' },
    { s: [0.12, 0.09, 0.12], at: [0.7, 0.62, 0.42], c: C.scuro }, { s: [0.12, 0.09, 0.12], at: [-0.7, 0.62, 0.42], c: C.scuro },
  ];
  return mergeBoxes(boxes);
}
function oarGeometry(): THREE.BufferGeometry {
  // impugnatura a −x (dentro), pala a +x (fuori): pivot in 0
  return mergeBoxes([{ s: [1.5, 0.04, 0.05], at: [0.4, 0, 0], c: C.chiaro }, { s: [0.4, 0.03, 0.16], at: [1.2, 0, 0], c: C.sabbia }, { s: [0.1, 0.05, 0.06], at: [-0.3, 0, 0], c: C.scuro }]);
}

// ---------- scia ----------
type Wake = { mesh: THREE.InstancedMesh; update(dt: number, x: number, z: number, yaw: number, wake: number, speed: number): void; count(): number; dispose(): void };
function createWake(): Wake {
  const geo = new THREE.PlaneGeometry(1, 1); geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const mesh = new THREE.InstancedMesh(geo, mat, WAKE_POOL);
  mesh.frustumCulled = false; mesh.castShadow = false; mesh.receiveShadow = false; mesh.name = 'scia';
  mesh.matrixWorldAutoUpdate = false; // le istanze sono in coordinate MONDO anche se il mesh vive dentro la barca
  const age = new Float32Array(WAKE_POOL).fill(WAKE_LIFE), px = new Float32Array(WAKE_POOL), pz = new Float32Array(WAKE_POOL);
  const vx = new Float32Array(WAKE_POOL), vz = new Float32Array(WAKE_POOL), sz = new Float32Array(WAKE_POOL), ry = new Float32Array(WAKE_POOL);
  let next = 0, travel = 0, alive = 0;
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s3 = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), white = new THREE.Color(C.schiuma), foam = new THREE.Color(C.bassa);
  const zero = new THREE.Matrix4().makeScale(0, 0, 0);
  for (let i = 0; i < WAKE_POOL; i++) { mesh.setMatrixAt(i, zero); mesh.setColorAt(i, white); }
  const spawn = (x: number, z: number, dx: number, dz: number, size: number, yaw: number) => {
    const i = next; next = (next + 1) % WAKE_POOL; age[i] = 0; px[i] = x; pz[i] = z; vx[i] = dx; vz[i] = dz; sz[i] = size; ry[i] = yaw;
  };
  return {
    mesh,
    count: () => alive,
    update(dt, x, z, yaw, wake, speed) {
      travel += speed * dt; // una coppia di sprite ogni mezzo metro percorso: la scia non si impasta a bassa velocità
      if (wake > 0.06) {
        const fx = Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = Math.sin(yaw);
        while (travel >= 0.5) {
          travel -= 0.5;
          const sx = x - fx * (HALF_LEN - 0.1 - travel), sz0 = z - fz * (HALF_LEN - 0.1 - travel), size = 0.32 + 0.22 * wake;
          spawn(sx, sz0, 0, 0, size * 1.2, yaw); // schiuma al centro
          for (const side of [-1, 1]) spawn(sx + rx * side * 0.5, sz0 + rz * side * 0.5, rx * side * (0.4 + 0.3 * wake), rz * side * (0.4 + 0.3 * wake), size, yaw); // ramo a V
        }
      } else travel = 0;
      alive = 0;
      for (let i = 0; i < WAKE_POOL; i++) {
        if (age[i]! >= WAKE_LIFE) { mesh.setMatrixAt(i, zero); continue; }
        age[i] = age[i]! + dt; const f = age[i]! / WAKE_LIFE;
        if (f >= 1) { mesh.setMatrixAt(i, zero); continue; }
        alive++;
        px[i] = px[i]! + vx[i]! * dt; pz[i] = pz[i]! + vz[i]! * dt;
        // a scatti (pixel): bianco → acqua bassa, e si restringe a gradini fino a sparire
        const k = f < 0.3 ? 1 : f < 0.6 ? 0.8 : f < 0.85 ? 0.55 : 0.3;
        mesh.setColorAt(i, f < 0.45 ? white : foam);
        q.setFromAxisAngle(up, -ry[i]!); p.set(px[i]!, 0.075, pz[i]!); s3.set(sz[i]! * k, 1, sz[i]! * k * 0.75);
        mesh.setMatrixAt(i, m4.compose(p, q, s3));
      }
      mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    },
    dispose() { geo.dispose(); mat.dispose(); mesh.dispose(); },
  };
}

export async function createBoat(o: { loader: Loader; x: number; z: number; look?: Look }): Promise<Boat> {
  const object = new THREE.Group(); object.name = 'barca'; object.rotation.order = 'YXZ';
  const body = new THREE.Group(); object.add(body); // il corpo beccheggia/rolla; la scia resta fuori (mondo)
  const seat = SEAT.clone();
  let oarL: THREE.Object3D | null = null, oarR: THREE.Object3D | null = null;
  let modelOk = false;
  if (o.loader.has('boat_barca')) {
    try {
      const { scene } = await o.loader.load('boat_barca'); body.add(scene); modelOk = true;
      const s = scene.getObjectByName('seat'); if (s) { scene.updateMatrixWorld(true); seat.copy(body.worldToLocal(s.getWorldPosition(new THREE.Vector3()))); }
      oarL = scene.getObjectByName('oar_l') ?? null; oarR = scene.getObjectByName('oar_r') ?? null;
    } catch (e) { console.warn('[marea] boat_barca non caricabile, uso il segnaposto', e); }
  }
  if (!modelOk) {
    const mat = vertexMat().clone(); mat.side = THREE.DoubleSide; // lo scafo è un guscio aperto: visibile da sopra e da sotto
    const hull = new THREE.Mesh(hullGeometry(), mat), fit = new THREE.Mesh(fittingsGeometry(), vertexMat());
    hull.castShadow = fit.castShadow = true; body.add(hull, fit);
    const oar = oarGeometry();
    for (const side of [-1, 1]) {
      const pivot = new THREE.Group(); pivot.position.set(side * 0.78, 0.62, 0.42); const m = new THREE.Mesh(oar, vertexMat()); m.castShadow = true; pivot.add(m);
      if (side < 0) m.scale.x = -1; // specchia: pala verso l'esterno
      body.add(pivot); if (side < 0) oarL = pivot; else oarR = pivot;
    }
  }
  const wake = createWake(); object.add(wake.mesh);
  const driver = await createAvatar({ loader: o.loader, look: o.look ?? DEFAULT_LOOK, x: 0, z: 0 });
  driver.attachTo(body, seat); driver.visible = false;

  let state = newBoat(o.x, o.z), prev = state;
  let ticks = 0, pitch = 0, roll = 0, lastSpeed = 0, accel = 0, rowPh = 0, rowAmp = 0, oarBlend = 0;
  const api: Boat = {
    object, get state() { return state; }, get prev() { return prev; }, driving: false, seat, driver,
    step(input, map) { ticks++; prev = state; state = stepBoat(state, input, map); },
    update(alpha, dt, t) {
      const x = prev.x + (state.x - prev.x) * alpha, z = prev.z + (state.z - prev.z) * alpha, yaw = prev.yaw + wrapPi(state.yaw - prev.yaw) * alpha;
      const s = Math.min(1, state.speed / BALANCE.barca.maxSpeed);
      accel = lerp(accel, dt > 0 ? (state.speed - lastSpeed) / dt : 0, ease(dt, 6)); lastSpeed = state.speed;
      // beccheggio: prua su con la velocità e quando accelera; rollio: si inclina dentro la curva; onde sempre presenti, più corte con la velocità
      const pitchT = 0.05 * s + Math.max(-0.05, Math.min(0.06, accel * 0.006)) + 0.018 * Math.sin(t * 1.5) + 0.012 * s * Math.sin(t * 6.3);
      const rollT = -state.rudder * (0.05 + 0.13 * s) * Math.min(1, state.speed / 2 + 0.2) + 0.028 * Math.sin(t * 1.25 + 1) + 0.01 * s * Math.sin(t * 5.1);
      pitch = lerp(pitch, pitchT, ease(dt, 5)); roll = lerp(roll, rollT, ease(dt, 5));
      const bob = 0.035 * Math.sin(t * 1.9) + 0.015 * Math.sin(t * 3.3 + 0.5) + 0.02 * s;
      object.position.set(x, 0.07 + bob, z); object.rotation.set(pitch, -yaw, roll); // yaw della sim: avanti = (sin yaw, −cos yaw) → three vuole −yaw
      // remi e rematore: solo se c'è un guidatore e la barca si muove
      const rowing = api.driving && state.speed > 0.4;
      rowAmp = lerp(rowAmp, rowing ? 1 : 0, ease(dt, 6)); oarBlend = lerp(oarBlend, api.driving ? 1 : 0, ease(dt, 4));
      if (rowing) rowPh += dt * Math.PI * 2 * (0.65 + 0.85 * s);
      if (oarL && oarR) {
        const sw = 0.38 * rowAmp * Math.cos(rowPh), dip = 0.42 - 0.2 * rowAmp * Math.max(0, Math.sin(rowPh)) + 0.12 * (1 - oarBlend);
        oarL.rotation.set(0, sw, dip); oarR.rotation.set(0, -sw, -dip);
      }
      driver.visible = api.driving; driver.setRowing(rowing, rowPh); driver.update(alpha, dt);
      wake.update(dt, x, z, yaw, state.wake, state.speed);
    },
    setDriver(a, look) { api.driving = !!a; driver.visible = !!a; if (a && look) driver.setLook(look); },
    setYaw(yaw) { state = { ...state, yaw }; prev = state; object.rotation.y = -yaw; },
    teleport(x, z, yaw) { state = { ...newBoat(x, z), yaw: yaw ?? state.yaw }; prev = state; object.position.set(x, object.position.y, z); object.rotation.y = -state.yaw; },
    wakeCount: () => wake.count(),
  };
  if (!registered) {
    registered = true;
    registerStateProvider('wp2_boat', () => ({ ticks, facing: facing(object), wake: wake.count(), pitch, roll, driverVisible: driver.visible, driverAnim: driver.attached, model: modelOk, y: object.position.y }));
  }
  return api;
}
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
