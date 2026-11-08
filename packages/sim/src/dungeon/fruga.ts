// Bottino a mano (prima persona, docs/PRIMA_PERSONA.md): come in Skyrim i cadaveri restano a terra e i forzieri si aprono; si fruga quello a
// portata di mano e si sceglie cosa prendere. L'azione `fruga` (il client la manda entrando) spegne per quell'eroe la raccolta automatica
// passandoci sopra (loot.ts); `prendi` porta nello zaino un oggetto (quanti ne entrano), le monete o tutto. Insieme ognuno fruga la sua parte.
// Le azioni ritornano i loro eventi (non quelli del tick): null = non si può (lontano, vuoto, niente che entri), e allora non si registra.
import type { DungeonEvent } from './types.ts';
import { RPG } from '@marea/content/rpg.ts';
import type { Bag, DungeonState, EroeRt, Loot } from './state.ts';
import { parte } from './state.ts';
import { pesoDi, pesoZaino } from './loot.ts';

/** Fin dove arriva la mano: distanza dal centro dell'eroe al centro del bottino, oltre al raggio dell'eroe. */
const RAGGIO_FRUGA = 1.9;

/** Prima persona: camminando (senza correre) i nemici ti notano più tardi, chi dorme quasi solo se gli arrivi addosso: moltiplica la loro vista. */
export function furtivita(r: EroeRt, dorme: boolean): number {
  const F = RPG.dungeon.furtivo;
  return F && r.hero.fruga && !r.hero.running ? F.vista * (dorme ? F.dorme : 1) : 1;
}

/** Da qui in poi l'eroe di turno prende il bottino a mano. */
export function frugaNow(s: DungeonState): DungeonEvent[] | null {
  if (s.hero.fruga) return null;
  s.hero.fruga = true;
  return [];
}

/** Il bottino `l` è a portata di mano dell'eroe di turno? */
export function aPortata(s: DungeonState, l: Loot): boolean {
  const dx = l.x - s.hero.x, dz = l.z - s.hero.z, r = RAGGIO_FRUGA + s.runHero.raggio;
  return dx * dx + dz * dz <= r * r;
}

/** Cosa c'è per l'eroe di turno nel bottino `id` (per la finestra del client); null se non c'è più. */
export function contenuto(s: DungeonState, id: number): { tipo: Loot['tipo']; items: Bag; monete: number; vuoto: boolean } | null {
  const l = s.loot.find((x) => x.id === id);
  if (!l) return null;
  const p = parte(s, l);
  return { tipo: l.tipo, items: { ...p.items }, monete: p.monete, vuoto: p.vuoto };
}

/** Prende dal bottino `id`: l'oggetto `item` (quanti ne entrano nello zaino), 'monete', o tutto (assente) finché il peso lo permette. */
export function prendiNow(s: DungeonState, id: number, item?: string): DungeonEvent[] | null {
  const l = s.loot.find((x) => x.id === id);
  if (!l || !aPortata(s, l)) return null;
  const p = parte(s, l);
  if (p.vuoto || (item !== undefined && item !== 'monete' && !(p.items[item]! > 0))) return null;
  const out: DungeonEvent[] = [];
  if ((item === undefined || item === 'monete') && p.monete > 0) { s.monete += p.monete; out.push({ t: 'monete', n: p.monete }); p.monete = 0; }
  let peso = pesoZaino(s), bloccato = '';
  const max = s.runHero.caricoMax;
  for (const k of item === 'monete' ? [] : Object.keys(p.items).sort()) {
    if (item !== undefined && k !== item) continue;
    const n = p.items[k]!, w = pesoDi(s, k), quanti = w <= 0 ? n : Math.min(n, Math.floor((max - peso + 1e-9) / w));
    if (quanti > 0) {
      s.bottino[k] = (s.bottino[k] ?? 0) + quanti; peso += quanti * w;
      out.push({ t: 'raccolto', item: k, n: quanti });
      if (k.startsWith('libro_')) out.push({ t: 'libro', item: k });
    }
    if (quanti < n) { p.items[k] = n - quanti; bloccato ||= k; } else delete p.items[k];
  }
  if (!out.length) return null; // niente che entri nello zaino: non è cambiato niente
  p.vuoto = Object.keys(p.items).length === 0 && p.monete === 0;
  p.pieno = bloccato !== '';
  if (bloccato) out.push({ t: 'pieno', item: bloccato });
  return out;
}
