// @marea/content/arena.ts: dati dell'Arena PvP (docs/ARENA.md): le quattro modalità (Sopravvivenza, Caccia alle stelle, Controllo,
// Rapinatori) coi loro numeri, la build (doti, armi e magie coi numeri dell'Arena, uguali per tutti), le ulti, premio col tetto del giorno,
// rete (attesa di chi perde la linea), gladiatori automatici e le mappe (stesso formato dei dungeon, una o più per modalità). Entry separata
// da index.ts: la carica solo il chunk dell'Arena e il server. Formule in @marea/sim/arena.
import cfg from './arena/arena.json' with { type: 'json' };
import type { DungeonDef } from './rpg_types.ts';

export type ArenaModo = 'sopravvivenza' | 'stelle' | 'controllo' | 'rapina';
/** Una modalità: id, nome, descrizione; `eroi` in partita (senza: due squadre da `per`), le grandezze di squadra possibili, i secondi di
 *  gioco, se chi cade rinasce. I numeri suoi: la nube, le casse e le monete rosse (Sopravvivenza), le stelle, la zona, la cassaforte. */
export type ArenaModoCfg = {
  id: ArenaModo; nome: string; descr: string; eroi?: number; per: number[]; secondi: number; rinasce?: true;
  /** Nube tossica: comincia a stringersi a `inizio` s, arriva al cerchio di `raggio` m a `fine` s; fuori fa `dps` danni al secondo. */
  nube?: { inizio: number; fine: number; raggio: number; dps: number };
  /** Le casse da rompere: vita, monete rosse dentro, raggio del corpo (m). */
  cassa?: { vita: number; monete: number; raggio: number };
  /** Una moneta rossa: +`vita` della Vita di base e +`danno` ai danni (frazioni) per tutta la partita; si raccoglie entro `raggio` m. */
  rossa?: { vita: number; danno: number; raggio: number };
  /** Caccia alle stelle: la taglia di partenza e quella massima. */
  stelle?: { inizio: number; max: number };
  /** Controllo: raggio della zona (m) e punti di conquista al secondo. */
  zona?: { raggio: number; alSecondo: number };
  /** Rapinatori: vita e raggio del corpo (m) della cassaforte. */
  cassaforte?: { vita: number; raggio: number };
};

/** Una mappa dell'Arena: un DungeonDef più le modalità che la usano e le partenze [cx, cz, fx, fz] di ogni squadra (la k-esima della squadra
 *  parte dalla k-esima); se le squadre sono più dei gruppi, si contano in fila. Segni nelle righe (pavimento, con legenda vuota): `K` una
 *  cassa, `A` e `B` le casseforti delle squadre 0 e 1, `1` `2` `3` i centri delle zone. */
export type ArenaMappa = DungeonDef & { modi: ArenaModo[]; spawn: [number, number, number, number][][] };
export type ArenaGladiatore = { nome: string; look: { pelle: number; capelli: number; coloreCapelli: number; vestito: number; cappello: number } };
/** Una dote della build: moltiplica Vita, Stamina o Magicka (massimo e ricarica) e, se c'è, il passo; `colore` = chiave di PAL del bagliore attorno all'eroe. */
export type ArenaDote = { id: string; nome: string; descr: string; colore: string; vita?: number; stamina?: number; magicka?: number; passo?: number };
/** Numeri dell'Arena di un'arma (danno a colpo, colpi al secondo, secondi di carica, moltiplicatore del caricato, portata in m) o dell'arco
 *  (danno della freccia a piena tensione, secondi per tenderlo). */
export type ArenaArma = { danno: number; colpi?: number; carica?: number; caricaMolt?: number; portata?: number; tensione?: number };
/** Numeri dell'Arena di una magia (gli altri restano quelli del libro): danno (al secondo per i raggi), cura, costo, ricarica; raggio (del
 *  proiettile o dello scoppio), gittata e larghezza (dei raggi); `senzaRallenta`: in Arena la magia non rallenta nessuno. */
