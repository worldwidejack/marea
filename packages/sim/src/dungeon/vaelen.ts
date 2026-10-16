// La Diga dei Disertori, il capo: il Capitano Vaelen, l'Ancora dei Giusti (docs/RPG.md §2g). Gigante col cappotto da ammiraglio e
// l'albero maestro spezzato come lancia, sul Ponte di Comando squarciato coi quattro piloni. Due fasi.
// LA GUARDIA DEL PASSO (sopra metà vita): il DOPPIO AFFONDO (due corsie rosse una dopo l'altra, ognuna mirata dove sei quando comincia) e
// la SPAZZATA (anello rosso attorno a lui); dopo la spazzata la lancia resta INCASTRATA nelle assi per qualche secondo: è chino, fermo, e
// alle spalle la catena arrugginita prende di più.
// L'ULTIMA MAREA (sotto metà vita, dopo che ha spezzato le catene: intanto è intoccabile): la CARICA (freccia larga fino a dove si
// fermerà, che ti segue e poco prima di partire si blocca: chi si è messo dietro un pilone se lo vede arrivare addosso; poi corre dritto: se finisce contro un pilone lo fracassa e resta stordito tra i detriti, con le spalle scoperte) e la SALVA
// (pianta la lancia e resta fermo con lo scudo davanti mentre cadono due ondate di cannonate; un caricato da davanti sfonda lo scudo e la
// salva finisce lì), più affondi e spazzate. Dopo ogni attacco una pausa. Niente funzioni trascendenti: le direzioni sono versori.
import { DT } from '../constants.ts';
import type { DungeonState, Enemy } from './state.ts';
import { conEroe, ev, inGioco, secToTicks } from './state.ts';
import { hitHero } from './combat.ts';
import { cellCenter, cellOf, isSolid, lineOfSight, moveCircle, stepDown } from './map.ts';
import { spingi } from './vento.ts';
import { colpoCorsia, corsiaFino, piloneIn, rompiPilone } from './diga.ts';
import { COLPISCE_TICKS, GEYSER_DIR } from './tuning.ts';

const r2 = (v: number): number => Math.round(v * 100) / 100;
function setState(e: Enemy, st: Enemy['st'], dur: number): void { e.st = st; e.stT = 0; e.stDur = dur; }
/** Danno di un colpo del Capitano (× il moltiplicatore dell'attacco). */
const danno = (e: Enemy, molt: number): number => e.def.danno * molt;

/** Cammina verso l'eroe di turno: dritto se è vicino e lo vede, se no lungo il flow field. */
function muovi(s: DungeonState, e: Enemy): void {
  const h = s.hero, passo = e.def.velocita * DT;
  let tx = h.x, tz = h.z;
  const ax = h.x - e.x, az = h.z - e.z;
  if (!(ax * ax + az * az < 16 && lineOfSight(s.map, e.x, e.z, h.x, h.z))) {
    const n = stepDown(s.map, s.flow, cellOf(s.map, e.x, e.z));
    if (n >= 0) { const c = cellCenter(s.map, n); tx = c.x; tz = c.z; }
  }
  const dx = tx - e.x, dz = tz - e.z, d = Math.sqrt(dx * dx + dz * dz);
  if (d < 1e-6) return;
  e.fx = dx / d; e.fz = dz / d;
  moveCircle(s.map, e, e.fx * Math.min(d, passo), e.fz * Math.min(d, passo), e.def.raggio);
}

/** Si gira verso l'eroe di turno. */
function guarda(s: DungeonState, e: Enemy): void {
  const dx = s.hero.x - e.x, dz = s.hero.z - e.z, d = Math.sqrt(dx * dx + dz * dz);
  if (d > 1e-6) { e.fx = dx / d; e.fz = dz / d; }
}

