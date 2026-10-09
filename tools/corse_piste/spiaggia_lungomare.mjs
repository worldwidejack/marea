// Spiaggia e porto, pista 1: il Lungomare (circuito, ruote, 3 giri). Concept: `assets/concept/corse/corse_02_spiaggia_lungomare.jpg`.
// Strada sul mare con il faro in cima alla scogliera:
// - rettilineo del via lungo la passeggiata (ombrelloni e manichini);
// - tornante sopraelevato intorno al faro, in salita;
// - discesa con un dosso da prendere forte, poi il salto sul canale di scolo della spiaggia;
// - un tappeto del turbo e le curve del paese.
// Evento firma: dal 3° giro l'onda copre mezza strada sul rettilineo del mare (acqua bassa: rallenta, si passa dall'altra parte).
// È la pista che prende il posto del Gran Premio: guida pura, senza scorciatoie.
export const meta = {
  id: 'spiaggia_lungomare', nome: 'Lungomare', zona: 'spiaggia', famiglia: 'ruote', tipo: 'circuito', giri: 3, chiusa: true,
  larghezza: 7, bordo: 2.5, muro: 0.7, superficie: 'asfalto', bordoTipo: 'sabbia', stile: 'strada', da: [0, 0, 0], dir: 0,
};
export default function (t) {
  t.dritto(30);
  const o0 = t.qui();
  t.dritto(55);
  t.evento('onda', 3, 'acquaBassa', o0, t.qui(), [-8, 1.5]);
  t.curva(70, 45, { sali: 2 });
  t.dritto(25, { sali: 3 });
  t.curva(140, 22, { inc: 12, sali: 4 });          // il tornante intorno al faro
  t.dritto(25, { sali: -3 });
  t.dritto(16, { sali: 2.5 }).dritto(16, { sali: -2.5 }); // il dosso
  t.curva(-60, 38, { sali: -3 });
  t.dritto(15, { sali: -3 });
  t.salto(10, { salto: 8 });                       // il canale di scolo della spiaggia
  t.dritto(10);
  t.turbo(t.qui(), [-3, 3], 6);
  t.dritto(20);
  t.curva(110, 32);
  t.dritto(20);
  t.curva(-40, 26);
  t.dritto(15);
  t.curva(90, 28);
  t.chiudi();
}
