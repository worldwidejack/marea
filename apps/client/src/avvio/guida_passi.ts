// I passi della guida «Primi passi»: casa → barca → minigioco → spendi le monete, poi le cose nuove: parla al Porto, pesca o perle, mappa,
// un'isola nuova. Senza casa (ospite) niente «entra in casa» né «spendi». I primi quattro restano in testa e in quest'ordine: il vecchio
// progresso salvato (un numero) vale per loro (ui/guida.ts). I passi si contano anche fuori ordine.
import { BORGO } from '@marea/content';
import type { LotState } from '@marea/sim';
import { portaDi } from '../game/borgo.ts';
import type { GameWorld } from '../game/world.ts';
import type { GuidaStep } from '../ui/guida.ts';

type Punto = { x: number; z: number };

export function passiGuida(o: {
  world: GameWorld;
  hasLot: boolean;
  myLot: () => LotState | null;
  /** In casa tua (la stanza del tuo lotto). */
  inCasa: () => boolean;
  /** Partite giocate (salvate nel lotto + quelle di questa visita). */
  giocate: () => number;
  /** Il primo minigioco (la Regata al molo della Laguna). */
  reg: { id: string; nome: string; x: number; z: number } | null;
  porto: { aperto(): string | null; gente(): readonly Punto[] };
  isole: readonly { spawn: Punto; role: string; index: number }[];
  mappa: () => { isOpen(): boolean; vista(id: string): boolean } | null;
}): GuidaStep[] {
  const { world, hasLot, myLot, reg, porto } = o, arch = world.archipelago;
  const porta = world.slot !== null ? portaDi(world, world.slot) : null;
  const portoPl = arch.places.find((p) => p.role === 'porto'), T = arch.tile;
  const negozio = portoPl ? { x: (portoPl.origin[0] + BORGO.negozio.porta[0] + 0.5) * T, z: (portoPl.origin[1] + BORGO.negozio.porta[1] + 0.5) * T } : null;
  const qui = () => (world.mode === 'walk' ? world.avatar.state : world.boat.state);
  const dist = (a: Punto, b: Punto) => Math.hypot(a.x - b.x, a.z - b.z);
  const piuVicino = <T extends Punto>(l: readonly T[]): T | null => { const f = qui(); let best: T | null = null; for (const p of l) if (!best || dist(p, f) < dist(best, f)) best = p; return best; };
  const portoAt = arch.spawnOf(null);
  const barcaTarget = () => { const p = world.boat.object.position; return { x: p.x, y: 1.8, z: p.z }; };
  const isolaVista = (p: { role: string; index: number }) => o.mappa()?.vista(`${p.role}:${p.index}`) ?? false;
  return [
    ...(hasLot ? [{ id: 'casa', titolo: 'Entra in casa tua', come: 'Segui la freccia fino alla tua porta nel Borgo e premi A: dentro metti i mobili con ARREDA.', done: o.inCasa, target: () => (porta ? { x: porta.x, y: world.groundY(porta.x, porta.z) + 2.2, z: porta.z } : null) }] : []),
    { id: 'barca', titolo: 'Sali in barca', come: 'Cammina fino alla barca e premi A: con la barca vai sulle altre isole.', done: () => world.mode === 'boat' || o.giocate() > 0, target: barcaTarget },
    ...(reg ? [{ id: reg.id, titolo: `Vai alla ${reg.nome}`, come: 'Segui la freccia fino alla bandiera: una medaglia vale monete.', done: () => o.giocate() > 0, target: () => ({ x: reg.x, y: 4, z: reg.z }) }] : []),
    ...(hasLot ? [{ id: 'spendi', titolo: 'Spendi le monete', come: 'Compra qualcosa nel Borgo: un mobile al negozio dei mobili o un pezzo in una bottega.', done: () => (myLot()?.ledger.monete?.spent ?? 0) > 0, target: () => {
      if (!negozio) return null;
      const f = qui();
      // in mare la freccia porta al Porto (il Borgo sta attorno), a terra alla porta del negozio dei mobili
      return world.mode === 'boat' && Math.hypot(f.x - negozio.x, f.z - negozio.z) > 45 ? { x: portoAt.x, y: 3, z: portoAt.z } : { x: negozio.x, y: world.groundY(negozio.x, negozio.z) + 2.2, z: negozio.z };
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
