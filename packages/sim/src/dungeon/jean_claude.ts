// Il capo del Tempio della «Doppia Nera»: Jean-Claude «Valanga», il Guru del Fuoripista (docs/BAITA.md). Due fasi, ognuna gira il suo ciclo di attacchi con una pausa
// dopo ognuno (il momento per colpirlo). Ogni attacco si vede prima: cono davanti a lui (frenata), quadrato a terra che ti segue e si blocca (salto), X davanti
// a lui (lamina), linea gialla tra le bandierine e cerchi di gelo (slalom). Le finestre di punizione (bilico, protesta all'arbitro) le dà `colpoBaita`.
import type { ClaudeDef } from '@marea/content/rpg.ts';
import type { DungeonState, Enemy } from './state.ts';
import { ev, secToTicks } from './state.ts';
import { hitHero } from './combat.ts';
import { isSolid, lineOfSight } from './map.ts';
import { moveToward, setState } from './passi.ts';
import { spingi } from './vento.ts';

const r2 = (v: number): number => Math.round(v * 100) / 100;
const dist = (ax: number, az: number, bx: number, bz: number): number => Math.sqrt((ax - bx) * (ax - bx) + (az - bz) * (az - bz));
type Atk = ClaudeDef['cicli'][number][number];

/** La stanza del capo: da dove sta, fino al primo muro nelle quattro direzioni (m). */
function arenaDi(s: DungeonState, e: Enemy): { x0: number; x1: number; z0: number; z1: number } {
  const m = s.map, T = m.tile, cx = Math.floor(e.x / T), cz = Math.floor(e.z / T);
  let x0 = cx, x1 = cx, z0 = cz, z1 = cz;
  while (!isSolid(m, x0 - 1, cz)) x0--;
  while (!isSolid(m, x1 + 1, cz)) x1++;
  while (!isSolid(m, cx, z0 - 1)) z0--;
  while (!isSolid(m, cx, z1 + 1)) z1++;
  return { x0: x0 * T, x1: (x1 + 1) * T, z0: z0 * T, z1: (z1 + 1) * T };
}

/** Pianta le bandierine da gara in un triangolo largo (a specchio a caso): la corsa va 1 → 2 → 3. */
function piantaBandierine(s: DungeonState, e: Enemy, C: ClaudeDef): void {
  const A = arenaDi(s, e), mx = s.rng.next() < 0.5, mz = s.rng.next() < 0.5, T = s.map.tile;
  const P: [number, number][] = [[0.2, 0.28], [0.8, 0.5], [0.28, 0.82]];
  s.bandierine = P.slice(0, C.slalom.n).map(([fx, fz], k) => {
    const x = A.x0 + (mx ? 1 - fx : fx) * (A.x1 - A.x0), z = A.z0 + (mz ? 1 - fz : fz) * (A.z1 - A.z0);
    return { id: s.nextId++, n: k + 1, x, z, cx: Math.floor(x / T), cz: Math.floor(z / T), vita: C.slalom.hp, abbattuta: false };
  });
  for (const b of s.bandierine) ev(s, { t: 'bandierina', id: b.id, n: b.n, abbattuta: false });
}

/** L'eroe di turno ha colpito con la lama: le bandierine entro portata cadono (un colpo basta). Lo chiama `hero.ts` a ogni swing. */
export function colpisciBandierine(s: DungeonState, portata: number): void {
  const h = s.hero;
  for (const b of s.bandierine) {
    if (b.abbattuta || dist(b.x, b.z, h.x, h.z) > portata + 0.8) continue;
    b.abbattuta = true; b.vita = 0; ev(s, { t: 'bandierina', id: b.id, n: b.n, abbattuta: true });
  }
}

const dentro = (px: number, pz: number, cx: number, cz: number, lato: number): boolean => Math.abs(px - cx) <= lato / 2 && Math.abs(pz - cz) <= lato / 2;

