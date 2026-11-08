// Prima persona: i pericoli che dall'alto si leggevano come disegni a terra (cerchi d'avviso di bombe, magma, geyser, cannonate, colpi ad
// area dei capi, corsie dei colpi dritti, forme della Baita) dagli occhi non si vedono: qui diventano muri di luce che si alzano da terra
// (si vedono anche da lontano e, se ci sei dentro, ti stanno tutt'attorno) e le cose lanciate volano da chi le lancia fin dove cadono.
// Anche le onde del Mausoleo (un muro d'acqua coi suoi varchi), le lancette, le zone del calore del Santuario e le linee di mira (il Fuciliere,
// i raggi dei capi: un filo rosso all'altezza del petto). Se ci sei dentro: un avviso in basso e una freccia attorno al mirino che dice da che
// parte uscire, col bip che accelera. Solo colori di palette, opacità a gradini. Gli avvisi a terra di prima (drenaggio.ts, archivio.ts, …)
// restano: questi si aggiungono.
import * as THREE from 'three';
import type { DungeonView } from '@marea/sim/dungeon/types.ts';
import { suona } from '../audio/ponte.ts';
import { registerStateProvider } from '../test/testapi.ts';
import { FONT_LIBRO, LIBRO as L } from '../ui/libro_colori.ts';
import { PAL } from '../ui/style.ts';

type Zona = { k: 'cerchio'; x: number; z: number; r: number; t: number; col: string; da?: [number, number]; cade?: boolean }
  | { k: 'corsia' | 'linea' | 'lancetta'; x: number; z: number; ex: number; ez: number; w: number; t: number; col: string }
  | { k: 'onda'; x: number; z: number; r: number; w: number; varchi: [number, number][]; t: number; col: string }
  | { k: 'rettangolo'; x: number; z: number; ex: number; ez: number; t: number; col: string };
/** Spicchi di un'onda (muro d'acqua) e mezzo angolo dei suoi varchi (coseno). */
const SPICCHI = 28, COS_VARCO = Math.cos((16 * Math.PI) / 180);
/** Altezza dei muri di luce (m), quanto sale chi è lanciato (m sopra la partenza) e da dove cade la cannonata. */
const MURO = 0.85, ARCO = 1.6, CIELO = 2.3, MAX = 24;
const steps = (v: number, n: number) => Math.floor(Math.max(0, Math.min(1, v)) * n) / n;
const CSS = `
.mz-fp-per { position: absolute; left: 50%; bottom: calc(env(safe-area-inset-bottom, 0px) + 92px); transform: translateX(-50%); display: none; z-index: 14; pointer-events: none;
  padding: 4px 14px 5px; background: ${L.rosso}; color: ${L.cartaChiara}; font: 700 18px ${FONT_LIBRO}; border: 2px solid ${L.inchiostro}; box-shadow: 0 3px 0 ${L.inchiostro}; white-space: nowrap; }
.mz-fp-per.on { display: block; } .mz-fp-per.forte { background: ${L.rossoScuro}; }
.mz-fp-via { position: absolute; left: 50%; top: 50%; width: 0; height: 0; display: none; z-index: 14; pointer-events: none; }
.mz-fp-via.on { display: block; }
.mz-fp-via i { position: absolute; left: -11px; top: -86px; width: 0; height: 0; border-left: 11px solid transparent; border-right: 11px solid transparent; border-bottom: 18px solid ${L.rosso}; filter: drop-shadow(0 2px 0 ${L.inchiostro}); }
`;

export type Pericoli = { update(v: DungeonView, t: number, yaw: number): void; dispose(): void };

