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

## 4. La partita
- Si parte con la **spada arrugginita** e **500 punti**, all'altare.
- **Ondate infinite**: in ogni ondata compare un numero fisso di zombie, mai più di **18** insieme; ucciso l'ultimo, **10 secondi** di respiro (jingle, «Ondata 4») e poi la prossima. Gli zombie diventano più resistenti a ogni ondata (sotto) e più veloci: alle prime camminano, dalla 4ª qualcuno corre, dalla 8ª molti scattano.
- **Vita** 100, si rigenera dopo 4 s senza colpi. Un fante toglie 45: tre colpi di fila e sei a terra.
- **Morte** = fine: «SEI CADUTO ALL'ONDATA N», la scheda col premio (lo conferma il server) e sei di nuovo davanti alla chiesa. Riprovi o vai via.
- **Alba**: dopo **60 minuti** la partita finisce da sola («È L'ALBA»): sei sopravvissuto, vale l'ondata a cui sei arrivato.
- **Punti**: +10 a colpo a segno, +60 a uccisione, +100 se l'uccisione è in mischia; +10 ad asse rimessa su una finestra (fino a 200 per ondata). Si azzerano a ogni partita: le risorse di MAREA non c'entrano, arrivano solo col premio finale.

**Vita degli zombie** (come COD): 150 all'ondata 1, +100 a ondata fino alla 9 (950), poi ×1,1 a ondata (ondata 10 ≈ 1050, 15 ≈ 1680, 20 ≈ 2700, 30 ≈ 7000).

| Ondata | Zombie | Ogni quanto ne entra uno |
|---|---|---|
| 1 · 2 · 3 · 4 · 5 | 6 · 9 · 11 · 14 · 17 | 2,0 s, poi −0,08 s a ondata (minimo 0,5) |
| n | 6 + 2,6·(n−1) + 0,06·(n−1)², al massimo 80 | |

## 5. Controlli
- **Mira** (passo 9): niente attacco automatico, colpisci solo quando premi. Il joystick (o WASD) appena sfiorato ti gira sul posto senza muoverti; da PC, se non cammini, l'eroe guarda il puntatore del mouse e il clic attacca lì. La spada colpisce davanti a te; archi e armi da fuoco aiutano solo dentro un cono stretto (~35°) davanti: fuori dal cono il colpo va dritto dove guardi. **Arco**: tieni premuto per tendere (più tendi, più fa male), lascia per tirare. **Pistole e moschetto**: un tocco = un colpo, a caricatore vuoto ricaricano da sole (le munizioni si comprano sul muro). **Fuoco greco**: un tocco lancia il vaso dove guardi.
- **Telefono**: joystick (spinto fino in fondo = corsa, 5 s di fiato), bottone grande **A** (attacca), **AZIONE** (compra, apri, prendi, ripara, accendi: il bottone dice cosa e quanto costa), **SCAMBIA** (le due armi), **SCUDO** (se ce l'hai).
- **PC**: WASD/frecce, Spazio, E o clic = attacca (tenuto = giro caricato), **F** = azione (tenuto per riparare), **Q** = scambia (lo scudo in mano è la terza «arma»), Shift = corsa, Esc = pausa.
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
| Moschetto | accampamento | 1500 (750) | 2000, trapassa 2 | ricarica 2,2 s | 1 + 24 | 17 |
| Trombone | accampamento | 1500 (750) | 7 pallini × 350, cono corto | ricarica 2,0 s | 1 + 20 | 19 (da vicino) |
| Arco lungo | cassa | — | 1400, trapassa | tende 0,8 s | 30 + 60 | 13 |
| Martello da guerra | cassa | — | 1600, caricato = giro | 1,1 s | ∞ | 14 |
| Pistola doppia | cassa | — | 2 × 1100 | ricarica 1,8 s | 2 + 40 | 11 |
| **Fuoco greco** (miracolosa) | cassa, rara | — | 3000 in 3 m + fiamme | lancio 0,8 s | 6 + 12 | 21 |
| **Spada maledetta di de Molay** (miracolosa) | cassa, rarissima | — | 6000 + scia di fuoco | 0,5 s | ∞ | 29 |

- **Ricarica**: da sola quando il caricatore è vuoto (A col caricatore vuoto la fa partire). Le armi da fuoco tirano anche fuori dalle finestre, agli zombie che strappano le assi.
- **Cassa del tesoro templare** (= mystery box): **950** punti, gira 4 s e tira fuori un'arma a caso da prendere entro 10 s (tutte tranne la spada e quelle che hai già; pesi in `templari.json`: le miracolose rare, la spada di de Molay rarissima). Ogni 4-8 aperture esce il **teschio** (la leggenda del teschio dei Templari): la cassa ride, ti rende i punti e sparisce, per ricomparire in un altro dei suoi posti (per ora due nella chiesa; con le porte anche piazza, cimitero, accampamento). Un fascio di luce gialla la fa trovare.

## 7. Scudo templare
Cade dal **templare scudato** quando muore (resta a terra 20 s: A per prenderlo). Lo porti **sulle spalle**: blocca i colpi da dietro. Con **SCUDO** lo **impugni** al posto dell'arma: blocca i colpi da davanti, cammini piano e con A dai una spallata (poco danno, li respinge). Regge **1500** danni, poi si spacca; se ne prende un altro dallo scudato successivo.

## 8. Nemici e boss

| Nemico | Da quale ondata | Vita (× la vita dell'ondata) | Velocità | Colpo | Carattere |
|---|---|---|---|---|---|
| **Fante crociato** | 1 | ×1 | cammina 1 m/s, corre 2,2, scatta 3,6 (sempre di più con le ondate) | 45 | tunica bianca con la croce rossa a pezzi, grida «Deus vult!» |
| **Pirata zombie** | 3 | ×0,6 | 4,2 m/s | 30 | veloce e fragile, tricorno e sciabola |
| **Templare scudato** | 6 | ×1,5 | 1,4 m/s | 50 | **immune da davanti** (scudo): giragli attorno; morto lascia lo scudo |
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

## 10. Premio
Lo calcola il **server** rigiocando la partita (come i dungeon): per ogni **ondata superata** (quella in cui muori non conta) **15 Legno, 8 Pietra, 2 Perle**, fino all'ondata 30. **Tetto giornaliero** (giorno UTC): **600 Legno, 300 Pietra, 60 Perle** in tutto; oltre, si gioca per il record. Il premio entra nel Magazzino fino al suo tetto, come quello dei minigiochi.

| Ondate superate | Legno | Pietra | Perle |
|---|---|---|---|
| 1 | 15 | 8 | 2 |
| 5 | 75 | 40 | 10 |
| 10 | 150 | 80 | 20 |
| 20 | 300 | 160 | 40 |

Il **record** (ondata più alta) resta nel lotto e si vede nella scheda finale.

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
- Partita insieme (fino a 4, come i dungeon): BACKLOG.

## 13. Come funziona sotto (per chi programma)
Una partita è una **sim deterministica** come il dungeon (`packages/sim/src/templari/`, stessa regola: niente funzioni trascendenti): il server sceglie il seed (`POST /api/templari/start`), il client gioca e registra un input per tick, a fine partita (`POST /api/templari/finish`) il DO del lotto rigioca gli input e paga il premio dell'ondata che ne esce. Lo stato (seed in sospeso, premio del giorno, record) sta nel `LotState` (niente migrazioni D1). Nel client tutto vive in un **chunk** a parte (`apps/client/src/templari/`), scaricato solo entrando. Dettagli e interfacce: `CONTRACTS.md` (sezione Templari).
