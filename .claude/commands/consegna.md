---
description: Chiude il lavoro su MAREA e lo manda online (test, PR, controlli, merge, deploy)
---
Consegna il lavoro corrente seguendo `docs/CONTRIBUIRE.md` §4. Fai tutto tu, parla alla persona solo per esiti e scelte.

1. **Ramo**: se sei su `main`, crea un ramo `<nome>/<cosa>` dal lavoro in corso (nome = utente `gh api user -q .login`). Mai commit su `main`.
2. **Aggiornato**: `git fetch origin && git rebase origin/main` (conflitti: §5 della guida). Se litighi su un documento archiviato (`docs/archivio/`), togli le tue righe da lì e scrivi la nota nella PR.
3. **Test veloci**: `node tests/run.mjs static types sim boot` (pochi minuti). Rossi → sistema prima di andare avanti. Se il lavoro è visivo, guarda gli screenshot in `tests/out/shots/`.
4. **Commit e push**: messaggio in italiano che dice cosa cambia nel gioco; `git push -u origin HEAD` (`--force-with-lease` se hai fatto rebase).
5. **PR**: `gh pr create` col template (`.github/pull_request_template.md`) compilato: cosa cambia per chi gioca, **decisioni prese** (le scelte e il loro perché: il diario del progetto è questo), come l'hai verificato. `Closes #<n>` se c'è una issue (in inglese: «Chiude» GitHub non lo capisce e la issue resta aperta). Se la PR esiste già, aggiorna quella.
6. **Controlli**: `gh pr checks --watch`. Gira tutta la suite, test veloci + gioco vero in 6 gruppi (~15 min; una PR di soli `.md` o `docs/` ~2 min). Rossi → `gh run view --log-failed`, sistema, ripusha, riattendi. Una suite caduta e poi passata alla riprova lascia un avviso: è un test instabile, segnalalo nella PR.
7. **Merge**: `gh pr merge --squash --delete-branch`, poi `git switch main && git pull`. `main` è protetto: senza il controllo «esito» verde GitHub non unisce.
8. **Deploy**: parte da solo dopo il merge e dura ~5 min (test veloci + pubblicazione; una PR di soli `.md` o `docs/` non lo fa partire). Controllane l'esito con `gh run list --workflow deploy.yml --limit 3`. Verde → `https://marea.stanza-idee.workers.dev/version.json` ha il build nuovo. Rosso → online resta la versione di prima: leggi l'errore (`gh run view <id> --log-failed`) e apri subito una PR di correzione.
9. **Chiudi** con 3 righe alla persona: cosa è unito e quando sarà online, link alla PR, link al gioco.

$ARGUMENTS
