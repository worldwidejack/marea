// Il Santuario del Capo Ardente, i nemici comuni (docs/SANTUARIO.md). Il Lanciatore di Lava tiene la distanza e carica col lanternino che brilla:
// sul pavimento compaiono i cerchi dei globi di lava; un colpo di mischia mentre carica lo stordisce e i globi si dissolvono. Il Guerriero Colossale
// abbatte la clava su una corsia davanti a sé e poi la clava resta incastrata: alle spalle lo stordisci; tra un colpo e l'altro va a calciare via i
// bracieri accesi. Lo Sciamano del Fumo è invisibile e intoccabile lontano dai bracieri accesi, evoca fuochi fatui che ti inseguono e, colpito alla
// lanterna in mischia, resta visibile per sempre. I fuochi fatui e i Mite di lava sono «micce»: inseguono e scoppiano a contatto.
// Niente funzioni trascendenti: le direzioni sono versori.
import type { HitSrc } from './combat.ts';
import type { DungeonState, Enemy } from './state.ts';
import { conEroe, ev, inGioco, newEnemy, secToTicks } from './state.ts';
import { hitHero } from './combat.ts';
import { lineOfSight, moveCircle } from './map.ts';
import { braciereAcceso, nascosto, spegni } from './braci.ts';
import { chase } from './enemies.ts';
import { setState } from './passi.ts';
import { colpoCorsia, corsiaFino } from './diga.ts';
import { grigliaDi } from './muove.ts';
import { RETRO_SCAFANDRO } from './tuning.ts';
import { colpoKorok, stepKorok } from './korok.ts';

const r2 = (v: number): number => Math.round(v * 100) / 100;
/** Chi di questi nemici è del Santuario (ha una sua macchina degli stati). */
const DEL_SANTUARIO = new Set(['lanciatore', 'colosso', 'sciamano', 'miccia', 'korok']);

/** Si gira verso l'eroe di turno; ritorna la distanza. */
function guarda(s: DungeonState, e: Enemy): number {
  const dx = s.hero.x - e.x, dz = s.hero.z - e.z, d = Math.sqrt(dx * dx + dz * dz);
  if (d > 1e-6) { e.fx = dx / d; e.fz = dz / d; }
  return d;
}
/** Lo stordimento: per `sec` s sta fermo (stepFoe), e quel che stava facendo è saltato. */
function stordisci(s: DungeonState, e: Enemy, sec: number): void {
  e.stordito = s.tick + secToTicks(sec);
  e.area = false; e.tiro = false; e.mira = undefined; e.modo = undefined;
  setState(e, 'recupera', secToTicks(0.4));
}

// ---- Lanciatore di Lava ----
/** Comincia a caricare: i cerchi dei globi compaiono subito (il primo dove sei adesso, gli altri attorno) e si riempiono in `carica` s. */
function carica(s: DungeonState, e: Enemy): void {
  const L = e.def.lanciatore!, h = s.hero;
  guarda(s, e);
  e.modo = 'lancia'; e.attacchi++;
  const dir = [[1, 0], [0.7071, 0.7071], [0, 1], [-0.7071, 0.7071], [-1, 0], [-0.7071, -0.7071], [0, -1], [0.7071, -0.7071]] as const;
  for (let k = 0; k < L.n; k++) {
    const [ox, oz] = k === 0 ? [0, 0] : dir[(e.attacchi * 3 + k * 2) % dir.length]!;
    const x = h.x + ox * L.sparpaglia, z = h.z + oz * L.sparpaglia;
    if (inMuro(s, x, z)) continue;
    s.geyser.push({
      id: s.nextId++, x, z, r: L.raggio, t: 0, avviso: secToTicks(L.carica), getto: secToTicks(0.25), danno: L.danno, colpiti: [], da: e.id,
      magma: { durata: L.fuoco.durata, raggio: L.raggio * 0.8, dps: L.fuoco.dps, secondi: L.fuoco.secondi },
    });
  }
  setState(e, 'prepara', secToTicks(L.carica));
}
/** Il punto (x, z) è dentro un muro (niente globo lì). */
const inMuro = (s: DungeonState, x: number, z: number): boolean => s.map.solid[Math.floor(z / s.map.tile) * s.map.w + Math.floor(x / s.map.tile)] === 1;

function stepLanciatore(s: DungeonState, e: Enemy): void {
  const L = e.def.lanciatore!, h = s.hero;
  switch (e.st) {
    case 'insegue': {
      const dx = h.x - e.x, dz = h.z - e.z, d = Math.sqrt(dx * dx + dz * dz), vede = d <= L.gittata && lineOfSight(s.map, e.x, e.z, h.x, h.z);
      if (vede && e.cdTiro <= 0) { carica(s, e); return; }
      if (vede && d < L.distanza * 0.7) chase(s, e, e.def.velocita, -1);
      else if (!vede || d > L.distanza * 1.3) chase(s, e, e.def.velocita, 1);
      if (vede && d > 1e-6) { e.fx = dx / d; e.fz = dz / d; }
      return;
    }
    case 'prepara':
      guarda(s, e); // il lanternino brilla e lui ti segue con lo sguardo; i globi sono già a terra
      if (e.stT < e.stDur) return;
      e.modo = undefined; e.cdTiro = secToTicks(L.pausa);
      setState(e, 'recupera', secToTicks(0.8));
      return;
    case 'recupera':
      if (e.stT >= e.stDur) { e.modo = undefined; setState(e, 'insegue', 0); }
      return;
    default:
  }
}

