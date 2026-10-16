// La Difesa a corsie (banco provadifesa.html, #358; docs/DIFESA.md): un passo della partita. Ordine del tick: comandi del giocatore,
// cielo e ondate (fermi nel tutorial finché non pianti), difensori, colpi, nemici, tosaerba, monete, fine partita.
// Vittoria: lanciate tutte le ondate e nessun nemico in campo. Sconfitta: un nemico in fondo a una corsia che ha già usato il tosaerba.
import type { DComando, DState } from './stato.ts';
import { totOndate } from './stato.ts';
import { passoOndate } from './ondate.ts';
import { passoNemici, passoTosaerba } from './nemici.ts';
import { pala, passoColpi, passoUnita, pianta } from './unita.ts';
import { passoCielo, passoMonete, raccogli } from './monete.ts';

export { nuovaPartita } from './stato.ts';

export function esegui(s: DState, c: DComando): void {
  if (c.t === 'pianta') pianta(s, c.tipo, c.corsia, c.col);
  else if (c.t === 'raccogli') raccogli(s, c.id);
  else if (c.t === 'pala') pala(s, c.corsia, c.col);
}

export function passo(s: DState, comandi: readonly DComando[] = []): void {
  s.ev.length = 0;
  if (s.esito) return;
  for (const c of comandi) esegui(s, c);
  if (!s.attesa) { passoCielo(s); passoOndate(s); }
  passoUnita(s);
  passoColpi(s);
  passoNemici(s);
  passoTosaerba(s);
  passoMonete(s);
  const tot = totOndate(s);
  if (!s.esito && tot >= 0 && s.ondata >= tot && s.nemici.length === 0) {
    s.esito = 'vinta'; s.fine = s.tick;
    s.ev.push({ e: 'vinta' });
  }
  s.tick++;
}
