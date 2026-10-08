// IA degli zombie (docs/TEMPLARI.md §8): escono da terra, inseguono l'eroe col flow field (che passa dalle finestre), davanti a una finestra
// sbarrata strappano le assi una alla volta, a portata preparano il colpo (telegrafato) e colpiscono se l'eroe è ancora lì davanti. Si
// tengono a distanza tra loro; chi resta bloccato troppo a lungo ricompare più vicino. In più:
//   cannoniere: da 3-10 m e in vista lancia una bomba dove sei (cerchio a terra, esplode dopo il volo), sennò si avvicina fino a `distanza`
//   cavaliere:  in vista entro `vista` m si impenna e carica in linea retta verso dove eri: chi prende lo butta via; sfonda le finestre
//   de Molay:   lascia fiamme dove passa, tira palle di fuoco, e a metà vita smette di prendere colpi, ride e scappa via (sparisce)
import { TEMPLARI } from '@marea/content/templari.ts';
import { DT } from '../constants.ts';
import { bfs, cellCenter, cellOf, isOpaque, lineOfSight, moveCircle, stepDown } from '../dungeon/map.ts';
import type { TState, Zombie } from './stato.ts';
import { COLPISCE_TICKS, COS_CONO_NEMICO, FLOW_OGNI, MORTO_TICKS, TOLLERANZA, ev, secToTicks } from './stato.ts';
import { accendi, dai, ferisci } from './colpi.ts';
import { setFinestra } from './mappa.ts';
import { attive, comparsaVicina } from './ondate.ts';

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
function insegui(s: TState, z: Zombie, v = z.vel): void {
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
        if (ex * ex + ez * ez > 0.36) { muovi(s, z, p.x, p.z, v); return; }
        z.finestra = f; setSt(z, 'strappa', secToTicks(z.def.strappa));
        const w = a.finestre[f]!, wx = w.x - z.x, wz = w.z - z.z, wd = Math.sqrt(wx * wx + wz * wz) || 1;
        z.fx = wx / wd; z.fz = wz / wd;
        return;
      }
      const p = cellCenter(s.gr.percorso, nx); tx = p.x; tz = p.z;
    }
  }
  muovi(s, z, tx, tz, v);
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
const guardaEroe = (s: TState, z: Zombie, dx: number, dz: number, d: number) => { if (d > 1e-6) { z.fx = dx / d; z.fz = dz / d; } };
const vede = (s: TState, z: Zombie) => lineOfSight(s.gr.percorso, z.x, z.z, s.eroe.x, s.eroe.z);

/** Colpi speciali quando insegue: bomba, carica, palla di fuoco. true = ha cominciato a prepararne uno. */
function speciale(s: TState, z: Zombie, dx: number, dz: number, d: number): boolean {
  const def = z.def, h = s.eroe;
  if (z.cd > 0) return false;
  if (def.bomba && d >= 3 && d <= def.bomba.gittata && vede(s, z)) {
    z.modo = 'bomba'; z.tx = h.x; z.tz = h.z; guardaEroe(s, z, dx, dz, d);
    setSt(z, 'prepara', secToTicks(def.bomba.preparazione)); return true;
  }
  if (def.carica && d >= 3 && d <= def.carica.vista && vede(s, z)) {
    z.modo = 'carica'; guardaEroe(s, z, dx, dz, d); z.dx = z.fx; z.dz = z.fz; z.preso = false;
    setSt(z, 'prepara', secToTicks(def.carica.preparazione)); ev(s, { t: 'corno', id: z.id }); return true;
  }
  if (def.palla && d >= 3 && d <= def.palla.gittata && vede(s, z)) {
    z.modo = 'palla'; guardaEroe(s, z, dx, dz, d);
    setSt(z, 'prepara', secToTicks(def.preparazione)); return true;
  }
  return false;
}

