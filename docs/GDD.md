# MAREA — Game Design Document (fonte di verità)

> Dove questo file contraddice gli altri documenti, vince questo. Si aggiorna solo tramite l'orchestratore; le idee nuove vanno in `BACKLOG.md`.
> Versione 1.0 · 29 set 2026 · titolo di lavoro **MAREA** (si può cambiare).

## 0. In tre righe
Un arcipelago 3D low-poly in stile pixel art, condiviso tra un gruppo di amici. Ogni amico ha la sua isola che **produce anche quando non c'è**; torna ogni giorno, raccoglie, costruisce, e sfida gli altri ai minigiochi nelle zone comuni, scommettendo risorse. Si gioca nel browser, da un link, anche dal telefono.

## 1. Pilastri (ogni scelta si misura su questi)
1. **Il mondo vive senza di te.** Quando rientri c'è sempre qualcosa che è cresciuto, qualcuno che ti ha sfidato, qualcosa di nuovo da vedere.
2. **Minigiochi sempre divertenti, mai tryhard.** Un pollice, 30-120 secondi, si capisce in 3 secondi, anche chi perde porta a casa qualcosa.
3. **Tutto personalizzabile e condiviso.** L'isola e l'avatar sono tuoi, ma gli amici li vedono: costruire è anche mostrare.

Riferimenti: **Grepolis** (rientro quotidiano, timer, risorse), **Mario Party** (minigiochi vari e leggeri), **Clash Royale** (dopamina, sblocchi; la battaglia con le unità è un obiettivo 2027). Anti-riferimenti: niente piattaforme 2D come gioco principale, niente grinding, niente PvP distruttivo.

