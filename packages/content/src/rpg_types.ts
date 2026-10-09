// Tipi dei contenuti del Mondo Sotterraneo (docs/RPG.md, CONTRACTS §15). Solo dati: le formule stanno in @marea/sim/rpg e @marea/sim/dungeon.
// I JSON stanno in packages/content/src/rpg/; si importano da `@marea/content/rpg.ts` (MAI da index.ts: il client li carica solo nel chunk GDR).

export type SkillId = 'armiLeggere' | 'armiPesanti' | 'arceria' | 'distruzione' | 'evocazione' | 'forgiatura' | 'alchimia';
export const SKILLS: readonly SkillId[] = ['armiLeggere', 'armiPesanti', 'arceria', 'distruzione', 'evocazione', 'forgiatura', 'alchimia'];
export type AttrId = 'vita' | 'magicka' | 'stamina';
export const ATTRS: readonly AttrId[] = ['vita', 'magicka', 'stamina'];
export type MaterialId = 'legno' | 'bronzo' | 'ferro' | 'argento' | 'oro' | 'vetro' | 'ossa' | 'meteorite';
export type WeaponTypeId = 'nunchaku' | 'katana' | 'ascia' | 'lancia' | 'spadone' | 'martello';
export type WeaponClass = 'leggera' | 'pesante';
/** Famiglia dei nemici: l'argento fa bonus su nonmorto e mostro; le frecce d'argento sono quasi inutili su bestia e umano. */
export type EnemyKind = 'umano' | 'bestia' | 'nonmorto' | 'mostro' | 'costrutto' | 'spettro';

/** Tratti speciali (tabella dei materiali di Riccardo). Tutti facoltativi; la sim del dungeon li legge da RunHero. */
export type Traits = {
  bonusVs?: Partial<Record<EnemyKind, number>>; // moltiplicatore di danno contro una famiglia (argento: nonmorto 2, mostro 2; frecce d'argento: bestia 0.3, umano 0.3)
  dropMolt?: number;           // oro: moltiplica monete e bottino dei nemici uccisi
  moneteColpo?: number;        // probabilità (0..1) di monete extra a ogni colpo a segno (arco d'oro)
  dropRaro?: boolean;          // frecce d'oro: chi uccidi lascia sicuramente il drop raro
  fragile?: number;            // vetro: colpi a segno prima di rompersi (0/assente = mai)
  sanguina?: number;           // danno al secondo per 3 s
  penetra?: number;            // frazione dell'armatura nemica ignorata (meteorite 0.5, schegge 0.25)
  sbilancia?: boolean;         // respinge e interrompe l'attacco nemico (ossa, frecce contundenti)
  trapassa?: boolean;          // frecce eteree: non si fermano al primo nemico
  noGravita?: boolean;         // arco del vuoto: le frecce volano dritte
  moltArgento?: number;        // arco benedetto: moltiplica il bonusVs delle frecce
  staminaTeso?: number;        // arco d'ossa: stamina al secondo mentre è teso
  // Unici del Mausoleo Cinetico (Epopea della Regata 4, docs/RPG.md §2f). Li legge la sim del dungeon.
  /** Anello dell'Onda della Regina (Eco della Marea): ogni colpo in mischia a segno libera un'onda d'acqua di `raggio` m attorno al nemico
   *  colpito che fa `frazione` del danno agli ALTRI nemici nel cerchio; al massimo una ogni `ogni` s. Due anelli non si sommano. */
  eco?: { raggio: number; frazione: number; ogni: number };
  /** Armatura del Moto Perpetuo (Barriera Cinetica): muoversi la carica (piena in `secondi` s camminando, `corsa` volte più in fretta
   *  correndo; da fermo no). Piena, il prossimo colpo subito è annullato e un'onda d'urto respinge di `spinta` m (e interrompe) i nemici
   *  entro `raggio` m. */
  barriera?: { secondi: number; corsa: number; raggio: number; spinta: number };
  /** Fendiflutti (Taglio a pressione): ogni attacco normale scaglia una lama d'acqua dritta (`gittata` m a `velocita` m/s) che trapassa e
   *  fa `frazione` del danno; il caricato ne scaglia `ventaglio` a ventaglio. `cariche` di pressione, una per attacco; a zero niente lame
   *  finché non passi `ricarica` s senza attaccare (allora si ricarica tutta). */
  lame?: { frazione: number; gittata: number; velocita: number; cariche: number; ricarica: number; ventaglio: number };
  /** La Grande Lancetta (Tic-tac): finito un colpo, il tic batte dopo `attesa` s; il colpo normale che parte entro ±`finestra` s dal tic è
   *  a tempo e alza il ritmo (+`passo` di danno per colpo di fila); il colpo numero `colpi` è il Rintocco: stordisce `stordisce` s chi
   *  prende (non i boss) e il ritmo riparte. Fuori tempo, un colpo subito o `reset` s senza attaccare: da zero. */
  ritmo?: { attesa: number; finestra: number; passo: number; colpi: number; stordisce: number; reset: number };
  /** Arco Carillon (Carica a molla): non si tende, ogni tocco tira subito a tensione piena; tiene `colpi` colpi e ne ricarica uno ogni
   *  `ricarica` s (anche mentre tiri); le frecce cadono con la gravità × `gravita`. */
  carillon?: { colpi: number; ricarica: number; gravita: number };
};

