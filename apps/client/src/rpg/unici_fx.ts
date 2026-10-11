// Gli unici della Regina (dal Mausoleo Cinetico, ma si portano in ogni dungeon): effetti sull'eroe, a scatti e in colori di palette.
// - Armatura del Moto Perpetuo: otto tacche azzurre a terra attorno all'eroe che si accendono mentre la Barriera si carica; piena,
//   l'anello gira e brilla; quando annulla un colpo, un'onda azzurra si allarga.
// - Anello dell'Onda: dove colpisci si allarga uno spruzzo d'acqua (l'Eco della Marea).
// - La Grande Lancetta: al tic una stellina d'oro sopra la testa; il Rintocco è un anello d'oro che si allarga.
// - Perk dell'albero: Terremoto (anello di sabbia che si allarga), Catena di fulmini (lampi gialli ai due capi del salto), Combustione (le chiazze
//   di fuoco dell'eroe, che brucia i nemici: ciuffi di fiamma a gradini come quelli della Fucina).
import * as THREE from 'three';
import type { DungeonView } from '@marea/sim/dungeon/types.ts';
import { M, merged, painted } from '../render/island_parts.ts';
import { PAL } from '../ui/style.ts';

export type UniciFx = {
  tick(v: DungeonView): void;
  update(hero: { x: number; z: number }, v: DungeonView): void;
  counts(): { tacche: number; piena: boolean; onde: number };
  dispose(): void;
};

const steps = (v: number, n: number) => Math.floor(Math.max(0, Math.min(1, v)) * n) / n;
const TACCHE = 8;