/** Fine della preparazione: colpo in mischia (se l'eroe è ancora lì davanti), carica, bomba o palla di fuoco. */
function scatta(s: TState, z: Zombie, dx: number, dz: number, d: number): void {
  const def = z.def;
  switch (z.modo) {
    case 'carica': setSt(z, 'carica', secToTicks(def.carica!.durata)); return;
    case 'bomba': {
      const b = def.bomba!;
      s.tiri.push({ id: s.nextId++, tipo: 'bomba', x: z.x, z: z.z, sx: z.x, sz: z.z, tx: z.tx, tz: z.tz, vx: 0, vz: 0, t: 0, dur: secToTicks(b.volo), danno: b.danno, r: b.raggio });
      ev(s, { t: 'bomba', x: Math.round(z.x * 100) / 100, z: Math.round(z.z * 100) / 100, tx: Math.round(z.tx * 100) / 100, tz: Math.round(z.tz * 100) / 100 });
      z.cd = secToTicks(b.ricarica); z.modo = 'mischia';
      setSt(z, 'colpisce', COLPISCE_TICKS); return;
    }
    case 'palla': {
      const p = def.palla!;
      s.tiri.push({ id: s.nextId++, tipo: 'palla', x: z.x + z.fx * 0.6, z: z.z + z.fz * 0.6, sx: z.x, sz: z.z, tx: 0, tz: 0, vx: z.fx * p.velocita, vz: z.fz * p.velocita, t: 0, dur: secToTicks(p.gittata / p.velocita), danno: p.danno, r: 0.45 });
      z.cd = secToTicks(p.ricarica); z.modo = 'mischia';
      setSt(z, 'colpisce', COLPISCE_TICKS); return;
    }
    default: {
      const dot = d > 1e-6 ? (dx * z.fx + dz * z.fz) / d : 1;
      if (d <= def.portata + def.raggio + TEMPLARI.eroe.raggio + TOLLERANZA && dot >= COS_CONO_NEMICO) ferisci(s, def.danno, z.x, z.z);
      setSt(z, 'colpisce', COLPISCE_TICKS);
    }
  }
}

/** Il cavaliere lanciato: dritto e veloce; chi prende lo ferisce e lo spinge via; contro un muro si ferma. */
function carica(s: TState, z: Zombie): void {
  const c = z.def.carica!, h = s.eroe, x0 = z.x, z0 = z.z;
  z.fx = z.dx; z.fz = z.dz;
  moveCircle(s.gr.zombie, z, z.dx * c.velocita * DT, z.dz * c.velocita * DT, z.def.raggio);
  const mosso = Math.sqrt((z.x - x0) * (z.x - x0) + (z.z - z0) * (z.z - z0));
  const dx = h.x - z.x, dz = h.z - z.z, rr = z.def.raggio + TEMPLARI.eroe.raggio + 0.5;
  if (!z.preso && dx * dx + dz * dz <= rr * rr) {
    z.preso = true;
    ferisci(s, c.danno, z.x, z.z);
    moveCircle(s.gr.eroe, h, z.dx * c.spinta, z.dz * c.spinta, TEMPLARI.eroe.raggio);
  }
  if (z.stT >= z.stDur || mosso < c.velocita * DT * 0.3) { z.cd = secToTicks(c.ricarica); z.modo = 'mischia'; setSt(z, 'recupera', secToTicks(z.def.recupero)); }
}

/** De Molay a metà vita: corre via verso la comparsa più lontana dall'eroe e sparisce (punti come un boss abbattuto). */
function fuggi(s: TState, z: Zombie): void {
  if (!z.fuga) {
    let best = attive(s)[0] ?? { x: z.x, z: z.z }, bd = -1;
    for (const c of attive(s)) { const d = (c.x - s.eroe.x) * (c.x - s.eroe.x) + (c.z - s.eroe.z) * (c.z - s.eroe.z); if (d > bd) { bd = d; best = c; } }
    z.fuga = { x: best.x, z: best.z };
  }
  const dx = z.fuga.x - z.x, dz = z.fuga.z - z.z;
  // non segue il flow field verso l'eroe: va dritto (sfonda le assi come se niente fosse), ed esce dopo 6 s comunque
  if (dx * dx + dz * dz > 1) moveCircle(s.gr.percorso, z, (dx / Math.sqrt(dx * dx + dz * dz)) * 3.6 * DT, (dz / Math.sqrt(dx * dx + dz * dz)) * 3.6 * DT, z.def.raggio);
  if (dx * dx + dz * dz <= 1 || z.stT >= secToTicks(6)) {
    z.st = 'morto'; z.stT = MORTO_TICKS; z.vita = 0;
    ev(s, { t: 'scompare', id: z.id, tipo: z.tipo });
    dai(s, z.def.punti ?? 0, 'uccisione');
  }
}