export type MaterialDef = {
  id: MaterialId; nome: string;
  /** Colore della palette (ART_BIBLE §2) per lama, icona, tinta del modello. */
  colore: string;
  /** Oggetto che si spende per forgiare (es. 'lingotto_ferro'); il legno si paga col Legno del Magazzino: 'risorsa:legno'. */
  costo: string;
  /** Livello del Banco da Lavoro che lo sblocca. */
  banco: 1 | 2 | 3;
  arma: { danno: number; velocita: number; peso: number; quanti: number; traits?: Traits; descr: string };
  armatura: { difesa: number; peso: number; quanti: number; vsMagia?: number; vsTaglio?: number; vsContundente?: number; moneteSuColpito?: number; terrore?: number; descr: string };
  arco: { danno: number; tensione: number; gittata: number; peso: number; quanti: number; traits?: Traits; descr: string };
  frecce: { danno: number; gittata: number; gravita: number; quanti: number; n: number; traits?: Traits; descr: string };
};
export type WeaponTypeDef = { id: WeaponTypeId; nome: string; classe: WeaponClass; danno: number; velocita: number; portata: number; peso: number; carica: number; caricaMolt: number; model: string; descr: string };

export type ItemKind = 'arma' | 'arco' | 'frecce' | 'armatura' | 'veste' | 'anello' | 'pozione' | 'libro' | 'ingrediente' | 'materiale';
/** Oggetti scritti a mano (anelli, vesti, pozioni, libri, ingredienti, materiali, unici). Armi/armature/archi/frecce dei materiali li genera la sim (tipo × materiale). */
export type ItemDefRaw = {
  id: string; nome: string; kind: ItemKind; peso: number; descr: string;
  /** Per arma/arco/frecce/armatura uniche: base da cui partire + ritocchi. */
  base?: string; danno?: number; velocita?: number; difesa?: number; traits?: Traits;
  /** Anelli e vesti: modificatori piatti. */
  mods?: Partial<Record<ModKey, number>>;
  /** Pozioni. */
  cura?: Partial<Record<AttrId, number>>; buff?: { mod: ModKey; valore: number; secondi: number };
  /** Libri: magia che insegnano. */
  insegna?: string;
  unico?: boolean; colore?: string;
};
/** Chiavi dei modificatori (perk, anelli, vesti, buff). Le legge solo la sim (rpg/derived.ts) quando calcola RunHero. */
export type ModKey =
  | 'vita' | 'magicka' | 'stamina' | 'regenVita' | 'regenMagicka' | 'regenStamina'
  | 'dannoLeggere' | 'dannoPesanti' | 'dannoArco' | 'dannoDistruzione' | 'velocitaLeggere' | 'velocitaPesanti' | 'tensioneArco'
  | 'caricaVeloce' | 'costoDistruzione' | 'costoEvocazione' | 'durataEvocazione' | 'difesa' | 'malusArmatura' | 'peso'
  | 'velocitaCorsa' | 'staminaCorsa' | 'dannoConArmaturaLeggera' | 'materialiForgia' | 'potenzaPozioni' | 'resistMagia';

