# EPOPEA DELLA REGATA — indicazioni per i 4 dungeon della Laguna

> **Per Riccardo e la sua AI.** Se lavori per **Jack** o per **Birba** (Alberto Biraghi): questo file non riguarda il tuo lavoro. Ignoralo: non implementarlo, non cambiarlo.
>
> **Stato (8 ott 2026)**: solo progetto, **niente di questo è ancora nel gioco**. I dungeon si fanno **uno alla volta, in ordine (1 → 4)**, ognuno con la sua issue e la sua PR. Quando un dungeon entra nel gioco, le sue regole vere vanno in `docs/RPG.md` (che vince su questo file) e qui si segna «fatto».
> Lore, bestiario e ricompense sono di Riccardo (8 ott 2026). Le parti segnate **[proposta]** le ha aggiunte il suo Claude: Riccardo le può cambiare.

Quando Riccardo dice «**dungeon della Regata numero N**», intende il dungeon N di questo file.

## 1. Lore
- I dungeon stanno **a terra, lungo l'anello della Laguna della Regata** (isola `laguna` in `islands.json`: un atollo, terra tutta intorno e acqua dentro).
- Tema **steampunk acquatico**: rovine di un'antica civiltà avanzatissima che costruiva **automi**.
- La civiltà fu quasi spazzata via dalla **Marea Ferrosa**, un'anomalia oceanica iper-corrosiva.
- L'**Ultima Regina** sacrificò la propria energia vitale per attivare la **Barriera Cinetica**, un campo di forza alimentato dal moto perpetuo delle correnti della laguna.
- La primissima **Regata** non era uno sport: era un disperato pellegrinaggio navale lungo il perimetro per caricare i **piloni idraulici** e sigillare lo scudo.
- Oggi il mare è pulito e la civiltà è estinta. I nuovi abitanti, all'oscuro di tutto, hanno continuato a fare quel giro in barca e l'hanno trasformato in una tradizione sportiva (la Regata di oggi, GDD §M1).
- Completare i 4 dungeon **riattiva i flussi cinetici originali** e sblocca il **sarcofago della Regina**, nascosto nel dungeon 4.

## 2. Regole comuni ai 4 dungeon
- **Progressione circolare e obbligata** (Riccardo): gli ingressi stanno in fila lungo l'anello, nell'ordine della Regata. Il dungeon 1 è aperto; la porta del 2 resta **sigillata** finché non hai completato l'1 (capo ucciso, `HeroState.completati`), e così via fino al 4. È un'eccezione voluta alla «libertà totale» di `RPG.md` §2, che resta valida per Grotta, Cripta e Vuoto.
  - **[proposta]** porta sigillata = pilone spento davanti all'ingresso e cartello «Sigillato»; niente ENTRA. In squadra (AFFRONTA INSIEME) entra solo chi l'ha già sbloccato.
