// Mausoleo Cinetico: gli unici della Regina addosso all'eroe (docs/RPG.md §2f, numeri in items.json → Traits).
// - Armatura del Moto Perpetuo, BARRIERA CINETICA: muoversi la carica; piena, annulla il prossimo colpo e respinge chi sta vicino.
// - Fendiflutti, TAGLIO A PRESSIONE: ogni attacco scaglia una lama d'acqua che trapassa (il caricato un ventaglio), finché c'è pressione.
// - La Grande Lancetta, TIC-TAC: i colpi a tempo col tic salgono di danno; il quinto di fila è il Rintocco, che stordisce.
// - Arco Carillon, CARICA A MOLLA: niente tensione, colpi pieni subito, si ricarica da solo un colpo alla volta.
// - Anello dell'Onda della Regina, ECO DELLA MAREA: i colpi in mischia liberano un'onda che prende i nemici attorno a chi colpisci.
// Tutto sull'eroe di turno; senza questi oggetti non succede niente (le funzioni escono subito).
import { DT } from '../constants.ts';
import type { DungeonState, Enemy } from './state.ts';
import { ev, secToTicks } from './state.ts';
import { buff, hitEnemy } from './combat.ts';
import { moveCircle } from './map.ts';
import { alto, grigliaDi } from './muove.ts';
import { FRECCIA_Y, HZ } from './tuning.ts';

const r2 = (v: number): number => Math.round(v * 100) / 100;

/** Barriera Cinetica: a ogni tick in movimento si carica (correndo più in fretta); quando torna piena lo dice. */
export function caricaBarriera(s: DungeonState): void {
  const b = s.runHero.armatura.barriera, h = s.hero;
  if (!b || !h.moving || h.barr >= 1) return;
  h.barr = Math.min(1, h.barr + (DT / b.secondi) * (h.running ? b.corsa : 1));
  if (h.barr >= 1) ev(s, { t: 'barrieraPronta' });
}

/** Un colpo sta per arrivare sull'eroe di turno: se la Barriera è piena lo annulla (true), si scarica e respinge i nemici vicini
 *  (interrompe chi prepara un colpo; i capi non si spostano). */
export function barriera(s: DungeonState): boolean {
  const b = s.runHero.armatura.barriera, h = s.hero;
  if (!b || h.barr < 1) return false;
  h.barr = 0;
  ev(s, { t: 'barriera', x: r2(h.x), z: r2(h.z) });
  for (const e of s.enemies) {
    if (e.alleato || e.st === 'morto' || e.def.boss || alto(s, e) || e.def.comportamento === 'torretta' || e.def.comportamento === 'anello') continue;
    const dx = e.x - h.x, dz = e.z - h.z, d = Math.sqrt(dx * dx + dz * dz);
    if (d > b.raggio + e.def.raggio) continue;
    if (e.st === 'prepara') { e.st = 'recupera'; e.stT = 0; e.stDur = secToTicks(e.def.recupero); }
    moveCircle(grigliaDi(s, e), e, d > 1e-6 ? (dx / d) * b.spinta : h.fx * b.spinta, d > 1e-6 ? (dz / d) * b.spinta : h.fz * b.spinta, e.def.raggio);
  }
  return true;
}

