// Validatore dei contenuti: niente dipendenze, errori in italiano. Chiamato da tools/check_static.mjs e dai test.
import type { ArchipelagoDef, AvatarDef, BalanceDef, BuildingDef, DecorDef, IslandDef, ResourceDef } from './types.ts';

const HEX = /^#[0-9A-F]{6}$/;
const TILES = new Set(['~', ',', '.', 'g', 'r', 'd', 'P', 'B', 'L']);

export function validateAll(c: { buildings: BuildingDef[]; resources: ResourceDef[]; islands: IslandDef[]; avatar: AvatarDef; balance: BalanceDef; decor?: DecorDef[] }): string[] {
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
    errs.push(...validateIslandExtras(isl, w));
  }
  for (const [k, arr] of Object.entries({ pelle: c.avatar.pelle, coloriCapelli: c.avatar.coloriCapelli, vestiti: c.avatar.vestiti }))
    for (const h of arr) if (!HEX.test(h)) errs.push(`avatar.${k}: colore non valido ${h}`);
  const nomiCap = c.avatar.nomiColoriCapelli;
  if (nomiCap && nomiCap.length !== c.avatar.coloriCapelli.length) errs.push(`avatar.nomiColoriCapelli: ${nomiCap.length} nomi per ${c.avatar.coloriCapelli.length} colori`);
  const hatIds = new Set<string>();
  for (const h of c.avatar.cappelli) {
    if (hatIds.has(h.id)) errs.push(`cappello duplicato: ${h.id}`);
    hatIds.add(h.id);
    if (!(Number.isInteger(h.perle) && h.perle >= 0)) errs.push(`cappello ${h.id}: costo in perle non valido`);
    if (h.mercante && h.perle <= 0) errs.push(`cappello ${h.id}: esclusivo del Mercante ma gratis`);
  }
  const decorIds = new Set<string>();
  for (const d of c.decor ?? []) {
    if (decorIds.has(d.id)) errs.push(`decorazione duplicata: ${d.id}`);
    decorIds.add(d.id);
    if (!(d.perle >= 0)) errs.push(`decorazione ${d.id}: costo in perle non valido`);
    if (!/^prop_[a-z_]+$/.test(d.model)) errs.push(`decorazione ${d.id}: nome modello non valido ${d.model}`);
  }
  if (c.balance.bufferOre <= 0) errs.push('balance.bufferOre deve essere > 0');
  if (c.balance.wager.min <= 0) errs.push('balance.wager.min deve essere > 0');
  if (!(c.balance.solo?.premiateAlGiorno >= 0)) errs.push('balance.solo.premiateAlGiorno mancante o negativo');
  for (const k of ['oro', 'argento', 'bronzo', 'nessuna'] as const) {
    const r = c.balance.solo?.premi?.[k];
    if (!r || !(['legno', 'pietra', 'perle'] as const).every((x) => Number.isInteger(r[x]) && r[x] >= 0)) errs.push(`balance.solo.premi.${k} non valido`);
  }
  return errs;
}

