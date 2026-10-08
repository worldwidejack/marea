// IA degli zombie: escono da terra, inseguono l'eroe col flow field (che passa dalle finestre), davanti a una finestra sbarrata strappano
// le assi una alla volta, a portata preparano il colpo (telegrafato) e colpiscono se l'eroe è ancora lì davanti. Si tengono a distanza
// tra loro; chi resta bloccato troppo a lungo ricompare più vicino.
import { TEMPLARI } from '@marea/content/templari.ts';
import { DT } from '../constants.ts';
import { bfs, cellCenter, cellOf, lineOfSight, moveCircle, stepDown } from '../dungeon/map.ts';
import type { TState, Zombie } from './stato.ts';
import { COLPISCE_TICKS, COS_CONO_NEMICO, FLOW_OGNI, MORTO_TICKS, TOLLERANZA, ev, secToTicks } from './stato.ts';
import { ferisci } from './colpi.ts';
import { setFinestra } from './mappa.ts';
import { comparsaVicina } from './ondate.ts';

function aggiornaFlow(s: TState): void {
  if (s.tick - s.flowTick < FLOW_OGNI) return;
  const c = cellOf(s.gr.percorso, s.eroe.x, s.eroe.z);
  s.flowTick = s.tick;
  if (c === s.flowCell || c < 0) return;
  s.flowCell = c;
  bfs(s.gr.percorso, c, s.flow);
}

function setSt(z: Zombie, st: Zombie['st'], dur = 0): void { z.st = st; z.stT = 0; z.stDur = dur; }

/** Passo verso l'eroe: diretto se è vicino e in vista, altrimenti lungo il flow field. Davanti a una finestra con le assi: strappa. */
function insegui(s: TState, z: Zombie): void {
  const h = s.eroe, a = s.arena;
  const dx0 = h.x - z.x, dz0 = h.z - z.z, d0 = Math.sqrt(dx0 * dx0 + dz0 * dz0);
  let tx = h.x, tz = h.z;
  const qui = cellOf(s.gr.percorso, z.x, z.z);
  if (!(d0 < 3 && lineOfSight(s.gr.percorso, z.x, z.z, h.x, h.z))) {
    const nx = stepDown(s.gr.percorso, s.flow, qui);
    if (nx >= 0 && nx !== qui) {
      const f = a.finestraDi[nx] ?? -1;
      if (f >= 0 && (s.assi[f] ?? 0) > 0) {
        // davanti alla finestra sbarrata: si mette in posizione e strappa
        const p = a.finestre[f]!.fuori, ex = p.x - z.x, ez = p.z - z.z;
        if (ex * ex + ez * ez > 0.36) { muovi(s, z, p.x, p.z, z.vel); return; }
        z.finestra = f; setSt(z, 'strappa', secToTicks(z.def.strappa));
        const w = a.finestre[f]!, wx = w.x - z.x, wz = w.z - z.z, wd = Math.sqrt(wx * wx + wz * wz) || 1;
        z.fx = wx / wd; z.fz = wz / wd;
        return;
      }
      const p = cellCenter(s.gr.percorso, nx); tx = p.x; tz = p.z;
    }
  }
  muovi(s, z, tx, tz, z.vel);
  // progresso: chi non si avvicina all'eroe per troppo tempo ricompare più vicino
  const fd = qui >= 0 ? s.flow[qui] ?? -1 : -1;
  if (fd >= 0 && fd < z.best) { z.best = fd; z.bestT = s.tick; }
  else if (s.tick - z.bestT > secToTicks(TEMPLARI.ondate.bloccato)) {
    const c = comparsaVicina(s);
    if (c) { z.x = c.x; z.z = c.z; z.best = 1e9; z.bestT = s.tick; setSt(z, 'sorge', secToTicks(z.def.sorge)); ev(s, { t: 'sorge', id: z.id, x: c.x, z: c.z }); }
  }
}
function muovi(s: TState, z: Zombie, tx: number, tz: number, v: number): void {
  const dx = tx - z.x, dz = tz - z.z, d = Math.sqrt(dx * dx + dz * dz);
  if (d < 1e-6) return;
  const step = Math.min(d, v * DT);
  z.fx = dx / d; z.fz = dz / d;
  moveCircle(s.gr.zombie, z, z.fx * step, z.fz * step, z.def.raggio);
}

