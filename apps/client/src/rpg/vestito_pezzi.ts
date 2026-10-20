// I pezzi dei vestiti (ossa, scatole, tinte) che servono sia all'equipaggiamento del GDR (vestito.ts) sia ai costumi dei Templari
// (vestito_templari.ts): stanno qui così i due file non si importano a vicenda.
export type Osso = 'Hips' | 'Spine' | 'UpperArm.L' | 'UpperArm.R' | 'LowerArm.L' | 'LowerArm.R' | 'UpperLeg.L' | 'UpperLeg.R' | 'LowerLeg.L' | 'LowerLeg.R';
export type V3 = [number, number, number];
/** b = base (il colore del materiale), d = scuro, l = chiaro, t = finitura. */
export type Tinta = 'b' | 'd' | 'l' | 't';
export type Hue = Record<Tinta, string>;
/** Una scatola: osso, dimensioni, centro, tinta, rotazione (Euler XYZ, rad) attorno al suo centro. */
export type Pz = { o: Osso; s: V3; at: V3; c: Tinta; r?: V3 };
export const lato = (b: 'UpperArm' | 'LowerArm' | 'UpperLeg' | 'LowerLeg', sx: number): Osso => `${b}.${sx > 0 ? 'R' : 'L'}` as Osso;
export const SX = [-1, 1] as const;
/** Pezzo sull'avambraccio a quota `y`: nel modello l'avambraccio parte dal gomito (±0,215; 0,965) e scende aprendosi di 16° e andando un po' avanti. */
export const avamb = (s: number, y: number, w: number, h: number, d: number, c: Tinta): Pz => {
  const k = 0.965 - y;
  return { o: lato('LowerArm', s), s: [w, h, d], at: [s * (0.215 + 0.28 * k), y, -0.17 * k], c, r: [0.17, 0, s * 0.273] };
};
