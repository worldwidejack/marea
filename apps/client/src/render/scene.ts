// Renderer Three.js a metà risoluzione con ingrandimento nearest (CSS image-rendering: pixelated), nessun tone mapping: palette esatta.
// Zero post-processing. stats() legge i numeri veri del frame (draw call e triangoli di gl.info, fps misurati tra un render e l'altro).
import * as THREE from 'three';
import type { Flags } from '../flags.ts';
import { createDioramaCamera } from './camera.ts';
import type { DioramaCamera } from './camera.ts';
import { pixelScale } from './pixel.ts';
import { createSky } from './sky.ts';
export type Stats = { drawCalls: number; triangles: number; fps: number; frameMs: number; width?: number; height?: number; textures?: number; geometries?: number };
export type Renderer = {
  gl: THREE.WebGLRenderer; scene: THREE.Scene; camera: THREE.PerspectiveCamera; diorama: DioramaCamera; render(alpha: number, t: number): void; resize(): void; stats(): Stats; dispose(): void;
  /** Scena da disegnare al posto del mondo (dungeon, CONTRACTS §15); null = torna al mondo. La camera diorama resta la stessa. */
  setScene(s: THREE.Scene | null): void;
};
export function createRenderer(o: { canvas: HTMLCanvasElement; flags: Flags }): Renderer {
  const gl = new THREE.WebGLRenderer({ canvas: o.canvas, antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: true, stencil: false });
  gl.setPixelRatio(1); gl.toneMapping = THREE.NoToneMapping; gl.outputColorSpace = THREE.SRGBColorSpace;
  gl.shadowMap.enabled = true; gl.shadowMap.type = THREE.BasicShadowMap;
  o.canvas.style.imageRendering = 'pixelated';
  const scene = new THREE.Scene();
  const sky = createSky(); scene.background = sky.texture; scene.add(sky.object);
  const scale = pixelScale(o.flags);
  const diorama = createDioramaCamera({ aspect: 1, canvas: o.canvas });
  let frames = 0, fps = 0, frameMs = 0, last = performance.now(), acc = 0, calls = 0, tris = 0;
  let w = 1, h = 1, active: THREE.Scene = scene;
  const resize = () => {
    const cw = o.canvas.clientWidth || innerWidth, ch = o.canvas.clientHeight || innerHeight;
    const k = Math.min(1.5, devicePixelRatio || 1) * scale;
    w = Math.max(1, Math.round(cw * k)); h = Math.max(1, Math.round(ch * k));
    gl.setSize(w, h, false);
    diorama.camera.aspect = cw / Math.max(1, ch); diorama.camera.updateProjectionMatrix();
  };
  resize(); addEventListener('resize', resize);
  const vv = window.visualViewport; vv?.addEventListener('resize', resize);
  return {
    gl, scene, camera: diorama.camera, diorama, resize,
    setScene: (s) => { active = s ?? scene; },
    render: () => {
      // Hook prima del render per chi deve riallineare qualcosa dopo world.update (es. il sole sul passo della shadow map).
      for (const c of active.children) (c.userData.preRender as (() => void) | undefined)?.();
      const t0 = performance.now();
      gl.render(active, diorama.camera);
      const t1 = performance.now();
      calls = gl.info.render.calls; tris = gl.info.render.triangles;
      frameMs = frameMs ? frameMs * 0.9 + (t1 - t0) * 0.1 : t1 - t0; frames++; acc += t1 - last; last = t1;
      if (acc >= 500) { fps = (frames * 1000) / acc; frames = 0; acc = 0; }
    },
    stats: () => ({ drawCalls: calls, triangles: tris, fps: Math.round(fps * 10) / 10, frameMs: Math.round(frameMs * 100) / 100, width: w, height: h, textures: gl.info.memory.textures, geometries: gl.info.memory.geometries }),
    dispose: () => { removeEventListener('resize', resize); vv?.removeEventListener('resize', resize); diorama.dispose(); gl.dispose(); },
  };
}
