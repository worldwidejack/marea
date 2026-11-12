# MAREA — Dungeon in prima persona

> Come si gioca un dungeon: **solo dagli occhi dell'eroe**, alla Skyrim (la vista dall'alto non c'è più, 11 nov 2026). Le regole del combattimento, dei perk e dei dungeon stanno in `RPG.md`: qui solo quello che la prima persona aggiunge. La sim non distingue: nell'Arena (vista dall'alto) non cambia niente e i log vecchi si rigiocano uguali.
> Numeri in `packages/content/src/rpg/*.json` (`balance.json` → `dungeon.furtivo`, `dungeon.quiete`, `perk.occhio`, `perk.manoFerma`; `enemies.json` → `altezza`, `quota`, `udito`).

## 1. Comandi
- **PC**: il mouse guarda (il primo clic lo cattura, Esc lo lascia e apre la Pausa), WASD cammina, Maiusc corre, clic o Spazio = A, V schiva, R pozione, 1-2-3 i preferiti, I lo zaino, **M** la mappa. **E** fruga quello che hai sotto il mirino (se non c'è niente da frugare resta la Scarica dell'arco).
- **Telefono** in orizzontale: joystick a sinistra, il pollice destro trascinato gira la visuale (anche partendo dalla A); il cartellino del bottino sotto il mirino si tocca.

## 2. Mira in alto e in basso
- Frecce, magie e raggi vanno **dove punta il mirino**, anche in alto e in basso: partono dagli occhi (1,4 m) e la sim li fa salire o scendere con lo sguardo (`DungeonInput.p`, l'**alzo**: 81 passi da −60° a +60°, solo mentre si mira).
- I nemici sono **alti quanto il loro modello** (`altezza`; chi vola sta alla sua `quota`, che è anche quella disegnata): un ragno o un lupo si colpiscono guardando in basso, l'Aerostato in volo guardando in su. Si concede 0,2 m di margine: meglio un colpo regalato che uno che sembra preso e non conta.
- Le frecce cadono con la loro gravità (si mira un po' più su per i bersagli lontani); soffitto e pavimento fermano i colpi, le magie ad area ci scoppiano contro.
- **Raggi a flusso**: seguono lo sguardo e si fermano al primo muro, al pavimento o al soffitto; si vedono finire sul primo nemico che prendono, con le scintille. Più lunghi di prima (Fuoco continuo 6,5 m, Elettricità continua 9 m, Cura e Furia a flusso 8 m). In alto e in basso il raggio è grosso la metà che di lato.
- **Bombe** (di fuoco, elettriche, Cura, Furia): atterrano dove lo sguardo tocca terra (guardando in su, in fondo alla gittata), o sul primo nemico davanti prima di lì.
- Dal telefono il colpo si aggancia al nemico davanti, al centro del suo corpo (anche in alto e in basso).

## 3. Bottino da frugare
- I nemici uccisi **restano a terra** (niente più sacco), i forzieri si aprono. Guardando un bottino a portata di mano (1,9 m) compare **«E · Fruga · Bandito»** (o «Apri · Forziere», «Prendi · Libro: …»; «vuoto» se non c'è più niente).
- La **finestra** mostra cosa c'è dentro (monete, oggetti, peso): un tocco o un clic prende quella riga (quanti ne entrano nello zaino), **«Prendi tutto»** (R) tutto quello che entra; E, Esc o Tab chiudono. Da soli la partita si ferma mentre è aperta; insieme no. I libri si prendono subito.
- Sotto: appena entri il client manda l'azione `fruga` (l'eroe non raccoglie più passandoci sopra), ogni presa è l'azione `prendi` (`sim/dungeon/fruga.ts`), registrata col tick e rigiocata dal server come quelle dello zaino. Insieme ognuno fruga la sua parte, uguale per tutti.

## 4. Furtività
- **Chi non ti ha visto** (`sim/dungeon/quiete.ts`) vede in un **cono**: davanti col raggio pieno (7-20 m secondo il nemico), di lato a metà, dietro quasi niente. Camminando (senza correre) ti vede a **¾ del raggio**. Non scatta subito: il **sospetto** (solo nel motore, a schermo nessuna barra) sale in fretta se sei vicino e davanti, piano se sei al bordo, e cala piano.
- **Sente**: i passi (camminando pochi metri, correndo molti), i colpi, l'arco e le magie, le lotte vicine; dietro un muro a metà. Il sentito da solo non basta per attaccare: si gira e viene a cercare.
- A metà sospetto **cerca** dove ti ha visto o sentito (un **«?»** giallo sopra la testa), poi si guarda intorno e torna a casa; pieno ti ha visto (un **«!»** rosso per un secondo) e sveglia chi ha vicino.
- Prima di tutto questo **non sta immobile**: metà di chi cammina fa la **ronda** tra due punti vicini, gli altri restano lì e si guardano intorno. **Chi dorme non vede**, sente a metà e, sveglio, va a vedere.
- **Attacco furtivo**: il colpo su chi non ti ha ancora visto (dorme o veglia) fa **×2** (i capi no), con la scritta e il suono. L'**occhio** sotto il mirino lo dice: una riga chiusa = nessuno ti ha visto, rosso aperto = qualcuno ti è addosso.
- I non-morti che dormono stanno **distesi a terra** e si tirano su quando ti sentono.

## 5. Arco
- Via l'**Automira** (le frecce che curvano dagli occhi si leggevano male). Al suo posto, nello stesso ramo:
  - **Occhio d'aquila** (30): con l'arco teso del tutto la vista si avvicina (campo al 55 %) e il mouse rallenta, per mirare lontano.
  - **Mano ferma** (60): mentre tendi l'arco il mondo va ai **due terzi** (nemici, i loro tiri e le trappole saltano un tick ogni tre; tu e le tue frecce no) e lo schermo si tinge. Solo da soli: insieme e in Arena no.
- Chi aveva preso l'Automira si ritrova i punti da spendere (`fitHero`).

## 6. Nemici e pericoli
- I nemici non arrivano più addosso agli occhi: in prima persona restano almeno 0,35 m più in là (`SPAZIO_FP`), così si vedono interi anche in mischia.
- Tutto quello che dall'alto si leggeva come un disegno a terra si alza in piedi (`rpg/fp_pericoli.ts`): i cerchi d'avviso (bombe, magma, geyser, cannonate, colpi ad area dei capi, forme della Baita) diventano **muri di luce** con l'orlo che sale col tempo; le corsie dei colpi dritti due pareti; le onde del Mausoleo un muro d'acqua coi suoi varchi; le lancette lastre in piedi; le zone del calore del Santuario quattro muri; le linee di mira (il Fuciliere, i raggi dei capi) un filo rosso all'altezza del petto.
- Quello che viene lanciato (bombe dell'Aerostato e dell'Albatros, magma del Mastro, globi del Lanciatore, sputi di Korok) **vola da chi lo lancia** fin dove cade; le cannonate cadono dall'alto.
- Se ci sei dentro: **«Pericolo: spostati»**, poi **«VIA DI LÌ!»**, una freccia attorno al mirino verso l'uscita più corta (o verso il varco dell'onda) e un bip che accelera. Chi prepara un colpo fuori dalla vista accende il bordo di quel lato.

## 7. Interfaccia
- In alto al centro la **barra del nemico** sotto il mirino o appena colpito (il capo col nome in oro). Niente barre sopra le teste dei nemici (restano quelle degli alleati). Non c'è più la bussola.
- In alto a sinistra la **minimappa** (piccola, 90 px sul telefono, nord in alto, gira solo la freccia che sei tu; `rpg/fp_mappa.ts`). Un tocco (o **M**) apre la **mappa grande**: da soli ferma la partita, e lì si sceglie cosa lasciare da chiusa, **Minimappa** o **Pulsante** (un bottoncino che riapre la grande); la scelta resta sul dispositivo. **Nebbia**: si scopre solo quello che vedi (360° fino a 8 celle, i muri fermano la vista); quello che vedi adesso è più chiaro di quello che ricordi. Scala e lanterne compaiono solo dopo averle viste, i nemici solo se li vedi ora, i compagni sempre. A ogni discesa si riparte dal buio.
- In basso al centro le tre barre (Magicka, Vita, Stamina) con frecce, pozioni, peso, monete e tempo. Mirino sempre: un punto con le armi, la croce con arco e magie, rosso sopra un nemico.
- Vita sotto il 30 %: bordi rossi che pulsano col **battito del cuore**.

## 8. Scenografia (per orientarsi)
- **Foschia di lontananza** a 6 gradini, del colore dello stile (`render/finestra.ts`): da vicino nitido, lontano si sfuma; le fiamme ne prendono la metà e restano punti di riferimento.
- **Dungeon costruiti** (`rpg/fp_arredo.ts`): zoccolo e cornice lungo i muri, pilastri negli angoli, sugli spigoli delle porte e ogni 4 m, travi al soffitto ogni 4 m, muri e pavimenti in tre toni a cella. **Ogni stanza ha un colore** (stendardi alle pareti; in cripta, archivio, mausoleo e baita anche il tappeto al centro). **Grotta**: massi alla base e sporgenze, pile di massi sugli spigoli, stalattiti, funghi luminosi del colore della stanza.
- **Portale del Vuoto** (`rpg/fp_vuoto.ts`): vista corta (15 m) e foschia viola dello stesso colore del fondo, così quello che è lontano sparisce nel nulla; piattaforme con orlo di cristallo, spessore e rocce a punta sotto; un faro per stanza col filo di luce del suo colore fino al cielo; stelle e il portale in cielo, sempre in direzione del Custode.
- Solo scenografia ferma, calcolata una volta dalla mappa: niente cambia la sim né le collisioni. L'Arena non la usa.

## 9. Come funziona sotto
Dungeon **v15** (`sim/dungeon/dungeon.ts`; v15: i nemici vivi di `quiete.ts`): log degli input **formato 5** (un byte d'alzo per riga, solo nelle partite che lo usano), azioni `fruga` e `prendi`, `SqInput` della squadra con l'alzo in quinta posizione. Moduli: `sim/dungeon/alzo.ts` (pendenza, altezze, raggio in 3D), `fruga.ts` (bottino a mano, furtività), `perk.ts` (Mano ferma); client `rpg/prima_persona.ts` con `fp_fruga.ts`, `fp_hud.ts`, `fp_mappa.ts`, `fp_pericoli.ts`. La prova: `tests/e2e/m2_prima_persona.mjs` e `packages/sim/test/dungeon_prima_persona.test.ts`.
