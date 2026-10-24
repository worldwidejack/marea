// Gli interni del mondo (#265): la stanza della casa (game/stanza.ts) e il negozio dei mobili (game/negozio.ts). Qui le parti comuni:
// pavimenti e carte disegnati interi su misura (finiture_disegni.ts, borgo.json `motivo`), la stanza «da plastico» (pavimento, tre pareti con la carta, davanti aperta
// col bordo tagliato, corridoio di assi sotto) e l'inquadratura fissa sopra l'ingresso (render/camera.ts `blocca`, scena interna senza
// cielo né foschia, render/scene.ts `setInterno`). Coordinate in celle del template (tile m l'una), la stanza si disegna dall'origine.
import * as THREE from 'three';
import type { StanzaFinitura } from '@marea/content';
import type { GameWorld } from './world.ts';
import type { Renderer } from '../render/scene.ts';
import { M, P, merged, painted } from '../render/island_parts.ts';
import { GIORNO, LUCE_INTERNO } from '../render/ciclo.ts';
import { TEX_MURO, TEX_PAV, type Muro, type Pav } from './finiture_kit.ts';

let disegniPromise: Promise<typeof import('./finiture_disegni.ts')> | null = null;
let disegniMod: typeof import('./finiture_disegni.ts') | null = null;

export function caricaDisegni(): Promise<typeof import('./finiture_disegni.ts')> {
  return (disegniPromise ??= import('./finiture_disegni.ts').then((m) => {
    disegniMod = m;
    return m;
  }));
}

export const SPESSORE = 0.3;
/** Inquadratura degli interni: da sud (yaw 0), inclinata (pitch ~38° per vedere bene mobili e pareti), FOV un po' più largo della diorama. */
export const VISTA = { yaw: 0, pitch: (38 * Math.PI) / 180, fov: 36 };
/** Cose del mondo che dentro non si vedono (nomi delle mesh): animali, lucciole, pioggia, acqua «stampa», lampadine. */
export const NASCOSTI_DENTRO = ['animali', 'lucciole', 'pioggia', 'acqua_stile', 'luci'] as const;

/** Texture di un disegno intero: la tela è subito della misura giusta (tinta di fondo), il disegno arriva col modulo dei disegni. */
function texturaDisegno(w: number, h: number, fondo: string, disegna: (m: typeof import('./finiture_disegni.ts'), c: HTMLCanvasElement) => void): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h));
  const g = c.getContext('2d')!; g.fillStyle = fondo; g.fillRect(0, 0, c.width, c.height);
  if (disegniMod) disegna(disegniMod, c);
  const t = new THREE.CanvasTexture(c);
  t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.colorSpace = THREE.SRGBColorSpace;
  if (!disegniMod) void caricaDisegni().then((m) => { disegna(m, c); t.needsUpdate = true; });
  return t;
}
/** Il pavimento disegnato intero per una pianta di cx×cz celle (16 texel/m): bordi, tappeti e rosoni si rifanno quando la casa cresce. */
const texturePavimento = (f: StanzaFinitura, s: Pav): THREE.CanvasTexture =>
  texturaDisegno(s.cx * 2 * TEX_PAV, s.cz * 2 * TEX_PAV, f.colori[0] ?? P.pietraChiara, (m, c) => m.disegnaPavimento(c, f, s));
/** Una parete disegnata intera (32 texel/m), pezzo del giro delle tre pareti. */
const textureParete = (f: StanzaFinitura, s: Muro): THREE.CanvasTexture =>
  texturaDisegno(s.lung * TEX_MURO, s.alt * TEX_MURO, f.colori[0] ?? P.pietraChiara, (m, c) => m.disegnaParete(c, f, s));
/** Il campione del negozio: un pavimento di 3×3 celle o un pezzo di parete di 2,4×3,2 m, in piccolo. */
export const textureCampione = (f: StanzaFinitura, tipo: 'pavimento' | 'carta'): THREE.CanvasTexture => tipo === 'pavimento'
  ? texturePavimento(f, { cx: 3, cz: 3 })
  : textureParete(f, { lato: 'fondo', lung: 2.4, alt: 3.2, u0: 0, giro: 2.4, x0: 0, x1: Math.round(2.4 * TEX_MURO) });
