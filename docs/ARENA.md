# MAREA — Isola dell'Arena (GDD e com'è ora)

> Documento di riferimento del PvP e dell'Isola dell'Arena. Le parti 1-4 e le regole delle modalità (parte 6) sono il design di Riccardo;
> la parte 5 dice com'è fatta una partita, la 6 le quattro modalità e le loro mappe, la 7 le build uguali per tutti e le ulti. Le voci
> **[proposta]** sono scelte di Claude dove il design non diceva niente: si cambiano nei JSON di `packages/content/src/arena/arena.json` (col
> perché nella PR). Mappa del codice: `MAPPA.md`; messaggi: `packages/protocol/src/arena.ts`.

---

## 1. Visione del Gioco
Il PvP di MAREA in stile *Brawl Stars* su un'isola sua («Isola dell'Arena»), col combattimento dei dungeon ma **senza il personaggio**:
abilità, perk, zaino e armature non c'entrano, si parte tutti uguali e conta la build scelta prima della partita (parte 7).

### Modalità (parte 6)
- **Sopravvivenza**: l'ultimo in piedi su un'isola che la nube tossica stringe; 10 tutti contro tutti o 5 coppie.
- **Caccia alle stelle**: 3 contro 3 per 2 minuti, la taglia di stelle sopra la testa di ognuno.
- **Controllo**: 3 contro 3, zone da conquistare fino al 100%.
- **Rapinatori**: 2 contro 2 o 3 contro 3, rompere la cassaforte avversaria prima che rompano la tua.

Ogni modalità si gioca con **qualsiasi mix di persone e gladiatori automatici**: da soli con tutti gladiatori, in cinque con un gladiatore, a
partita piena di persone. Il duello a round (1v1, 2v2, 3v3) di prima non c'è più, e nemmeno le sue mappe (colosseo, giardino, rovine).

---

## 2. Regole di Gioco & Loadout

### Build Pre-Partita
All'ingresso del colosseo (**ENTRA NEL COLOSSEO**, o A vicino al portone) si apre il pannello: in cima la **MODALITÀ** (le quattro, con la
grandezza di squadra dove c'è da scegliere e la mappa), poi **LE TUE BUILD**: se ne salvano fino a 3 (schede BUILD 1-3, + NUOVA), si gioca con
quella scelta; si salvano col personaggio (`HeroState.arena`, `POST /api/rpg {t:'arena'}`). Ogni build è uguale per tutti e ha:
- una **dote** al posto dell'armatura: +10% di **Vita**, o +100% di **Vigore** o +30% di **Magicka** (massimo e ricarica), con un leggero
  bagliore attorno all'eroe, rosso, verde o blu (parte 7);
- **2 slot** tra le armi (una per tipo, tutte di ferro: nunchaku, katana, ascia, lancia, spadone, martello, arco) e le magie (fuoco ed
  elettricità a proiettile, raggio e bomba; Cura e Furia **solo con dei compagni**: tutti contro tutti quello slot resta vuoto; niente evocazioni);
- un'**ulti** a scelta tra sei (parte 7).
Niente pozioni né anelli; l'arco ha 18 frecce (si riempiono quando si rinasce). Senza niente negli slot si combatte coi pugni.
In Arena le magie **elettriche non rallentano** (nei dungeon sì): fanno un po' meno danno di quelle di fuoco, costano meno e sono più facili da prendere
(proiettile più largo, raggio più lungo e largo, scoppio più grande; `build.magie` → `raggio`, `gittata`, `larghezza`, `senzaRallenta`).

### Interfaccia Utente
- In alto il **tabellone**: a sinistra la mia squadra (una barra di vita per eroe, io per primo, con Magicka e Stamina sotto); in mezzo il
  tempo e i punti della modalità (stelle, % di conquista, % della cassaforte); a destra l'altra squadra, o nella Sopravvivenza quante squadre
  sono **IN PIEDI**.
- Sopra la testa di ognuno il suo numero quando serve: le **monete rosse** (Sopravvivenza) o le **stelle della taglia** (Caccia alle stelle).
- Un cartello sotto il tabellone: NELL'ERBA / NEL VELO (non ti vedono), NELLA NUBE (torna dentro!), **RINASCI TRA N**, SEI FUORI (col posto).
- In basso la **barra**: i 2 slot (tocco su telefono 390×844, tasti **1-2** su PC) e il bottone tondo dell'**ulti**, che si riempie dal basso e
  si accende quando è piena (tocco, tasto **F**). La **schivata** come nei dungeon (bottone Schiva, tasto **V**): costa Vigore e mentre rotoli
  i colpi non ti prendono. Sullo slot si vede quante frecce restano (arco) o quanta Magicka costa (magie).