/** Comincia un colpo in mischia (normale o caricato): lame del Fendiflutti e ritmo della Grande Lancetta. */
export function inizioColpo(s: DungeonState, caricato: boolean): void {
  const h = s.hero, a = h.arma, L = a.traits.lame, R = a.traits.ritmo;
  if (L) {
    if (s.tick - h.ultimoAttacco >= secToTicks(L.ricarica)) h.pressione = L.cariche; // fermo abbastanza: pressione piena
    if (h.pressione > 0) {
      h.pressione--;
      const n = caricato ? Math.max(1, L.ventaglio) : 1, danno = a.danno * L.frazione * (1 + buff(s, a.classe === 'pesante' ? 'dannoPesanti' : 'dannoLeggere'));
      for (let k = 0; k < n; k++) {
        const o = (k - (n - 1) / 2) * 0.35, vx = h.fx - h.fz * o, vz = h.fz + h.fx * o, l = Math.sqrt(vx * vx + vz * vz);
        s.proj.push({
          id: s.nextId++, tipo: 'lama', x: h.x + (vx / l) * 0.5, y: FRECCIA_Y - 0.3, z: h.z + (vz / l) * 0.5, vx: (vx / l) * L.velocita, vy: 0, vz: (vz / l) * L.velocita, g: 0,
          danno, life: secToTicks(L.gittata / L.velocita), traits: { trapassa: true }, raggio: 0, colpiti: [], dalNemico: false, contundente: false, magico: false, arrowId: null, da: s.cur,
        });
      }
    }
  }
  h.ultimoAttacco = s.tick;
  h.rintocco = false;
  if (R && !caricato) {
    // a tempo: il colpo parte entro la finestra attorno al tic (che batte poco dopo la fine del colpo di prima)
    const aTempo = h.tic >= 0 && Math.abs(s.tick - h.tic) <= Math.round(R.finestra * HZ);
    h.ritmo = aTempo ? Math.min(R.colpi, h.ritmo + 1) : 0;
    if (h.ritmo >= R.colpi) { h.rintocco = true; ev(s, { t: 'rintocco', x: r2(h.x), z: r2(h.z) }); }
  }
}
/** Moltiplicatore del danno del colpo in corso per il ritmo (1 senza la Grande Lancetta o col caricato). */
export function moltRitmo(s: DungeonState): number {
  const h = s.hero, R = h.arma.traits.ritmo;
  return R && !h.caricato ? 1 + R.passo * h.ritmo : 1;
}
/** Fine di un colpo: il prossimo tic batte tra `attesa` s; dopo il Rintocco il ritmo riparte da zero. */
export function fineColpo(s: DungeonState): void {
  const h = s.hero, R = h.arma.traits.ritmo;
  if (!R) return;
  h.tic = s.tick + secToTicks(R.attesa);
  if (h.rintocco) { h.ritmo = 0; h.rintocco = false; }
}
/** Ogni tick: il tic della Grande Lancetta (suono), il ritmo che si perde a stare fermi; le molle dell'Arco Carillon che si ricaricano. */
export function stepUnici(s: DungeonState): void {
  const h = s.hero, a = h.arma, R = a.traits.ritmo, M = a.traits.carillon;
  if (R && h.tic === s.tick && h.act === 'idle') ev(s, { t: 'tic' });
  if (R && h.ritmo > 0 && h.act === 'idle' && s.tick - h.tic > secToTicks(R.reset)) h.ritmo = 0;
  if (M && h.molla < M.colpi && s.tick >= h.mollaT) {
    h.molla++;
    ev(s, { t: 'carillon', n: h.molla });
    if (h.molla < M.colpi) h.mollaT = s.tick + secToTicks(M.ricarica);
  }
}
/** Arco Carillon, al tocco di A: true = scarico (niente tiro); false = una molla in meno, si tira subito a tensione piena. */
export function molla(s: DungeonState): boolean {
  const h = s.hero, M = h.arma.traits.carillon;
  if (!M) return false;
  if (h.molla <= 0) { ev(s, { t: 'scarico' }); return true; }
  if (h.molla >= M.colpi) h.mollaT = s.tick + secToTicks(M.ricarica); // la ricarica parte dal primo colpo tirato
  h.molla--;
  return false;
}

/** Il Rintocco: chi prende il colpo resta stordito (i capi no). */
export function stordisci(s: DungeonState, e: Enemy): void {
  const R = s.hero.arma.traits.ritmo;
  if (!R || !s.hero.rintocco || e.def.boss || e.st === 'morto') return;
  e.stordito = s.tick + secToTicks(R.stordisce);
  if (e.st === 'prepara' || e.st === 'colpisce') { e.st = 'insegue'; e.stT = 0; e.area = false; e.tiro = false; }
}

/** Eco della Marea: colpito `e` in mischia con `danno`, un'onda prende gli altri nemici attorno a lui (al massimo una ogni `ogni` s). */
export function eco(s: DungeonState, e: Enemy, danno: number): void {
  const E = s.runHero.eco, h = s.hero;
  if (!E || s.tick - h.ecoT < secToTicks(E.ogni)) return;
  h.ecoT = s.tick;
  ev(s, { t: 'eco', x: r2(e.x), z: r2(e.z) });
  for (const o of s.enemies) {
    if (o === e || o.alleato || o.st === 'morto' || alto(s, o)) continue;
    const dx = o.x - e.x, dz = o.z - e.z, r = E.raggio + o.def.raggio;
    if (dx * dx + dz * dz > r * r) continue;
    hitEnemy(s, o, { danno: danno * E.frazione, traits: {}, magico: false, skill: h.arma.skill, caricato: false, dirX: 0, dirZ: 0, daAlleato: false, ox: e.x, oz: e.z });
  }
}
