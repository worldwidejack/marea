// Gli oggetti alla Mario Kart in pista (#250): scatole che girano, bucce a terra, colpi in volo, il salvagente-scudo intorno a chi ce l'ha,
// la casella dell'oggetto in alto (con la roulette) e il bottone USA (telefono) / tasti Q e R (PC). Lo usano il gioco (vista_gara.ts + index.ts)
// e il banco di prova (prova/main.ts). Disegna e basta: lo stato è della sim (GaraState.oggetti).
import * as THREE from 'three';
import { CORSE } from '@marea/content/corse.ts';
import type { GaraState } from '@marea/sim/corse/gara.ts';
import { punto, terna, nuovaTerna } from '@marea/sim/corse/nastro.ts';
import { VOLO_TRAPPOLA, oggettoDef, sDiProg } from '@marea/sim/corse/oggetti.ts';
import type { OggettiState } from '@marea/sim/corse/oggetti.ts';
import { nastroDi } from '@marea/sim/corse/pista.ts';
import type { Pista } from '@marea/sim/corse/pista.ts';
import { M as Mt, P, merged, painted } from '../render/island_parts.ts';
import type { SuoniGuida } from './suoni.ts';
import { BLOCCO_CIMA, BLOCCO_FIANCO, BUCCIA, CASSA_CIMA, CASSA_FIANCO, COCCO, LATTINA, LIANA, MASSO, PALLA, RAZZO, SALVAGENTE, TRIS, iconaPixel, texturePixel } from './sprite_oggetti.ts';

const MAX = { scatole: 24, trappole: 12, colpi: 16, scudi: 8 };
const NOMI = Object.fromEntries(CORSE.oggetti.catalogo.map((o) => [o.id, o.nome.toUpperCase()]));
const COLORE: Record<string, string> = { turbo: P.arancio, trappola: P.giallo, dritto: P.rosso, ricerca: P.violaNeon, scudo: P.cianoNeon };
const MAX_LIANE = 8;
/** Le icone in pixel art (dalla concept) per la casella e il bottone USA, fatte la prima volta che servono. */
const SPRITE: Record<string, readonly string[]> = { turbo: LATTINA, tris: TRIS, buccia: BUCCIA, palla: PALLA, razzo: RAZZO, scudo: SALVAGENTE, cocco: COCCO, masso: MASSO, liana: LIANA };
const ICONE: Record<string, string> = {};
/** La scatola di ogni zona: [fianchi, cima] in pixel art. Le zone senza la loro usano la cassa del relitto della Spiaggia. */
const SCATOLE: Record<string, readonly [readonly string[], readonly string[]]> = { spiaggia: [CASSA_FIANCO, CASSA_CIMA], giungla: [BLOCCO_FIANCO, BLOCCO_CIMA] };
const TEX_SCATOLE: Record<string, THREE.Texture> = {};
/** Le due facce affiancate in una texture sola (fianchi a sinistra, cima a destra): un materiale, una draw call. */
function texScatola(zona: string): THREE.Texture {
  const [f, c] = SCATOLE[zona] ?? SCATOLE['spiaggia']!;
  return (TEX_SCATOLE[zona in SCATOLE ? zona : 'spiaggia'] ??= texturePixel(f.map((r, i) => r + c[i]!)));
}
/** Il cubo della scatola con le uv sull'atlante di texScatola: i 4 fianchi sulla metà sinistra, sopra e sotto sulla destra. */
function geoScatola(): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(1.4, 1.4, 1.4), uv = g.attributes.uv!;
  for (let i = 0; i < uv.count; i++) { const faccia = Math.floor(i / 4); uv.setX(i, uv.getX(i) * 0.5 + (faccia === 2 || faccia === 3 ? 0.5 : 0)); }
  return g;
}
const icona = (id: string): string => (ICONE[id] ??= SPRITE[id] ? iconaPixel(SPRITE[id]!) : '');
const img = (id: string, alto: number): string => { const u = icona(id); return u ? `<img src="${u}" alt="" style="height:${alto}px">` : ''; };