function stepUno(s: TState, z: Zombie): void {
  const h = s.eroe, def = z.def;
  const dx = h.x - z.x, dz = h.z - z.z, d = Math.sqrt(dx * dx + dz * dz);
  z.stT++;
  if (z.hurt > 0) z.hurt--;
  if (s.tick >= z.grido && z.st !== 'morto') {
    z.grido = s.tick + secToTicks(4 + s.rng.next() * 7);
    ev(s, { t: 'grido', id: z.id, tipo: z.vel >= def.velocita.scatta ? 'urlo' : s.rng.next() < 0.35 ? 'deus' : 'rantolo' });
  }
  switch (z.st) {
    case 'sorge':
      if (z.stT >= z.stDur) setSt(z, 'insegue');
      return;
    case 'insegue': {
      const reach = def.portata + def.raggio + TEMPLARI.eroe.raggio;
      if (d <= reach && lineOfSight(s.gr.percorso, z.x, z.z, h.x, h.z)) {
        if (d > 1e-6) { z.fx = dx / d; z.fz = dz / d; }
        setSt(z, 'prepara', secToTicks(def.preparazione));
        return;
      }
      insegui(s, z);
      return;
    }
    case 'strappa': {
      const f = z.finestra;
      if (f < 0 || (s.assi[f] ?? 0) <= 0) { z.finestra = -1; setSt(z, 'insegue'); return; }
      if (z.stT >= z.stDur) {
        const n = Math.max(0, (s.assi[f] ?? 0) - 1);
        s.assi[f] = n; setFinestra(s.arena, s.gr, f, n);
        ev(s, { t: 'asse', finestra: f, assi: n, da: 'zombie' });
        if (n <= 0) { z.finestra = -1; setSt(z, 'insegue'); } else setSt(z, 'strappa', secToTicks(def.strappa));
      }
      return;
    }
    case 'prepara':
      if (z.stT >= z.stDur) {
        const dot = d > 1e-6 ? (dx * z.fx + dz * z.fz) / d : 1;
        if (d <= def.portata + def.raggio + TEMPLARI.eroe.raggio + TOLLERANZA && dot >= COS_CONO_NEMICO) ferisci(s, def.danno, h.x, h.z);
        setSt(z, 'colpisce', COLPISCE_TICKS);
      }
      return;
    case 'colpisce':
      if (z.stT >= z.stDur) setSt(z, 'recupera', secToTicks(def.recupero));
      return;
    case 'recupera':
      if (z.stT >= z.stDur) setSt(z, 'insegue');
      return;
    default:
  }
}

/** Separa gli zombie tra loro e dall'eroe (cerchi solidi). */
function separa(s: TState, act: Zombie[]): void {
  const h = s.eroe, rh = TEMPLARI.eroe.raggio;
  for (let i = 0; i < act.length; i++) {
    const a = act[i]!;
    for (let j = i + 1; j < act.length; j++) {
      const b = act[j]!;
      const dx = b.x - a.x, dz = b.z - a.z, d2 = dx * dx + dz * dz, rr = a.def.raggio + b.def.raggio;
      if (d2 >= rr * rr) continue;
      const d = Math.sqrt(d2), ux = d > 1e-6 ? dx / d : 1, uz = d > 1e-6 ? dz / d : 0, k = (rr - d) / 2;
      moveCircle(s.gr.zombie, a, -ux * k, -uz * k, a.def.raggio);
      moveCircle(s.gr.zombie, b, ux * k, uz * k, b.def.raggio);
    }
    const dx = a.x - h.x, dz = a.z - h.z, d2 = dx * dx + dz * dz, rr = a.def.raggio + rh;
    if (d2 < rr * rr && d2 > 1e-12) { const d = Math.sqrt(d2), k = (rr - d) / d; moveCircle(s.gr.zombie, a, dx * k * 0.5, dz * k * 0.5, a.def.raggio); }
  }
}

export function stepZombi(s: TState): void {
  aggiornaFlow(s);
  const act: Zombie[] = [];
  for (const z of s.zombie) {
    if (z.st === 'morto') { z.stT++; continue; }
    stepUno(s, z);
    if (s.done) return;
    if (z.st !== 'sorge') act.push(z);
  }
  separa(s, act);
  // i morti spariscono dopo la caduta
  if (s.zombie.some((z) => z.st === 'morto' && z.stT >= MORTO_TICKS)) s.zombie = s.zombie.filter((z) => z.st !== 'morto' || z.stT < MORTO_TICKS);
}
