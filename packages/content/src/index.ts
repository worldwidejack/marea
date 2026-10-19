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
import mobili from './mobili.json' with { type: 'json' }; // Mobili della casa (#265)
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
import type { MobileDef } from './types.ts'; // Mobili della casa (#265)
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
export const MOBILI = (mobili as unknown as { mobili: MobileDef[] }).mobili as readonly MobileDef[]; // Mobili della casa (#265)
/** Quanti mobili espone il negozio ogni giorno: a terra (pedane) e a parete (muro). Il pool è tutto mobili.json (economy/vetrina.ts). */
export const MOBILI_VETRINA = (mobili as unknown as { vetrina: { terra: number; parete: number; carte: number; pavimenti: number } }).vetrina;
/** Le categorie del catalogo del negozio dei mobili (ordine = ordine delle schede). Un mobile ha esattamente una di queste in `categoria`. */
export const MOBILI_CATEGORIE = (mobili as unknown as { categorie: { id: string; nome: string }[] }).categorie as readonly { id: string; nome: string }[];
export const SCACCHI = scacchi as unknown as ScacchiCfg;
export const RIENTRO = rientro as unknown as RientroCfg; // Mentre eri via e libro degli ospiti (#86)
export const METEO = meteo as unknown as MeteoCfg;

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
    // si nasce 2,5 m fuori dalla porta (world.ts): su una cella camminabile e lontano dalle altre porte (fuori dal raggio di 2,2 m del bottone)
    const l = Math.hypot(c.porta[0] - c.at[0], c.porta[1] - c.at[1]) || 1, sx = c.porta[0] + 0.5 + ((c.porta[0] - c.at[0]) / l) * 1.25, sz = c.porta[1] + 0.5 + ((c.porta[1] - c.at[1]) / l) * 1.25;
    if (!'.gdP'.includes(t.rows[Math.floor(sz)]?.[Math.floor(sx)] ?? '~')) errs.push(`borgo: davanti alla casa ${n} si nasce su una cella non camminabile`);
    for (const [m, d] of BORGO.case.entries()) if (m !== n && Math.hypot(sx - d.porta[0] - 0.5, sz - d.porta[1] - 0.5) < 1.2) errs.push(`borgo: davanti alla casa ${n} si nasce sulla porta della casa ${m}`);
  }
  const lt = ISLANDS.find((i) => i.id === 'lotto'), st = BORGO.stanza, [x0, z0, x1, z1] = st.pavimento;
  if (lt) {
    for (let z = z0; z < z1; z++) for (let x = x0; x < x1; x++) if (!'.LP'.includes(lt.rows[z]?.[x] ?? '~')) errs.push(`borgo: la stanza ha una cella non di pavimento in ${x},${z}`);
    // il passaggio del giardino ha la bocca sul lato ovest della cella `giardino` (#265): si cammina dalla cella verso quella a ovest
    for (const dx of [0, -1]) if (!'.gdP'.includes(lt.rows[st.giardino[1]]?.[st.giardino[0] + dx] ?? '~')) errs.push('borgo: il passaggio del giardino non è camminabile');
    if (st.retro[1] !== z0) errs.push('borgo: la porta sul retro sta nella prima fila della stanza');
    const [cx, c0, c1] = st.corridoio;
    if (c0 !== z1 || cx < x0 || cx >= x1) errs.push('borgo: il corridoio parte dal bordo davanti della stanza');
    for (let z = c0; z < c1; z++) if (!'.P'.includes(lt.rows[z]?.[cx] ?? '~')) errs.push(`borgo: il corridoio ha una cella non camminabile in ${cx},${z}`);
    // gli ampliamenti della casa (#386): ogni stanza cresce senza perdere celle e sta sul pavimento del template; il piano terra tiene il bordo davanti e il corridoio
    const att = new Map<string, readonly number[]>([['terra', st.pavimento]]), idl = new Set<string>();
    for (const [n, l] of BORGO.casa.livelli.entries()) {
      const r = l.pavimento, prima = att.get(l.stanza);
      if (idl.has(l.id)) errs.push(`borgo: casa.livelli ${l.id} doppio`);
      idl.add(l.id);
      if (!['terra', 'cantina', 'piano'].includes(l.stanza)) errs.push(`borgo: casa.livelli[${n}] ha una stanza sconosciuta (${l.stanza})`);
      if (!(Number.isInteger(l.monete) && l.monete > 0)) errs.push(`borgo: casa.livelli[${n}] ha un prezzo non valido (monete, intero > 0)`);
      if (prima && (r[0] > prima[0]! || r[1] > prima[1]! || r[2] < prima[2]! || r[3] < prima[3]! || r.every((v, i) => v === prima[i]))) errs.push(`borgo: casa.livelli[${n}] deve contenere e superare la stanza di prima`);
      for (let z = r[1]; z < r[3]; z++) for (let x = r[0]; x < r[2]; x++) if (!'.LP'.includes(lt.rows[z]?.[x] ?? '~')) errs.push(`borgo: casa.livelli[${n}] ha una cella non di pavimento in ${x},${z}`);
      if (l.stanza === 'terra' && (r[3] !== z1 || r[0] > cx || r[2] <= cx)) errs.push(`borgo: casa.livelli[${n}]: il piano terra tiene il bordo davanti e il corridoio`);
      att.set(l.stanza, r);
    }
    // le scale (#386): ognuna sta in una stanza che a quel livello c'è e porta in una cella dell'altra stanza, anch'essa già c'è
    const rettA = (id: string, liv: number): readonly number[] | null => { let r: readonly number[] | null = id === 'terra' ? st.pavimento : null; for (const l of BORGO.casa.livelli.slice(0, liv)) if (l.stanza === id) r = l.pavimento; return r; };
    const dentroR = (r: readonly number[] | null, c: readonly number[]) => !!r && c[0]! >= r[0]! && c[0]! < r[2]! && c[1]! >= r[1]! && c[1]! < r[3]!;
    for (const [n, s] of BORGO.casa.scale.entries()) {
      if (!dentroR(rettA(s.stanza, s.da), s.cell)) errs.push(`borgo: casa.scale[${n}] sta fuori dalla stanza ${s.stanza} al livello ${s.da}`);
      if (!dentroR(rettA(s.a, s.da), s.arrivo)) errs.push(`borgo: casa.scale[${n}] arriva fuori dalla stanza ${s.a} al livello ${s.da}`);
      if (s.verso !== 'giu' && s.verso !== 'su') errs.push(`borgo: casa.scale[${n}] ha un verso sconosciuto`);
      if (!BORGO.casa.livelli.some((l, i) => i + 1 === s.da && l.stanza !== 'terra')) errs.push(`borgo: casa.scale[${n}]: il livello ${s.da} non apre una stanza nuova`);
    }
  }
  if (!BORGO.pavimenti.length || !BORGO.carte.length) errs.push('borgo: serve almeno un pavimento e una carta da parati');
  // finiture e mobili (#265): id unici, quella di serie gratis, prezzi interi, colori in esadecimale (dalla palette)
  const hex = (c: string) => /^#[0-9A-F]{6}$/i.test(c);
  for (const [k, l] of [['pavimenti', BORGO.pavimenti], ['carte', BORGO.carte]] as const) {
    if (new Set(l.map((f) => f.id)).size !== l.length) errs.push(`borgo: ${k} con id doppi`);
    if ((l[0]?.monete ?? 0) !== 0) errs.push(`borgo: il primo dei ${k} è quello di serie, gratis`);
    for (const f of l) if (!(Number.isInteger(f.monete ?? 0) && (f.monete ?? 0) >= 0) || f.colori.length !== 3 || !f.colori.every(hex)) errs.push(`borgo: ${k} ${f.id} non valido`);
  }
  // il negozio dei mobili (#265): in città su prato o via libera, porta camminabile; dentro pavimento e corridoio camminabili
  const ng = BORGO.negozio, nd = BORGO.negozioDentro, nt = ISLANDS.find((i) => i.id === 'negozio');
  if (!'.g'.includes(t.rows[ng.at[1]]?.[ng.at[0]] ?? '~') || !'.gdP'.includes(t.rows[ng.porta[1]]?.[ng.porta[0]] ?? '~')) errs.push('borgo: il negozio dei mobili non sta su una cella libera o la sua porta non è camminabile');
  if (!nt) errs.push('borgo: manca il template negozio');
  else {
    const [a0, b0, a1, b1] = nd.pavimento, [cx, c0, c1] = nd.corridoio;
    for (let z = b0; z < b1; z++) for (let x = a0; x < a1; x++) if (nt.rows[z]?.[x] !== '.') errs.push(`borgo: il negozio ha una cella non di pavimento in ${x},${z}`);
    for (let z = c0; z < c1; z++) if (!'.P'.includes(nt.rows[z]?.[cx] ?? '~')) errs.push(`borgo: il corridoio del negozio non è camminabile in ${cx},${z}`);
    if (c0 !== b1) errs.push('borgo: il corridoio del negozio parte dal bordo davanti');
  }
  if (!BORGO.pavimenti.some((f) => f.id === nd.finitura.pavimento) || !BORGO.carte.some((f) => f.id === nd.finitura.carta)) errs.push('borgo: finitura del negozio sconosciuta');
  const ids = new Set<string>();
  for (const m of MOBILI) {
    if (ids.has(m.id)) errs.push(`mobili: id doppio ${m.id}`);
    ids.add(m.id);
    if (!/^[a-z][a-z0-9_]*$/.test(m.id) || !(Number.isInteger(m.monete) && m.monete > 0) || (m.posto !== 'terra' && m.posto !== 'parete') || !m.colori.length || !m.colori.every(hex)) errs.push(`mobili: ${m.id} non valido`);
    if (!MOBILI_CATEGORIE.some((c) => c.id === m.categoria)) errs.push(`mobili: ${m.id} ha una categoria sconosciuta (${m.categoria})`);
    if (m.celle && (m.celle.length !== 2 || !m.celle.every((n) => Number.isInteger(n) && n >= 1 && n <= 3) || (m.posto === 'parete' && (m.celle[0] !== 1 || m.celle[1] !== 1)))) errs.push(`mobili: ${m.id} ha un ingombro non valido (celle 1-3, a parete solo [1,1])`);
    if (m.altezza !== undefined && !(m.altezza > 0 && m.altezza <= 3)) errs.push(`mobili: ${m.id} ha un'altezza non valida (0-3 m)`);
  }
  // la vetrina del giorno: i posti del negozio sono una cella sì e una no lungo il pavimento (game/negozio.ts); carte e mobili a parete dividono il muro
  const vt = MOBILI_VETRINA, posti = Math.floor((nd.pavimento[2] - nd.pavimento[0] - 1) / 2);
  if (![vt.terra, vt.parete, vt.carte, vt.pavimenti].every((n) => Number.isInteger(n) && n >= 0)) errs.push('mobili: la vetrina del giorno vuole posti interi (0 o più)');
  else if (vt.terra > posti || vt.pavimenti > posti || vt.parete + vt.carte > posti) errs.push(`mobili: nel negozio ci sono ${posti} posti per fila: a terra ${vt.terra}, pavimenti ${vt.pavimenti}, al muro parete ${vt.parete} + carte ${vt.carte}`);
  const pl = BORGO.pala;
  if (!pl || pl.id !== 'pala' || !(Number.isInteger(pl.monete) && pl.monete > 0) || !Array.isArray(pl.bottino) || pl.bottino.length !== 2 || !(Number.isInteger(pl.bottino[0]) && Number.isInteger(pl.bottino[1]) && pl.bottino[0] >= 1 && pl.bottino[1] >= pl.bottino[0])) errs.push('borgo: pala non valida');
  return errs;
}
