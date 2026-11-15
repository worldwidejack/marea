// Le regole delle quattro modalità dell'Arena (docs/ARENA.md), sopra la partita (partita.ts): cosa c'è sulla mappa, cosa succede a ogni
// passo e quando qualcuno cade, chi vince.
// - Sopravvivenza: una vita sola. Le casse (segno `K`) si rompono e lasciano le monete rosse: chi ci passa sopra le prende, e ognuna dà
//   +`rossa.vita` della Vita di base (massimo e subito) e +`rossa.danno` ai danni per tutta la partita; chi cade le lascia tutte a terra.
//   La nube tossica si stringe in cerchio dal bordo verso il centro della mappa (da `nube.inizio` a `nube.fine` s, fino a `nube.raggio` m) e
//   fuori fa `nube.dps` al secondo. Vince l'ultima squadra in piedi; a tempo scaduto quella con più Vita. I posti: chi esce prima è più in fondo.
// - Caccia alle stelle: ognuno ha una taglia (`stelle.inizio` stelle) sopra la testa; chi butta giù un avversario prende le sue stelle per la
//   squadra e la sua taglia sale di una (fino a `stelle.max`); chi cade riparte dalla taglia iniziale. A tempo scaduto vince chi ha più stelle.
// - Controllo: le zone (segni `1` `2` `3`, raggio `zona.raggio` m) salgono di `zona.alSecondo` punti al secondo per la squadra che ci ha
//   qualcuno dentro senza avversari (se ci sono tutte e due è contesa: non sale niente); a 100 la zona è conquistata e si chiude. I punti della
//   squadra sono la media delle zone; vince chi le prende tutte, o a tempo scaduto chi ha di più.
// - Rapinatori: una cassaforte per squadra (segni `A` `B`, `cassaforte.vita`), che i suoi non possono colpire; vince chi rompe quella degli
//   altri, o a tempo scaduto chi ha la sua più integra (in %).
// A tempo scaduto sotto ARENA.modi.pariSotto di differenza è pari. Pura e deterministica: solo + − × ÷ e Math.sqrt.
import { ARENA, arenaModo, SEGNO } from '@marea/content/arena.ts';
import type { EnemyDef } from '@marea/content/rpg_types.ts';
import { DT } from '../constants.ts';
import { caduto } from '../dungeon/combat.ts';
import { conEroe, ev, secToTicks } from '../dungeon/state.ts';
import type { DungeonState, Enemy } from '../dungeon/state.ts';
import type { PartitaEsito, PartitaState } from './partita.ts';

/** Un mucchio di monete rosse a terra. */
export type Mucchio = { id: number; x: number; z: number; n: number };
/** Una zona del Controllo: centro (m), punti di ogni squadra, chi l'ha conquistata (-1 = ancora aperta). */
export type ZonaRt = { x: number; z: number; prog: number[]; di: number };
/** Quello che il client disegna della modalità: la nube (centro e raggio), i mucchi, le zone (con chi c'è dentro), le casseforti, le
 *  squadre ancora in piedi (Sopravvivenza). */
export type ModoView = {
  nube: { x: number; z: number; r: number } | null; mucchi: Mucchio[];
  zone: { x: number; z: number; r: number; prog: number[]; di: number; dentro: number[] }[];
  casseforti: { q: number; x: number; z: number; vita: number; max: number }[];
  vive: number;
};

const r2 = (v: number): number => Math.round(v * 100) / 100;
const SEMPRE = 2147483648; // il buff delle monete rosse non scade
const OGNI = Math.round(secToTicks(1) / 6); // la nube morde a impulsi: 6 al secondo

