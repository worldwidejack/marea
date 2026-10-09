// Spiaggia e porto, pista 3: il Porto (circuito MISTO, ruote + acqua insieme, 3 giri). Concept: `assets/concept/corse/corse_04_spiaggia_porto.jpg`.
// Il molo di legno e il canale corrono affiancati nella stessa carreggiata larga: a destra il molo (corsia delle ruote), a sinistra
// l'acqua (corsia delle barche). Ognuno guida nella sua; fuori dalla sua corsia si rallenta molto. Nelle gare ci sono bot di tutte e due.
// - Il via davanti alle tribune dei manichini, poi il rettilineo delle gru.
// - Due scorciatoie sul grande giro del magazzino: la passerella per le ruote, il canale tra i container per le barche.
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
  t.dritto(20);
  // il grande giro intorno al magazzino, con le due scorciatoie (ognuna ha il suo tappeto del turbo all'imbocco)
  const a = t.qui();
  t.curva(-140, 30).dritto(10).curva(140, 30);
  const b = t.qui();
  t.ramo('passerella', a, b, { lat: 4.2, latA: 4.2, larghezza: 3.4, bordo: 1, superficie: 'legno', bordoTipo: 'legno', scorciatoia: true, famiglie: ['ruote'] }, (r) => r.turbo(r.qui(), [-2, 2], 5).dritto(6));
  t.ramo('canale', a, b, { lat: -4.2, latA: -4.2, larghezza: 3.4, bordo: 1, superficie: 'acqua', bordoTipo: 'acquaBassa', scorciatoia: true, famiglie: ['acqua'] }, (r) => r.turbo(r.qui(), [-2, 2], 5).dritto(6));
  t.dritto(15);
  t.turbo(t.qui(), [2, 6.5], 6);
  t.turbo(t.qui(), [-6.5, -2], 6);
  t.dritto(15);
  t.curva(90, 30);
  const q0 = t.qui(8);
  t.dritto(187);
  t.evento('container', 2, 'container', q0, t.qui(-8), [1, 8]);   // la banchina delle gru
  t.curva(90, 30);
  t.dritto(83);
  t.curva(90, 30);
  t.chiudi();
}
