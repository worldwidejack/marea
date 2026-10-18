# MOBILI — il catalogo della casa e come si aggiunge un mobile (#304)

Un mobile = **una riga di dati + una descrizione + (poi) un modello Blender**. Il gioco funziona già con le prime due: il modello 3D si «collega» da solo quando esiste. Il codice non si tocca per aggiungere un mobile.

## 1. I file (tutto il lavoro di un mobile sta qui)

| File | Cosa | Chi lo scrive |
|---|---|---|
| `packages/content/src/mobili.json` | la riga del mobile: id, nome, categoria, prezzo, posto, ingombro, colori | chi prepara il catalogo (senza Blender) |
| `packages/content/src/mobili_testi.json` | la descrizione che si legge nel gioco | idem |
| `assets/blender/models_mobili.py` | la ricetta `def mob_<id>()` che disegna il modello | idem (non la esegue) |
| `apps/client/public/assets/mob_<id>.glb` + `manifest_mobili.json` | il modello vero | **solo** `npm run assets` sul PC con Blender |

Mai scrivere a mano `.glb` né `manifest_mobili.json`. Il segnaposto è una scatola grande quanto l'ingombro (`apps/client/src/render/mobili.ts`): finché non c'è il modello si vede quella, già nella posizione e nella misura giuste.

## 2. La riga in `mobili.json`

```json
{ "id": "cabina_telefonica", "nome": "Cabina telefonica rossa", "categoria": "decorazioni", "perle": 120,
  "posto": "terra", "celle": [2, 1], "altezza": 2.4, "colori": ["#E8433F", "#23201F", "#F5D547"] }
```

