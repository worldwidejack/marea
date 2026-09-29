// Renderer Three.js a metà risoluzione, nessun tone mapping (palette esatta). Stub funzionante (WP0); WP1 rifinisce.
import * as THREE from 'three';
import type { Flags } from '../flags.ts';
import { createDioramaCamera } from './camera.ts';
import type { DioramaCamera } from './camera.ts';
import { pixelScale } from './pixel.ts';
import { createSky } from './sky.ts';
export type Renderer = { gl: THREE.WebGLRenderer; scene: THREE.Scene; camera: THREE.PerspectiveCamera; diorama: DioramaCamera; render(alpha: number, t: number): void; resize(): void; stats(): { drawCalls: number; triangles: number; fps: number; frameMs: number }; dispose(): void };
export function createRenderer(o: { canvas: HTMLCanvasElement; flags: Flags }): Renderer {
  const gl = new THREE.WebGLRenderer({ canvas: o.canvas, antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: true });
  gl.setPixelRatio(1); gl.toneMapping = THREE.NoToneMapping; gl.outputColorSpace = THREE.SRGBColorSpace;
  gl.shadowMap.enabled = true; gl.shadowMap.type = THREE.BasicShadowMap;
  const scene = new THREE.Scene();
  const sky = createSky(); scene.background = sky.color; scene.add(sky.object);
  const scale = pixelScale(o.flags);
  const diorama = createDioramaCamera({ aspect: 1, canvas: o.canvas });
  let frames = 0, fps = 0, frameMs = 0, last = performance.now(), acc = 0;
  const resize = () => {
    const w = Math.max(1, Math.floor(o.canvas.clientWidth * Math.min(1.5, devicePixelRatio) * scale));
    const h = Math.max(1, Math.floor(o.canvas.clientHeight * Math.min(1.5, devicePixelRatio) * scale));
    gl.setSize(w, h, false);
    diorama.camera.aspect = o.canvas.clientWidth / Math.max(1, o.canvas.clientHeight); diorama.camera.updateProjectionMatrix();
  };
  resize(); addEventListener('resize', resize);
  return {
    gl, scene, camera: diorama.camera, diorama, resize,
    render: () => {
      const t0 = performance.now();
      gl.render(scene, diorama.camera);
      const t1 = performance.now(); frameMs = frameMs * 0.9 + (t1 - t0) * 0.1; frames++; acc += t1 - last; last = t1;
      if (acc >= 500) { fps = (frames * 1000) / acc; frames = 0; acc = 0; }
    },
    stats: () => ({ drawCalls: gl.info.render.calls, triangles: gl.info.render.triangles, fps, frameMs }),
    dispose: () => { removeEventListener('resize', resize); diorama.dispose(); gl.dispose(); },
  };
}
