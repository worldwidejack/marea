# MAREA — come si lavora in gruppo

> Per l'AI (Claude, Codex, Antigravity…) di chiunque metta mano a MAREA. La persona davanti a te probabilmente non è un programmatore: fai tu i passi tecnici e spiegali in una riga; a lei chiedi solo il cosa (gusto, priorità), con scelte A/B e screenshot. Le regole stanno in `CLAUDE.md`: qui ci sono i passi pratici.

## In breve
**Issue** (il lavoro) → **ramo** → codice + test → **`/consegna`** (PR → controlli di GitHub → merge) → **deploy automatico** pochi minuti dopo il merge. Nessuno deploya a mano, nessuno tocca Cloudflare.

## 1. Prima volta: preparare il computer (~10 minuti)
Serve un account GitHub invitato nel repo (l'invito arriva per email da `worldwidejack` e va accettato: senza, puoi leggere il codice ma non mandare PR) e **Claude Code** (incluso in Claude Pro), Codex o Antigravity.
> **Claude Code, non la chat di claude.ai.** La chat del sito non può usare il terminale del computer. Claude Code si installa senza permessi da amministratore:
> - Windows (PowerShell): `irm https://claude.ai/install.ps1 | iex`
> - Mac/Linux: `curl -fsSL https://claude.ai/install.sh | bash`
>
> Poi si apre un terminale in una cartella vuota e si scrive `claude`. Chi non può installare niente (PC della scuola) usa **claude.ai/code** nel browser: lì non si vede il gioco in locale.
1. **Strumenti**: `git`, **Node 26** (`node --version` → `v26.x`), **GitHub CLI** `gh`, **Google Chrome** (lo usano i test).
   - Mac: `brew install git node gh` (se Node non è il 26: `brew install node@26`). Chrome dal sito.
   - Windows: `winget install Git.Git OpenJS.NodeJS GitHub.cli Google.Chrome`.
   - Linux: dal gestore pacchetti, Node 26 da nodesource o `nvm install 26`.
2. **Login GitHub**: `gh auth login` (GitHub.com → HTTPS → browser). Poi `gh auth setup-git`.
3. **Codice**: `gh repo clone worldwidejack/marea && cd marea && npm install`.
4. **Prova**: in due terminali `npm run dev:server` e `npm run dev`, poi apri l'indirizzo che stampa `npm run dev` (di solito http://localhost:5173). Per giocare in locale non serve nessuna chiave: il server gira sul tuo computer con un database finto.
5. **Test veloci**: `node tests/run.mjs static types sim boot` → deve finire con `ALL GREEN`.

Se un passo fallisce, sistemalo tu (versione di Node, Chrome mancante) e aggiungi la soluzione in §8 nella tua prima PR, così il prossimo non ci inciampa.

## 2. Prendere un lavoro
- Bacheca: `gh issue list` (o https://github.com/worldwidejack/marea/issues).
- Scegli una issue libera e prendila: `gh issue edit <n> --add-assignee @me`. Se ha già un assegnatario è sua: scegline un'altra o chiedi nella issue.
- Hai un'idea che non c'è? `gh issue create --title "…" --body "…"` e assegnatela. Se l'idea cambia il gioco (un minigioco nuovo, regole nuove dell'economia), scrivila prima in `docs/BACKLOG.md` o nella issue e aspetta l'ok di Jack: dove va il gioco lo decide lui (`docs/VISIONE.md`).

## 3. Lavorare
```
git switch main && git pull
git switch -c <tuonome>/<cosa-fai>        # es. luca/boa-luminosa
```
- Leggi `CLAUDE.md`, poi `docs/MAPPA.md` per sapere dove sta il codice, poi solo i documenti che servono al lavoro.
- **Piccolo**: una PR = una cosa. Più dura, più è facile pestarsi i piedi con gli altri.
- **Fai vedere**: per qualsiasi cosa visiva, screenshot (i test e2e li salvano in `tests/out/shots/`) e scelte A/B alla persona, prima della PR.
- **Test**: un comportamento nuovo → un test nuovo. Logica pura in `packages/sim/test/*.test.ts` (node:test), cose che si vedono o si cliccano in `tests/e2e/<nome>.mjs` (guarda come è fatto `tests/e2e/m1_scacchi.mjs`).
- **Numeri di gioco** solo nei JSON di `packages/content`. Se li cambi, il perché va nella PR.
- **Documenti**: si toccano solo se la tua PR cambia quello che descrivono (il GDD se cambia com'è il gioco, il documento della modalità se cambia la modalità). Il diario del lavoro non va nei documenti: va nella PR, alla voce «Decisioni prese».

## 4. Consegnare: `/consegna`
Il comando fa tutto: test veloci, commit, push del ramo, PR con descrizione, attesa dei controlli (tutta la suite, ~15 min), merge. A mano sarebbe:
```
node tests/run.mjs static types sim boot
git add -A && git commit -m "…" && git push -u origin HEAD
gh pr create --fill
gh pr checks --watch
gh pr merge --squash --delete-branch
```
Controlli **rossi** → non si fa merge: leggi l'errore (`gh run view --log-failed`), sistema, ripusha.
Il deploy parte da solo dopo il merge e dura **~5 minuti**. Controllane l'esito con `gh run list --workflow deploy.yml --limit 3`.

## 5. Quando qualcuno ha cambiato `main` mentre lavoravi
```
git fetch origin && git rebase origin/main
```
Conflitti: tieni **entrambe** le modifiche quando possibile (sono lavori diversi), mai cancellare quella dell'altro per far prima. Poi test veloci di nuovo e `git push --force-with-lease`. Se il conflitto è su una scelta di gusto, chiedi alla persona (A/B).
Se la tua PR litiga su un documento archiviato (`docs/archivio/`), togli le tue righe da lì e scrivi la nota nella PR.

## 6. Cosa succede dopo il merge
- **Prima del merge**, sulla PR, GitHub fa girare **tutta** la suite: test veloci + gioco vero in 6 gruppi paralleli (`tests/shard.mjs`, ~15 min). `main` è protetto: si unisce solo col controllo «esito» verde.
- **Dopo il merge** il deploy rifà i test veloci (due PR verdi unite di seguito non si sono mai provate insieme) e `tools/deploy.mjs` pubblica su https://marea.stanza-idee.workers.dev (migrazioni del database comprese), in ~5 min. Rosso → online resta la versione di prima, e chi ha fatto l'ultimo merge sistema con una PR nuova.
- Se dopo un deploy il gioco online ha un problema: GitHub → Actions → **Torna indietro** → Run workflow. Riporta online la versione precedente in un minuto. Attenzione: non annulla le migrazioni del database.
- Una PR che tocca solo file `.md` o `docs/` non rifà test e deploy (il gioco non cambia).
- Due merge ravvicinati: i deploy vanno in coda, non si accavallano.
- GitHub disegna il gioco a 2-4 fps (contro ~60 di un Mac): se cade una suite e2e, i controlli la riprovano una volta sola e lasciano un avviso (test instabile da sistemare). Static, types, sim e budget non si riprovano. Un test e2e nuovo non deve aspettare tempi fissi brevi (`sleep(200)` sul Mac sono ~12 frame, su GitHub nemmeno uno): aspetta lo stato (`ctx.waitState`, `waitForFunction`).

## 7. Regole del gruppo
- **Mai push su `main`, mai `npm run deploy`, mai `wrangler` verso Cloudflare.** Il gioco online è di tutti.
- **Il repo è pubblico**: chiunque legge codice, issue e PR. Segreti, token, link personali con `?t=`, codici d'invito e dati personali: mai nel repo, mai nelle issue, mai nelle PR.
- `_STATO.md` e `_MEMORIA.md` sono il diario personale di Jack: stanno solo sul suo Mac, fuori dal repo. Il tuo lavoro lo racconti nella PR.
- Migrazioni D1: numero successivo all'ultimo in `apps/server/migrations/` su `main` aggiornato. I controlli della PR bocciano due migrazioni con lo stesso numero.
- Niente push di prova a raffica: prova in locale prima. Ogni push su una PR rifà tutta la suite (~15 min di GitHub).

## 8. Problemi già risolti
*(Aggiungi qui una riga quando sistemi un intoppo di installazione o di test.)*
- «Permission denied» o «403» al push: invito non accettato, oppure manca `gh auth login` / `gh auth setup-git`.
- I test e2e cercano Chrome installato; senza, provano la «headless shell» di Playwright in cache (solo Mac).
- Windows, PowerShell rifiuta `npm` («esecuzione di script disabilitata»): usa `npm.cmd` (`npm.cmd run dev`), senza cambiare le impostazioni di sicurezza.
- `npm run dev:server` si ferma con «assets.directory … apps/client/dist does not exist»: lancia una volta `npm run build` (crea la cartella; resta solo sul tuo computer).
- Windows: i test e2e che avviano `wrangler dev` (`m1_*`, `m2_server`, `m2_dungeon`, `wp4_net`) non partono («spawnSync npx ENOENT») e a fine suite non spengono il server: li fa girare GitHub nella suite completa dopo il merge (per provarli prima serve un Mac o Linux). Quelli veloci (`static types sim boot`) vanno.
- Windows: `npm.cmd run assets` trova da solo Blender in `Program Files\Blender Foundation\Blender <versione>\blender.exe` (`winget install BlenderFoundation.Blender`); in un altro posto, imposta la variabile `BLENDER` col percorso del `blender.exe`. Rigenerare un modello già esistente non cambia i `.glb`, ma cambia la data in `manifest*.json`: ripristinali con `git checkout --` se non li stai consegnando. Senza `ffmpeg` i fogli riassuntivi (`contact.png`, `rpg_contact.png`) non si fanno e compaiono avvisi «non riuscito»: le anteprime dei singoli modelli in `assets/export/preview/` ci sono comunque.
