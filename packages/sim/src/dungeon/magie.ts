// Magie d'attacco e di supporto oltre al proiettile secco (docs/RPG.md §Magie, docs/ARENA.md): il RAGGIO continuo (Fuoco/Elettricità continua, Cura/Furia a flusso:
// tieni A, costo e danno/cura sono al secondo, davanti all'eroe per pochi metri) e la BOMBA (Bomba di fuoco/elettrica, Cura/Furia a bomba: lenta, lanciata in alto, scoppia dove atterra).
// Il fuoco brucia (sanguina), l'elettricità rallenta chi colpisce (combat.ts → rallentaNemico); Cura e Furia agiscono su alleati ed evocazioni. Determinismo: solo + − × ÷ e Math.sqrt.
// Prima persona (alzo.ts): il raggio va anche in alto e in basso, dove punta il mirino, e si ferma a pavimento e soffitto; la bomba atterra dove guardi.
import { RPG } from '@marea/content/rpg.ts';
import { ALTEZZA_EROE, OCCHI_Y, finoAlTetto, lungoRaggio, quotaNemico } from './alzo.ts';
import { DT } from '../constants.ts';
import type { RunSpell } from '../rpg/types.ts';
import type { DungeonState, Enemy, HeroRt, Proj } from './state.ts';
import { add, ev, secToTicks } from './state.ts';
import { buff, hitEnemy } from './combat.ts';
import type { HitSrc } from './combat.ts';
import { visibileDa } from './erba.ts';
import { isOpaque, lineOfSight } from './map.ts';
import { effettiMagia } from './perk.ts';
import { caricaVampa, chiazzaVampa, consumaVampa } from './unici.ts';
import { amica, colpisciEroe, compagno, eroiNelCerchio, eroiNemici, ostile, squadraDi } from './pvp.ts';
import { portataDist } from './portata.ts';
import { BOMBA_G, BOMBA_LATO, BOMBA_VUOTO, CANALE_EFFETTI, CANALE_OGNI, HZ, MAGIA_Y } from './tuning.ts';

const r2 = (v: number): number => Math.round(v * 100) / 100;

/** Magia di supporto (Cura o Furia): bersaglia alleati ed evocazioni invece dei nemici ostili. */
export const isSupporto = (sp: RunSpell): boolean => Boolean(sp.cura || sp.furia);

