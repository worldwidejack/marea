// Cose che si muovono attorno all'eroe nelle ondate (docs/TEMPLARI.md §6-7): frecce, palle e vasi in volo (InstancedMesh, poche draw call),
// fiamme del fuoco greco e della spada di de Molay (coni accesi che tremano a scatti), anelli delle esplosioni, lampo dello sparo, scudi a
// terra e i power-up (lampeggiano prima di sparire), lo scudo dell'eroe (sulle spalle o al braccio sinistro), la cassa del tesoro col suo fascio di luce
// (si apre, gira, mostra l'arma, ride col teschio e vola via), le armi disegnate a gesso sui muri e l'arco sull'altare laterale.
import * as THREE from 'three';
import { armaDef } from '@marea/content/templari.ts';
import type { Arena } from '@marea/sim/templari/mappa.ts';
import type { TEvento, TView } from '@marea/sim/templari/types.ts';
import type { Loader } from '../render/loader.ts';
import { PAL, el } from '../ui/style.ts';
import { object } from '../rpg/dungeon_kit.ts';
import { cassa as cassa3d, gesso, potere, scudo } from './armi3d.ts';

export type Effetti = {
  tick(v: TView): void;
  evento(e: TEvento): void;
  update(alpha: number, dt: number, t: number, eroe: THREE.Object3D, v: TView): void;
  stats(): { proiettili: number; fiamme: number; drops: number; cassa: string; tiri: number };
  dispose(): void;
};

const steps = (v: number, n: number) => Math.floor(Math.max(0, Math.min(1, v)) * n) / n;
const NOMI_CASSA = ['Arco', 'Moschetto', 'Trombone', 'Martello da guerra', 'Arco lungo', 'Pistola doppia', 'Ascia danese', 'Fuoco greco', 'Mazza ferrata'];

