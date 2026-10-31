// La storia delle prime ore nel client (GDD §9, stato in @marea/sim/economy/storia.ts): chunk caricato da main.ts dopo l'avvio. Parte da
// sola se storia.json `attiva` (coi test solo con ?storia=1, che la fa partire anche spenta): segna l'inizio sul server, poi il naufragio
// (scena a parte), il risveglio con Nonna Pina, e da lì il tutorial guidato sulla scheda obbligatoria (passi.ts: casa, ARREDA, il regalo
// di Fulvio, il primo bottino, il Furetto, Bepi, Gigi) fino alla barca da comprare; poi le missioni (missioni.ts: le isole di Capitan Remo e
// i dungeon) finché non sono finite. I personaggi parlano coi dialoghi della storia (dialoghi.ts, agganciati con avvio/prima.ts). Ogni passo
// fatto lo segna il server: ricaricando la pagina si riparte dal passo dove eri.
import { STORIA } from '@marea/content/storia.ts';
import { isolaCorrente, passoCorrente } from '@marea/sim/economy/storia.ts';
import type { LotState } from '@marea/sim';
import type { BarcaLook, Look } from '@marea/protocol';
import { FLAGS } from '../flags.ts';
import type { Api } from '../net/api.ts';
import type { Botteghe } from '../game/botteghe.ts';
import type { Negozio } from '../game/negozio.ts';
import type { GameWorld } from '../game/world.ts';
import type { Porto } from '../game/porto.ts';
import type { Loader } from '../render/loader.ts';
import type { Renderer } from '../render/scene.ts';
import type { Hud } from '../ui/hud.ts';
import { createGuida } from '../ui/guida.ts';
import type { Guida } from '../ui/guida.ts';
import { setPrimaLaStoria } from '../avvio/prima.ts';
import { registerStateProvider } from '../test/testapi.ts';
import { creaDialoghi } from './dialoghi.ts';
import { passiMissioni } from './missioni.ts';
import type { Meta } from './missioni.ts';
import { creaNaufragio, NAUFRAGIO_NERO } from './naufragio.ts';
import type { Naufragio } from './naufragio.ts';
import { creaNero } from './nero.ts';
import type { Nero } from './nero.ts';
import { passiStoria } from './passi.ts';
import { risveglio } from './risveglio.ts';

export type Storia = {
  /** In scena (il naufragio): il mondo di superficie sta fermo e la resa la fa la storia. */
  readonly attiva: boolean;
  update(dt: number): void;
  /** Cosa dire a chi vuole la barca e non ce l'ha: il passo che c'è da fare, e solo a fine tutorial Bepi. */
  senzaBarca(): string;
};
export type StoriaOpts = {
  renderer: Renderer; loader: Loader; world: GameWorld; root: HTMLElement; hud: Hud; api: Api; porto: Porto;
  negozio(): Negozio | null; botteghe(): Botteghe | null;
  nome: string; look: Look; barca: BarcaLook;
  getLot(): LotState | null; setLot(l: LotState): void;
  /** Dentro casa tua. */
  inCasa(): boolean;
  /** C'è qualcosa sopra (un pannello, la schermata iniziale): la storia aspetta. */
  occupato(): boolean;
  /** Un pannello, un gioco, il dungeon: la scheda e la freccia si tolgono. */
  coperto(): boolean;
  /** Le mete della bussola (i giochi delle isole) e la meta da evidenziare (null = nessuna). */
  mete: readonly Meta[]; focus(id: string | null): void;
  /** Il dungeon più facile non ancora sconfitto (null = tutti). */
  dungeon(): (Meta & { nome: string }) | null;
};

/** Ogni quanto si rilegge il lotto anche se non è cambiato niente qui (s), per i passi che vede il server. */
const RILEGGI_S = 15;
/** Quanto resta su la scheda a passi finiti (ms), col suo «Fatto!». */
const FINE_MS = 8000;

