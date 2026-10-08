# MAREA — regole per gli agenti (leggi prima di toccare qualsiasi cosa)

**Cos'è**: arcipelago 3D low-poly pixel-art condiviso tra un gruppo di amici. La tua isola produce anche quando non ci sei; minigiochi nelle zone comuni. Browser, da link, anche dal telefono. Prima serata tutti insieme: **27-30 dic 2026**.

**Chi ci lavora**: Jack (il progetto è suo, decide il gusto) e i suoi amici, **ognuno col proprio Claude/Codex, tutti in parallelo e su tutto il codice**. Nessuno di loro è per forza un programmatore: decidi tu il come, chiedi alla persona solo il cosa (gusto, priorità), con scelte A/B e screenshot, mai domande aperte.

**Dove sta cosa**: come si lavora in gruppo `docs/CONTRIBUIRE.md` · design `docs/GDD.md` (vince su tutto) · look `docs/ART_BIBLE.md` · architettura e regole di codice `docs/TECH.md` · messaggi `docs/PROTOCOL.md` · tappe e deviazioni `docs/ROADMAP.md` · interfacce tra pacchetti e mappa del codice `docs/CONTRACTS.md` · idee parcheggiate `docs/BACKLOG.md` · lavori da fare: **GitHub Issues** del repo.

**Online**: https://marea.stanza-idee.workers.dev · repo privato `worldwidejack/marea`.

**Comandi**: `npm run dev` (client, proxy verso `npm run dev:server`) · `npm run build` · `npm run check` · `node tests/run.mjs static types sim boot` (veloce) · `npm test` (tutto, ~10 min) · `npm run assets` · `/consegna` (chiude il lavoro e lo manda online).

## Flusso di lavoro (per tutti)
0. **Prima di qualsiasi modifica: `git switch main && git pull`** (all'inizio di ogni sessione e di ogni lavoro nuovo). Perché e casi particolari: `AI_LEGGI_PRIMA.md`.
1. Un lavoro = una **issue** assegnata a te. Non c'è? Creala prima di iniziare, così gli altri sanno che ci sei sopra.
2. Un **ramo** per lavoro (`nome/cosa-fai`), partendo da `main` aggiornato. **Mai commit o push diretti su `main`.**
3. Lavoro piccolo: una PR = una cosa. Meglio tre PR da un'ora che una da una settimana (meno conflitti con gli altri).
4. Chiudi con **`/consegna`**: test veloci → PR → controlli di GitHub → merge → deploy automatico.
5. **Il deploy lo fa solo GitHub** quando `main` passa la suite completa. Mai `npm run deploy` né `wrangler` verso Cloudflare a mano.

## Regole di codice
1. **Mai lasciare `main` rotto.** Se i controlli della tua PR sono rossi, non si fa merge: si sistema.
2. **`packages/sim` è puro**: niente DOM, `three`, `Math.random`, `Date.now`, `performance.now`, timer. Casualità solo da `createRng(seed)`. Lo controlla `tools/check_static.mjs`.
3. **TypeScript erasable**: niente `enum`, `namespace`, parameter properties; `import type` per i tipi; import relativi con `.ts`. Node 26 esegue i `.ts` senza build.
4. **Numeri di gioco solo in `packages/content`** (JSON). Cambiarli = aggiornare la tabella del GDD e una riga in `ROADMAP.md` §Deviazioni.
5. **Nessuna dipendenza nuova** senza riga in `ROADMAP.md` §Deviazioni.
6. **Verifica prima di dire fatto**: test verdi, screenshot in `tests/out/` guardati davvero, numeri (draw call, KB). Un tool che risponde ok non prova niente.
7. **Look**: solo colori della palette (`ART_BIBLE.md` §2), texture nearest, un atlas, flat shading, avatar a 6 teste stile PS1. Mai Roblox/Fall Guys, mai gradienti lisci, mai PBR.
8. **Telefono prima**: tutto si prova a 390×844; un pollice basta per giocare. Jack gioca da PC: tastiera e mouse devono restare comodi.
9. **Budget** (`TECH.md` §5) fa fallire la build: rispettalo, non alzarlo.
10. **Database**: una modifica allo schema = nuova migrazione in `apps/server/migrations/` col numero successivo all'ultimo su `main`. Se un altro ha preso il tuo numero prima di te, rinumera la tua.
11. **Subagent dentro una sessione**: file disgiunti tra loro (un agente per pacchetto, mappa in `CONTRACTS.md` §1). Gli agenti non fanno commit, push, merge.

## Come si parla alle persone
Italiano, corto, operativo. Niente «ottima domanda», niente entusiasmo finto, niente muri di testo. Scelte A/B con screenshot. A fine lavoro: 3 righe su cosa è fatto, cosa resta, e il link al gioco.

## Solo sul Mac di Jack (utente `giacomolevi`, cartella `~/Desktop/JACK/`)
Se non sei su quel Mac, salta questa sezione: i file qui citati non esistono da te.
- File da fargli vedere: aprili tu con `open "<percorso>"`.
- Fine sessione: `_STATO.md` («Siamo arrivati a / Prossimo passo», data) → `_MEMORIA.md` (dettaglio) → `python3 "$HOME/Desktop/JACK/0 JACKOS/_strumenti/tabellone.py"`. `_STATO.md` e `_MEMORIA.md` li scrive solo il Claude di Jack (sono il suo diario del progetto): gli amici raccontano il loro lavoro nella PR.
- Link personale con token in `~/.config/jackos/marea-jack-link.txt` (mai nel repo). Inviti: `node apps/server/scripts/invito_gruppo.mjs --usi N --remote` (usa il login Cloudflare del Mac).
- Push e PR con `gh` (loggato come `worldwidejack`, scope `workflow`): `git -c credential.helper= -c credential.helper='!gh auth git-credential' push`. Il vecchio `~/.config/jackos/gh-token` ha solo `repo`: GitHub gli rifiuta i file in `.github/workflows/`.
- Invitare un amico: `gh api -X PUT repos/worldwidejack/marea/collaborators/<username> -f permission=push`.
