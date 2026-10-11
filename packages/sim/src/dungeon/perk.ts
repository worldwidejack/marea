// Effetti dei perk dell'albero delle abilità dentro il dungeon (docs/RPG.md §3): Taglio Critico (sanguinamento + rallentamento), Colpo fatale
// (paralisi), Automira (frecce che curvano). I numeri stanno in balance.json → perk; le probabilità e i livelli in perks.json (RunHero.perk).
// Determinismo: solo + − × ÷ e Math.sqrt, il caso viene da s.rng.
import { RPG } from '@marea/content/rpg.ts';
import { DT } from '../constants.ts';
import type { DungeonState, Enemy, Proj } from './state.ts';
import { conEroe, ev, inGioco, secToTicks } from './state.ts';
import { buff, hitEnemy } from './combat.ts';
import { moveCircle } from './map.ts';
import { alto, grigliaDi } from './muove.ts';
import { fuocoAmico } from './fuoco.ts';
import { FRECCIA_Y } from './tuning.ts';

/** Un attacco caricato a segno su `e`: tira i dadi di Taglio Critico (sanguina e rallenta) e Colpo fatale (paralizza). I boss non si
 *  paralizzano e sanguinano molto meno. */
export function statiCaricato(s: DungeonState, e: Enemy): void {
  const P = s.runHero.perk, B = RPG.perk;
  if (!P || !B || e.st === 'morto' || e.vita <= 0 || e.alleato) return;
  if (P.sanguina && s.rng.next() < P.sanguina) {
    const S = B.sanguinamento, fine = s.tick + secToTicks(S.secondi);
    e.emorr = fine; e.emorrPct = S.pctVitaAlSecondo * (e.def.boss ? S.moltBoss : 1);
    e.lentoT = fine; e.lentoMolt = 1 - S.rallenta; e.lentoAcc = 0;
    ev(s, { t: 'sanguinamento', id: e.id });
  }
  if (P.paralisi && !e.def.boss && s.rng.next() < P.paralisi) {
    e.paralisi = s.tick + secToTicks(B.paralisi.secondi);
    // la preparazione di un attacco si interrompe
    if (e.st === 'prepara' || e.st === 'colpisce') { e.st = 'insegue'; e.stT = 0; e.area = false; e.tiro = false; e.comboN = 0; }
    ev(s, { t: 'paralisi', id: e.id });
  }
}

export const paralizzato = (s: DungeonState, e: Enemy): boolean => e.paralisi !== undefined && e.paralisi > s.tick;
export const sanguinante = (s: DungeonState, e: Enemy): boolean => e.emorr !== undefined && e.emorr > s.tick;
export const rallentato = (s: DungeonState, e: Enemy): boolean => e.lentoT !== undefined && e.lentoT > s.tick;

/** Il sanguinamento del Taglio Critico di questo tick: toglie la sua parte di vita massima. true = il nemico è morto. */
export function sanguina(s: DungeonState, e: Enemy): boolean {
  if (!sanguinante(s, e)) return false;
  const d = e.max * (e.emorrPct ?? 0) * DT;
  e.vita -= d; s.danniFatti += d;
  return e.vita <= 0;
}

/** Il nemico fa il suo passo in questo tick? No se è paralizzato; rallentato salta una frazione dei tick (il tempo per lui scorre più
 *  piano, quindi anche i colpi). */
export function passoNemico(s: DungeonState, e: Enemy): boolean {
  if (e.alleato) return true;
  if (paralizzato(s, e)) return false;
  if (rallentato(s, e)) {
    const acc = (e.lentoAcc ?? 0) + (e.lentoMolt ?? 1);
    if (acc < 1) { e.lentoAcc = acc; return false; }
    e.lentoAcc = acc - 1;
  }
  return true;
}

/** Automira: la freccia dell'eroe sterza verso il nemico più vicino che ha davanti (dentro il cono del suo livello). */
export function guidaFreccia(s: DungeonState, p: Proj): void {
  const L = RPG.perk?.automira[(p.guida ?? 0) - 1];
  if (!L) return;
  const v = Math.sqrt(p.vx * p.vx + p.vz * p.vz);
  if (v < 1e-6) return;
  const hx = p.vx / v, hz = p.vz / v;
  let best: Enemy | null = null, bd = Infinity, bx = 0, bz = 0;
  for (const e of s.enemies) {
    if (e.alleato || e.st === 'morto' || p.colpiti.includes(e.id)) continue;
    const dx = e.x - p.x, dz = e.z - p.z, d = Math.sqrt(dx * dx + dz * dz);
    if (d < 0.3 || d > L.gittata || d >= bd) continue;
    if ((dx * hx + dz * hz) / d < L.cos) continue;
    best = e; bd = d; bx = dx / d; bz = dz / d;
  }
  if (!best) return;
  const nx = hx + (bx - hx) * L.k, nz = hz + (bz - hz) * L.k, l = Math.sqrt(nx * nx + nz * nz);
  if (l < 1e-6) return;
  p.vx = (nx / l) * v; p.vz = (nz / l) * v;
}

// ---------- seconda tornata (11 ott 2026) ----------
const r2 = (v: number): number => Math.round(v * 100) / 100;

/** Lame avvelenate: un colpo normale di un'arma leggera a segno avvelena (danno al secondo per qualche secondo, come un sanguinamento). */
export function veleno(s: DungeonState, e: Enemy): void {
  const p = s.runHero.perk?.veleno, V = RPG.perk?.veleno;
  if (!p || !V || e.st === 'morto' || e.vita <= 0 || e.alleato || s.hero.arma.skill !== 'armiLeggere') return;
  if (s.rng.next() >= p) return;
  e.bleed = Math.max(e.bleed, V.dps); e.bleedT = Math.max(e.bleedT, secToTicks(V.secondi));
}