export const ASSI: StanzaFinitura = { id: 'assi', nome: 'Assi', motivo: 'assi', colori: [P.legnoChiaro, P.legno, P.legnoScuro] };

/** Una porta (cornice e battente) larga ~1,5 m, in coordinate locali, rivolta verso +z. */
export function porta(x: number, y: number, z: number, ry = 0): THREE.BufferGeometry[] {
  const R = (m: THREE.Matrix4) => M(x, y, z, 0, ry, 0).multiply(m);
  return [
    painted(new THREE.BoxGeometry(1.7, 2.5, 0.2), P.legnoScuro, R(M(0, 1.25, 0))),
    painted(new THREE.BoxGeometry(1.3, 2.25, 0.26), P.legno, R(M(0, 1.13, 0))),
    painted(new THREE.BoxGeometry(0.14, 0.14, 0.34), P.giallo, R(M(0.4, 1.1, 0))),
  ];
}

/** Pianta di un interno, in celle del suo template: pavimento [x0, z0, x1, z1), corridoio [cx, c0, c1), altezza dei muri (m). */
export type Pianta = {
  pavimento: readonly [number, number, number, number];
  corridoio: readonly [number, number, number] | null;
  altezza: number;
  scale?: readonly { cell: readonly [number, number]; verso: 'giu' | 'su' }[];
  chiusoInFondo?: boolean;
};

