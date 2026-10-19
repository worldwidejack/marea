// Azioni sul lotto legate alla pala di Borgo Marea (#438): comprare la pala al negozio dei mobili (500 monete, finisce nello zaino in
// categoria "strumenti" a peso 0), togliere dal lotto quello che si seppellisce (oggetto dello zaino, mobile non posato, monete) e
// aggiungere al lotto quello che si dissotterra. Puro.
import { BORGO, MOBILI } from '@marea/content';
import { advance } from '../economy/advance.ts';
import { casaDi } from '../economy/casa.ts';
import { guadagna, spendi } from '../economy/monete.ts';
import type { BucaDono } from '../economy/pala.ts';
import { possiedePala } from '../economy/pala.ts';
import { EconomyError } from '../economy/types.ts';
import type { LotState } from '../economy/types.ts';
import { addTo, fixEquip, removeFrom } from './bag.ts';
import { caricoMaxOf, carriedOf } from './derived.ts';
import { heroOf } from './hero.ts';
import { hasItem, itemDef } from './items.ts';

/** Valida un `BucaDono` ricevuto dalla rete (null se non valido). */
export function parseBucaDono(raw: unknown): BucaDono | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (r.tipo === 'monete') {
    const monete = Number(r.monete);
    return Number.isInteger(monete) && monete >= 1 && monete <= 1_000_000 ? { tipo: 'monete', monete } : null;
  }
  if (r.tipo === 'mobile' || r.tipo === 'oggetto') {
    const id = typeof r.id === 'string' ? r.id.trim() : '';
    const n = r.n === undefined ? 1 : Number(r.n);
    if (!id || !Number.isInteger(n) || n < 1 || n > 9999) return null;
    return { tipo: r.tipo, id, n };
  }
  return null;
}

/** Nome leggibile di quello che c'è in un `BucaDono`. */
export function nomeBucaDono(dono: BucaDono): string {
  if (dono.tipo === 'monete') return dono.monete === 1 ? '1 moneta' : `${dono.monete} monete`;
  if (dono.tipo === 'mobile') {
    const m = MOBILI.find((x) => x.id === dono.id);
    const nome = m?.nome ?? dono.id;
    return dono.n > 1 ? `${dono.n} × ${nome}` : nome;
  }
  const nome = hasItem(dono.id) ? itemDef(dono.id).nome : dono.id;
  return dono.n > 1 ? `${dono.n} × ${nome}` : nome;
}

/** Compra la pala al negozio dei mobili (`BORGO.pala.monete` = 500 monete). Si compra una sola volta e pesa 0 nello zaino. */
export function compraPala(lot0: LotState, nowMs: number): LotState {
  const lot = advance(lot0, nowMs);
  if (possiedePala(lot)) throw new EconomyError('unico', 'Hai già la pala');
  const pagato = spendi(lot, BORGO.pala.monete);
  const h = heroOf(lot);
  return { ...pagato, version: lot.version + 1, hero: { ...h, inv: addTo(h.inv, BORGO.pala.id, 1) } };
}

/** Toglie dal lotto l'oggetto, il mobile non posato o le monete da seppellire in una buca aperta di Borgo Marea. */
export function prelevaPerSeppellire(lot0: LotState, dono: BucaDono, nowMs: number): { lot: LotState; dono: BucaDono; nome: string } {
  const lot = advance(lot0, nowMs);
  if (dono.tipo === 'monete') {
    if (!Number.isInteger(dono.monete) || dono.monete < 1) throw new EconomyError('risorse', 'Quantità di monete non valida');
    const pagato = spendi(lot, dono.monete);
    const clean: BucaDono = { tipo: 'monete', monete: dono.monete };
    return { lot: { ...pagato, version: lot.version + 1 }, dono: clean, nome: nomeBucaDono(clean) };
  }
  if (dono.tipo === 'mobile') {
    if (!Number.isInteger(dono.n) || dono.n < 1) throw new EconomyError('oggetto', 'Quantità non valida');
    const m = MOBILI.find((x) => x.id === dono.id);
    if (!m) throw new EconomyError('sconosciuto', 'Mobile sconosciuto');
    const c = casaDi(lot), mag0 = c.magazzino ?? {}, have = mag0[m.id] ?? 0;
    if (have < dono.n) throw new EconomyError('oggetto', `Non hai in magazzino: ${m.nome}`);
    const mag = { ...mag0 };
    if (have - dono.n > 0) mag[m.id] = have - dono.n; else delete mag[m.id];
    const clean: BucaDono = { tipo: 'mobile', id: m.id, n: dono.n };
    return { lot: { ...lot, version: lot.version + 1, casa: { ...c, magazzino: mag } }, dono: clean, nome: nomeBucaDono(clean) };
  }
  if (!Number.isInteger(dono.n) || dono.n < 1) throw new EconomyError('oggetto', 'Quantità non valida');
  if (!hasItem(dono.id)) throw new EconomyError('oggetto', 'Oggetto sconosciuto');
  const it = itemDef(dono.id);
  if (it.id === 'pala' || it.kind === 'strumento') throw new EconomyError('oggetto', 'La pala non si può seppellire');
  const h = heroOf(lot);
  if ((h.inv[it.id] ?? 0) < dono.n) throw new EconomyError('oggetto', `Non hai abbastanza: ${it.nome}`);
  const hero = fixEquip({ ...h, inv: removeFrom(h.inv, it.id, dono.n) });
  const clean: BucaDono = { tipo: 'oggetto', id: it.id, n: dono.n };
  return { lot: { ...lot, version: lot.version + 1, hero }, dono: clean, nome: nomeBucaDono(clean) };
}

/** Aggiunge al lotto quello che è stato dissotterrato da una buca di Borgo Marea (`ignorePeso = true` solo per il rimborso). */
export function riceviSeppellito(lot0: LotState, dono: BucaDono, nowMs: number, ignorePeso = false): { lot: LotState; nome: string } {
  const lot = advance(lot0, nowMs);
  if (!ignorePeso && !possiedePala(lot)) throw new EconomyError('oggetto', 'Serve la pala');
  if (dono.tipo === 'monete') {
    const monete = Math.max(1, Math.floor(dono.monete));
    const pagato = guadagna(lot, monete);
    return { lot: { ...pagato, version: lot.version + 1 }, nome: nomeBucaDono({ tipo: 'monete', monete }) };
  }
  if (dono.tipo === 'mobile') {
    const m = MOBILI.find((x) => x.id === dono.id);
    if (!m) throw new EconomyError('sconosciuto', 'Mobile sconosciuto');
    const n = Math.max(1, Math.floor(dono.n));
    const c = casaDi(lot), mag0 = c.magazzino ?? {};
    return {
      lot: { ...lot, version: lot.version + 1, casa: { ...c, magazzino: { ...mag0, [m.id]: (mag0[m.id] ?? 0) + n } } },
      nome: nomeBucaDono({ tipo: 'mobile', id: m.id, n }),
    };
  }
  if (!hasItem(dono.id)) throw new EconomyError('oggetto', 'Oggetto sconosciuto');
  const it = itemDef(dono.id);
  const n = Math.max(1, Math.floor(dono.n));
  const h = heroOf(lot);
  if (!ignorePeso && carriedOf(h) + it.peso * n > caricoMaxOf(h) + 1e-9) throw new EconomyError('peso', 'Zaino troppo pesante');
  return {
    lot: { ...lot, version: lot.version + 1, hero: { ...h, inv: addTo(h.inv, it.id, n) } },
    nome: nomeBucaDono({ tipo: 'oggetto', id: it.id, n }),
  };
}
