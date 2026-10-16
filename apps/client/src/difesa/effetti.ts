// Effetti della Difesa (#358): particelle in pixel di schermo (sbuffi, schegge, scintille, scritte che salgono, monete che volano al
// contatore, corpi che cadono). Vivono solo nella resa: la sim non le vede.
import type { ChiaveSprite, Pelle } from './skin.ts';

type Particella = {
  tipo: 'sbuffo' | 'scheggia' | 'scintilla' | 'testo' | 'anello';
  x: number; y: number; vx: number; vy: number; g: number; vita: number; max: number; r: number; colore: string; testo?: string;
};
type Corpo = { chiave: ChiaveSprite; x: number; y: number; h: number; t: number; max: number; vola: number };
type Volo = { x0: number; y0: number; x1: number; y1: number; t: number; max: number; h: number };

export type Effetti = {
  sbuffo(x: number, y: number, r: number, colore: string, n?: number): void;
  schegge(x: number, y: number, colore: string, n: number, forza: number): void;
  scintille(x: number, y: number, n: number, colore?: string): void;
  anello(x: number, y: number, r: number, colore: string): void;
  testo(x: number, y: number, t: string, colore: string): void;
  corpo(chiave: ChiaveSprite, x: number, y: number, h: number, vola?: number): void;
  volo(x0: number, y0: number, x1: number, y1: number, h: number): void;
  aggiorna(dt: number): void;
  disegna(g: CanvasRenderingContext2D, p: Pelle, moneta: (g: CanvasRenderingContext2D, x: number, y: number, h: number) => void): void;
  quanti(): number;
};

export function creaEffetti(): Effetti {
  const P: Particella[] = [], C: Corpo[] = [], V: Volo[] = [];
  const caso = (a: number, b: number) => a + Math.random() * (b - a);
  const metti = (q: Particella) => { if (P.length < 400) P.push(q); };
  return {
    sbuffo(x, y, r, colore, n = 6) { for (let i = 0; i < n; i++) metti({ tipo: 'sbuffo', x: x + caso(-r, r) * 0.4, y: y + caso(-r, r) * 0.3, vx: caso(-30, 30), vy: caso(-50, -10), g: 0, vita: 0, max: caso(0.35, 0.6), r: r * caso(0.3, 0.6), colore }); },
    schegge(x, y, colore, n, forza) { for (let i = 0; i < n; i++) { const a = caso(-Math.PI, 0); metti({ tipo: 'scheggia', x, y, vx: Math.cos(a) * caso(0.3, 1) * forza, vy: Math.sin(a) * caso(0.4, 1) * forza, g: forza * 2.6, vita: 0, max: caso(0.4, 0.8), r: caso(2, 5), colore }); } },
    scintille(x, y, n, colore = '#fff6b0') { for (let i = 0; i < n; i++) { const a = caso(0, Math.PI * 2); metti({ tipo: 'scintilla', x, y, vx: Math.cos(a) * caso(30, 90), vy: Math.sin(a) * caso(30, 90), g: 0, vita: 0, max: caso(0.25, 0.5), r: caso(2, 4), colore }); } },
    anello(x, y, r, colore) { metti({ tipo: 'anello', x, y, vx: 0, vy: 0, g: 0, vita: 0, max: 0.45, r, colore }); },
    testo(x, y, t, colore) { metti({ tipo: 'testo', x, y, vx: 0, vy: -40, g: 0, vita: 0, max: 0.9, r: 0, colore, testo: t }); },
    corpo(chiave, x, y, h, vola = 0) { C.push({ chiave, x, y, h, t: 0, max: vola ? 0.6 : 0.75, vola }); },
    volo(x0, y0, x1, y1, h) { V.push({ x0, y0, x1, y1, t: 0, max: 0.45, h }); },
    aggiorna(dt) {
      for (let i = P.length - 1; i >= 0; i--) {
        const q = P[i]!;
        q.vita += dt; if (q.vita >= q.max) { P.splice(i, 1); continue; }
        q.vy += q.g * dt; q.x += q.vx * dt; q.y += q.vy * dt;
        if (q.tipo === 'sbuffo') { q.vx *= 0.92; q.vy *= 0.92; }
      }
      for (let i = C.length - 1; i >= 0; i--) { C[i]!.t += dt; if (C[i]!.t >= C[i]!.max) C.splice(i, 1); }
      for (let i = V.length - 1; i >= 0; i--) { V[i]!.t += dt; if (V[i]!.t >= V[i]!.max) V.splice(i, 1); }
    },
    disegna(g, p, moneta) {
      for (const c of C) {
        const sp = p.sprite[c.chiave]; if (!sp) continue;
        const k = c.t / c.max, w = (c.h * sp.w) / sp.h;
        g.save();
        g.globalAlpha = Math.max(0, 1 - Math.max(0, k - 0.5) * 2);
        g.translate(c.x + c.vola * k * 60, c.y - c.vola * Math.sin(k * Math.PI) * 40);
        g.rotate(c.vola ? k * 6 : -Math.min(1, k * 1.6) * 1.45);
        g.drawImage(sp.img, sp.x, sp.y, sp.w, sp.h, (-sp.px / sp.w) * w, (-sp.py / sp.h) * c.h, w, c.h);
        g.restore();
      }
      for (const q of P) {
        const k = q.vita / q.max;
        g.globalAlpha = q.tipo === 'testo' ? Math.min(1, 2 - 2 * k) : 1 - k;
        if (q.tipo === 'sbuffo') { g.fillStyle = q.colore; g.beginPath(); g.arc(q.x, q.y, q.r * (1 + k * 1.5), 0, Math.PI * 2); g.fill(); }
        else if (q.tipo === 'anello') { g.strokeStyle = q.colore; g.lineWidth = 6 * (1 - k) + 1; g.beginPath(); g.arc(q.x, q.y, q.r * (0.3 + k), 0, Math.PI * 2); g.stroke(); }
        else if (q.tipo === 'testo') { g.font = `bold ${22}px MzTitan, sans-serif`; g.textAlign = 'center'; g.lineWidth = 4; g.strokeStyle = '#1b120c'; g.strokeText(q.testo!, q.x, q.y); g.fillStyle = q.colore; g.fillText(q.testo!, q.x, q.y); }
        else { g.fillStyle = q.colore; g.fillRect(q.x - q.r, q.y - q.r, q.r * 2, q.r * 2); }
      }
      g.globalAlpha = 1;
      for (const v of V) {
        const k = v.t / v.max, e = 1 - (1 - k) * (1 - k);
        moneta(g, v.x0 + (v.x1 - v.x0) * e, v.y0 + (v.y1 - v.y0) * e - Math.sin(k * Math.PI) * 40, v.h * (1 - 0.4 * k));
      }
    },
    quanti: () => P.length + C.length + V.length,
  };
}