/** Un nemico fermo che non attacca: una cassa o una cassaforte. */
function struttura(s: DungeonState, id: string, nome: string, vita: number, raggio: number, x: number, z: number): Enemy {
  const def = { id, nome, kind: 'costrutto', model: id, vita, danno: 0, armatura: 0, velocita: 0, vista: 0, portata: 0.5, preparazione: 1, recupero: 1, raggio, altezza: 1, comportamento: 'torretta', loot: 'nessuno', xp: 0 } as unknown as EnemyDef;
  const e: Enemy = {
    id: s.nextId++, tipo: id, def, x, z, fx: 0, fz: 1, vita, max: vita, st: 'insegue', stT: 0, stDur: 0, alleato: false, scade: 0, aggro: true, hurt: 0,
    bleed: 0, bleedT: 0, cdTiro: 0, attacchi: 0, area: false, tiro: false, bersaglio: -1, dropRaro: false, dropMolt: 1,
  };
  s.enemies.push(e);
  return e;
}
/** Le celle col segno `ch` della mappa (centro in m). */
function segni(d: PartitaState, ch: string): { x: number; z: number }[] {
  const T = d.s.map.tile, out: { x: number; z: number }[] = [];
  d.s.def.rows.forEach((r, cz) => { for (let cx = 0; cx < r.length; cx++) if (r[cx] === ch) out.push({ x: (cx + 0.5) * T, z: (cz + 0.5) * T }); });
  return out;
}
const centro = (d: PartitaState) => ({ x: (d.s.map.w * d.s.map.tile) / 2, z: (d.s.map.h * d.s.map.tile) / 2 });

/** La mappa della modalità: casse e nube, taglie, zone, casseforti. */
export function apriModo(d: PartitaState): void {
  const m = arenaModo(d.modo), s = d.s;
  if (d.modo === 'sopravvivenza' && m.cassa) {
    d.rosse = d.eroi.map(() => 0);
    d.casse = segni(d, SEGNO.cassa).map((p) => struttura(s, 'arena_cassa', 'Cassa', m.cassa!.vita, m.cassa!.raggio, p.x, p.z).id);
    d.nube = raggioNube(d);
  }
  if (d.modo === 'stelle') d.taglia = d.eroi.map(() => m.stelle?.inizio ?? 2);
  if (d.modo === 'controllo') d.zone = SEGNO.zone.flatMap((ch) => segni(d, ch)).map((p) => ({ ...p, prog: d.punti.map(() => 0), di: -1 }));
  if (d.modo === 'rapina' && m.cassaforte) {
    d.casseforti = SEGNO.casseforti.map((ch, q) => {
      const p = segni(d, ch)[0]!, e = struttura(s, 'arena_cassaforte', 'Cassaforte', m.cassaforte!.vita, m.cassaforte!.raggio, p.x, p.z);
      s.pvp!.di![e.id] = q;
      return e.id;
    });
    puntiRapina(d);
  }
}

/** Il raggio della nube adesso: tutta la mappa fino a `inizio`, poi si stringe dritta fino a `raggio` a `fine`. */
function raggioNube(d: PartitaState): number {
  const N = arenaModo(d.modo).nube!, c = centro(d), R0 = Math.sqrt(c.x * c.x + c.z * c.z) + 1, t = d.faseT * DT;
  if (t <= N.inizio) return R0;
  return t >= N.fine ? N.raggio : R0 + ((N.raggio - R0) * (t - N.inizio)) / (N.fine - N.inizio);
}

/** Le monete rosse dell'eroe i sono `n`: la Vita massima di tutti i suoi slot e il buff ai danni. */
function conRosse(d: PartitaState, i: number, prima: number): void {
  const R = arenaModo(d.modo).rossa!, n = d.rosse[i]!, h = d.s.eroi[i]!.hero;
  d.var[i]!.forEach((v, k) => { const base = d.eroi[i]!.varianti[k]?.max.vita; if (v && base) v.max = { ...v.max, vita: base * (1 + R.vita * n) }; });
  const base = d.s.eroi[i]!.runHero.max.vita / (1 + R.vita * n);
  h.vita += base * R.vita * (n - prima);
  h.buffs = h.buffs.filter((b) => b.fine !== SEMPRE);
  if (n > 0) h.buffs.push({ mod: 'furiaDanno', valore: R.danno * n, fine: SEMPRE });
}

