// Prima persona: dallo stato dell'eroe nella sim ai pezzi da disegnare davanti agli occhi. Non c'è mai una mano vuota: la destra tiene l'arma o la
// bacchetta della magia, la sinistra la torcia, o tutte e due un'arma pesante; a mani nude i tirapugni. Il fendente usa le stesse funzioni della
// sim (swing.ts): quel che si vede è quel che colpisce. Posizioni in frazioni dell'altezza dello schermo (fp_mani.ts).
import type { DungeonView } from '@marea/sim/dungeon/types.ts';
import { COLPI } from '@marea/sim/dungeon/tuning.ts';
import { bladeAngle, swept } from '@marea/sim/dungeon/swing.ts';
import { destraPresa, sopraPresa, sottoPresa } from './fp_mani.ts';
import type { Colore, Pezzo } from './fp_mani.ts';

export type Arnese = 'pugni' | 'katana' | 'ascia' | 'nunchaku' | 'lancia' | 'spadone' | 'martello' | 'arco' | 'bacchetta';
export type Contesto = {
  h: DungeonView['hero'];
  arnese: Arnese;
  /** Il disegno dell'arma o dell'arco se non è quello del tipo (le uniche: `u_<id>`, coi loro colori e senza lama da tingere); '' = quello del tipo. */
  sprite: string;
  /** Colore della lama (materiale o unico), della magia in mano, e id della magia (la sua bacchetta). */
  lama: Colore; magia: Colore; magiaId: string;
  /** Forma della magia in mano: 'raggio', 'bomba' o niente. */
  forma: string | undefined;
  /** La A è giù con la magia in mano: si punta. */
  punta: boolean;
  clock: number; bobX: number; bobY: number; swayX: number; swayY: number;
  /** 0..1: mani giù (cambio d'arma, schivata, morte). */
  giu: number;
  /** Colpi di pugno: si alternano le mani. */
  nColpo: number;
  /** Un pixel dello sprite in frazioni dell'altezza dello schermo. */
  u: number;
  /** Portata dell'arma in m: l'affondo della lancia va lontano quanto lei (3 m) e non come una katana (1,8 m). */
  portata: number;
};

const PESANTI = new Set<Arnese>(['lancia', 'spadone', 'martello']);
/** Archi unici che hanno la corda nel disegno (la molla dell'Arco Carillon, che non si tende): il gioco non ne disegna un'altra a riposo. */
const CORDA_PROPRIA = new Set(['u_unico_arco_carillon']);
const QUASI: Colore = [1, 0.92, 0.55], FILO: Colore = [0.9, 0.82, 0.62];
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const liscio = (t: number) => { const u = Math.max(0, Math.min(1, t)); return u * u * (3 - 2 * u); };
const RAGGIO = { x: 0.35, y: 0.06, rot: -0.62 }, REST = { x: 0.3, y: 0.26 }, TORCIA = { x: -0.36, y: 0.2 }, PESO = { x: 0.2, y: 0.2, rot: 0.32 };

function arma(c: Contesto, x: number, y: number, rot: number, out: Pezzo[], scie: readonly (readonly [number, number])[] = []): void {
  const id = c.sprite || c.arnese;
  for (const [r, a] of scie) out.push({ id: `${id}_lama`, x, y, rot: r, c: c.lama, a, luce: true }, { id, x, y, rot: r, a });
  if (c.arnese === 'nunchaku') {
    const dond = Math.sin(c.clock * 7) * 0.25 + rot * 0.6;
    out.push({ id: `${id}2`, x, y, rot: rot + dond });
  }
  out.push({ id, x, y, rot }, { id: `${id}_lama`, x, y, rot, c: c.lama });
}

/** La sinistra con la torcia accesa, che ondeggia poco. */
function torcia(c: Contesto, out: Pezzo[]): void {
  const fx = TORCIA.x + c.bobX * 0.6 + c.swayX * 0.7, fy = TORCIA.y + c.bobY * 0.6 + c.swayY * 0.7 - c.giu * 0.6;
  out.push({ id: 'fiaccola', x: fx, y: fy, flip: true }, { id: `fiamma${Math.floor(c.clock * 9) % 4}`, x: fx, y: fy, flip: true, luce: true }, { id: 'pugno', x: fx, y: fy, flip: true });
}

