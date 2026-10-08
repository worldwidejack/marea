// @marea/content/diario.ts: Diario del capitano e traguardi (#87). Cataloghi dell'album (minigiochi con la loro pagina di raccolta,
// tipi di perla, animali da avvistare, isole da visitare) e definizioni dei traguardi coi loro premi in Perle e titoli. Solo dati:
// le formule (progresso, sblocco, riscossione) stanno in @marea/sim/economy/diario.ts. Entry separata da index.ts come porto.ts;
// index.ts chiama validateDiario() dentro validateContent().
import diario from './diario.json' with { type: 'json' };
import traguardi from './traguardi.json' with { type: 'json' };
import pesca from './minigames/pesca.json' with { type: 'json' };
import buildings from './buildings.json' with { type: 'json' };
import archipelago from './archipelago.json' with { type: 'json' };
import islands from './islands.json' with { type: 'json' };

/** Pagina dell'album dove finisce quello che un minigioco raccoglie (il modulo della sim lo dice con `raccolta(s)`). */
export type DiarioRaccolta = 'pesci' | 'perle';
export type DiarioMinigioco = { id: string; nome: string; raccolta?: DiarioRaccolta };
export type DiarioVoce = { id: string; nome: string; battuta: string };
export type DiarioAnimale = DiarioVoce & { dove: string };
export type DiarioDef = { minigiochi: DiarioMinigioco[]; perle: DiarioVoce[]; animali: DiarioAnimale[] };
export type DiarioIsola = { id: string; nome: string };

/** Condizione di un traguardo: `n` = quanti, `tutti` = tutto il catalogo (si adegua da solo quando il catalogo cresce). */
export type TraguardoSe = {
  tipo: TraguardoTipo;
  n?: number;
  tutti?: boolean;
  /** `rarita`: rarità del pesce (pesca.json). */
  rarita?: string;
  /** `perla`: tipo di perla (diario.json `perle`). */
  perla?: string;
  /** `medaglie`: medaglia minima (bronzo ≤ argento ≤ oro). */
  medaglia?: 'oro' | 'argento' | 'bronzo';
  /** `edificio`: edificio e livello. */
  edificio?: string;
  livello?: number;
  /** `edifici`: edifici da costruire tutti (livello ≥ 1). */
  ids?: string[];
};
export type TraguardoDef = { id: string; nome: string; testo: string; titolo: string; perle: number; se: TraguardoSe };

/** Cosa sa contare il server (Lot DO): un tipo fuori da qui non si potrebbe mai compiere. */
export const TRAGUARDO_TIPI = ['pesci', 'specie', 'rarita', 'perle', 'perla', 'tipiPerle', 'medaglie', 'giocati', 'partite', 'edificio', 'edifici', 'animali', 'isole', 'amici', 'dungeon'] as const;
export type TraguardoTipo = (typeof TRAGUARDO_TIPI)[number];

export const DIARIO = diario as unknown as DiarioDef;
export const TRAGUARDI = (traguardi as unknown as { traguardi: TraguardoDef[] }).traguardi;
/** Lunghezza massima di un titolo (deve stare sotto il nome sopra la testa, anche sul telefono). */
export const TITOLO_MAX = 20;

type IsolaJson = { id: string; nome: string };
type ArchJson = { islands: { island: string; role: string }[] };
/** Le isole da visitare: tutte quelle dell'arcipelago che non sono lotti (Porto, Laguna, facciate, isole a tema), una volta sola. */
export const ISOLE_DIARIO: readonly DiarioIsola[] = (() => {
  const out: DiarioIsola[] = [];
  for (const p of (archipelago as unknown as ArchJson).islands) {
    if (p.role === 'lotto' || out.some((x) => x.id === p.island)) continue;
    const def = (islands as unknown as IsolaJson[]).find((i) => i.id === p.island);
    out.push({ id: p.island, nome: def?.nome ?? p.island });
  }
  return out;
})();
/** Id dei pesci (pesca.json): la pagina Pesci dell'album. */
export const PESCI_DIARIO: readonly { id: string; rarita: string }[] = (pesca as unknown as { pesci: { id: string; rarita: string }[] }).pesci;

