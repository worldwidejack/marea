// Danni e punti: colpo dell'eroe su uno zombie (+10, all'uccisione +60 o +100 in mischia; lo scudo dello scudato prende quello che gli
// arriva davanti finché non si spacca),
// esplosioni e fiamme, colpo di uno zombie sull'eroe (lo scudo templare para: in mano davanti, sulle spalle dietro; a zero sei caduto).
// Chi muore può lasciare un power-up (docs/TEMPLARI.md §9); con Ira di Dio ogni colpo uccide (boss esclusi), con la Decima punti doppi.
import { TEMPLARI } from '@marea/content/templari.ts';
import type { TFiamma, TPotere } from '@marea/content/templari.ts';
import { moveCircle } from '../dungeon/map.ts';
import type { TState, Zombie } from './stato.ts';
import { COLPITO_TICKS, classeDi, ev, inPiedi, secToTicks, usa, vitaBase } from './stato.ts';
import { vicinoRaggiungibile } from './raggiungi.ts';

const r2 = (v: number): number => Math.round(v * 100) / 100;
/** Fiamme a terra insieme al massimo (le più vecchie si spengono). */
const MAX_FIAMME = 14;

export function dai(s: TState, n: number, perche: 'colpo' | 'uccisione' | 'mischia' | 'asse' | 'potere'): void {
  if (n <= 0) return;
  if (s.tick < s.poteri.decima) n *= 2;
  s.punti += n; s.guadagnati += n;
  ev(s, { t: 'punti', n, perche });
}
/** Spende punti; false (e niente spesa) se non bastano. */
export function spendi(s: TState, n: number): boolean {
  if (s.punti < n) return false;
  if (n > 0) { s.punti -= n; ev(s, { t: 'punti', n: -n, perche: 'spesa' }); }
  return true;
}
/** Punti restituiti (il teschio della cassa): non contano tra quelli guadagnati. */
export function rendi(s: TState, n: number): void { s.punti += n; ev(s, { t: 'punti', n, perche: 'spesa' }); }

/** `dirX, dirZ`: verso in cui va il colpo (dal colpitore allo zombie); `scudo` false = passa lo scudo (fiamme); `super` = colpo del
 *  super (non lo ricarica). */
export type Colpo = { danno: number; mischia: boolean; caricato: boolean; dirX: number; dirZ: number; spinta: number; scudo?: boolean; super?: boolean };

/** Un'uccisione dell'eroe di turno (super.ts): un passo di carica del suo super; a pieno lo dice una volta. */
export function caricaSuper(s: TState): void {
  const h = s.eroe, cl = classeDi(h);
  if (!cl || h.superK >= 1) return;
  h.superK = Math.min(1, h.superK + 1 / cl.super.uccisioni);
  if (h.superK >= 1) ev(s, { t: 'superPronto' });
}
export type Esito = 'no' | 'parato' | 'colpito' | 'ucciso';

/** Lo scudato para un colpo che gli arriva davanti (chi colpisce sta nel suo cono), finché lo scudo regge. */
export function parato(z: Zombie, dirX: number, dirZ: number): boolean {
  const c = z.def.scudo;
  return c !== undefined && z.scudo > 0 && -(dirX * z.fx + dirZ * z.fz) >= c;
}

/** Colpo su uno zombie: scudo, danno, spinta, punti, morte. */
export function colpisci(s: TState, z: Zombie, c: Colpo): Esito {
  if (z.st === 'morto' || z.st === 'sorge' || z.st === 'fugge') return 'no';
  // lo scudo prende il colpo intero (niente danno passa) e si consuma; con Ira di Dio si spacca subito e il colpo passa
  const ira = s.tick < s.poteri.ira && !z.def.boss;
  if (c.scudo !== false && parato(z, c.dirX, c.dirZ)) {
    z.scudo = ira ? 0 : Math.max(0, z.scudo - c.danno);
    if (z.scudo <= 0) { ev(s, { t: 'scudoSpaccato', id: z.id, x: r2(z.x), z: r2(z.z) }); dai(s, TEMPLARI.punti.colpo, 'colpo'); }
    else ev(s, { t: 'parato', chi: 'zombie', x: r2(z.x), z: r2(z.z) });
    if (!ira) {
      if (c.spinta > 0) moveCircle(s.gr.zombie, z, c.dirX * c.spinta * 0.5, c.dirZ * c.spinta * 0.5, z.def.raggio);
      return 'parato';
    }
  }
  const danno = ira ? Math.max(c.danno, z.vita) : c.danno;
  const d = Math.min(z.vita, danno);
  z.vita -= danno;
  z.hurt = COLPITO_TICKS;
  // de Molay non muore: a metà vita ride e scappa (si uccide davvero solo nel finale dell'easter egg)
  if (z.def.fugge !== undefined && z.vita <= z.max * z.def.fugge) {
    ev(s, { t: 'colpo', id: z.id, x: r2(z.x), z: r2(z.z), danno: Math.round(d), uccide: false, caricato: c.caricato });
    scappa(s, z);
    return 'colpito';
  }
  const uccide = z.vita <= 0;
  ev(s, { t: 'colpo', id: z.id, x: r2(z.x), z: r2(z.z), danno: Math.round(d), uccide, caricato: c.caricato });
  if (c.spinta > 0 && !uccide) moveCircle(s.gr.zombie, z, c.dirX * c.spinta, c.dirZ * c.spinta, z.def.raggio);
  if (!uccide) { dai(s, TEMPLARI.punti.colpo, 'colpo'); return 'colpito'; }
  uccidi(s, z);
  if (!c.super) caricaSuper(s);
  dai(s, (c.mischia ? TEMPLARI.punti.mischia : TEMPLARI.punti.uccisione) + (z.def.punti ?? 0), c.mischia ? 'mischia' : 'uccisione');
  return 'ucciso';
}

