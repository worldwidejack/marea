// @marea/content/insetti.ts: gli insetti di Borgo Marea (#445), dal Database_Insetti_GameDesign.xlsx di Riccardo. Solo dati: chi
// esce quando e dove sta in @marea/sim/economy/insetti.ts, come si muove in apps/client/src/game/insetti*.ts. Entry separata da index.ts
// (come diario.ts): il catalogo non pesa sul JS iniziale. La validazione la chiama il test della sim (insetti.test.ts).
import dati from './insetti.json' with { type: 'json' };
import islands from './islands.json' with { type: 'json' };

export type InsettoStagione = 'tutto' | 'primavera' | 'estate' | 'autunno' | 'inverno';
export type InsettoFascia = 'sempre' | 'giorno' | 'notte';
/** Dove si trova: in giro volando, a terra nell'erba, sotto un sasso colpito con la pala, su un albero scosso. */
export type InsettoTipo = 'volante' | 'terra' | 'sasso' | 'albero';
export type InsettoRarita = 'comune' | 'noncomune' | 'raro' | 'ultrararo';
/** Come si muove (game/insetti_vita.ts): una macchina a stati per tipo, ritoccata dal comportamento della specie. */
export type InsettoComportamento =
  | 'zigzag' | 'soste' | 'cerchi' | 'scatti' | 'maestosa' | 'lucciola' | 'diagonale' | 'basso'
  | 'gruppo' | 'calpesta' | 'fissa' | 'pattuglia' | 'chele' | 'balzi' | 'trillo' | 'foglia' | 'cammina' | 'pattina'
  | 'pausa' | 'subito' | 'guscio' | 'giratondo' | 'intontito'
  | 'nido' | 'cade' | 'filo' | 'striscia';
/** Disegno (sprite del Diario e forma 3D). */
export type InsettoForma =
  | 'porcellino' | 'ape' | 'bombo' | 'formica' | 'farfalla' | 'falena' | 'centopiedi' | 'chiocciola' | 'cimice' | 'coleottero' | 'mantide'
  | 'ragno' | 'forbicina' | 'cicala' | 'libellula' | 'lucciola' | 'ercole' | 'scorpione' | 'bruco' | 'cavalletta' | 'foglia' | 'astuccio' | 'grillotalpa';

export type InsettoDef = {
  id: string; nome: string; stagione: InsettoStagione; fascia: InsettoFascia; tipo: InsettoTipo; rarita: InsettoRarita;
  /** Peso nell'estrazione (50 comune, 25 non comune, 8 raro, 2 ultra-raro). */
  peso: number;
  /** Monete che dà il Contrabbandiere (Excel ÷ 10). */
  prezzo: number;
  /** 1 lenta, 2 media, 3 veloce, 4 scatto (m/s in `passi`). */
  velocita: 1 | 2 | 3 | 4;
  /** Metri: entro questa distanza si accorge di te (99 = sempre). */
  allerta: number;
  /** Secondi per prenderlo dopo che è uscito dal sasso o caduto dall'albero (l'insetto foglia: dopo che si è svegliato); 0 = nessun limite. */
  finestra: number;
  comportamento: InsettoComportamento; forma: InsettoForma;
  /** Tre colori della palette (ART_BIBLE §2, chiavi di PAL): corpo, secondo, accento. */
  colori: [string, string, string];
  /** La scheda del Diario: si legge solo dopo averlo consegnato al mobiliere. */
  descr: string;
};
/** La rete del retino (m): l'asta fino al cerchio, raggio del cerchio, lunghezza della sacca, raggio dell'insetto che vi entra. */
export type RetinoRete = { asta: number; raggio: number; sacca: number; corpo: number };
/** Il colpo di retino (game/retino_azione.ts): tempi in secondi, e da carico (A tenuto) la frazione di passo e di raggio di fuga; `allarme` in metri dall'impatto. */
export type RetinoUso = {
  caricaS: number; avvioS: number; fendenteS: number; impattoS: number; lagS: number; risalitaS: number;
  passoCarico: number; furtivoCarico: number; allarme: number;
};
export type InsettiCfg = {
  retino: { id: string; nome: string; monete: number; rete: RetinoRete; uso: RetinoUso };
  /** Il ciclo giorno/notte del gioco (render/ciclo.ts, CICLO_MIN): notte = fase del giro in [notte[0], notte[1]). */
  ciclo: { minuti: number; notte: [number, number] };
  /** Mesi (1-12, calendario di Roma) di ogni stagione. */
  stagioni: Record<Exclude<InsettoStagione, 'tutto'>, number[]>;
  /** m/s per velocità 1-4 (indice 0 non usato). */
  passi: [number, number, number, number, number];
  /** In giro (volanti e a terra): ogni `minuti` escono `quanti` insetti nuovi, uguali per tutti. */
  liberi: { minuti: number; quanti: number };
  /** I sassi di Borgo Marea (celle del template `porto`): uno al giorno a testa per sasso, con `probabilita` che esca un insetto. */
  sassi: { probabilita: number; celle: [number, number][] };
  /** Gli alberi (gli `albero_tondo` del template `porto`): uno al giorno a testa per albero. */
  alberi: { probabilita: number };
  rarita: Record<InsettoRarita, string>;
  insetti: InsettoDef[];
};

