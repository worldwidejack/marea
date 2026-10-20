// Le mete della bussola e della minimappa, in quest'ordine: casa, Porto (Mercante, Bacheca, Record, poi i minigiochi del Porto),
// minigiochi delle isole, dungeon (solo il più facile non ancora sconfitto), Chiesa, Funivia, Orto, Colosseo, Relitto, isole a tema.
// Bussola a sezioni: quello che sta al Porto in una riga che si apre, le isole a tema in un'altra.
import { ISLANDS } from '@marea/content';
import { FLAGS } from '../flags.ts';
import { portaDi } from '../game/borgo.ts';
import type { GameWorld } from '../game/world.ts';
import type { CompassSezione, CompassTarget } from '../ui/compass.ts';
import type { PixId } from '../ui/icons.ts';

type Arch = GameWorld['archipelago'];
type Spot = { id: string; nome: string; x: number; z: number };

export const SEZIONI: CompassSezione[] = [{ id: 'porto', nome: 'Porto', icon: 'porto' }, { id: 'isole', nome: 'Isole', icon: 'isole' }];

/** Dentro un posto dell'arcipelago, con 4 celle di margine. */
export const dentro = (arch: Arch, p: { origin: readonly number[]; w: number; h: number }, x: number, z: number): boolean =>
  x >= (p.origin[0]! - 4) * arch.tile && x <= (p.origin[0]! + p.w + 4) * arch.tile && z >= (p.origin[1]! - 4) * arch.tile && z <= (p.origin[1]! + p.h + 4) * arch.tile;

export function creaMete(o: {
  world: GameWorld;
  giochi: readonly (Spot & { icon: PixId; aperta?: () => boolean })[];
  ingressi: { spots: readonly (Spot & { icon: PixId })[]; next(): string | null };
  porto: readonly Spot[];
  amici: readonly Spot[];
  tpl: { spot: Spot | null; relitto: { x: number; z: number } | null; calice(): boolean };
  adr: Spot | null;
  temi: { isole: readonly { island: string; nome: string; role: string; index: number; spawn: { x: number; z: number } }[]; aperta(id: string): boolean };
  /** L'isola compare in mappa (ci sei passato vicino). */
  vista: (id: string) => boolean;
}): CompassTarget[] {
  const { world, temi } = o, arch = world.archipelago, targets: CompassTarget[] = [];
  const portoPl = arch.places.find((p) => p.role === 'porto') ?? null;
  /** Sezione della bussola di un posto: al Porto → 'porto', su un'isola a tema → 'isole' (i suoi minigiochi), altrove nessuna. */
  const sezioneDi = (x: number, z: number) => (portoPl && dentro(arch, portoPl, x, z) ? 'porto' : arch.places.some((p) => p.role === 'tema' && dentro(arch, p, x, z)) ? 'isole' : undefined);
  if (world.slot !== null) targets.push({ id: 'casa', label: 'Casa', icon: 'casa', ...(portaDi(world, world.slot) ?? arch.spawnOf(world.slot)) }); // la porta di casa nel Borgo
  targets.push({ id: 'porto', label: 'Porto', icon: 'porto', ...arch.spawnOf(null), sezione: 'porto' });
  // aperta: minigiochi delle isole a tema (Ghiacci, Giardino, Tempesta, Vulcano)
  for (const sp of o.giochi) { const sez = sezioneDi(sp.x, sp.z); targets.push({ id: sp.id, label: sp.nome, icon: sp.icon, x: sp.x, z: sp.z, ...(sp.aperta ? { show: sp.aperta } : {}), ...(sez ? { sezione: sez } : {}) }); }
  // dei dungeon la bussola mostra solo il più facile non ancora completato (difficoltà invisibile, docs/RPG.md §2)
  for (const sp of o.ingressi.spots) targets.push({ id: sp.id, label: sp.nome, icon: sp.icon, x: sp.x, z: sp.z, show: () => o.ingressi.next() === sp.id, group: 'dungeon', desc: 'Il dungeon più facile che non hai ancora sconfitto' });
  // nella sezione del Porto subito dopo la piazza: Mercante e Bacheca prima dei minigiochi, poi il Tabellone dei record
  targets.splice(targets.findIndex((t) => t.id === 'porto') + 1, 0, ...o.porto.map((sp): CompassTarget => ({ id: sp.id, label: sp.id === 'mercante' ? 'Mercante' : sp.id === 'contrabbando' ? 'Contrabbando' : 'Bacheca', icon: sp.id as PixId, x: sp.x, z: sp.z, sezione: 'porto' })));
  targets.splice(targets.findIndex((t) => t.id === 'bacheca') + 1, 0, ...o.amici.map((sp): CompassTarget => ({ id: sp.id, label: 'Record', icon: sp.id as PixId, x: sp.x, z: sp.z, sezione: 'porto' })));
  const { tpl, adr } = o;
  if (tpl.spot) targets.push({ id: 'templari', label: 'Chiesa', icon: 'templari', x: tpl.spot.x, z: tpl.spot.z, show: () => FLAGS.templari || temi.aperta('templari'), sezione: 'isole' });
  if (adr) targets.push({ id: 'funivia', label: 'Funivia', icon: 'adrenalina', x: adr.x, z: adr.z, show: () => FLAGS.adrenalina || temi.aperta('adrenalina'), sezione: 'isole' });
  { const pa = arch.places.find((p) => p.island === 'difesa'), c = ISLANDS.find((i) => i.id === 'difesa')?.props?.find((p) => p.k === 'orto_campo'); if (pa && c) targets.push({ id: 'difesa', label: 'Orto', icon: 'difesa', x: (pa.origin[0] + c.at[0] - 6.3) * arch.tile, z: (pa.origin[1] + c.at[1]) * arch.tile, sezione: 'isole' }); } // = ingressoOrto() di game/difesa.ts
  { const pa = arch.places.find((p) => p.island === 'arena'), col = ISLANDS.find((i) => i.id === 'arena')?.props?.find((p) => p.k === 'colosseo'); if (pa && col) targets.push({ id: 'arena', label: 'Colosseo', icon: 'arena', x: (pa.origin[0] + col.at[0] + 0.5) * arch.tile, z: (pa.origin[1] + col.at[1] + 7) * arch.tile, sezione: 'isole' }); }
  // lo scheletro col calice sotto il faro della Tempesta: in bussola finché il calice non è tuo (e la Tempesta è aperta)
  if (tpl.relitto) targets.push({ id: 'relitto_templare', label: 'Relitto', icon: 'templari', x: tpl.relitto.x, z: tpl.relitto.z, show: () => !tpl.calice() && temi.aperta('tempesta'), sezione: 'isole' });
  for (const p of temi.isole) targets.push({ id: 'tema:' + p.island, label: p.nome.replace(/^Isola (della |delle |dei |del )?/, ''), icon: p.island as PixId, x: p.spawn.x, z: p.spawn.z, show: () => o.vista(`${p.role}:${p.index}`), sezione: 'isole' });
  return targets;
}
