#!/usr/bin/env node
// Crea una persona di MAREA e stampa il suo link personale da mandare su WhatsApp.
// Uso: node apps/server/scripts/invita.mjs "Nome" [--remote] [--admin] [--id slug] [--token tok] [--persist-to dir]
// Default: database LOCALE (wrangler dev). `--remote` scrive nel database online (solo Jack/orchestratore).
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SERVER = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const URL_ONLINE = 'https://marea.stanza-idee.workers.dev';
const args = process.argv.slice(2);
const flag = (k) => args.includes(k);
const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
const skip = new Set(['--id', '--token', '--persist-to'].flatMap((k) => { const i = args.indexOf(k); return i >= 0 ? [i, i + 1] : []; }));
const nome = args.find((a, i) => !a.startsWith('--') && !skip.has(i));
if (!nome || nome.length > 40) { console.error('Uso: node apps/server/scripts/invita.mjs "Nome" [--remote] [--admin] [--id slug]'); process.exit(1); }

const slug = (s) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 32) || 'amico';
const id = opt('--id') ?? slug(nome);
const token = opt('--token') ?? crypto.randomBytes(18).toString('base64url');
if (!/^[a-z0-9_-]{1,40}$/.test(id)) { console.error('id non valido: solo a-z 0-9 - _'); process.exit(1); }
const q = (s) => "'" + String(s).replace(/'/g, "''") + "'";
const sql = `INSERT INTO persone (id, nome, token, admin) VALUES (${q(id)}, ${q(nome)}, ${q(token)}, ${flag('--admin') ? 1 : 0});`;
const where = flag('--remote') ? ['--remote'] : ['--local', ...(opt('--persist-to') ? ['--persist-to', opt('--persist-to')] : [])];

try {
  execFileSync('npx', ['--no-install', 'wrangler', 'd1', 'execute', 'DB', ...where, '--command', sql], { cwd: SERVER, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, CI: '1' } });
} catch (e) {
  const out = String(e.stdout ?? '') + String(e.stderr ?? '');
  if (/UNIQUE/i.test(out)) console.error(`Esiste già una persona con id "${id}": usa --id altro-id`);
  else console.error('[marea] wrangler d1 execute failed\n' + out.split('\n').slice(-15).join('\n'));
  process.exit(1);
}
const base = flag('--remote') ? URL_ONLINE : 'http://localhost:8787';
console.log(`${nome} (${id}) creato${flag('--remote') ? ' online' : ' in locale'}.`);
console.log(`${base}/?t=${token}`);
