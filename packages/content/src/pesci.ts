// @marea/content/pesci.ts: i pesci (#457), dal Database_Pesci_GameDesign.xlsx di Riccardo. Solo dati: chi esce quando e dove sta in
// @marea/sim/economy/pesci.ts, come si pesca in apps/client/src/game/pesca.ts. Entry separata da index.ts (come insetti.ts): il catalogo
// non pesa sul JS iniziale. La validazione la chiama il test della sim (pesci.test.ts). Stagioni e giorno/notte sono quelli degli insetti.
import dati from './pesci.json' with { type: 'json' };
import islands from './islands.json' with { type: 'json' };
import type { InsettoFascia, InsettoRarita, InsettoStagione } from './insetti.ts';

export type PesceStagione = InsettoStagione;
export type PesceFascia = InsettoFascia;
export type PesceRarita = InsettoRarita;
/** Dove si pesca: dalle rive di Borgo Marea o dalla barca ferma in mare aperto. */
export type PesceZona = 'riva' | 'barca';
/** Disegno del Diario (ui/pesci_sprite.ts). */
export type PesceForma =
  | 'pesce' | 'alto' | 'tonno' | 'palla' | 'spada' | 'aguglia' | 'lanterna' | 'piatto' | 'anguilla' | 'remo' | 'squalo' | 'luna'
  | 'cavalluccio' | 'seppia' | 'calamaro' | 'polpo' | 'clione' | 'pagliaccio' | 'sanpietro';

export type PesceDef = {
  id: string; nome: string; stagione: PesceStagione; fascia: PesceFascia; zona: PesceZona;
  /** Dimensione dell'ombra in acqua: 1 minuscola … 5 enorme (`taglie`). */
  taglia: 1 | 2 | 3 | 4 | 5;
  rarita: PesceRarita;
  /** Peso nell'estrazione (50 comune, 25 non comune, 8 raro, 2 ultra-raro). */
  peso: number;
  /** Monete che dà il Contrabbandiere (Excel ÷ 10). */
  prezzo: number;
  forma: PesceForma;
  /** Tre colori della palette (ART_BIBLE §2, chiavi di PAL): corpo, pancia, pinne/accento. */
  colori: [string, string, string];
  /** La scheda del Diario: si legge solo dopo averlo consegnato al mobiliere. */
  descr: string;
};
/** Una taglia d'ombra: lunghezza in metri, e quanti tocchi servono per tirarlo su (`strappi`, che calano di `cala` al secondo). */
export type PesceTaglia = { id: string; nome: string; lungo: number; strappi: number; cala: number };
export type PesciCfg = {
  canna: { id: string; nome: string; monete: number };
  /** Ogni `minuti` escono ombre nuove, uguali per tutti: `riva` lungo le rive del Borgo, `barca` attorno a chi pesca dalla barca. */
  turno: { minuti: number; riva: number; barca: number };
  /** Le ombre di riva stanno sull'acqua (anche bassa) del template `porto` tra `celle[0]` e `celle[1]` celle dalla terra. */
  riva: { celle: [number, number] };
  /** Dalla barca: quasi ferma (m/s) e nessuna terra entro `rivaM` metri. */
  barca: { fermoMs: number; rivaM: number };
  /** Il lancio: distanza dell'esca (m) e quanto vola (s). */
  lancio: { min: number; max: number; secondi: number };
  /** L'ombra si accorge dell'esca entro `raggio` m (più largo di Animal Crossing: si avvicina facile) e viene a `velocita` m/s; `vista` = probabilità che la noti. */
  attira: { raggio: number; velocita: number; vista: number };
  /** Le finte prima del morso vero: quante e ogni quanto. */
  finte: { quante: [number, number]; secondi: [number, number] };
  /** Dall'ultima finta al morso (s). */
  morso: { secondi: [number, number] };
  /** Dopo il morso, secondi per riempire la barra coi tocchi. */
  tira: { secondi: number };
  /** Le 5 taglie (indice = taglia − 1). */
  taglie: PesceTaglia[];
  rarita: Record<PesceRarita, string>;
  pesci: PesceDef[];
};

export const PESCI_CFG = dati as unknown as PesciCfg;
export const PESCI: readonly PesceDef[] = PESCI_CFG.pesci;
export const CANNA = PESCI_CFG.canna;
export const tagliaDi = (d: Pick<PesceDef, 'taglia'>): PesceTaglia => PESCI_CFG.taglie[d.taglia - 1] ?? PESCI_CFG.taglie[0]!;

