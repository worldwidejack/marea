// Giocatore della prova: avatar a proporzioni normali che cammina, barca a vela tra le isole, comandi (joystick a un pollice,
// WASD/frecce, E/Spazio per salire e scendere), camera 3/4 bassa che guarda verso il sole.
import * as THREE from 'three';
import { Builder, PAT } from './paint.ts';
import { COL } from './kit.ts';
import { boat as boatParts, personParts } from './kit2.ts';
import type { Limb } from './kit2.ts';
import type { Mooring, World } from './world.ts';

// ---------- comandi ----------
export function createInput(canvas: HTMLCanvasElement, ui: HTMLElement) {
  const keys = new Set<string>(), joy = { x: 0, y: 0, id: -1, ox: 0, oy: 0 };
  let action = false, zoomTarget = 1;
  const ring = document.createElement('div'), knob = document.createElement('div');
  ring.style.cssText = 'position:absolute;width:120px;height:120px;margin:-60px 0 0 -60px;border-radius:50%;border:2px solid rgba(255,240,215,.55);background:rgba(60,35,20,.18);display:none;pointer-events:none';
  knob.style.cssText = 'position:absolute;left:50%;top:50%;width:52px;height:52px;margin:-26px 0 0 -26px;border-radius:50%;background:rgba(255,236,205,.75);box-shadow:0 2px 8px rgba(0,0,0,.25)';
  ring.appendChild(knob); ui.appendChild(ring);
  addEventListener('keydown', (e) => { keys.add(e.code); if (e.code === 'KeyE' || e.code === 'Space' || e.code === 'Enter') { action = true; e.preventDefault(); } });
  addEventListener('keyup', (e) => keys.delete(e.code));
  addEventListener('blur', () => keys.clear());
  canvas.addEventListener('pointerdown', (e) => {
    if (joy.id !== -1) return;
    joy.id = e.pointerId; joy.ox = e.clientX; joy.oy = e.clientY; joy.x = joy.y = 0;
    ring.style.left = e.clientX + 'px'; ring.style.top = e.clientY + 'px'; ring.style.display = 'block'; knob.style.transform = '';
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerId !== joy.id) return;
    let dx = e.clientX - joy.ox, dy = e.clientY - joy.oy; const l = Math.hypot(dx, dy), R = 50;
    if (l > R) { dx *= R / l; dy *= R / l; }
    joy.x = dx / R; joy.y = dy / R; knob.style.transform = `translate(${dx}px,${dy}px)`;
  });
  const up = (e: PointerEvent) => { if (e.pointerId !== joy.id) return; joy.id = -1; joy.x = joy.y = 0; ring.style.display = 'none'; };
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('wheel', (e) => { e.preventDefault(); zoomTarget = Math.min(1.6, Math.max(0.6, zoomTarget * Math.exp(e.deltaY * 0.0015))); }, { passive: false });
  return {
    /** Direzione voluta in assi schermo (x destra, y giù), lunghezza ≤ 1. */
    move(): { x: number; y: number } {
      let x = joy.x, y = joy.y;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
      if (keys.has('KeyW') || keys.has('ArrowUp')) y -= 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) y += 1;
      const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; }
      return { x, y };
    },
    takeAction() { const a = action; action = false; return a; },
    pressAction() { action = true; },
    get zoom() { return zoomTarget; },
  };
}
export type Input = ReturnType<typeof createInput>;

// ---------- avatar ----------
function buildAvatar(mat: THREE.Material) {
  const root = new THREE.Group(), limbs = {} as Record<Limb, THREE.Group>;
  const look = { shirt: COL.cream, pants: '#5a4a3a', skin: COL.skin, hair: COL.hair2, vest: '#3f5f8a', pack: true };
  for (const l of personParts(look)) {
    const b = new Builder(3);
    for (const p of l.parts) b.add(p.g, p.m, p.c, PAT.PLASTER, { smooth: p.smooth, grad: 0.1, jitter: 0.03 });
    const piv = new THREE.Group(); piv.position.copy(l.pivot);
    const mesh = new THREE.Mesh(b.geometry()!, mat); mesh.castShadow = true; mesh.receiveShadow = true;
    piv.add(mesh); root.add(piv); limbs[l.limb] = piv;
  }
  return { root, limbs };
}

