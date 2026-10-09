// SBP AirCare — local back office for development and tests (Rev.09 r10).
// Serves the site's static files AND the ticket API at /exec, running backoffice/apps-script/Code.gs unchanged in the
// Apps Script emulator (tools/gas-emu.mjs). Data persists to backoffice/.dev-data.json (gitignored).
//   npm run backoffice            → http://localhost:8790/a.html?ticketApi=/exec   ·   http://localhost:8790/backoffice.html?ticketApi=/exec
// env: PORT (8790) · STAFF_TOKEN (dev-token) · DATA (path) · FRESH=1 (start empty)
import http from 'node:http';
import { readFileSync, writeFileSync, existsSync, statSync, createReadStream } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGas } from './gas-emu.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PORT = +(process.env.PORT || 8790);
const DATA = process.env.DATA || join(ROOT, 'backoffice', '.dev-data.json');
const state = !process.env.FRESH && existsSync(DATA) ? JSON.parse(readFileSync(DATA, 'utf8')) : null;
const gas = createGas({ state, props: { STAFF_TOKEN: process.env.STAFF_TOKEN || 'dev-token', NOTIFY_EMAIL: process.env.NOTIFY_EMAIL || 'team@localhost', ...(process.env.SLOT_CAPACITY ? { SLOT_CAPACITY: process.env.SLOT_CAPACITY } : {}) } });
const save = () => { try { writeFileSync(DATA, JSON.stringify(gas.dump())); } catch (e) { console.warn('save failed', e.message); } };
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.webp': 'image/webp', '.jpg': 'image/jpeg' };
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' };

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/exec') {
    if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }
    if (req.method === 'GET') { res.writeHead(200, { ...cors, 'Content-Type': 'application/json' }); return res.end(JSON.stringify(gas.get(Object.fromEntries(url.searchParams)))); }
    let body = ''; req.on('data', c => { body += c; if (body.length > 1e6) req.destroy(); });
    req.on('end', () => {
      const out = gas.post(body);
      if (out.ok && /"action"\s*:\s*"(create|update)"/.test(body)) save();
      if (out.ok && /"action"\s*:\s*"create"/.test(body)) console.log('ticket', out.id, '→ mail:', gas.outbox[gas.outbox.length - 1]?.subject || '-');
      res.writeHead(200, { ...cors, 'Content-Type': 'application/json' }); res.end(JSON.stringify(out));
    });
    return;
  }
  if (url.pathname === '/__outbox') { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify(gas.outbox)); }
  // static files
  let p = normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, '');
  if (!p || p.endsWith('/')) p += 'index.html';
  const f = join(ROOT, p);
  if (!f.startsWith(ROOT) || !existsSync(f) || !statSync(f).isFile() || /(^|[/\\])(internal|node_modules)([/\\]|$)|\.dev-data\.json$/.test(p)) { res.writeHead(404); return res.end('not found'); }
  res.writeHead(200, { 'Content-Type': TYPES[extname(f).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  createReadStream(f).pipe(res);
}).listen(PORT, '127.0.0.1', () => console.log(`SBP back office (local) http://localhost:${PORT}/backoffice.html?ticketApi=/exec · site http://localhost:${PORT}/a.html?ticketApi=/exec · staff token: ${gas.props.STAFF_TOKEN}`));
