// @marea/content: dati di gioco in JSON, tipizzati e validati. Nessuna logica.
import buildings from './buildings.json' with { type: 'json' };
import resources from './resources.json' with { type: 'json' };
import islands from './islands.json' with { type: 'json' };
import avatar from './avatar.json' with { type: 'json' };
import balance from './balance.json' with { type: 'json' };
import regata from './minigames/regata.json' with { type: 'json' };
import pesca from './minigames/pesca.json' with { type: 'json' };
import consegne from './minigames/consegne.json' with { type: 'json' };
import ingorgo from './minigames/ingorgo.json' with { type: 'json' };
import decor from './decor.json' with { type: 'json' };
import archipelago from './archipelago.json' with { type: 'json' };
import scacchi from './scacchi.json' with { type: 'json' };
import perle from './minigames/perle.json' with { type: 'json' }; // Perle
import pinguini from './minigames/pinguini.json' with { type: 'json' }; // Ghiacci
import koi from './minigames/koi.json' with { type: 'json' }; // Giardino
import arrembaggio from './minigames/arrembaggio.json' with { type: 'json' }; // Tempesta
import lava from './minigames/lava.json' with { type: 'json' }; // Vulcano
import type { ArrembaggioCfg, LavaCfg } from './types.ts'; // Tempesta, Vulcano
import type { ArchipelagoDef, AvatarDef, BalanceDef, BuildingDef, ConsegneCfg, DecorDef, IngorgoCfg, IslandDef, PerleCfg, PescaCfg, RegataCfg, ResourceDef, ScacchiCfg } from './types.ts';
import type { PinguiniCfg } from './types.ts'; // Ghiacci
import type { KoiCfg } from './types.ts'; // Giardino
import { validateAll, validateArchipelago, validateTemi } from './schema.ts';

export type * from './types.ts';

export const BUILDINGS = buildings as unknown as readonly BuildingDef[];
export const RESOURCES = resources as unknown as readonly ResourceDef[];
export const ISLANDS = islands as unknown as readonly IslandDef[];
export const AVATAR = avatar as unknown as AvatarDef;
export const BALANCE = balance as unknown as BalanceDef;
export const MINIGAMES_CFG: {
  regata: RegataCfg; pesca: PescaCfg; consegne: ConsegneCfg; ingorgo: IngorgoCfg; perle: PerleCfg;
  pinguini: PinguiniCfg; // Ghiacci
  koi: KoiCfg; // Giardino
  arrembaggio: ArrembaggioCfg; // Tempesta
  lava: LavaCfg; // Vulcano
} = {
  regata: regata as unknown as RegataCfg,
  pesca: pesca as unknown as PescaCfg,
  consegne: consegne as unknown as ConsegneCfg, // Consegne
  ingorgo: ingorgo as unknown as IngorgoCfg, // Ingorgo
  perle: perle as unknown as PerleCfg, // Perle
  pinguini: pinguini as unknown as PinguiniCfg, // Ghiacci
  koi: koi as unknown as KoiCfg, // Giardino
  arrembaggio: arrembaggio as unknown as ArrembaggioCfg, // Tempesta
  lava: lava as unknown as LavaCfg, // Vulcano
};
export const DECOR = decor as unknown as readonly DecorDef[];
export const ARCHIPELAGO = archipelago as unknown as ArchipelagoDef;
export const SCACCHI = scacchi as unknown as ScacchiCfg;

export function decorDef(id: string): DecorDef {
  const d = DECOR.find((x) => x.id === id);
  if (!d) throw new Error(`Decorazione sconosciuta: ${id}`);
  return d;
}

export function building(id: string): BuildingDef {
  const b = BUILDINGS.find((x) => x.id === id);
  if (!b) throw new Error(`Edificio sconosciuto: ${id}`);
  return b;
}
export function island(id: string): IslandDef {
  const i = ISLANDS.find((x) => x.id === id);
  if (!i) throw new Error(`Isola sconosciuta: ${id}`);
  return i;
}
/** [] se tutto è a posto, altrimenti gli errori in italiano. */
export function validateContent(): string[] {
  return [
    ...validateAll({ buildings: [...BUILDINGS], resources: [...RESOURCES], islands: [...ISLANDS], avatar: AVATAR, balance: BALANCE, decor: [...DECOR] }),
    ...validateArchipelago(ARCHIPELAGO, [...ISLANDS]),
    ...validateTemi(ARCHIPELAGO, [...BUILDINGS], AVATAR),
  ];
}
