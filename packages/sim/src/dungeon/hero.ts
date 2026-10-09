// Eroe nel dungeon: movimento (camminata, corsa a stamina), mischia normale/caricata con mira assistita, arco, magie, pozioni, uscita.
import { RPG } from '@marea/content/rpg.ts';
import type { SkillId, Traits } from '@marea/content/rpg.ts';
import type { RunWeapon } from '../rpg/types.ts';
import { DT } from '../constants.ts';
import type { DungeonInput } from './types.ts';
import type { DungeonState, Enemy } from './state.ts';
import { add, ev, newEnemy, secToTicks } from './state.ts';
import { buff, hitEnemy } from './combat.ts';
import { lineOfSight, moveCircle } from './map.ts';
import {
  BEVE_TICKS, COLPI, COS_CONO_ARCO, COS_SEMICERCHIO, FRECCIA_Y, GIRO_TEMPO, HOLD_TICKS, LANCIA_TICKS, MAGIA_GITTATA, MAGIA_Y,
  HZ, PUGNI, RAGGIO_USCITA, TENSIONE_MIN, VOLO_MAX_TICKS, ALLEATO_SEGUE,
} from './tuning.ts';
import { sweepTo, swept, swingStyle } from './swing.ts';
import { consuma } from './zaino.ts';
import { apriValvola, valvolaVicina } from './acque.ts';
import { giraTimone, timoneVicino } from './vento.ts';
import { alto } from './muove.ts';
import { caricaBarriera, eco, fineColpo, inizioColpo, molla, moltRitmo, stepUnici, stordisci } from './unici.ts';

/** Pugni quando l'arma si rompe: da RPG.pugni (balance.json), ripiego in tuning. */
export function pugni(): RunWeapon {
  const P = RPG.pugni;
  const p = P ? { danno: P.danno, tempo: 1 / P.velocita, portata: P.portata, carica: P.carica, caricaMolt: P.caricaMolt } : PUGNI;
  return { id: null, kind: 'pugni', skill: 'armiLeggere', classe: null, danno: p.danno, tempo: p.tempo, portata: p.portata, carica: p.carica, caricaMolt: p.caricaMolt, gittata: 0, traits: {} };
}

const ostili = (s: DungeonState): Enemy[] => s.enemies.filter((e) => !e.alleato && e.st !== 'morto');
export const malusDi = (s: DungeonState): number => Math.max(0, Math.min(0.95, s.runHero.armatura.malus - buff(s, 'malusArmatura')));
export function vicinoUscita(s: DungeonState): boolean {
  const dx = s.map.exit.x - s.hero.x, dz = s.map.exit.z - s.hero.z;
  return dx * dx + dz * dz <= RAGGIO_USCITA * RAGGIO_USCITA;
}

/** Mira assistita: nemico più vicino entro `range` nel cono (coseno `cosMin`) davanti, altrimenti il più vicino entro `fallback`.
 *  In mischia (`vista` false) non conta chi vola alto (Archivio): la lama non ci arriva. */
export function aim(s: DungeonState, range: number, cosMin: number, fallback: number, vista: boolean): Enemy | null {
  const h = s.hero;
  let best: Enemy | null = null, bd = Infinity, near: Enemy | null = null, nd = Infinity;
  for (const e of ostili(s)) {
    if (!vista && alto(s, e)) continue;
    const dx = e.x - h.x, dz = e.z - h.z, d = Math.sqrt(dx * dx + dz * dz), reach = d - e.def.raggio;
    if (vista && !lineOfSight(s.map, h.x, h.z, e.x, e.z)) continue;
    const dot = d > 1e-6 ? (dx * h.fx + dz * h.fz) / d : 1;
    if (reach <= range && dot >= cosMin && d < bd) { bd = d; best = e; }
    if (reach <= fallback && d < nd) { nd = d; near = e; }
  }
  return best ?? near;
}
function faceTo(s: DungeonState, e: Enemy | null): void {
  if (!e) return;
  const h = s.hero, dx = e.x - h.x, dz = e.z - h.z, d = Math.sqrt(dx * dx + dz * dz);
  if (d > 1e-6) { h.fx = dx / d; h.fz = dz / d; }
}

