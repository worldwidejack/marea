// La stanza della casa (#240, #265), stile Animal Crossing: pavimento a piastrelle, tre pareti con la carta da parati (davanti è
// aperta verso la camera, col bordo del pavimento tagliato come un plastico), la porta in fondo che porta al giardino e, sotto, il
// corridoio di assi da cui si entra e si esce in città. Sta nel template `lotto` (BORGO.stanza, celle locali): così baule e decorazioni
// dentro casa sono celle del LotState come in giardino. Dentro la camera è fissa sopra l'ingresso (render/camera.ts `blocca`) e attorno
// è buio: niente mare, pesci, gabbiani, pioggia, cielo né foschia (render/scene.ts `setInterno`). In giardino, al posto della porta, un
// passaggio coperto riporta in casa. In casa e in giardino la minimappa si nasconde (body.mz-casa): il giardino sta fuori dalla mappa.
// Pavimenti e carte da parati vengono da borgo.json (il primo è quello di serie); `motivo` dice come si dipinge la texture.
import * as THREE from 'three';
import { BORGO } from '@marea/content';
import type { StanzaFinitura } from '@marea/content';
import { finitureScelte } from '@marea/sim';
import type { LotState } from '@marea/sim';
import type { GameWorld } from './world.ts';
import type { Renderer } from '../render/scene.ts';
import { M, P, merged, painted } from '../render/island_parts.ts';
import { registerStateProvider } from '../test/testapi.ts';

const ST = BORGO.stanza, [X0, Z0, X1, Z1] = ST.pavimento, [CX, C0, C1] = ST.corridoio;
const SPESSORE = 0.3;
/** Inquadratura di casa: da sud (yaw 0), dall'alto (pitch), FOV un po' più largo della diorama. */
const VISTA = { yaw: 0, pitch: (54 * Math.PI) / 180, fov: 36 };

