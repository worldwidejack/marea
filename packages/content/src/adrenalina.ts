// @marea/content/adrenalina.ts: dati delle discese dell'Isola dell'Adrenalina (docs/ADRENALINA.md, CONTRACTS §42). Entry separata da
// index.ts come quella delle Corse: il bundle iniziale del client non la importa, la caricano solo il chunk delle discese
// (apps/client/src/adrenalina/**), i test e il server. Le piste sono generate da tools/adrenalina_piste.mjs (non si scrivono a mano).
import barra from './adrenalina/barra.json' with { type: 'json' };
import snowboard from './adrenalina/snowboard.json' with { type: 'json' };
import snowboardVerde from './adrenalina/piste/snowboard_verde.json' with { type: 'json' };
import type { BarraCfg, SPistaDef, SnowboardCfg } from './adrenalina_types.ts';

export type * from './adrenalina_types.ts';

export const BARRA = barra as unknown as BarraCfg;
export const SNOWBOARD = snowboard as unknown as SnowboardCfg;
/** Le piste dello snowboard per id (per ora la verde: blu, rossa e nera al passo 7). */
export const SNOWBOARD_PISTE: Record<string, SPistaDef> = Object.fromEntries(([snowboardVerde] as unknown as SPistaDef[]).map((p) => [p.id, p]));

/** Controlli dei dati (in italiano): numeri positivi, porte, trampolini e ostacoli dentro la pista e in ordine. */
export function validateAdrenalina(): string[] {
  const errs: string[] = [];
  const pos = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v > 0;
  const b = BARRA;
  for (const [k, v] of Object.entries(b.riempi)) if (!pos(v) || v > 1) errs.push(`adrenalina: barra.riempi.${k} fuori da (0, 1]`);
  if (!pos(b.calaDopo) || !pos(b.cala)) errs.push('adrenalina: barra senza calaDopo o cala');
  if (!(b.soglie[0] > 0 && b.soglie[0] < b.soglie[1] && b.soglie[1] <= 1)) errs.push('adrenalina: barra.soglie non crescenti dentro (0, 1]');
  const c = SNOWBOARD;
  for (const [k, v] of Object.entries(c.fisica)) if (!pos(v)) errs.push(`snowboard: fisica.${k} non valido`);
  for (const [k, v] of Object.entries(c.salto)) if (!pos(v)) errs.push(`snowboard: salto.${k} non valido`);
  if (c.salto.grande > c.salto.finestra) errs.push('snowboard: salto.grande più lungo della finestra');
  for (const [k, t] of Object.entries(c.trick)) if (!pos(t.durata) || !pos(t.punti) || !t.nome) errs.push(`snowboard: trick ${k} non valido`);
  for (const k of ['rasente', 'corpo', 'caduta', 'maxSecondi', 'combo', 'ultimoIstante'] as const) if (!pos(c[k])) errs.push(`snowboard: ${k} non valido`);
  for (const p of Object.values(SNOWBOARD_PISTE)) {
    const e = (m: string) => errs.push(`snowboard ${p.id}: ${m}`);
    if (p.punti.length < 3) e('servono almeno 3 punti');
    if (!(p.partenza >= 0 && p.arrivo > p.partenza)) e('partenza e arrivo non in ordine');
    let prima = -1;
    for (const q of p.porte) {
      if (q.s <= prima) e(`porta a ${q.s} m fuori ordine`);
      if (q.s <= p.partenza || q.s >= p.arrivo) e(`porta a ${q.s} m fuori dalla discesa`);
      if (!pos(q.w)) e(`porta a ${q.s} m senza larghezza`);
      prima = q.s;
    }
    for (const r of p.rampe) if (!pos(r.lungo) || !pos(r.alto) || !pos(r.salto) || r.s - r.lungo <= p.partenza || r.s >= p.arrivo || r.lat[0] >= r.lat[1]) e(`trampolino a ${r.s} m non valido`);
    prima = -1;
    for (const o of p.ostacoli) { if (o.s < prima) e(`ostacolo a ${o.s} m fuori ordine`); if (!pos(o.r)) e(`ostacolo a ${o.s} m senza raggio`); prima = o.s; }
    for (const g of p.gole) if (!(g.a > g.da)) e(`gola ${g.da}-${g.a} rovesciata`);
    const f = p.fuoripista;
    if (f && (!(f.a > f.da && f.da > p.partenza && f.a <= p.arrivo) || !pos(f.neve) || f.chiusa.punti.length < 2 || !pos(f.chiusa.l) || !pos(f.chiusa.tronco))) e('fuoripista non valido');
  }
  return errs;
}
