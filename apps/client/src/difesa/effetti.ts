// Effetti della Difesa (#358, #379): particelle in pixel di schermo (sbuffi, schegge, scintille, gocce, scritte che salgono, monete che
// volano al contatore), corpi che cadono nella loro posa KO, armature che volano via girando e rimbalzano, scoppi a fotogrammi. Vivono
// solo nella resa: la sim non le vede.
import type { ChiaveSprite, NomeClip, Pelle, Posa } from './skin.ts';
import { clipDi, disegnaFoto } from './skin.ts';

type Particella = {
  tipo: 'sbuffo' | 'scheggia' | 'scintilla' | 'testo' | 'anello' | 'goccia';
  x: number; y: number; vx: number; vy: number; g: number; vita: number; max: number; r: number; colore: string; testo?: string;
};
type Corpo = { posa: Posa; x: number; y: number; H: number; t: number; max: number; vola: number };
type Pezzo = { k: ChiaveSprite; x: number; y: number; terra: number; vx: number; vy: number; rot: number; vr: number; H: number; t: number; max: number };
type Scoppio = { k: ChiaveSprite; clip: NomeClip; x: number; y: number; H: number; t: number; max: number };
type Volo = { x0: number; y0: number; x1: number; y1: number; t: number; max: number; H: number };
export type DisegnaMoneta = (g: CanvasRenderingContext2D, x: number, y: number, Hc: number) => void;

export type Effetti = {
  sbuffo(x: number, y: number, r: number, colore: string, n?: number): void;
  schegge(x: number, y: number, colore: string, n: number, forza: number): void;
  scintille(x: number, y: number, n: number, colore?: string): void;
  gocce(x: number, y: number, n: number, forza: number): void;
  anello(x: number, y: number, r: number, colore: string): void;
  testo(x: number, y: number, t: string, colore: string): void;
  /** Il nemico che cade (vola = travolto dall'annaffiatoio: vola via girando). `H` = altezza della casella. */
  corpo(posa: Posa, x: number, y: number, H: number, vola?: number): void;
  /** Un pezzo (ghianda, vasetto) che salta via girando, rimbalza sulla riga `y` e sparisce. Ritorna false se la pelle non ce l'ha. */
  pezzo(p: Pelle, k: ChiaveSprite, x: number, y: number, H: number): boolean;
  /** Una clip suonata una volta (lo scoppio). Ritorna false se la pelle non ce l'ha. */
  scoppio(p: Pelle, k: ChiaveSprite, clip: NomeClip, x: number, y: number, H: number, durata: number): boolean;
  volo(x0: number, y0: number, x1: number, y1: number, Hc: number): void;
  aggiorna(dt: number): void;
  disegna(g: CanvasRenderingContext2D, p: Pelle, moneta: DisegnaMoneta): void;
  svuota(): void;
  quanti(): number;
};

