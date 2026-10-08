# Per tutte le AI che lavorano su MAREA (Claude, Codex, qualsiasi altra)

**Prima di fare qualsiasi modifica al progetto, scarica l'ultima versione da GitHub:**

```
git switch main
git pull
```

Su MAREA lavorano più persone, ognuna con la sua AI, tutte in parallelo. Se parti da una versione vecchia rischi di rifare lavoro già fatto, di cancellare quello degli altri o di riempire la PR di conflitti.

- Fallo **all'inizio di ogni sessione** e **prima di ogni lavoro nuovo**: il ramo nuovo parte sempre da `main` appena aggiornato.
- Hai già un ramo con modifiche in corso? Aggiornalo con `git fetch origin && git rebase origin/main`.
- Nella cartella ci sono modifiche che non sono tue (un'altra sessione ci sta lavorando)? Non toccarle: lavora in una cartella a parte con `git worktree add -b <nome>/<cosa> ../marea-<cosa> origin/main`.
- Il resto delle regole sta in `CLAUDE.md` (per Codex è lo stesso file, `AGENTS.md`).
