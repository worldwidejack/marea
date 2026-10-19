// @marea/content/botteghe.ts: le botteghe di Borgo Marea (#414, VISIONE §2): Fabbro, Alchimista, Cantiere navale al posto degli edifici del
// giardino. Entry separata da index.ts come porto.ts (la usano solo il chunk delle botteghe, il GDR e il server). Solo dati: le formule
// (livelli, vetrine del giorno, prezzi) stanno in @marea/sim/economy/botteghe.ts e @marea/sim/rpg/botteghe.ts.
import botteghe from './botteghe.json' with { type: 'json' };
import avatar from './avatar.json' with { type: 'json' };

export type BottegaId = 'fabbro' | 'alchimista' | 'cantiere';
export const BOTTEGHE_IDS: readonly BottegaId[] = ['fabbro', 'alchimista', 'cantiere'];
/** Un livello di una bottega: quanto costa arrivarci (il primo è di tutti, 0) e cosa dà, in una riga. */
export type BottegaLivello = { monete: number; desc: string };
/** `scomparti`: la vetrina del giorno pesca un oggetto da ognuno (id di oggetti, di colori della barca o, nel Fabbro, tipi d'arma da
 *  incrociare con `materiali`); `ricarico`: prezzo = valore dell'oggetto × ricarico (Fabbro e Alchimista). */
export type BottegaDef = { nome: string; bottegaio: string; livelli?: BottegaLivello[]; ricarico?: number; materiali?: string[]; scomparti: string[][] };
export type BottegheDef = Record<BottegaId, BottegaDef>;

export const BOTTEGHE = botteghe as unknown as BottegheDef;

/** [] se tutto ok, altrimenti errori in italiano (li chiama il test della sim; gli id degli oggetti li controlla lì, col catalogo vero). */
export function validateBotteghe(): string[] {
  const errs: string[] = [];
  for (const id of BOTTEGHE_IDS) {
    const b = BOTTEGHE[id];
    if (!b) { errs.push(`botteghe: manca ${id}`); continue; }
    if (!b.nome || !b.bottegaio) errs.push(`botteghe ${id}: manca il nome o il bottegaio`);
    if (!b.scomparti.length || b.scomparti.some((s) => !s.length)) errs.push(`botteghe ${id}: scomparti della vetrina vuoti`);
    const tutti = b.scomparti.flat();
    if (new Set(tutti).size !== tutti.length) errs.push(`botteghe ${id}: un oggetto sta in due scomparti`);
    if (b.ricarico !== undefined && !(b.ricarico >= 1)) errs.push(`botteghe ${id}: ricarico sotto 1`);
    if (b.livelli) {
      if (b.livelli[0]?.monete !== 0) errs.push(`botteghe ${id}: il primo livello è gratis (è di tutti)`);
      for (const [n, l] of b.livelli.entries()) {
        if (!(Number.isInteger(l.monete) && l.monete >= 0)) errs.push(`botteghe ${id}: livello ${n + 1} con un prezzo non valido`);
        if (n > 0 && l.monete <= (b.livelli[n - 1]?.monete ?? 0)) errs.push(`botteghe ${id}: il livello ${n + 1} deve costare più del ${n}`);
        if (!l.desc) errs.push(`botteghe ${id}: livello ${n + 1} senza descrizione`);
      }
    }
  }
  // il Cantiere vende le vernici `cantiere` di avatar.json, tutte e solo quelle
  const vernici = new Set(avatar.barca.colori.filter((k) => (k as { cantiere?: boolean }).cantiere).map((k) => k.id));
  const inVetrina = new Set(BOTTEGHE.cantiere?.scomparti.flat() ?? []);
  for (const k of inVetrina) if (!vernici.has(k)) errs.push(`botteghe cantiere: ${k} non è una vernice del Cantiere (avatar.json, cantiere: true)`);
  for (const k of vernici) if (!inVetrina.has(k)) errs.push(`botteghe cantiere: la vernice ${k} non esce mai in vetrina`);
  if (BOTTEGHE.cantiere?.livelli?.length !== 3) errs.push('botteghe cantiere: i livelli sono quelli del Molo (3)');
  if (BOTTEGHE.fabbro?.livelli?.length !== 3) errs.push('botteghe fabbro: i livelli sono quelli del Banco da Lavoro (3)');
  return errs;
}