/** La stanza «da plastico» in coordinate locali del template: pavimento e carta si cambiano con `rifinisci`. */
export function costruisciStanza(T: number, p: Pianta, pav: StanzaFinitura, carta: StanzaFinitura): { group: THREE.Group; rifinisci(pav: StanzaFinitura, carta: StanzaFinitura): void } {
  const [X0, Z0, X1, Z1] = p.pavimento, [CX, C0, C1] = p.corridoio ?? [0, Z1, Z1], H = p.altezza; // senza corridoio (cantina, secondo piano, #386) il bordo davanti è intero
  const lw = (X1 - X0) * T, ld = (Z1 - Z0) * T, cw = T, cl = (C1 - C0) * T;
  const group = new THREE.Group();
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(lw, ld), new THREE.MeshLambertMaterial());
  floor.rotation.x = -Math.PI / 2; floor.position.set(X0 * T + lw / 2, 0.02, Z0 * T + ld / 2); floor.receiveShadow = true;
  group.add(floor);
  // corridoio: assi di legno, un po' più in basso del pavimento (un gradino)
  if (p.corridoio) {
    const corr = new THREE.Mesh(new THREE.PlaneGeometry(cw, cl), new THREE.MeshLambertMaterial({ map: texturePavimento(ASSI, { cx: 1, cz: C1 - C0 }) }));
    corr.rotation.x = -Math.PI / 2; corr.position.set((CX + 0.5) * T, -0.08, C0 * T + cl / 2); corr.receiveShadow = true;
    group.add(corr);
    if (p.scale) {
      const tAssi = texturePavimento(ASSI, { cx: 1, cz: 1 });
      for (const s of p.scale) {
        const sx = (s.cell[0] + 0.5) * T, sz = (s.cell[1] + 0.5) * T;
        const pian = new THREE.Mesh(new THREE.PlaneGeometry(T, T), new THREE.MeshLambertMaterial({ map: tAssi }));
        pian.rotation.x = -Math.PI / 2; pian.position.set(sx, -0.08, sz); pian.receiveShadow = true;
        group.add(pian);
      }
    }
  }
  // pareti: in fondo e ai lati (davanti aperta). La carta è un disegno solo per parete, sulla faccia verso la stanza; le altre facce
  // (la cima e i tagli davanti, come un plastico) sono a tinta unita. Le tre pareti si leggono come un giro: sinistra dal davanti al fondo,
  // fondo da sinistra a destra (passa dietro ai fianchi per lo spessore), destra dal fondo al davanti.
  const taglio = new THREE.MeshLambertMaterial({ color: P.roccia }), giro = 2 * ld + lw;
  const pareti: { m: THREE.Mesh; faccia: number; muro: Muro }[] = [];
  const parete = (muro: Muro, x: number, z: number, ry: number, faccia: number) => {
    const mats = Array.from({ length: 6 }, (_, i) => (i === faccia ? new THREE.MeshLambertMaterial() : taglio));
    const m = new THREE.Mesh(new THREE.BoxGeometry(muro.lung, H, SPESSORE), mats);
    m.position.set(x, H / 2, z); m.rotation.y = ry; m.receiveShadow = true; group.add(m); pareti.push({ m, faccia, muro });
  };
  const muro = (lato: Muro['lato'], lung: number, u0: number, x0: number, x1: number): Muro => ({ lato, lung, alt: H, u0, giro, x0: Math.round(x0 * TEX_MURO), x1: Math.round(x1 * TEX_MURO) });
  parete(muro('fondo', lw + 2 * SPESSORE, ld - SPESSORE, SPESSORE, SPESSORE + lw), X0 * T + lw / 2, Z0 * T - SPESSORE / 2, 0, 4);
  parete(muro('sx', ld, 0, 0, ld), X0 * T - SPESSORE / 2, Z0 * T + ld / 2, Math.PI / 2, 4); // la faccia +z guarda dentro (verso +x)
  parete(muro('dx', ld, ld + lw, 0, ld), X1 * T + SPESSORE / 2, Z0 * T + ld / 2, Math.PI / 2, 5); // qui guarda dentro la faccia −z
  // battiscopa, bordo davanti tagliato (lo spessore del pavimento, come un plastico) e i fianchi bassi del corridoio
  const zf = Z1 * T, xa = CX * T, xb = (CX + 1) * T;
  const fianchi: THREE.BufferGeometry[] = [];
  if (p.corridoio) {
    for (let cz = C0; cz < C1; cz++) {
      const czMid = (cz + 0.5) * T;
      if (!(p.scale ?? []).some((s) => s.cell[0] === CX - 1 && s.cell[1] === cz)) {
        fianchi.push(painted(new THREE.BoxGeometry(0.2, 0.7, T), P.legnoScuro, M(xa - 0.1, 0.27, czMid)));
      }
      if (!(p.scale ?? []).some((s) => s.cell[0] === CX + 1 && s.cell[1] === cz)) {
        fianchi.push(painted(new THREE.BoxGeometry(0.2, 0.7, T), P.legnoScuro, M(xb + 0.1, 0.27, czMid)));
      }
    }
    if (p.chiusoInFondo) {
      fianchi.push(painted(new THREE.BoxGeometry(cw + 0.2, 0.7, 0.2), P.legnoScuro, M((CX + 0.5) * T, 0.27, C1 * T - 0.1)));
    }
  }
  const parti = [
    painted(new THREE.BoxGeometry(lw, 0.25, 0.12), P.legnoScuro, M(X0 * T + lw / 2, 0.12, Z0 * T + 0.06)),
    painted(new THREE.BoxGeometry(0.12, 0.25, ld), P.legnoScuro, M(X0 * T + 0.06, 0.12, Z0 * T + ld / 2)),
    painted(new THREE.BoxGeometry(0.12, 0.25, ld), P.legnoScuro, M(X1 * T - 0.06, 0.12, Z0 * T + ld / 2)),
    ...(p.corridoio ? [
      // bordo del pavimento a sinistra e a destra del corridoio (pietra scura, mezzo metro: si vede il «taglio»)
      painted(new THREE.BoxGeometry(xa - X0 * T + SPESSORE, 0.55, 0.3), P.roccia, M((X0 * T - SPESSORE + xa) / 2, -0.25, zf + 0.15)),
      painted(new THREE.BoxGeometry(X1 * T + SPESSORE - xb, 0.55, 0.3), P.roccia, M((xb + X1 * T + SPESSORE) / 2, -0.25, zf + 0.15)),
      // i fianchi del corridoio: muretti bassi di legno che finiscono nel buio, e la soglia in cima
      ...fianchi,
      painted(new THREE.BoxGeometry(cw, 0.08, 0.2), P.legnoScuro, M((CX + 0.5) * T, -0.02, C0 * T + 0.1)),
    ] : [
      painted(new THREE.BoxGeometry(lw + 2 * SPESSORE, 0.55, 0.3), P.roccia, M(X0 * T + lw / 2, -0.25, zf + 0.15)), // il bordo davanti, tutto intero
    ]),
  ];
  group.add(new THREE.Mesh(merged(parti), new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true })));
  const buio = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), new THREE.MeshBasicMaterial({ color: P.neroCaldo }));
  buio.rotation.x = -Math.PI / 2; buio.position.set(X0 * T + lw / 2, -0.6, Z0 * T + ld / 2); group.add(buio);
  let fp: StanzaFinitura | null = null, fc: StanzaFinitura | null = null;
  const rifinisci = (p2: StanzaFinitura, c2: StanzaFinitura) => {
    if (p2 !== fp) {
      fp = p2; const mt = floor.material as THREE.MeshLambertMaterial; mt.map?.dispose();
      mt.map = texturePavimento(p2, { cx: X1 - X0, cz: Z1 - Z0 }); mt.needsUpdate = true;
    }
    if (c2 !== fc) {
      fc = c2;
      for (const { m, faccia, muro: mu } of pareti) { const mt = (m.material as THREE.MeshLambertMaterial[])[faccia]!; mt.map?.dispose(); mt.map = textureParete(c2, mu); mt.needsUpdate = true; }
    }
  };
  rifinisci(pav, carta);
  return { group, rifinisci };
}

