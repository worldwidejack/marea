// @marea/content/templari.ts: dati dell'Isola dei Templari (docs/TEMPLARI.md). Entry separata da index.ts: il bundle iniziale del client
// non la importa, la carica solo il chunk delle ondate (apps/client/src/templari/**). Formule in @marea/sim/templari.
import cfg from './templari/templari.json' with { type: 'json' };
import mappa from './templari/mappa.json' with { type: 'json' };
import type { TArmaDef, TEroeDef, TMappaDef, TNemicoDef, TemplariCfg } from './templari_types.ts';

export type * from './templari_types.ts';

export const TEMPLARI = cfg as unknown as TemplariCfg;
export const TEMPLARI_MAPPA = mappa as unknown as TMappaDef;

export function armaDef(id: string): TArmaDef {
  const a = TEMPLARI.armi.find((x) => x.id === id);
  if (!a) throw new Error(`Arma sconosciuta: ${id}`);
  return a;
}
/** L'eroe del menù d'ingresso; null se l'id non c'è (allora si gioca senza eroe, come prima del menù). */
export function eroeDef(id: string | null | undefined): TEroeDef | null {
  return (id && TEMPLARI.eroi.find((x) => x.id === id)) || null;
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
  if (!(c.ondate.insieme.base >= 1 && c.ondate.insieme.max >= c.ondate.insieme.base && c.ondate.quanti.base >= 1)) errs.push('templari: ondate vuote');
  const rows = TEMPLARI_MAPPA.rows, all = rows.join('');
  for (const [ch, cosa] of [['S', 'la partenza'], ['A', "l'altare"], ['z', 'le comparse'], ['W', 'le finestre']] as const) if (!all.includes(ch)) errs.push(`templari: la mappa non ha ${cosa}`);
  if (all.split('S').length !== 2) errs.push('templari: la mappa vuole una sola partenza');
  for (const [ch, l] of Object.entries(TEMPLARI_MAPPA.legenda)) {
    if (l.porta && !all.includes(ch)) errs.push(`templari: porta ${l.porta} non nella mappa`);
    if (l.muro && !c.armi.some((a) => a.id === l.muro)) errs.push(`templari: arma sul muro ${l.muro} sconosciuta`);
    if (l.muro && c.armi.find((a) => a.id === l.muro)?.prezzo === undefined) errs.push(`templari: l'arma sul muro ${l.muro} non ha prezzo`);
  }
  for (const l of Object.values(TEMPLARI_MAPPA.legenda)) {
    if (l.porta && !c.porte[l.porta]) errs.push(`templari: la porta ${l.porta} non ha prezzo (templari.json porte)`);
    if ((l.trappola || l.leva) && !c.trappole[(l.trappola ?? l.leva)!]) errs.push(`templari: la trappola ${l.trappola ?? l.leva} non è in templari.json`);
    if (l.comparsa && l.comparsa !== 'cripta' && !Object.values(c.porte).some((p) => p.zona === l.comparsa)) errs.push(`templari: nessuna porta apre la zona ${l.comparsa}`);
    if (l.campanella && !c.campanelle.lista[l.campanella]) errs.push(`templari: la campanella ${l.campanella} non è in templari.json`);
    if (l.trappola && !Object.entries(TEMPLARI_MAPPA.legenda).some(([k, x]) => x.leva === l.trappola && all.includes(k))) errs.push(`templari: la trappola ${l.trappola} non ha la leva`);
  }
  for (const [id, p] of Object.entries(c.porte)) if (!pos(p.prezzo)) errs.push(`templari: porta ${id} senza prezzo`);
  for (const [id, t] of Object.entries(c.trappole)) if (!pos(t.prezzo) || !pos(t.durata) || !pos(t.eroe.ogni)) errs.push(`templari: trappola ${id} non valida`);
  if (!(c.poteri.probabilita > 0 && c.poteri.probabilita < 1) || !c.poteri.tipi.length) errs.push('templari: power-up non validi');
  if (!all.includes('C')) errs.push('templari: la mappa non ha posti per la cassa');
  if (!c.armi.some((a) => (a.cassa ?? 0) > 0)) errs.push('templari: la cassa non ha armi');
  for (const a of c.armi) if (!a.nomePot) errs.push(`templari: l'arma ${a.id} non ha il nome da potenziata`);
  for (const p of ['mercante', 'strega'] as const) if (all.split(Object.entries(TEMPLARI_MAPPA.legenda).find(([, l]) => l.personaggio === p)?.[0] ?? '§').length !== 2) errs.push(`templari: la mappa vuole un posto per ${p}`);
  if (!pos(c.mercante.potenzia.prezzo) || !(c.mercante.potenzia.danno > 1)) errs.push('templari: potenziamento del Mercante non valido');
  if (!(c.strega.max >= 1) || new Set(c.strega.pozioni.map((p) => p.id)).size !== c.strega.pozioni.length || c.strega.pozioni.some((p) => !pos(p.prezzo))) errs.push('templari: pozioni della Strega non valide');
  for (const [id, f] of Object.entries(c.fuochi.lista)) if (!all.includes(Object.entries(TEMPLARI_MAPPA.legenda).find(([, l]) => l.fuoco === id)?.[0] ?? '§') || !f.nome) errs.push(`templari: il fuoco ${id} non è nella mappa`);
  for (const id of Object.keys(c.campana.pezzi)) if (!Object.entries(TEMPLARI_MAPPA.legenda).some(([k, l]) => l.pezzo === id && all.includes(k))) errs.push(`templari: il pezzo ${id} della campana non ha posti nella mappa`);
  if (!pos(c.fuochi.accendi) || !pos(c.campana.monta)) errs.push('templari: fuochi o campana senza tempi');
  // segreti (§9c): muro, scala e altare della cripta una volta sola, l'arma dell'altare, almeno due campanelle tutte nella mappa, i teschi
  const leg = Object.entries(TEMPLARI_MAPPA.legenda), quante = (f: (l: (typeof leg)[number][1]) => boolean) => leg.filter(([, l]) => f(l)).reduce((n, [k]) => n + all.split(k).length - 1, 0);
  for (const pezzo of ['muro', 'scala'] as const) if (quante((l) => l.cripta === pezzo) !== 1) errs.push(`templari: la cripta vuole un ${pezzo} (uno solo)`);
  if (!quante((l) => l.cripta === 'altare')) errs.push("templari: la cripta non ha l'altare");
  if (!c.armi.some((a) => a.id === c.cripta.arma) || !(c.cripta.anime >= 1)) errs.push("templari: l'arma della cripta non è valida");
  const camp = Object.keys(c.campanelle.lista);
  if (camp.length < 2 || camp.some((id) => !quante((l) => l.campanella === id))) errs.push('templari: le campanelle vogliono almeno due posti, tutti nella mappa');
  if (quante((l) => !!l.indizio) !== 1) errs.push("templari: la mappa vuole un muro con l'ordine delle campane");
  if (!quante((l) => !!l.teschio) || !pos(c.teschi.tieni)) errs.push('templari: i teschi della canzone non sono validi');
  for (const a of c.armi) if (a.affondo !== undefined && a.tipo !== 'mischia') errs.push(`templari: l'arma ${a.id} ha l'affondo ma non è da mischia`);
  if (!c.eroi.length) errs.push('templari: nessun eroe nel menù');
  for (const e of c.eroi) {
    for (const a of e.armi) if (a !== null && !c.armi.some((x) => x.id === a)) errs.push(`templari: l'eroe ${e.id} parte con l'arma ${a} sconosciuta`);
    if (!e.armi[0] || !pos(e.vita) || !pos(e.velocita)) errs.push(`templari: eroe ${e.id} non valido`);
    if (!pos(e.super.uccisioni) || !pos(e.super.danno) || !pos(e.super.raggio)) errs.push(`templari: super dell'eroe ${e.id} non valido`);
    for (const k of ['vita', 'forza', 'velocita', 'mira'] as const) if (!(e.barre[k] >= 1 && e.barre[k] <= 5)) errs.push(`templari: barra ${k} dell'eroe ${e.id} fuori da 1..5`);
  }
  return errs;
}