/** Dopo il passo della sim: nube, casse rotte, monete raccolte; zone; casseforti. */
export function dopoModo(d: PartitaState): void {
  const s = d.s, m = arenaModo(d.modo);
  if (d.modo === 'sopravvivenza') {
    d.nube = raggioNube(d);
    const c = centro(d), N = m.nube!, R = m.rossa!;
    if (d.faseT % OGNI === 0) s.eroi.forEach((r, i) => {
      const dx = r.hero.x - c.x, dz = r.hero.z - c.z;
      if (r.done || dx * dx + dz * dz <= d.nube * d.nube) return;
      conEroe(s, i, () => {
        const h = s.hero, x = N.dps / 6;
        h.vita -= x; h.hurt = Math.max(h.hurt, 6); s.danniPresi += x;
        ev(s, { t: 'colpo', x: r2(h.x), z: r2(h.z), danno: Math.round(x), su: 'eroe' });
        if (h.vita <= 0) caduto(s);
      });
    });
    d.casse = d.casse.filter((id) => {
      const e = s.enemies.find((x) => x.id === id);
      if (e && e.st !== 'morto') return true;
      if (e) d.mucchi.push({ id: s.nextId++, x: r2(e.x), z: r2(e.z), n: m.cassa!.monete });
      return false;
    });
    d.mucchi = d.mucchi.filter((p) => {
      const i = s.eroi.findIndex((r) => { const dx = r.hero.x - p.x, dz = r.hero.z - p.z; return !r.done && dx * dx + dz * dz <= R.raggio * R.raggio; });
      if (i < 0) return true;
      const prima = d.rosse[i]!;
      d.rosse[i] = prima + p.n; conRosse(d, i, prima);
      d.eventi.push({ t: 'rosse', i, n: p.n });
      return false;
    });
  }
  if (d.modo === 'controllo') {
    const Z = m.zona!;
    d.zone.forEach((z, k) => {
      if (z.di >= 0) return;
      const dentro = squadreDentro(d, z, Z.raggio);
      if (dentro.length !== 1) return;
      const q = dentro[0]!;
      z.prog[q] = Math.min(100, z.prog[q]! + Z.alSecondo * DT);
      if (z.prog[q]! >= 100) { z.di = q; d.eventi.push({ t: 'zona', z: k, q }); }
    });
    d.punti = d.punti.map((_, q) => r2(d.zone.reduce((t, z) => t + (z.di === q ? 100 : z.prog[q]!), 0) / Math.max(1, d.zone.length)));
  }
  if (d.modo === 'rapina') puntiRapina(d);
}
/** Le squadre che hanno qualcuno in piedi dentro la zona. */
function squadreDentro(d: PartitaState, z: { x: number; z: number }, r: number): number[] {
  const out: number[] = [];
  d.s.eroi.forEach((e, i) => {
    const dx = e.hero.x - z.x, dz = e.hero.z - z.z, q = d.squadre[i]!;
    if (!e.done && dx * dx + dz * dz <= r * r && !out.includes(q)) out.push(q);
  });
  return out;
}
const cassaforte = (d: PartitaState, q: number): Enemy | undefined => d.s.enemies.find((e) => e.id === d.casseforti[q]);
function puntiRapina(d: PartitaState): void {
  d.punti = d.punti.map((_, q) => { const e = cassaforte(d, q); return e ? Math.round((Math.max(0, e.vita) / e.max) * 1000) / 10 : 0; });
}

/** L'eroe i è appena caduto (buttato giù da `da`, -1 = nessuno): lascia le monete rosse, le stelle vanno a chi l'ha preso, una squadra esce. */
export function quandoCade(d: PartitaState, i: number, da: number): void {
  const s = d.s, m = arenaModo(d.modo);
  if (d.modo === 'sopravvivenza') {
    const n = d.rosse[i]!, h = s.eroi[i]!.hero;
    if (n > 0) { d.mucchi.push({ id: s.nextId++, x: r2(h.x), z: r2(h.z), n }); d.rosse[i] = 0; }
    const q = d.squadre[i]!;
    if (!d.punti[q] && d.eroi.every((_, j) => d.squadre[j] !== q || s.eroi[j]!.done)) {
      const vive = d.punti.filter((p, k) => !p && k !== q && d.eroi.some((_, j) => d.squadre[j] === k && !s.eroi[j]!.done)).length;
      d.punti[q] = vive + 1;
      d.eventi.push({ t: 'fuori', q, posto: vive + 1 });
    }
  }
  if (d.modo === 'stelle') {
    const S = m.stelle!;
    if (da >= 0) {
      const q = d.squadre[da]!, n = d.taglia[i]!;
      d.punti[q]! += n;
      d.taglia[da] = Math.min(S.max, d.taglia[da]! + 1);
      d.eventi.push({ t: 'stelle', q, n, da });
    }
    d.taglia[i] = S.inizio;
  }
}

