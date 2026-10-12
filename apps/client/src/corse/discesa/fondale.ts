// Il fondale della discesa (#229): un panorama dipinto e animato (video in loop: nuvole, mare che luccica, la barca, i gabbiani) su una
// sfera intorno alla camera, che la segue solo in traslazione: è lontanissimo, quindi niente parallasse. Non scrive la profondità: la
// passata finale lo tratta come cielo (niente foschia né contorni) ma lo passa dalla palette, così si fonde col 3D vicino.
// Mappatura: azimut → u, altezza → v. Il panorama copre `ampiezza` gradi centrati su `centro` (la direzione del mare); fuori si
// specchia (dietro le spalle non si guarda quasi mai). Sopra il bordo alto il colore del cielo, sotto il bordo basso quello del mare.
import * as THREE from 'three';

export type Fondale = { mesh: THREE.Mesh; video: HTMLVideoElement | null; segui(camera: THREE.Camera): void; pronto(): boolean; dispose(): void };

const VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = position;
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww; // sul piano lontano: dietro a tutto
}`;
const FRAG = /* glsl */ `
varying vec3 vDir;
uniform sampler2D uMap;
uniform float uCentro, uAmpiezza, uAlto, uBasso, uPronto;
uniform vec3 uCielo, uMare;
void main() {
  vec3 d = normalize(vDir);
  float az = atan(d.z, d.x);
  float u = (az - uCentro) / uAmpiezza + 0.5;
  u = 1.0 - abs(mod(u, 2.0) - 1.0); // specchiato fuori dal panorama
  float el = asin(clamp(d.y, -1.0, 1.0));
  float v = (el - uBasso) / (uAlto - uBasso);
  vec3 c = v > 1.0 ? uCielo : v < 0.0 ? uMare : texture2D(uMap, vec2(u, v)).rgb;
  if (uPronto < 0.5) c = el > 0.0 ? uCielo : uMare;
  gl_FragColor = vec4(c, 1.0);
  #include <colorspace_fragment>
}`;

/** `src` = i file del video (webm per Chrome, mp4 per Safari), `poster` = il primo fotogramma (finché il video non parte). `src` vuoto =
 *  un'immagine fissa (il `poster`), come i fondali delle piste delle Corse (#258). */
export function creaFondale(o: { src: string[]; poster: string; centro: number; ampiezza: number; orizzonte: number; cielo: string; mare: string }): Fondale {
  if (!o.src.length) return fondaleFisso(o);
  const video = document.createElement('video');
  video.muted = true; video.loop = true; video.playsInline = true; video.autoplay = true; video.crossOrigin = 'anonymous'; video.preload = 'auto';
  video.setAttribute('muted', ''); video.setAttribute('playsinline', '');
  for (const s of o.src) { const el = document.createElement('source'); el.src = s; el.type = s.endsWith('.webm') ? 'video/webm' : 'video/mp4'; video.appendChild(el); }
  const tVideo = new THREE.VideoTexture(video);
  const tPoster = new THREE.TextureLoader().load(o.poster, () => { U.uPronto.value = 1; });
  for (const t of [tVideo, tPoster]) { t.colorSpace = THREE.SRGBColorSpace; t.minFilter = THREE.LinearFilter; t.magFilter = THREE.LinearFilter; t.generateMipmaps = false; }
  // il panorama è 16:9: in altezza copre ampiezza × 9/16; `orizzonte` = dove sta l'orizzonte dal basso (0..1)
  const alto = (o.ampiezza * 9) / 16, basso = -alto * o.orizzonte;
  const U = {
    uMap: { value: tPoster as THREE.Texture }, uCentro: { value: o.centro }, uAmpiezza: { value: o.ampiezza }, uAlto: { value: basso + alto }, uBasso: { value: basso },
    uCielo: { value: new THREE.Color(o.cielo) }, uMare: { value: new THREE.Color(o.mare) }, uPronto: { value: 0 },
  };
  const mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: U, depthWrite: false, depthTest: false, side: THREE.BackSide, fog: false });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(100, 32, 16), mat);
  mesh.renderOrder = -1000; mesh.frustumCulled = false; mesh.name = 'fondale';
  let giaVideo = false;
  const prova = () => { video.play().catch(() => { /* senza un gesto può non partire: si riprova al primo tocco */ }); };
  video.addEventListener('playing', () => { if (!giaVideo) { giaVideo = true; U.uMap.value = tVideo; U.uPronto.value = 1; } });
  prova();
  addEventListener('pointerdown', prova, { once: true }); addEventListener('keydown', prova, { once: true });
  return {
    mesh, video,
    segui(camera) { mesh.position.copy(camera.position); },
    pronto: () => U.uPronto.value > 0.5,
    dispose() { video.pause(); video.removeAttribute('src'); tVideo.dispose(); tPoster.dispose(); mat.dispose(); mesh.geometry.dispose(); },
  };
}

/** Il fondale con un'immagine fissa: stessa sfera, niente video. */
function fondaleFisso(o: { poster: string; centro: number; ampiezza: number; orizzonte: number; cielo: string; mare: string }): Fondale {
  const tex = new THREE.TextureLoader().load(o.poster, () => { U.uPronto.value = 1; });
  tex.colorSpace = THREE.SRGBColorSpace; tex.minFilter = THREE.LinearFilter; tex.magFilter = THREE.LinearFilter; tex.generateMipmaps = false;
  const alto = (o.ampiezza * 9) / 16, basso = -alto * o.orizzonte;
  const U = {
    uMap: { value: tex as THREE.Texture }, uCentro: { value: o.centro }, uAmpiezza: { value: o.ampiezza }, uAlto: { value: basso + alto }, uBasso: { value: basso },
    uCielo: { value: new THREE.Color(o.cielo) }, uMare: { value: new THREE.Color(o.mare) }, uPronto: { value: 0 },
  };
  const mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: U, depthWrite: false, depthTest: false, side: THREE.BackSide, fog: false });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(100, 32, 16), mat);
  mesh.renderOrder = -1000; mesh.frustumCulled = false; mesh.name = 'fondale';
  return {
    mesh, video: null,
    segui(camera) { mesh.position.copy(camera.position); },
    pronto: () => U.uPronto.value > 0.5,
    dispose() { tex.dispose(); mat.dispose(); mesh.geometry.dispose(); },
  };
}
