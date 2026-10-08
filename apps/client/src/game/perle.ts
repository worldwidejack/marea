// Perle: il «posto mobile» della caccia alle perle (minigioco universale). Non sta su un'isola: ci si tuffa dalla barca ferma su acqua
// bassa ',' vicino a una costa, lontano dai moli (regola pura in @marea/sim `perleQui`; la pesca invece è su acqua profonda '~', così i
// due bottoni non si sovrappongono mai). Lì compare il bottone TUFFATI (e vale il tasto T; la A resta l'acceleratore della barca).
// La schermata del gioco è ui/perle.ts, scaricata alla prima partita (registraSchermo in game/minigiochi.ts).
import { MINIGAMES_CFG } from '@marea/content';
import { cercaPerle, perleQui } from '@marea/sim';
import type { PerleQui } from '@marea/sim';
import type { GameWorld } from './world.ts';
import type { Hud } from '../ui/hud.ts';
import type { Spot } from './minigiochi.ts';
import { el } from '../ui/style.ts';
import { pixIcon } from '../ui/icons.ts';
import { registerStateProvider, registerTestHook } from '../test/testapi.ts';

const CFG = MINIGAMES_CFG.perle;
/** Ogni quanti tick si ricontrolla il posto (la regola guarda le celle attorno alla barca). */
const OGNI = 6;
const AVVISO_MS = 20_000;

export type PostoPerle = { tick(): void; update(): void; readonly ok: boolean };

export function createPostoPerle(o: { world: GameWorld; root: HTMLElement; hud: Hud; libero(): boolean; gioca(s: Spot): void }): PostoPerle {
  const arch = o.world.archipelago;
  let q: PerleQui = { ok: false, perche: 'acqua' }, n = 0, ok = false, okWas = false, avvisoAt = -AVVISO_MS;
  const btn = el('button', 'mz mz-play'); btn.id = 'mzPerle'; btn.type = 'button';
  btn.append(pixIcon('perle', 24), el('span', '', 'TUFFATI · PERLE'), el('small', '', 'T'));
  for (const ev of ['pointerdown', 'touchstart']) btn.addEventListener(ev, (x) => x.stopPropagation());
  o.root.appendChild(btn);

  const controlla = () => {
    const b = o.world.boat.state;
    q = perleQui(arch, b.x, b.z, b.speed);
    ok = o.world.mode === 'boat' && !o.world.race.on && q.ok && o.libero();
  };
  const spot = (): Spot => {
    const b = o.world.boat.state;
    return { id: 'perle', nome: CFG.nome, minigame: 'perle', x: b.x, z: b.z, icon: 'perle', near: 0, boa: false };
  };
  /** Bottone o tasto T: parte se si può, altrimenti dice perché no (solo se si è in barca: a piedi la T non fa niente). */
  const prova = (): boolean => {
    controlla();
    if (ok) { o.gioca(spot()); return true; }
    if (!o.libero() || o.world.race.on || o.world.mode !== 'boat') return false;
    o.hud.toast(q.perche === 'veloce' ? 'Ferma la barca per tuffarti'
      : q.perche === 'molo' ? 'Troppo vicino al molo: spostati lungo la costa'
      : 'Le perle stanno in acqua bassa: avvicinati a una costa', 2200);
    return false;
  };
  btn.addEventListener('click', () => { prova(); });
  addEventListener('keydown', (e) => {
    if (e.code !== 'KeyT' || e.repeat || e.altKey || e.ctrlKey || e.metaKey) return;
    prova();
  });

  registerStateProvider('perlePosto', () => ({ ok, perche: q.perche, bottone: btn.classList.contains('on') }));
  registerTestHook('perle', () => prova());
  /** Test: porta la barca (serve essere già in barca: setMode('boat')) nel punto da tuffo più vicino. */
  registerTestHook('perleVai', () => {
    const b = o.world.boat.state, p = cercaPerle(arch, b.x, b.z);
    if (!p) return null;
    o.world.boat.teleport(p.x, p.z); o.world.avatar.teleport(p.x, p.z);
    controlla();
    return p;
  });

  return {
    get ok() { return ok; },
    tick() {
      if (++n % OGNI === 0 || ok) controlla();
      if (ok && !okWas && performance.now() - avvisoAt > AVVISO_MS) { avvisoAt = performance.now(); o.hud.toast(`Acqua bassa: qui ci sono perle · ${matchMedia('(pointer: coarse)').matches ? 'tocca TUFFATI' : 'T'}`, 2500); }
      okWas = ok;
    },
    update() { btn.classList.toggle('on', ok && o.libero()); },
  };
}
