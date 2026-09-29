// Validatore dei contenuti: niente dipendenze, errori in italiano. Chiamato da tools/check_static.mjs e dai test.
import type { AvatarDef, BalanceDef, BuildingDef, IslandDef, ResourceDef } from './types.ts';

const HEX = /^#[0-9A-F]{6}$/;
const TILES = new Set(['~', ',', '.', 'g', 'r', 'd', 'P', 'B', 'L']);

export function validateAll(c: { buildings: BuildingDef[]; resources: ResourceDef[]; islands: IslandDef[]; avatar: AvatarDef; balance: BalanceDef }): string[] {
  const errs: string[] = [];
  const ids = new Set<string>();
  for (const b of c.buildings) {
    if (ids.has(b.id)) errs.push(`edificio duplicato: ${b.id}`);
    ids.add(b.id);
    if (!b.levels.length) errs.push(`edificio senza livelli: ${b.id}`);
    for (const [i, l] of b.levels.entries()) {
      if (l.seconds < 0) errs.push(`${b.id} L${i + 1}: tempo negativo`);
      for (const k of ['legno', 'pietra', 'perle'] as const) if (l.cost[k] < 0) errs.push(`${b.id} L${i + 1}: costo negativo (${k})`);
    }
    if (b.requires && !c.buildings.some((o) => o.id === b.requires)) errs.push(`${b.id}: requisito sconosciuto ${b.requires}`);
  }
  const resIds = new Set(c.resources.map((r) => r.id));
  for (const k of ['legno', 'pietra', 'perle']) if (!resIds.has(k as ResourceDef['id'])) errs.push(`risorsa mancante: ${k}`);
  for (const isl of c.islands) {
    const w = isl.rows[0]?.length ?? 0;
    let spawn = 0, boat = 0;
    for (const [z, row] of isl.rows.entries()) {
      if (row.length !== w) errs.push(`isola ${isl.id}: riga ${z} lunga ${row.length}, attese ${w}`);
      for (const ch of row) {
        if (!TILES.has(ch)) errs.push(`isola ${isl.id}: carattere sconosciuto '${ch}'`);
        if (ch === 'P') spawn++;
        if (ch === 'B') boat++;
      }
    }
    if (spawn !== 1) errs.push(`isola ${isl.id}: serve esattamente uno spawn P (trovati ${spawn})`);
    if (boat !== 1) errs.push(`isola ${isl.id}: serve esattamente uno spawn barca B (trovati ${boat})`);
    if (isl.tile !== 2) errs.push(`isola ${isl.id}: tile deve essere 2 m`);
  }
  for (const [k, arr] of Object.entries({ pelle: c.avatar.pelle, coloriCapelli: c.avatar.coloriCapelli, vestiti: c.avatar.vestiti }))
    for (const h of arr) if (!HEX.test(h)) errs.push(`avatar.${k}: colore non valido ${h}`);
  if (c.balance.bufferOre <= 0) errs.push('balance.bufferOre deve essere > 0');
  if (c.balance.wager.min <= 0) errs.push('balance.wager.min deve essere > 0');
  return errs;
}
