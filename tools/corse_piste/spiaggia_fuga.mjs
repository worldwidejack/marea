// Spiaggia e porto, pista 4: la Fuga dall'onda (fuga A→B, ruote). Concept: `assets/concept/corse/corse_14_spiaggia_fuga.jpg`.
// Una strada di scogliera che scende dall'alto verso il faro, con un'onda gigante che insegue:
// - 100 m di rettilineo prima del via: l'onda parte da dietro la griglia;
// - curve ampie e due curve sopraelevate sulla scogliera, il salto dove la ringhiera è crollata (e il vuoto sotto);
// - arrivo sotto il faro.
// L'inseguitore (l'onda) avanza da sola e accelera se ti stacchi troppo: se ti prende ti dà un colpo e vai piano finché non passa.
export const meta = {
  id: 'spiaggia_fuga', nome: 'Fuga dall\'onda', zona: 'spiaggia', famiglia: 'ruote', tipo: 'fuga', giri: 1, chiusa: false, via: 100,
  larghezza: 7.5, bordo: 2.5, muro: 0.7, superficie: 'asfalto', bordoTipo: 'erba', stile: 'strada', da: [0, 90, 0], dir: 0,
  inseguitore: { tipo: 'onda', parte: -85, v0: 12, accel: 0.25, vmax: 20.5, distMax: 28, recupero: 0.3, spessore: 16, colpo: 0.45, rallenta: 0.55 },
};
export default function (t) {
  t.dritto(100);
  t.dritto(60, { sali: -3 });
  t.curva(70, 60, { sali: -4 });
  t.dritto(50, { sali: -4 });
  t.curva(-100, 40, { inc: 10, sali: -6 });
  t.dritto(40, { sali: -4 });
  t.salto(12, { salto: 9, scende: 3 });           // la ringhiera crollata
  t.dritto(40, { sali: -3 });
  t.curva(60, 50, { sali: -4 });
  t.dritto(80, { sali: -6 });
  t.curva(-80, 45, { inc: 8, sali: -5 });
  t.dritto(60, { sali: -4 });
  t.curva(90, 40, { sali: -4 });
  t.dritto(70, { sali: -5 });
  t.curva(-50, 55, { sali: -3 });
  t.dritto(40, { sali: -3 });
  t.curva(75, 45, { sali: -4 });
  t.dritto(60, { sali: -4 });
  t.curva(-100, 38, { inc: 8, sali: -4 });
  t.dritto(45, { sali: -3 });
  t.curva(65, 50, { sali: -3 });
  t.dritto(70, { sali: -3 });
  t.curva(-40, 60, { sali: -2 });
  t.dritto(35);
}
