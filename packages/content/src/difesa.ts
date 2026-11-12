// @marea/content/difesa.ts: numeri della Difesa a corsie alla Plants vs Zombies (difesa.html, #358; docs/DIFESA.md). Entry
// separata come sparo.ts: la caricano solo il chunk della Difesa (apps/client/src/difesa/**), la sim (packages/sim/src/difesa/), i test e
// tools/difesa_bilancio.mjs. Unità: caselle (larghe 1) e corsie, secondi; i passi in caselle al secondo.
// Due profili: `pvz` = i numeri dell'originale ricavati dal codice (DIFESA.md §2), `marea` = solo quello che cambiamo noi (si fonde su pvz).
import dati from './difesa.json' with { type: 'json' };

export type DTipoUnita = 'sparatore' | 'produttore' | 'bomba' | 'muro' | 'mina' | 'gelo' | 'mangiatutto' | 'ripetitore' | 'muroAlto' | 'potenziatore' | 'mortaio';
export type DTipoNemico = 'base' | 'bandiera' | 'cono' | 'saltatore' | 'secchio' | 'scudo' | 'volante' | 'gigante';
export type DProfiloId = 'pvz' | 'marea';
export const TIPI_UNITA: DTipoUnita[] = ['sparatore', 'produttore', 'bomba', 'muro', 'mina', 'gelo', 'mangiatutto', 'ripetitore', 'muroAlto', 'potenziatore', 'mortaio'];
export const TIPI_NEMICO: DTipoNemico[] = ['base', 'bandiera', 'cono', 'saltatore', 'secchio', 'scudo', 'volante', 'gigante'];

/** Un difensore. `tipo` dice cosa fa: `tiro` spara nella sua corsia (`danno` ogni `cadenza` s meno fino a `cadenzaCaso` s a caso,
 *  colpo a `colpoVel` caselle/s; `gelo` = rallenta; `colpi` colpi alla volta, a `stacco` caselle uno dall'altro), `produce` fa cadere
 *  `valore` dopo `primo` s e poi ogni `ogni` s (intervalli a caso), `bomba` esplode dopo `miccia` s (`danno` a ±`corsie` corsie e
 *  ±`caselle` caselle dal centro), `mina` si arma in `arma` s e scoppia a chi la tocca (entro `caselle` dal suo bordo destro), `muro` ha
 *  solo tanta vita (`alto`: il saltatore non lo scavalca), `mangia` inghiotte intero un nemico di terra davanti a sé (a `portata`
 *  caselle oltre la sua) e lo digerisce per `digestione` s, `potenzia` moltiplica per `molt` il danno dei colpi che gli passano sopra
 *  (e `scioglie` il gelo), `lancia` tira ogni `cadenza` s un colpo in arco sul nemico di terra più avanzato di QUALSIASI corsia che sta
 *  oltre `minimo` caselle: ci mette `voloBase` + `voloCasella` × distanza s, fa `danno` entro `centro` caselle dal punto d'arrivo e
 *  `danno × splash` fino a `raggio`. `costo` in valuta, `ricarica` s prima di poterla rimettere. */
export type DUnitaDef = {
  costo: number; ricarica: number; vita?: number;
  /** Secondi di ricarica già da fare a inizio livello (in PvZ le carte lente partono scariche). */
  ricaricaInizio?: number;
  tipo: 'tiro' | 'produce' | 'bomba' | 'muro' | 'mina' | 'mangia' | 'potenzia' | 'lancia';
  danno?: number; cadenza?: number; cadenzaCaso?: number; colpoVel?: number; gelo?: boolean; colpi?: number; stacco?: number;
  primo?: number[]; ogni?: number[]; valore?: number;
  miccia?: number; corsie?: number; caselle?: number; arma?: number;
  alto?: boolean; portata?: number; digestione?: number; molt?: number; scioglie?: boolean;
  minimo?: number; voloBase?: number; voloCasella?: number; centro?: number; splash?: number; raggio?: number;
};
/** Un nemico: `vita` del corpo, `armatura` presa prima del corpo (cono, secchio), `passo` caselle/s (a caso tra i due), `corsa` per chi
 *  corre prima del salto e `salto` s in volo; `punti` = costo nel budget dell'ondata, `peso` = probabilità relativa, `dallOndata` = prima
 *  ondata (da 1) in cui può uscire. Poi i tratti: `furia` = quando l'armatura cade resta fermo `pausa` s e poi va `molt` volte più
 *  veloce, `vola` = non si ferma a mordere e le mine e la mangiatutto non lo toccano, `morso` = danno al secondo suo (invece di quello
 *  comune), `grande` = la mangiatutto non lo inghiotte, `cadeTesta: false` = niente testa che cade (muore solo a vita zero). */
