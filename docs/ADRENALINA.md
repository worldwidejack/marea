# MAREA — Isola dell'Adrenalina (GDD dell'isola)

> Parte del GDD (`GDD.md` §3, §6 e §14 rimandano qui; vale come il GDD). Isola a tema **per tutti**, proposta da **birbasan** il 10 ott 2026; issue madre #189. Non è un'isola personale: entra con l'**ok di Jack** (10 ott 2026). Nasce da una bozza di decisioni presa in chat; le scelte che la bozza non diceva le ha prese Claude e sono segnate **[scelta provvisoria]**.
> Numeri: andranno in `packages/content/src/adrenalina/` e in `packages/content/src/minigames/<gioco>.json` (uno per gioco). Le tabelle qui sono la **prima ipotesi**; cambiarli = aggiornare qui e una riga in `ROADMAP.md` §Deviazioni.

## 0. In tre righe
Un'isola che è quasi tutta una montagna: neve in cima, bosco a metà, scogliere sul mare. Una **funivia** dal molo porta in vetta, e da lì scegli come buttarti giù: **snowboard**, **bici downhill** o **lancio col paracadute**. Discese brevi (60-120 s) contro il **fantasma** del record di un amico, con una barra **Adrenalina** che moltiplica i punti di chi rischia.

Sta dentro il pilastro 2 del GDD («30-120 secondi, un pollice, si capisce in 3 secondi»): le discese sono minigiochi veri, non dungeon. Adrenalina vera, niente roba da bambini, ma **non si muore mai**: chi cade fa una caduta buffa, perde qualche secondo e riparte.

Riferimenti: *Riders Republic* (una montagna con tante discipline), *Lonely Mountains: Downhill* (low-poly, camera alla diorama), *Cool Boarders* e *Jet Moto* (il sapore PS1).

## 1. Perché è diversa dalle Corse
L'Isola delle Corse (`docs/CORSE.md`, #155) ha già una zona di neve, le bici da cross tra i veicoli e i fantasmi degli amici. Le due isole non si pestano i piedi:

| | Corse | Adrenalina |
|---|---|---|
| Con cosa | veicoli (auto, moto, barche, bob) | il tuo corpo: tavola, bici, paracadute |
| Contro chi | 4 animali piloti più i fantasmi | **solo** i fantasmi degli amici, niente bot |
| Cosa conta | arrivare primo | punti: porte, salti, **trick** e rischio (barra Adrenalina) |
| Durata | 3 giri, ~1:30 | una discesa da 60-120 s |
| Dove | hub a parte, piste a nastro | una montagna sola, ogni gioco è un modo di scenderla |

Il **sistema dei fantasmi** è uno solo per le due isole: lo scrive chi arriva prima (§8).

## 2. Dove sta e come si apre
- **Posizione** **[scelta provvisoria]**: a **nord-ovest**, tra la Selvaggia (`[14, 30]`) e i Ghiacci (`[120, 16]`), verso la cella `[64, 10]` dell'arcipelago (~46×46 celle). La bozza la metteva a nord tra Ghiacci e Tempesta, ma lì dal 9 ott c'è l'Isola delle Corse (`[208, 13]`). A nord-ovest resta a nord, accanto ai Ghiacci (la neve sta bene vicino alla neve) e lontana dal giro iniziale come le altre isole a tema.
- **Sblocco: liberatoria e casco.** Ci sbarchi sempre (barriera 0, come il Vulcano), ma al **cancello della funivia** il guardiano non ti fa salire:
  - la prima volta ti fa **firmare una liberatoria** ironica: «Il parco declina ogni responsabilità per ossa rotte, orgoglio ferito e Perle perse.» FIRMA e basta, una volta sola (resta nel lotto);
  - poi ti fa salire **solo col casco in testa**. Senza casco: «Senza casco qui non sale nessuno.»
  - Il **casco** è un cappello nuovo, il tredicesimo di GDD §4. **[scelta provvisoria]**: si compra a **35 Perle** dall'editor come la Lanterna (non è del Mercante), arancione con la visiera scura e una striscia bianca, colori della palette. Il tipo di sblocco è quello del Vulcano (`tipo: "cappello"`), più la firma.
