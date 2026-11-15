> Isola dei Templari, §6-§8: armi (tabelle), scudo templare, Mercante e Strega, nemici e boss. Gli eroi e i loro bonus d'arma: [§4b](4-5-partita-eroi-controlli.md); il resto nell'[indice](../TEMPLARI.md).

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
