// La gente che passeggia per il Borgo Marea: ognuno sceglie una meta a caso (quasi sempre sulle vie lastricate, a volte sui prati, in
// riva o sul molo), ci va per il percorso libero (sim/world/cammino.ts: lontano da case, alberi, banchi e acqua), sosta un po' e riparte.
// Chi passeggia è un solido mobile (world.solidi): non lo attraversi tu e non si attraversano tra loro; se uno sta fermo in mezzo,
// l'altro aspetta un attimo e poi gli gira attorno. I numeri stanno in content/collisioni.json (`passeggio`).
// La rete dei percorsi si rifà quando qualcuno aggiunge un solido (botteghe e negozio arrivano dopo, in un chunk).
import { COLLISIONI } from '@marea/content';
import { cercaPercorso, creaRete, penetra } from '@marea/sim';
import type { Rete } from '@marea/sim';
import type { GameWorld } from './world.ts';

type XZ = { x: number; z: number };
export type Passante = {
  readonly id: string; x: number; z: number; yaw: number; anim: 'idle' | 'walk';
  /** Dove sta andando adesso (null = in sosta), per i test. */
  readonly meta: XZ | null;
};
export type Passeggio = {
  /** Un passante che parte da (x, z) e cammina a `velocita` m/s. */
  aggiungi(id: string, x: number, z: number, velocita: number): Passante;
  /** Ogni frame. `fermo(p)`: chi è fermo adesso (ci stai parlando o sei vicino) non si muove. */
  update(dt: number, fermo: (p: Passante) => boolean): void;
  /** La rete dei percorsi è pronta (per i test). */
  readonly pronta: boolean;
};

const PS = COLLISIONI.passeggio;
type Stato = Passante & { v: number; percorso: XZ[]; sosta: number; attesa: number; meta: XZ | null };

