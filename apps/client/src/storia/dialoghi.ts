// I dialoghi della storia davanti ai personaggi (avvio/prima.ts): Fulvio regala la canna o il retino, Bepi dice quanto costa la barca e poi
// te la vende (o apre la bottega di sempre), il Furetto ha la sua battuta, Gigi consiglia la Grotta; con la barca Capitan Remo dà le isole
// della missione e, provata l'isola, paga e la mette nel viaggio rapido (missioni.ts). Parlano nella scheda del Porto (game/porto.ts
// `dialogo`), con le scelte sull'ultima pagina. Fuori dal passo giusto non fanno niente: la scheda di sempre.
import { STORIA } from '@marea/content/storia.ts';
import { isolaCorrente, isolaProvata, passoCorrente } from '@marea/sim/economy/storia.ts';
import { moneteOf } from '@marea/sim/economy/monete.ts';
import type { LotState } from '@marea/sim';
import { ApiError } from '../net/api.ts';
import type { Api } from '../net/api.ts';
import type { Porto } from '../game/porto.ts';
import type { Pagina, Scheda } from '../ui/paesani_dlg.ts';
import { nomeIsola, paroleIsola } from './missioni.ts';

/** Le righe dei dialoghi di storia.json: {nome}, {prezzo}, {manca} al loro posto; senza «Nome:» davanti è narrazione, col nome è una
 *  battuta (senza il nome). */
export function righe(chiave: string, v: Record<string, string | number>): { narra: string[]; dice: string[] } {
  const d = STORIA.dialoghi[chiave], vv: Record<string, string | number> = { prezzo: STORIA.barca.prezzo, ...v };
  const tutte = (Array.isArray(d) ? d : d ? [d] : []).map((r) => r.replace(/\{(\w+)\}/g, (_, k: string) => String(vv[k] ?? '')));
  const narra: string[] = [], dice: string[] = [];
  for (const r of tutte) { const m = /^[^:]{1,20}: (.*)$/.exec(r); if (m) dice.push(m[1]!); else narra.push(r); }
  return { narra, dice };
}

