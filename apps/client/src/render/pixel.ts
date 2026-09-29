import type { Flags } from '../flags.ts';
/** Scala di resa: 0,5 = metà risoluzione (look pixel + prestazioni). */
export function pixelScale(flags: Flags): number { return flags.quality === 'low' ? 0.4 : 0.5; }
