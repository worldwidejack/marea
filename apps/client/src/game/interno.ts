// Gli interni del mondo (#265): la stanza della casa (game/stanza.ts) e il negozio dei mobili (game/negozio.ts). Qui le parti comuni:
// texture a pixel di pavimenti e carte (borgo.json `motivo`), la stanza «da plastico» (pavimento, tre pareti con la carta, davanti aperta
// col bordo tagliato, corridoio di assi sotto) e l'inquadratura fissa sopra l'ingresso (render/camera.ts `blocca`, scena interna senza
// cielo né foschia, render/scene.ts `setInterno`). Coordinate in celle del template (tile m l'una), la stanza si disegna dall'origine.
import * as THREE from 'three';
import type { StanzaFinitura } from '@marea/content';
import type { GameWorld } from './world.ts';
import type { Renderer } from '../render/scene.ts';
import { M, P, merged, painted } from '../render/island_parts.ts';

export const SPESSORE = 0.3;
/** Inquadratura degli interni: da sud (yaw 0), dall'alto (pitch), FOV un po' più largo della diorama. */
export const VISTA = { yaw: 0, pitch: (54 * Math.PI) / 180, fov: 36 };
/** Cose del mondo che dentro non si vedono (nomi delle mesh): animali, lucciole, pioggia, acqua «stampa», lampadine. */
export const NASCOSTI_DENTRO = ['animali', 'lucciole', 'pioggia', 'acqua_stile', 'luci'] as const;

/** Texture a pixel di un pavimento o di una carta da parati: 16×16 texel per cella (pavimento, 2 m) o per metro (carta). */
export function texture(f: StanzaFinitura): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = 16; c.height = 16;
  const g = c.getContext('2d')!, [a = P.pietraChiara, b = P.pietra, k = P.pietraScura] = f.colori;
  const px = (col: string, x: number, y: number, w = 1, h = 1) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
  if (f.motivo === 'rombi') {
    px(a, 0, 0, 16, 16);
    for (let y = 0; y < 16; y++) { const d = Math.abs(8 - y); px(b, d, y, 16 - 2 * d, 1); }
    for (let y = 0; y < 16; y++) { const d = Math.abs(8 - y); px(k, d, y); px(k, 15 - d, y); }
  } else if (f.motivo === 'listelli') { // parquet: listelli orizzontali sfalsati
    px(a, 0, 0, 16, 16);
    for (let y = 0; y < 16; y += 4) { px(k, 0, y, 16, 1); px(b, 0, y + 2, 16, 1); const o = (y / 4) % 2 ? 4 : 12; px(k, o, y, 1, 4); px(k, (o + 8) % 16, y, 1, 4); }
  } else if (f.motivo === 'stuoia') { // stuoia di bambù: canne verticali sottili con le legature
    px(a, 0, 0, 16, 16);
    for (let x = 0; x < 16; x += 2) px(x % 4 ? b : a, x, 0, 1, 16);
    for (let x = 0; x < 16; x += 4) px(k, x, 0, 1, 16);
    px(k, 0, 5, 16, 1); px(k, 0, 13, 16, 1);
  } else if (f.motivo === 'lastre') { // lastre di pietra grandi, fughe scure
    px(a, 0, 0, 16, 16); px(b, 9, 1, 6, 6); px(b, 1, 10, 5, 5);
    px(k, 0, 0, 16, 1); px(k, 0, 0, 1, 16); px(k, 8, 0, 1, 9); px(k, 0, 8, 16, 1); px(k, 7, 8, 1, 8);
  } else if (f.motivo === 'righe') { // carta a righe verticali larghe con un filo scuro
    px(a, 0, 0, 16, 16); px(b, 4, 0, 4, 16); px(b, 12, 0, 4, 16); px(k, 8, 0, 1, 16); px(k, 0, 0, 1, 16);
  } else if (f.motivo === 'mattoni') { // muro di pietra: blocchi sfalsati con la malta chiara
    px(a, 0, 0, 16, 16);
    for (let y = 0; y < 16; y += 4) { px(k, 0, y + 3, 16, 1); const o = (y / 4) % 2 ? 4 : 0; px(k, o, y, 1, 3); px(k, o + 8, y, 1, 3); px(b, o + 1, y, 2, 1); }
  } else if (f.motivo === 'perline') { // perline di legno: assi verticali con la scanalatura
    px(a, 0, 0, 16, 16);
    for (let x = 0; x < 16; x += 4) { px(k, x, 0, 1, 16); px(b, x + 1, 0, 1, 16); }
    px(k, 6, 4, 1, 1); px(k, 14, 11, 1, 1);
  } else if (f.motivo === 'assi') { // assi di legno per lungo, con le fughe e i chiodi (il corridoio)
    px(a, 0, 0, 16, 16);
    for (let x = 0; x < 16; x += 4) { px(k, x, 0, 1, 16); px(b, x + 1, 0, 1, 16); }
    for (const [x, y] of [[2, 3], [6, 11], [10, 5], [14, 13]] as const) px(k, x, y);
    px(k, 0, 7, 4, 1); px(k, 8, 13, 4, 1);
  } else { // 'scacchi' (di serie): quattro piastrelle per cella, fuga scura
    px(a, 0, 0, 16, 16); px(b, 8, 0, 8, 8); px(b, 0, 8, 8, 8);
    px(k, 0, 0, 16, 1); px(k, 0, 8, 16, 1); px(k, 0, 0, 1, 16); px(k, 8, 0, 1, 16);
  }
  const t = new THREE.CanvasTexture(c);
  t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
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

