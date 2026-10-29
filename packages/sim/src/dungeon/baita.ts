// Il Tempio della «Doppia Nera» (Isola dell'Adrenalina, docs/BAITA.md): il Ghiaccio Vivo (ghiaccio.ts), le colonnine termiche (le valvole: sciolgono il
// ghiaccio della stanza e aprono il suo tornello), le chiazze delle fiasche e i tre nemici del Culto della Sciolina. Tutti i numeri stanno in enemies.json.
// Ogni cosa che ti sposta o ti rallenta è telegrafata dalla vista (baita_vista.ts): cerchio che si riempie, anello rosso, linee a terra.
import { enemyDef } from '@marea/content/rpg.ts';
import type { FiascheDef } from '@marea/content/rpg.ts';
import { DT } from '../constants.ts';
import type { DungeonState, Enemy, Pozzanghera } from './state.ts';
import { conEroe, ev, inGioco, secToTicks } from './state.ts';
import { hitHero, kill } from './combat.ts';
import { lineOfSight, moveCircle } from './map.ts';
import { moveToward, setState } from './passi.ts';
import { FRECCIA_Y } from './tuning.ts';
import { stepGhiaccio } from './ghiaccio.ts';

const r2 = (v: number): number => Math.round(v * 100) / 100;
const FIASCHE = (): FiascheDef => enemyDef('alchimista_bombardino').fiasche!;
const norm = (dx: number, dz: number): [number, number] => { const d = Math.sqrt(dx * dx + dz * dz); return d > 1e-6 ? [dx / d, dz / d] : [0, 0]; };

/** Aggiornamento a ogni tick del Tempio: colonnine, scivolate, chiazze, bandierine rimaste senza capo. */
export function stepBaita(s: DungeonState): void {
  for (const b of s.bacini) if (b.aperta && !s.sciolti.includes(b.n)) { s.sciolti.push(b.n); ev(s, { t: 'scongelato', n: b.n }); } // la colonnina scioglie il ghiaccio subito, il tornello scola dopo
  for (const i of inGioco(s)) conEroe(s, i, () => stepGhiaccio(s, s.hero));
  if (s.pozzanghere.length) stepPozze(s);
  if (s.bandierine.length && !s.enemies.some((e) => e.capo && e.st !== 'morto')) s.bandierine = [];
}

/** Le chiazze a terra: la sciolina rallenta chi ci sta dentro (e un attimo dopo), il bombardino brucia ogni mezzo secondo. */
function stepPozze(s: DungeonState): void {
  const F = FIASCHE();
  s.pozzanghere = s.pozzanghere.filter((p) => p.fine > s.tick);
  for (const p of s.pozzanghere) for (const i of inGioco(s)) conEroe(s, i, () => {
    const h = s.hero, dx = h.x - p.x, dz = h.z - p.z;
    if (dx * dx + dz * dz > p.r * p.r) return;
    if (p.tipo === 'sciolina') {
      if (h.lento <= 0) ev(s, { t: 'rallentato' });
      h.lento = Math.max(h.lento, secToTicks(F.sciolina.coda)); h.lentoMolt = F.sciolina.lento;
    } else if (s.tick % secToTicks(0.5) === 0) hitHero(s, F.bombardino.dps * 0.5, 'magia', h.x, h.z);
  });
}

/** Moltiplicatore dei colpi su `e` e colpi che non passano: l'Acrobata in capogiro, il fusto giallo dell'Alchimista (da dietro: stordisce e scoppia), Jean-Claude
 *  nelle sue finestre (bilico, protesta) e in aria (intoccabile: -1). */
