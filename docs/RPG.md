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
| **Grotta della Marea** (facile) | Isola Selvaggia, sotto le rocce | banditi, lupi, ragni | bronzo, ferro, monete, erbe, un po' d'oro |
| **Cripta del Porto** (media) | Porto, porta di pietra | scheletri, non-morti antichi, boss **Re delle Ossa** | argento, ossa di mostro, libri di magia |
| **Portale del Vuoto** (difficile) | Distretto Neon | spettri, golem di cristallo, boss **Custode del Vuoto** | vetro, meteorite, oggetti unici |
Nessun «livello consigliato» a schermo: la difficoltà si capisce dai nemici e dall'ambiente. Libertà totale: se a livello 1 schivi tutto il Portale, buon per te.

## 3. Statistiche e livelli
- Tre barre: **Vita**, **Magicka** (incantesimi), **Stamina** (solo per correre; alza anche il peso trasportabile e attenua il malus delle armature pesanti). Colpire non costa stamina.
- **Crescita alla Skyrim**: usare un'abilità la fa salire; ogni livello di abilità dà esperienza al personaggio; a ogni livello del personaggio si sceglie **+10** a una delle tre barre e si prende **1 punto perk**.
- **Abilità (8)**: Armi Leggere · Armi Pesanti · Arceria · Distruzione · Evocazione · Navigazione · Forgiatura · Alchimia. Come salgono: colpendo con l'arma della classe; con le frecce a segno; con la magicka spesa; evocando; con le medaglie della Regata (Navigazione); forgiando; preparando pozioni.
- **Perk**: creano sinergie (es. Armi Pesanti → attacchi più veloci; più danni con l'armatura leggera). **[scelta provvisoria]** prima bozza di 4-5 perk per albero in `rpg/perks.json`: «Da pensare ora: SKILL TREE!!» (Riccardo) — l'albero vero lo decide lui, il codice legge il JSON.
- **Magie**: si imparano trovando e leggendo i **libri** nei dungeon. **[scelta provvisoria]** si parte sapendo *Fiammata*.

## 4. Combattimento
- Tempismo, mobilità (corsa a stamina) e distanze.
- **Attacco normale**: tocco breve di A, cadenza data dalla velocità dell'arma.
- **Attacco caricato**: tieni premuto A per X secondi (dipende dall'arma) e lascia. Non costa stamina, ma mentre carichi ti muovi piano e sei esposto. Molto più lento e potente; scala con danno e peso dell'arma.
- **Arco**: tieni premuto per tendere, lascia per tirare. Danno = arco + freccia; gittata = arco + freccia; ogni freccia ha la sua gravità.
- **Magia** (C): lancia l'incantesimo preparato. **Pozione** (D): bevi la pozione rapida.
- **Mira assistita** (telefono prima): il colpo si gira da solo verso il nemico più vicino davanti a te.
- **[scelta provvisoria] Morte**: torni all'ingresso, **perdi il bottino della spedizione** (non quello che avevi già), tieni l'esperienza. Pozioni e frecce usate restano usate.
- Il bottino resta sui cadaveri e nei forzieri: ci passi sopra e lo raccogli, se il peso lo permette. Ogni discesa rigenera i nemici: farmare un dungeon facile per le risorse del villaggio è voluto.

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
- **Inventario a peso** (cresce con la Stamina). Sull'isola il **Forziere** tiene l'eccesso; migliorarlo alza quanto ci sta.
- **[scelta provvisoria] Monete**: si trovano nei dungeon e servono a comprare i materiali di base al Banco da Lavoro (bottega minima), finché non c'è un mercante al Porto.

## 7. Prima taratura (6 ott 2026, da rivedere giocando)
- **Armi** = tipo × materiale. Colpi al secondo: nunchaku 2,5 · katana 1,7 · ascia 1,15 · lancia 1,1 (portata 3 m) · spadone 0,8 · martello 0,55. DPS dei sei tipi entro ±25 % della media. Le pesanti costano 1,5× materiale.
- **Materiali (danno)**: legno ×0,5 · bronzo ×1 · ferro ×1,4 · argento ×1,2 (×2 su non-morti e mostri) · oro ×0,6 (bottino ×2) · vetro ×1,9 (si rompe dopo 60 colpi) · ossa ×2,6 lentissime · meteorite ×2 (ignora metà armatura).
- **Armature (difesa)**: tela 5 (malus zero) · ferro 50 · ossa 90 (40 kg) · meteorite 50 (−10 kg, velocità ×1,12) · vetro: tagli ×0,6, contundenti ×2 · argento dimezza la magia · oro 2 monete per colpo preso. Malus = kg × 0,012 (max 0,6), dimezzato a 200 di Stamina.
- **Zaino** 20 + 0,8 × Stamina kg (100 alla partenza). **Partenza**: katana di legno, vesti di tela, arco di legno e 20 frecce, 2 pozioni di vita minori, Fiammata, 20 monete.
- **Crescita**: ogni livello d'abilità dà al personaggio xp pari al nuovo livello; +0,5 % di danno e +1 % di pozioni per livello d'abilità oltre 15. Regata da solo: Navigazione +60/40/25/10 xp (oro/argento/bronzo/nessuna).
- **Nemici** (vita · danno · armatura): bandito 24·7·0 · arciere 16·5·0 · lupo 16·6·0 · ragno 12·5·0 · scheletro 45·12·4 · scheletro arciere 35·8·3 · non-morto 80·18·6 · **Re delle Ossa** 420·26·10 · spettro 50·10·0 (magie) · golem 140·28·14 (contundente) · **Custode** 750·38·12. Alleati evocati: lupo spettrale 60·12, scheletro evocato 70·16 (invulnerabili finché durano) **[scelta provvisoria]**.
- Mappe: Grotta 40×30 (15 nemici, 5 forzieri), Cripta 44×31 (16 nemici + boss, 6 forzieri, libro Fulmine), Vuoto 48×33 (16 nemici + boss, 5 forzieri, libro Lupo spettrale). Niente colpi critici **[scelta provvisoria]**.

## 8. Come funziona sotto (per chi programma)
Un dungeon è una **partita deterministica** della sim (come la Regata, ma lunga fino a 20 min): il server apre la spedizione fotografando il personaggio (`RunHero`) e un seed, il client gioca e registra gli input, il server li rigioca e applica il risultato (`RunResult`). Niente trucchi, niente rete nuova. Dettagli e interfacce: `CONTRACTS.md` §15.
