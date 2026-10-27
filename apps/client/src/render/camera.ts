// Camera diorama (ART_BIBLE §7): prospettica FOV 30°, pitch 45° verso il basso, yaw 45°, distanza 28 m × zoom ∈ [0,6, 1,6].
// Inseguimento con molla a smorzamento critico (niente scatti all'avvio/arresto, niente jitter da fermo); rotella su PC e barra zoom su mobile.
import * as THREE from 'three';
export type DioramaCamera = {
  camera: THREE.PerspectiveCamera;
  follow(x: number, y: number, z: number): void;
  zoom: number;
  /** Yaw della camera attorno a Y (0 = guarda verso −Z). La legge l'input per ruotare il joystick in assi mondo. */
  yaw: number;
  setZoom(z: number): void;
  update(dt: number): void;
  dispose(): void;
  /** Porta subito la camera sul bersaglio (teletrasporto, cambio scena). */
  snap?(): void;
  /** Cambia inclinazione (rad), FOV (°) e distanza (m) della vista. Solo le pagine di prova (provapixel): il gioco usa sempre CAM. */
  setView?(pitch: number, fov: number, dist: number): void;
  /** Modalità foto (#109): gira attorno al bersaglio (yaw, rad) e cambia inclinazione (rad, mai sotto l'orizzonte). La yaw di serie è CAM.YAW. */
  orbit?(yaw: number, pitch: number): void;
  /** Inclinazione attuale (rad). */
  readonly pitch?: number;
  /** Interni (#265, la stanza della casa): inquadratura fissa (yaw e pitch in rad, distanza in m, FOV in °) che ignora zoom, rotella,
   *  e vista delle impostazioni finché non si passa null; con null torna esattamente com'era. */
  blocca?(v: { yaw: number; pitch: number; dist: number; fov: number } | null): void;
  readonly isLocked?: boolean;
};
export const CAM = { PITCH: Math.PI / 4, YAW: Math.PI / 4, FOV: 30, DIST: 28, ZMIN: 0.6, ZMAX: 2.2, SMOOTH: 0.22, ZOOM_SMOOTH: 0.12 } as const;
const clamp = (z: number) => Math.min(CAM.ZMAX, Math.max(CAM.ZMIN, z));

/** Molla critica (SmoothDamp): segue senza overshoot, continua in velocità. */
function damp(cur: number, target: number, vel: { v: number }, smooth: number, dt: number): number {
  const w = 2 / smooth, x = w * dt, e = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  const d = cur - target, tmp = (vel.v + w * d) * dt;
  vel.v = (vel.v - w * tmp) * e;
  let out = target + (d + tmp) * e;
  if ((target - cur > 0) === (out > target)) { out = target; vel.v = 0; }
  return out;
}

