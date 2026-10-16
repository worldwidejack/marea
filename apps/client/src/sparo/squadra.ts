// Gli avatar della partita (#355): il tuo (si vede in terza persona) e uno per ogni indice di `s.bot` (bersagli del poligono o nemici
// della missione; i rinforzi si caricano subito ma restano nascosti finché non arrivano). Le posizioni dei nemici sono interpolate tra
// due tick (si muovono a 60 Hz, lo schermo può andare a 120). Nemici in maglietta rossa con l'elmetto: si riconoscono al volo.
import * as THREE from 'three';
import type { Look } from '@marea/protocol';
import type { SState } from '@marea/sim/sparo/stato.ts';
import { creaSoldato } from './soldato.ts';
import type { Soldato } from './soldato.ts';

const LOOK_IO: Look = { pelle: 1, capelli: 1, coloreCapelli: 2, vestito: 3, cappello: 0 };
/** I nemici: tutti in rosso con l'elmetto (il tricorno sul modello AI sembrava un vassoio), pelle e capelli diversi. */
const lookNemico = (i: number): Look => ({ pelle: (i * 2 + 1) % 6, capelli: (i * 3 + 4) % 8, coloreCapelli: i % 6, vestito: 1, cappello: 12 });

export type Squadra = {
  readonly io: Soldato | null;
  readonly pronta: boolean;
  /** Prima di ogni passo della sim: le posizioni da cui interpolare. */
  ricorda(s: SState): void;
  aggiorna(s: SState, dt: number, alpha: number, io: { x: number; y: number; z: number; visibile: boolean; yaw: number; pitch: number }): void;
  bocca(chi: number, out: THREE.Vector3): THREE.Vector3 | null;
  colpito(chi: number, forte: number): void;
  armaIo(id: string): void;
  quanti(): number;
};

export function creaSquadra(scene: THREE.Scene, quanti: number, armaIo: string): Squadra {
  let io: Soldato | null = null, pronta = false;
  const altri: (Soldato | null)[] = [];
  const prima: { x: number; z: number }[] = [];
  void (async () => {
    try {
      io = await creaSoldato(scene, LOOK_IO, { arma: armaIo });
      for (let i = 0; i < quanti; i++) { const sd = await creaSoldato(scene, lookNemico(i), { arma: 'mitra' }); sd?.visibile(false); altri.push(sd); }
    } catch (e) { console.warn('[sparo] soldati non caricati', e); }
    pronta = true;
  })();
  return {
    get io() { return io; },
    get pronta() { return pronta; },
    quanti: () => altri.filter(Boolean).length,
    ricorda(s) { s.bot.forEach((b, i) => { prima[i] = { x: b.x, z: b.z }; }); },
    aggiorna(s, dt, alpha, g) {
      if (io) { io.visibile(g.visibile); io.aggiorna(dt, { x: g.x, y: g.y, z: g.z, yaw: g.yaw, pitch: g.pitch, vel: Math.hypot(s.g.vx, s.g.vz), giu: s.g.giu, morto: !!s.g.morto }); }
      altri.forEach((sd, i) => {
        if (!sd) return;
        const b = s.bot[i];
        sd.visibile(!!b);
        if (!b) return;
        const p = prima[i] ?? b, x = p.x + (b.x - p.x) * alpha, z = p.z + (b.z - p.z) * alpha;
        sd.aggiorna(dt, { x, y: b.y, z, yaw: b.yaw, pitch: b.pitch, vel: Math.hypot(b.vx, b.vz), giu: b.giu, morto: !!b.morto });
      });
    },
    bocca(chi, out) { const sd = chi < 0 ? io : altri[chi]; return sd ? sd.bocca(out) : null; },
    colpito(chi, forte) { altri[chi]?.colpito(forte); },
    armaIo(id) { io?.arma(id); },
  };
}