/** La bacchetta della magia in mano col suo bagliore in punta: `forza` lo gonfia. */
function bacchetta(c: Contesto, x: number, y: number, rot: number, forza: number, out: Pezzo[]): void {
  out.push({ id: `b_${c.magiaId}`, x, y, rot });
  if (forza <= 0 && Math.floor(c.clock * 3) % 4 !== 0) return; // ferma: solo uno scintillio ogni tanto, la testa della bacchetta si deve vedere
  const s = forza <= 0 ? 0.55 : 0.8 + 0.5 * forza, id = `bagliore${Math.floor(c.clock * 10) % 3}`, l = sopraPresa(`b_${c.magiaId}`) * c.u;
  out.push({ id, x: x + Math.sin(rot) * l, y: y + Math.cos(rot) * l, sx: s, sy: s, c: c.magia, luce: true });
}

function sceltaColpo(u: number): string { return u < 0.34 ? 'colpo1' : u < 0.7 ? 'colpo2' : 'colpo3'; }

function fendente(c: Contesto, out: Pezzo[], st: 'fendente' | 'giro'): void {
  const t = c.h.t, co = COLPI[st], u = swept(st, t), ang = bladeAngle(st, t);
  const pesante = PESANTI.has(c.arnese);
  if (t < co.da) { // preparazione: l'arma va indietro, in alto a destra
    const a = liscio(t / co.da), x = lerp(REST.x, 0.44, a), y = lerp(REST.y, pesante ? 0.3 : 0.42, a);
    arma(c, x, y, lerp(0, 0.62, a), out);
    out.push({ id: a < 0.5 ? 'pugno' : 'colpo1', x, y });
    return;
  }
  if (t < co.a) { // il colpo: la mano passa da destra a sinistra e la lama gira con la stessa fase della sim
    const x = lerp(0.44, -0.3, u), y = lerp(0.42, 0.3, u) - Math.sin(Math.PI * u) * 0.06;
    const rot = (ang / (75 * Math.PI / 180)) * (st === 'giro' ? 0.6 : 1) * 1.05;
    const scie = [[rot + 0.3, 0.42], [rot + 0.62, 0.22]] as const;
    arma(c, x, y, rot, out, scie);
    out.push({ id: sceltaColpo(u), x, y });
    return;
  }
  const v = liscio((t - co.a) / (1 - co.a)), x = lerp(-0.3, REST.x, v), y = lerp(0.3, REST.y, v) - Math.sin(Math.PI * v) * 0.34;
  arma(c, x, y, lerp(-1.05, 0, v), out);
  out.push({ id: v < 0.45 ? 'colpo3' : 'pugno', x, y });
}

function affondo(c: Contesto, out: Pezzo[]): void {
  const t = c.h.t, co = COLPI.affondo, avanti = t < co.da ? -0.5 * liscio(t / co.da) : t < co.a ? lerp(-0.5, 1, liscio((t - co.da) / (co.a - co.da))) : 1 - liscio((t - co.a) / (1 - co.a));
  const rot = -0.62, corsa = 0.14 * Math.max(1, c.portata / 1.8), x = 0.2 + Math.sin(rot) * avanti * corsa, y = 0.2 + Math.cos(rot) * avanti * corsa;
  arma(c, x, y, rot, out);
  out.push({ id: 'affondo', x, y: y - 0.02 });
}

