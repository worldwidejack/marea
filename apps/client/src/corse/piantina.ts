// Le minimappe delle Corse in un posto solo: quella delle gare (`creaMinimappa`
// in effetti.ts) e il disegno del tracciato nei pannelli di scelta (`pannelli.ts`). Una piantina è una tela fissa
// con la pianta adattata al riquadro (Nord in alto): lo sfondo si disegna una volta e si tiene da parte, a ogni fotogramma si rimette e
// sopra vanno i segnalini. Cosa c'è nello sfondo (la pista) lo decide chi la usa.
// La minimappa del mondo (ui/minimappa.ts: zoom, mappa grande, isole da scoprire, navigatore) è un'altra cosa e sta lì.
import { P } from '../render/island_parts.ts';
import type { Pista } from '@marea/sim/corse/pista.ts';

/** Metri del mondo → pixel della tela: il riquadro (x0, z0)-(x1, z1) sta dentro W×H lasciando `margine` px in tutto, al centro. */
export function adatta(x0: number, z0: number, x1: number, z1: number, W: number, H: number, margine: number): { mx(x: number): number; mz(z: number): number } {
  const dx = Math.max(1, x1 - x0), dz = Math.max(1, z1 - z0);
  const k = Math.min((W - margine) / dx, (H - margine) / dz), ox = (W - dx * k) / 2, oz = (H - dz * k) / 2;
  return { mx: (x) => ox + (x - x0) * k, mz: (z) => oz + (z - z0) * k };
}

type Linea = Pista['n'];
/** La linea della pista e quelle dei rami (scorciatoie). */
export const lineePista = (p: Pista): Linea[] => [p.n, ...p.rami.map((r) => r.n)];
/** Il riquadro che contiene tutte le linee. */
export function riquadroLinee(linee: readonly Linea[]): [number, number, number, number] {
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const n of linee) for (let i = 0; i < n.n; i++) { x0 = Math.min(x0, n.x[i]!); x1 = Math.max(x1, n.x[i]!); z0 = Math.min(z0, n.z[i]!); z1 = Math.max(z1, n.z[i]!); }
  return [x0, z0, x1, z1];
}
/** Una linea come spezzata (un punto ogni due), chiusa se la pista è un anello; il tratto lo sceglie chi chiama. */
export function tracciaLinea(g: CanvasRenderingContext2D, n: Linea, mx: (x: number) => number, mz: (z: number) => number): void {
  g.beginPath();
  for (let i = 0; i < n.n; i += 2) { if (i) g.lineTo(mx(n.x[i]!), mz(n.z[i]!)); else g.moveTo(mx(n.x[i]!), mz(n.z[i]!)); }
  if (n.chiuso) g.closePath();
  g.stroke();
}
/** L'indice del campione del traguardo sulla linea della pista. */
export const viaDi = (p: Pista): number => Math.round(p.def.via / p.n.passo) % p.n.n;

export type Piantina = {
  readonly el: HTMLCanvasElement;
  readonly g: CanvasRenderingContext2D | null;
  mx(x: number): number; mz(z: number): number;
  /** Il riquadro del mondo (m) da far stare nella tela. */
  inquadra(x0: number, z0: number, x1: number, z1: number): void;
  /** Disegna lo sfondo da capo e lo tiene da parte. */
  sfondo(disegna: (g: CanvasRenderingContext2D) => void): void;
  /** Rimette lo sfondo, per disegnarci sopra i segnalini. false = lo sfondo non c'è ancora. */
  rimetti(): boolean;
  /** Quadratino di lato 2r col bordo di 1 px, centrato su (x, z) del mondo. */
  quadro(x: number, z: number, r: number, colore: string, bordo?: string): void;
};

export function creaPiantina(root: HTMLElement, o: { W: number; H: number; margine: number; id: string; cls: string }): Piantina {
  const { W, H } = o, el = document.createElement('canvas');
  el.width = W; el.height = H; el.id = o.id; el.className = o.cls;
  root.appendChild(el);
  const g = el.getContext('2d');
  let fondo: ImageData | null = null, m = { mx: (x: number) => x, mz: (z: number) => z };
  const pi: Piantina = {
    el, g,
    mx: (x) => m.mx(x), mz: (z) => m.mz(z),
    inquadra(x0, z0, x1, z1) { m = adatta(x0, z0, x1, z1, W, H, o.margine); },
    sfondo(disegna) { if (!g) return; g.clearRect(0, 0, W, H); disegna(g); fondo = g.getImageData(0, 0, W, H); },
    rimetti() { if (!g || !fondo) return false; g.putImageData(fondo, 0, 0); return true; },
    quadro(x, z, r, colore, bordo = P.neroCaldo) {
      if (!g) return;
      g.fillStyle = bordo; g.fillRect(Math.round(m.mx(x)) - r - 1, Math.round(m.mz(z)) - r - 1, r * 2 + 2, r * 2 + 2);
      g.fillStyle = colore; g.fillRect(Math.round(m.mx(x)) - r, Math.round(m.mz(z)) - r, r * 2, r * 2);
    },
  };
  return pi;
}
