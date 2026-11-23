// Lo strato dei personaggi a sprite: il mondo resta a metà risoluzione (stessi pixel di sempre), gli sprite si disegnano sopra alla
// risoluzione vera dello schermo, così hanno i bordi netti a ogni zoom. La scena (o la passata finale di render/post.ts) va in un'immagine
// piccola, che si ingrandisce «nearest» sulla tela; poi gli sprite, nascosti da ciò che gli sta davanti con la profondità della scena.
// Con la grafica bassa la tela resta piccola e anche gli sprite sono a pixel grossi.
import * as THREE from 'three';
import type { Renderer, Strato } from '../render/scene.ts';
import type { Atlante, Voce } from './atlante.ts';

/** Sotto questi fotogrammi al secondo, per questi secondi di fila, la tela torna piccola (gli sprite a pixel grossi come il mondo). */
const LENTO_FPS = 24, LENTO_S = 4;
/** Pixel massimi della tela piena (2560×1440): oltre, l'ingrandimento lo fa il CSS. */
const MAX_PIXEL = 3_700_000;
const VERT = /* glsl */ `varying vec2 vP; varying float vZ, vAlto;
uniform vec2 uDim; uniform float uPiedeY;
void main() {
  vP = vec2(uv.x, 1.0 - uv.y) * uDim;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vZ = -mv.z; vAlto = mv.y - uPiedeY;
  gl_Position = projectionMatrix * mv;
}`;
const FRAG = /* glsl */ `#include <packing>
varying vec2 vP; varying float vZ, vAlto;
uniform sampler2D map, tDepth;
uniform vec2 uDim, uOrigine, uAtlante, uTela;
uniform float uNear, uFar, uPendenza, uOpaco, uLampo, uExp, uSat, uCon;
uniform vec3 uTint, uLuce;
void main() {
  // in piedi: il disegno guarda la camera, ma la profondità è quella di una figura dritta (sopra i piedi) o stesa a terra (sotto)
  float z = vZ - (vAlto > 0.0 ? vAlto * uPendenza : -vAlto / uPendenza) - 0.3;
  float d = texture2D(tDepth, gl_FragCoord.xy / uTela).x;
  if (d < 0.99999 && -perspectiveDepthToViewZ(d, uNear, uFar) < z) discard;
  // pixel d'arte netti: si sfuma solo per la larghezza di un pixel dello schermo sul bordo fra due pixel d'arte
  vec2 fw = max(fwidth(vP), vec2(1e-4)), seam = floor(vP + 0.5);
  vec2 p = seam + clamp((vP - seam) / fw + 0.5, 0.0, 1.0) - 0.5;
  vec4 t = textureGrad(map, (uOrigine + p) / uAtlante, dFdx(vP) / uAtlante, dFdy(vP) / uAtlante);
  if (t.a < 0.5) discard;
  vec2 q = floor(vP);
  if (uOpaco < 1.0 && mod(q.x * 2.0 + q.y * 3.0, 5.0) / 5.0 + 0.1 > uOpaco) discard; // dissolvenza a pixel
  vec3 c = mix(t.rgb / t.a * uLuce, vec3(0.9, 0.86, 0.75), uLampo) * uExp * uTint;
  c = max(mix(vec3(dot(c, vec3(0.2126, 0.7152, 0.0722))), c, uSat), 0.0);
  vec3 s = clamp(sRGBTransferOETF(vec4(c, 1.0)).rgb, 0.0, 1.0);
  gl_FragColor = vec4(clamp((s - 0.5) * uCon + 0.5, 0.0, 1.0), 1.0);
}`;

/** Un personaggio disegnato: chi lo usa lo posa a ogni frame con `posa`, lo strato lo disegna se la sua scena è quella attiva. */
export type SpriteHd = {
  /** Da disegnare in questo frame. */
  visibile: boolean;
  /** 0..1: dissolvenza a pixel; lampo 0..1 verso il bianco (colpito). */
  opaco: number; lampo: number;
  readonly luce: THREE.Color;
  /** `m` = metri per pixel del disegno; `gira` = rad di rotazione sullo schermo attorno al petto. */
  posa(a: Atlante, v: Voce, o: { x: number; y: number; z: number; m: number; specchio: boolean; gira: number }): void;
  /** Un punto del disegno (pixel) nel mondo. */
  punto(px: number, py: number, out: THREE.Vector3): THREE.Vector3;
  togli(): void;
};
type StratoSprite = Strato & { dispose(): void };