/** Jean-Claude «Valanga». */
export function stepJeanClaude(s: DungeonState, e: Enemy): void {
  const C = e.def.claude!, h = s.hero;
  if (!e.fase && e.vita <= e.max * C.soglia) { e.fase = 1; ev(s, { t: 'fase', n: 1 }); }
  if (e.stordito !== undefined && e.stordito > s.tick) return; // in bilico o a protestare: fermo
  if (e.modo === 'bilico' || e.modo === 'arbitro') { e.modo = undefined; setState(e, 'insegue', 0); }
  const dx = h.x - e.x, dz = h.z - e.z, d = Math.sqrt(dx * dx + dz * dz), pausa = secToTicks(C.pausa[e.fase ?? 0] ?? C.pausa[0]!);
  switch (e.st) {
    case 'insegue': {
      if (d > 1e-6) { e.fx = dx / d; e.fz = dz / d; }
      const cic = C.cicli[e.fase ?? 0] ?? C.cicli[0]!, atk: Atk = cic[e.attacchi % cic.length]!, vede = lineOfSight(s.map, e.x, e.z, h.x, h.z);
      if (atk === 'frenata' && !(vede && d <= C.frenata.gittata)) { moveToward(s, e, h.x, h.z, e.def.velocita); return; }
      if (atk === 'lamina' && !(vede && d <= C.lamina.lato)) { moveToward(s, e, h.x, h.z, e.def.velocita); return; }
      e.attacchi++; e.modo = atk; e.area = false;
      if (atk === 'salto') { e.mira = { dx: h.x, dz: h.z, len: 0 }; setState(e, 'prepara', secToTicks(C.salto.volo)); ev(s, { t: 'salto', x: r2(e.x), z: r2(e.z) }); }
      else if (atk === 'slalom') { e.salve = 0; piantaBandierine(s, e, C); setState(e, 'prepara', secToTicks(C.slalom.avviso)); ev(s, { t: 'arbitro', x: r2(e.x), z: r2(e.z), urlo: 'FISCHIO! GARA UFFICIALE!' }); }
      else if (atk === 'lamina') { e.mira = { dx: e.x + e.fx * C.lamina.lato / 2, dz: e.z + e.fz * C.lamina.lato / 2, len: 0 }; setState(e, 'prepara', secToTicks(C.lamina.avviso)); ev(s, { t: 'lamina', x: r2(e.x), z: r2(e.z) }); }
      else { setState(e, 'prepara', secToTicks(C.frenata.avviso)); ev(s, { t: 'frenata', x: r2(e.x), z: r2(e.z) }); }
      return;
    }
    case 'prepara':
      // salto: il quadrato ti segue finché non mancano `blocco` s all'atterraggio, poi resta dov'è
      if (e.modo === 'salto' && e.mira && e.stT < e.stDur - secToTicks(C.salto.blocco)) { e.mira.dx = h.x; e.mira.dz = h.z; }
      if (e.stT >= e.stDur) esegui(s, e, C, pausa);
      return;
    case 'colpisce':
      stepSlalom(s, e, C, pausa);
      return;
    default: if (e.stT >= e.stDur) { e.modo = undefined; e.mira = undefined; setState(e, 'insegue', 0); }
  }
}

/** Fine dell'avviso: il colpo. */
function esegui(s: DungeonState, e: Enemy, C: ClaudeDef, pausa: number): void {
  const h = s.hero, m = e.mira;
  if (e.modo === 'frenata') {
    const dx = h.x - e.x, dz = h.z - e.z, d = Math.sqrt(dx * dx + dz * dz);
    if (d <= C.frenata.gittata && d > 1e-6 && (dx * e.fx + dz * e.fz) / d >= C.frenata.cono) { hitHero(s, C.frenata.danno, 'contundente', h.x, h.z); spingi(s, e.fx, e.fz, C.frenata.spinta, 0.25); }
    setState(e, 'recupera', pausa);
  } else if (e.modo === 'salto' && m) {
    if (!isSolid(s.map, Math.floor(m.dx / s.map.tile), Math.floor(m.dz / s.map.tile))) { e.x = m.dx; e.z = m.dz; }
    if (dentro(h.x, h.z, e.x, e.z, C.salto.lato)) { hitHero(s, C.salto.danno, 'contundente', h.x, h.z); e.modo = undefined; setState(e, 'recupera', pausa); }
    else { e.modo = 'bilico'; e.stordito = s.tick + secToTicks(C.salto.stordito); setState(e, 'recupera', secToTicks(C.salto.stordito)); ev(s, { t: 'bilico', x: r2(e.x), z: r2(e.z) }); }
    e.mira = undefined;
  } else if (e.modo === 'lamina' && m) {
    if (dentro(h.x, h.z, m.dx, m.dz, C.lamina.lato)) hitHero(s, C.lamina.danno, 'taglio', h.x, h.z);
    e.mira = undefined; setState(e, 'recupera', pausa);
  } else if (e.modo === 'slalom') setState(e, 'colpisce', secToTicks(12)); // la corsa: al massimo 12 s
}

/** La corsa tra le bandierine: ogni porta passata fa scoppiare il suo cerchio di gelo; se la bandierina a cui arriva è stata spaccata, si pianta e protesta. */
function stepSlalom(s: DungeonState, e: Enemy, C: ClaudeDef, pausa: number): void {
  const k = e.salve ?? 0, S = C.slalom;
  if (k >= s.bandierine.length || e.stT >= e.stDur) { s.bandierine = []; e.modo = undefined; setState(e, 'recupera', pausa); return; }
  const b = s.bandierine[k]!;
  if (dist(b.x, b.z, e.x, e.z) > 1.3) { moveToward(s, e, b.x, b.z, S.velocita); return; }
  if (b.abbattuta) { // la porta è caduta: non è regolare!
    s.bandierine = []; e.modo = 'arbitro'; e.stordito = s.tick + secToTicks(S.urlo); setState(e, 'recupera', secToTicks(S.urlo));
    ev(s, { t: 'arbitro', x: r2(e.x), z: r2(e.z), urlo: 'MA ERA REGOLARE! ARBITRO VENDUTO!' });
    return;
  }
  s.geyser.push({ id: s.nextId++, x: b.x, z: b.z, r: S.onda.raggio, t: 0, avviso: secToTicks(S.onda.avviso), getto: secToTicks(0.4), danno: S.onda.danno, colpiti: [] }); // il gelo scoppia dopo l'avviso
  e.salve = k + 1;
}