export const INSETTI_CFG = dati as unknown as InsettiCfg;
export const INSETTI: readonly InsettoDef[] = INSETTI_CFG.insetti;
export const RETINO = INSETTI_CFG.retino;

type Isola = { id: string; rows: string[]; props?: { k: string; at: [number, number]; rot?: number }[] };
const PORTO = (islands as unknown as Isola[]).find((i) => i.id === 'porto');
/** Gli alberi da scuotere: gli `albero_tondo` del template `porto`, nell'ordine del json (l'indice è l'id dell'albero). Coordinate in celle. */
export const ALBERI_BORGO: readonly { at: [number, number] }[] = (PORTO?.props ?? []).filter((p) => p.k === 'albero_tondo').map((p) => ({ at: [p.at[0], p.at[1]] }));

const TIPI = new Set(['volante', 'terra', 'sasso', 'albero']), FASCE = new Set(['sempre', 'giorno', 'notte']);
const STAGIONI = new Set(['tutto', 'primavera', 'estate', 'autunno', 'inverno']), RARITA = new Set(['comune', 'noncomune', 'raro', 'ultrararo']);
/** [] se il catalogo è a posto, altrimenti gli errori in italiano. */
export function validateInsetti(palette: readonly string[]): string[] {
  const errs: string[] = [], c = INSETTI_CFG, visti = new Set<string>();
  if (c.retino.id !== 'retino' || !(Number.isInteger(c.retino.monete) && c.retino.monete > 0)) errs.push('insetti: retino non valido');
  const { rete, uso } = c.retino;
  if (![rete.asta, rete.raggio, rete.sacca, rete.corpo, uso.caricaS, uso.avvioS, uso.fendenteS, uso.impattoS, uso.lagS, uso.risalitaS, uso.allarme].every((n) => n > 0)) errs.push('insetti: rete o tempi del retino non validi');
  if (![uso.passoCarico, uso.furtivoCarico].every((n) => n > 0 && n <= 1)) errs.push('insetti: passo e fuga da carico del retino fra 0 e 1');
  if (!(c.ciclo.minuti > 0 && c.ciclo.notte[0] >= 0 && c.ciclo.notte[0] < c.ciclo.notte[1] && c.ciclo.notte[1] <= 1)) errs.push('insetti: ciclo non valido');
  const mesi = Object.values(c.stagioni).flat().sort((a, b) => a - b);
  if (mesi.join(',') !== '1,2,3,4,5,6,7,8,9,10,11,12') errs.push('insetti: le stagioni devono coprire i 12 mesi una volta sola');
  if (!(Number.isInteger(c.liberi.quanti) && c.liberi.quanti > 0 && c.liberi.minuti > 0)) errs.push('insetti: liberi non validi');
  if (!c.sassi.celle.length || !(c.sassi.probabilita > 0 && c.sassi.probabilita <= 1)) errs.push('insetti: sassi non validi');
  for (const [x, z] of c.sassi.celle) if (!'.g'.includes(PORTO?.rows[z]?.[x] ?? '~')) errs.push(`insetti: il sasso ${x},${z} non sta su una cella camminabile`);
  if (!ALBERI_BORGO.length || !(c.alberi.probabilita > 0 && c.alberi.probabilita <= 1)) errs.push('insetti: alberi non validi');
  for (const i of INSETTI) {
    if (!/^[a-z_]{2,24}$/.test(i.id) || visti.has(i.id)) errs.push(`insetti: id non valido o doppio ${i.id}`);
    visti.add(i.id);
    if (!TIPI.has(i.tipo) || !FASCE.has(i.fascia) || !STAGIONI.has(i.stagione) || !RARITA.has(i.rarita)) errs.push(`insetti ${i.id}: tipo, fascia, stagione o rarità sconosciuti`);
    if (!(i.peso > 0 && Number.isInteger(i.prezzo) && i.prezzo > 0 && [1, 2, 3, 4].includes(i.velocita) && i.allerta >= 0 && i.finestra >= 0)) errs.push(`insetti ${i.id}: numeri non validi`);
    if ((i.tipo === 'sasso' || i.tipo === 'albero') && !(i.finestra > 0)) errs.push(`insetti ${i.id}: chi esce dai sassi o dagli alberi vuole una finestra`);
    if (i.colori.length !== 3 || i.colori.some((k) => !palette.includes(k))) errs.push(`insetti ${i.id}: colori fuori palette`);
    if (i.descr.length < 20) errs.push(`insetti ${i.id}: manca la descrizione`);
  }
  return errs;
}