- **Per le prove** (`?adrenalina=1` nell'indirizzo): liberatoria già firmata, casco non richiesto, e un bottone nella barra in alto che porta subito in vetta. Il premio resta quello vero.

## 3. L'isola
Un picco solo, da guardare dalla barca come un cartello: «qui si scende».

| Zona | Cosa c'è |
|---|---|
| **Molo e stazione a valle** | il molo, la biglietteria di legno col guardiano, il cancello, la cabina rossa della funivia, il cartello delle piste con i colori |
| **Scogliere** | rocce a strapiombo sul mare sul lato nord, dove atterra chi si lancia |
| **Bosco** (a metà) | abeti, sentieri di terra battuta, tronchi e passerelle: le piste della bici |
| **Vetta** (innevata) | la stazione a monte, le piste della neve che partono a ventaglio, la piattaforma del lancio sul bordo |

Nel mondo l'isola si vede in piccolo, con la funivia che sale e scende. Le **discese si giocano in una scena a parte** (come i dungeon, i Templari e l'hub delle Corse): la montagna vista da vicino, con la sua camera, così la velocità si sente e il resto dell'arcipelago non paga il costo. Sali in funivia (pochi secondi, la vista dall'alto), scegli il gioco e la pista al cartello della vetta, scendi, e torni in vetta per un'altra o giù al molo.