/** Mira assistita verso l'alleato o evocazione più vicino nel cono davanti all'eroe (o entro `fallback`). */
export function aimAlleato(s: DungeonState, range: number, cosMin: number, fallback: number, vista = true): { x: number; z: number } | null {
  const h = s.hero;
  let best: { x: number; z: number } | null = null, bd = Infinity, near: { x: number; z: number } | null = null, nd = Infinity;
  const valuta = (tx: number, tz: number, raggio: number): void => {
    const dx = tx - h.x, dz = tz - h.z, d = Math.sqrt(dx * dx + dz * dz), reach = d - raggio;
    if (vista && !lineOfSight(s.map, h.x, h.z, tx, tz)) return;
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

// ---------- Cura e Furia (abilità Supporto) ----------

type Furia = { danno: number; velocita: number; secondi: number };
/** Chi riceve Cura o Furia: un'evocazione/alleato o un eroe della squadra, con la sua vita massima. */
type Ricevente = { o: Enemy | HeroRt; max: number };
/** Un colpo di supporto: `cura` vita (già per questo colpo), `furia`, e i `secondi` di Furia che la Benedizione trasforma in vita. */
type Sostegno = { cura: number; furia: Furia | undefined; secondi: number };
const riceve = (s: DungeonState, i: number): Ricevente => ({ o: s.eroi[i]!.hero, max: s.eroi[i]!.runHero.max.vita });

/** Cura `quanto` vita a `r`: quella che arriva davvero dà xp di Supporto e, col Cuore generoso, ne torna una parte a chi lancia. */
function curaVita(s: DungeonState, r: Ricevente, quanto: number, da: [number, number], effetti: boolean): void {
  const prima = r.o.vita;
  r.o.vita = Math.min(r.max, prima + quanto);
  if (effetti) ev(s, { t: 'cura', x: r2(r.o.x), z: r2(r.o.z), da });
  const dato = r.o.vita - prima;
  if (dato <= 0) return;
  add(s.xp, 'supporto', dato * (RPG.xpDanno?.supporto ?? 1));
  const k = s.runHero.perk?.supporto?.autocura;
  if (k && r.o !== s.hero) s.hero.vita = Math.min(s.runHero.max.vita, s.hero.vita + dato * k);
}

/** Dà la Furia a `r`; con la Furia condivisa ne prendi una parte anche tu. */
function dai(s: DungeonState, r: Ricevente, F: Furia): void {
  if ('buffs' in r.o) potenziaEroe(r.o, s.tick, F); else potenziaAlleato(s, r.o, F);
  const k = s.runHero.perk?.supporto?.furiaSuTe;
  if (k && r.o !== s.hero) potenziaEroe(s.hero, s.tick, { danno: F.danno * k, velocita: F.velocita * k, secondi: F.secondi });
}

/** Un colpo di Cura e/o Furia su `r`. Benedizione: la Cura porta anche mezza Furia, la Furia cura un po'. */
function sostieni(s: DungeonState, r: Ricevente, c: Sostegno, da: [number, number], effetti: boolean): void {
  const B = s.runHero.perk?.supporto?.benedizione ? RPG.perk?.benedizione : undefined;
  if (c.cura > 0) {
    curaVita(s, r, c.cura, da, effetti);
    if (B) dai(s, r, B.furia);
  }
  if (c.furia) {
    dai(s, r, c.furia);
    if (B) curaVita(s, r, B.curaAlSecondo * c.secondi, da, effetti);
  }
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
const colpoMagia = (_s: DungeonState, sp: RunSpell, danno: number, ox: number, oz: number): HitSrc => ({
  danno, traits: sp.sanguina ? { sanguina: sp.sanguina } : {}, magico: true, skill: 'distruzione', caricato: false, dirX: 0, dirZ: 0, daAlleato: false, ox, oz,
  ...(sp.rallenta ? { rallenta: sp.rallenta } : {}),
});

// ---------- raggio continuo ----------

/** Un tick con A tenuta e un raggio in mano: costa Magicka, e ogni CANALE_OGNI tick colpisce tutti i nemici nel corridoio davanti (lungo
 *  `gittata`, largo `larghezza` per lato, fermo al primo muro). false = Magicka finita (il raggio si spegne). La direzione è già girata. */
export function canale(s: DungeonState, sp: RunSpell): boolean {
  const h = s.hero;
  const cd = h.cdMagia <= 0 ? 0 : ((h.cdMagie ??= {})[sp.id] ?? h.cdMagia);
  if (cd > 0) { h.canale = 0; return true; } // il breve riposo dopo un raggio: ancora non riparte
  const per = sp.costo * DT;
  if (h.magicka < (h.canale === 0 ? per * CANALE_OGNI : per)) { ev(s, { t: 'senzaMagicka' }); return false; }
  h.magicka -= per;
  if (h.canale === 0) {
    ev(s, { t: 'magia', id: sp.id });
    h.sovralimentata = !isSupporto(sp) && sp.elemento === 'fuoco' && !!consumaVampa(s);
  }
  h.canale++;
  if (sp.elemento) h.canaleEl = sp.elemento; else delete h.canaleEl;
  const g = sp.gittata ?? 5, A = h.alzo; // con l'alzo la lunghezza è lungo il raggio (in piano ne fa len × coseno)
  h.canaleLen = A ? Math.min(g, finoAlTetto(s, A[1]), A[0] > 1e-3 ? libera(s, h.fx, h.fz, g * A[0]) / A[0] : g) : libera(s, h.fx, h.fz, g);
  if ((h.canale - 1) % CANALE_OGNI === 0) colpiRaggio(s, sp, ((h.canale - 1) / CANALE_OGNI) % CANALE_EFFETTI === 0);
  return true;
}

/** Raggio di supporto (Cura a flusso, Furia a flusso): il primo alleato o evocazione davanti a te, o tutti quelli sulla linea col Fascio che
 *  attraversa. Arena: senza un compagno o un'evocazione davanti vanno su chi le lancia. */
function raggioSupporto(s: DungeonState, sp: RunSpell, w: number, len: number, effetti: boolean): void {
  const h = s.hero;
  const sulla: { r: Ricevente; lungo: number }[] = [];
  for (const e of s.enemies) {
    const lungo = amica(s, e) ? lungoRaggio(s, e.x, e.z, e.def.raggio, quotaNemico(s, e), len, w) : null;
    if (lungo !== null) sulla.push({ r: { o: e, max: e.max }, lungo });
  }
  for (let i = 0; i < s.eroi.length; i++) {
    if (i === s.cur || s.eroi[i]!.done || !compagno(s, i)) continue;
    const lungo = lungoRaggio(s, s.eroi[i]!.hero.x, s.eroi[i]!.hero.z, s.eroi[i]!.runHero.raggio, ALTEZZA_EROE, len, w);
    if (lungo !== null) sulla.push({ r: riceve(s, i), lungo });
  }
  sulla.sort((a, b) => a.lungo - b.lungo);
  const scelti = s.runHero.perk?.supporto?.fascio ? sulla : sulla.slice(0, 1);
  if (!scelti.length && s.pvp) scelti.push({ r: riceve(s, s.cur), lungo: 0 });
  const dtStep = CANALE_OGNI / HZ, da: [number, number] = [r2(h.x), r2(h.z)];
  for (const { r } of scelti) sostieni(s, r, { cura: (sp.cura ?? 0) * dtStep, furia: sp.furia, secondi: dtStep }, da, effetti);
  if (scelti.length && sp.furia) add(s.xp, 'supporto', sp.costo * dtStep * RPG.xp.supportoLancio); // una volta per colpo, quanti siano
}

function colpiRaggio(s: DungeonState, sp: RunSpell, effetti: boolean): void {
  const h = s.hero, V = h.sovralimentata ? s.runHero.armatura.vampa : undefined;
  const w = (sp.larghezza ?? 0.6) * (V ? V.raggioMolt : 1), len = h.canaleLen;
  if (isSupporto(sp)) { raggioSupporto(s, sp, w, len, effetti); return; }
  const danno = sp.danno * (1 + buff(s, 'dannoDistruzione')) * (V ? 1 + V.danno : 1) * (CANALE_OGNI / HZ);
  let primo: Enemy | null = null, pd = Infinity;
  for (const e of s.enemies.slice()) {
    if (!ostile(s, e)) continue;
    const lungo = lungoRaggio(s, e.x, e.z, e.def.raggio, quotaNemico(s, e), len, w);
    if (lungo === null) continue;
    hitEnemy(s, e, colpoMagia(s, sp, danno, h.x, h.z));
    if (lungo < pd) { pd = lungo; primo = e; }
  }
  // Arena: il raggio brucia anche gli avversari nel corridoio
  for (const j of eroiNemici(s)) {
    const o = s.eroi[j]!;
    if (lungoRaggio(s, o.hero.x, o.hero.z, o.runHero.raggio, ALTEZZA_EROE, len, w) === null) continue;
    colpisciEroe(s, j, colpoMagia(s, sp, danno, h.x, h.z));
  }
  const c = h.alzo ? h.alzo[0] : 1; h.canaleFin = primo && c > 1e-3 ? Math.min(len, Math.max(0, pd) / c) : undefined; // dove il raggio si vede finire
  if (effetti && primo && sp.elemento === 'fuoco') {
    if (V) chiazzaVampa(s, primo.x, primo.z); else caricaVampa(s);
  }
  // perk di elemento (Combustione, Catena di fulmini): una volta al secondo sul primo preso, con il danno di un secondo di raggio
  if (effetti && primo && (sp.elemento === 'fuoco' || sp.elemento === 'elettricita')) {
    effettiMagia(s, { elemento: sp.elemento, raggio: 0, danno: sp.danno * (1 + buff(s, 'dannoDistruzione')) }, primo);
  }
}

/** A rilasciata (o Magicka finita, o la magia è cambiata): il raggio si spegne e parte il breve riposo della magia. */
export function fermaCanale(s: DungeonState, sp?: RunSpell): void {
  const h = s.hero;
  if (h.canale > 0 && sp) {
    const cd = secToTicks(sp.ricarica);
    h.cdMagia = (h.cdMagie ??= {})[sp.id] = Math.max((h.cdMagie ??= {})[sp.id] ?? 0, cd);
  }
  h.canale = 0; h.sovralimentata = false;
}

// ---------- bomba ----------

/** Arena: la traiettoria passa sopra gli ostacoli. Se il punto di caduta (a `d` m verso (fx, fz)) è su un muro, arretra fino a terra libera. */
function sulTerreno(s: DungeonState, fx: number, fz: number, d: number): number {
  const h = s.hero, t = s.map.tile;
  while (d > 0.4 && isOpaque(s.map, Math.floor((h.x + fx * d) / t), Math.floor((h.z + fz * d) / t))) d -= t / 8;
  return Math.max(0.4, d);
}

/** A che distanza dall'eroe di turno atterra una bomba lanciata verso (fx, fz): in Arena, se chi lancia ha scelto la `portata` (portata.ts), lì
 *  (senza agganciarsi a nessuno); se no sul nemico (o alleato, se di supporto) davanti, se no nel vuoto, oltre i muri in Arena. Lo usano
 *  lanciaBomba e il client per l'ombra di mira. */
export function distanzaBomba(s: DungeonState, sp: RunSpell, fx: number, fz: number, portata = 0): number {
  const h = s.hero, max = sp.gittata ?? 9, supp = isSupporto(sp), A = h.alzo;
  if (s.pvp && portata) return sulTerreno(s, fx, fz, portataDist(portata, max));
  // prima persona: atterra dove lo sguardo tocca terra (guardando in su, in fondo alla gittata), o su chi sta davanti prima di lì
  const fin = A ? (A[1] < -1e-3 ? Math.min(max, (OCCHI_Y * A[0]) / -A[1]) : max) : max;
  let d = A ? fin : max * BOMBA_VUOTO, vicino = Infinity;
  for (const e of s.enemies) {
    if (supp ? !amica(s, e) : !ostile(s, e)) continue;
    const dx = e.x - h.x, dz = e.z - h.z, lungo = dx * fx + dz * fz;
    if (lungo < (supp ? 0.2 : 0.8) || lungo > fin + (A ? e.def.raggio : 0) || Math.abs(dx * fz - dz * fx) > BOMBA_LATO + e.def.raggio) continue;
    if (lungo < vicino) { vicino = lungo; d = lungo; }
  }
  // Arena: le bombe d'attacco puntano anche l'avversario davanti
  for (const j of eroiNemici(s)) {
    if (supp) break;
    if (!visibileDa(s, j, squadraDi(s, s.cur))) continue;
    const th = s.eroi[j]!.hero, raggio = s.eroi[j]!.runHero.raggio;
    const dx = th.x - h.x, dz = th.z - h.z, lungo = dx * fx + dz * fz;
    if (lungo < 0.8 || lungo > fin || Math.abs(dx * fz - dz * fx) > BOMBA_LATO + raggio) continue;
    if (lungo < vicino) { vicino = lungo; d = lungo; }
  }
  if (supp) {
    for (let i = 0; i < s.eroi.length; i++) {
      if (i === s.cur || s.eroi[i]!.done || !compagno(s, i)) continue;
      const th = s.eroi[i]!.hero, raggio = s.eroi[i]!.runHero.raggio;
      const dx = th.x - h.x, dz = th.z - h.z, lungo = dx * fx + dz * fz;
      if (lungo < 0.2 || lungo > fin || Math.abs(dx * fz - dz * fx) > BOMBA_LATO + raggio) continue;
      if (lungo < vicino) { vicino = lungo; d = lungo; }
    }
    if (s.pvp && vicino === Infinity) d = 0.4; // Arena: senza compagni davanti la Cura e la Furia a bomba cadono ai tuoi piedi
  }
  return s.pvp ? sulTerreno(s, fx, fz, d) : Math.min(d, libera(s, fx, fz, max));
}

/** Lancia la bomba in alto nella direzione dell'eroe: atterra sul primo nemico (o alleato, se di supporto) lungo la mira, se no a 3/4
 *  della gittata. Vola `volo` s lungo un arco (gravità BOMBA_G) e arriva a terra proprio al tick giusto. */
export function lanciaBomba(s: DungeonState, sp: RunSpell): void {
  const h = s.hero, supp = isSupporto(sp), vampa = !supp && sp.elemento === 'fuoco' ? consumaVampa(s) : null;
  if (supp) add(s.xp, 'supporto', sp.costo * RPG.xp.supportoLancio);
  const d = distanzaBomba(s, sp, h.fx, h.fz, h.portata);
  const N = Math.max(8, Math.round((sp.volo ?? 1.1) * HZ)), T = N * DT, y0 = MAGIA_Y;
  const orizz = Math.max(0, d - 0.4) / T; // parte 0,4 m davanti all'eroe
  const vy0 = (BOMBA_G * DT * DT * ((N * (N + 1)) / 2) - y0) / T; // somma dei passi (Eulero semi-implicito, come projectiles.ts) = −y0 al tick N
  s.proj.push({
    id: s.nextId++, tipo: 'magia', x: h.x + h.fx * 0.4, y: y0, z: h.z + h.fz * 0.4, vx: h.fx * orizz, vy: vy0, vz: h.fz * orizz, g: BOMBA_G,
    danno: supp ? 0 : sp.danno * (1 + buff(s, 'dannoDistruzione')) * (vampa ? 1 + vampa.danno : 1), life: N, traits: sp.sanguina ? { sanguina: sp.sanguina } : {}, raggio: sp.raggio * (vampa ? vampa.raggioMolt : 1), colpiti: [],
    dalNemico: false, contundente: false, magico: true, arrowId: null, da: s.cur, bomba: [r2(h.x + h.fx * d), r2(h.z + h.fz * d)],
    ...(sp.mole ? { mole: sp.mole } : {}), ...(sp.elemento ? { elemento: sp.elemento } : {}), ...(sp.rallenta ? { rallenta: sp.rallenta } : {}),
    ...(sp.cura ? { cura: sp.cura } : {}), ...(sp.furia ? { furia: { ...sp.furia } } : {}),
    ...(vampa ? { vampa: true as const } : {}),
  });
}

/** La bomba è a terra: scoppia, tutti i nemici nel raggio prendono il danno (o gli alleati ed evocazioni ricevono Cura / Furia). */
export function scoppio(s: DungeonState, p: Proj): void {
  ev(s, { t: 'scoppio', x: r2(p.x), z: r2(p.z), r: r2(p.raggio), ...(p.elemento ? { el: p.elemento } : {}) });
  if (p.cura || p.furia) {
    const c: Sostegno = { cura: p.cura ?? 0, furia: p.furia, secondi: p.furia?.secondi ?? 0 }, da: [number, number] = [r2(p.x), r2(p.z)];
    for (const e of s.enemies) {
      if (!amica(s, e)) continue;
      const dx = e.x - p.x, dz = e.z - p.z, r = p.raggio + e.def.raggio;
      if (dx * dx + dz * dz <= r * r) sostieni(s, { o: e, max: e.max }, c, da, true);
    }
    for (let i = 0; i < s.eroi.length; i++) {
      const tr = s.eroi[i]!;
      if (tr.done || !compagno(s, i)) continue; // in Arena l'avversario no
      const dx = tr.hero.x - p.x, dz = tr.hero.z - p.z, r = p.raggio + tr.runHero.raggio;
      if (dx * dx + dz * dz <= r * r) sostieni(s, riceve(s, i), c, da, true);
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
  if (p.vampa) chiazzaVampa(s, p.x, p.z);
  else if (primo && p.elemento === 'fuoco') caricaVampa(s);
  if (primo && (p.elemento === 'fuoco' || p.elemento === 'elettricita')) effettiMagia(s, { elemento: p.elemento, raggio: p.raggio, danno: p.danno }, primo);
}
