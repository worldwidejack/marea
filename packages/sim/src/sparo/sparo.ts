// La partita dello sparatutto (#355): un tick = giocatore, poi nemici o bersagli. `passo` svuota gli eventi del tick prima (la resa li
// legge dopo ogni passo). Il pilota automatico serve ai test e al tasto T del banco: nel poligono va verso il bersaglio in piedi più
// vicino che vede, lo punta al petto e spara; ricarica quando serve. Cammina lungo le distanze BFS della griglia a terra.
import { SPARO } from '@marea/content/sparo.ts';
import { atan2 } from '../trig.ts';
import { bfs, cellCenter, cellOf, stepDown } from '../dungeon/map.ts';
import type { SMappa } from './mappa.ts';
import { mappaSparo, vede } from './mappa.ts';
import { passoGiocatore } from './giocatore.ts';
import type { SInput, SOpzioni, SState } from './stato.ts';
import { GRADI, collo, nuovaPartita, occhi, quantizzaMira, secTick } from './stato.ts';

export { nuovaPartita };

/** I bersagli del poligono: fermi a casa, si rialzano dopo qualche secondo. */
function passoBersagli(s: SState): void {
  const R = secTick(SPARO.bersagli.rinasce);
  for (let i = 0; i < s.bot.length; i++) {
    const b = s.bot[i]!;
    if (b.morto && s.tick - b.morto >= R) {
      b.vita = SPARO.bersagli.vita; b.morto = 0; b.x = b.casa.x; b.z = b.casa.z; b.yaw = b.casa.yaw;
      s.ev.push({ t: 'rialza', chi: i });
    }
  }
}

export function passo(s: SState, inp: SInput): void {
  const m = mappaSparo();
  s.ev.length = 0;
  s.tick++;
  passoGiocatore(s, m, inp);
  passoBersagli(s);
}

/** Yaw e pitch (quantizzati) per guardare da (ax, ay, az) verso (bx, by, bz). */
export function miraVerso(ax: number, ay: number, az: number, bx: number, by: number, bz: number): { yaw: number; pitch: number } {
  const dx = bx - ax, dy = by - ay, dz = bz - az, o = Math.sqrt(dx * dx + dz * dz);
  return { yaw: quantizzaMira(atan2(-dx, -dz)), pitch: quantizzaMira(atan2(dy, o)) };
}

const campi = new WeakMap<SState, { cella: number; d: Int32Array }>();
/** Prossimo punto verso (x, z) lungo il campo BFS (rifatto solo quando la meta cambia cella). */
function versoMeta(s: SState, m: SMappa, x: number, z: number): { x: number; z: number } | null {
  const meta = cellOf(m, x, z);
  let c = campi.get(s);
  if (!c || c.cella !== meta) { c = { cella: meta, d: bfs(m, meta) }; campi.set(s, c); }
  const qui = cellOf(m, s.g.x, s.g.z), dopo = stepDown(m, c.d, qui);
  if (dopo < 0) return null;
  // guarda due celle avanti: il passo è più dritto
  const dopo2 = stepDown(m, c.d, dopo);
  return cellCenter(m, dopo2 >= 0 ? dopo2 : dopo);
}

/** Pilota automatico: nel poligono abbatte i bersagli uno dopo l'altro. */
export function autopilota(s: SState): SInput {
  const m = mappaSparo(), g = s.g, oy = occhi(g);
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
  if (meta < 0) return inp;
  const b = s.bot[meta]!, dist = Math.sqrt((b.x - g.x) * (b.x - g.x) + (b.z - g.z) * (b.z - g.z));
  if (inVista) {
    // tiene giù il rinculo come farebbe una persona: punta più in basso (e di lato) di quanto è salito
    const a = miraVerso(g.x, oy, g.z, b.x, collo(b) - 0.25, b.z);
    inp.yaw = quantizzaMira(a.yaw - g.rinculoLato); inp.pitch = quantizzaMira(a.pitch - g.rinculoSu);
    inp.mira = dist > 9;
    // spara quando la mira è già lì (il passo prima ha girato la testa)
    const err = Math.abs(inp.yaw - g.yaw) + Math.abs(inp.pitch - g.pitch);
    inp.fuoco = err < 1.5 * GRADI && !g.grilletto;
    if (dist > 20) inp.my = 1;
  } else {
    const p = versoMeta(s, m, b.x, b.z);
    if (p) {
      const a = miraVerso(g.x, oy, g.z, p.x, oy, p.z);
      inp.yaw = a.yaw; inp.pitch = 0; inp.my = 1;
    }
  }
  return inp;
}

export type { SOpzioni };
