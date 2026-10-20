// @marea/content/diario.ts: Diario del capitano. Cataloghi dell'album (minigiochi con la loro pagina di raccolta, tipi di perla,
// animali da avvistare, isole da visitare). Solo dati: le formule stanno in @marea/sim/economy/diario.ts. I traguardi coi titoli sono
// stati tolti (tag archivio/spenti-traguardi). Entry separata da index.ts come porto.ts; index.ts chiama validateDiario() dentro validateContent().
import diario from './diario.json' with { type: 'json' };
import pesci from './pesci.json' with { type: 'json' };
import archipelago from './archipelago.json' with { type: 'json' };
import islands from './islands.json' with { type: 'json' };

/** Pagina dell'album dove finisce quello che un minigioco raccoglie (il modulo della sim lo dice con `raccolta(s)`). */
export type DiarioRaccolta = 'pesci' | 'perle';
export type DiarioMinigioco = { id: string; nome: string; raccolta?: DiarioRaccolta };
export type DiarioVoce = { id: string; nome: string; battuta: string };
export type DiarioAnimale = DiarioVoce & { dove: string };
export type DiarioDef = { minigiochi: DiarioMinigioco[]; perle: DiarioVoce[]; animali: DiarioAnimale[] };
export type DiarioIsola = { id: string; nome: string };

export const DIARIO = diario as unknown as DiarioDef;

type IsolaJson = { id: string; nome: string };
type ArchJson = { islands: { island: string; role: string }[] };
/** Le isole da visitare: tutte quelle dell'arcipelago che non sono lotti, Borgo o pontili (Porto, Laguna, facciate, isole a tema), una volta sola. */
export const ISOLE_DIARIO: readonly DiarioIsola[] = (() => {
  const out: DiarioIsola[] = [];
  for (const p of (archipelago as unknown as ArchJson).islands) {
    if (p.role === 'lotto' || out.some((x) => x.id === p.island)) continue;
    const def = (islands as unknown as IsolaJson[]).find((i) => i.id === p.island);
    out.push({ id: p.island, nome: def?.nome ?? p.island });
  }
  return out;
})();
/** Id e rarità dei pesci (pesci.json): la pagina Pesci dell'album. */
export const PESCI_DIARIO: readonly { id: string; rarita: string }[] = (pesci as unknown as { pesci: { id: string; rarita: string }[] }).pesci;

/** [] se tutto ok, altrimenti errori in italiano. */
export function validateDiario(): string[] {
  const errs: string[] = [];
  const unici = (nome: string, ids: string[]) => { const s = new Set<string>(); for (const id of ids) { if (s.has(id)) errs.push(`${nome}: id duplicato ${id}`); s.add(id); } };
  unici('diario.minigiochi', DIARIO.minigiochi.map((m) => m.id));
  unici('diario.perle', DIARIO.perle.map((m) => m.id));
  unici('diario.animali', DIARIO.animali.map((m) => m.id));
  for (const m of DIARIO.minigiochi) if (m.raccolta && m.raccolta !== 'pesci' && m.raccolta !== 'perle') errs.push(`diario.minigiochi ${m.id}: raccolta sconosciuta ${String(m.raccolta)}`);
  if (!DIARIO.perle.length || !DIARIO.animali.length || !DIARIO.minigiochi.length) errs.push('diario: catalogo vuoto');
  return errs;
}
