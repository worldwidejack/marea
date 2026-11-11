// Pose dei nemici snodati che non sono bipedi (issue 723): quadrupedi (trotto a coppie diagonali, agguato, balzo col morso), ragni (passo
// a tetrapode alterno, zampe davanti alzate come telegrafo, a pancia all'aria da morti), spettri (fluttuano, la coda che ondeggia, le
// braccia che caricano la magia). Assi del modello come nemici_pose.ts: +X su un arto che pende = in avanti.
import type { Colpo, Famiglia, Posa } from './nemici_pose.ts';
import { campana, clamp01, colpo, esce, lerp, tonfo } from './nemici_rig.ts';

export function posaBestia(p: Posa, f: Famiglia, c: Colpo): boolean {
  switch (f) {
    case 'quadrupede': return quadrupede(p);
    case 'ragno': return ragno(p);
    case 'spettro': return spettro(p, c);
    default: return false;
  }
}

// ------------------------------------------------------------------ quadrupedi
function quadrupede(p: Posa): boolean {
  const { rig: r, n, t, b } = p, H = r.h, s = p.seme;
  const cammina = clamp01(p.vel / 1.2), corre = clamp01((p.vel - 2.5) / 2);
  const fase = (p.passo / (1.1 * H + 0.6 * corre * H)) * Math.PI * 2, sa = Math.sin(fase), ca = Math.cos(fase);
  const coda = (amp: number, hz: number) => { r.ruota('coda', 0.2, amp * Math.sin(t * hz + s)); r.ruota('coda2', -0.1, amp * Math.sin(t * hz + s - 0.8)); };
  const zampe = (A: number, B: number) => { // trotto: anteriore sinistra con posteriore destra
    const g = (nome: string, ph: number) => { r.ruota('zampa_' + nome, A * Math.sin(fase + ph)); r.ruota('piede_' + nome, (nome[0] === 'a' ? 1 : -1) * B * Math.max(0, Math.cos(fase + ph))); };
    g('as', 0); g('pd', 0); g('ad', Math.PI); g('ps', Math.PI);
  };
  if (n.anim === 'morto') { // crolla su un fianco, le zampe rigide
    const k = tonfo(p.morto / 0.4), lato = s % 2 < 1 ? 1 : -1;
    b.rotation.z = 1.5 * lato * k; b.position.y = 0.05 * H * k;
    for (const z of ['as', 'ad', 'ps', 'pd']) r.ruota('zampa_' + z, (z[0] === 'a' ? 0.35 : -0.35) * k);
    r.ruota('testa', -0.3 * k); r.ruota('mascella', -0.35 * k);
    return true;
  }
  switch (n.anim) {
    case 'dorme': { // accucciato, il muso sulle zampe, la coda attorno
      const rr = Math.sin(t * 1.2 + s);
      b.position.y = -0.3 * H;
      r.ruota('zampa_as', 1.35); r.ruota('zampa_ad', 1.35); r.ruota('piede_as', -0.4); r.ruota('piede_ad', -0.4);
      r.ruota('zampa_ps', -1.2); r.ruota('zampa_pd', -1.2); r.ruota('piede_ps', 2.0); r.ruota('piede_pd', 2.0);
      r.ruota('corpo', 0.02 * rr); r.ruota('collo', -0.4); r.ruota('testa', -0.25 + 0.03 * rr);
      r.ruota('coda', -0.3, 0.9); r.ruota('coda2', 0, 0.7);
      return true;
    }
    case 'prepara': { // agguato: si abbassa davanti, ringhia (mascella che trema), la coda tesa
      const k = esce(n.t);
      zampe(0.3 * cammina, 0.5 * cammina);
      b.position.y = -0.1 * H * k; b.position.z = 0.1 * H * k;
      r.ruota('corpo', -0.12 * k); r.ruota('zampa_ps', -0.5 * k); r.ruota('zampa_pd', -0.5 * k); r.ruota('piede_ps', 1.0 * k); r.ruota('piede_pd', 1.0 * k);
      r.ruota('zampa_as', 0.35 * k); r.ruota('zampa_ad', 0.35 * k); r.ruota('piede_as', -0.5 * k); r.ruota('piede_ad', -0.5 * k);
      r.ruota('collo', -0.35 * k); r.ruota('testa', 0.25 * k); r.ruota('mascella', -(0.25 + 0.12 * Math.sin(t * 40)) * k);
      r.ruota('coda', -0.15 * k, 0.05 * Math.sin(t * 30));
      return true;
    }
    case 'colpisce': case 'recupera': { // il balzo col morso: avanti con le zampe tese, le fauci che si chiudono
      const su = n.anim === 'colpisce' ? colpo(n.t) : 1, giu = n.anim === 'recupera' ? esce(n.t) : 0, k = su * (1 - giu);
      b.position.z = -0.5 * H * k; b.position.y = 0.18 * H * campana(n.anim === 'colpisce' ? n.t : 0);
      r.ruota('corpo', 0.15 * k); r.ruota('zampa_as', 1.1 * k); r.ruota('zampa_ad', 1.0 * k); r.ruota('zampa_ps', -0.9 * k); r.ruota('zampa_pd', -0.9 * k);
      r.ruota('collo', 0.2 * k); r.ruota('mascella', -0.7 * (n.anim === 'colpisce' ? 1 - clamp01((n.t - 0.4) * 3) : 0));
      coda(0.2, 10);
      return true;
    }
    case 'colpito': {
      const k = campana(n.t || 0.5);
      b.position.z = 0.15 * H * k; r.ruota('corpo', 0.12 * k, 0.2 * k); r.ruota('testa', 0.5 * k, 0.3 * k); r.ruota('mascella', -0.4 * k);
      return true;
    }
    default: {
      const fermo = 1 - cammina, respiro = Math.sin(t * 2.4 + s);
      zampe(0.55 + 0.3 * corre, 0.8 + 0.4 * corre);
      b.position.y = 0.03 * H * cammina * Math.abs(ca) + 0.006 * H * respiro * fermo;
      r.ruota('corpo', 0.04 * sa * cammina + 0.012 * respiro * fermo, 0, 0.03 * ca * cammina);
      // fermo annusa (testa giù a scatti) e si guarda attorno; correndo la testa bassa e avanti
      const fiuta = fermo * Math.max(0, Math.sin(t * 0.7 + s)) ** 4;
      r.ruota('collo', -0.15 * corre - 0.45 * fiuta, fermo * 0.4 * Math.sin(t * 0.33 + s));
      r.ruota('testa', -0.05 * cammina + 0.08 * Math.sin(t * 12) * fiuta);
      coda(0.15 + 0.35 * fermo, 3 + 5 * cammina);
      if (n.anim === 'insegue' && cammina < 0.3) r.ruota('mascella', -0.12 - 0.05 * Math.sin(t * 25)); // fermo davanti a te: ringhia
      return true;
    }
  }
}

