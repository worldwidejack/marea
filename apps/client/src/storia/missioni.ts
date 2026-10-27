// Le missioni dopo la barca (GDD §9), sulla scheda della storia (ui/guida.ts): «Scopri le isole» e «Dungeon». Capitan Remo, al Porto, ti
// dà un'isola alla volta (ordine di storia.json `isole`): ci vai, provi il suo gioco (una partita, anche persa: lo vede il server), torni da
// lui e riscuoti → premio e viaggio rapido su quell'isola. La freccia e la bussola puntano il gioco dell'isola, poi Remo. Sotto, una riga
// per il dungeon da fare (il più facile non ancora sconfitto, game/ingressi.ts): il premio lo dà il server a dungeon finito. Finite le
// isole, il dungeon diventa il passo della scheda.
import { ISLANDS } from '@marea/content';
import { STORIA } from '@marea/content/storia.ts';
import type { StoriaIsola, StoriaRiga } from '@marea/content/storia.ts';
import { isolaCorrente, isolaProvata } from '@marea/sim/economy/storia.ts';
import type { LotState } from '@marea/sim';
import type { Porto } from '../game/porto.ts';
import type { GameWorld } from '../game/world.ts';
import type { GuidaStep } from '../ui/guida.ts';

/** Una meta della bussola (id e posto). */
export type Meta = { id: string; x: number; z: number };

export const nomeIsola = (id: string): string => ISLANDS.find((i) => i.id === id)?.nome ?? id;
/** Le parole dei dialoghi di Remo e delle righe della scheda per un'isola. */
export const paroleIsola = (i: StoriaIsola): Record<string, string> => ({ isola: nomeIsola(i.isola), cosa: i.cosa });
const riempi = (r: StoriaRiga, v: Record<string, string | number>): StoriaRiga => {
  const f = (t: string) => t.replace(/\{(\w+)\}/g, (_, k: string) => String(v[k] ?? ''));
  return { titolo: f(r.titolo), come: f(r.come) };
};

/** Il gioco di un'isola in bussola: il minigioco (o la Chiesa, l'Orto, il Colosseo), la Funivia per l'Adrenalina; se no l'isola. */
const ALTRA_META: Record<string, string> = { adrenalina: 'funivia' };
function metaIsola(i: StoriaIsola, mete: readonly Meta[]): Meta | null {
  for (const id of [i.gioco.tipo === 'minigioco' ? i.gioco.id : i.gioco.tipo, ALTRA_META[i.isola], 'tema:' + i.isola]) {
    const m = id ? mete.find((x) => x.id === id) : undefined;
    if (m) return m;
  }
  return null;
}

export function passiMissioni(o: {
  world: GameWorld; porto: Porto; getLot(): LotState | null; mete: readonly Meta[];
  /** Il dungeon da fare (null = tutti sconfitti). */
  dungeon(): (Meta & { nome: string }) | null;
  /** Hai già sentito Remo (la prima missione te la dà lui). */
  sentito(): boolean;
}): { steps: GuidaStep[]; nota(): string | null; meta(passo: string | null): string | null } {
  const M = STORIA.missioni, premio = STORIA.dungeon.premio, lot = () => o.getLot();
  const fatte = () => lot()?.storia?.isole ?? [];
  const su = (p: { x: number; z: number } | null) => (p ? { x: p.x, y: o.world.groundY(p.x, p.z) + 2.4, z: p.z } : null);
  /** L'isola `i` è quella della missione ed è provata: si torna da Remo. */
  const torna = (i: StoriaIsola) => isolaCorrente(lot())?.isola === i.isola && isolaProvata(lot());
  const riga = (i: StoriaIsola) => riempi(torna(i) ? M.torna : M.isola, paroleIsola(i));
  const dRiga = () => riempi(M.dungeon, { dungeon: o.dungeon()?.nome ?? '', premio });
  const steps: GuidaStep[] = [
    { id: 'remo', titolo: M.remo.titolo, come: M.remo.come, done: () => o.sentito() || fatte().length > 0 || isolaProvata(lot()), target: () => su(o.porto.dove('remo')) },
    ...STORIA.isole.map((i): GuidaStep => ({
      id: 'isola:' + i.isola,
      get titolo() { return riga(i).titolo; },
      get come() { return riga(i).come; },
      done: () => fatte().includes(i.isola),
      target: () => su(torna(i) ? o.porto.dove('remo') : metaIsola(i, o.mete)),
    })),
    { id: 'dungeon', get titolo() { return dRiga().titolo; }, get come() { return dRiga().come; }, done: () => !o.dungeon(), target: () => su(o.dungeon()) },
  ];
  return {
    steps,
    // finché ci sono isole: il dungeon sta nella riga sotto
    nota: () => { const d = o.dungeon(); return d && lot()?.storia?.dungeon && isolaCorrente(lot()) ? `Dungeon: ${d.nome} · +${premio} monete` : null; },
    meta: (passo) => {
      if (passo === 'dungeon') return o.dungeon()?.id ?? null;
      const i = STORIA.isole.find((x) => 'isola:' + x.isola === passo);
      return i && !torna(i) ? metaIsola(i, o.mete)?.id ?? null : null;
    },
  };
}
