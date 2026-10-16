// La resa della Difesa (#358) su un canvas 2D: fondale, tosaerba, difensori, nemici, colpi, monete ed effetti, corsia per corsia dall'alto
// in basso (così chi sta sotto copre chi sta sopra). Tutto il movimento in più è animazione da codice sugli sprite fermi della pelle:
// respiro e spuntata dei difensori, rinculo di chi spara, miccia della bomba, passo che ondeggia e morso dei nemici, lampo bianco quando
// li colpisci, azzurro quando sono gelati, caduta quando perdono la testa, salto del saltatore.
import type { DState, DNemico, DUnita } from '@marea/sim/difesa/stato.ts';
import { DIFESA } from '@marea/content/difesa.ts';
import { TICK_HZ } from '@marea/sim/constants.ts';
import type { ChiaveSprite, Pelle } from './skin.ts';
import type { Inquadratura } from './tavolo.ts';
import { aSchermo, casella, suFondale } from './tavolo.ts';
import type { Effetti } from './effetti.ts';

/** Tempi (secondi della resa) degli ultimi fatti di ogni cosa in campo, dagli eventi della sim. */
export type Anim = { nato: number; colpo: number; rinculo: number; morso: number; armata: number; passo: number; xPrima: number };
export type Fantasma = { tipo: string; corsia: number; col: number; ok: boolean } | null;

const CORSIA_PIEDI = 0.8;

