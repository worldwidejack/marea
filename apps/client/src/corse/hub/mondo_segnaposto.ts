// Segnaposto dei pezzi del kit dell'hub (`cs_h_*`, #185) finché il kit di Blender non c'è: forme semplici sull'atlas, nelle misure
// e nei colori giusti (davanti −Z, perno a terra), così il mondo si vede e si prova. Quando il pezzo vero è nel manifest, vince lui.
import { Tela } from './mondo_base.ts';
import type { NomeP, Pennello, Tessera } from './mondo_base.ts';

const p = (c: NomeP, tinta?: number): Pennello => ({ p: c, tinta });
const t = (c: Tessera, tinta?: number): Pennello => ({ t: c, tinta });
export type Segnaposto = { a: Tela; e: Tela };

const PORTE: Record<string, { pil: Pennello; arco: Pennello; em: NomeP; em2: NomeP; luce: Tessera }> = {
  spiaggia: { pil: t('intonaco'), arco: t('tavole'), em: 'giallo', em2: 'acqua', luce: 'emLanterna' },
  ghiaccio: { pil: t('pietraMuro'), arco: t('neve'), em: 'acquaProfonda', em2: 'pietraChiara', luce: 'emCiano' },
  giungla: { pil: t('pietraMuro', 0.8), arco: t('muschio'), em: 'erba', em2: 'bosco', luce: 'emFuoco' },
  neon: { pil: t('metallo'), arco: p('neroCaldo'), em: 'violaNeon', em2: 'rosaNeon', luce: 'emRosa' },
  lunapark: { pil: t('rossoLacca'), arco: t('tendaRossa'), em: 'giallo', em2: 'rosso', luce: 'emAmbra' },
  fondale: { pil: t('pietraMuro', 0.9), arco: p('acquaProfonda'), em: 'acqua', em2: 'pietraChiara', luce: 'emCiano' },
};

