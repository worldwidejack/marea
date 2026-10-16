// Dagli eventi della sim alla resa (#355): ogni tick la sim dice cosa è successo (spari, colpi, uccisioni, ricariche, salti, allerta,
// obiettivi, rinforzi, gru sabotata, fine) e qui diventa succo (succo.ts), suoni (suoni.ts) e HUD (hud.ts, missione_ui.ts).
// I tuoi spari partono dall'arma in mano (prima persona) o da quella dell'avatar (terza); quelli dei nemici dalla loro arma, coi suoni
// che arrivano da dove sono. Se ti colpiscono: segno rosso dalla direzione del colpo, bordo rosso, scossa.
import * as THREE from 'three';
import { SPARO } from '@marea/content/sparo.ts';
import type { SMappa } from '@marea/sim/sparo/mappa.ts';
import type { SEvento, SState } from '@marea/sim/sparo/stato.ts';
import { occhi } from '@marea/sim/sparo/stato.ts';
import { atan2 } from '@marea/sim/trig.ts';
import type { Hud } from './hud.ts';
import type { InMano } from './inmano.ts';
import type { MissioneUi } from './missione_ui.ts';
import type { Squadra } from './squadra.ts';
import type { Materia, Succo } from './succo.ts';
import type { SuoniSparo } from './suoni.ts';

export type Ambiente = {
  m: SMappa; camera: THREE.PerspectiveCamera; succo: Succo; suoni: SuoniSparo; hud: Hud; mui: MissioneUi; inMano: InMano; squadra: Squadra;
  prima: () => boolean; partita: () => SState;
  /** Scossa della camera, calcio verso l'alto, botta dell'atterraggio. */
  scuoti(k: number): void; calcio(k: number): void; atterra(k: number): void;
};

const MESSAGGI = ['', 'SABOTA LA GRU', 'RAGGIUNGI LA BARCA', ''];

