// Ritratto dell'avatar per l'HUD (#417): la testa di fronte, col look di chi gioca (bottone AVATAR e menù).
// Usa il renderer del gioco su un render target piccolo (niente secondo WebGL: accenderlo bloccava il gioco per centinaia di ms),
// poi legge i pixel in un PNG. Chunk caricato dopo l'avvio; il risultato lo tiene in memoria ui/hud_allegro.ts.
import * as THREE from 'three';
import type { Look } from '@marea/protocol';
import { createAvatar } from '../game/avatar.ts';
import type { Loader } from '../render/loader.ts';

const LATO = 128;
const fatti = new Map<string, Promise<string>>();

/** Data URL PNG della testa ('' se qualcosa va storto). Uno per look. */
export function ritrattoAvatar(look: Look, loader: Loader, gl: THREE.WebGLRenderer): Promise<string> {
  const k = JSON.stringify(look);
  let f = fatti.get(k);
  if (!f) { f = scatta(look, loader, gl).catch((e: unknown) => { console.warn('[marea] ritratto non fatto', e); return ''; }); fatti.set(k, f); }
  return f;
}

async function scatta(look: Look, loader: Loader, gl: THREE.WebGLRenderer): Promise<string> {
  const avatar = await createAvatar({ loader, look, x: 0, z: 0 });
  avatar.teleport(0, 0, 0); avatar.update(1, 0);
  const scena = new THREE.Scene();
  scena.add(new THREE.HemisphereLight(0xffffff, 0xaaccee, 2.4));
  const sole = new THREE.DirectionalLight(0xfff0d8, 2.6); sole.position.set(-2, 5, -9); scena.add(sole);
  scena.add(avatar.object); avatar.object.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(avatar.object);
  // la sim guarda verso −z a yaw 0: la camera sta davanti, appena di lato e un filo dall'alto, sulla testa
  const alto = box.max.y, h = alto - box.min.y, testa = alto - h * 0.1, d = h * 0.62;
  const cam = new THREE.PerspectiveCamera(24, 1, 0.05, 50);
  cam.position.set(d * 0.18, testa + d * 0.05, -d); cam.lookAt(0, testa - h * 0.035, 0);
  const rt = new THREE.WebGLRenderTarget(LATO, LATO, { depthBuffer: true });
  rt.texture.colorSpace = THREE.SRGBColorSpace;
  const prima = gl.getRenderTarget(), colore = gl.getClearColor(new THREE.Color()), alfa = gl.getClearAlpha();
  const px = new Uint8Array(LATO * LATO * 4);
  try {
    gl.setRenderTarget(rt); gl.setClearColor(0x000000, 0); gl.clear();
    gl.render(scena, cam);
    gl.readRenderTargetPixels(rt, 0, 0, LATO, LATO, px);
  } finally {
    gl.setRenderTarget(prima); gl.setClearColor(colore, alfa);
    rt.dispose(); scena.remove(avatar.object);
  }
  // le righe del render target vanno dal basso in alto: si rovesciano nel canvas
  const cv = document.createElement('canvas'); cv.width = cv.height = LATO;
  const g = cv.getContext('2d'); if (!g) return '';
  const img = g.createImageData(LATO, LATO);
  for (let y = 0; y < LATO; y++) img.data.set(px.subarray((LATO - 1 - y) * LATO * 4, (LATO - y) * LATO * 4), y * LATO * 4);
  g.putImageData(img, 0, 0);
  return cv.toDataURL('image/png');
}
