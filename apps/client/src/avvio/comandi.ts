import { azioneDi, PROFILI } from '../comandi/azioni.ts';
import type { Profilo } from '../comandi/azioni.ts';
import { avviaRimappa, impostaPad, impostaTasto, padDi, profiloAttivo, tastoDi } from '../comandi/mappa.ts';
import { cercaMenu } from '../comandi/pannelli.ts';
import { avviaPad, padCollegato, padMira, padMovimento } from '../comandi/pad.ts';
import { registerStateProvider, registerTestHook } from '../test/testapi.ts';

export function avviaComandi(): void {
  avviaRimappa(() => !!cercaMenu()); avviaPad();
  registerStateProvider('comandi', () => ({
    pad: padCollegato(), mov: padMovimento(), mira: padMira(), profilo: profiloAttivo(),
    azione: { tasti: [tastoDi('borgo', 'azione', 0), tastoDi('borgo', 'azione', 1)], pad: padDi('borgo', 'azione') },
    pozione: { tasti: [tastoDi('dungeon', 'pozione', 0)], pad: padDi('dungeon', 'pozione') },
  }));
  const profilo = (p?: Profilo): Profilo => p && Object.hasOwn(PROFILI, p) ? p : 'borgo';
  registerTestHook('comandi_tasto', (p) => {
    const a = p as { profilo?: Profilo; id: string; slot: number; code: string | null };
    const m = profilo(a.profilo); return azioneDi(m, a.id) ? impostaTasto(m, a.id, a.slot, a.code) : null;
  });
  registerTestHook('comandi_pad', (p) => {
    const a = p as { profilo?: Profilo; id: string; b: number | null };
    const m = profilo(a.profilo); return azioneDi(m, a.id) ? impostaPad(m, a.id, a.b) : null;
  });
}
