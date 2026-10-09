// Banco di prova del motore v2: l'Anello del Faro del Gran Premio (stessi 18 punti) con le colline, la sabbia all'interno di una curva,
// un tappeto del turbo e, dal secondo giro, una pozzanghera sul rettilineo del via (evento firma di prova).
export const meta = {
  id: 'prova_anello', nome: 'Anello di prova', zona: 'prova', famiglia: 'ruote', tipo: 'circuito', giri: 3, chiusa: true,
  larghezza: 6.5, bordo: 3, muro: 0.7, superficie: 'asfalto', bordoTipo: 'erba', stile: 'strada', da: [0, 0, 0], dir: 0,
};
const PUNTI = [
  [60, 0, 0], [100, 1, 5], [125, 3, 25], [130, 5, 55], [115, 6, 80], [85, 6, 88], [60, 5, 78], [45, 3, 60], [25, 2, 55],
  [5, 2, 65], [-10, 3, 90], [-35, 4, 100], [-65, 4, 92], [-85, 3, 70], [-90, 2, 40], [-80, 1, 15], [-50, 0, 2],
];
export default function (t) {
  const via = t.qui();
  t.vai(PUNTI[0]);
  t.evento('pozzanghera', 2, 'acquaBassa', { i: via.i, o: 12 }, t.qui(-8), [-6.5, -1]);
  for (let i = 1; i < PUNTI.length; i++) {
    const a = t.qui();
    t.vai(PUNTI[i]);
    if (i === 7 || i === 8) t.superficie('sabbia', a, t.qui(), [2.5, 9.5]); // l'interno della curva a destra
    if (i === 15) t.turbo(a, [-3, 3], 6);
  }
}