export type ArenaMagia = { danno?: number; cura?: number; costo?: number; ricarica?: number; raggio?: number; gittata?: number; larghezza?: number; senzaRallenta?: boolean };
/** Un'ulti: id, nome, descrizione e i suoi numeri (secondi, danno, raggio…: li legge sim/arena/ulti.ts). */
export type ArenaUlti = { id: string; nome: string; descr: string; secondi?: number; danno?: number; passo?: number; cura?: number; raggio?: number;
  carica?: number; gittata?: number; larghezza?: number; giro?: number; velocita?: number; tiro?: number; stordito?: number };
export type ArenaBuildCfg = {
  /** Build che si possono salvare; Vita, Magicka e Stamina di tutti e la loro ricarica al secondo. */
  salvate: number; attributi: { vita: number; magicka: number; stamina: number }; regen: { vita: number; magicka: number; stamina: number };
  /** Secondi senza attaccare e punti Vita recuperati al secondo. */
  recuperoVita: { attesa: number; alSecondo: number };
  /** Frazione della correzione angolare applicata per tick alla mira delle bombe. */
  sensibilitaBomba: number;
  doti: ArenaDote[];
  /** Il passo con l'arma in mano: × (1 + (neutro − peso) × perKg); le magie pesano `neutro`. */
  passo: { neutro: number; perKg: number };
  /** Il Vigore che costa una schivata in Arena (più di quella dei dungeon, RPG.schivata.stamina). I colpi non costano Vigore. */
  staminaSchivata: number;
  /** Le armi della build (id del catalogo, tutte dello stesso materiale) e le magie (id di spells.json: niente evocazioni). */
  armi: Record<string, ArenaArma>; magie: Record<string, ArenaMagia>;
};
export type ArenaCfg = {
  /** Le modalità: `conta` s di conto alla rovescia, `rinascita` s a terra prima di rinascere (dove si rinasce), `protetto` s intoccabili
   *  appena rinati, `pariSotto` differenza sotto cui a tempo scaduto è pari; poi l'elenco. */
  modi: { conta: number; rinascita: number; protetto: number; pariSotto: number; lista: ArenaModoCfg[] };
  /** Slot della build (armi o magie), frecce per l'arco (fuori dagli slot) e il loro tipo. */
  slot: number; frecce: number; frecceBase: string;
  build: ArenaBuildCfg;
  /** Le ulti: la carica (piena a `max`: tanti punti al secondo di gioco e per punto di danno dato e preso) e l'elenco. */
  ulti: { carica: { max: number; alSecondo: number; dato: number; preso: number }; lista: ArenaUlti[] };
  /** Monete del personaggio a fine partita (vinta, persa) e tetto del giorno UTC. Pareggio, resa e partita lasciata: niente. */
  premio: { vinta: number; persa: number; tetto: number };
  /** Rete: secondi che la partita aspetta chi ha perso la linea (poi è dato per arreso), secondi di attesa del caricamento, lettere del codice
   *  della sala, secondi che la coda aspetta altri giocatori prima di riempire i posti vuoti coi gladiatori automatici. */
  rete: { staccatoSecondi: number; caricoSecondi: number; codice: number; attesaBotSecondi: number };
  /** I gladiatori automatici che riempiono i posti vuoti (nome e look), in ordine. */
  gladiatori: ArenaGladiatore[];
  isola: { island: string; ingresso: [number, number] };
  mappe: ArenaMappa[];
};

export const ARENA = cfg as unknown as ArenaCfg;
/** Eroi in una partita al massimo (la Sopravvivenza a 10). */
export const ARENA_EROI_MAX = 10;
/** I segni delle mappe: cassa, casseforti (squadra 0 e 1), centri delle zone. */
export const SEGNO = { cassa: 'K', casseforti: ['A', 'B'], zone: ['1', '2', '3'] } as const;

