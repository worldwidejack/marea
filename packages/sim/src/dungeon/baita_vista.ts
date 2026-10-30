// Il Tempio della «Doppia Nera» visto dal client (docs/BAITA.md): tutto quello che ti sposta, ti rallenta o ti fa male si vede prima. Cerchi a terra che si riempiono
// (la trottola dell'Acrobata, la fiasca dell'Alchimista), le tre linee dello Sparaneve, il cono della frenata, il quadrato e la X di Jean-Claude, le bandierine, le chiazze.
import { enemyDef } from '@marea/content/rpg.ts';
import type { DungeonState, Enemy } from './state.ts';
import { secToTicks } from './state.ts';
import type { DungeonView } from './types.ts';
import { lineeRaffica } from './baita.ts';

type VistaNemico = Partial<DungeonView['nemici'][number]>;
const r2 = (v: number): number => Math.round(v * 100) / 100;

/** Quello che il client deve sapere di un nemico del Tempio (niente chiavi per gli altri). */
export function baitaNemico(e: Enemy): VistaNemico {
  const D = e.def, o: VistaNemico = {}, prepara = e.st === 'prepara', m = e.mira;
  if (D.trottola) {
    if (e.modo === 'trottola' && (prepara || e.st === 'colpisce')) { o.attacco = 'trottola'; o.forma = { f: 'cerchio', x: r2(e.x), z: r2(e.z), r: D.trottola.raggio, ...(prepara ? {} : { fisso: true }) }; }
    else if (e.modo === 'capogiro') o.attacco = 'capogiro';
  } else if (D.fiasche) {
    if (e.modo === 'fiasca' && prepara && m) { o.attacco = 'fiasca'; o.mira = [r2(m.dx), r2(m.dz)]; o.forma = { f: 'cerchio', x: r2(m.dx), z: r2(m.dz), r: D.fiasche.raggio, tipo: e.attacchi % 2 === 1 ? 'sciolina' : 'bombardino' }; }
  } else if (D.raffica) {
    if (e.modo === 'raffica' && prepara) { o.attacco = 'raffica'; o.linee = lineeRaffica(e).map(([dx, dz]) => [r2(e.x + dx * D.raffica!.gittata), r2(e.z + dz * D.raffica!.gittata)]); }
  } else if (D.claude) {
    const C = D.claude;
    o.fase = e.fase ?? 0;
    if (e.modo === 'frenata' && prepara) { o.attacco = 'frenata'; o.cono = [C.frenata.gittata, C.frenata.cono]; }
    else if (e.modo === 'salto' && prepara && m) {
      o.attacco = 'salto'; o.forma = { f: 'quadro', x: r2(m.dx), z: r2(m.dz), r: C.salto.lato, ...(e.stT >= e.stDur - secToTicks(C.salto.blocco) ? { fisso: true } : {}) };
      if (e.stT > secToTicks(0.3)) o.volo = true;
    } else if (e.modo === 'lamina' && prepara && m) { o.attacco = 'lamina'; o.forma = { f: 'x', x: r2(m.dx), z: r2(m.dz), r: C.lamina.lato }; }
    else if (e.modo === 'slalom' && e.st !== 'recupera') o.attacco = 'slalom';
    else if (e.modo === 'bilico' || e.modo === 'arbitro') o.attacco = e.modo;
  }
  return o;
}

/** Ghiaccio sciolto, chiazze e bandierine (negli altri dungeon niente chiavi in più: vista e hash restano quelli di sempre). */
export function baitaMondo(s: DungeonState): Partial<Pick<DungeonView, 'sciolti' | 'pozze' | 'bandierine'>> {
  if (s.dungeon !== 'baita') return {};
  const durata = s.pozzanghere.length ? secToTicks(enemyDef('alchimista_bombardino').fiasche!.durata) : 1, zona = s.bandierine.length ? enemyDef('jean_claude').claude!.slalom.onda.raggio : 0;
  return {
    sciolti: [...s.sciolti],
    pozze: s.pozzanghere.map((p) => ({ id: p.id, x: r2(p.x), z: r2(p.z), r: p.r, tipo: p.tipo, t: r2(Math.max(0, Math.min(1, 1 - (p.fine - s.tick) / durata))) })),
    bandierine: s.bandierine.map((b) => ({ id: b.id, n: b.n, x: r2(b.x), z: r2(b.z), r: zona, abbattuta: b.abbattuta })),
  };
}
