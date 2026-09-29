import type { Resources } from '@marea/content';
export type { Resources };

export type PlacedBuilding = { id: string; building: string; level: number; cell: [number, number]; buffer: number; lastMs: number };
export type PlacedDecor = { id: string; decor: string; cell: [number, number]; rot: number };
export type Construction = { building: string; level: number; endsMs: number; placedId: string };
export type LedgerTotals = { generated: Resources; spent: Resources };
/** Sfide lanciate oggi (giorno UTC = floor(nowMs / 86 400 000)): servono per le sfide gratis del Tavolo. */
export type ChallengeCount = { day: number; used: number };
export type LotState = {
  owner: string;
  version: number;
  nowMs: number;
  resources: Resources;
  buildings: PlacedBuilding[];
  construction: Construction | null;
  decor: PlacedDecor[];
  escrow: Resources;
  ledger: LedgerTotals;
  boostUntilMs: number;
  /** Assente negli stati vecchi: vale { day: 0, used: 0 }. */
  challenges?: ChallengeCount;
};

export const ZERO: Resources = { legno: 0, pietra: 0, perle: 0 };
export const RES_KEYS = ['legno', 'pietra', 'perle'] as const;
export const add = (a: Resources, b: Resources): Resources => ({ legno: a.legno + b.legno, pietra: a.pietra + b.pietra, perle: a.perle + b.perle });
export const sub = (a: Resources, b: Resources): Resources => ({ legno: a.legno - b.legno, pietra: a.pietra - b.pietra, perle: a.perle - b.perle });
export const scale = (a: Resources, k: number): Resources => ({ legno: Math.floor(a.legno * k), pietra: Math.floor(a.pietra * k), perle: Math.floor(a.perle * k) });
export const total = (a: Resources): number => a.legno + a.pietra + a.perle;
export const geq = (a: Resources, b: Resources): boolean => a.legno >= b.legno && a.pietra >= b.pietra && a.perle >= b.perle;
/** Quanto manca per coprire `cost` con `have` (componenti ≥ 0). */
export const missing = (have: Resources, cost: Resources): Resources => ({
  legno: Math.max(0, cost.legno - have.legno), pietra: Math.max(0, cost.pietra - have.pietra), perle: Math.max(0, cost.perle - have.perle),
});

export type EconomyErrorCode = 'risorse' | 'cantiere' | 'requisito' | 'cella' | 'livello' | 'sconosciuto' | 'unico' | 'posta' | 'tetto' | 'escrow';
export class EconomyError extends Error {
  code: EconomyErrorCode;
  manca: Resources | undefined;
  constructor(code: EconomyErrorCode, msg: string, manca?: Resources) {
    super(msg);
    this.name = 'EconomyError';
    this.code = code;
    this.manca = manca;
  }
}
