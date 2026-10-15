// Il primo sentiero della discesa (banco provadiscesa3d.html, #229), sul modello della speciale «Karma» di Finale Ligure: dalla cresta
// d'erba sopra il mare, con gli strappi in salita da pedalare, i dossi tondi, le discese che buttano nelle paraboliche, due salti; poi
// giù nel bosco con i tornanti sopraelevati, le radici, i tronchi, le paraboliche di tavole e il salto sul ruscello. Si guarda quasi sempre verso il mare
// (la direzione 0 = +x, dove sta il fondale dipinto): le curve si compensano.
export const meta = { id: 'cresta_bosco', nome: 'Cresta e bosco', da: [0, 260, 0], dir: 0, larghezza: 0.9, bordo: 2.6, sassiCresta: 22, sassiBosco: 34, seme: 11 };
export default function (t) {
  t.inizia('cresta', 'prato', 'dirupo');
  t.dritto(32, { sali: -2 });
  t.curva(25, 60, { sali: -5 });
  t.dritto(44, { sali: -7, dossi: 0.5 });             // i primi dossi
  t.curva(-35, 45, { sali: -6 });
  t.dritto(30, { sali: -6 }).rampa(1.3);
  t.dritto(26, { sali: -5 });
  t.dritto(16, { sali: -0.5 });
  t.dritto(42, { sali: 5.5 });                        // primo strappo in salita (~13 %): si pedala
  t.dritto(12, { sali: 0 });
  t.dritto(40, { sali: -9 });                         // giù a prendere velocità…
  t.curva(100, 17, { sali: -3, inc: 32 });            // …dentro la prima parabolica di terra
  t.dritto(22, { sali: -4, radici: true });           // il tratto di sassolini
  t.dritto(36, { sali: -8, dossi: 0.6 });
  t.curva(-90, 30, { sali: -6 });
  t.dritto(34, { sali: -7 }).rampa(1.6);
  t.dritto(20, { sali: -4 });
  t.curva(30, 50, { sali: -5 });
  t.dritto(14, { sali: 0 });
  t.dritto(36, { sali: 4.5 });                        // secondo strappo
  t.dritto(30, { sali: -6 });
  t.curva(-22, 60, { sali: -4 });
  t.inizia('bosco', 'bosco', 'bosco');
  t.dritto(30, { sali: -5, radici: true });
  t.curva(110, 14, { sali: -4, inc: 25 });            // primo tornante, sopraelevato
  t.dritto(20, { sali: -4 }).rampa(0.5, 'tronco');
  t.dritto(24, { sali: -4 });
  t.curva(-120, 13, { sali: -4, inc: 25 });           // secondo tornante
  t.dritto(46, { sali: -9, radici: true });
  t.dritto(26, { sali: -5 });
  t.curva(80, 18, { sali: -3, inc: 38, legno: true }); // parabolica di tavole
  t.dritto(30, { sali: -5 }).rampa(1.5);
  t.dritto(22, { sali: -2 });
  t.dritto(36, { sali: 4.5 });                        // terzo strappo, nel bosco
  t.curva(-60, 30, { sali: -5 });
  t.dritto(50, { sali: -10, radici: true });
  t.curva(-90, 16, { sali: -2, inc: 38, legno: true }); // seconda parabolica di tavole
  t.dritto(14, { sali: -2 }).rampa(0.5, 'tronco');
  t.dritto(36, { sali: -6, dossi: 0.6 });
  t.dritto(30, { sali: -6 }).ruscello(7);             // il salto sul ruscello: trampolino di terra e il fosso con l'acqua
  t.dritto(26, { sali: -4 });                         // l'atterraggio
  t.curva(30, 50, { sali: -3 });
  t.dritto(40, { sali: -2 });
}
