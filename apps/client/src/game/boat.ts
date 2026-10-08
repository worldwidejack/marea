// Barca (WP2): modello `boat_barca` dal manifest o scafo di legno procedurale (4,5 m, prua alta, sedili, remi); beccheggio e rollio
// dolci in funzione di velocità e timone; scia a pixel (sprite piatti in un solo InstancedMesh, pool riusato, 1,5 s di vita);
// guidatore seduto a bordo (un avatar interno, mostrato da setDriver). La fisica resta in stepBoat (@marea/sim).
// La tua barca (#107): colore del fasciame alto (scafo), vela facoltativa su un alberetto a prua, nome dipinto a pixel sui due fianchi.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { newBoat, stepBoat } from '@marea/sim';
import type { AvatarState, BoatState, GridMap, InputFrame } from '@marea/sim';
import type { BarcaLook, Look } from '@marea/protocol';
import { BALANCE } from '@marea/content';
import type { Loader } from '../render/loader.ts';
import { createAvatar, facing, mergeBoxes, vertexMat } from './avatar.ts';
import type { Avatar } from './avatar.ts';
import type { Box } from './avatar.ts';
import { registerStateProvider } from '../test/testapi.ts';
import { hexBarca, telaNome } from './barca_look.ts';

export type Boat = {
  object: THREE.Object3D; state: BoatState; prev: BoatState;
  step(input: InputFrame, map: GridMap): void; update(alpha: number, dt: number, t: number): void;
  /** La Regata muove la barca con la sim del minigioco: `prev` = stato di prima, `state` = `s`, senza `newBoat` (velocità, timone e scia restano). */
  setState(s: BoatState): void;
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
  /** La tua barca (#107): colori di scafo e vela, nome sul fianco. */
  readonly barca: BarcaLook;
  setBarca(b: BarcaLook): void;
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
function hullGeometry(scafo: string = C.legno): THREE.BufferGeometry {
  const falchetta = scafo.toUpperCase() === C.rosso ? C.bianco : C.rosso; // su uno scafo rosso la falchetta chiara
  const interno = scafo === C.legno ? C.chiaro : scafo; // dipinta (#107): anche i fianchi interni, quelli che il diorama vede di più
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
    quad(a.cl, b.cl, b.gl, a.gl, scafo); quad(a.cr, a.gr, b.gr, b.cr, scafo);
    // bordo superiore (falchetta) rosso lanterna
    quad(a.gl, b.gl, ib.gl, ia.gl, falchetta); quad(a.gr, ia.gr, ib.gr, b.gr, falchetta);
    // interno: fianchi chiari e fondo
    quad(ia.gl, ib.gl, ib.fl, ia.fl, interno); quad(ia.gr, ia.fr, ib.fr, ib.gr, interno);
    quad(ia.fl, ib.fl, ib.fr, ia.fr, C.sabbia);
  }
  // specchio di poppa (esterno)
  const s = outer[outer.length - 1]!;
  quad(s.cl, s.k, s.cr, s.gr, scafo); tri(s.cl, s.cr, s.gl, scafo); tri(s.gl, s.cr, s.gr, scafo);
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
/** Alberetto a prua con boma e vela latina (triangolo, due facce) del colore scelto (#107): sta sopra la testa di chi rema.
 *  Normali della vela verso l'alto (materiale liscio): la tela prende il sole da tutte e due le parti, chiara come una vela vera. */
function velaGeometry(col: string): THREE.BufferGeometry {
  const legni = mergeBoxes([{ s: [0.08, 2.65, 0.08], at: [0, 1.6, -0.95], c: C.scuro }, { s: [0.05, 0.05, 1.15], at: [0, 1.55, -0.4], c: C.scuro }]);
  const A = [0, 2.85, -0.92], B = [0, 1.6, -0.92], Cc = [0, 1.6, 0.15], k = new THREE.Color(col);
  const pos = [...A, ...B, ...Cc, ...A, ...B, ...Cc];
  const nor = Array.from({ length: 6 }, () => [0, 1, 0]).flat();
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(Array.from({ length: 6 }, () => [k.r, k.g, k.b]).flat(), 3));
  g.setIndex([0, 1, 2, 3, 5, 4]);
  const m = mergeGeometries([legni, g], false); legni.dispose(); g.dispose();
  return m ?? new THREE.BufferGeometry();
}
let velaMat: THREE.MeshLambertMaterial | null = null;
const velaMaterial = (): THREE.MeshLambertMaterial => (velaMat ??= new THREE.MeshLambertMaterial({ vertexColors: true }));