function pugni(c: Contesto, out: Pezzo[]): void {
  const h = c.h, bob = (s: number) => ({ x: s * 0.3 + c.bobX + c.swayX, y: 0.22 + c.bobY + c.swayY });
  const a = bob(1), b = bob(-1);
  if (h.anim === 'attacca') {
    const sin = c.nColpo % 2 === 1, st = h.stile === 'giro' ? 'giro' : 'pugno', co = COLPI[st], t = h.t;
    const f = t < co.da ? -0.3 * liscio(t / co.da) : t < co.a ? lerp(-0.3, 1, liscio((t - co.da) / (co.a - co.da))) : 1 - liscio((t - co.a) / (1 - co.a));
    const p = { x: lerp(0.3, 0.08, Math.max(0, f)), y: lerp(0.22, 0.34, Math.max(0, f)) - Math.min(0, f) * -0.08 };
    const ferma = sin ? a : b, fl = sin;
    out.push({ id: 'pugno_tp', x: ferma.x, y: ferma.y, flip: !fl });
    out.push({ id: f > 0.2 ? 'tiro' : 'pugno_tp', x: sin ? -p.x : p.x, y: p.y, flip: sin });
    return;
  }
  if (h.anim === 'carica') {
    const tr = h.carica >= 1 ? Math.sin(c.clock * 60) * 0.004 : 0;
    out.push({ id: 'pugno_tp', x: b.x, y: b.y, flip: true }, { id: 'colpo1_tp', x: 0.4 + tr, y: 0.34 + h.carica * 0.06, ...(h.carica >= 1 ? { c: QUASI } : {}) });
    return;
  }
  out.push({ id: 'pugno_tp', x: b.x, y: b.y, flip: true }, { id: 'pugno_tp', x: a.x, y: a.y });
}

/** Una corda da (x0, y0) a (x1, y1), spessa un pixel dello sprite. */
function corda(c: Contesto, x0: number, y0: number, x1: number, y1: number, out: Pezzo[]): void {
  const dx = x1 - x0, dy = y1 - y0, d = Math.sqrt(dx * dx + dy * dy);
  out.push({ id: 'px', x: (x0 + x1) / 2, y: (y0 + y1) / 2, rot: Math.atan2(dx, dy), sx: 1 / 2, sy: d / (2 * c.u), c: FILO, luce: true });
}

/** L'arco nella sinistra, la freccia nella destra: la corda la tira la mano, con la tensione della sim. */
function arco(c: Contesto, out: Pezzo[]): void {
  const h = c.h, bx = -0.14 + c.bobX + c.swayX, by = 0.36 + c.bobY + c.swayY, tesa = h.anim === 'tende' ? liscio(h.carica) : 0, scatto = h.anim === 'tira' ? 1 - h.t : 0;
  const ar = c.sprite || 'arco', su = by + sopraPresa(ar) * c.u + scatto * 0.015, giu = by - sottoPresa(ar) * c.u + scatto * 0.015, piega = 22 * c.u; // le punte dell'arco stanno a destra del ventre
  const cx = bx + (c.sprite ? (destraPresa(ar) - 2) * c.u : piega * 0.45); // dove sta la corda (negli unici: al bordo destro del disegno)
  out.push({ id: ar, x: bx, y: by + scatto * 0.015 });
  if (h.anim === 'tende') {
    const rx = lerp(0.04, 0.26, tesa) + c.bobX, ry = lerp(0.36, 0.26, tesa) + c.bobY;
    corda(c, cx, su, rx, ry, out); corda(c, cx, giu, rx, ry, out);
    out.push({ id: 'freccia', x: rx, y: ry, rot: Math.atan2(bx - rx, by - ry) }, { id: 'regge', x: bx, y: by, flip: true }, { id: 'tira', x: rx, y: ry });
    return;
  }
  if (!CORDA_PROPRIA.has(ar)) corda(c, cx, su, cx, giu, out);
  out.push({ id: 'regge', x: bx, y: by, flip: true });
  const rx = REST.x + c.bobX * 1.2 + c.swayX, ry = REST.y - 0.04 - scatto * 0.1 + c.bobY;
  out.push({ id: 'freccia', x: rx, y: ry, rot: 0.12 }, { id: 'pugno', x: rx, y: ry });
}