export function colpoBaita(s: DungeonState, e: Enemy, src: { ox?: number; oz?: number }): number {
  const D = e.def;
  if (D.trottola && e.modo === 'capogiro') return D.trottola.molt;
  if (D.claude) {
    const C = D.claude;
    if (e.modo === 'salto' && e.st === 'prepara' && e.stT > secToTicks(0.3)) { ev(s, { t: 'parato', x: r2(e.x), z: r2(e.z), perche: 'volo' }); return -1; }
    if (e.stordito !== undefined && e.stordito > s.tick) return e.modo === 'bilico' ? C.salto.molt : e.modo === 'arbitro' ? C.slalom.molt : 1;
    return 1;
  }
  const R = D.debolezzaRetro;
  if (!R || src.ox === undefined || src.oz === undefined) return 1;
  const [ax, az] = norm(src.ox - e.x, src.oz - e.z);
  if (ax * e.fx + az * e.fz > R.cono) return 1;
  // il fusto scoppia: stordisce lui e fa male a chi gli sta attorno (non a chi ha colpito)
  e.stordito = s.tick + secToTicks(R.stordisce); e.modo = undefined; e.mira = undefined; setState(e, 'recupera', secToTicks(R.stordisce));
  ev(s, { t: 'scoppio', x: r2(e.x), z: r2(e.z), r: R.raggio });
  for (const o of s.enemies) {
    if (o === e || o.st === 'morto' || o.alleato || o.def.boss) continue;
    const dx = o.x - e.x, dz = o.z - e.z;
    if (dx * dx + dz * dz > R.raggio * R.raggio) continue;
    o.vita -= R.danno; o.hurt = 15;
    ev(s, { t: 'colpo', x: r2(o.x), z: r2(o.z), danno: R.danno, su: 'nemico', id: o.id });
    if (o.vita <= 0) kill(s, o);
  }
  return R.molt;
}

/** Acrobata del Fuoripista: se ti vede da vicino prepara (anello rosso), gira come una trottola inseguendoti, poi gli gira la testa e sta fermo (stelline gialle). */
export function stepAcrobata(s: DungeonState, e: Enemy): void {
  const T = e.def.trottola!, h = s.hero;
  if (e.stordito !== undefined && e.stordito > s.tick) return;
  if (e.modo === 'capogiro') { e.modo = undefined; setState(e, 'insegue', 0); }
  const [ux, uz] = norm(h.x - e.x, h.z - e.z), d = Math.sqrt((h.x - e.x) * (h.x - e.x) + (h.z - e.z) * (h.z - e.z));
  switch (e.st) {
    case 'insegue':
      if (d <= T.vede && lineOfSight(s.map, e.x, e.z, h.x, h.z)) { e.fx = ux; e.fz = uz; e.modo = 'trottola'; setState(e, 'prepara', secToTicks(T.prep)); }
      else moveToward(s, e, h.x, h.z, e.def.velocita);
      return;
    case 'prepara':
      if (e.stT >= e.stDur) setState(e, 'colpisce', secToTicks(T.durata));
      return;
    case 'colpisce':
      moveToward(s, e, h.x, h.z, T.velocita);
      if (d <= T.raggio + s.runHero.raggio && e.stT % secToTicks(T.ogni) === 0) hitHero(s, T.danno, 'taglio', h.x, h.z);
      if (e.stT >= e.stDur) { e.modo = 'capogiro'; e.stordito = s.tick + secToTicks(T.capogiro); setState(e, 'recupera', secToTicks(T.capogiro)); ev(s, { t: 'capogiro', id: e.id, x: r2(e.x), z: r2(e.z) }); }
      return;
    default: if (e.stT >= e.stDur) { e.modo = undefined; setState(e, 'insegue', 0); }
  }
}

/** Alchimista del Bombardino: tiene le distanze, il cerchio sul pavimento (dove eri) si riempie per `prep` s, poi la fiasca cade e lascia una chiazza. */
export function stepAlchimista(s: DungeonState, e: Enemy): void {
  const F = e.def.fiasche!, h = s.hero;
  if (e.stordito !== undefined && e.stordito > s.tick) return;
  const [ux, uz] = norm(h.x - e.x, h.z - e.z), d = Math.sqrt((h.x - e.x) * (h.x - e.x) + (h.z - e.z) * (h.z - e.z));
  switch (e.st) {
    case 'insegue': {
      e.fx = ux; e.fz = uz;
      const vede = d <= e.def.vista && lineOfSight(s.map, e.x, e.z, h.x, h.z);
      if (vede && d < F.vicino) moveCircle(s.map, e, -ux * e.def.velocita * DT, -uz * e.def.velocita * DT, e.def.raggio); // troppo vicino: arretra (e intanto tira)
      if (vede && d <= F.distanza + 3) {
        e.attacchi++; e.modo = 'fiasca'; e.mira = { dx: h.x, dz: h.z, len: 0 }; // il bersaglio resta dove eri: si schiva
        setState(e, 'prepara', secToTicks(F.prep));
      } else if (!vede || d > F.distanza + 3) moveToward(s, e, h.x, h.z, e.def.velocita);
      return;
    }
    case 'prepara': {
      if (e.stT < e.stDur) return;
      const tipo = e.attacchi % 2 === 1 ? 'sciolina' : 'bombardino', m = e.mira!;
      const p: Pozzanghera = { id: s.nextId++, x: m.dx, z: m.dz, r: F.raggio, tipo, fine: s.tick + secToTicks(F.durata), tickDanno: 0 };
      s.pozzanghere.push(p);
      ev(s, { t: 'pozzanghera', x: r2(p.x), z: r2(p.z), tipo });
      const dx = h.x - p.x, dz = h.z - p.z;
      if (dx * dx + dz * dz <= p.r * p.r) hitHero(s, F.impatto, 'magia', h.x, h.z);
      e.modo = undefined; e.mira = undefined;
      setState(e, 'recupera', secToTicks(F.pausa));
      return;
    }
    default: if (e.stT >= e.stDur) { e.modo = undefined; setState(e, 'insegue', 0); }
  }
}