export type DNemicoDef = {
  vita: number; armatura: number; passo: number[]; corsa?: number[]; salto?: number;
  punti: number; peso: number; dallOndata: number;
  furia?: { molt: number; pausa: number }; vola?: boolean; morso?: number; grande?: boolean; cadeTesta?: boolean;
};
export type DProfilo = {
  economia: {
    iniziale: number; inizialeTutorial: number;
    /** Valuta dal cielo: la prima dopo `primo` s; poi ogni min(`max`, `base` + `passo` × già cadute) + fino a `caso` s; cade a `cade`
     *  corsie al secondo. */
    cielo: { primo: number[]; base: number; passo: number; max: number; caso: number; valore: number; cade: number };
    /** Secondi a terra prima di sparire. */
    aTerra: number;
  };
  unita: Record<DTipoUnita, DUnitaDef>;
  nemici: Record<DTipoNemico, DNemicoDef>;
  /** Danno al secondo di un nemico che mangia. */
  morso: number;
  /** Sotto `soglia` della vita del corpo cade la testa: non morde più e muore dopo `dopo` s. */
  testa: { soglia: number; dopo: number };
  /** Il colpo gelato rallenta per `durata` s: passo e morsi moltiplicati. */
  gelo: { durata: number; passo: number; morso: number };
  ondate: {
    prima: number; tra: number[];
    /** L'ondata dopo arriva in `conto` s quando quella in corso è sotto `soglia` (a caso) della vita con cui è entrata, dopo `dopo` s. */
    anticipo: { dopo: number; soglia: number[]; conto: number };
    /** Ogni `ogni` ondate una bandiera: budget × `molt`, più min(budget, `baseMax`) nemici base e quello con la bandiera; `avviso` s. */
    bandiera: { ogni: number; molt: number; baseMax: number; avviso: number };
    /** Punti dell'ondata n (da 0): n ÷ `diviso` + `piu` (per difetto). */
    budget: { diviso: number; piu: number };
    /** Sopravvivenza: (n × `molt`) ÷ `diviso` + `piu`. */
    sopravvivenza: { molt: number; diviso: number; piu: number };
  };
  /** Peso della corsia salvata dal tosaerba nell'ondata dopo e in quella dopo ancora. */
  pieta: number[];
  tosaerba: { vel: number };
};
/** Un livello: `nuova` = il difensore nuovo (null se non ce n'è), `intro` = il nemico nuovo (esce a metà livello e nell'ultima ondata),
 *  `pesi` = moltiplicatori del peso di certi nemici in questo livello (es. più saltatori per far capire il muro alto). */
export type DLivelloDef = {
  id: number; nome: string; corsie: number[]; carte: DTipoUnita[]; nuova: DTipoUnita | null; ondate: number;
  nemici: DTipoNemico[]; intro: DTipoNemico | null; tutorial: boolean; primaOndata: number; pesi?: Partial<Record<DTipoNemico, number>>;
};
export type DSopravvivenzaDef = { nome: string; corsie: number[]; carte: DTipoUnita[]; nemici: DTipoNemico[]; primaOndata: number; iniziale: number };
export type DifesaCfg = {
  /** Il campo: `colonne` caselle da 0 (a sinistra, vicino alla base) a destra; i nemici entrano a `ingresso` + fino a `ingressoCaso`
   *  (`bandieraIndietro` in più nelle ondate bandiera), si possono colpire da `visibile` in giù; il tosaerba parte a `tosaerba`, la base è
   *  persa quando un nemico arriva a `casa`. */
  campo: { corsie: number; colonne: number; ingresso: number; ingressoCaso: number; bandieraIndietro: number; visibile: number; tosaerba: number; casa: number };
  /** Le carte che si portano in partita: al massimo `max` (con più carte sbloccate si sceglie prima del livello); `priorita` = l'ordine
   *  con cui si riempie la scelta quando nessuno ha scelto (pilota automatico, prove). */
  carte: { max: number; priorita: DTipoUnita[] };
  profili: { pvz: DProfilo; marea: DeepPartial<DProfilo> };
  livelli: DLivelloDef[];
  sopravvivenza: DSopravvivenzaDef;
};
type DeepPartial<T> = { [K in keyof T]?: T[K] extends number[] ? number[] : T[K] extends object ? DeepPartial<T[K]> : T[K] };

export const DIFESA = dati as unknown as DifesaCfg;

/** Fonde `sopra` su `base` (oggetti in profondità; numeri, liste e testi si sostituiscono). */
function fondi<T>(base: T, sopra: unknown): T {
  if (sopra === undefined || sopra === null || typeof sopra !== 'object' || Array.isArray(sopra)) return (sopra ?? base) as T;
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [k, v] of Object.entries(sopra as Record<string, unknown>)) out[k] = fondi(out[k], v);
  return out as T;
}
const CACHE: Partial<Record<DProfiloId, DProfilo>> = {};
/** Il profilo coi numeri completi: `pvz` com'è, `marea` = pvz + le nostre modifiche. */
export function profiloDifesa(id: DProfiloId): DProfilo {
  return (CACHE[id] ??= id === 'pvz' ? DIFESA.profili.pvz : fondi(DIFESA.profili.pvz, DIFESA.profili.marea));
}
