// @marea/content/paesani.ts: le chiacchiere dei paesani di Borgo Marea e i loro favori (#493), dal Word «Dialoghi personaggi» di
// Riccardo. Solo dati: quale battuta esce e quando, e i favori, stanno in @marea/sim/economy/paesani.ts. Entry separata da index.ts
// (come insetti.ts): le battute non pesano sul JS iniziale, le scarica il pannello del Porto quando parli. La validazione la chiama il
// test della sim (paesani.test.ts).
import dati from './paesani.json' with { type: 'json' };
import gente from './gente.json' with { type: 'json' };
import insetti from './insetti.json' with { type: 'json' };
import pesci from './pesci.json' with { type: 'json' };
import mobili from './mobili.json' with { type: 'json' };

/** Momenti della giornata (ore di Roma): `tarda` è la mattina dalle 10 a mezzogiorno, senza battute sue. */
export type PaesanoMomento = 'mattina' | 'tarda' | 'pranzo' | 'pomeriggio' | 'tramonto' | 'notte';
export type PaesanoStagione = 'primavera' | 'estate' | 'autunno' | 'inverno';
/** Condizione di una battuta: un momento, `giorno` (da mattina a pomeriggio), o il tempo che fa (`pioggia`, `vento`). */
export type PaesanoSolo = PaesanoMomento | 'giorno' | 'pioggia' | 'vento';
/** Una battuta: il testo, o il testo con le condizioni (`solo` = quando si può dire; `asciutto` = mai sotto la pioggia). */
export type Battuta = string | { t: string; solo?: PaesanoSolo[]; asciutto?: boolean };
export type MessaggioTipo = 'pranzo' | 'prestito' | 'scuse' | 'briscola' | 'aiuto';
/** I favori nella voce del paesano. Segnaposto: {a} {da} {cosa} {nome} {tempo} {monete} {mobile} (vedi `_nota` del json). */
export type PaesanoFavori = {
  /** Probabilità che chieda un pesce invece di un insetto, quando chi gioca ha sia la canna che il retino. */
  preferisce: { pesce: number };
  /** Richieste: porta un pesce, porta un insetto. */
  pesce: string[]; insetto: string[];
  /** Risposta al SÌ e al NON ORA. */
  si: string[]; no: string[];
  /** Torni senza: il pesce o l'insetto non ce l'hai ancora. */
  promemoria: string[];
  /** Torni e ce l'hai nello zaino (parte il bottone REGALA). */
  dono: string[];
  /** Dopo il regalo. */
  grazie: string[];
  /** Torni prima di aver portato il messaggio. */
  attesa: string[];
  /** Torni a tempo scaduto. */
  scaduto: string[];
  /** Il premio: monete o un mobile. */
  monete: string[]; mobile: string[];
  /** «Vai a dire a {a} che…»: chi chiede, cosa risponde chi lo riceve (con {da}), il grazie di chi l'ha chiesto quando torni. */
  messaggi: Record<MessaggioTipo, { chiede: string; risponde: string; grazie: string }>;
};
export type PaesanoDef = {
  /** Come lo chiamano gli altri nelle frasi ({a}, {da}). */
  chiamato: string;
  /** Dove si trova di solito (sotto la richiesta di un messaggio). */
  dove: string;
  base: Battuta[];
  momenti: Partial<Record<PaesanoMomento, Battuta[]>>;
  stagioni: Record<PaesanoStagione, Battuta[]>;
  /** Pioggia o vento forte. */
  brutto: Battuta[];
  /** La prima volta che ci parli. */
  primo: Battuta[];
  /** Chi gli parla troppe volte di fila: in ordine, poi a caso. */
  insistente: Battuta[];
  /** Prima e dopo che il Cancello del Vuoto è aperto. */
  lore: Battuta[]; loreAperto: Battuta[];
  favori: PaesanoFavori;
};
export type PaesaniCfg = {
  /** Ore di Roma [dalle, alle) di ogni momento (la notte passa la mezzanotte). */
  momenti: Record<PaesanoMomento, [number, number]>;
  /** Peso di ogni bacino quando si sceglie la battuta (`brutto` solo col brutto tempo, `lore`/`loreAperto` secondo il Cancello). */
  pesi: { brutto: number; momento: number; base: number; stagione: number; lore: number; loreAperto: number };
  /** Probabilità di una seconda battuta (da un altro bacino) nella stessa chiacchierata. */
  secondaFrase: number;
  /** Quante battute per paesano ricordare per non ripeterle. */
  memoria: number;
  /** Dalla `dalla`-esima chiacchierata entro `finestraS` secondi parte l'«insistente». */
  insistente: { finestraS: number; dalla: number };
  /** Brutto tempo: pioggia o vento (0..1, sim/meteo.ts) da queste soglie in su. */
  brutto: { pioggia: number; vento: number };
  favori: {
    /** Ogni `slotMin` minuti ogni paesano decide (uguale su server e client) se ha un favore da chiedere, con `probabilita`. */
    slotMin: number; probabilita: number;
    /** Favori accettati al massimo in un giorno di Roma. */
    alGiorno: number;
    /** Probabilità che il favore sia «portami un pesce/insetto» (se hai la canna o il retino) invece di «vai a dire a…». */
    porta: number;
    /** Minuti senza nuove richieste dopo un NON ORA e dopo un favore finito. */
    pausaMin: { no: number; fatto: number };
    /** Minuti per portare un messaggio. */
    parlaMin: number;
    /** Tempo per portare il pesce o l'insetto: da [min, max] minuti a passi di `passoMin`; la specie c'è per tutto il tempo (controllata ogni `controlloMin`). */
    durataMin: [number, number]; passoMin: number; controlloMin: number;
    /** Rarità che si possono chiedere, e peso delle zone dei pesci (riva del Borgo, barca al largo). */
    rarita: string[]; zona: { riva: number; barca: number };
    /** Monete: messaggio in [min, max] (a passi di 5); pesce/insetto = prezzo × per + piu in [min, max]. Con probabilità `mobile` un mobile
     *  a caso (prezzo fino a `mobileMax`) invece delle monete. */
    premio: { parla: [number, number]; porta: { per: number; piu: number; min: number; max: number }; mobile: number; mobileMax: { parla: number; porta: number } };
  };
  messaggi: MessaggioTipo[];
  /** Articolo indeterminativo di ogni pesce e insetto («un», «uno», «una», «un'»). */
  articoli: Record<string, string>;
  paesani: Record<string, PaesanoDef>;
};

