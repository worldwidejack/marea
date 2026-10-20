// Borgo Marea (#237, #247, #265): le porte delle case attorno alla piazza del Porto. La stanza di una casa sta nel template `lotto` di
// quello slot (nella fascia oltre il mare che la barca non raggiunge). Dalla città si entra in casa solo con A davanti alla porta
// (camminarci contro non fa niente: si entrava per sbaglio); in fondo al corridoio della stanza si esce in città anche camminando (#265).
// Ogni passaggio è un teletrasporto dietro al velo nero (ui/velo.ts). Casa di un amico = sola lettura.
import { BORGO } from '@marea/content';
import type { GameWorld } from './world.ts';
import type { Hud } from '../ui/hud.ts';
import type { Velo } from '../ui/velo.ts';
import { el } from '../ui/style.ts';
import { pixIcon } from '../ui/icons.ts';
import { registerStateProvider, registerTestHook } from '../test/testapi.ts';

export type Borgo = {
  /** Un tick (60 Hz): vicino a una porta il fronte di salita di A entra/esce; camminando dentro un passaggio lo attraversi. true = A è delle porte. */
  tick(a: boolean): boolean;
  update(): void;
};
type XZ = { x: number; z: number };
/** Una casa: porta in città (x, z), facciata (`muro`: lì contro si entra), arrivo in cima al corridoio (`dentro`), fondo del corridoio
 *  (`p`: lì A esce), origine del lotto (`o`). */
type Porta = { slot: number; x: number; z: number; muro: XZ; verso: XZ; dentro: XZ; p: XZ; o: XZ; nome: string | null; mia: boolean };
type Dove = 'entra' | 'esci';

const RAGGIO = 2.2;
const ST = BORGO.stanza, [CX, C0, C1] = ST.corridoio;

/** Dove sta la porta della casa `slot` nel mondo (m), null se non c'è il Borgo o la casa. `fuori` = metri fuori dalla porta, sulla via (lo spawn). */
export function portaDi(world: Pick<GameWorld, 'archipelago'>, slot: number, fuori = 0): { x: number; z: number } | null {
  const arch = world.archipelago, b = arch.places.find((p) => p.role === 'porto'), c = BORGO.case[slot];
  if (!b || !c) return null;
  // dritto fuori dalla porta (#265: le case sono a schiera, a due celle l'una dall'altra; la porta più vicina resta la tua)
  const dx = c.porta[0] - c.at[0], dz = c.porta[1] - c.at[1], l = Math.hypot(dx, dz) || 1;
  return { x: (b.origin[0] + c.porta[0] + 0.5) * arch.tile + (dx / l) * fuori, z: (b.origin[1] + c.porta[1] + 0.5) * arch.tile + (dz / l) * fuori };
}

