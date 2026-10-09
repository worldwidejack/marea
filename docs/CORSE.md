# Isola delle Corse (design)

> Parte del GDD: vale come `docs/GDD.md`, e dove si contraddicono si aggiornano tutti e due.
> I numeri del Gran Premio di oggi stanno in `packages/content/src/minigames/corse.json`.
> Jack, 9 ott 2026, issue madre #155. L'intervista del 9 ott ha deciso la **Parte A**, cioè l'isola completa: è la bibbia, e vince sulla Parte B. La **Parte B** è il Gran Premio online oggi (fetta 1), che resta finché il circuito della Spiaggia non lo sostituisce.
> **[proposta]** = idea di Claude da confermare con la concept art o giocando. **[da decidere]** = la scelta spetta a Jack.

# Parte A — L'isola completa

## A0. In tre righe
Un'isola strana dove **tutto è diventato una corsa**. La giri liberamente col tuo veicolo, come in Diddy Kong Racing, e da lì entri in **6 zone da 4 piste**, più i boss. Si corre con veicoli di **4 famiglie che si guidano in modo diverso**, dalle auto serie alle vasche da bagno, contro animali piloti che si prendono molto sul serio e contro i fantasmi degli amici. L'idea guida è non aggiungere piste tanto per farlo: si fa una zona completa alla volta, finita bene.