const CSS = `.pp-ogg { position: absolute; top: calc(max(8px, env(safe-area-inset-top)) + 44px); left: 50%; transform: translateX(-50%); pointer-events: none; z-index: 3;
  font: bold 15px ui-monospace, Menlo, monospace; color: ${P.sabbiaChiara}; padding: 4px 10px; background: rgba(46,30,20,.88); border: 3px solid ${P.legnoChiaro}; white-space: nowrap; display: none; }
.pp-ogg small { font-size: 11px; color: ${P.sabbia}; margin-left: 6px; }
.pp-ogg img, .pp-usa img { image-rendering: pixelated; display: block; }
.pp-ogg img { display: inline-block; vertical-align: middle; margin: -6px 8px -6px -2px; }
.pp-ogg .ic { font-style: normal; } .pp-ogg .tag, .pp-ogg .n { display: none; }
.pp-usa { flex-direction: column; gap: 2px; }
.pp-ogg.gira { color: ${P.sabbia}; }
.pp-usa { position: absolute; right: calc(max(16px, env(safe-area-inset-right, 0px)) + 118px); bottom: calc(env(safe-area-inset-bottom, 0px) + 112px); width: 72px; height: 72px; border-radius: 50%;
  display: none; align-items: center; justify-content: center; text-align: center; background: rgba(46,30,20,.7); border: 3px solid rgba(244,227,193,.7); color: ${P.sabbiaChiara};
  font: bold 10px ui-monospace, Menlo, monospace; line-height: 1.1; z-index: 14; touch-action: none; -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; -webkit-tap-highlight-color: transparent; }
.pp-usa.pronto { background: rgba(232,67,63,.85); }
.pp-usa.giu { transform: scale(.92); filter: brightness(1.25); }`;

/** Da che parte va di serie l'oggetto: la trappola dietro, i colpi avanti (turbo e scudo non hanno parte). */
const dietroDiSerie = (ogg: string): boolean => !!ogg && (oggettoDef(ogg).effetto === 'trappola' || !!oggettoDef(ogg).indietro);

/** Il bottone USA (solo col dito) e i tasti: Q = USA di serie, R = USA dall'altra parte (#250, Jack: «uno non deve per forza frenare per
 *  sparare»). `giu()` = premuto adesso (la sim lo usa allo scatto); `contrario(ogg, sy)` = va lanciato al contrario di serie: R, oppure col
 *  dito lo stick tenuto verso l'altra parte (`sy` = stick a schermo, > 0 giù; col dito lo stick sterza e basta, la Y è libera). */
export function creaUsa(root: HTMLElement): { giu(): boolean; contrario(ogg: string, sy?: number, sx?: number): boolean; mostra(on: boolean): void; etichetta(t: string, pronto: boolean, ogg?: string): void; readonly el: HTMLElement } {
  stile();
  const dito = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  const b = document.createElement('button'); b.type = 'button'; b.className = 'pp-usa'; b.id = 'ppUsa'; b.textContent = 'USA';
  const dita = new Set<number>();
  let tasto = false, retro = false;
  b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); dita.add(e.pointerId); try { b.setPointerCapture(e.pointerId); } catch { /* sintetico */ } b.classList.add('giu'); });
  const su = (e: PointerEvent) => { if (dita.delete(e.pointerId) && !dita.size) b.classList.remove('giu'); };
  for (const ev of ['pointerup', 'pointercancel']) { b.addEventListener(ev, su as EventListener); addEventListener(ev, su as EventListener); }
  for (const ev of ['touchstart', 'touchmove', 'contextmenu']) b.addEventListener(ev, (e) => { e.preventDefault(); e.stopPropagation(); }, { passive: false });
  addEventListener('keydown', (e) => { if (e.code === 'KeyQ') tasto = true; else if (e.code === 'KeyR') retro = true; });
  addEventListener('keyup', (e) => { if (e.code === 'KeyQ') tasto = false; else if (e.code === 'KeyR') retro = false; });
  addEventListener('blur', () => { tasto = retro = false; dita.clear(); });
  root.appendChild(b);
  let testo = '';
  return {
    el: b,
    giu: () => tasto || retro || dita.size > 0,
    contrario(ogg, sy = 0, sx = 0) {
      if (retro) return true;
      if (!dito || !dita.size || Math.abs(sy) < 0.6 || Math.abs(sy) < Math.abs(sx)) return false; // stick per lo più su o giù
      return sy > 0 !== dietroDiSerie(ogg);
    },
    mostra(on) { b.style.display = on && dito ? 'flex' : 'none'; if (!on) { dita.clear(); tasto = retro = false; b.classList.remove('giu'); } },
    etichetta(t, pronto, ogg = '') {
      const k = `${t}|${ogg}`;
      if (k !== testo) { const i = ogg && img(ogg, 34); if (i) b.innerHTML = `${i}<span>${t}</span>`; else b.textContent = t || 'USA'; testo = k; }
      b.classList.toggle('pronto', pronto);
    },
  };
}