- Joystick di movimento, A e B come sempre (alzati sopra la barra); con l'arco o una magia in mano, al telefono il **joystick di mira** al
  posto di A, al PC il clic sinistro tenuto e la mira verso il cursore, come nei dungeon.
- Menu (Esc o il bottone in alto a destra): RIPRENDI e **ARRENDITI** (con conferma).
- La camera guarda un po' verso l'avversario più vicino che si vede; da a terra segue un compagno (o, da soli, chi ti ha buttato giù).

---

## 3. Magie di Supporto
- **Cura a flusso**: raggio continuo concentrato su un singolo alleato o evocazione.
- **Cura a bomba**: lancio ad area che cura alleati ed evocazioni nella zona d'impatto.
- **Furia a flusso**: raggio continuo che aumenta velocità e danno di un singolo alleato o evocazione.
- **Furia a bomba**: lancio ad area che potenzia per qualche secondo chi si trova nel raggio d'azione.
- In Arena valgono **solo nelle modalità con dei compagni** e **solo su di te e sui compagni**, mai sugli avversari; senza nessuno dei tuoi
  davanti il flusso va su di te e la bomba ti cade ai piedi. I loro numeri in Arena sono fissi (`arena.json` → `build.magie`).

---

## 4. Principi di Bilanciamento PvP
- **Tutti uguali**: 100 di Vita, Magicka e Stamina (più la dote), niente armatura, niente perk né abilità; danni, velocità e costi di ogni arma
  e magia sono fissi, scritti in `arena.json` → `build` (`buildArenaEroe` di `sim/rpg/arena.ts`). Le monete rosse della Sopravvivenza sono
  l'unica cosa che cresce durante una partita.
- **Recupero Vita**: dopo 4 s senza attaccare si recuperano 4 punti Vita al secondo, anche mentre ci si muove o si schiva.
- **Niente one-shot**: nessun colpo supera `arena.dannoMax` (92) di `balance.json`.
- **Il peso conta**: col martello in mano si va un po' più piano (−11%), con nunchaku e arco un po' più svelti (+2%): `build.passo`.
- **Il Vigore è per correre e schivare, non per colpire**: i colpi e le frecce non costano niente (a Vigore finito sul telefono sembrava che le
  armi non funzionassero). La corsa consuma Vigore, la schivata costa `build.staminaSchivata` (34, più dei 24 dei dungeon); senza il Vigore che
  costa non si rotola.
- **Indipendenza**: il bilanciamento dell'Arena non tocca i dungeon (stessi hash, stessa fixture d'oro).

---

## 5. Com'è fatta una partita

### Isola dell'Arena
- Isola `arena` 36×34 a sud-est del Porto (`[238, 256]`, tra i Templari e il Vulcano), **aperta a tutti** (sblocco `libera`) **[proposta]**:
  molo a sud-ovest, viale lastricato con gli stendardi e due bracieri fino al **portone del colosseo** (`render/island_arena.ts`). In bussola
  la meta **Colosseo** (sezione Isole). Il colosseo da fuori resta: le partite si giocano nelle mappe della parte 6.

### Trovare gli altri
- **CODA VELOCE** (per modalità e grandezza di squadra): si parte a partita piena o, dopo **10 s** (`rete.attesaBotSecondi`), con chi c'è; le
  persone si spargono tra le squadre (la prima nella 0, la seconda nella 1…).
- **CREA SALA**: un codice di 4 lettere da dire agli amici, che lo scrivono e premono ENTRA. La squadra di chi l'ha aperta si riempie per
  prima, poi le altre; chi l'ha aperta preme **PARTI ORA** (anche da solo), o si parte da soli a sala piena.
- **ALLENAMENTO**: tu e i gladiatori su tutti gli altri posti, senza server né premio. Ogni gladiatore ha una **build casuale** tirata a ogni
  partita (`sim/rpg/arena_bot.ts`); nel pannello, sezione **GLADIATORI DELL'ALLENAMENTO**, un tocco su uno (compagni prima, poi avversari)
  apre lo stesso editor della tua build; **BUILD CASUALE** lo rimette al caso. ARRENDITI nell'allenamento chiude la partita.