function startSwing(s: DungeonState, caricato: boolean): void {
  const h = s.hero, a = h.arma;
  faceTo(s, aim(s, a.portata * 1.5, COS_SEMICERCHIO, a.portata, false));
  const vel = 1 + buff(s, a.classe === 'pesante' ? 'velocitaPesanti' : 'velocitaLeggere');
  h.stile = swingStyle(a, caricato);
  h.act = 'swing'; h.actT = 0; h.actDur = secToTicks((a.tempo * (h.stile === 'giro' ? GIRO_TEMPO : 1) * (1 + malusDi(s))) / vel);
  h.caricato = caricato; h.colpiti = []; h.colpito = false; h.carica = 0;
  inizioColpo(s, caricato); // Mausoleo: lame del Fendiflutti, ritmo della Grande Lancetta
}

/** La lama spazza il suo arco (swing.ts): colpisce, una volta per swing, ogni nemico in portata appena la lama gli passa sopra. A fine
 *  arco, se ha colpito qualcuno, l'arma fragile si consuma. */
function sweepSwing(s: DungeonState): void {
  const h = s.hero, a = h.arma, rh = s.runHero;
  const k = swept(h.stile, h.actT / h.actDur), fatto = k * COLPI[h.stile].arco;
  if (k > 0) {
    const mod = a.classe === 'pesante' ? 'dannoPesanti' : 'dannoLeggere';
    const danno = a.danno * (h.caricato ? a.caricaMolt : 1) * (1 + buff(s, mod)) * moltRitmo(s);
    for (const e of ostili(s)) {
      if (h.colpiti.includes(e.id) || alto(s, e)) continue; // chi vola alto: la lama gli passa sotto
      const dx = e.x - h.x, dz = e.z - h.z, d = Math.sqrt(dx * dx + dz * dz);
      if (d > a.portata + e.def.raggio) continue;
      if (sweepTo(h.stile, h.fx, h.fz, dx, dz, e.def.raggio, d <= e.def.raggio + rh.raggio) > fatto) continue;
      h.colpiti.push(e.id);
      // spinta e direzione del colpo: dove va la lama (nel giro, via dall'eroe)
      const dirX = h.stile === 'giro' && d > 1e-6 ? dx / d : h.fx, dirZ = h.stile === 'giro' && d > 1e-6 ? dz / d : h.fz;
      const preso = hitEnemy(s, e, { danno, traits: a.traits, magico: false, skill: a.skill as SkillId, caricato: h.caricato, dirX, dirZ, daAlleato: false, ox: h.x, oz: h.z, mischia: true });
      // Mausoleo: il Rintocco stordisce, l'Eco della Marea fa l'onda attorno a chi hai preso
      if (preso > 0) { stordisci(s, e); if (rh.eco) eco(s, e, danno); }
    }
  }
  if (k < 1) return;
  h.colpito = true;
  const fragile = a.traits.fragile ?? 0;
  if (h.colpiti.length > 0 && fragile > 0 && a.id) {
    h.colpiFragile++;
    s.usura[a.id] = h.colpiFragile;
    if (h.colpiFragile >= fragile) {
      ev(s, { t: 'rotto', item: a.id });
      consuma(s, a.id, s.rotti);
      s.usura[a.id] = 0; // la copia successiva è nuova
      h.arma = pugni();
    }
  }
}