/** Pianta di un interno, in celle del suo template: pavimento [x0, z0, x1, z1), corridoio [cx, c0, c1), altezza dei muri (m), porta in fondo (colonna, o null). */
export type Pianta = { pavimento: readonly [number, number, number, number]; corridoio: readonly [number, number, number]; altezza: number; retro: number | null };

/** La stanza «da plastico» in coordinate locali del template: pavimento e carta si cambiano con `rifinisci`. */
export function costruisciStanza(T: number, p: Pianta, pav: StanzaFinitura, carta: StanzaFinitura): { group: THREE.Group; rifinisci(pav: StanzaFinitura, carta: StanzaFinitura): void } {
  const [X0, Z0, X1, Z1] = p.pavimento, [CX, C0, C1] = p.corridoio, H = p.altezza;
  const lw = (X1 - X0) * T, ld = (Z1 - Z0) * T, cw = T, cl = (C1 - C0) * T;
  const group = new THREE.Group();
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(lw, ld), new THREE.MeshLambertMaterial());
  floor.rotation.x = -Math.PI / 2; floor.position.set(X0 * T + lw / 2, 0.02, Z0 * T + ld / 2); floor.receiveShadow = true;
  group.add(floor);
  // corridoio: assi di legno, un po' più in basso del pavimento (un gradino)
  const tAssi = texture(ASSI); tAssi.repeat.set(1, cl / 2);
  const corr = new THREE.Mesh(new THREE.PlaneGeometry(cw, cl), new THREE.MeshLambertMaterial({ map: tAssi }));
  corr.rotation.x = -Math.PI / 2; corr.position.set((CX + 0.5) * T, -0.08, C0 * T + cl / 2); corr.receiveShadow = true;
  group.add(corr);
  // pareti: in fondo e ai lati (davanti aperta), carta da parati una volta per metro
  const pareti: THREE.Mesh[] = [];
  const parete = (lung: number, x: number, z: number, ry: number) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(lung, H, SPESSORE), new THREE.MeshLambertMaterial());
    m.position.set(x, H / 2, z); m.rotation.y = ry; m.receiveShadow = true; m.userData['lung'] = lung; group.add(m); pareti.push(m);
  };
  parete(lw + 2 * SPESSORE, X0 * T + lw / 2, Z0 * T - SPESSORE / 2, 0);
  parete(ld, X0 * T - SPESSORE / 2, Z0 * T + ld / 2, Math.PI / 2);
  parete(ld, X1 * T + SPESSORE / 2, Z0 * T + ld / 2, Math.PI / 2);
  // battiscopa, porta sul retro, bordo davanti tagliato (lo spessore del pavimento, come un plastico) e i fianchi bassi del corridoio
  const zf = Z1 * T, xa = CX * T, xb = (CX + 1) * T;
  const parti = [
    painted(new THREE.BoxGeometry(lw, 0.25, 0.12), P.legnoScuro, M(X0 * T + lw / 2, 0.12, Z0 * T + 0.06)),
    painted(new THREE.BoxGeometry(0.12, 0.25, ld), P.legnoScuro, M(X0 * T + 0.06, 0.12, Z0 * T + ld / 2)),
    painted(new THREE.BoxGeometry(0.12, 0.25, ld), P.legnoScuro, M(X1 * T - 0.06, 0.12, Z0 * T + ld / 2)),
    ...(p.retro !== null ? porta((p.retro + 0.5) * T, 0, Z0 * T + 0.05) : []),
    // bordo del pavimento a sinistra e a destra del corridoio (pietra scura, mezzo metro: si vede il «taglio»)
    painted(new THREE.BoxGeometry(xa - X0 * T + SPESSORE, 0.55, 0.3), P.roccia, M((X0 * T - SPESSORE + xa) / 2, -0.25, zf + 0.15)),
    painted(new THREE.BoxGeometry(X1 * T + SPESSORE - xb, 0.55, 0.3), P.roccia, M((xb + X1 * T + SPESSORE) / 2, -0.25, zf + 0.15)),
    // i fianchi del corridoio: muretti bassi di legno che finiscono nel buio, e la soglia in cima
    ...[xa - 0.1, xb + 0.1].map((x) => painted(new THREE.BoxGeometry(0.2, 0.7, cl), P.legnoScuro, M(x, 0.27, C0 * T + cl / 2))),
    painted(new THREE.BoxGeometry(cw, 0.08, 0.2), P.legnoScuro, M((CX + 0.5) * T, -0.02, C0 * T + 0.1)),
  ];
  group.add(new THREE.Mesh(merged(parti), new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true })));
  const buio = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), new THREE.MeshBasicMaterial({ color: P.neroCaldo }));
  buio.rotation.x = -Math.PI / 2; buio.position.set(X0 * T + lw / 2, -0.6, Z0 * T + ld / 2); group.add(buio);
  let fp: StanzaFinitura | null = null, fc: StanzaFinitura | null = null;
  const rifinisci = (p2: StanzaFinitura, c2: StanzaFinitura) => {
    if (p2 !== fp) {
      fp = p2; const mt = floor.material as THREE.MeshLambertMaterial; mt.map?.dispose();
      mt.map = texture(p2); mt.map.repeat.set(X1 - X0, Z1 - Z0); mt.needsUpdate = true;
    }
    if (c2 !== fc) {
      fc = c2;
      for (const m of pareti) { const mt = m.material as THREE.MeshLambertMaterial; mt.map?.dispose(); mt.map = texture(c2); mt.map.repeat.set(m.userData['lung'] as number, H); mt.needsUpdate = true; }
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
    const [X0, Z0, X1, Z1] = p.pavimento, lw = (X1 - X0) * T, ld = (Z1 - Z0) * T, cl = (p.corridoio[2] - p.corridoio[1]) * T;
    const a = dio.camera.aspect, t = Math.tan((VISTA.fov * Math.PI) / 360);
    aspetto = a;
    const alto = (ld + cl) * Math.sin(VISTA.pitch) + p.altezza * Math.cos(VISTA.pitch) + 1; // quanto è alta la stanza vista dalla camera (m)
    const dAlto = alto / 2 / t, dLargo = (lw + 2) / 2 / (t * a);
    distanza = Math.min(Math.max(dAlto, dLargo), dAlto * 1.6); // col telefono in verticale non si allontana troppo: ti segue in x
    mezzaVista = distanza * t * a;
    dio.blocca?.({ ...VISTA, dist: distanza });
  };
  return {
    get distanza() { return distanza; },
    entra(ox, oz, p) {
      const [X0, Z0, X1, Z1] = p.pavimento, lw = (X1 - X0) * T, ld = (Z1 - Z0) * T, cl = (p.corridoio[2] - p.corridoio[1]) * T;
      o.renderer.setInterno(P.neroCaldo);
      const centroZ = Z0 * T + (ld + cl) / 2 - 1.5, xMin = ox + X0 * T - 1, xMax = ox + X1 * T + 1;
      w.camFissa = (x) => {
        if (dio.camera.aspect !== aspetto) misura(p);
        const cx = ox + X0 * T + lw / 2, m = Math.max(0, (xMax - xMin) / 2 - mezzaVista);
        // in verticale lo schermo sotto è dei comandi: la stanza sale un po' (il bersaglio scende verso il corridoio)
        return { x: Math.min(cx + m, Math.max(cx - m, x)), z: oz + centroZ + (aspetto < 0.8 ? 3 : 0) };
      };
      misura(p);
      const t = w.camFissa(w.avatar.state.x, w.avatar.state.z)!;
      dio.follow(t.x, 0.5, t.z); dio.snap?.();
    },
    esce() { o.renderer.setInterno(null); dio.blocca?.(null); w.camFissa = null; dio.follow(w.avatar.state.x, 0.5, w.avatar.state.z); dio.snap?.(); },
  };
}
