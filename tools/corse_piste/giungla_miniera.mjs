// Giungla e templi, pista 1: la Miniera del tempio (circuito IBRIDO, 2 giri). Concept: `assets/concept/corse/corse_08_giungla_miniera.jpg`.
// Rifatta dopo la prova di Jack (#228, 11 ott 2026: «una gara intera sui binari è noiosa»): si corre col proprio veicolo a ruote sullo
// sterrato della giungla e solo nella miniera le ruote si agganciano alle rotaie (3, sul ponte di legno e dentro la bocca del tempio).
// - Il via sullo sterrato, una curva larga, la discesa con la esse da drift e il curvone sopraelevato.
// - L'imbuto: la strada si stringe fino alle rotaie e ci si aggancia. Frecce del turbo sulla rotaia di sinistra.
// - La curva in discesa sul ponte (piegati, sennò deragli), poi il bivio: dalla rotaia di destra il tunnel nella bocca del tempio,
//   più corto e col turbo, ma con la rotaia rotta da saltare (chi sbaglia cade); il giro largo intorno al tempio è sicuro.
// - Il ponte crollato: manca la rotaia di mezzo, si salta su un'altra (cartelli prima).
// - L'uscita: la strada si allarga, ci si sgancia; il salto sopra la cascata e la salita verso il via.
// Evento firma: dal 2° giro sul ponte dopo il bivio cede la rotaia di sinistra.
export const meta = {
  id: 'giungla_miniera', nome: 'Miniera del tempio', zona: 'giungla', famiglia: 'ruote', tipo: 'circuito', giri: 2, chiusa: true,
  larghezza: 6.5, bordo: 1.2, muro: 0.7, superficie: 'terra', bordoTipo: 'erba', stile: 'strada', da: [0, 20, 0], dir: 0,
  binari: [-2.6, 0, 2.6],
};
const MINIERA = 3.8;
/** La strada si stringe (o si allarga) fino a `l` in `m` metri, un punto alla volta. */
function imbuto(t, l, m) {
  const l0 = t.l, n = Math.max(1, Math.round(m / 5));
  for (let i = 1; i <= n; i++) t.larghezza(l0 + ((l - l0) * i) / n).dritto(m / n);
  return t;
}
export default function (t) {
  t.dritto(40);                                    // il via
  t.curva(90, 30);
  t.dritto(20, { sali: -3 });                      // la discesa nella giungla
  t.curva(-50, 22).curva(50, 22);                  // la esse da drift
  t.dritto(10);
  t.curva(90, 25, { inc: 8 });                     // il curvone sopraelevato
  imbuto(t, MINIERA, 15);                          // la strada si stringe alle rotaie
  const dentro = t.qui();
  // ---- la miniera: agganciati ----
  t.dritto(8);
  t.turbo(t.qui(), [-3.6, -1.6], 6);               // le frecce del turbo sulla rotaia di sinistra
  t.dritto(22);                                    // il ponte sopra la cascata
  t.curva(-50, 20, { sali: -4 });                  // la curva in discesa: senza piegarsi si deraglia
  t.dritto(10);
  // il bivio: il giro largo intorno al tempio (sicuro); il tunnel nella bocca del tempio parte dalla rotaia di destra
  const a = t.qui();
  t.curva(30, 22).dritto(15).curva(-60, 22).dritto(15).curva(30, 22);
  const b = t.qui();
  t.ramo('tunnel', a, b, { lat: 2.6, latA: 2.6, larghezza: 1.6, bordo: 0.3, superficie: 'rotaia', bordoTipo: 'legno', scorciatoia: true, binari: [0] }, (r) => {
    r.dritto(8); r.turbo(r.qui(), [-1.2, 1.2], 4); r.dritto(12);
    r.rotaiaRotta(0, r.qui(2), r.qui(7));            // la rotaia rotta nel tunnel (5 m): si salta, sennò si cade
    r.dritto(20);
  });
  const ponte0 = t.qui();
  t.dritto(30);                                    // il ponte di legno (dal 2° giro cede a sinistra)
  t.evento('ponte', 2, 'vuoto', { i: ponte0.i, o: 6 }, { i: ponte0.i, o: 22 }, [-3.8, -1.4]);
  const crollo = t.qui();
  t.dritto(25);
  t.rotaiaRotta(0, { i: crollo.i, o: 6 }, { i: crollo.i, o: 20 }); // il ponte crollato: manca la rotaia di mezzo
  t.curva(90, 24);
  t.dritto(10);
  const fuori = t.qui();
  t.aggancio(dentro, fuori);
  // ---- fuori: ci si sgancia ----
  imbuto(t, meta.larghezza, 15);
  t.salto(7, { salto: 8 });                        // il salto sopra la cascata (in piano: una discesa subito dopo la rampa fa staccare prima)
  t.curva(70, 40);
  t.dritto(135, { sali: 7 });                      // il rettilineo lungo il fiume, in salita verso il via
  t.curva(60, 40, { inc: 6 });
  t.dritto(60);
  t.chiudi();
}
