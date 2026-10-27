// Il naufragio (GDD §9, il primo avvio): una scena a parte (renderer.setScene, gli amici non vedono niente) con la tua barca, i tuoi colori e te
// a bordo, in mare aperto al tramonto. Il cielo si chiude a scalini, le onde crescono, piove, lampi, un'onda più grossa la rovescia e
// cala il nero. Camera fissa (diorama.blocca). Circa 17 s; coi test (?test=1) quattro volte più in fretta.
import * as THREE from 'three';
import { newAvatar } from '@marea/sim';
import type { BarcaLook, Look } from '@marea/protocol';
import { createBoat } from '../game/boat.ts';
import { createLights } from '../render/light.ts';
import type { Loader } from '../render/loader.ts';
import { PALETTE as P } from '../render/palette.ts';
import type { Renderer } from '../render/scene.ts';

export type Naufragio = {
  /** Ogni frame, finché è in scena. */
  update(dt: number): void;
  /** Quando la barca è andata sotto: la scena è già tolta, la camera è tornata quella di prima. */
  readonly fine: Promise<void>;
  /** Secondi passati (per i test). */
  readonly t: number;
};

/** I tempi (s): il cielo si chiude, piove, la tempesta, l'onda che la rovescia, sott'acqua. */
const T = { nuvole: 4, pioggia: 6, tempesta: 8.5, onda: 13, sotto: 15.8, fine: 16.8 } as const;
const LAMPI = [9.2, 11.1, 12.4, 13.9];
/** In scena si vede solo il mare: l'interfaccia del Borgo (cartelli, joystick, monete) sparisce; restano il lampo e il nero. */
const CSS = `body.mz-storia #ui > :not(#mzStoriaNero):not(#mzStoriaLampo) { visibility: hidden !important; }`;
/** Il cielo dall'alto in basso, a ogni passo: tramonto, si copre, tempesta. */
const CIELI: readonly (readonly string[])[] = [
  [P.acquaBassa, P.pietraChiara, P.giallo, P.arancio],
  [P.pietra, P.pietraChiara, P.sabbia, P.arancio],
  [P.pietraScura, P.pietra, P.pietra, P.legnoChiaro],
  [P.roccia, P.pietraScura, P.pietraScura, P.pietra],
  [P.neroCaldo, P.roccia, P.roccia, P.pietraScura],
];
const LATO = 160, SEG = 48, GOCCE = 500;

function cielo(): { tex: THREE.CanvasTexture; dipingi(bande: readonly string[]): void } {
  const c = document.createElement('canvas'); c.width = 1; c.height = 4;
  const g = c.getContext('2d')!, tex = new THREE.CanvasTexture(c);
  tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter; tex.colorSpace = THREE.SRGBColorSpace;
  return { tex, dipingi: (b) => { b.forEach((col, i) => { g.fillStyle = col; g.fillRect(0, i, 1, 1); }); tex.needsUpdate = true; } };
}

