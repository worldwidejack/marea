// Dove vanno i pezzi dell'hub (#185): il paese dei piloti al molo, la rotatoria col trofeo, le 6 porte coi loro quartieri, le
// tribune coi manichini, lampioni, alberi, scogli e barche. Solo regole e numeri: chi li monta è mondo_kit.ts. Le cose che il kit
// non ha (teschio in cima al monte, conchiglie giganti, nuvole, giostre, festoni, insegne al neon) si costruiscono qui sulla tela.
import type { IdPorta, Ostacolo, PortaHub, PostoHub } from './mappa.ts';
import { guarda, rng, rumore } from './mondo_base.ts';
import type { NomeP } from './mondo_base.ts';
import { conchiglia, festone, giostra, insegna, lampioneNeon, nuvola, teschio } from './mondo_costruzioni.ts';
import { Tele, fiore } from './mondo_mesh.ts';
import { AIUOLA, CAPO, CASCATA, LUNA, MARE, MESA, MONTE, NEON, PONTILE, PONTILE_Y, RAMPE, ROT, STAGNO, dentroPontile, distCosta } from './mondo_terreno.ts';
import type { Terreno } from './mondo_terreno.ts';

/** Un pezzo del kit: nome nel manifest (con le alternative se manca), posa, scala. `y` = quota della base. */
export type Pezzo = { m: string; x: number; y: number; z: number; ry: number; s?: number; sx?: number; sy?: number };
export type Testa = { x: number; y: number; z: number; ry: number };
export type Piazzati = {
  pezzi: Pezzo[]; teste: Testa[]; ostacoli: Ostacolo[]; porte: PortaHub[]; garage: PostoHub; molo: PostoHub;
  /** Pezzi da girare (la ruota panoramica): nome, perno, verso. */
  ruota: { x: number; y: number; z: number; ry: number; s: number } | null;
  /** Bandiere e nuvole che si muovono: niente per ora, il resto è fermo. */
};

/** Se manca il pezzo del kit nuovo, si prova questo (dal kit della Spiaggia o del gioco). */
export const ALTERNATIVE: Record<string, string[]> = {
  cs_h_lampione: ['cs_lampione'], cs_h_palma: ['prop_palma'], cs_h_pino_neve: ['cs_pino'], cs_h_bancarella: ['cs_bancarella'],
  cs_h_cartello: ['cs_cartello'], cs_h_roccia_a: ['cs_scoglio_a'], cs_h_roccia_b: ['cs_scoglio_b'], cs_h_casse: ['prop_cassa'],
  
};

const NOMI: Record<IdPorta, string> = {
  spiaggia: 'Spiaggia e porto', ghiaccio: 'Ghiaccio e neve', giungla: 'Giungla e templi', neon: 'Città al neon', lunapark: 'Luna park', fondale: 'Fondale e cielo',
};
const IDS: IdPorta[] = ['spiaggia', 'ghiaccio', 'giungla', 'neon', 'lunapark', 'fondale'];
/** Colori delle porte (segnaposto) e delle insegne. */
const COLORE_PORTA: Record<IdPorta, [NomeP, NomeP]> = {
  spiaggia: ['giallo', 'acqua'], ghiaccio: ['acquaBassa', 'pietraChiara'], giungla: ['erba', 'bosco'], neon: ['rosaNeon', 'violaNeon'], lunapark: ['rosso', 'giallo'], fondale: ['acquaProfonda', 'rosaNeon'],
};
const MANI_PIEDI = ['cs_manichino_rosso', 'cs_manichino_blu'], MANI_SEDUTI = ['cs_manichino_giallo', 'cs_manichino_verde'];
const OMBR = ['cs_ombrellone_rosso', 'cs_ombrellone_blu', 'cs_ombrellone_giallo'], CASE = ['cs_casa_a', 'cs_casa_b', 'cs_casa_c'];

