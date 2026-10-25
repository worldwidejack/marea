// La Borsa (bundle iniziale: solo il bottone nascosto #mzBorsaBtn, che apre la voce del menù AVATAR): le cose «da Animal Crossing» —
// vestiti e cappelli da indossare, gli strumenti (pala, canna, retino), insetti e pesci presi, i mobili nel magazzino di casa.
// Il pannello vero sta nel chunk rpg/borsa_ui.ts, caricato al primo tocco. Zaino, armi e armature restano nel Personaggio.
import type { Look, LotState } from '@marea/protocol';
import type { Api, Me } from '../net/api.ts';
import type { Hud } from './hud.ts';
import { topButton } from './topbar.ts';

export type Borsa = { open(): void; close(): void; isOpen(): boolean };
export type BorsaOpts = { api: Api; me: Me; root: HTMLElement; hud: Hud; getLot(): LotState | null; setLot(l: LotState): void; setLook(l: Look): void };

export function createBorsa(o: BorsaOpts): Borsa {
  let ui: Borsa | null = null, loading: Promise<Borsa> | null = null;
  const btn = topButton({ root: o.root, id: 'mzBorsaBtn', order: 3, label: '', title: 'Borsa', nascosto: true, onClick: () => { if (ui?.isOpen()) ui.close(); else b.open(); } });
  const load = (): Promise<Borsa> => (loading ??= import('../rpg/borsa_ui.ts').then((m) => (ui = m.createBorsaUi({ ...o, onOpen: () => btn.setOn(true), onClose: () => btn.setOn(false) })),
    (e: unknown) => { loading = null; o.hud.toast('Connessione lenta: riprova', 2500); throw e; }));
  const b: Borsa = {
    open() { void load().then((u) => u.open(), () => {}); },
    close() { ui?.close(); },
    isOpen: () => !!ui?.isOpen(),
  };
  return b;
}
