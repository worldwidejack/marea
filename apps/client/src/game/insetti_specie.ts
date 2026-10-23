// I comportamenti della seconda infornata di insetti («database Nuovi insetti seconda implementazione» di Riccardo): ogni specie
// ha il suo modo di muoversi, scritto qui accanto alle quattro macchine a stati di game/insetti_vita.ts (che lo chiama per primo).
// `viveSpecie` ritorna true se ha pensato lei all'insetto in questo frame; false = vale la macchina a stati del suo tipo.
// Il retino che colpisce a vuoto qui vicino (game/retino.ts) mette l'insetto in fuga e accende `spavento`: qui ognuno reagisce a modo suo.
import type { InsettoDef } from '@marea/content/insetti.ts';
import type { Attore, Chi, Eventi, Mondo } from './insetti_vita.ts';
import { PASSI, avanti, balzo, d2, lontanoDa, prua, saltaVerso, verso, via, wrap } from './insetti_moto.ts';

/** Sopra questa quota il retino non ci arriva (falena Luna, libellula rossa, Atlante). */
const FUORI_PORTATA = 1.7;
const raggio = (a: Attore, chi: Chi) => a.def.allerta * (chi.furtivo ?? 1);
/** Come in vive(): ti nota se corri nel suo raggio o se gli arrivi addosso. */
const allertato = (a: Attore, chi: Chi, dist: number) => (chi.corre && dist < raggio(a, chi)) || dist < Math.min(0.8, a.def.allerta * 0.5) * (chi.furtivo ?? 1);
const avvicina = (y: number, verso: number, k: number, dt: number) => y + (verso - y) * Math.min(1, k * dt);

/** In volo lontano da chi gioca (sull'acqua ci cade, come i volanti della prima infornata); lontano abbastanza, torna in giro. */
function volaVia(a: Attore, chi: Chi, v: number, dt: number, m: Mondo, ev: Eventi, dist: number, quota = 1): void {
  a.stato = 'scappa';
  a.y = avvicina(a.y, quota + Math.sin(a.vita * 12 + a.seme * 7) * 0.15, 4, dt);
  lontanoDa(a, chi, 6, dt, Math.sin(a.vita * 5 + a.seme * 9) * 0.3);
  if (avanti(a, v, dt, m, false)) { ev.plop = true; return; }
  if (dist > a.def.allerta * 3.5 && dist > 8) { a.stato = 'giro'; a.cx = a.x; a.cz = a.z; a.t = 0; }
}
/** In volo attorno a casa, entro 4 m. */
function giraVolo(a: Attore, v: number, dt: number, m: Mondo, quota: number, curve = 1.2): void {
  if (d2(a.x, a.z, a.cx, a.cz) > 4) verso(a, a.cx, a.cz, 2.5, dt); else a.h = wrap(a.h + Math.sin(a.vita * 1.3 + a.seme * 11) * dt * curve);
  avanti(a, v, dt, m, false);
  a.y = avvicina(a.y, quota + Math.sin(a.vita * 3.1 + a.seme * 7) * 0.12, 3, dt);
}
/** A terra attorno a casa: due passi e una sosta. */
function giraTerra(a: Attore, v: number, dt: number, m: Mondo): void {
  if (d2(a.x, a.z, a.cx, a.cz) > 3.5) verso(a, a.cx, a.cz, 2, dt); else a.h = wrap(a.h + Math.sin(a.vita * 0.9 + a.seme * 13) * dt * 1.4);
  if ((a.vita + a.seme * 4) % 3 < 2) avanti(a, v * 0.35, dt, m);
}
/** A terra lontano da chi gioca (`scarto` rad sulla prua: zig-zag). */
function fuggi(a: Attore, chi: Chi, v: number, dt: number, m: Mondo, ev: Eventi, dist: number, scarto = 0, k = 6): void {
  a.stato = 'scappa';
  lontanoDa(a, chi, k, dt, scarto);
  if (avanti(a, v, dt, m)) { ev.plop = true; return; }
  if (dist > a.def.allerta * 3.5 && dist > 8) { a.stato = 'giro'; a.cx = a.x; a.cz = a.z; }
}
/** Un balzo in volo (mosca, sirfide) di `lungo` metri: niente acqua né muri, alla fine si ferma. */
function scarto(a: Attore, dur: number, alto: number): void {
  const k = Math.min(1, a.t / dur);
  a.x = a.sx + (a.ex - a.sx) * k; a.z = a.sz + (a.ez - a.sz) * k;
  if (alto) a.y = Math.sin(k * Math.PI) * alto;
  if (k >= 1) { a.stato = a.def.comportamento === 'stella' ? 'fermo' : 'giro'; a.t = 0; }
}
/** Una prua per saltare via di `lungo` metri che non finisca in acqua (al limite verso casa). */
function pruaSicura(a: Attore, h: number, lungo: number, m: Mondo): number {
  for (const d of [0, Math.PI / 2, -Math.PI / 2, Math.PI]) {
    const x = a.x + Math.sin(h + d) * lungo, z = a.z - Math.cos(h + d) * lungo;
    if (!m.acqua?.(x, z) && m.terra(x, z)) return h + d;
  }
  return prua(a.cx - a.x, a.cz - a.z);
}
/** Giù dall'albero: true quando tocca terra. */
const cadi = (a: Attore, dt: number): boolean => { a.y = Math.max(0, a.y - dt * 7); if (a.y > 0) return false; a.t = 0; a.u = a.vita; return true; };

