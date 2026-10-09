// Archivio: dove si muovono i nemici che non camminano soltanto (EnemyDef.muove). Il Drone Idro-Ragno sale anche sulle grate (`grate`),
// l'Aerostato-Spia e l'Astrolabio volano (`vola`: sopra acqua, grate e vuoto, non sopra muri e scaffali). Ognuno ha la sua griglia di
// collisione e il suo flow field verso gli eroi, fatti alla prima richiesta (uguali per tutti: dipendono solo da mappa ed eroi).
// Chi vola sta alto: in mischia lo prendi solo quando scende (`alto`). Le griglie non seguono l'acqua che scende (nel Drenaggio non serve).
// Fucina: il Mastro Forgiatore (`asciutto`) cammina attorno alle cascate d'acqua.
import type { DungeonState, Enemy } from './state.ts';
import { inGioco } from './state.ts';
import { bfs, cellOf } from './map.ts';
import type { Griglia } from './map.ts';
import { FLOW_OGNI } from './tuning.ts';

/** Griglia di collisione di un nemico: quella della mappa, o quella di chi sale sulle grate o vola. */
export function grigliaDi(s: DungeonState, e: Enemy): Griglia {
  const k = e.def.muove;
  if (!k) return s.map;
  let g = s.griglie[k];
  if (!g) {
    const m = s.map;
    // Fucina, il Mastro Forgiatore (`asciutto`): le cascate per lui sono muri (ci entra solo caricando: forgiatore.ts)
    const solid = k === 'vola' ? m.opaque : k === 'asciutto' ? m.solid.map((v, i) => (m.getto[i] ? 1 : v)) : m.solid.map((v, i) => (m.grata[i] ? 0 : v));
    g = { w: m.w, h: m.h, tile: m.tile, opaque: m.opaque, solid };
    s.griglie[k] = g;
  }
  return g;
}

/** Flow field verso gli eroi in gioco sulla griglia del nemico (rifatto ogni FLOW_OGNI tick se gli eroi hanno cambiato cella). */
export function flowDi(s: DungeonState, e: Enemy): Int32Array {
  const k = e.def.muove;
  if (!k) return s.flow;
  const g = grigliaDi(s, e);
  let f = s.flowAlt[k];
  if (!f) { f = { field: new Int32Array(g.w * g.h), key: '', tick: -999 }; s.flowAlt[k] = f; }
  if (s.tick - f.tick >= FLOW_OGNI) {
    f.tick = s.tick;
    const celle = inGioco(s).map((i) => { const h = s.eroi[i]!.hero; return cellOf(g, h.x, h.z); });
    const key = celle.join(',');
    if (key !== f.key) { f.key = key; bfs(g, celle, f.field); }
  }
  return f.field;
}

/** Vola alto: in mischia non lo prendi. L'Aerostato scende quando sgancia (prepara, colpisce, recupera); l'Astrolabio e i suoi anelli
 *  quando lui si ricalibra (recupera). */
export function alto(s: DungeonState, e: Enemy): boolean {
  if (e.def.muove !== 'vola' || e.st === 'morto') return false;
  if (e.def.comportamento === 'astrolabio') return e.st !== 'recupera';
  if (e.def.comportamento === 'anello') {
    const p = s.enemies.find((x) => x.id === e.padre);
    return !!p && p.st !== 'morto' && p.st !== 'recupera';
  }
  return e.st !== 'prepara' && e.st !== 'colpisce' && e.st !== 'recupera';
}

/** Gli anelli-scudo ancora interi di un Astrolabio: finché ce n'è uno lui non prende danni. */
export function schermato(s: DungeonState, e: Enemy): boolean {
  return !!e.diviso && s.enemies.some((x) => x.padre === e.id && x.st !== 'morto');
}