- `id`: minuscolo, cifre e `_`, unico; è anche il nome del modello (`mob_<id>`) e della ricetta (`def mob_<id>()`).
- `nome`: corto (max ~28 caratteri), come sta sul cartellino del negozio.
- `categoria`: una di `categorie` in cima al file (`dormire`, `sedersi`, `tavoli`, `contenitori`, `luci`, `tecnologia`, `piante`, `decorazioni`, `cucina`, `bagno`, `giochi`).
- `perle`: intero > 0. Fasce: piccoli 10-30 · medi 40-90 · grandi/ingombranti 100-250 · pezzi rari fino a 400. Chi non ha idea sceglie per ingombro e bizzarria.
- `posto`: `terra` (celle del pavimento, si gira di 90°) o `parete` (appeso a un muro, una cella di muro).
- `celle`: ingombro a terra `[larghezza, profondità]` in **celle da 2 m**, 1-3 per lato. Assente = `[1,1]`. A parete sempre 1×1 (non scriverlo). La stanza è 7×6 celle (fino a 13×7 con gli ampliamenti del mobiliere, #386, GDD §5): un mobile da 3 celle è un evento.
- `altezza`: metri, solo per la scatola-segnaposto (assente = 1). Mettila vera: aiuta a capire la scena prima del modello.
- `colori`: 1-3 esadecimali **della palette** (ART_BIBLE §2; `#C98A4B` legno chiaro, `#8E5A2B` legno, `#5A3A1E` legno scuro, `#E8E1D6` pietra chiara, `#B9AFA3` pietra, `#7F7568` pietra scura, `#4A4340` roccia, `#23201F` nero caldo, `#E8433F` rosso, `#F2A33A` arancio, `#F5D547` giallo, `#8FC35B` erba, `#2C6B3F` bosco, `#3FB9C9` acqua, `#2478A8` acqua profonda, `#A64DFF` viola, `#F4E3C1` sabbia chiara, `#E2B97F` sabbia). Il primo è il corpo, il secondo il bordo/ripiano, il terzo l'accento.
- `vetrina`: **non esiste più** (#384): non serve scegliere quali mobili stanno in mostra. Ogni mobile entra da solo nella vetrina del giorno (§7).
- `forma`: **non metterlo** (è il vecchio disegno in codice dei primi 3 mobili).

## 3. La descrizione in `mobili_testi.json`

`"testi": { "<id>": "..." }`. Quella che l'utente scrive per ogni mobile (nome + descrizione) si copia **parola per parola** (nome → `nome`, descrizione → qui; correggere solo refusi). Se la descrizione dice «Occupa due slot» → `"celle": [2, 1]` (e si può togliere la frase dal testo se è ridondante col cartellino «occupa 2 celle» che il gioco mostra da solo). Tra 20 e 200 caratteri.

## 4. La ricetta Blender (`models_mobili.py`, mai eseguita da chi non ha Blender)

Una funzione per mobile, **nome identico**: `def mob_<id>():` che ritorna `_obj(m, footprint=[larghezza_m, profondita_m])`, poi registrata in `MODELS` in fondo al file. Il modello d'esempio completo è `mob_comodino_lampada`: ricalcalo.

Convenzioni (le stesse di tutti i modelli, `lib.py`):
- x destra, y su, **davanti −Z**, 1 unità = 1 m. Il gioco gira il modello di 180° da solo: non pensarci.
- **Una cella = 2 × 2 m.** `ingombro(celle)` dà la misura utile (1 cella → 1,9 × 1,9; 2×1 → 3,9 × 1,9). Il pivot è a terra, al **centro dell'ingombro** intero. Il corpo del mobile sta *dentro* l'ingombro (un comodino occupa una cella ma è largo ~1,3 m: il resto è respiro).
- A parete: il retro del mobile a `z = 0` (appoggiato al muro), sporge verso −Z fino a ~0,5 m; altezza dal pavimento tra 1,3 e 2,6 m (muro alto 3,2 m); larghezza ≤ 1,5 m.
- Colori e texture **solo dall'atlas**: i campioni piatti `p_legno`, `p_legno_scuro`, `p_legno_chiaro`, `p_pietra`, `p_pietra_chiara`, `p_pietra_scura`, `p_roccia`, `p_nero_caldo`, `p_rosso`, `p_arancio`, `p_giallo`, `p_acqua`, `p_viola`, `p_erba`, `p_sabbia`… (tutti: `python3 assets/blender/atlas.py`) più le texture (`tavole`, `legno_scuro`, `tessuto_rosso`, `tessuto_blu`, `metallo`, `ferro`, `intonaco`, `oro`, `cuoio`, `pelliccia`, `carta`…). Una regione che non esiste fa fallire la build.
- **≤ 600 triangoli** (i piccoli 60-250). Facce piatte: scatole e prismi a 5-8 lati, niente curve lisce. Pochi volumi grandi e riconoscibili dalla camera alta, come Animal Crossing; un dettaglio buffo per mobile (la maniglia gialla, il gettone incastrato) vale più di dieci rifiniture.
- Primitive utili di `lib.py`: `m.box(x0,y0,z0,x1,y1,z1, lato, top=, bottom=, skip=)`, `m.cbox(cx,cz,w,d,y0,y1, lato, ...)`, `m.prism(n, r0, r1, y0, y1, lato, top=, cx=, cz=)`, `m.cone(...)`, `beam(m, p0, p1, w, h, lato, end=)`, `face(...)`.

## 5. Flusso

**Senza Blender** (Antigravity/Gemini, il portatile): righe in `mobili.json`, testi, ricette in `models_mobili.py`. Controllo: `node tools/mobili_stato.mjs` (tabella: testo / ricetta / modello) + `node tests/run.mjs static types sim boot`. PR piccole: 10 mobili alla volta.

**Sul PC con Blender** (Claude): `git switch main && git pull`, poi
```
node tools/mobili_stato.mjs --ricette      # i nomi mob_<id> con ricetta ma senza modello
npm run assets <quei nomi>                  # genera glb + manifest_mobili.json + anteprime
```
guardare le anteprime in `assets/export/preview` e il gioco con `?test=1` (ARREDA → posa il mobile: la sagoma verde è l'ingombro, il modello deve starci dentro e guardare verso la camera); correggere le ricette dove serve; committare **le ricette corrette, i glb in `apps/client/public/assets/` e `manifest_mobili.json`**. Nessuna riga di codice del gioco da cambiare: il mobile compare da solo al posto della scatola.

## 6. Come funziona (per chi deve toccare il codice)

- Regole di posa: `packages/sim/src/economy/casa.ts` (`celleMobile`: le celle occupate, l'ancora è la cella d'angolo e l'ingombro va verso +x/+z, girando a quarti di giro). Server e client usano le stesse funzioni.
- Vista in casa: `game/arredi_vista.ts` (un mobile con modello è una mesh a parte con texture atlas; gli altri, scatole fuse in una mesh sola). Anteprima e sagoma: `game/arreda.ts`. Negozio: `game/negozio.ts` (i mobili della vetrina del giorno sulle pedane e al muro; il banco del mobiliere dice cosa c'è oggi e quando cambia).
- Caricamento modelli: `render/mobili_modelli.ts` (`manifest_mobili.json`, mai nel JS iniziale; budget ≤ 3 MB, `tools/build.mjs`).

## 7. La vetrina del giorno (#384)

Il negozio **vende solo quello che espone**. Ogni giorno (mezzanotte di Roma, `economy/giorno.ts`) la sim sceglie quali mobili mettere in mostra: `vetrinaDelGiorno(giorno)` in `packages/sim/src/economy/vetrina.ts`, uguale per tutti i giocatori, calcolata da client (cosa disegnare) e server (cosa si può comprare: `compraMobileDelGiorno`, errore 409 «Oggi non è in vendita»).

- **Il pool è tutto `mobili.json`**: aggiungere un mobile (righe, testo, ricetta) basta, non c'è niente da registrare. Per ogni mobile il giorno e l'id danno un punteggio casuale (`createRng`); in vetrina vanno i migliori. Aggiungere un mobile cambia la vetrina di oggi solo se vince lui; gli altri restano dove sono.
- **Quanti**: `"vetrina": { "terra": 6, "parete": 3 }` in testa a `mobili.json` (le pedane del negozio e i posti al muro dopo le carte da parati). Per esporne di più va ingrandito il negozio dentro (`borgo.json negozioDentro`, template `negozio` in `islands.json`).
- **Mobili da più celle** (es. il tavolo da biliardo 2×1) possono uscire: sulla pedana stanno in piccolo, la scheda dice la misura vera.
- **Con il modello 3D** (`mob_<id>` nel manifest) il negozio mostra quello, se no la forma o la scatola.
- **Anche le carte da parati e i pavimenti a pagamento di `borgo.json` ruotano** (#393): `vetrinaDelGiorno(giorno).carte` e `.pavimenti`, capienze `carte` e `pavimenti` accanto a `terra` e `parete`; una nuova riga di `borgo.json` con `perle` entra da sola. Le carte stanno al muro prima dei mobili a parete (insieme non più di 6 posti), i pavimenti sono campioni per terra. Quelli di serie (gratis) sono di tutti e non si vendono. Lato server: `compraFinituraDelGiorno` (fuori vetrina 409 «Oggi non è in vendita»; quello che hai già resta «Ce l'hai già»; l'id sconosciuto 404).
- Test: `packages/sim/test/vetrina.test.ts`; e2e `m3_negozio`.