/** De Molay a metà vita: smette di prendere colpi, ride, lascia un power-up e scappa. */
function scappa(s: TState, z: Zombie): void {
  z.vita = z.max * (z.def.fugge ?? 0); z.st = 'fugge'; z.stT = 0; z.fuga = null;
  ev(s, { t: 'risata', id: z.id });
  lasciaPotere(s, z.x, z.z, true);
}

/** Danno senza colpo (fiamme, trappole): de Molay scappa a metà vita; chi muore dà `punti` (0 = nessuno). Con Ira di Dio muore subito. */
export function danneggia(s: TState, z: Zombie, n: number, punti: number): void {
  z.vita -= s.tick < s.poteri.ira && !z.def.boss ? z.vita : n;
  if (z.def.fugge !== undefined && z.vita <= z.max * z.def.fugge) { scappa(s, z); return; }
  if (z.vita <= 0) { uccidi(s, z); dai(s, punti, 'uccisione'); }
}

/** Un power-up a terra dove è morto uno zombie (o nella cella raggiungibile più vicina): a caso, e sempre se `sicuro` (i boss). */
export function lasciaPotere(s: TState, x: number, z: number, sicuro: boolean): void {
  const k = TEMPLARI.poteri;
  if (!sicuro && (s.poteri.ondata >= k.maxOndata || s.rng.next() >= k.probabilita)) return;
  const p = vicinoRaggiungibile(s, x, z, 6);
  if (!p) return;
  let tipo: TPotere = k.tipi[s.rng.int(0, k.tipi.length - 1)]!;
  if (tipo === s.poteri.ultimo) tipo = k.tipi[s.rng.int(0, k.tipi.length - 1)]!;
  if (!sicuro) s.poteri.ondata++;
  s.poteri.ultimo = tipo;
  s.drops.push({ id: s.nextId++, tipo, x: p.x, z: p.z, fine: s.tick + secToTicks(k.aTerra) });
  ev(s, { t: 'potere', tipo, preso: false, x: r2(p.x), z: r2(p.z) });
}

/** Morte di uno zombie; `potere` false = non lascia power-up (le Campane a martello). */
export function uccidi(s: TState, z: Zombie, potere = true): void {
  z.vita = 0; z.st = 'morto'; z.stT = 0; z.finestra = -1;
  s.uccisioni++;
  ev(s, { t: 'morte', id: z.id, tipo: z.tipo, x: r2(z.x), z: r2(z.z) });
  if (potere) lasciaPotere(s, z.x, z.z, !!z.def.boss);
  // lo scudato lascia lo scudo a terra, se non gliel'hai spaccato
  if (z.def.scudo !== undefined && z.scudo > 0) {
    const scudi = s.drops.filter((d) => d.tipo === 'scudo' && d.fine > s.tick);
    if (scudi.length > 2) s.drops = s.drops.filter((d) => d !== scudi[0]);
    s.drops.push({ id: s.nextId++, tipo: 'scudo', x: z.x, z: z.z, fine: s.tick + secToTicks(TEMPLARI.scudo.aTerra) });
  }
}

