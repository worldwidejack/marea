// Comandi: rimappa dei tasti e controller, accesi una volta all'avvio. La schermata per cambiarli sta nelle Impostazioni (ui/comandi_ui.ts).
import { azioneDi } from '../comandi/azioni.ts';
import { avviaRimappa, impostaPad, impostaTasto, padDi, tastoDi } from '../comandi/mappa.ts';
import { avviaPad, padCollegato, padMira, padMovimento } from '../comandi/pad.ts';
import { registerStateProvider, registerTestHook } from '../test/testapi.ts';

export function avviaComandi(): void {
  avviaRimappa(); avviaPad();
  registerStateProvider('comandi', () => ({
    pad: padCollegato(), mov: padMovimento(), mira: padMira(),
    azione: { tasti: [tastoDi('azione', 0), tastoDi('azione', 1)], pad: padDi('azione') }, pozione: { tasti: [tastoDi('pozione', 0)], pad: padDi('pozione') },
  }));
  registerTestHook('comandi_tasto', (p) => { const a = p as { id: string; slot: number; code: string | null }; return azioneDi(a.id) ? impostaTasto(a.id, a.slot, a.code) : null; });
  registerTestHook('comandi_pad', (p) => { const a = p as { id: string; b: number | null }; return azioneDi(a.id) ? impostaPad(a.id, a.b) : null; });
}
