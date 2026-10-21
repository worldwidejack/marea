// Lo sfondo dello snowboard: le Alpi attorno alla pista, col metodo del dipinto dei Templari. Il corpo della montagna della pista (corpo.ts:
// una griglia normale oltre il nastro di pista3d, giù fino al fondovalle, neve e roccia) e attorno due strati:
// - il modellino: catene di montagne attorno alla pista (rumore a creste: guglie aguzze, neve in alto, roccia sulle pareti ripide, boschi
//   in basso) e il fondovalle innevato, a facce piatte. È la guida del dipinto e quello che si vede finché il dipinto non è arrivato;
// - il dipinto: un panorama a 360° (assets/adrenalina/panorama.webp) su un cilindro che segue la camera, all'infinito come il cielo. Si fa
//   con `foto`: il modellino visto da 6 lati dal centro della pista → Codex ridipinge ogni foto → si cuciono in una striscia cilindrica.
import * as THREE from 'three';
import type { PistaNeve } from '@marea/sim/adrenalina/pista.ts';
import { quotaA } from '@marea/sim/adrenalina/pista.ts';
import { PAL } from '../ui/style.ts';
import { corpoMontagna, liscio } from './corpo.ts';

export type Sfondo = {
  gruppo: THREE.Group;
  /** Il cilindro dipinto segue la camera (all'infinito: non si avvicina mai). */
  segui(camera: THREE.Vector3): void;
  /** Il modellino dal centro della pista verso `k` × 60° (k = 0-5): per il dipinto. */
  foto(gl: THREE.WebGLRenderer, k: number): string;
  /** Carica il panorama dipinto (sul telefono quello piccolo): da lì in poi si vede lui al posto del modellino, e lo sfondo della scena
   *  diventa il colore del suo cielo. */
  dipinto(scena: THREE.Scene, telefono: boolean): Promise<boolean>;
  dispose(): void;
};

/** Le foto per il dipinto: 6 lati da 60°, larghe 75° (15° di sovrapposizione per cucirle), 3:2, mezza altezza ALTO in tan(elevazione).
 *  La striscia cucita copre ±STRISCIA: la parte coperta anche a metà fra due foto (a 30° dai loro centri). */
const FOTO = { lati: 6, largo: 75, w: 1536, h: 1024 } as const;
const ALTO = Math.tan((FOTO.largo / 2) * (Math.PI / 180)) / (FOTO.w / FOTO.h), STRISCIA = ALTO * Math.cos(Math.PI / FOTO.lati);
/** Il cielo in cima al panorama (lo stampa cuci_neve.mjs): sopra la striscia la scena ha questo colore piatto. */
const CIELO = '#5497d4';
/** Raggio del cilindro dipinto (dentro camera.far = 16000). */
const RAGGIO = 5200;

/** Montagne: rumore «a creste» (1 − |2n − 1|) a più ottave, come le catene vere: creste aguzze, valli larghe. 0-1. */
function creste(x: number, z: number): number {
  let v = 0, a = 1, tot = 0, f = 1 / 2600, peso = 1;
  for (let o = 0; o < 5; o++) {
    const r = 1 - Math.abs(2 * liscio(x * f, z * f, o) - 1), q = r * r * peso;
    v += a * q; tot += a; peso = Math.min(1, q * 1.6); a *= 0.5; f *= 2.1;
  }
  return v / tot;
}

