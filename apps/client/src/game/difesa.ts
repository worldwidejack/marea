// Isola della Difesa nel mondo (docs/DIFESA.md §6): il cancello dell'orto davanti al casale, col cartello che si vede da lontano e
// DIFENDI L'ORTO (A vicino, ≤ 4 m). Il gioco è la stessa pagina del banco (provadifesa.html, canvas 2D, chunk tutto suo): si apre sopra il
// mondo in un riquadro a tutto schermo e il mondo intanto sta fermo (niente passi né resa: main.ts salta il frame finché è aperto).
// Si torna all'isola con ✕ ISOLA, con Esc a menù chiuso, o dal gioco stesso (messaggio `marea:difesa:esci`). Livelli e medaglie restano
// quelli del banco (localStorage del browser): sono gli stessi dentro e fuori dal mondo.
// Bundle iniziale: piccolo, niente import della sim. Prove: ?difesa=1 mette il bottone 🥕 (vai all'orto).
import * as THREE from 'three';
import { ISLANDS } from '@marea/content';
import type { GameWorld } from './world.ts';
import type { Renderer } from '../render/scene.ts';
import type { Hud } from '../ui/hud.ts';
import { pixIcon } from '../ui/icons.ts';
import { PAL, el, injectUiStyle } from '../ui/style.ts';
import { createLabelLayer, LABEL_NEAR_M } from '../ui/sheet.ts';
import { topButton } from '../ui/topbar.ts';
import { FLAGS } from '../flags.ts';
import { registerStateProvider, registerTestHook } from '../test/testapi.ts';

export type DifesaIsola = {
  /** Il cancello dell'orto (bussola), null se l'isola non c'è. */
  readonly spot: { id: string; nome: string; x: number; z: number } | null;
  tick(a: boolean): void;
  update(): void;
  /** Il gioco è aperto sopra il mondo: niente passi né resa del mondo. */
  readonly aperta: boolean;
  isBusy(): boolean;
};

const NEAR_M = 4;
const ISOLA = 'difesa';
/** Il cancello dell'orto, in celle dell'isola: 6,3 celle a ovest del centro del campo (orto_campo in islands.json), tra il casale e il campo. */
export function ingressoOrto(): [number, number] | null {
  const c = ISLANDS.find((i) => i.id === ISOLA)?.props?.find((p) => p.k === 'orto_campo');
  return c ? [c.at[0] - 6.3, c.at[1]] : null;
}

