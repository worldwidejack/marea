// I nemici della Missione 0 (#355, Tappa B, docs/SPARO.md §2). Calmi fanno la ronda (o, fermi, si guardano intorno) e ti vedono solo
// nel loro cono di vista (vicinissimi anche alle spalle); sentono gli spari e chi ti vede chiama i compagni vicini. In allerta si girano
// verso di te e dopo un tempo di reazione scelgono: uno ti aggira (va dove ti vede, di lato rispetto agli altri), gli altri corrono a un
// riparo (coperture.ts), ci restano accucciati qualche secondo e poi escono a sparare a raffiche. La mira parte larga e si stringe se
// ti seguono; sbagliano di più muovendosi o se corri. Se ti perdono di vista per un po' vengono a cercarti dove ti hanno visto.
import { SPARO, armaSparo } from '@marea/content/sparo.ts';
import type { SArmaDef } from '@marea/content/sparo.ts';
import { DT } from '../constants.ts';
import { bfs, cellCenter, cellOf, clearPath, isSolid, stepDown } from '../dungeon/map.ts';
import { atan2, cos, sin } from '../trig.ts';
import type { SMappa } from './mappa.ts';
import { muovi, vede } from './mappa.ts';
import { spara } from './colpi.ts';
import { puntoFianco, rotta, scarto, scegliRiparo, sbirciata } from './coperture.ts';
import type { SBot, SState } from './stato.ts';
import { GRADI, caso, collo, occhi, secTick } from './stato.ts';

const N = SPARO.nemici;
/** L'arma dei nemici: quella dell'elenco (suono, portata) col loro danno. */
export const ARMA_NEMICO: SArmaDef = { ...armaSparo(N.arma), danno: N.danno, testa: N.testa, pallini: 1 };
const COS_VISTA = cos((N.vista.angolo / 2) * GRADI), R = SPARO.giocatore.raggio;
const fra = (s: SState, r: number[]): number => r[0]! + (r[1]! - r[0]!) * caso(s);
const lung = (x: number, z: number): number => Math.sqrt(x * x + z * z);
export const calmo = (b: SBot): boolean => b.stato === 'pattuglia' || b.stato === 'fermo';

// ---------- strada: campi BFS in cache (non cambiano il risultato, solo la velocità) ----------
const campi = new WeakMap<SState, Map<number, Int32Array>>();
function campo(s: SState, m: SMappa, cella: number): Int32Array {
  let c = campi.get(s);
  if (!c) { c = new Map(); campi.set(s, c); }
  let f = c.get(cella);
  if (!f) { if (c.size > 24) c.clear(); f = bfs(m, cella); c.set(cella, f); }
  return f;
}
/** La cella libera più vicina a (x, z) (chi sta a ridosso di una scatola ha il centro in una cella «piena» della griglia allargata). */
export function libera(m: SMappa, x: number, z: number): number {
  const cx = Math.floor(x / m.tile), cz = Math.floor(z / m.tile);
  for (let r = 0; r <= 4; r++)
    for (let dz = -r; dz <= r; dz++)
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r || isSolid(m, cx + dx, cz + dz)) continue;
        return (cz + dz) * m.w + cx + dx;
      }
  return cellOf(m, x, z);
}
/** Un passo verso (tx, tz) a velocità `vel`: dritto se la strada è libera, sennò lungo il campo BFS. true = arrivato. */
function vai(s: SState, m: SMappa, b: SBot, tx: number, tz: number, vel: number): boolean {
  if (lung(tx - b.x, tz - b.z) < 0.3) { b.vx = 0; b.vz = 0; return true; }
  let px = tx, pz = tz;
  if (!clearPath(m, b.x, b.z, tx, tz, 0.1)) {
    const f = campo(s, m, libera(m, tx, tz)), n1 = stepDown(m, f, libera(m, b.x, b.z));
    if (n1 >= 0) { const n2 = stepDown(m, f, n1), c = cellCenter(m, n2 >= 0 ? n2 : n1); px = c.x; pz = c.z; }
  }
  const ex = px - b.x, ez = pz - b.z, e = lung(ex, ez) || 1;
  b.vx = (ex / e) * vel; b.vz = (ez / e) * vel;
  const p = { x: b.x, z: b.z };
  muovi(m, p, b.vx * DT, b.vz * DT, R, 0);
  b.x = p.x; b.z = p.z;
  return false;
}
const fermo = (b: SBot) => { b.vx = 0; b.vz = 0; };
function gira(b: SBot, verso: number): void {
  const d = scarto(verso, b.yaw), max = N.gira * DT;
  b.yaw += d > max ? max : d < -max ? -max : d;
}

// ---------- percezione ----------
/** Ti vede? Calmo solo nel suo cono di vista (vicinissimo anche alle spalle). Accucciato dietro una cassa non ti vede, a meno che tu
 *  non abbia appena sparato. */
