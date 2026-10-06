// Catalogo GDR coerente (docs/RPG.md): ogni id usato esiste, colori in palette, perk a catena, unici non forgiabili.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { building } from '@marea/content';
import { ENEMIES, ITEMS_RAW, LOOT, MATERIALS, PERKS, RECIPES, RPG, SKILLS, SPELLS, WEAPON_TYPES } from '@marea/content/rpg.ts';
import { ITEMS, hasItem, itemDef } from '../src/rpg/items.ts';

const PALETTE = new Set([...fs.readFileSync(new URL('../../../docs/ART_BIBLE.md', import.meta.url), 'utf8').matchAll(/`(#[0-9A-F]{6})`/g)].map((m) => m[1]));
const MOD_KEYS = new Set(['vita', 'magicka', 'stamina', 'regenVita', 'regenMagicka', 'regenStamina', 'dannoLeggere', 'dannoPesanti', 'dannoArco', 'dannoDistruzione',
  'velocitaLeggere', 'velocitaPesanti', 'tensioneArco', 'caricaVeloce', 'costoDistruzione', 'costoEvocazione', 'durataEvocazione', 'difesa', 'malusArmatura', 'peso',
  'velocitaCorsa', 'staminaCorsa', 'dannoConArmaturaLeggera', 'velocitaBarca', 'materialiForgia', 'potenzaPozioni', 'resistMagia']);

test('rpg catalogo: 8 materiali, 6 armi, tipo × materiale generato, id unici', () => {
  assert.equal(MATERIALS.length, 8);
  assert.equal(WEAPON_TYPES.length, 6);
  assert.equal(new Set(ITEMS.map((i) => i.id)).size, ITEMS.length);
  for (const m of MATERIALS) {
    for (const t of WEAPON_TYPES) assert.ok(hasItem(`${t.id}_${m.id}`), `${t.id}_${m.id}`);
    for (const p of ['arco', 'frecce', 'armatura']) assert.ok(hasItem(`${p}_${m.id}`), `${p}_${m.id}`);
    assert.ok(m.costo === 'risorsa:legno' || hasItem(m.costo), `costo di ${m.id}: ${m.costo}`);
  }
  assert.equal(itemDef('armatura_legno').nome, 'Vesti di tela');
  assert.equal(itemDef('katana_ferro').model, 'arm_katana');
  assert.equal(itemDef('arco_vetro').model, 'arm_arco');
  assert.equal(itemDef('frecce_ferro').forgia?.n, 10);
});

