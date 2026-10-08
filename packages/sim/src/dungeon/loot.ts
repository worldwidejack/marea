// Bottino: tiri sulle tabelle di loot.json (rng dedicato, così l'ordine delle uccisioni non cambia cosa cade) e raccolta automatica a peso.
import { LOOT } from '@marea/content/rpg.ts';
import type { LootTable } from '@marea/content/rpg.ts';
import type { Rng } from '../rng.ts';
import type { Bag, DungeonState, Loot, LootParte } from './state.ts';
import { ev, inGioco, parte } from './state.ts';
import { PESO_IGNOTO, RAGGIO_RACCOLTA } from './tuning.ts';
import { invNow } from './zaino.ts';

export function lootTable(id: string): LootTable {
  const t = LOOT.find((x) => x.id === id);
  if (!t) throw new Error(`Tabella di bottino sconosciuta: ${id}`);
  return t;
}

/** Tira una tabella: monete e oggetti. molt = dropMolt (oro); raro = le voci rare cadono sicuro (frecce d'oro). */
export function rollLoot(id: string, rng: Rng, o: { molt: number; raro: boolean }): { items: Bag; monete: number } {
  const t = lootTable(id);
  const items: Bag = {};
  const monete = Math.round(rng.int(t.monete[0], t.monete[1]) * o.molt);
  for (const v of t.voci) {
    const r = rng.next(), n = rng.int(v.n[0], v.n[1]);
    if (r < v.p || (o.raro && v.raro)) items[v.item] = (items[v.item] ?? 0) + Math.max(1, Math.round(n * o.molt));
  }
  return { items, monete };
}

export const pesoDi = (s: DungeonState, item: string): number => s.runHero.pesi[item] ?? PESO_IGNOTO;

/** Peso trasportato: lo zaino di adesso (v5, con `stato`: senza usati, rotti e buttati); senza `stato` quello con cui si è entrati + il raccolto. */
export function pesoZaino(s: DungeonState): number {
  if (s.stato) {
    const inv = invNow(s);
    let w = 0;
    for (const k of Object.keys(inv)) w += pesoDi(s, k) * inv[k]!;
    return w;
  }
  let p = s.runHero.carico;
  for (const k of Object.keys(s.bottino).sort()) p += pesoDi(s, k) * s.bottino[k]!;
  return p;
}

/** Raccoglie in automatico i bottini su cui l'eroe passa: monete sempre, oggetti finché il peso lo permette. */
/** Insieme: ogni eroe in gioco raccoglie la sua parte di ogni bottino. */
export function pickup(s: DungeonState): void {
  const prima = s.cur;
  for (const i of s.eroi.length > 1 ? inGioco(s) : [prima]) {
    s.cur = i;
    const h = s.hero, r = s.runHero.raggio + RAGGIO_RACCOLTA;
    for (const l of s.loot) {
      const p = parte(s, l);
      if (p.vuoto) continue;
      const dx = l.x - h.x, dz = l.z - h.z;
      if (dx * dx + dz * dz > r * r) { p.pieno = false; continue; }
      take(s, p);
    }
  }
  s.cur = prima;
}

function take(s: DungeonState, l: LootParte): void {
  if (l.monete > 0) {
    s.monete += l.monete;
    ev(s, { t: 'monete', n: l.monete });
    l.monete = 0;
  }
  let peso = pesoZaino(s);
  const max = s.runHero.caricoMax;
  let bloccato = '';
  for (const k of Object.keys(l.items).sort()) {
    const n = l.items[k]!, w = pesoDi(s, k);
    const quanti = w <= 0 ? n : Math.min(n, Math.floor((max - peso + 1e-9) / w));
    if (quanti > 0) {
      s.bottino[k] = (s.bottino[k] ?? 0) + quanti;
      peso += quanti * w;
      ev(s, { t: 'raccolto', item: k, n: quanti });
      if (k.startsWith('libro_')) ev(s, { t: 'libro', item: k });
    }
    if (quanti < n) { l.items[k] = n - quanti; if (!bloccato) bloccato = k; }
    else delete l.items[k];
  }
  if (bloccato && !l.pieno) ev(s, { t: 'pieno', item: bloccato });
  l.pieno = bloccato !== '';
  l.vuoto = Object.keys(l.items).length === 0 && l.monete === 0;
}

/** C'è qualcosa in questo bottino che entra nello zaino? (per l'autopilot) */
export function fits(s: DungeonState, bottino: Loot): boolean {
  const l = parte(s, bottino);
  if (l.vuoto) return false;
  if (l.monete > 0) return true;
  const libero = s.runHero.caricoMax - pesoZaino(s);
  return Object.keys(l.items).some((k) => pesoDi(s, k) <= libero);
}