/** Esplosione in (x, z): danno a chi sta nel raggio (lo scudato para se la guarda), poi le fiamme a terra. */
export function esplodi(s: TState, x: number, z: number, r: number, danno: number, fuoco?: TFiamma): void {
  ev(s, { t: 'esplosione', x: r2(x), z: r2(z), r });
  for (const zz of s.zombie) {
    if (zz.st === 'morto' || zz.st === 'sorge') continue;
    const dx = zz.x - x, dz = zz.z - z, d = Math.sqrt(dx * dx + dz * dz);
    if (d > r + zz.def.raggio) continue;
    colpisci(s, zz, { danno, mischia: false, caricato: false, dirX: d > 1e-6 ? dx / d : 0, dirZ: d > 1e-6 ? dz / d : 1, spinta: 0.6 });
  }
  if (fuoco) accendi(s, x, z, fuoco);
}
export function accendi(s: TState, x: number, z: number, f: TFiamma, nemico = false): void {
  if (s.fiamme.length >= MAX_FIAMME) s.fiamme.shift();
  s.fiamme.push({ id: s.nextId++, x, z, r: f.raggio, dps: f.dps, fine: s.tick + secToTicks(f.durata), ...(nemico ? { nemico: true } : {}) });
}
/** Le fiamme bruciano chi c'è dentro (passano lo scudo); chi muore così dà i punti dell'uccisione. */
export function stepFiamme(s: TState): void {
  if (!s.fiamme.length) return;
  s.fiamme = s.fiamme.filter((f) => f.fine > s.tick);
  for (const f of s.fiamme) {
    if (!f.nemico) continue;
    // le fiamme di de Molay bruciano gli eroi (niente scudo, niente rigenerazione mentre ci sei dentro)
    for (const i of inPiedi(s)) {
      const h = s.eroi[i]!, dx = h.x - f.x, dz = h.z - f.z, rr = f.r + TEMPLARI.eroe.raggio;
      if (dx * dx + dz * dz > rr * rr || s.done) continue;
      usa(s, i); ferisciDiretto(s, f.dps / 60, s.tick % 30 === 0 ? 'brucia' : null);
      if (s.done) return;
    }
  }
  for (const f of s.fiamme) for (const z of s.zombie) {
    if (f.nemico || z.st === 'morto' || z.st === 'sorge' || z.st === 'fugge') continue;
    const dx = z.x - f.x, dz = z.z - f.z, rr = f.r + z.def.raggio;
    if (dx * dx + dz * dz > rr * rr) continue;
    danneggia(s, z, f.dps / 60, TEMPLARI.punti.uccisione + (z.def.punti ?? 0));
  }
}

/** L'eroe è a zero: con l'Elisir del risorto si rialza (vita piena, qualche secondo intoccabile, gli zombie vicini spinti via) e perde tutte
 *  le pozioni, come in COD; sennò è caduto: da solo la partita finisce, insieme resta giù (perde le pozioni, si rialza all'ondata dopo) e
 *  finisce solo se non resta nessuno in piedi. */
function cade(s: TState): void {
  const h = s.eroe;
  if (h.pozioni.includes('risorto')) {
    const p = TEMPLARI.strega.pozioni.find((x) => x.id === 'risorto')!, r = p.spinta ?? 3;
    h.pozioni = []; h.max = vitaBase(h); h.vita = h.max; h.quiete = 0; h.intoccabile = s.tick + secToTicks(p.intoccabile ?? 3);
    for (const z of s.zombie) {
      if (z.st === 'morto' || z.st === 'sorge') continue;
      const dx = z.x - h.x, dz = z.z - h.z, d = Math.sqrt(dx * dx + dz * dz);
      if (d < r && d > 1e-6) moveCircle(s.gr.zombie, z, (dx / d) * (r - d), (dz / d) * (r - d), z.def.raggio);
    }
    ev(s, { t: 'risorto' });
    return;
  }
  h.vita = 0; ev(s, { t: 'caduto' });
  if (s.eroi.length === 1) { s.done = true; s.esito = 'morto'; return; }
  h.giu = true; h.pozioni = []; h.max = vitaBase(h);
  h.act = 'idle'; h.actT = 0; h.carica = 0; h.ricarica = 0; h.moving = false; h.corre = false; h.hurt = 0;
  if (!inPiedi(s).length) { s.done = true; s.esito = 'morto'; }
}

/** Danno all'eroe che lo scudo non para (fiamme, trappole): `segnale` = l'evento da mandare (brucia o ferito), null = nessuno. */
export function ferisciDiretto(s: TState, danno: number, segnale: 'brucia' | 'ferito' | null): void {
  const h = s.eroe;
  if (s.done || h.giu || h.fuori || s.tick < h.intoccabile) return;
  h.vita -= danno; h.quiete = 0;
  if (segnale === 'brucia') ev(s, { t: 'brucia' });
  if (segnale === 'ferito') { h.hurt = COLPITO_TICKS; ev(s, { t: 'ferito', danno: Math.round(danno), x: r2(h.x), z: r2(h.z) }); }
  if (h.vita <= 0) cade(s);
}

/** Colpo sull'eroe da (x, z): lo scudo para (in mano chi è davanti, sulle spalle chi è dietro), sennò vita; a zero è caduto. */
export function ferisci(s: TState, danno: number, x: number, z: number): void {
  const h = s.eroe;
  if (s.done || h.giu || h.fuori || s.tick < h.intoccabile) return;
  if (h.scudo) {
    const dx = x - h.x, dz = z - h.z, d = Math.sqrt(dx * dx + dz * dz) || 1, dot = (dx * h.fx + dz * h.fz) / d, c = TEMPLARI.scudo.cono;
    if ((h.inMano && dot >= c) || (!h.inMano && dot <= -c)) {
      h.scudo.vita -= danno;
      ev(s, { t: 'parato', chi: 'eroe', x: r2(h.x), z: r2(h.z) });
      if (h.scudo.vita <= 0) { h.scudo = null; h.inMano = false; ev(s, { t: 'scudoRotto' }); }
      return;
    }
  }
  h.vita -= danno; h.quiete = 0; h.hurt = COLPITO_TICKS;
  ev(s, { t: 'ferito', danno: Math.round(danno), x: r2(x), z: r2(z) });
  if (h.vita <= 0) cade(s);
}