/** L'ulti col suo id (la prima se non c'è). */
export function arenaUlti(id: string): ArenaUlti { return ARENA.ulti.lista.find((u) => u.id === id) ?? ARENA.ulti.lista[0]!; }
/** La modalità col suo id (la prima se non c'è). */
export function arenaModo(id: string): ArenaModoCfg { return ARENA.modi.lista.find((m) => m.id === id) ?? ARENA.modi.lista[0]!; }
export function arenaMappa(id: string): ArenaMappa { return ARENA.mappe.find((m) => m.id === id) ?? ARENA.mappe[0]!; }
/** Eroi in una partita della modalità con squadre da `per`. */
export const eroiDi = (modo: ArenaModoCfg, per: number): number => modo.eroi ?? 2 * per;
/** La mappa di una partita della modalità: una di quelle che la prevedono, scelta dal seed. */
export function mappaPer(modo: ArenaModo, seed: number): ArenaMappa {
  const ok = ARENA.mappe.filter((m) => m.modi.includes(modo));
  return ok[(seed >>> 0) % Math.max(1, ok.length)] ?? ARENA.mappe[0]!;
}

const SPECCHIO: Record<string, string> = { A: 'B', B: 'A', '1': '2', '2': '1' };
const SEGNI = new Set<string>([SEGNO.cassa, ...SEGNO.casseforti, ...SEGNO.zone]);

/** Controlli dei dati (in italiano): modalità, numeri sensati; mappe chiuse, con una scala, con abbastanza partenze sul pavimento e tutto il
 *  pavimento collegato; quelle a due squadre simmetriche (ruotate di mezzo giro, le casseforti e le zone si scambiano). */