export function createPasseggio(o: { world: GameWorld }): Passeggio {
  const w = o.world, arch = w.archipelago, map = w.map, T = arch.tile, solidi = w.solidi;
  const borgo = arch.places.find((p) => p.role === 'porto');
  const passanti: Stato[] = [];
  let rete: Rete | null = null, versione = -1, cambiata = 0, mete: { via: XZ[]; altro: XZ[] } = { via: [], altro: [] };
  // il riquadro della terra del Borgo (celle calpestabili), in metri
  const riq = ((): [number, number, number, number] => {
    if (!borgo) return [0, 0, 1, 1];
    let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
    for (let cz = borgo.origin[1]; cz < borgo.origin[1] + borgo.h; cz++) for (let cx = borgo.origin[0]; cx < borgo.origin[0] + borgo.w; cx++) {
      if (!map.walkable((cx + 0.5) * T, (cz + 0.5) * T)) continue;
      x0 = Math.min(x0, cx); z0 = Math.min(z0, cz); x1 = Math.max(x1, cx + 1); z1 = Math.max(z1, cz + 1);
    }
    return [x0 * T, z0 * T, x1 * T, z1 * T];
  })();
  const lastricato = new Set<number>();
  for (const [x0, z0, x1, z1] of arch.paved) for (let cz = z0; cz <= z1; cz++) for (let cx = x0; cx <= x1; cx++) lastricato.add(cz * 65536 + cx);
  const via = (x: number, z: number) => lastricato.has(Math.floor(z / T) * 65536 + Math.floor(x / T));
  const costo = (x: number, z: number): number => {
    if (via(x, z)) return PS.costo.lastricato;
    const c = map.at(Math.floor(x / T), Math.floor(z / T));
    return c === 'd' ? PS.costo.molo : c === 'g' || c === 'L' ? PS.costo.erba : PS.costo.sabbia;
  };
  function rifai(): void {
    if (!borgo) return;
    rete = creaRete(map, solidi.fissi, { riquadro: riq, raggio: PS.raggio, margine: PS.margine, passo: PS.passo, costo });
    versione = solidi.versione;
    mete = { via: [], altro: [] };
    for (const p of rete.aperti()) (via(p.x, p.z) ? mete.via : mete.altro).push(p);
    // chi è rimasto dentro un solido arrivato adesso (la bottega del chunk) o in un angolo chiuso si sposta al punto libero più vicino e ripensa la strada
    for (const s of passanti) {
      if (!rete.nelGrande(s.x, s.z)) { const q = rete.vicino(s.x, s.z, 8); if (q) { s.x = q.x; s.z = q.z; solidi.mobile(s.id, { x: s.x, z: s.z, r: PS.raggio }); } }
      if (s.percorso.length) { s.percorso = []; s.meta = null; s.sosta = 0.5; }
    }
  }
  const pesca = (l: XZ[]): XZ | null => l.length ? l[Math.floor(Math.random() * l.length)]! : null;
  /** Una meta nuova per `s` (non troppo vicina) e il percorso per arrivarci; false = niente, riprova più tardi. */
  function parti(s: Stato, vieta?: (x: number, z: number) => boolean): boolean {
    if (!rete) return false;
    for (let k = 0; k < 6; k++) {
      const m = s.meta && vieta ? s.meta : pesca(Math.random() < PS.suVia ? mete.via : mete.altro);
      if (!m || (!vieta && Math.hypot(m.x - s.x, m.z - s.z) < 6)) continue;
      const p = cercaPercorso(rete, s, m, vieta);
      if (p && p.length > 1) { s.percorso = p.slice(1); s.meta = m; return true; }
      if (vieta) vieta = undefined; // girarci attorno non si può: un'altra meta
    }
    return false;
  }
  /** Il primo solido mobile (un altro passante, chi sta a un banco) che il cerchio (x, z) toccherebbe. */
  const urta = (s: Stato, x: number, z: number) => solidi.vicini(x, z, PS.raggio, s.id).find((q) => 'r' in q && penetra(q, x, z, PS.raggio).d > 0.01 && penetra(q, s.x, s.z, PS.raggio).d <= 0.01) ?? null;

  return {
    get pronta() { return !!rete; },
    aggiungi(id, x, z, velocita) {
      const s: Stato = { id, x, z, yaw: Math.PI, anim: 'idle', v: velocita, percorso: [], sosta: 1 + Math.random() * 3, attesa: 0, meta: null };
      passanti.push(s); solidi.mobile(id, { x, z, r: PS.raggio });
      return s;
    },
    update(dt, fermo) {
      if (solidi.versione !== versione) {
        // si rifà un secondo dopo l'ultimo solido arrivato (così le botteghe e il negozio entrano tutti in una volta)
        if (cambiata === 0) cambiata = performance.now();
        if (performance.now() - cambiata > 1000 || !rete) { cambiata = 0; rifai(); }
      }
      let pensati = 0; // un percorso nuovo per frame al massimo: A* su 100 m di Borgo costa qualche millisecondo
      for (const s of passanti) {
        s.anim = 'idle';
        if (fermo(s)) continue;
        if (!s.percorso.length) {
          s.sosta -= dt;
          if (s.sosta > 0 || pensati > 0) continue;
          pensati++;
          if (!parti(s)) { s.sosta = 1; continue; }
        }
        const t = s.percorso[0]!, dx = t.x - s.x, dz = t.z - s.z, d = Math.hypot(dx, dz), passo = Math.min(d, s.v * dt);
        const nx = d > 1e-6 ? s.x + (dx / d) * passo : t.x, nz = d > 1e-6 ? s.z + (dz / d) * passo : t.z;
        const davanti = urta(s, nx, nz);
        if (davanti) {
          // qualcuno in mezzo: si aspetta un attimo, poi gli si gira attorno (quadretti chiusi attorno a lui solo per questa ricerca)
          s.attesa += dt;
          if (s.attesa > PS.attesa && pensati === 0) {
            pensati++; s.attesa = 0;
            const c = { x: davanti.x, z: davanti.z }, R = PS.raggio * 2 + PS.margine + 0.1;
            if (!parti(s, (x, z) => Math.hypot(x - c.x, z - c.z) < R)) { s.percorso = []; s.meta = null; s.sosta = 1 + Math.random() * 2; }
          }
          continue;
        }
        s.attesa = 0;
        if (d > 1e-6) {
          const yaw = Math.atan2(dx, -dz), dy = Math.atan2(Math.sin(yaw - s.yaw), Math.cos(yaw - s.yaw));
          s.yaw += Math.max(-8 * dt, Math.min(8 * dt, dy)); // si gira morbido, come l'avatar
        }
        s.x = nx; s.z = nz; s.anim = 'walk';
        solidi.mobile(s.id, { x: s.x, z: s.z, r: PS.raggio });
        if (passo >= d - 1e-6) {
          s.percorso.shift();
          if (!s.percorso.length) { s.meta = null; s.sosta = PS.sosta[0] + Math.random() * (PS.sosta[1] - PS.sosta[0]); }
        }
      }
    },
  };
}
