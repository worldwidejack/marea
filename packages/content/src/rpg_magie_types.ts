// Tratti delle magie che valgono SOLO nel dungeon (docs/RPG.md §Magie): in Arena la sim li ignora (`s.pvp`), così le partite restano come sono.
// I numeri stanno in spells.json, campo `tratto`; le regole in packages/sim/src/dungeon/magie_tratti.ts.
export type TrattoMagia = {
  /** Proiettile: dove colpisce (nemico o muro) lascia una chiazza di fuoco di `raggio` m per `secondi` s, `dps` danno al secondo. */
  incendia?: { raggio: number; secondi: number; dps: number };
  /** Proiettile: il nemico colpito vola indietro di `rinculo` m lungo il tiro (capi, torrette e anelli no). */
  rinculo?: number;
  /** Proiettile: attraversa fino a `trapassa` nemici prima di fermarsi. */
  trapassa?: number;
  /** Proiettile: il nemico colpito resta stordito `abbaglia` s (i capi no). */
  abbaglia?: number;
  /** Raggio: ogni `ogni` s lascia in fondo al raggio una pozza che brucia (`raggio` m, `secondi` s, `dps`). */
  pozze?: { ogni: number; raggio: number; secondi: number; dps: number };
  /** Raggio: tenuto sullo stesso nemico, il danno su di lui sale di `perSecondo` (frazione) ogni secondo, fino a `max`. */
  concentra?: { perSecondo: number; max: number };
  /** Bomba: dopo lo scoppio l'area (`frazione` del raggio) brucia per `secondi` s con `dps`. */
  brace?: { frazione: number; secondi: number; dps: number };
  /** Bomba: si divide in `n` braci sparse fino a `sparse` m dal punto di mira, una ogni `ritardo` s; ognuna fa `frazione` del danno in `raggio` m. */
  pioggia?: { n: number; sparse: number; ritardo: number; frazione: number; raggio: number };
  /** Bomba: chi è nell'area è tirato verso il centro di `risucchio` m (capi, torrette e anelli no). */
  risucchio?: number;
  /** Bomba: un secondo colpo nello stesso punto dopo `dopo` s, con `frazione` del danno. */
  secondoGiro?: { dopo: number; frazione: number };
};