export function creaStrato(renderer: Renderer): StratoSprite {
  const gl = renderer.gl, cam = renderer.camera;
  let piena = true, prima = 0, lento = 0;
  const comuni = {
    tDepth: { value: null as THREE.Texture | null }, uTela: { value: new THREE.Vector2(1, 1) }, uNear: { value: 1 }, uFar: { value: 300 }, uPendenza: { value: 1 },
    uExp: { value: 1 }, uSat: { value: 1 }, uCon: { value: 1 }, uTint: { value: new THREE.Color(1, 1, 1) },
  };
  type Interno = SpriteHd & { scena: THREE.Object3D; mesh: THREE.Mesh; prima(): void };
  const piatto = new THREE.PlaneGeometry(1, 1), lista = new Set<Interno>();
  const tutto = new THREE.Scene(); tutto.name = 'strato_sprite';
  // l'immagine piccola ingrandita a tutto schermo: si disegna per prima, poi gli sprite dal più lontano
  const uFondo = { tColor: { value: null as THREE.Texture | null }, uCodifica: { value: 0 } };
  const fondo = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: 'varying vec2 vUv; uniform sampler2D tColor; uniform float uCodifica; void main() { vec3 c = texture2D(tColor, vUv).rgb; gl_FragColor = vec4(uCodifica > 0.5 ? sRGBTransferOETF(vec4(c, 1.0)).rgb : c, 1.0); }',
    uniforms: uFondo, depthTest: false, depthWrite: false, transparent: true }));
  fondo.frustumCulled = false; fondo.renderOrder = -1e6; tutto.add(fondo);
  const NEAREST = { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter } as const;
  const profondita = new THREE.DepthTexture(1, 1); profondita.type = THREE.UnsignedIntType;
  const diretta = new THREE.WebGLRenderTarget(1, 1, { ...NEAREST, depthTexture: profondita, colorSpace: THREE.SRGBColorSpace });
  const finale = new THREE.WebGLRenderTarget(1, 1, { ...NEAREST, depthBuffer: false });
  const tmp = new THREE.Vector3(), avanti = new THREE.Vector3(), UNO = new THREE.Vector3(1, 1, 1), ASSE = new THREE.Vector3(0, 0, 1);
  const rot = new THREE.Quaternion(), su = new THREE.Vector3(), M = new THREE.Matrix4(), L = new THREE.Matrix4();

  function nuovo(scena: THREE.Object3D): SpriteHd {
    const u = {
      ...comuni, map: { value: null as THREE.Texture | null }, uDim: { value: new THREE.Vector2(1, 1) }, uOrigine: { value: new THREE.Vector2() }, uAtlante: { value: new THREE.Vector2(1, 1) },
      uPiedeY: { value: 0 }, uOpaco: { value: 1 }, uLampo: { value: 0 }, uLuce: { value: new THREE.Color(1, 1, 1) },
    };
    const mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: u, side: THREE.DoubleSide, depthTest: false, depthWrite: false, transparent: true });
    const mesh = new THREE.Mesh(piatto, mat); mesh.frustumCulled = false; mesh.matrixAutoUpdate = false;
    const piede = new THREE.Vector3(), giro = new THREE.Quaternion();
    let voce: Voce = [0, 0, 1, 1, 0, 0, 0], m = 1, sx = 1, petto = 0;
    const s: Interno = {
      scena, mesh, visibile: false, opaco: 1, lampo: 0, luce: u.uLuce.value,
      posa(a, v, o) {
        voce = v; m = o.m; sx = o.specchio ? -1 : 1;
        u.map.value = a.tex; u.uDim.value.set(v[2], v[3]); u.uOrigine.value.set(v[0], v[1]); u.uAtlante.value.set(a.w, a.h);
        piede.set(o.x, o.y, o.z);
        giro.setFromAxisAngle(ASSE, o.gira); petto = o.gira ? 28 * m : 0; // si capovolge attorno al petto
      },
      prima() {
        rot.copy(cam.quaternion).multiply(giro); // guarda la camera, col perno ai piedi
        su.set(0, petto, 0).applyQuaternion(cam.quaternion).add(piede);
        M.compose(su, rot, UNO);
        L.makeTranslation(sx * (voce[2] / 2 - voce[4] - 0.5) * m, (voce[5] - voce[3] / 2) * m - petto, 0);
        mesh.matrix.copy(M.multiply(L)).scale(tmp.set(sx * voce[2] * m, voce[3] * m, 1)); mesh.matrixWorldNeedsUpdate = true;
        tmp.copy(piede).applyMatrix4(cam.matrixWorldInverse);
        u.uPiedeY.value = tmp.y; u.uOpaco.value = s.opaco; u.uLampo.value = s.lampo;
        mesh.renderOrder = tmp.z; // dal più lontano al più vicino
      },
      punto: (px, py, out) => out.set(sx * (px - voce[4]) * m, (voce[5] - py) * m, 0).applyQuaternion(cam.quaternion).add(piede),
      togli() { lista.delete(s); mesh.removeFromParent(); mat.dispose(); },
    };
    lista.add(s); tutto.add(mesh);
    return s;
  }

  return {
    nuovo,
    vivo: (scena) => { for (const s of lista) if (s.scena === scena && s.visibile) return true; return false; },
    tela(cw, ch, w, h, bassa) {
      if (bassa || !piena) return [w, h];
      const d = Math.min(2, devicePixelRatio || 1), k = Math.min(1, Math.sqrt(MAX_PIXEL / Math.max(1, cw * ch * d * d)));
      return [Math.max(w, Math.round(cw * d * k)), Math.max(h, Math.round(ch * d * k))];
    },
    get piena() { return piena; },
    misura(w, h) { diretta.setSize(w, h); finale.setSize(w, h); },
    render(scena, post, t, mondo) {
      const ora = performance.now(), dt = (ora - prima) / 1000; prima = ora;
      lento = dt > 1 / LENTO_FPS ? lento + Math.min(dt, 1) : Math.max(0, lento - 2 * dt); // una pausa sola (scheda nascosta, caricamento) conta poco e si smaltisce
      if (lento > LENTO_S) piena = false;
      let calls: number, tris: number;
      if (post) {
        post.render(gl, scena, cam, t, mondo, finale);
        calls = post.sceneCalls() + 1; tris = post.sceneTris() + 2;
        uFondo.tColor.value = finale.texture; uFondo.uCodifica.value = 0; comuni.tDepth.value = post.profondita;
        const g = post.ritocco; comuni.uExp.value = g.uExp.value; comuni.uSat.value = g.uSat.value; comuni.uCon.value = g.uCon.value; comuni.uTint.value.copy(g.uTint.value);
      } else {
        gl.setRenderTarget(diretta); gl.render(scena, cam);
        calls = gl.info.render.calls; tris = gl.info.render.triangles;
        uFondo.tColor.value = diretta.texture; uFondo.uCodifica.value = 1; comuni.tDepth.value = profondita;
        comuni.uExp.value = comuni.uSat.value = comuni.uCon.value = 1; comuni.uTint.value.set(1, 1, 1);
      }
      gl.setRenderTarget(null);
      comuni.uNear.value = cam.near; comuni.uFar.value = cam.far; gl.getDrawingBufferSize(comuni.uTela.value);
      cam.getWorldDirection(avanti);
      comuni.uPendenza.value = Math.max(0.05, -avanti.y / Math.max(0.05, Math.sqrt(1 - avanti.y * avanti.y))); // tangente dell'inclinazione
      for (const s of lista) { s.mesh.visible = s.visibile && s.scena === scena; if (s.mesh.visible) s.prima(); }
      gl.render(tutto, cam);
      return { calls: calls + gl.info.render.calls, tris: tris + gl.info.render.triangles };
    },
    dispose() {
      for (const s of [...lista]) s.togli();
      piatto.dispose(); fondo.geometry.dispose(); fondo.material.dispose(); diretta.dispose(); finale.dispose(); profondita.dispose();
    },
  };
}