## 4. Le discese
- **Formato dei minigiochi** (GDD §6, `packages/sim/src/minigames/`): modulo puro e deterministico, `create/step/result/autopilot`, il server rigioca gli input e paga le medaglie. Punteggio «più alto vince».
- **Durata**: 60-120 s a discesa. Niente modalità lunga.
- **Piste fisse disegnate a mano**, non generate dal seed: un record vale solo se la pista è sempre la stessa, e il fantasma si rigioca sulla stessa identica pista. Il seed decide solo i dettagli (il vento del lancio, la neve che si alza).
- **Colori come sulle piste da sci**: verde → blu → rossa → nera per ogni gioco. Al primo giro c'è la verde; le altre si aprono con le medaglie (§9). La nera del lancio è la **wingsuit**.
- **Non si muore mai.** Cadere (contro un albero, un atterraggio storto, un'apertura troppo tardi) = animazione buffa, **2 s** persi **[scelta provvisoria]**, barra Adrenalina a zero, riparti dal punto della caduta.
- **Cartello delle regole** di 3 s in italiano all'inizio, come ogni minigioco.

## 5. Controlli
Un pollice basta; sul PC tastiera.

| | Telefono | PC |
|---|---|---|
| Curvare | trascini a destra e a sinistra | A/D o frecce |
| Saltare (snowboard) | lasci il dito sul trampolino | lasci Spazio |
| Trick in aria | un gesto col dito (su, giù, giro) | frecce in aria |
| Scatto (bici) | tocco | Spazio |
| Paracadute | tocco = apri | Spazio |

## 6. Barra Adrenalina
Il marchio dell'isola, uguale in tutti i giochi. **[scelta provvisoria]** sui numeri:
- Si riempie quando **rischi**: passi rasente a un albero o a una roccia, fai un salto lungo, chiudi un trick all'ultimo, apri il paracadute tardi, voli basso in wingsuit.
- Tre gradini: **×1** (vuota), **×2** (a metà), **×3** (piena) sui punti che fai mentre è su.
- **Cadi e si azzera.** Se non rischi per qualche secondo cala piano.
- Sta sempre nello stesso posto dello schermo, con lo stesso colore e suono in tutti e tre i giochi.

## 7. I giochi (primo giro)

### Snowboard (le piste della neve, dalla vetta)
Trascini per curvare tra le **porte** (bandierine a coppie), lasci sul **trampolino** per saltare, in aria un gesto = **trick**. Atterrare dritto chiude il trick; atterrare storto è una caduta. Punti: porte passate, salti, trick (più trick nello stesso salto valgono di più), tutto per la barra. Una porta saltata toglie punti, non ferma la discesa. È il primo gioco che si fa (passo 3): se non diverte ci si ferma e si corregge prima degli altri.

### Bici downhill (le piste del bosco)
Stessi comandi; il tocco è lo **scatto** (un colpo di pedale, poi qualche istante per ricaricare). Sentieri stretti tra gli abeti, radici, passerelle, salti sui dossi. Qui il fantasma conta più che altrove: è una gara contro il tempo dell'amico, con i punti del rischio sopra.

### Lancio dalla vetta (dalla piattaforma sul bordo)
Ti butti: **caduta libera** negli **anelli** sospesi (trascini per centrarli), il terreno sale. **Tocco = apri il paracadute**: più tardi lo apri, più punti; **troppo tardi** = atterraggio buffo sul prato o in mare sotto le scogliere, pochi punti, non si muore. Sotto il paracadute guidi verso il **bersaglio** d'atterraggio. La **wingsuit** è la pista nera: volo rasente alle rocce in un canyon, la barra si riempie quanto più stai basso.

## 8. I fantasmi degli amici
- Nessun bot. In pista corri contro la **replica trasparente** del record di un amico su quella pista: è il suo log di input rigiocato nella sim (lo stesso log che il server già usa per controllare il punteggio).
- Di serie il fantasma è quello del **migliore** del gruppo su quella pista; al cartello si può scegliere un amico.
- I record per pista stanno sul server (come il Tabellone dei record del Porto, GDD §5), con gli input del migliore di ciascuno.
- **Uno solo per Corse e Adrenalina**: le Corse li hanno in programma alla fetta 6 (#155). Chi arriva prima scrive il sistema comune; l'altra isola lo usa.

## 9. Premio e sblocchi
- Ogni discesa paga a medaglie come gli altri minigiochi delle isole a tema: `balance.solo` più un **oro in più** (`premioExtra`), con lo stesso tetto di partite premiate al giorno. **[scelta provvisoria]**: +15 Pietra all'oro.
- **Medaglie** **[scelta provvisoria]**: in frazione del punteggio del pilota di riferimento sulla stessa pista (come Arrembaggio e Fuga dalla lava). I numeri veri si fissano al passo 3 giocando.
- **Sblocchi delle piste**: una medaglia d'**argento** su una pista apre quella del colore dopo dello stesso gioco **[scelta provvisoria]**.

## 10. Camera
Da scegliere al **passo 3** con due screenshot A/B sulla pista verde dello snowboard:
- **A**: alle spalle, bassa e veloce (più adrenalina);
- **B**: dall'alto in diagonale come *Lonely Mountains* (più MAREA, più leggibile sul telefono).

## 11. Audio
Suoni nostri e sintetizzati (motore di `apps/client/src/audio/`, zero file), al passo 8: il **vento che sale con la velocità**, la neve sotto la tavola, la catena e i freni della bici, lo schiocco della vela del paracadute che si apre, e una **musica tesa** che sale con la barra Adrenalina.

## 12. Da decidere (non bloccano)
- **Casco**: aspetto e prezzo finali (la proposta è in §2).
- **Camera**: al passo 3 (§10).
- **Dopo il primo giro** (`BACKLOG.md`): tuffo dalla scogliera, moto d'acqua (riusa la barca), parapendio, zipline, bungee.

## 13. Come funziona sotto (per chi programma)
- **Un modulo per gioco** in `packages/sim/src/minigames/` (`snowboard.ts`, `downhill.ts`, `lancio.ts`), registrato in `registry.ts` come gli altri: il server paga dal solito giro dei minigiochi (`/api/solo/start`, `/api/solo/play`), rigiocando gli input. Le regole di `packages/sim` valgono tutte (niente trascendenti, `trig.ts`).
- **Piste in content**, non nel seed: `packages/content/src/adrenalina/piste/<gioco>_<colore>.json` (tracciato, porte, salti, anelli, ostacoli). La sim le legge; il seed cambia solo i dettagli.
- **Barra Adrenalina** come pezzo comune ai tre moduli (stessa logica, stessi numeri da content).
- **Scena a parte** nel client in un **chunk** suo caricato all'ingresso della funivia, con la sua riga nel budget di `TECH.md` §5.
- **Fantasmi** (passo 4): record e input del migliore per pista sul server; se serve una tabella nuova, migrazione D1 col numero successivo. In comune con le Corse (§8).
- **Sblocco**: `tipo: "cappello"` come il Vulcano, più un flag «liberatoria firmata» nel `LotState`.

## 14. Piano di lavoro (issue madre #189, una PR per passo, ognuna online)
1. **Documenti**: questo file, GDD §3 §6 §14, ROADMAP §Deviazioni, BACKLOG. **Ok di Jack** (fatto, 10 ott 2026).
2. **Isola**: la montagna (vetta innevata, bosco, scogliere), molo, funivia, posizione a nord-ovest, lucchetto; il casco e il cancello con la liberatoria; `?adrenalina=1`.
3. **Snowboard completo**: pista verde, barra Adrenalina, cadute, medaglie e premio dal server, telefono 390×844. Qui si sceglie la camera. Se non diverte ci si ferma.
4. **Fantasmi degli amici**: record per pista sul server, il fantasma in pista.
5. **Bici downhill**.
6. **Lancio dalla vetta** (paracadute; la wingsuit come pista nera).
7. **Piste blu, rossa e nera** per i tre giochi e sblocchi a medaglie.
8. **Audio**.