function stile() {
  if (document.getElementById('pp-ogg-style')) return;
  const st = document.createElement('style'); st.id = 'pp-ogg-style'; st.textContent = CSS; document.head.appendChild(st);
}

function istanze(geo: THREE.BufferGeometry, colore: string, n: number, nome: string): THREE.InstancedMesh {
  const m = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ color: colore, flatShading: true }), n);
  m.name = nome; m.count = 0; m.frustumCulled = false; m.castShadow = true;
  return m;
}

export type Oggetti3d = {
  readonly gruppo: THREE.Group;
  /** Un frame: scatole, trappole, colpi, scudi, casella in alto, suoni. Ritorna lo stato del tuo oggetto per il bottone USA. */
  aggiorna(s: GaraState, p: Pista, dt: number, suoni: SuoniGuida | null, camera?: THREE.Camera): { etichetta: string; pronto: boolean; ogg: string };
  /** Mostra o nasconde la casella in alto. */
  interfaccia(on: boolean): void;
  chiudi(): void;
};

export function creaOggetti3d(root: HTMLElement): Oggetti3d {
  stile();
  const gruppo = new THREE.Group(); gruppo.name = 'corse_oggetti';
  // le scatole si devono vedere anche controluce: la texture fa anche da luce propria (a metà), il lato in ombra resta più scuro
  const matScatole = new THREE.MeshLambertMaterial({ map: texScatola('spiaggia'), emissiveMap: texScatola('spiaggia'), emissive: 0xffffff, emissiveIntensity: 0.55 });
  const scatole = new THREE.InstancedMesh(geoScatola(), matScatole, MAX.scatole);
  scatole.name = 'corse_scatole'; scatole.count = 0; scatole.frustumCulled = false; scatole.castShadow = true;
  let zona = 'spiaggia';
  // la buccia è uno sprite in pixel art (dalla concept) che guarda sempre la camera, girando solo intorno alla verticale
  const altoB = 1.15, largoB = (altoB * BUCCIA[0]!.length) / BUCCIA.length;
  const bucce = new THREE.InstancedMesh(new THREE.PlaneGeometry(largoB, altoB).translate(0, altoB / 2, 0), new THREE.MeshBasicMaterial({ map: texturePixel(BUCCIA), alphaTest: 0.5, side: THREE.DoubleSide }), MAX.trappole);
  bucce.name = 'corse_bucce'; bucce.count = 0; bucce.frustumCulled = false;
  // i colpi dritti (pallonata, noce di cocco, masso del tempio): sprite dalla concept che guardano la camera e girano su sé stessi (rotolano)
  const sprite = (righe: readonly string[], alto: number, nome: string, n: number) => {
    const m = new THREE.InstancedMesh(new THREE.PlaneGeometry((alto * righe[0]!.length) / righe.length, alto), new THREE.MeshBasicMaterial({ map: texturePixel(righe), alphaTest: 0.5, side: THREE.DoubleSide }), n);
    m.name = nome; m.count = 0; m.frustumCulled = false;
    return m;
  };
  const rotola: Record<string, { m: THREE.InstancedMesh; d: number; n: number }> = {
    palla: { m: sprite(PALLA, 1.4, 'corse_palle', MAX.colpi), d: 1.4, n: 0 },
    cocco: { m: sprite(COCCO, 1.1, 'corse_cocchi', MAX.colpi), d: 1.1, n: 0 },
    masso: { m: sprite(MASSO, 3.2, 'corse_massi', MAX.colpi), d: 3.2, n: 0 },
  };
  // la liana: sopra chi la usa, finché scavalca
  const liane = sprite(LIANA, 2.2, 'corse_liane', MAX_LIANE);
  // razzo a ricerca e salvagente: in 3D a strisce come la concept (si vedono da dietro e dall'alto, uno sprite di lato no)
  const razzi = istanze(geoRazzo(), '#ffffff', MAX.colpi, 'corse_razzi');
  const scudi = istanze(geoSalvagente(), '#ffffff', MAX.scudi, 'corse_scudi');
  for (const m of [razzi, scudi]) (m.material as THREE.MeshLambertMaterial).vertexColors = true;
  const tutte = [scatole, bucce, ...Object.values(rotola).map((r) => r.m), razzi, scudi, liane];
  for (const m of tutte) gruppo.add(m);
  const casella = document.createElement('div'); casella.className = 'pp-ogg'; root.appendChild(casella);
  const T = nuovaTerna(), M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(1, 1, 1), V = new THREE.Vector3(), X = new THREE.Vector3(), Y = new THREE.Vector3(), Z = new THREE.Vector3();
  const P3: [number, number, number] = [0, 0, 0], Q2 = new THREE.Quaternion(), CAM = new THREE.Vector3(), SU = new THREE.Vector3(0, 1, 0);
  const dito = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  let t = 0, prima: { ogg: string; roulette: number; presi: number; scudo: number; usati: number } | null = null, mostra = true, ultimo = '';

  /** Matrice di un oggetto sulla principale: a `prog`, `lat`, alto `h`, girato di `giro` rad intorno al «sopra» della pista. */
  function posa(p: Pista, prog: number, lat: number, h: number, giro: number, scala = 1): THREE.Matrix4 {
    const s = sDiProg(p, prog);
    punto(p.n, s, lat, h, P3); terna(p.n, s, T);
    Y.set(T.ux, T.uy, T.uz).normalize(); Z.set(T.tx, T.ty, T.tz).normalize(); X.crossVectors(Y, Z).normalize();
    M.makeBasis(X, Y, Z);
    Q.setFromRotationMatrix(M).multiply(Q2.setFromAxisAngle(V.set(0, 1, 0), giro));
    return M.compose(V.set(P3[0], P3[1], P3[2]), Q, S.setScalar(scala));
  }
  /** La casella: icona, nome (nel look kart si vede solo l'icona grande), cariche, targhetta (USA col dito, Q da tastiera) e il suggerimento. */
  function casellaHtml(o: OggettiState) {
    const tu = o.tasche[0]!;
    if (!mostra) { casella.style.display = 'none'; return; }
    casella.style.display = 'block';
    const kart = document.body.classList.contains('mz-kh'), tag = `<b class="tag">${dito ? 'USA' : 'Q'}</b>`;
    let html: string;
    if (!tu.ogg && tu.scudo <= 0) { // tasca vuota: nel look kart la casella resta (vuota), come in Mario Kart; prima spariva
      if (!kart) { casella.style.display = 'none'; return; }
      html = '<i class="ic"></i>'; casella.className = 'pp-ogg vuota';
    } else if (tu.roulette > 0) { // la roulette: nomi a giro, sempre più lenti
      const ids = o.pesca, i = Math.floor(t * (6 + tu.roulette * 10)) % ids.length;
      html = `<i class="ic">${img(ids[i]!, 26)}</i><span class="nm">${NOMI[ids[i]!]!}</span>${kart ? tag : ''}`; casella.className = 'pp-ogg gira'; casella.style.borderColor = P.legnoChiaro;
    } else if (tu.ogg) {
      const d = oggettoDef(tu.ogg);
      const parti = d.effetto === 'turbo' || d.effetto === 'scudo' ? '' : dietroDiSerie(tu.ogg) ? (dito ? 'stick ↑ avanti' : 'Q dietro · R avanti') : dito ? 'stick ↓ indietro' : 'Q avanti · R indietro';
      html = `<i class="ic">${img(tu.ogg, 26)}</i><span class="nm">${NOMI[tu.ogg]}${tu.cariche > 1 ? ` ×${tu.cariche}` : ''}</span>${kart && tu.cariche > 1 ? `<b class="n">×${tu.cariche}</b>` : ''}${kart ? tag : ''}${parti || (!dito && !kart) ? `<small>${parti || 'Q'}</small>` : ''}`;
      casella.className = 'pp-ogg'; casella.style.borderColor = COLORE[d.effetto]!;
    } else { html = `<i class="ic">${img('scudo', 26)}</i><span class="nm">SALVAGENTE </span>${kart ? `<b class="n">${Math.ceil(tu.scudo)}</b>` : `<small>${Math.ceil(tu.scudo)} s</small>`}`; casella.className = 'pp-ogg'; casella.style.borderColor = COLORE.scudo!; }
    if (html !== ultimo) { casella.innerHTML = html; ultimo = html; }
  }

  return {
    gruppo,
    aggiorna(s, p, dt, suoni, camera) {
      const o = s.oggetti;
      gruppo.visible = !!o;
      if (!o) { casella.style.display = 'none'; prima = null; return { etichetta: '', pronto: false, ogg: '' }; }
      t += dt;
      if (p.def.zona !== zona) { zona = p.def.zona; matScatole.map = matScatole.emissiveMap = texScatola(zona); matScatole.needsUpdate = true; }
      let n = 0;
      for (const b of o.scatole) {
        if (b.t > 0 || n >= MAX.scatole) continue;
        const h = 0.9 + 0.15 * Math.sin(t * 3 + b.prog);
        scatole.setMatrixAt(n++, posa(p, b.prog, b.lat, h, t * 1.6 + b.lat));
      }
      scatole.count = n; scatole.instanceMatrix.needsUpdate = true;
      n = 0;
      if (camera) camera.getWorldPosition(CAM);
      for (const tr of o.trappole) {
        if (n >= MAX.trappole) break;
        // lanciata avanti vola in arco dal veicolo al punto dove atterra
        const u = tr.t < 0 ? 1 + tr.t / VOLO_TRAPPOLA : 1, pr = tr.p0 + (tr.prog - tr.p0) * u, h = 4 * u * (1 - u) * 3.5;
        punto(p.n, sDiProg(p, pr), tr.lat, h, P3);
        Q.setFromAxisAngle(SU, camera ? Math.atan2(CAM.x - P3[0], CAM.z - P3[2]) : 0);
        bucce.setMatrixAt(n++, M.compose(V.set(P3[0], P3[1], P3[2]), Q, S.setScalar(1)));
      }
      bucce.count = n; bucce.instanceMatrix.needsUpdate = true;
      let nr = 0;
      for (const r of Object.values(rotola)) r.n = 0;
      for (const c of o.colpi) {
        const e = oggettoDef(c.ogg).effetto, r = rotola[c.ogg] ?? rotola['palla']!;
        if (e === 'ricerca') { if (nr < MAX.colpi) razzi.setMatrixAt(nr++, posa(p, c.prog, c.lat, 0.8, c.v < 0 ? Math.PI : 0)); continue; }
        if (r.n >= MAX.colpi) continue;
        punto(p.n, sDiProg(p, c.prog), c.lat, r.d / 2 + 0.05 + (c.ogg === 'masso' ? 0 : 0.3 * Math.abs(Math.sin(c.t * 9))), P3);
        Q.setFromAxisAngle(SU, camera ? Math.atan2(CAM.x - P3[0], CAM.z - P3[2]) : 0).multiply(Q2.setFromAxisAngle(V.set(0, 0, 1), (-c.t * 14 * Math.sign(c.v || 1)) / r.d));
        r.m.setMatrixAt(r.n++, M.compose(V.set(P3[0], P3[1], P3[2]), Q, S.setScalar(1)));
      }
      for (const r of Object.values(rotola)) { r.m.count = r.n; r.m.instanceMatrix.needsUpdate = true; }
      razzi.count = nr; razzi.instanceMatrix.needsUpdate = true;
      // gli scudi: intorno al veicolo (anche su un ramo), un po' sollevati
      n = 0;
      for (let i = 0; i < o.tasche.length && n < MAX.scudi; i++) {
        const k = s.veicoli[i]!;
        if (o.tasche[i]!.scudo <= 0 || k.caduto) continue;
        const nn = nastroDi(p, k.ramo);
        punto(nn, k.s, k.lat, k.h + 0.7, P3); terna(nn, k.s, T);
        Y.set(T.ux, T.uy, T.uz).normalize(); Z.set(T.tx, T.ty, T.tz).normalize(); X.crossVectors(Y, Z).normalize();
        M.makeBasis(X, Y, Z); Q.setFromRotationMatrix(M).multiply(Q2.setFromAxisAngle(V.set(0, 1, 0), t * 2));
        scudi.setMatrixAt(n++, M.compose(V.set(P3[0], P3[1], P3[2]), Q, S.setScalar(1 + 0.05 * Math.sin(t * 8))));
      }
      scudi.count = n; scudi.instanceMatrix.needsUpdate = true;
      // la liana: sopra il veicolo che la usa, oscilla
      n = 0;
      for (let i = 0; i < o.tasche.length && n < MAX_LIANE; i++) {
        const k = s.veicoli[i]!;
        if (o.tasche[i]!.scavalca <= 0 || k.caduto) continue;
        const nn = nastroDi(p, k.ramo);
        punto(nn, k.s, k.lat, k.h + 2.4, P3);
        Q.setFromAxisAngle(SU, camera ? Math.atan2(CAM.x - P3[0], CAM.z - P3[2]) : 0).multiply(Q2.setFromAxisAngle(V.set(0, 0, 1), 0.35 * Math.sin(t * 9)));
        liane.setMatrixAt(n++, M.compose(V.set(P3[0], P3[1], P3[2]), Q, S.setScalar(1)));
      }
      liane.count = n; liane.instanceMatrix.needsUpdate = true;
      casellaHtml(o);
      // suoni del tuo oggetto
      const tu = o.tasche[0]!, ora = { ogg: tu.ogg, roulette: tu.roulette, presi: o.presi[0]!, scudo: tu.scudo, usati: o.usati[0]! };
      if (prima && suoni) {
        if (ora.roulette > prima.roulette) suoni.scatola();
        if (prima.roulette > 0 && ora.roulette === 0 && ora.ogg) suoni.pronto();
        if (ora.usati > prima.usati) suoni.lancia();
        if (ora.presi > prima.presi) suoni.colpito();
        else if (prima.scudo > 0 && ora.scudo === 0 && ora.usati === prima.usati && prima.scudo > dt * 2) suoni.parato();
      }
      prima = ora;
      const pronto = !!tu.ogg && tu.roulette === 0;
      return { etichetta: tu.roulette > 0 ? '…' : tu.ogg ? `${NOMI[tu.ogg]!.split(/[ -]/)[0]}${tu.cariche > 1 ? ` ×${tu.cariche}` : ''}` : '', pronto, ogg: tu.roulette > 0 ? '' : tu.ogg };
    },
    interfaccia(on) { mostra = on; if (!on) casella.style.display = 'none'; },
    chiudi() { for (const m of tutte) m.count = 0; casella.style.display = 'none'; prima = null; },
  };
}