/** Tratti di arco + frecce: bonus moltiplicati (l'arco benedetto moltiplica quelli delle frecce), il resto unito. */
export function mergeTraits(arco: Traits, fr: Traits): Traits {
  const out: Traits = {};
  const kinds = new Set([...Object.keys(arco.bonusVs ?? {}), ...Object.keys(fr.bonusVs ?? {})].sort());
  if (kinds.size) {
    out.bonusVs = {};
    for (const k of kinds) {
      const kk = k as keyof NonNullable<Traits['bonusVs']>;
      const fb = fr.bonusVs?.[kk] ?? 1, ab = arco.bonusVs?.[kk] ?? 1;
      out.bonusVs[kk] = ab * (fb > 1 ? fb * (arco.moltArgento ?? 1) : fb);
    }
  }
  const pen = Math.max(arco.penetra ?? 0, fr.penetra ?? 0); if (pen) out.penetra = pen;
  const sang = (arco.sanguina ?? 0) + (fr.sanguina ?? 0); if (sang) out.sanguina = sang;
  if (arco.sbilancia || fr.sbilancia) out.sbilancia = true;
  if (arco.trapassa || fr.trapassa) out.trapassa = true;
  if (arco.dropRaro || fr.dropRaro) out.dropRaro = true;
  if (arco.noGravita || fr.noGravita) out.noGravita = true;
  const mc = Math.max(arco.moneteColpo ?? 0, fr.moneteColpo ?? 0); if (mc) out.moneteColpo = mc;
  const dm = (arco.dropMolt ?? 1) * (fr.dropMolt ?? 1); if (dm !== 1) out.dropMolt = dm;
  return out;
}

function shoot(s: DungeonState): void {
  const h = s.hero, a = h.arma, fr = s.runHero.frecce;
  const t = Math.max(TENSIONE_MIN, h.carica);
  h.act = 'tira'; h.actT = 0; h.actDur = LANCIA_TICKS; h.carica = 0;
  if (!fr || h.frecce <= 0) return;
  const v = (a.gittata + fr.gittata) * t;
  faceTo(s, aim(s, MAGIA_GITTATA * 2, COS_CONO_ARCO, 0, true));
  const traits = mergeTraits(a.traits, fr.traits);
  h.frecce--;
  consuma(s, fr.id, s.usati);
  s.proj.push({
    id: s.nextId++, tipo: 'freccia', x: h.x + h.fx * 0.4, y: FRECCIA_Y, z: h.z + h.fz * 0.4, vx: h.fx * v, vy: 0, vz: h.fz * v,
    g: traits.noGravita ? 0 : fr.gravita * (a.traits.carillon?.gravita ?? 1), danno: (a.danno + fr.danno) * t * (1 + buff(s, 'dannoArco')), life: VOLO_MAX_TICKS,
    traits, raggio: 0, colpiti: [], dalNemico: false, contundente: !!traits.sbilancia, magico: false, arrowId: fr.id, da: s.cur,
  });
}

function cast(s: DungeonState): void {
  const h = s.hero, rh = s.runHero;
  const sp = rh.magia !== null ? rh.magie[rh.magia] : undefined;
  if (!sp || h.cdMagia > 0) return;
  if (h.magicka < sp.costo) { ev(s, { t: 'senzaMagicka' }); return; }
  h.magicka -= sp.costo;
  h.cdMagia = secToTicks(sp.ricarica);
  h.act = 'lancia'; h.actT = 0; h.actDur = LANCIA_TICKS;
  ev(s, { t: 'magia', id: sp.id });
  if (sp.scuola === 'evocazione' && sp.evoca) {
    // un'evocazione alla volta (per eroe): la vecchia sparisce
    for (const e of s.enemies) if (e.alleato && e.st !== 'morto' && (e.padrone ?? 0) === s.cur) { e.st = 'morto'; ev(s, { t: 'morte', id: e.id, tipo: e.tipo }); }
    const e = newEnemy(s, sp.evoca, h.x, h.z, true);
    if (s.eroi.length > 1) e.padrone = s.cur;
    moveCircle(s.map, e, h.fx * ALLEATO_SEGUE * 0.5, h.fz * ALLEATO_SEGUE * 0.5, e.def.raggio);
    e.fx = h.fx; e.fz = h.fz; e.aggro = true; e.st = 'insegue';
    e.scade = s.tick + secToTicks(sp.durata);
    ev(s, { t: 'evocato', id: e.id, tipo: e.tipo });
    add(s.xp, 'evocazione', sp.costo * (RPG.xp.evocazioneLancio ?? 0));
    return;
  }
  faceTo(s, aim(s, MAGIA_GITTATA, COS_CONO_ARCO, 0, true));
  const v = sp.velocita;
  s.proj.push({
    id: s.nextId++, tipo: 'magia', x: h.x + h.fx * 0.4, y: MAGIA_Y, z: h.z + h.fz * 0.4, vx: h.fx * v, vy: 0, vz: h.fz * v, g: 0,
    danno: sp.danno * (1 + buff(s, 'dannoDistruzione')), life: Math.max(1, Math.round((MAGIA_GITTATA / Math.max(1, v)) * HZ)),
    traits: sp.sanguina ? { sanguina: sp.sanguina } : {}, raggio: sp.raggio, colpiti: [], dalNemico: false, contundente: false, magico: true, arrowId: null, da: s.cur,
  });
}

