# MAREA — Game Design Document (fonte di verità)

> Dove questo file contraddice gli altri documenti, vince questo. Si aggiorna solo tramite l'orchestratore; le idee nuove vanno in `BACKLOG.md`.
> Versione 1.0 · 29 set 2026 · titolo di lavoro **MAREA** (si può cambiare).

## 0. In tre righe
Un arcipelago 3D low-poly in stile pixel art, condiviso tra un gruppo di amici. Ogni amico ha la sua isola che **produce anche quando non c'è**; torna ogni giorno, raccoglie, costruisce, e sfida gli altri ai minigiochi nelle zone comuni, scommettendo risorse. Si gioca nel browser, da un link, anche dal telefono.

## 1. Pilastri (ogni scelta si misura su questi)
1. **Il mondo vive senza di te.** Quando rientri c'è sempre qualcosa che è cresciuto, qualcuno che ti ha sfidato, qualcosa di nuovo da vedere.
2. **Minigiochi sempre divertenti, mai tryhard.** Un pollice, 30-120 secondi, si capisce in 3 secondi, anche chi perde porta a casa qualcosa.
3. **Tutto personalizzabile e condiviso.** L'isola e l'avatar sono tuoi, ma gli amici li vedono: costruire è anche mostrare.

Riferimenti: **Grepolis** (rientro quotidiano, timer, risorse), **Mario Party** (minigiochi vari e leggeri), **Clash Royale** (dopamina, sblocchi; la battaglia con le unità è un obiettivo 2027). Anti-riferimenti: niente piattaforme 2D come gioco principale, niente grinding, niente PvP distruttivo.

