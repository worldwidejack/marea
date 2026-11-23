// Renderer Three.js a metà risoluzione con ingrandimento nearest (CSS image-rendering: pixelated), nessun tone mapping: palette esatta.
// Zero post-processing di serie; con le impostazioni (#53: contorni, stampa, camera bassa) una passata finale (post.ts) via setPost.
// stats() legge i numeri veri del frame (draw call e triangoli di gl.info, fps misurati tra un render e l'altro).
import * as THREE from 'three';
import type { Flags } from '../flags.ts';
import { CAM, createDioramaCamera } from './camera.ts';
import type { DioramaCamera } from './camera.ts';
import { pixelScale } from './pixel.ts';
import { createSky } from './sky.ts';
import type { Sky } from './sky.ts';
import type { Post } from './post.ts';
/** Vista della camera scelta nelle impostazioni (gradi, gradi, metri, metri). */
export type View = { pitch: number; fov: number; dist: number; far: number };
/** Lo strato dei personaggi a sprite (sprite/strato.ts, un chunk): disegna la scena e, sopra, gli sprite a risoluzione piena. */
export type Strato = {
  /** Ci sono sprite da disegnare in questa scena? */
  vivo(scena: THREE.Scene): boolean;
  /** Misure della tela per una finestra di cw×ch pixel CSS e un mondo a w×h. */
  tela(cw: number, ch: number, w: number, h: number, bassa: boolean): [number, number];
  misura(w: number, h: number): void;
  /** La tela è a risoluzione piena? Se il dispositivo fa fatica diventa false e resta così. */
  readonly piena: boolean;
  render(scena: THREE.Scene, post: Post | null, t: number, mondo: boolean): { calls: number; tris: number };
  /** Un personaggio in più in quella scena. */
  nuovo(scena: THREE.Object3D): import('../sprite/strato.ts').SpriteHd;
};
export type Stats = { drawCalls: number; triangles: number; fps: number; frameMs: number; width?: number; height?: number; textures?: number; geometries?: number };
export type Renderer = {
  gl: THREE.WebGLRenderer; scene: THREE.Scene; camera: THREE.PerspectiveCamera; diorama: DioramaCamera; render(alpha: number, t: number): void; resize(): void; stats(): Stats; dispose(): void;
  /** Scena da disegnare al posto del mondo (dungeon, CONTRACTS §15); null = torna al mondo. La camera diorama resta la stessa. */
  setScene(s: THREE.Scene | null): void;
  sky: Sky;
  /** Passata finale (contorni, stampa, foschia): null = render diretto, come sempre. */
  setPost(p: Post | null): void;
  /** Camera delle impostazioni: vale solo in superficie (nei dungeon resta la diorama di sempre). null = di serie. */
  setView(v: View | null): void;
  /** HD (#277, l'isola delle Corse): `k` pixel veri per pixel CSS (al massimo quelli dello schermo); null = la metà pixel di sempre. */
  setNitido?(k: number | null): void;
  /** Personaggi a sprite: null = tutti in 3D, la tela è quella di sempre. */
  setStrato(s: Strato | null): void;
  readonly strato: Strato | null;
  /** Grafica bassa (impostazioni): risoluzione di resa ridotta (pixel.ts) e niente HD. */
  setBassa(on: boolean): void;
  /** Interni del mondo (#265, la stanza della casa): niente cielo né foschia della passata finale, fondo di `colore`; null = all'aperto. */
  setInterno(colore: string | null): void;
  /** Al chiuso: dentro un interno (setInterno con un colore) o in una scena a parte (dungeon, Templari): niente nuvole, pioggia né tuoni. */
  readonly alChiuso: boolean;
  /** Se siamo dentro un interno del mondo (stanza della casa, negozio dei mobili, #490). */
  readonly interno: boolean;
};
export function createRenderer(o: { canvas: HTMLCanvasElement; flags: Flags }): Renderer {
  const gl = new THREE.WebGLRenderer({ canvas: o.canvas, antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: true, stencil: false });
  gl.setPixelRatio(1); gl.toneMapping = THREE.NoToneMapping; gl.outputColorSpace = THREE.SRGBColorSpace;
  gl.shadowMap.enabled = true; gl.shadowMap.type = THREE.BasicShadowMap;
  o.canvas.style.imageRendering = 'pixelated';
  const scene = new THREE.Scene();
  const sky = createSky(); scene.background = sky.texture; scene.add(sky.object);
  const diorama = createDioramaCamera({ aspect: 1, canvas: o.canvas });
  let frames = 0, fps = 0, frameMs = 0, last = performance.now(), acc = 0, calls = 0, tris = 0;
  let nitido: number | null = null, w = 1, h = 1, active: THREE.Scene = scene, post: Post | null = null, view: View | null = null, interno = false, bassa = false, strato: Strato | null = null, conSprite = false, piena = false;
  const camera = diorama.camera, FAR = camera.far;
  const applyView = () => {
    const v = active === scene ? view : null;
    if (v) diorama.setView!((v.pitch * Math.PI) / 180, v.fov, v.dist); else diorama.setView!(CAM.PITCH, CAM.FOV, CAM.DIST);
    camera.far = v ? v.far : FAR; camera.updateProjectionMatrix();
  };
  const hd = () => nitido !== null && !bassa; // in grafica bassa niente HD (Corse): sarebbe tutta la risoluzione risparmiata
  // iOS, girando il telefono, a volte manda «resize» prima di aver rifatto il layout: le misure restano quelle di prima e l'immagine
  // esce stirata. Per questo `render` ricontrolla le misure a ogni frame (cw, ch) e rifà il resize se sono cambiate.
  let cw0 = 0, ch0 = 0;
  const resize = () => {
    const cw = o.canvas.clientWidth || innerWidth, ch = o.canvas.clientHeight || innerHeight;
    cw0 = cw; ch0 = ch;
    const k = hd() ? Math.min(nitido!, devicePixelRatio || 1) : Math.min(1.5, devicePixelRatio || 1) * pixelScale(o.flags, bassa);
    w = Math.max(1, Math.round(cw * k)); h = Math.max(1, Math.round(ch * k));
    const [W, H] = strato && conSprite ? strato.tela(cw, ch, w, h, bassa) : [w, h];
    gl.setSize(W, H, false); post?.setSize(w, h); strato?.misura(w, h);
    diorama.camera.aspect = cw / Math.max(1, ch); diorama.camera.updateProjectionMatrix();
  };
  resize(); addEventListener('resize', resize);
  const vv = window.visualViewport; vv?.addEventListener('resize', resize);
  return {
    gl, scene, camera: diorama.camera, diorama, resize, sky,
    setScene: (s) => {
      const was = active; active = s ?? scene;
      if (was !== active && view) applyView();
      // le scene chiuse (dungeon, Templari) mettono il piano vicino più in là in `userData.near`: più precisione di profondità, niente
      // facce vicine che sfarfallano sui telefoni col depth buffer corto (la camera sta sempre ad almeno 16 m dall'eroe)
      const near = (active.userData.near as number | undefined) ?? 1;
      if (camera.near !== near) { camera.near = near; camera.updateProjectionMatrix(); }
    },
    setStrato: (s) => { strato = s; },
    get strato() { return strato; },
    setPost: (p) => { post = p; post?.setSize(w, h); },
    get alChiuso() { return interno || active !== scene; },
    get interno() { return interno; },
    setInterno: (c) => { interno = c !== null; scene.background = c !== null ? new THREE.Color(c) : sky.texture; },
    setView: (v) => { view = v; applyView(); },
    setNitido: (k) => { if (k === nitido) return; nitido = k; o.canvas.style.imageRendering = hd() ? 'auto' : 'pixelated'; resize(); },
    setBassa: (on) => { if (on === bassa) return; bassa = on; o.canvas.style.imageRendering = hd() ? 'auto' : 'pixelated'; resize(); },
    render: (_alpha, t) => {
      // Hook prima del render per chi deve riallineare qualcosa dopo world.update (es. il sole sul passo della shadow map).
      for (const c of active.children) (c.userData.preRender as (() => void) | undefined)?.();
      if ((o.canvas.clientWidth || innerWidth) !== cw0 || (o.canvas.clientHeight || innerHeight) !== ch0) resize();
      const t0 = performance.now();
      const vivo = !!strato?.vivo(active), grande = vivo && strato!.piena, mondo = active === scene && !interno;
      if (vivo !== conSprite || grande !== piena) { conSprite = vivo; piena = grande; resize(); }
      const s = vivo ? strato!.render(active, post, t, mondo) : null;
      if (s) { calls = s.calls; tris = s.tris; }
      else if (post) { post.render(gl, active, diorama.camera, t, mondo); calls = post.sceneCalls() + 1; tris = post.sceneTris() + 2; }
      else { gl.render(active, diorama.camera); calls = gl.info.render.calls; tris = gl.info.render.triangles; }
      const t1 = performance.now();
      frameMs = frameMs ? frameMs * 0.9 + (t1 - t0) * 0.1 : t1 - t0; frames++; acc += t1 - last; last = t1;
      if (acc >= 500) { fps = (frames * 1000) / acc; frames = 0; acc = 0; }
    },
    stats: () => ({ drawCalls: calls, triangles: tris, fps: Math.round(fps * 10) / 10, frameMs: Math.round(frameMs * 100) / 100, width: w, height: h, textures: gl.info.memory.textures, geometries: gl.info.memory.geometries }),
    dispose: () => { removeEventListener('resize', resize); vv?.removeEventListener('resize', resize); diorama.dispose(); gl.dispose(); },
  };
}
