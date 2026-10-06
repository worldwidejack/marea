// Catalogo degli oggetti (CONTRACTS §15): armi, archi, frecce e armature generati da tipo × materiale (rpg/materials.json, rpg/weapons.json)
// più gli oggetti scritti a mano (rpg/items.json: anelli, vesti, pozioni, libri, ingredienti, materiali, unici). Puro, calcolato all'import.
// Formule: arma = tipo × materiale (danno e velocità del tipo moltiplicati da quelli del materiale, peso idem); archi, frecce e armature
// prendono i numeri del materiale così come sono. Gli unici partono da `base` e sostituiscono i numeri che scrivono (tratti uniti).
import { ITEMS_RAW, MATERIALS, WEAPON_TYPES } from '@marea/content/rpg.ts';
import type { ItemDefRaw, MaterialDef, Traits, WeaponTypeDef } from '@marea/content/rpg.ts';
import type { ItemDef } from './types.ts';

const r2 = (x: number): number => Math.round(x * 100) / 100;
/** «di ferro», «d'argento», «d'oro», «d'ossa». */
export function diMateriale(m: MaterialDef): string {
  const n = m.id === 'ossa' ? 'ossa' : m.nome.toLowerCase();
  return /^[aeiou]/.test(n) ? `d'${n}` : `di ${n}`;
}
const NOMI_ARMATURA: Partial<Record<string, string>> = { legno: 'Vesti di tela', bronzo: 'Corazza di bronzo' };
/** Le armi pesanti costano metà materiale in più (arrotondato su). */
const costoArma = (t: WeaponTypeDef, m: MaterialDef): number => (t.classe === 'pesante' ? Math.ceil(m.arma.quanti * 1.5) : m.arma.quanti);
const traitsOf = (t: Traits | undefined): Traits => (t ? JSON.parse(JSON.stringify(t)) as Traits : {});

function generated(): ItemDef[] {
  const out: ItemDef[] = [];
  for (const m of MATERIALS) {
    for (const t of WEAPON_TYPES) {
      out.push({
        id: `${t.id}_${m.id}`, nome: `${t.nome} ${diMateriale(m)}`, kind: 'arma', peso: r2(t.peso * m.arma.peso), descr: `${t.descr} ${m.arma.descr}`,
        colore: m.colore, materiale: m.id, tipo: t.id, classe: t.classe,
        danno: r2(t.danno * m.arma.danno), velocita: r2(t.velocita * m.arma.velocita), portata: t.portata,
        traits: traitsOf(m.arma.traits), model: t.model, forgia: { costo: { [m.costo]: costoArma(t, m) }, banco: m.banco },
      });
    }
    out.push({
      id: `arco_${m.id}`, nome: `Arco ${diMateriale(m)}`, kind: 'arco', peso: m.arco.peso, descr: m.arco.descr, colore: m.colore, materiale: m.id,
      danno: m.arco.danno, tensione: m.arco.tensione, gittata: m.arco.gittata, traits: traitsOf(m.arco.traits), model: 'arm_arco',
      forgia: { costo: { [m.costo]: m.arco.quanti }, banco: m.banco },
    });
    out.push({
      id: `frecce_${m.id}`, nome: `Frecce ${diMateriale(m)}`, kind: 'frecce', peso: m.id === 'bronzo' || m.id === 'ossa' ? 0.1 : 0.05, descr: m.frecce.descr,
      colore: m.colore, materiale: m.id, danno: m.frecce.danno, gittata: m.frecce.gittata, gravita: m.frecce.gravita, traits: traitsOf(m.frecce.traits),
      model: 'arm_freccia', forgia: { costo: { [m.costo]: m.frecce.quanti }, banco: m.banco, n: m.frecce.n },
    });
    out.push({
      id: `armatura_${m.id}`, nome: NOMI_ARMATURA[m.id] ?? `Armatura ${diMateriale(m)}`, kind: 'armatura', peso: m.armatura.peso, descr: m.armatura.descr,
      colore: m.colore, materiale: m.id, difesa: m.armatura.difesa, forgia: { costo: { [m.costo]: m.armatura.quanti }, banco: m.banco },
    });
  }
  return out;
}

/** Oggetto scritto a mano; gli unici con `base` ereditano dall'oggetto generato e non sono forgiabili. */
function fromRaw(r: ItemDefRaw, byId: Map<string, ItemDef>): ItemDef {
  const base = r.base ? byId.get(r.base) : undefined;
  if (r.base && !base) throw new Error(`items.json: ${r.id} ha una base sconosciuta (${r.base})`);
  const it: ItemDef = base ? { ...base, traits: traitsOf(base.traits) } : { id: r.id, nome: r.nome, kind: r.kind, peso: r.peso, descr: r.descr, colore: '#B9AFA3' };
  it.id = r.id; it.nome = r.nome; it.kind = r.kind; it.peso = r.peso; it.descr = r.descr;
  delete it.forgia;
  if (r.colore) it.colore = r.colore;
  else if (!base) it.colore = MATERIALS.find((m) => m.costo === r.id)?.colore ?? it.colore;
  if (r.danno !== undefined) it.danno = r.danno;
  if (r.velocita !== undefined) it.velocita = r.velocita;
  if (r.difesa !== undefined) it.difesa = r.difesa;
  if (r.traits) it.traits = { ...(it.traits ?? {}), ...traitsOf(r.traits) };
  if (r.mods) it.mods = { ...r.mods };
  if (r.cura) it.cura = { ...r.cura };
  if (r.buff) it.buff = { ...r.buff };
  if (r.insegna) it.insegna = r.insegna;
  if (r.unico) it.unico = true;
  return it;
}

function catalog(): ItemDef[] {
  const gen = generated();
  const byId = new Map(gen.map((i) => [i.id, i]));
  const out = [...gen];
  for (const r of ITEMS_RAW) {
    if (byId.has(r.id)) throw new Error(`items.json: id doppio ${r.id}`);
    const it = fromRaw(r, byId);
    byId.set(it.id, it);
    out.push(it);
  }
  return out;
}

/** id: `<tipo>_<materiale>` (katana_ferro), `arco_<materiale>`, `frecce_<materiale>`, `armatura_<materiale>`; il resto come in items.json. */
export const ITEMS: readonly ItemDef[] = catalog();
const BY_ID: ReadonlyMap<string, ItemDef> = new Map(ITEMS.map((i) => [i.id, i]));
export function hasItem(id: string): boolean { return BY_ID.has(id); }
export function itemDef(id: string): ItemDef {
  const it = BY_ID.get(id);
  if (!it) throw new Error(`Oggetto sconosciuto: ${id}`);
  return it;
}
/** Peso di un oggetto (0 se sconosciuto). */
export function pesoOf(id: string): number { return BY_ID.get(id)?.peso ?? 0; }
/** Materiale di un oggetto generato o di un unico (via la sua base). */
export function materialOf(it: ItemDef): MaterialDef | undefined { return it.materiale ? MATERIALS.find((m) => m.id === it.materiale) : undefined; }
/** Tipo d'arma (anche degli unici). */
export function weaponTypeOf(it: ItemDef): WeaponTypeDef | undefined { return it.tipo ? WEAPON_TYPES.find((t) => t.id === it.tipo) : undefined; }