export function createEffetti(o: { scene: THREE.Scene; arena: Arena; loader: Loader; root: HTMLElement; canvas: HTMLCanvasElement; camera: THREE.Camera }): Effetti {
  const { scene, arena } = o;
  const root = new THREE.Group(); root.name = 'effetti'; scene.add(root);
  const disp: { dispose(): void }[] = [];
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v3 = new THREE.Vector3(), s3 = new THREE.Vector3(), up = new THREE.Vector3(0, 0, -1);
  const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
  const inst = (geo: THREE.BufferGeometry, mat: THREE.Material, n: number, nome: string) => {
    const im = new THREE.InstancedMesh(geo, mat, n); im.name = nome; im.count = 0; im.frustumCulled = false; root.add(im); disp.push(geo, mat); return im;
  };
  // ---- proiettili ----
  const frecce = inst(new THREE.BoxGeometry(0.06, 0.06, 0.8), new THREE.MeshLambertMaterial({ color: PAL.legnoChiaro, flatShading: true }), 48, 'frecce');
  const palle = inst(new THREE.IcosahedronGeometry(0.07, 0), new THREE.MeshBasicMaterial({ color: PAL.giallo }), 64, 'palle');
  const vasi = inst(new THREE.IcosahedronGeometry(0.16, 0), new THREE.MeshLambertMaterial({ color: PAL.arancio, emissive: PAL.arancio, emissiveIntensity: 0.4, flatShading: true }), 12, 'vasi');
  type P = { tipo: string; px: number; pz: number; x: number; z: number; vx: number; vz: number; nato: number };
  // ---- tiri dei nemici: bombe del cannoniere (a parabola, col cerchio rosso dove cadono) e palle di fuoco di de Molay ----
  const bombe = inst(new THREE.IcosahedronGeometry(0.16, 0), new THREE.MeshLambertMaterial({ color: PAL.neroCaldo, flatShading: true }), 12, 'bombe');
  const palleFuoco = inst(new THREE.IcosahedronGeometry(0.3, 0), new THREE.MeshBasicMaterial({ color: PAL.arancio }), 8, 'palle_fuoco');
  const cerchioGeo = new THREE.RingGeometry(0.9, 1, 20); cerchioGeo.rotateX(-Math.PI / 2);
  const cerchi = inst(cerchioGeo, new THREE.MeshBasicMaterial({ color: PAL.rosso, side: THREE.DoubleSide }), 12, 'cerchi_bomba');
  let tiriV: TView['tiri'] = [];
  const proj = new Map<number, P>();
  // ---- fiamme: 6 coni per macchia, accesi (niente luce: colori pieni) ----
  const FPF = 6;
  const fiammeIm = inst(new THREE.ConeGeometry(0.22, 0.7, 5).translate(0, 0.35, 0), new THREE.MeshBasicMaterial({ color: 0xffffff }), 16 * FPF, 'fiamme');
  const fiamme = new Map<number, { x: number; z: number; r: number; resta: number }>();
  const luceFuoco = new THREE.PointLight(PAL.arancio, 0, 9, 1.6); luceFuoco.position.y = 1.4; root.add(luceFuoco);
  const COL_F = [new THREE.Color(PAL.arancio), new THREE.Color(PAL.giallo), new THREE.Color(PAL.rosso)];
  // ---- esplosioni e lampi ----
  const anelloGeo = new THREE.RingGeometry(0.85, 1, 16); anelloGeo.rotateX(-Math.PI / 2);
  const anelloMat = new THREE.MeshBasicMaterial({ color: PAL.arancio, side: THREE.DoubleSide }); disp.push(anelloGeo, anelloMat);
  const anelli = [0, 1, 2].map(() => { const a = new THREE.Mesh(anelloGeo, anelloMat); a.visible = false; root.add(a); return { m: a, t: -1, r: 1 }; });
  const lampo = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.25, 0.25), new THREE.MeshBasicMaterial({ color: PAL.giallo })); lampo.visible = false; root.add(lampo); disp.push(lampo.geometry, lampo.material as THREE.Material);
  let lampoT = 0;
  // ---- scudi e power-up a terra, scudo dell'eroe ----
  const drops = new Map<number, THREE.Object3D>();
  const poteriGeo = new Map<string, THREE.BufferGeometry>();
  const poteriMat = new THREE.MeshBasicMaterial({ vertexColors: true }); disp.push(poteriMat);
  const iconaPotere = (tipo: string): THREE.Mesh => {
    let g = poteriGeo.get(tipo);
    if (!g) { g = potere(tipo); poteriGeo.set(tipo, g); disp.push(g); }
    const me = new THREE.Mesh(g, poteriMat); me.name = 'potere_' + tipo; return me;
  };
  const mio = scudo(); mio.visible = false; root.add(mio);
  const osso = (oggetto: THREE.Object3D, n: string) => oggetto.getObjectByName(THREE.PropertyBinding.sanitizeNodeName(n)) ?? oggetto.getObjectByName(n) ?? null;
  // ---- armi sul muro: tavola col disegno a gesso; l'arco sull'altare laterale ----
  for (const mu of arena.muri) {
    if (mu.arma === 'arco') continue;
    const tex = gesso(mu.arma); disp.push(tex);
    const tav = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshLambertMaterial({ map: tex })); disp.push(tav.geometry, tav.material as THREE.Material);
    tav.position.set(mu.wx + mu.nx * 0.51, 1.35, mu.wz + mu.nz * 0.51);
    tav.rotation.y = Math.atan2(mu.nx, mu.nz);
    tav.name = 'gesso_' + mu.arma; root.add(tav);
  }
  for (const a of arena.altarini) {
    const g = new THREE.Group(); g.position.set(a.x, 0, a.z); root.add(g);
    const blocco = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 0.9), new THREE.MeshLambertMaterial({ color: PAL.pietraChiara, flatShading: true })); blocco.position.y = 0.45; g.add(blocco); disp.push(blocco.geometry, blocco.material as THREE.Material);
    const lume = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.2, 0.08), new THREE.MeshBasicMaterial({ color: PAL.giallo })); lume.position.set(0.3, 1.0, 0.3); g.add(lume); disp.push(lume.geometry, lume.material as THREE.Material);
    void object(o.loader, 'arm_arco', () => new THREE.Group()).then((b) => { b.rotation.set(0, 0.6, Math.PI / 2); b.position.set(0, 0.95, 0); g.add(b); });
  }
  // ---- cassa del tesoro ----
  const cas = cassa3d(); root.add(cas.obj);
  const fascio = new THREE.Mesh(new THREE.BoxGeometry(0.5, 14, 0.5).translate(0, 7, 0), new THREE.MeshBasicMaterial({ color: PAL.giallo, transparent: true, opacity: 0.35, depthWrite: false }));
  fascio.renderOrder = 2; cas.obj.add(fascio); disp.push(fascio.geometry, fascio.material as THREE.Material);
  const gemma = new THREE.Mesh(new THREE.OctahedronGeometry(0.22, 0), new THREE.MeshBasicMaterial({ color: PAL.giallo })); gemma.visible = false; root.add(gemma); disp.push(gemma.geometry, gemma.material as THREE.Material);
  const teschio = new THREE.Group();
  for (const [w, h, d, x, y, z, c] of [[0.42, 0.36, 0.38, 0, 0, 0, PAL.pietraChiara], [0.3, 0.12, 0.3, 0, -0.22, -0.04, PAL.pietraChiara], [0.1, 0.1, 0.05, -0.1, 0.02, -0.19, PAL.neroCaldo], [0.1, 0.1, 0.05, 0.1, 0.02, -0.19, PAL.neroCaldo]] as const) {
    const me = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color: c, flatShading: true })); me.position.set(x, y, z); teschio.add(me);
  }
  teschio.visible = false; root.add(teschio);
  const etichetta = el('div', 'mz'); etichetta.id = 'mzTplCassa';
  etichetta.style.cssText = `position:absolute;left:0;top:0;transform:translate(-50%,-100%);display:none;padding:3px 8px;background:rgba(35,32,31,.9);border:2px solid ${PAL.giallo};color:${PAL.giallo};font:bold 13px ui-monospace,Menlo,monospace;white-space:nowrap;pointer-events:none;z-index:11;`;
  o.root.append(etichetta);
  let cassaV: TView['cassa'] | null = null, cassaPosto = '';

  const schermo = (p: THREE.Vector3) => {
    v3.copy(p).project(o.camera);
    const r = o.canvas.getBoundingClientRect(), rr = o.root.getBoundingClientRect();
    return { x: r.left - rr.left + ((v3.x + 1) / 2) * r.width, y: r.top - rr.top + ((1 - v3.y) / 2) * r.height, on: v3.z < 1 && Math.abs(v3.x) < 1.1 && Math.abs(v3.y) < 1.1 };
  };

  return {
    tick(v) {
      const seen = new Set<number>();
      for (const p of v.proiettili) {
        seen.add(p.id);
        const c = proj.get(p.id);
        if (c) { c.px = c.x; c.pz = c.z; c.x = p.x; c.z = p.z; } else proj.set(p.id, { tipo: p.tipo, px: p.x, pz: p.z, x: p.x, z: p.z, vx: p.vx, vz: p.vz, nato: performance.now() });
      }
      for (const id of [...proj.keys()]) if (!seen.has(id)) proj.delete(id);
      fiamme.clear(); for (const f of v.fiamme) fiamme.set(f.id, f);
      tiriV = v.tiri;
      const ds = new Set<number>();
      for (const d of v.drops) {
        ds.add(d.id);
        let g = drops.get(d.id);
        if (!g) { g = d.tipo === 'scudo' ? scudo() : iconaPotere(d.tipo); g.position.set(d.x, d.tipo === 'scudo' ? 0.5 : 0, d.z); g.userData['scudo'] = d.tipo === 'scudo'; root.add(g); drops.set(d.id, g); }
        g.userData['resta'] = d.resta;
      }
      for (const [id, g] of drops) if (!ds.has(id)) { g.removeFromParent(); drops.delete(id); }
      cassaV = v.cassa;
      const posto = `${v.cassa.x},${v.cassa.z}`;
      if (posto !== cassaPosto) { cassaPosto = posto; cas.obj.position.set(v.cassa.x, 0, v.cassa.z); cas.obj.rotation.y = Math.atan2(-v.cassa.fx, -v.cassa.fz); }
    },
    evento(e) {
      if (e.t === 'esplosione') { const a = anelli.find((x) => x.t < 0) ?? anelli[0]!; a.t = 0; a.r = e.r; a.m.position.set(e.x, 0.08, e.z); a.m.visible = true; }
      if (e.t === 'sparo' && armaDef(e.arma).tipo === 'fuoco') { lampoT = 0.07; lampo.userData['x'] = e.x; lampo.userData['z'] = e.z; }
    },
    update(alpha, dt, t, eroe, v) {
      // proiettili interpolati, orientati col volo
      let nf = 0, np = 0, nv = 0;
      for (const p of proj.values()) {
        const x = p.px + (p.x - p.px) * alpha, z = p.pz + (p.z - p.pz) * alpha;
        const d = Math.sqrt(p.vx * p.vx + p.vz * p.vz) || 1;
        q.setFromUnitVectors(up, v3.set(p.vx / d, 0, p.vz / d));
        if (p.tipo === 'freccia' && nf < 48) frecce.setMatrixAt(nf++, m4.compose(v3.set(x, 1.3, z), q, s3.set(1, 1, 1)));
        else if (p.tipo === 'palla' && np < 64) palle.setMatrixAt(np++, m4.compose(v3.set(x, 1.25, z), q, s3.set(1, 1, 1)));
        else if (p.tipo === 'vaso' && nv < 12) { const u = Math.min(1, (performance.now() - p.nato) / 900); vasi.setMatrixAt(nv++, m4.compose(v3.set(x, 1.4 + 1.6 * u * (1 - u) * 4 * 0.5, z), q.setFromEuler(new THREE.Euler(t * 9, t * 7, 0)), s3.set(1, 1, 1))); }
      }
      frecce.count = nf; palle.count = np; vasi.count = nv;
      let nb = 0, nfu = 0, nc = 0;
      for (const b of tiriV) {
        if (b.tipo === 'bomba') {
          if (nb < 12) bombe.setMatrixAt(nb++, m4.compose(v3.set(b.x, 1.2 + 6 * b.k * (1 - b.k), b.z), q.setFromEuler(new THREE.Euler(t * 8, t * 5, 0)), s3.set(1, 1, 1)));
          if (nc < 12) cerchi.setMatrixAt(nc++, m4.compose(v3.set(b.tx, 0.06, b.tz), q.identity(), s3.setScalar(b.r * (0.4 + 0.6 * steps(b.k, 4)))));
        } else if (nfu < 8) palleFuoco.setMatrixAt(nfu++, m4.compose(v3.set(b.x, 1.2, b.z), q.setFromEuler(new THREE.Euler(t * 9, t * 6, 0)), s3.setScalar(0.8 + 0.3 * ((Math.floor(t * 12) * 0.618) % 1))));
      }
      bombe.count = nb; palleFuoco.count = nfu; cerchi.count = nc;
      for (const im of [frecce, palle, vasi, bombe, palleFuoco, cerchi]) { im.visible = im.count > 0; im.instanceMatrix.needsUpdate = true; }
      // fiamme: coni che tremano a scatti (10 al secondo), colori pieni
      const st = Math.floor(t * 10);
      let n = 0, vicina: { x: number; z: number } | null = null, vd = Infinity;
      for (const [id, f] of fiamme) {
        const dx = f.x - eroe.position.x, dz = f.z - eroe.position.z, dd = dx * dx + dz * dz;
        if (dd < vd) { vd = dd; vicina = f; }
        const sp = Math.min(1, f.resta * 2);
        for (let k = 0; k < FPF && n < fiammeIm.instanceMatrix.count; k++) {
          const a = k * 2.4 + id, rr = f.r * (k === 0 ? 0 : 0.35 + 0.5 * ((k * 0.37 + id * 0.13) % 1));
          const h = (0.6 + 0.7 * (((st + k * 3 + id) * 0.618) % 1)) * sp;
          fiammeIm.setMatrixAt(n, m4.compose(v3.set(f.x + Math.cos(a) * rr, 0.02, f.z + Math.sin(a) * rr), q.identity(), s3.set(1 + f.r * 0.15, h * (1 + f.r * 0.2), 1 + f.r * 0.15)));
          fiammeIm.setColorAt(n, COL_F[(st + k) % 3]!);
          n++;
        }
      }
      fiammeIm.count = n; fiammeIm.instanceMatrix.needsUpdate = true; if (fiammeIm.instanceColor) fiammeIm.instanceColor.needsUpdate = true;
      if (vicina && vd < 400) { luceFuoco.position.set(vicina.x, 1.4, vicina.z); luceFuoco.intensity = 12 + 6 * ((st * 0.618) % 1); } else luceFuoco.intensity = 0;
      // anelli delle esplosioni (si allargano a gradini in 0,4 s) e lampo dello sparo
      for (const a of anelli) {
        if (a.t < 0) continue;
        a.t += dt;
        const k = steps(a.t / 0.4, 5);
        a.m.scale.setScalar(Math.max(0.2, a.r * k));
        if (a.t > 0.45) { a.t = -1; a.m.visible = false; }
      }
      lampoT = Math.max(0, lampoT - dt);
      lampo.visible = lampoT > 0;
      if (lampo.visible) { const yaw = eroe.rotation.y; lampo.position.set(eroe.position.x - Math.sin(yaw) * 0.9, 1.25, eroe.position.z - Math.cos(yaw) * 0.9); }
      // scudi e power-up a terra: girano (lo scudo galleggia), lampeggiano negli ultimi 5 s
      for (const g of drops.values()) {
        const resta = Number(g.userData['resta'] ?? 99);
        g.rotation.y = t * (g.userData['scudo'] ? 1.5 : 2.2);
        if (g.userData['scudo']) g.position.y = 0.55 + 0.06 * Math.sin(t * 3);
        g.visible = resta > 5 || Math.floor(t * 6) % 2 === 0;
      }
      // il mio scudo: al braccio sinistro in mano, sulle spalle se no
      mio.visible = !!v.eroe.scudo;
      if (v.eroe.scudo) {
        const mano = v.eroe.scudo.inMano, b = osso(eroe, mano ? 'LowerArm.L' : 'Spine');
        const yaw = eroe.rotation.y;
        if (b) b.getWorldPosition(v3); else v3.copy(eroe.position).setY(1.1);
        if (mano) { mio.position.set(v3.x - Math.sin(yaw) * 0.25, 1.05, v3.z - Math.cos(yaw) * 0.25); mio.rotation.set(0, yaw, 0); }
        else { mio.position.set(v3.x + Math.sin(yaw) * 0.2, v3.y + 0.15, v3.z + Math.cos(yaw) * 0.2); mio.rotation.set(0.1, yaw + Math.PI, 0); }
      }
      // cassa: fascio di luce (spento mentre vola), coperchio, gemma che gira, teschio, etichetta col nome
      const c = cassaV;
      if (c) {
        const aperta = c.fase === 'gira' || c.fase === 'pronta' || c.fase === 'teschio';
        cas.coperchio.rotation.x = aperta ? -1.15 : 0;
        cas.obj.visible = c.fase !== 'vola' || c.t < 0.5;
        cas.obj.position.y = c.fase === 'vola' ? steps(c.t, 5) * 3 : 0;
        cas.obj.scale.setScalar(c.fase === 'vola' ? 1 - steps(c.t * 2, 4) * 0.9 : 1);
        fascio.visible = c.fase !== 'vola';
        (fascio.material as THREE.MeshBasicMaterial).opacity = c.fase === 'gira' ? 0.55 : 0.32;
        const sopra = v3.set(c.x, c.fase === 'gira' ? 1.2 + c.t * 0.8 : 1.9, c.z);
        gemma.visible = c.fase === 'gira' || c.fase === 'pronta';
        gemma.position.copy(sopra); gemma.rotation.y = t * (c.fase === 'gira' ? 14 : 2);
        teschio.visible = c.fase === 'teschio';
        if (teschio.visible) { teschio.position.set(c.x, 1.6 + c.t * 1.2, c.z); teschio.rotation.y = Math.sin(t * 12) * 0.4; }
        const testo = c.fase === 'gira' ? NOMI_CASSA[Math.floor(t * 8) % NOMI_CASSA.length]! : c.fase === 'pronta' && c.arma ? `${armaDef(c.arma).miracolosa ? '✦ ' : ''}${armaDef(c.arma).nome}` : c.fase === 'teschio' ? '☠ il teschio ride' : '';
        const p = schermo(v3.set(c.x, 2.5, c.z));
        etichetta.style.display = testo && p.on ? 'block' : 'none';
        if (testo) { if (etichetta.textContent !== testo) etichetta.textContent = testo; etichetta.style.left = `${p.x}px`; etichetta.style.top = `${p.y}px`; }
      }
    },
    stats: () => ({ proiettili: proj.size, fiamme: fiamme.size, drops: drops.size, cassa: cassaV?.fase ?? '', tiri: tiriV.length }),
    dispose() { root.removeFromParent(); etichetta.remove(); for (const d of disp) d.dispose(); },
  };
}
