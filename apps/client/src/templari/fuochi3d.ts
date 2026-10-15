// I fuochi da accendere e i pezzi della campana (docs/TEMPLARI.md §9b), come li vede chi gioca.
// Fuoco: un grande braciere di pietra su tre piedi, con la croce rossa sul fianco. Spento: brace fredda, un filo di fumo e un fascio di
// luce pallida che lo fa trovare da lontano; acceso: fiamme alte che tremano a scatti, scintille e una luce calda.
// Pezzi della campana (la corda arrotolata, il battaglio di bronzo, il perno di ferro): a terra dove li mette la partita, girano e
// salgono a scatti, col fascio giallo come la cassa del tesoro; spariscono quando la squadra li prende.
import * as THREE from 'three';
import type { Arena } from '@marea/sim/templari/mappa.ts';
import type { TView } from '@marea/sim/templari/types.ts';
import { PAL } from '../ui/style.ts';
import { unisci } from './armi3d.ts';
import type { Pezzo } from './armi3d.ts';

export type Fuochi3d = { tick(v: TView): void; update(t: number): void; stats(): { accesi: number; pezzi: number }; dispose(): void };

const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
const cil = (r0: number, r1: number, h: number, n = 8) => new THREE.CylinderGeometry(r0, r1, h, n);
const steps = (v: number, n: number) => Math.floor(v * n) / n;

/** Il braciere grande: tre piedi, la vasca di pietra con l'orlo, la croce rossa davanti, la brace. */
function braciere(): THREE.BufferGeometry {
  const p: Pezzo[] = [];
  for (let k = 0; k < 3; k++) { const a = (k / 3) * Math.PI * 2; p.push({ g: box(0.14, 0.9, 0.14), c: PAL.roccia, x: Math.cos(a) * 0.45, y: 0.45, z: Math.sin(a) * 0.45, rx: Math.sin(a) * 0.2, rz: -Math.cos(a) * 0.2 }); }
  p.push({ g: cil(0.85, 0.55, 0.55), c: PAL.pietra, y: 1.1 }, { g: cil(0.92, 0.92, 0.12), c: PAL.pietraScura, y: 1.4 });
  p.push({ g: box(0.12, 0.4, 0.04), c: PAL.rosso, y: 1.12, z: -0.72 }, { g: box(0.32, 0.1, 0.04), c: PAL.rosso, y: 1.18, z: -0.72 }); // croce davanti (−Z, verso la camera di sbieco)
  return unisci(p);
}
/** Brace dentro la vasca (spenta: grigia; accesa: si colora a scatti dal client col materiale). */
function brace(): THREE.BufferGeometry {
  return unisci([0, 1, 2, 3, 4].map((k): Pezzo => ({ g: box(0.32, 0.12, 0.14), c: '#ffffff', y: 1.45, x: Math.cos(k * 1.3) * 0.3, z: Math.sin(k * 1.3) * 0.3, ry: k * 0.9 })));
}
/** I tre pezzi della campana, pivot alla base. */
function pezzo(id: string): THREE.BufferGeometry {
  if (id === 'corda') return unisci([0, 1, 2, 3].map((k): Pezzo => ({ g: new THREE.TorusGeometry(0.28 - k * 0.02, 0.06, 4, 10), c: k % 2 ? PAL.legnoChiaro : PAL.sabbia, y: 0.1 + k * 0.1, rx: Math.PI / 2 })));
  if (id === 'battaglio') return unisci([{ g: cil(0.05, 0.05, 0.8, 6), c: PAL.roccia, y: 0.55 }, { g: new THREE.IcosahedronGeometry(0.2, 0), c: PAL.arancio, y: 0.18 }, { g: box(0.24, 0.08, 0.08), c: PAL.roccia, y: 0.95 }]);
  return unisci([{ g: cil(0.08, 0.08, 0.9, 6), c: PAL.pietraScura, y: 0.12, rz: Math.PI / 2 }, { g: cil(0.16, 0.16, 0.06, 6), c: PAL.roccia, x: -0.45, y: 0.12, rz: Math.PI / 2 }, { g: box(0.08, 0.2, 0.08), c: PAL.roccia, x: 0.45, y: 0.12 }]);
}

