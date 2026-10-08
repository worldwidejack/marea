// Isole a tema (#68): chi può entrare (regola pura in @marea/sim/world/temi.ts), barriere in mare sulla barca, il Vulcano che ti caccia
// se non hai il cappello giusto, avvisi quando un'isola si apre o trovi una mappa. Piccolo, nel bundle iniziale: la scenografia viva
// (tempesta, neve, aurora, fumo, nebbia, carpe, guardiani) è un chunk a parte (render/temi_fx.ts) scaricato quando ti avvicini.
import * as THREE from 'three';
import { AVATAR } from '@marea/content';
import { distanzaIsola, respingi, sblocchi, viaggiatore } from '@marea/sim';
import type { ArchPlace, LotState, Sblocco, Viaggiatore } from '@marea/sim';
import type { GameWorld } from './world.ts';
import type { Hud } from '../ui/hud.ts';
import type { Loader } from '../render/loader.ts';
import type { TemiFx } from '../render/temi_fx.ts';
import { PAL } from '../ui/style.ts';
import { registerStateProvider, registerTestHook } from '../test/testapi.ts';
import { FLAGS } from '../flags.ts';

export type Temi = {
  /** Isole a tema (ArchPlace) nell'ordine dell'arcipelago. */
  readonly isole: readonly ArchPlace[];
  aperta(id: string): boolean;
  motivo(id: string): string;
  update(dt: number, t: number): void;
};

/** Distanza (m) dal bordo dell'isola entro cui si scarica e si accende la scenografia viva. */
const FX_M = 260;
/** Secondi tra lo sbarco sul Vulcano senza cappello e il ritorno in barca. */
const CACCIA_S = 2.2;

const CSS = `
#mzTemaFumetto { position: absolute; left: 0; top: 0; z-index: 14; display: none; max-width: 230px; padding: 6px 9px; background: ${PAL.sabbiaChiara}; color: ${PAL.neroCaldo};
  border: 2px solid ${PAL.neroCaldo}; box-shadow: 0 3px 0 ${PAL.neroCaldo}; font: bold 12px ui-monospace, Menlo, monospace; pointer-events: none; transform: translate(-50%, -100%); }
#mzTemaFumetto.on { display: block; }
#mzTemaFumetto::after { content: ''; position: absolute; left: 50%; bottom: -8px; margin-left: -5px; border: 5px solid transparent; border-top-color: ${PAL.neroCaldo}; }
body.mz-sotto #mzTemaFumetto { display: none; }
`;

// Ghiacci e Giardino: i minigiochi delle isole (game/minigiochi.ts) chiedono qui se l'isola è aperta, senza passare da main.ts
let attiva: Temi | null = null;
/** L'isola a tema `id` è aperta per te adesso? (false prima che createTemi giri). */
export function temaAperta(id: string): boolean { return attiva?.aperta(id) ?? false; }
// fine Ghiacci e Giardino

