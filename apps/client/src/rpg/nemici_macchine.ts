// Pose dei nemici snodati che strisciano o sono macchine (issue 723). Serpi e lumache (testa, corpo, coda, coda2 in fila): l'onda che
// li spinge avanti, la testa che si alza come telegrafo e sbatte giù. Macchine (corpo, testa, cannone, ruota, lancetta, ruote, elica,
// sportello, quelle che ci sono): vibrano, la ruota del vapore gira sempre più forte mentre caricano, il cannone rincula al colpo, la
// lancetta del manometro sale; da morte la testa si affloscia e il corpo si piega. Assi del modello come nemici_pose.ts.
import type { Posa } from './nemici_pose.ts';
import { campana, clamp01, colpo, esce, lerp, tonfo } from './nemici_rig.ts';

export function serpe(p: Posa): boolean {
  const { rig: r, n, t, b } = p, H = r.h, s = p.seme;
  const va = clamp01(p.vel / 0.8), fase = (p.passo / 0.7) * Math.PI * 2 + t * 1.5 * (1 - va);
  const onda = (amp: number, alza: number) => { // l'onda corre dalla testa alla coda
    r.ruota('testa', alza * Math.sin(fase), amp * Math.sin(fase));
    r.ruota('coda', -alza * Math.sin(fase - 1.2), -amp * Math.sin(fase - 1.2));
    r.ruota('coda2', -alza * Math.sin(fase - 2.4), -1.3 * amp * Math.sin(fase - 2.4));
    r.sposta('corpo', 0, 0.03 * H * Math.max(0, Math.sin(fase - 0.6)), 0);
  };
  if (n.anim === 'morto') { // si affloscia e si spande
    const k = tonfo(p.morto / 0.6);
    b.scale.y *= 1 - 0.55 * k; b.scale.x *= 1 + 0.25 * k; b.scale.z *= 1 + 0.15 * k;
    r.ruota('testa', -0.4 * k, 0.3 * k); r.ruota('coda2', 0, -0.5 * k);
    return true;
  }
  switch (n.anim) {
    case 'dorme': onda(0.03, 0.02); b.scale.y *= 0.9 + 0.03 * Math.sin(t * 1.2 + s); return true;
    case 'prepara': { // la testa si alza e ondeggia, il corpo si gonfia
      const k = esce(n.t);
      onda(0.08 * (1 - k), 0.05);
      r.ruota('testa', 1.0 * k, 0.15 * Math.sin(t * 9) * k); r.ruota('corpo', 0.15 * k); b.scale.y *= 1 + 0.12 * k;
      r.ruota('tubo', 0, 0, 0.12 * Math.sin(t * 30) * k);
      return true;
    }
    case 'colpisce': case 'recupera': {
      const su = n.anim === 'colpisce' ? colpo(n.t) : 1, giu = n.anim === 'recupera' ? esce(n.t) : 0, k = su * (1 - giu);
      r.ruota('testa', lerp(1.0, -0.45, su) * (1 - giu)); b.position.z = -0.35 * H * k; b.scale.y *= 1 - 0.15 * k; b.scale.z *= 1 + 0.2 * k;
      return true;
    }
    case 'colpito': { const k = campana(n.t || 0.5); b.scale.y *= 1 - 0.2 * k; b.scale.x *= 1 + 0.15 * k; r.ruota('testa', 0.4 * k); return true; }
    default: onda(0.18 + 0.1 * va, 0.08); b.scale.z *= 1 + 0.06 * Math.sin(fase * 2) * va; return true;
  }
}

export function macchina(p: Posa): boolean {
  const { rig: r, n, t, b } = p, H = r.h, s = p.seme;
  const va = clamp01(p.vel / 1.0);
  const vibra = (a: number, hz: number) => { b.position.x = a * H * Math.sin(t * hz + s); b.position.y = a * H * Math.abs(Math.sin(t * hz * 1.3 + s)); };
  for (const ruota of ['ruota_sx', 'ruota_dx', 'ruote']) r.ruota(ruota, -p.passo / 0.25);
  r.ruota('elica', 0, 0, t * 14); r.ruota('elica2', 0, t * 12, 0);
  if (n.anim === 'morto') { // si spegne: la testa cade avanti, il corpo si piega di lato, il cannone giù
    const k = tonfo(p.morto / 0.5);
    r.ruota('testa', -0.7 * k, 0, 0.3 * k); r.ruota('cannone', -0.6 * k); r.ruota('corpo', -0.25 * k, 0, 0.35 * k);
    r.ruota('braccio_sx', 0, 0, -0.5 * k); r.ruota('braccio_dx', 0, 0, 0.5 * k); r.ruota('sportello', 0, 1.2 * k);
    b.position.y = -0.05 * H * k;
    return true;
  }
  switch (n.anim) {
    case 'dorme': r.ruota('testa', -0.25); r.ruota('lancetta', 0, 0, 0); r.ruota('ruota', 0, t * 0.3, 0); return true;
    case 'prepara': { // carica la pressione: la ruota del vapore gira sempre più forte, la lancetta sale, il cannone si ritira, trema
      const k = esce(n.t);
      vibra(0.004 + 0.012 * k, 40);
      r.ruota('ruota', 0, t * (2 + 25 * k), 0); r.ruota('lancetta', 2.4 * k + 0.1 * Math.sin(t * 50) * k);
      r.sposta('cannone', 0, 0, 0.06 * H * k); r.ruota('cannone', 0.12 * k); r.ruota('testa', 0.08 * k);
      r.ruota('sportello', 0, -0.9 * k); r.ruota('braccio_sx', 0.8 * k, 0, -0.4 * k); r.ruota('braccio_dx', 0.8 * k, 0, 0.4 * k);
      return true;
    }
    case 'colpisce': case 'recupera': { // il colpo: rinculo secco e ritorno
      const su = n.anim === 'colpisce' ? colpo(n.t) : 1, giu = n.anim === 'recupera' ? esce(n.t) : 0, k = su * (1 - giu);
      r.sposta('cannone', 0, 0, 0.1 * H * campana(n.anim === 'colpisce' ? n.t : 0) - 0.03 * H * k); r.ruota('testa', -0.12 * k);
      r.ruota('ruota', 0, t * 20 * (1 - giu), 0); r.ruota('lancetta', 2.4 * (1 - su) + 0.6 * (1 - giu) * su);
      r.ruota('sportello', 0, -0.9 * k); b.position.z = 0.06 * H * campana(n.anim === 'colpisce' ? n.t : 0);
      r.ruota('braccio_sx', 1.4 * k); r.ruota('braccio_dx', 1.4 * k);
      return true;
    }
    case 'colpito': { const k = campana(n.t || 0.5); r.ruota('testa', 0.3 * k, 0.2 * k); b.rotation.z = 0.08 * k; r.ruota('lancetta', 1.2 * k); return true; }
    default: {
      vibra(0.003 + 0.004 * va, 22);
      r.ruota('ruota', 0, t * 1.2, 0); r.ruota('lancetta', 0.6 + 0.15 * Math.sin(t * 3 + s));
      r.ruota('testa', 0.03 * Math.sin(t * 1.5 + s), 0.25 * Math.sin(t * 0.6 + s) * (1 - va));
      r.ruota('braccio_sx', 0.3 * Math.sin(p.passo * 4) * va); r.ruota('braccio_dx', -0.3 * Math.sin(p.passo * 4) * va);
      return true;
    }
  }
}
