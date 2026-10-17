# MAREA — Visione (revisione di Jack, 14 ott 2026)

> Jack ha passato in rassegna tutto il gioco e ha deciso dove va (issue #323). Il GDD dice **com'è il gioco oggi**, questo file dice **dove va**. Per il lavoro nuovo vince questo file; quando un punto si fa, si riscrive la sezione del GDD e qui la riga diventa «fatto».
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
| Tutorial «Primi passi» | **sì, ma facoltativo**: non parte da solo, lo accende chi lo vuole | parte da solo al primo ingresso, si chiude con × (GDD §9, `ui/guida.ts`) |
| Minimappa e mappa grande | **fatto** (16 ott 2026, #360): **nord sempre in alto**; **zoom a più scatti**; **icone degli spot**; le isole non sbloccate **non si vedono proprio** (niente nebbia sopra) | nord in alto, zoom a scatti, icone delle mete, isole chiuse invisibili (`ui/minimappa.ts`, GDD §3); tra due varianti Jack ha scelto (17 ott) icone col contorno nero, 3 scatti, bottoni accanto al cerchio |

## 2. Progressione, economia, isole personali (punti 35-55 della revisione)
- **L'isola personale «nel nulla» convince poco.** Oggi è il giardino dietro la casa del Borgo, fuori dal mare (#237).
- **Direzione possibile** (da ripensare con Jack): all'inizio hai **solo la casa** → fai risorse o monete → **compri la prima barca** → salpi → poi puoi **colonizzare altre isole**. Oggi la barca ce l'hai da subito.
- **Idea**: più avanti una meccanica da **city builder a esagoni**. Da valutare.
- **Risorse, estrattori e strutture economiche: da ripensare.** Oggi Legno, Pietra, Perle; Segheria, Cava, Magazzino, Casa, Faro, Tavolo (GDD §5). Non aggiungere edifici o risorse nuove finché non si decide.

| Cosa | Decisione | Nota |
|---|---|---|
| Decorazioni | **sì** | le categorie non si fissano ora |
| Editor dell'avatar | **sì** | |
| «Mentre eri via» | **sì** | |
| Libro degli ospiti | **sì, e di più** | si potranno **scrivere messaggi**, non solo saluti con le emote |
| Visita alle isole degli amici | **sì** | **idea** futura: permessi, ed eventuali attacchi o interazioni competitive (prima stava tra i «Mai» del BACKLOG) |
| Mercante del Porto | **sì** | la valuta potrebbe non essere le Perle |
| Bacheca delle missioni | sacrificabile, **non prioritaria** | non ci si investe |
| NPC del Porto | **sì** | |
| Tabelloni dei record | **sì**, anche **uno per isola** | oggi uno solo, in piazza |
| Faro comune | **via** per ora | |
| Diario del capitano | **sì** | |
| Traguardi e titoli | **via** per ora | oggi sono una pagina del Diario |

«Via per ora» vuol dire: non ci si lavora più. Toglierli dal gioco è un lavoro a parte, con la sua issue; meglio spegnerli che cancellare il codice.

## 3. I format: un'isola ciascuno
| Format | Ispirazione | Isola | Oggi | Design |
|---|---|---|---|---|
| **Corse** | arcade alla Mario Kart, ma originale | Isola delle Corse | Gran Premio, hub, 17 veicoli | `CORSE.md` |
| **Adrenalina** | sport estremi e discese | probabilmente **dentro le Corse** (§4) | snowboard sulla sua isola | `ADRENALINA.md` |
| **Templari** | sopravvivenza a ondate, zombie | Isola dei Templari | ondate, eroi, fino a 4 insieme | `TEMPLARI.md` |
| **Dungeon** | fantasy-avventura classico | da decidere | Mondo Sotterraneo sotto le isole | `RPG.md` |
| **Sparatutto a missioni** | missioni alla COD / GoldenEye 64, prima e terza persona; da soli prima, deathmatch tra amici come bonus (Jack, 16 ott) | da decidere | banco `provasparo.html`: poligono nel piazzale dei container | `SPARO.md` |
| **Difesa a corsie** | Plants vs Zombies, con più mondi ognuno con ambientazione e stile suoi (Jack, 16 ott) | da decidere | banco `provadifesa.html`: 6 livelli + Sopravvivenza coi numeri di PvZ | `DIFESA.md` |

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
`prova3d.html` (3D dipinto), `provapixel.html` (pixel 3D), `provascena.html` (scenografia delle piste), `provapiste.html` (banco delle piste), `provahub.html` e `provahubvista.html` (hub delle Corse), `provagarage.html` (garage), `provadiscesa3d.html` (discesa in bici).
Prima di rifare da zero una cosa, guarda se una di queste ce l'ha già.

## 6. Cosa si può fare subito e cosa va chiesto
**Chiari, si possono aprire come issue:**
1. ~~Minimappa e mappa grande: nord in alto, zoom a scatti, icone degli spot, isole chiuse invisibili.~~ Fatto (#360).
2. Tutorial che non parte da solo.
3. Libro degli ospiti con messaggi scritti.
4. Faro comune e traguardi/titoli spenti.
5. Tabelloni dei record anche sulle isole.
6. Meteo a nuvole che si muovono (il più grosso dei sei).

**Da decidere con Jack prima di scrivere codice** (scelte A/B con screenshot):
- la partenza nuova (casa → barca → colonie) e cosa ne è del giardino;
- risorse, estrattori e valuta del Mercante;
- l'unione di Adrenalina e Corse;
- lo sparatutto: **deciso** il 16 ott (missioni alla COD, camera prima/terza, `SPARO.md`); restano ambientazione e isola;
- permessi e attacchi alle isole degli amici;
- dove vive il Dungeon.
