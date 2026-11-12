> Isola dei Templari, §13: come funziona sotto, per chi programma (sim, server, client). Il resto nell'[indice](../TEMPLARI.md).

## 13. Come funziona sotto (per chi programma)
Una partita è una **sim deterministica** come il dungeon (`packages/sim/src/templari/`, stessa regola: niente funzioni trascendenti): il server sceglie il seed (`POST /api/templari/start`), il client gioca e registra un input per tick, a fine partita (`POST /api/templari/finish`) il DO del lotto rigioca gli input e paga il premio dell'ondata che ne esce. Lo stato (seed in sospeso, premio del giorno, record) sta nel `LotState` (niente migrazioni D1). Nel client tutto vive in un **chunk** a parte (`apps/client/src/templari/`), scaricato solo entrando. Dettagli e interfacce: `CONTRACTS.md` (sezione Templari).