/** Texture a pixel di un pavimento o di una carta da parati: 16×16 texel per cella (pavimento, 2 m) o per metro (carta). */
function texture(f: StanzaFinitura): THREE.CanvasTexture {
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
const ASSI: StanzaFinitura = { id: 'assi', nome: 'Assi', motivo: 'assi', colori: [P.legnoChiaro, P.legno, P.legnoScuro] };

/** Una porta (cornice e battente) larga ~1,5 m, in coordinate locali, rivolta verso +z. */
function porta(x: number, y: number, z: number, ry = 0): THREE.BufferGeometry[] {
  const R = (m: THREE.Matrix4) => M(x, y, z, 0, ry, 0).multiply(m);
  return [
    painted(new THREE.BoxGeometry(1.7, 2.5, 0.2), P.legnoScuro, R(M(0, 1.25, 0))),
    painted(new THREE.BoxGeometry(1.3, 2.25, 0.26), P.legno, R(M(0, 1.13, 0))),
    painted(new THREE.BoxGeometry(0.14, 0.14, 0.34), P.giallo, R(M(0.4, 1.1, 0))),
  ];
}

/** Il passaggio coperto del giardino (#265): tettoia di legno su quattro pali con l'interno buio, con la bocca in (x, z) rivolta a est
 *  (verso la camera, che sta a sud-est: si vede il buio dentro); ci si cammina dentro verso ovest e si torna in casa. Coordinate mondo. */
function passaggio(x: number, y: number, z: number): THREE.BufferGeometry[] {
  const g: THREE.BufferGeometry[] = [], gira = M(x, y, z, 0, -Math.PI / 2, 0);
  x = 0; y = 0; z = 0; // costruito con la bocca a nord e il corpo verso sud, poi girato: il corpo va a ovest
  for (const sx of [-1, 1]) for (const dz of [0, 1.8]) g.push(painted(new THREE.BoxGeometry(0.22, 2.5, 0.22), P.legnoScuro, M(x + sx * 1.05, y + 1.25, z + dz)));
  for (const sx of [-1, 1]) g.push(painted(new THREE.BoxGeometry(1.3, 0.14, 2.6), P.legno, M(x + sx * 0.6, y + 2.45, z + 0.9, 0, 0, sx * -0.45)));
  g.push(painted(new THREE.BoxGeometry(0.2, 0.2, 2.6), P.legnoScuro, M(x, y + 2.75, z + 0.9)));
  for (const sx of [-1, 1]) g.push(painted(new THREE.BoxGeometry(0.12, 1.9, 1.6), P.legno, M(x + sx * 1.05, y + 1.2, z + 0.9))); // fianchi
  g.push(painted(new THREE.BoxGeometry(2.0, 2.4, 0.12), P.neroCaldo, M(x, y + 1.2, z + 1.85))); // il buio in fondo
  g.push(painted(new THREE.BoxGeometry(2.0, 0.06, 1.9), P.legnoChiaro, M(x, y + 0.03, z + 0.9))); // assi per terra
  g.push(painted(new THREE.BoxGeometry(0.9, 0.5, 0.08), P.legnoChiaro, M(x, y + 2.3, z - 0.05)), painted(new THREE.BoxGeometry(0.22, 0.22, 0.1), P.rosso, M(x, y + 2.32, z - 0.1))); // insegna
  for (const q of g) q.applyMatrix4(gira);
  return g;
}

export type Stanza = { dentro(): number | null };

export function createStanza(o: { world: GameWorld; renderer: Renderer; slots: readonly number[]; lotDi?: (slot: number) => LotState | null }): Stanza {
  const w = o.world, arch = w.archipelago, T = arch.tile, dio = o.renderer.diorama;
  const lw = (X1 - X0) * T, ld = (Z1 - Z0) * T, H = ST.altezza, cw = T, cl = (C1 - C0) * T;
  let pav = BORGO.pavimenti[0]!, carta = BORGO.carte[0]!;
  const pareti: THREE.Mesh[] = [];
  const room = new THREE.Group(); room.name = 'stanza'; room.visible = false;
  // pavimento: la texture si ripete una volta per cella
  const tPav = texture(pav); tPav.repeat.set(X1 - X0, Z1 - Z0);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(lw, ld), new THREE.MeshLambertMaterial({ map: tPav }));
  floor.rotation.x = -Math.PI / 2; floor.position.set(X0 * T + lw / 2, 0.02, Z0 * T + ld / 2); floor.receiveShadow = true;
  room.add(floor);
  // corridoio: assi di legno, un po' più in basso del pavimento (un gradino)
  const tAssi = texture(ASSI); tAssi.repeat.set(1, cl / 2);
  const corr = new THREE.Mesh(new THREE.PlaneGeometry(cw, cl), new THREE.MeshLambertMaterial({ map: tAssi }));
  corr.rotation.x = -Math.PI / 2; corr.position.set((CX + 0.5) * T, -0.08, C0 * T + cl / 2); corr.receiveShadow = true;
  room.add(corr);
  // pareti: in fondo e ai lati (davanti aperta), carta da parati una volta per metro
  const parete = (lung: number, x: number, z: number, ry: number) => {
    const t = texture(carta); t.repeat.set(lung, H);
    const m = new THREE.Mesh(new THREE.BoxGeometry(lung, H, SPESSORE), new THREE.MeshLambertMaterial({ map: t }));
    m.position.set(x, H / 2, z); m.rotation.y = ry; m.receiveShadow = true; m.userData['lung'] = lung; room.add(m); pareti.push(m);
  };
  parete(lw + 2 * SPESSORE, X0 * T + lw / 2, Z0 * T - SPESSORE / 2, 0);
  parete(ld, X0 * T - SPESSORE / 2, Z0 * T + ld / 2, Math.PI / 2);
  parete(ld, X1 * T + SPESSORE / 2, Z0 * T + ld / 2, Math.PI / 2);
  // battiscopa, porta sul retro, bordo davanti tagliato (lo spessore del pavimento, come un plastico) e i fianchi bassi del corridoio
  const bx = (ST.retro[0] + 0.5) * T, bz = Z0 * T + 0.05, zf = Z1 * T, xa = CX * T, xb = (CX + 1) * T;
  const parti = [
    painted(new THREE.BoxGeometry(lw, 0.25, 0.12), P.legnoScuro, M(X0 * T + lw / 2, 0.12, Z0 * T + 0.06)),
    painted(new THREE.BoxGeometry(0.12, 0.25, ld), P.legnoScuro, M(X0 * T + 0.06, 0.12, Z0 * T + ld / 2)),
    painted(new THREE.BoxGeometry(0.12, 0.25, ld), P.legnoScuro, M(X1 * T - 0.06, 0.12, Z0 * T + ld / 2)),
    ...porta(bx, 0, bz),
    // bordo del pavimento a sinistra e a destra del corridoio (pietra scura, mezzo metro: si vede il «taglio»)
    painted(new THREE.BoxGeometry(xa - X0 * T + SPESSORE, 0.55, 0.3), P.roccia, M((X0 * T - SPESSORE + xa) / 2, -0.25, zf + 0.15)),
    painted(new THREE.BoxGeometry(X1 * T + SPESSORE - xb, 0.55, 0.3), P.roccia, M((xb + X1 * T + SPESSORE) / 2, -0.25, zf + 0.15)),
    // i fianchi del corridoio: muretti bassi di legno che finiscono nel buio, e la soglia in cima
    ...[xa - 0.1, xb + 0.1].map((x) => painted(new THREE.BoxGeometry(0.2, 0.7, cl), P.legnoScuro, M(x, 0.27, C0 * T + cl / 2))),
    painted(new THREE.BoxGeometry(cw, 0.08, 0.2), P.legnoScuro, M((CX + 0.5) * T, -0.02, C0 * T + 0.1)),
  ];
  const vc = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  room.add(new THREE.Mesh(merged(parti), vc));
  const buio = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), new THREE.MeshBasicMaterial({ color: P.neroCaldo }));
  buio.rotation.x = -Math.PI / 2; buio.position.set(X0 * T + lw / 2, -0.6, Z0 * T + ld / 2); room.add(buio);
  w.scene.add(room);
  // pavimento e carta di chi ci abita (#265: comprati al negozio dei mobili e scelti con ARREDA): si ridipingono quando cambiano
  const finiture = (slot: number) => {
    const s = finitureScelte(o.lotDi?.(slot) ?? null);
    const fp = BORGO.pavimenti.find((f) => f.id === s.pavimento) ?? BORGO.pavimenti[0]!, fc = BORGO.carte.find((f) => f.id === s.carta) ?? BORGO.carte[0]!;
    if (fp !== pav) {
      pav = fp; const mt = floor.material as THREE.MeshLambertMaterial; mt.map?.dispose();
      mt.map = texture(pav); mt.map.repeat.set(X1 - X0, Z1 - Z0); mt.needsUpdate = true;
    }
    if (fc !== carta) {
      carta = fc;
      for (const m of pareti) { const mt = m.material as THREE.MeshLambertMaterial; mt.map?.dispose(); mt.map = texture(carta); mt.map.repeat.set(m.userData['lung'] as number, H); mt.needsUpdate = true; }
    }
  };

  // il passaggio coperto del giardino verso la stanza, in ogni giardino abitato (una mesh sola)
  const gx = ST.giardino[0] * T, gz = (ST.giardino[1] + 0.5) * T; // bocca sul lato ovest della cella `giardino`
  const passaggi = o.slots.flatMap((s) => {
    const l = arch.lots.find((q) => q.slot === s); if (!l) return [];
    const ox = l.origin[0] * T, oz = l.origin[1] * T;
    return passaggio(ox + gx, w.groundY(ox + gx + 1, oz + gz), oz + gz);
  });
  if (passaggi.length) { const m = new THREE.Mesh(merged(passaggi), vc); m.name = 'passaggi_giardino'; m.castShadow = true; m.receiveShadow = true; w.scene.add(m); }

  // ——— camera fissa sopra l'ingresso: tutta la stanza in larghezza; col telefono in verticale ti segue in x tra i muri ———
  const centroZ = Z0 * T + (ld + cl) / 2 - 0.5;
  let distanza = 20, mezzaVista = 99, aspetto = 0;
  const misura = () => {
    const a = dio.camera.aspect, t = Math.tan((VISTA.fov * Math.PI) / 360);
    aspetto = a;
    const alto = (ld + cl) * Math.sin(VISTA.pitch) + H * Math.cos(VISTA.pitch) + 1; // quanto è alta la stanza vista dalla camera (m)
    const dAlto = alto / 2 / t, dLargo = (lw + 2) / 2 / (t * a);
    distanza = Math.min(Math.max(dAlto, dLargo), dAlto * 1.6); // col telefono in verticale non si allontana troppo: ti segue in x
    mezzaVista = distanza * t * a;
    dio.blocca?.({ ...VISTA, dist: distanza });
  };

  let qui: number | null = null;
  const nascosti: THREE.Object3D[] = [];
  const dentroDi = (): number | null => {
    const a = w.avatar.state, p = arch.placeAt(a.x, a.z);
    if (!p || p.role !== 'lotto' || p.slot === null) return null;
    const cx = a.x / T - p.origin[0], cz = a.z / T - p.origin[1];
    return cx >= X0 - 1 && cx < X1 + 1 && cz >= Z0 - 1 && cz < C1 + 0.5 ? p.slot : null;
  };
  const entra = (slot: number) => {
    o.renderer.setInterno(P.neroCaldo);
    const l = arch.lots.find((q) => q.slot === slot)!;
    const ox = l.origin[0] * T, oz = l.origin[1] * T, xMin = ox + X0 * T - 1, xMax = ox + X1 * T + 1;
    w.camFissa = (x) => {
      if (dio.camera.aspect !== aspetto) misura();
      const cx = ox + X0 * T + lw / 2, m = Math.max(0, (xMax - xMin) / 2 - mezzaVista);
      // in verticale lo schermo sotto è dei comandi: la stanza sale un po' (il bersaglio scende verso il corridoio)
      return { x: Math.min(cx + m, Math.max(cx - m, x)), z: oz + centroZ + (aspetto < 0.8 ? 3 : 0) };
    };
    misura();
    const t = w.camFissa(w.avatar.state.x, w.avatar.state.z)!;
    dio.follow(t.x, 0.5, t.z); dio.snap?.();
  };
  const esce = () => { o.renderer.setInterno(null); dio.blocca?.(null); w.camFissa = null; dio.follow(w.avatar.state.x, 0.5, w.avatar.state.z); dio.snap?.(); };
  // dopo il cull di ogni frame (world.ts): dentro la stanza si nasconde il resto di quel giardino, il mare, i leggii, animali e pioggia
  w.dopoCull = () => {
    for (const n of nascosti) n.visible = true;
    nascosti.length = 0;
    const prima = qui;
    qui = dentroDi();
    if (qui !== prima) { if (qui !== null) entra(qui); else esce(); }
    const pl = arch.placeAt(w.avatar.state.x, w.avatar.state.z);
    document.body.classList.toggle('mz-casa', w.mode === 'walk' && pl?.role === 'lotto'); // minimappa via in casa e in giardino
    room.visible = qui !== null;
    if (qui === null) return;
    finiture(qui);
    const l = arch.lots.find((q) => q.slot === qui)!;
    room.position.set(l.origin[0] * T, w.groundY((l.origin[0] + (X0 + X1) / 2) * T, (l.origin[1] + (Z0 + Z1) / 2) * T), l.origin[1] * T);
    const via = (n: THREE.Object3D | undefined | null) => { if (n && n.visible) { n.visible = false; nascosti.push(n); } };
    via(w.scene.getObjectByName('vista_lotto_' + qui)); via(w.water.mesh); via(w.scene.getObjectByName('libri_ospiti')); via(w.scene.getObjectByName('passaggi_giardino'));
    for (const n of ['animali', 'lucciole', 'pioggia', 'acqua_stile', 'luci']) via(w.scene.getObjectByName(n));
    const zMuro = (l.origin[1] + Z0) * T, v = new THREE.Vector3();
    for (const g of w.scene.children) if (g.name.startsWith('lot_')) for (const c of g.children) { c.getWorldPosition(v); if (v.z < zMuro) via(c); }
  };
  registerStateProvider('stanza', () => ({ dentro: qui, pavimento: pav.id, carta: carta.id, camera: qui !== null ? { yaw: dio.yaw, dist: +distanza.toFixed(1) } : null, mini: !document.body.classList.contains('mz-casa') }));
  return { dentro: () => qui };
}
