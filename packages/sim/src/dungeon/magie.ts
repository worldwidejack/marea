// Magie d'attacco oltre al proiettile secco (docs/RPG.md §Magie): il RAGGIO continuo (Fuoco continuo, Elettricità continua: tieni A, costo e danno sono
// al secondo, davanti all'eroe per pochi metri) e la BOMBA (Bomba di fuoco, Bomba elettrica: lenta, lanciata in alto, scoppia dove atterra).
// Il fuoco brucia (sanguina), l'elettricità rallenta chi colpisce (combat.ts → rallentaNemico). Determinismo: solo + − × ÷ e Math.sqrt.
import { DT } from '../constants.ts';
import type { RunSpell } from '../rpg/types.ts';
import type { DungeonState, Enemy, Proj } from './state.ts';
import { ev, secToTicks } from './state.ts';
import { buff, hitEnemy } from './combat.ts';
import type { HitSrc } from './combat.ts';
import { isOpaque } from './map.ts';
import { effettiMagia } from './perk.ts';
import { BOMBA_G, BOMBA_LATO, BOMBA_VUOTO, CANALE_EFFETTI, CANALE_OGNI, HZ, MAGIA_Y } from './tuning.ts';

const r2 = (v: number): number => Math.round(v * 100) / 100;

/** Quanto è libero il cammino dall'eroe lungo (ux, uz) fino a `len` m: si ferma mezzo metro prima del primo muro. */
export function libera(s: DungeonState, ux: number, uz: number, len: number): number {
  const h = s.hero;
  for (let d = 0.5; d <= len; d += 0.5) {
    if (isOpaque(s.map, Math.floor((h.x + ux * d) / s.map.tile), Math.floor((h.z + uz * d) / s.map.tile))) return Math.max(0, d - 0.5);
  }
  return len;
}

/** Un colpo di magia dell'eroe di turno: come i proiettili (magico, distruzione, bruciatura e rallentamento della magia). */
const colpoMagia = (s: DungeonState, sp: RunSpell, danno: number, ox: number, oz: number): HitSrc => ({
  danno, traits: sp.sanguina ? { sanguina: sp.sanguina } : {}, magico: true, skill: 'distruzione', caricato: false, dirX: 0, dirZ: 0, daAlleato: false, ox, oz,
  ...(sp.rallenta ? { rallenta: sp.rallenta } : {}),
});

// ---------- raggio continuo ----------

/** Un tick con A tenuta e un raggio in mano: costa Magicka, e ogni CANALE_OGNI tick colpisce tutti i nemici nel corridoio davanti (lungo
 *  `gittata`, largo `larghezza` per lato, fermo al primo muro). false = Magicka finita (il raggio si spegne). La direzione è già girata. */
export function canale(s: DungeonState, sp: RunSpell): boolean {
  const h = s.hero;
  if (h.cdMagia > 0) { h.canale = 0; return true; } // il breve riposo dopo un raggio: ancora non riparte
  const per = sp.costo * DT;
  if (h.magicka < (h.canale === 0 ? per * CANALE_OGNI : per)) { ev(s, { t: 'senzaMagicka' }); return false; }
  h.magicka -= per;
  if (h.canale === 0) ev(s, { t: 'magia', id: sp.id });
  h.canale++;
  if (sp.elemento) h.canaleEl = sp.elemento; else delete h.canaleEl;
  h.canaleLen = libera(s, h.fx, h.fz, sp.gittata ?? 5);
  if ((h.canale - 1) % CANALE_OGNI === 0) colpiRaggio(s, sp, ((h.canale - 1) / CANALE_OGNI) % CANALE_EFFETTI === 0);
  return true;
}

function colpiRaggio(s: DungeonState, sp: RunSpell, effetti: boolean): void {
  const h = s.hero, w = sp.larghezza ?? 0.6, len = h.canaleLen;
  const danno = sp.danno * (1 + buff(s, 'dannoDistruzione')) * (CANALE_OGNI / HZ);
  let primo: Enemy | null = null, pd = Infinity;
  for (const e of s.enemies.slice()) {
    if (e.alleato || e.st === 'morto') continue;
    const dx = e.x - h.x, dz = e.z - h.z, lungo = dx * h.fx + dz * h.fz;
    if (lungo < -0.2 || lungo > len + e.def.raggio) continue;
    if (Math.abs(dx * h.fz - dz * h.fx) > w + e.def.raggio) continue;
    hitEnemy(s, e, colpoMagia(s, sp, danno, h.x, h.z));
    if (lungo < pd) { pd = lungo; primo = e; }
  }
  // perk di elemento (Combustione, Catena di fulmini): una volta al secondo sul primo preso, con il danno di un secondo di raggio
  if (effetti && primo && sp.elemento) effettiMagia(s, { elemento: sp.elemento, raggio: 0, danno: sp.danno * (1 + buff(s, 'dannoDistruzione')) }, primo);
}

