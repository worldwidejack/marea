// Camera diorama: pitch 45°, yaw 45°, FOV 30°, distanza 28 m × zoom [0,6-1,6], segue il bersaglio. Stub funzionante (WP0); WP1 rifinisce.
import * as THREE from 'three';
export type DioramaCamera = { camera: THREE.PerspectiveCamera; follow(x: number, y: number, z: number): void; zoom: number; yaw: number; setZoom(z: number): void; update(dt: number): void; dispose(): void };
const PITCH = Math.PI / 4, YAW = Math.PI / 4, DIST = 28, ZMIN = 0.6, ZMAX = 1.6;
export function createDioramaCamera(o: { aspect: number; canvas: HTMLCanvasElement }): DioramaCamera {
  const camera = new THREE.PerspectiveCamera(30, o.aspect, 0.5, 400);
  const target = new THREE.Vector3(), cur = new THREE.Vector3();
  let zoom = 1, zoomTarget = 1, first = true;
  const onWheel = (e: WheelEvent) => { e.preventDefault(); zoomTarget = clamp(zoomTarget * (1 + Math.sign(e.deltaY) * 0.1)); };
  let pinch = 0;
  const onTouch = (e: TouchEvent) => {
    if (e.touches.length !== 2) { pinch = 0; return; }
    const t0 = e.touches[0]!, t1 = e.touches[1]!;
    const d = Math.hypot(t0.clientX - t1.clientX, t0.clientY - t1.clientY);
    if (pinch) zoomTarget = clamp(zoomTarget * (pinch / d));
    pinch = d;
  };
  o.canvas.addEventListener('wheel', onWheel, { passive: false });
  o.canvas.addEventListener('touchmove', onTouch, { passive: true });
  o.canvas.addEventListener('touchend', () => (pinch = 0));
  const clamp = (z: number) => Math.min(ZMAX, Math.max(ZMIN, z));
  const api: DioramaCamera = {
    camera, zoom, yaw: YAW,
    follow: (x, y, z) => { target.set(x, y, z); if (first) { cur.copy(target); first = false; } },
    setZoom: (z) => { zoomTarget = clamp(z); zoom = zoomTarget; },
    update: (dt) => {
      const k = 1 - Math.exp(-dt * 6);
      cur.lerp(target, k);
      zoom += (zoomTarget - zoom) * k;
      api.zoom = zoom;
      const d = DIST * zoom;
      camera.position.set(cur.x + Math.sin(YAW) * Math.cos(PITCH) * d, cur.y + Math.sin(PITCH) * d, cur.z + Math.cos(YAW) * Math.cos(PITCH) * d);
      camera.lookAt(cur);
    },
    dispose: () => { o.canvas.removeEventListener('wheel', onWheel); o.canvas.removeEventListener('touchmove', onTouch); },
  };
  return api;
}