export type SpellDef = {
  id: string; nome: string; scuola: 'distruzione' | 'evocazione'; costo: number; ricarica: number; descr: string;
  /** Distruzione: proiettile. */
  danno?: number; velocita?: number; raggio?: number; sanguina?: number;
  /** Evocazione: alleato (id di enemies.json) per `durata` s. */
  evoca?: string; durata?: number;
};
export type PerkDef = { id: string; skill: SkillId; nome: string; descr: string; livello: number; richiede?: string; mods: Partial<Record<ModKey, number>> };
export type RecipeDef = { id: string; nome: string; ingredienti: Record<string, number>; risultato: string; n: number; livello: number };

export type EnemyDef = {
  id: string; nome: string; kind: EnemyKind; model: string;
  vita: number; danno: number; armatura: number; resistMagia?: number;
  velocita: number; vista: number; portata: number; preparazione: number; recupero: number; raggio: number;
  /** `torretta` (Drenaggio, Valvola-SparaVapore): non si muove mai (né la spingono), si gira verso l'eroe e tira quando lo vede.
   *  Archivio: `bombardiere` (Aerostato-Spia) sta a qualche metro dall'eroe e sgancia `bomba`; `astrolabio` è il capo con `astrolabio`;
   *  `anello` sono gli anelli-scudo che il capo stacca a metà vita (non hanno IA: girano attorno a lui).
   *  Fucina: `forgiatore` è il capo con `forgiatore`. */
  comportamento: 'mischia' | 'arciere' | 'mago' | 'torretta' | 'bombardiere' | 'astrolabio' | 'anello' | 'forgiatore' | 'chierico' | 'custode';
  /** Dove si muove (Archivio). `grate`: anche sulle grate (Drone Idro-Ragno), dove l'eroe non sale. `vola`: sopra acqua, grate e vuoto,
   *  non sopra muri e scaffali; il vento non lo sposta e in mischia lo prendi solo quando scende (prepara, colpisce, recupera).
   *  `asciutto` (Fucina, il Mastro Forgiatore): camminando gira attorno alle cascate d'acqua (`getto`), non ci entra mai da sé. */
  muove?: 'grate' | 'vola' | 'asciutto';
  /** Il suo proiettile è un arpione: preso, l'eroe è tirato di `tira` m verso chi l'ha lanciato in `secondi` s (Drone Idro-Ragno). */
  arpione?: { tira: number; secondi: number };
  /** Bombardiere: entro `gittata` m sgancia una bomba dove sta l'eroe; cerchio d'avviso per `caduta` s, poi scoppia: `danno` a chi sta
   *  entro `raggio` m e lo spinge via di `spinta` m. Una ogni `ricarica` s (Aerostato-Spia). */
  bomba?: { danno: number; raggio: number; caduta: number; spinta: number; ricarica: number; gittata: number };
  /** Movimento erratico: mentre insegue scarta di lato di `ampiezza` (frazione del passo), cambiando lato ogni `periodo` s. */
  zigzag?: { ampiezza: number; periodo: number };
  /** Ogni `ogni` attacchi si ferma a ricaricare la molla: il recupero dura `secondi` (Archivista a Molla). */
  molla?: { ogni: number; secondi: number };
  /** Il capo dell'Archivio (docs/RPG.md §2d): gira il `ciclo` di attacchi, dopo ognuno si ricalibra fermo e basso per `ricalibra` s.
   *  `rosa`: `salve` raggiere da `n` proiettili, una ogni `ogni` s, ruotate di mezzo spicchio a ogni salva. `raffica`: chi sta entro
   *  `raggio` m vola via di `spinta` m in `secondi` s (`danno`, più `urto` se sbatte contro un muro). `raggio`: linea d'avviso per `avviso`
   *  s, poi il raggio per `durata` s (`danno` a chi sta entro `largo` m dalla linea; gli scaffali lo fermano). Sotto `anelli.soglia` della
   *  vita stacca `anelli.n` anelli-scudo (`anelli.tipo`) che gli girano attorno a `distanza` m (`giro` rad/s): finché ce n'è uno è intoccabile. */
  astrolabio?: {
    ciclo: ('rosa' | 'raffica' | 'raggio')[]; ricalibra: number; distanza: number; pausa: number;
    rosa: { n: number; salve: number; ogni: number; danno: number; velocita: number; gittata: number; prep: number };
    raffica: { raggio: number; spinta: number; secondi: number; danno: number; urto: number; prep: number };
    raggio: { avviso: number; durata: number; danno: number; largo: number; gittata: number };
    anelli: { tipo: string; soglia: number; n: number; distanza: number; giro: number };
  };
  /** `lama` (Mausoleo, Guardia d'Onore): è una lama d'acqua tagliente (né magia né freccia). */
  proiettile?: { danno: number; velocita: number; ricarica: number; gittata: number; lama?: boolean };
  /** Mausoleo, il Chierico a Ingranaggi (`chierico`): tiene `distanza` m dall'eroe; ogni `ogni` s ripara un altro automa ferito (o non
   *  ancora potenziato) entro `raggio` m che vede: `vita` in più e danno × `molt` per `secondi` s (preparazione `prep` s). */
  cura?: { raggio: number; vita: number; ogni: number; molt: number; secondi: number; prep: number; distanza: number };
  /** Mausoleo, la Sentinella dell'Egida: scudo torre a energia cinetica. Da davanti (coseno oltre `cono`) para tutto e, se è un colpo di
   *  lama, respinge l'eroe di `spinta` m; un attacco CARICATO da davanti lo sfonda: la Sentinella barcolla `rotto` s senza scudo. Da
   *  dietro × `retro`. Si gira piano (`gira` rad/s) come il Golem-Palombaro. */
  scudo?: { cono: number; retro: number; gira: number; spinta: number; rotto: number };
  /** Il suo colpo in mischia a segno spinge l'eroe di tanti metri (il colpo di scudo della Sentinella). */
  spinge?: number;
  /** Mausoleo, la Guardia d'Onore: ogni attacco in mischia è una combinazione di `colpi` fendenti, i successivi preparati in `prep` s. */
  combo?: { colpi: number; prep: number };
  /** Il capo del Mausoleo (docs/RPG.md §2f): il Custode dell'Egida, tre cuori e tre fasi. Sotto `soglie` della vita cambia fase (per
   *  `cambio` s è intoccabile: «cambia cuore»). Ogni fase gira il suo ciclo (`cicli`) con `pausa` s dopo ogni attacco; da vicino batte a
   *  terra (`area`). `ondata`: anello d'acqua che si allarga da lui a `velocita` m/s fino a `raggio` m; prende chi ci sta sopra (`danno`,
   *  spinto via di `spinta` m), tranne nei `varchi` (coseno `largo` attorno a direzioni che cambiano) e dietro le colonne. `fendenti`:
   *  `salve` ventagli di `n` lame d'acqua verso l'eroe (`apertura` = scarto di lato tra una lama e l'altra). `scatto` (fase Vapore): la
   *  nebbia segna dove ricompare (`avviso` s), `dietro` m alle spalle dell'eroe; poi ricompare lì e batte subito a terra (`raggio` m,
   *  danno × `danno`). `geyser`: come il Capoturno, uno sotto ogni eroe e `n` attorno a lui. `barriera` (fase Energia Cinetica): ogni
   *  `colpi` colpi presi scarica un'onda d'urto a 360° senza varchi (`raggio`, `danno`, `spinta`, `velocita`). */
  custode?: {
    soglie: number[]; cambio: number; pausa: number[];
    cicli: ('ondata' | 'fendenti' | 'scatto' | 'geyser')[][];
    ondata: { velocita: number; raggio: number; spessore: number; danno: number; spinta: number; varchi: number; largo: number; prep: number };
    fendenti: { n: number; apertura: number; salve: number; ogni: number; danno: number; velocita: number; gittata: number; prep: number };
    scatto: { avviso: number; dietro: number; raggio: number; danno: number };
    geyser: { n: number; distanza: number; raggio: number; danno: number; avviso: number; getto: number; prep: number };
    barriera: { colpi: number; raggio: number; danno: number; spinta: number; velocita: number };
  };
  /** Il suo colpo in mischia rallenta l'eroe: velocità × `molt` per `secondi` (Tubo-strisciante). */
  rallenta?: { molt: number; secondi: number };
  /** Colpo ad area ogni `ogni` attacchi: `raggio` m attorno a sé, danno × `danno`, preparazione × `prep` (sbuffo di vapore
   *  dell'Operaio, martello del Capoturno). Senza, i boss fanno quello di sempre (tuning.ts BOSS_AREA_*). */
  area?: { ogni: number; raggio: number; danno: number; prep: number };
  /** Il colpo ad area fa salire dal pavimento `n` geyser di vapore attorno a sé a `distanza` m, più uno sotto ogni eroe: cerchio
   *  d'avviso per `avviso` s, poi getto per `getto` s che fa `danno` a chi ci sta dentro (`raggio` m). Il Capoturno. */
  geyser?: { n: number; distanza: number; raggio: number; danno: number; avviso: number; getto: number };
  /** Fucina: il suo colpo in mischia dà fuoco all'eroe: brucia `dps` vita al secondo per `secondi` s (Scintilla-Vapore). */
  brucia?: { dps: number; secondi: number };
  /** Fucina: camminando lascia una scia di fuoco a terra, una chiazza ogni `ogni` s (se si è spostato): raggio `raggio` m, dura `durata`
   *  s, chi ci passa brucia (`dps`, `secondi`) (Fornace Semovente). */
  scia?: { ogni: number; durata: number; raggio: number; dps: number; secondi: number };
  /** Fucina: scafandro invulnerabile di fronte (Golem-Palombaro). Un colpo che arriva da davanti (coseno oltre `cono` rispetto a dove
   *  guarda) è parato; da dietro (le valvole sulla schiena) fa × `retro`. Si gira piano: al massimo `gira` rad/s, e avanza solo dritto. */
  scafandro?: { cono: number; retro: number; gira: number };
  /** Fucina: sotto una cascata d'acqua (`getto`) prende `danno` vita al secondo: si spegne (Scintilla-Vapore). */
  acqua?: { danno: number };
  /** Il capo della Fucina (docs/RPG.md §2e): finché la fornace è accesa è intoccabile; si spegne solo in una cascata d'acqua, e lui ci
   *  entra soltanto caricando (cammina attorno all'acqua). Gira il `ciclo`: `carica` (linea d'avviso per `avviso` s, poi corre dritto a
   *  `velocita` m/s fino a `oltre` m dopo l'eroe, al massimo `gittata`: `danno` × il suo a chi travolge, spinto via di `spinta` m) e
   *  `magma` (`n` palle, una ogni `ogni` s, dove sta l'eroe e attorno a `sparpaglia` m: cerchio per `caduta` s, poi `danno` entro
   *  `raggio` m e una pozza che brucia per `fuoco` s). Da vicino pesta gli zoccoli (`area`). Se l'eroe sta sotto una cascata non carica.
   *  Spento resta fermo `spento` s e prende danni (× `vulnerabile`: la fornace è aperta); poi si riaccende (il sanguinamento si
   *  cauterizza). Dopo ogni attacco `pausa` s. */
  forgiatore?: {
    ciclo: ('carica' | 'magma')[]; pausa: number; spento: number; vulnerabile: number;
    carica: { avviso: number; velocita: number; oltre: number; gittata: number; danno: number; spinta: number };
    magma: { n: number; ogni: number; sparpaglia: number; caduta: number; danno: number; raggio: number; fuoco: number; dps: number; secondi: number; gittata: number };
  };
  /** Il colpo è contundente (raddoppia sulle armature di vetro). */
  contundente?: boolean;
  /** Scappa da chi indossa armatura con `terrore` ≥ questo valore (nemici deboli contro le ossa). */
  pauroso?: number;
  loot: string; xp: number; boss?: boolean;
};
export type LootEntry = { item: string; p: number; n: [number, number]; raro?: boolean };
export type LootTable = { id: string; monete: [number, number]; voci: LootEntry[] };