export function creaResa(tela: HTMLCanvasElement) {
  const g = tela.getContext('2d')!;
  const anim = new Map<number, Anim>();
  let dpr = 1, sprite = 0;
  const A = (id: number, t: number): Anim => { let a = anim.get(id); if (!a) { a = { nato: t, colpo: -9, rinculo: -9, morso: -9, armata: -9, passo: Math.random() * 6, xPrima: NaN }; anim.set(id, a); } return a; };

  function dimensiona(W: number, H: number, pixel: boolean): void {
    dpr = Math.min(2, window.devicePixelRatio || 1) * (pixel ? 0.5 : 1);
    tela.width = Math.max(1, Math.round(W * dpr)); tela.height = Math.max(1, Math.round(H * dpr));
    tela.style.imageRendering = pixel ? 'pixelated' : 'auto';
  }

  /** Disegna uno sprite coi piedi in (x, y) di schermo, alto `h` px, con scala, rotazione e le copie colorate sopra. */
  function spr(p: Pelle, k: ChiaveSprite, x: number, y: number, h: number, o: { sx?: number; sy?: number; rot?: number; alfa?: number; bianco?: number; azzurro?: number; specchio?: boolean } = {}): void {
    const sp = p.sprite[k]; if (!sp) return;
    sprite++;
    const w = (h * sp.w) / sp.h, sx = o.sx ?? 1, sy = o.sy ?? 1;
    g.save();
    g.translate(x, y);
    if (o.rot) g.rotate(o.rot);
    g.scale(o.specchio ? -sx : sx, sy);
    if (o.alfa !== undefined) g.globalAlpha = o.alfa;
    const dx = (-sp.px / sp.w) * w, dy = (-sp.py / sp.h) * h;
    g.drawImage(sp.img, sp.x, sp.y, sp.w, sp.h, dx, dy, w, h);
    if (o.azzurro && p.azzurro[k]) { g.globalAlpha = (o.alfa ?? 1) * o.azzurro; g.drawImage(p.azzurro[k]!, dx, dy, w, h); }
    if (o.bianco && p.bianco[k]) { g.globalAlpha = (o.alfa ?? 1) * o.bianco; g.drawImage(p.bianco[k]!, dx, dy, w, h); }
    g.restore();
  }
  const scherm = (p: Pelle, q: Inquadratura, x: number, y: number) => aSchermo(q, suFondale(p, x, y));
  const altCasella = (p: Pelle, q: Inquadratura, corsia: number) => casella(p, corsia + 0.5)[1] * q.scala;

  function moneta(p: Pelle) {
    return (gg: CanvasRenderingContext2D, x: number, y: number, h: number) => {
      const sp = p.sprite.moneta; if (!sp) return;
      const w = (h * sp.w) / sp.h;
      gg.globalAlpha = 0.35; gg.fillStyle = '#fff6b0'; gg.beginPath(); gg.arc(x, y - h * 0.5, h * 0.62, 0, Math.PI * 2); gg.fill(); gg.globalAlpha = 1;
      gg.drawImage(sp.img, sp.x, sp.y, sp.w, sp.h, x - w / 2, y - h, w, h);
    };
  }

  function unita(s: DState, p: Pelle, q: Inquadratura, u: DUnita, t: number): void {
    const a = A(u.id, t), [x, y] = scherm(p, q, u.col + 0.5, u.corsia + CORSIA_PIEDI), H = altCasella(p, q, u.corsia);
    const sp = p.sprite[u.tipo]; if (!sp) return;
    const pop = Math.min(1, (t - a.nato) / 0.18), molla = pop < 1 ? 0.3 + 0.7 * pop + Math.sin(pop * Math.PI) * 0.25 : 1;
    const respiro = Math.sin(t * 5.6 + u.id) * 0.03, r = Math.max(0, 1 - (t - a.rinculo) / 0.14), m = Math.max(0, 1 - (t - a.morso) / 0.2);
    let sx = (1 - respiro * 0.5) * molla * (1 - 0.12 * r), sy = (1 + respiro) * molla * (1 + 0.06 * r), rot = 0, ox = -H * 0.05 * r + Math.sin(t * 60) * H * 0.02 * m;
    let chiave: ChiaveSprite = u.tipo, bianco = m * 0.5;
    if (u.tipo === 'bomba') { const k = Math.min(1, (s.tick - u.nata) / Math.max(1, u.t - u.nata)); sx *= 1 + 0.35 * k; sy *= 1 + 0.35 * k; ox += Math.sin(t * 50) * H * 0.03 * k; bianco = Math.max(bianco, k * 0.5 * (0.5 + 0.5 * Math.sin(t * 30))); }
    if (u.tipo === 'mina' && !u.armata) chiave = 'minaSotto';
    if (u.tipo === 'mina' && u.armata) { const k = Math.max(0, 1 - (t - a.armata) / 0.25); sy *= 1 + 0.3 * k; bianco = Math.max(bianco, (Math.sin(t * 8) > 0.6 ? 0.35 : 0)); }
    if (u.tipo === 'muro') { const f = u.vita / u.vitaMax; rot = f < 1 / 3 ? -0.1 : f < 2 / 3 ? -0.05 : 0; }
    if (u.tipo === 'produttore' && u.t - s.tick < TICK_HZ) bianco = Math.max(bianco, 0.25 + 0.25 * Math.sin(t * 14));
    spr(p, chiave, x + ox, y, H * (p.sprite[chiave]?.alto ?? sp.alto), { sx, sy, rot, bianco });
    if (u.tipo === 'muro' && u.vita < u.vitaMax * (2 / 3)) {
      g.strokeStyle = 'rgba(30,18,10,0.8)'; g.lineWidth = Math.max(2, H * 0.03);
      g.beginPath(); g.moveTo(x - H * 0.1, y - H * 0.75); g.lineTo(x + H * 0.02, y - H * 0.55); g.lineTo(x - H * 0.06, y - H * 0.4);
      if (u.vita < u.vitaMax / 3) { g.moveTo(x + H * 0.15, y - H * 0.6); g.lineTo(x + H * 0.04, y - H * 0.3); }
      g.stroke();
    }
  }

  function nemico(s: DState, p: Pelle, q: Inquadratura, e: DNemico, t: number): void {
    const a = A(e.id, t), H = altCasella(p, q, e.corsia);
    if (!Number.isNaN(a.xPrima)) a.passo += Math.abs(a.xPrima - e.x) * 26;
    a.xPrima = e.x;
    let alzo = 0;
    if (e.salto === 1) { const k = Math.min(1, (s.tick - e.saltoT0) / Math.max(1, e.saltoT1 - e.saltoT0)); alzo = Math.sin(k * Math.PI) * H * 0.9; }
    const [x, y] = scherm(p, q, e.x, e.corsia + CORSIA_PIEDI);
    const mangia = e.mangia > 0, colpo = Math.max(0, 1 - (s.tick - e.colpito) / TICK_HZ / 0.12);
    let rot = Math.sin(a.passo) * 0.07, by = Math.abs(Math.sin(a.passo)) * H * 0.04, sx = 1, sy = 1;
    if (mangia) { rot = Math.sin(t * 15) * 0.12 - 0.06; sy = 1 + Math.sin(t * 15) * 0.04; }
    let chiave: ChiaveSprite = e.tipo;
    if ((e.tipo === 'cono' || e.tipo === 'secchio') && e.armatura <= 0) chiave = 'base';
    let alfa = 1;
    if (!e.testa) { const k = Math.max(0, 1 - (e.muore - s.tick) / TICK_HZ); rot = -k * 1.4; alfa = 1 - Math.max(0, k - 0.6) * 2.5; by = 0; }
    spr(p, chiave, x, y - by - alzo, H * (p.sprite[chiave]?.alto ?? 1.15), { rot, sx, sy, alfa, bianco: colpo * 0.85, azzurro: e.gelo > s.tick ? 0.7 : 0 });
  }

  function disegna(s: DState, p: Pelle, q: Inquadratura, fx: Effetti, t: number, dt: number, fantasma: Fantasma): void {
    sprite = 0;
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
        spr(p, 'tosaerba', x + (tz.stato === 1 ? Math.sin(t * 70) * 2 : 0), y, H * (p.sprite.tosaerba?.alto ?? 0.55));
        if (tz.stato === 1 && Math.random() < 0.5) fx.sbuffo(x - H * 0.3, y - H * 0.1, H * 0.2, 'rgba(230,220,200,0.8)', 1);
      }
      for (const u of s.unita) if (u.corsia === r) unita(s, p, q, u, t);
      const ns = s.nemici.filter((e) => e.corsia === r).sort((a, b) => b.x - a.x);
      for (const e of ns) nemico(s, p, q, e, t);
      for (const c of s.colpi) {
        if (c.corsia !== r) continue;
        const [x, y] = scherm(p, q, c.x, r + 0.42);
        spr(p, c.gelo ? 'colpoGelo' : 'colpo', x, y + H * 0.11, H * (p.sprite.colpo?.alto ?? 0.22));
      }
    }
    if (fantasma && fantasma.ok && fantasma.tipo !== 'pala') {
      const [x, y] = scherm(p, q, fantasma.col + 0.5, fantasma.corsia + CORSIA_PIEDI), sp = p.sprite[fantasma.tipo as ChiaveSprite];
      if (sp) spr(p, fantasma.tipo as ChiaveSprite, x, y, altCasella(p, q, fantasma.corsia) * sp.alto, { alfa: 0.5 });
    }
    // le monete sopra tutto
    const mon = moneta(p);
    for (const m of s.monete) {
      const H = altCasella(p, q, 2) * (p.sprite.moneta?.alto ?? 0.5);
      let yy: number;
      const k = Math.min(1, (s.tick - m.nata) / Math.max(1, m.atterra - m.nata));
      if (m.cielo) yy = m.y0 + (m.yFine - m.y0) * k;
      else yy = m.y0 + (m.yFine - m.y0) * k - Math.sin(k * Math.PI) * 0.45;
      const [x, y] = scherm(p, q, m.x, yy);
      const ultimi = m.sparisce - s.tick < 2 * TICK_HZ ? (Math.sin(t * 22) > 0 ? 1 : 0.35) : 1;
      g.globalAlpha = ultimi;
      mon(g, x, y + Math.sin(t * 3 + m.id) * 2, H);
      g.globalAlpha = 1;
    }
    fx.aggiorna(dt);
    fx.disegna(g, p, mon);
    for (const [id, a] of anim) if (t - a.nato > 2 && !s.unita.some((u) => u.id === id) && !s.nemici.some((e) => e.id === id)) anim.delete(id);
  }

  return {
    dimensiona, disegna, anim: A,
    /** Centro di una moneta sullo schermo (per i tocchi e per farla volare al contatore). */
    dovMoneta(s: DState, p: Pelle, q: Inquadratura, id: number): [number, number, number] | null {
      const m = s.monete.find((x) => x.id === id); if (!m) return null;
      const k = Math.min(1, (s.tick - m.nata) / Math.max(1, m.atterra - m.nata));
      const yy = m.cielo ? m.y0 + (m.yFine - m.y0) * k : m.y0 + (m.yFine - m.y0) * k - Math.sin(k * Math.PI) * 0.45;
      const H = altCasella(p, q, 2) * (p.sprite.moneta?.alto ?? 0.5), [x, y] = scherm(p, q, m.x, yy);
      return [x, y - H * 0.5, H];
    },
    quantiSprite: () => sprite,
  };
}
export type Resa = ReturnType<typeof creaResa>;
