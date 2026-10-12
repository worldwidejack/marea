// Spiaggia e porto, pista 3: il Porto (circuito MISTO, ruote + acqua insieme, 3 giri). Concept: `assets/concept/corse/corse_04_spiaggia_porto.jpg`.
// Il molo di legno e il canale corrono affiancati nella stessa carreggiata larga: a destra il molo (corsia delle ruote), a sinistra
// l'acqua (corsia delle barche). Ognuno guida nella sua; fuori dalla sua corsia si rallenta molto. Nelle gare ci sono bot di tutte e due.
// - Il via davanti alle tribune dei manichini, poi il rettilineo delle gru.
// - Due scorciatoie, ognuna sulla corsia che sta all'interno della sua gobba (come la pista folle: la principale fa la gobba, la
//   scorciatoia taglia dritta e non tocca mai la principale, #258): la passerella per le ruote sulla banchina delle gru (gobba lunga a
//   sinistra, dolce perché le barche la fanno a tutta), il canale tra i container per le barche sul rettilineo di ritorno (gobba a destra).
// - Un tappeto del turbo per corsia.
// Evento firma: dal 2° giro le gru calano i container sul molo: i tetti di lamiera scivolano (poca presa) per le ruote.
export const meta = {
  id: 'spiaggia_porto', nome: 'Porto', zona: 'spiaggia', famiglia: 'ruote', famiglie: ['ruote', 'acqua'], corsie: { ruote: 4.2, acqua: -4.2 },
  tipo: 'circuito', giri: 3, chiusa: true,
  larghezza: 8, bordo: 2.5, muro: 0.7, superficie: 'legno', bordoTipo: 'legno', stile: 'strada', da: [0, 0, 0], dir: 0,
};
export default function (t) {
  t.superficieTutta('acqua', [-11, -1]);
  t.dritto(40);
  t.curva(90, 30);
  // il gradino intorno al magazzino: due curve larghe a 90° (prima erano tornanti da 140°, dove le barche andavano a 12 m/s, #258)
  t.dritto(10).curva(-90, 30).dritto(52.4).curva(90, 30);
  t.dritto(5.45);
  t.turbo(t.qui(), [2, 6.5], 6);
  t.turbo(t.qui(), [-6.5, -2], 6);
  t.dritto(5.45);
  t.curva(90, 30);
  const q0 = t.qui(8);
  t.dritto(35);
  // la gobba delle gru (a sinistra, lunga e dolce: le barche ci passano a tutta): la passerella la taglia dritta sulla corsia delle
  // ruote, col suo tappeto del turbo (chi la prende salta anche i container del 2° giro)
  const a = t.qui();
  t.curva(-25, 69.5).curva(50, 69.5).curva(-25, 69.5);
  const b = t.qui();
  t.ramo('passerella', a, b, { lat: 4.2, latA: 4.2, larghezza: 3.4, bordo: 1, superficie: 'legno', bordoTipo: 'legno', scorciatoia: true, famiglie: ['ruote'] }, (r) => r.turbo(r.qui(), [-2, 2], 5).dritto(6));
  t.dritto(34.51);
  t.evento('container', 2, 'container', q0, t.qui(-8), [1, 8]);   // la banchina delle gru
  t.curva(90, 30);
  t.dritto(5);
  // la gobba del magazzino (a destra): il canale tra i container la taglia dritto sulla corsia delle barche, col suo tappeto del turbo
  const c = t.qui();
  t.curva(50, 23.8).curva(-100, 23.8).curva(50, 23.8);
  const d = t.qui();
  t.ramo('canale', c, d, { lat: -4.2, latA: -4.2, larghezza: 3.4, bordo: 1, superficie: 'acqua', bordoTipo: 'acquaBassa', scorciatoia: true, famiglie: ['acqua'] }, (r) => r.turbo(r.qui(), [-2, 2], 5).dritto(6));
  t.dritto(5);
  t.curva(90, 30);
  t.chiudi();
}
