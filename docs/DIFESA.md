# MAREA — Difesa a corsie (bibbia corta, banco di prova)

> Format ripreso da Jack il 16 ott 2026 (issue #358): «qualcosa come Plants vs Zombies». Vale come il GDD per la Difesa; `VISIONE.md` §3
> rimanda qui. Oggi esiste solo il **banco di prova** `provadifesa.html`: il gioco non cambia. Numeri in
> `packages/content/src/difesa.json`, con due profili: `pvz` (l'originale, per verificare che la sim faccia le stesse cose) e `marea` (i
> nostri, che si tarano con lo strumento di bilanciamento e con Jack).

## 0. In tre righe
Un **tower defense a corsie alla Plants vs Zombies**: il campo ha 5 corsie × 9 caselle, i nemici entrano da destra e camminano verso la
tua base a sinistra, tu metti difensori nelle caselle spendendo una valuta che cade dal cielo e che producono alcuni difensori. Si gioca
**da soli**, a livelli, con una novità per livello; poi la Sopravvivenza infinita. L'isola della Difesa avrà **più mondi**, ognuno con
ambientazione e stile suoi (non per forza pirati o zombie).

## 1. Le decisioni di Jack (16 ott 2026)
| Domanda | Scelta | Perché |
|---|---|---|
| Che format | tower defense a corsie alla PvZ | «qualcosa come Plants vs Zombies» |
| Ambientazione e stile | diversi per ogni mondo; il primo lo sceglie dal foglio di 9 prove fatte con Codex | «ci saranno varie ambientazioni, stili» |
| Telefono | **in orizzontale**, come PvZ (in verticale: «GIRA IL TELEFONO») | il layout dell'originale, nemici di profilo |
| Link agli amici | **dopo** lo stile scelto e il suo ok sugli screenshot | niente grafica online senza il suo sì |
| Regole della prima prova | fedeli a PvZ; le varianti nostre (es. la marea che sposta il campo) dopo | prima un gioco che diverte, poi le idee |

## 2. Reverse engineering: come funziona Plants vs Zombies
**Fonti.** Il codice del gioco originale ricostruito dalla comunità (decompilazione della versione GOTY,
[Patoke/re-plants-vs-zombies](https://github.com/Patoke/re-plants-vs-zombies): `Lawn/Board.cpp`, `Zombie.cpp`, `Plant.cpp`,
`Projectile.cpp`, `Coin.cpp`, `Challenge.cpp`, `GameConstants.h`, `Sexy.TodLib/TodCommon.cpp`), confrontato con
[plantsvszombies.wiki.gg](https://plantsvszombies.wiki.gg/wiki/Plants_(PvZ)) e [StrategyWiki](https://strategywiki.org/wiki/Plants_vs._Zombies/Plants);
il talk di George Fan alla GDC 2012 «How I Got My Mom to Play Through Plants vs. Zombies». Si prendono **numeri e regole**, riscritti a
parole nostre: niente codice copiato. Il gioco aggiorna 100 volte al secondo; qui sotto i tempi sono già in secondi. Il prato è 9 colonne
× 5 corsie, una casella è 80 × 100 px.

### 2.1 L'economia (il sole)
- **Si parte con 50** (150 nel primissimo livello, quello del tutorial).
- **Dal cielo**, di giorno: il primo sole dopo 4,25-7 s; poi ognuno dopo `min(9,5 s; 4,25 s + 0,1 s × soli già caduti) + 0-2,75 s a caso`.
  All'inizio ne cade uno ogni ~5,6 s (~270 al minuto), dopo una cinquantina uno ogni ~10,9 s (~140 al minuto). Vale **25**; a terra resta
  **7,5 s**, poi sparisce. Nel tutorial il cielo aspetta che tu abbia piantato.
- **Girasole**: costa 50; il primo sole dopo 3-12,5 s, poi uno ogni 23,5-25 s → ~62 al minuto, si ripaga in ~30-40 s.
- **Ricariche** delle carte: veloce 7,5 s, lenta 30 s, lentissima 50 s. Comprare costa sole **e** tempo: è il secondo freno.

### 2.2 Le piante del primo mondo
| Pianta | Costo | Ricarica | Vita | Cosa fa |
|---|---|---|---|---|
| Sparapiselli | 100 | 7,5 s | 300 | 20 danni ogni 1,36-1,5 s (media 1,43); il pisello vola a 333 px/s (4,2 caselle/s); spara solo se nella sua corsia c'è uno zombie |
| Girasole | 50 | 7,5 s | 300 | 25 sole ogni 23,5-25 s |
| Ciliegia esplosiva | 150 | 50 s | — | dopo ~1 s, 1800 danni nel 3 × 3 attorno |
| Noce | 50 | 30 s | 4000 | blocca: uno zombie ci mette 40 s a mangiarla |
| Patata mina | 25 | 30 s | 300 | si arma in 15 s; armata, 1800 danni a chi la calpesta |
| Sparapiselli gelido | 175 | 7,5 s | 300 | 20 danni + gelo per 10 s: passo e morsi a metà |
| Mangiatutto · Ripetitore | 150 · 200 | 7,5 s | 300 | (nei livelli dopo: mangia uno zombie intero · due piselli a colpo) |

Tutte le piante normali hanno 300 di vita: **i muri sono l'eccezione** (4000 la noce, 8000 la noce alta).

### 2.3 Gli zombie del primo mondo
| Zombie | Vita | Passo | Punti | Dal livello | Dall'ondata | Peso |
|---|---|---|---|---|---|---|
| Base | 270; la testa cade dopo 181 di danno (non morde più e muore poco dopo): **bastano 10 piselli** | 5,3-7,4 s a casella, a caso per ogni zombie | 1 | 1-1 | 1 | 4000 |
| Bandiera | 270 | 3,8 s a casella | 1 | solo nelle ondate bandiera | — | 0 |
| Cono | 270 + 370 di cono | come il base | 2 | 1-3 | 1 | 4000 |
| Saltatore | 500 | corre a 2,5 s a casella, **salta la prima pianta**, poi cammina | 2 | 1-6 | 5 | 2000 |
| Secchio | 270 + 1100 di secchio | come il base | 4 | 1-8 | 1 | 3000 |

- **Morso**: 4 di danno ogni 4 centesimi = **100 di danno al secondo**. Uno sparapiselli dura 3 s, una noce 40 s. Gelato morde la metà.
- L'armatura (cono, secchio) prende i colpi prima del corpo; quando cade lo zombie torna un base.
- Gli zombie delle ondate bandiera partono 0,5 caselle più indietro (fuori dallo schermo).

### 2.4 Le ondate: il cuore del bilanciamento
- **Quante**: nel primo mondo 4, 6, 8, 10, 8, 10, 20, 10, 20, 20 ondate per livello.
- **Budget a punti**: l'ondata n (contando da 0) vale `n ÷ 3 + 1` punti (intero, per difetto). Ogni zombie costa i suoi punti; si pesca a
  caso, coi pesi, tra i tipi ammessi in quel livello e da quell'ondata che costano non più dei punti rimasti, finché i punti finiscono.
- **Ondata bandiera** («ONDATA ENORME»): l'ultima di ogni gruppo di 10 (se il livello ne ha meno di 10, l'ultima). Budget × 2,5, e in più
  `min(budget, 8)` zombie base e lo zombie con la bandiera; 7,5 s di avviso con la sirena. Nel livello 1-1 niente bandiera.
- **Zombie nuovo del livello**: compare apposta a metà livello e nell'ultima ondata; nell'ultima ondata ci sono tutti i tipi del livello.
- **Tempi**: la prima ondata dopo 18 s (50 s nel 1-2, per piantare i primi girasoli); poi 25-31 s tra un'ondata e l'altra, **ma l'ondata
  dopo arriva in 2 s quando quella in corso è scesa sotto il 50-65 % della vita con cui è entrata** (soglia a caso), purché siano passati
  almeno 4 s. Chi difende bene accelera il livello, chi soffre ha più respiro: è un **elastico** invisibile.
- **Corsia «liscia»**: la corsia di ogni zombie è a caso, ma il peso di ogni corsia cresce con le scelte passate dall'ultima e dalla
  penultima volta che è uscita: niente tre zombie di fila nella stessa corsia per sfortuna, nessuna corsia dimenticata.
- **Pietà dopo il tosaerba**: la corsia salvata dal tosaerba riceve l'1 % del peso nell'ondata dopo e il 50 % in quella dopo ancora.
- **Corsie aperte**: 1-1 solo quella in mezzo; 1-2 e 1-3 le 3 in mezzo; dal 1-4 tutte e 5.
- **Una pianta nuova a livello**: 1-1 sparapiselli, 1-2 girasole, 1-3 ciliegia, 1-4 noce, 1-5 minigioco (bowling con le noci), 1-6 patata
  mina, 1-7 gelido, 1-8 mangiatutto, 1-9 ripetitore, 1-10 livello col nastro trasportatore (niente sole: le carte arrivano da sole).
- **Tutorial**: nel 1-1 gli zombie e il sole aspettano che tu abbia raccolto e piantato il primo sparapiselli.

### 2.5 La Sopravvivenza
5 bandiere (normale) o 10 (difficile); il budget continua a salire, `(fase × ondate per fase + n) × 2 ÷ 5 + 1`. Nella Sopravvivenza
infinita il peso degli zombie facili cala piano (il base fino a 1/10, il cono fino a 1/4 dopo 50 bandiere) e i difficili arrivano prima.

### 2.6 Le regole di George Fan (GDC 2012)
- Si insegna **giocando**: messaggi corti (massimo 8 parole), che **non fermano** il gioco.
- **Una novità per livello**, e il livello è costruito per usarla subito.
- I primi livelli sono quasi impossibili da perdere; la difficoltà vera arriva quando il giocatore conosce già gli strumenti.
- Il gioco sembra profondo ma si capisce in un attimo: un clic per prendere, un clic per mettere.

### 2.7 I rapporti: perché funziona
| Rapporto | Valore | Cosa dice |
|---|---|---|
| Danno al secondo di uno sparapiselli | 14 per 100 sole | il metro di tutto |
| Vita per sole della noce | 80 (contro 3 dello sparapiselli) | il muro costa poco e compra tempo |
| Piselli per uccidere base · cono · secchio | 10 · 28 · 65 | il secchio vale 4 punti ma costa 6,5 base |
| Secondi di un solo sparapiselli per base · cono · secchio | 14 · 40 · 93 | contro il secchio servono 2-3 tiratori o un muro |
| Caselle che lo zombie fa intanto | ~2,3 · ~6,4 · ~15 | un tiratore solo ferma il base, non il cono |
| Tempo per attraversare il prato | ~45-65 s | lo spazio è tempo |
| Sole al minuto | cielo ~270 → ~140, girasole ~62 | dopo 3-4 minuti l'economia la fanno i girasoli |
| Ripago del girasole | ~30-40 s | piantarli presto vince; piantarli tardi no |

### 2.8 Altri giochi del genere (spunti per dopo, da verificare quando servono)
- **PvZ 2**: un potere a scelta per pianta (il «cibo»), ricariche più corte, zombie diversi per mondo, molti livelli-sfida con regole
  speciali (proteggi le piante, non perdere più di N piante…).
- **Kingdom Rush**: chiamare l'ondata prima dà monete e accorcia le ricariche dei poteri; premia chi è bravo senza punire chi non lo è.
- **Bloons TD 6**: soldi a ogni nemico colpito, round scritti a mano, difficoltà che cambia i prezzi.

## 3. Cosa prendiamo per il banco
(si completa con la sim e lo strumento di bilanciamento: profilo `marea`, i 6 livelli, la Sopravvivenza e le bande.)
