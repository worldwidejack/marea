// Il Tempio della «Doppia Nera» (Baita, Isola dell'Adrenalina):
// - Ghiaccio Vivo: scivolamento cardinale a griglia finché non si sbatte contro muri/ostacoli o terreno asciutto.
// - Colonnine Termiche: attivano le serpentine, scongelano la stanza e aprono i tornelli congelati.
// - Acrobata del Fuoripista: trottola rotante (2.5s, anello rosso raggio 2 celle, 14 dmg) seguita da 3s di capogiro (stelline gialle).
// - Alchimista del Bombardino: lancia fiasche a parabola (1.3s delay) alternando Sciolina (-50% vel per 3s) e Bombardino (8 dps per 3s);
//   debolezza alle spalle sul fusticino giallo (esplosione e stordimento 2.5s).
// - Sparaneve Automatico: torretta fissa, triplo colpo a ventaglio (16 dmg + spinta), ricarica 3s; se colpita da caricato 360° durante
//   la ricarica si gira e spara ai nemici.
import { DT } from '../constants.ts';
import type { DungeonState, Enemy, HeroRt } from './state.ts';
import { conEroe, ev, inGioco, secToTicks } from './state.ts';
import { hitHero } from './combat.ts';
import { cellOf, lineOfSight, moveCircle } from './map.ts';
import { moveToward } from './passi.ts';
import { FRECCIA_Y } from './tuning.ts';

const r2 = (v: number): number => Math.round(v * 100) / 100;
const setState = (e: Enemy, st: Enemy['st'], dur: number): void => { e.st = st; e.stT = 0; e.stDur = dur; };

/** Passo del Ghiaccio Vivo per l'eroe: scivola dritto finché sbatte o esce dal ghiaccio. */
function stepGhiaccio(s: DungeonState, h: HeroRt): void {
  const c = cellOf(s.map, h.x, h.z);
  const stanza = c >= 0 ? s.map.ghiaccio[c] ?? 0 : 0;
  const attivo = stanza > 0 && !s.sciolti.includes(stanza);

  if (attivo) {
    if (h.slideDir) {
      const step = 6.0 * DT;
      const x0 = h.x, z0 = h.z;
      moveCircle(s.map, h, h.slideDir[0] * step, h.slideDir[1] * step, s.runHero.raggio);
      // Se si è fermato (urto contro muro o ostacolo solido)
      if (Math.abs(h.x - x0) < 1e-4 && Math.abs(h.z - z0) < 1e-4) {
        h.slideDir = null;
        return;
      }
      // Se è scivolato fuori dal ghiaccio attivo
      const c2 = cellOf(s.map, h.x, h.z);
      const st2 = c2 >= 0 ? s.map.ghiaccio[c2] ?? 0 : 0;
      if (st2 === 0 || s.sciolti.includes(st2)) {
        h.slideDir = null;
      }
    } else if (h.moving) {
      // Inizia a scivolare nella direzione cardinale prevalente
      if (Math.abs(h.fx) >= Math.abs(h.fz)) {
        h.slideDir = [h.fx >= 0 ? 1 : -1, 0];
      } else {
        h.slideDir = [0, h.fz >= 0 ? 1 : -1];
      }
      ev(s, { t: 'scivolata', x: r2(h.x), z: r2(h.z) });
    }
  } else {
    h.slideDir = null;
  }
}

/** Chiazze a terra lasciate dall'Alchimista: Sciolina (rallenta) o Bombardino (brucia). */
function stepPozzanghere(s: DungeonState): void {
  if (!s.pozzanghere.length) return;
  const attive = [];
  for (const p of s.pozzanghere) {
    if (p.fine <= s.tick) continue;
    attive.push(p);
    for (const i of inGioco(s)) conEroe(s, i, () => {
      const h = s.hero;
      const dx = h.x - p.x, dz = h.z - p.z;
      if (dx * dx + dz * dz <= p.r * p.r) {
        if (p.tipo === 'sciolina') {
          h.lento = secToTicks(3.0);
          h.lentoMolt = 0.5;
        } else if (p.tipo === 'bombardino') {
          if (s.tick >= p.tickDanno) {
            p.tickDanno = s.tick + secToTicks(0.5);
            hitHero(s, 4, 'magia', h.x, h.z);
          }
        }
      }
    });
  }
  s.pozzanghere = attive;
}

/** Controlla se una colonnina ha scongelato una stanza. */
function stepScongelamento(s: DungeonState): void {
  for (const b of s.bacini) {
    if (b.aperta && !s.sciolti.includes(b.n)) {
      s.sciolti.push(b.n);
      ev(s, { t: 'scongelato', n: b.n });
    }
  }
}

/** Aggiornamento a ogni tick per il Tempio della «Doppia Nera». */
export function stepBaita(s: DungeonState): void {
  stepScongelamento(s);
  for (const i of inGioco(s)) conEroe(s, i, () => {
    stepGhiaccio(s, s.hero);
  });
  stepPozzanghere(s);
}

