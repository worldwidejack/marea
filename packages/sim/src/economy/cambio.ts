// Conversione dei vecchi salvataggi alle monete (#414, VISIONE §2, GDD §5). La fa il server in lettura (DO Lot), una volta sola: un lotto
// con `monete` è già convertito. Chi ha comprato tiene tutto (mobili, finiture, cappelli, colori della barca, decorazioni, ampliamenti,
// equipaggiamento): diventano monete, al cambio fisso di `BALANCE.monete.cambio`, solo
// - le risorse di prima (Legno, Pietra, Perle) del lotto;
// - gli edifici spenti del giardino (EDIFICI_SPENTI): quanto erano costati i loro livelli (anche il cantiere in corso, già pagato) e il
//   deposito non ancora raccolto;
// - le monete del personaggio (`hero.monete`, il portafoglio del GDR di prima; senza personaggio quelle con cui sarebbe nato).
// Molo (la barca), Banco da Lavoro (Fabbro), Tavolo Alchemico (Alchimista) e Forziere (baule della casa) restano col loro livello.
// Le poste delle sfide in corso (escrow) e il Faro comune restano nelle risorse di prima, col loro codice spento. Pura.
import { BALANCE, building } from '@marea/content';
import { inMonete } from './monete.ts';
import { ZERO, add } from './types.ts';
import type { CambioMonete, LotState, PlacedBuilding, Resources, StoredBuilding } from './types.ts';

/** Edifici del giardino che non ci sono più (#414): diventano monete. Gli altri diventano le botteghe del Borgo, la barca e il baule. */
export const EDIFICI_SPENTI: ReadonlySet<string> = new Set(['segheria', 'cava', 'magazzino', 'casa', 'faro', 'tavolo', 'serra']);

/** Quanto è costato un edificio fino al livello `livello` (somma dei livelli 1..livello). */
export function costoEdificio(id: string, livello: number): Resources {
  let r: Resources = { ...ZERO };
  for (const l of building(id).levels.slice(0, Math.max(0, livello))) r = add(r, l.cost);
  return r;
}

/** Valore di un edificio spento: i livelli pagati più il deposito di Legno o Pietra non raccolto (la Serra tiene ingredienti: non conta). */
function valore(b: PlacedBuilding | StoredBuilding): Resources {
  const r = costoEdificio(b.building, b.level), res = building(b.building).produces, dep = Math.max(0, Math.floor(b.buffer || 0));
  return res === 'legno' || res === 'pietra' ? { ...r, [res]: r[res] + dep } : r;
}

type LottoVecchio = Omit<LotState, 'monete'> & { monete?: number; hero?: LotState['hero'] & { monete?: number } };

/** Converte un salvataggio di prima del 18 ott 2026 (nessun `monete`); un lotto già convertito torna identico. */
export function convertiMonete(lot0: LotState | LottoVecchio): LotState {
  if (typeof lot0.monete === 'number') return lot0 as LotState;
  const lot = lot0 as LottoVecchio;
  let edifici: Resources = { ...ZERO };
  const spenti: string[] = [];
  const buildings: PlacedBuilding[] = [];
  for (const b of lot.buildings) {
    if (EDIFICI_SPENTI.has(b.building)) { edifici = add(edifici, valore(b)); spenti.push(b.building); } else buildings.push(b);
  }
  const riposti: StoredBuilding[] = [];
  for (const b of lot.magazzinoEdifici ?? []) {
    if (EDIFICI_SPENTI.has(b.building)) { edifici = add(edifici, valore(b)); spenti.push(b.building); continue; }
    // un edificio che resta (barca, bottega, baule) ma era riposto: torna fuori, così il suo livello vale ancora (fitToTemplate gli trova la cella)
    if (buildings.some((x) => x.building === b.building)) riposti.push(b);
    else buildings.push({ id: b.id, building: b.building, level: b.level, cell: [0, 0], buffer: b.buffer, lastMs: b.lastMs, ...(b.rot ? { rot: b.rot } : {}) });
  }
  // il cantiere di un edificio spento era già pagato: vale il livello che stava costruendo
  let construction = lot.construction;
  if (construction && EDIFICI_SPENTI.has(construction.building)) {
    const l = building(construction.building).levels[construction.level - 1];
    if (l) edifici = add(edifici, l.cost);
    construction = null;
  }
  const eroe = lot.hero ? Math.max(0, Math.floor(lot.hero.monete ?? 0)) : BALANCE.monete.partenza;
  const risorse: Resources = { ...lot.resources };
  const monete = inMonete(risorse) + inMonete(edifici) + eroe;
  const cambio: CambioMonete = { ms: lot.nowMs, monete, risorse, edifici, edificiSpenti: [...new Set(spenti)].sort(), eroe };
  let hero = lot.hero;
  if (hero && 'monete' in hero) { const { monete: _vecchie, ...h } = hero; hero = h; }
  const out: LotState = {
    ...lot,
    version: lot.version + 1,
    monete,
    cambio,
    resources: { ...ZERO },
    buildings,
    construction,
    boostUntilMs: 0,
    // le risorse escono dal libro mastro di prima (così il suo invariante regge) ed entrano in quello delle monete
    ledger: { ...lot.ledger, spent: add(lot.ledger.spent, risorse), monete: { generated: monete, spent: 0 } },
    ...(hero ? { hero } : {}),
  };
  if (lot.magazzinoEdifici) out.magazzinoEdifici = riposti;
  return out;
}
