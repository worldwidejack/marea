// Lore dentro il dungeon (docs/RPG.md §2c, `DungeonDef.testi`): poca roba obbligatoria e corta, il resto facoltativo e riconoscibile.
// - Scritta grande col nome del dungeon e il sottotitolo a ogni discesa (solo nei dungeon che hanno `testi`).
// - Voci: la prima volta che entri in una zona (una volta per sempre, in questo browser) parla l'altoparlante dell'impianto o il capo:
//   riquadro sotto l'HUD che si scrive da solo e sparisce da solo; un tocco lo chiude. Non ferma niente.
// - Letture (libro sul leggio, incisione sulla targa del muro a nord della cella): in vista hanno sopra il segno «facoltativo»; accanto
//   compare LEGGI (bordo tratteggiato), che apre il testo SOLO tenuto premuto 0,8 s (bottone o tasto L): A non lo apre mai, un tocco al
//   volo nemmeno. Da solo il dungeon sta fermo mentre leggi; insieme no (l'eroe resta fermo). Chiudi: CHIUDI, Esc o L. Già lette: «✓ letto».
import * as THREE from 'three';
import type { DungeonTesti } from '@marea/content/rpg.ts';
import { M, merged, painted } from '../render/island_parts.ts';
import { suona } from '../audio/ponte.ts';
import { PAL, el } from '../ui/style.ts';
import { itemIcon } from './items_ui.ts';
import type { DungeonScene } from './dungeon_scene.ts';

type Lettura = NonNullable<DungeonTesti['letture']>[number];
type Voce = NonNullable<DungeonTesti['voci']>[number];

export type DungeonTestiUi = {
  /** Ogni frame: dov'è l'eroe, se si gioca (se no niente voci né LEGGI) e i secondi passati. */
  update(hero: { x: number; z: number }, play: boolean, dt: number): void;
  /** Una lettura è aperta: da solo il dungeon non avanza. */
  readonly aperta: boolean;
  /** Per i test: cosa c'è a schermo e cosa è già stato visto/letto. */
  stato(): { titolo: boolean; voce: string | null; vicino: string | null; aperta: string | null; viste: string[]; lette: string[]; tenuto: number };
  hide(): void;
  dispose(): void;
};

