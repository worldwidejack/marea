// Banco dei pixel: serve la pagina e salva i segni di Jack (in Node: il Python di Homebrew lanciato dall'app non legge il Desktop).
// GET  /           la pagina (index.html) e i file della cartella
// GET  /segni      lo stato dei segni (segni.json)
// POST /segni      un segno {personaggio, sprite, voto, punti, nota} o una nota generale {personaggio, generale}:
//                  aggiorna segni.json e aggiunge una riga a segni.jsonl (tutti gli invii, anche quelli poi cambiati)
// Ogni errore va in errori.jsonl. Solo su questo Mac (127.0.0.1).
// uso: node _banco/pixel_lab/server.mjs [porta]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const QUI = path.dirname(fileURLToPath(import.meta.url));
const SEGNI = path.join(QUI, 'segni.json'), REGISTRO = path.join(QUI, 'segni.jsonl'), ERRORI = path.join(QUI, 'errori.jsonl');
const TIPI = { '.html': 'text/html; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.js': 'text/javascript' };
const ora = () => new Date().toLocaleString('sv-SE', { timeZone: 'Europe/Rome' });
const leggi = () => (fs.existsSync(SEGNI) ? JSON.parse(fs.readFileSync(SEGNI, 'utf8')) : { sprite: {}, generale: {} });
const registra = (f, riga) => fs.appendFileSync(f, JSON.stringify(riga) + '\n');
const rispondi = (res, codice, dati) => { res.writeHead(codice, { 'Content-Type': TIPI['.json'], 'Cache-Control': 'no-store' }); res.end(JSON.stringify(dati)); };

http.createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/segni' && req.method === 'GET') return rispondi(res, 200, leggi());
  if (p === '/segni' && req.method === 'POST') {
    let corpo = '';
    req.on('data', (c) => { corpo += c; });
    req.on('end', () => {
      try {
        const d = JSON.parse(corpo || '{}');
        if (!d.personaggio) throw new Error('manca il personaggio');
        const s = leggi();
        if ('generale' in d) s.generale[d.personaggio] = { nota: String(d.generale), quando: ora() };
        else s.sprite[`${d.personaggio}/${d.sprite}`] = { voto: d.voto ?? null, punti: d.punti ?? [], nota: String(d.nota ?? ''), quando: ora() };
        fs.writeFileSync(SEGNI + '.tmp', JSON.stringify(s, null, 1)); fs.renameSync(SEGNI + '.tmp', SEGNI);
        registra(REGISTRO, { ...d, quando: ora() });
        rispondi(res, 200, { ok: true, quando: ora() });
      } catch (e) {
        registra(ERRORI, { quando: ora(), errore: String(e), path: p });
        rispondi(res, 400, { ok: false, errore: String(e.message ?? e) });
      }
    });
    return;
  }
  const f = path.join(QUI, path.normalize(p === '/' ? '/index.html' : p));
  if (!f.startsWith(QUI) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('non c\'è'); }
  res.writeHead(200, { 'Content-Type': TIPI[path.extname(f)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(f).pipe(res);
}).listen(+(process.argv[2] || 5177), '127.0.0.1', () => console.log(`banco dei pixel su http://127.0.0.1:${process.argv[2] || 5177}/`));
