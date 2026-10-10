// La costa dell'hub delle Corse per la minimappa (#185): il contorno più lungo a quota del mare sulla griglia del terreno.
import type { V2 } from './mondo_base.ts';
import { MARE, NC, PASSO, X0, Z0 } from './mondo_terreno.ts';

export /** La costa per la minimappa: il contorno più lungo a quota del mare (marching squares sulla griglia, poi un punto ogni ~6 m). */
function costaPrincipale(H: Float32Array): V2[] {
  const N1 = NC + 1, L = MARE;
  const key = (x: number, z: number) => `${Math.round(x * 10)},${Math.round(z * 10)}`;
  const segs: [V2, V2][] = [];
  const v = (i: number, j: number) => H[j * N1 + i]! - L;
  const cut = (i0: number, j0: number, i1: number, j1: number): V2 => { const a = v(i0, j0), b = v(i1, j1), t = a / (a - b); return [X0 + (i0 + (i1 - i0) * t) * PASSO, Z0 + (j0 + (j1 - j0) * t) * PASSO]; };
  for (let j = 0; j < NC; j++) for (let i = 0; i < NC; i++) {
    const e: V2[] = [];
    if ((v(i, j) > 0) !== (v(i + 1, j) > 0)) e.push(cut(i, j, i + 1, j));
    if ((v(i + 1, j) > 0) !== (v(i + 1, j + 1) > 0)) e.push(cut(i + 1, j, i + 1, j + 1));
    if ((v(i + 1, j + 1) > 0) !== (v(i, j + 1) > 0)) e.push(cut(i + 1, j + 1, i, j + 1));
    if ((v(i, j + 1) > 0) !== (v(i, j) > 0)) e.push(cut(i, j + 1, i, j));
    if (e.length === 2) segs.push([e[0]!, e[1]!]);
    else if (e.length === 4) { segs.push([e[0]!, e[1]!]); segs.push([e[2]!, e[3]!]); }
  }
  const per = new Map<string, number[]>();
  segs.forEach(([a, b], k) => { for (const p of [a, b]) { const kk = key(p[0], p[1]); let l = per.get(kk); if (!l) per.set(kk, (l = [])); l.push(k); } });
  const usato = new Uint8Array(segs.length);
  let migliore: V2[] = [];
  for (let s0 = 0; s0 < segs.length; s0++) {
    if (usato[s0]) continue;
    usato[s0] = 1; const linea: V2[] = [segs[s0]![0], segs[s0]![1]];
    for (;;) {
      const u = linea[linea.length - 1]!, l = per.get(key(u[0], u[1])) ?? [];
      const k = l.find((x) => !usato[x]); if (k === undefined) break;
      usato[k] = 1; const [a, b] = segs[k]!; linea.push(key(a[0], a[1]) === key(u[0], u[1]) ? b : a);
    }
    if (linea.length > migliore.length) migliore = linea;
  }
  const out: V2[] = [];
  let acc = 99;
  for (let i = 0; i < migliore.length; i++) {
    const p = migliore[i]!, q = migliore[i - 1];
    acc += q ? Math.hypot(p[0] - q[0], p[1] - q[1]) : 0;
    if (acc >= 6) { out.push([Math.round(p[0] * 10) / 10, Math.round(p[1] * 10) / 10]); acc = 0; }
  }
  return out;
}
