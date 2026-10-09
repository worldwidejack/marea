// Archivio Navigazionale, il capo: l'Astrolabio Impazzito (docs/RPG.md §2d). Sfera che vola nell'Osservatorio e tiene la distanza; gira il
// suo `ciclo` di attacchi, ognuno telegrafato (`prepara`) e seguito dalla ricalibrazione (`recupera`), quando scende ed è il momento della
// mischia: ROSA DEI VENTI (salve a raggiera, ognuna ruotata di mezzo spicchio: ci si salva nello spicchio vuoto), RAFFICA (chi gli sta
// intorno vola via e se sbatte contro un muro prende la botta), RAGGIO (linea d'avviso, poi il colpo lungo la linea: gli scaffali lo
// fermano). Sotto metà vita stacca gli anelli-scudo: gli girano attorno e finché ce n'è uno lui non prende danni (combat.ts). Niente
// funzioni trascendenti: la rotazione degli anelli usa seno e coseno in serie di Taylor (solo + − × ÷) e si rinormalizza.
import { DT } from '../constants.ts';
import type { DungeonState, Enemy } from './state.ts';
import { conEroe, ev, inGioco, moltVita, newEnemy, secToTicks } from './state.ts';
import { hitHero } from './combat.ts';
import { cellCenter, cellOf, isOpaque, lineOfSight, moveCircle, stepDown } from './map.ts';
import { flowDi, grigliaDi } from './muove.ts';
import { spingi } from './vento.ts';
import { DIR16, MAGIA_Y } from './tuning.ts';

const r2 = (v: number): number => Math.round(v * 100) / 100;
function setState(e: Enemy, st: Enemy['st'], dur: number): void { e.st = st; e.stT = 0; e.stDur = dur; }

/** Si avvicina (verso 1, lungo il flow field se non ti vede) o si allontana (−1) dall'eroe di turno, volando. */
function muovi(s: DungeonState, e: Enemy, verso: 1 | -1): void {
  const h = s.hero, g = grigliaDi(s, e), passo = e.def.velocita * DT;
  let tx = h.x, tz = h.z;
  if (verso === 1 && !lineOfSight(s.map, e.x, e.z, h.x, h.z)) {
    const n = stepDown(g, flowDi(s, e), cellOf(g, e.x, e.z));
    if (n >= 0) { const c = cellCenter(g, n); tx = c.x; tz = c.z; }
  }
  const dx = tx - e.x, dz = tz - e.z, d = Math.sqrt(dx * dx + dz * dz);
  if (d < 1e-6) return;
  moveCircle(g, e, (dx / d) * passo * verso, (dz / d) * passo * verso, e.def.raggio);
}

/** Quanto è lungo il raggio da (x, z) lungo (dx, dz): fino al primo muro o scaffale, al massimo `max`. */
function lunghezza(s: DungeonState, x: number, z: number, dx: number, dz: number, max: number): number {
  const t = s.map.tile;
  let l = 0;
  while (l < max) {
    const nl = l + 0.25;
    if (isOpaque(s.map, Math.floor((x + dx * nl) / t), Math.floor((z + dz * nl) / t))) break;
    l = nl;
  }
  return l;
}

/** Comincia il prossimo attacco del ciclo (telegrafato): il raggio prende la mira adesso e non la cambia più. */
function inizia(s: DungeonState, e: Enemy): void {
  const A = e.def.astrolabio!, h = s.hero;
  const modo = A.ciclo[e.attacchi % A.ciclo.length]!;
  e.attacchi++; e.modo = modo; e.salve = 0; e.tiro = false; e.area = false;
  let prep = modo === 'rosa' ? A.rosa.prep : A.raffica.prep;
  if (modo === 'raggio') {
    const dx = h.x - e.x, dz = h.z - e.z, d = Math.sqrt(dx * dx + dz * dz);
    const ux = d > 1e-6 ? dx / d : e.fx, uz = d > 1e-6 ? dz / d : e.fz;
    e.mira = { dx: ux, dz: uz, len: lunghezza(s, e.x, e.z, ux, uz, A.raggio.gittata) };
    prep = A.raggio.avviso;
  }
  setState(e, 'prepara', secToTicks(prep));
}

/** Una salva della rosa dei venti: `n` proiettili a raggiera, le salve dispari ruotate di mezzo spicchio. */
function salva(s: DungeonState, e: Enemy): void {
  const R = e.def.astrolabio!.rosa, k = e.salve ?? 0;
  e.salve = k + 1;
  const passo = Math.max(1, Math.floor(DIR16.length / R.n)), mezzo = Math.max(1, Math.floor(passo / 2));
  for (let i = 0; i < R.n; i++) {
    const [vx, vz] = DIR16[(i * passo + (k % 2) * mezzo) % DIR16.length]!;
    s.proj.push({
      id: s.nextId++, tipo: 'vento_nemico', x: e.x + vx * (e.def.raggio + 0.2), y: MAGIA_Y, z: e.z + vz * (e.def.raggio + 0.2),
      vx: vx * R.velocita, vy: 0, vz: vz * R.velocita, g: 0, danno: R.danno, life: secToTicks(R.gittata / R.velocita), traits: {}, raggio: 0,
      colpiti: [], dalNemico: true, contundente: true, magico: false, arrowId: null,
    });
  }
}