/** Mira la corsia dell'affondo verso l'eroe di turno (i muri e i piloni la fermano) e la telegrafa per `avviso` s. */
function miraAffondo(s: DungeonState, e: Enemy): void {
  const A = e.def.vaelen!.affondo;
  guarda(s, e);
  e.mira = { dx: e.fx, dz: e.fz, len: corsiaFino(s, e.x, e.z, e.fx, e.fz, A.lungo).len };
  setState(e, 'prepara', secToTicks(A.avviso));
}

/** Mira la carica verso l'eroe di turno: la freccia arriva fino al primo muro, all'acqua o al pilone che la fermerà (anche se lui non ti
 *  vede: ti segue dietro i piloni, è il trucco per farcelo sbattere contro). */
function miraCarica(s: DungeonState, e: Enemy): void {
  guarda(s, e);
  const c = corsiaFino(s, e.x, e.z, e.fx, e.fz, e.def.vaelen!.carica.gittata, true);
  e.mira = { dx: e.fx, dz: e.fz, len: c.len }; e.pilone = c.pilone;
}

type Modo = 'affondo' | 'spazzata' | 'carica' | 'salva';
/** Comincia un attacco (telegrafato in `prepara`): corsie e carica prendono la mira adesso e non la cambiano più. */
function inizia(s: DungeonState, e: Enemy, modo: Modo): void {
  const V = e.def.vaelen!;
  e.modo = modo; e.salve = 0; e.tiro = false; e.area = modo === 'spazzata'; e.mira = undefined; e.pilone = -1;
  guarda(s, e);
  if (modo === 'affondo') { miraAffondo(s, e); return; }
  if (modo === 'carica') { miraCarica(s, e); setState(e, 'prepara', secToTicks(V.carica.avviso)); return; }
  if (modo === 'spazzata') { setState(e, 'prepara', secToTicks(e.def.preparazione * (e.def.area?.prep ?? 1))); return; }
  setState(e, 'prepara', secToTicks(0.5)); // la salva: pianta la lancia
}

/** Batte attorno a sé: tutti gli eroi in gioco entro `raggio` m prendono il colpo. */
function spazza(s: DungeonState, e: Enemy): void {
  const A = e.def.area!;
  for (const i of inGioco(s)) conEroe(s, i, () => {
    const h = s.hero, dx = h.x - e.x, dz = h.z - e.z, r = A.raggio + s.runHero.raggio;
    if (dx * dx + dz * dz <= r * r) hitHero(s, danno(e, A.danno), 'taglio', h.x, h.z);
    else ev(s, { t: 'schivato', x: r2(h.x), z: r2(h.z) });
  });
}

/** Un'ondata di cannonate della salva: la prima dove sta l'eroe di turno, le altre attorno (sui muri niente). */
function ondata(s: DungeonState, e: Enemy): void {
  const S = e.def.vaelen!.salva, h = s.hero, k0 = e.salve ?? 0;
  e.salve = k0 + 1;
  for (let k = 0; k < S.n; k++) {
    const [ox, oz] = k === 0 ? [0, 0] : GEYSER_DIR[(e.attacchi * 3 + k0 * 2 + k) % GEYSER_DIR.length]!;
    const x = h.x + ox * S.sparpaglia, z = h.z + oz * S.sparpaglia;
    if (isSolid(s.map, Math.floor(x / s.map.tile), Math.floor(z / s.map.tile))) continue;
    s.geyser.push({ id: s.nextId++, x, z, r: S.raggio, t: 0, avviso: secToTicks(S.caduta), getto: secToTicks(0.25), danno: S.danno, colpiti: [], spinta: 1.5, cannone: true });
  }
}

/** Un passo della carica: corre dritto, travolge chi trova (una volta); arrivato in fondo, contro un pilone lo fracassa e resta stordito
 *  tra i detriti, contro un muro si ferma. */
