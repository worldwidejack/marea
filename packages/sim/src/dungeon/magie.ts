// Magie d'attacco e di supporto oltre al proiettile secco (docs/RPG.md §Magie, docs/ARENA.md): il RAGGIO continuo (Fuoco/Elettricità continua, Cura/Furia a flusso:
// tieni A, costo e danno/cura sono al secondo, davanti all'eroe per pochi metri) e la BOMBA (Bomba di fuoco/elettrica, Cura/Furia a bomba: lenta, lanciata in alto, scoppia dove atterra).
// Il fuoco brucia (sanguina), l'elettricità rallenta chi colpisce (combat.ts → rallentaNemico); Cura e Furia agiscono su alleati ed evocazioni. Determinismo: solo + − × ÷ e Math.sqrt.
import { RPG } from '@marea/content/rpg.ts';
import { DT } from '../constants.ts';
import type { RunSpell } from '../rpg/types.ts';
import type { DungeonState, Enemy, HeroRt, Proj } from './state.ts';
import { add, ev, secToTicks } from './state.ts';
import { buff, hitEnemy } from './combat.ts';
import type { HitSrc } from './combat.ts';
import { isOpaque, lineOfSight } from './map.ts';
import { effettiMagia } from './perk.ts';
import { amica, colpisciEroe, compagno, eroiNelCerchio, eroiNemici, ostile } from './pvp.ts';
import { BOMBA_G, BOMBA_LATO, BOMBA_VUOTO, CANALE_EFFETTI, CANALE_OGNI, HZ, MAGIA_Y } from './tuning.ts';

const r2 = (v: number): number => Math.round(v * 100) / 100;

/** Magia di supporto (Cura o Furia): bersaglia alleati ed evocazioni invece dei nemici ostili. */
export const isSupporto = (sp: RunSpell): boolean => Boolean(sp.cura || sp.furia);

/** Mira assistita verso l'alleato o evocazione più vicino nel cono davanti all'eroe (o entro `fallback`). */
export function aimAlleato(s: DungeonState, range: number, cosMin: number, fallback: number): { x: number; z: number } | null {
  const h = s.hero;
  let best: { x: number; z: number } | null = null, bd = Infinity, near: { x: number; z: number } | null = null, nd = Infinity;
  const valuta = (tx: number, tz: number, raggio: number): void => {
    const dx = tx - h.x, dz = tz - h.z, d = Math.sqrt(dx * dx + dz * dz), reach = d - raggio;
    if (!lineOfSight(s.map, h.x, h.z, tx, tz)) return;
    const dot = d > 1e-6 ? (dx * h.fx + dz * h.fz) / d : 1;
    if (reach <= range && dot >= cosMin && d < bd) { bd = d; best = { x: tx, z: tz }; }
    if (reach <= fallback && d < nd) { nd = d; near = { x: tx, z: tz }; }
  };
  for (const e of s.enemies) if (amica(s, e)) valuta(e.x, e.z, e.def.raggio);
  for (let i = 0; i < s.eroi.length; i++) {
    if (i === s.cur || s.eroi[i]!.done || !compagno(s, i)) continue; // in Arena solo la propria squadra
    valuta(s.eroi[i]!.hero.x, s.eroi[i]!.hero.z, s.eroi[i]!.runHero.raggio);
  }
  return best ?? near;
}

/** Applica il potenziamento Furia a un'evocazione/alleato (`Enemy` con `alleato: true`). */
export function potenziaAlleato(s: DungeonState, e: Enemy, F: { danno: number; velocita: number; secondi: number }): void {
  const attivo = e.potT !== undefined && e.potT > s.tick;
  const dm = F.danno < 1 ? r2(1 + F.danno) : F.danno;
  const vm = F.velocita < 1 ? r2(1 + F.velocita) : F.velocita;
  e.potT = Math.max(e.potT ?? 0, s.tick + secToTicks(F.secondi));
  e.potM = Math.max(attivo ? e.potM ?? 1 : 1, dm);
  e.potV = Math.max(attivo ? e.potV ?? 1 : 1, vm);
}

