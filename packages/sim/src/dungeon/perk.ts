// Effetti dei perk dell'albero delle abilità dentro il dungeon (docs/RPG.md §3): Taglio Critico (sanguinamento + rallentamento), Colpo fatale
// (paralisi), Automira (frecce che curvano). I numeri stanno in balance.json → perk; le probabilità e i livelli in perks.json (RunHero.perk).
// Determinismo: solo + − × ÷ e Math.sqrt, il caso viene da s.rng.
import { RPG } from '@marea/content/rpg.ts';
import { DT } from '../constants.ts';
import type { DungeonState, Enemy, Proj } from './state.ts';
import { ev, secToTicks } from './state.ts';

/** Un attacco caricato a segno su `e`: tira i dadi di Taglio Critico (sanguina e rallenta) e Colpo fatale (paralizza). I boss non si
 *  paralizzano e sanguinano molto meno. */
export function statiCaricato(s: DungeonState, e: Enemy): void {
  const P = s.runHero.perk, B = RPG.perk;
  if (!P || !B || e.st === 'morto' || e.vita <= 0 || e.alleato) return;
  if (P.sanguina && s.rng.next() < P.sanguina) {
    const S = B.sanguinamento, fine = s.tick + secToTicks(S.secondi);
    e.emorr = fine; e.emorrPct = S.pctVitaAlSecondo * (e.def.boss ? S.moltBoss : 1);
    e.lentoT = fine; e.lentoMolt = 1 - S.rallenta; e.lentoAcc = 0;
    ev(s, { t: 'sanguinamento', id: e.id });
  }
  if (P.paralisi && !e.def.boss && s.rng.next() < P.paralisi) {
    e.paralisi = s.tick + secToTicks(B.paralisi.secondi);
    // la preparazione di un attacco si interrompe
    if (e.st === 'prepara' || e.st === 'colpisce') { e.st = 'insegue'; e.stT = 0; e.area = false; e.tiro = false; e.comboN = 0; }
    ev(s, { t: 'paralisi', id: e.id });
  }
}

export const paralizzato = (s: DungeonState, e: Enemy): boolean => e.paralisi !== undefined && e.paralisi > s.tick;
export const sanguinante = (s: DungeonState, e: Enemy): boolean => e.emorr !== undefined && e.emorr > s.tick;
export const rallentato = (s: DungeonState, e: Enemy): boolean => e.lentoT !== undefined && e.lentoT > s.tick;

/** Il sanguinamento del Taglio Critico di questo tick: toglie la sua parte di vita massima. true = il nemico è morto. */
export function sanguina(s: DungeonState, e: Enemy): boolean {
  if (!sanguinante(s, e)) return false;
  const d = e.max * (e.emorrPct ?? 0) * DT;
  e.vita -= d; s.danniFatti += d;
  return e.vita <= 0;
}

/** Il nemico fa il suo passo in questo tick? No se è paralizzato; rallentato salta una frazione dei tick (il tempo per lui scorre più
 *  piano, quindi anche i colpi). */
export function passoNemico(s: DungeonState, e: Enemy): boolean {
  if (e.alleato) return true;
  if (paralizzato(s, e)) return false;
  if (rallentato(s, e)) {
    const acc = (e.lentoAcc ?? 0) + (e.lentoMolt ?? 1);
    if (acc < 1) { e.lentoAcc = acc; return false; }
    e.lentoAcc = acc - 1;
  }
  return true;
}

/** Automira: la freccia dell'eroe sterza verso il nemico più vicino che ha davanti (dentro il cono del suo livello). */
export function guidaFreccia(s: DungeonState, p: Proj): void {
  const L = RPG.perk?.automira[(p.guida ?? 0) - 1];
  if (!L) return;
  const v = Math.sqrt(p.vx * p.vx + p.vz * p.vz);
  if (v < 1e-6) return;
  const hx = p.vx / v, hz = p.vz / v;
  let best: Enemy | null = null, bd = Infinity, bx = 0, bz = 0;
  for (const e of s.enemies) {
    if (e.alleato || e.st === 'morto' || p.colpiti.includes(e.id)) continue;
    const dx = e.x - p.x, dz = e.z - p.z, d = Math.sqrt(dx * dx + dz * dz);
    if (d < 0.3 || d > L.gittata || d >= bd) continue;
    if ((dx * hx + dz * hz) / d < L.cos) continue;
    best = e; bd = d; bx = dx / d; bz = dz / d;
  }
  if (!best) return;
  const nx = hx + (bx - hx) * L.k, nz = hz + (bz - hz) * L.k, l = Math.sqrt(nx * nx + nz * nz);
  if (l < 1e-6) return;
  p.vx = (nx / l) * v; p.vz = (nz / l) * v;
}
