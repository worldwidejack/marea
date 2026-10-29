// Il Santuario del Capo Ardente, il capo: Korok, il Cuore di Lava (docs/SANTUARIO.md). Gigante di roccia fusa nell'arena quadrata cinta di lava, coi
// quattro bracieri del Giuramento agli angoli. Il nucleo sul petto è l'unico punto debole: fuori dalle finestre di punizione la corazza di magma smorza
// ogni colpo; dopo ogni attacco il nucleo resta scoperto qualche secondo e un colpo di mischia lo prende più forte.
// LA PRIMA FASE (sopra metà vita): lo SPUTO (due globi di lava di fila, il primo dove sei: cerchio che si riempie, poi un lago di fuoco; dopo la bocca si
// raffredda) e l'EVOCAZIONE DEI MITE (batte i pugni: cerchi sotto i punti da cui nascono i Mite, piccole micce di lava).
// LA SECONDA (sotto metà): l'ONDA DI CALORE (un gran cerchio che si riempie: si salva solo chi sta nell'area di un braciere acceso) e lo SCHIANTO ERUTTIVO
// (cerchio e poi crepe di fuoco; resta incastrato, nucleo scoperto più forte). Sotto un quarto di vita si aggiunge la PIOGGIA DI BRACI.
// I cerchi sono geyser (acque.ts, stepGeyser): qui si decide dove cadono. Niente funzioni trascendenti: le direzioni sono versori.
import type { HitSrc } from './combat.ts';
import type { DungeonState, Enemy } from './state.ts';
import { ev, secToTicks } from './state.ts';
import { lineOfSight } from './map.ts';
import { chase } from './enemies.ts';
import { setState } from './passi.ts';
import { GEYSER_DIR } from './tuning.ts';

const r2 = (v: number): number => Math.round(v * 100) / 100;
type Modo = 'sputo' | 'mites' | 'onda' | 'schianto' | 'pioggia';

/** Tiene Korok dentro il rettangolo dell'arena (il resto è lava). */
function dentro(s: DungeonState, e: Enemy): void {
  const A = s.def.arena;
  if (!A) return;
  const T = s.map.tile, r = e.def.raggio;
  e.x = Math.max(A[0] * T + r, Math.min((A[2] + 1) * T - r, e.x));
  e.z = Math.max(A[1] * T + r, Math.min((A[3] + 1) * T - r, e.z));
}
/** Il punto (x, z) tirato dentro l'arena (con un po' di margine dal bordo di lava). */
function inArena(s: DungeonState, x: number, z: number, margine: number): { x: number; z: number } {
  const A = s.def.arena;
  if (!A) return { x, z };
  const T = s.map.tile;
  return { x: Math.max(A[0] * T + margine, Math.min((A[2] + 1) * T - margine, x)), z: Math.max(A[1] * T + margine, Math.min((A[3] + 1) * T - margine, z)) };
}

/** Un cerchio a terra (geyser) di Korok: si riempie in `caduta` s, poi `danno`. */
function cerchio(s: DungeonState, e: Enemy, x: number, z: number, r: number, caduta: number, danno: number, extra: Partial<DungeonState['geyser'][number]> = {}): void {
  s.geyser.push({ id: s.nextId++, x, z, r, t: 0, avviso: secToTicks(caduta), getto: secToTicks(0.25), danno, colpiti: [], da: e.id, ...extra });
}

/** Il globo `k` dello sputo: dove sei adesso, ma al massimo a `gittata` m da lui (se sei più lontano il globo cade a metà strada). */
function globo(s: DungeonState, e: Enemy): void {
  const S = e.def.korok!.sputo, h = s.hero, dx = h.x - e.x, dz = h.z - e.z, d = Math.sqrt(dx * dx + dz * dz);
  const k = d > S.gittata && d > 1e-6 ? S.gittata / d : 1, p = inArena(s, e.x + dx * k, e.z + dz * k, 1);
  cerchio(s, e, p.x, p.z, S.raggio, S.caduta, S.danno, { spegne: true, magma: { durata: S.fuoco.durata, raggio: S.raggio * 0.8, dps: S.fuoco.dps, secondi: S.fuoco.secondi } });
}