// ------------------------------------------------------------------ ragni (zampe 1-4 a sinistra dal davanti, 5-8 a destra)
function ragno(p: Posa): boolean {
  const { rig: r, n, t, b } = p, H = r.h, s = p.seme;
  const cammina = clamp01(p.vel / 1.0);
  const fase = (p.passo / 0.55) * Math.PI * 2;
  const zampa = (i: number, avanti: number, alza: number, piega: number) => {
    const sx = i <= 4 ? -1 : 1; // le sinistre si alzano ruotando su −Z, le destre su +Z
    r.ruota('zampa_' + i, 0, avanti, -sx * alza);
    r.ruota('punta_' + i, 0, 0, sx * piega);
  };
  const passo = (A: number, L: number) => {
    for (let i = 1; i <= 8; i++) {
      const gruppo = (i <= 4 ? i : i + 1) % 2; // tetrapode alterno: 1,3,6,8 contro 2,4,5,7
      const ph = fase + gruppo * Math.PI;
      zampa(i, A * Math.sin(ph) * (i <= 4 ? 1 : -1), L * Math.max(0, Math.cos(ph)), 0.3 * L * Math.max(0, Math.cos(ph)));
    }
  };
  if (n.anim === 'morto') { // a pancia all'aria con le zampe che si chiudono
    const k = tonfo(p.morto / 0.4);
    b.rotation.z = Math.PI * k * (s % 2 < 1 ? 1 : -1); b.position.y = 0.55 * H * k;
    for (let i = 1; i <= 8; i++) zampa(i, 0, -0.6 * k, 1.4 * k);
    return true;
  }
  switch (n.anim) {
    case 'dorme': {
      b.position.y = -0.18 * H;
      for (let i = 1; i <= 8; i++) zampa(i, 0, 0.25, 0.9);
      r.ruota('addome', 0.03 * Math.sin(t * 1.3 + s));
      return true;
    }
    case 'prepara': { // si impenna: le due zampe davanti alzate che ondeggiano, le zanne aperte
      const k = esce(n.t);
      passo(0.25 * cammina, 0.4 * cammina);
      r.ruota('corpo', 0.35 * k); b.position.y = 0.05 * H * k;
      zampa(1, -0.3 * k, 1.2 * k + 0.12 * Math.sin(t * 14), -0.6 * k); zampa(5, 0.3 * k, 1.2 * k + 0.12 * Math.sin(t * 14 + 1), -0.6 * k);
      r.ruota('zanne', 0, 0, 0); r.ruota('addome', -0.25 * k);
      return true;
    }
    case 'colpisce': case 'recupera': { // le zampe davanti sbattono giù, il corpo scatta avanti
      const su = n.anim === 'colpisce' ? colpo(n.t) : 1, giu = n.anim === 'recupera' ? esce(n.t) : 0, k = su * (1 - giu);
      r.ruota('corpo', lerp(0.35, -0.2, su) * (1 - giu)); b.position.z = -0.35 * H * k;
      zampa(1, -0.4 * k, lerp(1.2, -0.2, su) * (1 - giu), 0); zampa(5, 0.4 * k, lerp(1.2, -0.2, su) * (1 - giu), 0);
      r.ruota('addome', 0.15 * k);
      return true;
    }
    case 'colpito': { const k = campana(n.t || 0.5); b.position.z = 0.12 * H * k; r.ruota('corpo', -0.2 * k); for (let i = 1; i <= 8; i++) zampa(i, 0, 0.3 * k, 0.5 * k); return true; }
    default: {
      passo(0.35, 0.55 * cammina + 0.08);
      if (cammina < 0.2) for (const i of [1, 5]) zampa(i, 0, 0.15 + 0.15 * Math.max(0, Math.sin(t * 3 + i + s)), 0.2); // fermo: tasta l'aria
      b.position.y = 0.02 * H * Math.abs(Math.sin(fase)) * cammina;
      r.ruota('addome', 0.04 * Math.sin(t * 2 + s), 0.08 * Math.sin(fase) * cammina);
      return true;
    }
  }
}

