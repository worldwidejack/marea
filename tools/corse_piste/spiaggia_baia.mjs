// Spiaggia e porto, pista 2: la Baia (circuito, acqua, 3 giri). Concept: `assets/concept/corse/corse_03_spiaggia_baia.jpg`.
// Moto d'acqua e gommoni tra boe e scogli:
// - il via con un tappeto del turbo, onde su tutta la baia (ogni cresta fa saltare);
// - un tratto di corrente che spinge, il canale stretto tra gli scogli;
// - la secca di sabbia dentro la curva lunga: a bassa marea si gira intorno;
// - l'onda gigante: una rampa che lancia in aria (se atterri dritto prendi il turbo).
// Evento firma: dal 2° giro sale la marea e la secca diventa acqua (la curva si taglia).
export const meta = {
  id: 'spiaggia_baia', nome: 'Baia', zona: 'spiaggia', famiglia: 'acqua', tipo: 'circuito', giri: 3, chiusa: true,
  larghezza: 9, bordo: 3, muro: 0.8, superficie: 'acqua', bordoTipo: 'acquaBassa', stile: 'acqua', da: [0, 0, 0], dir: 0,
  griglia: [[-6, -3.5], [-6, 3.5], [-13, -3.5], [-13, 3.5], [-20, 0]],
};
export default function (t) {
  t.dritto(35);
  t.turbo(t.qui(), [-3, 3], 6);
  t.dritto(25);
  t.curva(80, 50);
  const c0 = t.qui();
  t.dritto(80);
  t.superficie('corrente', c0, t.qui());
  t.curva(-50, 40);                                  // il canale stretto tra gli scogli
  t.larghezza(6).dritto(35);
  t.larghezza(9).dritto(15);
  const s0 = t.qui();
  t.curva(120, 34);                                  // la curva lunga con la secca
  const s1 = t.qui();
  t.superficie('sabbia', s0, s1, [2.5, 9]);
  t.evento('marea', 2, 'acqua', s0, s1, [2.5, 9]);
  t.dritto(20);
  t.tratti.rampe.push({ m: t.qui(), salto: 9 });     // l'onda gigante
  t.dritto(30);
  t.curva(60, 40);
  t.dritto(25);
  t.curva(60, 45);
  t.chiudi();
}
