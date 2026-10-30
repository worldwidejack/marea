# Il tutorial e la storia — da tenere allineati (leggere se tocchi isole o minigiochi)

Il tutorial (GDD §9) **nomina e porta a mano** il giocatore su posti e giochi veri: il Borgo e le sue botteghe, la Grotta, le **isole** e il **minigioco di ognuna**. Se cambi uno di questi e non aggiorni il tutorial, il gioco manda la gente in un posto che non c'è più, o a provare un gioco che non conta.

## Quando questo file ti riguarda
Ogni volta che la tua PR **aggiunge, rimuove, rinomina, sposta o cambia il minigioco** di:
- un'**isola** (anche solo il suo nome, l'ordine tra le isole, o sostituire il gioco che la rappresenta);
- un **minigioco/modalità** che il tutorial presenta (oggi: Regata, Gran Premio, Templari, Difesa, Arena, Snowboard, Fuga dalla lava, Carpe koi, Pinguini, Arrembaggio, la Grotta, l'Ingorgo);
- un **personaggio o luogo del tutorial** (Nonna Pina, Fulvio, il Furetto, Bepi, Gigi, Capitan Remo, il Cantiere navale, il Porto).

## Dove sta il tutorial
| Cosa | File |
|---|---|
| Testi, numeri, **elenco delle isole e del gioco che le rappresenta** (`isole[]`: `isola`, `gioco`, `premio`, `cosa`), passi, consigli, dialoghi | `packages/content/src/storia.json` |
| Stato e regole (passo corrente, isola «provata», viaggio rapido sbloccato) | `packages/sim/src/economy/storia.ts` |
| Flusso del client, dialoghi, missioni di Remo, frecce e bussola | `apps/client/src/storia/` (`passi.ts`, `missioni.ts`, `dialoghi.ts`, `viaggio.ts`, `index.ts`) |
| La scheda a schermo | `apps/client/src/ui/guida.ts` |
| Test | `packages/sim/test/storia.test.ts` |
| Descrizione a parole | `docs/GDD.md` §9 e `docs/VISIONE.md` §1 (riga «Storia e tutorial») |

## Cosa fare, caso per caso
1. **Nuova isola** → aggiungi la riga in `storia.json` → `isole[]` nella posizione giusta (l'ordine è quello in cui Remo le dà). `gioco.tipo`/`id` devono essere quelli che il server registra come «partita giocata» (`diario.giocati`, `minigioco`/`templari`/`difesa`/`arena`): controlla in `economy/storia.ts` come viene riconosciuto. Poi: `premio`, `cosa` (testo: «una partita a…»). Se l'isola ha un molo/mercante nuovo, controlla che la freccia e la bussola di `missioni.ts` la trovino.
2. **Isola rimossa o rinominata** → togli/aggiorna la riga in `isole[]`, e cerca il vecchio nome in `storia.json` (consigli, dialoghi di Remo e Bepi), in `dialoghi.ts` e in `GDD.md` §9 (l'elenco «Laguna, Corse, Templari…»). Chi ha già finito quella missione deve restare coerente: guarda come `economy/storia.ts` legge `diario.isole` e **non rompere i salvataggi esistenti**.
3. **Minigioco cambiato o sostituito su un'isola** → aggiorna `gioco` e `cosa` della sua riga. `gioco` decide cosa conta come «provato»: se resta il vecchio id, la missione non si chiude mai.
4. **Minigioco rimosso senza sostituto** → l'isola non può restare in `isole[]` con un gioco che non esiste: o ne scegli un altro, o la togli (caso 2).
5. **Ordine/difficoltà cambiati** → Remo le dà in ordine di `isole[]` (premi crescenti 50→150): rimetti l'ordine e i premi in modo sensato.
6. **Cambia un luogo o un personaggio del tutorial** (Cantiere, Furetto, Grotta, Fabbro…) → aggiorna `come` dei passi, `barca.consigli` e i `dialoghi` in `storia.json`: dicono dove andare in parole («in riva a est del molo», «sotto la piazza»).

## Prima di dire «fatto»
- `node tests/run.mjs static types sim` verdi (`storia.test.ts` scorre tutte le isole di `STORIA.isole`: se si rompe, il tutorial è fuori sync).
- Prova il tutorial a mano con `?storia=1` (coi test `?test=1` la storia parte solo così), a 390×844: le frecce portano davvero al posto, la scheda mostra il testo giusto, il viaggio rapido apre l'isola.
- `docs/GDD.md` §9 e, se cambia la regola, `docs/VISIONE.md` dicono la stessa cosa del codice.
- Nella PR scrivi sotto «Decisioni prese» cosa hai cambiato nel tutorial e perché; se non l'hai toccato, una riga: «tutorial: non toccato perché …».

## Regola breve
**Isola o minigioco toccato = `storia.json` controllato.** Il numero di cose che il tutorial nomina è piccolo e sta tutto in `storia.json`: costa un minuto guardarlo, costa molto di più un giocatore nuovo bloccato alla prima ora.
