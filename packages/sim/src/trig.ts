// Seno, coseno, arcotangente e ipotenusa deterministici: gli stessi bit su ogni motore JS (V8 di Node, di Chrome e di workerd,
// JavaScriptCore di Safari). Le Math.sin/cos/atan2/… dei motori no: il 9/10/2026 Node 26 e workerd davano risultati diversi nell'ultima
// cifra, e il server che rigioca una partita in barca contava ogni tanto un pacco in meno delle Consegne (#169). Qui solo + − × ÷,
// Math.sqrt, Math.round e Math.abs (IEEE 754: esatti ovunque). Polinomi e costanti di fdlibm (Sun, via musl): errore < 1 ulp circa.
// In packages/sim le funzioni trascendenti di Math sono vietate fuori da questo file (tools/check_static.mjs).

// ---------- seno e coseno ----------
const INVPIO2 = 6.36619772367581382433e-1, PIO4 = 0.7853981633974483;
// π/2 a pezzi (33 + 33 bit e la coda), per togliere n·π/2 senza perdere cifre
const PIO2_1 = 1.57079632673412561417, PIO2_2 = 6.07710050630396597660e-11, PIO2_2T = 2.02226624879595063154e-21;
const S1 = -1.66666666666666324348e-1, S2 = 8.33333333332248946124e-3, S3 = -1.98412698298579493134e-4, S4 = 2.75573137070700676789e-6,
  S5 = -2.50507602534068634195e-8, S6 = 1.58969099521155010221e-10;
const C1 = 4.16666666666666019037e-2, C2 = -1.38888888888741095749e-3, C3 = 2.48015872894767294178e-5, C4 = -2.75573143513906633035e-7,
  C5 = 2.08757232129817482790e-9, C6 = -1.13596475577881948265e-11;

/** sin(x + y) per |x| ≤ π/4 (y = coda della riduzione). */
function kSin(x: number, y: number): number {
  const z = x * x, w = z * z, r = S2 + z * (S3 + z * S4) + z * w * (S5 + z * S6), v = z * x;
  return y === 0 ? x + v * (S1 + z * r) : x - ((z * (0.5 * y - v * r) - y) - v * S1);
}
/** cos(x + y) per |x| ≤ π/4. */
function kCos(x: number, y: number): number {
  const z = x * x, w = z * z, r = z * (C1 + z * (C2 + z * C3)) + w * w * (C4 + z * (C5 + z * C6)), hz = 0.5 * z, u = 1 - hz;
  return u + (((1 - u) - hz) + (z * r - x * y));
}
/** x = n·π/2 + (y0 + y1), |y0| ≤ π/4 circa; n modulo 4. Cody-Waite in due passate: precisa per gli angoli del gioco (|x| ≲ 1e6). */
function riduci(x: number): [number, number, number] {
  if (Math.abs(x) <= PIO4) return [0, x, 0];
  const fn = Math.round(x * INVPIO2), t = x - fn * PIO2_1, p = fn * PIO2_2, r = t - p, w = fn * PIO2_2T - ((t - r) - p), y0 = r - w;
  return [((fn % 4) + 4) % 4, y0, (r - y0) - w];
}

export function sin(x: number): number {
  if (x === 0) return x; // ±0 come Math.sin
  const [n, a, b] = riduci(x);
  return n === 0 ? kSin(a, b) : n === 1 ? kCos(a, b) : n === 2 ? -kSin(a, b) : -kCos(a, b);
}
export function cos(x: number): number {
  const [n, a, b] = riduci(x);
  return n === 0 ? kCos(a, b) : n === 1 ? -kSin(a, b) : n === 2 ? -kCos(a, b) : kSin(a, b);
}

// ---------- arcotangente ----------
const ATANHI = [4.63647609000806093515e-1, 7.85398163397448278999e-1, 9.82793723247329054082e-1, 1.57079632679489655800] as const;
const ATANLO = [2.26987774529616870924e-17, 3.06161699786838301793e-17, 1.39033110312309984516e-17, 6.12323399573676603587e-17] as const;
const AT = [3.33333333333329318027e-1, -1.99999999998764832476e-1, 1.42857142725034663711e-1, -1.11111104054623557880e-1,
  9.09088713343650656196e-2, -7.69187620504482999495e-2, 6.66107313738753120669e-2, -5.83357013379057348645e-2,
  4.97687799461593236017e-2, -3.65315727442169155270e-2, 1.62858201153657823623e-2] as const;
const PI = 3.14159265358979311600, PI_LO = 1.22464679914735317720e-16, PIO2 = 1.57079632679489655800;
const negativo = (v: number): boolean => v < 0 || Object.is(v, -0);

export function atan(x: number): number {
  if (x !== x) return x;
  const neg = negativo(x);
  let t = neg ? -x : x, id: number;
  if (t >= 7.378697629483821e19) return neg ? -(ATANHI[3] + ATANLO[3]) : ATANHI[3] + ATANLO[3]; // ≥ 2^66
  if (t < 0.4375) {
    if (t < 3.725290298461914e-9) return x; // < 2^-28
    id = -1;
  } else if (t < 1.1875) {
    if (t < 0.6875) { id = 0; t = (2 * t - 1) / (2 + t); } else { id = 1; t = (t - 1) / (t + 1); }
  } else if (t < 2.4375) { id = 2; t = (t - 1.5) / (1 + 1.5 * t); } else { id = 3; t = -1 / t; }
  const z = t * t, w = z * z;
  const s1 = z * (AT[0] + w * (AT[2] + w * (AT[4] + w * (AT[6] + w * (AT[8] + w * AT[10])))));
  const s2 = w * (AT[1] + w * (AT[3] + w * (AT[5] + w * (AT[7] + w * AT[9]))));
  const r = id < 0 ? t - t * (s1 + s2) : ATANHI[id]! - ((t * (s1 + s2) - ATANLO[id]!) - t);
  return neg ? -r : r;
}

/** Come Math.atan2 (zeri col segno e infiniti compresi). */
export function atan2(y: number, x: number): number {
  if (x !== x || y !== y) return NaN;
  if (x === 1) return atan(y);
  const m = (negativo(y) ? 1 : 0) | (negativo(x) ? 2 : 0);
  if (y === 0) return m === 2 ? PI : m === 3 ? -PI : y;
  if (x === 0) return m & 1 ? -PIO2 : PIO2;
  if (x === Infinity || x === -Infinity) {
    if (y === Infinity || y === -Infinity) return [PI / 4, -PI / 4, 3 * PI / 4, -3 * PI / 4][m]!;
    return [0, -0, PI, -PI][m]!;
  }
  if (y === Infinity || y === -Infinity) return m & 1 ? -PIO2 : PIO2;
  const q = Math.abs(y / x);
  if (q > 1.152921504606847e18) return m & 1 ? -(PIO2 + 0.5 * PI_LO) : PIO2 + 0.5 * PI_LO; // |y/x| > 2^60: ±π/2, il segno di x non conta
  const z = m & 2 && q < 8.673617379884035e-19 ? 0 : atan(q); // x < 0 e |y/x| < 2^-60: ±π
  return m === 0 ? z : m === 1 ? -z : m === 2 ? PI - (z - PI_LO) : (z - PI_LO) - PI;
}

/** √(x² + y²): Math.hypot cambia algoritmo da motore a motore. */
export const hypot = (x: number, y: number): number => Math.sqrt(x * x + y * y);
