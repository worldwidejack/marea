// Le missioni dopo la barca (GDD §9), sulla scheda della storia (ui/guida.ts): «Scopri le isole» e «Dungeon». Capitan Remo, al Porto, ti
// chiede di provare il gioco di `STORIA.isoleDaProvare` isole a tua scelta (una partita, anche persa: lo vede il server, che paga l'isola e
// la mette nel viaggio rapido; alla fine le apre tutte). La freccia punta il molo dell'isola aperta più vicina che non hai ancora provato,
// poi il suo gioco una volta a terra. Sotto, una riga per il dungeon da fare (il più facile non ancora sconfitto, game/ingressi.ts): il
// premio lo dà il server a dungeon finito. Finite le isole, il dungeon diventa il passo della scheda.
import { ISLANDS } from '@marea/content';
import { STORIA } from '@marea/content/storia.ts';
import type { StoriaIsola, StoriaRiga } from '@marea/content/storia.ts';
import { ISOLE_DA_PROVARE, isoleDaProvare, missioneIsole } from '@marea/sim/economy/storia.ts';
import { landingSpot, newBoat } from '@marea/sim';
import type { LotState } from '@marea/sim';
import type { Porto } from '../game/porto.ts';
import { temaAperta } from '../game/temi.ts';
import type { GameWorld } from '../game/world.ts';
import type { GuidaStep } from '../ui/guida.ts';

/** Una meta della bussola (id e posto). */
export type Meta = { id: string; x: number; z: number };

export const nomeIsola = (id: string): string => ISLANDS.find((i) => i.id === id)?.nome ?? id;
/** Le parole dei dialoghi di Remo e della riga della scheda: quante isole servono, quante fatte, quante mancano. */
export function paroleIsole(lot: LotState | null): Record<string, string | number> {
  const fatte = Math.min(missioneIsole(lot)?.provate.length ?? 0, ISOLE_DA_PROVARE);
  return { fatte, servono: ISOLE_DA_PROVARE, manca: ISOLE_DA_PROVARE - fatte };
}
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
  /** Hai già sentito Remo (la missione te la dà lui). */
  sentito(): boolean;
}): { steps: GuidaStep[]; nota(): string | null; meta(passo: string | null): string | null } {
  const M = STORIA.missioni, premio = STORIA.dungeon.premio, lot = () => o.getLot();
  const su = (p: { x: number; z: number } | null) => (p ? { x: p.x, y: o.world.groundY(p.x, p.z) + 2.4, z: p.z } : null);
  const riga = () => riempi(M.isola, paroleIsole(lot()));
  const dRiga = () => riempi(M.dungeon, { dungeon: o.dungeon()?.nome ?? '', premio });
  const places = new Map(o.world.archipelago.places.map((pl) => [pl.island, pl] as const));
  const moli = new Map<string, { x: number; z: number }>();
  for (const pl of o.world.archipelago.places) {
    const d = landingSpot(newBoat(pl.boat.x, pl.boat.z), o.world.map) ?? pl.boat;
    moli.set(pl.island, d);
  }
  /** Dove sei: l'avatar a piedi, se no la barca. */
  const qui = () => (o.world.mode === 'walk' ? o.world.avatar.state : o.world.boat.state);
  /** L'avatar è a terra sull'isola (ha attraccato al molo). Per la Laguna la Regata si fa in barca al molo. */
  const attraccato = (isola: string): boolean => {
    if (o.world.mode === 'walk') {
      const a = o.world.avatar.state;
      return o.world.archipelago.placeAt(a.x, a.z)?.island === isola;
    }
    if (isola === 'laguna') {
      const m = moli.get(isola);
      if (!m) return false;
      const b = o.world.boat.state;
      return Math.hypot(b.x - m.x, b.z - m.z) < 16;
    }
    return false;
  };
  /** L'isola da indicare: quella dove sei (se è da provare), se no la più vicina fra le aperte da provare (o fra tutte, se nessuna è aperta). */
  const scelta = (): StoriaIsola | null => {
    const da = isoleDaProvare(lot());
    const li = da.find((i) => attraccato(i.isola));
    if (li) return li;
    const aperte = da.filter((i) => !places.get(i.isola)?.tema || temaAperta(i.isola)), fra = aperte.length ? aperte : da, p = qui();
    let best: StoriaIsola | null = null, bd = Infinity;
    for (const i of fra) {
      const m = moli.get(i.isola);
      const d = m ? Math.hypot(m.x - p.x, m.z - p.z) : Infinity;
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  };
  const steps: GuidaStep[] = [
    { id: 'remo', titolo: M.remo.titolo, come: M.remo.come, done: () => o.sentito() || (missioneIsole(lot())?.provate.length ?? 0) > 0, target: () => su(o.porto.dove('remo')) },
    {
      id: 'isole',
      get titolo() { return riga().titolo; },
      get come() { return riga().come; },
      done: () => !!missioneIsole(lot())?.finita,
      target: () => { const i = scelta(); return i ? su(attraccato(i.isola) ? metaIsola(i, o.mete) : (moli.get(i.isola) ?? metaIsola(i, o.mete))) : null; },
    },
    { id: 'dungeon', get titolo() { return dRiga().titolo; }, get come() { return dRiga().come; }, done: () => !o.dungeon(), target: () => su(o.dungeon()) },
  ];
  return {
    steps,
    // finché ci sono isole: il dungeon sta nella riga sotto
    nota: () => { const d = o.dungeon(), m = missioneIsole(lot()); return d && lot()?.storia?.dungeon && m && !m.finita ? `Dungeon: ${d.nome} · +${premio} monete` : null; },
    meta: (passo) => {
      if (passo === 'dungeon') return o.dungeon()?.id ?? null;
      if (passo !== 'isole') return null;
      const i = scelta();
      return i && attraccato(i.isola) ? metaIsola(i, o.mete)?.id ?? null : null;
    },
  };
}
