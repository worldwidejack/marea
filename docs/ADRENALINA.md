# MAREA — Isola dell'Adrenalina (GDD dell'isola)

> Parte del GDD (`GDD.md` §3, §6 e §14 rimandano qui). Isola a tema **per tutti**, proposta da **birbasan** il 10 ott 2026; issue madre #189. Non è un'isola personale: entra con l'**ok di Jack** (10 ott 2026). Nasce da una bozza di decisioni presa in chat; le scelte che la bozza non diceva le ha prese Claude e sono segnate **[scelta provvisoria]**.
> **14 ott 2026** (`VISIONE.md` §4): l'Adrenalina probabilmente si unisce all'Isola delle Corse. Finché Jack non conferma, le discese restano qui; il lavoro nuovo va pensato per poter traslocare nell'hub delle Corse.
> Numeri: andranno in `packages/content/src/adrenalina/` e in `packages/content/src/minigames/<gioco>.json` (uno per gioco). Le tabelle qui sono la **prima ipotesi**; cambiarli = aggiornare qui, col perché nella PR.

## 0. In tre righe
Un'isola che è quasi tutta una montagna: neve in cima, bosco a metà, scogliere sul mare. Una **funivia** dal molo porta in vetta, e da lì scegli come buttarti giù: **snowboard**, **bici downhill** o **lancio col paracadute**. Discese brevi (60-120 s) contro il **fantasma** del record di un amico, con una barra **Adrenalina** che moltiplica i punti di chi rischia.

Sta dentro il pilastro 2 del GDD («30-120 secondi, un pollice, si capisce in 3 secondi»): le discese sono minigiochi veri, non dungeon. Adrenalina vera, niente roba da bambini, ma **non si muore mai**: chi cade fa una caduta buffa, perde qualche secondo e riparte.

Riferimenti: *Riders Republic* (una montagna con tante discipline), *Lonely Mountains: Downhill* (low-poly, camera alla diorama), *Cool Boarders* e *Jet Moto* (il sapore PS1).

## 1. Perché è diversa dalle Corse
L'Isola delle Corse (`docs/CORSE.md`, #155) ha già una zona di neve, le bici da cross tra i veicoli e i fantasmi degli amici. Le due isole non si pestano i piedi:

| | Corse | Adrenalina |
|---|---|---|
| Con cosa | veicoli (auto, moto, barche, bob) | il tuo corpo: tavola, bici, paracadute |
| Contro chi | 4 animali piloti più i fantasmi | **solo** i fantasmi degli amici, niente bot |
| Cosa conta | arrivare primo | punti: porte, salti, **trick** e rischio (barra Adrenalina) |
| Durata | 3 giri, ~1:30 | una discesa da 60-120 s |
| Dove | le porte dell'isola, piste a nastro | una montagna sola, ogni gioco è un modo di scenderla |

Il **sistema dei fantasmi** è uno solo per le due isole: lo scrive chi arriva prima (§8).

## 2. Dove sta e come si apre
- **Posizione** **[scelta provvisoria]**: a **nord-ovest**, tra la Selvaggia (`[14, 30]`) e i Ghiacci (`[120, 16]`), alla cella `[64, 10]` dell'arcipelago (38×38 celle: più piccola delle prime ipotesi perché da lì si vedono anche Selvaggia, Ghiacci e il lotto 1, e i triangoli hanno un tetto, `TECH.md` §5). La bozza la metteva a nord tra Ghiacci e Tempesta, ma lì dal 9 ott c'è l'Isola delle Corse (`[208, 13]`). A nord-ovest resta a nord, accanto ai Ghiacci (la neve sta bene vicino alla neve) e lontana dal giro iniziale come le altre isole a tema.
- **Sblocco: liberatoria e casco.** Ci sbarchi sempre (barriera 0, come il Vulcano), ma al **cancello della funivia** il guardiano non ti fa salire:
  - la prima volta ti fa **firmare una liberatoria** ironica: «Il parco declina ogni responsabilità per ossa rotte, orgoglio ferito e Perle perse.» FIRMA e basta, una volta sola (resta nel lotto);
  - poi ti fa salire **solo col casco in testa**. Senza casco: «Senza casco qui non sale nessuno.»
  - Il **casco** è un cappello nuovo, il tredicesimo di GDD §4: si compra a **35 Perle** dall'editor come la Lanterna (lo vende anche il Mercante, ma non è un suo esclusivo), arancione con la striscia bianca e la visiera scura. Prezzo e aspetto si possono ancora cambiare. Lo sblocco è un tipo nuovo, `funivia`: firma più cappello, ma niente cacciata come al Vulcano.
