// Le costruzioni procedurali dell'hub delle Corse (#185) che il kit non ha: festoni, lampioni al neon, insegne, giostre, conchiglie
// giganti, nuvole, il teschio in cima al monte. Sulla tela, sull'atlas (vedi mondo_base.ts); le mette mondo_pezzi.ts.
import { Tela, h01 } from './mondo_base.ts';
import type { NomeP, Pennello, V3 } from './mondo_base.ts';
import type { Tele } from './mondo_mesh.ts';

// ---------- costruzioni procedurali (sulla tela, sull'atlas) ----------
const P_ = (p: NomeP, tinta?: number): Pennello => ({ p, tinta });
/** Festone: filo che pende tra due punti con le bandierine triangolari colorate. */
export function festone(tl: Tela, a: V3, b: V3, seme: number): void {
  const n = Math.max(6, Math.round(Math.hypot(b[0] - a[0], b[2] - a[2]) / 1.1)), cols: NomeP[] = ['rosso', 'giallo', 'acquaProfonda', 'erba', 'arancio', 'pietraChiara'];
  const p = (t: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - Math.sin(t * Math.PI) * 1.1, a[2] + (b[2] - a[2]) * t];
  for (let k = 0; k < n; k++) {
    const t0 = k / n, t1 = (k + 1) / n, q0 = p(t0), q1 = p(t1), m = p((t0 + t1) / 2);
    const col = P_(cols[(k + seme) % cols.length]!), basso: V3 = [m[0], m[1] - 0.55, m[2]];
    tl.quad(q0, q1, basso, basso, col); tl.quad(q1, q0, basso, basso, col);
  }
}
/** Lampione al neon: palo scuro, braccio, luce emissiva colorata. */
export function lampioneNeon(tele: Tele, x: number, y: number, z: number, k: number): void {
  const tl = tele.at(x, z, 'pv'), col = (['emCiano', 'emRosa', 'emViola'] as const)[k % 3]!;
  tl.box(x, y, z, 0.22, 4.6, 0.22, 0, P_('neroCaldo'));
  tele.e.box(x, y + 4.6, z, 0.5, 0.5, 0.5, 0, { t: col });
}
/** Insegne luminose sulla facciata di un palazzo (davanti −Z del palazzo = verso la strada). */
export function insegna(tele: Tele, x: number, y: number, z: number, ry: number, alto: number, k: number): void {
  const cols = ['emRosa', 'emCiano', 'emViola', 'emVerde', 'emAmbra'] as const, c = Math.cos(ry), s = Math.sin(ry);
  const at = (lx: number, ly: number, lz: number): V3 => [x + lx * c + lz * s, y + ly, z - lx * s + lz * c];
  const fronte = -4.7, hTot = 10 * alto;
  // insegna verticale sul fronte e una fascia orizzontale
  const v0 = 2.2 + h01(k, ry * 100 | 0, 5) * 2, col = cols[k % 5]!, col2 = cols[(k + 2) % 5]!;
  const w = 1.1, xs = -3 + (k % 3) * 1.4;
  tele.e.quad(at(xs - w / 2, v0, fronte - 0.6), at(xs + w / 2, v0, fronte - 0.6), at(xs + w / 2, Math.min(hTot - 1, v0 + 6), fronte - 0.6), at(xs - w / 2, Math.min(hTot - 1, v0 + 6), fronte - 0.6), { t: col });
  tele.e.quad(at(xs + w / 2, v0, fronte - 0.6), at(xs - w / 2, v0, fronte - 0.6), at(xs - w / 2, Math.min(hTot - 1, v0 + 6), fronte - 0.6), at(xs + w / 2, Math.min(hTot - 1, v0 + 6), fronte - 0.6), { t: col });
  const yb = Math.min(hTot - 1.5, 3.6 + (k % 2) * 3);
  tele.e.quad(at(-3.6, yb, fronte - 0.15), at(3.6, yb, fronte - 0.15), at(3.6, yb + 0.7, fronte - 0.15), at(-3.6, yb + 0.7, fronte - 0.15), { t: col2 });
  void tele.at;
}
/** Giostra (carosello): pedana, palo, tetto a spicchi rossi e bianchi, cavallini (scatole). */
export function giostra(tele: Tele, x: number, y: number, z: number, k: number): void {
  const tl = tele.at(x, z);
  tl.prisma(x, y, z, 5, 5, 0.6, 12, P_('legnoScuro'), { t: 'tavole' });
  tl.prisma(x, y + 0.6, z, 0.5, 0.5, 4.2, 6, P_(k ? 'giallo' : 'pietraChiara'), null);
  for (let i = 0; i < 12; i++) {
    const a0 = (i / 12) * Math.PI * 2, a1 = ((i + 1) / 12) * Math.PI * 2, col = P_(i % 2 ? 'rosso' : k ? 'giallo' : 'pietraChiara');
    const p0: V3 = [x + Math.cos(a0) * 5.6, y + 4.4, z + Math.sin(a0) * 5.6], p1: V3 = [x + Math.cos(a1) * 5.6, y + 4.4, z + Math.sin(a1) * 5.6], top: V3 = [x, y + 6.6, z];
    tl.quad(p1, p0, top, top, col);
    tl.quad([p0[0], p0[1] - 0.6, p0[2]], [p1[0], p1[1] - 0.6, p1[2]], p1, p0, col);
    if (i % 2 === 0) { const a = (a0 + a1) / 2; tl.box(x + Math.cos(a) * 3.8, y + 1.3, z + Math.sin(a) * 3.8, 0.5, 0.9, 1.4, -a, P_((['pietraChiara', 'rosaNeon', 'acquaBassa'] as NomeP[])[i % 3]!)); tl.prisma(x + Math.cos(a) * 3.8, y + 0.6, z + Math.sin(a) * 3.8, 0.06, 0.06, 3.8, 4, P_('giallo'), null); }
  }
  tele.e.prisma(x, y + 6.6, z, 0.4, 0.05, 0.8, 6, { t: 'emAmbra' }, null);
}
/** Conchiglia gigante a ventaglio (coste alternate). */
export function conchiglia(tele: Tele, x: number, y: number, z: number, ry: number, s: number, col: NomeP): void {
  const tl = tele.at(x, z), c = Math.cos(ry), sn = Math.sin(ry), n = 9, R = 3.4 * s;
  const at = (lx: number, ly: number, lz: number): V3 => [x + lx * c + lz * sn, y + ly, z - lx * sn + lz * c];
  for (let i = 0; i < n; i++) {
    const a0 = Math.PI * (i / n), a1 = Math.PI * ((i + 1) / n), am = (a0 + a1) / 2;
    const base = at(0, 0.2, 0.8 * s), p0 = at(Math.cos(a0) * R, Math.sin(a0) * R * 0.9 + 0.2, 0), p1 = at(Math.cos(a1) * R, Math.sin(a1) * R * 0.9 + 0.2, 0), pm = at(Math.cos(am) * R * 1.02, Math.sin(am) * R * 0.92 + 0.2, -0.5 * s);
    const pen = P_(i % 2 ? col : 'pietraChiara');
    tl.quad(base, p0, pm, pm, pen); tl.quad(base, pm, p1, p1, pen); tl.quad(p0, base, pm, pm, pen); tl.quad(pm, base, p1, p1, pen);
  }
  tl.box(x, y, z, 1.4 * s, 0.6 * s, 1.2 * s, ry, P_(col));
}
/** Nuvola a blocchi piatti (lato in ombra arancio, come al tramonto). */
export function nuvola(tele: Tele, x: number, y: number, z: number, s: number): void {
  const tl = tele.e; // senza luce: le nuvole restano chiare anche viste da sotto
  for (const [dx, dy, dz, w, h, d] of [[0, 0, 0, 8, 2.2, 5], [-4, 0.8, 1, 5, 2.4, 4], [4, 0.6, -1, 5.4, 2.2, 4], [1, 1.8, 0, 4.4, 2, 3.6], [-6.5, -0.2, -0.5, 3, 1.4, 3]] as const)
    tl.box(x + dx * s, y + dy * s, z + dz * s, w * s, h * s, d * s, 0.3, P_('sabbiaChiara'), P_('pietraChiara'), true);
  tl.box(x, y - 0.25 * s, z, 7.6 * s, 0.3 * s, 4.6 * s, 0.3, P_('arancio'), P_('arancio'), true);
}
/** Il teschio cornuto in cima al monte (12 m): calotta, orbite scure con gli occhi di fuoco, denti, corna. */
export function teschio(tele: Tele, x: number, y: number, z: number, ry: number): void {
  const tl = tele.at(x, z), c = Math.cos(ry), s = Math.sin(ry);
  const at = (lx: number, ly: number, lz: number): [number, number, number] => [x + lx * c + lz * s, y + ly, z - lx * s + lz * c];
  const B = (lx: number, ly: number, lz: number, w: number, h: number, d: number, pen: Pennello, sopra?: Pennello) => { const p = at(lx, ly, lz); tl.box(p[0], p[1], p[2], w, h, d, ry, pen, sopra ?? pen, true); };
  const osso: Pennello = { t: 'neve', tinta: 0.96 }, ombra = P_('pietra'), buio = P_('neroCaldo');
  B(0, -0.5, 0, 12, 2, 10, P_('roccia'));               // la roccia sotto
  B(0, 1.5, 0.5, 9, 3.6, 8, osso);                      // mascella e zigomi
  B(0, 5.1, 0, 10, 4.8, 9.6, osso);                     // calotta
  B(0, 9.9, 0.3, 8, 1.6, 8, osso);
  B(0, 1.3, 4.6, 6.6, 1.1, 0.4, buio);                  // la bocca
  for (let k = -3; k <= 3; k++) B(k * 0.9, 1.6, 4.85, 0.6, 0.9, 0.3, P_('pietraChiara'));
  for (const sx of [-1, 1]) {
    B(sx * 2.3, 4.6, 4.85, 2.6, 2.4, 0.3, buio);        // orbite
    const e = at(sx * 2.3, 4.9, 5.05); tele.e.box(e[0], e[1], e[2], 1.1, 1.1, 0.2, ry, { t: 'emFuoco' });
    B(sx * 4.6, 4.2, 0, 0.6, 3, 7.6, ombra);            // tempie
    // corna: tre pezzi che salgono di lato
    B(sx * 5.8, 7.6, 0, 2.4, 1.6, 1.8, P_('legnoScuro'));
    B(sx * 7.3, 9.2, 0, 1.8, 2.4, 1.5, P_('legnoScuro'));
    B(sx * 7.9, 11.5, 0, 1.1, 2.4, 1.0, P_('ombraCalda'));
  }
  B(0, 3.2, 4.85, 1.2, 1, 0.3, buio);                    // il naso
}