## 2. Il loop del rientro (2-10 minuti, 1-2 volte al giorno)
1. **Entri** dal tuo link → sei sul molo della tua isola, la camera diorama la mostra tutta.
2. **Raccogli**: gli edifici hanno accumulato risorse nel loro deposito (tap sull'edificio → volano nel Magazzino). Feed: «Marco ti ha sfidato alla Regata», «hai vinto 40 Legno».
3. **Costruisci**: nuovo edificio o miglioramento (spesa immediata + timer), o piazzi una decorazione.
4. **Minigiochi** (1-3): prendi la barca e vai dove sta il minigioco (la Regata al molo della Laguna); con una medaglia vinci Legno, Pietra e Perle. Le sfide differite con posta tornano dopo la prova con gli amici (vedi §7).
5. **Esci** con almeno un timer che finirà prima del prossimo rientro (il gioco lo dice: «la Cava finisce tra 6 h»).

## 3. Il mondo: l'arcipelago
- **Zone comuni** (tutti le vedono, nessuno le possiede): in V1 una sola zona vera, il **Porto** (villaggio con edifici e mood asiatico: lanterne, torii, moli di legno, insegne). Il **Distretto Neon** (cyberpunk leggero) e l'**Isola Selvaggia** (natura, scogliere, palme) esistono come **facciate** visibili dalla barca; diventano zone vere quando chi ci lavora le apre (Neon e Laguna sono di Riccardo, #25 #26).
- **Isole a tema** (Jack, 7 ott 2026): ogni isola nuova ha un **tema** suo (contenuti e grafica), **minigiochi suoi** e un **modo suo per sbloccarla** (barca potenziata, livello del personaggio, un certo cappello senza il quale gli abitanti ti cacciano, una mappa…). Prima: **Isola della Tempesta** (scogli neri, fulmini, faro in rovina, pirati), protetta da una tempesta in mare che si passa solo col Molo al livello giusto.
- **Minigiochi universali** (pesca, caccia alle perle, consegne, ingorgo al porto): si giocano ovunque, dalla barca o al molo; le isole a tema hanno in più i loro.
- **Minimappa**: cerchietto in un angolo; toccandolo, la mappa intera dell'arcipelago con la nebbia sulle isole non ancora sbloccate.
- **Isole personali (lotti)**: una per amico, disposte attorno al Porto e alla Laguna, a **10-25 s di barca** (80-240 m) da entrambi. Vi si arriva in barca o con «vai a casa». Un lotto è una griglia di celle da 2 m con slot per edifici e decorazioni; il Molo è sempre costruito e fa da spawn.
- **Barca**: il mezzo principale. Sali dal molo (tasto A vicino alla barca), guida arcade (accelerazione, virata, scia), scendi a qualsiasi molo. Anche a piedi sulle isole.
- **Camera**: dall'alto in diagonale (diorama), segue l'avatar, zoom 0,6-1,6. Stessa vista per costruire.
- **Ciclo giorno/notte**: sì, dalle Impostazioni (#54), acceso di serie (#59); un giro ogni 24 min, stessa ora per tutti.

## 4. Chi sei: l'avatar
Umano semplice in **stile PS1 / Final Fantasy IX**: proporzioni quasi vere (6 teste, 1,6 m), pochi poligoni, viso e vestiti dipinti a pixel. Personalizzazione V1: tono della pelle (6), capelli (8 tagli × 6 colori), vestito (6 colori), cappello (6, di cui 3 da sbloccare con Perle). Emote (4) al posto della chat. Animazioni: idle, camminata, corsa, seduto (in barca), remata/timone.

## 5. Economia
**Risorse**: **Legno** e **Pietra** (prodotte dall'isola, servono a costruire) e **Perle** (solo da minigiochi e wager: sbloccano cappelli e decorazioni esclusive; non si producono, non si comprano).

| Edificio | Cosa fa | Costo L1 · L2 · L3 (Legno/Pietra) | Tempo L1 · L2 · L3 |
|---|---|---|---|
| Molo | Spawn, barca; velocità barca +10 %/livello | già costruito · 100/80 · 350/300 | — · 10 min · 2 h |
| Segheria | 20 → 45 → 90 Legno/ora | 30/0 · 120/60 · 400/250 | 30 s · 20 min · 4 h |
| Cava | 12 → 28 → 60 Pietra/ora (richiede Molo) | 50/0 · 150/80 · 450/300 | 2 min · 40 min · 6 h |
| Magazzino | Tetto per risorsa 200 → 600 → 1500 | 40/20 · 200/120 · 600/400 | 5 min · 1 h · 8 h |
| Casa | Slot cosmetici avatar 2 → 4 → 6 | 60/30 · 250/150 · 700/500 | 10 min · 2 h · 8 h |
| Faro | +50 % produzione per 2 h dopo una vittoria (1 attivo) | 120/120 · 400/400 | 30 min · 3 h |
| Tavolo delle Sfide | Wager max 50 → 150 → 400; sfide gratis/giorno 3 → 5 → 8 | 40/10 · 180/100 · 500/350 | 5 min · 1 h · 6 h |
| Decorazioni (10+) | Solo estetica, ovunque nel lotto | 5-40 Perle | istantanee |

**Regole**
- **Produzione pigra**: ogni edificio accumula nel suo deposito in base al tempo trascorso (`advance(lotto, oraServer)`): piena velocità per **10 ore**, poi al **25 %** fino a 110 ore (così chi entra due volte a settimana non resta fermo). Raccogliere sposta il deposito nel Magazzino, fino al suo tetto. Il server è l'unica autorità del tempo; il client non usa mai il suo orologio per l'economia.
- **Costruire** = spesa immediata + timer; un solo cantiere alla volta in V1. Niente acceleratori a pagamento: **mai soldi veri**.
- **Partenza**: Molo L1, 400 Legno, 160 Pietra, 0 Perle. Tetto base del deposito centrale senza Magazzino: 800 per risorsa. Nei primi 10 minuti si costruiscono Segheria e Cava e si scopre il Tavolo.
- **Taratura**: tutti i numeri stanno in `packages/content/src/balance.json` e si verificano con `economy_30days.test.ts` su tre archetipi (chi entra 2 volte al giorno / 1 volta / 2 volte a settimana → dopo 30 giorni ~100 % / ~75 % / ~40 % degli edifici a L2, nessuno a L3 pieno).
- **Dai minigiochi da solo** (`balance.json` → `solo`): il premio della medaglia arriva sempre, senza posta. Premiate le prime **10 partite al giorno** (giorno UTC), poi si gioca senza premio. Una medaglia attiva il Faro.

| Medaglia | Legno | Pietra | Perle |
|---|---|---|---|
| Oro | 60 | 30 | 20 |
| Argento | 30 | 15 | 10 |
| Bronzo | 15 | 8 | 5 |
| Nessuna | 0 | 0 | 2 |

- **Dalle sfide con posta** (spente per ora, §7): medaglia → Perle **5 / 10 / 20** (bronzo / argento / oro) e attiva il Faro. Chi perde una sfida prende comunque **2 Perle** (mai zero).

## 6. Minigiochi
**Formato comune** (in `packages/sim/src/minigames/`): modulo puro e deterministico, 60 Hz, `create({seed, difficulty})`, `step(state, input)`, `result(state)`, `autopilot`. Stesso seed = stessa partita, sempre. Il punteggio è **sempre «più alto vince»**; i dettagli (tempo, combo) stanno in `result().detail`.

**Ogni minigioco ha il suo posto** su un'isola (ogni isola ha giochi diversi): la Regata parte dal molo della Laguna. Nel mondo una boa grande con il cartello «REGATA» che si vede da lontano, nella bussola una riga con la distanza; vicino compare **GIOCA** (A). Si gioca da soli quando si vuole: il seed lo dà il server, che rigioca gli input e paga il premio (§5).

**Sfide differite** (spente per la prova con gli amici, si riaccendono con `?sfide=1`): A gioca oggi con un seed; B entra domani, gioca lo **stesso** seed e vede se batte il punteggio di A. Nessun bot. Il server rigioca l'input log nella sim e verifica il punteggio dichiarato.

**Ordine**
1. **Regata** (M1) — gara in barca a tempo tra 5 boe fisse nella laguna del Porto, con raffiche di vento da seed che spingono di lato. Riusa barca, mondo e camera. Tempo massimo 120 s; `score = max(0, 12000 − floor(ms/10))`. Medaglie relative al pilota di riferimento con le stesse raffiche: oro ≤ 1,04×, argento ≤ 1,3×, bronzo ≤ 2,0× (dall'8 ott 2026, #2; prima 1,1 / 1,4 / 2,3 ≈ 22 / 28 / 46 s; giro di ~167 m). Le boe si passano in ordine, la prossima è evidenziata. Controllo: joystick per virare, A per accelerare.
2. ~~**Lanterne**~~ — tolto l'8 ott 2026 (Jack: non divertiva). Al suo posto i minigiochi universali (§3): la **pesca** per prima.
3. **Puzzle leggero** (2027) — tubi o tessere da ruotare con i moduli dell'isola.
4. **Battaglia carte/unità in tempo reale** (2027) — richiede avversario live o bot, netcode a bassa latenza, bilanciamento: si fa dopo il collaudo di dicembre.

Ogni minigioco: cartello regole di 3 s in italiano, si gioca con un pollice, anche chi perde prende qualcosa.

## 7. Sfide e wager
> **Sospese dal 30 set 2026** per la prova con gli amici: si prova il gioco da soli e si viene premiati dai minigiochi (§5, §6). Il codice resta (Tavolo, feed, escrow) e si riaccende con `?sfide=1`; il Tavolo non compare nel pannello Costruisci.

- **Creare**: al Tavolo delle Sfide scegli minigioco, avversario, posta (Legno/Pietra/Perle, ≥ 10 e ≤ tetto del Tavolo); il seed lo genera il server; giochi subito il tuo turno. La posta va in **escrow** nel libro mastro.
- **Rispondere**: l'altro ha **24 h** per accettare (posta pari, in escrow) e giocare lo stesso seed. Punteggio più alto prende il piatto. Nessuna risposta o parità → rimborso a entrambi.
- **Colpo di coda**: se chi risponde ha meno del **50 %** delle risorse totali dello sfidante e vince, prende **1,5×**. Premia lo sfavorito, scoraggia il bullismo.
- **Gratis al giorno** 3/5/8 per livello del Tavolo; oltre, 1 Perla a sfida.
- **Invariante** (testato): somma risorse di tutti + escrow = generato − speso, sempre.

## 8. Tra amici
Mondo alla GTA: né coop né guerra. Nessuno attacca o modifica le isole altrui. Ci si vede muoversi nel Porto e in mare (presenza a 10 Hz), si visitano le isole degli altri (sola lettura), si comunica con 4 emote e con le sfide. Niente chat testuale in V1. Ingresso solo con link personale mandato da Jack.

## 9. Onboarding «Primi passi» (anticipato in M1, 30 set 2026)
Una scheda con un passo alla volta e una freccia gialla sulla meta (sopra la cosa se è in vista, sul bordo dello schermo se è fuori): **1** costruisci la Segheria (il cartello «Costruisci» evidenziato apre già la conferma) → **2** sali in barca → **3** vai alla Regata e gioca → **4** costruisci col premio. Sugli slot liberi dell'isola c'è sempre un cartello «Costruisci». Niente tutorial a testo lungo.

## 10. Tagli espliciti V1 (fino a dicembre 2026)
Fuori: battaglia unità, bot, puzzle, chat testuale, interni degli edifici, ciclo giorno/notte, commercio tra giocatori, apertura al pubblico, app installabile (PWA solo se gratis in tempo), musica originale, storia. Entrano dopo, uno alla volta, e solo dal `BACKLOG.md`.

## 11. Numeri
I numeri di questo documento sono la **prima ipotesi**. La verità operativa sta in `packages/content/src/balance.json`, nei json di `packages/content/src/minigames/` e (GDR) in `packages/content/src/rpg/`; quando cambiano, si aggiorna la tabella qui e si annota in `ROADMAP.md` §Deviazioni.

## 12. Mondo Sotterraneo (GDR, dal 6 ott 2026)
Sotto le isole ci sono dungeon con combattimento alla Skyrim, voluti da **Riccardo** (che ne cura il design): personaggio con Vita/Magicka/Stamina, 7 abilità, perk, forgia di armi e armature in 8 materiali, alchimia, bottino. **Facoltativo**: chi non scende gioca MAREA come prima. In superficie zero nemici. Tutto il design sta in **`docs/RPG.md`**, che vale come questo documento. Rispetto al §10: il combattimento entra (solo nei dungeon, contro la sim, mai contro gli amici); gli interni restano fuori dalla superficie.
