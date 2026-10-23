#!/usr/bin/env node
// Inviti e link personali di MAREA per chi sviluppa (admin), senza login Cloudflare e senza passare da nessuno.
// Uso:
//   node apps/server/scripts/admin.mjs invito [--usi N]          link di gruppo per N persone (di serie 7): chi lo apre scrive il nome e ha la sua isola
//   node apps/server/scripts/admin.mjs link <nome|id> [--ruota]  il link personale di un personaggio esistente (--ruota: ne fa uno nuovo e invalida il vecchio)
//   node apps/server/scripts/admin.mjs admin <nome|id> [--togli] fa (o toglie) admin a un personaggio
// Si presenta col TUO link personale: variabile MAREA_TOKEN (il token o l'intero link) oppure il file ~/.config/marea/link.txt (una riga: il tuo link).
// `--locale` parla col server di `npm run dev:server` (http://localhost:8787) invece che con quello online; `--url <indirizzo>` per altri.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const args = process.argv.slice(2);
const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
const flag = (k) => args.includes(k);
const falla = (m) => { console.error(m); process.exit(1); };

const comando = args[0];
const base = opt('--url') ?? (flag('--locale') ? 'http://localhost:8787' : 'https://marea.stanza-idee.workers.dev');
const valoriOpt = new Set(['--usi', '--url']);
const persona = args.slice(1).find((a, i, tutti) => !a.startsWith('--') && !valoriOpt.has(tutti[i - 1]));
if (!['invito', 'link', 'admin'].includes(comando ?? '') || (comando !== 'invito' && !persona)) {
  falla('Uso: admin.mjs invito [--usi N] | link <nome|id> [--ruota] | admin <nome|id> [--togli]   (--locale per il server locale)');
}

const FILE = path.join(os.homedir(), '.config/marea/link.txt');
let grezzo = process.env.MAREA_TOKEN?.trim() || (fs.existsSync(FILE) ? fs.readFileSync(FILE, 'utf8').trim() : '');
if (!grezzo) falla(`Mi serve il tuo link personale di MAREA: mettilo in ${FILE} (una riga) oppure nella variabile MAREA_TOKEN.\nNon ce l'hai? Chiedilo a un altro dev (admin.mjs link <tuo nome>) o a chi ti ha invitato.`);
// il file può avere righe di commento: vale il primo `t=…` che si trova, altrimenti la prima riga che non è un commento
const token = grezzo.match(/[?&]t=([A-Za-z0-9_-]+)/)?.[1] ?? grezzo.split('\n').map((r) => r.trim()).find((r) => r && !/^(#|\/\/)/.test(r) && !/\s/.test(r));
if (!token) falla('Nel file del tuo link non trovo il token: ci vuole una riga come https://marea.stanza-idee.workers.dev/?t=...');

const corpo = comando === 'invito' ? { usi: opt('--usi') === undefined ? undefined : Number(opt('--usi')) }
  : comando === 'link' ? { persona, ruota: flag('--ruota') } : { persona, admin: !flag('--togli') };
const r = await fetch(`${base}/api/admin/${comando}`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-token': token }, body: JSON.stringify(corpo) }).catch((e) => falla(`Il server non risponde (${base}): ${e.cause?.code ?? e.message}`));
const out = await r.json().catch(() => ({}));
if (!r.ok) {
  falla(`${out.error ?? `Errore ${r.status}`}${out.scelte ? '\n' + out.scelte.map((s) => `  - ${s.nome}: ${s.id}`).join('\n') : ''}`);
}
if (comando === 'invito') console.log(`Invito di gruppo per ${out.usi} persone:\n${out.url}`);
else if (comando === 'link') console.log(`Link di ${out.nome}${out.ruotato ? ' (NUOVO: quello vecchio non vale più)' : ''}, da mandare solo a lui/lei:\n${out.url}`);
else console.log(`${out.nome} ${out.admin ? 'ora è admin' : 'non è più admin'}.`);