export function createDioramaCamera(o: { aspect: number; canvas: HTMLCanvasElement; pitch?: number; fov?: number; dist?: number; far?: number }): DioramaCamera {
  let pitch = o.pitch ?? CAM.PITCH, dist = o.dist ?? CAM.DIST, yaw: number = CAM.YAW;
  const camera = new THREE.PerspectiveCamera(o.fov ?? CAM.FOV, o.aspect, 1, o.far ?? 300);
  const target = new THREE.Vector3(), cur = new THREE.Vector3();
  const vx = { v: 0 }, vy = { v: 0 }, vz = { v: 0 }, vzoom = { v: 0 };
  // Telefono in verticale: si parte un po' più larghi (sempre dentro [0,6, 1,6]) perché con FOV verticale 30° il campo orizzontale è stretto.
  const portrait = o.canvas.clientHeight > o.canvas.clientWidth * 1.2;
  let zoom = portrait ? 1.3 : 1, zoomTarget = zoom, first = true;
  // Offset unitario camera → bersaglio: da sud-est (yaw 45°) guardando a nord-ovest, 45° dall'alto.
  const off = new THREE.Vector3();
  const aim = () => off.set(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
  aim();

  let lock: { yaw: number; pitch: number; dist: number; fov: number } | null = null, fov0 = camera.fov;
  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    if (lock) return;
    // deltaY continuo (trackpad) o a scatti (rotella): zoom esponenziale, così ogni tacca pesa uguale a ogni livello.
    const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * 400 : e.deltaY;
    zoomTarget = clamp(zoomTarget * Math.exp(Math.max(-60, Math.min(60, dy)) * (e.ctrlKey ? 0.01 : 0.0022)));
  };
  o.canvas.addEventListener('wheel', onWheel, { passive: false });

  const lockOff = new THREE.Vector3();
  const place = () => {
    const d = lock ? lock.dist : dist * zoom, o = lock ? lockOff : off;
    camera.position.set(cur.x + o.x * d, cur.y + o.y * d, cur.z + o.z * d);
    camera.lookAt(cur);
  };
  // Orientamento fisso: lo impostiamo una volta, poi si muove solo la posizione (niente micro-rotazioni da lookAt).
  const api: DioramaCamera = {
    camera, zoom, yaw: CAM.YAW, // zoom: valore iniziale, aggiornato a ogni update
    get isLocked() { return lock !== null; },
    follow: (x, y, z) => {
      target.set(x, y, z);
      if (first || cur.distanceToSquared(target) > 30 * 30) { api.snap!(); first = false; }
    },
    snap: () => { cur.copy(target); vx.v = vy.v = vz.v = 0; place(); },
    setView: (p, fov, d) => { pitch = p; dist = d; aim(); fov0 = fov; if (!lock) { camera.fov = fov; camera.updateProjectionMatrix(); } place(); },
    blocca: (v) => {
      lock = v ? { ...v } : null; // copia: in modalità foto la gira orbit(), e l'oggetto di chi chiama non cambia
      if (lock) lockOff.set(Math.sin(lock.yaw) * Math.cos(lock.pitch), Math.sin(lock.pitch), Math.cos(lock.yaw) * Math.cos(lock.pitch));
      api.yaw = lock ? lock.yaw : yaw;
      camera.fov = lock ? lock.fov : fov0; camera.updateProjectionMatrix(); place();
    },
    orbit: (y, p) => {
      const pp = Math.min(Math.PI / 2 - 0.05, Math.max(0.05, p));
      if (lock) { // dentro un interno la modalità foto gira l'inquadratura bloccata; yaw e pitch dell'overworld restano quelli di prima
        lock.yaw = y; lock.pitch = pp; api.yaw = y;
        lockOff.set(Math.sin(y) * Math.cos(pp), Math.sin(pp), Math.cos(y) * Math.cos(pp));
      } else { yaw = y; pitch = pp; api.yaw = yaw; aim(); }
      place();
    },
    get pitch() { return lock ? lock.pitch : pitch; },
    setZoom: (z) => { zoomTarget = clamp(z); zoom = zoomTarget; vzoom.v = 0; api.zoom = zoom; place(); },
    update: (dt) => {
      if (!(dt > 0)) return;
      dt = Math.min(dt, 0.1);
      cur.x = damp(cur.x, target.x, vx, CAM.SMOOTH, dt);
      cur.y = damp(cur.y, target.y, vy, CAM.SMOOTH, dt);
      cur.z = damp(cur.z, target.z, vz, CAM.SMOOTH, dt);
      // Da fermo: quando il resto è sotto il millimetro si aggancia, così l'immagine a metà risoluzione non "respira".
      if (Math.abs(cur.x - target.x) < 1e-3 && Math.abs(vx.v) < 1e-3) { cur.x = target.x; vx.v = 0; }
      if (Math.abs(cur.z - target.z) < 1e-3 && Math.abs(vz.v) < 1e-3) { cur.z = target.z; vz.v = 0; }
      zoom = damp(zoom, zoomTarget, vzoom, CAM.ZOOM_SMOOTH, dt);
      if (Math.abs(zoom - zoomTarget) < 1e-4) { zoom = zoomTarget; vzoom.v = 0; }
      api.zoom = zoom;
      place();
    },
    dispose: () => {
      o.canvas.removeEventListener('wheel', onWheel);
    },
  };
  place();
  return api;
}