- Online i posti vuoti li prendono i **gladiatori automatici** (`sim/arena/bot.ts`, nomi e look in `arena.json` → `gladiatori`, ne servono 9):
  copiano la build di una delle persone e i loro input li decide il server (stesso turno delle persone, stesso replay). Se non resta nessuna
  persona, si arrendono. Il gladiatore fa la modalità: rompe casse, raccoglie monete e scappa dalla nube; va nelle zone; attacca o difende
  la cassaforte (il terzo della squadra difende).

### La partita
- **3 s** di conto alla rovescia (fermi, si può già cambiare slot), poi il gioco fino alla fine della modalità o del tempo. Una partita sola,
  niente round.
- **Rinascita** (Stelle, Controllo, Rapinatori) **[proposta]**: chi cade torna dopo **3 s** (`modi.rinascita`) alla partenza della sua squadra,
  com'era all'inizio (primo slot, frecce piene; la carica dell'ulti resta), intoccabile per **1,5 s** (`modi.protetto`). Nella Sopravvivenza
  non si rinasce: chi cade guarda gli altri finché la partita finisce, o esce.
- A tempo scaduto, sotto `modi.pariSotto` (1) di differenza è **pari**.
- **Resa**: dal menu (ARRENDITI) o uscendo; chi si arrende esce dalla partita e la sua squadra continua; se si arrende tutta una squadra vince
  l'altra (nella Sopravvivenza chi si arrende è fuori, e basta).
- **Linea persa** **[proposta]**: la partita si ferma e gli altri vedono «ha perso la linea: lo aspetto ancora N s»; il gioco si ricollega da
  solo e riprende coi turni persi. Dopo **20 s** senza tornare è dato per arreso. Chi è già fuori per sempre (Sopravvivenza) e se ne va non
  ferma nessuno.
- **Il server decide**: il DO `Arena` fa girare la partita coi turni di tutti e alla fine la **rigioca dal log** (`replayPartita`); l'esito del
  replay vale per il premio. Se il server si riavvia a metà (un deploy) la partita si perde, senza premio.

### Esito e premio
- Scheda finale: VITTORIA / SCONFITTA / PAREGGIO e il perché (ultimo in piedi o il posto, le stelle, la conquista, la cassaforte, la resa), e il premio.
- **Premio** **[proposta]**: monete del personaggio, **30** per una vittoria, **10** per una sconfitta, niente per pareggio e resa; **tetto di
  150 monete al giorno** (giorno UTC). Nella Sopravvivenza vince solo il primo posto. Il lotto tiene vinte, perse e pari (`LotState.arena`).
- **[proposta]** Niente monete se tra gli **avversari non c'è nessuna persona** (solo gladiatori): si contano vinte e perse. Basta una persona
  dall'altra parte (o, nella Sopravvivenza, in un'altra squadra) e il premio c'è.

### Prove
- **Bombe**: passano sopra muri e ostacoli e scoppiano dove atterrano.
- **Ombra di mira**: con una magia a bomba in mano, mentre si mira a terra c'è un disco scuro col raggio dello scoppio dove la bomba
  atterrerebbe. La vede solo chi mira. La direzione delle bombe è smorzata per limitare gli scarti con joystick e mouse.
- **Allenamento senza server**: `?test=1&net=0&arena=banco` entra subito nell'allenamento (Caccia alle stelle). `?arena=1`: il bottone ⚔ porta
  al colosseo. Hook di prova: `arenaGioca`, `arenaPosa`, `arenaCarica`, `arenaTempo` (avanti di N s), `arenaAuto` (il pilota gioca per me).
- Test: `packages/sim/test/arena_partita.test.ts` (build, colpi tra eroi, Vigore, Cura e Furia, le sei ulti, erba alta, resa, premio),
  `arena_modi.test.ts` (le regole delle quattro modalità e partite intere di gladiatori in ognuna, col replay uguale), `arena_bot.test.ts`
  (build casuali, distanza della bomba); `tests/e2e/m4_arena.mjs` (telefono e PC), `m4_arena_modi.mjs` (le quattro modalità al telefono),
  `m4_arena_server.mjs` (client finti contro il server: sala, coda coi gladiatori, linea persa e ripresa, resa, premio, Sopravvivenza a 10).

### Da fare dopo
- Modelli veri (Blender) per le mappe: oggi pavimenti, muri, colonne, muretti, casse e casseforti sono blocchi in codice (`rpg/arena_kit.ts`).
- Altre mappe per modalità (il codice ne sceglie una a caso tra quelle della modalità).
- Una classifica o un titolo per chi vince di più (il Diario del capitano).
- L'isola va confermata da Jack (`BACKLOG.md`, «Da confermare»).