/** Comincia un attacco (telegrafato in `prepara`): i cerchi compaiono subito. */
function inizia(s: DungeonState, e: Enemy, modo: Modo): void {
  const K = e.def.korok!, h = s.hero, dx = h.x - e.x, dz = h.z - e.z, d = Math.sqrt(dx * dx + dz * dz);
  if (d > 1e-6) { e.fx = dx / d; e.fz = dz / d; }
  e.modo = modo; e.salve = 0; e.esp = undefined;
  switch (modo) {
    case 'sputo': globo(s, e); e.salve = 1; setState(e, 'prepara', secToTicks(K.sputo.caduta + K.sputo.ogni * (K.sputo.n - 1))); return;
    case 'mites':
      for (let k = 0; k < K.mites.n; k++) {
        const [ox, oz] = GEYSER_DIR[(e.attacchi * 3 + k * 3) % GEYSER_DIR.length]!, p = inArena(s, h.x + ox * K.mites.distanza, h.z + oz * K.mites.distanza, 1.2);
        cerchio(s, e, p.x, p.z, 1.0, K.mites.caduta, 0, { evoca: K.mites.tipo, senzaDanno: true });
      }
      setState(e, 'prepara', secToTicks(K.mites.caduta)); return;
    case 'onda': cerchio(s, e, e.x, e.z, K.onda.raggio, K.onda.caduta, K.onda.danno, { riparo: true }); setState(e, 'prepara', secToTicks(K.onda.caduta)); return;
    case 'schianto':
      cerchio(s, e, e.x, e.z, K.schianto.raggio, K.schianto.caduta, K.schianto.danno,
        { magma: { durata: K.schianto.crepe.durata, raggio: K.schianto.raggio * 0.85, dps: K.schianto.crepe.dps, secondi: K.schianto.crepe.secondi } });
      setState(e, 'prepara', secToTicks(K.schianto.caduta)); return;
    default: {
      const P = K.pioggia, A = s.def.arena, T = s.map.tile;
      for (let k = 0; k < P.n; k++) {
        let p = { x: h.x, z: h.z };
        if (k >= P.vicine && A) p = { x: (A[0] + 0.5 + s.rng.next() * (A[2] - A[0])) * T, z: (A[1] + 0.5 + s.rng.next() * (A[3] - A[1])) * T };
        else if (k > 0) { const [ox, oz] = GEYSER_DIR[(e.attacchi * 3 + k) % GEYSER_DIR.length]!; p = inArena(s, h.x + ox * 2.4, h.z + oz * 2.4, 1); }
        cerchio(s, e, p.x, p.z, P.raggio, P.caduta, P.danno, { spegne: true });
      }
      setState(e, 'prepara', secToTicks(P.caduta));
    }
  }
}

/** Fine dell'attacco: la finestra di punizione (il nucleo scoperto per `fermo` s, i colpi di mischia × `molt`); senza, subito la pausa. */
function finestra(e: Enemy, fermo: number, molt: number): void {
  if (fermo > 0) { e.modo = 'esposto'; e.esp = molt; setState(e, 'recupera', secToTicks(fermo)); } else { e.modo = undefined; setState(e, 'recupera', 1); }
}

/** Sotto la soglia della fase: il ruggito. Per `cambio` s è intoccabile, poi riparte col ciclo nuovo. */
function cambia(s: DungeonState, e: Enemy): void {
  const K = e.def.korok!;
  e.fase = (e.fase ?? 0) + 1; e.modo = 'cambio'; e.esp = undefined; e.attacchi = 0;
  setState(e, 'recupera', secToTicks(K.cambio));
  ev(s, { t: 'fase', n: e.fase });
}

/** Un colpo dell'eroe su Korok (combat.ts): -1 = intoccabile (il ruggito), se no il moltiplicatore: nella finestra di punizione i colpi di mischia
 *  prendono il nucleo (× `esp`), fuori la corazza di magma li smorza (× `corazza`). */
export function colpoKorok(s: DungeonState, e: Enemy, src: HitSrc): number {
  if (e.modo === 'cambio') { ev(s, { t: 'parato', x: r2(e.x), z: r2(e.z), perche: 'cuore' }); return -1; }
  return e.esp !== undefined ? (src.mischia ? e.esp : 1) : e.def.korok!.corazza;
}

/** Passo di Korok sveglio (dorme e veglia li fa enemies.ts). */
export function stepKorok(s: DungeonState, e: Enemy): void {
  const K = e.def.korok!, h = s.hero, fase = e.fase ?? 0;
  if (e.modo !== 'cambio' && fase < K.soglie.length && e.vita <= e.max * K.soglie[fase]!) { cambia(s, e); return; }
  switch (e.st) {
    case 'insegue': {
      const dx = h.x - e.x, dz = h.z - e.z, d = Math.sqrt(dx * dx + dz * dz);
      if (d > K.sputo.gittata * 0.8 || !lineOfSight(s.map, e.x, e.z, h.x, h.z)) { chase(s, e, K.velocita, 1); dentro(s, e); }
      else if (d > 1e-6) { e.fx = dx / d; e.fz = dz / d; }
      if (d > e.def.vista || e.cdTiro > 0) return; // tra un attacco e l'altro una pausa
      const ciclo = K.cicli[Math.min(fase, K.cicli.length - 1)]!, modo = ciclo[e.attacchi % ciclo.length]!;
      e.attacchi++;
      inizia(s, e, modo);
      return;
    }
    case 'prepara': {
      const dx = h.x - e.x, dz = h.z - e.z, d = Math.sqrt(dx * dx + dz * dz);
      if (d > 1e-6 && e.modo !== 'schianto') { e.fx = dx / d; e.fz = dz / d; }
      // lo sputo: il secondo globo parte `ogni` s dopo il primo, dove sei adesso
      if (e.modo === 'sputo' && (e.salve ?? 0) < K.sputo.n && e.stT === secToTicks(K.sputo.ogni) * (e.salve ?? 0)) { globo(s, e); e.salve = (e.salve ?? 0) + 1; }
      if (e.stT < e.stDur) return;
      switch (e.modo) {
        case 'sputo': finestra(e, K.sputo.fermo, K.sputo.molt); break;
        case 'mites': finestra(e, K.mites.fermo, K.mites.molt); break;
        case 'schianto': finestra(e, K.schianto.fermo, K.schianto.molt); break;
        case 'pioggia': finestra(e, K.pioggia.fermo, K.pioggia.molt); break;
        default: finestra(e, 0, 1);
      }
      return;
    }
    case 'recupera':
      if (e.stT < e.stDur) return;
      e.esp = undefined; e.modo = undefined;
      setState(e, 'insegue', 0); e.cdTiro = secToTicks(K.pausa[Math.min(fase, K.pausa.length - 1)] ?? 1);
      return;
    default:
  }
}
