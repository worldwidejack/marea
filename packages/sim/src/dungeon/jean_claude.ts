// Il Tempio della «Doppia Nera», il capo: Jean-Claude «Valanga», Il Guru del Fuoripista (950 HP).
// Terrazza panoramica a sbalzo sulla montagna (arena 14x12 celle). Due fasi:
// FASE 1 (100% - 50% HP):
// - Frenata a Spruzzo (16 danni + 3 celle spinta): cono rosso di neve (0.9s preavviso).
// - Salto dal Trampolino (26 danni): balzo altissimo (1.5s), quadrato 3x3 che segue e si blocca 0.6s prima;
//   se schivato, Jean-Claude atterra male e resta in bilico su una gamba per 3s con bersaglio giallo.
// FASE 2 (50% - 0% HP):
// - Slalom Gigante: fischietto d'oro, piazza 3 bandierine da gara (10 HP ciascuna). Percorso 1 -> 2 -> 3;
//   se il giocatore abbatte una bandierina prima che lui la passi, lui si ferma e urla per 4s contro l'arbitro
//   invisibile ("MA ERA REGOLARE! ARBITRO VENDUTO!"), completamente vulnerabile!
// - Doppia Lamina Incrociata (20 danni): X rossa 3x3 a terra per 1.0s, due fendenti rapidi.
import type { DungeonState, Enemy } from './state.ts';
import { ev, secToTicks } from './state.ts';
import { hitHero } from './combat.ts';
import { lineOfSight } from './map.ts';
import { moveToward } from './passi.ts';
import { spingi } from './vento.ts';

const r2 = (v: number): number => Math.round(v * 100) / 100;
const setState = (e: Enemy, st: Enemy['st'], dur: number): void => { e.st = st; e.stT = 0; e.stDur = dur; };

/** Boss Jean-Claude "Valanga". */
export function stepJeanClaude(s: DungeonState, e: Enemy): void {
  const h = s.hero;
  const hpRatio = e.vita / e.max;
  const fase2 = hpRatio <= 0.5;
  if (fase2 && !e.fase) {
    e.fase = 2;
    ev(s, { t: 'fase', n: 2 });
  }

  // Se è stordito (in bilico o a urlare contro l'arbitro)
  if (e.stordito && e.stordito > s.tick) {
    e.stT++;
    if (e.stT >= e.stDur) {
      e.stordito = 0;
      e.modo = undefined;
      setState(e, 'insegue', 0);
    }
    return;
  }

  const dx = h.x - e.x, dz = h.z - e.z, d2 = dx * dx + dz * dz, d = Math.sqrt(d2);

  switch (e.st) {
    case 'insegue':
      if (d > 1e-6) { e.fx = dx / d; e.fz = dz / d; }
      if (!fase2) {
        // FASE 1: alterna Frenata a Spruzzo e Salto dal Trampolino
        if (e.attacchi % 2 === 0) {
          // Frenata a Spruzzo: si avvicina a 3-4m
          if (d <= 16 && lineOfSight(s.map, e.x, e.z, h.x, h.z)) {
            e.modo = 'frenata';
            e.attacchi++;
            setState(e, 'prepara', secToTicks(0.9));
            ev(s, { t: 'frenata', x: r2(e.x), z: r2(e.z) });
          } else {
            moveToward(s, e, h.x, h.z, e.def.velocita);
          }
        } else {
          // Salto dal Trampolino: prepara il salto
          e.modo = 'salto';
          e.attacchi++;
          e.mira = { dx: h.x, dz: h.z, len: 0 };
          setState(e, 'prepara', secToTicks(1.5));
          ev(s, { t: 'salto', x: r2(e.x), z: r2(e.z) });
        }
      } else {
        // FASE 2: alterna Slalom Gigante e Doppia Lamina Incrociata
        if (e.attacchi % 2 === 0) {
          // Avvia lo Slalom: pianta 3 bandierine nell'arena
          e.modo = 'slalom';
          e.attacchi++;
          e.salve = 0; // indice bandierina corrente (0, 1, 2)
          piantaBandierine(s, e);
          setState(e, 'prepara', secToTicks(2.0));
          ev(s, { t: 'arbitro', x: r2(e.x), z: r2(e.z), urlo: 'FISCHIO!' });
        } else {
          // Doppia Lamina Incrociata: X rossa 3x3
          if (d <= 12) {
            e.modo = 'lamina';
            e.attacchi++;
            e.mira = { dx: e.fx, dz: e.fz, len: 4 };
            setState(e, 'prepara', secToTicks(1.0));
            ev(s, { t: 'lamina', x: r2(e.x), z: r2(e.z) });
          } else {
            moveToward(s, e, h.x, h.z, e.def.velocita);
          }
        }
      }
      return;

    case 'prepara':
      e.stT++;
      if (e.modo === 'salto') {
        // Durante il salto il quadrato 3x3 segue il giocatore fino a 0.6s prima dell'impatto
        if (e.stT < secToTicks(0.9) && e.mira) {
          e.mira.dx = h.x;
          e.mira.dz = h.z;
        }
      }
      if (e.stT >= e.stDur) {
        eseguiColpo(s, e);
      }
      return;

    case 'colpisce':
      e.stT++;
      if (e.modo === 'slalom') {
        stepSlalom(s, e);
      } else if (e.stT >= e.stDur) {
        setState(e, 'recupera', secToTicks(e.def.recupero));
      }
      return;

    case 'recupera':
      e.stT++;
      if (e.stT >= e.stDur) {
        e.modo = undefined;
        setState(e, 'insegue', 0);
      }
      return;

    default:
  }
}