function corre(s: DungeonState, e: Enemy): void {
  const C = e.def.vaelen!.carica, m = e.mira!, passo = C.velocita * DT;
  const x0 = e.x, z0 = e.z;
  moveCircle(s.map, e, m.dx * passo, m.dz * passo, e.def.raggio);
  const fx = e.x - x0, fz = e.z - z0, fatto = Math.sqrt(fx * fx + fz * fz);
  e.corsa = (e.corsa ?? 0) + fatto;
  const presi = e.presi ?? (e.presi = []);
  for (const i of inGioco(s)) {
    if (presi.includes(i)) continue;
    conEroe(s, i, () => {
      const h = s.hero, dx = h.x - e.x, dz = h.z - e.z, r = e.def.raggio + s.runHero.raggio + 0.2;
      if (dx * dx + dz * dz > r * r) return;
      presi.push(i);
      const arriva = h.protetto <= 0;
      hitHero(s, danno(e, C.danno), 'contundente', h.x, h.z);
      if (!arriva || s.done) return;
      // via di lato, dalla parte dove stava rispetto alla corsa (in mezzo: a destra)
      const lato = dx * m.dz - dz * m.dx >= 0 ? -1 : 1, px = -m.dz * lato + m.dx * 0.5, pz = m.dx * lato + m.dz * 0.5, l = Math.sqrt(px * px + pz * pz);
      spingi(s, px / l, pz / l, C.spinta, 0.3);
    });
  }
  if (fatto >= passo * 0.5 && e.corsa < m.len) return;
  // arrivato: il pilone che aveva davanti (se è ancora lì) va in pezzi e la lancia resta tra i detriti
  const t = s.map.tile, k = e.pilone ?? -1, p = k >= 0 ? s.map.piloni[k] : undefined;
  if (p && piloneIn(s, p.cx, p.cz) === k) {
    const ax = p.x - e.x, az = p.z - e.z, r = e.def.raggio + t;
    if (ax * ax + az * az <= r * r) {
      rompiPilone(s, k);
      e.modo = 'detriti'; e.mira = undefined; e.area = false;
      setState(e, 'recupera', secToTicks(C.stordito));
      return;
    }
  }
  riposa(s, e); // contro il muro, l'acqua o a fine corsa: si ferma e riprende fiato
}

/** Fine dell'attacco: pausa della fase (il momento per colpirlo). */
function riposa(s: DungeonState, e: Enemy): void {
  const V = e.def.vaelen!;
  e.modo = undefined; e.mira = undefined; e.area = false; e.tiro = false; e.pilone = -1;
  setState(e, 'recupera', secToTicks(V.pausa[Math.min(e.fase ?? 0, V.pausa.length - 1)] ?? 1));
}

/** Sotto la soglia spezza le catene: per `cambio` s è fermo e intoccabile (combat.ts), poi riparte con l'Ultima Marea. */
function cambia(s: DungeonState, e: Enemy): void {
  const V = e.def.vaelen!;
  e.fase = 1; e.modo = 'cambio'; e.mira = undefined; e.area = false; e.tiro = false; e.attacchi = 0;
  setState(e, 'recupera', secToTicks(V.cambio));
  ev(s, { t: 'fase', n: 1 });
}

/** La salva interrotta: un caricato da davanti ha sfondato lo scudo (combat.ts). Le cannonate in arrivo non cadono, niente seconda ondata,
 *  barcolla per `rotto` s. */
export function sbilancia(s: DungeonState, e: Enemy): void {
  const V = e.def.vaelen!;
  e.modo = 'sbilanciato'; e.mira = undefined; e.area = false;
  s.geyser = s.geyser.filter((g) => !(g.cannone && g.t <= g.avviso)); // le cannonate ancora in aria non cadono più
  setState(e, 'recupera', secToTicks(V.salva.rotto));
  ev(s, { t: 'sfondato', x: r2(e.x), z: r2(e.z) });
}

