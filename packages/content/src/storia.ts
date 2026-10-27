// @marea/content/storia.ts: la storia delle prime ore (GDD §9): passi del tutorial guidato, prezzo della barca, ordine delle isole della
// missione «Scopri le isole», premio dei dungeon e i dialoghi. Entry separata da index.ts (come botteghe.ts): la usano il chunk della storia,
// la sim e il server. Solo dati: le regole stanno in @marea/sim/economy/storia.ts. La validazione la chiama il test della sim.
import storia from './storia.json' with { type: 'json' };
import archipelago from './archipelago.json' with { type: 'json' };
import diario from './diario.json' with { type: 'json' };
import gente from './gente.json' with { type: 'json' };
import mobili from './mobili.json' with { type: 'json' };

/** Chi segna il passo: `client` (parlare con qualcuno, entrare in casa: il server non lo vede) o il server guardando il lotto. */
export type StoriaPassoTipo = 'client' | 'arreda' | 'attrezzo' | 'cattura' | 'guadagna';
/** Un passo del tutorial: `chi` = dove punta la freccia (un id di gente.json, o `fulvio` / `bepi`). */
export type StoriaPasso = { id: string; tipo: StoriaPassoTipo; chi?: string; titolo: string; come: string };
/** Cosa conta come «provato» il gioco di un'isola: una partita in più da quando la missione è partita. */
export type StoriaGioco = { tipo: 'minigioco'; id: string } | { tipo: 'templari' } | { tipo: 'arena' } | { tipo: 'difesa' };
export type StoriaIsola = { isola: string; gioco: StoriaGioco; premio: number; /** Il gioco in parole («la Regata»), nei dialoghi di Remo. */ cosa: string };
/** Una riga della scheda delle missioni. */
export type StoriaRiga = { titolo: string; come: string };
export type StoriaDef = {
  attiva: boolean;
  /** Il mobile che Nonna Pina ti regala (va nel magazzino di casa). */
  regaloPina: string;
  /** `consigli`: come fare le monete, a giro sulla scheda della storia finché la barca non è tua. */
  barca: { prezzo: number; consigli: string[] };
  passi: StoriaPasso[];
  isole: StoriaIsola[];
  dungeon: { premio: number };
  /** La scheda dopo la barca: Remo ti cerca, l'isola da provare, torna da Remo, il dungeon; `fine` = titolo e testo a missioni finite. */
  missioni: { remo: StoriaRiga; isola: StoriaRiga; torna: StoriaRiga; dungeon: StoriaRiga; fine: [string, string] };
  dialoghi: Record<string, string | string[]>;
};

export const STORIA = storia as unknown as StoriaDef;

const CHI_EXTRA = new Set(['fulvio', 'bepi']);
const TIPI = new Set<StoriaPassoTipo>(['client', 'arreda', 'attrezzo', 'cattura', 'guadagna']);

/** [] se tutto ok, altrimenti errori in italiano. */
export function validateStoria(): string[] {
  const errs: string[] = [];
  const isole = new Set((archipelago as { islands: { island: string; role: string }[] }).islands.filter((p) => p.role === 'tema' || p.role === 'laguna').map((p) => p.island));
  const minigiochi = new Set((diario as { minigiochi: { id: string }[] }).minigiochi.map((m) => m.id));
  const chi = new Set([...(gente as { gente: { id: string }[] }).gente.map((g) => g.id), ...CHI_EXTRA]);
  if (!(mobili as { mobili: { id: string }[] }).mobili.some((m) => m.id === STORIA.regaloPina)) errs.push(`storia: il regalo di Pina «${STORIA.regaloPina}» non è un mobile`);
  if (!(STORIA.barca.prezzo > 0)) errs.push('storia: la barca deve costare qualcosa');
  if (!STORIA.barca.consigli.length || STORIA.barca.consigli.some((c) => !c || c.length > 120)) errs.push('storia: i consigli per la barca mancano o sono più lunghi di 120 caratteri');
  const ids = STORIA.passi.map((p) => p.id);
  if (new Set(ids).size !== ids.length) errs.push('storia: due passi con lo stesso id');
  if (ids[0] !== 'naufragio') errs.push('storia: il primo passo è il naufragio');
  for (const p of STORIA.passi) {
    if (!TIPI.has(p.tipo)) errs.push(`storia ${p.id}: tipo «${p.tipo}» sconosciuto`);
    if (p.chi && !chi.has(p.chi)) errs.push(`storia ${p.id}: «${p.chi}» non è nel Borgo`);
    if (!p.titolo || !p.come) errs.push(`storia ${p.id}: manca il titolo o il come`);
  }
  const viste = new Set<string>();
  for (const i of STORIA.isole) {
    if (!isole.has(i.isola)) errs.push(`storia: «${i.isola}» non è un'isola a tema`);
    if (viste.has(i.isola)) errs.push(`storia: «${i.isola}» due volte`);
    viste.add(i.isola);
    if (i.gioco.tipo === 'minigioco' && !minigiochi.has(i.gioco.id)) errs.push(`storia ${i.isola}: minigioco «${i.gioco.id}» non è nel Diario`);
    if (!(i.premio >= 0) || !i.cosa) errs.push(`storia ${i.isola}: premio o cosa sbagliati`);
  }
  if (!(STORIA.dungeon.premio >= 0)) errs.push('storia: premio dei dungeon sbagliato');
  const m = STORIA.missioni;
  for (const [k, r] of Object.entries({ remo: m.remo, isola: m.isola, torna: m.torna, dungeon: m.dungeon, fine: { titolo: m.fine[0], come: m.fine[1] } })) {
    if (!r.titolo || !r.come || r.come.length > 120) errs.push(`storia: la riga «${k}» delle missioni manca o è più lunga di 120 caratteri`);
  }
  for (const [k, v] of Object.entries(STORIA.dialoghi)) {
    for (const t of Array.isArray(v) ? v : [v]) if (!t || t.length > 200) errs.push(`storia: battuta di «${k}» vuota o più lunga di 200 caratteri`);
  }
  return errs;
}
