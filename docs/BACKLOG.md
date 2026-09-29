# MAREA — Backlog (idee parcheggiate, zero sensi di colpa)

> Ogni idea nuova → una riga qui. Entra in una milestone solo tramite `ROADMAP.md`. Niente deroghe alla V1.

## Dopo dicembre 2026
- Battaglia carte/unità in tempo reale (Clash Royale-like): netcode a bassa latenza, bot, bilanciamento. Unica ragione per il piano Paid di Cloudflare.
- Puzzle leggero con i moduli dell'isola (tubi/tessere).
- Distretto Neon e Isola Selvaggia come zone vere (oggi facciate).
- Progetti comuni (ponte, faro del Porto) finanziati insieme.
- Bot per i minigiochi in tempo reale.
- Chat testuale (oggi solo emote).
- Interni degli edifici; ciclo giorno/notte; meteo.
- Commercio di risorse tra giocatori.
- PWA installabile; notifiche «la Cava è finita».
- Musica originale (ElevenLabs Music), voci per l'onboarding.
- Apertura al pubblico: inviti a catena, moderazione, dominio, piano Paid.
- Passaggio a un motore (Godot) se il browser mostra un tetto: le fixture d'oro di `packages/sim` sono il criterio di parità.

- Negozio dei cappelli (M1): i cappelli con costo in Perle si comprano una volta (campo `posseduti` nel `LotState`, azione `buyHat`); finché non c'è, `/api/look` accetta solo i cappelli gratuiti.
- Barche per giocatore: oggi ogni client ha la sua barca a `boatSpawn`, quindi al molo la barca di un peer si sovrappone alla tua (vuota). In M1: una barca per lotto/persona con posto al molo proprio, o la tua barca nascosta finché non ci sali.

## Mai
- Soldi veri per risorse o acceleratori. (Cosmetici a pagamento: solo se un giorno si apre al pubblico, e solo cosmetici.)
- Attacchi alle isole altrui.
