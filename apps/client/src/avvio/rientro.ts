// Rientro: il server dice cosa è successo mentre eri via (e segna che ci sei), poi «ci sono» ogni RIENTRO.presenzaSecondi.
// Cartolina e novità aspettano che si chiuda la schermata iniziale (`dopo`). Dopo la cartolina, «Dall'ultima volta»: chi ha fatto cosa nel codice dalla visita scorsa (chunk ui/novita.ts), quando non c'è altro aperto.
import { RIENTRO } from '@marea/content';
import { FLAGS } from '../flags.ts';
import type { Api, Me } from '../net/api.ts';
import type { LotView } from '../game/lot.ts';
import type { Libri } from '../game/libro.ts';
import type { Hud } from '../ui/hud.ts';
import { registerTestHook } from '../test/testapi.ts';

type Lavoro = { t: number; chi: string; titolo: string };

export function avviaRientro(o: {
  api: Api; me: Me | null; hud: Hud; root: HTMLElement; myView: LotView | null;
  libri: Pick<Libri, 'cartolina'>;
  /** Un pannello è aperto: le novità aspettano. */
  busy: () => boolean;
  /** La schermata iniziale chiusa (avvio/home.ts). */
  dopo: Promise<void>;
}): void {
  const { api, me, myView } = o;
  let rientro: Promise<void> = Promise.resolve();
  if (me && api.enabled && FLAGS.net) {
    const ciSono = () => { if (document.visibilityState === 'visible') void api.presenza().catch(() => { /* riprova al prossimo giro */ }); };
    rientro = api.rientro().then(async (r) => {
      myView?.set(r.lot);
      if (r.riepilogo && (!FLAGS.test || FLAGS.rientro) && !FLAGS.banco && FLAGS.arena !== 'banco') { await o.dopo; await o.libri.cartolina(r.riepilogo, r.novita); }
    }).catch(() => { /* senza rientro si gioca lo stesso */ }).finally(() => {
      setInterval(ciSono, RIENTRO.presenzaSecondi * 1000);
      document.addEventListener('visibilitychange', ciSono);
    });
  }
  registerTestHook('rientroPronto', () => rientro);
  const novita = (prova?: { lavori: Lavoro[]; ora: number }) => import('../ui/novita.ts').then((m) =>
    m.apriNovita({ root: o.root, chiave: `marea:novita:${me?.id ?? 'ospite'}`, busy: o.busy, ...(prova ? { prova } : {}) }));
  if ((!FLAGS.test || FLAGS.novita) && !FLAGS.banco && FLAGS.arena !== 'banco') void rientro.then(() => o.dopo).then(() => novita()).catch(() => { /* senza novità si gioca lo stesso */ });
  registerTestHook('novitaProva', (lavori, ora) => { void novita({ lavori: lavori as Lavoro[], ora: Number(ora) }); return true; });
}
