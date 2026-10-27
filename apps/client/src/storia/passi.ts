// I passi della storia sulla scheda obbligatoria (ui/guida.ts `obbligatoria`): dalla casa alla barca comprata. Fatto = quello che dice il
// server (`lot.storia.fatti`, poi `storia.barca`). La freccia punta chi tocca (`chi` di storia.json): la porta di casa, il negozio di Fulvio
// (dentro niente freccia: è lì al banco), il Cantiere di Bepi, il banco del Furetto, la gente del Porto. L'ultimo passo è la barca: le monete
// che salgono e un consiglio a giro per farle; quando bastano, la freccia torna al Cantiere.
import { BORGO } from '@marea/content';
import { STORIA } from '@marea/content/storia.ts';
import { moneteOf } from '@marea/sim/economy/monete.ts';
import type { LotState } from '@marea/sim';
import { portaDi } from '../game/borgo.ts';
import type { Botteghe } from '../game/botteghe.ts';
import type { Negozio } from '../game/negozio.ts';
import type { Porto } from '../game/porto.ts';
import type { GameWorld } from '../game/world.ts';
import type { GuidaStep } from '../ui/guida.ts';

type XZ = { x: number; z: number };
/** Ogni quanti secondi cambia il consiglio per fare monete. */
const CONSIGLIO_S = 9;

export function passiStoria(o: {
  world: GameWorld; porto: Porto; getLot(): LotState | null; negozio(): Negozio | null; botteghe(): Botteghe | null;
}): GuidaStep[] {
  const { world } = o, arch = world.archipelago, T = arch.tile, borgo = arch.places.find((p) => p.role === 'porto');
  const porta = world.slot !== null ? portaDi(world, world.slot) : null;
  const negozio = borgo ? { x: (borgo.origin[0] + BORGO.negozio.porta[0] + 0.5) * T, z: (borgo.origin[1] + BORGO.negozio.porta[1] + 0.5) * T } : null;
  const dove = (chi: string | undefined): XZ | null => {
    if (chi === 'fulvio') return o.negozio()?.dentro ? null : negozio;
    if (chi === 'bepi') return o.botteghe()?.spots.find((s) => s.id === 'cantiere') ?? null;
    if (chi === 'furetto') return o.porto.spots.find((s) => s.id === 'contrabbando') ?? null;
    return chi ? o.porto.dove(chi) : null;
  };
  const su = (p: XZ | null): { x: number; y: number; z: number } | null => (p ? { x: p.x, y: world.groundY(p.x, p.z) + 2.4, z: p.z } : null);
  const fatti = () => o.getLot()?.storia?.fatti ?? [];
  const prezzo = STORIA.barca.prezzo, consigli = STORIA.barca.consigli;
  const monete = () => { const l = o.getLot(); return l ? moneteOf(l) : 0; };
  const passi = STORIA.passi.slice(STORIA.passi.findIndex((p) => p.id === 'casa'));
  return [
    ...passi.map((p): GuidaStep => ({
      id: p.id, titolo: p.titolo, come: p.come, done: () => fatti().includes(p.id),
      target: () => su(p.id === 'casa' ? porta : dove(p.chi)),
    })),
    {
      id: 'barca',
      get titolo() { return `La barca · ${Math.min(monete(), prezzo)}/${prezzo} monete`; },
      get come() { return monete() >= prezzo ? 'Ci sono! Torna da Bepi al Cantiere e comprala.' : consigli[Math.floor(performance.now() / 1000 / CONSIGLIO_S) % consigli.length]!; },
      done: () => !!o.getLot()?.storia?.barca,
      target: () => (monete() >= prezzo ? su(dove('bepi')) : null),
    },
  ];
}
