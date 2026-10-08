# MAREA — Mondo Sotterraneo (GDD della parte GDR)

> Parte del GDD (`GDD.md` §12 rimanda qui; vale come il GDD). Nasce dal documento di **Riccardo** «Piano Gioco» (6 ott 2026), portato nel repo da Jack. Le scelte che il documento non diceva le ha prese il Claude di Jack e sono segnate **[scelta provvisoria]**: Riccardo le può cambiare.
> Numeri: tutti in `packages/content/src/rpg/*.json`. Le tabelle qui sono la prima ipotesi; cambiarli = aggiornare qui e una riga in `ROADMAP.md` §Deviazioni.

## 0. Chi fa cosa
- **Jack** (superficie): isole, barca, minigiochi per le risorse, edifici del villaggio (anche Banco da Lavoro, Tavolo Alchemico, Forziere, Serra: li si piazza sull'isola come gli altri), sbloccabili estetici.
- **Riccardo** (la parte «skyrimmosa»): combattimento, alberi delle abilità, statistiche, bottino, dungeon, bilanciamento dell'equipaggiamento. Tocca il codice del villaggio solo quando serve alle sue meccaniche.
- Il giocatore può **non scendere mai** nei dungeon e giocare MAREA come village builder con minigiochi. Nessun dungeon è obbligatorio, nessuna risorsa di superficie viene tolta a chi non combatte.

## 1. Il loop
Superficie (raccogli, coltiva, costruisci) → ti prepari (forgi armi, prepari pozioni) → scendi in un dungeon da un ingresso su un'isola → combatti e raccogli bottino ed esperienza → esci → torni al villaggio a forgiare roba migliore ed espandere. **Zero nemici in superficie.**

## 2. Ingressi (V1)
| Dungeon | Dove | Nemici | Cosa si trova |
|---|---|---|---|
| **Grotta della Marea** (facile) | Porto, sotto le rocce a nord-est (il più facile da trovare) | banditi, lupi, ragni | bronzo, ferro, monete, erbe, un po' d'oro |
| **Cripta delle Ossa** (media) | Isola Selvaggia, porta di pietra sotto le rocce | scheletri, non-morti antichi, boss **Re delle Ossa** | argento, ossa di mostro, libri di magia |
| **Portale del Vuoto** (difficile) | Distretto Neon | spettri, golem di cristallo, boss **Custode del Vuoto** | vetro, meteorite, oggetti unici |
Nessun «livello consigliato» a schermo: la difficoltà si capisce dai nemici e dall'ambiente. Libertà totale: se a livello 1 schivi tutto il Portale, buon per te.
- **Difficoltà invisibile** (Riccardo, 7 ott 2026): ogni dungeon ha un numero che il giocatore non vede (`difficolta` in `dungeons.json`: Grotta 1, Cripta 2, Vuoto 3). La bussola mostra **solo il dungeon più facile non ancora completato**; gli altri ingressi restano nel mondo, col loro cartello, e ci si entra lo stesso.
- **Completato** = hai ucciso il **capo** almeno una volta, anche se poi sei morto (`HeroState.completati`). Cripta: Re delle Ossa · Vuoto: Custode · Grotta (niente boss): il **Capo dei banditi**, un arciere un po' più forte degli altri al posto di uno della sala dei banditi, il nemico più lontano dall'ingresso (lettera `C`). Ogni capo ha una **corona gialla** sopra la barra della vita, visibile anche quando non è ferito (scelta di Riccardo, 7 ott 2026). Completati tutti, l'eroe resta senza freccia verso i dungeon.

## 3. Statistiche e livelli
- Tre barre: **Vita**, **Magicka** (incantesimi), **Stamina** (solo per correre; alza anche il peso trasportabile e attenua il malus delle armature pesanti). Colpire non costa stamina.
- **Crescita alla Skyrim**: usare un'abilità la fa salire; ogni livello di abilità dà esperienza al personaggio; a ogni livello del personaggio si sceglie **+10** a una delle tre barre e si prende **1 punto perk**.
- **Abilità (7)**: Armi Leggere · Armi Pesanti · Arceria · Distruzione · Evocazione · Forgiatura · Alchimia. Come salgono: colpendo con l'arma della classe; con le frecce a segno; con la magicka spesa; evocando; forgiando; preparando pozioni.
- **Niente Navigazione** (scelta di Riccardo, 7 ott 2026): la barca più veloce la dà già il livello del **Molo** della propria isola (GDD §5), e la Regata dà solo il suo premio. Chi aveva già preso perk di Navigazione si riprende i punti perk.
- **Perk**: creano sinergie (es. Armi Pesanti → attacchi più veloci; più danni con l'armatura leggera). **[scelta provvisoria]** prima bozza di 4-5 perk per albero in `rpg/perks.json`: «Da pensare ora: SKILL TREE!!» (Riccardo) — l'albero vero lo decide lui, il codice legge il JSON.
- **Magie**: si imparano trovando e leggendo i **libri** nei dungeon, a qualsiasi livello di abilità (Riccardo, 8 ott 2026). **[scelta provvisoria]** si parte sapendo *Fiammata*. Evocazioni (costo in Magicka · ricarica · durata · alleato vita/danno/armatura): **Lupo spettrale** 45 · 10 s · 30 s · 60/12/0; **Scheletro evocato** 110 · 15 s · 45 s · 70/16/4; **Golem evocato** 180 · 25 s · 40 s · 220/32/14 (libro dal Custode del Vuoto o, raro, dai forzieri rari del Vuoto).

## 4. Combattimento
- Tempismo, mobilità (corsa a stamina) e distanze.
- **Attacco normale**: tocco breve di A, cadenza data dalla velocità dell'arma. È un **fendente orizzontale da destra a sinistra** che spazza 150° davanti (lancia: affondo stretto di 40°; pugni: gancio di 100°) e colpisce ogni nemico in portata quando la lama gli passa sopra; la scia mostra l'arco vero (7 ott 2026).
- **Attacco caricato**: tieni premuto A per X secondi (dipende dall'arma) e lascia. Non costa stamina, ma mentre carichi ti muovi piano e sei esposto. Molto più lento e potente; scala con danno e peso dell'arma. A carica piena è un **giro completo di 360°** (scelta di Riccardo, 7 ott 2026): colpisce tutti intorno entro la portata. Mentre carichi: corpo girato con l'arma bassa dietro, anello a terra grande quanto la portata che si riempie a tacche nel verso del giro, scintille, lama che si accende; al pieno lampo, onda e stella sopra la testa.
- **Arco**: tieni premuto per tendere, lascia per tirare. Danno = arco + freccia; gittata = arco + freccia; ogni freccia ha la sua gravità.
- **Magia** (C): lancia l'incantesimo preparato. **Pozione** (D): bevi la pozione rapida.
- **Zaino e Pausa nel dungeon** (Riccardo, 7 ott 2026): in alto **ZAINO** (tasto I) e **PAUSA** (Esc); con uno dei due aperti la partita è ferma. Dallo zaino si cambia equipaggiamento (arma, frecce, corpo, anelli, pozione rapida, magia), anche con quello trovato laggiù, e si butta via quello che non serve; livelli, perk e libri si fanno fuori. Pozioni e frecce raccolte si usano dopo quelle portate da casa.
- **Mira assistita** (telefono prima): il colpo si gira da solo verso il nemico più vicino davanti a te.
- **Morte** (confermata da Riccardo, 7 ott 2026): torni all'ingresso, **perdi il bottino della spedizione** (non quello che avevi già), tieni l'esperienza. Pozioni e frecce usate restano usate.
- **Altari di salvataggio**, le **lanterne** (scelta di Riccardo, 7 ott 2026): almeno **2 per dungeon**, in punti fissi della mappa (lettera `A`), fuori dalla vista dei boss. Standoci sopra compaiono **SALVA** ed **ESCI** (dal 7 ott 2026 non salvano più da sole passandoci sopra: non si capiva). SALVA: il bottino e le monete raccolti fin lì sono **al sicuro** (scritta grande e lampo della lanterna). ESCI: fuori col bottino, come dalla scala; alla discesa dopo in quel dungeon si sceglie se partire dall'ingresso o **da quella lanterna** (i nemici rinascono come a ogni discesa). Se muori dopo aver salvato **ti risvegli su quella lanterna**, con le barre piene e **3 secondi senza danni**; perdi solo il bottino raccolto dopo il salvataggio (i forzieri aperti restano vuoti) e la spedizione continua. Uscendo dalla Pausa, a tempo scaduto o chiudendo la scheda tieni il bottino dell'ultimo salvataggio (se la scheda si chiude, il server chiude la spedizione alla discesa dopo). Un salvataggio libero ovunque è stato scartato: renderebbe la morte senza peso.
- Il bottino resta sui cadaveri e nei forzieri: ci passi sopra e lo raccogli, se il peso lo permette. Ogni discesa rigenera i nemici: farmare un dungeon facile per le risorse del villaggio è voluto.
- **Dungeon insieme** (Riccardo, 8 ott 2026, #118): quando all'ingresso ci sono altri giocatori compare **AFFRONTA INSIEME** accanto a ENTRA. Chi lo preme entra nella squadra di quel dungeon (fino a **4**); con almeno 2, chiunque preme **SCENDIAMO** e si scende tutti nella stessa partita: ci si vede (nome e vita sopra la testa), stessi nemici, stessi colpi. Chi si allontana dall'ingresso esce dalla squadra. Si parte sempre dall'ingresso.
  - **Nemici più forti**: vita × (1 + 0,6 × compagni in più) → in 2 +60 %, in 3 +120 %, in 4 +180 %. Il danno dei nemici non cambia; i nemici puntano l'eroe più vicino e i boss col colpo ad area prendono tutti quelli nel cerchio. Perché 0,6: in due si fanno il doppio dei danni ma i nemici hanno 1,6× la vita, quindi si pulisce un po' più in fretta che da soli (0,8× il tempo): conviene andare insieme senza che diventi una passeggiata **[scelta provvisoria, da rivedere giocando]**.
  - **Bottino personale**: ogni forziere e ogni cadavere ha la sua parte per ciascuno (si prende il proprio, uguale per tutti): niente litigi su chi arriva prima. L'esperienza va a chi fa i danni.
  - **Ognuno per sé alla fine**: uscire dalla scala o da una lanterna, cadere senza aver salvato, o andarsene dal menu vale solo per te; gli altri continuano. Le lanterne sono personali (SALVA salva il tuo bottino). Il capo ucciso conta come dungeon completato per tutta la squadra.
  - **Niente pausa insieme**: Esc apre il menu ma il dungeon non si ferma; con lo zaino aperto il tuo eroe sta fermo (occhio ai nemici).

## 5. Equipaggiamento e forgia
Si sblocca costruendo il **Banco da Lavoro**. Per forgiare serve **solo un tot di quel materiale** (il Legno è quello del Magazzino dell'isola; gli altri si trovano nei dungeon). **[scelta provvisoria]** il livello del Banco sblocca i materiali: L1 legno, bronzo, ferro · L2 + argento, oro, vetro · L3 + ossa, meteorite.

**Armi** (compensate da velocità contro danno)
| Classe | Arma | Carattere |
|---|---|---|
| Leggere | Nunchaku | velocissimo, danni bassi |
| | Katana | equilibrata |
| | Ascia | la più lenta delle leggere, danni alti |
| Pesanti | Lancia | ottima portata, veloce per la categoria, danno contenuto |
| | Spadone | equilibrato |
| | Martello | lentissimo, danni devastanti |
Più gli **archi** e le **frecce**. **Armi uniche**: drop speciali non forgiabili nei dungeon (armi, armature, archi, frecce).

**Materiali** (si forgiano armi leggere, pesanti, archi, frecce e armature)
| Materiale | Armi da mischia | Armatura (pezzo unico) | Arco | Frecce |
|---|---|---|---|---|
| Legno / Tela | danni ridicoli, solo all'inizio | vesti base: difesa bassissima, malus zero | corto: veloce, gittata ridicola | di legno: parabola ripidissima |
| Bronzo / Rame | primo vero upgrade, pesanti | prima corazza: protegge, il malus si sente | rinforzato: più faticoso, più danno | pesanti: fanno male, perdono quota in fretta |
| Ferro / Acciaio | lo standard mid-game | l'equilibrio | lungo: il bilanciamento perfetto | standard: dritte a lungo |
| Argento | danni bonus devastanti contro non-morti e mostri | anti-magia: meno difesa dell'acciaio, riduce i danni magici | benedetto: raddoppia il bonus delle frecce d'argento | purificanti: fondono i mostri, quasi inutili su bestie e banditi |
| Oro | pessime per combattere, ×2 drop e monete | puro flex: pesantissima, protegge poco; più ti colpiscono più monete droppano | dorato: ogni colpo può far cadere monete | di lusso: costosissime; chi uccidi con queste lascia il drop raro |
| Vetro / Cristallo | velocissime, alto danno, **si rompono** dopo un po' | glass cannon: leggera, difesa alta dai tagli, **doppio danno dai contundenti** | composito: ricarica istantanea | a schegge: ignorano un po' d'armatura, sanguinamento |
| Ossa di mostro (dai boss scheletrici) | danni enormi, sanguinamento, lentissime | tank totale: ti muovi come un bradipo, i nemici deboli scappano | pesante: lento, consuma stamina tenuto teso, un cannone | contundenti: sbilanciano e respingono |
| Meteorite / Vuoto | ignorano il 50 % dell'armatura | antigravità: difesa dell'acciaio, peso **negativo** (corri di più) | del vuoto: frecce senza gravità | eteree: trapassano i nemici in fila |

**Armature e accessori**
- L'armatura è un **pezzo unico** per il corpo. Più pesa, più rallenta movimento e attacchi; si compensa con la Stamina o con i perk.
- Cappelli ed elmi sono **solo estetica** (gli stessi cappelli dell'avatar), separati dalle statistiche.
- **Anelli** (2 slot): modificatori (es. Anello della Vita Debole +20 Vita). Si trovano esplorando.
- **Vesti da mago**: al posto dell'armatura; aumentano Magicka, rigenerazione, Distruzione o Evocazione. Nessuna difesa.

## 6. Alchimia, Forziere, Serra
- **Tavolo Alchemico**: ricette tutte visibili; la difficoltà è procurarsi e coltivare gli ingredienti. Salendo in Alchimia si sbloccano più ricette e le pozioni curano di più.
- **Serra**: genera da sola gli ingredienti di base (si raccolgono come Legno e Pietra); quelli rari solo nei dungeon.
- **Inventario a peso** (cresce con la Stamina). Sull'isola il **Forziere** tiene l'eccesso; migliorarlo alza quanto ci sta. **Butta via** (Riccardo, 7 ott 2026): dallo zaino, sull'isola e nel dungeon, con un secondo tocco di conferma; gli oggetti spariscono.
- **[scelta provvisoria] Monete**: si trovano nei dungeon e servono a comprare i materiali di base al Banco da Lavoro (bottega minima) e dal Contrabbandiere al Porto.
- **Contrabbandiere del Porto** (Riccardo, 8 ott 2026, #127): il **Furetto**, banco losco a sud della Grotta della Marea, paga e vende in **monete**. Ogni giorno (cambio a **mezzanotte italiana**) vende **un'arma, un'armatura, un materiale e un ingrediente** pescati da un banco senza roba rara (armi e archi di bronzo e ferro; armature di bronzo e ferro, veste da apprendista; lingotti di bronzo, ferro, argento; ingredienti comuni: niente oro, vetro, ossa, meteorite, essenza del vuoto, unici); in un giro esce tutto, mai lo stesso due giorni di fila. **Compra tutto** quello che sta nello zaino (non quello che hai addosso) a una frazione del valore: conviene più che buttare, non per fare soldi. Valore = costo di forgia × 1,25 (materiali a prezzo fisso, il Legno quasi niente), pozioni = ingredienti × 1,5, il resto a prezzo fisso per tipo; **vende a valore × 1,5, compra a valore × 0,3** (totale arrotondato giù: la roba di Legno non la prende). Esempi: katana di ferro 150 / 30, armatura di ferro 300 / 60, lingotto di ferro 30 / 6. Numeri in `rpg/balance.json` `contrabbando`.

## 7. Prima taratura (6 ott 2026, da rivedere giocando)
- **Armi** = tipo × materiale. Colpi al secondo: nunchaku 2,5 · katana 1,7 · ascia 1,15 · lancia 1,1 (portata 3 m) · spadone 0,8 · martello 0,55. DPS dei sei tipi entro ±25 % della media. Le pesanti costano 1,5× materiale.
- **Materiali (danno)**: legno ×0,5 · bronzo ×1 · ferro ×1,4 · argento ×1,2 (×2 su non-morti e mostri) · oro ×0,6 (bottino ×2) · vetro ×1,9 (si rompe dopo 60 colpi) · ossa ×2,6 lentissime · meteorite ×2 (ignora metà armatura).
- **Armature (difesa)**: tela 5 (malus zero) · ferro 50 · ossa 90 (40 kg) · meteorite 50 (−10 kg, velocità ×1,12) · vetro: tagli ×0,6, contundenti ×2 · argento dimezza la magia · oro 2 monete per colpo preso. Malus = kg × 0,012 (max 0,6), dimezzato a 200 di Stamina.
- **Zaino** 20 + 0,8 × Stamina kg (100 alla partenza). **Partenza**: katana di legno, vesti di tela, arco di legno e 20 frecce, 2 pozioni di vita minori, Fiammata, 20 monete.
- **Crescita**: ogni livello d'abilità dà al personaggio xp pari al nuovo livello; +0,5 % di danno e +1 % di pozioni per livello d'abilità oltre 15.
- **Nemici** (vita · danno · armatura): bandito 24·7·0 · arciere 16·5·0 (frecce 7) · **capo dei banditi** 30·7·2 (frecce 9, ricarica 2 s, vede a 14 m) · lupo 16·6·0 · ragno 12·5·0 · scheletro 45·12·4 · scheletro arciere 35·8·3 · non-morto 80·18·6 · **Re delle Ossa** 420·26·10 · spettro 50·10·0 (magie) · golem 140·28·14 (contundente) · **Custode** 750·38·12. Alleati evocati: lupo spettrale 60·12, scheletro evocato 70·16 (invulnerabili finché durano) **[scelta provvisoria]**.
- Mappe: Grotta 40×30 (15 nemici, 5 forzieri), Cripta 44×31 (16 nemici + boss, 6 forzieri, libro Fulmine), Vuoto 48×33 (16 nemici + boss, 5 forzieri, libro Lupo spettrale). Niente colpi critici **[scelta provvisoria]**.
- **Altari**: 2 per dungeon. Grotta: all'imbocco del ramo ovest e a metà del ramo est · Cripta: nel passaggio verso la sala grande e davanti alla porta del Re delle Ossa (16 m, lui vede a 14) · Vuoto: sul ramo ovest e sotto l'isola centrale. Protezione al risveglio 3 s (`balance.json` → `dungeon.altare.protezione`).
- **Insieme** (#118): squadra fino a 4 (`dungeon.gruppo.max`), vita dei nemici +60 % per ogni compagno oltre il primo (`dungeon.gruppo.vitaPerCompagno` = 0,6) **[scelta provvisoria]**.

## 8. Come funziona sotto (per chi programma)
Un dungeon è una **partita deterministica** della sim (come la Regata, ma lunga fino a 20 min): il server apre la spedizione fotografando il personaggio (`RunHero`) e un seed, il client gioca e registra gli input, il server li rigioca e applica il risultato (`RunResult`). Niente trucchi, niente rete nuova. Dettagli e interfacce: `CONTRACTS.md` §15.
**Insieme** la sim ha un eroe per giocatore: il server (DO `Spedizioni`) raccoglie i comandi di tutti e 20 volte al secondo manda a tutti lo stesso «turno»; ogni telefono fa girare la stessa partita con gli stessi comandi, quindi tutti vedono la stessa cosa. Il server tiene il registro dei turni e a fine spedizione il lotto di ognuno lo rigioca per dare a ciascuno il suo esito. Dettagli: `CONTRACTS.md` §15 (Dungeon insieme) e `PROTOCOL.md` §7.