/** [] se tutto ok, altrimenti errori in italiano. */
export function validateDiario(): string[] {
  const errs: string[] = [];
  const unici = (nome: string, ids: string[]) => { const s = new Set<string>(); for (const id of ids) { if (s.has(id)) errs.push(`${nome}: id duplicato ${id}`); s.add(id); } };
  unici('diario.minigiochi', DIARIO.minigiochi.map((m) => m.id));
  unici('diario.perle', DIARIO.perle.map((m) => m.id));
  unici('diario.animali', DIARIO.animali.map((m) => m.id));
  unici('traguardi', TRAGUARDI.map((t) => t.id));
  for (const m of DIARIO.minigiochi) if (m.raccolta && m.raccolta !== 'pesci' && m.raccolta !== 'perle') errs.push(`diario.minigiochi ${m.id}: raccolta sconosciuta ${String(m.raccolta)}`);
  if (!DIARIO.perle.length || !DIARIO.animali.length || !DIARIO.minigiochi.length) errs.push('diario: catalogo vuoto');
  const rarita = new Set(PESCI_DIARIO.map((p) => p.rarita));
  const edifici = new Set((buildings as unknown as { id: string; levels: unknown[] }[]).map((b) => b.id));
  const livelli = (id: string) => (buildings as unknown as { id: string; levels: unknown[] }[]).find((b) => b.id === id)?.levels.length ?? 0;
  const titoli = new Set<string>();
  for (const t of TRAGUARDI) {
    const se = t.se, dove = `traguardo ${t.id}`;
    if (!(TRAGUARDO_TIPI as readonly string[]).includes(se.tipo)) errs.push(`${dove}: tipo ${se.tipo} che il server non sa contare`);
    if (!t.nome || !t.testo) errs.push(`${dove}: manca nome o testo`);
    if (!t.titolo || t.titolo.length > TITOLO_MAX) errs.push(`${dove}: titolo vuoto o più lungo di ${TITOLO_MAX}`);
    if (titoli.has(t.titolo)) errs.push(`${dove}: titolo ripetuto ${t.titolo}`);
    titoli.add(t.titolo);
    if (!Number.isInteger(t.perle) || t.perle < 1 || t.perle > 50) errs.push(`${dove}: premio in Perle fuori da 1-50`);
    const conTutti = ['specie', 'tipiPerle', 'medaglie', 'giocati', 'animali', 'isole', 'amici'].includes(se.tipo);
    const senzaN = se.tipo === 'edificio' || se.tipo === 'edifici' || (se.tipo === 'tipiPerle' && se.tutti);
    if (se.tutti && !conTutti) errs.push(`${dove}: «tutti» non vale per ${se.tipo}`);
    if (!senzaN && !se.tutti && !(Number.isInteger(se.n) && (se.n ?? 0) >= 1)) errs.push(`${dove}: serve n ≥ 1 o tutti`);
    if (se.tipo === 'rarita' && !rarita.has(se.rarita ?? '')) errs.push(`${dove}: rarità sconosciuta ${String(se.rarita)}`);
    if (se.tipo === 'perla' && !DIARIO.perle.some((p) => p.id === se.perla)) errs.push(`${dove}: perla sconosciuta ${String(se.perla)}`);
    if (se.tipo === 'medaglie' && !['oro', 'argento', 'bronzo'].includes(se.medaglia ?? '')) errs.push(`${dove}: medaglia sconosciuta`);
    if (se.tipo === 'edificio' && (!edifici.has(se.edificio ?? '') || !(Number.isInteger(se.livello) && (se.livello ?? 0) >= 1 && (se.livello ?? 0) <= livelli(se.edificio ?? ''))))
      errs.push(`${dove}: edificio o livello non validi`);
    if (se.tipo === 'edifici' && (!se.ids?.length || se.ids.some((id) => !edifici.has(id)))) errs.push(`${dove}: edifici sconosciuti`);
    const catalogo = se.tipo === 'specie' ? PESCI_DIARIO.length : se.tipo === 'animali' ? DIARIO.animali.length : se.tipo === 'isole' ? ISOLE_DIARIO.length
      : se.tipo === 'giocati' || se.tipo === 'medaglie' ? DIARIO.minigiochi.length : se.tipo === 'tipiPerle' ? DIARIO.perle.length : Infinity;
    if (se.n !== undefined && se.n > catalogo) errs.push(`${dove}: n ${se.n} oltre il catalogo (${catalogo})`);
  }
  return errs;
}
