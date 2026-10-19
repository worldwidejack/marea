# MAREA — test e collaudo

## Per Jack: il collaudo dal telefono (5 minuti)
1. **Apri il tuo link** sul telefono, in 4G (non Wi-Fi): <https://marea.stanza-idee.workers.dev>.
2. **Aggiungi `?fps=1`** in fondo al link: in alto compare un contatore con fps, draw call e triangoli. Lascialo acceso mentre giochi.
3. **Guarda queste 5 cose**, in quest'ordine:
   - parte entro pochi secondi? («ci ha messo ~N secondi»)
   - **cammina** col joystick: il pollice basta? A e B si raggiungono?
   - **pizzica** per lo zoom: da vicino e da lontano il look regge? (colori, pixel, ombre)
   - **sali in barca** e naviga in mare aperto: la sensazione è giusta?
   - il contatore: gli **fps** stanno sopra 45? Scendono mai sotto 30? (dì quando)
4. **Manda lo screenshot** dove qualcosa non ti convince o è bello, **con una nota vocale** di 10-20 secondi: «qui l'acqua è troppo chiara», «questa lanterna mi piace». Con `?fps=1` acceso lo screenshot contiene anche i numeri.
5. **Non devi scrivere altro**: cosa vedi e cosa senti, a voce.

Il suo Claude divide ogni frase in tre buste: **difetto** (si riproduce con un test in `tests/e2e/` e si sistema), **gusto** (diventa una scelta A/B con screenshot, mai una domanda aperta), **idea** (una riga in `docs/BACKLOG.md`, non si fa senza l'ok di Jack).

## Per gli AI: comandi
```
node tests/run.mjs static types sim boot   # i test veloci, quelli dei controlli della PR (pochi minuti)
npm test                                   # = node tests/run.mjs all: tutto, quasi un'ora sul Mac (di solito lo fa GitHub dopo il merge)
node tests/run.mjs m3_pesca m3_porto       # una o più suite e2e per nome (tests/e2e/<nome>.mjs)
node tests/run.mjs all --no-build          # usa apps/client/dist già costruito
node tests/run.mjs look --only zoom        # solo i test il cui nome contiene «zoom»
node tests/run.mjs boot --viewport desktop # viewport predefinito di ctx.open() (iphone | desktop)
node tests/run.mjs perf --timeout 120000   # timeout per suite (default: `export const timeout` della suite, poi 180 s)
node tests/run.mjs look --palette-warn     # il controllo della palette diventa un avviso (solo mentre si tara la luce)
node tools/build.mjs                       # build + budget → tests/out/build.json
node tools/contact.mjs [prefisso]          # tests/out/contact.png (etichette = nome dello screenshot)
node tools/deploy.mjs --dry-run            # prova del deploy senza toccare niente (il deploy vero lo fa solo GitHub)
```
Senza suite, `node tests/run.mjs` fa `static sim boot`. Uscite in `tests/out/` (fuori da git): `report.json` (durata per test e per suite), `build.json`, `look.json`, `perf.json`, `shots/<suite>_*.png`, `contact.png`. Ogni suite cancella i propri `shots/<suite>_*` all'avvio, mai quelli delle altre.

### Suite
| Suite | Cosa controlla |
|---|---|
| `static` | `tools/check_static.mjs`: purezza di `sim` (niente DOM, three, casualità, tempo, `console.log`, funzioni trascendenti), import `.ts` espliciti, niente enum e namespace, `three` solo nel client, JSON dei contenuti; avviso per file oltre 400 righe |
| `types` | `tsc --noEmit` per pacchetto |
| `sim` | `node --test packages/sim/test/` |
| `boot` | nessun `pageerror`, `__game.ready` (obiettivo 8 s), canvas non vuoto, avatar che cammina, barca, zoom, desktop |
| `look` | viste fisse (telefono e desktop): varianza, nessun errore, pixel dentro la palette (`tests/lib/palette.mjs`) |
| `perf` | 20 s di navigazione: draw call ≤ 100, triangoli ≤ 200.000; fps e memoria solo riportati (Chrome headless usa SwiftShader) |
| `m1_*` … `m4_*`, `wpN_*` | le suite e2e, una per cosa (`tests/e2e/`); in `all` girano dopo `perf`, in ordine alfabetico |
| `contact` | `tests/out/contact.png` con ffmpeg |

Il budget della build (`docs/TECH.md` §5) compare come test `build › budget` alla prima suite e2e: se lo si sfora, le altre suite girano comunque ma il totale è rosso.
Un test e2e aspetta lo stato del gioco (`ctx.waitState`, `waitForFunction`), mai tempi fissi brevi: GitHub disegna il gioco a 2-4 fps.

### API della ctx (stabile: si aggiunge, non si cambia)
`open(query, { viewport })` · `waitReady(page)` · `waitState(page, fn, ms)` · `getState(page)` · `getPerf(page)` · `screenStats(page)` · `shot(page, nome)` · `test(nome, fn)` · `warn(nome, msg)` · `noErrors(pagina, cosa)` · `log(...)` · `assert` · `B` (`tests/lib/browser.mjs`: `IPHONE`, `DESKTOP`, `samplePixels`) · `ROOT`, `OUT`, `base`, `browser`, `distDir` · `opts` (flag della riga di comando), `viewport`/`viewportName`, `only`, `writeOut(nome, json)` → `tests/out/<nome>`, `startWrangler({ distDir?, port? })`.

`startWrangler` (anche direttamente da `tests/lib/wrangler.mjs`) avvia `wrangler dev --local` da `apps/server` su una porta libera, con gli asset di `distDir`, persistenza privata per processo, e aspetta `/api/ping`; ritorna `{ url, port, logs(), close() }`. Con `ctx.startWrangler` la chiusura è automatica a fine suite.