/** A rilasciata (o Magicka finita, o la magia è cambiata): il raggio si spegne e parte il breve riposo della magia. */
export function fermaCanale(s: DungeonState, sp?: RunSpell): void {
  const h = s.hero;
  if (h.canale > 0 && sp) h.cdMagia = Math.max(h.cdMagia, secToTicks(sp.ricarica));
  h.canale = 0;
}

// ---------- bomba ----------

/** Lancia la bomba in alto nella direzione dell'eroe: atterra sul primo nemico lungo la mira (con un po' di tolleranza di lato), se no a 3/4
 *  della gittata; un muro in mezzo la fa cadere prima. Vola `volo` s lungo un arco (gravità BOMBA_G) e arriva a terra proprio al tick giusto. */
export function lanciaBomba(s: DungeonState, sp: RunSpell): void {
  const h = s.hero, max = sp.gittata ?? 9;
  let d = max * BOMBA_VUOTO, vicino = Infinity;
  for (const e of s.enemies) {
    if (e.alleato || e.st === 'morto') continue;
    const dx = e.x - h.x, dz = e.z - h.z, lungo = dx * h.fx + dz * h.fz;
    if (lungo < 0.8 || lungo > max || Math.abs(dx * h.fz - dz * h.fx) > BOMBA_LATO + e.def.raggio) continue;
    if (lungo < vicino) { vicino = lungo; d = lungo; }
  }
  d = Math.min(d, libera(s, h.fx, h.fz, max));
  const N = Math.max(8, Math.round((sp.volo ?? 1.1) * HZ)), T = N * DT, y0 = MAGIA_Y;
  const orizz = Math.max(0, d - 0.4) / T; // parte 0,4 m davanti all'eroe
  const vy0 = (BOMBA_G * DT * DT * ((N * (N + 1)) / 2) - y0) / T; // somma dei passi (Eulero semi-implicito, come projectiles.ts) = −y0 al tick N
  s.proj.push({
    id: s.nextId++, tipo: 'magia', x: h.x + h.fx * 0.4, y: y0, z: h.z + h.fz * 0.4, vx: h.fx * orizz, vy: vy0, vz: h.fz * orizz, g: BOMBA_G,
    danno: sp.danno * (1 + buff(s, 'dannoDistruzione')), life: N, traits: sp.sanguina ? { sanguina: sp.sanguina } : {}, raggio: sp.raggio, colpiti: [],
    dalNemico: false, contundente: false, magico: true, arrowId: null, da: s.cur, bomba: [r2(h.x + h.fx * d), r2(h.z + h.fz * d)],
    ...(sp.mole ? { mole: sp.mole } : {}), ...(sp.elemento ? { elemento: sp.elemento } : {}), ...(sp.rallenta ? { rallenta: sp.rallenta } : {}),
  });
}

/** La bomba è a terra: scoppia, tutti i nemici nel raggio prendono il danno (e bruciano o rallentano). I perk di elemento lavorano sul più vicino. */
export function scoppio(s: DungeonState, p: Proj): void {
  ev(s, { t: 'scoppio', x: r2(p.x), z: r2(p.z), r: r2(p.raggio), ...(p.elemento ? { el: p.elemento } : {}) });
  let primo: Enemy | null = null, pd = Infinity;
  for (const e of s.enemies.slice()) {
    if (e.alleato || e.st === 'morto') continue;
    const dx = e.x - p.x, dz = e.z - p.z, r = p.raggio + e.def.raggio, d2 = dx * dx + dz * dz;
    if (d2 > r * r) continue;
    hitEnemy(s, e, {
      danno: p.danno, traits: p.traits, magico: true, skill: 'distruzione', caricato: false, dirX: 0, dirZ: 0, daAlleato: false, ox: p.x, oz: p.z,
      ...(p.rallenta ? { rallenta: p.rallenta } : {}),
    });
    if (d2 < pd) { pd = d2; primo = e; }
  }
  if (primo && p.elemento) effettiMagia(s, p, primo);
}
