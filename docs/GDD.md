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
4. **Sfide** (1-3): rispondi a una sfida differita o ne lanci una; prendi la barca e vai al porto se ti va di guardare le isole degli altri.
5. **Esci** con almeno un timer che finirà prima del prossimo rientro (il gioco lo dice: «la Cava finisce tra 6 h»).

## 3. Il mondo: l'arcipelago
- **Zone comuni** (tutti le vedono, nessuno le possiede): in V1 una sola zona vera, il **Porto** (villaggio con edifici e mood asiatico: lanterne, torii, moli di legno, insegne). Il **Distretto Neon** (cyberpunk leggero) e l'**Isola Selvaggia** (natura, scogliere, palme) esistono come **facciate** visibili dalla barca; diventano zone vere dopo dicembre.
- **Isole personali (lotti)**: una per amico, disposte attorno al Porto. Vi si arriva in barca o con «vai a casa». Un lotto è una griglia di celle da 2 m con slot per edifici e decorazioni; il Molo è sempre costruito e fa da spawn.
- **Barca**: il mezzo principale. Sali dal molo (tasto A vicino alla barca), guida arcade (accelerazione, virata, scia), scendi a qualsiasi molo. Anche a piedi sulle isole.
- **Camera**: dall'alto in diagonale (diorama), segue l'avatar, zoom 0,6-1,6. Stessa vista per costruire.
- **Ciclo giorno/notte**: no in V1 (luce fissa del tardo pomeriggio).

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
- **Produzione pigra**: ogni edificio accumula nel suo deposito in base al tempo trascorso (`advance(lotto, oraServer)`), fino a un tetto pari a **10 ore** di produzione. Raccogliere sposta il deposito nel Magazzino, fino al suo tetto. Il server è l'unica autorità del tempo; il client non usa mai il suo orologio per l'economia.
- **Costruire** = spesa immediata + timer; un solo cantiere alla volta in V1. Niente acceleratori a pagamento: **mai soldi veri**.
- **Partenza**: Molo L1, 100 Legno, 40 Pietra, 0 Perle. Nei primi 10 minuti si costruiscono Segheria e Cava e si scopre il Tavolo.
- **Taratura**: tutti i numeri stanno in `packages/content/src/balance.json` e si verificano con `economy_30days.test.ts` su tre archetipi (chi entra 2 volte al giorno / 1 volta / 2 volte a settimana → dopo 30 giorni ~100 % / ~75 % / ~40 % degli edifici a L2, nessuno a L3 pieno).
- **Dai minigiochi**: medaglia → Perle **5 / 10 / 20** (bronzo / argento / oro) e attiva il Faro. Chi perde una sfida prende comunque **2 Perle** (mai zero).

## 6. Minigiochi
**Formato comune** (in `packages/sim/src/minigames/`): modulo puro e deterministico, 60 Hz, `create({seed, difficulty})`, `step(state, input)`, `result(state)`, `autopilot`. Stesso seed = stessa partita, sempre. Il punteggio è **sempre «più alto vince»**; i dettagli (tempo, combo) stanno in `result().detail`.

**Sfide differite** (dal giorno uno): A gioca oggi con un seed; B entra domani, gioca lo **stesso** seed e vede se batte il punteggio di A. Nessun bot. Il server rigioca l'input log nella sim e verifica il punteggio dichiarato.

**Ordine**
1. **Regata** (M1) — gara in barca a tempo tra 6-8 boe nella laguna del Porto, con raffiche di vento da seed che spingono di lato. Riusa barca, mondo e camera. Tempo massimo 120 s; `score = max(0, 12000 − floor(ms/10))`. Medaglie (da tarare): oro ≤ 45 s, argento ≤ 60 s, bronzo ≤ 90 s. Le boe si passano in ordine, la prossima è evidenziata. Controllo: joystick per virare, A per accelerare.
2. **Lanterne** (M2 se c'è tempo) — al Porto, 6 lanterne; si accendono in sequenza a ritmo, le tocchi nello stesso ordine; la sequenza cresce; un errore chiude la partita; 60 s max; `score = lanterne giuste × combo`.
3. **Puzzle leggero** (2027) — tubi o tessere da ruotare con i moduli dell'isola.
4. **Battaglia carte/unità in tempo reale** (2027) — richiede avversario live o bot, netcode a bassa latenza, bilanciamento: si fa dopo il collaudo di dicembre.

Ogni minigioco: cartello regole di 3 s in italiano, si gioca con un pollice, anche chi perde prende qualcosa.

## 7. Sfide e wager
- **Creare**: al Tavolo delle Sfide scegli minigioco, avversario, posta (Legno/Pietra/Perle, ≥ 10 e ≤ tetto del Tavolo); il seed lo genera il server; giochi subito il tuo turno. La posta va in **escrow** nel libro mastro.
- **Rispondere**: l'altro ha **24 h** per accettare (posta pari, in escrow) e giocare lo stesso seed. Punteggio più alto prende il piatto. Nessuna risposta o parità → rimborso a entrambi.
- **Colpo di coda**: se chi risponde ha meno del **50 %** delle risorse totali dello sfidante e vince, prende **1,5×**. Premia lo sfavorito, scoraggia il bullismo.
- **Gratis al giorno** 3/5/8 per livello del Tavolo; oltre, 1 Perla a sfida.
- **Invariante** (testato): somma risorse di tutti + escrow = generato − speso, sempre.

## 8. Tra amici
Mondo alla GTA: né coop né guerra. Nessuno attacca o modifica le isole altrui. Ci si vede muoversi nel Porto e in mare (presenza a 10 Hz), si visitano le isole degli altri (sola lettura), si comunica con 4 emote e con le sfide. Niente chat testuale in V1. Ingresso solo con link personale mandato da Jack.

## 9. Onboarding (60 s, M2)
Arrivi sul tuo molo → «tocca la Segheria per costruirla» → «tocca per raccogliere» → «sali in barca» → al Porto «il Tavolo delle Sfide: sfida un amico». Niente tutorial a testo lungo: frecce e un'azione alla volta.

## 10. Tagli espliciti V1 (fino a dicembre 2026)
Fuori: battaglia unità, bot, puzzle, chat testuale, interni degli edifici, ciclo giorno/notte, commercio tra giocatori, apertura al pubblico, app installabile (PWA solo se gratis in tempo), musica originale, storia. Entrano dopo, uno alla volta, e solo dal `BACKLOG.md`.

## 11. Numeri
I numeri di questo documento sono la **prima ipotesi**. La verità operativa sta in `packages/content/src/balance.json` e nei json di `packages/content/src/minigames/`; quando cambiano, si aggiorna la tabella qui e si annota in `ROADMAP.md` §Deviazioni.