export function creaEffetti(): Effetti {
  const P: Particella[] = [], C: Corpo[] = [], Z: Pezzo[] = [], B: Scoppio[] = [], V: Volo[] = [];
  const caso = (a: number, b: number) => a + Math.random() * (b - a);
  const metti = (q: Particella) => { if (P.length < 400) P.push(q); };
  return {
    sbuffo(x, y, r, colore, n = 6) { for (let i = 0; i < n; i++) metti({ tipo: 'sbuffo', x: x + caso(-r, r) * 0.4, y: y + caso(-r, r) * 0.3, vx: caso(-30, 30), vy: caso(-50, -10), g: 0, vita: 0, max: caso(0.35, 0.6), r: r * caso(0.3, 0.6), colore }); },
    schegge(x, y, colore, n, forza) { for (let i = 0; i < n; i++) { const a = caso(-Math.PI, 0); metti({ tipo: 'scheggia', x, y, vx: Math.cos(a) * caso(0.3, 1) * forza, vy: Math.sin(a) * caso(0.4, 1) * forza, g: forza * 2.6, vita: 0, max: caso(0.4, 0.8), r: caso(2, 5), colore }); } },
    scintille(x, y, n, colore = '#fff6b0') { for (let i = 0; i < n; i++) { const a = caso(0, Math.PI * 2); metti({ tipo: 'scintilla', x, y, vx: Math.cos(a) * caso(30, 90), vy: Math.sin(a) * caso(30, 90), g: 0, vita: 0, max: caso(0.25, 0.5), r: caso(2, 4), colore }); } },
    gocce(x, y, n, forza) { for (let i = 0; i < n; i++) { const a = caso(-0.9, -0.1); metti({ tipo: 'goccia', x, y, vx: Math.cos(a) * caso(0.5, 1) * forza, vy: Math.sin(a) * caso(0.3, 1) * forza, g: forza * 2.2, vita: 0, max: caso(0.3, 0.55), r: caso(2.5, 4.5), colore: '#9fdcff' }); } },
    anello(x, y, r, colore) { metti({ tipo: 'anello', x, y, vx: 0, vy: 0, g: 0, vita: 0, max: 0.45, r, colore }); },
    testo(x, y, t, colore) { metti({ tipo: 'testo', x, y, vx: 0, vy: -40, g: 0, vita: 0, max: 0.9, r: 0, colore, testo: t }); },
    corpo(posa, x, y, H, vola = 0) { C.push({ posa, x, y, H, t: 0, max: vola ? 0.6 : 0.7, vola }); },
    pezzo(p, k, x, y, H) {
      if (!p.sprite[k]) return false;
      Z.push({ k, x, y: y - H * 0.55, terra: y, vx: caso(0.9, 1.5) * H, vy: -caso(2.2, 2.8) * H, rot: 0, vr: caso(7, 11), H, t: 0, max: 1.1 });
      return true;
    },
    scoppio(p, k, clip, x, y, H, durata) {
      if (!clipDi(p, k, clip)) return false;
      B.push({ k, clip, x, y, H, t: 0, max: durata });
      return true;
    },
    volo(x0, y0, x1, y1, Hc) { V.push({ x0, y0, x1, y1, t: 0, max: 0.45, H: Hc }); },
    aggiorna(dt) {
      for (let i = P.length - 1; i >= 0; i--) {
        const q = P[i]!;
        q.vita += dt; if (q.vita >= q.max) { P.splice(i, 1); continue; }
        q.vy += q.g * dt; q.x += q.vx * dt; q.y += q.vy * dt;
        if (q.tipo === 'sbuffo') { q.vx *= 0.92; q.vy *= 0.92; }
      }
      for (let i = C.length - 1; i >= 0; i--) { C[i]!.t += dt; if (C[i]!.t >= C[i]!.max) C.splice(i, 1); }
      for (let i = Z.length - 1; i >= 0; i--) {
        const z = Z[i]!;
        z.t += dt; if (z.t >= z.max) { Z.splice(i, 1); continue; }
        z.vy += z.H * 7 * dt; z.x += z.vx * dt; z.y += z.vy * dt; z.rot += z.vr * dt;
        if (z.y > z.terra && z.vy > 0) { z.y = z.terra; z.vy *= -0.35; z.vx *= 0.5; z.vr *= 0.4; }
      }
      for (let i = B.length - 1; i >= 0; i--) { B[i]!.t += dt; if (B[i]!.t >= B[i]!.max) B.splice(i, 1); }
      for (let i = V.length - 1; i >= 0; i--) { V[i]!.t += dt; if (V[i]!.t >= V[i]!.max) V.splice(i, 1); }
    },
    disegna(g, p, moneta) {
      for (const c of C) {
        const k = c.t / c.max;
        const alfa = Math.max(0, 1 - Math.max(0, k - 0.5) * 2);
        // a terra: si piega all'indietro (verso destra: guardano a sinistra) e sparisce; travolto: vola via girando
        disegnaFoto(g, p, c.posa, c.x + c.vola * k * c.H * 0.9, c.y - c.vola * Math.sin(k * Math.PI) * c.H * 0.5, c.H,
          { rot: c.vola ? k * 6 : Math.min(1, k * 1.8) * 1.35, alfa });
      }
      for (const z of Z) disegnaFoto(g, p, { k: z.k, clip: 'fermo', i: 0 }, z.x, z.y, z.H, { rot: z.rot, alfa: Math.min(1, (z.max - z.t) / 0.3) });
      for (const b of B) {
        const n = clipDi(p, b.k, b.clip)?.c.f.length ?? 1, k = b.t / b.max;
        disegnaFoto(g, p, { k: b.k, clip: b.clip, i: Math.min(n - 1, Math.floor(k * n)) }, b.x, b.y, b.H, { alfa: k > 0.8 ? (1 - k) * 5 : 1, sx: 0.9 + 0.2 * k, sy: 0.9 + 0.2 * k });
      }
      for (const q of P) {
        const k = q.vita / q.max;
        g.globalAlpha = q.tipo === 'testo' ? Math.min(1, 2 - 2 * k) : 1 - k;
        if (q.tipo === 'sbuffo') { g.fillStyle = q.colore; g.beginPath(); g.arc(q.x, q.y, Math.max(0.1, q.r * (1 + k * 1.5)), 0, Math.PI * 2); g.fill(); }
        else if (q.tipo === 'anello') { g.strokeStyle = q.colore; g.lineWidth = 6 * (1 - k) + 1; g.beginPath(); g.arc(q.x, q.y, Math.max(0.1, q.r * (0.3 + k)), 0, Math.PI * 2); g.stroke(); }
        else if (q.tipo === 'goccia') { g.fillStyle = q.colore; g.beginPath(); g.arc(q.x, q.y, Math.max(0.1, q.r), 0, Math.PI * 2); g.fill(); }
        else if (q.tipo === 'testo') { g.font = `bold ${22}px MzTitan, sans-serif`; g.textAlign = 'center'; g.lineWidth = 4; g.strokeStyle = '#1b120c'; g.strokeText(q.testo!, q.x, q.y); g.fillStyle = q.colore; g.fillText(q.testo!, q.x, q.y); }
        else { g.fillStyle = q.colore; g.fillRect(q.x - q.r, q.y - q.r, q.r * 2, q.r * 2); }
      }
      g.globalAlpha = 1;
      for (const v of V) {
        const k = v.t / v.max, e = 1 - (1 - k) * (1 - k);
        moneta(g, v.x0 + (v.x1 - v.x0) * e, v.y0 + (v.y1 - v.y0) * e - Math.sin(k * Math.PI) * 40, v.H * (1 - 0.4 * k));
      }
    },
    svuota() { P.length = 0; C.length = 0; Z.length = 0; B.length = 0; V.length = 0; },
    quanti: () => P.length + C.length + Z.length + B.length + V.length,
  };
}