// ---- Guerriero Colossale ----
/** Il braciere acceso da prendere a calci: entro `cerca` m, se non è il momento di un altro calcio. */
function perCalcio(s: DungeonState, e: Enemy): number {
  const C = e.def.colosso!;
  return e.cdTiro > 0 ? -1 : braciereAcceso(s, e.x, e.z, C.calcio.cerca);
}

function stepColosso(s: DungeonState, e: Enemy): void {
  const C = e.def.colosso!, h = s.hero, rh = s.runHero;
  switch (e.st) {
    case 'insegue': {
      const dx = h.x - e.x, dz = h.z - e.z, d = Math.sqrt(dx * dx + dz * dz), vicino = d <= e.def.portata + e.def.raggio + rh.raggio + 0.6;
      const b = vicino ? -1 : perCalcio(s, e);
      if (b >= 0) {
        const br = s.map.bracieri[b]!, bx = br.x - e.x, bz = br.z - e.z, bl = Math.sqrt(bx * bx + bz * bz);
        if (bl <= e.def.raggio + 2.0) { // a un passo: alza il piede
          e.fx = bx / bl; e.fz = bz / bl; e.modo = 'calcio'; e.braciere = b;
          setState(e, 'prepara', secToTicks(C.calcio.prep));
          return;
        }
        const x0 = e.x, z0 = e.z, passo = e.def.velocita / 60;
        e.fx = bx / bl; e.fz = bz / bl;
        moveCircle(grigliaDi(s, e), e, e.fx * passo, e.fz * passo, e.def.raggio);
        if ((e.x - x0) * (e.x - x0) + (e.z - z0) * (e.z - z0) < passo * passo * 0.2) e.cdTiro = secToTicks(4); // bloccato da un muro: rinuncia
        return;
      }
      if (vicino && d > 1e-6) {
        e.fx = dx / d; e.fz = dz / d; e.modo = 'schiacciata'; e.attacchi++;
        e.mira = { dx: e.fx, dz: e.fz, len: corsiaFino(s, e.x, e.z, e.fx, e.fz, C.lungo).len };
        setState(e, 'prepara', secToTicks(e.def.preparazione));
        return;
      }
      chase(s, e, e.def.velocita, 1);
      return;
    }
    case 'prepara':
      if (e.stT < e.stDur) return;
      if (e.modo === 'calcio') {
        const b = e.braciere ?? -1;
        if (b >= 0) spegni(s, b);
        e.braciere = undefined; e.modo = undefined; e.cdTiro = secToTicks(C.calcio.ogni);
        setState(e, 'recupera', secToTicks(0.9));
        return;
      }
      colpoCorsia(s, e, C.largo, e.def.danno, 'contundente');
      e.modo = 'incastrato'; e.mira = undefined; // la clava resta nel pavimento
      ev(s, { t: 'incastrato' });
      setState(e, 'recupera', secToTicks(C.incastrata));
      return;
    case 'recupera':
      if (e.stT >= e.stDur) { e.modo = undefined; setState(e, 'insegue', 0); }
      return;
    default:
  }
}

// ---- Sciamano del Fumo ----
function stepSciamano(s: DungeonState, e: Enemy): void {
  const S = e.def.sciamano!, h = s.hero;
  switch (e.st) {
    case 'insegue': {
      const dx = h.x - e.x, dz = h.z - e.z, d = Math.sqrt(dx * dx + dz * dz), vede = d <= e.def.vista && lineOfSight(s.map, e.x, e.z, h.x, h.z);
      const vivi = s.enemies.filter((o) => o.tipo === S.fatuo && o.st !== 'morto').length;
      if (vede && e.cdTiro <= 0 && vivi < S.n * 2 && d <= S.distanza * 2) {
        guarda(s, e); e.modo = 'evoca';
        setState(e, 'prepara', secToTicks(S.avviso));
        return;
      }
      if (vede && d < S.distanza * 0.7) chase(s, e, e.def.velocita, -1);
      else if (!vede || d > S.distanza * 1.3) chase(s, e, e.def.velocita, 1);
      if (vede && d > 1e-6) { e.fx = dx / d; e.fz = dz / d; }
      return;
    }
    case 'prepara': {
      const d = guarda(s, e); // la linea che ti segue è la sua lanterna puntata su di te
      e.mira = { dx: e.fx, dz: e.fz, len: d };
      if (e.stT < e.stDur) return;
      for (let k = 0; k < S.n; k++) {
        const lato = k % 2 === 0 ? 1 : -1, f = newEnemy(s, S.fatuo, e.x - e.fz * lato * 1.0 + e.fx * 0.8, e.z + e.fx * lato * 1.0 + e.fz * 0.8);
        f.aggro = true; f.st = 'insegue';
      }
      e.modo = undefined; e.mira = undefined; e.cdTiro = secToTicks(S.ogni);
      setState(e, 'recupera', secToTicks(0.8));
      return;
    }
    case 'recupera':
      if (e.stT >= e.stDur) { e.modo = undefined; setState(e, 'insegue', 0); }
      return;
    default:
  }
}