/** Le direzioni delle `n` palle della raffica di uno Sparaneve che guarda (fx, fz): la centrale e le altre spostate di lato di `angolo` per metro. */
export function lineeRaffica(e: Enemy): [number, number][] {
  const R = e.def.raffica!, out: [number, number][] = [];
  for (let k = 0; k < R.n; k++) { const a = (k - (R.n - 1) / 2) * R.angolo, [x, z] = norm(e.fx - e.fz * a, e.fz + e.fx * a); out.push([x, z]); }
  return out;
}

/** Sparaneve Automatico: appena ti vede le tre linee a terra si accendono (ferme), poi la raffica; poi ricarica. Se lo ribalti spara all'altro nemico più vicino. */
export function stepSparaneve(s: DungeonState, e: Enemy): void {
  const R = e.def.raffica!, h = s.hero;
  if (e.stordito !== undefined && e.stordito > s.tick) return;
  switch (e.st) {
    case 'insegue': {
      const d2 = (h.x - e.x) * (h.x - e.x) + (h.z - e.z) * (h.z - e.z), vede = d2 <= e.def.vista * e.def.vista && lineOfSight(s.map, e.x, e.z, h.x, h.z);
      if (!e.ribaltato && !vede) return;
      if (!e.ribaltato) { const [ux, uz] = norm(h.x - e.x, h.z - e.z); e.fx = ux; e.fz = uz; }
      e.modo = 'raffica'; setState(e, 'prepara', secToTicks(R.avviso));
      return;
    }
    case 'prepara': {
      if (e.stT < e.stDur) return;
      const ribaltato = !!e.ribaltato;
      for (const [dx, dz] of lineeRaffica(e)) {
        s.proj.push({
          id: s.nextId++, tipo: 'palla_nemica', x: e.x + dx * 0.8, y: FRECCIA_Y, z: e.z + dz * 0.8, vx: dx * R.velocita, vy: 0, vz: dz * R.velocita, g: 0,
          danno: R.danno, life: secToTicks(R.gittata / R.velocita), traits: { sbilancia: true }, raggio: 0.3, colpiti: [], dalNemico: !ribaltato, contundente: true, magico: false, arrowId: null,
          ...(ribaltato ? { da: s.cur } : { spinge: R.spinta }),
        });
      }
      ev(s, { t: 'sparo', x: r2(e.x), z: r2(e.z) });
      e.ribaltato = false; e.modo = undefined;
      setState(e, 'recupera', secToTicks(R.ricarica));
      return;
    }
    default: if (e.stT >= e.stDur) { e.modo = undefined; setState(e, 'insegue', 0); }
  }
}

/** Un colpo caricato mentre ricarica manda in tilt lo Sparaneve: la raffica dopo la spara contro l'altro nemico più vicino che vede (se no, dietro di sé). */
export function ribalta(s: DungeonState, e: Enemy): void {
  const R = e.def.raffica!;
  let best: Enemy | null = null, bd = R.ribalta * R.ribalta;
  for (const o of s.enemies) {
    if (o === e || o.st === 'morto' || o.alleato) continue;
    const dx = o.x - e.x, dz = o.z - e.z, d2 = dx * dx + dz * dz;
    if (d2 < bd && lineOfSight(s.map, e.x, e.z, o.x, o.z)) { bd = d2; best = o; }
  }
  if (best) { const [ux, uz] = norm(best.x - e.x, best.z - e.z); e.fx = ux; e.fz = uz; } else { e.fx = -e.fx; e.fz = -e.fz; }
  e.ribaltato = true; e.st = 'recupera'; e.stT = Math.max(0, e.stDur - secToTicks(0.8)); // spara tra poco
  ev(s, { t: 'sfondato', x: r2(e.x), z: r2(e.z) });
}