function guarda(s: SState, m: SMappa, b: SBot): boolean {
  const g = s.g;
  if (g.morto) return false;
  const dx = g.x - b.x, dz = g.z - b.z, d2 = dx * dx + dz * dz;
  if (d2 > N.vista.distanza * N.vista.distanza) return false;
  const d = Math.sqrt(d2);
  if (calmo(b) && d > N.vista.vicino && dx * -sin(b.yaw) + dz * -cos(b.yaw) < COS_VISTA * d) return false;
  const ey = occhi(b), esposto = s.tick - g.ultimoSparo < secTick(0.6);
  return vede(m, b.x, ey, b.z, g.x, occhi(g) - (esposto ? 0 : 0.12), g.z) || vede(m, b.x, ey, b.z, g.x, collo(g) - 0.35, g.z);
}
/** `b` si accorge di te (o di qualcosa in ux, uz): si gira, dopo la reazione decide; chiama i compagni calmi vicini. */
function allerta(s: SState, i: number, chiama: boolean, ritardo = 0): void {
  const b = s.bot[i]!;
  b.stato = 'allerta'; b.allertaT = s.tick + secTick(fra(s, N.reazione) + ritardo); b.timer = b.allertaT; b.meta = -1; b.giu = false;
  s.ev.push({ t: 'allerta', chi: i });
  if (!chiama) return;
  for (let k = 0; k < s.bot.length; k++) {
    const o = s.bot[k]!;
    if (k === i || o.morto || o.tipo !== 'nemico' || !calmo(o) || lung(o.x - b.x, o.z - b.z) > N.chiama) continue;
    o.ux = b.ux; o.uz = b.uz; o.vistoT = s.tick;
    allerta(s, k, false, 0.3);
  }
}
/** Uno sparo (o un colpo preso) in (x, z): chi lo sente si mette in allerta e sa più o meno dove sei. */
export function senti(s: SState, x: number, z: number, raggio: number): void {
  for (let i = 0; i < s.bot.length; i++) {
    const b = s.bot[i]!;
    if (b.morto || b.tipo !== 'nemico' || lung(b.x - x, b.z - z) > raggio) continue;
    b.ux = x; b.uz = z;
    if (b.stato === 'cerca' || calmo(b)) { b.vistoT = s.tick; allerta(s, i, false, 0.15); }
  }
}

// ---------- fuoco ----------
function fuoco(s: SState, m: SMappa, b: SBot, i: number): void {
  const g = s.g;
  if (!b.vede || g.morto || s.tick < b.allertaT || s.tick < b.prossimo) return;
  if (b.raffica <= 0) b.raffica = Math.round(fra(s, N.raffica));
  const ty = caso(s) < 0.2 ? occhi(g) : collo(g) - 0.35, ey = occhi(b);
  const yaw = rotta(b.x, b.z, g.x, g.z), pitch = atan2(ty - ey, lung(g.x - b.x, g.z - b.z));
  const k = Math.min(1, (s.tick - b.tracciaT) / secTick(N.errore.secondi));
  let err = N.errore.inizio + (N.errore.fine - N.errore.inizio) * k;
  if (lung(b.vx, b.vz) > 0.5) err += N.errore.muovendo;
  if (lung(g.vx, g.vz) > 4) err += N.errore.bersaglioVeloce;
  b.yaw = yaw; b.pitch = pitch;
  spara(s, m, i, ARMA_NEMICO, b.x, ey, b.z, yaw, pitch, err * GRADI);
  b.raffica--;
  b.prossimo = s.tick + secTick(b.raffica > 0 ? N.cadenza : fra(s, N.pausa));
}

// ---------- decisione ----------
/** Dopo la reazione (o quando il piano va rifatto): aggirare, correre a un riparo o sparare da dove si è. */
function piano(s: SState, m: SMappa, b: SBot): void {
  const da = campo(s, m, libera(m, b.x, b.z));
  if (!b.fianco && !s.bot.some((o) => o.fianco && !o.morto) && s.bot.some((o) => o !== b && !o.morto && o.tipo === 'nemico' && !calmo(o))) b.fianco = true;
  if (b.fianco) {
    const f = puntoFianco(s, m, b, da);
    if (f >= 0) { b.meta = f; b.sbircia = -1; b.stato = 'aggira'; return; }
  }
  const r = scegliRiparo(s, m, b, da);
  if (r) { b.meta = r.cella; b.sbircia = sbirciata(s, m, r); b.stato = 'copertura'; b.timer = 0; b.riparoAlto = r.alto; return; }
  b.meta = -1; b.stato = 'sporge'; b.timer = s.tick + secTick(fra(s, N.copertura.fuori));
}