function magia(c: Contesto, out: Pezzo[]): void {
  const h = c.h, raggio = c.forma === 'raggio', bomba = c.forma === 'bomba';
  if (h.anim === 'lancia' && raggio) { // raggio acceso: bacchetta verso il mirino e getto dalla punta al centro dello schermo
    const x = RAGGIO.x + c.bobX * 0.5, y = RAGGIO.y + c.bobY * 0.5;
    bacchetta(c, x, y, RAGGIO.rot, 0.1, out);
    out.push({ id: 'pugno', x, y });
    return;
  }
  if (h.anim === 'lancia') { // il colpo: su e avanti; la bomba si lancia dall'alto, ad arco
    const t = h.t, su = liscio(t / 0.3), giu = liscio((t - 0.3) / 0.7);
    const x = bomba ? lerp(lerp(REST.x, 0.4, su), 0.1, giu) : lerp(lerp(REST.x, 0.34, su), 0.12, giu), y = bomba ? lerp(lerp(REST.y, 0.46, su), 0.3, giu) : lerp(lerp(REST.y, 0.3, su), 0.3, giu);
    const rot = bomba ? lerp(0.5, -0.7, giu) : lerp(0.25, -0.55, giu);
    bacchetta(c, x, y, rot, t < 0.45 ? 1.2 : 0.3, out);
    out.push({ id: bomba && t < 0.45 ? 'colpo1' : 'pugno', x, y });
    return;
  }
  const pun = c.punta ? 1 : 0, x = lerp(REST.x, 0.24, pun) + c.bobX + c.swayX, y = lerp(REST.y, 0.32, pun) + c.bobY + c.swayY;
  bacchetta(c, x, y, lerp(0, -0.2, pun), pun ? 0.7 + Math.sin(c.clock * 14) * 0.2 : 0, out);
  out.push({ id: 'pugno', x, y });
}

/** Punta della bacchetta mentre il raggio è acceso (frazioni dello schermo): da lì parte il flusso nel mondo (magie_fx.ts). */
export function puntaRaggio(c: Pick<Contesto, 'magiaId' | 'u' | 'bobX' | 'bobY'>): { x: number; y: number } {
  const l = sopraPresa(`b_${c.magiaId}`) * c.u;
  return { x: RAGGIO.x + c.bobX * 0.5 + Math.sin(RAGGIO.rot) * l, y: RAGGIO.y + c.bobY * 0.5 + Math.cos(RAGGIO.rot) * l };
}

/** I pezzi da disegnare adesso, dal più lontano al più vicino. */
export function posa(c: Contesto): Pezzo[] {
  const out: Pezzo[] = [], h = c.h;
  if (c.arnese === 'pugni') pugni(c, out);
  else if (c.arnese === 'arco') arco(c, out);
  else if (c.arnese === 'bacchetta') { if (h.anim !== 'beve') torcia(c, out); magia(c, out); } else {
    const pesante = PESANTI.has(c.arnese);
    if (!pesante && h.anim !== 'beve') torcia(c, out);
    if (h.anim === 'attacca' && h.stile === 'affondo') affondo(c, out);
    else if (h.anim === 'attacca') fendente(c, out, h.stile === 'giro' ? 'giro' : 'fendente');
    else if (h.anim === 'carica') {
      const k = liscio(h.carica * 3), tr = h.carica >= 1 ? Math.sin(c.clock * 60) * 0.004 : 0, x = lerp(REST.x, 0.44, k) + tr, y = lerp(REST.y, pesante ? 0.3 : 0.42, k);
      arma({ ...c, lama: h.carica >= 1 ? QUASI : c.lama }, x, y, lerp(0, 0.62, k), out);
      out.push({ id: k < 0.5 ? 'pugno' : 'colpo1', x, y });
    } else if (pesante) { // tutte e due le mani sull'arma, di traverso
      const x = PESO.x + c.bobX + c.swayX, y = PESO.y + c.bobY + c.swayY, r = PESO.rot;
      arma(c, x, y, r, out);
      out.push({ id: 'pugno', x, y }, { id: 'pugno', x: x + Math.sin(r) * 0.16, y: y + Math.cos(r) * 0.16, flip: true });
    } else {
      const x = REST.x + c.bobX + c.swayX, y = REST.y + c.bobY + c.swayY;
      arma(c, x, y, 0, out);
      out.push({ id: 'pugno', x, y });
    }
  }
  if (h.anim === 'beve') { // la pozione sale alla bocca con la sinistra, poi torna
    const k = Math.sin(Math.PI * Math.max(0, Math.min(1, h.t))), x = lerp(-0.42, -0.06, k), y = lerp(0.05, 0.3, k);
    out.push({ id: 'pugno', x, y, flip: true }, { id: 'pozione', x: x + 0.01, y: y + 0.08, rot: k * 0.5 });
  }
  if (c.giu > 0) for (const p of out) p.y -= c.giu * 0.7;
  return out;
}