const STYLES = new Set(['lotto', 'porto', 'laguna', 'neon', 'selvaggia']);
const PROP_KINDS = new Set(['torii', 'lanterna', 'insegna_neon', 'palma', 'cassa', 'barile', 'sasso', 'cespuglio', 'filo_lanterne', 'fac_neon', 'fac_selvaggia']);
/** Campi facoltativi di un'isola: stile, densità della scenografia, slot (su celle L) e decorazioni fisse (dentro la mappa). */
function validateIslandExtras(isl: IslandDef, w: number): string[] {
  const errs: string[] = [];
  const h = isl.rows.length;
  if (isl.style !== undefined && !STYLES.has(isl.style)) errs.push(`isola ${isl.id}: stile sconosciuto ${isl.style}`);
  if (isl.scenery !== undefined && !(isl.scenery >= 0 && isl.scenery <= 4)) errs.push(`isola ${isl.id}: scenery fuori da 0-4`);
  const seen = new Set<string>();
  for (const s of isl.slots ?? []) {
    const [x, z] = s.at;
    if (isl.rows[z]?.[x] !== 'L') errs.push(`isola ${isl.id}: lo slot ${s.kind} in ${x},${z} non è su una cella L`);
    if (seen.has(`${x},${z}`)) errs.push(`isola ${isl.id}: due slot nella cella ${x},${z}`);
    seen.add(`${x},${z}`);
  }
  if (isl.slots) {
    let nL = 0;
    for (const row of isl.rows) for (const ch of row) if (ch === 'L') nL++;
    if (nL !== isl.slots.length) errs.push(`isola ${isl.id}: ${nL} celle L ma ${isl.slots.length} slot descritti`);
  }
  for (const p of isl.props ?? []) {
    if (!PROP_KINDS.has(p.k)) errs.push(`isola ${isl.id}: decorazione sconosciuta ${p.k}`);
    const [x, z] = p.at;
    if (!(x >= -0.5 && z >= -0.5 && x <= w - 0.5 && z <= h - 0.5)) errs.push(`isola ${isl.id}: decorazione ${p.k} fuori mappa (${x}, ${z})`);
  }
  for (const r of isl.paved ?? []) {
    const [x0, z0, x1, z1] = r;
    if (!(x0 >= 0 && z0 >= 0 && x1 < w && z1 < h && x0 <= x1 && z0 <= z1)) errs.push(`isola ${isl.id}: lastricato fuori mappa ${r.join(',')}`);
  }
  return errs;
}

/** Arcipelago: isole esistenti, dentro la griglia, senza sovrapposizioni; un Porto; lotti = template `lotto` con slot 0..n-1 unici. */
export function validateArchipelago(a: ArchipelagoDef, islands: IslandDef[]): string[] {
  const errs: string[] = [];
  if (a.tile !== 2) errs.push('arcipelago: tile deve essere 2 m');
  if (!(a.w > 0 && a.h > 0 && a.w <= 2048 && a.h <= 2048)) errs.push(`arcipelago: dimensioni non valide ${a.w}×${a.h}`);
  const rects: { id: string; x0: number; z0: number; x1: number; z1: number }[] = [];
  const slots = new Set<number>();
  let porto = 0;
  for (const [i, e] of a.islands.entries()) {
    const def = islands.find((d) => d.id === e.island);
    const tag = `arcipelago[${i}] ${e.island}`;
    if (!def) { errs.push(`${tag}: isola inesistente`); continue; }
    if (!['porto', 'lotto', 'facciata', 'laguna'].includes(e.role)) errs.push(`${tag}: ruolo sconosciuto ${e.role}`);
    const w = def.rows[0]?.length ?? 0, h = def.rows.length;
    const [x0, z0] = e.at;
    if (!Number.isInteger(x0) || !Number.isInteger(z0)) errs.push(`${tag}: posizione non intera`);
    if (x0 < 0 || z0 < 0 || x0 + w > a.w || z0 + h > a.h) errs.push(`${tag}: esce dalla griglia ${a.w}×${a.h}`);
    for (const r of rects) if (x0 < r.x1 && r.x0 < x0 + w && z0 < r.z1 && r.z0 < z0 + h) errs.push(`${tag}: si sovrappone a ${r.id}`);
    rects.push({ id: tag, x0, z0, x1: x0 + w, z1: z0 + h });
    if (e.role === 'porto') porto++;
    if (e.role === 'lotto') {
      if (e.island !== 'lotto') errs.push(`${tag}: i lotti usano il template 'lotto'`);
      if (e.slot === undefined || !Number.isInteger(e.slot) || e.slot < 0) errs.push(`${tag}: slot mancante o non valido`);
      else if (slots.has(e.slot)) errs.push(`${tag}: slot ${e.slot} duplicato`);
      else slots.add(e.slot);
    } else if (e.slot !== undefined) errs.push(`${tag}: slot solo per i lotti`);
  }
  if (porto !== 1) errs.push(`arcipelago: serve esattamente un Porto (trovati ${porto})`);
  for (let s = 0; s < slots.size; s++) if (!slots.has(s)) errs.push(`arcipelago: slot ${s} mancante (servono 0..${slots.size - 1})`);
  return errs;
}