// ---- Fuoco fatuo, Mite di lava ----
/** Lo scoppio: tutti gli eroi in gioco entro `raggio` m dalla miccia prendono `danno`. */
function scoppia(s: DungeonState, e: Enemy): void {
  const M = e.def.miccia!;
  for (const i of inGioco(s)) conEroe(s, i, () => {
    const h = s.hero, dx = h.x - e.x, dz = h.z - e.z, r = M.raggio + s.runHero.raggio;
    if (dx * dx + dz * dz <= r * r) hitHero(s, M.danno, 'magia', h.x, h.z);
  });
  ev(s, { t: 'scoppio', x: r2(e.x), z: r2(e.z), r: M.raggio, el: 'fuoco' });
}
function stepMiccia(s: DungeonState, e: Enemy): void {
  const M = e.def.miccia!, h = s.hero;
  if (e.fuso === undefined) e.fuso = s.tick + secToTicks(M.durata);
  if (s.tick >= e.fuso) {
    if (M.scoppia) scoppia(s, e);
    e.st = 'morto'; ev(s, { t: 'morte', id: e.id, tipo: e.tipo });
    return;
  }
  const dx = h.x - e.x, dz = h.z - e.z, d = Math.sqrt(dx * dx + dz * dz);
  if (d <= e.def.raggio + s.runHero.raggio + 0.3) { scoppia(s, e); e.st = 'morto'; ev(s, { t: 'morte', id: e.id, tipo: e.tipo }); return; }
  chase(s, e, e.def.velocita, 1);
  if (d > 1e-6) { e.fx = dx / d; e.fz = dz / d; }
}

/** Passo dei nemici del Santuario già svegli (dorme e veglia li fa enemies.ts). true = se n'è occupato. */
export function stepCeneri(s: DungeonState, e: Enemy): boolean {
  const c = e.def.comportamento;
  if (!DEL_SANTUARIO.has(c)) return false;
  if (c === 'miccia') { stepMiccia(s, e); return true; }
  if (e.st === 'dorme' || e.st === 'veglia') return false;
  if (c === 'lanciatore') stepLanciatore(s, e);
  else if (c === 'colosso') stepColosso(s, e);
  else if (c === 'sciamano') stepSciamano(s, e);
  else stepKorok(s, e);
  return true;
}

/** Un colpo dell'eroe su un nemico del Santuario (combat.ts): -1 = parato, se no il moltiplicatore del danno. Qui stanno i punti deboli. */
export function colpoCeneri(s: DungeonState, e: Enemy, src: HitSrc): number {
  const c = e.def.comportamento;
  if (c === 'korok') return colpoKorok(s, e, src);
  if (c === 'sciamano') {
    if (nascosto(s, e)) { ev(s, { t: 'parato', x: r2(e.x), z: r2(e.z), perche: 'fumo' }); return -1; }
    if (src.mischia && !e.rivelato && !e.alleato) { // la lanterna è solida: un colpo di lama la fa cadere, e da lì lo si vede sempre
      e.rivelato = true; stordisci(s, e, e.def.sciamano!.stordito);
      ev(s, { t: 'rivelato', id: e.id });
    }
    return 1;
  }
  if (c === 'lanciatore') {
    if (src.mischia && e.st === 'prepara' && e.modo === 'lancia') { // la lanterna brilla: colpita mentre carica, il globo si dissolve
      s.geyser = s.geyser.filter((g) => !(g.da === e.id && g.t <= g.avviso));
      stordisci(s, e, e.def.lanciatore!.stordito);
    }
    return 1;
  }
  if (c === 'colosso' && e.st === 'recupera' && e.modo === 'incastrato' && src.ox !== undefined && src.oz !== undefined) {
    const C = e.def.colosso!, ax = src.ox - e.x, az = src.oz - e.z, l = Math.sqrt(ax * ax + az * az), k = l > 1e-6 ? (ax * e.fx + az * e.fz) / l : 0;
    if (k > RETRO_SCAFANDRO) return 1;
    if (src.mischia && (e.stordito ?? 0) <= s.tick) e.stordito = s.tick + secToTicks(C.stordito);
    return C.retro; // alle spalle la schiena è scoperta
  }
  return 1;
}