/** Appena uscito da un sasso o staccato da un albero: dove e come parte (dopo daSasso/daAlbero). */
export function esceSpecie(a: Attore): Attore {
  const b = a.def.comportamento;
  if (b === 'morde') { a.stato = 'fermo'; a.t = 0; }
  if (b === 'fisarmonica' || b === 'corazza' || b === 'rotella') { a.stato = 'giro'; a.h = prua(a.x - a.cx, a.z - a.cz); }
  if (b === 'deltaplano') a.stato = 'plana';
  return a;
}
/** Può finire nel retino adesso? (quello che dice vive() più i casi della seconda infornata). */
export function prendibileSpecie(a: Attore): boolean {
  const b = a.def.comportamento;
  if (b === 'corazza' && a.stato === 'fermo') return false; // un sassolino: il retino rimbalza
  if ((b === 'planata' || b === 'quota' || b === 'deltaplano') && a.y > FUORI_PORTATA) return false;
  if (b === 'schiva' && a.stato === 'salta') return false; // il balzo all'indietro schiva la retata
  return true;
}
/** La scritta che compare quando esce (vespe, calabrone, scolopendra: ti avvisa che sta per attaccare). */
export function avvisoSpecie(d: InsettoDef): string | null {
  return d.comportamento === 'nido' ? 'È caduto un nido di vespe!' : d.comportamento === 'calabrone' ? 'Bzzz… un calabrone gigante!' : d.comportamento === 'morde' ? 'Attento: una scolopendra!' : null;
}