export function validateArena(): string[] {
  const errs: string[] = [], c = ARENA, M = c.modi;
  const pos = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v > 0;
  if (![M.conta, M.rinascita, M.protetto, M.pariSotto].every(pos)) errs.push('arena: tempi delle modalità non validi');
  for (const m of M.lista) {
    if (!pos(m.secondi) || !m.per.length || m.per.some((p) => !Number.isInteger(p) || p < 1 || eroiDi(m, p) % p !== 0 || eroiDi(m, p) > ARENA_EROI_MAX || eroiDi(m, p) / p < 2)) errs.push(`arena: modalità ${m.id} non valida`);
    if (!c.mappe.some((x) => x.modi.includes(m.id))) errs.push(`arena: nessuna mappa per ${m.id}`);
  }
  const S = arenaModo('sopravvivenza');
  if (!S.nube || !S.cassa || !S.rossa || S.nube.fine <= S.nube.inizio || !pos(S.cassa.vita)) errs.push('arena: numeri della Sopravvivenza mancanti');
  if (!arenaModo('stelle').stelle || !arenaModo('controllo').zona || !arenaModo('rapina').cassaforte) errs.push('arena: numeri delle modalità mancanti');
  if (!pos(c.slot) || c.slot > 9 || !pos(c.frecce)) errs.push('arena: slot o frecce non validi');
  const b = c.build;
  if (!pos(b.recuperoVita.attesa) || !pos(b.recuperoVita.alSecondo)) errs.push('arena: recupero Vita non valido');
  if (!pos(b.sensibilitaBomba) || b.sensibilitaBomba > 1) errs.push('arena: sensibilità delle bombe non valida');
  if (!pos(b.salvate) || !b.doti.length || !Object.keys(b.armi).length || !Object.keys(b.magie).length) errs.push('arena: build non valida');
  for (const a of Object.values(b.armi)) if (!pos(a.danno) || !(pos(a.colpi) || pos(a.tensione))) errs.push('arena: arma senza danno o velocità');
  if (!c.ulti.lista.length || !pos(c.ulti.carica.max) || new Set(c.ulti.lista.map((u) => u.id)).size !== c.ulti.lista.length) errs.push('arena: ulti non valide');
  if (!(c.premio.vinta >= 0 && c.premio.persa >= 0 && c.premio.tetto >= c.premio.vinta)) errs.push('arena: premio non valido');
  if (!pos(c.rete.attesaBotSecondi)) errs.push('arena: attesa dei gladiatori non valida');
  if (c.gladiatori.length < ARENA_EROI_MAX - 1) errs.push(`arena: servono almeno ${ARENA_EROI_MAX - 1} gladiatori automatici`);
  for (const m of c.mappe) errs.push(...validaMappa(m));
  return errs;
}
function validaMappa(m: ArenaMappa): string[] {
  const errs: string[] = [], rows = m.rows, H = rows.length, W = rows[0]?.length ?? 0, qui = `arena ${m.id}`;
  if (!H || rows.some((x) => x.length !== W)) return [`${qui}: righe della mappa di lunghezze diverse`];
  if (!m.modi.length || m.modi.some((x) => !ARENA.modi.lista.some((y) => y.id === x))) errs.push(`${qui}: modalità non valide`);
  const due = m.modi.every((x) => !arenaModo(x).eroi);
  if (rows.join('').split('<').length !== 2) errs.push(`${qui}: serve una sola scala '<'`);
  for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) {
    const a = rows[z]![x]!, b = rows[H - 1 - z]![W - 1 - x]!;
    if ((z === 0 || x === 0 || z === H - 1 || x === W - 1) && a !== '#') errs.push(`${qui}: bordo aperto in ${x},${z}`);
    if (due && (SPECCHIO[a] ?? a) !== b && a !== '<' && b !== '<') errs.push(`${qui}: mappa non simmetrica in ${x},${z}`);
    if (a !== '#' && a !== '.' && a !== '<' && !m.legenda[a]) errs.push(`${qui}: lettera '${a}' senza legenda in ${x},${z}`);
    if (SEGNI.has(a) && Object.keys(m.legenda[a] ?? {}).length) errs.push(`${qui}: il segno '${a}' è pavimento (legenda vuota)`);
  }
  const conta = (ch: string) => rows.join('').split(ch).length - 1;
  if (m.modi.includes('rapina') && SEGNO.casseforti.some((ch) => conta(ch) !== 1)) errs.push(`${qui}: serve una cassaforte per squadra`);
  if (m.modi.includes('controllo') && conta(SEGNO.zone[0]) !== 1) errs.push(`${qui}: serve almeno la zona 1`);
  if (m.modi.includes('sopravvivenza') && !conta(SEGNO.cassa)) errs.push(`${qui}: servono le casse`);
  const serve = Math.max(...m.modi.flatMap((x) => { const mo = arenaModo(x); return mo.per.map((p) => eroiDi(mo, p)); }));
  if (m.spawn.flat().length < serve || (due && m.spawn.length !== 2)) errs.push(`${qui}: servono ${serve} partenze`);
  for (const lista of m.spawn) for (const [x, z] of lista) if (rows[z]?.[x] !== '.' && rows[z]?.[x] !== 'E') errs.push(`${qui}: partenza ${x},${z} non sul pavimento`);
  // tutto il pavimento si raggiunge dalle partenze (muri, colonne e muretti fermano i passi)
  const libero = (x: number, z: number) => { const ch = rows[z]?.[x]; return ch !== undefined && ch !== '#' && !m.legenda[ch]?.colonna && !m.legenda[ch]?.grata; };
  const p0 = m.spawn[0]?.[0];
  if (p0) {
    const visti = new Set<number>([p0[1] * W + p0[0]]), coda = [p0[1] * W + p0[0]];
    while (coda.length) {
      const i = coda.pop()!, x = i % W, z = (i - x) / W;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) { const nx = x + dx, nz = z + dz, j = nz * W + nx; if (libero(nx, nz) && !visti.has(j)) { visti.add(j); coda.push(j); } }
    }
    for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) if (libero(x, z) && !visti.has(z * W + x)) errs.push(`${qui}: ${x},${z} non si raggiunge`);
  }
  return errs;
}
