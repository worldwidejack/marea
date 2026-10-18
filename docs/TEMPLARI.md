# MAREA — Isola dei Templari (GDD della modalità a ondate)

> Parte del GDD (`GDD.md` §3, §6 e §13 rimandano qui; vale come il GDD). Isola personale di **birbasan**, tema libero con l'ok di Jack (8 ott 2026). Nasce dalla bozza di decisioni presa in chat; le scelte che la bozza non diceva le ha prese Claude e sono segnate **[scelta provvisoria]**.
> Numeri: tutti in `packages/content/src/templari.json`. Le tabelle qui sono la **prima ipotesi**; cambiarli = aggiornare qui e una riga in `ROADMAP.md` §Deviazioni.

## 0. In tre righe
Un'isola maledetta a sud dell'arcipelago: chiesa templare in rovina al centro, borgo abbandonato attorno, cimitero, accampamento pirata sulla spiaggia. Porti la **reliquia** all'altare e i Templari morti si svegliano: **ondate infinite** di crociati zombie alla Call of Duty Zombies, con punti per comprare armi, aprire porte e accendere trappole. Muori → esci; più ondate superi, più Legno, Pietra e Perle porti a casa.

**Eccezione al GDD §1** (pilastro 2, «30-120 secondi»): una partita dura quanto sopravvivi (10-40 minuti). È voluta: è l'isola di chi vuole una sfida lunga. Resta facoltativa (come i dungeon), si gioca con un pollice e anche chi muore all'ondata 2 porta a casa qualcosa.

## 1. La storia
**Vera** (la si racconta nel biglietto e nei cartelli):
- 13 ottobre **1307**: Filippo IV il Bello fa arrestare tutti i Templari di Francia in una notte. Nel **1312** papa Clemente V scioglie l'ordine.
- 18 marzo **1314**: il Gran Maestro **Jacques de Molay** è bruciato sull'isola della Senna davanti a Notre-Dame. Dal rogo, dice la tradizione, cita re e papa davanti a Dio entro l'anno: Clemente muore ad aprile, Filippo a novembre.
- La **flotta templare** di La Rochelle sparisce nel 1307 e non se ne sa più niente. Il tesoro dell'ordine non fu mai trovato.
- Dal **1795** cercatori di tesori scavano il «Money Pit» di Oak Island; molte teorie lo legano ai Templari.

**Nel gioco**: gli ultimi Templari fuggono per mare col tesoro dell'ordine. Una nave si sfascia sugli scogli della Tempesta (il relitto sotto il faro); le altre approdano su un'isola a sud, costruiscono una chiesa e aspettano. La maledizione del rogo li fa risorgere: chi tocca l'isola diventa uno di loro. Secoli dopo arrivano pirati e cacciatori di tesori per il tesoro dei Templari: zombificati anche loro, o morti lasciando le armi (ecco perché sull'isola ci sono pistole e moschetti). Nella chiesa aspetta **de Molay** in fiamme. Gli zombie gridano «**Deus vult!**».

