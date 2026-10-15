// La partita dello sparatutto (#355): un tick = giocatore, poi bersagli (poligono) o nemici e missione (Missione 0). `passo` svuota gli
// eventi del tick prima (la resa li legge dopo ogni passo). Chi sente uno sparo si mette in allerta; un nemico colpito sa da dove.
// Il pilota automatico serve ai test e al tasto T del banco: spara al nemico più vicino che vede (tenendo giù il rinculo come una
// persona); se non vede nessuno va verso l'obiettivo (il nemico più vicino, la gru, la barca) lungo le distanze BFS della griglia a terra.
import { SPARO } from '@marea/content/sparo.ts';
import { atan2 } from '../trig.ts';
import { bfs, cellCenter, stepDown } from '../dungeon/map.ts';
import type { SMappa } from './mappa.ts';
import { mappaSparo, vede } from './mappa.ts';
import { passoGiocatore } from './giocatore.ts';
import { calmo, libera, passoNemici, senti } from './bot.ts';
import { inCerchio, passoMissione, sabotando } from './missione.ts';
import type { SInput, SOpzioni, SState } from './stato.ts';
import { GRADI, collo, nuovaPartita, occhi, quantizzaMira, secTick } from './stato.ts';

export { nuovaPartita };

/** I bersagli del poligono: fermi a casa, si rialzano dopo qualche secondo. */
function passoBersagli(s: SState): void {
  const R = secTick(SPARO.bersagli.rinasce);
  for (let i = 0; i < s.bot.length; i++) {
    const b = s.bot[i]!;
    if (b.tipo === 'bersaglio' && b.morto && s.tick - b.morto >= R) {
      b.vita = SPARO.bersagli.vita; b.morto = 0; b.x = b.casa.x; b.z = b.casa.z; b.yaw = b.casa.yaw;
      s.ev.push({ t: 'rialza', chi: i });
    }
  }
}

export function passo(s: SState, inp: SInput): void {
  const m = mappaSparo();
  s.ev.length = 0;
  s.tick++;
  if (s.missione?.esito) return; // finita: si guarda la schermata
  passoGiocatore(s, m, sabotando(s, inp) ? { ...inp, fuoco: false } : inp);
  if (s.modo === 'poligono') { passoBersagli(s); return; }
  const g = s.g;
  for (const e of s.ev) {
    if (e.t === 'sparo' && e.chi < 0) senti(s, g.x, g.z, SPARO.nemici.udito);
    if (e.t === 'colpito' && e.chi >= 0 && e.da < 0) {
      const b = s.bot[e.chi]!;
      b.ux = g.x; b.uz = g.z; b.vistoT = s.tick;
      if (calmo(b)) senti(s, g.x, g.z, Math.sqrt((b.x - g.x) * (b.x - g.x) + (b.z - g.z) * (b.z - g.z)) + 0.5);
    }
  }
  passoNemici(s, m);
  passoMissione(s, inp);
}

/** Yaw e pitch (quantizzati) per guardare da (ax, ay, az) verso (bx, by, bz). */
export function miraVerso(ax: number, ay: number, az: number, bx: number, by: number, bz: number): { yaw: number; pitch: number } {
  const dx = bx - ax, dy = by - ay, dz = bz - az, o = Math.sqrt(dx * dx + dz * dz);
  return { yaw: quantizzaMira(atan2(-dx, -dz)), pitch: quantizzaMira(atan2(dy, o)) };
}

const campi = new WeakMap<SState, { cella: number; d: Int32Array }>();
/** Prossimo punto verso (x, z) lungo il campo BFS (rifatto solo quando la meta cambia cella). */
function versoMeta(s: SState, m: SMappa, x: number, z: number): { x: number; z: number } | null {
  const meta = libera(m, x, z);
  let c = campi.get(s);
  if (!c || c.cella !== meta) { c = { cella: meta, d: bfs(m, meta) }; campi.set(s, c); }
  const dopo = stepDown(m, c.d, libera(m, s.g.x, s.g.z));
  if (dopo < 0) return null;
  // guarda due celle avanti: il passo è più dritto
  const dopo2 = stepDown(m, c.d, dopo);
  return cellCenter(m, dopo2 >= 0 ? dopo2 : dopo);
}

/** Pilota automatico: abbatte bersagli o nemici; nella missione segue gli obiettivi. */
export function autopilota(s: SState): SInput {
  const m = mappaSparo(), g = s.g, oy = occhi(g), mi = s.missione;
  const inp: SInput = { mx: 0, my: 0, yaw: g.yaw, pitch: g.pitch, fuoco: false, mira: false, ricarica: false, salto: false, giu: false, corsa: false, azione: false, arma: 0 };
  const st = g.armi[g.arma - 1]!;
  if (st.colpi === 0 && st.riserva > 0) inp.ricarica = true;
  let meta = -1, md = Infinity, inVista = false;
  for (let i = 0; i < s.bot.length; i++) {
    const b = s.bot[i]!;
    if (b.morto) continue;
    const dx = b.x - g.x, dz = b.z - g.z, d = dx * dx + dz * dz, v = vede(m, g.x, oy, g.z, b.x, collo(b) - 0.25, b.z);
    // preferisce quelli che vede; tra quelli il più vicino
    const peso = v ? d : d + 1e6;
    if (peso < md) { md = peso; meta = i; inVista = v; }
  }
  const verso = (x: number, z: number) => {
    const p = versoMeta(s, m, x, z);
    if (p) { const a = miraVerso(g.x, oy, g.z, p.x, oy, p.z); inp.yaw = a.yaw; inp.pitch = 0; inp.my = 1; }
  };
  // alla gru: sabota se nessuno è troppo vicino
  if (mi && mi.obiettivo === 1 && inCerchio(g.x, g.z, SPARO.mappa.gru) && !(inVista && md < 36)) { inp.azione = true; return inp; }
  if (meta >= 0 && inVista) {
    const b = s.bot[meta]!, dist = Math.sqrt(md);
    // tiene giù il rinculo come farebbe una persona: punta più in basso (e di lato) di quanto è salito
    const a = miraVerso(g.x, oy, g.z, b.x, collo(b) - 0.25, b.z);
    inp.yaw = quantizzaMira(a.yaw - g.rinculoLato); inp.pitch = quantizzaMira(a.pitch - g.rinculoSu);
    inp.mira = dist > 9;
    // spara quando la mira è già lì (il passo prima ha girato la testa)
    const err = Math.abs(inp.yaw - g.yaw) + Math.abs(inp.pitch - g.pitch);
    inp.fuoco = err < 1.5 * GRADI && !g.grilletto;
    if (dist > 20) inp.my = 1;
    return inp;
  }
  if (mi && mi.obiettivo === 1) verso(SPARO.mappa.gru.x, SPARO.mappa.gru.z);
  else if (mi && mi.obiettivo === 2) verso(SPARO.mappa.barca.uscita.x, SPARO.mappa.barca.uscita.z);
  else if (meta >= 0) verso(s.bot[meta]!.x, s.bot[meta]!.z);
  return inp;
}

export type { SOpzioni };