## 2. Il loop del rientro (2-10 minuti, 1-2 volte al giorno)
1. **Entri** dal tuo link → sei sul molo della tua isola, la camera diorama la mostra tutta.
2. **Raccogli**: gli edifici hanno accumulato risorse nel loro deposito (tap sull'edificio → volano nel Magazzino). Feed: «Marco ti ha sfidato alla Regata», «hai vinto 40 Legno».
3. **Costruisci**: nuovo edificio o miglioramento (spesa immediata + timer), o piazzi una decorazione.
4. **Minigiochi** (1-3): prendi la barca e vai dove sta il minigioco (la Regata al molo della Laguna); con una medaglia vinci Legno, Pietra e Perle. Le sfide differite con posta tornano dopo la prova con gli amici (vedi §7).
5. **Esci** con almeno un timer che finirà prima del prossimo rientro (il gioco lo dice: «la Cava finisce tra 6 h»).

**Mentre eri via** (#86, 8 ott 2026): se mancavi da almeno **10 minuti** (`rientro.json`), all'ingresso una cartolina dice da quanto mancavi, quanto c'è nei depositi, il cantiere finito, chi ha firmato il tuo libro degli ospiti, le novità della campanella e le missioni nuove della Bacheca; **RACCOGLI TUTTO** svuota tutti i depositi nel Magazzino (fino al tetto). L'assenza la misura il server, da quando sei uscito.

## 3. Il mondo: l'arcipelago
- **Zone comuni** (tutti le vedono, nessuno le possiede): in V1 una sola zona vera, il **Porto** (villaggio con edifici e mood asiatico: lanterne, torii, moli di legno, insegne). Il **Distretto Neon** (cyberpunk leggero) e l'**Isola Selvaggia** (natura, scogliere, palme) esistono come **facciate** visibili dalla barca; diventano zone vere quando chi ci lavora le apre (Neon e Laguna sono di Riccardo, #25 #26).
- **Isole a tema** (Jack, 7 ott 2026): ogni isola nuova ha un **tema** suo (contenuti e grafica), **minigiochi suoi** e un **modo suo per sbloccarla** (barca potenziata, livello del personaggio, un certo cappello senza il quale gli abitanti ti cacciano, una mappa…). Le prime quattro (#68, 8 ott 2026), lontane dal giro iniziale:
  - **Isola della Tempesta** (nord-est): scogli neri e scogliere, faro in rovina, relitti, cannoni e bandiere pirata; mare scuro, onde alte, pioggia, fulmini. La tempesta in mare ti respinge finché il **Molo** della tua isola non è al **livello 2**.
  - **Isola dei Ghiacci** (nord): neve, scogliere di ghiaccio, iceberg, igloo, pinguini, aurora boreale di notte. Il mare gela e la barca si ferma finché il **personaggio** (Mondo Sotterraneo) non è al **livello 3**.
  - **Isola Vulcano** (est): cono con cratere di lava, spiaggia d'ossidiana, capanne, bracieri, teste di pietra, fumo e cenere. Ci sbarchi, ma gli abitanti ti rimettono in barca se non indossi la **Lanterna in testa** (cappello a Perle).
  - **Isola Giardino** (sud-ovest): ciliegi in fiore, tempio, torii e lanterne di pietra, stagno con le carpe koi e il ponticello rosso. Nascosta nella nebbia, dove la barca si perde e torna indietro, finché non hai la **mappa**: la regala la prima medaglia d'oro in un minigioco.
  - **Isola dei Templari** (sud, tra Giardino e Vulcano; isola di birbasan, 8 ott 2026): chiesa templare in rovina, borgo abbandonato, cimitero, accampamento pirata. Nebbia rossastra finché non trovi la **reliquia** nel relitto templare sotto il faro della Tempesta. Non ha un minigioco ma una **modalità a ondate** di crociati zombie (§6, design in **`docs/TEMPLARI.md`**).
  - **Isola delle Corse** (nord-est, tra Ghiacci e Tempesta; Jack, 9 ott 2026, #155): prato rasato, anello d'asfalto, tribune, gomme, arco del via a scacchi. **Aperta a tutti** (sblocco `libera`). Il suo gioco è il **Gran Premio**: kart alla Mario Kart con la camera dietro, drift e turbo, 3 giri contro 4 bot (design in **`docs/CORSE.md`**). **Dove va** (intervista del 9 ott 2026, CORSE.md Parte A): l'isola diventa un'avventura completa alla Diddy Kong Racing, un posto strano dove tutto è diventato una corsa, con un hub aperto da girare col veicolo, 6 zone × 4 piste più i boss, 4 famiglie di veicoli (ruote, due ruote, acqua, scivoli e binari) più quelli buffi, pubblico di manichini e animali piloti. Il Gran Premio resta finché il circuito della Spiaggia non lo sostituisce.
  - Minigiochi propri (§6, tabella «Isole a tema»): **Ghiacci → Pinguini sul ghiaccio** (vicino agli igloo), **Giardino → Carpe koi** (sul ponticello rosso), **Tempesta → Arrembaggio** (cannone sul promontorio del faro), **Vulcano → Fuga dalla lava** (tra le capanne e il cratere). Il posto c'è (anche in bussola) solo quando l'isola è aperta.
- **Minigiochi universali** (pesca, caccia alle perle, consegne, ingorgo al porto): si giocano ovunque, dalla barca o al molo; le isole a tema hanno in più i loro.
- **Minimappa**: cerchietto in un angolo; toccandolo, la mappa intera dell'arcipelago con la nebbia sulle isole non ancora visitate; le isole a tema chiuse restano nella nebbia col lucchetto finché non le sblocchi. Un'isola a tema scoperta compare tra le mete della bussola. Toccando un punto della mappa intera ci metti un **segnalino** (sull'icona di una meta si aggancia a lei): diventa la meta del navigatore, in cima alla bussola con distanza e freccia e con la freccia sullo schermo; si toglie con TOGLI, con la × in bussola o da solo quando ci arrivi.
- **Bordo del mondo** (#5): al bordo dell'arcipelago una corrente morbida riporta la barca verso le isole.
- **Isole personali (lotti)**: una per amico, disposte attorno al Porto e alla Laguna, a **10-25 s di barca** (80-240 m) da entrambi. Vi si arriva in barca o con «vai a casa». Un lotto è una griglia di celle da 2 m con slot per edifici e decorazioni; il Molo è sempre costruito e fa da spawn.
- **Barca**: il mezzo principale. Sali dal molo (tasto A vicino alla barca), guida arcade (accelerazione, virata, scia), scendi a qualsiasi molo. Anche a piedi sulle isole.
- **La tua barca** (#107, 8 ott 2026): colore dello **scafo** (fasciame fuori e dentro) e della **vela** (una vela latina su un alberetto; di serie nessuna vela: la barca a remi di prima), e un **nome** di massimo 14 caratteri su una targa ai due fianchi. Si sceglie nell'editor (sezione Barca); 6 colori gratis, 6 **esclusivi del Mercante delle Perle** (§5), comprati una volta valgono per scafo e vela. Gli amici la vedono: quando navighi dov'è, quando sei a piedi o non ci sei **ormeggiata al molo della tua isola**. Due barche ferme non stanno mai una sopra l'altra: se uno scafo tocca la tua barca vuota, la tua si sposta al posto libero più vicino del molo (#6).
- **Camera**: dall'alto in diagonale (diorama), segue l'avatar, zoom 0,6-1,6. Stessa vista per costruire.
- **Una mano** (#143, solo telefono e tablet, spenta di serie): nelle Impostazioni. Il joystick fisso sparisce e ne nasce uno dove appoggi il pollice; quando lo alzi resta lì, più chiaro, per **1, 2, 3 o 5 s** (si sceglie sotto l'interruttore, di serie 2): rimettendoci il dito sopra lo riprendi, altrove ne nasce uno nuovo. Vale ovunque (mondo, barca, gare, dungeon, Templari). Sul PC la voce non c'è.
- **Ciclo giorno/notte**: sì, dalle Impostazioni (#54), acceso di serie (#59); un giro ogni 24 min, stessa ora per tutti.
- **Meteo** (#85): sereno, nuvoloso, pioggia, nebbia, vento forte; cambia ogni qualche minuto, **uguale per tutti** (dall'orologio, come il ciclo). Interruttore nelle Impostazioni, acceso di serie. Solo aspetto e suono, niente effetti sul gioco. Numeri in `packages/content/src/meteo.json`:

| Stato | Peso | Durata (min) |
|---|---|---|
| sereno | 6 | 5-10 |
| nuvoloso | 3 | 4-7 |
| pioggia | 2 | 3-5 |
| nebbia | 1,5 | 3-5 |
| vento | 1,5 | 3-5 |

  Ciclo di 40 min che parte sereno (mai due stati uguali di fila; se restano meno di 2,5 min finisce sereno); passaggi in 5 gradini da 8 s (40 s). In un giorno: sereno ~50% del tempo, poi nuvoloso ~20%, pioggia ~13%, nebbia e vento ~9% l'uno.

## 4. Chi sei: l'avatar
Umano semplice in **stile PS1 / Final Fantasy IX**: proporzioni quasi vere (6 teste, 1,6 m), pochi poligoni, viso e vestiti dipinti a pixel. Personalizzazione V1: tono della pelle (6), capelli (8 tagli × 6 colori), vestito (6 colori), cappello (12: 3 gratis, 3 a Perle anche dall'editor, 6 **esclusivi del Mercante delle Perle** al Porto; colori dei capelli con nomi da capelli: nero corvino, castano scuro, castano, biondo miele, rosso fuoco, biondo platino). Emote (4) al posto della chat. Animazioni: idle, camminata, corsa, seduto (in barca), remata/timone.

## 5. Economia
**Risorse**: **Legno** e **Pietra** (prodotte dall'isola, servono a costruire) e **Perle** (da minigiochi, wager, missioni della Bacheca e **traguardi del Diario**: sbloccano cappelli e decorazioni esclusive; non si producono, non si comprano).

| Edificio | Cosa fa | Costo L1 · L2 · L3 (Legno/Pietra) | Tempo L1 · L2 · L3 |
|---|---|---|---|
| Molo | Spawn, barca; velocità barca +10 %/livello | già costruito · 100/80 · 350/300 | — · 10 min · 2 h |
| Segheria | 20 → 45 → 90 Legno/ora | 30/0 · 120/60 · 400/250 | 30 s · 20 min · 4 h |
| Cava | 12 → 28 → 60 Pietra/ora (richiede Molo) | 50/0 · 150/80 · 450/300 | 2 min · 40 min · 6 h |
| Magazzino | Tetto per risorsa 200 → 600 → 1500 | 40/20 · 200/120 · 600/400 | 5 min · 1 h · 8 h |
| Casa | Slot cosmetici avatar 2 → 4 → 6 | 60/30 · 250/150 · 700/500 | 10 min · 2 h · 8 h |
| Faro | +50 % produzione per 2 h dopo una vittoria (1 attivo) | 120/120 · 400/400 | 30 min · 3 h |
| Tavolo delle Sfide | Wager max 50 → 150 → 400; sfide gratis/giorno 3 → 5 → 8 | 40/10 · 180/100 · 500/350 | 5 min · 1 h · 6 h |
| Decorazioni (20, 8 esclusive) | Solo estetica, sulla sabbia/erba del lotto; si comprano dal Mercante delle Perle; sulla tua isola si spostano, si girano di 90° e si **rivendono a metà prezzo** (per difetto, `balance.json` `decor.rimborso` 0,5) | 5-45 Perle | istantanee |

**Regole**
- **Produzione pigra**: ogni edificio accumula nel suo deposito in base al tempo trascorso (`advance(lotto, oraServer)`): piena velocità per **10 ore**, poi al **25 %** fino a 110 ore (così chi entra due volte a settimana non resta fermo). Raccogliere sposta il deposito nel Magazzino, fino al suo tetto. Il server è l'unica autorità del tempo; il client non usa mai il suo orologio per l'economia.
- **Costruire** = spesa immediata + timer; un solo cantiere alla volta in V1. Niente acceleratori a pagamento: **mai soldi veri**.
- **Partenza**: Molo L1, 400 Legno, 160 Pietra, 0 Perle. Tetto base del deposito centrale senza Magazzino: 800 per risorsa. Nei primi 10 minuti si costruiscono Segheria e Cava e si scopre il Tavolo.
- **Taratura**: tutti i numeri stanno in `packages/content/src/balance.json` e si verificano con `economy_30days.test.ts` su tre archetipi (chi entra 2 volte al giorno / 1 volta / 2 volte a settimana → dopo 30 giorni ~100 % / ~75 % / ~40 % degli edifici a L2, nessuno a L3 pieno).
- **Dai minigiochi da solo** (`balance.json` → `solo`): il premio della medaglia arriva sempre, senza posta. Premiate le prime **10 partite al giorno** (giorno UTC), poi si gioca senza premio. Una medaglia attiva il Faro.

| Medaglia | Legno | Pietra | Perle |
|---|---|---|---|
| Oro | 60 | 30 | 20 |
| Argento | 30 | 15 | 10 |
| Bronzo | 15 | 8 | 5 |
| Nessuna | 0 | 0 | 2 |

Un minigioco può dare qualcosa in più (`premioExtra` nel suo json): la **Caccia alle perle** all'oro dà **+10 Perle** (§6).

- **Dalle sfide con posta** (spente per ora, §7): medaglia → Perle **5 / 10 / 20** (bronzo / argento / oro) e attiva il Faro. Chi perde una sfida prende comunque **2 Perle** (mai zero).

### Porto: Mercante, Bacheca e Gente (#63-#65, 8 ott 2026)
- **Mercante delle Perle** (banco in piazza, a sinistra del Tavolo; Maestro Ishi accanto): vende tutti i cappelli a Perle, tutte le decorazioni e i colori esclusivi della barca (#107); le **esclusive** si comprano solo da lui. Un cappello si compra una volta (poi INDOSSA); una decorazione si posa sulla tua isola, nella cella libera di sabbia/erba più vicina a casa; poi la tocchi (o premi A vicino) e la **sposti** dove vuoi (sagoma verde/rossa sulle celle), la **ruoti** o la **rivendi** per metà delle Perle (#108). Prezzi (`avatar.json`, `decor.json`):

| Cappelli esclusivi | Perle | Decorazioni esclusive | Perle |
|---|---|---|---|
| Cappello a cono | 20 | Ancora arrugginita | 15 |
| Berretto da capitano | 30 | Carpa di carta | 18 |
| Tricorno pirata | 45 | Bandiera pirata | 20 |
| Polpo in testa | 60 | Lampione di pietra | 22 |
| Corona di perle | 80 | Gong del porto | 25 |
| Elmo da palombaro | 100 | Bonsai paziente | 30 |
| | | Papera gigante | 35 |
| | | Pagoda in miniatura | 45 |

Colori della barca (#107, `avatar.json` `barca`): gratis Legno (di serie), Tela, Rosso lanterna, Blu mare, Verde bosco, Giallo sole; esclusivi del Mercante (scheda BARCA, si comprano una volta e valgono per scafo e vela):

| Colore esclusivo | Perle |
|---|---|
| Nero pirata | 15 |
| Blu abisso | 15 |
| Arancio tramonto | 20 |
| Viola corsaro | 25 |
| Rosa neon | 35 |
| Ciano neon | 40 |

- **Bacheca delle missioni** (in piazza, a destra del Tavolo): **3 missioni al giorno** (giorno UTC), diverse per ognuno, mai due dello stesso gruppo; si fanno durante il giorno e si **riscuotono** alla Bacheca (una volta). Contano solo cose che il server vede (`missioni.json`):

| Missione | Quanto | Premio (Legno / Pietra / Perle) |
|---|---|---|
| Raccogli Legno dalla tua isola | 40-120 (a 10) | 0 / 15 / 8 |
| Raccogli Pietra dalla tua isola | 20-60 (a 10) | 30 / 0 / 8 |
| Avvia un cantiere (costruisci o migliora) | 1 | 0 / 0 / 10 |
| Gioca partite ai minigiochi | 2-4 | 20 / 10 / 8 |
| Vinci una medaglia *(gruppo medaglie)* | 1 | 0 / 0 / 12 |
| Vinci un oro *(gruppo medaglie)* | 1 | 0 / 0 / 20 |
| Torna da una spedizione nel Mondo Sotterraneo | 1 | 0 / 10 / 15 |
| Compra qualcosa dal Mercante | 1 | 20 / 0 / 6 |

- **Gente del Porto** (`gente.json`): Maestro Ishi (il Mercante), Gigi il Mozzo (sul viale: barca, Laguna, dungeon), Capitan Remo (passeggia in piazza: isole a tema, mappa, Tempesta), Nonna Pina (al molo: produzione, Bacheca, Mercante). Vicino premi A (o tocca il nome): 3 battute ironiche che spiegano il gioco ai nuovi.

### Diario del capitano e traguardi (#87, 8 ott 2026)
- **Diario** (libro in alto, tasto **J**): album a pagine con caselle grigie e «?» per quello che manca e il contatore «3/12». **Pesci** (ogni specie con la sagoma a pixel e quante volte), **Perle** (bianca, conchiglia, rosa, nera), **Animali** avvistati (gabbiano, gatto, granchio, pesce saltatore, delfino, lucciola: si segnano passandoci vicino), **Medaglie** (la migliore per minigioco e le partite), **Isole** visitate (Porto, Laguna, facciate, isole a tema e le isole degli amici), **Traguardi**. Si sfoglia anche il diario di un amico (sola lettura). Cataloghi in `diario.json`.
- **Traguardi** (`traguardi.json`, 23): compiuto → **RISCUOTI** (una volta, il server verifica e paga) → il suo **titolo** si può mettere sotto il nome, sopra la testa (lo vedono gli amici). Avviso breve quando se ne compie uno, numerino sul libro.

| Traguardo | Premio (Perle) | Titolo |
|---|---|---|
| Primo pesce · 10 pesci · 50 pesci | 5 · 10 · 20 | Mozzo · Pescatore · Re della lenza |
| 6 specie · tutte le specie · un leggendario | 15 · 30 · 20 | Naturalista · Re dei pesci · Leggenda del mare |
| 100 perle e conchiglie · una perla nera · tutti i tipi | 15 · 10 · 15 | Cercatore di perle · Palombaro · Collezionista |
| Prima medaglia · primo oro · oro in ogni minigioco | 5 · 15 · 30 | Promessa · Campione · Leggenda di MAREA |
| Ogni minigioco giocato · 50 partite | 15 · 20 | Tuttofare · Lupo di mare |
| Segheria, Cava, Magazzino, Casa e Faro · Segheria L3 | 20 · 20 | Capomastro · Boscaiolo |
| 5 animali · tutti gli animali | 10 · 20 | Amico degli animali · Sussurratore |
| Tutte le isole · un amico · tutti gli amici | 15 · 5 · 15 | Esploratore · Buon vicino · Ospite d'onore |
| 1 spedizione · 10 spedizioni nel Mondo Sotterraneo | 10 · 25 | Speleologo · Avventuriero |

### Porto tra amici: Tabellone dei record e Faro comune (#110 #111, 8 ott 2026)
- **Tabellone dei record** (prato a ovest della piazza, accanto al Mercante): per ogni minigioco da solo il **migliore di oggi** (giorno UTC) e il **migliore di sempre** tra gli amici, con nome, punteggio (tempo per la Regata, pacchi per le Consegne, ingorghi/livelli e mosse per Ingorgo e Pinguini, altrimenti punti) e medaglia. Lo scrive il server quando rigioca la partita; a pari punteggio resta chi c'era. Chi perde il record di sempre lo legge nella campanella («Luca ha battuto il tuo record alla Pesca»).
- **Faro comune** (sullo scoglio a nord-est del Porto, accanto alla Grotta della Marea): un progetto di tutti. Vicino al faro (A) si versano **50 / 200 / TUTTO** Legno o Pietra dal proprio Magazzino (escono come una spesa; mai oltre quello che manca al faro completo); il pannello mostra le barre verso il prossimo livello e chi ha versato di più. A ogni livello il faro cresce (spento al livello 0, poi acceso, più alto, di notte un fascio che gira più lungo) e dà **a tutti** un bonus di produzione; una riga nella campanella di tutti quando sale. Numeri in `porto_amici.json`:

| Livello | Legno totale | Pietra totale | Segherie e Cave |
|---|---|---|---|
| 1 | 2000 | 1000 | +5 % |
| 2 | 6000 | 3000 | +10 % |
| 3 | 15000 | 8000 | +15 % |

Il bonus è sulla velocità (il tetto del deposito resta quello dell'edificio) e vale dal momento in cui il faro sale. Non c'entra col **Faro** edificio dell'isola (+50 % per 2 h dopo una vittoria), che resta com'è.

## 6. Minigiochi
**Formato comune** (in `packages/sim/src/minigames/`): modulo puro e deterministico, 60 Hz, `create({seed, difficulty})`, `step(state, input)`, `result(state)`, `autopilot`. Stesso seed = stessa partita, sempre. Il punteggio è **sempre «più alto vince»**; i dettagli (tempo, combo) stanno in `result().detail`.

**Ogni minigioco ha il suo posto** su un'isola (ogni isola ha giochi diversi): la Regata parte dal molo della Laguna. Nel mondo una boa grande con il cartello «REGATA» che si vede da lontano, nella bussola una riga con la distanza; vicino compare **GIOCA** (A). La Regata fa eccezione (8 ott 2026, Riccardo): la boa del via sta accanto al molo della Laguna, dove **A attracca e fa scendere a terra** (sull'anello della Laguna ci sono i dungeon dell'Epopea, `RPG.md`); la gara parte **solo dalla barca**, col bottone **GIOCA · REGATA** o il tasto **R**. Si gioca da soli quando si vuole: il seed lo dà il server, che rigioca gli input e paga il premio (§5).

**Sfide differite** (spente per la prova con gli amici, si riaccendono con `?sfide=1`): A gioca oggi con un seed; B entra domani, gioca lo **stesso** seed e vede se batte il punteggio di A. Nessun bot. Il server rigioca l'input log nella sim e verifica il punteggio dichiarato.

**Ordine**
1. **Regata** (M1) — gara in barca a tempo tra 5 boe fisse nella laguna del Porto, con raffiche di vento da seed che spingono di lato. Riusa barca, mondo e camera. Tempo massimo 120 s; `score = max(0, 12000 − floor(ms/10))`. Medaglie relative al pilota di riferimento con le stesse raffiche: oro ≤ 1,04×, argento ≤ 1,3×, bronzo ≤ 2,0× (dall'8 ott 2026, #2; prima 1,1 / 1,4 / 2,3 ≈ 22 / 28 / 46 s; giro di ~167 m). Le boe si passano in ordine, la prossima è evidenziata. Controllo: joystick per virare, A per accelerare.
2. ~~**Lanterne**~~ — tolto l'8 ott 2026 (Jack: non divertiva). Al suo posto i minigiochi universali (§3): la **pesca** per prima.

**Minigiochi universali** (§3; premio a medaglie come la Regata, `balance.solo`; il server rigioca gli input). Si giocano **su ogni molo** che ha un posto in content (Porto e lotti), **a piedi**, in un punto del molo lontano dalla barca (lì A fa salire in barca); nella bussola solo quelli del Porto, il cartello degli altri si vede da 45 m.

| Gioco | Come si gioca | Durata | Medaglie | Numeri |
|---|---|---|---|---|
| **Consegne** (corriere: cassa sul molo) | Il corriere ti dà un pacco per un altro molo (Porto, Laguna, lotti, 60-170 m in linea d'aria, scelto dal seed); lo porti **in barca**, la guida è quella di sempre. Puntini gialli sulla rotta, boa con bandiera al molo, freccia e metri nell'HUD. Consegnato entro 6 m dalla B. Poi lì c'è il pacco dopo: **5 pacchi**. Tempo per pacco = 3 s + 0,15 s/m di rotta (+5 s sul primo); **quello avanzato passa al pacco dopo**; ogni **cassetta** che galleggia lungo la rotta (3 a tratto, 3-8 m di lato) dà **+4 s**. Finito il tempo, finisce la partita. | 60-120 s (max 150) | oro 5 pacchi · argento 3 · bronzo 2 | `minigames/consegne.json`; per difficoltà 0,18 / 0,15 / 0,13 s/m |
| **Ingorgo** (barile sul molo) | Stile Rush Hour: griglia 6×6 vista dall'alto, barchette ormeggiate che scorrono solo lungo il loro verso (trascini, o tocchi la barca dalla parte dove vuoi che vada: un passo). Fai uscire la **barca rossa** dal varco a destra. **3 ingorghi** di fila, sempre più intricati (difficoltà 2: facile 3-5 mosse, medio 7-9, intricato 11-14); RICOMINCIA rimette l'ingorgo com'era. | 120 s | oro 3 ingorghi · argento 2 · bronzo 1 | `minigames/ingorgo.json`; 36 livelli generati con `tools/ingorgo_livelli.mjs` |

Punteggio («più alto vince»): Consegne = 1000 a pacco + 10 a secondo avanzato + 5 a cassetta; Ingorgo = 1000 a ingorgo + fino a 100 per quanto ti avvicini alla soluzione più corta + 5 a secondo avanzato se li risolvi tutti.
3. **Puzzle leggero** (2027) — tubi o tessere da ruotare con i moduli dell'isola.
4. **Battaglia carte/unità in tempo reale** (2027) — richiede avversario live o bot, netcode a bassa latenza, bilanciamento: si fa dopo il collaudo di dicembre.

**Minigiochi universali** (§3): si giocano ovunque, non hanno un posto fisso.
- **Pesca dalla barca** (#66) — in barca **ferma** su acqua profonda, ad almeno 10 m dalla riva, compare **PESCA** (tasto P; la A resta l'acceleratore). 60 s: tocchi per lanciare, aspetti (il galleggiante a volte trema per finta: chi tira troppo presto spaventa il pesce), quando va sotto hai una finestra per tirare (0,9 / 0,7 / 0,55 s per difficoltà 1/2/3), poi il **recupero**: una barra va avanti e indietro e tocchi quando è nel verde; 2 tocchi fuori zona tollerati, al terzo scappa. Il tempo parte al primo tocco (prima il cartello delle regole coi pesci del mare). Il **mare** viene dall'isola più vicina (entro 40 m: Acque del Porto, Laguna; altrove Mare aperto) e decide quali pesci abboccano; rarità e punti sono uguali in ogni mare. Medaglie in punti: **oro 12, argento 8, bronzo 4** (il pilota di riferimento ne fa 13-37, ~22 di media; ~12 pesci al minuto).

| Rarità | Probabilità | Punti | Tocchi nel verde | Zona verde | Barra |
|---|---|---|---|---|---|
| Comune | 55 % | 1 | 1 | 34 % | 0,85 passate/s |
| Non comune | 28 % | 2 | 2 | 26 % | 1,0 |
| Raro | 13 % | 3 | 2 | 20 % | 1,2 |
| Leggendario | 4 % | 6 | 3 | 16 % | 1,3 |

12 pesci: Sardina Pensierosa, Ciabatta Spaiata (non è un pesce, vale lo stesso), Ghiozzo Brontolone, Sgombro in Ritardo · Orata col Mutuo, Branzino Influencer, Granchio Burocrate · Pesce Palla Offeso, Polpo Multitasking · Tonno Pensionato, Pesce Lanterna Nostalgico, Pesce Spada Spuntato. Ogni mare ne ha 6 (almeno uno per rarità); le isole a tema avranno i loro (`minigames/pesca.json` → `mari`).

- **Caccia alle perle** — in barca **ferma** su **acqua bassa** vicino a una costa (a più di 8 m da un molo, dove la A fa scendere a terra) compare **TUFFATI** (tasto T). Schermata a pixel di profilo: la corrente ti porta verso destra, **tieni premuto = nuoti giù, lascia = risali** (un dito, stile «Flappy» morbido). 60 s: prendi perle bianche, conchiglie, perle **rosa** nelle ostriche (si aprono quando arrivi) e perle **nere** in fondo ai crepacci; **meduse** e **granchi** ti tolgono un quarto d'aria (non si muore). L'aria dura 7 s sott'acqua e si ricarica in 1 s a galla o nelle bolle; senz'aria risali da solo e perdi tempo. Il fondale nasce dal seed (≈ 57 perle bianche, 11 conchiglie, 4 rosa, 3 nere, 6 bolle: ≈ 1400 punti in tutto). Medaglie in **frazione dei punti di tutto il fondale**: **oro 55 %, argento 35 %, bronzo 15 %** (il pilota di riferimento fa 60-87 %; chi tocca a caso prende il bronzo, chi resta a galla niente). L'oro dà **10 Perle in più** del premio di §5 (`premioExtra` in `minigames/perle.json`): oro = 60 Legno, 30 Pietra, **30 Perle**.

| Cosa | Punti | Dove |
|---|---|---|
| Perla bianca | 10 | a mezz'acqua, in archi e scie |
| Conchiglia | 25 | sul fondo |
| Perla rosa | 60 | nell'ostrica (si prende aperta), un granchio accanto |
| Perla nera | 120 | in fondo ai crepacci, due meduse di guardia |
| Bolla | aria +40 % | a mezz'acqua |

**Minigiochi delle isole a tema** (§3; premio a medaglie `balance.solo` più `premioExtra`, il server rigioca gli input). Uno per isola, **a piedi** sul posto dell'isola (`isola` e `posto` nel json), che compare (cartello, GIOCA, bussola) **solo quando l'isola è aperta**. Schermata a pixel sopra il mondo.

| Isola · gioco | Come si gioca | Durata | Medaglie | Oro in più | Numeri |
|---|---|---|---|---|---|
| **Ghiacci · Pinguini sul ghiaccio** (vicino agli igloo) | Lastra 6×6 vista dall'alto sotto l'aurora: **trascini un pinguino** (o lo tocchi e poi tocchi da che parte; frecce/WASD sul PC) e scivola finché non sbatte contro un iceberg, un altro pinguino o il bordo; se passa sopra una **buca di pesca** ci si tuffa. Tutti nelle buche = livello fatto. **3 livelli** sempre più difficili (fasce a 2-3, 3-5, 5-6 mosse minime; dalla seconda fascia un pinguino deve fare da sponda all'altro). Incastrati? RICOMINCIA. | 90 s | livelli risolti 1 / 2 / 3 | +6 Pietra | `minigames/pinguini.json`; livelli da `tools/pinguini_livelli.mjs` |
| **Giardino · Carpe koi** (sul ponticello rosso) | Lo stagno visto dal ponticello: dal ciliegio cadono **petali** (10 punti) e ogni tanto una **briciola d'oro** (30), uno ogni 1-1,6 s. **Tocchi il cibo**: la carpa colorata libera più vicina ci corre e lo mangia. La **carpa nera** punta il cibo che vede e lo ruba (combo azzerata): **toccala e scappa** per 1,7 s. Combo: ×2 da 5 bocconi in fila, ×3 da 10; il ciliegio fiorisce coi punti. | 60 s | 15 / 32 / 50 % dei punti di tutto il cibo con la combo piena | +6 Legno | `minigames/koi.json` |
| **Tempesta · Arrembaggio** (promontorio del faro in rovina, accanto al cannone) | **Tieni premuto**: la potenza del cannone sale e scende; **lascia**: fuoco. La palla vola a parabola (il mirino mostra la prima metà del tiro), il **vento** della tempesta la sposta e cambia a raffiche (bandiera e frecce lo dicono). Navi pirata da destra e da sinistra, una ogni 1,3-2,6 s: Galeone 10, Brigantino 20, **Sloop 40**, **Nave del tesoro 80** (piccole e veloci valgono di più). **36 palle** a partita (sparare a caso dà il bronzo, non l'oro). Fulmini che illuminano la scena. | 60 s | oro 50 %, argento 35 %, bronzo 12 % (il pilota di riferimento fa 95-100 %) | +20 Legno | `minigames/arrembaggio.json` |
| **Vulcano · Fuga dalla lava** (tra le capanne e il cratere, accanto al braciere) | Corri da solo verso destra sulle colonne di basalto sopra la lava. **Tocca** = salto, **tieni premuto** = salto lungo e più alto. Le rocce **crepate affondano** dopo il primo passo, i **geyser** bollono 0,5 s e poi eruttano (0,9 s su 2-3 s), la lava ti insegue alle spalle. Prendi **ossidiana** 10, **scintille** 25 (in alto: salto lungo), **rubini** 60. Toccare la lava o un geyser scotta: **−15 punti**, un rimbalzo in su e per 1 s non raccogli niente (non si muore mai; chi non salta mai non prende medaglie). | 60 s | oro 50 %, argento 30 %, bronzo 12 % (il pilota di riferimento fa 84-96 %) | +20 Pietra | `minigames/lava.json` |

| **Corse · Gran Premio** (all'arco del via sull'anello d'asfalto) | Dal 10 ott 2026 sul motore v2 (#173): scegli una delle 4 piste della Spiaggia e porto (Lungomare 3 giri, Baia e Porto 3 giri, Fuga dall'onda) e il veicolo della sua famiglia, tu e 4 animali piloti. Guidi con l'avatar MAREA. **Telefono in orizzontale** (in verticale compare «Ruota il telefono»): joystick sterza, in avanti è il gas (o «gas automatico»), giù frena, **DRIFT** tenuto in curva carica il turbo (3 livelli): lasci e parti; gas tenuto all'1 del semaforo = partenza razzo. | ~1:25 sul Lungomare (max 240 s) | posizione: 1° oro, 2° argento, 3° bronzo | +20 Legno | `minigames/corse.json`, `corse/motore.json`, `docs/CORSE.md` |

Punteggio: Pinguini = 1000 a livello + fino a 100 per quanto ti avvicini alla soluzione più corta (−15 a mossa in più) + 5 a secondo avanzato se li risolvi tutti; Carpe koi = i punti. Arrembaggio e Fuga dalla lava = i punti, medaglie in frazione dei punti di tutta la partita (come le Perle). Gran Premio = `30000 − centesimi` (più veloce = più alto), medaglia dalla posizione. Chi non scaccia mai la nera fa di solito argento; l'oro vuole anche lei.

Ogni minigioco: cartello regole di 3 s in italiano, si gioca con un pollice, anche chi perde prende qualcosa.

**Ondate dei Templari** (Isola dei Templari, §3): non è un minigioco ma una modalità a ondate infinite alla Call of Duty Zombies, **eccezione voluta ai 30-120 s** del pilastro 2 (dura quanto sopravvivi, 10-40 min; facoltativa come i dungeon, un pollice basta, anche chi muore subito prende qualcosa). Premio per ondata superata con tetto giornaliero. Tutto in **`docs/TEMPLARI.md`**.

## 7. Sfide e wager
> **Sospese dal 30 set 2026** per la prova con gli amici: si prova il gioco da soli e si viene premiati dai minigiochi (§5, §6). Il codice resta (Tavolo, feed, escrow) e si riaccende con `?sfide=1`; il Tavolo non compare nel pannello Costruisci.

- **Creare**: al Tavolo delle Sfide scegli minigioco, avversario, posta (Legno/Pietra/Perle, ≥ 10 e ≤ tetto del Tavolo); il seed lo genera il server; giochi subito il tuo turno. La posta va in **escrow** nel libro mastro.
- **Rispondere**: l'altro ha **24 h** per accettare (posta pari, in escrow) e giocare lo stesso seed. Punteggio più alto prende il piatto. Nessuna risposta o parità → rimborso a entrambi.
- **Colpo di coda**: se chi risponde ha meno del **50 %** delle risorse totali dello sfidante e vince, prende **1,5×**. Premia lo sfavorito, scoraggia il bullismo.
- **Gratis al giorno** 3/5/8 per livello del Tavolo; oltre, 1 Perla a sfida.
- **Invariante** (testato): somma risorse di tutti + escrow = generato − speso, sempre.

## 8. Tra amici
Mondo alla GTA: né coop né guerra. Nessuno attacca o modifica le isole altrui. Ci si vede muoversi nel Porto e in mare (presenza a 10 Hz), si visitano le isole degli altri (sola lettura), si comunica con 8 emote (fumetto sopra la testa; ruota rapida, #90) e con le sfide. Niente chat testuale in V1. Ingresso solo con link personale mandato da Jack.

**Libro degli ospiti** (#86): vicino al molo di ogni isola c'è un leggio col libro. Sull'isola di un amico **FIRMA** lascia il tuo nome e uno degli 8 saluti delle emote, **una volta al giorno** per isola; lui lo vede nella campanella («Marco è passato sulla tua isola») e nella cartolina «Mentre eri via». Sulla tua isola il libro mostra le ultime **20** firme (ne tiene **50**).

## 9. Onboarding «Primi passi» (anticipato in M1, 30 set 2026; allungato l'8 ott 2026)
Una scheda con un passo alla volta e una freccia gialla sulla meta (sopra la cosa se è in vista, sul bordo dello schermo se è fuori): **1** costruisci la Segheria (il cartello «Costruisci» evidenziato apre già la conferma) → **2** sali in barca → **3** vai alla Regata e gioca → **4** costruisci col premio → **5** fai due chiacchiere con la Gente del Porto → **6** pesca o tuffati dalla barca (minigiochi universali) → **7** guarda la mappa (il cerchio lampeggia) → **8** scopri un'isola a tema. Senza isola propria niente 1 e 4. Un passo fatto vale anche fuori ordine; SALTA salta il passo, × chiude la guida (si riaccende dalle Impostazioni). Testi corti e ironici. Sugli slot liberi dell'isola c'è sempre un cartello «Costruisci». Niente tutorial a testo lungo.

## 10. Tagli espliciti V1 (fino a dicembre 2026)
Fuori: battaglia unità, bot, puzzle, chat testuale, interni degli edifici, ciclo giorno/notte, commercio tra giocatori, apertura al pubblico, app installabile (PWA solo se gratis in tempo), musica originale, storia. Entrano dopo, uno alla volta, e solo dal `BACKLOG.md`.

## 11. Numeri
I numeri di questo documento sono la **prima ipotesi**. La verità operativa sta in `packages/content/src/balance.json`, nei json di `packages/content/src/minigames/` e (GDR) in `packages/content/src/rpg/`; quando cambiano, si aggiorna la tabella qui e si annota in `ROADMAP.md` §Deviazioni.

## 12. Mondo Sotterraneo (GDR, dal 6 ott 2026)
Sotto le isole ci sono dungeon con combattimento alla Skyrim, voluti da **Riccardo** (che ne cura il design): personaggio con Vita/Magicka/Stamina, 7 abilità, perk, forgia di armi e armature in 8 materiali, alchimia, bottino. **Facoltativo**: chi non scende gioca MAREA come prima. In superficie zero nemici. Tutto il design sta in **`docs/RPG.md`**, che vale come questo documento. Rispetto al §10: il combattimento entra (solo nei dungeon, contro la sim, mai contro gli amici); gli interni restano fuori dalla superficie.

## 13. Isola dei Templari (modalità a ondate, dall'8 ott 2026)
Isola personale di **birbasan** (tema libero, ok di Jack): crociati zombie a ondate infinite, armi da comprare coi punti della partita, porte, trappole, boss. Tutto il design sta in **`docs/TEMPLARI.md`**, che vale come questo documento. Rispetto al §1 (30-120 s) e al §10 (storia, nemici): la partita è lunga e ha una storia, ma si gioca in una scena a parte come i dungeon; nel resto dell'arcipelago restano zero nemici.