/** A tempo scaduto: la squadra coi punti più alti (null = pari, sotto pariSotto di differenza). */
function aiPunti(punti: readonly number[]): number | null {
  const ord = punti.map((p, q) => ({ p, q })).sort((a, b) => b.p - a.p);
  return ord.length < 2 || ord[0]!.p - ord[1]!.p >= ARENA.modi.pariSotto ? ord[0]!.q : null;
}
/** La partita è finita? L'esito, o null. */
export function fineModo(d: PartitaState): PartitaEsito | null {
  const s = d.s, tempo = d.faseT >= secToTicks(arenaModo(d.modo).secondi);
  if (d.modo === 'sopravvivenza') {
    const vive = d.punti.flatMap((p, q) => (p ? [] : [q]));
    if (vive.length > 1 && !tempo) return null;
    if (vive.length === 1) { d.punti[vive[0]!] = 1; return { vincitore: vive[0]!, perche: 'ultimo', punti: [...d.punti] }; }
    if (!vive.length) { const w = d.punti.filter((p) => p === 1).length === 1 ? d.punti.indexOf(1) : -1; return { vincitore: w >= 0 ? w : null, perche: w >= 0 ? 'ultimo' : 'pari', punti: [...d.punti] }; } // cadute insieme: pari
    // a tempo: chi resta, in ordine di Vita
    const vita = vive.map((q) => ({ q, v: d.eroi.reduce((t, _, j) => (d.squadre[j] === q ? t + Math.max(0, s.eroi[j]!.hero.vita) : t), 0) })).sort((a, b) => b.v - a.v);
    vita.forEach((x, k) => { d.punti[x.q] = k + 1; });
    const w = vita[0]!.v - vita[1]!.v >= ARENA.modi.pariSotto ? vita[0]!.q : null;
    return { vincitore: w, perche: w === null ? 'pari' : 'tempo', punti: [...d.punti] };
  }
  if (d.modo === 'controllo' && d.zone.length && d.zone.every((z) => z.di >= 0)) {
    const w = aiPunti(d.punti);
    return { vincitore: w, perche: w === null ? 'pari' : 'zone', punti: [...d.punti] };
  }
  if (d.modo === 'rapina') {
    const rotte = d.casseforti.map((_, q) => (cassaforte(d, q)?.st ?? 'morto') === 'morto');
    if (rotte[0] || rotte[1]) return rotte[0] && rotte[1] ? { vincitore: null, perche: 'pari', punti: [...d.punti] } : { vincitore: rotte[0] ? 1 : 0, perche: 'cassaforte', punti: [...d.punti] };
  }
  if (!tempo) return null;
  const w = aiPunti(d.punti);
  return { vincitore: w, perche: w === null ? 'pari' : 'tempo', punti: [...d.punti] };
}

export function modoView(d: PartitaState, io: number): ModoView {
  void io;
  const m = arenaModo(d.modo), s = d.s;
  return {
    nube: d.modo === 'sopravvivenza' ? { ...centro(d), r: r2(d.nube) } : null,
    mucchi: d.mucchi.map((p) => ({ ...p })),
    zone: d.zone.map((z) => ({ x: z.x, z: z.z, r: m.zona?.raggio ?? 3, prog: z.prog.map(r2), di: z.di, dentro: z.di >= 0 ? [] : squadreDentro(d, z, m.zona?.raggio ?? 3) })),
    casseforti: d.casseforti.flatMap((id, q) => { const e = s.enemies.find((x) => x.id === id); return e ? [{ q, x: e.x, z: e.z, vita: Math.max(0, Math.round(e.vita)), max: e.max }] : []; }),
    vive: d.modo === 'sopravvivenza' ? d.punti.filter((p) => !p).length : d.nSquadre,
  };
}
export const modoHash = (d: PartitaState) => ({ rosse: d.rosse, mucchi: d.mucchi, casse: d.casse, nube: r2(d.nube), taglia: d.taglia, zone: d.zone, casseforti: d.casseforti });