/** Sezioni dello scafo del modello `boat_barca` (assets/blender/models_prop.py): z, mezza larghezza al bordo e al ginocchio, quote. */
const SEZ_GLB: readonly [number, number, number, number, number][] = [[2.2, 0.56, 0.44, 0.62, 0.22], [1.3, 0.74, 0.6, 0.58, 0.18], [0.0, 0.78, 0.62, 0.58, 0.17], [-1.2, 0.64, 0.5, 0.62, 0.2], [-1.85, 0.36, 0.26, 0.72, 0.3], [-2.3, 0, 0, 0.88, 0.62]];
/** Vernice sul fasciame del modello (#107): le facce «scafo» dei due fianchi, lo specchio di poppa e i fianchi interni (quelli che il
 *  diorama vede di più: la camera sta in alto), 1,5 cm staccata dal legno, del colore scelto. */
function verniceGeometry(col: string): THREE.BufferGeometry {
  const pos: number[] = [], k = new THREE.Color(col), o = 0.015;
  const quad = (a: number[], b: number[], c: number[], d: number[]) => { for (const p of [a, b, c, a, c, d]) pos.push(p[0]!, p[1]!, p[2]!); };
  for (let i = 0; i < SEZ_GLB.length - 1; i++) {
    const [za, wga, wca, yga, yca] = SEZ_GLB[i]!, [zb, wgb, wcb, ygb, ycb] = SEZ_GLB[i + 1]!;
    for (const sx of [1, -1]) {
      const A0 = [sx * (wga + o), yga, za], B0 = [sx * (wgb + o), ygb, zb], B1 = [sx * (wcb + o), ycb - o, zb], A1 = [sx * (wca + o), yca - o, za];
      if (sx > 0) quad(A0, A1, B1, B0); else quad(A0, B0, B1, A1);
      const i = 0.05 + o, I0 = [sx * (wga - i), yga, za], J0 = [sx * (wgb - i), ygb, zb], J1 = [sx * (wcb - i), ycb + i, zb], I1 = [sx * (wca - i), yca + i, za];
      if (sx > 0) quad(I0, J0, J1, I1); else quad(I0, I1, J1, J0);
    }
  }
  const [z0, wg, wc, yg, yc] = SEZ_GLB[0]!, zt = z0 + o;
  quad([-wg, yg, zt], [-wc, yc, zt], [wc, yc, zt], [wg, yg, zt]);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(Array.from({ length: pos.length / 3 }, () => [k.r, k.g, k.b]).flat(), 3));
  g.computeVertexNormals();
  return g;
}
/** TEXEL del nome: 32 per metro (ART_BIBLE §4, insegne). Targa sul bordo di ogni fianco, girata a 45° verso l'alto (la camera del diorama
 *  sta in alto: dipinto sul fasciame si vedrebbe di taglio), letta da fuori. */
const NOME_TEXEL = 1 / 32;
type NomePosa = { x: number; y: number; z: number; tilt: number };
const NOME_GLB: NomePosa = { x: 0.84, y: 0.5, z: 0.5, tilt: -Math.PI / 4 }, NOME_PROC: NomePosa = { x: 0.83, y: 0.47, z: 0.45, tilt: -Math.PI / 4 };
function nomeGeometry(px: number, p: NomePosa): THREE.BufferGeometry {
  const w = px * NOME_TEXEL, h = 7 * NOME_TEXEL, out: THREE.BufferGeometry[] = [];
  for (const side of [1, -1]) {
    const g = new THREE.PlaneGeometry(w, h);
    g.rotateY((side * Math.PI) / 2); g.rotateZ(-side * p.tilt); g.translate(side * p.x, p.y, p.z);
    out.push(g);
  }
  const m = mergeGeometries(out, false); for (const g of out) g.dispose();
  return m ?? new THREE.BufferGeometry();
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
        if (age[i]! >= WAKE_LIFE) { mesh.setMatrixAt(i, zero); continue; } // (dopo il ciclo: senza sprite vivi il mesh non si disegna)
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
      mesh.visible = alive > 0; // una draw call in meno per ogni barca ferma (le barche ormeggiate degli amici, #6)
    },
    dispose() { geo.dispose(); mat.dispose(); mesh.dispose(); },
  };
}

