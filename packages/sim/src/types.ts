/** Input di un tick. Assi MONDO: mx = +X, my = +Z (il client ruota il joystick per la yaw della camera). a = azione/accelera, b = secondario/freno. */
export type InputFrame = { mx: number; my: number; a: boolean; b: boolean };
export const NO_INPUT: InputFrame = { mx: 0, my: 0, a: false, b: false };
export type Vec2 = { x: number; z: number };