export async function creaNaufragio(o: { renderer: Renderer; loader: Loader; root: HTMLElement; look: Look; barca: BarcaLook; veloce: number }): Promise<Naufragio> {
  if (!document.getElementById('mz-storia-scena')) { const st = document.createElement('style'); st.id = 'mz-storia-scena'; st.textContent = CSS; document.head.appendChild(st); }
  document.body.classList.add('mz-storia');
  const scene = new THREE.Scene(); scene.name = 'naufragio';
  const sky = cielo(); sky.dipingi(CIELI[0]!); scene.background = sky.tex;
  scene.fog = new THREE.Fog(P.arancio, 40, 110);
  const luci = createLights(); scene.add(luci.group); luci.follow?.(0, 0);
  // il mare: un foglio a facce piatte che si alza in onde, più alte con la tempesta
  const geo = new THREE.PlaneGeometry(LATO, LATO, SEG, SEG).rotateX(-Math.PI / 2).toNonIndexed();
  const pos = geo.getAttribute('position') as THREE.BufferAttribute, base = Float32Array.from(pos.array as Float32Array);
  const marMat = new THREE.MeshLambertMaterial({ color: P.acqua, flatShading: true });
  const mare = new THREE.Mesh(geo, marMat); mare.name = 'naufragio_mare'; mare.receiveShadow = true; scene.add(mare);
  // pioggia: segmenti che cadono di sbieco attorno alla barca
  const gp = new Float32Array(GOCCE * 6), semi = Array.from({ length: GOCCE }, (_, i) => [((i * 7919) % 1000) / 1000, ((i * 104729) % 1000) / 1000, ((i * 1299709) % 1000) / 1000] as const);
  const gGeo = new THREE.BufferGeometry(); gGeo.setAttribute('position', new THREE.BufferAttribute(gp, 3));
  const pioggia = new THREE.LineSegments(gGeo, new THREE.LineBasicMaterial({ color: P.pietraChiara })); pioggia.frustumCulled = false; pioggia.visible = false; scene.add(pioggia);
  const boat = await createBoat({ loader: o.loader, x: 0, z: 0, look: o.look, barca: o.barca }); scene.add(boat.object);
  boat.setDriver(newAvatar(0, 0), o.look);
  // il lampo: tutto lo schermo chiaro per un attimo
  const lampo = document.createElement('div'); lampo.id = 'mzStoriaLampo';
  lampo.style.cssText = `position:fixed;inset:0;z-index:44;background:${P.sabbiaChiara};opacity:0;pointer-events:none`;
  o.root.appendChild(lampo);

  const d = o.renderer.diorama, cam = o.renderer.camera, far0 = cam.far;
  o.renderer.setScene(scene); cam.far = 400; cam.updateProjectionMatrix();
  d.blocca?.({ yaw: Math.PI * 0.8, pitch: 0.24, dist: 18, fov: 30 }); d.follow(0, 0.6, 0); d.snap?.();

  /** Quanto è forte il mare (0 calmo … 1 tempesta) al secondo `t`. */
  const forza = (t: number) => (t < T.nuvole ? 0.08 : t < T.tempesta ? 0.08 + 0.5 * (t - T.nuvole) / (T.tempesta - T.nuvole) : Math.min(1, 0.58 + 0.42 * (t - T.tempesta) / (T.onda - T.tempesta)));
  const onda = (x: number, z: number, t: number, k: number) => k * (1.1 * Math.sin(x * 0.13 + t * 1.4) + 0.7 * Math.sin(z * 0.19 - t * 1.9) + 0.35 * Math.sin((x + z) * 0.31 + t * 2.7));
  let t = 0, cieloA = 0, chiuso = false, fatto: () => void = () => {};
  const fine = new Promise<void>((r) => { fatto = r; });
  const chiudi = () => {
    if (chiuso) return; chiuso = true;
    document.body.classList.remove('mz-storia'); d.blocca?.(null); o.renderer.setScene(null); cam.far = far0; cam.updateProjectionMatrix();
    lampo.remove(); scene.remove(boat.object); geo.dispose(); gGeo.dispose(); marMat.dispose(); sky.tex.dispose();
    fatto();
  };
  return {
    fine,
    get t() { return t; },
    update(dt) {
      if (chiuso) return;
      t += dt * o.veloce;
      const k = forza(t);
      // il cielo a scalini
      const c = Math.min(CIELI.length - 1, t < T.nuvole ? 0 : 1 + Math.floor((t - T.nuvole) / ((T.onda - T.nuvole) / (CIELI.length - 1))));
      if (c !== cieloA) {
        cieloA = c; sky.dipingi(CIELI[c]!); (scene.fog as THREE.Fog).color.set(CIELI[c]![2]!);
        marMat.color.set(c < 2 ? P.acqua : P.acquaProfonda);
        luci.set?.({ elev: 12, azim: 250, color: c < 2 ? 0xffb070 : 0x9fa8b8, intensity: 2.6 - 0.25 * c, sky: 0x9fb4d0, ground: 0x3a3440, hemiI: 1.9 - 0.15 * c, amb: 0x8a5cff, ambI: 0.18 });
      }
      for (let i = 0; i < pos.count; i++) { const x = base[i * 3]!, z = base[i * 3 + 2]!; pos.setY(i, onda(x, z, t, k)); }
      pos.needsUpdate = true; geo.computeVertexNormals();
      // pioggia
      pioggia.visible = t > T.pioggia;
      if (pioggia.visible) {
        for (let i = 0; i < GOCCE; i++) {
          const s = semi[i]!, y = 14 - ((s[2] * 14 + t * 18) % 14), x = (s[0] - 0.5) * 40 + y * 0.3, z = (s[1] - 0.5) * 40;
          gp.set([x, y, z, x + 0.25, y - 0.9, z], i * 6);
        }
        gGeo.getAttribute('position').needsUpdate = true;
      }
      // il lampo
      const vicino = LAMPI.find((l) => t >= l && t < l + 0.12);
      lampo.style.opacity = vicino !== undefined ? '0.7' : '0';
      // la barca va su e giù con l'onda, poi si rovescia e va sotto
      boat.update(1, dt, t);
      const y = onda(0, 0, t, k), dx = onda(1, 0, t, k) - onda(-1, 0, t, k), dz = onda(0, 1, t, k) - onda(0, -1, t, k);
      const giro = t < T.onda ? 0 : Math.min(1, (t - T.onda) / 1.5), giu = t < T.onda + 1.6 ? 0 : (t - T.onda - 1.6) * 1.2;
      boat.object.position.set(0, y + 0.07 - giu, 0);
      boat.object.rotation.set(-Math.atan(dz / 2) * 0.8, 0, Math.atan(dx / 2) * 0.8 + giro * Math.PI * 0.9);
      d.follow(0, 0.6, 0); d.update(dt);
      if (t >= T.fine) chiudi();
    },
  };
}
/** Quando cala il nero (s di scena): chi chiama mette il nero un attimo prima della fine. */
export const NAUFRAGIO_NERO = T.sotto;