function stepUno(s: TState, z: Zombie): void {
  const h = s.eroe, def = z.def;
  const dx = h.x - z.x, dz = h.z - z.z, d = Math.sqrt(dx * dx + dz * dz);
  z.stT++;
  if (z.hurt > 0) z.hurt--;
  if (z.cd > 0) z.cd--;
  if (s.tick >= z.grido && z.st !== 'morto') {
    z.grido = s.tick + secToTicks(4 + s.rng.next() * 7);
    ev(s, { t: 'grido', id: z.id, tipo: z.vel >= def.velocita.scatta && !def.boss ? 'urlo' : s.rng.next() < 0.35 ? 'deus' : 'rantolo' });
  }
  // de Molay lascia fiamme dove passa
  if (def.scia && z.st !== 'sorge' && z.st !== 'fugge' && s.tick >= z.scia) {
    z.scia = s.tick + secToTicks(def.scia.ogni);
    accendi(s, z.x, z.z, def.scia, true);
  }
  switch (z.st) {
    case 'sorge':
      if (z.stT >= z.stDur) setSt(z, 'insegue');
      return;
    case 'insegue': {
      const reach = def.portata + def.raggio + TEMPLARI.eroe.raggio;
      if (d <= reach && vede(s, z)) { z.modo = 'mischia'; guardaEroe(s, z, dx, dz, d); setSt(z, 'prepara', secToTicks(def.preparazione)); return; }
      if (speciale(s, z, dx, dz, d)) return;
      // il cannoniere resta a distanza se ti vede
      if (def.bomba && d <= def.bomba.distanza && vede(s, z)) { guardaEroe(s, z, dx, dz, d); return; }
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
      if (z.stT >= z.stDur) scatta(s, z, dx, dz, d);
      return;
    case 'carica': carica(s, z); return;
    case 'colpisce':
      if (z.stT >= z.stDur) setSt(z, 'recupera', secToTicks(def.recupero));
      return;
    case 'recupera':
      if (z.stT >= z.stDur) setSt(z, 'insegue');
      return;
    case 'fugge': fuggi(s, z); return;
    default:
  }
}

/** Tiri dei nemici: la bomba vola fino a dove eri ed esplode (lo scudo para se guarda lì); la palla di fuoco va dritta e lascia fiamme. */
function stepTiri(s: TState): void {
  if (!s.tiri.length) return;
  const h = s.eroe, keep: typeof s.tiri = [];
  for (const b of s.tiri) {
    b.t++;
    if (b.tipo === 'bomba') {
      const k = Math.min(1, b.t / b.dur);
      b.x = b.sx + (b.tx - b.sx) * k; b.z = b.sz + (b.tz - b.sz) * k;
      if (k < 1) { keep.push(b); continue; }
      ev(s, { t: 'esplosione', x: Math.round(b.x * 100) / 100, z: Math.round(b.z * 100) / 100, r: b.r });
      const dx = h.x - b.x, dz = h.z - b.z;
      if (dx * dx + dz * dz <= (b.r + TEMPLARI.eroe.raggio) * (b.r + TEMPLARI.eroe.raggio)) ferisci(s, b.danno, b.x, b.z);
      if (s.done) return;
      continue;
    }
    const n = Math.max(1, Math.ceil(Math.sqrt(b.vx * b.vx + b.vz * b.vz) * DT / 0.4));
    let fine = false;
    for (let i = 0; i < n && !fine; i++) {
      b.x += (b.vx * DT) / n; b.z += (b.vz * DT) / n;
      const g = s.gr.percorso;
      const dx = h.x - b.x, dz = h.z - b.z, rr = b.r + TEMPLARI.eroe.raggio;
      if (dx * dx + dz * dz <= rr * rr) { ferisci(s, b.danno, b.x - b.vx * 0.05, b.z - b.vz * 0.05); fine = true; }
      else if (isOpaque(g, Math.floor(b.x / g.tile), Math.floor(b.z / g.tile))) fine = true;
    }
    if (fine || b.t >= b.dur) {
      const molay = TEMPLARI.nemici.find((x) => x.palla)?.palla;
      if (molay) accendi(s, b.x, b.z, molay.fuoco, true);
      if (s.done) return;
      continue;
    }
    keep.push(b);
  }
  s.tiri = keep;
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
      // i boss non si fanno spostare dai fanti
      const ka = b.def.boss && !a.def.boss ? 2 : a.def.boss && !b.def.boss ? 0 : 1, kb = 2 - ka;
      moveCircle(s.gr.zombie, a, -ux * k * ka, -uz * k * ka, a.def.raggio);
      moveCircle(s.gr.zombie, b, ux * k * kb, uz * k * kb, b.def.raggio);
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
    if (!(['sorge', 'morto', 'fugge'] as string[]).includes(z.st)) act.push(z); // stepUno può averlo fatto sparire (de Molay)
  }
  separa(s, act);
  stepTiri(s);
  if (s.done) return;
  // i morti spariscono dopo la caduta
  if (s.zombie.some((z) => z.st === 'morto' && z.stT >= MORTO_TICKS)) s.zombie = s.zombie.filter((z) => z.st !== 'morto' || z.stT < MORTO_TICKS);
}
