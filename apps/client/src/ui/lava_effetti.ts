// Fuga dalla lava, gli effetti del client a ogni tick (dopo la sim): polvere, scintille, numeri che volano, scosse, lampi, suoni e vibrazione.
// Niente di tutto questo entra nella partita: il server rigioca solo gli input. Il feeling sta qui quanto nella fisica.
import { MINIGAMES_CFG } from '@marea/content';
import type { LavaState } from '@marea/sim/minigames/lava.ts';
import { suona } from '../audio/ponte.ts';
import { hash } from './pixel_kit.ts';
import type { Col } from './pixel_kit.ts';
import type { ScenaLava } from './lava_vista.ts';

const CFG = MINIGAMES_CFG.lava;
const COSA_COL: Record<string, Col> = { ossidiana: 'viola', scintilla: 'giallo', rubino: 'rosaNeon' };

/** Prima di ogni tick: dove sei e quanto cadevi, per disegnare a metà tra due tick e per sapere quanto forte atterri. */
export function primaPassoLava(s: LavaState, sc: ScenaLava): void { sc.px = s.c.x; sc.py = s.c.y; sc.vyPrima = s.c.vy; }

export function effettiLava(s: LavaState, sc: ScenaLava): void {
  const c = s.c, u = s.ultimo, tk = s.tick;
  const getta = (n: number, x: number, y: number, vx: number, vy: number, col: Col, vita: number, g = 0.05, sp = 1) => {
    for (let i = 0; i < n && sc.part.length < 260; i++) {
      const h = hash(tk, i + Math.round(x));
      sc.part.push({ x: x + ((h % 5) - 2) * sp, y, vx: vx + (((h >> 4) % 9) - 4) * 0.12 * sp, vy: vy - ((h >> 8) % 4) * 0.12, t: 0, vita: vita + ((h >> 12) % 8), c: col, g });
    }
  };
  const vibra = (ms: number) => { try { if (navigator.userActivation?.hasBeenActive) navigator.vibrate?.(ms); } catch { /* telefono senza vibrazione */ } };
  const testo = (s2: string, col: Col) => sc.fx.push({ x: c.x, y: c.y - 20, t: 0, s: s2, c: col });

  if (u.salto) { sc.tSalto = tk; getta(4, c.x - 2, c.y, -0.5, -0.3, 'pietraScura', 14); suona('salto'); }
  if (u.atterra && sc.vyPrima > 2.2) { sc.tAtterra = tk; getta(3, c.x - 3, c.y, 0, -0.4, 'pietra', 10, 0.05, 2); suona('atterra', Math.min(1, sc.vyPrima / 6)); }
  if (u.spin) { sc.tSpin = tk; getta(6, c.x, c.y - 6, 0, 0.2, 'pietraChiara', 12, 0.02, 3); suona('giravolta'); }
  if (u.scavalco) { getta(4, c.x, c.y, -0.3, -0.3, 'pietra', 12); suona('scavalco'); }
  if (u.bello) { testo(`+${CFG.punti.scavalcoBello}!`, 'giallo'); getta(5, c.x, c.y - 4, 0, -0.5, 'giallo', 16, 0.04, 2); suona('moneta', 0.6); }
  if (u.aggancio) getta(3, c.x + 4, c.y - 6, 0, -0.2, 'pietra', 10);
  if (u.nemico) {
    testo(`+${CFG.punti.nemico[Math.min(u.nemico, CFG.punti.nemico.length) - 1]}`, 'arancio'); sc.scuoti = Math.max(sc.scuoti, 4);
    getta(10, c.x, c.y, 0, -1.2, 'arancio', 22, 0.08, 3); suona('calpesta'); vibra(12);
  }
  for (const k of u.presi) {
    getta(3, c.x, c.y - 6, 0, -0.4, COSA_COL[k]!, 14, 0.02, 2);
    suona(k === 'ossidiana' ? 'raccolto' : 'moneta', k === 'rubino' ? 1 : 0.5);
    if (k !== 'ossidiana') testo(`+${CFG.punti[k]}`, COSA_COL[k]!);
  }
  if (u.colpo) {
    sc.tColpo = tk; sc.scuoti = 12; sc.lampo = 7; sc.lampoC = 'rosso'; testo(`-${CFG.colpo.punti}`, 'rosso');
    getta(10, c.x, c.y - 6, 0, -0.9, 'arancio', 26, 0.07, 3); suona('colpo_preso'); vibra(45);
  }
  if (u.bagno) {
    if (u.bagno === 2) { sc.tColpo = tk; sc.scuoti = 14; sc.lampo = 8; sc.lampoC = 'arancio'; testo(`-${CFG.bagno.punti}`, 'rosso'); vibra(70); }
    getta(14, c.x, 0, 0, -2, 'giallo', 34, 0.1, 3); suona('sfrigola');
  }
  if (c.margine < CFG.muro.margine * 0.45 && !s.done && tk - sc.battito > 42) { sc.battito = tk; suona('tuono', 0.15); } // il muro è vicino: rombo
  if (tk % 5 === 0) getta(1, c.x + ((hash(tk, 3) % 260) - 60), 0, 0, -0.5, hash(tk, 4) % 2 ? 'arancio' : 'giallo', 40, -0.004, 1); // scintille dalla lava
  if (s.done && s.fine === 'bruciato' && tk % 2 === 0) getta(3, c.x, c.y - 6, 0.2, -1, 'arancio', 30, 0.05, 3);

  for (const p of sc.part) { p.t++; p.x += p.vx; p.y += p.vy; p.vy += p.g; }
  sc.part = sc.part.filter((p) => p.t < p.vita && p.y < 6);
  for (const e of sc.fx) e.t++;
  sc.fx = sc.fx.filter((e) => e.t < 50);
  if (sc.scuoti > 0) sc.scuoti--;
  if (sc.lampo > 0) sc.lampo--;
}
