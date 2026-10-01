---
description: Chiude il lavoro su MAREA e lo manda online (test, PR, controlli, merge, deploy)
---
Consegna il lavoro corrente seguendo `docs/CONTRIBUIRE.md` §4. Fai tutto tu, parla alla persona solo per esiti e scelte.

1. **Ramo**: se sei su `main`, crea un ramo `<nome>/<cosa>` dal lavoro in corso (nome = utente `gh api user -q .login`). Mai commit su `main`.
2. **Aggiornato**: `git fetch origin && git rebase origin/main` (conflitti: §5 della guida).
3. **Test veloci**: `node tests/run.mjs static types sim boot`. Rossi → sistema prima di andare avanti. Se il lavoro è visivo, guarda gli screenshot in `tests/out/shots/`.
4. **Commit e push**: messaggio in italiano che dice cosa cambia nel gioco; `git push -u origin HEAD` (`--force-with-lease` se hai fatto rebase).
5. **PR**: `gh pr create` col template (`.github/pull_request_template.md`) compilato; `Chiude #<n>` se c'è una issue. Se esiste già, aggiorna quella.
6. **Controlli**: `gh pr checks --watch`. Rossi → `gh run view --log-failed`, sistema, ripusha, riattendi.
7. **Merge**: `gh pr merge --squash --delete-branch`, poi `git switch main && git pull`.
8. **Deploy**: segui il workflow `deploy.yml` appena partito (`gh run watch`). Verde → verifica `https://marea.stanza-idee.workers.dev/version.json`. Rosso → la versione online non è cambiata: leggi l'errore e apri subito una PR di correzione.
9. **Chiudi** con 3 righe alla persona: cosa è online, link alla PR, link al gioco.

$ARGUMENTS
