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
import borgo from './borgo.json' with { type: 'json' };
import scacchi from './scacchi.json' with { type: 'json' };
import perle from './minigames/perle.json' with { type: 'json' }; // Perle
import meteo from './meteo.json' with { type: 'json' }; // Meteo (#85)
import rientro from './rientro.json' with { type: 'json' }; // Mentre eri via (#86)
import pinguini from './minigames/pinguini.json' with { type: 'json' }; // Ghiacci
import koi from './minigames/koi.json' with { type: 'json' }; // Giardino
import arrembaggio from './minigames/arrembaggio.json' with { type: 'json' }; // Tempesta
import lava from './minigames/lava.json' with { type: 'json' }; // Vulcano
import corse from './minigames/corse.json' with { type: 'json' }; // Isola delle Corse
import snowboard from './minigames/snowboard.json' with { type: 'json' }; // Isola dell'Adrenalina
import type { ArrembaggioCfg, LavaCfg } from './types.ts'; // Tempesta, Vulcano
import type { ArchipelagoDef, AvatarDef, BorgoDef, BalanceDef, BuildingDef, ConsegneCfg, DecorDef, IngorgoCfg, IslandDef, MeteoCfg, PerleCfg, PescaCfg, RegataCfg, ResourceDef, RientroCfg, ScacchiCfg } from './types.ts';
import type { PinguiniCfg } from './types.ts'; // Ghiacci
import type { KoiCfg } from './types.ts'; // Giardino
import type { CorseCfg } from './types.ts'; // Isola delle Corse
import type { SnowboardMgCfg } from './types.ts'; // Isola dell'Adrenalina
import { validateAll, validateArchipelago, validateTemi } from './schema.ts';
import { DIARIO, validateDiario } from './diario.ts'; // Diario del capitano (#87)

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
  corse: CorseCfg; // Isola delle Corse
  snowboard: SnowboardMgCfg; // Isola dell'Adrenalina
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
  corse: corse as unknown as CorseCfg, // Isola delle Corse
  snowboard: snowboard as unknown as SnowboardMgCfg, // Isola dell'Adrenalina (la discesa: @marea/content/adrenalina.ts)
};
export const DECOR = decor as unknown as readonly DecorDef[];
export const ARCHIPELAGO = archipelago as unknown as ArchipelagoDef;
export const BORGO = borgo as unknown as BorgoDef; // Borgo Marea (#237): una casa per slot
export const SCACCHI = scacchi as unknown as ScacchiCfg;
export const RIENTRO = rientro as unknown as RientroCfg; // Mentre eri via e libro degli ospiti (#86)
export const METEO = meteo as unknown as MeteoCfg;

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
    ...validateBorgo(),
    ...validateDiario(), // Diario del capitano (#87)
    ...DIARIO.minigiochi.filter((m) => !Object.hasOwn(MINIGAMES_CFG, m.id)).map((m) => `diario: minigioco sconosciuto ${m.id}`),
  ];
}

/** Borgo Marea (#237, #247): una casa per ogni lotto, porta su una cella camminabile del template `porto`, edificio su una `L`. */
function validateBorgo(): string[] {
  const errs: string[] = [], lotti = ARCHIPELAGO.islands.filter((i) => i.role === 'lotto').length, t = ISLANDS.find((i) => i.id === 'porto');
  if (BORGO.case.length !== lotti) errs.push(`borgo: ${BORGO.case.length} case ma ${lotti} lotti`);
  if (!t) return [...errs, 'borgo: manca il template porto'];
  for (const [n, c] of BORGO.case.entries()) {
    if (t.rows[c.at[1]]?.[c.at[0]] !== 'L') errs.push(`borgo: la casa ${n} non sta su una L`);
    if (!'.gdP'.includes(t.rows[c.porta[1]]?.[c.porta[0]] ?? '~')) errs.push(`borgo: la porta della casa ${n} non è camminabile`);
    // case a schiera (#265): porte ad almeno due celle (4 m), così uscendo di casa la porta più vicina è la tua (game/borgo.ts)
    for (const [m, d] of BORGO.case.entries()) if (m > n && Math.hypot(c.porta[0] - d.porta[0], c.porta[1] - d.porta[1]) < 2) errs.push(`borgo: le porte delle case ${n} e ${m} sono troppo vicine`);
  }
  const lt = ISLANDS.find((i) => i.id === 'lotto'), st = BORGO.stanza, [x0, z0, x1, z1] = st.pavimento;
  if (lt) {
    for (let z = z0; z < z1; z++) for (let x = x0; x < x1; x++) if (!'.LP'.includes(lt.rows[z]?.[x] ?? '~')) errs.push(`borgo: la stanza ha una cella non di pavimento in ${x},${z}`);
    if (!'.gdP'.includes(lt.rows[st.giardino[1]]?.[st.giardino[0]] ?? '~')) errs.push('borgo: la porta del giardino non è camminabile');
    if (st.retro[1] !== z0) errs.push('borgo: la porta sul retro sta nella prima fila della stanza');
  }
  if (!BORGO.pavimenti.length || !BORGO.carte.length) errs.push('borgo: serve almeno un pavimento e una carta da parati');
  return errs;
}
