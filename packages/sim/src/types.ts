/** Input di un tick. Assi MONDO: mx = +X, my = +Z (il client ruota il joystick per la yaw della camera). a = azione/accelera, b = secondario/freno.
 *  c (facoltativo, conta solo con b) = «dall'altra parte»: nelle Corse l'oggetto si lancia al contrario di serie (#250). */
export type InputFrame = { mx: number; my: number; a: boolean; b: boolean; c?: boolean };
export const NO_INPUT: InputFrame = { mx: 0, my: 0, a: false, b: false };
export type Vec2 = { x: number; z: number };
