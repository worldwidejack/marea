# MAREA — Isola dell'Arena (GDD e com'è ora)

> Documento di riferimento della modalità PvP e dell'Isola dell'Arena. Le parti 1-4 sono il design di Riccardo; la parte 5 dice com'è fatto
> il duello (17 ott 2026, #373), la parte 6 le squadre, l'erba alta e le mappe (23 ott 2026, #567). Le voci **[proposta]** sono scelte di Claude dove il design non diceva niente: si cambiano nei JSON di
> `packages/content/src/arena/arena.json` (col perché nella PR). Mappa del codice: `MAPPA.md`; messaggi: `packages/protocol/src/arena.ts`.

---

## 1. Visione del Gioco
Una modalità PvP in stile *Brawl Stars* su un'isola nuova dell'arcipelago («Isola dell'Arena»), con il combattimento, le armi, le armature, le
magie e le pozioni dei dungeon.

### Modalità
- **1v1 (Duello rapido)**: la prima versione, al meglio dei 3 round. **Fatta.**
- **Showdown (Tutti contro tutti a 4)**: evoluzione futura, vince l'ultimo in piedi.
- **A squadre (2v2 / 3v3)**: **fatta** (23 ott 2026, #567), con l'erba alta come in Brawl Stars e due mappe nuove: parte 6.

---

## 2. Regole di Gioco & Loadout

### Set Pre-Partita (fatto)
All'ingresso del colosseo (**ENTRA NEL COLOSSEO**, o A vicino al portone) si apre il pannello del colosseo col **set del duello**, scelto tra
quello che hai nello **zaino e nel Forziere**, e salvato col personaggio (`HeroState.arena`, `POST /api/rpg {t:'arena'}`):
- **Vestizione**: armatura (o veste) e due anelli.
- **4 slot rapidi**: armi, archi o magie conosciute, intercambiabili al volo (la stessa arma o magia una volta sola).
- **Frecce per l'arco**: ogni arco ha il suo tipo di freccia, **18 a duello** **[proposta]**, fuori dagli slot; senza sceglierne uno, frecce di legno.
- **2 pozioni rapide**: una a testa per round **[proposta]**.
- **[proposta]** In Arena non si consuma e non si perde niente: frecce, pozioni e armi di vetro tornano come prima a ogni round, lo zaino e
  l'equipaggiamento dei dungeon non cambiano. Senza niente negli slot si combatte coi pugni.

### Interfaccia Utente (fatta)
- In alto il **tabellone**: la tua vita (con Magicka e Stamina sotto), il tempo del round e i round vinti a pallini, la vita dell'avversario.
- In basso la **barra**: i 4 slot (tocco su telefono 390×844, tasti **1-4** su PC) con le 2 pozioni ai lati (tocco, tasti **5-6** o Q/R).
  Sullo slot si vede quante frecce restano (archi) o quanta Magicka costa (magie).
- Joystick di movimento, A e B come sempre (alzati sopra la barra); con l'arco o una magia in mano, al telefono il **joystick di mira** al
  posto di A, al PC il clic sinistro tenuto e la mira verso il cursore, come nei dungeon. E: la Scarica dell'arco (perk).
- Menu (Esc o il bottone in alto a destra): RIPRENDI e **ARRENDITI** (con conferma).
- La camera guarda un po' verso l'avversario, così si vedono tutti e due finché si è vicini.

---

## 3. Nuove Magie di Supporto (Step 1, 16 ott 2026)
- **Cura a flusso**: raggio continuo concentrato su un singolo alleato o evocazione.
- **Cura a bomba**: lancio ad area che cura alleati ed evocazioni nella zona d'impatto.
- **Furia a flusso**: raggio continuo che aumenta velocità e danno di un singolo alleato o evocazione.
- **Furia a bomba**: lancio ad area che potenzia per qualche secondo chi si trova nel raggio d'azione.
- In Arena valgono **solo su di te, sui compagni e sulle tue evocazioni**, mai sull'avversario; **[proposta]** senza nessuno dei tuoi davanti
  il flusso va su di te e la bomba ti cade ai piedi (così servono anche nel duello 1v1).

---

## 4. Principi di Bilanciamento PvP (Step 1)
- **Statistiche normalizzate**: tutti partono con 100 di Vita, 100 di Magicka e 100 di Stamina (`buildArenaHero`).
- **Perk attivi ma calibrati**: i danni sono × `arena.dannoMolt` (0,45) e mai oltre `arena.dannoMax` (92 su 100): niente one-shot.
- **Evocazioni accessibili**: con un perk di Evocazione le creature più forti si lanciano anche consumando tutta la Magicka. **[proposta]**
  Sugli eroi il loro danno è scalato come quello delle armi (× `dannoMolt`); attaccano l'eroe avversario e le sue evocazioni, e sono bersagli
  per lui. Le evocazioni dell'avversario si vedono **rosse** (le tue viola).
- **Indipendenza**: il bilanciamento dell'Arena non tocca i dungeon (stessi hash, stessa fixture d'oro).
- **[proposta]** Gli effetti dei perk che lavorano sui nemici del dungeon (sanguinamento, paralisi, veleno, Lama d'aria, Terremoto, Eco della
  Marea, Combustione, Automira) sugli eroi non valgono: conta il danno. Il Patto di sangue non porta la creatura nel duello.

---

## 5. Com'è fatta adesso (17 ott 2026, #373)

### Isola dell'Arena
- Isola `arena` 36×34 a sud-est del Porto (`[238, 256]`, tra i Templari e il Vulcano), **aperta a tutti** (sblocco `libera`) **[proposta]**:
  molo a sud-ovest, viale lastricato con gli stendardi e due bracieri fino al **portone del colosseo**.
- Il **colosseo**: anello di pietra chiara a due ordini di archi (venti campate), gradinate dentro, la sabbia dell'arena, due torri col tetto
  rosso ai lati del portone, stendardi rossi e gialli in cima: alto ~10 m, si vede dal mare (`render/island_arena.ts`).
- In bussola la meta **Colosseo** (sezione Isole).

### La mappa del duello (il colosseo da dentro)
Chiusa, **simmetrica** (ruotata di mezzo giro) **[proposta]**, 19×13 celle da 2 m: colonne (fermano passi e tiri), muretti bassi (fermano i
passi, non i tiri), bracieri sui muri. Le due partenze ai lati opposti, una di fronte all'altra, con una colonna in mezzo a coprire la linea
dritta. Tutto in vista: niente nebbia dei dungeon. Formato dei dungeon (`ARENA.mappa`, stile `colosseo`).

### Il duello 1v1
- **Trovare l'avversario**: **CODA VELOCE** (il primo che c'è) o **SFIDA UN AMICO** (CREA SALA dà un codice di 4 lettere da dire all'amico,
  che lo scrive e preme ENTRA). **ALLENAMENTO**: contro l'avversario automatico, con una copia del tuo set, senza server né premio.
- **Round** **[proposta]**: 3 s di conto alla rovescia (fermi, si può già cambiare slot), 90 s di gioco, 3 s col risultato. Ogni round riparte
  da capo: vita, posizioni, slot, frecce e pozioni.
- **Vince il round** chi resta in piedi; caduti insieme = pari. **A tempo scaduto** **[proposta]** vince chi ha più Vita; sotto 1 punto di
  differenza è pari (non conta).
- **Vince la partita** chi arriva a 2 round; **[proposta]** dopo 5 round si chiude comunque (più round vinti, se no pareggio).
- **Resa**: dal menu (ARRENDITI) o uscendo; la partita finisce subito e vince l'altro.
- **Linea persa** **[proposta]**: il duello si ferma e l'altro vede «ha perso la linea: lo aspetto ancora N s»; il gioco si ricollega da solo e
  riprende coi turni persi. Dopo **20 s** senza tornare è dato per arreso (sconfitta).
- **Il server decide**: il DO `Arena` fa girare il duello coi turni dei due e a fine partita lo **rigioca dal log** (`replayDuello`); l'esito del
  replay vale per il premio. Se il server si riavvia a metà (un deploy) il duello si perde, senza premio.

### Esito e premio
- Scheda finale: VITTORIA / SCONFITTA / PAREGGIO, come (round vinti o resa) e il premio.
- **Premio** **[proposta]**: monete del personaggio, **30** per una vittoria, **10** per una sconfitta a round, niente per pareggio e resa;
  **tetto di 150 monete al giorno** (giorno UTC), come i Templari. Il lotto tiene vinte, perse e pari (`LotState.arena`).

### Prove
- **Stanza di prova senza server**: `?test=1&net=0&arena=banco` entra subito nell'allenamento contro l'avversario automatico (`sim/arena/bot.ts`).
  `?arena=1`: il bottone ⚔ porta al colosseo.
- Test: `packages/sim/test/arena_duello.test.ts` (set, colpi tra eroi, evocazioni, Cura e Furia, pozioni, round, pareggio a tempo, resa, replay
  uguale tra client e server, premio), `packages/sim/test/arena_squadre.test.ts` (2v2 e 3v3, mappe, erba alta), `tests/e2e/m4_arena.mjs` e
  `m4_arena_squadre.mjs` (telefono e PC), `tests/e2e/m4_arena_server.mjs` (client finti contro il server: coda, sala, linea persa e ripresa,
  resa, premio, 2v2 coi gladiatori).

### Da fare dopo
- Showdown a 4 (tutti contro tutti: oggi le squadre sono sempre due, pari).
- Modelli veri (Blender) per l'interno del colosseo e per le mappe nuove: oggi muri, colonne, muretti ed erba sono blocchi in codice (`rpg/arena_kit.ts`).
- Una classifica o un titolo per chi vince di più (il Diario del capitano).
- L'isola nuova va confermata da Jack (`BACKLOG.md`, «Da confermare»).

---

## 6. Squadre, erba alta e mappe (23 ott 2026, #567)

### Formati e squadre
- Tre formati, scelti nel pannello del colosseo: **1 contro 1**, **2 contro 2**, **3 contro 3**. Due squadre sempre pari (`DuelloState.squadre`:
  0 o 1 per eroe; la sim è quella del duello, `s.pvp.squadre`). Cura e Furia valgono su tutta la propria squadra.
- **Round**: finisce quando una squadra è tutta a terra (cadute insieme = pari). A tempo scaduto vince la squadra con più Vita in tutto (somma);
  sotto 1 punto di differenza è pari. Al meglio di 3 round come il duello **[proposta]**.
- **Chi cade** resta a terra fino al round dopo e guarda i compagni (la camera li segue, un cartello dice «SEI A TERRA»).
- **Resa** (dal menu): chi si arrende da una squadra di più esce dai round che restano e la squadra continua; se si arrendono tutti vince l'altra.
  Il 1v1 non cambia: la resa chiude subito. Chi perde la linea per più di 20 s è dato per arreso allo stesso modo.
- Il tabellone ha una barra di vita per eroe (la mia squadra a sinistra, io per primo); i nomi sopra la testa sono verdi per i compagni e rossi
  per gli avversari che si vedono.

### Trovare gli altri e i gladiatori
- **Coda veloce a squadre**: si parte con 2×f persone, o dopo 10 s (`arena.json` → `rete.attesaBotSecondi`) con chi c'è **[proposta]**; le persone si
  alternano tra le squadre (squadre pari). **Sala con codice**: la squadra di chi l'ha aperta si riempie per prima (l'amico che entra col codice
  gioca con te), poi l'altra; chi l'ha aperta preme **PARTI ORA**, o si parte da soli a sala piena.