## A1. Tono e lore
- **Riferimenti**: tanti giochi mescolati. Da Diddy Kong Racing la struttura (isola-hub, porte, boss), da Mario Kart e Crash Team Racing la gara (drift, turbo, scorciatoie), da Trackmania le piste folli (salti, giri della morte, pareti).
- **Un posto strano**: per un motivo che sarà la lore, sull'isola tutto è diventato una corsa. Il tono mescola due cose:
  - il **grande evento sportivo**, felice e buffo (bandiere, podio, fuochi d'artificio);
  - un **filo di creepy, sempre colorato**, alla Luigi's Mansion: mai horror e mai buio vero.
- **C'è un cattivo**, che si affronta zona dopo zona. La lore si scrive dopo **[da decidere]**.

## A2. Vibes (le due scelte di Jack)
- **Pubblico di manichini**: tribune, moli e ombrelloni sono pieni di manichini. Applaudono a scatti e **girano la testa quando passi**. È il filo creepy di tutta l'isola.
- **Animali piloti seri**: granchi, struzzi, trichechi con casco, tuta, sponsor e numero di gara. Si prendono sul serio come in Formula 1: rituali prima del via, sguardi, podio impettito. Sono i **bot** e gli abitanti dell'isola.
- **Tu guidi col tuo avatar MAREA** (cappello e vestiti), seduto nel veicolo.

## A3. L'hub: l'isola aperta
- L'Isola delle Corse si gira **sempre col veicolo**: scendi dalla barca al molo e sali sul veicolo. Strade, spiaggia, acqua, salite e segreti, come l'isola di Diddy Kong Racing.
- Ogni zona ha la sua **porta**, cioè l'ingresso del suo quartiere. Le **stelle** aprono le porte e, dentro ogni zona, le piste.
- C'è un **garage** per cambiare veicolo. Nell'hub non si vince niente, quindi la guida è libera.
- Se con le ruote entri in acqua, il veicolo si trasforma in barca, alla Sonic Racing Transformed **[proposta]**.
- Le zone ancora chiuse si vedono, ma con la porta sbarrata.

## A4. Le 6 zone
Tutte dentro l'isola. Ogni zona ha:
- 4 piste;
- un **boss** (un animale campione da battere uno contro uno);
- un **tema musicale**;
- le sue famiglie di veicoli.

Le famiglie per zona sono una **[proposta]** da confermare con la concept art:

| # | Zona | Famiglie | Piste [proposta] | Boss |
|---|---|---|---|---|
| 1 | **Spiaggia e porto** (la prima) | Ruote + Acqua | Lungomare (circuito) · Baia (acqua) · Porto (mista: moli e canali) · Fuga dall'onda (A→B) | Granchio campione |
| 2 | **Ghiaccio e neve** | Scivoli (bob, slitta) + Ruote (fuoristrada) | Canale del bob · Slitte nel bosco · Lago ghiacciato · Valanga | [da decidere] |
| 3 | **Giungla e templi** | Scivoli (kart da miniera, rapide) + Due ruote (cross) | Miniera del tempio · Rapide · Sentiero del cross · Tempio che crolla | [da decidere] |
| 4 | **Città al neon di notte** | Due ruote + Ruote sportive | Strade bagnate · Tetti (salti) · Tunnel · Incrocio del treno | [da decidere] |
| 5 | **Luna park e giocattoli** | Veicoli buffi e giocattoli, montagne russe | Viale delle giostre · Montagne russe (giri della morte) · Scatola dei giocattoli · Casa degli specchi | [da decidere] |
| 6 | **Fondale e cielo** (il finale) | Acqua + piste sulle nuvole | Coralli · Corrente · Strada delle nuvole · Sfida al cattivo | il cattivo |

## A5. Le piste
- **Tipi**: circuiti a giri (3 giri, scorciatoie, sorpassi), **discese e fughe** da A a B (si scende da una montagna, si scappa da qualcosa) e **piste folli** (salti, giri della morte, pareti, trampolini).
- **Evento firma**: ogni pista ha una sorpresa sua che **cambia giro dopo giro**. Esempi:
  - sulla spiaggia l'onda che al 3° giro copre il lungomare;
  - nella giungla il tempio che crolla;
  - in città il treno che taglia la strada;
  - sul lago il ghiaccio che si crepa.
- **La pista decide la famiglia** (strada, acqua, scivolo…) e tu scegli il veicolo dentro quella famiglia. Alcune **piste speciali sono miste**: per esempio nel porto la moto d'acqua prende la scorciatoia nel canale e l'auto il molo.
- **Durata**: un circuito dura 1:30-2:00, una discesa o una fuga 60-90 s **[proposta]**.

## A6. Veicoli: 4 famiglie
Ogni famiglia ha **una guida sua**. Dentro la famiglia i veicoli cambiano velocità, accelerazione, peso e sterzo, come le guide morbida, media e nervosa di oggi. Niente aerei per ora.

| Famiglia | Veicoli | Come si guida [proposta] |
|---|---|---|
| **Ruote** | kart, auto sportive, fuoristrada, camion | come il Gran Premio di oggi: drift che carica il turbo |
| **Due ruote** | moto, scooter, bici | si piegano in curva, sterzo che dipende dalla velocità, l'impennata dà la spinta |
| **Acqua** | moto d'acqua, hovercraft, gommone | scivolano sempre, saltano sulle onde, il salto dà il turbo, la corrente spinge |
| **Scivoli e binari** | kart da miniera, scivolo d'acqua, bob, slitta | niente gas: spinge la gravità. Ti pieghi per stare in traiettoria e prendere le curve alte; sui binari scegli i bivi |

**Veicoli buffi**, uno o più per famiglia, ciascuno con **un pregio o un difetto comico** **[proposta]**:
- **Oggetti di casa**: il carrello della spesa ha la ruota storta e tira da una parte; la vasca da bagno galleggia, quindi va bene nelle piste miste; il divano a motore è pesante e nessuno lo sposta; il tosaerba non rallenta sull'erba.
- **Animali**: lo struzzo salta, la tartaruga gigante è lenta ma nessuno la ferma, il granchio va di lato.
- **Mezzi da lavoro**: l'ape car si inclina nelle curve strette, il muletto spinge, il trattore va ovunque.
- **Giocattoli e cibo**: la macchinina a molla va a scatti, la papera di gomma rimbalza, la fetta di pizza scivola tantissimo.

## A7. Avversari, oggetti, sblocchi
- **Avversari**: bot (gli animali piloti) più i **fantasmi degli amici**, cioè la loro gara migliore rigiocata in pista. Funziona anche se giocate a orari diversi e non costa niente. Niente gare dal vivo per ora **[da decidere più avanti]**.
- **Oggetti**: **solo in alcune gare**. Ci sono gare con oggetti e gare di guida pura. Quali sono è **[da decidere]**.
- **Sblocchi**:
  - **stelle-trofeo**, finite e che non si spendono: aprono zone e piste;
  - **veicoli**: i boss e i traguardi regalano veicoli nuovi, quelli buffi sono anche nascosti;
  - **premi per MAREA**: materiali e oggetti che servono fuori dall'isola.
- **Sfide extra** in pista (contro il tempo, collezionabili, prove speciali): dopo. Per ora contano vibes e vision.

## A8. Musica e suoni
- **Un tema per zona** più uno per l'hub, in stile console anni '90 (Diddy Kong Racing, Crash Team Racing). **All'ultimo giro accelera**.
- Suoni:
  - un motore per famiglia;
  - drift, turbo, spruzzi;
  - lo **sferragliare dei manichini** che applaudono a scatti e girano la testa.

## A9. Look e asset
- Valgono le regole di `ART_BIBLE.md`: palette, texture nearest, un atlas, flat shading, stile PS1, niente gradienti, niente PBR.
- **Prima la concept art**: per l'hub, ogni zona, ogni famiglia di veicoli, i buffi, i manichini e gli animali piloti si generano immagini di riferimento, e Jack sceglie da un foglio di confronto. Le scelte stanno in `assets/concept/corse/`, fuori dalla build. Solo dopo si passa al 3D, **fedele a quelle immagini**.
- **Concept scelta** (9 ott 2026, `assets/concept/corse/`, foglio `_FOGLIO_concept_corse.jpg`): Jack ha approvato tutte e 14 le immagini, senza niente da rifare.
  - **Look**: questa direzione. Colori saturi, pixel grossi, piste piene di dettagli.
  - **Hub**: tutte e due le immagini. `corse_01_hub` è la mappa dell'isola con le zone intorno; `corse_13_hub_arrivo` è il paese dei piloti al molo (garage, podio, statua del manichino col trofeo).
  - **Il metro di qualità è la Giungla** (`corse_08_giungla_miniera`): ogni zona deve arrivare a quel livello.
  - In gioco il 3D sarà più semplice delle illustrazioni: si prendono colori, densità, atmosfera e soggetti.
- **Asset misti**:
  - **piste e ambienti** da Blender via codice, con un kit per zona (`assets/blender/models_corse_<zona>.py`, sull'atlas come gli altri);
  - **veicoli buffi e animali** con l'AI 3D, poi ridotti allo stile PS1: pochi poligoni, palette, atlas.

## A10. Come si lavora con Jack
Le scelte di Jack arrivano a tre tappe, per ogni zona:
1. **Concept art**: Jack sceglie il look.
2. **Pista grezza giocabile**: Jack prova la forma.
3. **Pista finita**: Jack dà il voto.

Gli amici vedono **pezzo per pezzo**: ogni pista va online appena è giocabile.

## A11. Come funziona sotto (motore v2, fatto il 9 ott 2026)
Mappa del codice in `docs/CONTRACTS.md` §32. Per ora lo usa solo il banco di prova; il Gran Premio (Parte B) resta sul motore vecchio finché il circuito della Spiaggia non lo sostituisce.
- **La pista è un nastro 3D.** Il centro passa per i punti di controllo ed è campionato ogni metro. In ogni punto c'è il «sopra», che serve per sopraelevazioni, salite e giri della morte. Su ogni tratto si possono dare:
  - le **superfici** (asfalto, legno, erba, sabbia, ghiaccio, acqua, acqua bassa, corrente);
  - i **buchi** da saltare e i **bordi senza muro**, da dove si cade;
  - le **rampe** e i **tappeti del turbo**;
  - i **rami**, cioè le scorciatoie che lasciano la pista e la ritrovano;
  - gli **eventi firma**, che da un certo giro cambiano la superficie di un tratto.
- **Il veicolo vive in coordinate di pista**: avanzamento, scarto laterale, altezza. La guida è quella del Gran Premio (sterzo, presa, drift, turbo). In più:
  - la **pendenza** frena in salita e spinge in discesa;
  - i **dossi** presi forte fanno volare;
  - nei **giri della morte** si resta attaccati se si va almeno a 12 m/s;
  - chi **cade** riparte 25 m prima di dove era a terra, a mezza velocità;
  - le barche **saltano sulle creste delle onde** e, se atterrano dritte, prendono un po' di turbo.

  Solo + − × ÷ e radice, come prima: il replay del server coinciderà con la partita.
- **La guida divertente** (#170, dopo la prova di Jack del 9 ott: «sterzo esagerato, non capisco cosa cambi dal drift»). Ogni regola ha un interruttore A/B nel banco di prova (opzioni della gara, di serie accese):
  - **sterzo**: curva del joystick (al centro risponde piano), rampa da tastiera (arriva a fondo in 1/6 di secondo, torna più in fretta), e a tutta velocità sterza il 45 % in meno. Il drift no: **per stringere a tutta velocità serve il drift**;
  - **drift alla Mario Kart**: si parte col bottone DRIFT e il lato si sceglie entro 0,35 s (il saltello si vede); niente più drift automatico tenendo lo sterzo. Il kart va di traverso, la carica ha **3 livelli** con le scintille dalle ruote dietro, **blu → arancio → viola** (0,55 / 1,15 / 1,9 s; stringendo carica prima), e lasciando parte il turbo (0,55 / 1 / 1,6 s). Contro il muro la carica si perde. Col pilota automatico il drift fa guadagnare l'8 % sull'anello (79,0 s contro 85,7) e il 4 % sulla pista folle;
  - **turbo alla partenza**: conto alla rovescia 3-2-1 nella sim; tieni DRIFT premuto da quando compare l'1: da meno di 0,4 s al VIA è la **partenza razzo** (1,4 s di turbo), fino a 0,9 s una buona partenza (0,7 s); da prima il **motore si ingolfa** (fermo 0,8 s, fumo);
  - **acrobazie**: DRIFT premuto in aria → avvitamento e 0,8 s di turbo all'atterraggio (non sulle onde: lì c'è già il turbo dell'atterraggio dritto);
  - **scia**: 1,2 s dietro un avversario (2-12 m, in fila) → 1 s di turbo; vale anche per i bot;
  - **turbo sommati** alla Crash Team Racing: un turbo preso durante un altro si aggiunge (tetto 3 s).
  - Si vede e si sente: fiammate dal tubo, FOV che si allarga con un colpo quando parte il turbo, linee di velocità col turbo e nella scia, scossa negli atterraggi, suoni sintetizzati (motore, sgommata, «ding» per livello, turbo, semaforo).
- **Numeri** in `packages/content/src/corse/motore.json`:
  - 2 famiglie (Ruote, Acqua);
  - 6 veicoli: kart, auto sportiva, carrello della spesa, moto d'acqua, gommone, vasca da bagno;
  - le superfici, per famiglia;
  - i bot.

  I buffi hanno il loro difetto: il carrello tira a destra, la vasca sulla terra rallenta meno delle altre barche.
- **Come si fa una pista**: si scrive il percorso in `tools/corse_piste/<id>.mjs` con le mosse della tartaruga (dritto, curva, giro della morte, salto, scorciatoia…), poi `node tools/corse_piste.mjs --planimetria`. Escono il JSON in content e la planimetria in `tests/out/piste/`.
- **Banco di prova `provapiste.html`** (online accanto al gioco):
  - si guida su ogni pista col proprio veicolo, contro i bot o da soli;
  - si può far guidare il pilota automatico;
  - le camere si scelgono dal **menù ⚙ opzioni** (anche coi suoni): **dietro** (sui binari, resta dentro i giri della morte), **alta** e **primo piano** (bassa e vicina); la pista intera è la **minimappa** nell'angolo;
  - nel pannello «prove» si cambia la luce e si accendono e spengono le regole della guida (1-5) e gli effetti (6).

  Le piste di adesso sono 4 piste di prova del motore: l'anello, la pista folle (giro della morte, curva sopraelevata, salto, dosso, scorciatoia, ponte senza muri), la baia (acqua, corrente, secca) e la discesa (fuga da A a B).
- **Piste miste** (il Porto): una pista può avere più `famiglie` e una `corsia` per famiglia (scarto laterale, + = destra).
  - Il molo di legno e il canale d'acqua stanno affiancati nella stessa carreggiata larga: ognuno parte e guida nella sua corsia, e fuori dalla sua rallenta molto (barca sul legno ×0,3, ruote nell'acqua ×0,4).
  - I bot si alternano tra le famiglie (ruote, barca, ruote, barca) e partono nella corsia della loro.
  - Ogni famiglia ha la sua scorciatoia: un ramo con `famiglie: [...]` lo prendono solo quelle (anche i bot); le altre lo ignorano.
- **Scorciatoie che convengono**: un ramo può avere i suoi tappeti del turbo (all'imbocco). Tagliare una chicane da sola non basta: i metri risparmiati sono pochi, così la scorciatoia vale se ha il turbo o se salta un giro largo.
- **L'inseguitore** (l'onda della Fuga): un fronte che parte dietro la griglia e avanza da solo (`v0` che sale di `accel` fino a `vmax`), più veloce se ti stacchi oltre `distMax` (così non scappi: ti sta sempre dietro, ma lontano se guidi bene). Chi viene preso prende un colpo (velocità × `colpo`, una volta sola) e va a `rallenta` × il massimo finché il corpo dell'onda (`spessore` m) gli passa sopra; poi è dietro l'onda e riparte. Tocca anche i bot: i ritardatari vengono presi. Deterministico: solo + − × ÷, il replay del server coincide.
- **Superfici**: nuova `container` (tetto di lamiera: ruote veloci ma con poca presa), per l'evento dei container del Porto.
- **Bot in acqua**: `bot.bravuraFamiglia` (ruote 1, acqua 0,97). A 0,97 (misurato sulla Baia, sul Porto e sulla baia di prova) il pilota automatico con la moto d'acqua vince e la vasca da bagno arriva ultima. L'elastico dei bot li tiene vicini a chi guida, quindi il margine in acqua è di pochi decimi: va riletto quando cambiano le piste d'acqua.
- **Budget**: in gara 8-15 draw call e al massimo 55.000 triangoli a 390×844 (`tests/out/m4_provapiste.json`); il limite di `TECH.md` §5 è 150.000.
- **Le 4 piste della Spiaggia e porto** (grezze, giocabili sul banco di prova, 9 ott 2026; concept in `assets/concept/corse/`, confronto in `_FOGLIO_spiaggia_grezza.jpg`):

| Pista | Tipo · famiglia | Lunghezza · tempo del pilota automatico | Cosa c'è | Evento firma |
|---|---|---|---|---|
| **Lungomare** `spiaggia_lungomare` | circuito, 3 giri · ruote | 661 m · 90 s (kart) | rettilineo sul mare, tornante sopraelevato intorno al faro in salita, dosso, salto sul canale di scolo, tappeto del turbo, curve del paese | dal 3° giro l'**onda** copre mezza strada del rettilineo del mare (acqua bassa: rallenta, si passa dall'altra parte) |
| **Baia** `spiaggia_baia` | circuito, 3 giri · acqua | 771 m · 100 s (moto d'acqua) | onde su tutta la baia, turbo al via, tratto di corrente, canale stretto tra gli scogli, curva lunga con la secca, onda gigante (rampa) | dal 2° giro sale la **marea** e la secca diventa acqua (la curva si taglia) |
| **Porto** `spiaggia_porto` | circuito misto, 3 giri · ruote + acqua | 740 m · 95 s (kart), 100 s (moto d'acqua) | molo e canale affiancati, divisorio a righe gialle e nere, grande giro intorno al magazzino con la passerella (ruote) e il canale tra i container (barche), un tappeto del turbo per corsia | dal 2° giro le gru calano i **container** sul molo: i tetti di lamiera scivolano |
| **Fuga dall'onda** `spiaggia_fuga` | fuga A→B · ruote | 1.366 m (corsa 1.258) · 61 s (kart) | discesa dalla scogliera al faro, 100 m di rettilineo prima del via, curve ampie e due sopraelevate, il salto dove la ringhiera è crollata | l'**onda gigante** insegue (inseguitore); il kart del pilota automatico non viene mai preso, il carrello sì |

  La scorciatoia sulla sabbia del Lungomare, pensata all'inizio, è stata tolta: tagliare una chicane faceva perdere 0,6-2,7 s invece di farne guadagnare.
- **Da fare** con le zone:
  - le famiglie Due ruote e Scivoli e binari;
  - un pacchetto di asset per zona caricato all'ingresso, con la sua riga nel budget di `TECH.md` §5;
  - i fantasmi: gli input della gara migliore salvati sul server e rigiocati;
  - il bilanciamento per zona: in acqua i bot sono ancora un filo troppo deboli e la vasca vince.

## A12. Ordine di lavoro (fette di #155)
1. Questa bibbia.
2. Concept art di hub, zone, veicoli, manichini e animali piloti.
3. Motore v2: nastro 3D, famiglie Ruote e Acqua, bot sul nastro, evento firma, pagina di prova (**fatto**: `provapiste.html`).
4. **Zona Spiaggia e porto**: 4 piste, boss granchio, kit 3D, veicoli buffi, manichini, musica e suoni. Il primo circuito finito sostituisce il Gran Premio.
   - **4a. Le 4 piste grezze** (**fatto**, 9 ott 2026): Lungomare, Baia, Porto misto, Fuga dall'onda, giocabili su `provapiste.html?pista=spiaggia_…`. Il gioco non cambia ancora.
   - 4b. Vestire la zona: kit Blender, veicoli buffi e granchio campione, manichini, musica e suoni.
   - 4c. Il Lungomare al posto del Gran Premio (`garaCorse` nel registro, il server rigioca).
5. Hub alla Diddy Kong Racing: isola aperta, porta della Spiaggia, garage, le altre porte chiuse.
6. Fantasmi, stelle e sblocchi, premi per MAREA.
7. Zone 2-6 con la stessa catena di montaggio.

## A13. Da decidere
- Lore e cattivo.
- In quali gare ci sono gli oggetti.
- Sfide extra in pista.
- I boss animali delle zone 2-6.
- Quante stelle apre ogni porta.
- Gare dal vivo (più avanti, forse).

# Parte B — Il Gran Premio di oggi (fetta 1, #156)

## B0. In tre righe
Un'isola con il format delle **corse arcade alla Mario Kart**: kart, camera dietro al veicolo, drift che carica il turbo, 3 giri contro 4 bot. Si gioca da telefono (il gas è automatico, un pollice sterza) e da PC (frecce/WASD + Spazio). Il server rigioca la gara e paga il premio come per gli altri minigiochi.

## B1. Storia
Nessuna per ora **[scelta provvisoria]**. Il circuito si chiama «Anello del Faro». I bot si chiamano Gabbiano, Granchio, Polpo e Delfino.

## B2. Dove sta e come si apre
- Nell'arcipelago a `[215, 18]` (nord-est, tra i Ghiacci e la Tempesta), stile `corse`.
- Sblocco `{ tipo: 'libera' }`: è **aperta a tutti**, anche senza link personale **[scelta provvisoria]**.
- Il posto del gioco è l'**arco del via** sull'anello d'asfalto dell'isola (cella `[22, 26]`): lì compare **GIOCA · GRAN PREMIO**. Si arriva dal molo a sud.

## B3. L'isola
- **Nel mondo:** isola verde col prato rasato a strisce, un anello d'asfalto con la riga tratteggiata, la riva a cordoli bianchi e rossi, una collinetta in mezzo, l'arco del via a scacchi col semaforo, due tribune col pubblico, pile di gomme, due kart parcheggiati e le bandierine.
- **La pista vera** è una scena a parte (come la chiesa dei Templari): 580 m di anello levigato con 12 m di carreggiata, 3 m di prato e il muretto di gomme a bande. Intorno ci sono tribune sul rettilineo, gomme all'esterno delle curve, palme e il mare.

## B4. La partita
1. Scegli la **guida** (MORBIDA, MEDIA o NERVOSA): è la prova A/B di Jack e il gioco si ricorda l'ultima scelta.
2. **VIA!** → semaforo 3-2-1 → 3 giri.
3. Si parte **ultimi** in griglia, dietro ai 4 bot.
4. All'arrivo conta la **posizione**: 1° oro, 2° argento, 3° bronzo, 4° e 5° niente medaglia (ma la consolazione di `balance.solo`).
5. Il punteggio per il tabellone dei record è il **tempo**: `30000 − centesimi`, più alto vince.

Il tempo massimo è 240 s: chi non arriva non prende medaglia.

Con la guida media una gara pulita dura ~1:24 (giro ~27 s). Chi va a mezzo gas e non fa il drift arriva ultimo in ~2:35.

## B5. Controlli
| | Telefono | PC |
|---|---|---|
| Sterzo | joystick (al 70% della corsa è già pieno) | A/D o ← → |
| Gas | automatico | automatico |
| Freno / retro | joystick giù o FRENO | S / ↓ |
| Drift | **DRIFT** tenuto in curva, oppure sterzo tutto da una parte per 0,35 s (parte da solo) | Spazio tenuto, oppure sterzo tenuto |
| Uscire | Ritirati | Esc |

Nella scelta della guida il PC usa 1/2/3 e Invio.

## B6. Guida (i numeri)
- **Niente fisica vera.** Il kart ha un muso, una direzione del moto e una velocità:
  - lo sterzo gira il muso (fino a `sterzo` rad/s, pieno sopra `sterzoPieno` m/s);
  - la **presa** porta il moto verso il muso: bassa = scivola.
- **Prato** = velocità × 0,55.
- **Muro** = rimbalzo, velocità × 0,7, e si striscia lungo la pista. Il muro chiude le scorciatoie.
- **Drift:**
  - gira sempre verso il lato del drift, ×0,7 dello sterzo a sterzo dritto;
  - sterzando dalla stessa parte stringe (fino a ×1,3), controsterzando allarga (fino a ×0,1);
  - la presa in drift è bassa, per questo il kart va di traverso.
- **Turbo:** la carica decide il livello.
  - carica ≥ 0,8 s = turbo 1, 0,5 s;
  - carica ≥ 1,6 s = turbo 2, 1,2 s;
  - il turbo dà +30% di velocità massima.
  - Scintille: bianche mentre carichi, gialle al livello 1, rosa al livello 2.

| Guida | Velocità | Accelerazione | Sterzo | Presa | Presa in drift | Drift |
|---|---|---|---|---|---|---|
| Morbida | 19 m/s | 11 | 1,9 | 14 | 5 | ×1,25 |
| Media | 20 m/s | 14 | 2,25 | 10 | 3,5 | ×1,35 |
| Nervosa | 21 m/s | 17 | 2,7 | 7 | 2,5 | ×1,45 |

## B7. I bot
- Guidano con la guida media, a una frazione della velocità massima (97,5 / 95,5 / 93,5 / 91,5%), senza drift.
- Ognuno segue la sua **corsia**, che ondeggia piano, puntando un punto 6 m + 0,35 s davanti.
- **Elastico leggero:**
  - se sono davanti a te rallentano (−0,04% al metro, fino a −6%);
  - se sono dietro spingono (+0,03% al metro, fino a +5%).
- I kart che si toccano si spingono via e quello dietro perde l'1,5%.

## B8-B9. Pista e griglia
- Il centro della pista è in `pista.punti`: 18 punti, levigati con Catmull-Rom e campionati ogni 2 m.
- Griglia: 2 file da 2 bot a −5 e −11 m dal via; tu da solo a −17 m.
- Il progresso si misura lungo la pista: chi torna indietro perde giro.

## B10. Premio
`balance.solo` (10 partite premiate al giorno) più **+20 Legno** per l'oro (`premioExtra`). La gara entra nel **diario** (pagina Medaglie: «Oro ovunque» ora vuole anche il Gran Premio) e nel **tabellone dei record** del Porto, che mostra tempo e posizione (es. «1:23,4 · 1°»).

## B11. Audio
Solo i suoni che esistono già **[scelta provvisoria]**:
- `bip` per il semaforo;
- `via` alla partenza;
- `boa` a ogni giro;
- `arrivo` o `fine` alla fine.

Da fare: motore, sgommata del drift, turbo.

## B12. Da decidere
- Quale guida tenere di serie (prova di Jack), o se lasciarle tutte e tre come scelta. Le fette successive stanno in A12.

## B13. Come funziona sotto
Mappa del codice in `docs/CONTRACTS.md` §31.
- **Sim** `packages/sim/src/minigames/corse.ts`: solo + − × ÷ e radice quadrata, come dungeon e Templari, perché il replay del server coincida con quello di Safari. È un `MinigameModule` normale, registrato nel registro dei minigiochi. Il server lo rigioca col giro «da solo» (`/api/solo/start` · `/api/solo/play`), senza rotte nuove e senza migrazioni.
- **Client:** chunk `apps/client/src/corse/` (scena sua, camera dietro al kart) aperto da `game/minigiochi.ts` come gioco nel mondo (`SchermoGioco` con `step`/`update`).