## 2. Dove sta e come si apre
- **Posizione**: a sud del Porto, tra il Giardino e il Vulcano (cella `[156, 240]` dell'arcipelago, ~48×44 celle). Lontana dal giro iniziale, come le altre isole a tema.
- **Aperta a tutti** (dal 10 ott 2026, scelta di birbasan: «il calice è troppo sbatti»): niente nebbia, niente lucchetto, come le Corse. Si arriva, si entra in chiesa e le ondate partono subito.
- **Il calice** (fino al 10 ott era lo sblocco, ora resta come storia da trovare): il **calice dei Templari** (scelto da birbasan: d'oro coi rubini, forse il Graal). Sta sull'**Isola della Tempesta**, sotto il faro, accanto al **relitto della nave templare** (lo scafo spaccato sugli scogli, la vela bianca con la croce rossa, una cassa che luccica): lo tiene in grembo lo **scheletro di fra' Guillaume**, sergente del Tempio, col mantello stracciato e il **biglietto** che racconta la fuga da La Rochelle e indica la rotta (libeccio, tra la montagna di fuoco e il giardino). Il calice luccica e un fascio di luce lo segnala da lontano; in bussola c'è il «Relitto» finché non è tuo. **A** vicino (o PRENDI IL CALICE) lo prende e apre il biglietto, che poi si rilegge. Il server lo mette nel lotto (`POST /api/templari/reliquia`, `LotState.reliquie`), ma non apre più niente.
- **Avvio**: entri nella chiesa (porta sul lato ovest, ENTRA) e le ondate partono subito (partita `subito`, il calice è già sull'altare). Ogni volta che rientri si ricomincia dall'ondata 1. La fase «posa il calice sull'altare» resta nella sim solo per i test.
- **Stanza di prova** (`?net=0&templari=banco`, 13 ott 2026): appena si apre il gioco si è nella chiesa, senza server, e a destra c'è il **banco di prova**: scegliere l'ondata, far uscire uno zombie davanti (fante, pirata, scudato, cannoniere, cavaliere, de Molay), prendere un'arma, +5000 punti, via gli zombie, immortale, ondate ferme, zombie fermi, rallentatore ×¼, camera vicina, e «Vai da» Mercante o Strega (porte aperte). Solo per guardare: la partita non va mai al server.
- **Per le prove** (`?templari=1` nell'indirizzo): l'isola è aperta, l'altare funziona senza reliquia e nella barra in alto ci sono due bottoni: **⚔** porta subito nella chiesa con le ondate già partite, **⛪** a piedi sull'isola davanti alla porta della chiesa (con la barca ormeggiata al molo). Il premio resta quello vero (stesso tetto giornaliero).

## 3. L'isola
Si gioca in una scena a parte (come i dungeon): l'isola vista da vicino, camera diorama a 45° come sotto terra. Il tetto della chiesa è crollato (si vede dentro dall'alto); i muri dalla parte della camera sono diroccati e bassi.

| Zona | Cosa c'è | Come ci arrivi |
|---|---|---|
| **Chiesa di Santa Maria del Tempio** | tre stanze: la **rotonda** (la navata: giro di colonne col tamburo di archi, i sarcofagi dei cavalieri con la statua distesa, panche rovesciate, l'altare laterale con l'**arco**), il **coro** (presbiterio e abside con l'altare maggiore, stalli, arazzi rossi, candelabri, la **trappola del rogo**; lo separa dalla rotonda un tramezzo col crocifisso e un passaggio di 3 m) e la **sacrestia** (assito, armadi dei paramenti, tavolo coi calici, un posto della cassa; porta dal coro); finestre sbarrate con le vetrate sopra, muri con le armi da comprare; fuori dalla porta nord la **campana** | si parte nel coro; sacrestia **750** |
| **Piazza del borgo** | case diroccate, pozzo, carretti, la cassa del tesoro (a volte) | porta ovest della chiesa, **750** |
| **Cimitero** | tombe da cui escono gli zombie, ossario | porta nord della chiesa, **1000** |
| **Taverna del Teschio** | banconi e botti, **pistola a pietra focaia** sul muro | dalla piazza, **750** |
| **Accampamento pirata** | tende, falò, cannoni sulla spiaggia, **moschetto** e **trombone** abbandonati | dalla taverna o dal cimitero, **1250** |

Zombie e punti di comparsa si accendono zona per zona: finché una porta è chiusa, da lì non entra nessuno.

**Riferimenti storici** (ricerca del passo 6; la scena li segue in piccolo, a pixel):
- **Chiesa**: le chiese dei Templari copiano il Santo Sepolcro di Gerusalemme, una rotonda e a est il coro con l'abside, come la [Temple Church di Londra](https://en.wikipedia.org/wiki/Temple_Church) (il giro di colonne, le lastre dei cavalieri sul pavimento) e la [Vera Cruz di Segovia](https://en.wikipedia.org/wiki/Iglesia_de_la_Vera_Cruz,_Segovia) (l'edicola al centro: da noi il braciere). Sopra le colonne il tamburo di archi della [charola di Tomar](https://www.portugalvisitor.com/portugal-attractions/convent-christ). Sui muri le dodici [croci di consacrazione](https://en.wikipedia.org/wiki/Consecration_cross) rosse in un cerchio. Ai lati del coro due stendardi [Beauceant](https://en.wikipedia.org/wiki/Baucent), bianco sopra e nero sotto con la croce rossa (come nell'affresco di San Bevignate a Perugia). I cavalieri vestono il mantello bianco con la croce rossa, i sergenti il nero o il marrone.
- **Borgo**: l'isola è nel Mediterraneo; Riccardo Cuor di Leone vendette [Cipro ai Templari nel 1191](https://en.wikipedia.org/wiki/Gastria_Castle). Le case sono alla cipriota, di pietra e mattoni crudi, intonaco chiaro e coppi: ora diroccate, senza tetto, con l'uscio buio e qualche fila di tegole rimasta.
- **Cimitero**: le tombe dei cavalieri sono lastre con la croce e la spada incise (le [cross slab](https://bosburyhistoryresource.org.uk/BosburyTemplars1.html) medievali), quelle della gente croci di pietra o di legno; in fondo l'ossario dove finivano le ossa delle fosse riaperte ([charnel house](https://archaeology.co.uk/articles/features/rothwell-charnel-chapel-the-nameless-dead.htm)), attorno i cipressi.
- **Accampamento pirata**: la nave tirata in secca su un fianco per pulire lo scafo (il carenaggio, [alle Cayman per esempio](https://www.caymancompass.com/1984/10/19/when-cayman-was-a-lair-for-pirates)), la griglia di legno sul fuoco per affumicare la carne, il *boucan* che dà il nome ai bucanieri, la bandiera nera col teschio, i cannoni puntati al mare.

## 3b. L'isola dipinta (16 ott 2026, scelta di birbasan, #370)
Dentro le ondate l'isola non è più a blocchi colorati: sopra i blocchi c'è un **dipinto realistico** (pietra consumata, lastre, erba secca, sabbia, tende rattoppate), proiettato con la tecnica dei matte painting del cinema (*projection mapping*). Eroi, zombie, porte, assi, campana, fiamme e personaggi restano i modelli di sempre.
- **Come si fa il dipinto**: la camera diorama ha sempre la stessa direzione (45° e 45°), quindi una camera ortografica da quella direzione fotografa i pezzi fermi di tutta l'isola (`__dipinto.foto()` con `?dipinto=prova`, 4050×3070). La foto si taglia in 9 tasselli che si sovrappongono; ognuno lo ridipinge un'IA di immagini (Codex, `image_gen`) con lo stesso testo e il primo dipinto della chiesa come riferimento di stile; ogni tassello si riallinea ai blocchi (prima scala e spostamento, poi a pezzi di 24 px seguendo i bordi) e si cuciono sfumando le sovrapposizioni. Risultato: `apps/client/public/assets/templari/dipinto_isola.webp` (1,2 MB) e `dipinto_isola_m.webp` per il telefono (0,4 MB). Gli script stanno fuori dal repo (sul computer di birbasan, `MAREA/dipinti/strumenti`); se l'isola cambia forma, il dipinto va rifatto.
- **Nel gioco** (`templari/dipinto.ts`): il dipinto è il colore delle facce che la camera della foto vedeva (una mappa di profondità dalla stessa camera; quello che sta dietro un muro e si scopre con la finestra sull'eroe resta coi colori di prima). La luce del gioco resta. In più **ombre cotte** all'ingresso: la luna (mappa di profondità dalla sua direzione) e tutte le luci ferme (bracieri, candele, rogo, fuochi, camino; una cube map di distanze ciascuna, copiata in un atlas «a ottaedro»; non la lanterna dell'eroe né le luci che si muovono). E il tono **cupo**: dipinto più spento, cielo e ambiente più bassi, così l'isola la illuminano i fuochi.
- **Telefono**: dipinto, profondità e ombre a metà risoluzione (~25 MB di texture invece di ~100). Nessuna draw call in più (61 nella stanza di prova, come prima).
- **Prove**: `?dipinto=0` l'isola a blocchi di prima (coi test, `?test=1`, è spenta se non si chiede `?dipinto=1`: su SwiftShader lo shader rallenta le prove a tempo); `?dipinto=prova` i tasti P (dipinto), L (ombre), K (cupo 0/1/2) e `window.__dipinto` (foto, vista da un punto, uniform a mano).

## 4. La partita
- Si parte con la **spada arrugginita** e **500 punti**, all'altare.
- **Ondate infinite**: in ogni ondata compare un numero fisso di zombie, mai più di **10** insieme alla prima, uno in più a ogni ondata fino a **24** dalla 15ª (§12b; prima 18 fissi); ucciso l'ultimo, **10 secondi** di respiro (jingle, «Ondata 4») e poi la prossima. Gli zombie diventano più resistenti a ogni ondata (sotto) e più veloci: alle prime camminano, dalla 4ª qualcuno corre, dalla 8ª molti scattano.
- **Vita** 100, si rigenera dopo 4 s senza colpi. Un fante toglie 45: tre colpi di fila e sei a terra.
- **Morte** = fine (da solo; insieme si resta a terra fino all'ondata dopo, §10b): «SEI CADUTO ALL'ONDATA N», la scheda col premio (lo conferma il server) e sei di nuovo davanti alla chiesa. Riprovi o vai via.
- **Alba**: dopo **60 minuti** la partita finisce da sola («È L'ALBA»): sei sopravvissuto, vale l'ondata a cui sei arrivato.
- **Punti**: +10 a colpo a segno, +60 a uccisione, +100 se l'uccisione è in mischia; +10 ad asse rimessa su una finestra (fino a 200 per ondata). Si azzerano a ogni partita: le risorse di MAREA non c'entrano, arrivano solo col premio finale.

**Vita degli zombie** (come COD): 150 all'ondata 1, +100 a ondata fino alla 9 (950), poi ×1,1 a ondata (ondata 10 ≈ 1050, 15 ≈ 1680, 20 ≈ 2700, 30 ≈ 7000).

| Ondata | Zombie | Ogni quanto ne entra uno |
|---|---|---|
| 1 · 2 · 3 · 4 · 5 | 6 · 9 · 11 · 14 · 17 | 2,0 s, poi −0,08 s a ondata (minimo 0,5) |
| n | 6 + 2,6·(n−1) + 0,06·(n−1)², al massimo 80 | |
| insieme (§10b) | × (1 + 0,5 · (giocatori − 1)): in 2 una volta e mezza, in 4 due volte e mezza | |
| in campo insieme (§12b) | 10 all'ondata 1, +1 a ondata, al massimo 24 (dalla 15ª); in squadra × come sopra: in 4 fino a 60 | |

## 4b. Gli eroi: il menù d'ingresso (14 ott 2026, scelte di birbasan)
Jack l'ha provata: «bella ma non c'è niente da fare». Primo passo della risposta: prima di entrare si **sceglie l'eroe**, come in Destiny la classe e come il veicolo nel menù delle Corse. Sono **3 eroi, pochi ma diversi**: è sempre il **tuo avatar di MAREA** (pelle, capelli, faccia) con il **vestito dell'eroe** e la sua arma in mano. Ognuno ha **4 barre** (vita, forza, velocità, mira: solo da vedere), un'**arma di partenza** e un **super** alla Destiny che si carica uccidendo. In squadra ognuno sceglie chi vuole (anche quattro uguali).

| Eroe | Vestito | Parte con | Vita | Velocità | Più forte con | Super (18 uccisioni) |
|---|---|---|---|---|---|---|
| **Il Crociato** | elmo chiuso, tunica bianca con la croce rossa, maglia | spada + **scudo templare sulle spalle** | **150** | ×0,94 | mischia: danno ×1,25 | **Giudizio**: pianta la spada, chi sta entro 4 m prende 1,5 × la vita dell'ondata (lo scudo dello scudato non para) e vola via di 2,5 m; 1,2 s intoccabile |
| **La Bucaniera** | tricorno, giacca rossa coi bottoni d'oro, stivali | pistola a pietra focaia + spada | 100 | ×1,12 | armi da fuoco: danno ×1,25, ricarica ×0,65 | **Bordata**: tre cannonate dalla nave in fila lungo la mira (2,2 m l'una dall'altra, la prima dopo 0,6 s, poi ogni 0,3 s), raggio 2,6, 1,2 × la vita dell'ondata |
| **L'Arciere** | cappuccio e tunica verdi, giubba e faretra di cuoio | arco + spada | 100 | ×1,04 | archi: danno ×1,3, si tende in ×0,7 | **Pioggia di frecce**: per 4 s un cerchio di 3,2 m dove miri, 0,9 × la vita dell'ondata al secondo a chi ci sta sotto |

- **Il super**: ogni uccisione dell'eroe (colpi suoi, frecce e palle sue) riempie 1/18 dell'anello; le fiamme, le trappole, i power-up e il super stesso no. Pieno brilla e si usa col bottone **SUPER** (telefono, a sinistra sopra il joystick) o **R** (PC: va dove punta il mouse). Bersaglio senza mira: lo zombie in vista più vicino davanti, sennò davanti a te. Il danno segue la vita dell'ondata, così il super serve a ogni ondata; i boss ne perdono una fetta.
- **Vita e pozioni**: la Zuppa di pietra dà +100 sulla vita dell'eroe (Crociato 250); cadendo si torna alla vita dell'eroe.
- **Il menù** (`apps/client/src/templari/scelta.ts`): una cripta a lume di candela con gli stendardi, la pedana di pietra con l'anello bianco e nero e la croce rossa, l'eroe che gira piano; a sinistra le tre carte, a destra il pannello (nome, frase, barre, super, armi di partenza), sotto il bottone giallo **DEUS VULT** (insieme: **IN SALA**). Frecce, A D o W S, joystick = cambia; Invio/Spazio = parte; Esc o ✕ = di nuovo fuori. L'ultimo eroe resta (localStorage `mz-templari-eroe`). Al telefono in verticale l'eroe sta in alto, sotto carte, pannello e bottone.
- **Server**: l'eroe va con `POST /api/templari/start {subito, classe}` e resta nel lotto (`pending.classe`); a fine partita il server rigioca con lui. Insieme si sceglie prima di entrare in sala (`/ws/templari?classe=`), la sala lo dice accanto al nome e il log della squadra lo porta (`classi`).
- **Stanza di prova**: niente menù, l'ultimo eroe scelto; nel banco «Eroe (si ricomincia)» e «Super: carica pieno».
- **Prossimi passi** (scelte del 14 ott): ~~accendere l'isola, costruire la campana coi pezzi~~ (fatto: §9b), ~~segreti (stanza dietro il muro con l'arma da guadagnare uccidendo 5 zombie lì dentro, campane in ordine, canzone dei 3 teschi)~~ (fatto: §9c), la forgia della spada di de Molay (§12b, scelta il 18 ott), missioni durante le ondate, la missione finale e la fuga in nave; tra le partite vestiti nuovi e trofei sul lotto. Il **secondo giro** (18 ott: bilanciamento, spiaggia, catacombe, indizi, nemici nuovi, forgia) è nel §12b.

## 5. Controlli
- **Mira** (passo 9): niente attacco automatico, colpisci solo quando premi. Il joystick (o WASD) appena sfiorato ti gira sul posto senza muoverti; da PC, se non cammini, l'eroe guarda il puntatore del mouse e il clic attacca lì. La spada colpisce davanti a te; archi e armi da fuoco senza mira vera aiutano solo dentro un cono stretto (~35°) davanti: fuori dal cono il colpo va dritto dove guardi. **Mira vera** (12 ott 2026, #244, la stessa del dungeon: arco e magie): con arco, pistole, moschetto, trombone o fuoco greco in mano **il colpo va esattamente dove punta il cursore** (anche mentre cammini, anche fuori dal cono, anche se c'è uno zombie più vicino); il cursore diventa un mirino e davanti all'eroe c'è la linea di mira. L'arco teso segue il cursore e la freccia parte dove punta al rilascio. Il vaso del fuoco greco cade sul primo zombie lungo la mira, sennò a 3/5 della gittata. Senza mouse né joystick di mira vale la mira assistita di prima. **Arco**: tieni premuto per tendere (più tendi, più fa male), lascia per tirare. **Pistole e moschetto**: un tocco = un colpo, a caricatore vuoto ricaricano da sole (le munizioni si comprano sul muro). **Fuoco greco**: un tocco lancia il vaso dove guardi.
- **Telefono**: joystick (spinto fino in fondo = corsa, 5 s di fiato), bottone grande **A** (attacca; con un'arma a distanza in mano al suo posto c'è il **joystick di mira**: arco = tieni per tendere, trascina per puntare, lascia per tirare; pistole, moschetto, trombone e fuoco greco partono **al rilascio**; un tocco veloce senza trascinare spara come prima, assistito), **AZIONE** (compra, apri, prendi, ripara, accendi: il bottone dice cosa e quanto costa), **SCAMBIA** (le due armi), **SCUDO** (se ce l'hai).
- **PC**: WASD/frecce, Spazio, E o clic = attacca (tenuto = giro caricato), **F** = azione (tenuto per riparare), **Q** = scambia (lo scudo in mano è la terza «arma»), **R** = super (§4b), Shift = corsa, Esc = pausa. Un clic più corto di un fotogramma vale lo stesso (almeno un tick premuto).
- **Mira automatica di serie**: ogni colpo si gira verso lo zombie più vicino davanti a te, e con **AUTO** acceso (di serie) l'eroe attacca da solo quando ne ha uno a tiro: basta il joystick. **A MANO** (dalla pausa): attacchi solo quando premi, così non sprechi frecce e colpi.

## 6. Armi
Due armi alla volta (come COD): una nuova prende il posto di quella in mano. Le armi «da muro» si comprano dove sono disegnate col gesso; comprarle di nuovo lì ricarica le munizioni a metà prezzo. Danni pensati sulla vita degli zombie: ogni arma uccide con un colpo fino a un'ondata, poi «fatica».

| Arma | Dove | Prezzo (munizioni) | Danno | Ritmo | Colpi | Un colpo fino all'ondata |
|---|---|---|---|---|---|---|
| Spada arrugginita | in mano all'inizio | — | 250 | 0,55 s | ∞ | 2 |
| Arco | altare laterale della chiesa | gratis (frecce 150) | 450 a corda tesa | tende 0,6 s | 20 + 40 | 4 |
| Mazza ferrata | muro della chiesa | 750 | 700, spinge indietro | 0,8 s | ∞ | 6 |
| Ascia danese | muro della chiesa | 1000 | 1000, colpo largo | 1,0 s | ∞ | 9 |
| Pistola a pietra focaia | muro della taverna | 1000 (500) | 900 | ricarica 1,4 s | 1 + 30 | 8 |
| Moschetto | accampamento | 1500 (750) | 1400, trapassa 2 | ricarica 2,2 s | 1 + 24 | 13 |
| Trombone | accampamento | 1500 (750) | 7 pallini × 250, cono corto | ricarica 2,0 s | 1 + 20 | 15 (da vicino) |
| Arco lungo | cassa | — | 1400, trapassa | tende 0,8 s | 30 + 60 | 13 |
| Martello da guerra | cassa | — | 1600, caricato = giro | 1,1 s | ∞ | 14 |
| Pistola doppia | cassa | — | 2 × 1100 | ricarica 1,8 s | 2 + 40 | 11 |
| **Fuoco greco** (miracolosa) | cassa, rara (1 apertura su 60) | — | **0,6 ×** la vita dell'ondata in 3 m + fiamme (0,1 × al secondo per 3 s) | lancio 0,8 s | 6 + 12 | mai: sempre due vasi |
| **Spada maledetta di de Molay** (miracolosa) | solo forgiandola (§12b punto 7) | — | **1 ×** la vita dell'ondata + scia di fuoco (0,2 × al secondo per 2 s) | 0,5 s | ∞ | un fante sempre, un cannoniere mai |
| **Lancia di Longino** (miracolosa, §9c) | altare della cripta, dopo 5 anime | — | **0,8 ×** la vita dell'ondata a punta, trapassa la fila, +10 vita a uccisione; caricata: affondo di 3 m | 0,6 s | ∞ | mai: sempre due affondi |

- **Bilanciamento** (13 ott 2026, alla Black Ops, test `templari_bilancio`): più un'arma costa, più a lungo uccide con un colpo (spada 2, muro da 750-1000 tra la 5 e la 10, muro da 1500 e cassa tra la 10 e la 16, miracolose oltre la 20). Moschetto (prima 2000, un colpo fino alla 17) e trombone (prima 7 × 350, fino alla 19) erano troppo forti per 1500 punti. **Secondo giro** (18 ott, §12b): le miracolose non hanno più un danno fisso (erano 3000, 6000 e 5000: un colpo fino alla 21ª, 29ª e 26ª) ma una fetta della vita dell'ondata, come i super, così servono a ogni ondata senza cancellarla; il test controlla che dall'ondata 5 in su nessuna basti da sola.
- **Ricarica**: da sola quando il caricatore è vuoto (A col caricatore vuoto la fa partire). Le armi da fuoco tirano anche fuori dalle finestre, agli zombie che strappano le assi.
- **Cassa del tesoro templare** (= mystery box; dal secondo giro solo il fuoco greco tra le miracolose, §12b): **950** punti, gira 4 s e tira fuori un'arma a caso da prendere entro 10 s (tutte tranne la spada e quelle che hai già; pesi in `templari.json`: l'unica miracolosa è il fuoco greco, 1 apertura su 60; la spada di de Molay e la Lancia dalla cassa non escono). Ogni 4-8 aperture esce il **teschio** (la leggenda del teschio dei Templari): la cassa ride, ti rende i punti e sparisce, per ricomparire in un altro dei suoi posti (per ora due nella chiesa; con le porte anche piazza, cimitero, accampamento). Un fascio di luce gialla la fa trovare.

## 7. Scudo templare
Cade dal **templare scudato** quando muore (resta a terra 20 s: A per prenderlo). Lo porti **sulle spalle**: blocca i colpi da dietro. Con **SCUDO** lo **impugni** al posto dell'arma: blocca i colpi da davanti, cammini piano e con A dai una spallata (poco danno, li respinge). Regge **1500** danni, poi si spacca; se ne prende un altro dallo scudato successivo.

## 7b. Mercante e Strega (13 ott 2026, scelte di birbasan)
Due personaggi **fuori dal campo**, sul bordo: ci parli da vicino con **AZIONE**, che apre il loro menù (la partita intanto va avanti, come in COD). Ogni acquisto è un'azione registrata col tick (`TAzione` «compra»), il server la rigioca. Codice: `sim/templari/bottega.ts`, numeri in `templari.json` (`mercante`, `strega`), disegni in `client/templari/personaggi.ts`, menù in `bottega_ui.ts`.
- **Il Mercante** (veneziano, sulla sua cocca ormeggiata davanti alla **spiaggia**: ci arrivi tardi, come al Pack-a-Punch; 'D' nella mappa). Vende **munizioni piene per qualsiasi arma**, anche quelle della cassa (prezzo del muro; cassa 750, miracolose 2000; arma potenziata ×2, anche sul muro) e **potenzia** l'arma: **5000 punti**, una volta per arma: danno ×2 (miracolose ×1,5), caricatore ×1,5, riserva ×2, ricarica ×0,75, munizioni piene e nome nuovo (Spada del Tempio, Ascia dei Variaghi, Moschetto di La Rochelle, Trombone del Kraken, Gemelle di Tortuga, Fuoco di Bisanzio…); la lama diventa d'oro. Un colpo fino all'ondata: spada 2→4, mazza 6→13, ascia 9→16, pistola 8→15, moschetto 13→20, trombone 15→22, arco lungo 13→20, martello 14→21, pistola doppia 10→17; mai oltre la 23 per le armi normali.
- **La Strega** (nella capanna oltre la staccionata in cima al **cimitero**, col calderone verde: ci arrivi presto, porta da 1000; 'F' nella mappa). Pozioni (zuppe, brodi, infusi), **al massimo 4** insieme; berla dura 1,1 s (non attacchi), prezzi di Black Ops:

| Pozione | Come in COD | Effetto | Prezzo |
|---|---|---|---|
| Zuppa di pietra | Juggernog | vita 100 → 200 (reggi 4 colpi del fante invece di 2) | 2500 |
| Brodo del viandante | Stamin-Up | +20% velocità, fiato doppio | 2000 |
| Infuso lesto | Speed Cola | ricarica e arco teso ×0,6 | 3000 |
| Grappa del bombardiere | Double Tap | armi da fuoco, archi e vasi: danno ×1,3, tempo tra due colpi ×0,75 | 2000 |
| Elisir del risorto | Quick Revive | quando cadi ti rialzi con la vita piena, 3 s intoccabile, zombie spinti a 3 m; perdi tutte le pozioni; al massimo 3 per partita | 1500 |
| Acqua di fonte santa | (nostra) | la vita torna dopo 1,5 s invece di 4, il doppio più in fretta | 2500 |

- **Economia** (test `templari_bilancio`): anche uccidendo tutto con la spada e rifacendo tutte le assi, alla fine della 4ª ondata non hai i punti per arrivare alla spiaggia e potenziare, e alla fine della 5ª non hai quelli per il cimitero e quattro pozioni; giocando bene ci arrivi tra la 7ª e la 12ª.

## 8. Nemici e boss

| Nemico | Da quale ondata | Vita (× la vita dell'ondata) | Velocità | Colpo | Carattere |
|---|---|---|---|---|---|
| **Fante crociato** | 1 | ×1 | cammina 1 m/s, corre 2,2, scatta 3,6 (sempre di più con le ondate) | 45 | tunica bianca con la croce rossa a pezzi, grida «Deus vult!» |
| **Pirata zombie** | 3 | ×0,6 | 4,2 m/s | 30 | veloce e fragile, tricorno e sciabola |
| **Templare scudato** | 6 (al massimo 1 alla 6 e alla 7, poi +1 ogni due ondate, fino a 8) | ×1 | 1,4 m/s | 50 | lo **scudo davanti** prende i colpi (da ~53° in qua) e regge 3/4 della vita dell'ondata, poi si spacca e lui è scoperto; da dietro e di lato colpo pieno; morto con lo scudo intero lo lascia a terra (13 ott 2026: prima era immune da davanti con vita ×1,5, col trombone servivano 4 caricatori) |
| **Cannoniere pirata** | 12 | ×1,2 | 1,6 m/s | bomba 50 in 2,2 m | resta a 8 m e lancia bombe col cerchio a terra |
| **Templare a cavallo** (mini-boss) | **5, 15, 25…** (da solo con pochi fanti); dalla 20 anche nelle ondate normali | ×12 | carica a 7 m/s | 70 | enorme, gualdrappa con la croce, lancia; si annuncia col corno e la terra che trema |
| **Jacques de Molay** (boss) | **10, 20, 30…** | ×25 | 2,4 m/s | 40 + palle di fuoco | cavaliere in fiamme, lascia scie di fuoco a terra; **a metà vita scappa ridendo** (+500 punti e un power-up). Si uccide davvero solo nel finale dell'easter egg (da decidere) |

## 9. Power-up, porte, barricate, trappole
- **Power-up** (2,5 % a uccisione, al massimo 4 a ondata; i boss ne lasciano sempre uno, de Molay quando scappa; 25 s a terra e lampeggiano negli ultimi 5; si prendono passandoci sopra; se lo zombie muore fuori, il power-up cade dentro, dove arrivi): **Faretra piena** (munizioni piene a tutte le armi) · **Ira di Dio** (30 s, ogni colpo uccide, i boss no) · **Campane a martello** (muoiono tutti gli zombie in campo, i boss no, +400) · **Decima** (30 s punti doppi) · **Muratori** (tutte le finestre rifatte, +200). Quelli a tempo si vedono sotto la vita coi secondi che restano.
- **Porte**: macerie o cancelli con il prezzo sopra (AZIONE vicino); aperte una volta, restano aperte per tutta la partita e accendono le comparse della loro zona. Prezzi nella tabella del §3; la spiaggia ha due porte (dalla taverna e il cancello dal cimitero, **1250** l'una): basta una.
- **Barricate**: ogni finestra ha 5 assi. Uno zombie davanti ne strappa una ogni 1,2 s; a zero entra. Tu le rimetti tenendo AZIONE (una ogni 0,6 s, +10 punti).
- **Trappole** **[scelta provvisoria]** (AZIONE alla leva, 1000 punti, 25 s accese, poi 60 s per ricaricarsi; la leva rossa in su = pronta). Chi ci passa muore, ma **senza punti** (come in COD); i boss perdono vita (300 al secondo nel rogo, 500 sotto la campana). Tu ti fai male se ci stai dentro: 15 ogni mezzo secondo nel rogo, 60 a ogni passaggio della campana (ogni 1,2 s).
  - **Rogo** nella navata: l'incensiere rovesciato accende la passatoia rossa del presbiterio (il rogo di de Molay). Leva accanto agli stalli a sud.
  - **Campana** sul passaggio verso il cimitero, appena fuori dalla porta nord: la campana grande appesa all'incastellatura oscilla e falcia chi passa. Leva dentro, accanto alla porta nord.

## 9b. Accendere l'isola e montare la campana (14 ott 2026, scelte di birbasan)
Secondo passo della risposta a Jack, come la corrente e i pezzi da costruire di COD Zombies: cose da fare sulla mappa oltre a sparare.
- **Tre fuochi** (grandi bracieri di pietra con la croce): spenti hanno la brace fredda, un filo di fumo e un fascio di luce pallida che li fa trovare. Si accendono tenendo **AZIONE** per **1,5 s** (gratis; lasciare prima = si ricomincia; il bottone ha la barra che si riempie, da PC «tieni F»).

| Fuoco | Dove | Cosa accende |
|---|---|---|
| **Il fuoco del coro** | in chiesa, accanto agli stalli a sud (due passi dalla partenza) | il **rogo**: la leva funziona solo col fuoco acceso |
| **Il fuoco del cimitero** | in cima al cimitero, accanto alla capanna | la **Strega** si sveglia (prima dorme: calderone freddo, niente pozioni) |
| **Il falò dei pirati** | nell'accampamento sulla spiaggia | la **nave del Mercante** attracca (prima è al largo: niente munizioni né potenziamenti) |

  Tutti e tre accesi: **+1000 punti** e un power-up a due passi.
- **La campana da montare**: la campana della trappola è **a terra**, sdraiata accanto all'incastellatura, e la leva dice «pezzi 0/3». I tre pezzi — **la corda**, **il battaglio**, **il perno** — stanno ognuno in uno dei suoi tre posti, diverso da partita a partita (dal seed): la corda in sacrestia, in taverna o all'accampamento; il battaglio nel cimitero, sul sagrato della piazza o sulla spiaggia; il perno sulla spiaggia, in piazza o nel cimitero. Girano a terra col fascio giallo; **AZIONE** li prende (sono della squadra). Con tutti e tre, **AZIONE tenuto 2 s** alla leva monta la campana, che si appende: da lì la trappola funziona come prima (1000 punti, 25 s).
- **HUD**: sotto la vita «🔥 1/3 · 🔔 2/3» (montata: «🔔 montata»).
- **Mappa**: `I` `O` `U` i fuochi, `c` `d` `f` i posti dei pezzi (`tools/templari_mappa.mjs`, che controlla che si raggiungano). Numeri in `templari.json` (`fuochi`, `campana`).
- **Stanza di prova**: nel banco «Isola»: accendi i fuochi, prendi i pezzi, vai a un pezzo.

## 9c. I segreti: la cripta, le campane in ordine, la canzone dei teschi (15 ott 2026, scelte di birbasan, #338)
Terzo passo della risposta a Jack: gli easter egg di COD Zombies, nostri. Tutto nella sim (`sim/templari/segreti.ts`), della squadra (insieme valgono per tutti), deterministico: il server rigioca uguale. Numeri in `templari.json` (`cripta`, `campanelle`, `teschi`, l'arma `lancia`).

**La cripta sotto la chiesa.**
- **Il muro crepato**: nel muro nord-ovest della rotonda, accanto all'ascia sul muro, crepe scure e due sassi ai piedi (si nota, ma non troppo). Si rompe con un **colpo pesante** (scelta di birbasan): un colpo caricato in mischia (il giro tenuto, o l'affondo caricato della Lancia), un'esplosione (fuoco greco, la bomba di un cannoniere), una cannonata della Bordata o il Giudizio. Il colpo normale fa solo **polvere** e la scritta «La pietra suona vuota… ci vuole un colpo più forte»: è l'indizio.
- **Rotto**: un buco nel pavimento coi gradini che scendono nel nero. Entrandoci si arriva in fondo alla **cripta**: una sala buia a colonne con otto sarcofagi, torce sui muri, l'altare a ovest e la scala a est (entrandoci si torna in chiesa). Dentro la luna e il cielo si spengono: resta la lanterna dell'eroe, le torce e la luce dell'altare.
- **Gli zombie ti seguono**: scendono e salgono dalla stessa scala, e con un eroe nella cripta ne escono di nuovi dai sarcofagi (le comparse della cripta si accendono col muro rotto).
- **L'altare della Lancia**: la Lancia di Longino sta distesa sopra l'altare, legata da quattro catene, con una luce viola; il bottone dice «L'altare è sigillato: anime N/5». Ogni zombie ucciso **dentro la cripta** manda la sua anima all'altare (vola a scatti, una candela si accende; HUD «✝ anime N/5»). Con **5 anime** le catene cadono, la luce diventa d'oro, un fascio la fa vedere: **AZIONE la prende**. Insieme ognuno può prendere la sua; chi ce l'ha già non la vede più sull'altare.
- **La Lancia di Longino** (miracolosa, scelta di birbasan fra tre proposte): mischia lunga **3,5 m** a punta (l'affondo della lancia del dungeon), **trapassa tutti quelli in fila**, danno **0,8 × la vita dell'ondata** (due affondi per un fante a ogni ondata; prima 5000, un colpo fino alla ~26ª, §12b), ogni uccisione ti ridà **10 di vita**; **caricata** l'affondo ti porta avanti di **3 m** prendendo chi trovi. Il Mercante la potenzia in «Lancia del Destino».

**Le campane in ordine.** Quattro **campanelle** su un palo, una per zona: la **croce** nella rotonda (accanto alla tomba di un cavaliere), il **teschio** nel cimitero, l'**ancora** sulla spiaggia, la **luna** in piazza accanto al pozzo; ognuna ha il suo simbolo sul cartello e la sua nota. L'**ordine** è scritto in rosso sul muro nord della **taverna** (numeri romani I-IV e i simboli) e cambia da partita a partita (dal seed, con un rng a parte). **AZIONE** la suona: giusta = un passo avanti («🔔 2/4»), sbagliata = stona e **si ricomincia** dalla prima. Tutte e quattro giuste: **una pozione che non hai, gratis, a ognuno della squadra in piedi**, anche oltre il limite di 4 (scelta di birbasan; l'Elisir no se è finito). **Una volta per partita**: dopo le campanelle tacciono.

**La canzone segreta.** Tre **teschi** piccoli e pallidi in angoli bui: dietro una casa della piazza, nell'angolo della taverna, dietro l'ossario del cimitero. **AZIONE tenuto 1,5 s** (come i fuochi, «tieni F»; lasciare prima = si ricomincia); dopo il primo l'HUD conta «☠ N/3». Al terzo parte la **canzone segreta**, l'«**Inno dei crociati**» (scelta di birbasan): originale, scritta nota per nota e suonata dal nostro motore sintetizzato (`client/audio/inno.ts`, zero file): Re minore che chiude in Re maggiore, 72 bpm, 30 battute (~100 s): l'organo e il coro che mormora, il tema cantato dal coro (Rem Si♭ Fa Do | Rem Solm La La), gli ottoni con la seconda melodia e i timpani, il tema di nuovo con tutti e le campane, il finale in Re maggiore con la campana grande. Poi torna la musica delle ondate.

- **Mappa** (`tools/templari_mappa.mjs`, che controlla che il muro tocchi solo la chiesa, che la cripta sia staccata da tutto e che campanelle, indizio e teschi si raggiungano): `Z` il muro crepato, `H` la scala della cripta, `P` l'altare, `n` le comparse della cripta, `7 8 9 0` le campanelle, `B` l'indizio, `i l !` i teschi. La cripta sta nell'angolo nord-ovest, staccata: il muro rotto e la scala sono i due capi della stessa scala.
- **Stanza di prova**: nel banco «Segreti»: rompi il muro, nella cripta, anime 4/5, all'altare, l'indizio, la prossima campanella, il prossimo teschio, la canzone.
- **Draw call**: dal coro coi boss si era già al limite (98-101 su `main`), quindi campanella, indizio e teschi non si vedono da lì; nella cripta candele e torce stanno in due InstancedMesh e si accendono solo per chi è dentro.

## 10. Premio
Lo calcola il **server** rigiocando la partita (come i dungeon): per ogni **ondata superata** (quella in cui muori non conta) **15 Legno, 8 Pietra, 2 Perle**, fino all'ondata 30. **Tetto giornaliero** (giorno UTC): **600 Legno, 300 Pietra, 60 Perle** in tutto; oltre, si gioca per il record. Il premio entra nel Magazzino fino al suo tetto, come quello dei minigiochi.

| Ondate superate | Legno | Pietra | Perle |
|---|---|---|---|
| 1 | 15 | 8 | 2 |
| 5 | 75 | 40 | 10 |
| 10 | 150 | 80 | 20 |
| 20 | 300 | 160 | 40 |

Il **record** (ondata più alta) resta nel lotto e si vede nella scheda finale.

## 10b. Insieme (14 ott 2026)
Fino a **4 amici nella stessa chiesa**, come COD in cooperativa. Alla porta, accanto a ENTRA, c'è **GIOCA INSIEME**: chi lo preme entra nella sala; con almeno 2 chiunque dice **SI PARTE** e si entra tutti, con le ondate già partite.
- **Ognuno ha il suo eroe** (il suo avatar, le sue armi, il suo scudo, le sue pozioni); sopra la testa degli altri il nome e la vita. Gli zombie vanno verso l'eroe in piedi più vicino ed escono a turno vicino a ognuno.
- **Punti a testa** (birbasan, 15 ott, dopo la prima partita in due; prima erano in comune): ognuno parte coi suoi 500 e si fa i suoi, come in COD. I punti di un colpo o di un'uccisione vanno a chi l'ha fatta (anche con frecce, palle, fuoco greco, Bordata e Pioggia di frecce), quelli delle assi a chi ripara (tetto di 200 a ondata per ciascuno). **Chi compra paga lui**: porte, armi sul muro, cassa, trappole, Mercante e Strega. L'arma della cassa la può prendere solo chi l'ha aperta, e il teschio rende i punti a lui. **A testa** (ognuno prende tutto): Campane a martello +400, Muratori +200, tutti e tre i fuochi accesi +1000, de Molay che scappa. Sopra la testa dei compagni nome e punti; il «+60» che sale è solo per i tuoi.
- **Più zombie** (scelta di birbasan, come COD): ogni giocatore in più aggiunge metà degli zombie dell'ondata (tabella del §4), e di quanti ce ne possono essere in campo insieme (§12b: in 4 fino a 60). La vita degli zombie non cambia.
- **Chi cade resta a terra** (niente rianimazione per ora) e **si rialza all'inizio dell'ondata dopo**, in chiesa, con la vita piena e **l'arma di partenza del suo eroe** (§12b, 18 ott: prima teneva le sue armi): perde le armi comprate o trovate, lo scudo raccolto da uno scudato (il Crociato riprende il suo, nuovo), i potenziamenti e le **pozioni** (come in COD). La Lancia si riprende all'altare della cripta con **altre 5 anime**. L'Elisir del risorto ti rialza subito come da solo. La partita finisce quando **non resta nessuno in piedi** («SIETE CADUTI»), all'alba, o quando escono tutti.
- **Niente pausa**: il menu non ferma la partita (il tuo eroe sta fermo). Uscire dal menu lascia gli altri a combattere.
- **Linea persa** (15 ott 2026, #326; prima la partita si chiudeva con «Connessione con la squadra persa», anche a ogni aggiornamento del server): il tuo eroe sta fermo, il gioco dice «Linea persa: mi ricollego alla squadra…» e ci riprova da solo per 40 s; tornato, recupera i turni persi e continua («Di nuovo insieme»). Se si riavvia il server (a ogni aggiornamento del gioco) la partita riparte da sola dove era, per tutti.
- **Premio**: ognuno prende quello delle ondate superate **fino a quando era dentro** (chi esce prima prende per le ondate che ha visto), col solito tetto del giorno.
- Sotto: PROTOCOL §9; la sim ha più eroi (`opzioni.eroi`), il server tiene il log dei turni e lo rigioca per ciascuno.

## 11. Audio (priorità alta)
Atmosfera alla COD Zombies con suoni **nostri, sintetizzati** (motore di `apps/client/src/audio/`, zero file, mai niente copiato da COD). Fatto al passo 8:
- **Versi** (più piano se lontani): «Deus vult!» gridato da una gola morta (tre sillabe con le vocali vere: formanti su un dente di sega ruvido), il rantolo lungo che trema, l'urlo stridulo di chi scatta, la terra che si apre quando escono.
- **Ondate**: lo stacco d'inizio (timpano, ottoni bassi in Re col Mi bemolle che stona, la campana grande) e quello di fine (un coro che respira e scende). Cadere: il cuore che rallenta su un bordone basso.
- **Boss**: il corno del Templare a cavallo (sale di una quarta, con l'eco), la risata di de Molay (HA ha ha ha che scende, con una voce un'ottava sotto e l'eco) e la fiammata quando arriva.
- **Armi e cose**: pietra focaia e scoppio delle pistole, il tuono del moschetto, il ventaglio del trombone, la corda dell'arco, il fendente; l'asse strappata (schianto e chiodi), la porta che cede (cigolio, tonfo, polvere), la campana grande (trappola e Campane a martello), il rogo che prende, il luccichio del power-up e l'accordo quando lo prendi (uno per tipo), la cassa che suona come un carillon per 4 s e il teschio che ride. Passi sul suolo sotto i piedi (pietra, erba, sabbia, assito).
- **Musica** `templari` (generativa, mai uguale): Re frigio dominante (il Mi bemolle e il Do diesis, il colore delle crociate), 50 bpm, un coro che respira, il cuore che batte a ogni battuta, la campana a morto ogni due; con la **tensione** (tanti zombie, un boss in campo) arrivano i tamburi di guerra, il rullo e la campana a ogni battuta. Tra un'ondata e l'altra si calma. Nelle ondate è sempre notte anche per l'ambiente.
- Niente ElevenLabs per ora (resta in BACKLOG): le voci vere («Deus vult!» detto da un attore) sarebbero il passo dopo.

## 12. Da decidere (non bloccano)
- **Easter egg** (spezzare la maledizione, il tesoro, il Graal) e **forma finale di de Molay**: in una chat leggera prima del passo 9.

## 12b. Il secondo giro: più chiara, più stretta, più varia (18 ott 2026, scelte di birbasan)
Dopo il recap di tutte le cose dell'isola, birbasan ha detto cosa tenere e cosa cambiare. **Restano come sono**: la storia e l'arrivo (§1-2), gli eroi (§4b), lo scudo (§7), i boss (§8), il premio (§10); in squadra niente rianimazione (§10b). Il resto cambia così; i numeri sono la **prima ipotesi** e quelli non detti da birbasan sono **[scelta provvisoria]**. Ogni passo è una PR a sé (issue madre del secondo giro).

**I problemi che ha visto**: l'isola è dispersiva e non si capisce cosa fare (la cripta c'è da tre giorni, ma lui non lo sapeva: è la prova); la strada per la spiaggia è lunga e la spiaggia è tutta aperta, basta girare in tondo e non si muore; i nemici normali sembrano sempre gli stessi; dalla cassa escono armi che rompono la partita.

**1. Bilanciamento, cassa e chi cade** (fatto il 18 ott, issue #413; `templari.json` versione 7)
- **Più zombie insieme, che crescono con le ondate** (come COD): erano al massimo 18 in campo dalla prima ondata. Sono **10 all'ondata 1, +1 a ondata, fino a 24** dalla 15ª **[scelta provvisoria]** (`ondate.insieme`); in squadra il tetto sale come il numero (§10b): 36 in due, 60 in quattro. **Misurato prima di alzarlo** (coro, 390×844, ondata 15, Templare a cavallo e de Molay in campo con fanti, pirati, scudati e cannonieri): gli zombie sono instanziati, quindi le draw call non crescono col numero (**91-93** con 18, con 24 e con 60, tutti disegnati); i triangoli sì, ~500 a zombie (57 mila con 18, 60 mila con 24, 79 mila con 60; budget 150 mila); i fotogrammi nel Chrome dei test (SwiftShader, senza scheda video) uguali tra 18 e 24 (~7,7) e −15-20 % con 60. Il client ora disegna fino a 64 zombie per tipo (erano 32: in quattro dalla 15ª qualcuno sarebbe stato invisibile).
- **Cassa del tesoro**: l'unica miracolosa che può uscire è il **fuoco greco**, e più di rado (peso 2 → 1: circa 1 apertura su 60 invece di 1 su 30). La **spada di de Molay** non esce più dalla cassa: si avrà solo forgiandola (punto 7). La Lancia di Longino resta solo nella cripta (§9c), com'era già.
- **Danni proporzionati all'ondata**: nessuna arma deve far finire la partita da sola. Le miracolose non uccidono più con un colpo per 20 ondate: il loro danno segue la vita dell'ondata, come i super (§4b; `"ondata": true` in `templari.json`, anche per le fiamme): fuoco greco **0,6 ×** la vita dell'ondata nell'area più le fiamme **0,1 ×** al secondo per 3 s (un vaso con tutte le fiamme fa 0,9: due vasi per un fante), spada di de Molay **1 ×** più la scia **0,2 ×** al secondo per 2 s, Lancia **0,8 ×** **[scelte provvisorie]**, così servono a ogni ondata senza cancellarla. Il Mercante le potenzia ancora ×1,5. Le altre armi restano nella tabella del §6; il test `templari_bilancio` controlla che dall'ondata 5 in su nessuna basti da sola (due vasi, due affondi, la spada un fante alla volta e mai un cannoniere; le armi normali smettono di uccidere con un colpo entro la 16ª, potenziate entro la 23ª).
- **In squadra chi cade perde anche le armi**: si rialza all'ondata dopo con la vita piena e **l'arma di partenza del suo eroe** (Crociato spada e scudo nuovo, Bucaniera pistola e spada, Arciere arco e spada; senza eroe la spada), senza pozioni, senza scudo dello scudato, senza potenziamenti e senza armi comprate o trovate; il super caricato resta. La Lancia si riprende all'altare con altre 5 anime (ognuno ha il suo sigillo: «anime 5/10»); la spada di de Molay si rifarà alla fucina col solo rituale (i pezzi restano) **[scelta provvisoria, punto 7]**.

**2. La spiaggia più vicina e più stretta**
- La strada fino all'accampamento si accorcia: meno spiaggia vuota tra la taverna (o il cimitero) e il Mercante.
- L'accampamento non è più una piazza aperta dove si gira in tondo: palizzate, tende, botti, cannoni, rocce e la nave in secca fanno **passaggi stretti e vicoli ciechi**; il bagnasciuga dove si va a correre si chiude con gli scogli. Si può ancora scappare, ma bisogna scegliere da che parte.
- **Il dipinto** (§3b) va rifatto quando l'isola cambia forma: si rifà **una volta sola**, dopo il punto 3 (le catacombe toccano la stessa zona). Gli script sono fuori dal repo, sul computer di birbasan.

**3. Le catacombe**
- La cripta (§9c) diventa l'ingresso di un **piano sotto**: dal suo lato nord parte un **tunnel stretto** di pietra e ossa che si divide in due. Un ramo sbuca nell'**ossario del cimitero**, l'altro in una **grotta sotto l'accampamento**, a due passi dal Mercante: è la **scorciatoia per la spiaggia**.
- Le catacombe si aprono col muro rotto (come oggi la cripta); le due uscite hanno una **grata** da pagare (**1250**) **[scelta provvisoria]**, così si può anche arrivarci dall'altra parte.
- Nei tunnel non si gira in tondo: sono corridoi da una persona con le nicchie dei morti, e gli zombie escono anche dalle nicchie. Sotto la luna non c'è (come nella cripta): lanterna, torce e quello che brucia.
- In una sala delle catacombe c'è la **fucina dei Templari** (punto 7).
- Draw call: chi è sotto vede solo il sotto (come la cripta oggi).

**4. Gli indizi: sangue e scheletri** (scelta di birbasan)
Gli easter egg restano segreti, ma qualcosa sull'isola deve dirti che si possono fare. Due modi, collegati a catena (uno ti porta al prossimo):
- **Scritte col sangue** su muri e pavimenti, brevi e in italiano, vicino a quello che serve: sul muro crepato («SOTTO DORMONO I FRATI · COLPISCI FORTE»), sull'ordine delle campanelle in taverna, accanto ai teschi, alla fucina.
- **Scheletri con un biglietto** (come fra' Guillaume col calice): cacciatori di tesori e pirati morti a metà dell'impresa. **AZIONE** apre il biglietto, che si rilegge dalla pausa. Il primo è **all'ingresso della chiesa** e spiega cosa si fa sull'isola (sopravvivere, accendere i fuochi, montare la campana) e dove guardare per il resto; gli altri stanno accanto a ogni segreto (cripta, campanelle, teschi, catacombe, forgia) e mandano al passo dopo.
- Anche le cose normali si capiscono meglio: i fuochi spenti e i pezzi della campana li segna la bussola, e il primo scheletro li nomina.

**5. I fantasmi** (idea di birbasan)
- Un **numero fisso** sull'isola per tutta la partita (**3**, **5** in squadra **[scelta provvisoria]**), dall'ondata 1: la probabilità di incontrarne uno è sempre la stessa, non cresce con le ondate e non contano per finire l'ondata.
- **Trapassano tutto** (muri, porte, assi, case) e **girano a caso** per la mappa: possono spuntare da qualsiasi parte, anche dove le porte sono chiuse.
- **Di base non attaccano.** Se **ci passi attraverso** si arrabbiano: diventano rossi, urlano e **ti puntano** (velocità 3 m/s, colpo 30, sempre attraverso i muri) finché uno dei due non muore.
- **Si uccidono con qualsiasi arma** (vita × 0,8 la vita dell'ondata, 100 punti **[scelta provvisoria]**). Ucciso uno, dopo 20 s ne torna un altro da un punto a caso, per tenere fisso il numero.
- Look: monaci e crociati pallidi, mezzi trasparenti, azzurri; un lamento lungo quando sono vicini.

**6. Il monaco, l'alfiere, il lebbroso** (tutti e tre scelti da birbasan; dati in `templari.json` come gli altri nemici)

| Nemico | Da quale ondata | Vita (× l'ondata) | Cosa fa **[scelta provvisoria]** |
|---|---|---|---|
| **Monaco guaritore** | 7 | ×0,8 | saio nero e incensiere; resta a 5 m dietro gli altri e ogni 2 s cura del 10% gli zombie entro 4 m (fumo verde): va ucciso per primo |
| **Lebbroso** | 8 | ×1,3 | gonfio, bendato, lento (0,8 m/s); quando muore, o quando ti arriva addosso, scoppia in una nube di 2,5 m che fa 20 al secondo per 3 s (anche agli zombie): va ucciso da lontano |
| **Alfiere** | 11 | ×1,5 | porta lo stendardo Beauceant; gli zombie entro 5 m camminano ×1,3 e picchiano ×1,25 finché lui è vivo; morto, lo stendardo cade e si spegne |

**7. La forgia della spada di de Molay** (scelta di birbasan, alla Origins)
- **Tre pezzi**: l'**elsa**, che cade dal **Templare a cavallo** quando muore; la **lama spezzata**, che lascia **de Molay quando scappa** (ondata 10); il **pomo col rubino**, che si trova in giro sull'isola (uno di tre posti, dal seed, come i pezzi della campana §9b) **[il pomo: scelta provvisoria]**. Sono della squadra.
- **La fucina** nelle catacombe: AZIONE coi tre pezzi li mette sull'incudine e la fucina si accende. Poi **la lama si tempra**: **10 zombie uccisi nel fuoco della fucina** (dentro 3 m) mentre brucia; ogni anima fa salire la tempra («🔥 tempra N/10»). Finito, AZIONE prende la **spada maledetta di de Molay** (un pezzo per ciascuno in squadra, come la Lancia).
- Prima dell'ondata 10 non si può: è la ricompensa di chi arriva lontano.

**Ordine dei passi**: 1 bilanciamento → 2 spiaggia → 3 catacombe (e il dipinto rifatto) → 4 indizi → 5 fantasmi → 6 monaco, lebbroso, alfiere → 7 forgia. Gli indizi vengono dopo le catacombe perché devono parlare anche di loro; la forgia per ultima perché sta nelle catacombe e usa i biglietti.

## 13. Come funziona sotto (per chi programma)
Una partita è una **sim deterministica** come il dungeon (`packages/sim/src/templari/`, stessa regola: niente funzioni trascendenti): il server sceglie il seed (`POST /api/templari/start`), il client gioca e registra un input per tick, a fine partita (`POST /api/templari/finish`) il DO del lotto rigioca gli input e paga il premio dell'ondata che ne esce. Lo stato (seed in sospeso, premio del giorno, record) sta nel `LotState` (niente migrazioni D1). Nel client tutto vive in un **chunk** a parte (`apps/client/src/templari/`), scaricato solo entrando. Dettagli e interfacce: `CONTRACTS.md` (sezione Templari).