export const PAESANI_CFG = dati as unknown as PaesaniCfg;
export const PAESANI: Readonly<Record<string, PaesanoDef>> = PAESANI_CFG.paesani;

const MOMENTI = ['mattina', 'tarda', 'pranzo', 'pomeriggio', 'tramonto', 'notte'] as const;
const SOLO = new Set<string>([...MOMENTI, 'giorno', 'pioggia', 'vento']);
const STAGIONI = ['primavera', 'estate', 'autunno', 'inverno'] as const;
const SEGNAPOSTO = /\{(\w+)\}/g;

/** [] se tutto è a posto, altrimenti gli errori in italiano. */
export function validatePaesani(): string[] {
  const errs: string[] = [], c = PAESANI_CFG;
  const ids = (gente as unknown as { gente: { id: string; ruolo: string }[] }).gente.filter((p) => p.ruolo === 'paesano').map((p) => p.id);
  for (const id of ids) if (!PAESANI[id]) errs.push(`paesani: ${id} è un paesano di gente.json senza battute`);
  for (const id of Object.keys(PAESANI)) if (!ids.includes(id)) errs.push(`paesani: ${id} non è un paesano di gente.json`);
  // le ore dei momenti coprono il giorno una volta sola
  const ore = new Array<number>(48).fill(0);
  for (const m of MOMENTI) {
    const [a, b] = c.momenti[m] ?? [0, 0];
    for (let h = 0; h < 48; h++) { const x = h / 2; if (a < b ? x >= a && x < b : x >= a || x < b) ore[h]!++; }
  }
  if (ore.some((n) => n !== 1)) errs.push('paesani: i momenti devono coprire le 24 ore una volta sola');
  const f = c.favori;
  if (!(f.slotMin > 0 && f.probabilita > 0 && f.probabilita <= 1 && f.alGiorno >= 1 && f.porta >= 0 && f.porta <= 1)) errs.push('paesani: favori non validi');
  if (!(f.durataMin[0] >= f.passoMin && f.durataMin[1] >= f.durataMin[0] && f.passoMin > 0 && f.controlloMin > 0 && f.parlaMin > 0)) errs.push('paesani: durate dei favori non valide');
  if (!(f.premio.parla[0] > 0 && f.premio.parla[1] >= f.premio.parla[0] && f.premio.porta.max >= f.premio.porta.min && f.premio.mobile >= 0 && f.premio.mobile <= 1)) errs.push('paesani: premi non validi');
  const cat = [...(pesci as unknown as { pesci: { id: string }[] }).pesci, ...(insetti as unknown as { insetti: { id: string }[] }).insetti];
  for (const x of cat) if (!["un", "uno", "una", "un'"].includes(c.articoli[x.id] ?? '')) errs.push(`paesani: manca l'articolo di ${x.id}`);
  const economici = (mobili as unknown as { mobili: { monete: number }[] }).mobili.filter((m) => m.monete <= Math.min(f.premio.mobileMax.parla, f.premio.mobileMax.porta));
  if (!economici.length) errs.push('paesani: nessun mobile abbastanza economico per i premi');

  const testo = (b: Battuta) => (typeof b === 'string' ? b : b.t);
  const lista = (id: string, dove: string, l: readonly Battuta[] | undefined, minimo = 1) => {
    if (!l || l.length < minimo) { errs.push(`paesani ${id}: ${dove} vuoto`); return; }
    for (const b of l) {
      if (!testo(b) || testo(b).length < 8) errs.push(`paesani ${id}: ${dove} ha una battuta vuota`);
      if (typeof b !== 'string' && (b.solo ?? []).some((s) => !SOLO.has(s))) errs.push(`paesani ${id}: ${dove} ha una condizione sconosciuta`);
      if (/[{}]/.test(testo(b))) errs.push(`paesani ${id}: ${dove} ha un segnaposto in una chiacchiera`);
    }
  };
  const frasi = (id: string, dove: string, l: readonly string[] | undefined, ammessi: readonly string[], servono: readonly string[] = []) => {
    if (!l?.length) { errs.push(`paesani ${id}: favori.${dove} vuoto`); return; }
    for (const t of l) {
      for (const m of t.matchAll(SEGNAPOSTO)) if (!ammessi.includes(m[1]!)) errs.push(`paesani ${id}: favori.${dove} ha {${m[1]}}`);
      for (const s of servono) if (!t.includes(`{${s}}`)) errs.push(`paesani ${id}: favori.${dove} senza {${s}}`);
    }
  };
  for (const [id, p] of Object.entries(PAESANI)) {
    if (!p.chiamato || !p.dove) errs.push(`paesani ${id}: manca come si chiama o dove sta`);
    lista(id, 'base', p.base, 3); lista(id, 'brutto', p.brutto); lista(id, 'primo', p.primo); lista(id, 'insistente', p.insistente);
    lista(id, 'lore', p.lore); lista(id, 'loreAperto', p.loreAperto);
    for (const m of ['mattina', 'pranzo', 'pomeriggio', 'tramonto', 'notte'] as const) lista(id, m, p.momenti[m]);
    for (const s of STAGIONI) lista(id, s, p.stagioni[s]);
    const v = p.favori;
    if (!v || !(v.preferisce.pesce >= 0 && v.preferisce.pesce <= 1)) { errs.push(`paesani ${id}: favori non validi`); continue; }
    frasi(id, 'pesce', v.pesce, ['cosa', 'tempo'], ['cosa', 'tempo']); frasi(id, 'insetto', v.insetto, ['cosa', 'tempo'], ['cosa', 'tempo']);
    frasi(id, 'si', v.si, []); frasi(id, 'no', v.no, []);
    frasi(id, 'promemoria', v.promemoria, ['cosa', 'nome']); frasi(id, 'dono', v.dono, ['cosa', 'nome'], ['cosa']); frasi(id, 'grazie', v.grazie, ['cosa', 'nome']);
    frasi(id, 'attesa', v.attesa, ['a']); frasi(id, 'scaduto', v.scaduto, []);
    frasi(id, 'monete', v.monete, ['monete'], ['monete']); frasi(id, 'mobile', v.mobile, ['mobile'], ['mobile']);
    for (const t of c.messaggi) {
      const m = v.messaggi[t];
      if (!m) { errs.push(`paesani ${id}: manca il messaggio ${t}`); continue; }
      frasi(id, `messaggi.${t}.chiede`, [m.chiede], ['a'], ['a']); frasi(id, `messaggi.${t}.risponde`, [m.risponde], ['da'], ['da']); frasi(id, `messaggi.${t}.grazie`, [m.grazie], ['a']);
    }
  }
  return errs;
}
