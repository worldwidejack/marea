# MAREA — Difesa a corsie (bibbia corta)

> Format ripreso da Jack il 16 ott 2026 (issue #358): «qualcosa come Plants vs Zombies». Il documento della Difesa; `VISIONE.md` §3
> rimanda qui. La pagina è `difesa.html`: si apre da sola o dal cancello dell'isola (§6). Numeri in
> `packages/content/src/difesa.json`, con due profili: `pvz` (l'originale, per verificare che la sim faccia le stesse cose) e `marea` (i
> nostri, che si tarano con lo strumento di bilanciamento e con Jack).

## 0. In tre righe
Un **tower defense a corsie alla Plants vs Zombies**: il campo ha 5 corsie × 9 caselle, i nemici entrano da destra e camminano verso la
tua base a sinistra, tu metti difensori nelle caselle spendendo una valuta che cade dal cielo e che producono alcuni difensori. Si gioca
**da soli**, a 12 livelli, con una novità per livello; poi la Sopravvivenza infinita. L'isola della Difesa avrà **più mondi**, ognuno con
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
**Regole e numeri: quelli di PvZ.** Il profilo `marea` per ora non cambia niente (`"marea": {}` in `difesa.json`): la prima prova deve
divertire come l'originale; la taratura nostra arriva dopo il giro con gli amici, con lo strumento qui sotto.

| PvZ | Da noi (id) | Nome e aspetto |
|---|---|---|
| Sparapiselli · Girasole · Ciliegia · Noce · Patata · Gelido | `sparatore` · `produttore` · `bomba` · `muro` · `mina` · `gelo` | li dà la pelle (lo stile scelto) |
| Zombie base · bandiera · cono · saltatore · secchio | `base` · `bandiera` · `cono` · `saltatore` · `secchio` | idem |
| Mangiatutto · Ripetitore · Noce alta · Torcia | `mangiatutto` · `ripetitore` · `muroAlto` · `potenziatore` | Dionea · Cetriolo gemello · Zucca gigante · Pannocchia ardente |
| (nostro) | `mortaio` | Melone mortaio |
| Zombie col giornale · col palloncino · Gargantuar | `scudo` · `volante` · `gigante` | Bruco con lo scudo · Vespa · Maggiolino gigante |
| Sole · tosaerba | valuta · tosaerba | idem |

**I 12 livelli** (una novità per livello, come 1-1 → 1-8 senza il bowling; i primi 6 qui, i livelli 7-12 sotto):
| Livello | Corsie | Novità | Ondate | Nemici |
|---|---|---|---|---|
| 1 Il primo giorno | 1 | sparatore (tutorial: si parte con 150, niente arriva finché non pianti) | 4 | base |
| 2 Arriva il raccolto | 3 | produttore (prima ondata dopo 50 s) | 6 | base |
| 3 Il botto | 3 | bomba | 8 | + cono |
| 4 Tutto il campo | 5 | muro | 10 | base, cono |
| 5 Chi salta | 5 | mina | 10 | + saltatore |
| 6 La grande ondata | 5 | gelo | 20 (2 bandiere) | + secchio |
| 7 Il boccone | 5 | mangiatutto | 12 | + bruco con lo scudo |
| 8 Doppio colpo | 5 | ripetitore | 14 | + vespa |
| 9 L'alto muro | 5 | muro alto (saltatori ×3) | 16 | — |
| 10 Pannocchie accese | 5 | potenziatore | 16 | — |
| 11 Pioggia di meloni | 5 | mortaio | 20 (2 bandiere) | — |
| 12 Il maggiolino | 5 | — (tutte le carte) | 20 (2 bandiere) | + maggiolino gigante |

### 3.1 Le novità dei livelli 7-12 (numeri in `difesa.json`, profilo `pvz`)
Dove PvZ ha l'equivalente i numeri sono i suoi; il mortaio e la vespa sono nostri. Le carte sbloccate salgono fino
a 11, ma se ne portano al massimo 8: vedi «Scegliere le carte» in §4.
| Cosa | Costo · ricarica · vita | Come funziona |
|---|---|---|
| **Dionea** `mangiatutto` | 150 · 7,5 s · 300 | inghiotte intero (armatura compresa) il nemico di terra davanti a sé, fino a 0,9 caselle oltre la sua; poi digerisce 42 s fermo. Non inghiotte il maggiolino né chi vola. |
| **Cetriolo gemello** `ripetitore` | 200 · 7,5 s · 300 | come il tiratore ma due colpi alla volta (40 di danno per volta, a 0,4 caselle uno dall'altro). |
| **Zucca gigante** `muroAlto` | 125 · 30 s (20 s all'inizio) · 8000 | muro altissimo: la cavalletta non lo scavalca, si ferma a mangiarlo (resta a camminare piano dopo). |
| **Pannocchia ardente** `potenziatore` | 175 · 7,5 s · 300 | i colpi dritti che le passano sopra fanno ×2 (di fuoco) e perdono il gelo; una volta sola per colpo. Va messa a destra dei tiratori. |
| **Melone mortaio** `mortaio` | 175 · 12 s (8 s all'inizio) · 300 | ogni ~3,2 s tira un colpo in arco sul nemico di terra più avanzato di QUALSIASI corsia, ma non entro 2,2 caselle da sé (zona morta). Il colpo ci mette 0,8 s + 0,1 s a casella, cade dove il bersaglio sarà; 60 di danno entro 0,5 caselle, 30 di splash fino a 1 casella. Non prende chi vola. |
| **Bruco con lo scudo** `scudo` | 270 + 250 di foglia · punti 3 · dall'ondata 3 | caduta la foglia resta fermo 0,6 s e poi va 2,5 volte più veloce. |
| **Vespa** `volante` | 200 · punti 3 · dall'ondata 4 · passo 0,16-0,21 | vola sopra i difensori senza morderli: la fermano i colpi dritti, la bomba e l'annaffiatoio; mina, ravanello e mangiatutto non la toccano; il mortaio non la prende. |
| **Maggiolino gigante** `gigante` | 3000 · punti 10 · dall'ondata 8 · passo 0,09-0,115 | schiaccia: morde a 900 al secondo (un difensore normale cade subito, il cavolo in 4 s). Niente testa che cade, la mangiatutto non lo inghiotte. Esce nelle bandiere e nell'ultima ondata. |
Nel livello 9 il peso dei saltatori è ×3 (`pesi` nel livello) per far provare la zucca gigante.

**Sopravvivenza**: 5 corsie, tutte le 11 carte e tutti i nemici, si parte con 150, ondate infinite col budget della Sopravvivenza; il record sono le ondate.

**Bilanciamento** (`node tools/difesa_bilancio.mjs --semi 200`, 16 ott, profilo marea = pvz). Tre giocatori finti: il **bravo** pianta al
posto giusto e raccoglie subito; il **medio** ragiona ogni ~1 s e sbaglia casella una volta su 7; il **distratto** reagisce ogni ~2 s, perde
il 30 % delle monete, mette i difensori un po' a caso e non usa mine.
| Livello | Bravo vince | Medio vince | Distratto vince | Durata | Tosaerba (distratto) |
|---|---|---|---|---|---|
| 1 | 100 % | 100 % | 100 % | 1,3 min | 0 |
| 2 | 100 % | 100 % | 100 % | 2,5 min | 0 |
| 3 | 100 % | 100 % | 89 % | 2,7 min | 0,4 |
| 4 | 100 % | 100 % | 71 % | 3,6 min | 1,2 |
| 5 | 100 % | 99,5 % | 61 % | 3,7 min | 1,8 |
| 6 | 100 % | 98,5 % | 37 % | 6,5 min | 2,0 |
| Sopravvivenza | 41 ondate | 39 ondate | 25 ondate | 9-13 min | — |

Livelli 7-12 e Sopravvivenza (200 semi per riga, 30 per la Sopravvivenza; il pilota porta le 8 carte di partenza e usa le piante nuove come una persona):
| Livello | Bravo vince | Medio vince | Distratto vince | Durata | Tosaerba (distratto) |
|---|---|---|---|---|---|
| 7 | 99 % | 98,5 % | 50,5 % | 4,7 min | 1,7 |
| 8 | 100 % | 100 % | 60 % | 4,9 min | 1,7 |
| 9 | 99,5 % | 99,5 % | 40,5 % | 5,4 min | 2,0 |
| 10 | 99,5 % | 99,5 % | 53,5 % | 5,4 min | 1,7 |
| 11 | 100 % | 99,5 % | 50 % | 6,2 min | 1,7 |
| 12 | 91 % | 92,5 % | 14,5 % | 7,2 min | 2,5 |
| Sopravvivenza | 45 ondate | 43 ondate | 30 ondate | 10-13 min | — |

La curva è quella giusta (i primi due livelli non si perdono, poi sale); il medio vince quasi sempre: è PvZ, facile per chi gioca. Da
decidere con Jack dopo la prova degli amici se indurire gli ultimi livelli (strumento pronto: si cambia un numero in `profili.marea`, si
rilancia, si guarda la tabella).

## 4. Come si gioca (banco)
- **Toccare la carta, poi la casella** (o trascinare la carta sulla casella); la carta si scurisce mentre si ricarica, si spegne se non
  bastano le monete. **Toccare le monete** per raccoglierle (anche mentre cadono); la pala toglie un difensore (senza rimborso).
- **Scegliere le carte**: in partita se ne portano al massimo 8 (`carte.max` in `difesa.json`). Dove le carte sbloccate sono di più (dal livello 9 e
  nella Sopravvivenza) prima del livello compare «SCEGLI LE CARTE»: si toccano le carte da portare (n / 8, la nona non entra: se ne toglie una),
  VIA! avvia. Parte già con la scelta dell'ultima volta (resta nel telefono) e la carta nuova del livello dentro, poi si riempie nell'ordine di
  `carte.priorita`; la barra le mette nell'ordine del livello. RICOMINCIA e RIPROVA tengono la stessa scelta; AVANTI chiede di nuovo. Col pilota
  automatico e nelle prove (`prova=1`) non si sceglie: carte di partenza (`carte.ts` nella sim).
- PC: mouse; tasti 1-8 carte, E pala, Spazio pausa, F veloce ×2, T pilota automatico, M muto, R ricomincia, Esc annulla.
- Telefono in **orizzontale** (in verticale «GIRA IL TELEFONO» e il gioco si ferma); la pagina in secondo piano mette in pausa.
- Pannello «⚙ prove»: STILE (le pelli), numeri PvZ/MAREA, raccolta automatica delle monete, pilota automatico (bravo, medio,
  distratto), velocità, suoni, livelli tutti aperti, ricomincia, scegli il livello.
- Medaglia a fine livello: oro senza tosaerba usati, argento con uno, bronzo con di più. Livelli sbloccati, medaglie e record restano
  nel telefono (localStorage).
- Indirizzo: `difesa.html?livello=1..12|s&stile=<pelle>&profilo=pvz|marea&auto=bravo&veloce=2&raccolta=1&seme=N`.

## 5. Regole per chi ci lavora
- La sim sta in `packages/sim/src/difesa/` ed è pura come il resto (`check_static`): il caso è un intero nello stato (mulberry32), tempi
  in tick, solo + − × ÷. Il pilota automatico (`bot.ts`) ha il suo caso e non cambia la partita.
- I numeri stanno solo in `packages/content/src/difesa.json`: `profili.pvz` è l'originale (non si tocca: lo controllano i test
  «riproduce PvZ»), le nostre modifiche vanno in `profili.marea`. Dopo una modifica: `node tools/difesa_bilancio.mjs` e la tabella del §3.
- La grafica è una **pelle** (`apps/client/src/difesa/skin.ts`): fondale con gli angoli del campo, atlas di sprite coi piedi e l'altezza in
  caselle, nomi, colori della UI, suoni. Di serie **«L'orto»** (#379, stile 1 del foglio: cartoon a contorni spessi): carota, carota gelata,
  zucca, peperoncino, cavolo, ravanello contro lumaca, lumaca con la ghianda, scarabeo col vasetto, cavalletta e la lumaca capobanda con la
  bandierina; annaffiatoi a molla al posto dei tosaerba. **Animazione a fotogrammi** generati uno per uno da Codex (ogni fotogramma è una
  modifica della posa base, poi stessa scala e allineamento: `tools/difesa_pelle.py` dal manifest `assets/concept/difesa/orto/manifest.json`),
  19 suoni ElevenLabs. Le pelli stanno in `apps/client/public/assets/difesa/<id>/` (budget a parte nella build: `difesaAssetsMB`; l'orto
  1,2 MB su 4). La pelle segnaposto da codice resta con `?stile=segnaposto`.
- I personaggi nuovi dei livelli 7-12 (#738) sono su una pagina a parte dell'atlas, aggiunta al pelle.json senza toccare quello che c'era:
  `assets/concept/difesa/orto/manifest_nuovi.json` (sorgenti in `dionea/`, `gemello/`, `zuccone/`, `pannocchia/`, `mortaio/`, `scudo/`,
  `scudoNudo/`, `vespa/`, `gigante/`, `fuoco/`, `palla/`, `foglia/`: disegnati da Codex sul foglio `_FOGLIO_nuovi.jpg`, poi ogni
  fotogramma è una modifica della posa base) e `tools/difesa_pelle.py <manifest_nuovi> --aggiungi`. I PNG stanno solo sul computer di chi
  li ha fatti (nel repo i JPG, i manifest e i brief).
- Test: `node --test packages/sim/test/difesa.test.ts packages/sim/test/difesa_nuovi.test.ts` (sim) e `node tests/run.mjs m4_difesa` (banco).

## 6. L'isola della Difesa (18 ott 2026, #395)
Jack: «costruire l'isola tower defense in cui mettere il nostro Plants vs Zombies ed altro in futuro». L'isola `difesa` sta a ovest del
Porto (`archipelago.json` `[34, 138]`, 40×36 celle, sblocco `libera`), stile suo (`render/island_difesa.ts`, chunk a parte come Arena e
Corse): terra battuta, prato, riva di sassi.
- **Un mondo per zona.** Ogni mondo della Difesa (ambientazione e stile suoi, §1) ha la sua zona dell'isola. Il primo è **L'orto**: il
  **casale** da difendere a ovest, davanti l'**orto a 5 corsie × 9 caselle** come il campo del gioco (aiuole rialzate, i difensori fermi a
  sinistra, le lumache che arrivano da destra, la capobanda con la bandierina), la **staccionata** con l'arco del cancello verso il casale,
  il **mulino a vento** a nord-est che si vede dal mare, spaventapasseri, carriola, cassette di verdura. Il resto dell'isola è prato
  libero per i mondi dopo (spiaggia, cucina, cameretta… dal foglio delle prove di Codex).
- **Si gioca dal cancello.** Vicino all'arco (≤ 4 m) **DIFENDI L'ORTO** (o A) apre il gioco sopra il mondo: la stessa pagina del banco
  (`difesa.html?mondo=1`) in un riquadro a tutto schermo; intanto il mondo sta fermo e non si disegna (`main.ts` salta il frame).
  Si torna al cancello con **✕ ISOLA** (in basso a sinistra), con Esc fuori dal riquadro o dal gioco stesso (messaggio
  `marea:difesa:esci` alla pagina madre). Telefono in orizzontale come sul banco.
- Livelli sbloccati, medaglie e record per ora restano nel browser (`localStorage` `marea.difesa`, gli stessi del banco): il salvataggio
  sul server e il tabellone dei record dell'isola sono il passo dopo.
- Bussola e minimappa: meta «Orto». Prove: `?difesa=1` mette il bottone 🥕 (vai al cancello); `state().difesa = { spot, near, aperte,
  aperta }`, hook `difesaVai`, `difesaApri`, `difesaChiudi`. Test: `node tests/run.mjs m4_difesa_isola`.
