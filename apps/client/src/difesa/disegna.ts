// La resa della Difesa (#358, #379) su un canvas 2D: fondale, annaffiatoi (tosaerba), difensori, nemici, colpi, monete ed effetti,
// corsia per corsia dall'alto in basso (così chi sta sotto copre chi sta sopra). Le pose a fotogrammi le sceglie pose.ts dallo stato
// della sim; qui sopra resta il movimento da codice che fa da contorno: la molla quando pianti, un respiro leggero, il lampo bianco
// quando colpisci, l'azzurro del gelo, l'arco del salto. Dove la pelle non ha la clip (la segnaposto) torna il movimento da codice di
// prima: rinculo, miccia che si gonfia, passo che ondeggia, morso che dondola, crepe del muro.
import type { DState, DNemico, DUnita } from '@marea/sim/difesa/stato.ts';
import { DIFESA } from '@marea/content/difesa.ts';
import { TICK_HZ } from '@marea/sim/constants.ts';
import type { ChiaveSprite, OpzioniFoto, Pelle, Posa } from './skin.ts';
import { disegnaFoto } from './skin.ts';
import type { Inquadratura } from './tavolo.ts';
import { aSchermo, casella, suFondale } from './tavolo.ts';
import type { DisegnaMoneta, Effetti } from './effetti.ts';
import type { Anim } from './pose.ts';
import { aggiorna, animato, nuovaAnim, posaNemico, posaTosaerba, posaUnita } from './pose.ts';

export type { Anim } from './pose.ts';
export type Fantasma = { tipo: string; corsia: number; col: number; ok: boolean } | null;

const CORSIA_PIEDI = 0.8;

