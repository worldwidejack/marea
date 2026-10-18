// Ritratto dell'avatar per l'HUD (#417): la testa di fronte, col look di chi gioca (bottone AVATAR) o di un amico (fumetto «è online»).
// Come i ritratti delle Corse (corse/ritratti.ts) ma senza veicolo: un renderer piccolo a parte, usato per tutti i ritratti in coda e poi
// buttato (sul telefono un secondo WebGL acceso pesa). Chunk caricato dopo l'avvio: l'HUD intanto mostra la testa di riserva.
import * as THREE from 'three';
import type { Look } from '@marea/protocol';
import { createAvatar } from '../game/avatar.ts';
import type { Loader } from '../render/loader.ts';

const LATO = 128;
const fatti = new Map<string, Promise<string>>();
let coda: { look: Look; fatto: (url: string) => void }[] = [];

/** Data URL PNG della testa ('' se WebGL non c'è o qualcosa va storto). Uno per look. */
export function ritrattoAvatar(look: Look, loader: Loader): Promise<string> {
  const k = JSON.stringify(look);
  let f = fatti.get(k);
  if (!f) {
    f = new Promise<string>((fatto) => { coda.push({ look, fatto }); if (coda.length === 1) setTimeout(() => void scatta(loader), 0); });
    fatti.set(k, f);
  }
  return f;
}

async function scatta(loader: Loader): Promise<void> {
  const lista = coda; coda = [];
  if (!lista.length) return;
  let gl: THREE.WebGLRenderer | null = null;
  try { gl = new THREE.WebGLRenderer({ alpha: true, antialias: false, preserveDrawingBuffer: true }); } catch { for (const x of lista) x.fatto(''); return; }
  gl.setPixelRatio(1); gl.setSize(LATO, LATO, false); gl.outputColorSpace = THREE.SRGBColorSpace; gl.setClearColor(0x000000, 0);
  const scena = new THREE.Scene();
  scena.add(new THREE.HemisphereLight(0xffffff, 0x88aacc, 1.8));
  const sole = new THREE.DirectionalLight(0xfff0d8, 2.0); sole.position.set(-3, 6, -8); scena.add(sole);
  const cam = new THREE.PerspectiveCamera(24, 1, 0.05, 50);
  const box = new THREE.Box3();
  for (const { look, fatto } of lista) {
    try {
      const avatar = await createAvatar({ loader, look, x: 0, z: 0 });
      avatar.teleport(0, 0, 0); avatar.update(1, 0);
      scena.add(avatar.object); avatar.object.updateMatrixWorld(true);
      box.setFromObject(avatar.object);
      // la sim guarda verso −z a yaw 0: la camera sta davanti, appena di lato e un filo dall'alto, sulla testa (l'ultimo sesto dell'altezza)
      const alto = box.max.y, testa = alto - (alto - box.min.y) * 0.1, d = (alto - box.min.y) * 0.62;
      cam.position.set(d * 0.18, testa + d * 0.05, -d); cam.lookAt(0, testa - (alto - box.min.y) * 0.035, 0);
      gl.render(scena, cam); fatto(gl.domElement.toDataURL('image/png'));
      scena.remove(avatar.object);
    } catch (e) { console.warn('[marea] ritratto non fatto', e); fatto(''); }
  }
  gl.dispose(); gl.forceContextLoss();
}