/** Mappa ASCII, una cella = `tile` m: '#' muro, '.' pavimento, '<' scala d'uscita (anche lo spawn, accanto), ' ' vuoto. Ogni altra lettera la spiega `legenda` (sopra c'è pavimento). */
export type DungeonDef = {
  id: string; nome: string; descr: string; stile: 'grotta' | 'cripta' | 'vuoto' | 'drenaggio' | 'archivio' | 'fucina' | 'mausoleo'; tile: number;
  /** Porta sigillata (Epopea della Regata): si entra solo dopo aver completato questo dungeon (`HeroState.completati`). */
  richiede?: string;
  /** Archivio: correnti d'aria. Le celle della corrente n (legenda `vento: n`) spingono chi ci cammina verso `dir` (n = −z, s = +z,
   *  e = +x, o = −x) a `forza` m/s mentre soffia: `soffia` s di raffica e `pausa` s di calma, a giro, sfasati di `fase` s; pausa 0 = sempre.
   *  Al riparo: la cella subito sottovento di uno scaffale (colonna). Il timone n ferma la corrente per sempre (per tutti). */
  venti?: { n: number; dir: 'n' | 's' | 'e' | 'o'; forza: number; soffia: number; pausa: number; fase?: number }[];
  /** Fucina: colate di lava che respirano. Le celle della colata n (legenda `lava: n`) si camminano sempre, ma per `scorre` s la lava
   *  scorre (chi ci sta sopra brucia: `dps` al secondo, ancora per `secondi` s dopo) e per `crosta` s fa la crosta (si passa), a giro,
   *  sfasati di `fase` s; negli ultimi istanti della crosta le crepe si accendono (avviso). */
  lave?: { n: number; scorre: number; crosta: number; fase?: number; dps: number; secondi: number }[];
  /** Mausoleo: lancette giganti che girano a terra attorno al perno nella cella `at` (una colonna): lunghe `lunga` m, `giro` rad/s (il
   *  segno è il verso), angolo di partenza `fase` rad (0 = verso +x, poi verso +z). Chi sta sulla lancetta (entro `largo` m) prende `danno`
   *  e vola avanti di `spinta` m; per `pausa` s quella lancetta non lo riprende. Gli automi conoscono il ritmo: a loro non fa niente. */
  lancette?: { n: number; at: [number, number]; lunga: number; giro: number; fase: number; largo: number; danno: number; spinta: number; pausa: number }[];
  /** Difficoltà, invisibile al giocatore: la bussola punta solo al dungeon più facile non ancora completato (docs/RPG.md §2). */
  difficolta: number;
  rows: string[];
  /** `altare`: altare di salvataggio (docs/RPG.md §4): passandoci il bottino raccolto fin lì è al sicuro; morendo dopo si riparte da lì.
   *  `capo` (con `nemico`): ucciso lui, il dungeon è completato (`HeroState.completati`); uno per dungeon. Non cambia il nemico.
   *  `acqua: n` (Drenaggio): cella allagata del bacino n, non si cammina (ma si vede e si tira sopra) finché la valvola n non la svuota.
   *  `valvola: n`: valvola del bacino n (sul pavimento): A accanto la apre, il bacino si svuota in qualche secondo, per tutti.
   *  `asciutti` (con `altare`): ripartendo da questa lanterna questi bacini sono già vuoti (per arrivarci li avevi svuotati).
   *  Archivio: `vento: n` cella della corrente n (pavimento); `timone: n` timone che ferma la corrente n (sul pavimento, A accanto);
   *  `grata` rastrelliera a grata: non ci si cammina (solo il Drone Idro-Ragno ci sale), ma ci si vede e ci si tira attraverso;
   *  `ferme` (con `altare`): ripartendo da questa lanterna queste correnti sono già ferme (per arrivarci le avevi fermate).
   *  Fucina: `lava: n` cella della colata che respira n (pavimento); `colata: n` la Colata Maestra, un bacino come `acqua: n` (non si passa
   *  finché la `chiusa: n` non la raffredda; con `asciutti` la lanterna la trova già fredda); `chiusa: n` leva della chiusa (come
   *  `valvola: n`); `getto` cascata d'acqua di raffreddamento (pavimento): spegne chi brucia e il Mastro Forgiatore.
   *  Mausoleo: `cancello: n` il cancello del Santuario, un bacino come `acqua: n` (sbarre: ci si vede attraverso; con `asciutti` la
   *  lanterna lo trova già aperto); `carica: n` la chiave di carica che lo apre (come `valvola: n`); `sarcofago` il sarcofago della Regina
   *  (non ci si cammina, ci si vede sopra): ucciso il capo si apre e il bottino del capo compare lì davanti. */
  legenda: Record<string, { nemico?: string; capo?: boolean; forziere?: string; libro?: string; luce?: boolean; colonna?: boolean; altare?: boolean; asciutti?: number[]; acqua?: number; valvola?: number; vento?: number; timone?: number; grata?: boolean; ferme?: number[]; lava?: number; colata?: number; chiusa?: number; getto?: boolean; cancello?: number; carica?: number; sarcofago?: boolean }>;
  /** Dove sta l'ingresso nel mondo: cella di un'isola di islands.json (il modello è `prop_ingresso_<stile>`). */
  ingresso: { island: string; at: [number, number] };
  /** Lore dentro il dungeon (docs/RPG.md §2c): solo testo per il client, la sim non lo vede. */
  testi?: DungeonTesti;
};

