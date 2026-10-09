// Banco di prova del motore v2 per la famiglia Acqua.
// - una baia larga, con le onde che fanno saltare;
// - un tratto di corrente che spinge;
// - una secca di sabbia in mezzo al rettilineo, da girare intorno;
// - un tappeto del turbo galleggiante.
export const meta = {
  id: 'prova_baia', nome: 'Baia di prova', zona: 'prova', famiglia: 'acqua', tipo: 'circuito', giri: 3, chiusa: true,
  larghezza: 9, bordo: 3, muro: 0.8, superficie: 'acqua', bordoTipo: 'acquaBassa', stile: 'acqua', da: [0, 0, 0], dir: 0,
  griglia: [[-6, -3.5], [-6, 3.5], [-13, -3.5], [-13, 3.5], [-20, 0]],
};
export default function (t) {
  t.dritto(50);
  t.turbo(t.qui(), [-3, 3], 6);
  t.dritto(20);
  t.curva(90, 40);
  const c0 = t.qui();
  t.dritto(70);
  t.superficie('corrente', c0, t.qui());
  t.curva(90, 30);
  const s0 = t.qui();
  t.dritto(50);
  t.superficie('sabbia', { i: s0.i, o: 8 }, t.qui(-8), [-3, 3]);
  t.curva(-60, 35).curva(150, 30);
  t.chiudi();
}