- I posti vuoti li prendono i **gladiatori automatici** (`sim/arena/bot.ts`, nomi e look in `arena.json` → `gladiatori`): hanno una copia del set di
  una delle persone, e i loro input li decide il server (stesso turno delle persone, stesso replay). Se non resta nessuna persona, si arrendono.
- **[proposta]** Se tra gli **avversari** ci sono gladiatori niente monete (si contano vinte e perse): non si fa il pieno contro i bot. Con i
  gladiatori solo nella tua squadra il premio c'è. L'ALLENAMENTO locale resta senza server né premio: tu (e i compagni) contro i gladiatori,
  con la mappa a scelta o a caso.

### Erba alta (come in Brawl Stars)
- Le celle `E` (legenda `erba`): chi ci sta dentro **non lo vedono gli avversari**: non si disegna, niente nome, la mira assistita non lo punta.
  I compagni lo vedono sempre. Colpi, frecce, scoppi e mischia lo prendono lo stesso.
- Lo **scoprono** **[proposta]**: un avversario entro 3 m, e per 1,2 s chi attacca (qualsiasi azione tranne bere, o un raggio acceso) o prende un
  colpo (`balance.json` → `arena.erba`: `raggio`, `rivela`; `sim/dungeon/erba.ts`).
- A chi sta nell'erba un cartello dice «NELL'ERBA: NON TI VEDONO». Nella scena: una macchia scura e ciuffi alti fino a ~1 m; attorno a chi
  cammina l'erba si abbassa (la finestra sull'eroe), così ci si vede sempre.
