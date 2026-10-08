export const TICK_HZ = 60;
export const DT = 1 / TICK_HZ;
export const SIM_VERSION = 1;
/** Bordo del mondo (#5): fascia (m) dentro il bordo dove una corrente riporta la barca verso le isole, spinta massima (m/s) e freno (1/s) per chi punta fuori. */
export const BORDO = { fascia: 24, corrente: 6, freno: 1.5 } as const;