test('rpg catalogo: ogni id usato in partenza, ricette, bottega, libri, Serra e bottino esiste', () => {
  for (const id of Object.keys(RPG.partenza.inv)) assert.ok(hasItem(id), `partenza.inv ${id}`);
  for (const [slot, id] of Object.entries(RPG.partenza.equip)) assert.ok(slot === 'magia' ? RPG.partenza.magie.includes(id) : (RPG.partenza.inv[id] ?? 0) > 0, `partenza.equip ${slot}`);
  for (const s of RPG.partenza.magie) assert.ok(SPELLS.some((x) => x.id === s), `magia ${s}`);
  for (const r of RECIPES) {
    assert.ok(hasItem(r.risultato) && itemDef(r.risultato).kind === 'pozione', `ricetta ${r.id}`);
    for (const id of Object.keys(r.ingredienti)) assert.ok(hasItem(id) && itemDef(id).kind === 'ingrediente', `${r.id}: ${id}`);
  }
  assert.ok(RECIPES.some((r) => r.livello <= RPG.livelli.skillIniziale), 'almeno una ricetta subito');
  for (const id of Object.keys(RPG.bottega)) assert.ok(hasItem(id), `bottega ${id}`);
  for (const id of building('serra').producesItems ?? []) assert.ok(hasItem(id) && itemDef(id).kind === 'ingrediente', `serra ${id}`);
  for (const it of ITEMS.filter((i) => i.kind === 'libro')) assert.ok(SPELLS.some((s) => s.id === it.insegna), `libro ${it.id}`);
  for (const s of SPELLS) assert.ok(s.id === 'fiammata' || ITEMS.some((i) => i.insegna === s.id), `nessun libro per ${s.id}`);
  // contenuti di R-dungeon (se già scritti): bottino e evocazioni puntano a id veri
  for (const t of LOOT) for (const v of t.voci) assert.ok(hasItem(v.item), `loot ${t.id}: ${v.item}`);
  if (ENEMIES.length) for (const s of SPELLS) if (s.evoca) assert.ok(ENEMIES.some((e) => e.id === s.evoca), `evoca ${s.evoca}`);
  // gli id che R-dungeon usa nelle tabelle del bottino
  for (const id of ['lingotto_bronzo', 'lingotto_ferro', 'lingotto_argento', 'pepita_oro', 'frammento_vetro', 'ossa_mostro', 'frammento_meteorite', 'erba_curativa', 'fiore_azzurro',
    'radice_vigore', 'fungo_luminoso', 'polvere_ossa', 'essenza_vuoto', 'seta_ragno', 'zanna_lupo', 'pozione_vita_minore', 'pozione_vita', 'pozione_vita_grande',
    'pozione_magicka_minore', 'pozione_magicka', 'pozione_stamina', 'pozione_forza', 'libro_fiammata', 'libro_fulmine', 'libro_lupo_spettrale', 'libro_scheletro_evocato',
    'anello_vita_debole', 'veste_apprendista', 'veste_distruzione', 'veste_evocazione', 'unico_martello_re', 'unico_arco_custode']) assert.ok(hasItem(id), id);
});

test('rpg catalogo: colori solo dalla palette, unici non forgiabili, anelli e vesti', () => {
  assert.ok(PALETTE.size >= 30, 'palette letta da ART_BIBLE');
  for (const m of MATERIALS) assert.ok(PALETTE.has(m.colore), `materiale ${m.id}: ${m.colore}`);
  for (const i of ITEMS) assert.ok(PALETTE.has(i.colore), `${i.id}: ${i.colore}`);
  const unici = ITEMS.filter((i) => i.unico);
  assert.ok(unici.length >= 5);
  for (const k of ['arma', 'arco', 'frecce', 'armatura']) assert.ok(unici.some((u) => u.kind === k), `unico ${k}`);
  for (const u of unici) { assert.equal(u.forgia, undefined, u.id); assert.ok(u.id.startsWith('unico_')); }
  assert.ok(ITEMS.filter((i) => i.kind === 'anello').length >= 6);
  assert.equal(itemDef('anello_vita_debole').mods?.vita, 20);
  for (const v of ITEMS.filter((i) => i.kind === 'veste')) { assert.equal(v.difesa, 0, v.id); assert.ok((v.mods?.magicka ?? 0) > 0, v.id); }
  for (const r of ITEMS_RAW) for (const k of [...Object.keys(r.mods ?? {}), ...(r.buff ? [r.buff.mod] : [])]) assert.ok(MOD_KEYS.has(k), `${r.id}: ${k}`);
});

test('rpg perk: 4-5 per abilità, prerequisiti a catena nella stessa abilità, chiavi valide', () => {
  const byId = new Map(PERKS.map((p) => [p.id, p]));
  assert.equal(byId.size, PERKS.length);
  for (const s of SKILLS) {
    const n = PERKS.filter((p) => p.skill === s).length;
    assert.ok(n >= 4 && n <= 5, `${s}: ${n} perk`);
  }
  for (const p of PERKS) {
    for (const k of Object.keys(p.mods)) assert.ok(MOD_KEYS.has(k), `${p.id}: ${k}`);
    if (!p.richiede) continue;
    const q = byId.get(p.richiede);
    assert.ok(q, `${p.id} richiede ${p.richiede}`);
    assert.equal(q.skill, p.skill, p.id);
    assert.ok(q.livello < p.livello, `${p.id}: livello sotto il prerequisito`);
  }
});
