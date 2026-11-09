// Arena PvP (docs/ARENA.md §2): la build del duello, uguale per tutti e senza niente del personaggio (abilità, perk, zaino): una dote (+50% di
// Vita, Vigore o Magicka), ARENA.slot slot tra le armi (una per tipo, tutte dello stesso materiale) e le magie di ARENA.build (niente evocazioni)
// e un'ulti. Se ne salvano fino a ARENA.build.salvate col personaggio (HeroState.arena, POST /api/rpg {t:'arena'}).
// Dalla build la fotografia del duello (ArenaEroe): una RunHero «arena» per slot, coi numeri dell'Arena (arena.json → build) e il passo
// dell'arma in mano (le pesanti rallentano un po').
import { ARENA } from '@marea/content/arena.ts';
import { spellDef } from '@marea/content/rpg.ts';
import { buildRunHero } from './derived.ts';
import { newHero } from './hero.ts';
import { hasItem, itemDef } from './items.ts';
import type { ArenaBuild, ArenaBuilds, ArenaSlot, HeroState, RunHero } from './types.ts';

const B = ARENA.build;
/** La fotografia del duello: una RunHero per slot (null = slot vuoto, o Cura e Furia nel 1 contro 1), la dote e l'ulti. */
export type ArenaEroe = { varianti: (RunHero | null)[]; dote: string; ulti: string };

export const slotArma = (s: ArenaSlot | null | undefined): s is { arma: string } => !!s && typeof s === 'object' && 'arma' in s;
export const slotMagia = (s: ArenaSlot | null | undefined): s is { magia: string } => !!s && typeof s === 'object' && 'magia' in s;
/** Le armi e le magie che si possono mettere negli slot (in ordine: armi, poi magie). */
export const ARMI_ARENA: readonly string[] = Object.keys(B.armi).filter(hasItem);
export const MAGIE_ARENA: readonly string[] = Object.keys(B.magie).filter((id) => { try { return !spellDef(id).evoca; } catch { return false; } });
/** Cura e Furia: valgono solo nelle partite a squadre (nel 1 contro 1 lo slot resta vuoto). */
export const soloSquadre = (s: ArenaSlot | null | undefined): boolean => slotMagia(s) && spellDef(s.magia).scuola === 'supporto';

/** La build con cui si parte: Vita, katana e arco, Furia. */
export const BUILD_BASE: ArenaBuild = { dote: 'vita', slot: [{ arma: 'katana_ferro' }, { arma: 'arco_ferro' }], ulti: 'furia' };

const chiave = (s: ArenaSlot): string => (slotMagia(s) ? 'magia:' + s.magia : s.arma);
/** null se la build va bene, altrimenti il motivo in italiano. */
export function erroreBuild(b: ArenaBuild): string | null {
  if (!b || typeof b !== 'object' || !Array.isArray(b.slot) || b.slot.length !== ARENA.slot) return 'Build non valida';
  if (!B.doti.some((d) => d.id === b.dote)) return 'Scegli una dote';
  if (!ARENA.ulti.lista.some((u) => u.id === b.ulti)) return 'Scegli un’ulti';
  const usate = new Set<string>();
  for (const s of b.slot) {
    if (s === null) continue;
    if (slotArma(s) ? !ARMI_ARENA.includes(s.arma) : !slotMagia(s) || !MAGIE_ARENA.includes(s.magia)) return 'Arma o magia non valida';
    if (usate.has(chiave(s))) return 'La stessa arma o magia due volte';
    usate.add(chiave(s));
  }
  if (!b.slot.some((s) => s && !soloSquadre(s))) return 'Metti almeno un’arma o una magia d’attacco';
  return null;
}
/** null se le build salvate vanno bene. */
export function erroreBuilds(x: ArenaBuilds): string | null {
  if (!x || !Array.isArray(x.build) || !x.build.length || x.build.length > B.salvate || !Number.isInteger(x.scelta) || x.scelta < 0 || x.scelta >= x.build.length) return 'Build non valide';
  for (const b of x.build) { const e = erroreBuild(b); if (e) return e; }
  return null;
}
/** Le build salvate (quelle che non vanno più bene, o un salvataggio di prima, diventano BUILD_BASE). */
export function buildsDi(h: HeroState): ArenaBuilds {
  const a = h.arena as ArenaBuilds | undefined;
  if (!a || !Array.isArray(a.build) || !a.build.length) return { build: [BUILD_BASE], scelta: 0 };
  const build = a.build.slice(0, B.salvate).map((b) => (erroreBuild(b) ? BUILD_BASE : b));
  return { build, scelta: Number.isInteger(a.scelta) && a.scelta >= 0 && a.scelta < build.length ? a.scelta : 0 };
}
/** La build scelta per la prossima partita. */
export const buildScelta = (h: HeroState): ArenaBuild => { const x = buildsDi(h); return x.build[x.scelta]!; };