export function creaResa(tela: HTMLCanvasElement) {
  const g = tela.getContext('2d')!;
  const anim = new Map<number, Anim>();
  let dpr = 1, sprite = 0, tickOra = 0;
  const A = (id: number, t: number): Anim => { let a = anim.get(id); if (!a) { a = nuovaAnim(t, tickOra); anim.set(id, a); } return a; };

  function dimensiona(W: number, H: number, pixel: boolean): void {
    dpr = Math.min(2, window.devicePixelRatio || 1) * (pixel ? 0.5 : 1);
    tela.width = Math.max(1, Math.round(W * dpr)); tela.height = Math.max(1, Math.round(H * dpr));
    tela.style.imageRendering = pixel ? 'pixelated' : 'auto';
  }

  const spr = (p: Pelle, posa: Posa, x: number, y: number, H: number, o?: OpzioniFoto) => { if (disegnaFoto(g, p, posa, x, y, H, o)) sprite++; };
  const scherm = (p: Pelle, q: Inquadratura, x: number, y: number) => aSchermo(q, suFondale(p, x, y));
  const altCasella = (p: Pelle, q: Inquadratura, corsia: number) => casella(p, corsia + 0.5)[1] * q.scala;

  /** Il seme (la moneta) coi piedi in (x, y), su una casella alta `Hc`, con l'alone che luccica. */
  function moneta(p: Pelle): DisegnaMoneta {
    return (gg, x, y, Hc) => {
      const sp = p.sprite.moneta; if (!sp) return;
      const h = Hc * sp.alto;
      gg.globalAlpha = 0.3 * (gg.globalAlpha || 1); gg.fillStyle = '#fff6b0'; gg.beginPath(); gg.arc(x, y - h * 0.5, Math.max(1, h * 0.62), 0, Math.PI * 2); gg.fill(); gg.globalAlpha = 1;
      disegnaFoto(gg, p, { k: 'moneta', clip: 'fermo', i: 0 }, x, y, Hc);
    };
  }

  function unita(s: DState, p: Pelle, q: Inquadratura, u: DUnita, t: number): void {
    const a = A(u.id, t), [x, y] = scherm(p, q, u.col + 0.5, u.corsia + CORSIA_PIEDI), H = altCasella(p, q, u.corsia);
    aggiorna(s, a, null, false, false);
    const posa = posaUnita(s, p, u, a);
    const vivo = animato(p, u.tipo, 'spara', 'manovella', 'gonfia', 'rosicchiato', 'sotto', 'chiusi');
    const pop = Math.min(1, (t - a.nato) / 0.18), molla = pop < 1 ? 0.3 + 0.7 * pop + Math.sin(pop * Math.PI) * 0.25 : 1;
    const respiro = Math.sin(t * 5.6 + u.id) * (vivo ? 0.012 : 0.03), r = Math.max(0, 1 - (t - a.rinculo) / 0.14), m = Math.max(0, 1 - (t - a.morso) / 0.15);
    const spara = animato(p, u.tipo, 'spara');
    let sx = (1 - respiro * 0.5) * molla * (1 - (spara ? 0.03 : 0.12) * r), sy = (1 + respiro) * molla * (1 + (spara ? 0.01 : 0.06) * r), rot = 0;
    // il morso arriva ogni 0,45 s: lampo leggero e corto, sennò chi viene mangiato resta sbiadito
    let ox = (spara ? 0 : -H * 0.05 * r) + Math.sin(t * 60) * H * 0.02 * m, bianco = m * 0.25;
    if (u.tipo === 'bomba') {
      const k = Math.min(1, (s.tick - u.nata) / Math.max(1, u.t - u.nata)), z = animato(p, 'bomba', 'gonfia') ? 0.06 : 0.35;
      sx *= 1 + z * k; sy *= 1 + z * k; ox += Math.sin(t * 50) * H * 0.03 * k;
      bianco = Math.max(bianco, k * (z < 0.1 ? 0.2 : 0.5) * (0.5 + 0.5 * Math.sin(t * 30)));
    }
    if (u.tipo === 'mina' && u.armata && !animato(p, 'mina', 'spunta')) { const k = Math.max(0, 1 - (t - a.armata) / 0.25); sy *= 1 + 0.3 * k; bianco = Math.max(bianco, Math.sin(t * 8) > 0.6 ? 0.35 : 0); }
    const crepe = u.tipo === 'muro' && !animato(p, 'muro', 'rosicchiato');
    if (crepe) { const f = u.vita / u.vitaMax; rot = f < 1 / 3 ? -0.1 : f < 2 / 3 ? -0.05 : 0; }
    if (u.tipo === 'produttore' && !animato(p, 'produttore', 'manovella') && u.t - s.tick < TICK_HZ) bianco = Math.max(bianco, 0.25 + 0.25 * Math.sin(t * 14));
    spr(p, posa, x + ox, y, H, { sx, sy, rot, bianco });
    if (crepe && u.vita < u.vitaMax * (2 / 3)) {
      g.strokeStyle = 'rgba(30,18,10,0.8)'; g.lineWidth = Math.max(2, H * 0.03);
      g.beginPath(); g.moveTo(x - H * 0.1, y - H * 0.75); g.lineTo(x + H * 0.02, y - H * 0.55); g.lineTo(x - H * 0.06, y - H * 0.4);
      if (u.vita < u.vitaMax / 3) { g.moveTo(x + H * 0.15, y - H * 0.6); g.lineTo(x + H * 0.04, y - H * 0.3); }
      g.stroke();
    }
  }

  function nemico(s: DState, p: Pelle, q: Inquadratura, e: DNemico, t: number): void {
    const a = A(e.id, t), H = altCasella(p, q, e.corsia), gelato = e.gelo > s.tick;
    if (!Number.isNaN(a.xPrima)) a.passo += Math.abs(a.xPrima - e.x) * 26;
    aggiorna(s, a, e.x, gelato, e.salto === 1);
    let alzo = 0;
    if (e.salto === 1) { const k = Math.min(1, (s.tick - e.saltoT0) / Math.max(1, e.saltoT1 - e.saltoT0)); alzo = Math.sin(k * Math.PI) * H * 0.9; }
    const [x, y] = scherm(p, q, e.x, e.corsia + CORSIA_PIEDI);
    const posa = posaNemico(s, p, e, a), cammina = animato(p, posa.k, 'cammina', 'corre');
    const colpo = Math.max(0, 1 - (s.tick - e.colpito) / TICK_HZ / 0.12);
    let rot = Math.sin(a.passo) * (cammina ? 0.012 : 0.07), by = cammina ? 0 : Math.abs(Math.sin(a.passo)) * H * 0.04, sy = 1;
    if (e.mangia > 0 && !animato(p, posa.k, 'mangia')) { rot = Math.sin(t * 15) * 0.12 - 0.06; sy = 1 + Math.sin(t * 15) * 0.04; }
    // senza testa: stordito sul posto (la caduta la fa il corpo dell'effetto quando sparisce)
    if (!e.testa) { rot = Math.sin(t * 9 + e.id) * 0.05; by = 0; sy = 1; }
    spr(p, posa, x, y - by - alzo, H, { rot, sy, bianco: colpo * (cammina ? 0.55 : 0.85), azzurro: gelato ? 0.7 : 0 });
  }

  function disegna(s: DState, p: Pelle, q: Inquadratura, fx: Effetti, t: number, dt: number, fantasma: Fantasma): void {
    sprite = 0; tickOra = s.tick;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.imageSmoothingEnabled = !p.pixel;
    g.fillStyle = p.tema.sfondo; g.fillRect(0, 0, q.W, q.H);
    g.drawImage(p.fondale, q.ox, q.oy, p.fondaleW * q.scala, p.fondaleH * q.scala);
    // corsie chiuse (tutorial): velate
    for (let r = 0; r < DIFESA.campo.corsie; r++) {
      if (s.corsie.includes(r)) continue;
      const a = scherm(p, q, 0, r), b = scherm(p, q, 9, r), c = scherm(p, q, 9, r + 1), d = scherm(p, q, 0, r + 1);
      g.fillStyle = 'rgba(40,26,14,0.55)'; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.lineTo(c[0], c[1]); g.lineTo(d[0], d[1]); g.closePath(); g.fill();
    }
    // la casella sotto il dito / il mouse
    if (fantasma) {
      const a = scherm(p, q, fantasma.col, fantasma.corsia), b = scherm(p, q, fantasma.col + 1, fantasma.corsia), c = scherm(p, q, fantasma.col + 1, fantasma.corsia + 1), d = scherm(p, q, fantasma.col, fantasma.corsia + 1);
      g.fillStyle = fantasma.ok ? 'rgba(255,255,255,0.28)' : 'rgba(255,60,60,0.25)';
      g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.lineTo(c[0], c[1]); g.lineTo(d[0], d[1]); g.closePath(); g.fill();
    }
    for (let r = 0; r < DIFESA.campo.corsie; r++) {
      const H = altCasella(p, q, r), tz = s.tosa[r]!;
      if (tz.stato !== 2 && s.corsie.includes(r)) {
        const [x, y] = scherm(p, q, tz.x, r + CORSIA_PIEDI);
        spr(p, posaTosaerba(s, p, tz.stato), x + (tz.stato === 1 ? Math.sin(t * 70) * 2 : 0), y, H);
        if (tz.stato === 1 && Math.random() < 0.5) {
          if (p.id !== 'segnaposto') fx.gocce(x + H * 0.45, y - H * 0.55, 2, H * 2.2);
          else fx.sbuffo(x - H * 0.3, y - H * 0.1, H * 0.2, 'rgba(230,220,200,0.8)', 1);
        }
      }
      for (const u of s.unita) if (u.corsia === r) unita(s, p, q, u, t);
      const ns = s.nemici.filter((e) => e.corsia === r).sort((a, b) => b.x - a.x);
      for (const e of ns) nemico(s, p, q, e, t);
      for (const c of s.colpi) {
        if (c.corsia !== r) continue;
        const [x, y] = scherm(p, q, c.x, r + CORSIA_PIEDI);
        spr(p, { k: c.gelo ? 'colpoGelo' : 'colpo', clip: 'fermo', i: 0 }, x, y - p.volo * H, H, { rot: t * 9 + c.id });
      }
    }
    if (fantasma && fantasma.ok && fantasma.tipo !== 'pala') {
      const [x, y] = scherm(p, q, fantasma.col + 0.5, fantasma.corsia + CORSIA_PIEDI);
      spr(p, { k: fantasma.tipo as ChiaveSprite, clip: 'fermo', i: 0 }, x, y, altCasella(p, q, fantasma.corsia), { alfa: 0.5 });
    }
    // le monete sopra tutto
    const mon = moneta(p), Hc = altCasella(p, q, 2);
    for (const m of s.monete) {
      const k = Math.min(1, (s.tick - m.nata) / Math.max(1, m.atterra - m.nata));
      const yy = m.cielo ? m.y0 + (m.yFine - m.y0) * k : m.y0 + (m.yFine - m.y0) * k - Math.sin(k * Math.PI) * 0.45;
      const [x, y] = scherm(p, q, m.x, yy);
      g.globalAlpha = m.sparisce - s.tick < 2 * TICK_HZ ? (Math.sin(t * 22) > 0 ? 1 : 0.35) : 1;
      mon(g, x, y + Math.sin(t * 3 + m.id) * 2, Hc);
      g.globalAlpha = 1;
    }
    fx.aggiorna(dt);
    fx.disegna(g, p, mon);
    for (const [id, a] of anim) if (t - a.nato > 2 && !s.unita.some((u) => u.id === id) && !s.nemici.some((e) => e.id === id)) anim.delete(id);
  }

  return {
    dimensiona, disegna,
    anim: (id: number, t: number) => A(id, t),
    /** A ogni partita nuova gli id ripartono da 1: la memoria delle animazioni va svuotata. */
    nuovaPartita: () => anim.clear(),
    /** Centro di una moneta sullo schermo e la sua altezza (per i tocchi e per farla volare al contatore). */
    dovMoneta(s: DState, p: Pelle, q: Inquadratura, id: number): [number, number, number] | null {
      const m = s.monete.find((x) => x.id === id); if (!m) return null;
      const k = Math.min(1, (s.tick - m.nata) / Math.max(1, m.atterra - m.nata));
      const yy = m.cielo ? m.y0 + (m.yFine - m.y0) * k : m.y0 + (m.yFine - m.y0) * k - Math.sin(k * Math.PI) * 0.45;
      const Hc = altCasella(p, q, 2), h = Hc * (p.sprite.moneta?.alto ?? 0.5), [x, y] = scherm(p, q, m.x, yy);
      return [x, y - h * 0.5, h];
    },
    /** Altezza di una casella a metà campo (per le monete che volano al contatore). */
    casellaH: (p: Pelle, q: Inquadratura) => altCasella(p, q, 2),
    quantiSprite: () => sprite,
  };
}
export type Resa = ReturnType<typeof creaResa>;
