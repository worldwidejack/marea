#!/usr/bin/env node
// Crea un link di invito per il gruppo (lo stesso link per tutti): chi lo apre scrive il nome e ha la sua isola.
// Uso: node apps/server/scripts/invito_gruppo.mjs [--usi N] [--remote] [--persist-to dir] [--codice xyz]
// Default: 7 ingressi, database LOCALE. `--remote` scrive nel database online.
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SERVER = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
const remote = args.includes('--remote');
const usi = Number(opt('--usi') ?? 7);
const codice = opt('--codice') ?? crypto.randomBytes(9).toString('base64url');
if (!Number.isInteger(usi) || usi < 1 || usi > 50) { console.error('--usi tra 1 e 50'); process.exit(1); }
if (!/^[A-Za-z0-9_-]{4,40}$/.test(codice)) { console.error('codice non valido'); process.exit(1); }
const where = remote ? ['--remote'] : ['--local', ...(opt('--persist-to') ? ['--persist-to', opt('--persist-to')] : [])];
execFileSync('npx', ['--no-install', 'wrangler', 'd1', 'execute', 'DB', ...where, '--command',
  `INSERT INTO inviti (codice, creato_da, max_usi) VALUES ('${codice}', 'jack', ${usi});`], { cwd: SERVER, stdio: ['ignore', 'pipe', 'inherit'], env: { ...process.env, CI: '1' } });
const base = remote ? 'https://marea.stanza-idee.workers.dev' : 'http://localhost:8787';
console.log(`Invito di gruppo per ${usi} persone${remote ? ' (online)' : ' (locale)'}:`);
console.log(`${base}/?invito=${codice}`);