export function createFuochi3d(scene: THREE.Scene, a: Arena): Fuochi3d {
  const root = new THREE.Group(); root.name = 'fuochi'; scene.add(root);
  const disp: { dispose(): void }[] = [];
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }); disp.push(mat);
  const bGeo = braciere(), brGeo = brace(); disp.push(bGeo, brGeo);
  const fGeo = new THREE.ConeGeometry(0.28, 1.0, 5); fGeo.translate(0, 0.5, 0); disp.push(fGeo);
  const COL = [PAL.arancio, PAL.giallo, PAL.rosso].map((c) => new THREE.MeshBasicMaterial({ color: c }));
  const fumoM = new THREE.MeshBasicMaterial({ color: PAL.pietraChiara, transparent: true, opacity: 0.55, depthWrite: false });
  const fumoG = box(0.18, 0.18, 0.18); disp.push(fumoG);
  const fascioG = box(0.36, 12, 0.36); fascioG.translate(0, 6, 0);
  const fascioM = new THREE.MeshBasicMaterial({ color: PAL.sabbiaChiara, transparent: true, opacity: 0.22, depthWrite: false });
  const fascioP = new THREE.MeshBasicMaterial({ color: PAL.giallo, transparent: true, opacity: 0.3, depthWrite: false });
  const braceSpenta = new THREE.MeshLambertMaterial({ color: PAL.pietraScura, flatShading: true });
  const braceAccesa = new THREE.MeshBasicMaterial({ color: PAL.arancio });
  disp.push(...COL, fumoM, fascioG, fascioM, fascioP, braceSpenta, braceAccesa);
  type F = { id: string; g: THREE.Group; brace: THREE.Mesh; fiamme: THREE.Mesh[]; fumo: THREE.Mesh[]; fascio: THREE.Mesh; luce: THREE.PointLight; acceso: boolean };
  const fuochi: F[] = a.fuochi.map((f) => {
    const g = new THREE.Group(); g.name = 'fuoco_' + f.id; g.position.set(f.x, 0, f.z); root.add(g);
    g.add(new THREE.Mesh(bGeo, mat));
    const br = new THREE.Mesh(brGeo, braceSpenta); g.add(br);
    const fiamme = [0, 1, 2, 3, 4].map((k) => { const m = new THREE.Mesh(fGeo, COL[k % 3]!); m.position.set(Math.cos(k * 1.3) * 0.32 * (k ? 1 : 0), 1.45, Math.sin(k * 1.3) * 0.32 * (k ? 1 : 0)); m.visible = false; g.add(m); return m; });
    const fumo = [0, 1, 2].map(() => { const m = new THREE.Mesh(fumoG, fumoM); g.add(m); return m; });
    const fascio = new THREE.Mesh(fascioG, fascioM); fascio.renderOrder = 2; g.add(fascio);
    const luce = new THREE.PointLight(PAL.arancio, 0, 13, 1.5); luce.position.set(0, 2.4, 0); g.add(luce);
    return { id: f.id, g, brace: br, fiamme, fumo, fascio, luce, acceso: false };
  });
  type Pz = { id: string; m: THREE.Group; preso: boolean };
  const pezzi = new Map<string, Pz>();
  const pzMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, emissive: '#3a2a10' }); disp.push(pzMat);

  return {
    tick(v) {
      for (const f of v.fuochi) {
        const x = fuochi.find((q) => q.id === f.id);
        if (!x || x.acceso === f.acceso) continue;
        x.acceso = f.acceso;
        x.brace.material = f.acceso ? braceAccesa : braceSpenta;
        for (const m of x.fiamme) m.visible = f.acceso;
        for (const m of x.fumo) m.visible = !f.acceso;
        x.fascio.visible = !f.acceso;
      }
      for (const p of v.pezzi) {
        let x = pezzi.get(p.id);
        if (!x) {
          const g = new THREE.Group(); g.name = 'pezzo_' + p.id; g.position.set(p.x, 0, p.z);
          const geo = pezzo(p.id); disp.push(geo);
          const m = new THREE.Mesh(geo, pzMat); m.name = 'pezzo'; g.add(m);
          const fa = new THREE.Mesh(fascioG, fascioP); fa.renderOrder = 2; fa.scale.set(0.6, 0.7, 0.6); g.add(fa);
          root.add(g); x = { id: p.id, m: g, preso: false }; pezzi.set(p.id, x);
        }
        x.preso = p.preso; x.m.visible = !p.preso;
      }
    },
    update(t) {
      const st = Math.floor(t * 10);
      fuochi.forEach((f, n) => {
        if (f.acceso) {
          f.fiamme.forEach((m, k) => { const h = 0.7 + 0.8 * (((st + k * 3 + n) * 0.618) % 1); m.scale.set(1, k ? h * 0.8 : h * 1.5, 1); });
          f.luce.intensity = 22 + 8 * (((st + n) * 0.618) % 1);
        } else {
          f.luce.intensity = 0;
          f.fumo.forEach((m, k) => { const u = (t * 0.35 + k / 3) % 1; m.position.set(0.1 * Math.sin(u * 6 + k), 1.5 + u * 2.2, 0.1 * Math.cos(u * 5)); m.scale.setScalar(0.6 + u * 1.4); });
          (f.fascio.material as THREE.MeshBasicMaterial).opacity = 0.16 + 0.08 * steps((Math.sin(t * 2 + n) + 1) / 2, 4);
        }
      });
      for (const p of pezzi.values()) {
        if (p.preso) continue;
        const m = p.m.children[0]!;
        m.rotation.y = steps((t * 0.4) % 1, 12) * Math.PI * 2;
        m.position.y = 0.15 + 0.12 * steps((Math.sin(t * 3) + 1) / 2, 4);
      }
    },
    stats: () => ({ accesi: fuochi.filter((f) => f.acceso).length, pezzi: [...pezzi.values()].filter((p) => !p.preso).length }),
    dispose() { root.removeFromParent(); for (const d of disp) d.dispose(); },
  };
}