/** Nemico 1: Acrobata del Fuoripista — trottola rotante con 3s di capogiro finale. */
export function stepAcrobata(s: DungeonState, e: Enemy): void {
  if (e.stordito && e.stordito > s.tick) return;
  const h = s.hero;
  const dx = h.x - e.x, dz = h.z - e.z, d2 = dx * dx + dz * dz;

  switch (e.st) {
    case 'insegue':
      if (d2 <= 100 && lineOfSight(s.map, e.x, e.z, h.x, h.z)) {
        // Vede il giocatore: carica la trottola!
        const d = Math.sqrt(d2);
        if (d > 1e-6) { e.fx = dx / d; e.fz = dz / d; }
        e.modo = 'trottola';
        e.area = true;
        setState(e, 'prepara', secToTicks(0.5));
      } else {
        moveToward(s, e, h.x, h.z, e.def.velocita);
      }
      return;
    case 'prepara':
      e.stT++;
      if (e.stT >= e.stDur) {
        // Parte la rotazione a 1080° per 2.5s
        setState(e, 'colpisce', secToTicks(2.5));
      }
      return;
    case 'colpisce':
      e.stT++;
      // Insegue a 2.8 m/s (1.4 celle/sec)
      moveToward(s, e, h.x, h.z, 2.8);
      // Danno entro 4m (2 celle) una volta ogni 0.6s
      if (d2 <= 16 && e.stT % secToTicks(0.6) === 0) {
        hitHero(s, e.def.danno, 'taglio', h.x, h.z);
      }
      if (e.stT >= e.stDur) {
        // Fine della trottola: Capogiro per 3 secondi!
        e.area = false;
        setState(e, 'recupera', secToTicks(3.0));
        e.stordito = s.tick + secToTicks(3.0);
        ev(s, { t: 'capogiro', id: e.id, x: r2(e.x), z: r2(e.z) });
      }
      return;
    case 'recupera':
      e.stT++;
      if (e.stT >= e.stDur) {
        setState(e, 'insegue', 0);
      }
      return;
    default:
  }
}

/** Nemico 2: Alchimista del Bombardino — fiasche a distanza e debolezza sul retro. */
export function stepAlchimista(s: DungeonState, e: Enemy): void {
  if (e.stordito && e.stordito > s.tick) return;
  const h = s.hero;
  const dx = h.x - e.x, dz = h.z - e.z, d2 = dx * dx + dz * dz, d = Math.sqrt(d2);

  switch (e.st) {
    case 'insegue':
      if (d > 1e-6) { e.fx = dx / d; e.fz = dz / d; }
      if (d <= 144 && lineOfSight(s.map, e.x, e.z, h.x, h.z)) {
        if (d < 8) {
          // Troppo vicino: indietreggia
          moveCircle(s.map, e, -e.fx * e.def.velocita * DT, -e.fz * e.def.velocita * DT, e.def.raggio);
        }
        e.attacchi++;
        e.mira = { dx: e.fx, dz: e.fz, len: Math.min(12, Math.max(4, d)) };
        setState(e, 'prepara', secToTicks(1.3));
      } else {
        moveToward(s, e, h.x, h.z, e.def.velocita);
      }
      return;
    case 'prepara':
      e.stT++;
      if (e.stT >= e.stDur) {
        // Lancia la fiasca: alterna Sciolina e Bombardino
        const tipo = e.attacchi % 2 === 1 ? 'sciolina' : 'bombardino';
        const len = e.mira?.len ?? 8;
        const tx = e.x + e.fx * len, tz = e.z + e.fz * len;
        s.pozzanghere.push({
          id: s.nextId++,
          x: tx,
          z: tz,
          r: 2.0,
          tipo,
          fine: s.tick + secToTicks(3.0),
          tickDanno: s.tick,
        });
        ev(s, { t: 'pozzanghera', x: r2(tx), z: r2(tz), tipo });
        setState(e, 'recupera', secToTicks(e.def.recupero));
      }
      return;
    case 'recupera':
      e.stT++;
      if (e.stT >= e.stDur) {
        setState(e, 'insegue', 0);
      }
      return;
    default:
  }
}

/** Nemico 3: Sparaneve Automatico — torretta fissa con triplo colpo a ventaglio. */
export function stepSparaneve(s: DungeonState, e: Enemy): void {
  if (e.stordito && e.stordito > s.tick) return;
  const h = s.hero;
  const dx = h.x - e.x, dz = h.z - e.z, d2 = dx * dx + dz * dz, d = Math.sqrt(d2);

  switch (e.st) {
    case 'insegue':
      if (d <= 144 && lineOfSight(s.map, e.x, e.z, h.x, h.z)) {
        if (!e.ribaltato && d > 1e-6) { e.fx = dx / d; e.fz = dz / d; }
        setState(e, 'prepara', secToTicks(1.2));
      }
      return;
    case 'prepara':
      e.stT++;
      if (e.stT >= e.stDur) {
        // Spara 3 palle di neve a ventaglio 45°
        const angoli = [-0.38, 0, 0.38];
        for (const ang of angoli) {
          const vx = e.fx - e.fz * ang, vz = e.fz + e.fx * ang, vl = Math.sqrt(vx * vx + vz * vz);
          const dirX = vl > 1e-6 ? vx / vl : e.fx, dirZ = vl > 1e-6 ? vz / vl : e.fz;
          s.proj.push({
            id: s.nextId++,
            tipo: 'palla_nemica',
            x: e.x + dirX * 0.8,
            y: FRECCIA_Y,
            z: e.z + dirZ * 0.8,
            vx: dirX * 12,
            vy: 0,
            vz: dirZ * 12,
            g: 0,
            danno: e.def.danno,
            life: secToTicks(1.5),
            traits: { sbilancia: true },
            raggio: 0.3,
            colpiti: [],
            dalNemico: !e.ribaltato,
            contundente: true,
            magico: false,
            arrowId: null,
          });
        }
        ev(s, { t: 'sparo', x: r2(e.x), z: r2(e.z) });
        setState(e, 'recupera', secToTicks(3.0));
      }
      return;
    case 'recupera':
      e.stT++;
      if (e.stT >= e.stDur) {
        e.ribaltato = false;
        setState(e, 'insegue', 0);
      }
      return;
    default:
  }
}
