// Numeri derivati del personaggio (perk + anelli + veste/armatura + abilità) e fotografia per il dungeon (RunHero). Puro.
// Chiavi dei modificatori (ModKey): vita, magicka, stamina, peso (kg), difesa (punti) sono piatti; tutte le altre sono frazioni
// (+0.2 = +20 %, −0.25 = −25 %: costi, malusArmatura, staminaCorsa, materialiForgia vanno in negativo per migliorare).
import { ATTRS, PERKS, RPG, SKILLS, spellDef } from '@marea/content/rpg.ts';
import type { AttrId, ModKey, SkillId, Traits } from '@marea/content/rpg.ts';
import { ITEMS, itemDef, hasItem, materialOf, weaponTypeOf } from './items.ts';
import type { HeroState, ItemDef, RunArmor, RunArrows, RunHero, RunPotion, RunSpell, RunWeapon } from './types.ts';

export type Mods = Partial<Record<ModKey, number>>;
const r2 = (x: number): number => Math.round(x * 100) / 100;
const clamp = (x: number, a: number, b: number): number => Math.max(a, Math.min(b, x));
const PERK_BY_ID = new Map(PERKS.map((p) => [p.id, p]));
export const PESI: Readonly<Record<string, number>> = Object.fromEntries(ITEMS.map((i) => [i.id, i.peso]));

function addMods(into: Mods, m: Partial<Record<string, number>> | undefined): void {
  if (!m) return;
  for (const [k, v] of Object.entries(m)) if (typeof v === 'number' && Number.isFinite(v)) into[k as ModKey] = (into[k as ModKey] ?? 0) + v;
}
/** Oggetto equipaggiato e davvero nello zaino (altrimenti undefined). */
export function equipped(h: HeroState, slot: 'arma' | 'frecce' | 'corpo' | 'anello1' | 'anello2' | 'pozione'): ItemDef | undefined {
  const id = h.equip[slot];
  if (!id || !hasItem(id) || (h.inv[id] ?? 0) < 1) return undefined;
  if (slot === 'anello2' && h.equip.anello1 === id && (h.inv[id] ?? 0) < 2) return undefined; // lo stesso anello in due dita serve doppio
  return itemDef(id);
}
/** Somma dei modificatori: perk, anelli, corpo (veste o armatura unica), arma. */
export function modsOf(h: HeroState): Mods {
  const m: Mods = {};
  for (const p of h.perk) addMods(m, PERK_BY_ID.get(p)?.mods);
  for (const s of ['anello1', 'anello2', 'corpo', 'arma'] as const) addMods(m, equipped(h, s)?.mods);
  return m;
}
const mod = (m: Mods, k: ModKey): number => m[k] ?? 0;

export function maxOf(h: HeroState, m: Mods): Record<AttrId, number> {
  const b = RPG.attributi;
  const out = { vita: 0, magicka: 0, stamina: 0 };
  for (const a of ATTRS) out[a] = Math.max(1, Math.round(b.base[a] + (h.punti[a] ?? 0) * b.perLivello + mod(m, a)));
  return out;
}
export function caricoMaxOf(h: HeroState, m: Mods = modsOf(h)): number {
  return r2(RPG.peso.base + RPG.peso.perStamina * maxOf(h, m).stamina + mod(m, 'peso'));
}
export function carriedOf(h: HeroState): number {
  let w = 0;
  for (const [id, n] of Object.entries(h.inv)) w += (PESI[id] ?? 0) * n;
  return r2(w);
}
/** Moltiplicatore di un'abilità sopra il livello iniziale (danno delle armi e delle magie, potenza delle pozioni). */
function skillBonus(h: HeroState, s: SkillId, perLv: number): number {
  return Math.max(0, (h.skill[s]?.lv ?? RPG.livelli.skillIniziale) - RPG.livelli.skillIniziale) * perLv;
}
const dannoPerLv = (): number => RPG.abilita?.dannoPerLivello ?? 0.005;