// ------------------------------------------------------------------ spettri: fluttuano sempre, la coda ondeggia
function spettro(p: Posa, c: Colpo): boolean {
  const { rig: r, n, t, b } = p, H = r.h, s = p.seme;
  const ondeggia = Math.sin(t * 1.7 + s), va = clamp01(p.vel / 1.5);
  r.ruota('aureola', 0, 0, t * 0.9); r.ruota('schegge', 0, t * 1.4, 0); // il Custode: l'aureola e le schegge girano sempre
  b.position.y = 0.12 * H + 0.05 * H * ondeggia;
  r.ruota('corpo', -0.25 * va + 0.04 * ondeggia, 0, 0.05 * Math.sin(t * 1.1 + s));
  r.ruota('coda', 0.3 * va + 0.15 * Math.sin(t * 2.3 + s), 0.25 * Math.sin(t * 1.9 + s)); r.ruota('coda2', 0.2 * va + 0.2 * Math.sin(t * 2.3 + s - 1), 0.3 * Math.sin(t * 1.9 + s - 1));
  const braccia = (x: number, z: number, gomito: number) => { r.ruota('braccio_sx', x, 0, -z); r.ruota('braccio_dx', x, 0, z); r.ruota('avambraccio_sx', gomito); r.ruota('avambraccio_dx', gomito); };
  if (n.anim === 'morto') { // si torce, poi la veste vuota si affloscia a terra (in prima persona resta lì come bottino)
    const k = esce(p.morto / 0.35), giu = tonfo((p.morto - 0.3) / 0.5);
    b.position.y = lerp(0.12 * H + 0.15 * H * k, -0.05 * H, giu); b.rotation.y = 2.5 * k;
    b.rotation.x = -1.35 * giu; b.position.z = -0.35 * H * giu;
    braccia(lerp(2.4 * k, 1.2, giu), lerp(0.8 * k, 1.1, giu), 0); r.ruota('testa', lerp(0.6 * k, -0.3, giu));
    r.ruota('coda', 0.5 * giu); r.ruota('coda2', 0.6 * giu);
    return true;
  }
  switch (n.anim) {
    case 'dorme': b.position.y = 0.02 * H; r.ruota('corpo', -0.3); r.ruota('testa', -0.5); braccia(0.2, 0.1, 0.3); return true;
    case 'prepara': { // carica: le braccia si alzano a scatti, la testa indietro, trema
      const k = esce(n.t), tr = n.t > 0.7 ? 0.04 * Math.sin(t * 60) : 0;
      braccia(lerp(0.6, c === 'magia' ? 2.7 : 2.2, k), lerp(0.4, 0.7, k), 0.3 * (1 - k)); r.ruota('testa', 0.35 * k + tr); r.ruota('corpo', 0.2 * k + tr);
      return true;
    }
    case 'colpisce': case 'recupera': { // spinge le mani avanti
      const su = n.anim === 'colpisce' ? colpo(n.t) : 1, giu = n.anim === 'recupera' ? esce(n.t) : 0;
      braccia(lerp(lerp(2.7, 1.55, su), 0.6, giu), lerp(lerp(0.7, 0.08, su), 0.4, giu), 0); r.ruota('corpo', -0.3 * su * (1 - giu)); b.position.z = -0.25 * H * su * (1 - giu);
      return true;
    }
    case 'colpito': { const k = campana(n.t || 0.5); b.position.z = 0.15 * H * k; r.ruota('corpo', 0.4 * k); braccia(0.3, 1.0 * k, 0); return true; }
    default: braccia(0.6 + 0.15 * Math.sin(t * 2 + s), 0.4 + 0.1 * Math.sin(t * 1.3 + s), 0.4 + 0.2 * Math.sin(t * 2.5 + s)); r.ruota('testa', 0, 0.3 * Math.sin(t * 0.5 + s)); return true;
  }
}
