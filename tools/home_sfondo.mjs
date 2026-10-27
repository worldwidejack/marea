#!/usr/bin/env node
// Sfondo della schermata iniziale (apps/client/index.html) dal disegno di Riccardo (assets/concept/ui/home_reference.jpg, uno screenshot
// del telefono 571×1280): via la barra di stato in alto e i bottoni disegnati in basso (quelli veri li fa la pagina).
// Scrive apps/client/public/assets/home/sfondo.webp e, dentro index.html, due immagini piccolissime in base64 così si vedono prima della rete:
//  --mz-home-mini  lo sfondo a 1/12, a quadrettoni (image-rendering: pixelated) finché non arriva quello vero
//  --mz-home-bordi la prima e la penultima colonna dello sfondo, stirate ai lati da PC (niente gradienti: righe dritte)
// Uso: node tools/home_sfondo.mjs [percorso del jpg]   (senza: assets/concept/ui/home_reference.jpg)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.resolve(process.argv[2] ?? path.join(ROOT, 'assets/concept/ui/home_reference.jpg'));
const OUT = path.join(ROOT, 'apps/client/public/assets/home/sfondo.webp');
const HTML = path.join(ROOT, 'apps/client/index.html');
const TAGLIO = { sopra: 56, sotto: 1112 }; // barra di stato (icone fino a y≈50) · cima dei bottoni disegnati (y≈1118)

const { width: W } = await sharp(SRC).metadata();
const H = TAGLIO.sotto - TAGLIO.sopra;
const taglio = () => sharp(SRC).extract({ left: 0, top: TAGLIO.sopra, width: W, height: H });
fs.mkdirSync(path.dirname(OUT), { recursive: true });
await taglio().webp({ quality: 78, effort: 6 }).toFile(OUT);
const mini = await taglio().resize(Math.round(W / 12), Math.round(H / 12), { kernel: 'cubic' }).webp({ quality: 70 }).toBuffer();
const cols = await taglio().raw().toBuffer({ resolveWithObject: true });
// una riga ogni 4 (a mano: resize di sharp su un'immagine larga 2 sbagliava i colori), tanto ai lati è stirata
const ch = cols.info.channels, hb = Math.floor(H / 4), bordi = Buffer.alloc(2 * hb * ch);
for (let y = 0; y < hb; y++) for (let c = 0; c < ch; c++) {
  bordi[(y * 2) * ch + c] = cols.data[(y * 4 * W) * ch + c];
  bordi[(y * 2 + 1) * ch + c] = cols.data[(y * 4 * W + W - 2) * ch + c]; // l'ultima colonna del jpg ha un filo scuro
}
const bordiWebp = await sharp(bordi, { raw: { width: 2, height: hb, channels: ch } }).webp({ lossless: true }).toBuffer();

const uri = (b) => `url("data:image/webp;base64,${b.toString('base64')}")`;
let html = fs.readFileSync(HTML, 'utf8');
for (const [nome, b] of [['--mz-home-mini', mini], ['--mz-home-bordi', bordiWebp]]) {
  const re = new RegExp(`(${nome}: )url\\("[^"]*"\\)`);
  if (!re.test(html)) throw new Error(`index.html: manca «${nome}: url("…")»`);
  html = html.replace(re, `$1${uri(b)}`);
}
fs.writeFileSync(HTML, html);
console.log(`sfondo ${W}×${H} ${(fs.statSync(OUT).size / 1024).toFixed(1)} KB · mini ${mini.length} B · bordi ${bordiWebp.length} B`);
