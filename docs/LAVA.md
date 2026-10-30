# Fuga dalla lava (Isola Vulcano)

Corsa senza fine a scorrimento laterale, a **schermo intero**, con un dito solo. Nata guardando come funziona Super Mario Run; di quel gioco
prende le regole del movimento, non niente altro (personaggio, grafica, nomi e musica sono di MAREA). Da questo documento vale tutto quello
che segue; la riga sintetica sta in `GDD.md` §6, i numeri in `packages/content/src/minigames/lava.json`.

## 1. In tre righe
- Corri da solo verso destra su colonne di basalto sopra un mare di lava. **Tocca** = salto, **tieni** = più alto, **in aria** tocca ancora = giravolta.
- Un **muro di lava** ti insegue. Colpi e tuffi nella lava gli fanno guadagnare terreno; se ti raggiunge sei bruciato. Non c'è altro modo di perdere.
- Punti = tile corsi + gemme + trucchi. **Classifica** tra amici (oggi e di sempre), verificata dal server rigiocando gli input.

## 2. Super Mario Run: com'è fatto (analisi a scatola nera)
Fatta da fuori, da fonti pubbliche ([Mario Wiki](https://www.mariowiki.com/Super_Mario_Run), [Toad Rally](https://www.mariowiki.com/Toad_Rally),
[analisi su Game Developer](https://www.gamedeveloper.com/design/the-brilliance-of-super-mario-run)) e dal comportamento del gioco; nessun
codice o asset di Nintendo è stato guardato o copiato.

**Il principio.** Tutto è pensato per una mano sola: Mario corre da solo a velocità quasi costante e l'unico gesto è il *quando* saltare. Il
gioco toglie il resto di Mario (correre, frenare) e tiene il suo cuore, il tempismo.

**Cosa lo fa sentire bene** (è quello che abbiamo ricostruito):
| Meccanica di SMR | Perché funziona | Da noi |
|---|---|---|
| Salto variabile: tocco corto = saltello, tenuto = alto | un gesto solo, mille altezze | gravità in salita bassa finché tieni, alta quando lasci (tocco corto ≈ 1,7 tile, tenuto ≈ 4,5) |
| **Scavalco automatico** di ostacoli bassi e nemici piccoli | gli ostacoli non spezzano il ritmo; toccare nel momento giusto dà un bonus | scavalchi da solo fino a 2 tile; un tocco entro 12 tick = «scavalco bello» (+10, salto più alto) |
| **Presa del bordo**: se sbatti sul bordo di una piattaforma ti tiri su | perdona il salto corto di un soffio | se i piedi sono a ≤ 12 px dal bordo sali senza colpo |
| **Giravolta** in aria (un tocco in più allunga la permanenza) | recuperi un errore | una per salto, spinta corta; vicino a terra il tocco resta «prenotato» e salta all'atterraggio |
| **Rimbalzo** sui nemici, più alto se tieni premuto; catena 1, 2, 4 monete | rischio e premio in verticale | catena 10, 20, 40 punti |
| **Bolle**: se cadi o ti colpiscono galleggi indietro, perdi 5 monete, hai 2 vite per percorso | l'errore costa ma non butta via la partita | il muro di lava: ogni colpo o tuffo toglie vantaggio, che si ricarica correndo |
| **Monete come guida**: archi che disegnano la traiettoria del salto | il percorso si legge senza testo | le gemme sono archi calcolati sulla fisica, non a caso |
| Tempo limite per percorso (60-90 s) | niente prove infinite | la lava è il tempo: non fermarsi mai |
| **Toad Rally**: 1 minuto, percorso fatto di pezzi dei livelli messi in fila a caso, contro il fantasma di un altro, moltiplicatori per i «trucchi» (rotolo, scavalco, salti sul muro) | una sfida asincrona che sembra una gara | percorso a pezzi dal seed; trucchi che danno punti; classifica tra amici |

**Cosa NON copiamo:** Mario e i suoi nemici, la grafica, i suoni, il nome, i blocchi con le loro regole (pausa, frecce, blocchi del tempo),
la salita sui muri a rimbalzo e i livelli a bandiera. Il salto sul muro, i blocchi pausa e il tempo extra non servono a una corsa dove
la lava fa da orologio.

## 3. Corsa senza fine o livelli? Corsa senza fine
Perché, in ordine di peso:
1. **La lava è già un timer che insegue.** Con i livelli il muro sarebbe un contorno; senza fine è tutto il gioco.
2. **La classifica ha senso solo così.** In un livello tutti arrivano in fondo e resta il tempo; in una corsa senza fine il punteggio non ha soffitto.
3. **Costa un decimo.** Un livello a mano è ore di lavoro e si consuma in un minuto; un pezzo di percorso lavora per sempre, e la sim ha già
   seed, replay e verifica del server. (Il Toad Rally di Nintendo stesso è una corsa a pezzi: segno che regge.)
4. **Dà più voglia di riprovare**, perché ogni corsa è diversa e la tua misura è il tuo record.

I livelli (stile World Tour: traguardo, monete rosa da prendere tutte, tempo) restano possibili sullo stesso motore: basta un percorso a
pezzi scelti a mano invece che dal mazzo. Sono in `BACKLOG.md`.

## 4. Come funziona
**Mondo.** Pixel: tile = 16, la lava sta a y = 0 e il resto è negativo. Rocce a tile interi, alte 1-6; buchi che sono sempre saltabili.
**Corsa.** Parti a 1,75 px/tick (6,6 tile/s) e sali fino a 2,45 (9,2) in 900 tile. La velocità dipende dal punto del percorso, non dal tempo: così il
generatore sa quanto è lungo un salto lì e dimensiona i buchi (2-6 tile).
**Il muro.** Vantaggio 100 px, ricarica lenta mentre corri (7 % della tua velocità); colpo −40 px e ti rallenta per 0,75 s; tuffo −54 px e ti rimette in
aria sopra la prossima roccia. Chi sta fermo davanti a un muro alto viene raggiunto: non serve altro per perdere.
**Pezzi.** Mazzo di 14 pezzi (fossa, gradino, spuntoni, magmini, trincea, isolotti, sfiato di geyser, mensola, muro alto, scalinata, ponte…),
pesati per livello: ogni 120 tile entra un livello nuovo, fino al quarto; dal terzo qualche pezzo viene senza riposo in mezzo. Ogni pezzo ha il
suo respiro di roccia piana prima.
**Punti.** 1 per tile corso; ossidiana 2, scintilla 10, rubino 50; scavalco bello +10; nemico 10 / 20 / 40 in catena; colpo −10, tuffo −20.
Medaglie a soglie fisse: bronzo 250, argento 700, oro 1500. Fino a 180 s (poi «Traguardo!»). Il pilota di riferimento arriva al traguardo senza colpi.
**Classifica.** Il DO `Sfide` tiene per gioco e periodo il miglior punteggio di ciascuno (`punteggiStore.ts`; regole pure in
`sim/economy/classifica.ts`); il Worker la manda coi nomi dopo ogni partita (`classifica` in `POST /api/solo/play`) e a richiesta (`GET /api/classifica?minigame=lava`).
Si mostra all'ingresso (i primi tre di oggi) e nella scheda finale (oggi / di sempre, la tua riga evidenziata). Gli altri giochi possono entrare
aggiungendo il loro id a `CON_CLASSIFICA`.
**Seed.** Ogni partita ha il suo seed scelto dal server: nessuno può imparare il percorso a memoria.

## 5. Il feeling: cosa conta e dove sta
Il gioco vive di questo; sono tutte regole del tick, quindi uguali per il client, il pilota e il replay del server.
- **Coyote** 6 tick e **salto prenotato** 6 tick; un tocco più corto di un tick non si perde (il client lo tiene in sospeso fino al tick dopo).
- **Gravità a tre velocità**: salita tenuta 0,20, salita lasciata 0,55, discesa 0,42: il salto sale morbido e cade deciso.
- **Il corpo perdona**: i pericoli hanno una scatola più stretta dei piedi; i piedi atterrano anche sul bordo.
- **Niente morte secca**: ogni errore ha un prezzo leggibile (il muro si avvicina, il bordo diventa rosso) e un modo di rimediare.
- **Disegno a metà tra due tick** (60 Hz fissi, ma lo schermo può essere a 120): niente scatti. Camera con la lava sempre in vista.
- **Risposta**: polvere al salto e all'atterraggio, giravolta che ruota, scosse e lampo sul colpo, vibrazione sul telefono, quattro suoni nuovi
  (atterra, giravolta, scavalco, calpesta) più i vecchi; rombo quando il muro è vicino.
- **Schermo intero a pixel interi**: il pixel grosso è il più grande intero che lascia vedere almeno 176×150 px di mondo (a 390×844 è 2, 11 tile in larghezza).

## 6. File e prove
`packages/sim/src/minigames/`: `lava.ts` (partita, punti), `lava_fisica.ts` (un tick di corsa), `lava_percorso.ts` (mazzo e gemme), `lava_pilota.ts`.
La sim non sta nel registro del client (`lava_registra.ts`, come le Corse): la caricano il server, i test e la schermata della lava, così il JS iniziale non cresce.
Client `apps/client/src/ui/`: `lava.ts` (schermata e input), `lava_vista.ts` (disegno), `lava_effetti.ts`, `lava_sprite.ts`, `lava_scheda.ts` (ingresso e scheda).
Server: `do/punteggiStore.ts`, `do/Sfide.ts`, `porto_amici.ts`. Test: `sim/test/lava.test.ts` (la fisica in numeri, il pilota, il replay),
`tests/e2e/m3_giochi_tempesta_vulcano.mjs` (schermo intero, classifica). In locale `?test=1&net=0`, `__game.test.temiProva('tutte')`,
`playSpot('lava:vulcano')`, `lavaFinoA(tick)`, `lavaAuto(true)`.

## 7. Aperto
- Le soglie delle medaglie sono tarate sul pilota (che fa ~3.400) e su un pilota con 0,17 s di ritardo (700-1.500): vanno riviste con le corse di chi gioca.
- Nemici volanti, trampolini, piattaforme mobili e un power-up (lanterna-scudo) non ci sono ancora: il motore li regge, il mazzo no.
