// I segni delle modalità dell'Arena nella scena (docs/ARENA.md), tutti a colori di palette e flat:
// - la nube tossica della Sopravvivenza: sbuffi verdi trasparenti, uno per cella fuori dal cerchio (alti a scatti, uno diverso dall'altro),
//   rifatti quando il cerchio si stringe;
// - le monete rosse a terra: una pila (fino a 5) che gira a scatti e saltella;
// - le zone del Controllo: un anello di lastre e un disco a terra, gialli finché nessuno c'è, del colore di chi c'è dentro (arancio se è
//   contesa), pieni del colore di chi l'ha conquistata; in mezzo un'asta con la bandiera che sale col punteggio di chi è avanti;
// - sotto le casseforti dei Rapinatori l'anello della squadra (acqua la mia, rosso l'altra);
// - il mare attorno all'Isola del Naufragio, il faro in mezzo al Forte;
// - sopra la testa di ognuno che si vede il suo numero: le monete rosse (Sopravvivenza) o le stelle della taglia (Caccia alle stelle).
//   I numeri sono in HTML, come i nomi dei compagni (dungeon_hud.ts), un po' più su.
import * as THREE from 'three';
import type { PartitaView } from '@marea/sim/arena/partita.ts';
import { PAL, el } from '../ui/style.ts';
import { FONT_LIBRO, LIBRO as L } from '../ui/libro_colori.ts';
import { cellHash } from './dungeon_kit.ts';
import { faroParts } from './arena_kit.ts';

export type ArenaSegni = {
  /** Ogni frame: la vista, il tempo, il punto sopra la testa di ogni eroe che si vede (null = no). */
  update(v: PartitaView, t: number, teste: readonly (THREE.Vector3 | null)[]): void;
  dispose(): void;
};

const CSS = `
.mz-ar-segno { position: absolute; left: 0; top: 0; display: none; align-items: center; gap: 2px; padding: 0 5px 0 2px; height: 20px; background: ${L.carta}; border: 2px solid ${L.inchiostro}; box-shadow: 0 2px 0 ${L.inchiostro}; font: 700 13px ${FONT_LIBRO}; color: ${L.inchiostro}; pointer-events: none; z-index: 12; white-space: nowrap; }
.mz-ar-segno svg { display: block; }
.mz-ar-zona { position: absolute; left: 0; top: 0; display: none; padding: 1px 6px; background: ${L.carta}; border: 2px solid ${L.oro}; font: 700 12px ${FONT_LIBRO}; color: ${L.inchiostro}; pointer-events: none; z-index: 11; white-space: nowrap; }
.mz-ar-zona .mio { color: ${L.acquaScura}; } .mz-ar-zona .suo { color: ${L.rosso}; }
`;
/** Moneta rossa e stella in pixel (svg a celle, niente sfumature). */
const pix = (rows: string[], cols: Record<string, string>, px: number) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${rows[0]!.length} ${rows.length}" width="${px}" height="${px}" shape-rendering="crispEdges">${rows.map((r, y) => [...r].map((c, x) => (cols[c] ? `<rect x="${x}" y="${y}" width="1" height="1" fill="${cols[c]}"/>` : '')).join('')).join('')}</svg>`;
const MONETA = pix(['..kkk..', '.krrrk.', 'krryrrk', 'kryyyrk', 'krryrrk', '.krrrk.', '..kkk..'], { k: PAL.neroCaldo, r: PAL.rosso, y: PAL.giallo }, 14);
const STELLA = pix(['...k...', '..kyk..', 'kkyyykk', '.kyyyk.', '.kykyk.', 'kk...kk'], { k: PAL.neroCaldo, y: PAL.giallo }, 14);

const flat = (c: string, opacity = 1) => new THREE.MeshLambertMaterial({ color: c, flatShading: true, ...(opacity < 1 ? { transparent: true, opacity, depthWrite: false } : {}) });
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0), m4 = new THREE.Matrix4(), v3 = new THREE.Vector3();

