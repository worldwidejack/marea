// Gli unici sparsi nei dungeon (docs/UNICI.md). L'oggetto a terra è il suo disegno del menu in piedi, che galleggia piano sopra un cerchio
// di luce dorata: si riconosce da lontano e si vede anche al buio. I resti di un avventuriero sono uno scheletro a scatole accasciato
// accanto al suo zaino (si frugano come un cadavere).
import * as THREE from 'three';
import { hasItem, itemDef } from '@marea/sim/rpg/items.ts';
import { PAL } from '../ui/style.ts';
import { boxes } from './dungeon_kit.ts';
import { iconOf } from './items_ui.ts';

const ALTO = 0.95, ONDA = 0.08;

export function oggettoATerra(item: string): THREE.Object3D {
  const g = new THREE.Group();
  if (hasItem(item)) {
    const t = new THREE.CanvasTexture(iconOf(itemDef(item), 16));
    t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.colorSpace = THREE.SRGBColorSpace;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, alphaTest: 0.5, fog: false }));
    sp.scale.setScalar(0.85); sp.position.y = ALTO;
    sp.onBeforeRender = () => { sp.position.y = ALTO + Math.floor(Math.sin(performance.now() / 600) * 4) * (ONDA / 4); }; // a scatti, come il resto
    g.add(sp);
  }
  const anello = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.6, 12, 1), new THREE.MeshBasicMaterial({ color: PAL.giallo, transparent: true, opacity: 0.75, depthWrite: false }));
  anello.rotation.x = -Math.PI / 2; anello.position.y = 0.04; anello.renderOrder = 2;
  g.add(anello);
  return g;
}

export function restiAvventuriero(): THREE.Object3D {
  const osso = PAL.pietraChiara, scuro = PAL.pietraScura;
  return boxes([
    [0.26, 0.22, 0.26, -0.05, 0.13, -0.5, osso], [0.08, 0.06, 0.03, -0.1, 0.16, -0.36, PAL.neroCaldo], [0.08, 0.06, 0.03, 0.02, 0.16, -0.36, PAL.neroCaldo], // il teschio
    [0.46, 0.12, 0.34, 0, 0.07, -0.12, osso], [0.5, 0.04, 0.06, 0, 0.13, -0.2, scuro], [0.5, 0.04, 0.06, 0, 0.13, -0.04, scuro], // le costole
    [0.07, 0.06, 0.52, -0.13, 0.04, 0.35, osso], [0.07, 0.06, 0.48, 0.12, 0.04, 0.36, osso], // le gambe
    [0.5, 0.06, 0.07, -0.42, 0.04, -0.15, osso], // un braccio allungato
    [0.42, 0.36, 0.26, 0.45, 0.18, -0.25, PAL.legno], [0.44, 0.08, 0.28, 0.45, 0.38, -0.25, PAL.legnoScuro], [0.1, 0.22, 0.05, 0.45, 0.2, -0.1, PAL.sabbia], // lo zaino
  ]);
}
