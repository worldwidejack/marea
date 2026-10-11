// Discesa in bici in prima persona sul video (docs/ADRENALINA.md §7, bici downhill; banco provadiscesa.html).
// La pista è il video: la logica vive sulla sua linea del tempo. «t» = secondi di video (la posizione lungo la pista), la velocità
// è la velocità di riproduzione (1 = quella del filmato). Gli ostacoli sono messi su quella linea con una corsia (−1 sinistra,
// 0 centro, 1 destra) e arrivano addosso in finta prospettiva (il trucco di OutRun). Niente DOM qui: la usa main.ts e un giorno
// la sim del server.

export type Tipo = 'sasso' | 'tronco' | 'pigna' | 'dosso';
export type Ostacolo = { t: number; x: number; tipo: Tipo; fatto: boolean; preso?: boolean };
export type Comandi = { sterzo: number; pedala: boolean; salta: boolean };
export type Evento = 'botta' | 'salto' | 'trick' | 'pigna' | 'rasente' | 'atterra' | 'giuntura' | 'fine';

export const REGOLE = {
  vBase: 1, vPedala: 1.6, vBotta: 0.25,
  acc: 0.7, frena: 1.6,
  sterzoVel: 2.4, // corsie al secondo
  aria: 0.55, ariaTrick: 0.95, ricarica: 0.85,
  botta: 1.2, invulnerabile: 1.7,
  urto: 0.34, rasente: 0.62, // distanza in corsie per la botta e per il «rasente» (adrenalina)
  collisione: 0.12, // secondi di video prima che l'oggetto arrivi al manubrio: lì si controlla l'urto
  adrCala: 0.05, adrRasente: 0.22, adrTrick: 0.35, adrVeloce: 0.05,
  punti: { pigna: 100, trick: 300, rasente: 50 },
};

export type Stato = {
  t: number; durata: number; v: number; x: number;
  aria: number; ariaMax: number; ricarica: number;
  botta: number; invul: number;
  adr: number; punti: number; tempo: number; finito: boolean;
  ostacoli: Ostacolo[]; giunture: number[];
};

