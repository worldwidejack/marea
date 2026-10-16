# MAREA — Isola dell'Arena (GDD e Obiettivi di Progetto)

> Documento di riferimento per l'implementazione della modalità PvP e dell'Isola dell'Arena.

---

## 1. Visione del Gioco
Creare una modalità PvP in stile *Brawl Stars* ambientata su una nuova isola dell'arcipelago ("Isola dell'Arena"), riutilizzando il sistema di combattimento, armi, armature, magie e pozioni dei dungeon.

### Modalità
- **1v1 (Duello rapido)**: focus della prima versione (V1), al meglio dei 3 round.
- **Showdown (Tutti contro tutti a 4)**: evoluzione futura, vince l'ultimo in piedi.
- **A squadre (2v2 / 3v3)**: evoluzione futura, basata su cooperazione e ruoli.

---

## 2. Regole di Gioco & Loadout

### Set Pre-Partita
Prima di entrare nell'arena il giocatore sceglie il proprio equipaggiamento dal baule/inventario:
- **Vestizione**: Armatura e anelli.
- **4 Slot Rapidi (Armi / Magie)**: 4 armi o magie intercambiabili al volo durante lo scontro.
- **Frecce per l'Arco**: ogni arco equipaggiato ha una propria scorta di frecce (circa 15–20) che non occupano slot armi aggiuntivi.
- **2 Pozioni rapide**: due pozioni a scelta pronte all'uso.

### Interfaccia Utente (Mobile e Desktop)
- Su telefono (schermo 390×844) i 4 slot armi/magie sono disposti in una barra orizzontale in basso per il cambio rapido con un tocco (tasti 1-4 su PC).
- Due pulsanti dedicati per l'uso immediato delle due pozioni.

---

## 3. Nuove Magie di Supporto
Quattro magie pensate per il gioco di squadra e le evocazioni (utili in Arena e nei dungeon):
- **Cura a flusso**: raggio continuo concentrato su un singolo alleato o evocazione.
- **Cura a bomba**: lancio ad area che cura alleati ed evocazioni nella zona d'impatto.
- **Furia a flusso**: raggio continuo che aumenta velocità e danno di un singolo alleato o evocazione.
- **Furia a bomba**: lancio ad area che potenzia per qualche secondo chi si trova nel raggio d'azione.

---

## 4. Principi di Bilanciamento PvP
- **Statistiche normalizzate**: tutti i giocatori partono con 100 di Vita, 100 di Magicka e 100 di Stamina di base.
- **Perk attivi ma calibrati**: i perk sbloccati nel gioco base restano attivi (es. bonus percentuali, sconti o effetti speciali), ma i danni non devono consentire l'uccisione in un colpo solo (one-shot).
- **Evocazioni accessibili**: anche con 100 di Magicka base, chi ha sviluppato i perk di evocazione deve riuscire a lanciare le creature più forti (anche esaurendo l'intera barra di Magicka).
- **Indipendenza**: il bilanciamento dell'Arena non deve alterare le statistiche dei dungeon normali.

---

## 5. I 4 Step di Implementazione

### Step 1: Bilanciamento PvP & Nuove Magie
- **Obiettivo**: Rendere il combattimento equilibrato per il PvP (base 100 stats, danni riscalati senza one-shot, evocazioni usabili) e aggiungere le 4 nuove magie di cura e furia (flusso e bomba), valide anche su alleati ed evocazioni.

### Step 2: Loadout Pre-Partita & Interfaccia Rapida
- **Obiettivo**: Permettere al giocatore di comporre il proprio set prima di entrare (armatura, 4 armi/magie, frecce legate all'arco, 2 pozioni) e integrare a schermo la barra a 4 slot per il cambio rapido e i 2 tasti pozione, comodi su mobile.

### Step 3: Modalità 1v1 Online
- **Obiettivo**: Creare la logica multiplayer del duello 1v1: sincronizzazione tra due giocatori, gestione dei 3 round, condizioni di vittoria e gestione fine scontro.

### Step 4: Isola dell'Arena & Mappa del Colosseo
- **Obiettivo**: Aggiungere la nuova isola nel mondo con molo e colosseo visibile, e creare la mappa di combattimento chiusa (simmetrica con coperture e ostacoli).