/** Lo scudo della salva è alzato (para da davanti). */
export const scudoSu = (e: Enemy): boolean => !!e.def.vaelen && e.modo === 'salva' && e.st === 'colpisce';
/** Chino sulla lancia (incastrata nelle assi o tra i detriti di un pilone): alle spalle la catena prende di più. */
export const chino = (e: Enemy): boolean => !!e.def.vaelen && e.st === 'recupera' && (e.modo === 'incastrato' || e.modo === 'detriti');

/** Passo del Capitano sveglio (dorme e veglia li fa enemies.ts). */
export function stepVaelen(s: DungeonState, e: Enemy): void {
  const V = e.def.vaelen!, h = s.hero, rh = s.runHero, fase = e.fase ?? 0;
  if (e.modo !== 'cambio' && fase === 0 && e.vita <= e.max * V.soglia) { cambia(s, e); return; }
  switch (e.st) {
    case 'insegue': {
      const dx = h.x - e.x, dz = h.z - e.z, d = Math.sqrt(dx * dx + dz * dz);
      const vicino = d <= e.def.portata + e.def.raggio + rh.raggio;
      if (!vicino) muovi(s, e); else if (d > 1e-6) { e.fx = dx / d; e.fz = dz / d; }
      if (d > e.def.vista || !lineOfSight(s.map, e.x, e.z, h.x, h.z)) return;
      const ciclo = V.cicli[Math.min(fase, V.cicli.length - 1)]!, modo = ciclo[e.attacchi % ciclo.length]!;
      // affondo e spazzata vanno fatti da vicino: finché è lontano cammina ancora (carica e salva partono da dove sta)
      if (modo === 'spazzata' && d > (e.def.area?.raggio ?? 3) - 0.5) return;
      if (modo === 'affondo' && d > V.affondo.lungo - 1.5) return;
      e.attacchi++;
      inizia(s, e, modo);
      return;
    }
    case 'prepara':
      // la freccia della carica ti segue finché non si blocca (gli ultimi `blocca` s)
      if (e.modo === 'carica' && e.stT < e.stDur - secToTicks(V.carica.blocca)) miraCarica(s, e);
      if (e.stT < e.stDur) return;
      switch (e.modo) {
        case 'affondo': {
          colpoCorsia(s, e, V.affondo.largo, danno(e, V.affondo.danno), 'taglio');
          e.salve = (e.salve ?? 0) + 1;
          if (e.salve < V.affondo.n) miraAffondo(s, e); // il secondo affondo: mirato di nuovo dove sei adesso
          else { e.mira = undefined; setState(e, 'colpisce', COLPISCE_TICKS); }
          break;
        }
        case 'spazzata':
          spazza(s, e);
          // la lancia si conficca nelle assi: chino e fermo, le spalle scoperte
          e.modo = 'incastrato'; e.area = false;
          setState(e, 'recupera', secToTicks(V.spazzata.incastrato));
          ev(s, { t: 'incastrato' });
          break;
        case 'carica': e.corsa = 0; e.presi = []; ev(s, { t: 'carica' }); setState(e, 'colpisce', secToTicks(V.carica.gittata / V.carica.velocita) + 2); break;
        default: // la salva: fermo con lo scudo, la prima ondata adesso
          e.salve = 0; setState(e, 'colpisce', secToTicks(V.salva.durata)); ondata(s, e);
      }
      return;
    case 'colpisce':
      if (e.modo === 'carica') { corre(s, e); if (e.st === 'colpisce' && e.stT >= e.stDur) riposa(s, e); return; }
      if (e.modo === 'salva' && (e.salve ?? 0) < V.salva.ondate && e.stT % secToTicks(V.salva.ogni) === 0) ondata(s, e);
      if (e.stT >= e.stDur) riposa(s, e);
      return;
    case 'recupera':
      if (e.stT < e.stDur) return;
      e.modo = undefined; e.mira = undefined; e.cdTiro = 0;
      setState(e, 'insegue', 0);
      return;
    default:
  }
}
