# Corse · Parte B: il Gran Premio della fetta 1 (motore v1)

> Archivio. Tolto da `docs/CORSE.md` il 20 ott 2026 insieme al motore v1 (`sim/minigames/corse.ts`, tag `archivio/spenti-corse-v1`). Il Gran Premio di oggi gira sul motore v2: `docs/CORSE.md` A11-A12.

## B0. In tre righe
Un'isola con il format delle **corse arcade alla Mario Kart**: kart, camera dietro al veicolo, drift che carica il turbo, 3 giri contro 4 bot. Si gioca da telefono (il gas è automatico, un pollice sterza) e da PC (frecce/WASD + Spazio). Il server rigioca la gara e paga il premio come per gli altri minigiochi.

## B1. Storia
Nessuna per ora **[scelta provvisoria]**. Il circuito si chiama «Anello del Faro». I bot si chiamano Gabbiano, Granchio, Polpo e Delfino.

## B2. Dove sta e come si apre
- Nell'arcipelago a `[208, 13]` (nord-est, tra i Ghiacci e la Tempesta), 58×46 celle, stile `corse`.
- Sblocco `{ tipo: 'libera' }`: è **aperta a tutti**, anche senza link personale **[scelta provvisoria]**.
- Il posto del gioco è l'**arco a scacchi in cima al molo** (cella `[27, 35]`): lì compare **GIOCA · ISOLA DELLE CORSE**, che apre l'hub (A3, #185). Le gare partono dalla porta della Spiaggia nell'hub.

## B3. L'isola
- **Nel mondo** (#185, 10 ott 2026): l'hub in piccolo, come la concept `corse_13_hub_arrivo`. A sud il molo e il paese dei piloti (garage, podio con la statua del manichino col trofeo, torre di controllo, bancarelle, festoni); al centro la rotatoria col trofeo dorato e le strade coi cordoli; intorno i quartieri delle zone (montagna innevata, giungla col tempio, palazzi al neon, luna park, spiaggia col faro) con le loro porte.
- **La pista vera** è una scena a parte (come la chiesa dei Templari): 580 m di anello levigato con 12 m di carreggiata, 3 m di prato e il muretto di gomme a bande. Intorno ci sono tribune sul rettilineo, gomme all'esterno delle curve, palme e il mare.

## B4. La partita
1. Scegli la **guida** (MORBIDA, MEDIA o NERVOSA): è la prova A/B di Jack e il gioco si ricorda l'ultima scelta.
2. **VIA!** → semaforo 3-2-1 → 3 giri.
3. Si parte **ultimi** in griglia, dietro ai 4 bot.
4. All'arrivo conta la **posizione**: 1° oro, 2° argento, 3° bronzo, 4° e 5° niente medaglia (ma la consolazione di `balance.solo`).
5. Il punteggio per il tabellone dei record è il **tempo**: `30000 − centesimi`, più alto vince.

Il tempo massimo è 240 s: chi non arriva non prende medaglia.

Con la guida media una gara pulita dura ~1:24 (giro ~27 s). Chi va a mezzo gas e non fa il drift arriva ultimo in ~2:35.

## B5. Controlli
| | Telefono | PC |
|---|---|---|
| Sterzo | joystick (al 70% della corsa è già pieno) | A/D o ← → |
| Gas | automatico | automatico |
| Freno / retro | joystick giù o FRENO | S / ↓ |
| Drift | **DRIFT** tenuto in curva, oppure sterzo tutto da una parte per 0,35 s (parte da solo) | Spazio tenuto, oppure sterzo tenuto |
| Uscire | Ritirati | Esc |

Nella scelta della guida il PC usa 1/2/3 e Invio.

## B6. Guida (i numeri)
- **Niente fisica vera.** Il kart ha un muso, una direzione del moto e una velocità:
  - lo sterzo gira il muso (fino a `sterzo` rad/s, pieno sopra `sterzoPieno` m/s);
  - la **presa** porta il moto verso il muso: bassa = scivola.
  - **retromarcia** (Jack, 10 ott: «se vai a sbattere contro il muro è un casino»): freno tenuto da fermo, fino a `retro` 7 m/s con `retroAccelerazione` 12 m/s²; lo sterzo in retro è pieno già sopra `retroSterzoPieno` 2,5 m/s, così ci si gira e si esce dal muro.
- **Prato** = velocità × 0,55.
- **Muro** = rimbalzo, velocità × 0,7, e si striscia lungo la pista. Il muro chiude le scorciatoie.
- **Drift:**
  - gira sempre verso il lato del drift, ×0,7 dello sterzo a sterzo dritto;
  - sterzando dalla stessa parte stringe (fino a ×1,3), controsterzando allarga (fino a ×0,1);
  - la presa in drift è bassa, per questo il kart va di traverso.
- **Turbo:** la carica decide il livello.
  - carica ≥ 0,8 s = turbo 1, 0,5 s;
  - carica ≥ 1,6 s = turbo 2, 1,2 s;
  - il turbo dà +30% di velocità massima.
  - Scintille: bianche mentre carichi, gialle al livello 1, rosa al livello 2.

| Guida | Velocità | Accelerazione | Sterzo | Presa | Presa in drift | Drift |
|---|---|---|---|---|---|---|
| Morbida | 19 m/s | 11 | 1,9 | 14 | 5 | ×1,25 |
| Media | 20 m/s | 14 | 2,25 | 10 | 3,5 | ×1,35 |
| Nervosa | 21 m/s | 17 | 2,7 | 7 | 2,5 | ×1,45 |

## B7. I bot
- Guidano con la guida media, a una frazione della velocità massima (97,5 / 95,5 / 93,5 / 91,5%), senza drift.
- Ognuno segue la sua **corsia**, che ondeggia piano, puntando un punto 6 m + 0,35 s davanti.
- **Elastico leggero:**
  - se sono davanti a te rallentano (−0,04% al metro, fino a −6%);
  - se sono dietro spingono (+0,03% al metro, fino a +5%).
- I kart che si toccano si spingono via e quello dietro perde l'1,5%.

## B8-B9. Pista e griglia
- Il centro della pista è in `pista.punti`: 18 punti, levigati con Catmull-Rom e campionati ogni 2 m.
- Griglia: 2 file da 2 bot a −5 e −11 m dal via; tu da solo a −17 m.
- Il progresso si misura lungo la pista: chi torna indietro perde giro.

## B10. Premio
`balance.solo` (10 partite premiate al giorno) più **+20 Legno** per l'oro (`premioExtra`). La gara entra nel **diario** (pagina Medaglie: «Oro ovunque» ora vuole anche il Gran Premio) e nel **tabellone dei record** del Porto, che mostra tempo e posizione (es. «1:23,4 · 1°»).

## B11. Audio
Solo i suoni che esistono già **[scelta provvisoria]**:
- `bip` per il semaforo;
- `via` alla partenza;
- `boa` a ogni giro;
- `arrivo` o `fine` alla fine.

Da fare: motore, sgommata del drift, turbo.

## B12. Da decidere
- Quale guida tenere di serie (prova di Jack), o se lasciarle tutte e tre come scelta. Le fette successive stanno in A12.

## B13. Come funziona sotto
Mappa del codice in `docs/CONTRACTS.md` §31.
- **Sim** `packages/sim/src/minigames/corse.ts`: solo + − × ÷ e radice quadrata, come dungeon e Templari, perché il replay del server coincida con quello di Safari. È un `MinigameModule` normale, registrato nel registro dei minigiochi. Il server lo rigioca col giro «da solo» (`/api/solo/start` · `/api/solo/play`), senza rotte nuove e senza migrazioni.
- **Client:** chunk `apps/client/src/corse/` (scena sua, camera dietro al kart) aperto da `game/minigiochi.ts` come gioco nel mondo (`SchermoGioco` con `step`/`update`).
