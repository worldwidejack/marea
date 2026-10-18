# MAREA — Isola dell'Arena (GDD e com'è ora)

> Documento di riferimento della modalità PvP e dell'Isola dell'Arena. Le parti 1-4 sono il design di Riccardo; la parte 5 dice com'è fatta
> adesso (17 ott 2026, #373). Le voci **[proposta]** sono scelte di Claude dove il design non diceva niente: si cambiano nei JSON di
> `packages/content/src/arena/arena.json` (e una riga in `ROADMAP.md` §Deviazioni). Mappa del codice: `CONTRACTS.md` §48; messaggi: `PROTOCOL.md` §10.

---

## 1. Visione del Gioco
Una modalità PvP in stile *Brawl Stars* su un'isola nuova dell'arcipelago («Isola dell'Arena»), con il combattimento, le armi, le armature, le
magie e le pozioni dei dungeon.

### Modalità
- **1v1 (Duello rapido)**: la prima versione, al meglio dei 3 round. **Fatta.**
- **Showdown (Tutti contro tutti a 4)**: evoluzione futura, vince l'ultimo in piedi.
- **A squadre (2v2 / 3v3)**: evoluzione futura, basata su cooperazione e ruoli (la sim ha già le squadre: `DungeonState.pvp.squadre`).

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
  uguale tra client e server, premio), `tests/e2e/m4_arena.mjs` (telefono e PC), `tests/e2e/m4_arena_server.mjs` (due client finti contro
  il server: coda, sala, linea persa e ripresa, resa, premio).

### Da fare dopo
- Showdown a 4 e squadre 2v2/3v3 (la sim ha già le squadre).
- Modelli veri (Blender) per l'interno del colosseo: oggi muri, colonne e muretti sono il kit dei dungeon e blocchi in codice.
- Una classifica o un titolo per chi vince di più (il Diario del capitano).
- L'isola nuova va confermata da Jack (`BACKLOG.md`, «Da confermare»).
