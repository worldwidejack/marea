// Giungla e templi, pista 1: la Miniera del tempio (circuito, binari). Concept: `assets/concept/corse/corse_08_giungla_miniera.jpg`.
// Tre rotaie su un ponte di legno tra le cascate (#228), 2 giri lunghi:
// - il via davanti alla faccia di pietra del tempio, poi la discesa nel canyon: in fondo un tornante stretto sopra la cascata
//   (frena e piegati, sennò deragli);
// - il bivio: dalla rotaia di destra parte il tunnel nel tempio (una rotaia sola, col turbo), che taglia il giro largo;
// - il ponte crollato: la rotaia di mezzo manca, si salta su una delle altre;
// - il salto sopra la cascata e la salita sopraelevata fino al tempio (lì serve la leva);
// - il tornante del tempio, il rettilineo lungo il fiume e l'ultima curva sopraelevata.
// Evento firma: dal 2° giro il ponte di corda dopo il bivio cede a sinistra (la rotaia di sinistra cade).
export const meta = {
  id: 'giungla_miniera', nome: 'Miniera del tempio', zona: 'giungla', famiglia: 'binari', tipo: 'circuito', giri: 2, chiusa: true,
  larghezza: 3.8, bordo: 0.6, muro: 0.7, superficie: 'rotaia', bordoTipo: 'legno', stile: 'binari', da: [0, 30, 0], dir: 0,
  binari: [-2.6, 0, 2.6],
  griglia: [[-5, -2.6], [-5, 2.6], [-11, -2.6], [-11, 2.6], [-17, 0]],
};
export default function (t) {
  t.dritto(25);                                   // il via, davanti alla faccia del tempio
  t.curva(-40, 40, { sali: -2 });
  t.dritto(40, { sali: -9 });                    // la discesa nel canyon
  t.curva(130, 20, { inc: 12, sali: -3 });        // il tornante sopra la cascata
  t.dritto(10);
  // il bivio: il giro largo intorno al tempio; il tunnel parte dalla rotaia di destra e lo taglia dritto
  const a = t.qui();
  t.curva(-60, 22).dritto(18).curva(120, 22).dritto(18).curva(-60, 22);
  const b = t.qui();
  t.ramo('tunnel', a, b, { lat: 2.6, latA: 2.6, larghezza: 1.6, bordo: 0.3, superficie: 'rotaia', bordoTipo: 'legno', scorciatoia: true, famiglie: ['binari'], binari: [0] }, (r) => {
    r.dritto(8); r.turbo(r.qui(), [-1.2, 1.2], 4); r.dritto(20);
  });
  const ponte0 = t.qui();
  t.dritto(35);                                    // il ponte di corda (dal 2° giro cede a sinistra)
  t.evento('ponte', 2, 'vuoto', { i: ponte0.i, o: 8 }, { i: ponte0.i, o: 26 }, [-3.8, -1.4]);
  const crollo = t.qui();
  t.dritto(30);
  t.rotaiaRotta(0, { i: crollo.i, o: 6 }, { i: crollo.i, o: 24 }); // il ponte crollato: manca la rotaia di mezzo
  t.curva(90, 30);
  t.salto(6, { salto: 8, scende: 2 });            // il salto sopra la cascata
  t.dritto(12);
  t.curva(120, 30, { inc: 10, sali: 6 });          // la salita sopraelevata
  t.dritto(40, { sali: 9 });
  t.curva(60, 26, { sali: 2 });
  t.curva(-180, 20);                               // il tornante del tempio
  t.dritto(88);                                     // il rettilineo lungo il fiume
  t.curva(180, 23.5, { inc: 8 });                  // l'ultima curva, sopraelevata, e di nuovo il via
  t.chiudi();
}
