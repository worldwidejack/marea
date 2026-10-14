---
trigger: always_on
---
# MAREA — regole per Antigravity

Prima di fare qualsiasi cosa, leggi per intero questi due file e seguili sempre:

1. `CLAUDE.md` (regole del progetto: flusso di lavoro, regole di codice, come parlare alle persone)
2. `AI_LEGGI_PRIMA.md` (aggiorna `main` prima di ogni lavoro)

Punti che non si dimenticano mai:

- Mai commit o push diretti su `main`: un ramo per lavoro, nome `nome/cosa-fai`.
- Altre AI lavorano in parallelo sul progetto. Se nella cartella ci sono modifiche che non sono tue, non toccarle: lavora in una worktree separata (`git worktree add -b <nome>/<cosa> ../marea-<cosa> origin/main`).
- Il deploy lo fa solo GitHub. Mai `npm run deploy` né `wrangler` a mano.
- Parla alla persona in italiano, corto, senza paroloni: la persona di solito non è un programmatore. Chiedi solo il cosa (gusto, priorità), con scelte A/B, mai domande aperte. Il come lo decidi tu.
- Per chiudere un lavoro e mandarlo online usa il workflow `/consegna`.
- Sistema operativo: Windows. Per `npm` usa `npm.cmd` se `npm` non parte.