function drink(s: DungeonState): void {
  const h = s.hero, rh = s.runHero;
  const p = rh.pozione !== null ? rh.pozioni[rh.pozione] : undefined;
  if (!p || h.pozioni <= 0) return;
  h.pozioni--;
  consuma(s, p.id, s.usati);
  if (p.cura.vita) h.vita = Math.min(rh.max.vita, h.vita + p.cura.vita);
  if (p.cura.magicka) h.magicka = Math.min(rh.max.magicka, h.magicka + p.cura.magicka);
  if (p.cura.stamina) h.stamina = Math.min(rh.max.stamina, h.stamina + p.cura.stamina);
  if (p.buff) h.buffs.push({ mod: p.buff.mod, valore: p.buff.valore, fine: s.tick + secToTicks(p.buff.secondi) });
  h.act = 'beve'; h.actT = 0; h.actDur = BEVE_TICKS;
  ev(s, { t: 'pozione', id: p.id });
}

export function stepHero(s: DungeonState, inp: DungeonInput): void {
  const h = s.hero, rh = s.runHero, a = h.arma;
  if (h.hurt > 0) h.hurt--;
  if (h.protetto > 0) h.protetto--;
  if (h.cdMagia > 0) h.cdMagia--;
  if (h.buffs.length) h.buffs = h.buffs.filter((b) => b.fine > s.tick);
  if (h.lento > 0) h.lento--;
  let aDown = inp.a && !h.prevA;
  const cDown = inp.c && !h.prevC, dDown = inp.d && !h.prevD;
  h.prevA = inp.a; h.prevC = inp.c; h.prevD = inp.d;
  // uscita: A sulla scala vince su tutto
  if (aDown && vicinoUscita(s)) { s.done = true; s.outcome = 'uscito'; ev(s, { t: 'uscita' }); return; }
  // Drenaggio: A accanto a una valvola chiusa la gira (e non attacca)
  if (aDown && s.map.valvole.length) { const v = valvolaVicina(s); if (v >= 0) { apriValvola(s, v); aDown = false; } }
  // Archivio: A accanto al timone di una corrente la ferma (e non attacca)
  if (aDown && s.map.timoni.length) { const t = timoneVicino(s); if (t >= 0) { giraTimone(s, t); aDown = false; } }
  // Mausoleo: il tic della Grande Lancetta, le molle dell'Arco Carillon
  stepUnici(s);
  // azioni
  h.actT++;
  switch (h.act) {
    case 'idle':
      h.actT = 0;
      if (aDown) {
        if (a.kind === 'arco') {
          if (!rh.frecce || h.frecce <= 0) ev(s, { t: 'senzaFrecce' });
          else if (a.traits.carillon) { if (!molla(s)) { h.carica = 1; shoot(s); } } // Arco Carillon: niente tensione, colpo pieno subito
          else { h.act = 'tende'; h.actT = 0; h.actDur = secToTicks(a.tempo * (1 + malusDi(s)) / (1 + buff(s, 'tensioneArco'))); h.carica = 0; }
        } else { h.act = 'press'; h.actT = 0; }
      } else if (cDown) cast(s);
      else if (dDown) drink(s);
      break;
    case 'press':
      if (!inp.a) startSwing(s, false);
      else if (h.actT >= HOLD_TICKS) { h.act = 'carica'; h.actT = 0; h.actDur = secToTicks(a.carica * (1 + malusDi(s)) / (1 + buff(s, 'caricaVeloce'))); h.carica = 0; }
      break;
    case 'carica':
      h.carica = Math.min(1, h.actT / h.actDur);
      if (!inp.a) startSwing(s, h.carica >= 1);
      break;
    case 'swing':
      if (!h.colpito) sweepSwing(s);
      if (h.actT >= h.actDur) { h.act = 'idle'; h.actT = 0; fineColpo(s); }
      break;
    case 'tende': {
      h.carica = Math.min(1, h.actT / h.actDur);
      const st = a.traits.staminaTeso ?? 0;
      if (st > 0) h.stamina = Math.max(0, h.stamina - st * DT);
      if (!inp.a || (st > 0 && h.stamina <= 0)) shoot(s);
      break;
    }
    default: // tira, lancia, beve
      if (h.actT >= h.actDur) { h.act = 'idle'; h.actT = 0; }
  }
  // movimento
  let mx = inp.mx, my = inp.my;
  const mag = Math.sqrt(mx * mx + my * my);
  if (mag > 1) { mx /= mag; my /= mag; }
  const m = Math.min(1, mag);
  h.moving = m > 0.1;
  const lento = h.act !== 'idle' && h.act !== 'tira' && h.act !== 'lancia';
  h.running = h.moving && inp.b && !lento && h.stamina > 0;
  let v = h.running ? rh.corsa * (1 + buff(s, 'velocitaCorsa')) : rh.camminata;
  if (h.running) h.stamina = Math.max(0, h.stamina - rh.staminaCorsa * DT);
  if (lento) v *= rh.mentreCarichi;
  if (h.lento > 0) v *= h.lentoMolt; // Tubo-strisciante
  v *= (1 - malusDi(s)) * rh.armatura.velocitaMolt;
  if (h.moving) {
    moveCircle(s.map, h, mx * v * DT, my * v * DT, rh.raggio);
    if (h.act !== 'swing' && h.act !== 'tira' && h.act !== 'lancia') { h.fx = mx / mag; h.fz = my / mag; }
  }
  caricaBarriera(s); // Mausoleo: l'Armatura del Moto Perpetuo si carica camminando
  // i nemici sono solidi: l'eroe non li attraversa
  for (const e of s.enemies) {
    if (e.st === 'morto' || e.alleato || e.def.muove === 'vola') continue; // chi vola passa sopra
    const dx = h.x - e.x, dz = h.z - e.z, d2 = dx * dx + dz * dz, rr = rh.raggio + e.def.raggio;
    if (d2 >= rr * rr || d2 < 1e-12) continue;
    const d = Math.sqrt(d2), k = (rr - d) / d;
    moveCircle(s.map, h, dx * k, dz * k, rh.raggio);
  }
  // rigenerazione (la stamina non torna mentre corri o tendi un arco che la consuma)
  h.vita = Math.min(rh.max.vita, h.vita + (rh.regen.vita + buff(s, 'regenVita')) * DT);
  h.magicka = Math.min(rh.max.magicka, h.magicka + (rh.regen.magicka + buff(s, 'regenMagicka')) * DT);
  if (!h.running && !(h.act === 'tende' && (a.traits.staminaTeso ?? 0) > 0)) h.stamina = Math.min(rh.max.stamina, h.stamina + (rh.regen.stamina + buff(s, 'regenStamina')) * DT);
}