function armorOf(h: HeroState, m: Mods, staminaMax: number): RunArmor & { leggera: boolean } {
  const it = equipped(h, 'corpo');
  const A = RPG.armatura;
  const out = { id: it?.id ?? null, difesa: Math.max(0, mod(m, 'difesa')), malus: 0, vsMagia: 1, vsTaglio: 1, vsContundente: 1, moneteSuColpito: 0, terrore: 0, velocitaMolt: 1, leggera: true };
  if (it && it.kind === 'armatura') {
    const mat = materialOf(it)?.armatura;
    out.difesa += it.difesa ?? 0;
    // il peso oltre `liberi` rallenta; la Stamina sopra la base lo attenua (a 200 di Stamina pesa la metà), i perk anche
    const raw = Math.max(0, it.peso - (A.liberi ?? 0)) * A.malusPerPeso * (RPG.attributi.base.stamina / Math.max(1, staminaMax)) * Math.max(0, 1 + mod(m, 'malusArmatura'));
    out.malus = r2(clamp(raw, 0, A.malusMax));
    out.velocitaMolt = it.peso < 0 ? r2(1 - it.peso * A.malusPerPeso) : 1;
    out.vsMagia = mat?.vsMagia ?? 1; out.vsTaglio = mat?.vsTaglio ?? 1; out.vsContundente = mat?.vsContundente ?? 1;
    out.moneteSuColpito = mat?.moneteSuColpito ?? 0; out.terrore = mat?.terrore ?? 0;
    out.leggera = it.peso <= (A.leggera ?? 12);
    if (it.traits?.barriera) (out as RunArmor).barriera = { ...it.traits.barriera }; // Armatura del Moto Perpetuo
  }
  out.vsMagia = r2(out.vsMagia * clamp(1 - mod(m, 'resistMagia'), 0.1, 1));
  return out;
}

function weaponOf(h: HeroState, m: Mods, leggera: boolean): RunWeapon {
  const it = equipped(h, 'arma');
  const P = RPG.pugni ?? { danno: 3, velocita: 2, portata: 1.1, carica: 0.6, caricaMolt: 1.5 };
  const leggeraBonus = leggera ? mod(m, 'dannoConArmaturaLeggera') : 0;
  const caricaK = clamp(1 - mod(m, 'caricaVeloce'), 0.2, 2);
  if (it && it.kind === 'arco') {
    const k = 1 + mod(m, 'dannoArco') + skillBonus(h, 'arceria', dannoPerLv());
    const tempo = r2(Math.max(0.1, (it.tensione ?? 1) * clamp(1 - mod(m, 'tensioneArco'), 0.2, 2)));
    return { id: it.id, kind: 'arco', skill: 'arceria', classe: null, danno: r2((it.danno ?? 0) * k), tempo, portata: 0, carica: tempo, caricaMolt: 1, gittata: it.gittata ?? 0, traits: { ...(it.traits ?? {}) } };
  }
  if (it && it.kind === 'arma') {
    const t = weaponTypeOf(it);
    const pesante = it.classe === 'pesante';
    const skill: SkillId = pesante ? 'armiPesanti' : 'armiLeggere';
    const k = 1 + mod(m, pesante ? 'dannoPesanti' : 'dannoLeggere') + leggeraBonus + skillBonus(h, skill, dannoPerLv());
    const vel = (it.velocita ?? 1) * (1 + mod(m, pesante ? 'velocitaPesanti' : 'velocitaLeggere'));
    const w: RunWeapon = {
      id: it.id, kind: 'mischia', skill, classe: it.classe ?? null, danno: r2((it.danno ?? 0) * k), tempo: r2(1 / Math.max(0.05, vel)),
      portata: it.portata ?? 1.5, carica: r2((t?.carica ?? 1) * caricaK), caricaMolt: t?.caricaMolt ?? 2, gittata: 0, traits: { ...(it.traits ?? {}) },
    };
    if (it.traits?.fragile) w.usura = h.usura[it.id] ?? 0;
    return w;
  }
  const k = 1 + mod(m, 'dannoLeggere') + leggeraBonus + skillBonus(h, 'armiLeggere', dannoPerLv());
  return { id: null, kind: 'pugni', skill: 'armiLeggere', classe: null, danno: r2(P.danno * k), tempo: r2(1 / P.velocita), portata: P.portata, carica: r2(P.carica * caricaK), caricaMolt: P.caricaMolt, gittata: 0, traits: {} };
}

function arrowsOf(h: HeroState, m: Mods): RunArrows | null {
  const it = equipped(h, 'frecce');
  if (!it || it.kind !== 'frecce') return null;
  const k = 1 + mod(m, 'dannoArco') + skillBonus(h, 'arceria', dannoPerLv());
  const traits: Traits = { ...(it.traits ?? {}) };
  return { id: it.id, n: h.inv[it.id] ?? 0, danno: r2((it.danno ?? 0) * k), gittata: it.gittata ?? 0, gravita: it.gravita ?? materialOf(it)?.frecce.gravita ?? 9.8, traits };
}

