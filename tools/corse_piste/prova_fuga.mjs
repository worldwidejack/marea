// Banco di prova del motore v2: una fuga da A a B (pista aperta) giù da una collina, con curve sopraelevate e un salto in discesa.
export const meta = {
  id: 'prova_fuga', nome: 'Discesa di prova', zona: 'prova', famiglia: 'ruote', tipo: 'fuga', giri: 1, chiusa: false, via: 25,
  larghezza: 7, bordo: 2.5, muro: 0.7, superficie: 'asfalto', bordoTipo: 'erba', stile: 'strada', da: [0, 80, 0], dir: 0,
};
export default function (t) {
  t.dritto(45);
  t.curva(60, 50, { sali: -8 });
  t.dritto(60, { sali: -10 });
  t.curva(-90, 40, { sali: -8, inc: 10 });
  t.salto(12, { salto: 9, scende: 4 });
  t.dritto(40, { sali: -6 });
  t.curva(70, 45, { sali: -6, inc: 8 });
  t.dritto(80, { sali: -10 });
  t.curva(-40, 60, { sali: -5 });
  t.dritto(60, { sali: -4 });
  t.dritto(35);
}
