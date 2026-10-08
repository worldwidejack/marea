// @marea/content/templari.ts: dati dell'Isola dei Templari (docs/TEMPLARI.md). Entry separata da index.ts: il bundle iniziale del client
// non la importa, la carica solo il chunk delle ondate (apps/client/src/templari/**). Formule in @marea/sim/templari.
import cfg from './templari/templari.json' with { type: 'json' };
import mappa from './templari/mappa.json' with { type: 'json' };
import type { TArmaDef, TMappaDef, TNemicoDef, TemplariCfg } from './templari_types.ts';

export type * from './templari_types.ts';

export const TEMPLARI = cfg as unknown as TemplariCfg;
export const TEMPLARI_MAPPA = mappa as unknown as TMappaDef;

export function armaDef(id: string): TArmaDef {
  const a = TEMPLARI.armi.find((x) => x.id === id);
  if (!a) throw new Error(`Arma sconosciuta: ${id}`);
  return a;
}
export function nemicoDef(id: string): TNemicoDef {
  const n = TEMPLARI.nemici.find((x) => x.id === id);
  if (!n) throw new Error(`Nemico sconosciuto: ${id}`);
  return n;
}

/** Controlli dei dati (in italiano): numeri sensati, l'arma di partenza esiste, la mappa ha partenza, altare, comparse e finestre. */
export function validateTemplari(): string[] {
  const errs: string[] = [], c = TEMPLARI;
  const pos = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v > 0;
  if (!c.armi.some((a) => a.id === c.partenza.arma)) errs.push(`templari: arma di partenza ${c.partenza.arma} sconosciuta`);
  for (const a of c.armi) {
    if (!pos(a.danno) || !pos(a.tempo)) errs.push(`templari: arma ${a.id} con danno o tempo non validi`);
    if (a.tipo === 'mischia' && !pos(a.portata)) errs.push(`templari: arma ${a.id} senza portata`);
    if (a.tipo !== 'mischia' && (!pos(a.colpi) || !pos(a.velocita) || !pos(a.gittata))) errs.push(`templari: arma ${a.id} senza colpi, velocità o gittata`);
  }
  for (const n of c.nemici) if (!pos(n.vitaMolt) || !pos(n.raggio) || !pos(n.danno) || !pos(n.velocita.cammina)) errs.push(`templari: nemico ${n.id} non valido`);
  if (!c.nemici.some((n) => n.id === 'fante')) errs.push('templari: manca il fante crociato');
  if (!(c.ondate.insieme >= 1 && c.ondate.quanti.base >= 1)) errs.push('templari: ondate vuote');
  const rows = TEMPLARI_MAPPA.rows, all = rows.join('');
  for (const [ch, cosa] of [['S', 'la partenza'], ['A', "l'altare"], ['z', 'le comparse'], ['W', 'le finestre']] as const) if (!all.includes(ch)) errs.push(`templari: la mappa non ha ${cosa}`);
  if (all.split('S').length !== 2) errs.push('templari: la mappa vuole una sola partenza');
  for (const [ch, l] of Object.entries(TEMPLARI_MAPPA.legenda)) {
    if (l.porta && !all.includes(ch)) errs.push(`templari: porta ${l.porta} non nella mappa`);
    if (l.muro && !c.armi.some((a) => a.id === l.muro)) errs.push(`templari: arma sul muro ${l.muro} sconosciuta`);
    if (l.muro && c.armi.find((a) => a.id === l.muro)?.prezzo === undefined) errs.push(`templari: l'arma sul muro ${l.muro} non ha prezzo`);
  }
  if (!all.includes('C')) errs.push('templari: la mappa non ha posti per la cassa');
  if (!c.armi.some((a) => (a.cassa ?? 0) > 0)) errs.push('templari: la cassa non ha armi');
  return errs;
}