- I gladiatori rispettano l'erba: non vedono chi è nascosto, lo cercano dove l'hanno visto l'ultima volta. Le evocazioni invece vedono tutti.
- Il client riceve gli stessi turni di tutti e ha tutto lo stato (come in ogni partita a turni): l'erba nasconde sullo schermo e alla mira, non
  protegge da chi modifica il client.

### Mappe
Tutte chiuse e simmetriche (ruotate di mezzo giro), 2 m a cella, con partenze a lati opposti; `validateArena` controlla chiusura, simmetria,
partenze e che tutto il pavimento si raggiunga. La mappa di ogni partita la sceglie il server (dal seed) tra quelle del suo formato.
- **Colosseo dell'Arena** (1v1 e 2v2, 21×15): com'era, più tre ciuffi d'erba, due partenze per squadra.
- **Giardino dei Gladiatori** (2v2 e 3v3, 27×17): vialetti di ghiaia, siepi attorno, basamenti con cespuglio, staccionate e tre prati d'erba alta
  (uno grande al centro con un basamento in mezzo). Stile `giardino`.
- **Rovine del Tempio** (2v2 e 3v3, 23×21): le squadre partono in alto e in basso; colonne spezzate, muri a pezzi, prati d'erba sui fianchi e
  quattro attorno al centro. Stile `rovine`.
Una mappa nuova è una voce in `arena.json` → `mappe` (`rows` con `E` per l'erba, `legenda`, `formati`, `spawn` per squadra) e, se serve un aspetto
suo, un kit in `rpg/arena_kit.ts` e una riga in `STYLE` di `rpg/dungeon_scene.ts`.