type Isola = { id: string; rows: string[] };
const PORTO = (islands as unknown as Isola[]).find((i) => i.id === 'porto');
/** Le celle d'acqua (profonda `~` o bassa `,`) del template `porto` vicine alla riva (tra `riva.celle[0]` e `riva.celle[1]` celle dalla terra): lì stanno le ombre di riva. */
export const ACQUA_RIVA: readonly [number, number][] = (() => {
  const rows = PORTO?.rows ?? [], out: [number, number][] = [], [a, b] = PESCI_CFG.riva.celle;
  const terra = (x: number, z: number) => { const c = rows[z]?.[x]; return c !== undefined && c !== '~' && c !== ','; }; // ',' è acqua bassa
  for (let z = 0; z < rows.length; z++) for (let x = 0; x < (rows[z]?.length ?? 0); x++) {
    if (terra(x, z)) continue;
    let d = Infinity;
    for (let dz = -b; dz <= b; dz++) for (let dx = -b; dx <= b; dx++) if (terra(x + dx, z + dz)) d = Math.min(d, Math.max(Math.abs(dx), Math.abs(dz)));
    if (d >= a && d <= b) out.push([x, z]);
  }
  return out;
})();

const ZONE = new Set(['riva', 'barca']), FASCE = new Set(['sempre', 'giorno', 'notte']);
const STAGIONI = new Set(['tutto', 'primavera', 'estate', 'autunno', 'inverno']), RARITA = new Set(['comune', 'noncomune', 'raro', 'ultrararo']);
const FORME = new Set(['pesce', 'alto', 'tonno', 'palla', 'spada', 'aguglia', 'lanterna', 'piatto', 'anguilla', 'remo', 'squalo', 'luna', 'cavalluccio', 'seppia', 'calamaro', 'polpo', 'clione', 'pagliaccio', 'sanpietro']);
/** [] se il catalogo è a posto, altrimenti gli errori in italiano. */
export function validatePesci(palette: readonly string[]): string[] {
  const errs: string[] = [], c = PESCI_CFG, visti = new Set<string>();
  if (c.canna.id !== 'canna' || !(Number.isInteger(c.canna.monete) && c.canna.monete > 0)) errs.push('pesci: canna non valida');
  if (!(c.turno.minuti > 0 && Number.isInteger(c.turno.riva) && c.turno.riva > 0 && Number.isInteger(c.turno.barca) && c.turno.barca > 0)) errs.push('pesci: turno non valido');
  if (ACQUA_RIVA.length < 20) errs.push('pesci: troppo poca acqua di riva nel template porto');
  if (!(c.lancio.min > 0 && c.lancio.max > c.lancio.min && c.attira.raggio > 0 && c.attira.vista > 0 && c.attira.vista <= 1 && c.tira.secondi > 0)) errs.push('pesci: lancio, attira o tira non validi');
  if (c.taglie.length !== 5 || c.taglie.some((t, i) => !(t.lungo > 0 && Number.isInteger(t.strappi) && t.strappi > 0 && t.cala >= 0 && (i === 0 || t.lungo > c.taglie[i - 1]!.lungo)))) errs.push('pesci: le taglie devono essere 5 e crescenti');
  for (const z of ['riva', 'barca'] as const) for (const s of ['primavera', 'estate', 'autunno', 'inverno']) for (const notte of [false, true]) {
    if (!c.pesci.some((p) => p.zona === z && (p.stagione === 'tutto' || p.stagione === s) && (p.fascia === 'sempre' || (p.fascia === 'notte') === notte))) errs.push(`pesci: ${z} senza pesci in ${s} ${notte ? 'di notte' : 'di giorno'}`);
  }
  for (const p of c.pesci) {
    if (!/^[a-z_]{2,24}$/.test(p.id) || visti.has(p.id)) errs.push(`pesci: id non valido o doppio ${p.id}`);
    visti.add(p.id);
    if (!ZONE.has(p.zona) || !FASCE.has(p.fascia) || !STAGIONI.has(p.stagione) || !RARITA.has(p.rarita) || !FORME.has(p.forma)) errs.push(`pesci ${p.id}: zona, fascia, stagione, rarità o forma sconosciute`);
    if (!(p.peso > 0 && Number.isInteger(p.prezzo) && p.prezzo > 0 && [1, 2, 3, 4, 5].includes(p.taglia))) errs.push(`pesci ${p.id}: numeri non validi`);
    if (p.colori.length !== 3 || p.colori.some((k) => !palette.includes(k))) errs.push(`pesci ${p.id}: colori fuori palette`);
    if (p.descr.length < 20) errs.push(`pesci ${p.id}: manca la descrizione`);
  }
  return errs;
}