export type Player = ReturnType<typeof createPlayer>;
export function createPlayer(scene: THREE.Scene, world: World, mat: THREE.Material, input: Input) {
  const av = buildAvatar(mat);
  scene.add(av.root);
  const bb = new Builder(9); boatParts(bb, new THREE.Matrix4(), { L: 4.6, sail: true, hull: '#9a6038', sailC: COL.cream });
  const boatMesh = new THREE.Mesh(bb.geometry()!, mat); boatMesh.castShadow = true; boatMesh.receiveShadow = true;
  scene.add(boatMesh);
  const start = world.moorings[0]!;
  const st = {
    x: start.landX - 4, z: start.landZ, y: 1.5, ry: -Math.PI / 2, mode: 'walk' as 'walk' | 'boat', speed: 0, phase: 0,
    boat: { x: start.x, z: start.z, ry: start.ry, v: 0, moored: start as Mooring | null },
  };
  st.y = world.groundAt(st.x, st.z) ?? 1.5;
  const WALK = 4.6, BOAT = 9.5, R = 0.32;
  let boatObj: THREE.Object3D = boatMesh;
  let hint: Mooring | null = null;

  function near(): { act: 'salpa' | 'sbarca'; m: Mooring } | null {
    if (st.mode === 'walk') { const m = st.boat.moored; if (m && Math.hypot(st.x - m.landX, st.z - m.landZ) < 3.2) return { act: 'salpa', m }; return null; }
    for (const m of world.moorings) if (Math.hypot(st.boat.x - m.x, st.boat.z - m.z) < 7) return { act: 'sbarca', m };
    return null;
  }

  function update(dt: number, t: number, camYaw: number) {
    const mv = input.move(), c = Math.cos(camYaw), s = Math.sin(camYaw);
    // assi schermo → mondo (camera che guarda verso −Z ruotata di camYaw)
    const wx = mv.x * c + mv.y * s, wz = -mv.x * s + mv.y * c, mag = Math.hypot(wx, wz);
    const n = near(); hint = n ? n.m : null;
    if (input.takeAction() && n) {
      if (n.act === 'salpa') { st.mode = 'boat'; st.boat.moored = null; }
      else { st.mode = 'walk'; const m = n.m; st.boat.x = m.x; st.boat.z = m.z; st.boat.ry = m.ry; st.boat.v = 0; st.boat.moored = m; st.x = m.landX; st.z = m.landZ; st.y = world.groundAt(st.x, st.z) ?? 1.5; st.ry = Math.atan2(m.landX - m.x, m.landZ - m.z); }
    }
    if (st.mode === 'walk') {
      st.speed = mag > 0.08 ? WALK * Math.min(1, mag) : 0;
      if (st.speed > 0) {
        const tr = Math.atan2(wx, wz); let d = tr - st.ry; d = Math.atan2(Math.sin(d), Math.cos(d)); st.ry += d * Math.min(1, dt * 12);
        const step = st.speed * dt, nx = st.x + (wx / mag) * step, nz = st.z + (wz / mag) * step;
        const ok = (x: number, z: number) => world.groundAt(x, z) !== null && !world.blocked(x, z, R);
        if (ok(nx, nz)) { st.x = nx; st.z = nz; } else if (ok(nx, st.z)) st.x = nx; else if (ok(st.x, nz)) st.z = nz;
      }
      const gy = world.groundAt(st.x, st.z) ?? st.y; st.y += (gy - st.y) * Math.min(1, dt * 14);
      st.phase += st.speed * dt * 2.2;
      const sw = Math.sin(st.phase) * Math.min(1, st.speed / WALK);
      av.limbs.legL.rotation.x = sw * 0.6; av.limbs.legR.rotation.x = -sw * 0.6; av.limbs.armL.rotation.x = -sw * 0.5; av.limbs.armR.rotation.x = sw * 0.5;
      av.root.position.set(st.x, st.y + Math.abs(Math.cos(st.phase)) * 0.05 * Math.min(1, st.speed / WALK), st.z);
      av.root.rotation.set(0, st.ry, 0);
    } else {
      const b = st.boat;
      const target = mag > 0.08 ? BOAT * Math.min(1, mag) : 0;
      b.v += (target - b.v) * Math.min(1, dt * (target > b.v ? 0.9 : 1.4));
      if (mag > 0.08) { const tr = Math.atan2(wz, wx) * -1; let d = tr - b.ry; d = Math.atan2(Math.sin(d), Math.cos(d)); b.ry += d * Math.min(1, dt * 2.2); }
      const fx = Math.cos(b.ry), fz = -Math.sin(b.ry), nx = b.x + fx * b.v * dt, nz = b.z + fz * b.v * dt;
      if (world.df.at(nx + fx * 2, nz + fz * 2) > 1.2 && Math.hypot(nx, nz) < 150) { b.x = nx; b.z = nz; } else b.v *= 0.3;
      av.limbs.legL.rotation.x = av.limbs.legR.rotation.x = -1.4; av.limbs.armL.rotation.x = av.limbs.armR.rotation.x = -0.5;
      st.x = b.x - fx * 0.6; st.z = b.z - fz * 0.6; st.y = -0.45; st.ry = b.ry + Math.PI / 2;
      av.root.position.set(st.x, st.y + Math.sin(t * 1.6) * 0.06, st.z); av.root.rotation.set(0, st.ry, 0);
    }
    const b = st.boat, bob = Math.sin(t * 1.6) * 0.06;
    boatObj.position.set(b.x, -0.12 + bob, b.z);
    boatObj.rotation.set(Math.sin(t * 1.1) * 0.03, b.ry, Math.sin(t * 1.3 + 1) * 0.02 - (st.mode === 'boat' ? b.v * 0.004 : 0), 'YXZ');
  }
  return {
    /** Sostituisce il modello della barca (prova coi modelli AI). */
    setBoatModel(o: THREE.Object3D) { scene.remove(boatObj); boatObj = o; scene.add(o); },
    update, st, get hint() { return hint; }, near,
    get pos() { return st.mode === 'boat' ? new THREE.Vector3(st.boat.x, 0.5, st.boat.z) : new THREE.Vector3(st.x, st.y, st.z); },
  };
}