export function createUniciFx(scene: THREE.Scene, floorY: number): UniciFx {
  const root = new THREE.Group(); root.name = 'unici_fx'; scene.add(root);
  // Barriera: otto tacche ad arco attorno ai piedi
  const accesa = new THREE.MeshBasicMaterial({ color: PAL.acquaBassa, transparent: true, opacity: 0.9, depthWrite: false });
  const spenta = new THREE.MeshBasicMaterial({ color: PAL.acquaProfonda, transparent: true, opacity: 0.45, depthWrite: false });
  const anello = new THREE.Group(); anello.visible = false; root.add(anello);
  const tacche: THREE.Mesh[] = [];
  for (let k = 0; k < TACCHE; k++) {
    const g = new THREE.RingGeometry(0.75, 0.95, 3, 1, (k / TACCHE) * Math.PI * 2 + 0.06, (Math.PI * 2) / TACCHE - 0.12); g.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(g, spenta); m.renderOrder = 2; anello.add(m); tacche.push(m);
  }
  // onde che si allargano (barriera, eco, rintocco): un anello per tipo, riusati
  const ringGeo = new THREE.RingGeometry(0.85, 1, 20, 1); ringGeo.rotateX(-Math.PI / 2);
  const onde: { m: THREE.Mesh; t0: number; dur: number; r: number }[] = [];
  const onda = (x: number, z: number, c: string, r: number, dur: number) => {
    const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.9, depthWrite: false }));
    m.position.set(x, floorY + 0.08, z); m.renderOrder = 2; root.add(m);
    onde.push({ m, t0: performance.now() / 1000, dur, r });
    while (onde.length > 8) { const o = onde.shift()!; o.m.removeFromParent(); (o.m.material as THREE.Material).dispose(); }
  };
  // il tic della Grande Lancetta: stellina d'oro sopra la testa
  const stella = new THREE.Group(); stella.visible = false; root.add(stella);
  const oro = new THREE.MeshBasicMaterial({ color: PAL.giallo });
  for (const [w, h] of [[0.36, 0.08], [0.08, 0.36]] as const) stella.add(new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.08), oro));
  let ticT = -1, nAcc = 0;
  // Combustione: chiazze di fuoco dell'eroe (come quelle della Fucina: ciuffi di fiamma che tremano a scatti e calano quando stanno per spegnersi)
  const MAXF = 48;
  const fiammaGeo = merged([
    painted(new THREE.ConeGeometry(0.32, 0.7, 5), PAL.arancio, M(0, 0.35, 0)), painted(new THREE.ConeGeometry(0.2, 0.55, 5), PAL.giallo, M(0.25, 0.27, 0.15)),
    painted(new THREE.ConeGeometry(0.22, 0.45, 5), PAL.rosso, M(-0.28, 0.22, -0.1)), painted(new THREE.ConeGeometry(0.16, 0.35, 4), PAL.arancio, M(0.05, 0.17, -0.32)),
  ]);
  const fiammaMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, emissive: PAL.arancio, emissiveIntensity: 0.6 });
  const fiamme = new THREE.InstancedMesh(fiammaGeo, fiammaMat, MAXF); fiamme.name = 'fuochi_eroe'; fiamme.frustumCulled = false; fiamme.count = 0; root.add(fiamme);
  const m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), p3 = new THREE.Vector3(), s3 = new THREE.Vector3(), YA = new THREE.Vector3(0, 1, 0);

  return {
    tick(v) {
      for (const e of v.eventi) {
        if (e.eroe !== undefined && e.eroe !== v.io) continue;
        if (e.t === 'barriera') onda(e.x, e.z, PAL.acquaBassa, 2.6, 0.4);
        else if (e.t === 'eco') onda(e.x, e.z, PAL.acqua, 2.5, 0.35);
        else if (e.t === 'rintocco') onda(e.x, e.z, PAL.giallo, 3, 0.45);
        else if (e.t === 'tic') ticT = performance.now() / 1000;
        else if (e.t === 'terremoto') onda(e.x, e.z, PAL.sabbia, 4.5, 0.5);
        else if (e.t === 'catena') { onda(e.da[0], e.da[1], PAL.giallo, 1.3, 0.25); onda(e.a[0], e.a[1], PAL.giallo, 1.6, 0.3); }
      }
    },
    update(hero, v) {
      const now = performance.now() / 1000, b = v.hero.barriera;
      anello.visible = b !== undefined && v.hero.anim !== 'morto';
      if (b !== undefined) {
        anello.position.set(hero.x, floorY + 0.06, hero.z);
        const piena = b >= 1;
        nAcc = piena ? TACCHE : Math.floor(b * TACCHE);
        tacche.forEach((m, k) => { m.material = k < nAcc ? accesa : spenta; });
        anello.rotation.y = piena ? Math.floor(now * 8) * (Math.PI / 8) : 0;
        accesa.opacity = piena ? (Math.floor(now * 6) % 2 ? 1 : 0.7) : 0.85;
      }
      for (const o of onde) {
        const a = (now - o.t0) / o.dur;
        o.m.visible = a < 1;
        if (a < 1) { o.m.scale.setScalar(o.r * (0.35 + 0.65 * steps(a, 4))); (o.m.material as THREE.MeshBasicMaterial).opacity = 0.9 * (1 - steps(a, 4)); }
      }
      let nF = 0;
      for (const f of v.fuochi) {
        if (!f.amico || nF >= MAXF) continue;
        const k = f.r * (1 - steps(Math.max(0, f.t - 0.7) / 0.3, 3) * 0.7), h = 0.75 + 0.25 * (Math.floor(now * 8 + f.id) % 2);
        fiamme.setMatrixAt(nF++, m4.compose(p3.set(f.x, floorY + 0.02, f.z), q4.setFromAxisAngle(YA, Math.floor(now * 6 + f.id) * 0.9), s3.set(k, k * h, k)));
      }
      fiamme.count = nF; fiamme.instanceMatrix.needsUpdate = true;
      stella.visible = now - ticT < 0.16;
      if (stella.visible) { stella.position.set(hero.x, floorY + 2.3, hero.z); stella.rotation.set(0, Math.PI / 4, Math.PI / 4); }
    },
    counts: () => ({ tacche: nAcc, piena: nAcc === TACCHE && anello.visible, onde: onde.filter((o) => o.m.visible).length }),
    dispose() { root.removeFromParent(); ringGeo.dispose(); fiammaGeo.dispose(); fiammaMat.dispose(); fiamme.dispose(); for (const m of tacche) m.geometry.dispose(); },
  };
}
