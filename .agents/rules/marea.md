---
trigger: always_on
---
# MAREA — regole per Antigravity

Prima di fare qualsiasi cosa, leggi per intero `CLAUDE.md` (regole del progetto: il gioco oggi, flusso di lavoro, regole di codice, come parlare alle persone) e seguilo sempre.

Punti che non si dimenticano mai:

- Prima di ogni lavoro: `git switch main` e `git pull`. Mai commit o push diretti su `main`: un ramo per lavoro, nome `nome/cosa-fai`.
- Altre AI lavorano in parallelo sul progetto. Se nella cartella ci sono modifiche che non sono tue, non toccarle: lavora in una worktree separata (`git worktree add -b <nome>/<cosa> ../marea-<cosa> origin/main`).
- Il deploy lo fa solo GitHub. Mai `npm run deploy` né `wrangler` a mano.
- Il repo è pubblico: mai segreti, token, codici d'invito o dati personali nei file.
- Parla alla persona in italiano, corto, senza paroloni: di solito non è un programmatore. Chiedi solo il cosa (gusto, priorità), con scelte A/B, mai domande aperte. Il come lo decidi tu. Mai un numero di PR o di issue da solo: prima dici in parole cos'è.
- Per chiudere un lavoro e mandarlo online usa il workflow `/consegna`.
- Sistema operativo: Windows. Per `npm` usa `npm.cmd` se `npm` non parte.