/** Esegue l'attacco di Jean-Claude alla fine di `prepara`. */
function eseguiColpo(s: DungeonState, e: Enemy): void {
  const h = s.hero;

  if (e.modo === 'frenata') {
    // Frenata a Spruzzo: onda di neve a cono che infligge 16 danni e spinge di 3 celle (6m)
    const dx = h.x - e.x, dz = h.z - e.z, d = Math.sqrt(dx * dx + dz * dz);
    const dot = d > 1e-6 ? (dx * e.fx + dz * e.fz) / d : 0;
    if (d <= 8 && dot >= 0.5) {
      hitHero(s, 16, 'contundente', h.x, h.z);
      spingi(s, e.fx, e.fz, 6, 0.4);
    }
    setState(e, 'recupera', secToTicks(1.2));
  } else if (e.modo === 'salto') {
    // Atterraggio dal Trampolino: quadrato 3x3 (lato 6m)
    const targetX = e.mira?.dx ?? e.x, targetZ = e.mira?.dz ?? e.z;
    e.x = targetX; e.z = targetZ;
    const dx = Math.abs(h.x - targetX), dz = Math.abs(h.z - targetZ);
    if (dx <= 3 && dz <= 3) {
      // Giocatore preso: 26 danni
      hitHero(s, 26, 'contundente', h.x, h.z);
      setState(e, 'recupera', secToTicks(1.0));
    } else {
      // Giocatore ha schivato: atterra male, 3s di bilico su una gamba sola!
      e.modo = 'bilico';
      setState(e, 'recupera', secToTicks(3.0));
      e.stordito = s.tick + secToTicks(3.0);
      ev(s, { t: 'bilico', x: r2(e.x), z: r2(e.z) });
    }
  } else if (e.modo === 'slalom') {
    // Comincia la corsa attraverso le 3 bandierine
    setState(e, 'colpisce', secToTicks(10.0));
  } else if (e.modo === 'lamina') {
    // Doppia Lamina Incrociata: 20 danni in quadrato 3x3 centrato sul bersaglio
    const dx = Math.abs(h.x - (e.x + e.fx * 2)), dz = Math.abs(h.z - (e.z + e.fz * 2));
    if (dx <= 3 && dz <= 3) {
      hitHero(s, 20, 'taglio', h.x, h.z);
    }
    setState(e, 'recupera', secToTicks(1.0));
  }
}

/** Pianta le 3 bandierine da Slalom nell'arena. */
function piantaBandierine(s: DungeonState, e: Enemy): void {
  s.bandierine = [
    { id: s.nextId++, n: 1, x: e.x - 4, z: e.z - 3, cx: Math.floor((e.x - 4) / 2), cz: Math.floor((e.z - 3) / 2), vita: 10, abbattuta: false },
    { id: s.nextId++, n: 2, x: e.x + 4, z: e.z, cx: Math.floor((e.x + 4) / 2), cz: Math.floor(e.z / 2), vita: 10, abbattuta: false },
    { id: s.nextId++, n: 3, x: e.x - 2, z: e.z + 4, cx: Math.floor((e.x - 2) / 2), cz: Math.floor((e.z + 4) / 2), vita: 10, abbattuta: false },
  ];
  for (const b of s.bandierine) {
    ev(s, { t: 'bandierina', id: b.id, n: b.n, abbattuta: false });
  }
}

/** Corsa a zig-zag tra le bandierine. */
function stepSlalom(s: DungeonState, e: Enemy): void {
  const idx = e.salve ?? 0;
  if (idx >= s.bandierine.length) {
    // Slalom completato regolarmente
    s.bandierine = [];
    setState(e, 'recupera', secToTicks(1.5));
    return;
  }

  const b = s.bandierine[idx]!;
  if (b.abbattuta) {
    // La bandierina è stata abbattuta dal giocatore!
    // Jean-Claude si ferma e urla contro l'arbitro per 4 secondi!
    e.modo = 'arbitro';
    e.stordito = s.tick + secToTicks(4.0);
    setState(e, 'recupera', secToTicks(4.0));
    s.bandierine = [];
    ev(s, { t: 'arbitro', x: r2(e.x), z: r2(e.z), urlo: 'MA ERA REGOLARE! ARBITRO VENDUTO!' });
    return;
  }

  // Corre veloce verso la bandierina corrente
  const bx = b.x - e.x, bz = b.z - e.z, bd = Math.sqrt(bx * bx + bz * bz);
  if (bd <= 1.5) {
    // Ha attraversato la porta: onda di ghiaccio radiale (22 danni)
    const h = s.hero;
    const dx = h.x - e.x, dz = h.z - e.z;
    if (dx * dx + dz * dz <= 36) {
      hitHero(s, 22, 'taglio', h.x, h.z);
    }
    e.salve = idx + 1;
  } else {
    moveToward(s, e, b.x, b.z, 6.0); // carica veloce da slalom
  }
}