export function segnaposto(nome: string): Segnaposto | null {
  const a = new Tela(), e = new Tela();
  const B = (x: number, y: number, z: number, w: number, h: number, d: number, lati: Pennello, sopra?: Pennello, ry = 0) => a.box(x, y, z, w, h, d, ry, lati, sopra ?? lati);
  if (nome.startsWith('cs_h_porta_')) {
    const k = PORTE[nome.slice(11)]; if (!k) return null;
    for (const s of [-1, 1]) {
      B(s * 7.3, 0, 0, 2, 0.8, 2, t('pietraMuro', 0.8));
      B(s * 7.3, 0.8, 0, 1.6, 8.4, 1.6, k.pil);
      B(s * 7.3, 9.2, 0, 2.1, 0.5, 2.1, p('roccia'));
      e.box(s * 7.3, 9.7, 0, 0.9, 1.1, 0.9, 0, { t: k.luce }, { t: k.luce });
    }
    B(0, 7.4, 0, 16.4, 2.2, 1.4, k.arco);
    a.box(0, 7.6, -0.72, 15.6, 0.7, 0.05, 0, t('scacchi'));         // la fascia a scacchi davanti
    B(0, 9.6, 0, 5.6, 3.6, 0.8, p(k.em));                            // lo stemma
    B(0, 10.2, -0.42, 3.4, 2.4, 0.1, p(k.em2));
    e.box(0, 10.9, -0.48, 1.2, 1.0, 0.08, 0, { t: k.luce });
    return { a, e };
  }
  switch (nome) {
    case 'cs_h_sbarra':
      for (const s of [-1, 1]) B(s * 6.6, 0, 0, 0.4, 1.5, 0.4, p('pietraChiara'));
      for (let k = 0; k < 10; k++) B(-6.3 + k * 1.4 + 0.7, 0.95, 0, 1.4, 0.38, 0.32, p(k % 2 ? 'rosso' : 'pietraChiara'));
      return { a, e };
    case 'cs_h_garage': {
      B(0, 0, 0, 11, 5.6, 12, t('intonaco'), t('tegole'));
      B(0, 5.6, 0, 11.6, 0.5, 12.6, p('roccia'));
      B(0, 0, -6.02, 7, 4.4, 0.08, p('neroCaldo'));                  // il portone aperto (buio dentro)
      B(0, 4.6, -6.1, 4.6, 1.2, 0.12, p('roccia'));                   // l'insegna con la chiave
      B(0, 4.95, -6.18, 2.4, 0.4, 0.06, p('pietraChiara'));
      for (const s of [-1, 1]) e.box(s * 4.3, 3.6, -6.2, 0.5, 0.5, 0.2, 0, { t: 'emLanterna' });
      e.box(0, 0.6, -5.9, 5.6, 2.2, 0.04, 0, { t: 'emFinestra' }, { t: 'emFinestra' });
      return { a, e };
    }
    case 'cs_h_podio':
      B(0, 0, 0, 2.6, 1.3, 2.2, p('pietraChiara'));
      B(-2.6, 0, 0, 2.6, 0.9, 2.2, p('pietraChiara', 0.92));
      B(2.6, 0, 0, 2.6, 0.6, 2.2, p('pietraChiara', 0.86));
      B(0, 0.5, -1.12, 0.5, 0.5, 0.04, p('roccia')); B(-2.6, 0.35, -1.12, 0.5, 0.4, 0.04, p('roccia')); B(2.6, 0.2, -1.12, 0.5, 0.3, 0.04, p('roccia'));
      return { a, e };
    case 'cs_h_statua': {
      const o = p('pietraChiara'), y0 = 1.3;
      for (const s of [-1, 1]) B(s * 0.5, y0, 0, 0.7, 2.3, 0.8, o);   // gambe
      B(0, y0 + 2.3, 0, 1.9, 2.3, 1.1, o);                             // busto
      B(0, y0 + 4.6, 0, 0.5, 0.3, 0.5, o);                             // collo
      B(0, y0 + 4.9, 0, 1.1, 1.2, 1.1, o);                             // testa
      B(0, y0 + 6.0, 0, 1.2, 0.35, 1.2, p('rosso')); B(0, y0 + 6.0, -0.7, 1.0, 0.18, 0.6, p('rosso')); // cappellino
      B(-1.25, y0 + 2.4, 0, 0.55, 2.2, 0.6, o);                        // braccio giù
      B(1.25, y0 + 4.4, 0, 0.55, 2.3, 0.6, o);                         // braccio su col trofeo
      B(1.25, y0 + 6.7, 0, 0.6, 0.3, 0.4, p('giallo')); a.prisma(1.25, y0 + 7.0, 0, 0.3, 0.7, 0.9, 6, p('giallo'), p('arancio'));
      B(0, y0 + 3.6, -0.57, 1.0, 0.7, 0.05, t('scacchi'));             // la fascia a scacchi sul petto
      return { a, e };
    }
    case 'cs_h_torre': {
      B(0, 0, 0, 4, 8, 4, t('pietraMuro'), p('pietra'));
      B(0, 8, 0, 5.2, 0.4, 5.2, p('roccia'));
      B(0, 8.4, 0, 4.6, 2.6, 4.6, t('intonaco'));
      for (const [x, z, w, d] of [[0, -2.32, 3.4, 0.05], [0, 2.32, 3.4, 0.05], [-2.32, 0, 0.05, 3.4], [2.32, 0, 0.05, 3.4]] as const) e.box(x, 9.2, z, w, 1.2, d, 0, { t: 'emFinestra' });
      a.prisma(0, 11, 0, 3.8, 0, 2.2, 4, p('rosso'), null, Math.PI / 4);
      B(0, 6.6, -2.02, 4, 1, 0.06, t('scacchi'));
      for (const s of [-1, 1]) B(s * 2.7, 9.6, -1, 0.6, 0.6, 1.2, p('roccia'));  // gli altoparlanti
      return { a, e };
    }
    case 'cs_h_trofeo':
      a.prisma(0, 0, 0, 0.7, 0.6, 0.35, 8, p('legnoScuro'), p('legno'));
      a.prisma(0, 0.35, 0, 0.18, 0.18, 0.55, 6, p('arancio'), null);
      a.prisma(0, 0.9, 0, 0.25, 0.85, 0.9, 8, p('giallo'), p('arancio'));
      for (const s of [-1, 1]) B(s * 0.9, 1.25, 0, 0.18, 0.55, 0.14, p('giallo'));
      return { a, e };
    case 'cs_h_bandiera':
      a.prisma(0, 0, 0, 0.07, 0.07, 4.6, 5, p('pietraChiara'), p('giallo'));
      a.box(0.85, 3.4, 0, 1.6, 1.1, 0.04, 0, t('scacchi'));
      return { a, e };
    case 'cs_h_staccionata':
      for (const s of [-1, 1]) B(s * 1.1, 0, 0, 0.16, 1.05, 0.16, p('legnoScuro'));
      B(0, 0.4, 0, 2.4, 0.12, 0.08, p('legno')); B(0, 0.8, 0, 2.4, 0.12, 0.08, p('legno'));
      return { a, e };
    case 'cs_h_coni':
      for (const [x, z] of [[0, 0], [0.7, 0.3], [-0.5, 0.6]] as const) { B(x, 0, z, 0.5, 0.06, 0.5, p('arancio')); a.prisma(x, 0.06, z, 0.2, 0.03, 0.62, 6, p('arancio'), null); a.prisma(x, 0.3, z, 0.13, 0.1, 0.1, 6, p('pietraChiara'), null); }
      return { a, e };
    case 'cs_h_gomme':
      for (let k = 0; k < 3; k++) a.prisma(0, k * 0.32, 0, 0.45, 0.45, 0.3, 8, p('neroCaldo'), p('roccia'));
      return { a, e };
    case 'cs_h_salvagente':
      B(0, 0, 0, 0.12, 1.2, 0.12, p('legnoScuro'));
      for (const [x, y, w, h, c] of [[0, 0.9, 0.7, 0.16, 'rosso'], [0, 0.32, 0.7, 0.16, 'rosso'], [-0.29, 0.48, 0.14, 0.42, 'pietraChiara'], [0.29, 0.48, 0.14, 0.42, 'pietraChiara']] as const) B(x, y, -0.1, w, h, 0.14, p(c));
      return { a, e };
    case 'cs_h_palo_luce':
      B(0, 0, 0, 0.26, 1.6, 0.26, p('legnoScuro'));
      e.box(0, 1.6, 0, 0.36, 0.36, 0.36, 0, { t: 'emLanterna' }, { t: 'emLanterna' });
      B(0, 1.96, 0, 0.42, 0.1, 0.42, p('roccia'));
      return { a, e };
    case 'cs_h_albero':
      a.prisma(0, 0, 0, 0.32, 0.26, 2.4, 5, t('corteccia'), null);
      a.prisma(0, 1.9, 0, 1.7, 2.1, 1.8, 6, p('erbaScura'), p('erba'));
      a.prisma(0, 3.7, 0, 2.1, 1.0, 1.4, 6, p('erbaScura'), p('erba'));
      return { a, e };
    case 'cs_h_albero_giungla':
      a.prisma(0, 0, 0, 0.45, 0.32, 6, 5, t('corteccia'), null);
      a.prisma(0, 5, 0, 2.2, 3.4, 1.2, 7, p('bosco'), p('erbaScura'));
      a.prisma(0, 6.2, 0, 3.4, 1.6, 1.2, 7, p('bosco'), p('erbaScura'));
      a.prisma(1, 3.2, 0.4, 1.4, 1.6, 0.9, 5, p('boscoOmbra'), p('bosco'));
      return { a, e };
    case 'cs_h_cespuglio':
      a.prisma(0, 0, 0, 0.9, 1.1, 0.7, 6, p('erbaScura'), null);
      a.prisma(0, 0.7, 0, 1.1, 0.5, 0.5, 6, p('erbaScura'), p('erba'));
      return { a, e };
    case 'cs_h_tempio': {
      const m = t('pietraMuro', 0.85), v = t('muschio');
      B(0, 0, 0, 20, 4, 14, m, v); B(0, 4, 0.5, 15, 4, 11, m, v); B(0, 8, 1, 10, 4, 8, m, v); B(0, 12, 1.2, 5, 2.5, 4, m, p('bosco'));
      B(0, 0, -7.02, 7.4, 5.4, 0.1, p('neroCaldo'));                 // la bocca (il tunnel)
      for (let k = -3; k <= 3; k++) B(k * 1.05, 4.6, -7.1, 0.6, 0.9, 0.2, p('pietraChiara')); // denti
      for (const s of [-1, 1]) { B(s * 3, 5.6, -5.2, 2.4, 2, 0.2, p('neroCaldo')); e.box(s * 3, 6, -5.34, 1.2, 1.1, 0.08, 0, { t: 'emFuoco' }); } // occhi di fuoco
      for (const s of [-1, 1]) { B(s * 8.5, 0, -8, 1.2, 4.2, 1.2, m); e.box(s * 8.5, 4.2, -8, 0.8, 1, 0.8, 0, { t: 'emFuoco' }, { t: 'emFuoco' }); }
      return { a, e };
    }
    case 'cs_h_rovina':
      B(-1, 0, 0, 1.4, 3.4, 1.4, t('pietraMuro', 0.85), t('muschio')); B(1.2, 0, 0.2, 1.4, 1.8, 1.4, t('pietraMuro', 0.85), t('muschio'));
      B(0.2, 0, 1.6, 2.8, 0.8, 1, t('pietraMuro', 0.8), t('muschio'), 0.4);
      return { a, e };
    case 'cs_h_ruota_base':
      for (const s of [-1, 1]) { a.box(s * 2.6, 0, -1.4, 0.5, 9.8, 0.5, 0.25 * s, p('pietraChiara')); a.box(s * 2.6, 0, 1.4, 0.5, 9.8, 0.5, -0.25 * s, p('pietraChiara')); }
      B(0, 0, 0, 7, 0.6, 5, t('tavole'));
      B(0, 8.7, 0, 5.6, 0.6, 0.6, p('rosso'));
      return { a, e };
    case 'cs_h_ruota_giro': {
      const n = 12, R = 8, cols: NomeP[] = ['rosso', 'giallo', 'acquaProfonda', 'erba', 'viola', 'arancio'];
      for (let k = 0; k < n; k++) {
        const a0 = (k / n) * Math.PI * 2, a1 = ((k + 1) / n) * Math.PI * 2;
        for (const z of [-0.5, 0.5]) {
          const x0 = Math.cos(a0) * R, y0 = Math.sin(a0) * R, x1 = Math.cos(a1) * R, y1 = Math.sin(a1) * R;
          a.quad([x0, y0, z], [x1, y1, z], [x1 * 0.93, y1 * 0.93, z], [x0 * 0.93, y0 * 0.93, z], p('pietraChiara')); a.quad([x1, y1, z], [x0, y0, z], [x0 * 0.93, y0 * 0.93, z], [x1 * 0.93, y1 * 0.93, z], p('pietraChiara'));
          a.quad([0, 0.2, z], [0, -0.2, z], [x0, y0 - 0.2, z], [x0, y0 + 0.2, z], p('rosso')); a.quad([0, -0.2, z], [0, 0.2, z], [x0, y0 + 0.2, z], [x0, y0 - 0.2, z], p('rosso'));
        }
        a.box(Math.cos(a0) * R, Math.sin(a0) * R - 1.6, 0, 1.4, 1.2, 1.4, 0, p(cols[k % cols.length]!), p('pietraChiara'), true);
        e.box(Math.cos(a0 + 0.26) * R * 0.97, Math.sin(a0 + 0.26) * R * 0.97, 0, 0.3, 0.3, 1.2, 0, { t: k % 2 ? 'emAmbra' : 'emRosa' });
      }
      a.box(0, -0.6, 0, 1.2, 1.2, 1.6, 0, p('giallo'));
      return { a, e };
    }
    case 'cs_h_tendone': {
      const n = 10;
      for (let k = 0; k < n; k++) {
        const a0 = (k / n) * Math.PI * 2, a1 = ((k + 1) / n) * Math.PI * 2, R = 7.5, pen = t(k % 2 ? 'tendaRossa' : 'intonaco');
        const p0: [number, number, number] = [Math.cos(a0) * R, 0, Math.sin(a0) * R], p1: [number, number, number] = [Math.cos(a1) * R, 0, Math.sin(a1) * R];
        a.faccia(p1, p0, [p1[0], 3.6, p1[2]], pen, R * 0.62, 3.6);
        a.quad([p1[0] * 1.06, 3.6, p1[2] * 1.06], [p0[0] * 1.06, 3.6, p0[2] * 1.06], [0, 8.6, 0], [0, 8.6, 0], k % 2 ? p('rosso') : p('pietraChiara'));
      }
      B(0, 0, -7.3, 3, 2.8, 0.3, p('neroCaldo'));
      a.prisma(0, 8.6, 0, 0.08, 0.08, 1.6, 4, p('pietraChiara'), null); a.box(0.5, 9.6, 0, 0.9, 0.6, 0.04, 0, p('giallo'));
      e.box(0, 3.1, -7.5, 3.4, 0.25, 0.1, 0, { t: 'emAmbra' });
      return { a, e };
    }
    case 'cs_h_palazzo_a': case 'cs_h_palazzo_b': {
      const b = nome.endsWith('b'), w = b ? 8 : 9, d = b ? 9 : 8.6;
      B(0, 0, 0, w, 10, d, t('metallo', b ? 0.75 : 1), p('roccia'));
      B(0, 10, 0, w + 0.4, 0.4, d + 0.4, p('neroCaldo'));
      for (let f = 0; f < 3; f++) for (let c = 0; c < 3; c++) if ((f + c + (b ? 1 : 0)) % 3) e.box(-w / 3 + (c * w) / 3, 1.6 + f * 2.9, -d / 2 - 0.02, 1.2, 1.1, 0.04, 0, { t: 'emFinestra' });
      for (let f = 0; f < 3; f++) if (f % 2 === 0) for (const s of [-1, 1]) e.box(s * (w / 2 + 0.02), 2.4 + f * 2.9, 0, 0.04, 1, 1.4, 0, { t: 'emFinestra' });
      return { a, e };
    }
    case 'cs_h_corallo': {
      const cols: NomeP[] = ['rosaNeon', 'arancio', 'viola', 'rosso'];
      for (let k = 0; k < 5; k++) { const ang = k * 1.3, r = k ? 0.6 : 0, h = 1.4 + ((k * 7) % 5) * 0.4; a.prisma(Math.cos(ang) * r, 0, Math.sin(ang) * r, 0.22, 0.12, h, 5, p(cols[k % 4]!), p(cols[(k + 1) % 4]!)); a.box(Math.cos(ang) * r, h, Math.sin(ang) * r, 0.42, 0.42, 0.42, ang, p(cols[(k + 2) % 4]!)); }
      return { a, e };
    }
    case 'cs_h_igloo':
      a.prisma(0, 0, 0, 2.3, 2.1, 1.1, 8, t('neve'), null);
      a.prisma(0, 1.1, 0, 2.1, 1.4, 0.9, 8, t('neve'), null);
      a.prisma(0, 2.0, 0, 1.4, 0.2, 0.7, 8, t('neve'), p('pietraChiara'));
      B(0, 0, -2.2, 1.2, 1.2, 1.2, t('neve'));
      B(0, 0, -2.82, 0.7, 0.9, 0.05, p('acquaProfonda'));
      return { a, e };
    case 'cs_h_casse':
      B(0, 0, 0, 0.9, 0.9, 0.9, t('tavole')); B(0.3, 0.9, 0.1, 0.7, 0.7, 0.7, t('tavole'), undefined, 0.4);
      return { a, e };
    case 'cs_h_lampione':
      B(0, 0, 0, 0.2, 3.8, 0.2, p('neroCaldo')); B(0, 3.8, -0.4, 0.14, 0.14, 0.9, p('neroCaldo'));
      e.box(0, 3.4, -0.8, 0.4, 0.42, 0.4, 0, { t: 'emLanterna' }, { t: 'emLanterna' });
      return { a, e };
    default: return null;
  }
}
