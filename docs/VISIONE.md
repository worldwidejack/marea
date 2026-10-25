# MAREA — Visione (revisione di Jack, 14 ott 2026)

> Jack ha passato in rassegna tutto il gioco e ha deciso dove va (issue #323). Il GDD dice **com'è il gioco oggi**, questo file dice **dove va**. Quando un punto si fa, si riscrive la sezione del GDD e qui la riga diventa «fatto».
> Legenda: **sì** = resta · **via** = si toglie per ora · **da rifare** / **da ripensare** = la direzione è decisa, la forma no · **idea** = da valutare con Jack, non si fa senza di lui.

## 0. In tre righe
MAREA **non è una raccolta di minigiochi piccoli e scollegati**. Ogni volta che si sceglie un format gli si dà **un'isola intera**: lo si sviluppa bene, con più mappe, livelli e modalità, e lo si collega al resto del mondo con **lore, progressione e oggetti condivisi**.

Per chi lavora: prima di aggiungere un minigioco piccolo e isolato, chiediti a quale isola-format appartiene. Se non appartiene a nessuna, va in `BACKLOG.md`.

## 1. Base del gioco
| Cosa | Decisione | Com'è oggi |
|---|---|---|
| Arcipelago condiviso, movimento in tempo reale, camera diorama regolabile, app installabile, a piedi e in barca | **sì**, è la base | c'è |
| Giorno/notte | **sì**, ma spegnibile | c'è già l'interruttore nelle Impostazioni (#54) |
| Meteo | **da rifare**: niente nebbia globale fissa. **Nuvole che si muovono sulla mappa** e decidono il meteo del posto dove sono (piove sotto la nuvola, non ovunque) | uno stato solo per tutto il mondo, dall'orologio (`meteo.json`, GDD §3) |
| Tutorial «Primi passi» | **fatto** (18 ott 2026): **facoltativo**, non parte da solo, lo accende chi lo vuole | si accende dalla riga «Guida Primi passi» delle Impostazioni; al primo ingresso solo un toast che lo dice (GDD §9, `ui/guida.ts`) |
| HUD del mondo | **fatto** (19 ott 2026, #417): deciso col gruppo quali bottoni tenere, poi lo stile «Allegro» (alla Super Mario) | monete, campanella con «X è online», AVATAR col menù a tutto schermo, ingranaggio, viaggio rapido, minimappa con bandierina delle mete, A con la scritta dell'azione, B solo dove serve (`ui/stile_allegro.ts`, `ui/hud_allegro.ts`, GDD §3) |
| Minimappa e mappa grande | **fatto** (16 ott 2026, #360): **nord sempre in alto**; **zoom a più scatti**; **icone degli spot**; le isole non sbloccate **non si vedono proprio** (niente nebbia sopra) | nord in alto, zoom a scatti, icone delle mete, isole chiuse invisibili (`ui/minimappa.ts`, GDD §3); tra due varianti Jack ha scelto (17 ott) icone col contorno nero, 3 scatti, bottoni accanto al cerchio |

## 2. Progressione, economia, isole personali (punti 35-55 della revisione)
### Una valuta sola e le botteghe del Borgo (Jack e gli amici, 18 ott 2026, #414)
**Deciso**: via l'isola personale alla Grepolis (il giardino dietro la casa con Segheria, Cava, Magazzino…). Il giro «Segheria → Legno → edificio più grande» era circolare (Jack, 9 ott) e il gioco ormai sta nelle isole-format (Corse, Difesa, Templari, Sparo, Dungeon): **una valuta sola le lega tutte**.
- **Le monete** sono l'unica valuta: si vincono nei minigiochi e nei format, si trovano nei dungeon, si spendono nelle botteghe. Le **Perle confluiscono nelle monete**: i cosmetici costano di più.
- **Il motivo per tornare ogni giorno**: le **vetrine delle botteghe cambiano ogni giorno** (come il mobiliere, #384 #393, e il Contrabbandiere) e i **record per isola**. Niente regali gratis al rientro.
- **I salvataggi si convertono**: chi ha già comprato **tiene tutto** (mobili, finiture, cappelli, colori della barca, decorazioni, ampliamenti della casa, equipaggiamento). Legno, Pietra, Perle e gli edifici spenti diventano monete a un **cambio fisso** scritto nel GDD §5. Gli edifici che diventano botteghe portano il loro livello alla bottega.
- **Restano i tetti al giorno** che ci sono già (10 partite premiate ai minigiochi, 150 monete ai Templari, 150 all'Arena): niente monete infinite da un minigioco facile.
- Il **bottino del dungeon** (ferro, argento, erbe…) resta **oggetto**, non valuta: è il progresso del GDR di Riccardo.

| Oggi | Dopo |
|---|---|
| Legno, Pietra, Perle (`resources.json`) + monete del GDR (`HeroState.monete`) | **monete**, un portafoglio solo nel lotto |
| Banco da Lavoro (giardino) | **Fabbro** nel Borgo: forgia e migliora armi e armature; il livello del banco diventa il tuo livello col Fabbro (sblocca i materiali, RPG §5); il Legno da forgiare si compra da lui |
| Tavolo Alchemico + Serra | **Alchimista** nel Borgo: pozioni (ricette di RPG §6) e vende gli ingredienti base al posto della Serra |
| Molo a livelli | **Cantiere navale** nel Borgo: potenziamenti della barca (velocità); la **barca potenziata apre la Tempesta** (oggi Molo al livello 2) |
| Mercante delle Perle, mobiliere, Contrabbandiere | **restano**, prezzi in monete |
| Forziere | il **baule della casa** (c'è già): il livello resta, quanto ci sta |
| Segheria, Cava, Magazzino, Faro (edificio), Tavolo delle Sfide, Casa (edificio) | **spenti**, non cancellati: niente produzione, niente cantieri |
| Giardino dietro la casa + portale + modalità modifica dell'isola | **spenti**; la **casa** nel Borgo resta (mobili, ampliamenti, visite, libro degli ospiti) |
| Decorazioni del giardino | restano tue: si posano **in casa** con ARREDA, come i mobili a terra |
| Bacheca delle missioni | premi in monete; via le missioni che non si possono più fare (raccogli Legno/Pietra, avvia un cantiere) |

**Ordine dei lavori** (#414, una PR ciascuno): 1) questo documento · 2) sim e content: portafoglio, premi, prezzi, conversione dei salvataggi · 3) client: un contatore solo nell'HUD (lo stile nuovo dell'HUD si sceglie a parte), giardino e pannelli del lotto spenti, negozi a monete · 4) le botteghe Fabbro, Alchimista, Cantiere navale nel Borgo, con le vetrine del giorno: **fatto** (19 ott 2026, GDD §5 «Botteghe del Borgo») · 5) pulizia del codice spento, dopo, a parte.

Resta valido, per più avanti:
- **Direzione possibile** (da ripensare con Jack): all'inizio hai **solo la casa** → fai monete → **compri la prima barca** al Cantiere → salpi. Oggi la barca ce l'hai da subito.
- **Idea**: più avanti una meccanica da **city builder a esagoni**. Da valutare.
- Non aggiungere valute, risorse o edifici di produzione nuovi: si aggiungono **botteghe** e **cose da comprare**.

| Cosa | Decisione | Nota |
|---|---|---|
| Decorazioni | **sì** | le categorie non si fissano ora |
| Editor dell'avatar | **sì** | |
| «Mentre eri via» | **sì** | |
| Libro degli ospiti | **sì, e di più** | si potranno **scrivere messaggi**, non solo saluti con le emote |
| Visita alle isole degli amici | **sì** | **idea** futura: permessi, ed eventuali attacchi o interazioni competitive (prima stava tra i «Mai» del BACKLOG) |
| Mercante del Porto | **sì** | **deciso** (18 ott 2026, #414): vende a monete |
| Bacheca delle missioni | sacrificabile, **non prioritaria** | non ci si investe |
| NPC del Porto | **sì** | |
| Tabelloni dei record | **sì**, anche **uno per isola** | oggi uno solo, in piazza |
| Faro comune | **via** per ora: **fatto** (18 ott 2026, #111) | tolto dal codice il 20 ott (tag `archivio/spenti-faro`): resta solo il modello sulla riva, acceso (GDD §5) |
| Diario del capitano | **sì** | |
| Traguardi e titoli | **via** per ora: **fatto** (18 ott 2026, #87) | tolti dal codice il 20 ott (tag `archivio/spenti-traguardi`): il Diario resta senza la loro pagina, niente titoli sopra il nome (GDD §5) |

«Via per ora» vuol dire: non ci si lavora più. Toglierli dal gioco è un lavoro a parte, con la sua issue; meglio spegnerli che cancellare il codice.

## 3. I format: un'isola ciascuno
| Format | Ispirazione | Isola | Oggi | Design |
|---|---|---|---|---|
| **Corse** | arcade alla Mario Kart, ma originale | Isola delle Corse | Gran Premio, isola a piedi con le porte delle zone, 17 veicoli | `CORSE.md` |
| **Adrenalina** | sport estremi e discese | probabilmente **dentro le Corse** (§4) | snowboard sulla sua isola | `ADRENALINA.md` |
| **Templari** | sopravvivenza a ondate, zombie | Isola dei Templari | ondate, eroi, fino a 4 insieme | `TEMPLARI.md` |
| **Dungeon** | fantasy-avventura classico | da decidere | Mondo Sotterraneo sotto le isole | `RPG.md` |
| **Sparatutto a missioni** | missioni alla COD / GoldenEye 64, prima e terza persona; da soli prima, deathmatch tra amici come bonus (Jack, 16 ott) | da decidere | banco `provasparo.html`: poligono nel piazzale dei container | `SPARO.md` |
| **Difesa a corsie** | Plants vs Zombies, con più mondi ognuno con ambientazione e stile suoi (Jack, 16 ott) | **Isola della Difesa** (18 ott 2026, #395): un mondo per zona, il primo è L'orto | l'orto col casale e il cancello che apre il gioco (6 livelli + Sopravvivenza coi numeri di PvZ); pagina `difesa.html` | `DIFESA.md` §6 |

**Le isole si parlano** tra loro con:
- **lore condivisa**;
- **oggetti trasferibili**;
- **pezzi di equipaggiamento e sbloccabili** che si usano anche in altre modalità.

Templari, Dungeon e le altre isole sono **da approfondire**: per ora valgono i loro documenti.

## 4. Corse + Adrenalina
- L'Isola dell'Adrenalina **probabilmente si unisce** all'Isola delle Corse.
- L'isola delle Corse diventa più ampia: **un hub di competizioni e di movimento**, non solo guida su pista. Dentro: auto e kart, **snowboard**, **mountain bike**; poi altri mezzi, forse anche **cose che volano**.
- Per chi lavora adesso: finché Jack non conferma l'unione, le discese restano dove sono. Però il lavoro nuovo sulle discese va pensato per poter **traslocare nell'hub delle Corse** (moduli di gioco e piste separati dall'isola, niente investimenti grossi su funivia o isola a parte).

## 5. Prototipi vecchi (punto 88)
Le vecchie pagine di prova servono: **usarle per accelerare lo sviluppo** (approvato). Oggi in `apps/client/`:
`prova3d.html` (3D dipinto), `provapixel.html` (pixel 3D), `provascena.html` (scenografia delle piste), `provapiste.html` (banco delle piste), `provagarage.html` (garage), `provadiscesa3d.html` (discesa in bici).
Prima di rifare da zero una cosa, guarda se una di queste ce l'ha già.

## 6. Cosa si può fare subito e cosa va chiesto
**Chiari, si possono aprire come issue:**
1. ~~Minimappa e mappa grande: nord in alto, zoom a scatti, icone degli spot, isole chiuse invisibili.~~ Fatto (#360).
2. ~~Tutorial che non parte da solo.~~ Fatto (18 ott 2026).
3. Libro degli ospiti con messaggi scritti.
4. ~~Faro comune e traguardi/titoli spenti.~~ Fatto (18 ott 2026; usciti dal codice il 20 ott).
5. Tabelloni dei record anche sulle isole.
6. Meteo a nuvole che si muovono (il più grosso dei sei).

**Da decidere con Jack prima di scrivere codice** (scelte A/B con screenshot):
- la partenza nuova (casa → barca → colonie); il giardino: **deciso** il 18 ott (spento, §2);
- risorse, estrattori e valuta del Mercante: **deciso** il 18 ott (monete e botteghe, §2, #414);
- l'unione di Adrenalina e Corse;
- lo sparatutto: **deciso** il 16 ott (missioni alla COD, camera prima/terza, `SPARO.md`); restano ambientazione e isola;
- permessi e attacchi alle isole degli amici;
- dove vive il Dungeon.
