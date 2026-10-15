// Il giocatore dello sparatutto (#355): corsa, passo, accucciato, salto (su casse e barriere ci si sale saltando, sulla base della gru
// col gradino), mira col tasto destro; tre armi con caricatore, ricarica (il pompa un colpo alla volta, e sparare la interrompe),
// cambio d'arma, rinculo che sale coi colpi di fila e torna giù quando smetti, dispersione che cresce muovendosi, in aria e sparando.
// La vita torna da sola dopo qualche secondo senza colpi (come in COD).
import { SPARO } from '@marea/content/sparo.ts';
import { DT } from '../constants.ts';
import { cos, sin } from '../trig.ts';
import type { SMappa } from './mappa.ts';
import { muovi, suolo } from './mappa.ts';
import { spara } from './colpi.ts';
import type { SInput, SState } from './stato.ts';
import { GRADI, caso, occhi, secTick } from './stato.ts';

/** Si guarda su e giù fino a ~83°. */
export const PITCH_MAX = 1.45;

/** Mezzo angolo del cono di dispersione adesso (rad): per il mirino del client e per i colpi. */
export function conoAdesso(s: SState): number {
  const g = s.g, A = SPARO.armi[g.arma - 1]!, D = A.dispersione;
  const vel = Math.sqrt(g.vx * g.vx + g.vz * g.vz);
  let gradi = (g.mira ? D.mira : D.fianco) + D.muovi * Math.min(1, vel / SPARO.giocatore.passo) * (g.mira ? 0.35 : 1) + (g.aTerra ? 0 : D.aria);
  if (g.giu) gradi *= 0.8;
  return gradi * GRADI + g.dispersione;
}