/** Raffica: chi gli sta intorno (e lo vede) prende il colpo e vola via; contro un muro, la botta (vento.ts). */
function raffica(s: DungeonState, e: Enemy): void {
  const R = e.def.astrolabio!.raffica;
  ev(s, { t: 'raffica' });
  for (const i of inGioco(s)) conEroe(s, i, () => {
    const h = s.hero, dx = h.x - e.x, dz = h.z - e.z, d = Math.sqrt(dx * dx + dz * dz);
    if (d > R.raggio || !lineOfSight(s.map, e.x, e.z, h.x, h.z)) return;
    const arriva = h.protetto <= 0;
    hitHero(s, R.danno, 'contundente', h.x, h.z);
    if (arriva && !s.done) spingi(s, d > 1e-6 ? dx / d : e.fx, d > 1e-6 ? dz / d : e.fz, R.spinta, R.secondi, R.urto);
  });
}

/** Raggio lungo la mira presa all'inizio: prende chi sta entro `largo` dalla linea (fino al primo scaffale o muro). */
function raggio(s: DungeonState, e: Enemy): void {
  const R = e.def.astrolabio!.raggio, m = e.mira;
  if (!m) return;
  ev(s, { t: 'raggio', x: r2(e.x + m.dx * m.len), z: r2(e.z + m.dz * m.len) });
  for (const i of inGioco(s)) conEroe(s, i, () => {
    const h = s.hero, rx = h.x - e.x, rz = h.z - e.z, lungo = rx * m.dx + rz * m.dz, r = s.runHero.raggio;
    if (lungo < 0 || lungo > m.len + r) return;
    if (Math.abs(rx * m.dz - rz * m.dx) > R.largo + r) return;
    hitHero(s, R.danno, 'magia', h.x, h.z);
  });
}

/** Sotto metà vita: gli anelli-scudo si staccano e cominciano a girargli attorno. */
function staccaAnelli(s: DungeonState, e: Enemy): void {
  const N = e.def.astrolabio!.anelli, passo = Math.max(1, Math.floor(DIR16.length / N.n)), kv = moltVita(s.eroi.length);
  e.diviso = true;
  for (let k = 0; k < N.n; k++) {
    const [ux, uz] = DIR16[(k * passo) % DIR16.length]!;
    const a = newEnemy(s, N.tipo, e.x + ux * N.distanza, e.z + uz * N.distanza);
    a.padre = e.id; a.ux = ux; a.uz = uz; a.fx = ux; a.fz = uz;
    a.aggro = true; a.st = 'insegue';
    if (kv !== 1) { a.max = a.def.vita * kv; a.vita = a.max; }
  }
  ev(s, { t: 'anelli' });
}

/** Passo dell'Astrolabio sveglio (dorme e veglia li fa enemies.ts): distanza, ciclo di attacchi, ricalibrazione, anelli a metà vita. */
export function stepAstrolabio(s: DungeonState, e: Enemy): void {
  const A = e.def.astrolabio!, h = s.hero;
  if (!e.diviso && e.vita <= e.max * A.anelli.soglia) staccaAnelli(s, e);
  switch (e.st) {
    case 'insegue': {
      const dx = h.x - e.x, dz = h.z - e.z, d = Math.sqrt(dx * dx + dz * dz);
      const vede = lineOfSight(s.map, e.x, e.z, h.x, h.z);
      if (!vede || d > A.distanza * 1.3) muovi(s, e, 1);
      else if (d < A.distanza * 0.7) muovi(s, e, -1);
      if (d > 1e-6) { e.fx = dx / d; e.fz = dz / d; }
      if (vede && e.cdTiro <= 0) inizia(s, e);
      return;
    }
    case 'prepara':
      if (e.stT < e.stDur) return;
      if (e.modo === 'rosa') { salva(s, e); setState(e, 'colpisce', secToTicks(A.rosa.ogni * A.rosa.salve)); }
      else if (e.modo === 'raffica') { raffica(s, e); setState(e, 'colpisce', secToTicks(A.raffica.secondi)); }
      else { raggio(s, e); setState(e, 'colpisce', secToTicks(A.raggio.durata)); }
      return;
    case 'colpisce':
      if (e.modo === 'rosa' && (e.salve ?? 0) < A.rosa.salve && e.stT % secToTicks(A.rosa.ogni) === 0) salva(s, e);
      if (e.stT >= e.stDur) setState(e, 'recupera', secToTicks(A.ricalibra));
      return;
    case 'recupera':
      if (e.stT < e.stDur) return;
      e.modo = undefined; e.mira = undefined; e.cdTiro = secToTicks(A.pausa);
      setState(e, 'insegue', 0);
      return;
    default:
  }
}

/** Un anello-scudo: gira attorno al suo Astrolabio (fermo mentre lui si ricalibra); sparisce con lui. */
export function stepAnello(s: DungeonState, e: Enemy): void {
  const p = s.enemies.find((x) => x.id === e.padre);
  if (!p || p.st === 'morto') { e.st = 'morto'; e.vita = 0; ev(s, { t: 'morte', id: e.id, tipo: e.tipo }); return; }
  const N = p.def.astrolabio!.anelli;
  let ux = e.ux ?? 1, uz = e.uz ?? 0;
  if (p.st !== 'recupera') {
    // rotazione di giro × DT radianti: seno e coseno in serie di Taylor, poi rinormalizza
    const a = N.giro * DT, a2 = a * a, c = 1 - a2 / 2 + (a2 * a2) / 24, sn = a - (a * a2) / 6 + (a * a2 * a2) / 120;
    const nx = ux * c - uz * sn, nz = ux * sn + uz * c, l = Math.sqrt(nx * nx + nz * nz);
    ux = nx / l; uz = nz / l;
  }
  e.ux = ux; e.uz = uz; e.fx = ux; e.fz = uz;
  e.x = p.x + ux * N.distanza; e.z = p.z + uz * N.distanza;
}