export function creaPericoli(o: { scene: THREE.Scene; floorY: number; root: HTMLElement }): Pericoli {
  if (!document.getElementById('mz-fp-per')) { const st = document.createElement('style'); st.id = 'mz-fp-per'; st.textContent = CSS; document.head.appendChild(st); }
  const root = new THREE.Group(); root.name = 'fp_pericoli'; o.scene.add(root);
  const tubo = new THREE.CylinderGeometry(1, 1, 1, 28, 1, true), lastra = new THREE.BoxGeometry(1, 1, 1);
  const mats = new Map<string, THREE.MeshBasicMaterial>();
  const mat = (c: string, op: number) => {
    const k = c + op; let m = mats.get(k);
    if (!m) { m = new THREE.MeshBasicMaterial({ color: c, transparent: op < 1, opacity: op, depthWrite: false, side: THREE.DoubleSide }); mats.set(k, m); }
    return m;
  };
  // pezzi riusati: muri tondi (con l'orlo), lastre per le corsie, palle in volo con la scia
  const tondi: { muro: THREE.Mesh; orlo: THREE.Mesh }[] = [], lastre: THREE.Mesh[] = [], palle: { g: THREE.Group; scia: THREE.Mesh[] }[] = [];
  const tondo = (i: number) => {
    while (tondi.length <= i) {
      const muro = new THREE.Mesh(tubo, mat(PAL.rosso, 0.3)), orlo = new THREE.Mesh(tubo, mat(PAL.giallo, 0.9));
      muro.renderOrder = orlo.renderOrder = 4; root.add(muro, orlo); tondi.push({ muro, orlo });
    }
    return tondi[i]!;
  };
  const lastraN = (i: number) => { while (lastre.length <= i) { const m = new THREE.Mesh(lastra, mat(PAL.rosso, 0.3)); m.renderOrder = 4; root.add(m); lastre.push(m); } return lastre[i]!; };
  let nl = 0;
  /** Una lastra in piedi da (x0, z0) a (x1, z1): centro a `y` m da terra, alta `alto`, grossa `spesso`. */
  const lastraTra = (x0: number, z0: number, x1: number, z1: number, y: number, alto: number, spesso: number, col: string, op: number) => {
    const dx = x1 - x0, dz = z1 - z0, len = Math.max(0.05, Math.sqrt(dx * dx + dz * dz)), m = lastraN(nl++);
    m.visible = true; m.material = mat(col, Math.round(op * 20) / 20);
    m.position.set((x0 + x1) / 2, o.floorY + y, (z0 + z1) / 2); m.scale.set(spesso, alto, len); m.rotation.set(0, Math.atan2(dx, dz), 0);
  };
  const palla = (i: number) => {
    while (palle.length <= i) {
      const g = new THREE.Group(), testa = new THREE.Mesh(lastra, mat(PAL.arancio, 1)); testa.scale.setScalar(0.34); g.add(testa);
      const scia = [0, 1, 2].map((k) => { const m = new THREE.Mesh(lastra, mat(PAL.giallo, 0.8 - k * 0.2)); m.scale.setScalar(0.22 - k * 0.05); root.add(m); return m; });
      root.add(g); palle.push({ g, scia });
    }
    return palle[i]!;
  };
  const avviso = document.createElement('div'); avviso.className = 'mz-fp-per'; o.root.appendChild(avviso);
  const via = document.createElement('div'); via.className = 'mz-fp-via'; via.appendChild(document.createElement('i')); o.root.appendChild(via);
  let bip = 0, dentroOra = false, nZone = 0;
  const togliStato = registerStateProvider('pericoli', () => ({ zone: nZone, dentro: dentroOra }));

  return {
    update(v, t, yaw) {
      // ---- le zone di adesso, dalla vista ----
      const zone: Zona[] = [];
      for (const g of v.geyser) {
        if (g.getto || g.evoca) continue;
        const col = g.magma ? PAL.arancio : g.cannone ? PAL.pietraChiara : g.bomba ? PAL.giallo : g.onda ? PAL.arancio : PAL.rosso;
        zone.push({ k: 'cerchio', x: g.x, z: g.z, r: g.r, t: g.t, col, ...(g.da ? { da: g.da } : {}), ...(g.cannone ? { cade: true } : {}) });
      }
      for (const n of v.nemici) {
        if (n.alleato || n.anim !== 'prepara') continue;
        if (n.area) zone.push({ k: 'cerchio', x: n.x, z: n.z, r: n.area, t: n.t, col: PAL.rosso });
        if (n.corsia) zone.push({ k: 'corsia', x: n.x, z: n.z, ex: n.corsia[0], ez: n.corsia[1], w: n.corsia[2], t: n.t, col: PAL.rosso });
        if (n.forma && n.forma.f !== 'x') zone.push({ k: 'cerchio', x: n.forma.x, z: n.forma.z, r: n.forma.r, t: n.t, col: n.forma.tipo === 'sciolina' ? PAL.acquaBassa : PAL.rosso });
        if (n.mira && (n.attacco === 'fucile' || n.attacco === 'raggio')) zone.push({ k: 'linea', x: n.x, z: n.z, ex: n.mira[0], ez: n.mira[1], w: 0.45, t: n.t, col: n.fisso ? PAL.giallo : PAL.rosso });
        if (n.mira && n.attacco === 'carica') zone.push({ k: 'corsia', x: n.x, z: n.z, ex: n.mira[0], ez: n.mira[1], w: 1.1, t: n.t, col: PAL.arancio });
      }
      for (const w of v.onde) zone.push({ k: 'onda', x: w.x, z: w.z, r: w.r, w: w.spessore, varchi: w.varchi, t: Math.min(1, w.r / Math.max(0.1, w.max)), col: w.barriera ? PAL.sabbiaChiara : PAL.acquaBassa });
      for (const l of v.lancette) zone.push({ k: 'lancetta', x: l.x, z: l.z, ex: l.x + l.dx * l.lunga, ez: l.z + l.dz * l.lunga, w: l.largo, t: 0.5, col: PAL.giallo });
      for (const c of v.calore) if (c.stato === 'avviso') zone.push({ k: 'rettangolo', x: c.zona[0], z: c.zona[1], ex: c.zona[2], ez: c.zona[3], t: c.t, col: PAL.arancio });
      if (zone.length > MAX) zone.length = MAX;
      nZone = zone.length;
      // ---- disegno ----
      let nt = 0, np = 0, peggio: { ex: number; ez: number; t: number } | null = null;
      nl = 0;
      const h = v.hero, lampo = Math.floor(t * 8) % 2 === 0;
      for (const z of zone) {
        const forte = z.t > 0.7, op = forte ? (lampo ? 0.6 : 0.35) : 0.18 + 0.3 * steps(z.t, 3);
        if (z.k === 'cerchio') {
          const p = tondo(nt++);
          p.muro.visible = p.orlo.visible = true;
          p.muro.material = mat(z.col, op); p.orlo.material = mat(forte ? PAL.sabbiaChiara : PAL.giallo, 0.9);
          p.muro.position.set(z.x, o.floorY + MURO / 2, z.z); p.muro.scale.set(z.r, MURO, z.r);
          p.orlo.position.set(z.x, o.floorY + MURO * steps(z.t, 4), z.z); p.orlo.scale.set(z.r, 0.05, z.r); // l'orlo sale col tempo che passa
          if (z.da || z.cade) { // in volo: dalla mano di chi la lancia (o dall'alto) fin dove cade, a gradini
            const b = palla(np++), k = steps(z.t, 12), x0 = z.da ? z.da[0] : z.x, z0 = z.da ? z.da[1] : z.z, y0 = z.da ? 1.6 : CIELO;
            const y = (k2: number) => o.floorY + (z.da ? y0 * (1 - k2) + 4 * ARCO * k2 * (1 - k2) : y0 * (1 - k2));
            b.g.visible = true; b.g.position.set(x0 + (z.x - x0) * k, y(k), z0 + (z.z - z0) * k); b.g.rotation.set(k * 9, k * 7, 0);
            (b.g.children[0] as THREE.Mesh).material = mat(z.col === PAL.pietraChiara ? PAL.neroCaldo : z.col, 1);
            b.scia.forEach((m, i) => { const kk = Math.max(0, k - (i + 1) * 0.05); m.visible = true; m.position.set(x0 + (z.x - x0) * kk, y(kk), z0 + (z.z - z0) * kk); });
          }
          const dx = h.x - z.x, dz = h.z - z.z, d = Math.sqrt(dx * dx + dz * dz);
          if (d < z.r + 0.35 && (!peggio || z.t > peggio.t)) peggio = d > 0.05 ? { ex: dx / d, ez: dz / d, t: z.t } : { ex: Math.sin(yaw), ez: Math.cos(yaw), t: z.t };
        } else if (z.k === 'onda') { // muro d'acqua che si allarga, a spicchi: dove c'è un varco lo spicchio manca
          const passo = (2 * Math.PI) / SPICCHI;
          for (let i = 0; i < SPICCHI; i++) {
            const a = (i + 0.5) * passo, cx = Math.cos(a), cz = Math.sin(a);
            if (z.varchi.some(([vx, vz]) => vx * cx + vz * cz > COS_VARCO)) continue;
            const a0 = i * passo, a1 = a0 + passo;
            lastraTra(z.x + Math.cos(a0) * z.r, z.z + Math.sin(a0) * z.r, z.x + Math.cos(a1) * z.r, z.z + Math.sin(a1) * z.r, MURO / 2, MURO, 0.08, z.col, 0.5);
          }
          const dx = h.x - z.x, dz = h.z - z.z, d = Math.sqrt(dx * dx + dz * dz), cx = d > 0.05 ? dx / d : 1, cz = d > 0.05 ? dz / d : 0;
          const varco = z.varchi.reduce<[number, number] | null>((b, w) => (!b || w[0] * cx + w[1] * cz > b[0] * cx + b[1] * cz ? w : b), null);
          if (Math.abs(d - z.r) < z.w + 0.6 && d < z.r + 0.2 && !(varco && varco[0] * cx + varco[1] * cz > COS_VARCO) && (!peggio || 0.8 > peggio.t)) {
            const tx = varco ? z.x + varco[0] * d - h.x : -cz, tz = varco ? z.z + varco[1] * d - h.z : cx, l = Math.hypot(tx, tz) || 1; // verso il varco più vicino
            peggio = { ex: tx / l, ez: tz / l, t: 0.8 };
          }
        } else if (z.k === 'rettangolo') { // zona del calore: quattro muri
          const x0 = z.x, z0 = z.z, x1 = z.ex, z1 = z.ez;
          lastraTra(x0, z0, x1, z0, MURO / 2, MURO, 0.06, z.col, op); lastraTra(x1, z0, x1, z1, MURO / 2, MURO, 0.06, z.col, op);
          lastraTra(x1, z1, x0, z1, MURO / 2, MURO, 0.06, z.col, op); lastraTra(x0, z1, x0, z0, MURO / 2, MURO, 0.06, z.col, op);
          if (h.x > x0 && h.x < x1 && h.z > z0 && h.z < z1 && (!peggio || z.t > peggio.t)) {
            const vie: [number, number, number][] = [[h.x - x0, -1, 0], [x1 - h.x, 1, 0], [h.z - z0, 0, -1], [z1 - h.z, 0, 1]];
            const via0 = vie.reduce((a, b) => (b[0] < a[0] ? b : a));
            peggio = { ex: via0[1], ez: via0[2], t: z.t };
          }
        } else {
          const dx = z.ex - z.x, dz = z.ez - z.z, len = Math.max(0.1, Math.sqrt(dx * dx + dz * dz)), ux = dx / len, uz = dz / len;
          if (z.k === 'corsia') for (const lato of [-1, 1]) lastraTra(z.x - uz * z.w * lato, z.z + ux * z.w * lato, z.ex - uz * z.w * lato, z.ez + ux * z.w * lato, MURO / 2, MURO, 0.06, z.col, op); // i due bordi
          else if (z.k === 'linea') lastraTra(z.x, z.z, z.ex, z.ez, 1.2, 0.05, 0.05, z.col, lampo || z.t < 0.5 ? 0.95 : 0.5); // il filo della mira, all'altezza del petto
          else lastraTra(z.x, z.z, z.ex, z.ez, 0.3, 0.6, z.w * 2, z.col, 0.45); // la lancetta che gira
          const hx = h.x - z.x, hz = h.z - z.z, lungo = hx * ux + hz * uz, lat = hx * -uz + hz * ux;
          if (lungo > -0.3 && lungo < len + 0.3 && Math.abs(lat) < z.w + 0.35 && (!peggio || z.t > peggio.t)) { const s = lat >= 0 ? 1 : -1; peggio = { ex: -uz * s, ez: ux * s, t: z.k === 'lancetta' ? 0.8 : z.t }; }
        }
      }
      for (let i = nt; i < tondi.length; i++) tondi[i]!.muro.visible = tondi[i]!.orlo.visible = false;
      for (let i = nl; i < lastre.length; i++) lastre[i]!.visible = false;
      for (let i = np; i < palle.length; i++) { palle[i]!.g.visible = false; for (const m of palle[i]!.scia) m.visible = false; }
      // ---- dentro: avviso, freccia verso l'uscita, bip ----
      dentroOra = !!peggio;
      avviso.classList.toggle('on', !!peggio); via.classList.toggle('on', !!peggio);
      if (!peggio) { bip = 0; return; }
      const forte = peggio.t > 0.6;
      avviso.classList.toggle('forte', forte);
      const testo = forte ? 'VIA DI LÌ!' : 'Pericolo: spostati';
      if (avviso.textContent !== testo) avviso.textContent = testo;
      const fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
      via.style.transform = `rotate(${Math.atan2(peggio.ex * rx + peggio.ez * rz, peggio.ex * fx + peggio.ez * fz)}rad)`;
      if (t >= bip) { suona('pericolo', forte ? 1 : 0); bip = t + (forte ? 0.16 : 0.36); }
    },
    dispose() { togliStato(); root.removeFromParent(); tubo.dispose(); lastra.dispose(); for (const m of mats.values()) m.dispose(); avviso.remove(); via.remove(); },
  };
}