export function piazza(t: Terreno, tele: Tele): Piazzati {
  const R = rng(185);
  const pezzi: Pezzo[] = [], teste: Testa[] = [], ostacoli: Ostacolo[] = [];
  // ---------- spazio occupato (per non mettere i pezzi uno sull'altro) ----------
  const occ = new Map<number, [number, number, number][]>(), CO = 8;
  const kk = (i: number, j: number) => (i + 256) * 512 + (j + 256);
  const occupa = (x: number, z: number, r: number) => { const k = kk(Math.floor(x / CO), Math.floor(z / CO)); let a = occ.get(k); if (!a) occ.set(k, (a = [])); a.push([x, z, r]); };
  const sovrapposto = (x: number, z: number, r: number) => {
    for (let i = Math.floor((x - r - 6) / CO); i <= Math.floor((x + r + 6) / CO); i++) for (let j = Math.floor((z - r - 6) / CO); j <= Math.floor((z + r + 6) / CO); j++)
      for (const [ox, oz, or] of occ.get(kk(i, j)) ?? []) if ((ox - x) ** 2 + (oz - z) ** 2 < (or + r) ** 2) return true;
    return false;
  };
  const davantiPorte: [number, number][] = [];
  /** Libero: fuori dalle strade (con margine), all'asciutto, non sopra altro, non davanti alle porte né sui trampolini. */
  const libero = (x: number, z: number, r: number, o: { margine?: number; acqua?: boolean; piazza?: boolean } = {}) => {
    const q = t.stradaVicina(x, z, r + 20);
    if (q && q.d < q.c.l + r + (o.margine ?? 1)) return false;
    if (!o.acqua && t.quotaTerra(x, z) < MARE + 0.25) return false;
    if (!o.piazza && t.inPiazza(x, z)) return false;
    if (dentroPontile(x, z)) return false;
    for (const [px, pz] of davantiPorte) if ((px - x) ** 2 + (pz - z) ** 2 < (14 + r) ** 2) return false;
    for (const rp of RAMPE) if ((rp.x + Math.sin(rp.yaw) * rp.lung / 2 - x) ** 2 + (rp.z + Math.cos(rp.yaw) * rp.lung / 2 - z) ** 2 < (rp.lung + 6 + r) ** 2) return false;
    return !sovrapposto(x, z, r);
  };
  /** Ostacolo rettangolare (ruotato): cerchi in fila sul lato lungo. */
  const rett = (x: number, z: number, ry: number, w: number, d: number) => {
    const c = Math.cos(ry), s = Math.sin(ry), r = Math.min(w, d) / 2, lungo = Math.max(w, d), n = Math.max(1, Math.ceil(lungo / r / 1.4));
    for (let k = 0; k < n; k++) {
      const u = -lungo / 2 + r + ((lungo - 2 * r) * k) / Math.max(1, n - 1);
      const lx = w >= d ? u : 0, lz = w >= d ? 0 : u;
      ostacoli.push({ x: x + lx * c + lz * s, z: z - lx * s + lz * c, r });
    }
  };
  type Opz = { y?: number; s?: number; sx?: number; sy?: number; coll?: number | [number, number]; margine?: number; acqua?: boolean; piazza?: boolean; forza?: boolean };
  const metti = (m: string, x: number, z: number, ry: number, r: number, o: Opz = {}): boolean => {
    if (!o.forza && !libero(x, z, r, o)) return false;
    occupa(x, z, r);
    pezzi.push({ m, x, y: o.y ?? t.quota(x, z), z, ry, s: o.s, sx: o.sx, sy: o.sy });
    if (typeof o.coll === 'number') ostacoli.push({ x, z, r: o.coll });
    else if (o.coll) rett(x, z, ry, o.coll[0], o.coll[1]);
    return true;
  };
  const verso = (x: number, z: number, tx: number, tz: number) => guarda(tx - x, tz - z);

  // ---------- le porte ----------
  const porte: PortaHub[] = IDS.map((id) => {
    const g = t.porte[id]!, rx = g.fz, rz = -g.fx, ry = guarda(-g.fx, -g.fz), aperta = id === 'spiaggia';
    const ex = g.x - g.fx * 7, ez = g.z - g.fz * 7;
    davantiPorte.push([g.x, g.z]);
    pezzi.push({ m: 'cs_h_porta_' + id, x: g.x, y: g.y, z: g.z, ry });
    occupa(g.x, g.z, 9);
    for (const s of [-1, 1]) ostacoli.push({ x: g.x + rx * s * 7.3, z: g.z + rz * s * 7.3, r: 1.3 });
    if (!aperta) {
      pezzi.push({ m: 'cs_h_sbarra', x: g.x - g.fx * 0.9, y: g.y, z: g.z - g.fz * 0.9, ry });
      for (let u = -6; u <= 6.01; u += 1.2) ostacoli.push({ x: g.x - g.fx * 0.9 + rx * u, z: g.z - g.fz * 0.9 + rz * u, r: 0.7 });
    }
    return { id, nome: NOMI[id], x: ex, z: ez, yaw: Math.atan2(g.fx, g.fz), raggio: 6, aperta };
  });

  // ---------- il paese dei piloti e il molo ----------
  const garage: PostoHub = { x: 22, z: 140, yaw: Math.PI / 2, raggio: 5 };
  metti('cs_h_garage', 35, 140, guarda(-1, 0), 7, { forza: true, coll: [14, 11.5] });
  const molo: PostoHub = { x: 0, z: 181, yaw: Math.PI, raggio: 6 };
  // la statua del manichino col trofeo sul podio, in mezzo all'aiuola fiorita
  metti('cs_h_podio', AIUOLA.x, AIUOLA.z, guarda(0, 1), AIUOLA.r, { forza: true, coll: AIUOLA.r - 1, y: 1.6 });
  pezzi.push({ m: 'cs_h_statua', x: AIUOLA.x, y: 1.6 + 1.7, z: AIUOLA.z - 0.6, ry: guarda(0, 1), s: 0.85 });
  for (let k = 0; k < 70; k++) { const a = R() * 6.28, r = 3.6 + R() * 2.6; fiore(tele.at(AIUOLA.x, AIUOLA.z, 'pv'), AIUOLA.x + Math.cos(a) * r, 1.9, AIUOLA.z + Math.sin(a) * r, (['rosso', 'giallo', 'rosaNeon', 'pietraChiara', 'arancio'] as NomeP[])[k % 5]!); }
  tele.at(AIUOLA.x, AIUOLA.z).prisma(AIUOLA.x, 1.55, AIUOLA.z, AIUOLA.r, AIUOLA.r, 0.35, 16, { t: 'pietraMuro' }, { t: 'erbaB' });
  metti('cs_h_torre', 21, 103, verso(21, 103, 0, 125), 3.5, { forza: true, coll: 3.2 });
  // bancarelle a ovest della piazza, rivolte al centro
  for (const [x, z] of [[-25, 108], [-27, 119], [-25, 130], [-17, 99]] as [number, number][]) metti('cs_h_bancarella', x, z, verso(x, z, 0, 119), 2.2, { piazza: true, coll: [3.6, 2], margine: 0.3 });
  // coni, gomme e casse davanti al garage; bandiere a scacchi alla radice del pontile
  for (const [m, x, z, c] of [['cs_h_gomme', 27, 131, 0.7], ['cs_h_gomme', 28.5, 132.6, 0.7], ['cs_h_coni', 24, 133, 0], ['cs_h_coni', 24, 147, 0], ['cs_h_casse', 27, 149, 0.8], ['cs_h_gomme', 41, 151, 0.7], ['cs_h_casse', 13, 148, 0.8]] as [string, number, number, number][])
    metti(m, x, z, R() * 6.28, 0.8, { piazza: true, coll: c || undefined, margine: 0 });
  for (const [x, z] of [[-6.5, 148], [6.5, 148], [-9, 134], [9, 134]] as [number, number][]) metti('cs_h_bandiera', x, z, guarda(0, 1), 0.4, { piazza: true, coll: 0.25, margine: 0 });
  // lampioni intorno alla piazza (con i festoni tra uno e l'altro) e sulla banchina
  const lumi: [number, number][] = [];
  for (let k = 0; k < 14; k++) {
    const a = (k / 14) * Math.PI * 2 + 0.11, x = Math.cos(a) * 24.5, z = 120 + Math.sin(a) * 24.5;
    if (metti('cs_h_lampione', x, z, verso(x, z, 0, 120), 0.4, { piazza: true, coll: 0.3, margine: 0.3 })) lumi.push([x, z]);
  }
  for (let i = 0; i < lumi.length; i++) {
    const a = lumi[i]!, b = lumi[(i + 1) % lumi.length]!;
    if (Math.hypot(a[0] - b[0], a[1] - b[1]) < 14) festone(tele.at(a[0], a[1], 'pv'), [a[0], 1.6 + 3.4, a[1]], [b[0], 1.6 + 3.4, b[1]], i);
  }
  for (let x = -40; x <= 48; x += 11) if (Math.abs(x) > 8) metti('cs_h_lampione', x, 150.6, guarda(0, -1), 0.4, { piazza: true, coll: 0.3, margine: 0.2, y: 1.66 });
  // il pontile: pali con la luce, salvagente, la barca all'ormeggio, le boe
  for (let z = 150; z <= 186; z += 9) for (const s of [-1, 1]) pezzi.push({ m: 'cs_h_palo_luce', x: s * 4.2, y: PONTILE_Y, z, ry: guarda(-s, 0) });
  for (const s of [-1, 1]) pezzi.push({ m: 'cs_h_palo_luce', x: s * 14.6, y: PONTILE_Y, z: 187.6, ry: guarda(0, -1) });
  for (const s of [-1, 1]) for (let z = 150; z <= 186; z += 3) ostacoli.push({ x: s * 4.9, z, r: 0.35 });
  for (let x = -14.5; x <= 14.5; x += 3) if (Math.abs(x) > 4.5) { ostacoli.push({ x, z: 179.4, r: 0.35 }); ostacoli.push({ x, z: 188.6, r: 0.35 }); }
  for (const z of [180, 183, 186]) { ostacoli.push({ x: -15.4, z, r: 0.35 }); ostacoli.push({ x: 15.4, z, r: 0.35 }); }
  pezzi.push({ m: 'cs_h_salvagente', x: 4.7, y: PONTILE_Y, z: 170, ry: guarda(1, 0) });
  pezzi.push({ m: 'cs_h_salvagente', x: -4.7, y: PONTILE_Y, z: 158, ry: guarda(-1, 0) });
  pezzi.push({ m: 'boat_barca', x: 6.5, y: MARE - 0.1, z: 193, ry: guarda(0, -1) + 0.15 });
  for (const [x, z] of [[-24, 196], [26, 198], [-36, 172], [44, 176]] as [number, number][]) pezzi.push({ m: 'prop_boa', x, y: MARE, z, ry: 0 });
  // l'arco del via sulla strada del paese
  { const s = t.strade.find((x) => x.def.id === 'paese')!, c = s.c[50]!; pezzi.push({ m: 'cs_arco_via', x: c.x, y: c.y - 0.05, z: c.z, ry: guarda(c.tx, c.tz), sx: 1 }); ostacoli.push({ x: c.x + c.tz * 6.2, z: c.z - c.tx * 6.2, r: 0.6 }, { x: c.x - c.tz * 6.2, z: c.z + c.tx * 6.2, r: 0.6 }); }
  // manichini in piedi intorno alla piazza: guardano la statua
  for (let k = 0; k < 40; k++) {
    const a = R() * 6.28, r = 17 + R() * 5, x = Math.cos(a) * r, z = 120 + Math.sin(a) * r, ry = verso(x, z, 0, 119) + (R() - 0.5) * 0.5;
    if (z > 138 && Math.abs(x) < 12) continue;
    if (metti(MANI_PIEDI[k % 2]!, x, z, ry, 0.5, { piazza: true, margine: 0, y: 1.6, coll: 0.3 })) teste.push({ x, y: 1.6 + 1.38, z, ry });
  }
  // casette del paese ai lati
  for (const [x, z] of [[-44, 126], [-50, 138], [-38, 142], [-58, 124], [52, 128], [58, 140], [46, 118], [-46, 112], [64, 118]] as [number, number][])
    metti(CASE[Math.floor(R() * 3)]!, x, z, verso(x, z, 0, 120), 4.2, { coll: [6.5, 5] });
  // cartello coi nomi delle zone all'uscita della piazza
  metti('cs_h_cartello', 7.5, 96, guarda(0, 1), 0.5, { coll: 0.3, margine: 0.2 });

  // ---------- la rotatoria: piedistallo, trofeo d'oro, aiuola, bandiere ----------
  {
    const tl = tele.at(ROT.x, ROT.z), y = t.quotaTerra(ROT.x, ROT.z);
    tl.prisma(ROT.x, y - 0.2, ROT.z, 5.2, 4.8, 1.4, 8, { t: 'pietraMuro' }, { p: 'pietra' }, Math.PI / 8);
    tl.prisma(ROT.x, y + 1.2, ROT.z, 3.6, 3.2, 1.6, 8, { t: 'pietraLiscia' }, { p: 'pietraChiara' }, Math.PI / 8);
    tl.box(ROT.x, y + 0.9, ROT.z + 4.95, 3.2, 0.5, 0.2, 0, { t: 'scacchi' });
    pezzi.push({ m: 'cs_h_trofeo', x: ROT.x, y: y + 2.8, z: ROT.z, ry: guarda(0, 1), s: 1.45 });
    ostacoli.push({ x: ROT.x, z: ROT.z, r: 5.4 });
    for (let k = 0; k < 160; k++) { const a = R() * 6.28, r = 7 + R() * 10.5; fiore(tele.at(ROT.x, ROT.z, 'pv'), ROT.x + Math.cos(a) * r, t.quotaTerra(ROT.x + Math.cos(a) * r, ROT.z + Math.sin(a) * r), ROT.z + Math.sin(a) * r, (['rosso', 'giallo', 'rosaNeon', 'pietraChiara', 'arancio', 'viola'] as NomeP[])[k % 6]!); }
    for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2 + 0.5, x = ROT.x + Math.cos(a) * 15.5, z = ROT.z + Math.sin(a) * 15.5; metti('cs_h_bandiera', x, z, verso(x, z, ROT.x, ROT.z), 0.4, { coll: 0.25, margine: 0.4 }); }
  }

  // ---------- tribune coi manichini lungo le strade ----------
  const tribuna = (id: string, s: number, lato: -1 | 1) => {
    const st = t.strade.find((x) => x.def.id === id); if (!st) return;
    const c = st.c[Math.min(st.c.length - 1, s)]!, off = c.l + 6.2, tx = c.x + c.tz * lato * off, tz = c.z - c.tx * lato * off;
    const ry = verso(tx, tz, c.x, c.z);
    if (!metti('cs_tribuna', tx, tz, ry, 4.4, { coll: [8.6, 3.2], margine: 0.4 })) return;
    const fx = -Math.sin(ry), fz = -Math.cos(ry), rx = Math.cos(ry), rz = -Math.sin(ry), y0 = t.quota(tx, tz);
    for (let k = 0; k < 3; k++) for (let i = 0; i < 7; i++) {
      if (R() < 0.12) continue;
      const u = -3.4 + i * 1.13 + (R() - 0.5) * 0.2, back = 0.9 * k - 0.05;
      const mx = tx + rx * u - fx * back, mz = tz + rz * u - fz * back, my = y0 + 0.6 * (k + 1);
      pezzi.push({ m: MANI_SEDUTI[(i + k) % 2]!, x: mx, y: my, z: mz, ry });
      teste.push({ x: mx, y: my + 0.58, z: mz, ry });
    }
  };
  for (const [id, s, lato] of [['paese', 22, 1], ['paese', 22, -1], ['paese', 40, -1], ['lunapark', 55, -1], ['lunapark', 75, 1], ['neon', 45, 1], ['fondale', 30, -1], ['spiaggia', 45, 1], ['giungla', 50, -1], ['ghiaccio', 45, 1], ['anello', 20, 1], ['anello', 95, 1]] as [string, number, -1 | 1][])
    tribuna(id, s, lato);

  // ---------- lampioni e staccionate lungo le strade, cartelli agli incroci ----------
  for (const st of t.strade) {
    const id = st.def.id; if (id === 'monte') continue;
    const neon = id === 'neon' || id === 'neon_luna';
    for (let s = 14; s < st.c.length - 14; s += neon ? 16 : 30) {
      const c = st.c[s]!, lato = (Math.floor(s / (neon ? 16 : 30)) % 2 ? 1 : -1), off = c.l + (c.ponte ? 0.4 : 1.3);
      const x = c.x + c.tz * lato * off, z = c.z - c.tx * lato * off;
      if (c.ponte) { pezzi.push({ m: 'cs_h_palo_luce', x, y: c.y + 0.95, z, ry: verso(x, z, c.x, c.z) }); continue; }
      if (neon) { if (libero(x, z, 0.4, { margine: 0.25 })) { lampioneNeon(tele, x, t.quota(x, z), z, s); occupa(x, z, 0.4); ostacoli.push({ x, z, r: 0.3 }); } }
      else metti('cs_h_lampione', x, z, verso(x, z, c.x, c.z), 0.4, { coll: 0.3, margine: 0.25 });
    }
    // staccionate a tratti sulle strade di campagna
    if (['fondale', 'costa_est', 'costa_ovest', 'gelo_giungla', 'spiaggia'].includes(id)) {
      for (let s = 10; s < st.c.length - 10; s += 4) {
        if (rumore(s, st.def.l * 7, 9, 61) < 0.5) continue;
        for (const lato of [-1, 1]) {
          const c = st.c[s]!, off = c.l + 3.2, x = c.x + c.tz * lato * off, z = c.z - c.tx * lato * off;
          if (metti('cs_h_staccionata', x, z, guarda(c.tx, c.tz) + Math.PI / 2, 1.2, { margine: 1.5, coll: 0.3 }) === false) continue;
        }
      }
    }
  }
  for (const [id, s] of [['spiaggia', 10], ['ghiaccio', 10], ['giungla', 12], ['neon', 12], ['lunapark', 10], ['fondale', 10]] as [string, number][]) {
    const st = t.strade.find((x) => x.def.id === id)!, c = st.c[s]!, x = c.x + c.tz * (c.l + 1.6), z = c.z - c.tx * (c.l + 1.6);
    metti('cs_h_cartello', x, z, guarda(-c.tx, -c.tz), 0.5, { coll: 0.3, margine: 0.3 });
  }

  // ---------- quartieri ----------
  spiaggia(); ghiaccio(); giungla(); neon(); lunapark(); fondale(); campagna(); mare();

  function sparsi(n: number, x0: number, x1: number, z0: number, z1: number, f: (x: number, z: number, h: number) => void) {
    for (let i = 0; i < n; i++) { const x = x0 + R() * (x1 - x0), z = z0 + R() * (z1 - z0); f(x, z, t.quotaTerra(x, z)); }
  }
  function spiaggia() {
    // ombrelloni e sdraio sulla sabbia, palme, cabine
    sparsi(2400, -230, 40, 20, 200, (x, z, h) => {
      if (h < MARE + 0.4 || h > MARE + 2.6 || t.superficie(x, z) !== 'sabbia') return;
      const c = R();
      if (c < 0.22) { if (metti(OMBR[Math.floor(R() * 3)]!, x, z, R() * 6.28, 1.6, { coll: 0.25 })) { const a = R() * 6.28; metti('cs_sdraio', x + Math.cos(a) * 1.3, z + Math.sin(a) * 1.3, a, 0.6, { margine: 0.3 }); } }
      else if (c < 0.3) metti('cs_h_palma', x, z, R() * 6.28, 1.3, { s: 0.8 + R() * 0.3, coll: 0.45 });
      else if (c < 0.37) metti('cs_cabina', x, z, R() * 6.28, 1.3, { coll: 1 });
    });
    metti('cs_faro', -184, 150, guarda(1, -1), 5, { forza: true, coll: 2.6, y: t.quotaTerra(-184, 150) });
    // pontili di legno sulla spiaggia con le barche a vela
    for (const [x, z, a] of [[-142, 138, 2.6], [-104, 150, 2.9]] as [number, number, number][]) {
      const fx = Math.sin(a), fz = Math.cos(a), tl = tele.at(x, z);
      tl.box(x + fx * 11, PONTILE_Y - 0.6, z + fz * 11, 3, 0.3, 24, a, { t: 'legnoScuro' }, { t: 'tavole' });
      for (let k = 0; k < 6; k++) for (const s of [-1, 1]) tl.prisma(x + fx * k * 4.5 + fz * s * 1.3, MARE - 2.5, z + fz * k * 4.5 - fx * s * 1.3, 0.18, 0.18, PONTILE_Y - 0.6 - MARE + 2.6, 5, { t: 'legnoScuro' }, null);
      pezzi.push({ m: 'cs_barca_vela', x: x + fx * 18 + fz * 4, y: MARE - 0.1, z: z + fz * 18 - fx * 4, ry: a + 0.1 });
    }
  }
  function ghiaccio() {
    // pini innevati sul monte (fitti), rocce, igloo vicino alla porta, il teschio in cima
    sparsi(2600, MONTE.x - MONTE.r, MONTE.x + MONTE.r, MONTE.z - MONTE.r, MONTE.z + MONTE.r, (x, z, h) => {
      const tm = Math.hypot(x - MONTE.x, z - MONTE.z) / MONTE.r;
      if (tm > 1 || tm < 0.18 || h < MARE + 1.2) return;
      const c = R(), ripido = Math.abs(t.quotaTerra(x + 2, z) - h) + Math.abs(t.quotaTerra(x, z + 2) - h) > 1.8;
      if (ripido) { if (c < 0.2) metti(R() < 0.5 ? 'cs_h_roccia_a' : 'cs_h_roccia_b', x, z, R() * 6.28, 2, { s: 0.7 + R() * 0.8, coll: 1.4 }); return; }
      if (c < 0.17) metti('cs_h_pino_neve', x, z, R() * 6.28, 1.8, { s: 0.8 + R() * 0.6, coll: 0.5 });
    });
    for (const [x, z] of [[-112, -22], [-122, -36], [-106, -64]] as [number, number][]) metti('cs_h_igloo', x, z, verso(x, z, -92, -34), 3.8, { coll: 3.3 });
    teschio(tele, MONTE.x, t.quotaTerra(MONTE.x, MONTE.z), MONTE.z, guarda(1, 1));
    ostacoli.push({ x: MONTE.x, z: MONTE.z, r: 6.5 });
    occupa(MONTE.x, MONTE.z, 9);
  }
  function giungla() {
    pezzi.push({ m: 'cs_h_tempio', x: -46, y: t.quotaTerra(-46, -131), z: -134, ry: guarda(0, 1) });
    occupa(-46, -136, 11); rett(-46, -133.5, 0, 20, 17);
    for (const s of [-1, 1]) ostacoli.push({ x: -46 + s * 7, z: -131, r: 1.4 });
    // alberi fitti, palme e cespugli sull'altopiano e intorno
    sparsi(4200, MESA.x - MESA.rx * 1.5, MESA.x + MESA.rx * 1.5, MESA.z - MESA.rz * 1.6, MESA.z + MESA.rz * 2.2, (x, z, h) => {
      const tj = Math.sqrt(((x - MESA.x) / MESA.rx) ** 2 + ((z - MESA.z) / MESA.rz) ** 2);
      if (tj > 1.5 || h < MARE + 1) return;
      if (Math.hypot(x - STAGNO.x, z - STAGNO.z) < STAGNO.r + 2) return;
      const c = R(), fitto = tj < 1.05 ? 1 : 0.45;
      if (c < 0.14 * fitto) metti('cs_h_albero_giungla', x, z, R() * 6.28, 2.6, { s: 0.75 + R() * 0.45, coll: 0.6 });
      else if (c < 0.16 * fitto) metti('cs_h_palma', x, z, R() * 6.28, 1.4, { s: 0.8 + R() * 0.3, coll: 0.45 });
      else if (c < 0.24 * fitto) metti('cs_h_cespuglio', x, z, R() * 6.28, 1.0, { s: 0.8 + R() * 0.7, margine: 0.4 });
    });
    // rovine sparse sull'altopiano e ai suoi piedi
    for (const [x, z] of [[-84, -150], [-70, -176], [-18, -170], [4, -150], [-96, -128], [-28, -136], [-60, -112], [-8, -186]] as [number, number][]) metti('cs_h_rovina', x, z, R() * 6.28, 5, { coll: [7, 6], s: 0.65 + R() * 0.3 });
    // il laghetto: canne e rocce intorno, la cascata
    for (let k = 0; k < 10; k++) { const a = (k / 10) * 6.28, x = STAGNO.x + Math.cos(a) * (STAGNO.r + 2.5), z = STAGNO.z + Math.sin(a) * (STAGNO.r + 2.5); metti(k % 3 ? 'cs_h_cespuglio' : 'cs_h_roccia_b', x, z, R() * 6.28, 1, { s: 0.7, margine: 0.5 }); }
    void CASCATA;
  }
  function neon() {
    // palazzi su una griglia storta, rivolti alla strada più vicina; insegne luminose sulle facciate
    for (let gx = -4; gx <= 4; gx++) for (let gz = -4; gz <= 4; gz++) {
      const x = NEON.x + gx * 16 + (R() - 0.5) * 3, z = NEON.z + gz * 16 + (R() - 0.5) * 3;
      if (Math.hypot(x - NEON.x, z - NEON.z) > NEON.r - 4 || t.quotaTerra(x, z) < MARE + 1.5) continue;
      const q = t.stradaVicina(x, z, 60), ry = q ? verso(x, z, q.c.x, q.c.z) : 0;
      const alto = 0.55 + R() * 0.5, m = R() < 0.5 ? 'cs_h_palazzo_a' : 'cs_h_palazzo_b';
      if (!metti(m, x, z, ry, 7, { sy: alto, coll: [10, 9], margine: 2.5 })) continue;
      insegna(tele, x, t.quotaTerra(x, z), z, ry, alto * 2.2, Math.floor(R() * 5));
    }
  }
  function lunapark() {
    const rx = LUNA.x + 20, rz = LUNA.z - 16;
    pezzi.push({ m: 'cs_h_ruota_base', x: rx, y: t.quotaTerra(rx, rz), z: rz, ry: verso(rx, rz, 128, -27) + 0.4 }); occupa(rx, rz, 9); rett(rx, rz, verso(rx, rz, 128, -27) + 0.4, 12, 4);
    metti('cs_h_tendone', LUNA.x + 8, LUNA.z + 28, verso(LUNA.x + 8, LUNA.z + 28, 128, -27), 10, { coll: 9.5, forza: true });
    giostra(tele, LUNA.x - 6, t.quotaTerra(LUNA.x - 6, LUNA.z - 26), LUNA.z - 26, 0); occupa(LUNA.x - 6, LUNA.z - 26, 6); ostacoli.push({ x: LUNA.x - 6, z: LUNA.z - 26, r: 5 });
    giostra(tele, LUNA.x + 30, t.quotaTerra(LUNA.x + 30, LUNA.z + 6), LUNA.z + 6, 1); occupa(LUNA.x + 30, LUNA.z + 6, 6); ostacoli.push({ x: LUNA.x + 30, z: LUNA.z + 6, r: 5 });
    for (const [x, z] of [[LUNA.x - 10, LUNA.z + 8], [LUNA.x + 2, LUNA.z - 4], [LUNA.x + 16, LUNA.z - 34], [LUNA.x - 14, LUNA.z - 8]] as [number, number][]) metti('cs_h_bancarella', x, z, verso(x, z, LUNA.x, LUNA.z), 2.2, { coll: [3.6, 2] });
    // pali coi festoni tra le attrazioni
    const pali: [number, number][] = [];
    for (let k = 0; k < 9; k++) { const a = (k / 9) * 6.28, x = LUNA.x + 4 + Math.cos(a) * 24, z = LUNA.z - 4 + Math.sin(a) * 24; if (metti('cs_h_bandiera', x, z, verso(x, z, LUNA.x, LUNA.z), 0.5, { coll: 0.3 })) pali.push([x, z]); }
    for (let i = 0; i + 1 < pali.length; i++) { const a = pali[i]!, b = pali[i + 1]!; if (Math.hypot(a[0] - b[0], a[1] - b[1]) < 22) festone(tele.at(a[0], a[1], 'pv'), [a[0], t.quotaTerra(a[0], a[1]) + 4.4, a[1]], [b[0], t.quotaTerra(b[0], b[1]) + 4.4, b[1]], i + 3); }
    sparsi(60, LUNA.x - 40, LUNA.x + 40, LUNA.z - 40, LUNA.z + 40, (x, z) => { if (R() < 0.1) metti('cs_h_coni', x, z, R() * 6.28, 0.6, { margine: 1 }); });
  }
  function fondale() {
    // coralli giganti, conchiglie, nuvole basse sul capo; bolle (sfere) sopra la scogliera
    sparsi(500, CAPO.x - 50, CAPO.x + 60, CAPO.z - 40, CAPO.z + 40, (x, z, h) => {
      if (h < CAPO.h - 3 || Math.hypot(x - CAPO.x, z - CAPO.z) > CAPO.r + 10) return;
      const c = R();
      if (c < 0.1) metti('cs_h_corallo', x, z, R() * 6.28, 3.5, { s: 0.55 + R() * 0.6, coll: 1.6 });
    });
    for (const [x, z, s] of [[CAPO.x - 4, CAPO.z - 18, 1.4], [CAPO.x + 24, CAPO.z - 14, 1], [CAPO.x - 20, CAPO.z + 10, 1.2]] as [number, number, number][]) {
      if (!libero(x, z, 3.5 * s)) continue;
      conchiglia(tele, x, t.quotaTerra(x, z), z, verso(x, z, CAPO.x + 14, CAPO.z + 8), s, s > 1.1 ? 'rosaNeon' : 'pietraChiara'); occupa(x, z, 3.5 * s); ostacoli.push({ x, z, r: 2.6 * s });
    }
    for (const [x, y, z, s] of [[CAPO.x + 10, 26, CAPO.z - 8, 1.4], [CAPO.x + 44, 20, CAPO.z + 6, 1.8], [CAPO.x - 14, 30, CAPO.z + 18, 1.1], [CAPO.x + 30, 34, CAPO.z - 30, 1.2], [CAPO.x + 64, 24, CAPO.z - 12, 2.2], [CAPO.x + 20, 15, CAPO.z + 22, 0.9]] as [number, number, number, number][])
      nuvola(tele, x, y, z, s);
    // la staccionata sul ciglio della scogliera
    for (let a = -1.1; a < 1.4; a += 0.09) { const x = CAPO.x + 6 + Math.cos(a) * 44, z = CAPO.z + 6 + Math.sin(a) * 30; if (distCosta(x, z) > 3 && distCosta(x, z) < 12) metti('cs_h_staccionata', x, z, a, 1, { coll: 0.3, margine: 0.6 }); }
  }
  function campagna() {
    // alberi tondi, cespugli e rocce sui prati; palme vicino al mare; fiori sparsi
    sparsi(11000, -230, 230, -210, 210, (x, z, h) => {
      if (h < MARE + 0.8) return;
      if (Math.hypot(x - MONTE.x, z - MONTE.z) < MONTE.r || Math.sqrt(((x - MESA.x) / MESA.rx) ** 2 + ((z - MESA.z) / MESA.rz) ** 2) < 1.5) return;
      if (Math.hypot(x - NEON.x, z - NEON.z) < NEON.r + 4 || Math.hypot(x - LUNA.x, z - LUNA.z) < LUNA.r - 6 || Math.hypot(x - ROT.x, z - ROT.z) < ROT.r + 8) return;
      if (Math.hypot(x - CAPO.x, z - CAPO.z) < CAPO.r - 4 || (x > -70 && x < 70 && z > 92 && z < 160)) return;
      const sup = t.superficie(x, z), c = R(), bosco = rumore(x, z, 40, 71);
      if (sup !== 'erba') return;
      const ripido = Math.abs(t.quotaTerra(x + 2, z) - h) + Math.abs(t.quotaTerra(x, z + 2) - h) > 1.6;
      if (ripido) { if (c < 0.12) metti(R() < 0.5 ? 'cs_h_roccia_a' : 'cs_h_roccia_b', x, z, R() * 6.28, 2, { s: 0.7 + R() * 0.9, coll: 1.3 }); return; }
      const costa = distCosta(x, z) < 22;
      if (c < (bosco > 0.55 ? 0.2 : 0.06)) metti(costa ? 'cs_h_palma' : 'cs_h_albero', x, z, R() * 6.28, 1.8, { s: (costa ? 0.7 : 0.85) + R() * 0.4, coll: 0.55 });
      else if (c < (bosco > 0.55 ? 0.3 : 0.11)) metti('cs_h_cespuglio', x, z, R() * 6.28, 1, { s: 0.7 + R() * 0.6, margine: 0.5 });
      else if (c < 0.115) metti(R() < 0.5 ? 'cs_h_roccia_a' : 'cs_h_roccia_b', x, z, R() * 6.28, 1.4, { s: 0.5 + R() * 0.5, coll: 0.9 });
      else if (c < 0.2) fiore(tele.at(x, z, 'pv'), x, h, z, (['rosso', 'giallo', 'pietraChiara', 'rosaNeon'] as NomeP[])[Math.floor(R() * 4)]!, 0.9);
    });
  }
  function mare() {
    sparsi(2600, -280, 280, -280, 280, (x, z, h) => {
      if (Math.abs(x) < 30 && z > 140) return; // la rotta della barca
      if (h < MARE - 0.2 && h > MARE - 3.5 && R() < 0.3) metti(R() < 0.5 ? 'cs_scoglio_a' : 'cs_scoglio_b', x, z, R() * 6.28, 2.4, { y: MARE - 0.5, s: 0.7 + R() * 0.9, acqua: true, coll: 1.6 });
      else if (h < MARE - 5 && distCosta(x, z) < -30 && R() < 0.01) metti('cs_barca_vela', x, z, R() * 6.28, 6, { y: MARE - 0.1, acqua: true });
    });
  }

  // ---------- i parapetti dei ponti ----------
  for (const st of t.strade) for (let i = 0; i < st.c.length; i += 2) { const c = st.c[i]!; if (!c.ponte) continue; for (const s of [-1, 1]) ostacoli.push({ x: c.x + c.tz * s * (c.l + 0.45), z: c.z - c.tx * s * (c.l + 0.45), r: 0.45 }); }

  // segnaposto procedurali delle cose che il kit non ha
  return { pezzi, teste, ostacoli, porte, garage, molo, ruota: { x: LUNA.x + 20, y: t.quotaTerra(LUNA.x + 20, LUNA.z - 16), z: LUNA.z - 16, ry: guarda(128 - LUNA.x - 20, -27 - LUNA.z + 16) + 0.4, s: 1 } };
}

export { NOMI };
