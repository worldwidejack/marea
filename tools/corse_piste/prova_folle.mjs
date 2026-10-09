// Banco di prova del motore v2: tutte le cose nuove in un giro.
// - un tappeto del turbo e un giro della morte;
// - una curva sopraelevata a U;
// - un salto sopra un buco e un dosso da prendere forte;
// - una deviazione con la scorciatoia di sabbia;
// - un ponte stretto senza muri da cui si cade.
export const meta = {
  id: 'prova_folle', nome: 'Pista folle di prova', zona: 'prova', famiglia: 'ruote', tipo: 'circuito', giri: 2, chiusa: true,
  larghezza: 7, bordo: 2.5, muro: 0.7, superficie: 'asfalto', bordoTipo: 'sabbia', stile: 'strada', da: [0, 0, 0], dir: 0,
};
export default function (t) {
  t.dritto(40);
  t.turbo(t.qui(), [-3, 3], 6);
  t.dritto(30);
  t.giro(10, 9);
  t.dritto(35);
  t.curva(180, 32, { inc: 20 });
  t.dritto(30);
  t.salto(12, { salto: 10 });
  t.dritto(15);
  t.dritto(22, { sali: 5 }).dritto(22, { sali: -5 }); // il dosso
  t.dritto(15);
  // deviazione verso destra; la scorciatoia (sabbia, stretta) taglia dritta a sinistra
  const a = t.qui();
  t.curva(60, 28).curva(-120, 28).curva(60, 28);
  const b = t.qui();
  t.ramo('scorciatoia', a, b, { lat: -4, latA: -4, larghezza: 3.5, bordo: 1, superficie: 'sabbia', bordoTipo: 'erba', scorciatoia: true }, (r) => r.dritto(10));
  t.dritto(25);
  // il ponte stretto senza muri
  t.larghezza(5).dritto(5);
  const p0 = t.qui();
  t.dritto(50);
  t.senzaMuro(0, p0, t.qui());
  t.larghezza(7).dritto(10);
  t.curva(180, 45, { inc: 8 });
  t.chiudi();
}
