// Il primo sentiero della discesa (banco provadiscesa3d.html, #229): dalla cresta d'erba sopra il mare, sassi da schivare e due
// salti, poi giù nel bosco di abeti con i tornanti stretti, le radici e i tronchi da saltare. Si guarda quasi sempre verso il mare
// (la direzione 0 = +x, dove sta il fondale dipinto); nel bosco i tornanti girano, ma lì il fondale si vede solo tra gli alberi.
export const meta = { id: 'cresta_bosco', nome: 'Cresta e bosco', da: [0, 260, 0], dir: 0, larghezza: 0.9, bordo: 2.6, sassiCresta: 22, sassiBosco: 34, seme: 11 };
export default function (t) {
  t.inizia('cresta', 'prato', 'dirupo');
  t.dritto(32, { sali: -2 });
  t.curva(25, 60, { sali: -5 });
  t.dritto(44, { sali: -7 });
  t.curva(-35, 45, { sali: -6 });
  t.dritto(30, { sali: -6 }).rampa(4);
  t.dritto(26, { sali: -5 });
  t.curva(40, 40, { sali: -7 });
  t.dritto(22, { sali: -5, radici: true });           // il tratto di sassolini
  t.dritto(36, { sali: -8 });
  t.curva(-50, 35, { sali: -6 });
  t.dritto(34, { sali: -7 }).rampa(5.5);
  t.dritto(20, { sali: -4 });
  t.curva(30, 50, { sali: -5 });
  t.dritto(40, { sali: -6 });
  t.curva(-22, 60, { sali: -4 });
  t.inizia('bosco', 'bosco', 'bosco');
  t.dritto(30, { sali: -5, radici: true });
  t.curva(110, 14, { sali: -4 });                     // primo tornante
  t.dritto(20, { sali: -4 }).rampa(3, 'tronco');
  t.dritto(24, { sali: -4 });
  t.curva(-120, 13, { sali: -4 });                    // secondo tornante
  t.dritto(46, { sali: -8, radici: true });
  t.curva(70, 25, { sali: -5 });
  t.dritto(30, { sali: -5 }).rampa(5);
  t.dritto(22, { sali: -2 });
  t.curva(-60, 30, { sali: -5 });
  t.dritto(50, { sali: -9, radici: true });
  t.curva(40, 35, { sali: -4 });
  t.dritto(14, { sali: -2 }).rampa(3, 'tronco');
  t.dritto(36, { sali: -6 });
  t.curva(-30, 50, { sali: -3 });
  t.dritto(40, { sali: -2 });
}