// ---------- camera ----------
/** Camera 3/4 bassa e vicina come la reference: guarda verso il sole, l'orizzonte entra in alto. Si allarga in verticale (telefono). */
export function createCamera(canvas: HTMLCanvasElement) {
  const cam = new THREE.PerspectiveCamera(48, 1, 0.5, 1200);
  const cur = new THREE.Vector3(), look = new THREE.Vector3();
  let first = true, zoom = 1, yaw = 0;
  function frame() {
    const a = canvas.clientWidth / Math.max(1, canvas.clientHeight);
    cam.aspect = a;
    // orizzontale minimo ~58°: in verticale il FOV verticale cresce
    const hf = 62 * Math.PI / 180, vf = a < 1 ? 2 * Math.atan(Math.tan(hf / 2) / a) * 180 / Math.PI : 56;
    cam.fov = Math.min(84, vf);
    cam.updateProjectionMatrix();
  }
  frame();
  return {
    cam, frame, get yaw() { return yaw; },
    update(target: THREE.Vector3, dt: number, z: number, inBoat: boolean) {
      zoom += (z - zoom) * Math.min(1, dt * 6);
      const portrait = cam.aspect < 1, pitch = portrait ? 0.68 : 0.5, dist = (inBoat ? 22 : 19) * zoom * (portrait ? 1.05 : 1);
      // punto guardato: un po' avanti (verso il sole) così il giocatore sta nel terzo basso
      const ahead = portrait ? 6 : 4.5;
      const tx = target.x + Math.sin(yaw) * -ahead, tz = target.z - Math.cos(yaw) * ahead;
      const want = new THREE.Vector3(tx - Math.sin(yaw) * -Math.cos(pitch) * dist, target.y + Math.sin(pitch) * dist, tz + Math.cos(yaw) * Math.cos(pitch) * dist);
      if (first) { cur.copy(want); look.set(tx, target.y + 1, tz); first = false; }
      const k = 1 - Math.exp(-dt * 5);
      cur.lerp(want, k); look.lerp(new THREE.Vector3(tx, target.y + 1, tz), k);
      cam.position.copy(cur); cam.lookAt(look);
    },
  };
}