---

## 6. Le quattro modalità e le mappe
Regole in `sim/arena/modi.ts`, numeri in `arena.json` → `modi`. Le mappe sono nel formato dei dungeon (2 m a cella), chiuse, con tutto il
pavimento raggiungibile; quelle a due squadre sono **simmetriche** (ruotate di mezzo giro, casseforti e zone si scambiano). Segni nelle righe
(pavimento): `K` cassa, `A` `B` le casseforti delle squadre 0 e 1, `1` `2` i centri delle zone; `E` erba alta, `C` colonna, `m` muretto basso
(si tira sopra, non si passa). Le collisioni di colonne e recinzioni seguono il loro ingombro, lasciando liberi i passaggi laterali. Una mappa nuova è una voce in `arena.json` → `mappe` con `modi` e `spawn` per squadra, più (per un aspetto
suo) un kit in `rpg/arena_kit.ts` e una riga in `STYLE` di `rpg/dungeon_scene.ts`.

### Sopravvivenza — Isola del Naufragio (34×34)
- **10 eroi**: da soli (10 squadre) o in coppia (5 squadre da 2). Una vita sola; vince l'ultima squadra in piedi, gli altri hanno il loro posto
  (chi esce prima è più in fondo; caduti insieme = stesso posto). Dopo **200 s** **[proposta]** vince chi ha più Vita.
- **Casse** (16 sparse, `cassa.vita` 40): si rompono e lasciano una **moneta rossa**. Chi ci passa sopra la prende: **+10% di Vita** (massimo e
  subito) e **+8% ai danni** per tutta la partita **[proposta]**. Il numero sopra la testa (moneta rossa e numero); chi cade le lascia **tutte**
  a terra, in un mucchio che chiunque può prendere.
- **Nube tossica** verde: dai **20 s** si stringe dal bordo verso il centro, fino a un cerchio di **3 m** ai **150 s**; fuori fa **20 danni al
  secondo** (a impulsi, 6 al secondo) **[proposta]**.
- La mappa: un'isola di sabbia nel mare, col relitto al centro (le assi basse dello scafo, l'albero maestro con la vela), palme, scogli
  muschiosi, giungla d'erba alta, fuochi dei naufraghi; le partenze in cinque coppie su un anello.

### Caccia alle stelle — Osservatorio delle Stelle (27×19)
- **3 contro 3, 2 minuti**. Ognuno ha una **taglia** di **2 stelle** sopra la testa. Chi butta giù un avversario prende le sue stelle per la
  squadra e la sua taglia sale di una, fino a **7**; chi cade riparte da 2 **[proposta]**. A tempo scaduto vince chi ha più stelle (uguali = pari).
- La mappa: terrazza di lastre blu con le stelline accese, muri viola con le borchie d'oro, la cupola dei telescopi in mezzo, siepi di cristallo,
  prati d'erba ai quattro angoli; le squadre a sinistra e a destra.

### Controllo — Forte del Faro (29×21)
- **3 contro 3, 150 s**. Due **zone** (cerchi di **3,5 m**, in alto e in basso al centro), attive tutte e due. Una zona sale di **1,6 punti al
  secondo** per la squadra che ci ha almeno un eroe in piedi dentro e **nessun avversario** (se ci sono tutte e due è **contesa**: non sale
  niente) **[proposta]**; a **100** è conquistata e si chiude: si va sull'altra. I punti della squadra sono la media delle zone (una presa = 50%).
- Vince chi le conquista tutte (barra al 100%), o a tempo scaduto chi ha la percentuale più alta.
- Nella scena: un anello di lastre e un disco giallo (nessuno), blu (i miei), rosso (gli altri), arancio che lampeggia (contesa); l'asta con la
  bandiera che sale; sopra, «ZONA 1 40% · 20%».
- La mappa: il prato fra i bastioni merlati, il faro bianco e rosso sulla torre in mezzo, cannoni sugli affusti, palizzate, erba alta ai fianchi.

### Rapinatori — Porto dei Contrabbandieri (23×31)
- **2 contro 2 o 3 contro 3, 150 s**. Una **cassaforte** per base (vita **400** **[proposta]**, scelta con partite di gladiatori perché a volte
  cada prima del tempo), che i suoi non possono colpire; vince chi rompe quella degli altri, o a tempo scaduto chi ha la sua più integra (in %).