/** Quanto è girato (rad) un veicolo colpito: due giri pieni nel tempo del colpo. */
export function giroColpito(s: GaraState, i: number): number {
  const c = s.oggetti?.tasche[i]?.colpito ?? 0;
  return c > 0 ? (1 - c / CORSE.oggetti.colpito.secondi) * Math.PI * 4 : 0;
}

/** Il razzo a ricerca (concept: corpo a fasce rosse e bianche, anello nero, occhio sul muso, alette, fiamma): punta verso +Z. */
function geoRazzo(): THREE.BufferGeometry {
  const r = 0.27, fascia = (z0: number, z1: number, c: string) => painted(new THREE.CylinderGeometry(r, r, z1 - z0, 6).rotateX(Math.PI / 2), c, Mt(0, 0, (z0 + z1) / 2));
  const parti = [
    fascia(-0.62, -0.38, P.rosso), fascia(-0.38, -0.2, P.pietraChiara), fascia(-0.2, -0.1, P.neroCaldo), fascia(-0.1, 0.1, P.pietraChiara), fascia(0.1, 0.42, P.rosso),
    painted(new THREE.ConeGeometry(r, 0.42, 6).rotateX(Math.PI / 2), P.rosso, Mt(0, 0, 0.63)),
    painted(new THREE.ConeGeometry(0.2, 0.55, 6).rotateX(-Math.PI / 2), P.arancio, Mt(0, 0, -0.9)),
    painted(new THREE.ConeGeometry(0.11, 0.3, 6).rotateX(-Math.PI / 2), P.giallo, Mt(0, 0, -0.8)),
  ];
  for (const sx of [-1, 1]) { // l'occhio, su tutti e due i fianchi del muso
    parti.push(painted(new THREE.BoxGeometry(0.06, 0.26, 0.26), P.neroCaldo, Mt(sx * 0.27, 0.03, 0.3)));
    parti.push(painted(new THREE.BoxGeometry(0.06, 0.18, 0.18), P.pietraChiara, Mt(sx * 0.29, 0.03, 0.3)));
    parti.push(painted(new THREE.BoxGeometry(0.06, 0.08, 0.08), P.neroCaldo, Mt(sx * 0.31, 0.05, 0.34)));
  }
  for (let i = 0; i < 4; i++) { // quattro alette a croce in coda
    const a = (i * Math.PI) / 2 + Math.PI / 4;
    parti.push(painted(new THREE.BoxGeometry(0.05, 0.3, 0.3), P.rosso, Mt(Math.cos(a) * 0.36, Math.sin(a) * 0.36, -0.5, 0, 0, a + Math.PI / 2)));
  }
  return merged(parti).scale(1.25, 1.25, 1.25);
}

/** Il salvagente-scudo: anello a quattro spicchi rossi e quattro bianchi (concept), in piano intorno al veicolo. */
function geoSalvagente(): THREE.BufferGeometry {
  const g = new THREE.TorusGeometry(1.7, 0.27, 4, 16).rotateX(Math.PI / 2).toNonIndexed();
  const pos = g.attributes.position!, col = new Float32Array(pos.count * 3), rosso = new THREE.Color(P.rosso), bianco = new THREE.Color(P.pietraChiara);
  for (let f = 0; f < pos.count; f += 3) { // colore per faccia, dall'angolo del suo centro: 8 spicchi alternati
    const x = (pos.getX(f) + pos.getX(f + 1) + pos.getX(f + 2)) / 3, z = (pos.getZ(f) + pos.getZ(f + 1) + pos.getZ(f + 2)) / 3;
    const c = Math.floor(((Math.atan2(z, x) + Math.PI) / (2 * Math.PI)) * 8) % 2 ? rosso : bianco;
    for (let v = 0; v < 3; v++) { col[(f + v) * 3] = c.r; col[(f + v) * 3 + 1] = c.g; col[(f + v) * 3 + 2] = c.b; }
  }
  g.deleteAttribute('uv'); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}
