// I passi della guida «Primi passi»: costruire → barca → minigioco → costruire col premio, poi le cose nuove: parla al Porto, pesca o
// perle, mappa, un'isola nuova. Senza isola propria niente Segheria né costruisci. I primi quattro restano in testa e in quest'ordine: il
// vecchio progresso salvato (un numero) vale per loro (ui/guida.ts). I passi si contano anche fuori ordine.
import { ISLANDS } from '@marea/content';
import type { LotState } from '@marea/sim';
import type { GameWorld } from '../game/world.ts';
import type { GuidaStep } from '../ui/guida.ts';

type Punto = { x: number; z: number };

/** Dove la guida suggerisce di costruire la Segheria (il cartello giallo sul lotto) mentre è quello il passo. */
export function suggerimento(myLot: () => LotState | null, passo: () => string | null) {
  const tpl = ISLANDS.find((i) => i.id === 'lotto');
  const segCell = tpl?.slots?.find((sl) => sl.kind === 'segheria')?.at ?? null;
  const freeCell = (prefer: readonly [number, number] | null): [number, number] | null => {
    const l = myLot();
    if (!l || !tpl) return null;
    const busy = (c: readonly [number, number]) => l.buildings.some((b) => b.cell[0] === c[0] && b.cell[1] === c[1]) || l.decor.some((d) => d.cell[0] === c[0] && d.cell[1] === c[1]);
    if (prefer && !busy(prefer)) return [prefer[0], prefer[1]];
    const sl = (tpl.slots ?? []).find((x) => !busy(x.at) && x.kind !== 'tavolo');
    return sl ? [sl.at[0], sl.at[1]] : null;
  };
  const hint = (): { cell: [number, number]; building: string } | null => {
    if (passo() !== 'segheria') return null;
    const c = freeCell(segCell);
    return c ? { cell: c, building: 'segheria' } : null;
  };
  return { freeCell, hint };
}

export function passiGuida(o: {
  world: GameWorld;
  hasLot: boolean;
  myLot: () => LotState | null;
  sugg: ReturnType<typeof suggerimento>;
  /** Partite giocate (salvate nel lotto + quelle di questa visita). */
  giocate: () => number;
  /** Il primo minigioco (la Regata al molo della Laguna). */
  reg: { id: string; nome: string; x: number; z: number } | null;
  porto: { aperto(): string | null; gente(): readonly Punto[] };
  isole: readonly { spawn: Punto; role: string; index: number }[];
  mappa: () => { isOpen(): boolean; vista(id: string): boolean } | null;
}): GuidaStep[] {
  const { world, hasLot, myLot, sugg, reg, porto } = o, arch = world.archipelago;
  const home = world.slot !== null ? arch.spawnOf(world.slot) : null, homeDock = world.slot !== null ? arch.boatOf(world.slot) : null;
  const cellTarget = (c: [number, number] | null) => { if (!c || world.slot === null) return null; const w = arch.lotCellToWorld(world.slot, c); return { x: w.x, y: world.groundY(w.x, w.z) + 1.2, z: w.z }; };
  const qui = () => (world.mode === 'walk' ? world.avatar.state : world.boat.state);
  const dist = (a: Punto, b: Punto) => Math.hypot(a.x - b.x, a.z - b.z);
  const piuVicino = <T extends Punto>(l: readonly T[]): T | null => { const f = qui(); let best: T | null = null; for (const p of l) if (!best || dist(p, f) < dist(best, f)) best = p; return best; };
  const portoAt = arch.spawnOf(null);
  const barcaTarget = () => { const p = world.boat.object.position; return { x: p.x, y: 1.8, z: p.z }; };
  const isolaVista = (p: { role: string; index: number }) => o.mappa()?.vista(`${p.role}:${p.index}`) ?? false;
  return [
    ...(hasLot ? [{ id: 'segheria', titolo: 'Costruisci la Segheria', come: 'Tocca il cartello giallo: la Segheria fa Legno anche quando non giochi.', done: () => !!myLot()?.buildings.some((b) => b.building === 'segheria'), target: () => cellTarget(sugg.hint()?.cell ?? null) }] : []),
    { id: 'barca', titolo: 'Sali in barca', come: 'Cammina fino alla barca e premi A: con la barca vai sulle altre isole.', done: () => world.mode === 'boat' || o.giocate() > 0, target: barcaTarget },
    ...(reg ? [{ id: reg.id, titolo: `Vai alla ${reg.nome}`, come: 'Segui la freccia fino alla bandiera: una medaglia vale monete.', done: () => o.giocate() > 0, target: () => ({ x: reg.x, y: 4, z: reg.z }) }] : []),
    ...(hasLot ? [{ id: 'costruisci', titolo: 'Costruisci col premio', come: 'Torna a casa e tocca un cartello: Cava, Magazzino, Casa, Faro.', done: () => (myLot()?.buildings.filter((b) => b.building !== 'molo' && b.building !== 'segheria').length ?? 0) > 0, target: () => {
      const f = qui();
      if (home && homeDock && Math.hypot(f.x - home.x, f.z - home.z) > 45) return { x: homeDock.x, y: 2, z: homeDock.z };
      return cellTarget(sugg.freeCell(null));
    } }] : []),
    { id: 'parla', titolo: 'Fai due chiacchiere al Porto', come: 'Al Porto c\'è gente che parla volentieri, anche troppo. Vai vicino e premi A.', done: () => porto.aperto() === 'parla', target: () => {
      const p = piuVicino(porto.gente());
      return p && dist(p, qui()) < 80 ? { x: p.x, y: world.groundY(p.x, p.z) + 2.4, z: p.z } : { x: portoAt.x, y: 3, z: portoAt.z };
    } },
    { id: 'universale', titolo: 'Pesca o tuffati', come: 'Su acqua bassa vicino a riva: TUFFATI. Con la canna (negozio dei mobili) si pesca dalla riva o dalla barca ferma.', done: () => !!document.querySelector('#mzPescaPanel.on, #mzPerleGioco.on'), target: () => (world.mode === 'walk' ? barcaTarget() : null) },
    { id: 'mappa', titolo: 'Guarda la mappa', come: 'Tocca il cerchio della mappa (o M). Le isole compaiono quando ci passi vicino in barca.', done: () => !!o.mappa()?.isOpen(), target: () => null },
    ...(o.isole.length ? [{ id: 'isola', titolo: 'Scopri un\'isola nuova', come: 'Segui la freccia in mare aperto. Certe isole non ti fanno entrare: è carattere.', done: () => o.isole.some(isolaVista), target: () => {
      const p = piuVicino(o.isole.filter((x) => !isolaVista(x)).map((x) => x.spawn));
      return p ? { x: p.x, y: 3, z: p.z } : null;
    } }] : []),
  ];
}