export function createBorgo(o: { world: GameWorld; hud: Hud; root: HTMLElement; velo: Velo; abitanti: readonly { slot: number | null; nome: string; mia: boolean }[]; /** true = A è d'altri (il leggio del libro accanto alla porta): le porte non rispondono. */ cede?: () => boolean }): Borgo {
  const w = o.world, arch = w.archipelago, T = arch.tile;
  const porte: Porta[] = [];
  for (const l of arch.lots) {
    const p = portaDi(w, l.slot), c = BORGO.case[l.slot];
    if (!p || !c) continue;
    const chi = o.abitanti.find((a) => a.slot === l.slot) ?? null;
    const cella = (cx: number, cz: number): XZ => ({ x: (l.origin[0] + cx + 0.5) * T, z: (l.origin[1] + cz + 0.5) * T });
    const dx = c.at[0] - c.porta[0], dz = c.at[1] - c.porta[1], n = Math.hypot(dx, dz) || 1, verso = { x: dx / n, z: dz / n };
    porte.push({
      slot: l.slot, ...p, verso, muro: { x: p.x + verso.x * 0.9, z: p.z + verso.z * 0.9 }, dentro: cella(CX, C0), p: { x: cella(CX, C1 - 1).x, z: (l.origin[1] + C1 - 0.1) * T },
      o: { x: l.origin[0] * T, z: l.origin[1] * T }, nome: chi?.nome ?? null, mia: !!chi?.mia,
    });
  }
  // entra: dalla città nella stanza · esci: dalla stanza in città
  type Vicino = { porta: Porta; esci: boolean; dove: Dove };
  let near: Vicino | null = null, nearWas = '', aWas = false;
  const libero = () => w.mode === 'walk' && !w.frozen && !w.race.on && !o.velo.attivo;
  const trova = (): Vicino | null => {
    if (!libero() || o.cede?.()) return null;
    // la porta più vicina entro RAGGIO (le case a schiera hanno le porte a 4 m: i cerchi si toccano)
    const f = w.avatar.state;
    let best: Vicino | null = null, bd = RAGGIO;
    const prova = (p: Porta, q: XZ, esci: boolean, dove: Dove) => { const d = Math.hypot(f.x - q.x, f.z - q.z); if (d < bd) { bd = d; best = { porta: p, esci, dove }; } };
    for (const p of porte) { prova(p, p, false, 'entra'); prova(p, p.p, true, 'esci'); }
    return best;
  };
  /** Passaggio attraversato camminando: in fondo al corridoio. */
  const attraversa = (): Vicino | null => {
    if (!libero()) return null;
    const f = w.avatar.state, sp = Math.hypot(f.vx, f.vz);
    if (sp < 0.5) return null;
    for (const p of porte) {
      // in città la porta di casa NON si attraversa camminando (si rischiava di entrare per sbaglio): si entra solo con A
      const cx = (f.x - p.o.x) / T, cz = (f.z - p.o.z) / T;
      // nella stanza: in fondo al corridoio verso sud si esce
      if (Math.abs(cx - CX - 0.5) < 0.9 && cz > C1 - 0.4 && cz < C1 && f.vz > 0) return { porta: p, esci: true, dove: 'esci' };
    }
    return null;
  };
  const testo = (v: Vicino) => v.esci ? 'Esci in città' : v.porta.mia ? 'Entra in casa' : v.porta.nome ? `Casa di ${v.porta.nome}` : 'Casa libera';
  const NORD = 0;
  const salto = (v: Vicino) => {
    const p = v.porta;
    if (v.esci) { w.aPiedi(p.x - p.verso.x * 1, p.z - p.verso.z * 1, Math.atan2(-p.verso.x, p.verso.z)); return; } // un passo fuori dalla porta, di spalle alla casa
    w.aPiedi(p.dentro.x, p.dentro.z - 0.2, NORD); // in cima al corridoio, guardando la stanza
  };
  const vai = (v: Vicino) => {
    if (v.dove === 'entra' && !v.esci && !v.porta.nome) { o.hud.toast('Questa casa non è ancora di nessuno', 2200); return; }
    void o.velo.passa(() => salto(v)).then((ok) => {
      if (ok && v.dove === 'entra') o.hud.toast(v.porta.mia ? 'Casa tua: con ARREDA metti i mobili' : `Sei da ${v.porta.nome}: guarda pure, non si tocca`, 2600);
    });
  };

  const btn = el('button', 'mz mz-play mz-libro-btn'); btn.id = 'mzPortaBtn'; btn.type = 'button';
  for (const ev of ['pointerdown', 'touchstart']) btn.addEventListener(ev, (x) => x.stopPropagation());
  btn.addEventListener('click', () => { if (near) vai(near); });
  o.root.appendChild(btn);

  // le case libere non si attraversano: contro la facciata non succede niente (lo dice il bottone)
  let passato = '';
  registerStateProvider('borgo', () => ({ near: near ? { slot: near.porta.slot, esci: near.esci, dove: near.dove } : null, passato, porte: porte.map((p) => ({ slot: p.slot, x: p.x, z: p.z, nome: p.nome, mia: p.mia, muro: p.muro, verso: p.verso })) }));
  // test: i passaggi istantanei (senza velo), come prima, e quelli veri col velo (`conVelo`)
  const hook = (slot: unknown, v: Omit<Vicino, 'porta'>, conVelo: unknown) => { const p = porte.find((x) => x.slot === Number(slot)); if (!p) return false; if (conVelo) vai({ porta: p, ...v }); else salto({ porta: p, ...v }); return true; };
  registerTestHook('porta', (slot, conVelo) => hook(slot, { esci: false, dove: 'entra' }, conVelo));
  registerTestHook('esciDiCasa', (slot, conVelo) => hook(slot, { esci: true, dove: 'esci' }, conVelo));

  return {
    tick(a) {
      const pressA = a && !aWas; aWas = a;
      near = trova();
      const k = near ? `${near.porta.slot}:${near.dove}` : '';
      if (near && k !== nearWas) o.hud.toast(`${testo(near)}: premi A`, 2000);
      nearWas = k;
      if (near && pressA) { vai(near); return true; }
      const x = attraversa();
      if (x && (x.esci || x.dove !== 'entra' || x.porta.nome)) { passato = `${x.porta.slot}:${x.dove}`; vai(x); }
      return !!near;
    },
    update() {
      const show = !!near;
      const k = near ? `${near.porta.slot}:${near.dove}` : '';
      if (show && near && btn.dataset['k'] !== k) { btn.dataset['k'] = k; btn.replaceChildren(pixIcon('casa', 24), el('span', '', testo(near).toUpperCase()), el('small', '', 'A')); }
      btn.classList.toggle('on', show);
    },
  };
}
