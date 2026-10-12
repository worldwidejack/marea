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
import { P } from '../render/island_parts.ts';
import type { SuoniGuida } from './suoni.ts';
import { BUCCIA, texturePixel } from './sprite_oggetti.ts';

const MAX = { scatole: 24, trappole: 12, colpi: 16, scudi: 8 };
const NOMI = Object.fromEntries(CORSE.oggetti.catalogo.map((o) => [o.id, o.nome.toUpperCase()]));
const COLORE: Record<string, string> = { turbo: P.arancio, trappola: P.giallo, dritto: P.rosso, ricerca: P.violaNeon, scudo: P.cianoNeon };

const CSS = `.pp-ogg { position: absolute; top: calc(max(8px, env(safe-area-inset-top)) + 44px); left: 50%; transform: translateX(-50%); pointer-events: none; z-index: 3;
  font: bold 15px ui-monospace, Menlo, monospace; color: ${P.sabbiaChiara}; padding: 4px 10px; background: rgba(46,30,20,.88); border: 3px solid ${P.legnoChiaro}; white-space: nowrap; display: none; }
.pp-ogg small { font-size: 11px; color: ${P.sabbia}; margin-left: 6px; }
.pp-ogg.gira { color: ${P.sabbia}; }
.pp-usa { position: absolute; right: calc(max(16px, env(safe-area-inset-right, 0px)) + 118px); bottom: calc(env(safe-area-inset-bottom, 0px) + 112px); width: 72px; height: 72px; border-radius: 50%;
  display: none; align-items: center; justify-content: center; text-align: center; background: rgba(46,30,20,.7); border: 3px solid rgba(244,227,193,.7); color: ${P.sabbiaChiara};
  font: bold 10px ui-monospace, Menlo, monospace; line-height: 1.1; z-index: 14; touch-action: none; -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; -webkit-tap-highlight-color: transparent; }
.pp-usa.pronto { background: rgba(232,67,63,.85); }
.pp-usa.giu { transform: scale(.92); filter: brightness(1.25); }`;

/** Da che parte va di serie l'oggetto: la trappola dietro, i colpi avanti (turbo e scudo non hanno parte). */
const dietroDiSerie = (ogg: string): boolean => !!ogg && oggettoDef(ogg).effetto === 'trappola';

/** Il bottone USA (solo col dito) e i tasti: Q = USA di serie, R = USA dall'altra parte (#250, Jack: «uno non deve per forza frenare per
 *  sparare»). `giu()` = premuto adesso (la sim lo usa allo scatto); `contrario(ogg, sy)` = va lanciato al contrario di serie: R, oppure col
 *  dito lo stick tenuto verso l'altra parte (`sy` = stick a schermo, > 0 giù; col dito lo stick sterza e basta, la Y è libera). */
export function creaUsa(root: HTMLElement): { giu(): boolean; contrario(ogg: string, sy?: number, sx?: number): boolean; mostra(on: boolean): void; etichetta(t: string, pronto: boolean): void; readonly el: HTMLElement } {
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
    etichetta(t, pronto) { if (t !== testo) { b.textContent = t || 'USA'; testo = t; } b.classList.toggle('pronto', pronto); },
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
  aggiorna(s: GaraState, p: Pista, dt: number, suoni: SuoniGuida | null, camera?: THREE.Camera): { etichetta: string; pronto: boolean };
  /** Mostra o nasconde la casella in alto. */
  interfaccia(on: boolean): void;
  chiudi(): void;
};

