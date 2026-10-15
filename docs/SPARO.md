# MAREA — Sparatutto a missioni (bibbia corta, banco di prova)

> Format deciso da Jack il 16 ott 2026 (issue #355). Vale come il GDD per lo sparatutto; `VISIONE.md` §3 rimanda qui.
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
| **B** | 6 nemici col cervello (pattuglia, allerta, copertura, aggiramento, ricerca) e la **Missione 0 · Il piazzale** | da fare |
| **C** | il telefono in orizzontale a due pollici, mira assistita, sparo automatico | da fare |
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

## 4. Il piazzale (Missione 0)
42 × 44 m di banchina, il mare a sud. Muro di container impilati su tre lati, nove container dentro (alcuni a due piani), la gru rossa
al centro (la base si sale), otto casse e quattro barriere (coperture basse: proteggono chi sta accucciato, non chi sta in piedi), la
barca a vela ormeggiata al bordo sud (l'uscita della missione). Disposizione in `sparo.json` → `mappa.oggetti`: la stessa per la sim e
per la resa.

## 5. Regole per chi ci lavora
- La sim sta in `packages/sim/src/sparo/` ed è pura come il resto (`check_static`): la casualità è un intero nello stato (mulberry32),
  la mira viaggia quantizzata (8192 passi al giro), così più avanti il server potrà rigiocare missioni e medaglie.
- Il look segue `ART_BIBLE.md`: colori della palette, niente sfumature lisce (la base della gru del kit, a colori per vertice, faceva
  una sfumatura: è rifatta a blocchi), passata pixel a metà risoluzione (H = HD per confrontare).
- Budget: ≤ 100 draw call e ≤ 150.000 triangoli al telefono (test `m4_provasparo`). Solo il corpo dei soldati fa ombra (ogni pezzo
  che fa ombra costa un draw call in più).