export function createDifesa(o: { world: GameWorld; renderer: Renderer; hud: Hud; root: HTMLElement; canvas: HTMLCanvasElement }): DifesaIsola {
  injectUiStyle();
  const arch = o.world.archipelago, place = arch.places.find((p) => p.island === ISOLA) ?? null;
  const ing = ingressoOrto();
  const spot = place && ing ? { id: 'difesa', nome: 'L’orto da difendere', x: (place.origin[0] + ing[0]) * arch.tile, z: (place.origin[1] + ing[1]) * arch.tile } : null;
  let near = false, nearWas = false, aWas = false, aperte = 0;
  let velo: HTMLDivElement | null = null;

  // ---- cartello sopra il cancello e bottone DIFENDI L'ORTO ----
  const layer = createLabelLayer(o.root);
  const label = spot ? layer.add(() => apri()) : null;
  label?.set('bubble', [pixIcon('difesa', 16), el('span', '', 'L’orto da difendere')], 'dng');
  label?.el.classList.add('dng');
  const btn = el('button', 'mz mz-play'); btn.id = 'mzDifesaEntra'; btn.type = 'button';
  btn.style.background = PAL.giallo; btn.style.color = PAL.ombraCalda;
  btn.replaceChildren(pixIcon('difesa', 24), el('span', '', 'DIFENDI L’ORTO'), el('small', '', 'A'));
  for (const ev of ['pointerdown', 'touchstart']) btn.addEventListener(ev, (x) => x.stopPropagation());
  btn.addEventListener('click', () => apri());
  o.root.append(btn);

  /** Il gioco sopra il mondo: la pagina del banco in un riquadro a tutto schermo, con ✕ ISOLA in alto a sinistra. */
  function apri(): void {
    if (velo) return;
    aperte++;
    btn.classList.remove('on');
    velo = document.createElement('div');
    velo.id = 'mzDifesa';
    Object.assign(velo.style, { position: 'fixed', inset: '0', zIndex: '60', background: '#1d1a22' });
    const fr = document.createElement('iframe');
    fr.src = '/provadifesa.html?mondo=1' + (FLAGS.test ? '&prova=1' : '');
    fr.title = 'Difesa: l’orto';
    fr.allow = 'autoplay; fullscreen';
    Object.assign(fr.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', border: '0', display: 'block' });
    const x = el('button', 'mz', '✕ ISOLA'); x.id = 'mzDifesaEsci'; x.type = 'button';
    Object.assign(x.style, {
      position: 'absolute', left: 'max(8px, env(safe-area-inset-left))', bottom: 'max(8px, env(safe-area-inset-bottom))', zIndex: '1',
      font: '700 13px/1 system-ui, sans-serif', padding: '8px 11px', borderRadius: '10px', border: `2px solid ${PAL.ombraCalda}`,
      background: PAL.sabbiaChiara, color: PAL.ombraCalda, boxShadow: `0 3px 0 ${PAL.ombraCalda}`, cursor: 'pointer',
    });
    x.addEventListener('click', chiudi);
    velo.append(fr, x);
    document.body.append(velo);
    fr.addEventListener('load', () => { try { fr.contentWindow?.focus(); } catch { /* altra origine: pazienza */ } });
    addEventListener('keydown', esc, true);
  }
  function chiudi(): void {
    if (!velo) return;
    velo.remove(); velo = null; // via il riquadro: il gioco si ferma e libera la memoria
    removeEventListener('keydown', esc, true);
    const a = o.world.avatar;
    if (spot && o.world.mode === 'walk') a.teleport(spot.x - 1.5, spot.z + 2.5);
    o.renderer.diorama.follow(a.state.x, o.world.groundY(a.state.x, a.state.z), a.state.z);
    o.renderer.diorama.snap?.();
    nearWas = true;
    o.canvas.focus?.();
  }
  /** Esc fuori dal riquadro (il fuoco è tornato sul mondo): si torna all'isola. Dentro il gioco Esc lo gestisce lui. */
  function esc(e: KeyboardEvent): void { if (e.key === 'Escape') { e.stopPropagation(); chiudi(); } }
  addEventListener('message', (e) => { if (e.origin === location.origin && (e.data as { tipo?: string } | null)?.tipo === 'marea:difesa:esci') chiudi(); });

  const vai = () => { const p = o.world.vai(ISOLA); if (p && spot) o.world.avatar.teleport(spot.x - 1.5, spot.z + 2.5); return !!p; };
  if (FLAGS.difesa) topButton({ root: o.root, id: 'mzDifesaVai', order: 9, label: '🥕', title: 'Difesa: vai all’orto (prova)', onClick: () => { vai(); } });

  registerStateProvider('difesa', () => ({ spot, near, aperte, aperta: !!velo }));
  registerTestHook('difesaVai', () => vai());
  registerTestHook('difesaApri', () => { apri(); return true; });
  registerTestHook('difesaChiudi', () => { chiudi(); return true; });

  const v = new THREE.Vector3();
  return {
    spot,
    get aperta() { return !!velo; },
    isBusy: () => !!velo,
    tick(a) {
      const pressA = a && !aWas; aWas = a;
      if (!spot || velo) { near = false; return; }
      const f = o.world.avatar.state;
      near = o.world.mode === 'walk' && !o.world.race.on && Math.hypot(f.x - spot.x, f.z - spot.z) < NEAR_M;
      if (near && !nearWas) o.hud.toast('L’orto da difendere: premi A o tocca DIFENDI L’ORTO', 2500);
      nearWas = near;
      if (near && pressA) apri();
    },
    update() {
      btn.classList.toggle('on', near && !velo);
      if (spot && label) {
        const y = o.world.groundY(spot.x, spot.z) + 4.2;
        v.set(spot.x, y, spot.z).project(o.renderer.camera);
        const r = o.canvas.getBoundingClientRect(), rr = o.root.getBoundingClientRect();
        const f = o.world.mode === 'walk' ? o.world.avatar.state : o.world.boat.state;
        label.place(r.left - rr.left + ((v.x + 1) / 2) * r.width, r.top - rr.top + ((1 - v.y) / 2) * r.height, v.z < 1 && Math.abs(v.x) < 1.05 && Math.abs(v.y) < 1.05 && !o.world.race.on && !velo, Math.hypot(f.x - spot.x, f.z - spot.z) < LABEL_NEAR_M);
      }
    },
  };
}