export function creaOggetti3d(root: HTMLElement): Oggetti3d {
  stile();
  const gruppo = new THREE.Group(); gruppo.name = 'corse_oggetti';
  const scatole = istanze(new THREE.BoxGeometry(1.1, 1.1, 1.1), P.ambraNeon, MAX.scatole, 'corse_scatole');
  const segno = istanze(new THREE.BoxGeometry(0.36, 0.36, 1.16), P.neroCaldo, MAX.scatole, 'corse_scatole_segno');
  // la buccia è uno sprite in pixel art (dalla concept) che guarda sempre la camera, girando solo intorno alla verticale
  const altoB = 1.15, largoB = (altoB * BUCCIA[0]!.length) / BUCCIA.length;
  const bucce = new THREE.InstancedMesh(new THREE.PlaneGeometry(largoB, altoB).translate(0, altoB / 2, 0), new THREE.MeshBasicMaterial({ map: texturePixel(BUCCIA), alphaTest: 0.5, side: THREE.DoubleSide }), MAX.trappole);
  bucce.name = 'corse_bucce'; bucce.count = 0; bucce.frustumCulled = false;
  const palle = istanze(new THREE.IcosahedronGeometry(0.5, 0), P.rosso, MAX.colpi, 'corse_palle');
  const razzi = istanze(new THREE.ConeGeometry(0.35, 1.3, 6).rotateX(-Math.PI / 2), P.violaNeon, MAX.colpi, 'corse_razzi');
  const scudi = istanze(new THREE.TorusGeometry(1.7, 0.25, 4, 10).rotateX(Math.PI / 2), P.rosso, MAX.scudi, 'corse_scudi');
  for (const m of [scatole, segno, bucce, palle, razzi, scudi]) gruppo.add(m);
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
  function casellaHtml(o: OggettiState) {
    const tu = o.tasche[0]!;
    if (!mostra || (!tu.ogg && tu.scudo <= 0)) { casella.style.display = 'none'; return; }
    casella.style.display = 'block';
    let html: string;
    if (tu.roulette > 0) { // la roulette: nomi a giro, sempre più lenti
      const ids = o.pesca, i = Math.floor(t * (6 + tu.roulette * 10)) % ids.length;
      html = NOMI[ids[i]!]!; casella.className = 'pp-ogg gira'; casella.style.borderColor = P.legnoChiaro;
    } else if (tu.ogg) {
      const d = oggettoDef(tu.ogg);
      const parti = d.effetto === 'turbo' || d.effetto === 'scudo' ? '' : dietroDiSerie(tu.ogg) ? (dito ? 'stick ↑ avanti' : 'Q dietro · R avanti') : dito ? 'stick ↓ indietro' : 'Q avanti · R indietro';
      html = `${NOMI[tu.ogg]}${tu.cariche > 1 ? ` ×${tu.cariche}` : ''}${parti || !dito ? `<small>${parti || 'Q'}</small>` : ''}`; casella.className = 'pp-ogg'; casella.style.borderColor = COLORE[d.effetto]!;
    } else { html = `SALVAGENTE <small>${Math.ceil(tu.scudo)} s</small>`; casella.className = 'pp-ogg'; casella.style.borderColor = COLORE.scudo!; }
    if (html !== ultimo) { casella.innerHTML = html; ultimo = html; }
  }

  return {
    gruppo,
    aggiorna(s, p, dt, suoni, camera) {
      const o = s.oggetti;
      gruppo.visible = !!o;
      if (!o) { casella.style.display = 'none'; prima = null; return { etichetta: '', pronto: false }; }
      t += dt;
      let n = 0;
      for (const b of o.scatole) {
        if (b.t > 0 || n >= MAX.scatole) continue;
        const h = 0.9 + 0.15 * Math.sin(t * 3 + b.prog);
        scatole.setMatrixAt(n, posa(p, b.prog, b.lat, h, t * 1.6 + b.lat));
        segno.setMatrixAt(n, M); n++;
      }
      scatole.count = segno.count = n; scatole.instanceMatrix.needsUpdate = segno.instanceMatrix.needsUpdate = true;
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
      let np = 0, nr = 0;
      for (const c of o.colpi) {
        const e = oggettoDef(c.ogg).effetto;
        if (e === 'ricerca' && nr < MAX.colpi) razzi.setMatrixAt(nr++, posa(p, c.prog, c.lat, 0.8, c.v < 0 ? Math.PI : 0));
        else if (np < MAX.colpi) palle.setMatrixAt(np++, posa(p, c.prog, c.lat, 0.55 + 0.25 * Math.abs(Math.sin(c.t * 9)), c.t * 12));
      }
      palle.count = np; razzi.count = nr; palle.instanceMatrix.needsUpdate = razzi.instanceMatrix.needsUpdate = true;
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
      return { etichetta: tu.roulette > 0 ? '…' : tu.ogg ? `${NOMI[tu.ogg]!.split(/[ -]/)[0]}${tu.cariche > 1 ? ` ×${tu.cariche}` : ''}` : '', pronto };
    },
    interfaccia(on) { mostra = on; if (!on) casella.style.display = 'none'; },
    chiudi() { for (const m of [scatole, segno, bucce, palle, razzi, scudi]) m.count = 0; casella.style.display = 'none'; prima = null; },
  };
}

/** Quanto è girato (rad) un veicolo colpito: due giri pieni nel tempo del colpo. */
export function giroColpito(s: GaraState, i: number): number {
  const c = s.oggetti?.tasche[i]?.colpito ?? 0;
  return c > 0 ? (1 - c / CORSE.oggetti.colpito.secondi) * Math.PI * 4 : 0;
}
