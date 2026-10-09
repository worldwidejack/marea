// Segnalino del navigatore (#144): toccando un punto della mappa grande (ui/minimappa.ts) ci metti un segnalino; toccando l'icona di una meta
// il segnalino si aggancia a lei e ne prende il nome. Diventa la meta del navigatore (`CompassTarget.navi`): riga in cima a METE con distanza
// e freccia, freccia sullo schermo anche se ci sono altre mete accese, segno rosso in mappa e minimappa. Uno solo; quando ci arrivi sparisce.
// Resta su questo dispositivo (localStorage), come le altre scelte delle mete.
import type { CompassTarget } from './compass.ts';
import { registerStateProvider, registerTestHook } from '../test/testapi.ts';

const STORE = 'marea:segno';
/** Entro questa distanza (m) sei arrivato e il segnalino si toglie; vale solo dopo esserne stato più lontano (messo sotto i piedi, resta). */
export const ARRIVATO_M = 10;

/** `su`/`nome`: la meta a cui è agganciato (id e nome), se l'hai scelto toccandone l'icona. */
export type PuntoSegno = { x: number; z: number; su?: string; nome?: string };
export type Segno = {
  /** La meta per la bussola: segue il segnalino e c'è solo quando è fissato. */
  readonly target: CompassTarget;
  get(): PuntoSegno | null;
  set(p: PuntoSegno | null): void;
  /** Ogni frame: il segnalino a cui sei appena arrivato (e che si è tolto), se no null. */
  update(me: { x: number; z: number }): PuntoSegno | null;
};

const load = (): PuntoSegno | null => {
  try {
    const v = JSON.parse(localStorage.getItem(STORE) ?? 'null') as PuntoSegno | null;
    if (!v || typeof v !== 'object' || !Number.isFinite(v.x) || !Number.isFinite(v.z)) return null;
    return { x: v.x, z: v.z, ...(typeof v.su === 'string' ? { su: v.su } : {}), ...(typeof v.nome === 'string' ? { nome: v.nome } : {}) };
  } catch { return null; }
};
const save = (p: PuntoSegno | null) => { try { if (p) localStorage.setItem(STORE, JSON.stringify(p)); else localStorage.removeItem(STORE); } catch { /* storage bloccato: vale fino a fine sessione */ } };

export function createSegno(): Segno {
  let cur = load(), lontano = false;
  const set = (p: PuntoSegno | null) => { cur = p ? { ...p } : null; lontano = false; save(cur); };
  const target: CompassTarget = {
    id: 'segno', icon: 'segno', navi: true,
    get label() { return cur?.nome ?? 'Segnalino'; },
    get x() { return cur?.x ?? 0; },
    get z() { return cur?.z ?? 0; },
    show: () => cur !== null,
    togli: () => set(null),
  };
  registerStateProvider('segno', () => (cur ? { ...cur } : null));
  registerTestHook('segno', (x, z) => { set(x === null || x === undefined ? null : { x: Number(x), z: Number(z) }); return cur; });
  return {
    target,
    get: () => cur,
    set,
    update(me) {
      if (!cur) return null;
      const d = Math.hypot(cur.x - me.x, cur.z - me.z);
      if (d > ARRIVATO_M + 5) lontano = true;
      else if (lontano && d < ARRIVATO_M) { const p = cur; set(null); return p; }
      return null;
    },
  };
}