export function creaSfondo(p: PistaNeve): Sfondo {
  const gruppo = new THREE.Group(); gruppo.name = 'snowboard_sfondo';
  // il centro della pista, il fondovalle (come pista3d: 260 m sotto l'arrivo) e la direzione in cui si scende (lì la valle si apre)
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (let i = 0; i < p.n.n; i++) { const x = p.n.x[i]!, z = p.n.z[i]!; x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
  const montagna = corpoMontagna(p), cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, valle = montagna.valle;
  const giu = Math.atan2(p.n.z[p.n.n - 1]! - p.n.z[0]!, p.n.x[p.n.n - 1]! - p.n.x[0]!);
  const occhioY = quotaA(p, p.n.len * 0.5, 0) + 30;

  // ---- il modellino: una griglia polare dal fondovalle alle catene lontane ----
  // anelli fitti vicino, radi lontano (le facce restano più o meno quadrate)
  const NA = 420, RS: number[] = [300, 900];
  for (let r = 1500; r < 15000; r *= 1.075) RS.push(Math.round(r));
  const quota = (t: number, r: number): number => {
    const x = cx + Math.cos(t) * r, z = cz + Math.sin(t) * r;
    if (r < 1500) return valle - 12; // vicino alla pista: il fondovalle, sotto il corpo della montagna
    // verso valle le montagne vicine si abbassano (lo sguardo va lontano), lontano si chiude tutto sull'orizzonte
    const d = Math.max(0, Math.cos(t - giu)), apre = 1 - 0.6 * d * d * Math.max(0, 1 - (r - 2500) / 6000);
    const su = Math.min(1, (r - 1500) / 1800), giuLontano = Math.max(0, Math.min(1, (14500 - r) / 2500));
    return valle + su * su * (3 - 2 * su) * giuLontano * apre * (200 + 3000 * creste(x, z) * Math.min(1, 0.55 + r / 9000));
  };
  const vs: THREE.Vector3[][] = [];
  for (let j = 0; j < RS.length; j++) {
    const fila: THREE.Vector3[] = [];
    for (let i = 0; i < NA; i++) { const t = (i / NA) * Math.PI * 2, r = RS[j]!; fila.push(new THREE.Vector3(cx + Math.cos(t) * r, quota(t, r), cz + Math.sin(t) * r)); }
    vs.push(fila);
  }
  const pos: number[] = [], col: number[] = [], c = new THREE.Color(), n = new THREE.Vector3(), u = new THREE.Vector3(), w = new THREE.Vector3();
  const COL = { neve: PAL.pietraChiara, neveOmbra: PAL.sabbiaChiara, roccia: PAL.pietraScura, rocciaScura: PAL.roccia, bosco: PAL.bosco, boscoScuro: PAL.erbaScura };
  const tri = (a: THREE.Vector3, b: THREE.Vector3, d: THREE.Vector3) => {
    u.subVectors(b, a); w.subVectors(d, a); n.crossVectors(u, w).normalize();
    // a macchie compatte (boschi, nevai, pareti), non faccia per faccia: è la guida del dipinto
    const hv = (a.y + b.y + d.y) / 3 - valle, mx = (a.x + d.x) / 2, mz = (a.z + d.z) / 2, m = liscio(mx / 450, mz / 450, 9), ripido = n.y < 0.6;
    const bosco = hv < 520 + m * 200 && m > 0.46, neveDa = 900 + liscio(mx / 900, mz / 900, 4) * 500;
    c.set(ripido ? (hv > neveDa && n.y > 0.42 ? COL.neveOmbra : liscio(mx / 300, mz / 300, 3) < 0.5 ? COL.roccia : COL.rocciaScura)
      : bosco ? (m > 0.62 ? COL.boscoScuro : COL.bosco) : COL.neve);
    pos.push(a.x, a.y, a.z, b.x, b.y, b.z, d.x, d.y, d.z);
    for (let q = 0; q < 3; q++) col.push(c.r, c.g, c.b);
  };
  for (let j = 0; j + 1 < RS.length; j++) for (let i = 0; i < NA; i++) {
    const a = vs[j]![i]!, b = vs[j]![(i + 1) % NA]!, d = vs[j + 1]![i]!, e = vs[j + 1]![(i + 1) % NA]!;
    tri(a, e, d); tri(a, b, e); // la faccia guarda in su
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  const matM = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  const modellino = new THREE.Mesh(g, matM); modellino.name = 'snowboard_modellino';
  gruppo.add(modellino);

  // ---- il corpo della montagna (corpo.ts) su una griglia normale: tutto neve (i boschi sono gli abeti 3D e il dipinto), roccia sulle facce
  // ripide ----
  const corpo = (() => {
    const PASSO = 30, MARGINE = 1300, nx = Math.ceil((x1 - x0 + 2 * MARGINE) / PASSO), nz = Math.ceil((z1 - z0 + 2 * MARGINE) / PASSO);
    const Y: number[] = [];
    for (let iz = 0; iz <= nz; iz++) for (let ix = 0; ix <= nx; ix++) Y.push(montagna.quota(x0 - MARGINE + ix * PASSO, z0 - MARGINE + iz * PASSO));
    const P: number[] = [], C: number[] = [], at = (ix: number, iz: number) => new THREE.Vector3(x0 - MARGINE + ix * PASSO, Y[iz * (nx + 1) + ix]!, z0 - MARGINE + iz * PASSO);
    const t3 = (a: THREE.Vector3, b: THREE.Vector3, d: THREE.Vector3) => {
      u.subVectors(b, a); w.subVectors(d, a); n.crossVectors(u, w).normalize();
      const mx = (a.x + d.x) / 2, mz = (a.z + d.z) / 2;
      c.set(n.y < 0.6 ? (liscio(mx / 200, mz / 200, 3) < 0.5 ? COL.roccia : COL.rocciaScura) : COL.neve);
      P.push(a.x, a.y, a.z, b.x, b.y, b.z, d.x, d.y, d.z);
      for (let q = 0; q < 3; q++) C.push(c.r, c.g, c.b);
    };
    for (let iz = 0; iz < nz; iz++) for (let ix = 0; ix < nx; ix++) {
      const a = at(ix, iz), b = at(ix + 1, iz), d = at(ix, iz + 1), e = at(ix + 1, iz + 1);
      t3(a, d, b); t3(b, d, e);
    }
    const cg = new THREE.BufferGeometry();
    cg.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); cg.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
    cg.computeVertexNormals();
    const m = new THREE.Mesh(cg, matM); m.name = 'snowboard_corpo'; m.receiveShadow = true;
    return m;
  })();
  gruppo.add(corpo);

  // ---- il dipinto: una striscia cilindrica attorno alla camera (u = angolo, v = tan dell'elevazione) ----
  let cilindro: THREE.Mesh | null = null, tex: THREE.Texture | null = null;
  const creaCilindro = (t: THREE.Texture) => {
    const N = 96, P: number[] = [], UV: number[] = [], I: number[] = [];
    // tre file di vertici: sotto la striscia (si allunga il fondo verso il basso), la striscia, sopra (sfuma nel cielo)
    const righe = [[-3, 0], [-STRISCIA, 0], [STRISCIA, 1]] as const;
    for (let i = 0; i <= N; i++) {
      const t = (i / N) * Math.PI * 2;
      for (const [y, v] of righe) { P.push(Math.cos(t) * RAGGIO, y * RAGGIO, Math.sin(t) * RAGGIO); UV.push(i / N, v); }
    }
    for (let i = 0; i < N; i++) for (let r = 0; r < righe.length - 1; r++) {
      const a = i * righe.length + r, b = a + righe.length;
      I.push(a, a + 1, b, b, a + 1, b + 1);
    }
    const cg = new THREE.BufferGeometry();
    cg.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); cg.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2)); cg.setIndex(I);
    const m = new THREE.Mesh(cg, new THREE.MeshBasicMaterial({ map: t, side: THREE.DoubleSide, depthWrite: false, fog: false }));
    m.name = 'snowboard_panorama'; m.renderOrder = -10; m.frustumCulled = false;
    return m;
  };

  return {
    gruppo,
    segui(cam) { cilindro?.position.copy(cam); },
    foto(gl, k) {
      const scena = new THREE.Scene(); scena.background = new THREE.Color(PAL.acquaBassa);
      scena.add(new THREE.HemisphereLight(0xdff4ff, 0xc8d4e0, 2.2));
      const sole = new THREE.DirectionalLight(0xfff6e8, 2.4); sole.position.set(cx + 3000, valle + 4000, cz - 2000); sole.target.position.set(cx, valle, cz);
      scena.add(sole, sole.target);
      const prima = modellino.parent; scena.add(modellino);
      const cam = new THREE.PerspectiveCamera(2 * Math.atan(ALTO) * (180 / Math.PI), FOTO.w / FOTO.h, 10, 20000);
      const t = (k * Math.PI * 2) / FOTO.lati;
      cam.position.set(cx, occhioY, cz); cam.lookAt(cx + Math.cos(t) * 100, occhioY, cz + Math.sin(t) * 100);
      const dim = gl.getSize(new THREE.Vector2()), pr = gl.getPixelRatio();
      gl.setPixelRatio(1); gl.setSize(FOTO.w, FOTO.h, false);
      gl.render(scena, cam);
      const url = gl.domElement.toDataURL('image/png');
      gl.setSize(dim.x, dim.y, false); gl.setPixelRatio(pr);
      prima?.add(modellino);
      return url;
    },
    async dipinto(scena, telefono) {
      try {
        const t = await new THREE.TextureLoader().loadAsync(`/assets/adrenalina/panorama${telefono ? '_m' : ''}.webp`);
        t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; t.anisotropy = 4;
        tex = t; cilindro = creaCilindro(t); gruppo.add(cilindro); modellino.visible = false;
        scena.background = new THREE.Color(CIELO);
        return true;
      } catch (e) { console.warn('[marea] panorama dello snowboard non caricato', e); return false; }
    },
    dispose() { g.dispose(); corpo.geometry.dispose(); matM.dispose(); if (cilindro) { cilindro.geometry.dispose(); (cilindro.material as THREE.Material).dispose(); } tex?.dispose(); },
  };
}