/** Generatore pseudo-casuale ripetibile (mulberry32): la pista è sempre la stessa per lo stesso seme. */
export function rng(seme: number): () => number {
  let a = seme >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let r = Math.imul(a ^ (a >>> 15), 1 | a);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/** Mette gli ostacoli sul video: dal secondo 2 a 1 s dalla fine, mai a cavallo di una giuntura (lì c'è un dosso fisso). */
export function creaPista(durata: number, giunture: number[], seme = 7): Ostacolo[] {
  const r = rng(seme), out: Ostacolo[] = [];
  const corsia = () => [-0.66, 0, 0.66][Math.floor(r() * 3)] ?? 0;
  const vicinoGiuntura = (t: number) => giunture.some((g) => Math.abs(t - g) < 0.7);
  for (const g of giunture) out.push({ t: g - 0.08, x: 0, tipo: 'dosso', fatto: false });
  let t = 2;
  while (t < durata - 1) {
    if (!vicinoGiuntura(t)) {
      const p = r();
      if (p < 0.42) {
        const a = corsia();
        out.push({ t, x: a, tipo: 'sasso', fatto: false });
        if (r() < 0.35) { const b = corsia(); if (b !== a) out.push({ t, x: b, tipo: 'sasso', fatto: false }); }
      } else if (p < 0.72) {
        const a = corsia();
        for (let k = 0; k < 3; k++) out.push({ t: t + k * 0.16, x: a, tipo: 'pigna', fatto: false });
      } else if (p < 0.86) out.push({ t, x: 0, tipo: 'tronco', fatto: false });
      else out.push({ t, x: 0, tipo: 'dosso', fatto: false });
    }
    t += 0.85 + r() * 0.6;
  }
  return out.sort((a, b) => a.t - b.t);
}

export function creaStato(durata: number, giunture: number[], seme = 7): Stato {
  return { t: 0, durata, v: REGOLE.vBase, x: 0, aria: 0, ariaMax: 0, ricarica: 0, botta: 0, invul: 0, adr: 0, punti: 0, tempo: 0, finito: false, ostacoli: creaPista(durata, giunture, seme), giunture };
}

export const moltiplicatore = (s: Stato) => (s.adr >= 0.66 ? 3 : s.adr >= 0.33 ? 2 : 1);

/**
 * Un passo: dt in secondi veri. `tVideo` è dove sta davvero il video (comanda lui: se il telefono rallenta, la pista lo segue);
 * se manca, la posizione avanza da sola con la velocità (test e pilota automatico). Ritorna gli eventi del passo.
 */
export function passo(s: Stato, dt: number, c: Comandi, tVideo?: number): Evento[] {
  const ev: Evento[] = [];
  if (s.finito) return ev;
  const R = REGOLE;
  s.tempo += dt;
  s.botta = Math.max(0, s.botta - dt); s.invul = Math.max(0, s.invul - dt);
  s.ricarica = Math.max(0, s.ricarica - dt);
  // velocità: pedalare spinge, la botta frena, altrimenti torna a quella del filmato
  const meta = s.botta > 0 ? R.vBotta : c.pedala ? R.vPedala : R.vBase;
  s.v += Math.sign(meta - s.v) * Math.min(Math.abs(meta - s.v), (meta > s.v ? R.acc : R.frena) * dt);
  // sterzo: la corsia scorre finché tieni (-1..1)
  s.x = Math.max(-1, Math.min(1, s.x + c.sterzo * R.sterzoVel * dt));
  // salto
  const prima = s.t;
  s.t = tVideo ?? s.t + s.v * dt;
  if (c.salta && s.aria <= 0 && s.ricarica <= 0 && s.botta <= 0) {
    const dosso = s.ostacoli.find((o) => o.tipo === 'dosso' && !o.fatto && o.t - s.t < 0.5);
    s.aria = s.ariaMax = dosso ? R.ariaTrick : R.aria;
    s.ricarica = s.aria + R.ricarica;
    if (dosso) { dosso.fatto = true; dosso.preso = true; s.punti += R.punti.trick * moltiplicatore(s); s.adr = Math.min(1, s.adr + R.adrTrick); ev.push('trick'); }
    else ev.push('salto');
  } else if (s.aria > 0) {
    s.aria -= dt;
    if (s.aria <= 0) { s.aria = 0; ev.push('atterra'); }
  }
  // adrenalina: cala piano, sale se vai forte
  s.adr = Math.max(0, Math.min(1, s.adr - R.adrCala * dt + (s.v > 1.3 ? R.adrVeloce * dt : 0)));
  // ostacoli che arrivano al manubrio
  for (const o of s.ostacoli) {
    if (o.fatto || o.t - R.collisione > s.t) continue;
    o.fatto = true;
    const d = Math.abs(o.x - s.x);
    if (o.tipo === 'pigna') {
      if (d < R.urto + 0.08) { o.preso = true; s.punti += R.punti.pigna * moltiplicatore(s); ev.push('pigna'); }
    } else if (o.tipo === 'dosso') {
      ev.push('atterra'); // lo prendi senza saltare: scossone
    } else if (s.aria > 0 || s.invul > 0) {
      if (s.aria > 0) { s.punti += R.punti.rasente * moltiplicatore(s); s.adr = Math.min(1, s.adr + R.adrRasente * 0.5); ev.push('rasente'); }
    } else if (o.tipo === 'tronco' || d < R.urto) {
      s.botta = R.botta; s.invul = R.invulnerabile; s.adr = 0; ev.push('botta');
    } else if (d < R.rasente) {
      s.punti += R.punti.rasente * moltiplicatore(s); s.adr = Math.min(1, s.adr + R.adrRasente); ev.push('rasente');
    }
  }
  for (const g of s.giunture) if (prima < g && s.t >= g) ev.push('giuntura');
  if (s.t >= s.durata - 0.05) { s.finito = true; ev.push('fine'); }
  return ev;
}

/** Pilota automatico per i test: schiva i sassi, salta tronchi e dossi, va sulle pigne. */
export function autopilota(s: Stato): Comandi {
  const avanti = s.ostacoli.filter((o) => !o.fatto && o.t - s.t < 0.7 && o.t - s.t > 0);
  let meta = 0, salta = false;
  const sassi = avanti.filter((o) => o.tipo === 'sasso').map((o) => o.x);
  const pigna = avanti.find((o) => o.tipo === 'pigna');
  if (pigna && !sassi.some((x) => Math.abs(x - pigna.x) < 0.3)) meta = pigna.x;
  else if (sassi.length) meta = [-0.66, 0, 0.66].find((c) => !sassi.some((x) => Math.abs(x - c) < 0.5)) ?? 0;
  if (avanti.some((o) => (o.tipo === 'tronco' || o.tipo === 'dosso') && o.t - s.t < 0.28)) salta = true;
  return { sterzo: Math.max(-1, Math.min(1, (meta - s.x) * 4)), pedala: true, salta };
}