export function passoNemici(s: SState, m: SMappa): void {
  const g = s.g;
  for (let i = 0; i < s.bot.length; i++) {
    const b = s.bot[i]!;
    if (b.tipo !== 'nemico' || b.morto) continue;
    if ((s.tick + i) % 6 === 0) {
      const v = guarda(s, m, b);
      if (v && !b.vede) b.tracciaT = s.tick;
      b.vede = v;
      if (v) { b.vistoT = s.tick; b.ux = g.x; b.uz = g.z; if (calmo(b) || b.stato === 'cerca') allerta(s, i, true); }
    }
    const verso = rotta(b.x, b.z, b.ux, b.uz);
    // persi di vista da troppo: si va a cercare
    if (!calmo(b) && b.stato !== 'cerca' && !b.vede && s.tick - b.vistoT > secTick(N.dimentica)) { b.stato = 'cerca'; b.meta = -1; b.giu = false; b.timer = 0; }
    switch (b.stato) {
      case 'fermo': fermo(b); gira(b, b.casa.yaw + 0.7 * sin(s.tick * 0.0045 + b.id)); break;
      case 'pattuglia': {
        const giro = SPARO.mappa.nemici[b.via]?.giro ?? [], t = giro[b.tappa % Math.max(1, giro.length)];
        if (!t) { b.stato = 'fermo'; break; }
        if (vai(s, m, b, t[0]!, t[1]!, N.passo)) b.tappa = (b.tappa + 1) % giro.length;
        gira(b, rotta(b.x, b.z, t[0]!, t[1]!));
        break;
      }
      case 'allerta': fermo(b); gira(b, verso); fuoco(s, m, b, i); if (s.tick >= b.timer) piano(s, m, b); break;
      case 'copertura': {
        const c = cellCenter(m, b.meta);
        if (b.timer === 0) {
          const arrivato = vai(s, m, b, c.x, c.z, N.corsa);
          gira(b, b.vede ? verso : rotta(b.x, b.z, c.x, c.z));
          if (b.vede && lung(g.x - b.x, g.z - b.z) < 12) fuoco(s, m, b, i);
          if (arrivato) b.timer = s.tick + secTick(fra(s, N.copertura.dentro));
        } else {
          fermo(b); b.giu = !b.riparoAlto; gira(b, verso);
          if (s.tick >= b.timer) { b.stato = 'sporge'; b.giu = false; b.timer = s.tick + secTick(fra(s, N.copertura.fuori)); }
        }
        break;
      }
      case 'sporge': {
        b.giu = false;
        if (b.sbircia >= 0 && b.sbircia !== b.meta) { const c = cellCenter(m, b.sbircia); vai(s, m, b, c.x, c.z, N.passo); } else fermo(b);
        gira(b, verso); fuoco(s, m, b, i);
        if (s.tick >= b.timer) {
          if (b.meta >= 0) { b.stato = 'copertura'; b.timer = 0; } else piano(s, m, b);
        } else if (!b.vede && s.tick - b.vistoT > secTick(2)) piano(s, m, b);
        break;
      }
      case 'aggira': {
        const c = cellCenter(m, b.meta), arrivato = vai(s, m, b, c.x, c.z, N.corsa);
        gira(b, b.vede ? verso : rotta(b.x, b.z, c.x, c.z));
        fuoco(s, m, b, i);
        if (arrivato) { b.meta = -1; b.stato = 'sporge'; b.timer = s.tick + secTick(fra(s, N.copertura.fuori) * 2); }
        break;
      }
      case 'cerca': {
        if (b.timer === 0) { if (vai(s, m, b, b.ux, b.uz, N.passo)) b.timer = s.tick + secTick(N.cerca); gira(b, verso); }
        else { fermo(b); gira(b, b.yaw + 0.5); if (s.tick >= b.timer) { b.stato = b.via >= 0 && (SPARO.mappa.nemici[b.via]?.giro.length ?? 0) > 0 ? 'pattuglia' : 'fermo'; b.fianco = false; } }
        break;
      }
    }
    if (!b.vede) b.pitch *= 0.9;
  }
  separa(s);
}

/** I nemici non si sovrappongono tra loro né a te. */
function separa(s: SState): void {
  const D = 2 * R;
  for (let i = 0; i < s.bot.length; i++) {
    const a = s.bot[i]!;
    if (a.morto || a.tipo !== 'nemico') continue;
    for (let k = i + 1; k <= s.bot.length; k++) {
      const o = k < s.bot.length ? s.bot[k]! : s.g;
      if (o.morto || (k < s.bot.length && (o as SBot).tipo !== 'nemico')) continue;
      const dx = a.x - o.x, dz = a.z - o.z, d = lung(dx, dz);
      if (d >= D || d < 1e-6) continue;
      const k2 = (D - d) / d / (k < s.bot.length ? 2 : 1);
      a.x += dx * k2; a.z += dz * k2;
      if (k < s.bot.length) { o.x -= dx * k2; o.z -= dz * k2; }
    }
  }
}
