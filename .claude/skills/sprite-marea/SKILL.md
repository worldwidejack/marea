---
name: sprite-marea
description: Come si fanno gli sprite dei personaggi di MAREA nel look 3 votato dal gruppo (personaggio 2.5D in pixel art in un mondo 3D, 16 direzioni = 9 viste disegnate + 7 specchiate, 4 disegni per mossa, 36 per mossa). Riga di stile in testa al prompt, modello approvato e sagoma grigia allegati, una vista per foglio su fondo magenta, Codex o ChatGPT; gli script in tools/sprite (prompt, genera, pixel, foglio, in_fenaki) e il controllo con Fenaki; prima di entrare nel gioco li guarda chi li fa (e il gruppo, se vuole). Da caricare prima di generare, preparare, controllare o mettere nel gioco un personaggio a sprite, un abitante, una mossa nuova.
---

# Gli sprite dei personaggi di MAREA (look 3)

Il gruppo ha votato il **look 3**: il mondo è in 3D e il motore lo fa sembrare disegnato; i personaggi sono **sprite 2.5D in pixel art**. Questa ricetta è quella che nella prova dei look (`assets/concept/personaggio/`) ha dato 108 disegni buoni al primo colpo. Seguila com'è: uno sprite fatto a occhio si vede subito accanto agli altri, e stona.

