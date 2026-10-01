# MAREA — come si lavora in gruppo

> Per il Claude (o Codex) di chiunque metta mano a MAREA. La persona davanti a te probabilmente non è un programmatore: fai tu i passi tecnici e spiegali in una riga; a lei chiedi solo il cosa (gusto, priorità), con scelte A/B e screenshot.

## In breve
**Issue** (il lavoro) → **ramo** → codice + test → **`/consegna`** (PR → controlli di GitHub → merge) → **deploy automatico** se la suite completa su `main` è verde. Nessuno deploya a mano, nessuno tocca Cloudflare.

## 1. Prima volta: preparare il computer (~10 minuti)
Serve: un account GitHub già invitato nel repo (l'invito arriva per email da `worldwidejack`: va accettato), Claude Code o Codex.
1. **Strumenti**: `git`, **Node 26** (`node --version` → `v26.x`), **GitHub CLI** `gh`, **Google Chrome** (lo usano i test).
   - Mac: `brew install git node gh` (se Node non è il 26: `brew install node@26`). Chrome dal sito.
   - Windows: `winget install Git.Git OpenJS.NodeJS GitHub.cli Google.Chrome`.
   - Linux: dal gestore pacchetti, Node 26 da nodesource o `nvm install 26`.
2. **Login GitHub**: `gh auth login` (GitHub.com → HTTPS → browser). Poi `gh auth setup-git`.
3. **Codice**: `gh repo clone worldwidejack/marea && cd marea && npm install`.
4. **Prova**: in due terminali `npm run dev:server` e `npm run dev`, poi apri l'indirizzo che stampa `npm run dev` (di solito http://localhost:5173). Nessuna chiave o segreto serve per giocare in locale: il server gira sul tuo computer con un database finto.
5. **Test veloci**: `node tests/run.mjs static types sim boot` → deve finire con `ALL GREEN`.

Se un passo fallisce, sistemalo tu (versione di Node, Chrome mancante) e annota la soluzione qui sotto in §8 nella tua prima PR, così il prossimo non ci inciampa.

## 2. Prendere un lavoro
- Bacheca: `gh issue list` (o https://github.com/worldwidejack/marea/issues).
- Scegli una issue libera e prendila: `gh issue edit <n> --add-assignee @me`. Se ha già un assegnatario, è sua: scegline un'altra o chiedi nella issue.
- Hai un'idea che non c'è? `gh issue create --title "…" --body "…"` e assegnatela. Se l'idea cambia il design (nuovo minigioco, nuove regole dell'economia), scrivila prima in `docs/BACKLOG.md` dentro la PR o nella issue e aspetta l'ok di Jack: il design (`docs/GDD.md`) lo decide lui.

## 3. Lavorare
```
git switch main && git pull
git switch -c <tuonome>/<cosa-fai>        # es. luca/boa-luminosa
```
- Leggi `CLAUDE.md` (regole), poi solo i documenti che servono al lavoro: `CONTRACTS.md` §1 ti dice dove sta il codice.
- **Piccolo**: una PR = una cosa. Più dura, più è facile pestarsi i piedi con gli altri.
- **Fai vedere**: per qualsiasi cosa visiva, screenshot (i test e2e li salvano in `tests/out/shots/`) e scelte A/B alla persona.
- **Test**: un comportamento nuovo → un test nuovo. Logica pura in `packages/sim/test/*.test.ts` (node:test), cose che si vedono o si cliccano in `tests/e2e/<nome>.mjs` (guarda come è fatto `tests/e2e/m1_scacchi.mjs`).
- **Numeri di gioco** solo nei JSON di `packages/content`; se li cambi, aggiorna la tabella del GDD e una riga in `ROADMAP.md` §Deviazioni.

## 4. Consegnare: `/consegna`
Il comando fa tutto: test veloci, commit, push del ramo, PR con descrizione, attesa dei controlli, merge, attesa del deploy, link. A mano sarebbe:
```
node tests/run.mjs static types sim boot
git add -A && git commit -m "…" && git push -u origin HEAD
gh pr create --fill
gh pr checks --watch
gh pr merge --squash --delete-branch
gh run watch $(gh run list --workflow deploy.yml --limit 1 --json databaseId -q '.[0].databaseId')
```
Controlli **rossi** → non si fa merge: leggi l'errore (`gh run view --log-failed`), sistema, ripusha.

## 5. Quando qualcuno ha cambiato `main` mentre lavoravi
```
git fetch origin && git rebase origin/main
```
Conflitti: tieni **entrambe** le modifiche quando possibile (sono lavori diversi), mai cancellare quella dell'altro per far prima. Poi test veloci di nuovo e `git push --force-with-lease`. Se il conflitto è su una scelta di gusto, chiedi alla persona (A/B).

## 6. Cosa succede dopo il merge
- GitHub fa girare **tutta** la suite (`npm test`, ~10-12 min). Verde → `tools/deploy.mjs` pubblica su https://marea.stanza-idee.workers.dev (migrazioni del database comprese). Rosso → online resta la versione di prima, e chi ha fatto l'ultimo merge sistema con una PR nuova.
- Se dopo un deploy il gioco online ha un problema: GitHub → Actions → **Torna indietro** → Run workflow. Riporta online la versione precedente in un minuto. Attenzione: non annulla le migrazioni del database.
- Due merge ravvicinati: i deploy vanno in coda, non si accavallano.
- GitHub disegna il gioco a 2-4 fps (contro ~60 di un Mac): se cade una suite e2e, il deploy la riprova una volta sola. Static, types, sim e budget non si riprovano. Un test e2e nuovo non deve aspettare tempi fissi brevi (`sleep(200)` sul Mac sono ~12 frame, su GitHub nemmeno uno): aspetta lo stato (`ctx.waitState`, `waitForFunction`).

## 7. Regole del gruppo
- **Mai push su `main`, mai `npm run deploy`, mai `wrangler` verso Cloudflare.** GitHub non lo impedisce (repo privato gratis), quindi è una regola d'onore: il gioco online è di tutti.
- `_STATO.md` e `_MEMORIA.md` sono il diario del Claude di Jack: non toccarli. Il tuo lavoro lo racconti nella PR.
- Migrazioni D1: numero successivo all'ultimo in `apps/server/migrations/` su `main` aggiornato. I controlli della PR bocciano due migrazioni con lo stesso numero.
- Minuti di GitHub Actions: il piano gratis ne dà 2.000 al mese. Una PR costa ~5 min di controlli, un deploy ~12. Non serve contarli, ma niente push di prova a raffica: prova in locale prima.
- Segreti (token, link personali con `?t=`): mai nel repo, mai nelle issue.

## 8. Problemi già risolti
*(Aggiungi qui una riga quando sistemi un intoppo di installazione o di test.)*
- I test e2e cercano Chrome installato; senza, provano la «headless shell» di Playwright in cache (solo Mac).
