// Isola dell'Adrenalina nel mondo (docs/ADRENALINA.md §2-3), la parte che sta nel bundle iniziale: dove sta il cancello della funivia (per la
// bussola) e il caricamento del resto quando ti avvicini all'isola (con ?adrenalina=1 subito). La funivia vera (cavi, cabine, cancello,
// liberatoria, il bottone 🚡 delle prove) è il chunk game/adrenalina_funivia.ts: il JS iniziale ha un tetto (TECH §5).
import type { LotState } from '@marea/sim';
import { distanzaIsola } from '@marea/sim';
import { ISLANDS } from '@marea/content';
import type { GameWorld } from './world.ts';
import type { Renderer } from '../render/scene.ts';
import type { Hud } from '../ui/hud.ts';
import type { Api } from '../net/api.ts';
import { FLAGS } from '../flags.ts';
import { registerTestHook } from '../test/testapi.ts';
import type { Funivia } from './adrenalina_funivia.ts';

export type AdrenalinaOpts = { world: GameWorld; renderer: Renderer; api: Api | null; hud: Hud; root: HTMLElement; getLot(): LotState | null; setLot(l: LotState): void; nome(): string; /** L'isola è aperta (game/temi.ts): firma e casco. */ aperta(): boolean };
export type Adrenalina = {
  /** Il cancello della funivia (per la bussola), null se l'isola non c'è. */
  readonly spot: { id: string; nome: string; x: number; z: number } | null;
  /** Un tick fuori dai minigiochi: vicino al cancello il fronte di A apre la liberatoria o prova a salire. */
  tick(a: boolean): void;
  update(dt: number, t: number): void;
  /** La liberatoria è aperta: il mondo sta fermo. */
  isBusy(): boolean;
};

/** Distanza (m) dal bordo dell'isola entro cui si scarica la funivia. */
const CARICA_M = 220;
/** Il cancello: metri davanti al pivot della stazione a valle, verso il molo (dove si ferma chi vuole salire). */
const CANCELLO_M = 3.2;

export function createAdrenalina(o: AdrenalinaOpts): Adrenalina {
  const arch = o.world.archipelago, place = arch.places.find((p) => p.island === 'adrenalina'), v = ISLANDS.find((i) => i.id === 'adrenalina')?.props?.find((p) => p.k === 'funivia_valle');
  // la stazione a valle guarda a sud (rot π): il cancello è davanti, verso il molo
  const spot = place && v ? { id: 'funivia', nome: 'Funivia', x: (place.origin[0] + v.at[0] + 0.5) * arch.tile, z: (place.origin[1] + v.at[1] + 0.5) * arch.tile + CANCELLO_M } : null;
  let fun: Funivia | null = null, load: Promise<unknown> | null = null;
  const carica = () => (load ??= place && spot ? import('./adrenalina_funivia.ts').then((m) => { fun = m.createFunivia(o, place, spot); }, () => { load = null; }) : Promise.resolve());
  if (FLAGS.adrenalina) void carica(); // prove: il bottone 🚡 lo mette la funivia appena arriva
  /** Test: scarica subito la funivia (lo stato `adrenalina` e gli hook adrenalinaCancello e adrenalinaVista arrivano con lei). */
  registerTestHook('adrenalinaCarica', () => carica().then(() => !!fun));
  return {
    spot,
    isBusy: () => !!fun?.isBusy(),
    tick: (a) => fun?.tick(a),
    update(_dt, t) {
      const f = o.world.mode === 'walk' ? o.world.avatar.state : o.world.boat.state;
      if (!load && place && distanzaIsola(place, arch.tile, f.x, f.z).d < CARICA_M) void carica();
      fun?.update(t);
    },
  };
}