export function createArenaSegni(o: { scene: THREE.Scene; floorY: number; root: HTMLElement; canvas: HTMLCanvasElement; camera: THREE.Camera; mappa: { w: number; h: number; tile: number; stile: string; solido: (cx: number, cz: number) => boolean }; mia: number; io: number }): ArenaSegni {
  if (!document.getElementById('mz-ar-segni-style')) { const st = document.createElement('style'); st.id = 'mz-ar-segni-style'; st.textContent = CSS; document.head.appendChild(st); }
  const root = new THREE.Group(); root.name = 'arenaSegni'; o.scene.add(root);
  const { w: W, h: H, tile: T } = o.mappa, y0 = o.floorY, geos: THREE.BufferGeometry[] = [], mats: THREE.Material[] = [];
  const tieni = <G extends THREE.BufferGeometry>(g: G): G => { geos.push(g); return g; };
  const tieniM = <M extends THREE.Material>(m: M): M => { mats.push(m); return m; };

  // ---- il mare attorno all'isola ----
  if (o.mappa.stile === 'naufragio') {
    const mare = new THREE.Mesh(tieni(new THREE.PlaneGeometry(W * T + 160, H * T + 160)), tieniM(flat(PAL.acqua)));
    mare.rotation.x = -Math.PI / 2; mare.position.set((W * T) / 2, y0 - 0.5, (H * T) / 2); root.add(mare);
    // la schiuma sotto gli scogli: lastre chiare sulle celle di muro che toccano il pavimento
    const sch: THREE.Matrix4[] = [];
    for (let cz = 0; cz < H; cz++) for (let cx = 0; cx < W; cx++) {
      if (!o.mappa.solido(cx, cz) || cellHash(cx, cz, 4) > 0.5) continue;
      let riva = false;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) if (!o.mappa.solido(cx + dx, cz + dz)) riva = true;
      if (!riva) sch.push(new THREE.Matrix4().makeTranslation((cx + 0.5) * T + (cellHash(cx, cz, 5) - 0.5), y0 - 0.42, (cz + 0.5) * T + (cellHash(cx, cz, 6) - 0.5)));
    }
    const im = new THREE.InstancedMesh(tieni(new THREE.BoxGeometry(T * 1.4, 0.05, T * 0.7)), tieniM(flat(PAL.acquaBassa)), Math.max(1, sch.length));
    sch.forEach((m, i) => im.setMatrixAt(i, m)); im.count = sch.length; im.frustumCulled = false; root.add(im);
  }

  // ---- il faro sopra la torre in mezzo al Forte ----
  if (o.mappa.stile === 'forte') {
    const g = new THREE.Group();
    for (const p of faroParts()) { g.add(new THREE.Mesh(p.geo, p.mat)); tieni(p.geo); }
    g.position.set((W * T) / 2, y0 + 1.95, (H * T) / 2); root.add(g);
  }

  // ---- la nube tossica: uno sbuffo per cella, nascosto finché la cella è dentro il cerchio ----
  const celle: { x: number; z: number; m: THREE.Matrix4 }[] = [];
  for (let cz = 0; cz < H; cz++) for (let cx = 0; cx < W; cx++) {
    const alto = 1.4 + Math.floor(cellHash(cx, cz, 11) * 4) * 0.35;
    celle.push({ x: (cx + 0.5) * T, z: (cz + 0.5) * T, m: new THREE.Matrix4().compose(v3.set((cx + 0.5) * T, y0 + alto / 2, (cz + 0.5) * T), new THREE.Quaternion(), new THREE.Vector3(1, alto, 1)) });
  }
  const nubeM = tieniM(flat(PAL.erbaChiara, 0.32)), nubeScura = tieniM(flat(PAL.erba, 0.4));
  const sbuffi = [nubeM, nubeScura].map((mt, k) => { const im = new THREE.InstancedMesh(tieni(new THREE.BoxGeometry(T * (k ? 0.7 : 1.02), 1, T * (k ? 0.7 : 1.02))), mt, celle.length); im.frustumCulled = false; im.renderOrder = 3; for (let i = 0; i < celle.length; i++) im.setMatrixAt(i, ZERO); im.visible = false; root.add(im); return im; });
  let nubeR = -1;

  // ---- monete rosse a terra ----
  const monetaG = tieni(new THREE.CylinderGeometry(0.26, 0.26, 0.09, 8)), monetaM = tieniM(flat(PAL.rosso)), bordoM = tieniM(flat(PAL.giallo));
  const pile: THREE.Group[] = [];
  const pila = (k: number) => {
    let g = pile[k];
    if (!g) {
      g = new THREE.Group();
      for (let n = 0; n < 5; n++) { const c = new THREE.Mesh(monetaG, n % 2 ? bordoM : monetaM); c.position.y = 0.06 + n * 0.1; c.rotation.z = Math.PI / 2; g.add(c); }
      root.add(g); pile[k] = g;
    }
    return g;
  };

  // ---- zone: anello di lastre, disco, asta con la bandiera ----
  const lastraG = tieni(new THREE.BoxGeometry(0.5, 0.06, 0.28)), discoG = tieni(new THREE.CircleGeometry(1, 16)), astaG = tieni(new THREE.BoxGeometry(0.12, 2.6, 0.12)), bandG = tieni(new THREE.BoxGeometry(0.9, 0.5, 0.06));
  const colZ = { neutra: PAL.giallo, mia: PAL.acqua, sua: PAL.rosso, contesa: PAL.arancio } as const;
  const matZ = Object.fromEntries(Object.entries(colZ).map(([k, c]) => [k, tieniM(flat(c))])) as Record<keyof typeof colZ, THREE.MeshLambertMaterial>;
  const discoZ = Object.fromEntries(Object.entries(colZ).map(([k, c]) => [k, tieniM(flat(c, 0.22))])) as Record<keyof typeof colZ, THREE.MeshLambertMaterial>;
  const legno = tieniM(flat(PAL.legnoScuro));
  const zone: { lastre: THREE.InstancedMesh; disco: THREE.Mesh; band: THREE.Mesh; tipo: string; label: HTMLElement }[] = [];
  const zona = (k: number, z: PartitaView['zone'][number]) => {
    let x = zone[k];
    if (!x) {
      const N = 28, lastre = new THREE.InstancedMesh(lastraG, matZ.neutra, N);
      for (let n = 0; n < N; n++) { const a = (n / N) * Math.PI * 2; lastre.setMatrixAt(n, m4.compose(v3.set(z.x + Math.cos(a) * z.r, y0 + 0.04, z.z + Math.sin(a) * z.r), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -a + Math.PI / 2), new THREE.Vector3(1, 1, 1))); }
      lastre.frustumCulled = false;
      const disco = new THREE.Mesh(discoG, discoZ.neutra); disco.rotation.x = -Math.PI / 2; disco.scale.setScalar(z.r); disco.position.set(z.x, y0 + 0.03, z.z);
      const asta = new THREE.Mesh(astaG, legno); asta.position.set(z.x, y0 + 1.3, z.z);
      const band = new THREE.Mesh(bandG, matZ.neutra);
      root.add(lastre, disco, asta, band);
      const label = el('div', 'mz-ar-zona'); o.root.append(label);
      x = zone[k] = { lastre, disco, band, tipo: 'neutra', label };
    }
    return x;
  };

  // ---- anelli sotto le casseforti ----
  const anelloG = tieni(new THREE.RingGeometry(1.0, 1.35, 12)), anelli: THREE.Mesh[] = [];

  // ---- numeri sopra le teste ----
  const segni: HTMLElement[] = [];
  const screen = (p: THREE.Vector3) => {
    v3.copy(p).project(o.camera);
    const r = o.canvas.getBoundingClientRect(), rr = o.root.getBoundingClientRect();
    return { x: r.left - rr.left + ((v3.x + 1) / 2) * r.width, y: r.top - rr.top + ((1 - v3.y) / 2) * r.height, on: v3.z < 1 && Math.abs(v3.x) < 1.1 && Math.abs(v3.y) < 1.1 };
  };

  return {
    update(v, t, teste) {
      // nube: rifatta quando il cerchio cambia di almeno 10 cm
      if (v.nube && Math.abs(v.nube.r - nubeR) > 0.1) {
        nubeR = v.nube.r;
        const r2 = nubeR * nubeR, rIn = (nubeR + 2.4) * (nubeR + 2.4);
        let tutte = true;
        celle.forEach((c, i) => {
          const dx = c.x - v.nube!.x, dz = c.z - v.nube!.z, d2 = dx * dx + dz * dz;
          sbuffi[0]!.setMatrixAt(i, d2 > r2 ? c.m : ZERO);
          sbuffi[1]!.setMatrixAt(i, d2 > rIn ? c.m : ZERO); // dentro la nube, lontano dal bordo, più fitta
          if (d2 > r2) tutte = false;
        });
        for (const s of sbuffi) { s.instanceMatrix.needsUpdate = true; s.visible = !tutte; }
      }
      // monete a terra
      const passo = Math.floor(t * 6);
      v.mucchi.forEach((p, k) => {
        const g = pila(k);
        g.visible = true; g.position.set(p.x, y0 + 0.1 + ((passo + p.id) % 3) * 0.06, p.z); g.rotation.y = ((passo + p.id) % 8) * (Math.PI / 4);
        g.children.forEach((c, n) => { c.visible = n < Math.min(5, p.n); });
      });
      for (let k = v.mucchi.length; k < pile.length; k++) pile[k]!.visible = false;
      // zone
      v.zone.forEach((z, k) => {
        const x = zona(k, z), mie = z.dentro.includes(o.mia), sue = z.dentro.some((q) => q !== o.mia);
        const tipo = z.di >= 0 ? (z.di === o.mia ? 'mia' : 'sua') : mie && sue ? 'contesa' : mie ? 'mia' : sue ? 'sua' : 'neutra';
        if (tipo !== x.tipo) { x.tipo = tipo; const k2 = tipo as keyof typeof colZ; x.lastre.material = matZ[k2]; x.disco.material = discoZ[k2]; x.band.material = matZ[z.di >= 0 ? k2 : (z.prog[o.mia] ?? 0) >= Math.max(...z.prog) && (z.prog[o.mia] ?? 0) > 0 ? 'mia' : Math.max(...z.prog) > 0 ? 'sua' : 'neutra']; }
        // la contesa lampeggia a scatti
        x.disco.visible = tipo !== 'contesa' || passo % 2 === 0;
        const su = z.di >= 0 ? 1 : Math.max(...z.prog) / 100;
        x.band.position.set(z.x + 0.5, y0 + 0.4 + Math.round(su * 8) / 8 * 2.1, z.z);
        const s = screen(v3.set(z.x, y0 + 3.1, z.z));
        if (s.on) {
          const mio = Math.floor(z.prog[o.mia] ?? 0), suo = Math.floor(Math.max(0, ...z.prog.filter((_, q) => q !== o.mia)));
          const html = z.di >= 0 ? `ZONA ${k + 1} <span class="${z.di === o.mia ? 'mio' : 'suo'}">${z.di === o.mia ? 'VOSTRA' : 'LORO'}</span>` : `ZONA ${k + 1} <span class="mio">${mio}%</span> · <span class="suo">${suo}%</span>`;
          if (x.label.innerHTML !== html) x.label.innerHTML = html;
          x.label.style.transform = `translate(${Math.round(s.x)}px, ${Math.round(s.y)}px) translate(-50%, -100%)`; x.label.style.display = 'block';
        } else x.label.style.display = 'none';
      });
      // casseforti
      v.casseforti.forEach((c, k) => {
        let a = anelli[k];
        if (!a) { a = new THREE.Mesh(anelloG, tieniM(flat(c.q === o.mia ? PAL.acqua : PAL.rosso, 0.8))); a.rotation.x = -Math.PI / 2; root.add(a); anelli[k] = a; }
        a.position.set(c.x, y0 + 0.04, c.z); a.visible = c.vita > 0;
      });
      // numeri sopra le teste: io e gli altri che si vedono
      let n = 0;
      for (let j = 0; j < teste.length; j++) {
        const p = teste[j], num = j === o.io ? v.segno : v.altri.find((a) => a.i === j)?.segno ?? 0;
        if (!p || (v.modo === 'sopravvivenza' && num <= 0) || (v.modo !== 'stelle' && v.modo !== 'sopravvivenza')) continue;
        const s = screen(p);
        if (!s.on) continue;
        let e = segni[n];
        if (!e) { e = el('div', 'mz-ar-segno'); e.append(el('span'), el('b')); o.root.append(e); segni.push(e); }
        const ico = v.modo === 'stelle' ? STELLA : MONETA;
        if ((e.firstChild as HTMLElement).innerHTML !== ico) (e.firstChild as HTMLElement).innerHTML = ico;
        if ((e.lastChild as HTMLElement).textContent !== String(num)) (e.lastChild as HTMLElement).textContent = String(num);
        e.style.borderColor = j === o.io || v.altri.find((a) => a.i === j)?.squadra === o.mia ? L.acqua : L.rosso;
        e.style.transform = `translate(${Math.round(s.x)}px, ${Math.round(s.y) - 34}px) translate(-50%, -100%)`; e.style.display = 'flex';
        n++;
      }
      for (; n < segni.length; n++) segni[n]!.style.display = 'none';
    },
    dispose() {
      for (const z of zone) z.label.remove();
      for (const e of segni) e.remove();
      root.removeFromParent();
      for (const g of geos) g.dispose();
      for (const m of mats) m.dispose();
    },
  };
}