## Il look 3 in numeri
- **16 direzioni**: 9 viste disegnate, da davanti a dietro passando da destra (S, SSE, SE, ESE, E, ENE, NE, NNE, N), e le 7 del lato sinistro sono lo **specchio** (le fa il gioco: non si disegnano). La vista la sceglie il gioco dall'angolo fra dove guarda il personaggio e la camera, a scatti di 22,5°.
- **4 disegni per mossa e per vista** → **36 disegni per mossa** (9 × 4). La camminata fa anche da posa ferma (il disegno 2, gambe unite).
- **Pixel art vera**: pixel grossi e netti, niente sfumature né anti-aliasing, contorno scuro di 1 pixel, una tavolozza piccola comune a tutte le viste del personaggio. Il protagonista è alto **48 px** in piedi; testa grande (circa il 45 % dell'altezza coi capelli), corpo corto.
- **Riferimenti approvati** (il protagonista F3), da guardare prima di cominciare e da allegare: `assets/concept/personaggio/` → `F3_design.jpg` (il disegno), `F3_5_viste.jpg` (il modello in 5 viste), `F3_vista_<S|SE|E|NE|N>.jpg`, `F3_foglio_pixel_<SE|E|NE>.jpg` (fogli a pixel approvati: lo stile da copiare per un personaggio nuovo), `F3_sprite_pixel.jpg` (tutti i 108 sprite, la misura di cosa vuol dire «fatto bene»).
- Fino all'Art Bible sul look 3, per i personaggi a sprite vale questa skill dove `docs/ART_BIBLE.md` §5 dice altro (6 teste, modello 3D, Mixamo).

## La regola
**Prima di metterli nel gioco, guardali.** Il gusto lo decide la persona con cui lavori, guardando immagini (il foglio, il video), mai a parole; se vuole un parere, il foglio va nel gruppo. Si va per gradini: il modello in 5 viste, poi il giro 1 (tre viste), poi il resto. Niente produzione in serie prima che il primo pezzo le piaccia. Nessuno deve approvare: il gruppo è alla pari (Jack, 29/10: «non sono e non voglio essere io il capo»). (Sul Mac di Jack le domande di gusto vanno nella Lanterna.)

## Cosa serve
- **Codex** (`codex login` con l'account ChatGPT) per disegnare in automatico con `genera.py`, oppure **ChatGPT** a mano (`prompt.py --stampa`).
- **Fenaki**, il banco d'animazione di Jack: repo privato `worldwidejack/fenaki` (Riccardo e birbasan ci sono dentro, in scrittura), installato seguendo il suo `CLAUDE.md`. Se `claude mcp list` non mostra `fenaki`, installalo prima di cominciare.
- **Python**: quello del venv di Fenaki (`<fenaki>/.venv/bin/python`, su Windows `<fenaki>\.venv\Scripts\python.exe`), che ha già Pillow, numpy e OpenCV. Negli esempi qui sotto `PY` = quel python.

## La cartella del personaggio
`assets/concept/sprite/<id>/`, con dentro `scheda.json`: l'esempio vero è `assets/concept/sprite/protagonista/scheda.json`. La scheda dice chi è (`descrizione` in inglese, **identica in ogni prompt**: capelli, testa, pelle, vestiti coi colori), `pronome` (he / she / it), `modello` (il disegno approvato), `viste` (le 5 viste del modello), `stile` (per un personaggio nuovo: i fogli a pixel di F3, uno per vista del giro 1), `alto` (px in piedi), `testa` (% coi capelli), `mosse` (una frase in inglese per riga del foglio: «WALK CYCLE, 4 frames: …»), `extra` (colori piccoli che devono restare, come il verde della pozione). Nel repo vanno scheda, prompt, tavolozza e i JPG; i PNG (fogli, sprite) restano sul computer (`.gitignore`). La mappa degli script è in `tools/sprite/README.md`.

## Il giro
**0. Un personaggio nuovo comincia da un disegno solo**, scelto dalla persona fra 3 varianti (A/B/C) generate col modello di F3 accanto, così sta nello stesso mondo. Poi scrivi la scheda.

**1. Il modello in 5 viste** (davanti, 3/4 davanti, profilo, 3/4 dietro, dietro), il foglio da cui nascono tutte le viste:
```
PY tools/sprite/viste.py guida <cartella> --testa 45 --largo 0.82     # la sagoma grigia: misura la testa sul disegno
PY tools/sprite/prompt.py <cartella> --modello                         # 2 tentativi, a e b
PY tools/sprite/genera.py <cartella>                                   # → modello/modello_a.png, modello_b.png
PY tools/sprite/viste.py taglia <cartella> <cartella>/modello/modello_b.png
```
Guarda tu `modello/_FOGLIO_5_viste.jpg` (stessa altezza, piedi sulla stessa riga, testa alla stessa taglia, vestiti uguali da ogni lato), tieni il tentativo migliore, poi fallo approvare. `taglia` scrive le viste in `modello/vista_*.jpg` e le mette nella scheda.

**2. Giro 1: tre viste (SE, E, NE)**, ognuna dalla sua vista del modello:
```
PY tools/sprite/prompt.py <cartella>               # lavori.txt: un foglio per vista, 4 colonne × una riga per mossa
PY tools/sprite/genera.py <cartella>               # Codex, 4 alla volta: ~1-4 minuti a foglio
PY tools/sprite/pixel.py <cartella>                # → sprite/: taglio per sagome, 48 px, tavolozza comune, contorno
PY tools/sprite/foglio.py <cartella> --apri        # → _FOGLIO_sprite.jpg
PY tools/sprite/in_fenaki.py <cartella>            # → controllo/: le mosse e il giro delle viste in Fenaki
```
Controlla (sotto), poi **ok della persona sul giro 1 prima di andare avanti**: è il gradino che decide lo stile.

**3. Giro 2: le altre sei viste** (S, SSE, ESE, ENE, NNE, N), ognuna fra due viste del modello e col foglio a pixel della vista vicina del giro 1 allegato come stile, «dello stesso artista»:
```
PY tools/sprite/prompt.py <cartella> --giro 2
PY tools/sprite/genera.py <cartella>
PY tools/sprite/pixel.py <cartella>  &&  PY tools/sprite/foglio.py <cartella> --apri  &&  PY tools/sprite/in_fenaki.py <cartella>
```
**4. Una mossa nuova**: una riga nuova in `mosse` della scheda, poi `prompt.py --mosse <nuova>` (la camminata entra da sola nella prima riga: fa da metro per altezza e piedi) e di nuovo giro 1 e giro 2. Al massimo 3 mosse per foglio. I fogli già approvati non si rifanno: `pixel.py` tiene la tavolozza in `sprite/tavolozza.json` e, se due fogli danno lo stesso sprite, tiene quello del foglio più vecchio.

**Con ChatGPT a mano**: `prompt.py <cartella> --stampa <nome>` dice quali immagini allegare e in che ordine, il prompt da incollare e dove salvare il PNG (`fogli/<nome>.png`, a grandezza piena, almeno 1024 px di lato). Il fondo magenta pieno evita i PNG «trasparenti» finti.

## Come si scrive il prompt (lo fa `prompt.py`: non riscriverlo a mano)
- **La riga di stile in testa** («TRUE PIXEL ART, the most important thing: …»): la cosa più importante va per prima. Nei giri del personaggio Codex ha rispettato la testa grande solo quando la frase della testa era in testa al prompt; con «ADULT body, real jawline» ignorava la sagoma e faceva proporzioni da adulto normale.
- **Una vista per immagine**: un foglio = una vista, 4 colonne (i 4 disegni) × una riga per mossa, la camminata nella prima riga. Mai più viste nello stesso foglio: le proporzioni scappano.
- **Fondo magenta pieno #FF00FF**, niente pavimento, ombre, scritte o griglie; spazio vuoto fra le righe (Codex lascia salire i capelli nella riga sopra: `pixel.py` taglia per sagome, ma meno si toccano, meglio è).
- **Allegati, in quest'ordine**: la vista giusta del modello, poi il disegno approvato (giro 1, più il foglio di stile se il personaggio è nuovo); nel giro 2 le due viste del modello fra cui sta la vista nuova e, per ultimo, il foglio a pixel già approvato della vista vicina.
- **Le dosi a parole**: con «VERY BIG» o «HUGE» Codex esagera (teste al 49 % su sagome al 38 e al 43); «a little MORE than one third (38 %)», «a little LESS than half (43 %)» e «the chin sits exactly at the bottom of the grey head shape» vengono giuste a ±3 punti. Si misura e si rifà quello fuori dose (2 tentativi).
- La camminata: «passing pose with the legs together» nei disegni 2 e 4. Nella prova la vista ENE aveva il 2 a gambe aperte: da fermo il personaggio restava a metà passo.

## Il controllo, prima di farli vedere
Sul `_FOGLIO_sprite.jpg`, a occhio, uno per uno:
1. **I piedi** toccano la linea di terra della loro riga (una capriola resta in aria quanto la disegna il foglio).
2. **La testa** ha la stessa taglia in tutte le viste e in tutti i disegni; i capelli interi, niente tagli piatti in cima (`pixel.py` avvisa se una figura tocca il bordo del foglio o due figure sono attaccate).
3. **I colori** sono gli stessi girando (stessa maglietta, stesse scarpe in tutte le 9 viste) e lo stile è quello di `F3_sprite_pixel.jpg`: stessa grandezza dei pixel, stesso contorno.
4. **La camminata**: 2 e 4 a gambe unite; il giro 4 → 1 non scatta.
5. **Il giro delle 16 direzioni** (in fondo al foglio): da una vista all'altra la sagoma cambia a poco a poco, nessuna vista «di un altro artista».
Poi in **Fenaki** (`in_fenaki.py` ha preparato `controllo/`): `provino(cartella=<…>/controllo, anim="giro-cammina-v1")` mostra le 9 viste in fila con la precedente in rosso sotto; `momento(…, anim="cammina-SE-v1", da=3, a=4)` un cambio di disegno da vicino (striscia, sovrapposti, strobo); `esporta_mp4` il video. La pagina (`fenaki.py --app --porta 8800`, «Nuovo progetto» → la cartella `controllo/`) fa girare i cicli a velocità vera con l'onion skin (N): è lì che la persona guarda e vota va / non va (lo leggi con `giudizi`).
**Non usare** su questi sprite `teste`, `zampe` e i «doppioni» della `diagnosi`: sono tarati sul gatto di Matemagica (cercano occhi gialli e unghie) e qui danno falsi allarmi. Se vuoi mettere una scena in «Tocca a te» nella home di Fenaki: `diagnosi`, poi `chiedi_giudizio(…, forza=True, perche="sprite a pixel: la diagnosi è tarata sul gatto")`.

## Farli vedere
1. Alla persona: il foglio aperto (`foglio.py --apri`) e la pagina di Fenaki; le scelte di gusto come A/B con le immagini.
2. Nella PR: `_FOGLIO_sprite.jpg` (e il video se serve) nella cartella del personaggio, con scritto cosa guardare, così il gruppo vede cosa entra. Il motore degli sprite del look 3 arriverà in MAREA con una PR sua, che leggerà `sprite/elenco.json` (lo stesso formato della prova dei look).

## Cosa NON fare
- Partire da forme fatte da codice al posto del design: prima il disegno approvato, poi le viste. La sagoma grigia dice solo misura e angolo e sparisce sotto il disegno (se il generatore copia le forme della base, il risultato sembra un modello low-poly ridisegnato).
- Più viste in un foglio, più di 3 mosse in un foglio, fogli senza la camminata in prima riga.
- Saltare il giro 1 o fare il giro 2 prima dell'ok: i 6 fogli del giro 2 copiano lo stile del giro 1, anche i suoi difetti.
- Ritoccare la tavolozza a mano o mischiare le tavolozze di due personaggi: ognuno ha la sua `sprite/tavolozza.json`.
- Mettere i PNG nel repo (solo i JPG).
- Fidarsi del «fatto» di Codex: apri sempre il foglio. Dopo ~40-50 immagini di fila Codex si può fermare: rilancia `genera.py`, salta i fogli già fatti.

## Tempi e costi (dalla prova)
9 fogli Codex → 108 disegni (3 mosse × 4 × 9 viste), tutti buoni al primo colpo; i 6 del giro 2 in ~4 minuti, 4 alla volta; un foglio da 4 disegni ~1 minuto. Ogni mossa nuova: 36 disegni per personaggio. Codex e ChatGPT usano l'abbonamento ChatGPT di chi genera: niente crediti a parte.