export function creaEventi(a: Ambiente): (ev: readonly SEvento[]) => void {
  const bocca = new THREE.Vector3(), punto = new THREE.Vector3(), nor = new THREE.Vector3(), dir = new THREE.Vector3(), esp = new THREE.Vector3();
  const destra = new THREE.Vector3(), su = new THREE.Vector3(0, 1, 0), verso = new THREE.Vector3();
  const materia = (i: number): Materia => { const t = a.m.scatole[i]?.tipo; return t === 'cassa' ? 'legno' : t === 'barriera' ? 'plastica' : 'metallo'; };
  /** Da dove arriva un suono rispetto a dove guardi: −1 sinistra … +1 destra. */
  const pan = (x: number, z: number): number => {
    destra.set(1, 0, 0).applyQuaternion(a.camera.quaternion); destra.y = 0; destra.normalize();
    verso.set(x - a.camera.position.x, 0, z - a.camera.position.z).normalize();
    return destra.dot(verso);
  };
  return (ev) => {
    const s = a.partita(), g = s.g;
    for (const e of ev) {
      switch (e.t) {
        case 'sparo': {
          const mia = e.chi < 0;
          if (mia) {
            if (a.prima()) a.inMano.bocca(bocca); else if (!a.squadra.bocca(-1, bocca)) bocca.set(g.x, occhi(g), g.z);
          } else if (!a.squadra.bocca(e.chi, bocca)) bocca.set(e.ox, e.oy - 0.15, e.oz);
          const c0 = e.colpi[0]!;
          dir.set(c0.x - bocca.x, c0.y - bocca.y, c0.z - bocca.z).normalize();
          a.succo.lampo(bocca, dir, mia && a.prima() ? 0.2 : 1);
          if (mia) {
            a.suoni.sparo(e.arma);
            const forza = e.arma === 'pompa' ? 2.4 : e.arma === 'pistola' ? 1.3 : 0.8;
            a.inMano.sparo(forza); a.calcio(0.004 * forza); a.scuoti(0.1 * forza);
            if (e.arma !== 'pompa') {
              if (a.prima()) a.inMano.espulsione(esp); else esp.copy(bocca);
              destra.set(1, 0, 0).applyQuaternion(a.camera.quaternion);
              a.succo.bossolo(esp, destra, su, g.y);
            }
          } else a.suoni.sparo(e.arma, { pan: pan(e.ox, e.oz), dist: Math.hypot(e.ox - g.x, e.oz - g.z) });
          e.colpi.forEach((c, k) => {
            punto.set(c.x, c.y, c.z);
            // i colpi che ti prendono non lasciano la scia fino agli occhi
            if (k < 4 && !(c.cosa === 'attore' && c.chi < 0 && a.prima())) a.succo.scia(bocca, punto);
            if (c.cosa === 'nulla' || (c.cosa === 'attore' && c.chi < 0)) return;
            const mat: Materia = c.cosa === 'attore' ? 'corpo' : c.cosa === 'acqua' ? 'acqua' : c.cosa === 'terra' ? 'cemento' : materia(c.scatola);
            nor.set(c.nx, c.ny, c.nz);
            a.succo.impatto(punto, nor, mat, c.cosa === 'muro' || c.cosa === 'terra');
            if (k === 0 && c.cosa === 'muro') a.suoni.impatto(mat === 'metallo', punto.distanceTo(a.camera.position));
          });
          break;
        }
        case 'colpito':
          if (e.da < 0 && e.chi >= 0) { a.squadra.colpito(e.chi, e.testa ? 1.5 : 1); a.hud.segno(e.testa, false); a.suoni.segno(e.testa); }
          if (e.chi < 0) {
            const b = s.bot[e.da];
            if (b) {
              // angolo del colpo rispetto a dove guardi (0 = davanti, + a sinistra), nella convenzione della sim
              const verso = atan2(-(b.x - g.x), -(b.z - g.z)), cam = new THREE.Euler().setFromQuaternion(a.camera.quaternion, 'YXZ').y;
              a.mui.danno(verso - cam);
            }
            a.suoni.colpitoIo(); a.scuoti(0.35);
          }
          break;
        case 'ucciso':
          if (e.da < 0) { a.hud.segno(e.testa, true); a.suoni.ucciso(); if (e.testa) a.hud.messaggio('COLPO ALLA TESTA', 0.9); }
          break;
        case 'ricarica': { const A = SPARO.armi[e.arma - 1]!; a.suoni.ricarica(A.id, A.ricarica); break; }
        case 'carico': a.suoni.carico(SPARO.armi[e.arma - 1]!.id); break;
        case 'vuoto': a.suoni.vuoto(); break;
        case 'cambio': { const A = SPARO.armi[e.arma - 1]!; a.inMano.cambio(A.id, A.estrai); a.squadra.armaIo(A.id); break; }
        case 'salto': a.suoni.salto(); break;
        case 'atterra': a.suoni.atterra(e.forte); a.atterra(e.forte * 0.03); break;
        case 'obiettivo': if (MESSAGGI[e.i]) a.hud.messaggio(MESSAGGI[e.i]!, 2.2); break;
        case 'rinforzi': a.hud.messaggio('ARRIVANO I RINFORZI!', 2.2); break;
        case 'sabotata': {
          const G = SPARO.mappa.gru;
          a.suoni.atterra(40); a.suoni.sparo('pompa'); a.scuoti(0.9);
          for (let i = 0; i < 6; i++) {
            punto.set(G.x + (Math.random() - 0.5) * 2, 7.5 + Math.random() * 2, G.z + (Math.random() - 0.5) * 2);
            nor.set(Math.random() - 0.5, 1, Math.random() - 0.5).normalize();
            a.succo.impatto(punto, nor, 'metallo', false);
          }
          a.hud.messaggio('GRU SABOTATA!', 1.4);
          break;
        }
        default: break;
      }
    }
  };
}