- **Per le prove** (`?adrenalina=1` nell'indirizzo): liberatoria già firmata, casco non richiesto, e un bottone 🚡 nella barra in alto che porta subito al cancello della funivia. Il premio resta quello vero.
- **Dal passo 3b** (12 ott 2026) con firma e casco al cancello si sale in funivia e si scende con lo snowboard: aperto a tutti.

## 3. L'isola
Un picco solo, da guardare dalla barca come un cartello: «qui si scende».

| Zona | Cosa c'è |
|---|---|
| **Molo e stazione a valle** | il molo, la biglietteria di legno col guardiano, il cancello, la cabina rossa della funivia, il cartello delle piste con i colori |
| **Scogliere** | rocce a strapiombo sul mare sul lato nord, dove atterra chi si lancia |
| **Bosco** (a metà) | abeti, sentieri di terra battuta, tronchi e passerelle: le piste della bici |
| **Vetta** (innevata) | la stazione a monte, le piste della neve che partono a ventaglio, la piattaforma del lancio sul bordo |

Nel mondo l'isola si vede in piccolo, con la funivia che sale e scende. Le **discese si giocano in una scena a parte** (come i dungeon, i Templari e le gare delle Corse): la montagna vista da vicino, con la sua camera, così la velocità si sente e il resto dell'arcipelago non paga il costo. Sali in funivia (pochi secondi, la vista dall'alto), scegli il gioco e la pista al cartello della vetta, scendi, e torni in vetta per un'altra o giù al molo.

## 4. Le discese
- **Formato dei minigiochi** (GDD §6, `packages/sim/src/minigames/`): modulo puro e deterministico, `create/step/result/autopilot`, il server rigioca gli input e paga le medaglie. Punteggio «più alto vince».
- **Durata**: 60-120 s a discesa. Niente modalità lunga.
- **Piste fisse disegnate a mano**, non generate dal seed: un record vale solo se la pista è sempre la stessa, e il fantasma si rigioca sulla stessa identica pista. Il seed decide solo i dettagli (il vento del lancio, la neve che si alza).
- **Colori come sulle piste da sci**: verde → blu → rossa → nera per ogni gioco. Al primo giro c'è la verde; le altre si aprono con le medaglie (§9). Lo **snowboard** invece ha tre piste, **blu, rossa e nera, aperte da subito**: si sceglie la difficoltà in vetta. La nera del lancio è la **wingsuit**.
- **Non si muore mai.** Cadere (contro un albero, un atterraggio storto, un'apertura troppo tardi) = animazione buffa, **2 s** persi **[scelta provvisoria]**, barra Adrenalina a zero, riparti dal punto della caduta.
- **Cartello delle regole** di 3 s in italiano all'inizio, come ogni minigioco.

## 5. Controlli
Un pollice basta; sul PC tastiera.

| | Telefono | PC |
|---|---|---|
| Curvare | trascini a destra e a sinistra (da dove hai toccato) | A/D o frecce |
| Saltare (snowboard) | tieni il dito giù (ti accucci e carichi), lo alzi sul bordo del trampolino | tieni e lasci Spazio |
| Trick in aria | un colpo veloce col dito: su = mortale avanti, giù = indietro, di lato = 360 | frecce in aria |
| Presa (snowboard) | in aria tieni il dito fermo; lo alzi prima di toccare terra | Spazio tenuto in aria |
| Scatto (bici) | tocco | Spazio |
| Paracadute | tocco = apri | Spazio |

## 6. Barra Adrenalina
Il marchio dell'isola, uguale in tutti i giochi. **[scelta provvisoria]** sui numeri:
- Si riempie quando **rischi**: passi rasente a un albero o a una roccia, fai un salto lungo, chiudi un trick all'ultimo, apri il paracadute tardi, voli basso in wingsuit.
- Tre gradini: **×1** (vuota), **×2** (a metà), **×3** (piena) sui punti che fai mentre è su.
- **Cadi e si azzera.** Se non rischi per qualche secondo cala piano.
- Sta sempre nello stesso posto dello schermo, con lo stesso colore e suono in tutti e tre i giochi.

## 7. I giochi (primo giro)

### Snowboard (le piste della neve, dalla vetta)
Trascini per curvare tra le **porte** (bandierine a coppie), lasci sul **trampolino** per saltare, in aria un gesto = **trick**. Atterrare dritto chiude il trick; atterrare storto è una caduta. Punti: porte passate, salti, trick (più trick nello stesso salto valgono di più), tutto per la barra. Una porta saltata toglie punti, non ferma la discesa. È il primo gioco che si fa (passo 3): se non diverte ci si ferma e si corregge prima degli altri.

Deciso da birbasan il 12 ott 2026 (bozza del passo 3, fatto al **3a**):
- **Guida arcade** (Cool Boarders, SSX): niente gas, spinge la pendenza; la velocità di lato è pronta; una curva larga tiene la velocità, una stretta frena (è il modo di controllarla). Fuori dal bordo la **neve fresca** rallenta; oltre, tra gli alberi (o contro la roccia nella gola) si cade. Contro un albero cadi solo se ci vai proprio addosso; passarci **rasente** riempie la barra.
- **Salto**: tieni premuto e ti accucci (carichi); lasci e salti. Sul trampolino conta quando lasci: proprio sul bordo è il **salto grande** (riempie la barra); se non lasci voli lo stesso, ma basso.
- **Trick**: quattro gesti (mortale avanti, indietro, 360 a destra e a sinistra), uno dopo l'altro nello stesso salto (**combo**: ogni trick in più vale il 50 % in più del primo). La **presa**: in aria tieni premuto senza muovere il dito (PC: Spazio); vale punti finché tieni. Toccare terra ancora in presa o a metà di un trick = atterraggio storto, una caduta. Chiudere all'ultimo istante riempie la barra.
- **Tre piste: blu, rossa, nera**, sempre più difficili (la verde non c'è più: era la prima, ora è la blu), tutte dalla stessa vetta, ~1 minuto ciascuna col pilota automatico, in tre parti a tempo: **un quarto di porte** (vicine e sfalsate, da prendere curvando, su una pista che curva a sinistra, a destra e gira attorno alla montagna), **un tratto corto di salti** senza porte (la **cornice** da cui ci si butta nel **muro**, il **canalino** stretto tra le rocce coi **salti di neve** larghi quanto lui, il trampolino), **metà nel bosco**: il **fuoripista** (un abete cade di traverso sulla pista battuta, sbarrata da una transenna a strisce; la deviazione a sinistra la annunciano la scritta «↰ Deviazione a sinistra» 60 m prima e cartelloni arancio con le frecce; poi un sentiero di neve alta che serpeggia tra gli abeti, curve strette una dopo l'altra, abeti a filo da rasentare e altri in mezzo da scansare) fino allo striscione a scacchi. Dalla blu alla nera: più ripida (fino a ~25 m/s), porte più fitte e più strette (blu 7 larghe 5,5 m, rossa e nera 9 larghe 4,6 e 3,9 m), salti più alti, sentiero più stretto (4,2 → 3,1 m) e più veloce (17 → 20 m/s) con più abeti e qualche roccia in mezzo. Generate da `tools/adrenalina_piste.mjs` (una scheda per pista). Il **limite del bosco** è alla cornice. Il bosco vero, coi sentieri di terra, resta alla bici (passo 5). Quando un tracciato cambia la pista sale di `versione` e classifica e fantasma ripartono da zero; ogni pista ha la sua classifica e il suo fantasma.
- **Attorno, le Alpi dipinte a pixel**: un panorama a 360° (Dolomiti al tramonto) dipinto da un'IA di immagini sopra un modellino delle montagne e portato nelle regole del gioco (pixel grossi, solo colori della palette, nearest: `assets/adrenalina/panorama.png`), su un cilindro che segue la camera. Gli abeti sono sagome a pixel dello stesso dipinto (16 texel/m, `abeti.png`) che guardano la camera; il terreno resta a tinta unita a facce piatte. `?dipinto=0` mostra il modellino e gli abeti a coni.
- **Salti naturali e botta**: su un dosso o un bordo (la cornice, la roccia) a velocità ci si stacca da soli, come nella realtà (restare attaccati vorrebbe più della gravità: v² × curvatura). Su un pendio ripido si atterra morbidi; in piano da troppo in alto (oltre 17 m/s contro la neve, lungo la sua normale) è una caduta («atterraggio troppo duro»).
- **La neve che si muove**: la scia della tavola e la polvere che si alza dalla coda (di più in curva e nella neve fresca), la nuvola quando atterri o cadi.
- **Numeri** (`snowboard.json`, `barra.json`; prima ipotesi, si fissano giocando): gravità 9,81 m/s² (vera), aria 0,0082 (in discesa ripida ~22 m/s, 80 km/h), velocità massima 26 m/s, neve fresca 7 m/s, fuoripista 16 m/s, stacco 0,9 × g, botta 17 m/s; porta +100, porta mancata −150, salto 40 punti per metro d'altezza, mortale 400, 360 250, presa 250 al secondo (minimo 0,2 s); barra: rasente +10 %, palo della porta +8 %, salto grande +20 %, salto lungo (oltre 1,2 s) +12 %, ultimo istante +15 %, cala dell'8 % al secondo dopo 3 s senza rischi; ×2 da metà, ×3 piena.
- **Camera: la A** (scelta da birbasan il 12 ott), fatta come una follow cam: chi filma scende sul pendio 10 m dietro di te, la camera 2 m sopra la sua neve, guarda giù verso di te e oltre; l'orizzonte resta dritto, nei salti si alza un po' con te, più vai forte più si apre l'inquadratura. La B (dall'alto) è stata tolta.

### Bici downhill (le piste del bosco)
Stessi comandi; il tocco è lo **scatto** (un colpo di pedale, poi qualche istante per ricaricare). Sentieri stretti tra gli abeti, radici, passerelle, salti sui dossi. Qui il fantasma conta più che altrove: è una gara contro il tempo dell'amico, con i punti del rischio sopra.

**Banco di prova** `provadiscesa3d.html` (#229, 11 ott 2026; mappa del codice in `CONTRACTS.md` §41). Jack: «un video come sfondo in lontananza, il resto restano modelli». Vicino è tutto 3D: bici pilotabile (pendenza che spinge, sterzo che dipende dalla velocità, piega in curva, salti, scossoni sulle radici, sassi da schivare, cadute da 2 s), sentiero dalla cresta sul mare al bosco di abeti, pezzi del kit Blender `cs_d_*`. Lontano un panorama dipinto (ChatGPT) animato in loop (Kling, 15 crediti) su una sfera che segue la camera. Due camere: occhi col manubrio e dietro bassa col ciclista. Tutto passa dalla stessa passata pixel del gioco. Numeri in `packages/content/src/corse/discesa/bici.json` **[prima ipotesi]**.

### Lancio dalla vetta (dalla piattaforma sul bordo)
Ti butti: **caduta libera** negli **anelli** sospesi (trascini per centrarli), il terreno sale. **Tocco = apri il paracadute**: più tardi lo apri, più punti; **troppo tardi** = atterraggio buffo sul prato o in mare sotto le scogliere, pochi punti, non si muore. Sotto il paracadute guidi verso il **bersaglio** d'atterraggio. La **wingsuit** è la pista nera: volo rasente alle rocce in un canyon, la barra si riempie quanto più stai basso.

## 8. I fantasmi degli amici
> **Fatto per lo snowboard al passo 3b** (birbasan, 12 ott 2026): scendi contro il fantasma di chi ha il **miglior tempo** sulla pista (la sua discesa rigiocata coi suoi input, semitrasparente, coi suoi colori e il nome sopra; in alto il distacco in secondi). Classifica e input sul server (DO `Sfide`, tabella `discese`). Restano da fare: scegliere il fantasma di un amico al cartello, e le Corse sullo stesso sistema.

- Nessun bot. In pista corri contro la **replica trasparente** del record di un amico su quella pista: è il suo log di input rigiocato nella sim (lo stesso log che il server già usa per controllare il punteggio).
- Di serie il fantasma è quello del **migliore** del gruppo su quella pista; al cartello si può scegliere un amico.
- I record per pista stanno sul server (come il Tabellone dei record del Porto, GDD §5), con gli input del migliore di ciascuno.
- **Uno solo per Corse e Adrenalina**: le Corse li hanno in programma alla fetta 6 (#155). Chi arriva prima scrive il sistema comune; l'altra isola lo usa.

## 9. Premio e sblocchi
- Ogni discesa paga a medaglie come gli altri minigiochi delle isole a tema: `balance.solo` più un **oro in più** (`premioExtra`), con lo stesso tetto di partite premiate al giorno. **[scelta provvisoria]**: +15 Pietra all'oro.
- **Medaglie col fantasma del record** (birbasan, 12 ott 2026, passo 3b; al posto della frazione del pilota automatico): la classifica di ogni pista è a **tempo finale** (il miglior tempo di ciascuno del gruppo). Se batti il fantasma del primo è **oro**, secondo **argento**, terzo **bronzo**, più giù niente. Se non c'è nessuno davanti (la prima discesa della pista) sei primo: **oro**.
- **Tempo con abbuoni** (come SSX): tempo finale = tempo della discesa − abbuoni + penalità. Porte, salti, trick e presa fanno punti (per la barra Adrenalina) e i punti diventano secondi di abbuono (**1 s ogni 1.000 punti**); una **porta mancata +2 s**; una caduta costa già i suoi 2 s. All'arrivo: tempo, abbuoni, tempo finale, posto in classifica, medaglia, premio.
- **Sblocchi delle piste**: una medaglia d'**argento** su una pista apre quella del colore dopo dello stesso gioco **[scelta provvisoria]**.

## 10. Camera
Scelta il 12 ott 2026: la **A**, come una follow cam dei video di freeride (§7). Era da scegliere tra:
- **A**: alle spalle, bassa e veloce (più adrenalina);
- **B**: dall'alto in diagonale come *Lonely Mountains* (più MAREA, più leggibile sul telefono).

## 11. Audio
Suoni nostri e sintetizzati (motore di `apps/client/src/audio/`, zero file), al passo 8: il **vento che sale con la velocità**, la neve sotto la tavola, la catena e i freni della bici, lo schiocco della vela del paracadute che si apre, e una **musica tesa** che sale con la barra Adrenalina.

## 12. Da decidere (non bloccano)
- **Casco**: aspetto e prezzo finali (la proposta è in §2).
- **Camera**: al passo 3 (§10).
- **Dopo il primo giro** (`BACKLOG.md`): tuffo dalla scogliera, moto d'acqua (riusa la barca), parapendio, zipline, bungee.

## 13. Come funziona sotto (per chi programma)
- **Un modulo per gioco** in `packages/sim/src/minigames/` (`snowboard.ts`, `downhill.ts`, `lancio.ts`), registrato come gli altri (al 3b, come le Corse con un `registra.ts` che importa solo il server: il registro finisce nel JS iniziale): il server paga dal solito giro dei minigiochi (`/api/solo/start`, `/api/solo/play`), rigiocando gli input. Le regole di `packages/sim` valgono tutte (niente trascendenti, `trig.ts`).
- **Piste in content**, non nel seed: `packages/content/src/adrenalina/piste/<gioco>_<colore>.json` (tracciato, porte, salti, anelli, ostacoli). La sim le legge; il seed cambia solo i dettagli.
- **Barra Adrenalina** come pezzo comune ai tre moduli (stessa logica, stessi numeri da content).
- **Scena a parte** nel client in un **chunk** suo caricato all'ingresso della funivia, con la sua riga nel budget di `TECH.md` §5.
- **Fantasmi** (passo 4): record e input del migliore per pista sul server; se serve una tabella nuova, migrazione D1 col numero successivo. In comune con le Corse (§8).
- **Sblocco** (fatto al passo 2): tipo nuovo `funivia` in `archipelago.json` (`cappello` e `liberatoria`), firme in `LotState.liberatorie`, `POST /api/adrenalina/liberatoria`. La funivia e il cancello sono un chunk a parte (`game/adrenalina_funivia.ts`), come le decorazioni dell'isola (`render/island_adrenalina.ts`): il JS iniziale ha un tetto. Dettagli in `CONTRACTS.md` §39.

## 14. Piano di lavoro (issue madre #189, una PR per passo, ognuna online)
1. **Documenti**: questo file, GDD §3 §6 §14, ROADMAP §Deviazioni, BACKLOG. **Ok di Jack** (fatto, 10 ott 2026).
2. **Isola** (fatto, 10 ott 2026): la montagna (vetta innevata, bosco, scogliere), molo, funivia con le cabine che vanno su e giù, posizione a nord-ovest, lucchetto; il casco e il cancello con la liberatoria; `?adrenalina=1`. Le piste ancora no: con firma e casco il guardiano dice che aprono a giorni.
3. **Snowboard completo**, diviso in due PR (bozza del 12 ott 2026):
   - **3a** (fatto, 12 ott 2026): la pista verde col fuoripista, la tavola, la barra Adrenalina, le cadute, la scena a parte e la camera A/B, solo con `?adrenalina=1` (alla funivia, firma e casco già a posto, si scende). Serve a vedere se diverte; se no ci si ferma e si corregge.
   - **3b** (fatto, 12 ott 2026): medaglie col fantasma del record e classifica a tempo con abbuoni (§9, birbasan), premio dal server (`balance.solo` + 15 Pietra all'oro), il viaggio in funivia fino alla vetta, il cartello delle piste in vetta (blu, rossa, nera, bici e lancio col lucchetto), il cartello delle regole e 3-2-1, il tuo avatar vero col casco sulla tavola, la scheda d'arrivo con «Ancora», «In vetta», «Al molo»; aperto a tutti con firma e casco.
4. **Fantasmi degli amici**: record per pista sul server, il fantasma in pista. *Per lo snowboard fatto col 3b (il fantasma del primo); restano la scelta di un amico al cartello e le Corse.*
5. **Bici downhill**.
6. **Lancio dalla vetta** (paracadute; la wingsuit come pista nera).
7. **Piste blu, rossa e nera** per i tre giochi e sblocchi a medaglie.
8. **Audio**.
