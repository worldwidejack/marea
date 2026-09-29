# MAREA — test e collaudo

## Per Jack: 5 passi dal telefono (5 minuti)
1. **Apri il link** sul telefono, in 4G (non Wi-Fi): <https://marea.stanza-idee.workers.dev> . Se l'orchestratore ti ha mandato un link con `?t=...` usa quello.
2. **Aggiungi `?fps=1`** in fondo al link (`https://marea.stanza-idee.workers.dev/?fps=1`): in alto compare un contatore con fps, draw call e triangoli. Lascialo acceso mentre giochi.
3. **Guarda queste 5 cose**, in quest'ordine:
   - parte entro pochi secondi? (conta o registra a voce «ci ha messo ~N secondi»)
   - **cammina** col joystick a sinistra; il pollice basta? i tasti A/B si raggiungono?
   - **pizzica** per lo zoom: da vicino e da lontano il look regge? (colori, pixel, ombre)
   - **sali in barca** (vai sul molo, premi A) e naviga in mare aperto: la sensazione è giusta?
   - il contatore: gli **fps** stanno sopra 45? scendono mai sotto 30? (dì quando)
4. **Manda lo screenshot** dove qualcosa non ti convince o è bello: su iPhone tasto laterale + volume su, poi mandalo nella chat (o su WhatsApp a te stesso e da lì al Mac) **con una nota vocale** di 10-20 secondi: «qui l'acqua è troppo chiara», «questa lanterna mi piace». Con `?fps=1` acceso lo screenshot contiene anche i numeri.
5. **Non devi scrivere altro**: niente elenchi, niente diagnosi. Cosa vedi e cosa senti, a voce.

## Cosa fa l'orchestratore con le note vocali
1. Trascrive ogni nota e la abbina allo screenshot (stessa ora o stesso messaggio).
2. Divide ogni frase in una di tre buste: **difetto** (qualcosa non funziona: fps bassi, non parte, joystick scomodo), **gusto** (il look/il feeling non convince), **idea** (una cosa nuova).
3. **Difetto** → riprodotto con un test in `tests/e2e/` (se serve) e sistemato dal work package proprietario del file (`docs/CONTRACTS.md` §1). **Gusto** → diventa una **scelta A/B con screenshot** (mai una domanda aperta) nel prossimo contact sheet. **Idea** → riga in `docs/BACKLOG.md`, non si implementa senza che Jack la promuova.
4. Riporta a Jack in 3-5 righe cosa è cambiato e cosa aspetta da lui (di solito: «A o B?»), apre il contact sheet con `open`.
5. Annota tutto in `_MEMORIA.md` (dettaglio) e la sintesi in `_STATO.md` (Siamo arrivati a / Prossimo passo).

## Per gli agenti: comandi
```
npm test                                   # = node tests/run.mjs all
node tests/run.mjs static sim boot         # scelta di suite (default: static sim boot)
node tests/run.mjs look perf               # viste per il contact sheet + budget draw call/triangoli
node tests/run.mjs all --no-build          # usa apps/client/dist già costruito
node tests/run.mjs look --only zoom        # solo i test il cui nome contiene «zoom»
node tests/run.mjs boot --viewport desktop # viewport predefinito di ctx.open() (iphone | desktop)
node tests/run.mjs perf --timeout 120000   # timeout per suite (default: `export const timeout` della suite, poi 180 s)
node tests/run.mjs look --palette-warn     # il controllo palette diventa un avviso (solo mentre si tara la luce)
node tools/build.mjs                       # build + budget → tests/out/build.json
node tools/contact.mjs [prefisso]          # tests/out/contact.png (etichette = nome dello screenshot)
node tools/deploy.mjs --dry-run            # prova del deploy senza toccare niente (solo orchestratore il deploy vero)
```
Uscite in `tests/out/` (gitignored): `report.json` (durata per test e per suite), `build.json`, `look.json` (varianza e % palette per vista), `perf.json` (campioni al secondo), `shots/<suite>_*.png`, `contact.png`. Ogni suite cancella i propri `shots/<suite>_*` all'avvio, mai quelli delle altre.

### Suite
| Suite | Cosa controlla |
|---|---|
| `static` | `tools/check_static.mjs`: purezza di `sim` (no DOM/three/random/tempo/`console.log`, tsconfig senza lib DOM), import `.ts` espliciti, no enum/namespace, `three` solo in `apps/client`, JSON dei contenuti; avviso per file > 400 righe |
| `types` | `tsc --noEmit` per pacchetto |
| `sim` | `node --test packages/sim/test/` |
| `boot` | nessun `pageerror`, `__game.ready` entro 10 s, canvas non vuoto, avatar che cammina, barca, zoom, desktop |
| `look` | 6 viste fisse (telefono: spawn, zoom min, zoom max, barca in mare aperto, isola dall'alto; desktop: spawn): varianza > 50, nessun errore, ≥ 80 % di 2.000 pixel campionati entro distanza RGB 24 dalla palette (`tests/lib/palette.mjs`) |
| `perf` | 20 s di navigazione (frecce, barca, zoom), `perf()` ogni secondo: draw call ≤ 100, triangoli ≤ 150.000; fps e heap JS solo riportati (Chrome headless usa SwiftShader) |
| `wpN_*` | suite dei work package (`tests/e2e/wpN_*.mjs`), girano dopo `perf` in ordine alfabetico |
| `contact` | `tests/out/contact.png` con ffmpeg |
Il budget di build (TECH §5) compare come test `build › budget` alla prima suite e2e: se lo si sfora, le altre suite girano comunque ma il totale è rosso.

### API della ctx (stabile: si aggiunge, non si cambia)
`open(query, { viewport })` · `waitReady(page)` · `waitState(page, fn, ms)` · `getState(page)` · `getPerf(page)` · `screenStats(page)` · `shot(page, nome)` · `test(nome, fn)` · `warn(nome, msg)` · `noErrors(pagina, cosa)` · `log(...)` · `assert` · `B` (`tests/lib/browser.mjs`: `IPHONE`, `DESKTOP`, `samplePixels`) · `ROOT`, `OUT`, `base`, `browser`, `distDir` · **novità**: `opts` (flag della riga di comando), `viewport`/`viewportName`, `only`, `writeOut(nome, json)` → `tests/out/<nome>`, `startWrangler({ distDir?, port? })`.

`startWrangler` (anche direttamente da `tests/lib/wrangler.mjs`) avvia `wrangler dev --local` da `apps/server` su una porta libera, con gli asset di `distDir`, persistenza privata per processo, e aspetta `/api/ping`; ritorna `{ url, port, logs(), close() }`. Con `ctx.startWrangler` la chiusura è automatica a fine suite.