/** Applica il potenziamento Furia a un eroe alleato (rinnova la durata senza sommare all'infinito). */
export function potenziaEroe(h: HeroRt, tick: number, F: { danno: number; velocita: number; secondi: number }): void {
  const fine = tick + secToTicks(F.secondi);
  const up = (mod: string, val: number): void => {
    const cur = h.buffs.find((b) => b.mod === mod && b.fine > tick);
    if (cur) { cur.valore = Math.max(cur.valore, val); cur.fine = Math.max(cur.fine, fine); }
    else h.buffs.push({ mod, valore: val, fine });
  };
  up('furiaDanno', F.danno < 1 ? F.danno : r2(F.danno - 1));
  up('furiaVel', F.velocita < 1 ? F.velocita : r2(F.velocita - 1));
}

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
  if (isSupporto(sp)) {
    // Raggio di supporto (Cura a flusso, Furia a flusso): concentrato su un singolo bersaglio alleato o evocazione davanti a te
    let bestE: Enemy | null = null, bestH = -1, bd = Infinity;
    for (const e of s.enemies) {
      if (!amica(s, e)) continue;
      const dx = e.x - h.x, dz = e.z - h.z, lungo = dx * h.fx + dz * h.fz;
      if (lungo < -0.2 || lungo > len + e.def.raggio || Math.abs(dx * h.fz - dz * h.fx) > w + e.def.raggio) continue;
      if (lungo < bd) { bd = lungo; bestE = e; bestH = -1; }
    }
    for (let i = 0; i < s.eroi.length; i++) {
      if (i === s.cur || s.eroi[i]!.done || !compagno(s, i)) continue;
      const th = s.eroi[i]!.hero, raggio = s.eroi[i]!.runHero.raggio;
      const dx = th.x - h.x, dz = th.z - h.z, lungo = dx * h.fx + dz * h.fz;
      if (lungo < -0.2 || lungo > len + raggio || Math.abs(dx * h.fz - dz * h.fx) > w + raggio) continue;
      if (lungo < bd) { bd = lungo; bestE = null; bestH = i; }
    }
    // Arena: senza un compagno o un'evocazione davanti, Cura e Furia a flusso vanno su chi le lancia
    if (!bestE && bestH < 0 && s.pvp) bestH = s.cur;
    const dtStep = CANALE_OGNI / HZ;
    if (bestE) {
      if (sp.cura) {
        const prima = bestE.vita;
        bestE.vita = Math.min(bestE.max, bestE.vita + sp.cura * dtStep);
        if (bestE.vita > prima) add(s.xp, 'evocazione', (bestE.vita - prima) * (RPG.xpDanno?.evocazione ?? 1));
        if (effetti) ev(s, { t: 'cura', x: r2(bestE.x), z: r2(bestE.z), da: [r2(h.x), r2(h.z)] });
      }
      if (sp.furia) {
        potenziaAlleato(s, bestE, sp.furia);
        add(s.xp, 'evocazione', sp.costo * dtStep * (RPG.xp.evocazioneLancio ?? 0));
      }
    } else if (bestH >= 0) {
      const tr = s.eroi[bestH]!;
      if (sp.cura) {
        const prima = tr.hero.vita;
        tr.hero.vita = Math.min(tr.runHero.max.vita, tr.hero.vita + sp.cura * dtStep);
        if (tr.hero.vita > prima) add(s.xp, 'evocazione', (tr.hero.vita - prima) * (RPG.xpDanno?.evocazione ?? 1));
        if (effetti) ev(s, { t: 'cura', x: r2(tr.hero.x), z: r2(tr.hero.z), da: [r2(h.x), r2(h.z)] });
      }
      if (sp.furia) {
        potenziaEroe(tr.hero, s.tick, sp.furia);
        add(s.xp, 'evocazione', sp.costo * dtStep * (RPG.xp.evocazioneLancio ?? 0));
      }
    }
    return;
  }
  const danno = sp.danno * (1 + buff(s, 'dannoDistruzione')) * (CANALE_OGNI / HZ);
  let primo: Enemy | null = null, pd = Infinity;
  for (const e of s.enemies.slice()) {
    if (!ostile(s, e)) continue;
    const dx = e.x - h.x, dz = e.z - h.z, lungo = dx * h.fx + dz * h.fz;
    if (lungo < -0.2 || lungo > len + e.def.raggio) continue;
    if (Math.abs(dx * h.fz - dz * h.fx) > w + e.def.raggio) continue;
    hitEnemy(s, e, colpoMagia(s, sp, danno, h.x, h.z));
    if (lungo < pd) { pd = lungo; primo = e; }
  }
  // Arena: il raggio brucia anche gli avversari nel corridoio
  for (const j of eroiNemici(s)) {
    const o = s.eroi[j]!, r = o.runHero.raggio, dx = o.hero.x - h.x, dz = o.hero.z - h.z, lungo = dx * h.fx + dz * h.fz;
    if (lungo < -0.2 || lungo > len + r || Math.abs(dx * h.fz - dz * h.fx) > w + r) continue;
    colpisciEroe(s, j, colpoMagia(s, sp, danno, h.x, h.z));
  }
  // perk di elemento (Combustione, Catena di fulmini): una volta al secondo sul primo preso, con il danno di un secondo di raggio
  if (effetti && primo && (sp.elemento === 'fuoco' || sp.elemento === 'elettricita')) {
    effettiMagia(s, { elemento: sp.elemento, raggio: 0, danno: sp.danno * (1 + buff(s, 'dannoDistruzione')) }, primo);
  }
}

