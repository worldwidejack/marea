// Generatore deterministico sfc32 con seed numerico o stringa; fork(label) deriva un sotto-flusso indipendente.
export type Rng = {
  readonly seed: number;
  next(): number;
  int(min: number, max: number): number;
  pick<T>(a: readonly T[]): T;
  fork(label: string): Rng;
};

export function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function createRng(seed: number | string): Rng {
  const s = (typeof seed === 'string' ? hashStr(seed) : Math.floor(seed)) >>> 0;
  let a = (s ^ 0x9e3779b9) >>> 0;
  let b = (s ^ 0x243f6a88) >>> 0;
  let c = (s ^ 0xb7e15162) >>> 0;
  let d = ((s ^ 0xdeadbeef) | 1) >>> 0;
  const next = (): number => {
    const t = (((a + b) | 0) + d) | 0;
    d = (d + 1) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
  for (let i = 0; i < 12; i++) next();
  const rng: Rng = {
    seed: s,
    next,
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    pick: (arr) => {
      const v = arr[Math.floor(next() * arr.length)];
      if (v === undefined) throw new Error('pick su array vuoto');
      return v;
    },
    fork: (label) => createRng(hashStr(`${s}:${label}`)),
  };
  return rng;
}

/**
 * Generatore con tutto lo stato in un intero (mulberry32, solo interi a 32 bit: uguale su ogni motore), per le sim che tengono
 * lo stato della partita serializzabile e confrontabile con un hash (Difesa, Sparo): `s.caso` è il seme e avanza a ogni numero.
 */
export function casoIntero(s: { caso: number }): number {
  s.caso = (s.caso + 0x6d2b79f5) >>> 0;
  let t = s.caso;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