export function createStoria(o: StoriaOpts): Storia {
  const veloce = FLAGS.test ? 4 : 1;
  const aspetta = (ms: number) => new Promise<void>((r) => setTimeout(r, ms / veloce));
  const finche = (fatto: () => boolean) => new Promise<void>((r) => { const k = setInterval(() => { if (fatto()) { clearInterval(k); r(); } }, 200); });
  let scena: Naufragio | null = null, nero: Nero | null = null, fase = 'attesa';
  registerStateProvider('storia', () => ({ fase, passo: passoCorrente(o.getLot())?.id ?? null, barca: !!o.getLot()?.storia?.barca, isola: isolaCorrente(o.getLot())?.isola ?? null, t: scena?.t ?? null }));
  const segna = async (id: string) => { const l = await o.api.storia('passo', { id }); o.setLot(l); return l; };
  // la prima isola te la dà Remo: sentito una volta, su questo dispositivo (se si perde, Remo la ripete)
  const chiaveRemo = `marea:storia:remo:${o.nome}`;
  let sentito = (() => { try { return localStorage.getItem(chiaveRemo) === '1'; } catch { return false; } })();
  const remo = { sentito: () => sentito, senti: () => { sentito = true; try { localStorage.setItem(chiaveRemo, '1'); } catch { /* storage bloccato */ } } };

  /** Una scheda obbligatoria (ui/guida.ts) aggiornata a ogni frame finché `finita` (e un po' dopo, per il «Fatto!»). */
  function scheda(g: Guida, finita: () => boolean, ogniFrame?: () => void): Promise<void> {
    return new Promise((fatto) => {
      let fine = 0;
      const giro = (now: number) => {
        g.update(now / 1000); ogniFrame?.();
        if (finita()) fine ||= now + FINE_MS;
        if (fine && now > fine) { fatto(); return; }
        requestAnimationFrame(giro);
      };
      requestAnimationFrame(giro);
    });
  }
  const comune = { root: o.root, camera: o.renderer.camera, canvas: o.renderer.gl.domElement, hidden: () => o.coperto() || !!scena };

  /** Il tutorial: il passo della casa lo segna qui, quelli dei personaggi i dialoghi; per quelli che vede il server
   *  (ARREDA, il bottino, le monete) si rilegge il lotto quando cambia qui (un mobile posato, un pesce preso) o ogni tanto. */
  async function tutorial(lot0: LotState): Promise<void> {
    let lot = lot0, visto = -1, letto = performance.now();
    while (!lot.storia?.barca) {
      const p = passoCorrente(lot);
      fase = p?.id ?? 'barca';
      if (p?.id === 'casa') {
        await finche(() => o.inCasa());
        lot = await segna('casa');
        continue;
      }
      await new Promise<void>((r) => setTimeout(r, 700));
      lot = o.getLot() ?? lot;
      const serve = p && p.tipo !== 'client' && p.tipo !== 'attrezzo';
      if (serve && (lot.version !== visto || performance.now() - letto > RILEGGI_S * 1000)) {
        letto = performance.now();
        try { lot = await o.api.lot(); o.setLot(lot); visto = lot.version; } catch { /* la rete: si riprova al prossimo giro */ }
      }
    }
  }

  /** Le missioni: la scheda finché le isole e i dungeon non sono finiti; un toast quando il server paga un dungeon. */
  async function missioni(): Promise<void> {
    fase = 'missioni';
    const m = passiMissioni({ world: o.world, porto: o.porto, getLot: o.getLot, mete: o.mete, dungeon: o.dungeon, sentito: remo.sentito });
    const g = createGuida({ ...comune, steps: m.steps, nota: m.nota, onFocus: (id) => o.focus(m.meta(id)), nome: 'Missioni', id: 'mzMissioni', stato: 'missioniGuida', fine: STORIA.missioni.fine });
    let pagati = o.getLot()?.storia?.dungeon?.length ?? 0;
    await scheda(g, () => g.current() === null, () => {
      const n = o.getLot()?.storia?.dungeon?.length ?? 0;
      if (n > pagati) o.hud.toast(`Missione Dungeon: +${(n - pagati) * STORIA.dungeon.premio} monete`, 3500);
      pagati = n;
    });
    o.focus(null);
    fase = 'fatta';
  }

  async function corri(): Promise<void> {
    if (!STORIA.attiva && !FLAGS.storia) return;
    await finche(() => !o.occupato());
    let lot = o.getLot();
    if (!lot) return;
    if (lot.storia?.barca && !isolaCorrente(lot) && !o.dungeon()) { fase = 'fatta'; return; } // tutto fatto: niente da fare
    if (!lot.storia) { lot = await o.api.storia('inizia'); o.setLot(lot); }
    nero = creaNero(o.root, veloce);
    if (passoCorrente(lot)?.id === 'naufragio') {
      fase = 'naufragio';
      const n = await creaNaufragio({ renderer: o.renderer, loader: o.loader, root: o.root, look: o.look, barca: o.barca, veloce });
      scena = n;
      await finche(() => n.t >= NAUFRAGIO_NERO);
      await nero.chiudi(STORIA.passi[0]!.come);
      await n.fine; scena = null;
      await aspetta(1500);
      lot = await segna('naufragio');
    }
    if (passoCorrente(lot)?.id === 'pina') {
      fase = 'risveglio';
      await nero.chiudi('');
      await risveglio({ world: o.world, porto: o.porto, nero, nome: o.nome, aspetta });
      lot = await segna('pina');
      o.hud.toast('Nonna Pina ti ha dato un lume: è nel magazzino di casa', 3500);
    }
    setPrimaLaStoria(creaDialoghi({ porto: o.porto, api: o.api, nome: o.nome, getLot: o.getLot, setLot: o.setLot, segna, toast: (t, ms) => o.hud.toast(t, ms), remo }));
    if (!lot.storia?.barca) {
      const g = createGuida({
        ...comune, steps: passiStoria({ world: o.world, porto: o.porto, getLot: o.getLot, negozio: o.negozio, botteghe: o.botteghe, inCasa: o.inCasa }),
        nome: 'Storia', id: 'mzStoria', stato: 'storiaGuida', fine: ['La barca è tua', 'È al tuo posto del molo: sali e prendi il largo.'],
      });
      const finita = scheda(g, () => !!o.getLot()?.storia?.barca);
      await tutorial(lot);
      fase = 'barca fatta';
      await finita;
    }
    await missioni();
  }
  void corri().catch((e: unknown) => { fase = 'errore'; scena = null; void nero?.apri(); console.warn('[marea] storia', e); o.hud.toast(e instanceof Error ? e.message : 'La storia non è partita: ricarica la pagina', 4000); });

  return {
    get attiva() { return !!scena; },
    update(dt) { scena?.update(dt); },
    senzaBarca() {
      const p = passoCorrente(o.getLot());
      return p ? `Non hai ancora la barca. Prima: ${p.come}` : 'Non hai una barca: Bepi al Cantiere te la vende';
    },
  };
}