export async function createBoat(o: { loader: Loader; x: number; z: number; look?: Look; barca?: BarcaLook }): Promise<Boat> {
  const object = new THREE.Group(); object.name = 'barca'; object.rotation.order = 'YXZ';
  const body = new THREE.Group(); object.add(body); // il corpo beccheggia/rolla; la scia resta fuori (mondo)
  const seat = SEAT.clone();
  let oarL: THREE.Object3D | null = null, oarR: THREE.Object3D | null = null;
  let modelOk = false, hull: THREE.Mesh | null = null;
  if (o.loader.has('boat_barca')) {
    try {
      const { scene } = await o.loader.load('boat_barca'); body.add(scene); modelOk = true;
      const s = scene.getObjectByName('seat'); if (s) { scene.updateMatrixWorld(true); seat.copy(body.worldToLocal(s.getWorldPosition(new THREE.Vector3()))); }
      oarL = scene.getObjectByName('oar_l') ?? null; oarR = scene.getObjectByName('oar_r') ?? null;
    } catch (e) { console.warn('[marea] boat_barca non caricabile, uso il segnaposto', e); }
  }
  if (!modelOk) {
    const mat = vertexMat().clone(); mat.side = THREE.DoubleSide; // lo scafo è un guscio aperto: visibile da sopra e da sotto
    const h = new THREE.Mesh(hullGeometry(), mat), fit = new THREE.Mesh(fittingsGeometry(), vertexMat());
    h.castShadow = fit.castShadow = true; body.add(h, fit); hull = h;
    const oar = oarGeometry();
    for (const side of [-1, 1]) {
      const pivot = new THREE.Group(); pivot.position.set(side * 0.78, 0.62, 0.42); const m = new THREE.Mesh(oar, vertexMat()); m.castShadow = true; pivot.add(m);
      if (side < 0) m.scale.x = -1; // specchia: pala verso l'esterno
      body.add(pivot); if (side < 0) oarL = pivot; else oarR = pivot;
    }
  }
  // vela e nome (#107): nascosti finché la barca è quella di serie
  const vela = new THREE.Mesh(new THREE.BufferGeometry(), velaMaterial()); vela.name = 'vela'; vela.castShadow = true; vela.visible = false; body.add(vela);
  const vernice = new THREE.Mesh(new THREE.BufferGeometry(), vertexMat()); vernice.name = 'vernice'; vernice.visible = false; if (modelOk) body.add(vernice);
  const telaN = document.createElement('canvas'), texN = new THREE.CanvasTexture(telaN);
  texN.magFilter = texN.minFilter = THREE.NearestFilter; texN.generateMipmaps = false; texN.colorSpace = THREE.SRGBColorSpace;
  const nome = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshLambertMaterial({ map: texN, alphaTest: 0.5, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 }));
  nome.name = 'nome_barca'; nome.visible = false; body.add(nome);
  let barca: BarcaLook = { scafo: 'legno', vela: 'nessuna', nome: '' }, barcaKey = JSON.stringify(barca);
  const wake = createWake(); object.add(wake.mesh);
  const driver = await createAvatar({ loader: o.loader, look: o.look ?? DEFAULT_LOOK, x: 0, z: 0 });
  driver.attachTo(body, seat); driver.visible = false;

  let state = newBoat(o.x, o.z), prev = state;
  let ticks = 0, pitch = 0, roll = 0, lastSpeed = 0, accel = 0, rowPh = 0, rowAmp = 0, oarBlend = 0;
  const api: Boat = {
    object, get state() { return state; }, get prev() { return prev; }, driving: false, seat, driver,
    step(input, map) { ticks++; prev = state; state = stepBoat(state, input, map); },
    setState(s) { ticks++; prev = state; state = s; },
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
    get barca() { return barca; },
    setBarca(b) {
      const key = JSON.stringify(b); if (key === barcaKey) return;
      const prima = barca; barca = { ...b }; barcaKey = key;
      if (b.scafo !== prima.scafo) {
        const hs = hexBarca(b.scafo) ?? C.legno;
        if (hull) { hull.geometry.dispose(); hull.geometry = hullGeometry(hs); }
        vernice.geometry.dispose(); vernice.geometry = b.scafo === 'legno' ? new THREE.BufferGeometry() : verniceGeometry(hs); vernice.visible = b.scafo !== 'legno';
      }
      const hv = b.vela === 'nessuna' ? null : hexBarca(b.vela);
      if (b.vela !== prima.vela) { vela.geometry.dispose(); vela.geometry = hv ? velaGeometry(hv) : new THREE.BufferGeometry(); }
      vela.visible = !!hv;
      if (b.nome !== prima.nome || b.scafo !== prima.scafo) {
        nome.visible = !!b.nome;
        if (b.nome) { telaNome(b.nome, b.scafo, telaN); texN.dispose(); texN.image = telaN; texN.needsUpdate = true; nome.geometry.dispose(); nome.geometry = nomeGeometry(telaN.width, modelOk ? NOME_GLB : NOME_PROC); }
      }
    },
  };
  if (o.barca) api.setBarca(o.barca);
  if (!registered) {
    registered = true;
    registerStateProvider('wp2_boat', () => ({ ticks, facing: facing(object), wake: wake.count(), pitch, roll, driverVisible: driver.visible, driverAnim: driver.attached, model: modelOk, y: object.position.y }));
  }
  return api;
}
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