function spellsOf(h: HeroState, m: Mods): RunSpell[] {
  const out: RunSpell[] = [];
  for (const id of h.magie) {
    let s;
    try { s = spellDef(id); } catch { continue; }
    const dist = s.scuola === 'distruzione';
    const costo = Math.max(1, Math.round(s.costo * clamp(1 + mod(m, dist ? 'costoDistruzione' : 'costoEvocazione'), 0.2, 3)));
    const k = 1 + mod(m, 'dannoDistruzione') + skillBonus(h, 'distruzione', dannoPerLv());
    out.push({
      id: s.id, scuola: s.scuola, costo, ricarica: s.ricarica, danno: dist ? r2((s.danno ?? 0) * k) : 0, velocita: s.velocita ?? 0, raggio: s.raggio ?? 0,
      sanguina: s.sanguina ?? 0, evoca: s.evoca ?? null, durata: s.evoca ? r2((s.durata ?? 0) * (1 + mod(m, 'durataEvocazione'))) : 0,
    });
  }
  return out;
}

/** Potenza delle pozioni: sale con Alchimia sopra il livello iniziale e coi perk. */
export function potionPower(h: HeroState, m: Mods = modsOf(h)): number {
  return r2(1 + skillBonus(h, 'alchimia', RPG.abilita?.potenzaPerLivello ?? 0.01) + mod(m, 'potenzaPozioni'));
}
function potionsOf(h: HeroState, m: Mods): RunPotion[] {
  const k = potionPower(h, m);
  const out: RunPotion[] = [];
  for (const id of Object.keys(h.inv).sort()) {
    const n = h.inv[id] ?? 0;
    if (n < 1 || !hasItem(id)) continue;
    const it = itemDef(id);
    if (it.kind !== 'pozione') continue;
    const cura: Partial<Record<AttrId, number>> = {};
    for (const [a, v] of Object.entries(it.cura ?? {})) cura[a as AttrId] = Math.round((v ?? 0) * k);
    out.push({ id, n, cura, buff: it.buff ? { mod: it.buff.mod, valore: r2(it.buff.valore * k), secondi: it.buff.secondi } : null });
  }
  return out;
}

/** RunHero: camminata, corsa, arma.tempo e arma.carica SENZA il malus dell'armatura e senza velocitaMolt: li applica la sim del dungeon da `armatura`. */
export function buildRunHero(h: HeroState): RunHero {
  const m = modsOf(h);
  const max = maxOf(h, m);
  const R = RPG.attributi.regen;
  const regen = {
    vita: r2(R.vita * Math.max(0, 1 + mod(m, 'regenVita'))),
    magicka: r2(R.magicka * Math.max(0, 1 + mod(m, 'regenMagicka'))),
    stamina: r2(R.stamina * Math.max(0, 1 + mod(m, 'regenStamina'))),
  };
  const { leggera, ...armatura } = armorOf(h, m, max.stamina);
  const mv = RPG.movimento;
  const magie = spellsOf(h, m);
  const pozioni = potionsOf(h, m);
  const mi = h.equip.magia ? magie.findIndex((s) => s.id === h.equip.magia) : -1;
  const pi = h.equip.pozione ? pozioni.findIndex((p) => p.id === h.equip.pozione) : -1;
  const skill = {} as Record<SkillId, number>;
  for (const s of SKILLS) skill[s] = h.skill[s]?.lv ?? RPG.livelli.skillIniziale;
  // Anello dell'Onda della Regina: l'Eco della Marea c'è o non c'è (due anelli uguali non si sommano)
  const eco = [equipped(h, 'anello1'), equipped(h, 'anello2')].find((it) => it?.traits?.eco)?.traits?.eco;
  return {
    ...(eco ? { eco: { ...eco } } : {}),
    livello: h.livello, max, regen,
    camminata: mv.camminata, corsa: r2(mv.corsa * (1 + mod(m, 'velocitaCorsa'))),
    staminaCorsa: r2(mv.staminaCorsa * clamp(1 + mod(m, 'staminaCorsa'), 0.1, 3)), mentreCarichi: mv.mentreCarichi, raggio: mv.raggio,
    arma: weaponOf(h, m, leggera), frecce: arrowsOf(h, m), armatura,
    magie, magia: mi >= 0 ? mi : null, ...(mi >= 0 && h.equip.mano === 'magia' ? { manoMagia: true } : {}), pozioni, pozione: pi >= 0 ? pi : null,
    skill, carico: carriedOf(h), caricoMax: caricoMaxOf(h, m), pesi: { ...PESI },
  };
}

/** Capienza del Forziere (kg) dal livello dell'edificio (0 = non costruito). */
export function forziereCap(level: number): number { return level >= 1 ? RPG.forziere[Math.min(level, RPG.forziere.length) - 1] ?? 0 : 0; }
