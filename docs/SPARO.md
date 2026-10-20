# MAREA — Sparatutto a missioni (bibbia corta, banco di prova)

> Format deciso da Jack il 16 ott 2026 (issue #355). Il documento dello sparatutto; `VISIONE.md` §3 rimanda qui.
> Oggi esiste solo il **banco di prova** `provasparo.html`: il gioco non cambia. Ambientazione, storia, nemici e armi veri li decidono
> l'intervista e la concept art dopo il banco. Numeri in `packages/content/src/sparo.json`: sono la **prima ipotesi**, si tarano con Jack.

## 0. In tre righe
Uno sparatutto **in prima e in terza persona** (si cambia con un tasto) con **missioni alla Call of Duty / GoldenEye 64**: obiettivi,
un evento firma per missione, medaglie per tempo e difficoltà. Si gioca **prima di tutto da soli**, contro nemici guidati dal computer;
il **deathmatch tra amici** sulle stesse mappe è il bonus per quando ci si vede (come lo split screen di GoldenEye).

## 1. Le decisioni di Jack (16 ott 2026)
| Domanda | Scelta | Perché |
|---|---|---|
| Che format dopo le Corse | sparatutto prima/terza persona | «resto più gasato di provare a costruire uno sparatutto» |
| Da soli o con gli amici | **da soli prima**, il PvP è il bonus | «sono rarissime le volte in cui abbiamo giocato insieme» |
| Prima o terza persona | **tutte e due**, tasto V | le prova giocando e sceglie |
| Il gioco da soli | **missioni alla COD** | campagna con obiettivi; con gli amici deathmatch sulle stesse mappe |
| Da dove si parte | banco di prova nel piazzale dei container del Porto | lo Shipment di COD; si riusano i pezzi del kit delle Corse |

Bocciati nello stesso giro: party a eliminazione, nascondino, battle royale, GTA, Minecraft. Pokémon: «non male, non convince».
Piaciuti e parcheggiati in `BACKLOG.md`: Isola dello sport, Difesa del Porto, Carte della Marea, Cucina del Porto.

## 2. Le tappe del banco
| Tappa | Cosa | Stato |
|---|---|---|
| **A** | sparo e camere: il poligono coi 6 bersagli, 3 armi, prima e terza persona, succo, suoni (PC) | fatto (16 ott) |
| **B** | 6 nemici col cervello (pattuglia, allerta, copertura, aggiramento, ricerca) e la **Missione 0 · Il piazzale** | fatto (16 ott) |
| **C** | il telefono in orizzontale a due pollici, mira assistita, sparo automatico; comandi rifatti come COD Mobile (#377) | fatto (16-17 ott) |
| poi | intervista, concept art, Missione 1 vera, isola nell'arcipelago, deathmatch tra amici | da fare |

## 3. Come si gioca (Tappa A)
- **PC**: clic per catturare il mouse; WASD muovi, mouse mira, clic spara, tasto destro mira (zoom), R ricarica, Spazio salta, C accucciato
  (resta), Ctrl accucciato (finché tieni), Shift corri, 1-2-3 o rotella armi. V prima/terza persona, H pixel/HD, T pilota automatico,
  M muto, P pausa, Invio ricomincia. Pannello «⚙ prove» in alto a destra: camera, grafica, sensibilità del mouse, campo visivo.
- **Movimento**: passo 4,6 m/s, corsa 6,6 (solo in avanti, non in mira, non sparando), accucciato 2,3, in mira × 0,62. Si sale su casse e
  barriere saltando (non camminando); sulla base della gru col gradino.
- **Vita**: 100, torna da sola dopo 4 s senza colpi (40 al secondo), come in COD.
- **Colpi**: raggio dagli occhi lungo la mira, sparpagliato nel cono della dispersione; si ferma sulla faccia della prima scatola
  (container, cassa, barriera, gamba della gru), sulla banchina, sul mare o su un corpo (cilindro fino al collo + sfera della testa).
  Alla testa vale di più; oltre una distanza il danno cala.
- **Terza persona**: la camera sta dietro la spalla destra; il colpo parte dagli occhi verso il punto che sta al centro dello schermo.

| Arma | Danno | Testa | Cadenza | Caricatore | Ricarica | Note |
|---|---|---|---|---|---|---|
| Pistola | 30 | ×2 | 0,14 s, un colpo a pressione | 12 (+96) | 1,25 s | precisa (1,4° dal fianco, 0,25° in mira) |
| Mitra | 24 | ×2 | 0,085 s, automatico | 30 (+180) | 1,9 s | rinculo che sale coi colpi di fila |
| Pompa | 9 × 13 | ×1,5 | 0,8 s | 6 (+36) | 0,5 s a colpo | sparare interrompe la ricarica |

## 3b. I nemici (Tappa B)
- **Calmi**: cinque fanno la ronda (giri in `sparo.json` → `mappa.nemici`), uno sta di guardia alla barca e si guarda intorno. Ti vedono
  solo nel loro cono (130°, fino a 40 m; più vicino di 4,5 m anche alle spalle). Accucciato dietro una cassa non ti vedono, a meno che
  tu non abbia appena sparato.
- **Allerta**: chi ti vede chiama i compagni entro 14 m; gli spari si sentono fino a 22 m; chi viene colpito sa da dove. Si girano verso
  di te e dopo 0,35-0,7 s decidono.
- **In combattimento**: uno ti aggira (va dove ti vede, ad almeno 65° dagli altri, tra 7 e 14 m); gli altri corrono al riparo che li
  nasconde da te (dietro un container in piedi, dietro una cassa accucciati), restano 1,2-2,6 s e poi escono a sparare raffiche di 3-6
  colpi. Errore della mira da 7° a 1,8° in 2,2 s che ti seguono; +2,5° se si muovono, +1,6° se corri. 8 di danno a colpo (×1,5 alla
  testa). Niente fuoco amico.
- **Persi di vista** per 6 s vengono a cercarti dove ti hanno visto; dopo 9 s di ricerca tornano di ronda.

## 3c. Dal telefono (Tappa C, comandi rifatti come COD Mobile il 17 ott, #377)
In orizzontale (in verticale compare «GIRA IL TELEFONO» e la partita si ferma). Lo schema è quello della **modalità Avanzata di COD
Mobile**, perché il primo giro faceva «o mirare o sparare» (MIRA si teneva premuto sullo stesso pollice di SPARA).
- **Pollice sinistro**: joystick fermo in basso a sinistra, si sposta dove appoggi il dito. Spinto in fondo in avanti = corri; portato
  oltre, fino al **lucchetto CORSA**, la corsa resta anche lasciando il dito (si sblocca toccando di nuovo il joystick). Sopra il joystick
  lo **SPARA sinistro**: spara e basta, così il pollice destro resta libero per mirare.
- **Pollice destro**: trascini ovunque sulla metà destra per mirare. Lo **SPARA destro** è fisso e ci si trascina sopra per mirare mentre
  spari. **Spara e mira** (lo «ADS fire»): tenere SPARA mette anche in mira con pistola e mitra; il pompa spara dal fianco. **MIRA** si
  accende e si spegne a tocco (resta). Anche MIRA, SALTA e GIÙ si trascinano per mirare. RICARICA, ARMA (la prossima), AZIONE alla gru.
- **Aiuti**, accesi di serie e spegnibili dal pannello «⚙ prove» (con «spara e mira»): **mira assistita** (la mira si attacca un filo al
  nemico vicino al mirino quando ti muovi o trascini, e rallenta del 35% quando il mirino ci passa sopra) e **sparo automatico** (spara da
  solo quando il mirino è su un nemico in vista).
- Ogni dito sa a cosa appartiene da quando tocca, e lo seguono gli ascoltatori della finestra: il dito che trascina su SPARA non si perde
  se esce dal bottone. Munizioni in basso al centro.

## 4. Il piazzale (Missione 0)
42 × 44 m di banchina, il mare a sud. Muro di container impilati su tre lati, nove container dentro (alcuni a due piani), la gru rossa
al centro (la base si sale), otto casse e quattro barriere (coperture basse: proteggono chi sta accucciato, non chi sta in piedi), la
barca a vela ormeggiata al bordo sud (l'uscita della missione). Disposizione in `sparo.json` → `mappa.oggetti`: la stessa per la sim e
per la resa.

**La missione**: briefing («clicca/tocca per iniziare») → **elimina le 6 sentinelle** → **sabota la gru** (tieni AZIONE 3 s nel cerchio ai
suoi piedi; intanto non spari, se lasci si ricomincia) mentre arrivano **3 rinforzi** già in allerta → **raggiungi la barca**. Il
segnalino giallo coi metri indica gru e barca. Medaglia dal tempo: oro entro 2:00, argento entro 3:20, poi bronzo. A terra: «SEI
CADUTO», RIPROVA. Su PC con Esc la partita si ferma. Il pilota automatico (un tiratore perfetto) la finisce in ~25 s.

## 5. Regole per chi ci lavora
- La sim sta in `packages/sim/src/sparo/` ed è pura come il resto (`check_static`): la casualità è un intero nello stato (mulberry32),
  la mira viaggia quantizzata (8192 passi al giro), così più avanti il server potrà rigiocare missioni e medaglie.
- Il look segue `ART_BIBLE.md`: colori della palette, niente sfumature lisce (la base della gru del kit, a colori per vertice, faceva
  una sfumatura: è rifatta a blocchi), passata pixel a metà risoluzione (H = HD per confrontare).
- Budget: ≤ 100 draw call e ≤ 150.000 triangoli al telefono (test `m4_provasparo`). Solo il corpo dei soldati fa ombra (ogni pezzo
  che fa ombra costa un draw call in più).