const r2 = (x: number): number => Math.round(x * 100) / 100;
/** Il passo con un'arma di `peso` kg in mano. */
export const passoDi = (peso: number): number => r2(1 + (B.passo.neutro - peso) * B.passo.perKg);

/** La RunHero di uno slot: niente perk, niente armatura, i numeri dell'Arena, la dote. null = i pugni. */
function variante(dote: string, s: ArenaSlot | null): RunHero {
  const h: HeroState = { ...newHero(), inv: {}, equip: {}, magie: [], perk: [], usura: {} };
  if (slotArma(s)) {
    h.inv[s.arma] = 1; h.equip.arma = s.arma;
    if (itemDef(s.arma).kind === 'arco') { h.inv[ARENA.frecceBase] = ARENA.frecce; h.equip.frecce = ARENA.frecceBase; }
  } else if (slotMagia(s)) { h.magie = [s.magia]; h.equip.magia = s.magia; h.equip.mano = 'magia'; }
  const rh = buildRunHero(h), d = B.doti.find((x) => x.id === dote) ?? B.doti[0]!;
  const k = { vita: d.vita ?? 1, magicka: d.magicka ?? 1, stamina: d.stamina ?? 1 };
  const max = { vita: Math.round(B.attributi.vita * k.vita), magicka: Math.round(B.attributi.magicka * k.magicka), stamina: Math.round(B.attributi.stamina * k.stamina) };
  const regen = { vita: r2(B.regen.vita * k.vita), magicka: r2(B.regen.magicka * k.magicka), stamina: r2(B.regen.stamina * k.stamina) };
  const peso = slotArma(s) ? itemDef(s.arma).peso : B.passo.neutro, passo = passoDi(peso);
  let arma = rh.arma, frecce = rh.frecce;
  const n = slotArma(s) ? B.armi[s.arma] : undefined;
  if (n && arma.kind === 'arco') {
    const t = n.tensione ?? arma.tempo;
    arma = { ...arma, danno: n.danno, tempo: t, carica: t, fatica: B.staminaFreccia };
    if (frecce) frecce = { ...frecce, danno: 0, n: ARENA.frecce };
  } else if (n && arma.kind === 'mischia') {
    const tempo = r2(1 / Math.max(0.05, n.colpi ?? 1));
    arma = { ...arma, danno: n.danno, tempo, carica: n.carica ?? arma.carica, caricaMolt: n.caricaMolt ?? arma.caricaMolt, portata: n.portata ?? arma.portata, fatica: r2(B.staminaAlSecondo * tempo) };
  } else arma = { ...arma, fatica: r2(B.staminaAlSecondo * arma.tempo) };
  const magie = rh.magie.map((sp) => {
    const m = B.magie[sp.id] ?? {};
    return { ...sp, ...(m.danno !== undefined ? { danno: m.danno } : {}), ...(m.cura !== undefined && sp.cura !== undefined ? { cura: m.cura } : {}), ...(m.costo !== undefined ? { costo: m.costo } : {}), ...(m.ricarica !== undefined ? { ricarica: m.ricarica } : {}) };
  });
  const { perk: _perk, ...resto } = rh;
  return { ...resto, arena: true, max, regen, camminata: r2(rh.camminata * passo), corsa: r2(rh.corsa * passo), arma, frecce, magie, pozioni: [], pozione: null, pesi: {}, carico: 0 };
}

/** La fotografia del duello dalla build. Senza niente negli slot, i pugni. */
export function buildArenaEroe(b: ArenaBuild): ArenaEroe {
  const varianti = b.slot.map((s) => (s ? variante(b.dote, s) : null));
  if (!varianti.some((v) => v)) varianti[0] = variante(b.dote, null);
  return { varianti, dote: b.dote, ulti: b.ulti };
}
