// I telegrafi dei nemici del Tempio della «Doppia Nera», a terra (docs/BAITA.md): quello che sta per succedere si vede sempre prima, e si riempie per tutta la durata
// dell'avviso. Cerchio (l'anello rosso della trottola dell'Acrobata, il cerchio della fiasca blu o arancio con la fiasca in volo), le tre linee tratteggiate dello Sparaneve,
// il cono della frenata, il quadrato del salto (rosso che ti segue, giallo a scatti quando si blocca) con l'ombra di Jean-Claude in aria, la X della lamina, le stelline
// di chi ha la testa che gira o è in bilico. Tutto a scatti, colori di palette.
import * as THREE from 'three';
import type { DungeonView } from '@marea/sim/dungeon/types.ts';
import { M, merged, painted } from '../render/island_parts.ts';
import { PAL } from '../ui/style.ts';

const steps = (v: number, n: number) => Math.floor(Math.max(0, Math.min(1, v)) * n) / n;
const MC = 8, MQ = 3, MX = 3, MF = 4, MS = 5, MDASH = 160;
type Nemico = DungeonView['nemici'][number];
type Basic = (c: string, op: number) => THREE.MeshBasicMaterial;

export function createTelegrafi(o: { root: THREE.Group; fy: number; lit(x: number, z: number): boolean; basic: Basic; ring: THREE.BufferGeometry; disc: THREE.BufferGeometry }) {
  const { root, fy, lit, basic, ring, disc } = o;
  const m4 = new THREE.Matrix4(), p3 = new THREE.Vector3(), s3 = new THREE.Vector3(), q = new THREE.Quaternion(), YA = new THREE.Vector3(0, 1, 0);
  const piano = new THREE.PlaneGeometry(1, 1); piano.rotateX(-Math.PI / 2);
  const barra = new THREE.BoxGeometry(1, 0.05, 1);
  const fiascaGeo = new THREE.IcosahedronGeometry(0.3, 0);
  const stellaGeo = merged([painted(new THREE.BoxGeometry(0.2, 0.2, 0.05), PAL.giallo), painted(new THREE.BoxGeometry(0.2, 0.2, 0.05), PAL.giallo, M(0, 0, 0, 0, 0, Math.PI / 4))]);

  const cerchi = Array.from({ length: MC }, () => { const g = new THREE.Group(); g.visible = false; const r = new THREE.Mesh(ring, basic(PAL.rosso, 0.95)), d = new THREE.Mesh(disc, basic(PAL.rosso, 0.3)); r.renderOrder = d.renderOrder = 1; r.position.y = d.position.y = 0.06; g.add(r, d); root.add(g); return { g, r, d }; });
  const quadri = Array.from({ length: MQ }, () => {
    const g = new THREE.Group(); g.visible = false; root.add(g);
    const fondo = new THREE.Mesh(piano, basic(PAL.rosso, 0.22)), pieno = new THREE.Mesh(piano, basic(PAL.rosso, 0.42));
    const bordi = [[0, -0.5, 1, 0.04], [0, 0.5, 1, 0.04], [-0.5, 0, 0.04, 1], [0.5, 0, 0.04, 1]].map(([x, z, w, d]) => { const b = new THREE.Mesh(barra, basic(PAL.rosso, 0.95)); b.position.set(x!, 0.07, z!); b.scale.set(w!, 1, d!); return b; });
    const ombra = new THREE.Mesh(disc, basic(PAL.neroCaldo, 0.45)); ombra.position.y = 0.05; ombra.visible = false;
    for (const m of [fondo, pieno, ...bordi, ombra]) { m.renderOrder = 1; g.add(m); }
    return { g, fondo, pieno, bordi, ombra };
  });
  const croci = Array.from({ length: MX }, () => {
    const g = new THREE.Group(); g.visible = false; root.add(g);
    const bar = [1, -1].map((s) => { const b = new THREE.Mesh(barra, basic(PAL.rosso, 0.7)); b.rotation.y = (s * Math.PI) / 4; b.position.y = 0.07; b.renderOrder = 1; g.add(b); return b; });
    const quadro = new THREE.Mesh(piano, basic(PAL.rosso, 0.16)); quadro.position.y = 0.06; quadro.renderOrder = 1; g.add(quadro);
    return { g, bar, quadro };
  });
  const coni = Array.from({ length: 2 }, () => ({ m: null as THREE.Mesh | null, fuori: null as THREE.Mesh | null, cos: 2 })); // il cono che si riempie e il suo contorno, grande come sarà
  const dashGeo = new THREE.BoxGeometry(0.7, 0.05, 0.3), dashMat = new THREE.MeshBasicMaterial({ color: PAL.rosso, transparent: true, opacity: 0.9, depthWrite: false });
  const dash = new THREE.InstancedMesh(dashGeo, dashMat, MDASH); dash.frustumCulled = false; dash.renderOrder = 2; dash.count = 0; root.add(dash);
  const fiasche = Array.from({ length: MF }, () => { const m = new THREE.Mesh(fiascaGeo, new THREE.MeshLambertMaterial({ color: PAL.acqua, flatShading: true })); m.visible = false; root.add(m); return m; });
  const stelle = Array.from({ length: MS }, () => { const g = new THREE.Group(); g.visible = false; root.add(g); const st = [0, 1, 2].map(() => { const m = new THREE.Mesh(stellaGeo, new THREE.MeshBasicMaterial({ vertexColors: true })); g.add(m); return m; }); return { g, st }; });
  let nc = 0, nq = 0, nx = 0, nco = 0, nl = 0, nf = 0, ns = 0;

  function cono(k: number, n: Nemico, yaw: number): void {
    const [lungo, cos] = n.cono!, c = coni[k]!;
    if (!c.m || c.cos !== cos) { // la geometria dipende dal coseno: si rifà solo se cambia
      c.m?.geometry.dispose();
      const half = Math.acos(Math.max(-1, Math.min(1, cos))), g = new THREE.CircleGeometry(1, 24, -half, 2 * half); g.rotateX(-Math.PI / 2);
      if (!c.m || !c.fuori) { c.m = new THREE.Mesh(g, basic(PAL.rosso, 0.4)); c.fuori = new THREE.Mesh(g, basic(PAL.rosso, 0.16)); c.m.renderOrder = c.fuori.renderOrder = 1; root.add(c.m, c.fuori); } else c.m.geometry = c.fuori.geometry = g;
      c.cos = cos;
    }
    c.fuori!.visible = true; c.fuori!.position.set(n.x, fy + 0.065, n.z); c.fuori!.rotation.y = yaw; c.fuori!.scale.set(lungo, 1, lungo);
    c.m.visible = true; c.m.position.set(n.x, fy + 0.07, n.z); c.m.rotation.y = yaw; c.m.scale.set(lungo * Math.max(0.1, steps(n.t, 6)), 1, lungo * Math.max(0.1, steps(n.t, 6)));
    (c.m.material as THREE.MeshBasicMaterial).opacity = 0.4 + 0.3 * (Math.floor(performance.now() / 90) % 2);
  }

  return {
    tick(_v: DungeonView) { /* niente da seguire evento per evento: tutto sta nella vista */ },
    update(t: number, v: DungeonView) {
      nc = nq = nx = nco = nl = nf = ns = 0;
      for (const c of coni) if (c.m) c.m.visible = c.fuori!.visible = false;
      let nd = 0;
      for (const n of v.nemici) {
        if (n.anim === 'morto' || !lit(n.x, n.z)) continue;
        const F = n.forma;
        if (F?.f === 'cerchio' && nc < MC) {
          const c = cerchi[nc++]!, fisso = !!F.fisso, col = F.tipo === 'sciolina' ? PAL.acqua : F.tipo === 'bombardino' ? PAL.arancio : PAL.rosso;
          c.g.visible = true; c.g.position.set(F.x, fy, F.z); c.r.scale.setScalar(F.r); (c.r.material as THREE.MeshBasicMaterial).color.set(col); (c.d.material as THREE.MeshBasicMaterial).color.set(col);
          (c.r.material as THREE.MeshBasicMaterial).opacity = fisso ? 0.6 + 0.35 * (Math.floor(t * 8) % 2) : 0.95;
          c.d.scale.setScalar(F.r * (fisso ? 1 : Math.max(0.05, steps(n.t, 8)))); (c.d.material as THREE.MeshBasicMaterial).opacity = fisso ? 0.14 : 0.32;
          if (n.attacco === 'fiasca' && nf < MF && n.t > 0.4) { // la fiasca in volo: dal lanciatore al cerchio, in arco
            const u = (n.t - 0.4) / 0.6, f = fiasche[nf++]!, e0 = { x: n.x, z: n.z };
            f.visible = true; f.position.set(e0.x + (F.x - e0.x) * u, fy + 1.4 + 4 * u * (1 - u) * 3.4, e0.z + (F.z - e0.z) * u); f.rotation.set(t * 6, t * 4, 0);
            (f.material as THREE.MeshLambertMaterial).color.set(F.tipo === 'sciolina' ? PAL.acqua : PAL.giallo);
          }
        } else if (F?.f === 'quadro' && nq < MQ) {
          const g = quadri[nq++]!, giallo = !!F.fisso && Math.floor(t * 10) % 2 === 0, col = F.fisso ? PAL.giallo : PAL.rosso;
          g.g.visible = true; g.g.position.set(F.x, fy, F.z); g.g.scale.set(F.r, 1, F.r);
          g.fondo.position.y = 0.06; g.pieno.position.y = 0.065; g.pieno.scale.set(Math.max(0.05, steps(F.fisso ? 1 : n.t, 6)), 1, Math.max(0.05, steps(F.fisso ? 1 : n.t, 6)));
          for (const m of [g.fondo, g.pieno, ...g.bordi]) (m.material as THREE.MeshBasicMaterial).color.set(giallo ? PAL.sabbiaChiara : col);
          g.ombra.visible = !!n.volo; g.ombra.scale.set(0.2 + 0.5 * n.t, 1, 0.2 + 0.5 * n.t); // l'ombra di Jean-Claude: più grande man mano che scende
        } else if (F?.f === 'x' && nx < MX) {
          const g = croci[nx++]!;
          g.g.visible = true; g.g.position.set(F.x, fy, F.z);
          g.bar.forEach((b) => { b.scale.set(F.r * 1.41, 1, 0.55); (b.material as THREE.MeshBasicMaterial).opacity = 0.35 + 0.55 * steps(n.t, 5); });
          g.quadro.scale.set(F.r, 1, F.r);
        }
        if (n.cono && nco < coni.length) cono(nco++, n, Math.atan2(-n.fz, n.fx));
        if (n.linee) for (const [x1, z1] of n.linee) { // tre linee tratteggiate a terra, fisse per tutto l'avviso
          const dx = x1 - n.x, dz = z1 - n.z, len = Math.sqrt(dx * dx + dz * dz), k = Math.max(1, Math.floor(len / 1.3)), yaw = Math.atan2(-dz, dx);
          for (let i = 0; i < k && nd < MDASH; i++) { const u = (i + 0.5) / k; dash.setMatrixAt(nd++, m4.compose(p3.set(n.x + dx * u, fy + 0.07, n.z + dz * u), q.setFromAxisAngle(YA, yaw), s3.set(1, 1, 1))); }
          nl++;
        }
        if ((n.attacco === 'capogiro' || n.attacco === 'bilico' || n.attacco === 'arbitro' || n.stordito) && ns < MS) { // stelline gialle che girano sopra la testa
          const s = stelle[ns++]!, alt = n.boss ? 3.6 : 1.9;
          s.g.visible = true; s.g.position.set(n.x, fy + alt, n.z);
          s.st.forEach((m, k) => { const a = Math.floor(t * 5) * 0.8 + (k * Math.PI * 2) / 3; m.position.set(Math.cos(a) * 0.5, 0, Math.sin(a) * 0.5); m.rotation.y = a; });
        }
      }
      dash.count = nd; dash.instanceMatrix.needsUpdate = true; (dash.material as THREE.MeshBasicMaterial).opacity = 0.55 + 0.4 * (Math.floor(t * 6) % 2);
      for (let k = nc; k < MC; k++) cerchi[k]!.g.visible = false;
      for (let k = nq; k < MQ; k++) quadri[k]!.g.visible = false;
      for (let k = nx; k < MX; k++) croci[k]!.g.visible = false;
      for (let k = nf; k < MF; k++) fiasche[k]!.visible = false;
      for (let k = ns; k < MS; k++) stelle[k]!.g.visible = false;
    },
    counts: () => ({ cerchi: nc, quadri: nq, croci: nx, coni: nco, linee: nl, fiasche: nf, stelle: ns }),
    dispose() {
      piano.dispose(); barra.dispose(); fiascaGeo.dispose(); stellaGeo.dispose(); dashGeo.dispose(); dashMat.dispose(); dash.dispose();
      for (const c of coni) c.m?.geometry.dispose();
    },
  };
}