const TIENI = 0.8; // s di LEGGI tenuto premuto per aprire
const TITOLO_MS = 3000;
const VICINO = 1.6; // m dal centro della cella della lettura
const SEGNO = 10; // m: più lontano, niente segno sopra
const K_VISTE = 'marea.dng.voci', K_LETTE = 'marea.dng.lette';
const P = PAL;
const HORN = ['....m...', '...mm..w', 'mmmmm.w.', 'mmmmm...', 'mmmmm.w.', '...mm..w', '....m...'];
const horn = (c: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 7" width="16" height="14" shape-rendering="crispEdges" style="display:block">${
  HORN.map((r, y) => [...r].map((k, x) => (k === '.' ? '' : `<rect x="${x}" y="${y}" width="1" height="1" fill="${k === 'w' ? P.sabbiaChiara : c}"/>`)).join('')).join('')}</svg>`;
const CSS = `
.mz-dng-titolo { position: absolute; left: 50%; top: 25%; transform: translateX(-50%); z-index: 17; pointer-events: none !important; text-align: center; display: none; white-space: nowrap; }
.mz-dng-titolo.on { display: block; animation: mzDngTit ${TITOLO_MS}ms steps(15) forwards; }
.mz-dng-titolo b { display: block; font: bold min(30px, 5.6vw) ui-monospace, Menlo, monospace; letter-spacing: .1em; color: ${P.sabbiaChiara}; text-shadow: 3px 3px 0 ${P.neroCaldo}; }
.mz-dng-titolo i { display: block; width: 62%; height: 3px; margin: 7px auto; background: ${P.giallo}; box-shadow: 0 3px 0 ${P.neroCaldo}; }
.mz-dng-titolo small { display: block; font: bold 14px ui-monospace, Menlo, monospace; color: ${P.sabbia}; text-shadow: 2px 2px 0 ${P.neroCaldo}; }
@keyframes mzDngTit { 0% { opacity: 0; } 12% { opacity: 1; } 82% { opacity: 1; } 100% { opacity: 0; } }
.mz-dng-voce { position: absolute; left: 50%; top: calc(max(8px, env(safe-area-inset-top)) + 112px); transform: translateX(-50%); width: min(440px, calc(100% - 32px)); box-sizing: border-box; padding: 7px 12px 9px; background: rgba(35,32,31,.94); border: 2px solid ${P.acquaBassa}; box-shadow: 0 4px 0 ${P.neroCaldo}; z-index: 16; display: none; cursor: pointer; pointer-events: auto; }
.mz-dng-voce.on { display: block; }
.mz-dng-voce.capo { border-color: ${P.rosso}; }
.mz-dng-voce .chi { display: flex; align-items: center; gap: 6px; font-weight: bold; font-size: 12px; letter-spacing: .08em; text-transform: uppercase; color: ${P.acquaBassa}; }
.mz-dng-voce.capo .chi { color: ${P.rosso}; }
.mz-dng-voce .chi small { margin-left: auto; font-size: 11px; letter-spacing: 0; text-transform: none; color: ${P.sabbia}; font-weight: normal; }
.mz-dng-voce p { margin: 4px 0 0; min-height: 2.7em; font-size: 15px; line-height: 1.35; color: ${P.sabbiaChiara}; }
.mz-dng-segni { position: absolute; inset: 0; pointer-events: none !important; z-index: 12; overflow: hidden; }
.mz-dng-segno { position: absolute; left: 0; top: 0; display: none; align-items: center; gap: 4px; padding: 2px 6px 2px 4px; background: rgba(35,32,31,.82); border: 1px dashed ${P.sabbia}; font: bold 11px ui-monospace, Menlo, monospace; color: ${P.sabbia}; white-space: nowrap; }
.mz-dng-segno.letto { color: ${P.erbaChiara}; border-color: ${P.erbaScura}; }
.mz-dng-leggi { position: absolute; left: 50%; top: 62%; transform: translateX(-50%); width: min(300px, calc(100% - 32px)); box-sizing: border-box; padding: 7px 12px 10px; background: rgba(46,30,20,.94); border: 2px dashed ${P.legnoChiaro}; box-shadow: 0 4px 0 ${P.neroCaldo}; z-index: 15; display: none; cursor: pointer; touch-action: none; overflow: hidden; pointer-events: auto; }
.mz-dng-leggi.on { display: block; }
.mz-dng-leggi.tiene { border-style: solid; border-color: ${P.giallo}; }
.mz-dng-leggi .t { display: flex; align-items: center; gap: 8px; font-weight: bold; font-size: 13px; color: ${P.sabbiaChiara}; }
.mz-dng-leggi .t kbd { margin-left: auto; padding: 0 5px; border: 1px solid ${P.sabbia}; font: bold 12px ui-monospace, Menlo, monospace; color: ${P.sabbia}; }
.mz-dng-leggi .n { margin-top: 4px; font-size: 14px; font-weight: bold; color: ${P.sabbiaChiara}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.mz-dng-leggi .s { margin-top: 1px; font-size: 12px; color: ${P.sabbia}; }
.mz-dng-leggi .fill { position: absolute; left: 0; bottom: 0; height: 4px; width: 0; background: ${P.giallo}; }
.mz-dng-lett { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); width: min(460px, calc(100% - 24px)); max-height: calc(100% - 96px); box-sizing: border-box; display: none; flex-direction: column; z-index: 25; background: ${P.sabbiaChiara}; color: ${P.neroCaldo}; border: 3px solid ${P.legno}; box-shadow: 0 6px 0 ${P.neroCaldo}; pointer-events: auto; }
.mz-dng-lett.on { display: flex; }
.mz-dng-lett .tag { padding: 9px 14px 0; font-size: 11px; font-weight: bold; letter-spacing: .08em; text-transform: uppercase; color: ${P.legno}; }
.mz-dng-lett h3 { margin: 2px 14px 8px; font-size: 18px; color: ${P.legnoScuro}; }
.mz-dng-lett .corpo { overflow-y: auto; padding: 0 14px 2px; font-size: 15px; line-height: 1.5; color: ${P.neroCaldo}; }
.mz-dng-lett .corpo p { margin: 0 0 10px; }
.mz-dng-lett .piede { padding: 0 14px 12px; }
.mz-dng-lett .piede .sub { font-size: 12px; color: ${P.legno}; }
.mz-dng-lett.incisione { background: ${P.pietraScura}; color: ${P.sabbiaChiara}; border-color: ${P.giallo}; }
.mz-dng-lett.incisione .tag, .mz-dng-lett.incisione h3 { color: ${P.giallo}; }
.mz-dng-lett.incisione .corpo { color: ${P.sabbiaChiara}; }
.mz-dng-lett.incisione .piede .sub { color: ${P.sabbia}; }
`;

const ricorda = (k: string): Set<string> => {
  try { const v: unknown = JSON.parse(localStorage.getItem(k) ?? '[]'); return new Set(Array.isArray(v) ? v.map(String) : []); } catch { return new Set(); }
};
const scrivi = (k: string, s: Set<string>) => { try { localStorage.setItem(k, JSON.stringify([...s])); } catch { /* storage spento: la rivedrai */ } };
/** Quanto ci vuole a leggerla (3 parole al secondo). */
const durata = (l: Lettura) => { const s = l.righe.join(' ').split(/\s+/).length / 3; return s < 50 ? `~${Math.max(10, Math.round(s / 10) * 10)} s` : `~${Math.max(1, Math.round(s / 60))} min`; };
const genere = (l: Lettura) => (l.tipo === 'libro' ? 'libro facoltativo' : 'incisione facoltativa');

// ——— segnaposto 3D (in codice, palette, facce piatte): leggio col libro aperto, targa d'ottone incisa ———
const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
function leggio(): THREE.BufferGeometry {
  const piano = M(0, 0.98, -0.05, 0.55, 0, 0); // inclinato verso chi guarda (la camera sta a sud-est)
  const su = (x: number, y: number, z: number, g: THREE.BufferGeometry, c: string) => painted(g, c, piano.clone().multiply(M(x, y, z)));
  const righe = [-0.12, -0.05, 0.02, 0.09].flatMap((z) => [su(-0.15, 0.07, z, box(0.2, 0.01, 0.025), PAL.legno), su(0.15, 0.07, z, box(0.2, 0.01, 0.025), PAL.legno)]);
  return merged([
    painted(box(0.56, 0.08, 0.42), PAL.legnoScuro, M(0, 0.04, 0)), painted(box(0.12, 0.9, 0.12), PAL.legno, M(0, 0.5, -0.02)),
    su(0, 0, 0, box(0.66, 0.05, 0.46), PAL.legno), su(-0.15, 0.045, 0, box(0.28, 0.04, 0.38), PAL.sabbiaChiara), su(0.15, 0.045, 0, box(0.28, 0.04, 0.38), PAL.sabbiaChiara),
    ...righe, su(0.02, 0.07, 0.12, box(0.03, 0.012, 0.3), PAL.rosso), // segnalibro
  ]);
}
function targa(): THREE.BufferGeometry {
  const righe = [0.16, 0.06, -0.04, -0.14].map((y, i) => painted(box(i === 0 ? 0.56 : 0.66 - i * 0.08, 0.035, 0.02), PAL.legnoScuro, M(0, y, 0.035)));
  return merged([painted(box(0.94, 0.62, 0.05), PAL.arancio), painted(box(0.84, 0.52, 0.03), PAL.giallo, M(0, 0, 0.02)), ...righe,
    ...([[-0.4, 0.24], [0.4, 0.24], [-0.4, -0.24], [0.4, -0.24]] as const).map(([x, y]) => painted(box(0.05, 0.05, 0.03), PAL.legnoScuro, M(x, y, 0.04)))]);
}

export function createTesti(o: { root: HTMLElement; camera: THREE.Camera; canvas: HTMLCanvasElement; sc: DungeonScene; insieme: boolean }): DungeonTestiUi {
  if (!document.getElementById('mz-dng-testi-style')) { const st = document.createElement('style'); st.id = 'mz-dng-testi-style'; st.textContent = CSS; document.head.appendChild(st); }
  const def = o.sc.def, T = def.testi ?? {}, tile = o.sc.map.tile, fy = o.sc.floorY, id = (x: string) => `${def.id}:${x}`;
  const viste = ricorda(K_VISTE), lette = ricorda(K_LETTE);
  const stop = (e: HTMLElement) => { for (const ev of ['pointerdown', 'touchstart']) e.addEventListener(ev, (x) => x.stopPropagation()); };

  // scritta grande col nome, a ogni discesa
  const titolo = el('div', 'mz mz-dng-titolo'); titolo.id = 'mzDngTitolo';
  titolo.append(el('b', '', def.nome.toUpperCase()), el('i'), ...(T.sottotitolo ? [el('small', '', T.sottotitolo)] : []));
  let titoloFino = 0;
  if (def.testi) { titolo.classList.add('on'); titoloFino = performance.now() + TITOLO_MS; }
  titolo.addEventListener('animationend', () => titolo.classList.remove('on'));

  // voci: una alla volta, scritte a scatti, poi spariscono
  const voce = el('div', 'mz mz-dng-voce'); voce.id = 'mzDngVoce';
  const chi = el('div', 'chi'), testo = el('p');
  voce.append(chi, testo); stop(voce);
  let ora: { v: Voce; n: number; t: number; fine: number } | null = null;
  const coda: Voce[] = [];
  const chiudiVoce = () => { ora = null; voce.classList.remove('on'); };
  voce.addEventListener('click', chiudiVoce);
  const parla = (v: Voce) => {
    viste.add(id(v.id)); scrivi(K_VISTE, viste);
    voce.classList.toggle('capo', !!v.capo);
    chi.innerHTML = v.capo ? '' : horn(P.acquaBassa); // SVG statico
    chi.append(v.chi, el('small', '', matchMedia('(pointer: coarse)').matches ? 'tocca per chiudere' : 'clic per chiudere'));
    testo.textContent = ''; voce.classList.add('on');
    ora = { v, n: 0, t: 0, fine: 1.5 + v.testo.length / 25 + 2.5 }; // si scrive in ~testo/25 s, poi resta il tempo di leggerla
    suona('altoparlante');
  };

  // letture: segnaposto 3D, segno sopra, LEGGI tenuto premuto, pannello
  const group = new THREE.Group(); group.name = 'dungeon_testi'; o.sc.scene.add(group);
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }); mat.name = 'mat_dungeon_testi';
  const geos = { libro: leggio(), incisione: targa() };
  const segni = el('div', 'mz mz-dng-segni');
  const letture = (T.letture ?? []).map((l) => {
    const [cx, cz] = l.at, x = (cx + 0.5) * tile, z = (cz + 0.5) * tile;
    const mesh = new THREE.Mesh(geos[l.tipo], mat); mesh.name = `lettura_${l.id}`;
    if (l.tipo === 'libro') { mesh.position.set(x, fy, z); mesh.scale.setScalar(1.3); } else mesh.position.set(x, fy + 1.35, cz * tile + 0.03);
    group.add(mesh);
    const segno = el('div', 'mz-dng-segno'); segni.appendChild(segno);
    const top = new THREE.Vector3(x, fy + (l.tipo === 'libro' ? 1.75 : 2.0), l.tipo === 'libro' ? z : cz * tile + 0.1);
    return { l, x, z, mesh, segno, top, sig: '' };
  });
  const leggi = el('div', 'mz mz-dng-leggi'); leggi.id = 'mzDngLeggi'; stop(leggi);
  const lt = el('div', 't'), ln = el('div', 'n'), ls = el('div', 's'), fill = el('i', 'fill');
  lt.append(itemIcon('libro', P.sabbia, 16), 'TIENI PREMUTO PER LEGGERE', el('kbd', '', 'L'));
  leggi.append(lt, ln, ls, fill);
  const pan = el('div', 'mz mz-dng-lett'); pan.id = 'mzDngLettura'; stop(pan);
  const tag = el('div', 'tag'), h3 = el('h3'), corpo = el('div', 'corpo'), piede = el('div', 'piede');
  const chiudi = el('button', 'mz-btn', 'CHIUDI'); chiudi.type = 'button'; chiudi.append(el('small', '', 'Esc'));
  piede.append(el('div', 'sub', o.insieme ? 'La squadra continua: il dungeon non si ferma' : 'Il dungeon ti aspetta'), chiudi);
  pan.append(tag, h3, corpo, piede);
  o.root.append(titolo, voce, segni, leggi, pan);

  let vicino: (typeof letture)[number] | null = null, aperta: Lettura | null = null, tenuto = 0, giu = false, tasto = false, vicSig = '';
  const apri = (l: Lettura) => {
    aperta = l; tenuto = 0; giu = tasto = false; leggi.classList.remove('on', 'tiene');
    lette.add(id(l.id)); scrivi(K_LETTE, lette);
    pan.classList.toggle('incisione', l.tipo === 'incisione');
    tag.textContent = `${l.tipo === 'libro' ? 'Libro' : 'Incisione'} · ${genere(l).split(' ')[1]}`;
    h3.textContent = l.titolo; corpo.replaceChildren(...l.righe.map((r) => el('p', '', r))); corpo.scrollTop = 0;
    pan.classList.add('on'); voce.style.visibility = 'hidden'; suona(l.tipo === 'libro' ? 'pagina' : 'click');
  };
  const chiudiLettura = () => { if (!aperta) return; aperta = null; pan.classList.remove('on'); voce.style.visibility = ''; vicSig = ''; suona('chiudi'); };
  chiudi.addEventListener('click', chiudiLettura);
  const held = new Set<number>();
  leggi.addEventListener('pointerdown', (e) => { e.preventDefault(); held.add(e.pointerId); giu = true; try { leggi.setPointerCapture(e.pointerId); } catch { /* sintetico */ } });
  const su = (e: PointerEvent) => { held.delete(e.pointerId); giu = held.size > 0; };
  leggi.addEventListener('pointerup', su); leggi.addEventListener('pointercancel', su);
  leggi.addEventListener('contextmenu', (e) => e.preventDefault());
  const kd = (e: KeyboardEvent) => {
    if (aperta && (e.code === 'Escape' || (e.code === 'KeyL' && !e.repeat))) { e.preventDefault(); e.stopImmediatePropagation(); chiudiLettura(); return; }
    if (aperta) return; // da solo il dungeon è fermo, insieme l'eroe sta fermo: gli altri tasti non servono
    if (e.code === 'KeyL' && !e.altKey && !e.ctrlKey && !e.metaKey) { e.preventDefault(); if (!e.repeat) tasto = true; }
  };
  const ku = (e: KeyboardEvent) => { if (e.code === 'KeyL') tasto = false; };
  const blur = () => { tasto = false; giu = false; held.clear(); };
  addEventListener('keydown', kd, true); addEventListener('keyup', ku, true); addEventListener('blur', blur);

  const v3 = new THREE.Vector3();
  const screen = (p: THREE.Vector3) => {
    v3.copy(p).project(o.camera);
    const r = o.canvas.getBoundingClientRect(), rr = o.root.getBoundingClientRect();
    return { x: r.left - rr.left + ((v3.x + 1) / 2) * r.width, y: r.top - rr.top + ((1 - v3.y) / 2) * r.height, on: v3.z < 1 && Math.abs(v3.x) < 1.05 && Math.abs(v3.y) < 1.05 };
  };
  const zona = (v: Voce, cx: number, cz: number) => cx >= v.zona[0] && cz >= v.zona[1] && cx <= v.zona[2] && cz <= v.zona[3];
  let fermo = false;

  return {
    get aperta() { return aperta !== null; },
    update(hero, play, dt) {
      if (fermo) return;
      // voci: zona nuova (mai sentita) → in coda; parlano dopo la scritta grande, una alla volta
      if (play) {
        const cx = Math.floor(hero.x / tile), cz = Math.floor(hero.z / tile);
        for (const v of T.voci ?? []) if (!viste.has(id(v.id)) && !coda.includes(v) && ora?.v !== v && zona(v, cx, cz)) coda.push(v);
        if (!ora && coda.length && performance.now() >= titoloFino) parla(coda.shift()!);
      }
      if (ora && !aperta) {
        ora.t += dt;
        const n = Math.min(ora.v.testo.length, Math.floor(ora.t * 25 / 2) * 2); // due lettere alla volta
        if (n !== ora.n) { ora.n = n; testo.textContent = ora.v.testo.slice(0, n); }
        if (ora.t >= ora.fine) chiudiVoce();
      }
      // letture: in vista (luce della cella) il segnaposto e il segno; vicino, LEGGI
      vicino = null;
      for (const r of letture) {
        const lit = o.sc.light(r.x, r.z), dx = r.x - hero.x, dz = r.z - hero.z, d = Math.sqrt(dx * dx + dz * dz);
        r.mesh.visible = lit > 0;
        const s = lit >= 0.45 && d <= SEGNO && d > VICINO && !aperta ? screen(r.top) : null; // accanto c'è già LEGGI
        if (s?.on) {
          const letto = lette.has(id(r.l.id)), sig = letto ? 'l' : 'f';
          if (sig !== r.sig) { r.sig = sig; r.segno.className = `mz-dng-segno${letto ? ' letto' : ''}`; r.segno.replaceChildren(itemIcon(r.l.tipo === 'libro' ? 'libro' : 'materiale', letto ? P.erbaChiara : P.sabbia, 12), letto ? '✓ letto' : 'facoltativo'); }
          r.segno.style.transform = `translate(${Math.round(s.x)}px, ${Math.round(s.y)}px) translate(-50%, -100%)`; r.segno.style.display = 'flex';
        } else r.segno.style.display = 'none';
        if (play && d <= VICINO && (!vicino || d < Math.hypot(vicino.x - hero.x, vicino.z - hero.z))) vicino = r;
      }
      const sig = vicino && !aperta ? `${vicino.l.id}|${lette.has(id(vicino.l.id)) ? 1 : 0}` : '';
      if (sig !== vicSig) {
        vicSig = sig; leggi.classList.toggle('on', !!sig); tenuto = 0;
        if (vicino) { ln.textContent = vicino.l.titolo; ls.textContent = `${genere(vicino.l)} · ${durata(vicino.l)}${lette.has(id(vicino.l.id)) ? ' · ✓ letto' : ''}`; }
      }
      // LEGGI: solo tenuto (bottone o L), mai al volo
      const tiene = !!vicino && !aperta && (giu || tasto);
      tenuto = tiene ? tenuto + dt : 0;
      leggi.classList.toggle('tiene', tiene);
      fill.style.width = `${Math.min(10, Math.floor((tenuto / TIENI) * 10)) * 10}%`;
      if (vicino && tenuto >= TIENI) apri(vicino.l);
    },
    stato: () => ({ titolo: titolo.classList.contains('on'), voce: ora?.v.id ?? null, vicino: vicino?.l.id ?? null, aperta: aperta?.id ?? null,
      viste: [...viste].filter((x) => x.startsWith(def.id + ':')), lette: [...lette].filter((x) => x.startsWith(def.id + ':')), tenuto }),
    hide() { fermo = true; chiudiLettura(); chiudiVoce(); leggi.classList.remove('on'); segni.replaceChildren(); },
    dispose() {
      removeEventListener('keydown', kd, true); removeEventListener('keyup', ku, true); removeEventListener('blur', blur);
      for (const e of [titolo, voce, segni, leggi, pan]) e.remove();
      group.removeFromParent(); geos.libro.dispose(); geos.incisione.dispose(); mat.dispose();
    },
  };
}
