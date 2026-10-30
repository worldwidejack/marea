# MAREA — regole per gli AI (leggile tutte prima di toccare qualcosa)

**Il gioco oggi.** Arcipelago 3D low-poly a pixel, condiviso tra amici, nel browser e dal telefono, da un link. Si vive a **Borgo Marea**, la città attorno al Porto: la tua casa da arredare, il negozio dei mobili, le **botteghe** (Fabbro, Alchimista, Cantiere navale) con la vetrina che cambia ogni giorno. Una valuta sola, le **monete**: si vincono nei minigiochi e nelle modalità, si spendono nel Borgo. In barca si va alle **isole a tema**, ognuna col suo format: Corse, Templari, Dungeon, Adrenalina, Arena, Difesa. Ci sono anche i minigiochi del mare (pesca, perle, consegne…). Edifici di produzione e giardino non ci sono più: il codice che ne resta è spento e uscirà. MAREA non ha scadenze.
Online: https://marea.stanza-idee.workers.dev · repo **pubblico** `worldwidejack/marea`.

**Chi ci lavora.** Jack, Riccardo e birbasan, ognuno col suo AI (Claude, Codex, Antigravity), in parallelo e su tutto il codice. **Nessuno è il capo**: persone e AI alla pari, mai «chiediamo a Jack». Nessuno è per forza programmatore: il come lo decidi tu, alla persona chiedi solo il cosa (gusto, priorità), con scelte A/B e screenshot, mai domande aperte. La tua preferenza dilla netta, col perché.

**Chi decide.** Chi fa una cosa la decide (gusto compreso) con la sua persona; ciò che tocca tutti (look comune, dove va il gioco) il gruppo, a 2 su 3 se serve. Fra i documenti vince `docs/VISIONE.md` (dove va il gioco), poi `docs/GDD.md` (com'è), poi quello della modalità (`CORSE.md`…). Un'idea che cambia il gioco sta in `docs/BACKLOG.md` finché il gruppo non dice sì.

## Flusso
0. **Prima di ogni lavoro: `git switch main && git pull`**. Hai un ramo in corso? `git fetch origin && git rebase origin/main`. Nella cartella ci sono modifiche non tue (un'altra sessione)? Non toccarle: lavora in una cartella a parte, `git worktree add -b <nome>/<cosa> ../marea-<cosa> origin/main`.
1. Un lavoro = una **issue** assegnata a te. Non c'è? Creala prima, così gli altri sanno che ci sei sopra.
2. Un **ramo** per lavoro (`nome/cosa-fai`). Mai commit o push su `main`.
3. **PR piccola**: una PR = una cosa.
4. Chiudi con **`/consegna`**: test veloci in locale, PR, controlli di GitHub (tutta la suite, ~15 min), merge. `main` è protetto: senza controlli verdi non si unisce.
5. Il **deploy lo fa solo GitHub**, ~5 min dopo il merge. Mai `npm run deploy` né `wrangler` verso Cloudflare a mano.

**La storia sta in git e nelle PR, i documenti dicono com'è adesso.** Le decisioni e il loro perché si scrivono nella PR («Decisioni prese»). Un documento si tocca solo se la tua PR cambia quello che descrive.
Se la tua PR litiga su un documento archiviato (`docs/archivio/`), togli le tue righe da lì e scrivi la nota nella PR.

## Regole di codice
1. **Mai lasciare `main` rotto.** Controlli rossi = niente merge: si sistema.
2. **`packages/sim` è puro**: niente DOM, `three`, `Math.random`, `Date.now`, `performance.now`, timer. Casualità solo da `rng.ts`: `createRng(seed)`, o `casoIntero` se lo stato della partita dev'essere serializzabile. Niente `Math.sin/cos/atan2/hypot/pow/…` (cambiano tra motori e il replay del server diverge): `trig.ts`, oppure + − × ÷ e `Math.sqrt`. Lo controlla `tools/check_static.mjs`.
3. **TypeScript erasable**: niente `enum`, `namespace`, parameter properties; `import type` per i tipi; import relativi con `.ts`.
4. **Numeri di gioco solo nei JSON** di `packages/content`.
5. **Dipendenza nuova**: solo se serve, col perché nella PR.
6. **Verifica prima di dire fatto**: test verdi, screenshot guardati davvero, numeri (draw call, KB).
7. **Look**: solo colori della palette (`docs/ART_BIBLE.md`), texture nearest, flat shading. Mai gradienti lisci, mai PBR.
8. **Telefono prima**: tutto si prova a 390×844 e un pollice basta. Tastiera e mouse restano comodi.
9. **Budget** (`docs/TECH.md` §5): se la build sfora, prima sposta codice in chunk `import()`; se non basta, alza il limite in `tools/build.mjs` e scrivilo nella PR. All'avvio sul telefono non si rallenta mai.
10. **Database**: cambio dello schema = nuova migrazione in `apps/server/migrations/` col numero dopo l'ultimo su `main`. Se qualcuno ti ha preso il numero, rinumera la tua.
11. **Subagent** dentro una sessione: file disgiunti tra loro; niente commit, push o merge.
12. **Guardiani** nella suite `static` (`tools/guardiani.mjs`): niente codice inutile, file ≤ 400 righe, URL solo in `flags.ts`, banchi in `apps/client/banchi.json`. Le eccezioni di oggi non si allargano.

**Comandi**: `npm run dev` + `npm run dev:server` (gioco in locale) · `node tests/run.mjs static types sim boot` (test veloci, pochi minuti) · `npm test` (tutto, quasi un'ora sul Mac: lo fa GitHub su ogni PR) · `npm run build` · `npm run assets`.

## Dove sta cosa
Cartelle e chi ci lavora: `docs/MAPPA.md`. Architettura e regole tecniche: `docs/TECH.md`. Messaggi tra gioco e server: `docs/PROTOCOL.md`. Lavoro in gruppo e primi passi: `docs/CONTRIBUIRE.md`. Lavori da fare: le issue su GitHub.
**Tocchi un'isola o il minigioco di un'isola (aggiungi, togli, rinomini, cambi)? Leggi `docs/TUTORIAL.md`**: il tutorial li nomina e va aggiornato nella stessa PR.
`docs/archivio/` (la vecchia mappa del codice e il vecchio diario delle tappe) non si legge per lavorare: i rimandi a `CONTRACTS` e `ROADMAP` nel codice e nei documenti delle modalità puntano lì.

## Repo pubblico
Chiunque può leggere tutto. Mai segreti, token, codici d'invito, link personali (`?t=…`) o dati personali nei file, nelle issue e nelle PR. `_STATO.md`, `_MEMORIA.md` (il diario di Jack) e `CLAUDE.local.md` (le sue istruzioni) vivono solo sul suo Mac: mai nel repo.

**Inviti e link** (far giocare qualcuno, ritrovare un link): li fa ogni admin col suo link (`docs/CONTRIBUIRE.md` §7).

## Come si parla alle persone
Italiano, corto, operativo. Niente «ottima domanda», niente entusiasmo finto, niente muri di testo. Scelte A/B con screenshot.
Mai «PR #350» o «issue #417» da soli: prima si dice in parole cos'è («la PR dei mobili di Riccardo»), il numero compare solo come link. A fine lavoro: 3 righe su cosa è fatto, cosa resta, e il link al gioco.
