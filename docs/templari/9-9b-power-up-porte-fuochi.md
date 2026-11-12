> Isola dei Templari, §9-§9b: power-up, porte, trappole; i tre fuochi da accendere e la campana da montare. I segreti: [§9c](9c-segreti.md); il resto nell'[indice](../TEMPLARI.md).

## 9. Power-up, porte, barricate, trappole
- **Power-up** (2,5 % a uccisione, al massimo 4 a ondata; i boss ne lasciano sempre uno, de Molay quando scappa; 25 s a terra e lampeggiano negli ultimi 5; si prendono passandoci sopra; se lo zombie muore fuori, il power-up cade dentro, dove arrivi): **Faretra piena** (munizioni piene a tutte le armi) · **Ira di Dio** (30 s, ogni colpo uccide, i boss no) · **Campane a martello** (muoiono tutti gli zombie in campo, i boss no, +400) · **Decima** (30 s punti doppi) · **Muratori** (tutte le finestre rifatte, +200). Quelli a tempo si vedono sotto la vita coi secondi che restano.
- **Porte**: macerie o cancelli con il prezzo sopra (AZIONE vicino); aperte una volta, restano aperte per tutta la partita e accendono le comparse della loro zona. Prezzi nella tabella del §3; la spiaggia ha due porte (dalla taverna e il cancello dal cimitero, **1250** l'una): basta una.
- **Barricate**: ogni finestra ha 5 assi. Uno zombie davanti ne strappa una ogni 1,2 s; a zero entra. Tu le rimetti tenendo AZIONE (una ogni 0,6 s, +10 punti).
- **Trappole** **[scelta provvisoria]** (AZIONE alla leva, 1000 punti, 25 s accese, poi 60 s per ricaricarsi; la leva rossa in su = pronta). Chi ci passa muore, ma **senza punti** (come in COD); i boss perdono vita (300 al secondo nel rogo, 500 sotto la campana). Tu ti fai male se ci stai dentro: 15 ogni mezzo secondo nel rogo, 60 a ogni passaggio della campana (ogni 1,2 s).
  - **Rogo** nella navata: l'incensiere rovesciato accende la passatoia rossa del presbiterio (il rogo di de Molay). Leva accanto agli stalli a sud.
  - **Campana** sul passaggio verso il cimitero, appena fuori dalla porta nord: la campana grande appesa all'incastellatura oscilla e falcia chi passa. Leva dentro, accanto alla porta nord.

## 9b. Accendere l'isola e montare la campana (14 ott 2026, scelte di birbasan)
Secondo passo della risposta a Jack, come la corrente e i pezzi da costruire di COD Zombies: cose da fare sulla mappa oltre a sparare.
- **Tre fuochi** (grandi bracieri di pietra con la croce): spenti hanno la brace fredda, un filo di fumo e un fascio di luce pallida che li fa trovare. Si accendono tenendo **AZIONE** per **1,5 s** (gratis; lasciare prima = si ricomincia; il bottone ha la barra che si riempie, da PC «tieni F»).

| Fuoco | Dove | Cosa accende |
|---|---|---|
| **Il fuoco del coro** | in chiesa, accanto agli stalli a sud (due passi dalla partenza) | il **rogo**: la leva funziona solo col fuoco acceso |
| **Il fuoco del cimitero** | in cima al cimitero, accanto alla capanna | la **Strega** si sveglia (prima dorme: calderone freddo, niente pozioni) |
| **Il falò dei pirati** | nell'accampamento sulla spiaggia | la **nave del Mercante** attracca (prima è al largo: niente munizioni né potenziamenti) |

  Tutti e tre accesi: **+1000 punti** e un power-up a due passi.
- **La campana da montare**: la campana della trappola è **a terra**, sdraiata accanto all'incastellatura, e la leva dice «pezzi 0/3». I tre pezzi — **la corda**, **il battaglio**, **il perno** — stanno ognuno in uno dei suoi tre posti, diverso da partita a partita (dal seed): la corda in sacrestia, in taverna o all'accampamento; il battaglio nel cimitero, sul sagrato della piazza o sulla spiaggia; il perno sulla spiaggia, in piazza o nel cimitero. Girano a terra col fascio giallo; **AZIONE** li prende (sono della squadra). Con tutti e tre, **AZIONE tenuto 2 s** alla leva monta la campana, che si appende: da lì la trappola funziona come prima (1000 punti, 25 s).
- **HUD**: sotto la vita «🔥 1/3 · 🔔 2/3» (montata: «🔔 montata»).
- **Mappa**: `I` `O` `U` i fuochi, `c` `d` `f` i posti dei pezzi (`tools/templari_mappa.mjs`, che controlla che si raggiungano). Numeri in `templari.json` (`fuochi`, `campana`).
- **Stanza di prova**: nel banco «Isola»: accendi i fuochi, prendi i pezzi, vai a un pezzo.
