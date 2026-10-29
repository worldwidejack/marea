import type { Flags } from '../flags.ts';
/** Scala di resa: 0,5 = metà risoluzione (look pixel + prestazioni). Con la grafica bassa 0,35: su telefono meno della metà dei pixel. */
export function pixelScale(flags: Flags, bassa = false): number { return bassa ? 0.35 : flags.quality === 'low' ? 0.4 : 0.5; }