/** A rilasciata (o Magicka finita, o la magia è cambiata): il raggio si spegne e parte il breve riposo della magia. */
export function fermaCanale(s: DungeonState, sp?: RunSpell): void {
  const h = s.hero;
  if (h.canale > 0 && sp) h.cdMagia = Math.max(h.cdMagia, secToTicks(sp.ricarica));
  h.canale = 0;
}

// ---------- bomba ----------

/** Lancia la bomba in alto nella direzione dell'eroe: atterra sul primo nemico (o alleato, se di supporto) lungo la mira, se no a 3/4
 *  della gittata; un muro in mezzo la fa cadere prima. Vola `volo` s lungo un arco (gravità BOMBA_G) e arriva a terra proprio al tick giusto. */
export function lanciaBomba(s: DungeonState, sp: RunSpell): void {
  const h = s.hero, max = sp.gittata ?? 9, supp = isSupporto(sp);
  let d = max * BOMBA_VUOTO, vicino = Infinity;
  for (const e of s.enemies) {
    if (supp ? !amica(s, e) : !ostile(s, e)) continue;
    const dx = e.x - h.x, dz = e.z - h.z, lungo = dx * h.fx + dz * h.fz;
    if (lungo < (supp ? 0.2 : 0.8) || lungo > max || Math.abs(dx * h.fz - dz * h.fx) > BOMBA_LATO + e.def.raggio) continue;
    if (lungo < vicino) { vicino = lungo; d = lungo; }
  }
  // Arena: le bombe d'attacco puntano anche l'avversario davanti
  for (const j of eroiNemici(s)) {
    if (supp) break;
    const th = s.eroi[j]!.hero, raggio = s.eroi[j]!.runHero.raggio;
    const dx = th.x - h.x, dz = th.z - h.z, lungo = dx * h.fx + dz * h.fz;
    if (lungo < 0.8 || lungo > max || Math.abs(dx * h.fz - dz * h.fx) > BOMBA_LATO + raggio) continue;
    if (lungo < vicino) { vicino = lungo; d = lungo; }
  }
  if (supp) {
    for (let i = 0; i < s.eroi.length; i++) {
      if (i === s.cur || s.eroi[i]!.done || !compagno(s, i)) continue;
      const th = s.eroi[i]!.hero, raggio = s.eroi[i]!.runHero.raggio;
      const dx = th.x - h.x, dz = th.z - h.z, lungo = dx * h.fx + dz * h.fz;
      if (lungo < 0.2 || lungo > max || Math.abs(dx * h.fz - dz * h.fx) > BOMBA_LATO + raggio) continue;
      if (lungo < vicino) { vicino = lungo; d = lungo; }
    }
    add(s.xp, 'evocazione', sp.costo * (RPG.xp.evocazioneLancio ?? 0));
    if (s.pvp && vicino === Infinity) d = 0.4; // Arena: senza compagni davanti la Cura e la Furia a bomba cadono ai tuoi piedi
  }
  d = Math.min(d, libera(s, h.fx, h.fz, max));
  const N = Math.max(8, Math.round((sp.volo ?? 1.1) * HZ)), T = N * DT, y0 = MAGIA_Y;
  const orizz = Math.max(0, d - 0.4) / T; // parte 0,4 m davanti all'eroe
  const vy0 = (BOMBA_G * DT * DT * ((N * (N + 1)) / 2) - y0) / T; // somma dei passi (Eulero semi-implicito, come projectiles.ts) = −y0 al tick N
  s.proj.push({
    id: s.nextId++, tipo: 'magia', x: h.x + h.fx * 0.4, y: y0, z: h.z + h.fz * 0.4, vx: h.fx * orizz, vy: vy0, vz: h.fz * orizz, g: BOMBA_G,
    danno: supp ? 0 : sp.danno * (1 + buff(s, 'dannoDistruzione')), life: N, traits: sp.sanguina ? { sanguina: sp.sanguina } : {}, raggio: sp.raggio, colpiti: [],
    dalNemico: false, contundente: false, magico: true, arrowId: null, da: s.cur, bomba: [r2(h.x + h.fx * d), r2(h.z + h.fz * d)],
    ...(sp.mole ? { mole: sp.mole } : {}), ...(sp.elemento ? { elemento: sp.elemento } : {}), ...(sp.rallenta ? { rallenta: sp.rallenta } : {}),
    ...(sp.cura ? { cura: sp.cura } : {}), ...(sp.furia ? { furia: { ...sp.furia } } : {}),
  });
}