export function createTemi(o: {
  world: GameWorld; hud: Hud; loader: Loader; root: HTMLElement; camera: THREE.Camera; canvas: HTMLCanvasElement;
  getLot(): LotState | null; notte(): boolean;
}): Temi {
  const { world, hud } = o, arch = world.archipelago, map = world.map;
  const isole = arch.places.filter((p) => p.tema);
  let prova: Partial<Viaggiatore> | null = null; // hook di test: forza Molo, livello, cappello, mappe
  // Templari per le prove (?templari=1): come se avessi già la reliquia
  const chi = (): Viaggiatore => ({ ...viaggiatore(o.getLot(), world.look.cappello), ...(FLAGS.templari ? { reliquie: ['templari'] } : {}), ...prova });
  let stato: Record<string, Sblocco & { nome: string }> = sblocchi(arch.places, chi());
  let mappeNote = new Set(chi().mappe), next = 0, respinte = 0, ultimo = '', toastAt = 0, cacce = 0;

  // barriere in mare: dopo ogni passo della barca (world.ts), contro le isole chiuse
  world.vincoloBarca = (prev, nx) => {
    for (const p of isole) {
      if (stato[p.island]?.aperta || !p.tema || p.tema.barriera <= 0) continue;
      const r = respingi(prev, nx, p, map);
      if (!r) continue;
      respinte++; ultimo = stato[p.island]?.motivo ?? '';
      if (performance.now() > toastAt) { toastAt = performance.now() + 3500; hud.toast(ultimo, 3200); }
      fx?.respinta(p.island);
      return r;
    }
    return null;
  };

  // Vulcano: sbarchi senza il cappello giusto → un abitante ti dice di andartene, poi sei di nuovo in barca
  if (!document.getElementById('mz-temi-style')) { const st = document.createElement('style'); st.id = 'mz-temi-style'; st.textContent = CSS; document.head.appendChild(st); }
  const fum = document.createElement('div'); fum.id = 'mzTemaFumetto'; fum.className = 'mz'; o.root.appendChild(fum);
  let caccia: { isola: string; t: number } | null = null;
  const v3 = new THREE.Vector3();
  const fumetto = (testo: string | null) => {
    if (!testo) { fum.classList.remove('on'); return; }
    if (fum.textContent !== testo) fum.textContent = testo;
    const a = world.anchorOf('me'); if (!a) return;
    v3.set(a.x, a.y + 0.6, a.z).project(o.camera);
    const r = o.canvas.getBoundingClientRect(), rr = o.root.getBoundingClientRect();
    fum.style.left = `${r.left - rr.left + (v3.x + 1) / 2 * r.width}px`; fum.style.top = `${r.top - rr.top + (1 - v3.y) / 2 * r.height}px`;
    fum.classList.add('on');
  };

  // scenografia viva: chunk a parte, scaricato la prima volta che ti avvicini a un'isola a tema
  let fx: TemiFx | null = null, fxLoad: Promise<void> | null = null;
  const caricaFx = () => {
    fxLoad ??= import('../render/temi_fx.ts').then((m) => {
      fx = m.createTemiFx({ scene: world.scene, arch, map, loader: o.loader, root: o.root, groundY: world.groundY, aperta: (id) => !!stato[id]?.aperta, notte: o.notte });
    }).catch((e: unknown) => { fxLoad = null; console.warn('[marea] scenografia delle isole a tema non caricata', e); });
    return fxLoad;
  };
  const vicino = (x: number, z: number): ArchPlace | null => {
    let best: ArchPlace | null = null, bd = Infinity;
    for (const p of isole) { const d = distanzaIsola(p, map.tile, x, z).d; if (d < bd) { bd = d; best = p; } }
    return bd < FX_M ? best : null;
  };

  const ricalcola = () => {
    const v = chi(), nuovo = sblocchi(arch.places, v);
    for (const p of isole) if (stato[p.island] && !stato[p.island]!.aperta && nuovo[p.island]!.aperta) hud.toast(`Si apre l'${p.nome}!`, 3500);
    for (const m of v.mappe) if (!mappeNote.has(m)) hud.toast(`Hai trovato la mappa del ${m.charAt(0).toUpperCase() + m.slice(1)}: la nebbia si apre`, 4000);
    mappeNote = new Set(v.mappe);
    stato = nuovo;
  };

  registerStateProvider('temi', () => ({
    isole: isole.map((p) => ({ id: p.island, nome: p.nome, aperta: !!stato[p.island]?.aperta, motivo: stato[p.island]?.motivo ?? '', manca: stato[p.island]?.manca ?? '', barriera: p.tema!.barriera, x: p.spawn.x, z: p.spawn.z, boat: p.boat, centro: { x: (p.origin[0] + p.w / 2) * map.tile, z: (p.origin[1] + p.h / 2) * map.tile } })),
    respinte, ultimo, cacce, caccia: !!caccia, fumetto: fum.classList.contains('on') ? fum.textContent : null, fx: fx?.stato() ?? null,
  }));
  /** Test: forza parti del viaggiatore (`{ molo: 2 }`, `{ cappello: 'lanterna' }`, `{ mappe: ['giardino'] }`, `{ livello: 3 }`); null = quello vero. 'tutte' apre tutto. */
  registerTestHook('temiProva', (v) => { prova = v === 'tutte' ? { molo: 9, livello: 99, cappello: 'lanterna', mappe: ['giardino'], reliquie: ['templari'] } : (v as Partial<Viaggiatore> | null) ?? null; ricalcola(); return Object.fromEntries(Object.entries(stato).map(([k, x]) => [k, x.aperta])); });
  /** Test: barca a `m` metri fuori dalla barriera dell'isola, prua verso il suo molo (poi il test accelera con Spazio). */
  registerTestHook('temiVerso', (id, m) => {
    const p = isole.find((q) => q.island === id); if (!p) return null;
    const cx = (p.origin[0] + p.w / 2) * map.tile, cz = (p.origin[1] + p.h / 2) * map.tile;
    let dx = p.boat.x - cx, dz = p.boat.z - cz; const n = Math.hypot(dx, dz) || 1; dx /= n; dz /= n;
    const b = distanzaIsola(p, map.tile, p.boat.x, p.boat.z);
    const far = p.tema!.barriera + Number(m ?? 30) - b.d + 2;
    const x = p.boat.x + dx * far, z = p.boat.z + dz * far, yaw = Math.atan2(-dx, dz); // prua verso il molo
    (window as unknown as { __game: { test: Record<string, (...a: unknown[]) => unknown> } }).__game.test['setMode']?.('boat');
    world.boat.teleport(x, z, yaw); world.avatar.teleport(x, z);
    return { x, z, yaw };
  });
  /** Test: in barca in (x, z) con la prua a `yaw` (bordo del mondo, #5). */
  registerTestHook('temiBarca', (x, z, yaw) => {
    (window as unknown as { __game: { test: Record<string, (...a: unknown[]) => unknown> } }).__game.test['setMode']?.('boat');
    world.boat.teleport(Number(x), Number(z), Number(yaw ?? 0)); world.avatar.teleport(Number(x), Number(z));
    return true;
  });
  registerTestHook('temiFx', () => caricaFx());

  const temi: Temi = {
    isole,
    aperta: (id) => !!stato[id]?.aperta,
    motivo: (id) => stato[id]?.motivo ?? '',
    update(dt, t) {
      const now = performance.now();
      if (now >= next) { next = now + 500; ricalcola(); }
      const f = world.mode === 'walk' ? world.avatar.state : world.boat.state;
      if (!fxLoad && vicino(f.x, f.z)) void caricaFx();
      fx?.update(dt, t, f);
      // Vulcano (o ogni isola chiusa senza barriera): a piedi lì sopra → fumetto, poi di nuovo in barca
      const qui = world.mode === 'walk' && !world.race.on ? arch.placeAt(world.avatar.state.x, world.avatar.state.z) : null;
      const cacciato = qui?.tema && qui.tema.barriera <= 0 && !stato[qui.island]?.aperta ? qui : null;
      if (cacciato && !caccia) { caccia = { isola: cacciato.island, t: 0 }; cacce++; fx?.caccia(cacciato.island); }
      if (caccia) {
        caccia.t += dt;
        const h = isole.find((p) => p.island === caccia!.isola)?.tema?.sblocco;
        const cap = (h?.tipo === 'cappello' ? AVATAR.cappelli.find((c) => c.id === h.cappello)?.nome : null) ?? 'il cappello giusto';
        fumetto(`«Fuori di qui, forestiero! Senza ${cap} qui non si entra»`);
        if (!cacciato || caccia.t >= CACCIA_S) {
          if (cacciato) { world.reimbarca(); hud.toast(stato[caccia.isola]?.motivo ?? '', 3500); }
          caccia = null; fumetto(null);
        }
      }
    },
  };
  attiva = temi; // Ghiacci e Giardino
  return temi;
}
