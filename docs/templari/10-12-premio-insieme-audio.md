> Isola dei Templari, §10-§12: premio (monete e tetto), partita insieme fino a 4, audio, cose ancora da decidere. Come funziona sotto: [§13](13-sotto.md); il resto nell'[indice](../TEMPLARI.md).

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