/** L'inquadratura fissa sopra l'ingresso di un interno: tutta la stanza in larghezza; col telefono in verticale ti segue in x tra i muri. */
export function createInquadratura(o: { world: GameWorld; renderer: Renderer }): { entra(ox: number, oz: number, p: Pianta): void; esce(): void; readonly distanza: number } {
  const w = o.world, T = w.archipelago.tile, dio = o.renderer.diorama;
  let distanza = 20, mezzaVista = 99, aspetto = 0;
  const misura = (p: Pianta) => {
    const [X0, Z0, X1, Z1] = p.pavimento, lw = (X1 - X0) * T, ld = (Z1 - Z0) * T;
    const a = dio.camera.aspect, t = Math.tan((VISTA.fov * Math.PI) / 360);
    aspetto = a;
    const alto = ld * Math.sin(VISTA.pitch) + p.altezza * Math.cos(VISTA.pitch) + 0.8; // quanto è alta la stanza vista dalla camera (m)
    const dAlto = alto / 2 / t, dLargo = (lw + 1.6) / 2 / (t * a);
    distanza = Math.min(Math.max(dAlto * 0.88, dLargo * 0.9), dAlto * 1.4); // più vicina: i mobili si vedono grandi e definiti
    mezzaVista = distanza * t * a;
    dio.blocca?.({ ...VISTA, dist: distanza });
  };
  return {
    get distanza() { return distanza; },
    entra(ox, oz, p) {
      const [X0, Z0, X1, Z1] = p.pavimento, lw = (X1 - X0) * T, ld = (Z1 - Z0) * T, cl = p.corridoio ? (p.corridoio[2] - p.corridoio[1]) * T : 0;
      o.renderer.setInterno(P.neroCaldo);
      w.lights.set?.(LUCE_INTERNO);
      const centroZ = Z0 * T + ld / 2, xMin = ox + X0 * T - 1, xMax = ox + X1 * T + 1;
      w.camFissa = (x, z) => {
        if (dio.camera.aspect !== aspetto) misura(p);
        const cx = ox + X0 * T + lw / 2, m = Math.max(0, (xMax - xMin) / 2 - mezzaVista);
        const cz = oz + centroZ, zOltre = z > oz + Z1 * T ? Math.min(cl, z - (oz + Z1 * T)) : 0;
        // in verticale lo schermo sotto è dei comandi: la stanza sale un po' (il bersaglio scende verso il corridoio)
        return { x: Math.min(cx + m, Math.max(cx - m, x)), z: cz + zOltre + (aspetto < 0.8 ? 2 : 0) };
      };
      misura(p);
      const t = w.camFissa(w.avatar.state.x, w.avatar.state.z)!;
      dio.follow(t.x, 0.5, t.z); dio.snap?.();
    },
    esce() { o.renderer.setInterno(null); w.lights.set?.(GIORNO.sun); dio.blocca?.(null); w.camFissa = null; dio.follow(w.avatar.state.x, 0.5, w.avatar.state.z); dio.snap?.(); },
  };
}