export function passoGiocatore(s: SState, m: SMappa, inp: SInput): void {
  const g = s.g, C = SPARO.giocatore;
  if (g.morto) { g.vx = 0; g.vz = 0; return; }
  g.yaw = inp.yaw;
  g.pitch = inp.pitch > PITCH_MAX ? PITCH_MAX : inp.pitch < -PITCH_MAX ? -PITCH_MAX : inp.pitch;
  g.giu = inp.giu;

  // ---- arma in mano: cambio, ricarica ----
  if (inp.arma >= 1 && inp.arma <= SPARO.armi.length && inp.arma !== g.arma) {
    g.arma = inp.arma; g.estrae = s.tick + secTick(SPARO.armi[g.arma - 1]!.estrai); g.ricarica = 0;
    s.ev.push({ t: 'cambio', arma: g.arma });
  }
  if (g.estrae && s.tick >= g.estrae) g.estrae = 0;
  const A = SPARO.armi[g.arma - 1]!, st = g.armi[g.arma - 1]!;
  if (g.ricarica && s.tick >= g.ricarica) {
    if (A.ricaricaUno) {
      st.colpi++; st.riserva--;
      g.ricarica = st.colpi < A.caricatore && st.riserva > 0 ? s.tick + secTick(A.ricarica) : 0;
    } else {
      const n = Math.min(A.caricatore - st.colpi, st.riserva);
      st.colpi += n; st.riserva -= n; g.ricarica = 0;
    }
    s.ev.push({ t: 'carico', arma: g.arma });
  }
  const ricarica = (): void => {
    if (g.ricarica || g.estrae || st.colpi >= A.caricatore || st.riserva <= 0) return;
    g.ricarica = s.tick + secTick(A.ricarica);
    s.ev.push({ t: 'ricarica', arma: g.arma });
  };
  if (inp.ricarica) ricarica();

  // ---- corsa e mira: in mira non si corre, si corre solo in avanti, accucciati no, sparando no ----
  g.mira = inp.mira && !g.estrae;
  g.corre = !g.mira && inp.corsa && inp.my > 0.3 && !g.giu && !inp.fuoco && g.aTerra;

  // ---- movimento a terra (in aria si controlla poco) ----
  let v = g.giu ? C.accucciato : g.corre ? C.corsa : C.passo;
  if (g.mira) v *= C.inMira;
  v *= A.velocita;
  const sy = sin(g.yaw), cy = cos(g.yaw);
  let wx = cy * inp.mx - sy * inp.my, wz = -sy * inp.mx - cy * inp.my;
  const wl = Math.sqrt(wx * wx + wz * wz);
  if (wl > 1) { wx /= wl; wz /= wl; }
  const acc = (wl > 0.01 ? C.accelera : C.frena) * (g.aTerra ? 1 : C.inAria) * DT;
  let ddx = wx * v - g.vx, ddz = wz * v - g.vz;
  const dl = Math.sqrt(ddx * ddx + ddz * ddz);
  if (dl > acc) { ddx *= acc / dl; ddz *= acc / dl; }
  g.vx += ddx; g.vz += ddz;
  const p = { x: g.x, z: g.z };
  muovi(m, p, g.vx * DT, g.vz * DT, C.raggio, g.y);
  g.vx = (p.x - g.x) / DT; g.vz = (p.z - g.z) / DT; // contro un muro la velocità si perde
  g.x = p.x; g.z = p.z;

  // ---- salto, gradini, gravità ----
  if (inp.salto && !g.saltoPrima && g.aTerra && !g.giu) { g.vy = C.salto; g.aTerra = false; s.ev.push({ t: 'salto' }); }
  g.saltoPrima = inp.salto;
  const q = suolo(m, g.x, g.z, C.raggio, g.y);
  if (g.y < q) { g.y = q; if (g.vy < 0) g.vy = 0; } // gradino o scavalco
  if (g.vy > 0 || g.y > q) {
    g.vy -= C.gravita * DT; g.y += g.vy * DT;
    if (g.y <= q) {
      if (g.vy < -6) s.ev.push({ t: 'atterra', forte: Math.round(-g.vy * 10) / 10 });
      g.y = q; g.vy = 0; g.aTerra = true;
    } else g.aTerra = false;
  } else { g.vy = 0; g.aTerra = true; }

  // ---- fuoco: le automatiche tenendo premuto, le altre a ogni pressione ----
  const fronte = inp.fuoco && (A.auto || !g.grilletto);
  if (fronte && !g.estrae && s.tick >= g.pronto) {
    if (A.ricaricaUno && g.ricarica && st.colpi > 0) g.ricarica = 0; // col pompa si spara anche a metà ricarica
    if (!g.ricarica) {
      if (st.colpi > 0) {
        const cono = conoAdesso(s);
        st.colpi--;
        g.pronto = s.tick + secTick(A.cadenza);
        g.ultimoSparo = s.tick;
        spara(s, m, -1, A, g.x, occhi(g), g.z, g.yaw + g.rinculoLato, g.pitch + g.rinculoSu, cono);
        const k = g.mira ? 0.7 : 1;
        g.rinculoSu += A.rinculo.su * GRADI * (0.8 + 0.4 * caso(s)) * k;
        g.rinculoLato += A.rinculo.lato * GRADI * (caso(s) * 2 - 1) * k;
        if (g.rinculoSu > 12 * GRADI) g.rinculoSu = 12 * GRADI;
        g.dispersione += A.dispersione.colpo * GRADI;
        if (st.colpi === 0) ricarica();
      } else if (!g.grilletto) { s.ev.push({ t: 'vuoto' }); ricarica(); }
    }
  }
  g.grilletto = inp.fuoco;

  // ---- il rinculo torna giù quando smetti di sparare; la dispersione dei colpi di fila cala ----
  if (s.tick - g.ultimoSparo > secTick(A.cadenza) * 1.3) {
    const rec = A.rinculo.recupero * GRADI * DT;
    g.rinculoSu = g.rinculoSu > rec ? g.rinculoSu - rec : 0;
    g.rinculoLato = g.rinculoLato > rec ? g.rinculoLato - rec : g.rinculoLato < -rec ? g.rinculoLato + rec : 0;
  }
  const cala = A.dispersione.cala * GRADI * DT;
  g.dispersione = g.dispersione > cala ? g.dispersione - cala : 0;

  // ---- la vita torna dopo un po' senza colpi ----
  if (g.vita < C.vita && s.tick - g.colpitoT > secTick(C.rigenera.attesa)) g.vita = Math.min(C.vita, g.vita + C.rigenera.alSecondo * DT);
}