/** La bomba è a terra: scoppia, tutti i nemici nel raggio prendono il danno (o gli alleati ed evocazioni ricevono Cura / Furia). */
export function scoppio(s: DungeonState, p: Proj): void {
  ev(s, { t: 'scoppio', x: r2(p.x), z: r2(p.z), r: r2(p.raggio), ...(p.elemento ? { el: p.elemento } : {}) });
  if (p.cura || p.furia) {
    for (const e of s.enemies) {
      if (!amica(s, e)) continue;
      const dx = e.x - p.x, dz = e.z - p.z, r = p.raggio + e.def.raggio;
      if (dx * dx + dz * dz > r * r) continue;
      if (p.cura) {
        const prima = e.vita;
        e.vita = Math.min(e.max, e.vita + p.cura);
        if (e.vita > prima) add(s.xp, 'evocazione', (e.vita - prima) * (RPG.xpDanno?.evocazione ?? 1));
        ev(s, { t: 'cura', x: r2(e.x), z: r2(e.z), da: [r2(p.x), r2(p.z)] });
      }
      if (p.furia) potenziaAlleato(s, e, p.furia);
    }
    for (let i = 0; i < s.eroi.length; i++) {
      const tr = s.eroi[i]!;
      if (tr.done || !compagno(s, i)) continue; // in Arena l'avversario no
      const dx = tr.hero.x - p.x, dz = tr.hero.z - p.z, r = p.raggio + tr.runHero.raggio;
      if (dx * dx + dz * dz > r * r) continue;
      if (p.cura) {
        const prima = tr.hero.vita;
        tr.hero.vita = Math.min(tr.runHero.max.vita, tr.hero.vita + p.cura);
        if (tr.hero.vita > prima) add(s.xp, 'evocazione', (tr.hero.vita - prima) * (RPG.xpDanno?.evocazione ?? 1));
        ev(s, { t: 'cura', x: r2(tr.hero.x), z: r2(tr.hero.z), da: [r2(p.x), r2(p.z)] });
      }
      if (p.furia) potenziaEroe(tr.hero, s.tick, p.furia);
    }
    return;
  }
  let primo: Enemy | null = null, pd = Infinity;
  const src = { danno: p.danno, traits: p.traits, magico: true, skill: 'distruzione' as const, caricato: false, dirX: 0, dirZ: 0, daAlleato: false, ox: p.x, oz: p.z, ...(p.rallenta ? { rallenta: p.rallenta } : {}) };
  for (const e of s.enemies.slice()) {
    if (!ostile(s, e)) continue;
    const dx = e.x - p.x, dz = e.z - p.z, r = p.raggio + e.def.raggio, d2 = dx * dx + dz * dz;
    if (d2 > r * r) continue;
    hitEnemy(s, e, src);
    if (d2 < pd) { pd = d2; primo = e; }
  }
  for (const j of eroiNelCerchio(s, p.x, p.z, p.raggio)) colpisciEroe(s, j, src); // Arena: anche gli avversari nel cerchio
  if (primo && (p.elemento === 'fuoco' || p.elemento === 'elettricita')) effettiMagia(s, { elemento: p.elemento, raggio: p.raggio, danno: p.danno }, primo);
}