- La mappa: banchine di tavolato divise da un canale d'acqua (si tira sopra, non si passa) con tre ponti, magazzini dal tetto rosso, pile di
  barili, erba alta sulle banchine; le basi in basso (squadra 0) e in alto (squadra 1), la cassaforte davanti alle partenze.

### Erba alta (come in Brawl Stars)
- Le celle `E`: chi ci sta dentro **non lo vedono gli avversari** (non si disegna, niente nome, la mira assistita non lo punta); i compagni sì.
  Chi è nascosto vede il proprio eroe semitrasparente. Quando torna visibile agli avversari ricompare con una breve dissolvenza a pixel.
  Colpi, frecce, scoppi e mischia lo prendono lo stesso.
- Lo **scoprono** **[proposta]**: un avversario entro 3 m, e per 1,2 s chi attacca o prende un colpo (`balance.json` → `arena.erba`).
- I gladiatori rispettano l'erba: non vedono chi è nascosto, lo cercano dove l'hanno visto l'ultima volta.
- Il client riceve gli stessi turni di tutti e ha tutto lo stato: l'erba nasconde sullo schermo e alla mira, non protegge da chi modifica il client.

---

## 7. Build, doti e ulti

### Le ulti
Una a scelta nella build. Si **carica giocando** (`arena.json` → `ulti.carica`): un po' al secondo, di più col danno dato e un po' col danno
preso; piena a 100, si lancia col bottone tondo o con **F**. Mentre è in corso non si carica. **[proposta]** La carica **resta** anche
quando si cade e si rinasce. Codice in `sim/arena/ulti.ts`, sopra la sim della partita.
- **Furia**: danni ×2 per 5 s (armi e magie; il tetto contro i one-shot resta).
- **Scatto**: passo ×2 per 10 s, la corsa non consuma Vigore.
- **Aura di cura**: per 6 s cura te e i compagni entro 4 m.
- **Raggio della Marea** (la kamehameha): fermo, carichi 0,7 s una sfera d'acqua, poi un raggio dritto fino al primo muro per 1,5 s che
  colpisce tutti gli avversari sulla linea; lo giri con la mira (stick destro al telefono, mouse al PC) o, in mancanza, col joystick. Chi carica e spara non si muove: si può schivare girandogli attorno.
- **Arpione**: un gancio dritto davanti (11 m); chi prende viene tirato fino a te, preso un po' di danno, e resta fermo un attimo.
- **Velo di nebbia**: per 8 s gli avversari non ti vedono, come nell'erba alta (anche fuori dall'erba); attaccando ti scopri.

### Come si vede
- Il **bagliore della dote** (`rpg/arena_fx.ts`): un guscio trasparente attorno all'eroe e un anello a terra, a scatti, rosso (Vita), verde
  (Vigore) o blu (Magicka); con Furia o Scatto in corso si accende di più. Aura: l'anello verde col raggio dell'aura. Velo: la nebbia grigia
  (la vedono solo lui e i compagni). Marea: la sfera e il raggio d'acqua. Arpione: la punta e la corda. Gli avversari nascosti non mostrano niente.
- Quando qualcuno lancia l'ulti, sopra la testa compare il suo nome.

### Bilanciamento: come è stato fatto
I numeri delle armi e delle magie (`build.armi`, `build.magie`) vengono da migliaia di partite simulate tra gladiatori automatici con build a
caso (2 slot, dote e ulti a caso, ulti accese): il danno di ogni arma e magia è stato corretto a piccoli passi finché ognuna vince tra il 45% e
il 55% delle partite in cui c'è. Il gladiatore tira con arco e magie mirando davvero (con un po' d'anticipo) e schiva come una persona (non
sempre in tempo) i caricati che stanno per partire e i proiettili in arrivo; non scappa, quindi le ulti di movimento (Scatto, Velo) nelle
simulazioni contano meno che tra persone. Coi colpi che non costano Vigore (12.000 partite a build casuali) ogni arma e magia vince il 49-52%;
dote Vita +10% (53%), Magicka +30% (53%), Vigore +100% (44%: il gladiatore schiva e corre poco, tra persone vale di più). I numeri delle modalità (casse, monete rosse, nube, zone, cassaforte) vengono da partite di soli gladiatori in ogni modalità: la
Sopravvivenza finisce tra 50 e 150 s, la cassaforte ogni tanto cade prima del tempo.
