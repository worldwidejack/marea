# MAREA — regole per gli agenti (leggi prima di toccare qualsiasi cosa)

**Cos'è**: arcipelago 3D low-poly pixel-art condiviso tra gli amici di Jack. La tua isola produce anche quando non ci sei; minigiochi nelle zone comuni con scommesse di risorse. Browser, da link, anche dal telefono. Prima serata con gli amici: **27-30 dic 2026**.

**Dove sta cosa**: design `docs/GDD.md` (vince su tutto) · look `docs/ART_BIBLE.md` · architettura e regole di codice `docs/TECH.md` · messaggi `docs/PROTOCOL.md` · tappe e deviazioni `docs/ROADMAP.md` · contratti tra pacchetti e **proprietà dei file** `docs/CONTRACTS.md` · idee parcheggiate `docs/BACKLOG.md` · stato per il tabellone `_STATO.md` · storia `_MEMORIA.md`.

**Online**: https://marea.stanza-idee.workers.dev · repo privato `worldwidejack/marea` · sorgente `~/Desktop/JACK/_GITHUB/marea/`.

**Comandi**: `npm run dev` (client, proxy verso `npm run dev:server`) · `npm run build` · `npm run check` · `npm test` · `node tests/run.mjs boot` · `npm run assets` · `npm run deploy` (solo l'orchestratore).

## Regole
1. **Ogni sessione finisce deployata e con `_STATO.md` aggiornato.** Mai lasciare `main` rotto: il tempo di Jack arriva a raffiche e un progetto rotto non si riapre.
2. **Tocca solo i file che possiedi** (`CONTRACTS.md` §1). Serve altro → `tests/out/richieste/<wp>.md` e un adattatore nei tuoi file.
3. **`packages/sim` è puro**: niente DOM, `three`, `Math.random`, `Date.now`, `performance.now`, timer. Casualità solo da `createRng(seed)`. Lo controlla `tools/check_static.mjs`.
4. **TypeScript erasable**: niente `enum`, `namespace`, parameter properties; `import type` per i tipi; import relativi con `.ts`. Node 26 esegue i `.ts` senza build.
5. **Numeri di gioco solo in `packages/content`** (JSON). Cambiarli = aggiornare la tabella del GDD e una riga in `ROADMAP.md` §Deviazioni.
6. **Nessuna dipendenza nuova** senza riga in `ROADMAP.md` §Deviazioni.
7. **Verifica prima di dire fatto**: `npm test` verde, screenshot in `tests/out/`, numeri (draw call, KB, fps). Un tool che risponde ok non prova niente.
8. **Look**: solo colori della palette (`ART_BIBLE.md` §2), texture nearest, un atlas, flat shading, avatar a 6 teste stile PS1. Mai Roblox/Fall Guys, mai gradienti lisci, mai PBR.
9. **Telefono prima**: tutto si prova a 390×844; un pollice basta per giocare.
10. **Budget** (`TECH.md` §5) fa fallire la build: rispettalo, non alzarlo.

## Come si parla a Jack
Italiano, corto, operativo. Decidi tu il come, chiedi a lui solo il cosa (gusto, priorità). **Scelte A/B con screenshot, mai domande aperte.** File da fargli vedere: aprili tu con `open "<percorso>"`. Niente «ottima domanda», niente entusiasmo finto, niente muri di testo.

## Fine sessione (orchestratore)
`npm test` → `npm run deploy` → contact sheet a Jack → `_STATO.md` («Siamo arrivati a / Prossimo passo», data) → `_MEMORIA.md` (dettaglio) → `python3 "$HOME/Desktop/JACK/0 JACKOS/_strumenti/tabellone.py"` → commit e push.
