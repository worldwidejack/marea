// @marea/content/corse.ts: dati del motore v2 dell'Isola delle Corse (docs/CORSE.md A11). Entry separata da index.ts: il bundle
// iniziale del client non la importa, la caricano solo il chunk delle corse (apps/client/src/corse/**) e il server. Le piste sono
// generate da tools/corse_piste.mjs (non si scrivono a mano). Formule in @marea/sim/corse.
import motore from './corse/motore.json' with { type: 'json' };
import provaAnello from './corse/piste/prova_anello.json' with { type: 'json' };
import provaFolle from './corse/piste/prova_folle.json' with { type: 'json' };
import provaBaia from './corse/piste/prova_baia.json' with { type: 'json' };
import provaFuga from './corse/piste/prova_fuga.json' with { type: 'json' };
import spiaggiaLungomare from './corse/piste/spiaggia_lungomare.json' with { type: 'json' };
import spiaggiaBaia from './corse/piste/spiaggia_baia.json' with { type: 'json' };
import spiaggiaPorto from './corse/piste/spiaggia_porto.json' with { type: 'json' };
import spiaggiaFuga from './corse/piste/spiaggia_fuga.json' with { type: 'json' };
import type { CPistaDef, CorseMotoreCfg } from './corse_types.ts';

export type * from './corse_types.ts';

export const CORSE = motore as unknown as CorseMotoreCfg;
/** Le piste per id, nell'ordine del banco di prova. */
export const CORSE_PISTE: Record<string, CPistaDef> = Object.fromEntries(
  ([provaAnello, provaFolle, provaBaia, provaFuga, spiaggiaLungomare, spiaggiaBaia, spiaggiaPorto, spiaggiaFuga] as unknown as CPistaDef[]).map((p) => [p.id, p]),
);

/** Controlli dei dati (in italiano): veicoli e superfici conosciuti, piste coerenti (griglia, tratti dentro la pista, rami). */
export function validateCorse(): string[] {
  const errs: string[] = [], c = CORSE;
  const pos = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v > 0;
  const famiglie = Object.keys(c.famiglie);
  for (const v of c.veicoli) {
    if (!famiglie.includes(v.famiglia)) errs.push(`corse: veicolo ${v.id} di una famiglia sconosciuta (${v.famiglia})`);
    for (const k of ['velocita', 'accelerazione', 'sterzo', 'presa', 'presaDrift', 'drift', 'peso'] as const) if (!pos(v[k])) errs.push(`corse: veicolo ${v.id} con ${k} non valido`);
    for (const s of Object.keys(v.effetti ?? {})) if (!c.superfici[s]) errs.push(`corse: veicolo ${v.id} con un effetto su una superficie sconosciuta (${s})`);
  }
  for (const f of famiglie) if (!pos(c.bot.bravuraFamiglia[f as keyof typeof c.bot.bravuraFamiglia])) errs.push(`corse: bot senza bravuraFamiglia per ${f}`);
  for (const [f, ids] of Object.entries(c.bot.veicoli)) for (const id of ids) {
    const v = c.veicoli.find((x) => x.id === id);
    if (!v || v.famiglia !== f) errs.push(`corse: veicolo dei bot ${id} non è della famiglia ${f}`);
  }
  for (const s of Object.values(c.superfici)) for (const f of famiglie) if (!s.per[f as keyof typeof s.per]) errs.push(`corse: superficie ${s.id} senza effetto per ${f}`);
  const sup = (id: string, dove: string) => { if (id !== 'vuoto' && !c.superfici[id]) errs.push(`corse: ${dove}: superficie sconosciuta ${id}`); };
  for (const p of Object.values(CORSE_PISTE)) {
    const d = `pista ${p.id}`;
    if (!famiglie.includes(p.famiglia)) errs.push(`corse: ${d} di una famiglia sconosciuta`);
    const fams = p.famiglie ?? [p.famiglia];
    if (fams[0] !== p.famiglia) errs.push(`corse: ${d}: la prima delle famiglie deve essere ${p.famiglia}`);
    for (const f of fams) {
      if (!famiglie.includes(f)) errs.push(`corse: ${d}: famiglia sconosciuta ${f}`);
      else if (!c.veicoli.some((v) => v.famiglia === f)) errs.push(`corse: ${d}: nessun veicolo della famiglia ${f}`);
      if (fams.length > 1 && typeof p.corsie?.[f] !== 'number') errs.push(`corse: ${d}: pista mista senza corsia per ${f}`);
    }
    for (const r of p.rami) for (const f of r.famiglie ?? []) if (!fams.includes(f)) errs.push(`corse: ${d}, ramo ${r.id}: famiglia ${f} che non corre qui`);
    const O = p.inseguitore;
    if (O) {
      if (p.tipo !== 'fuga') errs.push(`corse: ${d}: l'inseguitore c'è solo nelle fughe`);
      for (const k of ['v0', 'accel', 'vmax', 'distMax', 'recupero', 'spessore', 'colpo', 'rallenta'] as const) if (!pos(O[k])) errs.push(`corse: ${d}: inseguitore con ${k} non valido`);
      if (!(O.parte < 0) || p.via + O.parte < 0) errs.push(`corse: ${d}: l'inseguitore deve partire dietro il via ma dentro la pista (alza via)`);
    }
    if (p.punti.length < 3) errs.push(`corse: ${d} con meno di 3 punti`);
    if (p.griglia.length < 1) errs.push(`corse: ${d} senza griglia`);
    if (p.tipo === 'fuga' && p.griglia.some(([s]) => p.via + s < 0)) errs.push(`corse: ${d}: griglia prima dell'inizio della pista (alza via)`);
    sup(p.superficie, d); sup(p.bordoTipo, d);
    for (const t of p.superfici) sup(t.tipo, d);
    for (const e of p.eventi) { sup(e.superficie, `${d}, evento ${e.tipo}`); if (!(e.daGiro >= 1)) errs.push(`corse: ${d}: evento ${e.tipo} senza giro di partenza`); }
    for (const r of p.rami) { sup(r.superficie, `${d}, ramo ${r.id}`); if (r.punti.length < 2) errs.push(`corse: ${d}: ramo ${r.id} con meno di 2 punti`); }
    if (!pos(p.larghezza) || !(p.bordo >= 0) || !(p.muro > 0 && p.muro <= 1)) errs.push(`corse: ${d}: larghezza, bordo o muro non validi`);
  }
  return errs;
}