/** Un passo di vita per le specie della seconda infornata: true se ci ha pensato lei. */
export function viveSpecie(a: Attore, chi: Chi, dt: number, m: Mondo, ev: Eventi, dist: number): boolean {
  const b = a.def.comportamento, v = PASSI[a.def.velocita] ?? 1.2, sp = a.spavento === true;
  a.spavento = false;
  if (a.stato === 'via') {
    if (b === 'fisarmonica' || b === 'radici') { a.y -= dt * 0.3; a.alfa = Math.max(0, 1 - a.t / 1.5); return true; } // torna sotto terra
    if (b === 'decolla') { a.alfa = Math.max(0, 1 - a.t / 1.5); a.y += dt * 1.6; a.h = wrap(a.h + dt * 7); avanti(a, v * 1.2, dt, m, false); return true; } // sale a spirale
    return false;
  }
  switch (b) {
    // ———— volanti ————
    case 'stella': { // mosca: posata 2 s, un balzo di un metro, di nuovo posata
      if (a.stato === 'scappa' || allertato(a, chi, dist)) { volaVia(a, chi, v, dt, m, ev, dist); return true; }
      if (a.stato === 'salta') { scarto(a, 0.35, 0.6); return true; }
      a.stato = 'fermo'; a.y = Math.max(0.05, a.y - dt * 3);
      if (a.t > 2) { const lontana = d2(a.x, a.z, a.cx, a.cz) > 3; saltaVerso(a, pruaSicura(a, lontana ? prua(a.cx - a.x, a.cz - a.z) : a.h + 1.3 + Math.sin(a.seme * 7 + a.vita) * 1.2, 1.2, m), 1.2); }
      return true;
    }
    case 'librata': { // sirfide: ferma a mezz'aria, scarta di 90° quando ti avvicini
      a.u -= dt;
      if (a.stato === 'scappa' || allertato(a, chi, dist)) { volaVia(a, chi, v, dt, m, ev, dist); return true; }
      if (a.stato === 'salta') { scarto(a, 0.22, 0); a.y = 1; return true; }
      a.stato = 'giro'; a.y = avvicina(a.y, 1 + Math.sin(a.vita * 9) * 0.03, 3, dt);
      if (dist < raggio(a, chi) && a.u <= 0) { a.u = 1; saltaVerso(a, prua(a.x - chi.x, a.z - chi.z) + (Math.sin(a.vita * 3 + a.seme * 9) > 0 ? 1 : -1) * Math.PI / 2, 1.6); a.y = 1; }
      else if (d2(a.x, a.z, a.cx, a.cz) > 4) { verso(a, a.cx, a.cz, 2, dt); avanti(a, v * 0.25, dt, m, false); }
      return true;
    }
    case 'fiori': { // farfalla Aurora: 3 s posata sui fiori, poi un giro svelto
      if (a.stato === 'scappa' || allertato(a, chi, dist)) { volaVia(a, chi, v, dt, m, ev, dist); return true; }
      const posata = (a.vita + a.seme * 6) % 6 < 3;
      a.stato = posata ? 'fermo' : 'giro';
      if (posata) a.y = avvicina(a.y, 0.3, 4, dt); else giraVolo(a, v * 0.9, dt, m, 1, 2);
      return true;
    }
    case 'planata': { // falena Luna: alta fuori portata, ogni 4 s scende a tiro con un'ampia onda
      if (a.stato === 'scappa' || allertato(a, chi, dist)) { volaVia(a, chi, v, dt, m, ev, dist, 2.8); return true; }
      const p = (a.vita + a.seme * 4) % 4, onda = p < 1.6 ? Math.sin((p / 1.6) * Math.PI) : 0;
      giraVolo(a, v * 0.6, dt, m, 2.8, 0.8); a.y = 2.8 - onda * 2.2;
      return true;
    }
    case 'ubriaco': { // maggiolino: volo a zig-zag storto; se sbatte su un tronco o un lampione cade a pancia in su per 2 s
      a.u -= dt;
      if (a.stato === 'stordito') { a.y = Math.max(0, a.y - dt * 4); if (a.t > 2) { a.stato = 'giro'; a.t = 0; } return true; }
      if (a.stato === 'scappa' || allertato(a, chi, dist)) { volaVia(a, chi, v, dt, m, ev, dist); return true; }
      a.h = wrap(a.h + (Math.sin(a.vita * 4.1 + a.seme * 11) + Math.sin(a.vita * 7.3)) * dt * 2.5);
      if (d2(a.x, a.z, a.cx, a.cz) > 1.2) verso(a, a.cx, a.cz, 1.5, dt);
      avanti(a, v * 0.7, dt, m, false);
      a.y = avvicina(a.y, 1 + Math.sin(a.vita * 2.3) * 0.25, 2, dt);
      if (a.u <= 0 && m.ostacolo?.(a.x, a.z)) { a.stato = 'stordito'; a.t = 0; a.u = 5; ev.tonfo = true; }
      return true;
    }
    case 'termiche': { // macaone: tre battiti in salita, poi una lunga planata in diagonale
      if (a.stato === 'scappa' || allertato(a, chi, dist)) { volaVia(a, chi, v, dt, m, ev, dist); return true; }
      const sale = (a.vita + a.seme * 3) % 2.4 < 0.6;
      if (d2(a.x, a.z, a.cx, a.cz) > 4.5) verso(a, a.cx, a.cz, 1.5, dt);
      avanti(a, v * (sale ? 0.4 : 0.9), dt, m, false);
      a.y = Math.min(1.6, Math.max(0.5, a.y + dt * (sale ? 0.9 : -0.3)));
      a.stato = sale ? 'giro' : 'fermo'; // fermo = ali aperte in planata
      return true;
    }
    case 'quota': { // libellula rossa: bassa e regolare in tondo; se corri si alza fuori portata finché non cammini piano
      if ((chi.corre && dist < raggio(a, chi) * 1.5) || a.stato === 'scappa' || sp) a.u = 2.5; else a.u -= dt;
      a.stato = 'giro';
      const ang = a.vita * 0.8 + a.seme * 6;
      a.x = a.cx + Math.cos(ang) * 2.2; a.z = a.cz + Math.sin(ang) * 2.2; a.h = ang + Math.PI;
      a.y = avvicina(a.y, a.u > 0 ? 2.4 : 0.6 + Math.sin(a.vita * 2) * 0.05, 3, dt);
      return true;
    }
    case 'squittio': { // sfinge: entri nel suo raggio muovendoti e squittisce, poi parte a razzo
      if (a.stato === 'scappa') { volaVia(a, chi, v * 1.8, dt, m, ev, dist, 1.4); return true; }
      if (dist < raggio(a, chi) && (chi.v > 0.2 || chi.corre)) { ev.squittio = true; volaVia(a, chi, v * 1.8, dt, m, ev, dist, 1.4); return true; }
      giraVolo(a, v * 0.5, dt, m, 1.2);
      return true;
    }
    case 'lascia': { // cedronella: bassa; se ti avvicini chiude le ali e si lascia cadere come una foglia
      if (a.stato === 'scappa' || (a.stato === 'fermo' && allertato(a, chi, dist))) { volaVia(a, chi, v, dt, m, ev, dist, 0.6); return true; }
      if (a.stato === 'fermo') {
        if (a.y > 0.05) { a.y = Math.max(0.05, a.y - dt * 1.1); a.x += Math.sin(a.t * 6) * 0.4 * dt; a.h += dt * 1.5; }
        if (dist > raggio(a, chi) * 2 && a.t > 3) { a.stato = 'giro'; a.t = 0; }
        return true;
      }
      if (dist < raggio(a, chi)) { a.stato = 'fermo'; a.t = 0; return true; }
      giraVolo(a, v * 0.5, dt, m, 0.5);
      return true;
    }
    // ———— a terra ————
    case 'schiva': { // ragno lupo: pattuglia a scatti; se corri o lo manchi fa un balzo all'indietro, poi fugge
      if (a.stato === 'salta') { if (balzo(a, m, 0.35, 0.3)) ev.plop = true; return true; }
      if ((allertato(a, chi, dist) || sp) && a.u === 0) { a.u = 1; saltaVerso(a, pruaSicura(a, prua(a.x - chi.x, a.z - chi.z), 1.8, m), 1.8); return true; }
      if (a.stato === 'scappa' || (a.u === 1 && dist < raggio(a, chi))) { fuggi(a, chi, v, dt, m, ev, dist); if (a.stato === 'giro') a.u = 0; return true; }
      a.stato = 'giro';
      if (d2(a.x, a.z, a.cx, a.cz) > 4) verso(a, a.cx, a.cz, 2, dt); else a.h = wrap(a.h + Math.sin(a.vita * 0.7 + a.seme * 13) * dt * 2);
      if ((a.vita + a.seme * 3) % 1.2 < 0.4) avanti(a, v * 0.8, dt, m);
      return true;
    }
    case 'orchidea': { // mantide orchidea: immobile come un fiore; a un passo di corsa (o a un colpo mancato) sparisce
      if ((chi.corre && dist < raggio(a, chi)) || sp) { a.stato = 'via'; a.t = 99; a.alfa = 0; return true; }
      a.stato = 'fermo';
      if (dist < raggio(a, chi)) verso(a, chi.x, chi.z, 3, dt);
      return true;
    }
    case 'cicindela': { // corre fortissimo, ma ogni 1,5 s si ferma di colpo per ricalcolare dove sei
      if (a.stato !== 'scappa' && a.stato !== 'fermo' && dist >= raggio(a, chi)) { giraTerra(a, v * 0.3, dt, m); return true; }
      if (a.stato !== 'scappa' && a.stato !== 'fermo') { a.stato = 'fermo'; a.t = 0; }
      const ciclo = a.t % 2;
      if (ciclo >= 1.5) { a.stato = 'fermo'; lontanoDa(a, chi, 20, dt); return true; }
      a.stato = 'scappa';
      if (avanti(a, v, dt, m)) { ev.plop = true; return true; }
      if (dist > a.def.allerta * 3.5 && dist > 8) { a.stato = 'giro'; a.cx = a.x; a.cz = a.z; }
      return true;
    }
    case 'pallina': { // stercorario: spinge la pallina; se corri la molla (rotola via da sola) e scappa dall'altra parte
      if (a.u === 1) { a.sx += a.ex * dt; a.sz += a.ez * dt; a.ex *= 1 - Math.min(1, dt * 0.6); a.ez *= 1 - Math.min(1, dt * 0.6); }
      if (a.u === 0 && (allertato(a, chi, dist) || a.stato === 'scappa')) {
        a.u = 1; a.sx = a.x + Math.sin(a.h) * 0.3; a.sz = a.z - Math.cos(a.h) * 0.3; a.ex = Math.sin(a.h) * 2.5; a.ez = -Math.cos(a.h) * 2.5;
        a.h = wrap(a.h + Math.PI); a.stato = 'scappa'; a.t = 0;
      }
      if (a.stato === 'scappa') { fuggi(a, chi, v, dt, m, ev, dist, 0, 3); return true; }
      a.stato = 'giro';
      if (d2(a.x, a.z, a.cx, a.cz) > 5) verso(a, a.cx, a.cz, 1, dt); else a.h = wrap(a.h + Math.sin(a.vita * 0.5 + a.seme * 13) * dt * 0.6);
      avanti(a, v * 0.4, dt, m);
      return true;
    }
    case 'furca': { // collembolo: cammina piano; ogni 3 s (o se lo spaventi) si catapulta due metri più in là
      if (a.stato === 'salta') { if (balzo(a, m, 0.5, 0.8)) ev.plop = true; return true; }
      a.u += dt;
      if (allertato(a, chi, dist) || a.stato === 'scappa') { a.u = 0; saltaVerso(a, pruaSicura(a, prua(a.x - chi.x, a.z - chi.z), 2, m), 2); return true; }
      if (a.u > 3) { a.u = 0; saltaVerso(a, pruaSicura(a, a.h + Math.sin(a.seme * 31 + a.vita * 7) * 3, 2, m), 2); return true; }
      giraTerra(a, v * 0.6, dt, m);
      return true;
    }
    // ———— dai sassi ————
    case 'sinuoso': // pesciolino d'argento: zig-zag strettissimo, non velocissimo in linea retta
      fuggi(a, chi, v * 0.75, dt, m, ev, dist, Math.sin(a.vita * 16) * 1.4, 12);
      return true;
    case 'fisarmonica': { // lombrico: si allunga e si accorcia allontanandosi dal sasso; finita la finestra torna sotto terra
      a.stato = 'giro';
      if (a.vita > a.def.finestra) { via(a); return true; }
      if (allertato(a, chi, dist)) lontanoDa(a, chi, 2, dt);
      avanti(a, v * 0.6 * Math.max(0, Math.sin(a.vita * 3)), dt, m);
      return true;
    }
    case 'indietro': { // formica leone: cammina solo all'indietro, in una spirale stretta
      const s = allertato(a, chi, dist) || a.stato === 'scappa' ? v : v * 0.5;
      a.stato = dist > 8 ? 'giro' : a.stato;
      a.h = wrap(a.h + dt * (1.6 - Math.min(0.8, a.vita * 0.04)));
      const nx = a.x - Math.sin(a.h) * s * dt, nz = a.z + Math.cos(a.h) * s * dt;
      if (m.acqua?.(nx, nz)) { a.x = nx; a.z = nz; a.stato = 'acqua'; a.t = 0; ev.plop = true; }
      else if (m.terra(nx, nz)) { a.x = nx; a.z = nz; } else a.h = wrap(a.h + Math.PI / 2);
      return true;
    }
    case 'morde': { // scolopendra: si impenna un attimo, poi ti punta; se ti arriva addosso morde
      if (a.u === 0) { a.stato = 'fermo'; verso(a, chi.x, chi.z, 8, dt); if (a.vita > 1.2) { a.u = 1; a.t = 0; } return true; }
      if (a.u === 1) {
        a.stato = 'carica'; verso(a, chi.x, chi.z, 8, dt); avanti(a, v * 0.25, dt, m);
        if (dist < 0.5) { ev.punto = 'Ahi! La scolopendra ti ha morso'; via(a); }
        else if (a.t > 3) { a.u = 2; a.t = 0; }
        return true;
      }
      fuggi(a, chi, v * 0.7, dt, m, ev, dist);
      return true;
    }
    case 'molla': // opilione: scappa molleggiando (il saltello è solo nel disegno: l'ombra a terra è quella che si prende)
      fuggi(a, chi, v * 0.8, dt, m, ev, dist, Math.sin(a.vita * 2.5 + a.seme * 7) * 0.5);
      return true;
    case 'corazza': { // portasassi: striscia via piano; se corri (o lo manchi) diventa un sassolino finché non cammini piano
      if (sp || (chi.corre && dist < raggio(a, chi) * 1.5)) { a.stato = 'fermo'; a.u = 0; return true; }
      if (a.stato === 'fermo') { a.u += dt; if (a.u > 1.5) { a.stato = 'giro'; a.t = 0; } return true; }
      a.stato = 'giro';
      if (dist < raggio(a, chi) * 2) lontanoDa(a, chi, 2, dt);
      avanti(a, v * 0.6, dt, m);
      return true;
    }
    case 'rotella': { // millepiedi: cammina tranquillo; se lo manchi col retino si arrotola e rotola via
      if (sp) { a.stato = 'rotola'; a.t = 0; a.h = pruaSicura(a, prua(a.x - chi.x, a.z - chi.z), 2, m); }
      if (a.stato === 'rotola') {
        if (a.t > 2.5) { a.stato = 'giro'; a.t = 0; return true; }
        const nx = a.x + Math.sin(a.h) * v * 1.8 * dt, nz = a.z - Math.cos(a.h) * v * 1.8 * dt;
        if (m.acqua?.(nx, nz)) { a.x = nx; a.z = nz; a.stato = 'acqua'; a.t = 0; ev.plop = true; } else if (m.terra(nx, nz)) { a.x = nx; a.z = nz; } else a.h = wrap(a.h + Math.PI * 0.7);
        return true;
      }
      a.stato = 'giro';
      if (dist < raggio(a, chi) * 2) lontanoDa(a, chi, 3, dt); else a.h = wrap(a.h + Math.sin(a.vita * 0.9 + a.seme * 13) * dt);
      avanti(a, v * (allertato(a, chi, dist) ? 0.9 : 0.4), dt, m);
      return true;
    }
    // ———— dagli alberi ————
    case 'rametto': { // insetto stecco: atterra immobile come un rametto, dopo 2 s cammina piano lontano da te
      if (a.stato === 'cade') { if (cadi(a, dt)) a.stato = 'fermo'; return true; }
      if (a.stato === 'fermo' && a.vita - a.u < 2) return true;
      a.stato = 'giro';
      if (dist < raggio(a, chi) * 2) lontanoDa(a, chi, 1.5, dt);
      avanti(a, v * 0.5, dt, m);
      return true;
    }
    case 'radici': { // blatta: corre a nascondersi tra le radici del suo albero e ci gira attorno
      if (a.stato === 'cade') { if (cadi(a, dt)) a.stato = 'scappa'; return true; }
      const r = d2(a.x, a.z, a.sx, a.sz);
      if (r > 0.6) { a.stato = 'scappa'; verso(a, a.sx, a.sz, 10, dt); avanti(a, v * 0.8, dt, m, false); return true; }
      if (a.stato !== 'fermo') { a.stato = 'fermo'; a.t = 0; }
      const ang = Math.atan2(a.z - a.sz, a.x - a.sx) + dt * 1.2;
      a.x = a.sx + Math.cos(ang) * 0.5; a.z = a.sz + Math.sin(ang) * 0.5; a.h = ang;
      if (a.t > 12) via(a);
      return true;
    }
    case 'decolla': // cetonia: atterra, poi si alza a spirale (o subito, se la manchi)
      if (a.stato === 'cade') { if (cadi(a, dt)) a.stato = 'fermo'; return true; }
      a.stato = 'fermo';
      if (sp || a.vita - a.u > a.def.finestra * 0.75) via(a);
      return true;
    case 'intimidisce': { // cervo volante: a terra mezzo secondo, una finta carica di mezzo secondo, poi vola via
      if (a.stato === 'cade') { if (cadi(a, dt)) a.stato = 'fermo'; return true; }
      const t = a.vita - a.u;
      if (sp || t > a.def.finestra) { via(a); return true; }
      if (t > 0.5 && t < 1 && dist > 0.7) { a.stato = 'carica'; verso(a, chi.x, chi.z, 10, dt); avanti(a, v * 0.9, dt, m); }
      else { a.stato = 'fermo'; verso(a, chi.x, chi.z, 6, dt); }
      return true;
    }
    case 'deltaplano': { // falena Atlante: non cade, si stacca planando di traverso; finita la finestra vola via
      a.stato = 'plana';
      if (a.vita > a.def.finestra) { via(a); return true; }
      if (a.vita < dt * 1.5) a.h = prua(a.x - chi.x, a.z - chi.z) + (a.seme > 0.5 ? 0.7 : -0.7);
      a.y = Math.max(0.55, a.y - dt * 2.4);
      a.h = wrap(a.h + Math.sin(a.vita * 2) * dt * 0.4);
      avanti(a, v * 1.1, dt, m, false);
      return true;
    }
    case 'puzza': { // cimice marmorizzata: aspetta a terra; se la manchi da vicino ti lascia la nuvola puzzolente e vola via
      if (a.stato === 'cade') { if (cadi(a, dt)) a.stato = 'fermo'; return true; }
      if (sp) { if (dist < 2.5) { ev.puzza = true; a.sx = a.x; a.sz = a.z; } via(a); return true; }
      if (a.vita - a.u < a.def.finestra) { a.stato = 'fermo'; return true; }
      a.stato = 'giro'; lontanoDa(a, chi, 2, dt); avanti(a, v * 0.6, dt, m);
      return true;
    }
    case 'calabrone': { // calabrone gigante: atterra, ronza mezzo secondo, poi carica velocissimo e punge
      if (a.stato === 'cade') { if (cadi(a, dt)) a.stato = 'fermo'; return true; }
      const t = a.vita - a.u;
      if (t < 0.5) { a.stato = 'fermo'; a.y = 0.15; verso(a, chi.x, chi.z, 8, dt); return true; }
      a.stato = 'carica'; a.y = avvicina(a.y, 1, 6, dt); verso(a, chi.x, chi.z, 8, dt);
      avanti(a, v * 1.5, dt, m, false);
      if (dist < 0.45) { ev.punto = 'Ahi! Il calabrone ti ha punto'; via(a); } else if (t > 4) via(a);
      return true;
    }
  }
  return false;
}