/** Lore di un dungeon: poche cose obbligatorie e corte (sottotitolo, voci), il resto facoltativo (letture). Celle [x, z] della mappa. */
export type DungeonTesti = {
  /** Sotto il nome, nella scritta grande a ogni discesa. */
  sottotitolo?: string;
  /** Obbligatorie: la prima volta che entri nella zona [x0, z0, x1, z1] (estremi compresi) parla `chi` (`capo`: è il capo, in rosso). */
  voci?: { id: string; zona: [number, number, number, number]; chi: string; capo?: boolean; testo: string }[];
  /** Facoltative: `libro` = leggio sulla cella, `incisione` = targa sul muro a nord della cella. Si aprono solo tenendo premuto LEGGI.
   *  `dopo: 'capo'`: c'è solo quando il capo è morto (la lettera nel sarcofago del Mausoleo). */
  letture?: { id: string; tipo: 'libro' | 'incisione'; at: [number, number]; titolo: string; righe: string[]; dopo?: 'capo' }[];
};

export type RpgBalance = {
  attributi: { base: Record<AttrId, number>; perLivello: number; regen: Record<AttrId, number> };
  livelli: { skillIniziale: number; skillMax: number; xpSkill: { base: number; perLivello: number }; xpPersonaggio: { base: number; perLivello: number } };
  movimento: { camminata: number; corsa: number; staminaCorsa: number; raggio: number; mentreCarichi: number };
  peso: { base: number; perStamina: number };
  /** R-rpg, facoltativi: leggera = peso massimo per i perk «con armatura leggera» (vesti e nessuna armatura contano sempre); liberi = kg che non rallentano. */
  armatura: { k: number; malusPerPeso: number; malusMax: number; leggera?: number; liberi?: number };
  /** R-rpg, facoltativi: arma quando non ne hai una; quanto ogni livello di abilità sopra skillIniziale alza danno (armi e magie) e potenza delle pozioni. */
  pugni?: { danno: number; velocita: number; portata: number; carica: number; caricaMolt: number };
  abilita?: { dannoPerLivello: number; potenzaPerLivello: number };
  partenza: { inv: Record<string, number>; equip: Record<string, string>; magie: string[]; monete: number };
  /** altare.protezione: secondi senza danni dopo il risveglio all'altare (i nemici non ti uccidono appena riapri gli occhi). */
  dungeon: {
    maxMinuti: number; morte: { bottino: number; xp: number }; altare: { protezione: number };
    /** Dungeon insieme (#118): al massimo `max` eroi; la vita dei nemici cresce di `vitaPerCompagno` (frazione) per ogni eroe oltre il primo. */
    gruppo?: { max: number; vitaPerCompagno: number };
  };
  xp: Record<string, number>;
  /** Xp di combattimento: danno utile (mai oltre la vita che restava al nemico) × questo, per abilità. Evocazione = danno della tua evocazione. */
  xpDanno?: Partial<Record<SkillId, number>>;
  forziere: number[];
  bottega: Record<string, number>;
  /** Contrabbandiere del Porto (accanto alla Grotta): ogni giorno un oggetto per categoria di `banco`, venduto a valore × `vendita`;
   *  compra tutto a valore × `compra` (monete, arrotondato giù sul totale). Valore: `valori[id]`, se no il costo di forgia × `lavoro`
   *  (materiali a `valori`, il Legno a `valori['risorsa:legno']`), le pozioni dalla ricetta × `pozione`, il resto da `tipi` (`unico` per gli unici). */
  contrabbando: {
    vendita: number; compra: number; lavoro: number; pozione: number;
    valori: Record<string, number>;
    tipi: Partial<Record<ItemKind | 'unico', number>>;
    banco: Record<'arma' | 'armatura' | 'materiale' | 'ingrediente', string[]>;
  };
};
