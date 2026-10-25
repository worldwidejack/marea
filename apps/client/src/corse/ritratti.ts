// I ritratti della classifica d'arrivo (#276, risultati_4_sonic.jpg): la testa del pilota di fronte, seduto sul suo veicolo. Gli
// animali sono quelli del kit, tu e gli amici l'avatar MAREA col proprio look. Come le foto del menù (palco.ts): un renderer
// piccolo a parte per tutti quelli chiesti nello stesso momento, poi buttato (sul telefono un secondo WebGL acceso pesa).
import * as THREE from 'three';
import type { Look } from '@marea/protocol';
import { createAvatar } from '../game/avatar.ts';
import { P } from '../render/island_parts.ts';
import { veicoloGeo } from './veicoli3d.ts';
import { caricaKit, kitPronto, loaderCorse, modelloDi, postoAvatar, veicoloKit } from './veicoli_kit.ts';

/** Chi ritrarre: il veicolo e l'animale (`pilota`, cs_p_…) oppure il look dell'avatar. */
export type Chi = { veicolo: string; pilota: string | null; look: Look | null };

const W = 120, H = 100;
const fatti = new Map<string, Promise<string>>();
let coda: { chi: Chi; fatto: (url: string) => void }[] = [];

/** Il ritratto come data URL ('' se WebGL non c'è o il modello manca). Una volta per pilota e veicolo. */
export function ritratto(chi: Chi): Promise<string> {
  const k = chi.pilota ?? JSON.stringify(chi.look);
  let f = fatti.get(k);
  if (!f) {
    f = new Promise<string>((fatto) => { coda.push({ chi, fatto }); if (coda.length === 1) setTimeout(() => void scatta(), 0); });
    fatti.set(k, f);
  }
  return f;
}

async function scatta(): Promise<void> {
  await caricaKit().catch(() => {});
  const loader = await loaderCorse().catch(() => null);
  const lista = coda; coda = [];
  if (!lista.length) return;
  let gl: THREE.WebGLRenderer | null = null;
  try { gl = new THREE.WebGLRenderer({ alpha: true, antialias: false, preserveDrawingBuffer: true }); } catch { for (const x of lista) x.fatto(''); return; }
  gl.setPixelRatio(1); gl.setSize(W, H, false); gl.outputColorSpace = THREE.SRGBColorSpace; gl.setClearColor(0x000000, 0);
  const scena = new THREE.Scene();
  scena.add(new THREE.HemisphereLight(0xffffff, 0x88aacc, 1.7));
  const sole = new THREE.DirectionalLight(0xfff0d8, 2.2); sole.position.set(-4, 8, -8); scena.add(sole);
  const cam = new THREE.PerspectiveCamera(22, W / H, 0.05, 50);
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  const box = new THREE.Box3();
  for (const { chi: x, fatto } of lista) {
    try {
      // la testa in coordinate del veicolo (il muso guarda verso −z): [altezza, z]
      let testa: [number, number] = [1.3, 0];
      let geo: THREE.BufferGeometry;
      let avatar: Awaited<ReturnType<typeof createAvatar>> | null = null;
      // sempre sul kart (aperto): sotto il tetto della sportiva la testa non si vedrebbe; nella foto si vede solo la testa
      const id = 'kart', modello = modelloDi(id);
      const kit = x.pilota && modello && kitPronto() ? veicoloKit(modello, x.pilota, false, () => new THREE.BufferGeometry()) : null;
      if (kit) { // la testa = la cima dei vertici del pilota (vengono dopo quelli del kart)
        geo = kit.geo;
        const da = veicoloKit(modello!, null, true, () => new THREE.BufferGeometry())!.geo.attributes.position!.count, pos = geo.attributes.position!;
        let alto = -Infinity, zMin = Infinity, zMax = -Infinity;
        for (let i = da; i < pos.count; i++) { alto = Math.max(alto, pos.getY(i)); zMin = Math.min(zMin, pos.getZ(i)); zMax = Math.max(zMax, pos.getZ(i)); }
        testa = [alto - 0.3, (zMin + zMax) / 2];
        geo.setDrawRange(da, pos.count - da); // solo il pilota: il volante coprirebbe granchio e gorilla
      }
      else geo = veicoloGeo(id, P.rosso, P.pietraChiara, null, x.pilota, !x.pilota && kitPronto());
      const m = new THREE.Mesh(geo, mat); scena.add(m);
      if (!x.pilota) geo.setDrawRange(0, 0); // l'avatar da solo, seduto
      if (!x.pilota && x.look && loader) {
        avatar = await createAvatar({ loader, look: x.look, x: 0, z: 0 });
        const { seat, scala } = postoAvatar(id, null);
        avatar.attachTo(m, seat, 0); avatar.object.scale.setScalar(scala); avatar.visible = true; avatar.update(1, 0);
        m.updateMatrixWorld(true); box.setFromObject(avatar.object);
        testa = [box.max.y - 0.3 * scala, seat.z];
      }
      // di fronte (il muso guarda verso −z), un po' di lato e dall'alto; l'avatar più da vicino (la testa è più piccola)
      const d = avatar ? 1.25 : 2.0;
      cam.position.set(0.32 * d, testa[0] + 0.16 * d, testa[1] - d); cam.lookAt(0, testa[0], testa[1]);
      gl.render(scena, cam); fatto(gl.domElement.toDataURL('image/png'));
      if (avatar) { avatar.attachTo(null); avatar.object.removeFromParent(); }
      scena.remove(m); geo.dispose();
    } catch (e) { console.warn('[corse] ritratto non fatto', e); fatto(''); }
  }
  mat.dispose(); gl.dispose(); gl.forceContextLoss();
}
