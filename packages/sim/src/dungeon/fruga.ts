// Bottino a mano (prima persona, docs/PRIMA_PERSONA.md): come in Skyrim i cadaveri restano a terra e i forzieri si aprono; si fruga quello a
// portata di mano e si sceglie cosa prendere. L'azione `fruga` (il client la manda entrando) spegne per quell'eroe la raccolta automatica
// passandoci sopra (loot.ts); `prendi` porta nello zaino un oggetto (quanti ne entrano), le monete o tutto. Insieme ognuno fruga la sua parte.
// Le azioni ritornano i loro eventi (non quelli del tick): null = non si può (lontano, vuoto, niente che entri), e allora non si registra.
import type { DungeonEvent } from './types.ts';
import { RPG } from '@marea/content/rpg.ts';
import type { Bag, DungeonState, EroeRt, Loot } from './state.ts';
import { parte } from './state.ts';
import { pesoDi, pesoZaino } from './loot.ts';
import { lunghezzaCorpo } from './alzo.ts';
import { riallinea } from './zaino.ts';

/** Fin dove arriva la mano: distanza dal centro dell'eroe al centro del bottino, oltre al raggio dell'eroe. */
const RAGGIO_FRUGA = 1.9;

/** Prima persona: camminando (senza correre) i nemici ti vedono da più vicino: moltiplica la loro vista (quiete.ts). */
export function furtivita(r: EroeRt): number {
  const F = RPG.dungeon.furtivo;
  return F && r.hero.fruga && !r.hero.running ? F.vista : 1;
}

/** Da qui in poi l'eroe di turno prende il bottino a mano. */
export function frugaNow(s: DungeonState): DungeonEvent[] | null {
  if (s.hero.fruga) return null;
  s.hero.fruga = true;
  return [];
}

/** Fin dove arriva la mano dell'eroe di turno (m, dal bordo del bottino al suo centro): il client la misura dal punto del corpo che mira. */
export const portataMano = (s: DungeonState): number => RAGGIO_FRUGA + s.runHero.raggio;

/** Quanto il cadavere `l` si allunga oltre il punto dove è caduto (m): giace lungo quanto era alto il nemico (un capo di più) e può
 *  stendersi in ogni direzione, un po' di margine per le braccia aperte. 0 per tutto il resto. */
function ingombro(s: DungeonState, l: Loot): number {
  if (l.tipo !== 'cadavere') return 0;
  const e = s.enemies.find((x) => x.st === 'morto' && !x.alleato && Math.abs(x.x - l.x) < 0.05 && Math.abs(x.z - l.z) < 0.05);
  return e ? lunghezzaCorpo(e) * 1.25 + 0.3 : 0;
}

/** Il bottino `l` è a portata di mano dell'eroe di turno? Un cadavere lungo (un capo) si può frugare anche dal lato lontano: conta
 *  quanto è disteso, non solo il punto dov'è caduto. La mira stretta (quale punto del corpo) la fa il client (fp_fruga.ts). */
export function aPortata(s: DungeonState, l: Loot): boolean {
  const dx = l.x - s.hero.x, dz = l.z - s.hero.z, d2 = dx * dx + dz * dz, r = portataMano(s);
  if (d2 <= r * r) return true;
  if (l.tipo !== 'cadavere' || d2 > (r + 6) * (r + 6)) return false;
  const q = r + ingombro(s, l);
  return d2 <= q * q;
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
  const presi: string[] = [];
  const max = s.runHero.caricoMax;
  for (const k of item === 'monete' ? [] : Object.keys(p.items).sort()) {
    if (item !== undefined && k !== item) continue;
    const n = p.items[k]!, w = pesoDi(s, k), quanti = w <= 0 ? n : Math.min(n, Math.floor((max - peso + 1e-9) / w));
    if (quanti > 0) {
      s.bottino[k] = (s.bottino[k] ?? 0) + quanti; peso += quanti * w; presi.push(k);
      out.push({ t: 'raccolto', item: k, n: quanti });
      if (k.startsWith('libro_')) out.push({ t: 'libro', item: k });
    }
    if (quanti < n) { p.items[k] = n - quanti; bloccato ||= k; } else delete p.items[k];
  }
  if (!out.length) return null; // niente che entri nello zaino: non è cambiato niente
  p.vuoto = Object.keys(p.items).length === 0 && p.monete === 0;
  p.pieno = bloccato !== '';
  riallinea(s, presi);
  if (bloccato) out.push({ t: 'pieno', item: bloccato });
  return out;
}