/** Danno del colpo caricato in corso (senza ritmo né letale): base dei perk che ne usano una frazione. */
const dannoCaricato = (s: DungeonState): number => {
  const a = s.hero.arma;
  return a.danno * a.caricaMolt * (1 + buff(s, a.classe === 'pesante' ? 'dannoPesanti' : 'dannoLeggere'));
};

/** Lama d'aria: il caricato scaglia anche una lama dritta che trapassa (la stessa del Fendiflutti), con una frazione del danno. */
export function lamaAria(s: DungeonState): void {
  const L = RPG.perk?.lamaAria, h = s.hero;
  if (!L || !s.runHero.perk?.aria) return;
  s.proj.push({
    id: s.nextId++, tipo: 'lama', x: h.x + h.fx * 0.5, y: FRECCIA_Y - 0.3, z: h.z + h.fz * 0.5, vx: h.fx * L.velocita, vy: 0, vz: h.fz * L.velocita, g: 0,
    danno: dannoCaricato(s) * L.frazione, life: secToTicks(L.gittata / L.velocita), traits: { trapassa: true }, raggio: 0, colpiti: [], dalNemico: false,
    contundente: false, magico: false, arrowId: null, da: s.cur,
  });
}

/** Terremoto: il caricato a segno scuote il terreno: i nemici vicini prendono una frazione del danno, vengono interrotti e spinti via (i boss, le
 *  torrette e chi vola alto restano dove sono). */
export function terremoto(s: DungeonState): void {
  const T = RPG.perk?.terremoto, h = s.hero;
  if (!T || !s.runHero.perk?.terremoto) return;
  ev(s, { t: 'terremoto', x: r2(h.x), z: r2(h.z) });
  const danno = dannoCaricato(s) * T.frazione;
  for (const e of s.enemies.slice()) {
    if (e.alleato || e.st === 'morto' || alto(s, e)) continue;
    const dx = e.x - h.x, dz = e.z - h.z, d = Math.sqrt(dx * dx + dz * dz);
    if (d > T.raggio + e.def.raggio) continue;
    const ux = d > 1e-6 ? dx / d : h.fx, uz = d > 1e-6 ? dz / d : h.fz;
    hitEnemy(s, e, { danno, traits: { sbilancia: true }, magico: false, skill: h.arma.skill, caricato: true, dirX: ux, dirZ: uz, daAlleato: false, ox: h.x, oz: h.z });
    if (e.vita > 0 && !e.def.boss && e.def.comportamento !== 'torretta' && e.def.comportamento !== 'anello') moveCircle(grigliaDi(s, e), e, ux * T.spinta, uz * T.spinta, e.def.raggio);
  }
}

/** Scarica: quante frecce e quanto dura la ricarica (la Pioggia di frecce la rende di 5 frecce ogni 20 s). */
export function scaricaDi(s: DungeonState): { frecce: number; ricarica: number; ogni: number } {
  const P = RPG.perk?.scarica ?? { frecce: 3, ricarica: 30, ogni: 0.07, pioggia: { frecce: 5, ricarica: 20 } };
  const pio = s.runHero.perk?.pioggia ? P.pioggia : null;
  return { frecce: pio?.frecce ?? P.frecce, ricarica: pio?.ricarica ?? P.ricarica, ogni: P.ogni };
}

/** Medico da campo: la cura di vita della pozione bevuta arriva anche ai compagni in gioco entro il raggio. */
export function curaCompagni(s: DungeonState, vita: number): void {
  const R = RPG.perk?.medicoCampo;
  if (!R || !s.runHero.perk?.campo || vita <= 0 || s.eroi.length < 2) return;
  const h = s.hero, io = s.cur;
  for (const i of inGioco(s)) {
    if (i === io) continue;
    conEroe(s, i, () => {
      const c = s.hero, dx = c.x - h.x, dz = c.z - h.z;
      if (dx * dx + dz * dz <= R.raggio * R.raggio) c.vita = Math.min(s.runHero.max.vita, c.vita + vita);
    });
  }
}

/** Effetti di una magia d'attacco dell'eroe che ha appena colpito `e`: Combustione (fuoco lascia una chiazza che brucia) e Catena di fulmini
 *  (l'elettricità salta al nemico più vicino). */
export function effettiMagia(s: DungeonState, p: Proj, e: Enemy): void {
  const P = s.runHero.perk, B = RPG.perk;
  if (!P || !B || !p.elemento) return;
  if (p.elemento === 'fuoco' && P.combustione) fuocoAmico(s, e.x, e.z, Math.max(B.combustione.raggio, p.raggio), B.combustione.secondi, p.danno * B.combustione.frazione);
  if (p.elemento === 'elettricita' && P.catena) {
    let best: Enemy | null = null, bd = B.catena.raggio * B.catena.raggio;
    for (const o of s.enemies) {
      if (o === e || o.alleato || o.st === 'morto' || alto(s, o)) continue;
      const dx = o.x - e.x, dz = o.z - e.z, d2 = dx * dx + dz * dz;
      if (d2 < bd) { bd = d2; best = o; }
    }
    if (best) {
      ev(s, { t: 'catena', da: [r2(e.x), r2(e.z)], a: [r2(best.x), r2(best.z)] });
      hitEnemy(s, best, { danno: p.danno * B.catena.frazione, traits: {}, magico: true, skill: 'distruzione', caricato: false, dirX: 0, dirZ: 0, daAlleato: false, ox: e.x, oz: e.z });
    }
  }
}