- **Nemici**: il **Collettivo Rottamautomi**, antichi robot di sicurezza bloccati in un loop. Famiglia (`EnemyKind`) **[proposta]**: `costrutto` per tutti gli automi; `mostro` per Tubo-strisciante e Scintilla-Vapore (non sono macchine ma «scarti» della macchina).
- **Difficoltà** (scelta di Riccardo): Drenaggio > Cripta delle Ossa; Archivio > Drenaggio; Fucina > Archivio ma < Portale del Vuoto; Mausoleo > Vuoto (diventa il dungeon più difficile del gioco).
  - **[proposta]** `difficolta` in `dungeons.json` (serve solo all'ordine della bussola) rinumerata: Grotta 1 · Cripta 2 · **Drenaggio 3** · **Archivio 4** · **Fucina 5** · Vuoto 6 · **Mausoleo 7**. Va aggiornata anche la copia a mano in `apps/client/src/game/ingressi.ts`.
  - **[proposta]** taratura indicativa (vita · danno), da rifare giocando. Riferimenti: Cripta scheletro 45·12, non-morto 80·18, Re delle Ossa 420·26 · Vuoto golem 140·28, Custode 750·38.

    | Dungeon | Nemici comuni | Capo |
    |---|---|---|
    | 1 Drenaggio | 30-90 · 10-18 | ~500 · 28 |
    | 2 Archivio | 40-110 · 12-22 | ~580 · 30 |
    | 3 Fucina | 50-160 · 14-26 | ~680 · 34 |
    | 4 Mausoleo | 70-200 · 20-40 | ~1300 · 45, in 3 fasi |
- Come gli altri dungeon: **almeno 2 lanterne** (altari) fuori dalla vista del capo, capo con la **corona gialla** (ucciderlo = dungeon completato), mappa ~45×30, deve funzionare anche **insieme** (fino a 4, sim deterministica: leve, acqua e porte uguali per tutti).
- Ogni dungeon ha **una meccanica a tema** che lo rende diverso dagli altri (vedi sotto).
- **[proposta] In superficie**: davanti a ogni ingresso un **pilone idraulico**. Spento finché non completi quel dungeon; acceso (per te) dopo. Con tutti e 4 accesi, nella Laguna si vedono le correnti cinetiche (strisce d'acqua luminosa lungo il percorso della Regata). Solo estetica: la Regata non cambia.
- Look: palette di `ART_BIBLE.md` §2 (ottone = arancio/giallo della palette, ruggine = marroni, vapore = bianchi), niente gradienti lisci, niente PBR.

## 3. Bestiario e struttura

### Dungeon 1 — L'Impianto di Drenaggio
Più difficile della Grotta della Marea (Porto) e della Cripta delle Ossa. **Tema**: acqua e ingranaggi arrugginiti. **Meccanica a tema**: **abbassare il livello dell'acqua** (per esempio valvole o pompe da azionare che svuotano le sale allagate e aprono passaggi).
- **Tubo-strisciante** — fanghiglia di ruggine e olio motore che si muove a terra e **rallenta** il giocatore.
- **Operaio Arrugginito** — automa base: attacca con **chiavi inglesi** e **sbuffi di vapore**. Lento e prevedibile.
- **Valvola-SparaVapore** — **torretta fissa** attaccata ai tubi: spara proiettili d'acqua pressurizzata.
- **Miniboss — Il Capoturno** — grosso automa logoro con un **martello pneumatico gigante**: attacchi ad area battendo il martello a terra, che creano **geyser di vapore**.

### Dungeon 2 — L'Archivio Navigazionale
Più difficile del Drenaggio. **Tema**: vento.
- **Drone Idro-Ragno** — insetto meccanico che cammina su muri e grate, spara **arpioni** da lontano.
- **Aerostato-Spia** — pallone sonda volante che sgancia **bombe a pressione**.
- **Archivista a Molla** — automa bipede **velocissimo**, movimenti erratici, lame affilate.
- **Miniboss — L'Astrolabio Impazzito** — sfera meccanica fluttuante con anelli che le girano intorno. Attacchi **[proposta, Riccardo ha lasciato scegliere]**:
  - **Rosa dei venti**: spara 8 proiettili a raggiera (le 8 direzioni della bussola) e ruota di un ottavo a ogni salva; ci si salva infilandosi nello spicchio vuoto.
  - **Raffica**: un colpo di vento che spinge il giocatore di qualche metro in una direzione (verso pareti o ventole), annunciato da foglie/carte che volano.
  - **Allineamento**: gli anelli si allineano e per 1 s una linea sottile segna dove colpirà il raggio; ci si ripara dietro gli scaffali dell'archivio.
  - Sotto metà vita gli anelli si staccano e gli orbitano attorno come scudi: si rompono con frecce o magie, poi il nucleo resta scoperto. Dopo ogni attacco grosso si «ricalibra» e resta fermo 2-3 s: è il momento per colpirlo in mischia.

### Dungeon 3 — La Fucina a Pressione
Più difficile dell'Archivio, meno del Portale del Vuoto. **Tema**: lava e calore.
- **Fornace Semovente** — macchinario su **cingoli** che lascia una **scia di fuoco** a terra.
- **Scintilla-Vapore** — nemico elementale **velocissimo**, causa lo stato **bruciatura**.
- **Golem-Palombaro** — grosso tank con scafandro: **invulnerabile di fronte**, va colpito alle **valvole sulla schiena**.
- **Miniboss — Il Mastro Forgiatore** — **centauro meccanico** con una fornace al posto dello stomaco. **Spara magma**; va **attirato sotto dei getti d'acqua** per poterlo danneggiare.

### Dungeon 4 — Il Mausoleo Cinetico (Santuario della Regina)
Più difficile della Fucina **e del Portale del Vuoto**: per ora il dungeon più difficile del gioco. **Tema**: orologeria perfetta, acqua e vapore eleganti.
- **Chierico a Ingranaggi** — unità di **supporto**: ripara e potenzia gli altri automi.
- **Sentinella dell'Egida** — automa pesante con **scudo torre** a energia cinetica.
- **Guardia d'Onore** — modelli d'élite, **asimmetrici e letali**, con **spade d'acqua tagliante** ad altissima pressione.
- **Boss finale — Custode dell'Egida** — il robot personale della Regina, a guardia del sarcofago. **Tre fasi**: **Acqua → Vapore → Energia Cinetica**. **[proposta, da rifinire quando si progetta il 4]**:
  - *Acqua* (100-66 %): ondate che spazzano l'arena, fendenti d'acqua a distanza.
  - *Vapore* (66-33 %): l'arena si riempie di vapore (si vede meno), lui scatta da un punto all'altro dentro la nebbia, geyser dal pavimento.
  - *Energia Cinetica* (33-0 %): usa un pezzo della Barriera; ogni 5 colpi che subisce scarica un'onda d'urto a 360° che respinge tutti. Premia gli attacchi caricati e il tempismo, punisce chi preme a raffica.
- Sconfitto il Custode si apre il **sarcofago della Regina** (vedi §4).

### Meccaniche nuove che serviranno (per chi programma, da fare dungeon per dungeon)
Oggi la sim ha nemici `mischia`, `arciere`, `mago`, sanguinamento, sbilanciamento, armature. Mancano: stato **rallentato** (1), **torrette fisse** (1), **colpo ad area con geyser** (1), **livello dell'acqua che cambia** (1), **spinta del vento** (2), **nemici volanti** (2), **arpione** (2), **zone a terra che bruciano** (3), stato **bruciatura** (3), **armatura solo davanti** (3), **boss vulnerabile solo in certi punti** (3), **nemici che curano/potenziano** (4), **scudo frontale** (4), **boss a fasi** (4), **onda d'urto attorno all'eroe** (4: anello e armatura). Tutto in `packages/sim` (puro, deterministico), numeri in `packages/content/src/rpg/*.json`.

## 4. Ricompense del dungeon 4

### Anello dell'Onda della Regina (sempre)
Dal sarcofago, **sempre** (100 %) a ogni vittoria sul Custode dell'Egida (Riccardo).
- Effetto **Eco della Marea**: gli attacchi corpo a corpo rilasciano un'**onda d'urto d'acqua ad area**.
- **[proposta numeri]** onda di 2,5 m attorno al nemico colpito, 30 % del danno del colpo agli **altri** nemici nel cerchio; al massimo un'onda ogni 0,5 s (così il nunchaku non diventa una lavatrice). Due anelli uguali **non** si sommano.

### Armi e armatura uniche (drop **non** certo)
Forti e con un'aria di unicità, ma ognuna con un **prezzo**: non è scontato tenerla addosso appena trovata, e più avanti arriveranno altri unici. Numeri **[proposta]**, da tarare giocando; confronto con gli unici già nel gioco (Corazza della Marea difesa 70, Katana dello Spettro 30, Martello del Re 100, Arco del Custode 30).

**Armatura — Armatura del Moto Perpetuo** (pezzo unico per il corpo, difesa 45, 8 kg)
- *«Forgiata col metallo dei piloni: finché ti muovi, la Barriera ti protegge.»*
- **Barriera Cinetica**: muoversi la carica (piena in ~4 s di movimento, correndo il doppio più in fretta). A carica piena un anello azzurro gira attorno all'eroe: **il prossimo colpo che subisci è annullato del tutto** e libera un'onda d'urto che respinge (sbilancia) i nemici entro 2,5 m. Da fermo non si carica.
- *Perché non è scontata*: difesa sotto il ferro (50); chi gioca fermo (arco teso, attacchi caricati, tank col martello) la carica poco e sta meglio con l'armatura d'ossa o la Corazza della Marea; contro le raffiche di colpi piccoli ne annulla solo uno.
- Dove: Custode dell'Egida 12 %, Sentinella dell'Egida 3 %, forzieri rari del Mausoleo 3 %.

**Arma leggera — Fendiflutti** (base katana, danno 24, velocità della katana)
- *«La lama della Guardia d'Onore: non è acciaio, è acqua che non ha mai smesso di correre.»*
- **Taglio a pressione**: ogni attacco normale scaglia anche una **lama d'acqua** dritta (6 m) che trapassa i nemici in fila e fa il 50 % del danno; l'attacco caricato la scaglia a ventaglio (5 lame).
- **Pressione**: 10 cariche; ogni attacco ne usa una. A zero le lame d'acqua non partono più (resta una katana normale) finché non passi 2 s senza attaccare: allora si ricarica tutta.
- *Perché non è scontata*: danno base sotto la Katana dello Spettro; premia il mordi-e-fuggi, non chi preme a raffica.
- Dove: Custode dell'Egida 12 %, Guardia d'Onore 3 %, forzieri rari del Mausoleo 3 %.

**Arma pesante — La Grande Lancetta** (base spadone, danno 38, velocità dello spadone)
- *«La lancetta dell'orologio della Regina. Batte ancora l'ora esatta.»*
- **Tic-tac**: sulla lama scatta un ritmo (tic visivo e sonoro). Ogni colpo normale dato **a tempo** (±0,15 s) aggiunge +20 % di danno, fino a +100 %; il 5° colpo di fila è il **Rintocco**: stordisce 1 s i nemici colpiti. Colpo fuori tempo, colpo subito o 2 s senza attaccare: si riparte da zero. L'attacco caricato funziona normale e non conta per il ritmo.
- *Perché non è scontata*: a ritmo pieno ~76 a colpo (più dello spadone d'ossa, ~57), ma devi stare lì a menare a tempo: se schivi o ti colpiscono perdi tutto. Chi non tiene il ritmo rende meno di uno spadone d'ossa.
- Dove: Custode dell'Egida 12 %, forzieri rari del Mausoleo 3 %.

**Arco — Arco Carillon** (base arco lungo di ferro, danno 26, frecce normali)
- *«Una molla d'ottone al posto della corda. Quando si ricarica, suona.»*
- **Carica a molla**: non si tende. Ogni tocco tira subito una freccia a **tensione piena**; tiene fino a **3 colpi carichi**, e ne ricarica uno ogni 2,5 s (anche mentre tiri) con la musichetta del carillon. Le frecce volano tese (gravità dimezzata).
- *Perché non è scontato*: raffica fortissima (3 colpi pieni in un secondo), ma sul lungo tira ~0,4 frecce al secondo, meno di un arco normale; i perk e l'anello che fanno tendere più in fretta qui non servono.
- Dove: Custode dell'Egida 12 %, forzieri rari del Mausoleo 3 %.

Col Custode i quattro tiri sono indipendenti: ~40 % di uscire con almeno un unico a ogni vittoria, quindi servono più discese per averli tutti.