export function creaDialoghi(o: {
  porto: Porto; api: Api; nome: string; getLot(): LotState | null; setLot(l: LotState): void;
  segna(id: string): Promise<LotState>; toast(t: string, ms?: number): void;
  /** Remo ti ha già dato la prima isola (`senti` lo segna). */
  remo: { sentito(): boolean; senti(): void };
}): (chi: string, poi: (frase?: string) => void) => boolean {
  let parla = false;
  const dice = (chiave: string, v: Record<string, string | number> = {}): Pagina[] => righe(chiave, { nome: o.nome || 'Navigante', ...v }).dice.map((testo) => ({ testo }));
  const errore = (e: unknown) => (e instanceof ApiError || e instanceof Error ? e.message : 'Qualcosa non va: riprova');
  /** Apre la scheda; `dopo` quando la chiudi. Mentre è aperta, A davanti al personaggio va alla pagina dopo. */
  const via = (id: string, nome: string, pagine: (s: Scheda) => Pagina[], dopo?: () => Promise<unknown>): true => {
    parla = true;
    void o.porto.dialogo(id, nome, pagine).then(() => dopo?.()).catch((e: unknown) => o.toast(errore(e), 3000)).finally(() => { parla = false; });
    return true;
  };
  /** Le pagine, con le scelte sull'ultima. */
  const conScelte = (pagine: Pagina[], scelte: Pagina['scelte']): Pagina[] => pagine.map((p, i) => (i === pagine.length - 1 ? { ...p, scelte } : p));

  const regalo = (s: Scheda): Pagina[] => conScelte(dice('fulvio'), (['canna', 'retino'] as const).map((k) => ({
    label: k === 'canna' ? 'La canna' : 'Il retino', act: k, principale: true,
    fai: async () => {
      try { o.setLot(await o.api.storia('attrezzo', { scelta: k })); s.poi(dice('fulvioGrazie')); } catch (e) { s.nota(errore(e)); }
    },
  })));
  const barca = (s: Scheda, poi: () => void): Pagina[] => {
    const lot = o.getLot(), manca = STORIA.barca.prezzo - (lot ? moneteOf(lot) : 0);
    const bottega = { label: 'La bottega', act: 'bottega', fai: () => { s.chiudi(); poi(); } };
    if (manca > 0) return conScelte(dice('bepiManca', { manca }), [bottega, { label: 'Ciao', act: 'ciao', fai: () => s.chiudi() }]);
    return conScelte(dice('bepiPronto'), [{
      label: `Compra · ${STORIA.barca.prezzo}`, act: 'compra', principale: true,
      fai: async () => {
        try { o.setLot(await o.api.storia('barca')); s.poi(dice('bepiBarca')); } catch (e) { s.nota(errore(e)); }
      },
    }, bottega]);
  };

  /** Remo: l'isola da fare (la prima volta te la racconta, poi ti chiede se ci sei stato), o provata → RISCUOTI e la prossima. */
  const remo = (lot: LotState, poi: () => void): boolean => {
    const i = isolaCorrente(lot);
    if (!i) return false;
    const altro = (s: Scheda): NonNullable<Pagina['scelte']> => [{ label: 'Ciao', act: 'ciao', fai: () => s.chiudi() }, { label: 'Chiacchiera', act: 'chiacchiera', fai: () => { s.chiudi(); poi(); } }];
    if (!isolaProvata(lot)) {
      const prima = !o.remo.sentito();
      o.remo.senti();
      return via('remo', 'Capitan Remo', (s) => conScelte(dice(prima ? 'remoMissione' : 'remoAttesa', paroleIsola(i)), altro(s)));
    }
    return via('remo', 'Capitan Remo', (s) => conScelte(dice('remoFatto', paroleIsola(i)), [{
      label: `Riscuoti · ${i.premio}`, act: 'riscuoti', principale: true,
      fai: async () => {
        try {
          const r = await o.api.storiaIsola(), dopo = isolaCorrente(r.lot);
          o.setLot(r.lot);
          o.toast(`+${r.premio} monete · ${nomeIsola(r.isola)} è nel viaggio rapido`, 3500);
          s.poi(dopo ? dice('remoMissione', paroleIsola(dopo)) : dice('remoFine'));
        } catch (e) { s.nota(errore(e)); }
      },
    }]));
  };

  return (chi, poi) => {
    if (parla) { o.porto.avanti(); return true; }
    const lot = o.getLot(), s = lot?.storia;
    if (!lot || !s) return false;
    const passo = passoCorrente(lot), p = passo?.id ?? null;
    if (chi === 'fulvio' && p === 'attrezzo') return via('fulvio', 'Fulvio', regalo);
    if (chi === 'cantiere' && p === 'bepi') return via('bepi', 'Bepi', () => dice('bepi'), () => o.segna('bepi'));
    if (chi === 'cantiere' && !p && !s.barca) {
      return via('bepi', 'Bepi', (sc) => barca(sc, poi), async () => { if (o.getLot()?.storia?.barca) o.toast('La barca è al tuo posto del molo: vai e sali', 4000); });
    }
    // la barca non è ancora il tuo passo: Bepi ti rimanda a quello che c'è da fare, la bottega di sempre (con «Ce l'hai») non si apre
    if (chi === 'cantiere' && passo && !s.barca) return via('bepi', 'Bepi', () => dice('bepiPresto', { passo: passo.come }));
    if (chi === 'furetto' && p === 'vendi') { poi(righe('furetto', {}).dice[0]); return true; }
    if (chi === 'gigi' && p === 'gigi') return via('gigi', 'Gigi il Mozzo', () => dice('gigi'), () => o.segna('gigi'));
    if (chi === 'remo' && s.barca) return remo(lot, () => poi());
    return false;
  };
}
