#!/usr/bin/env node
// SBP AirCare — production server entry. Rev.10.
//   npm start                      (reads the environment; deploy/.env.example lists every variable)
//   NODE_ENV=production … npm start  refuses to start with an unsafe configuration (checkConfig)
// Listens on HOST:PORT (default 127.0.0.1:8080) behind Caddy (HTTPS, deploy/Caddyfile). Background jobs: outbox delivery
// (15 s), rate-limit sweep, gateway polling (phase 2), optional nightly backup (BACKUP_AT=03:15) and PDPA retention.
import http from 'node:http';
import { loadConfig, checkConfig, VERSION } from './config.mjs';
import { createApp } from './app.mjs';
import { addStaff } from './staff.mjs';
import { backupNow } from './backup.mjs';
import { anonymizeOld } from './retention.mjs';
import { now, today } from './util.mjs';

const cfg = loadConfig();
const { errors, warnings } = checkConfig(cfg);
warnings.forEach(w => console.warn('⚠', w));
if (errors.length) { errors.forEach(e => console.error('✗', e)); process.exit(1); }

const app = await createApp(cfg);
if (cfg.bootstrapAdmin && !app.db.prepare(`SELECT COUNT(*) AS n FROM staff`).get().n) {
  try { addStaff(app.db, { ...cfg.bootstrapAdmin, role: 'admin' }); console.log(`created the first admin account "${cfg.bootstrapAdmin.username}" from ADMIN_USER / ADMIN_PASSWORD`); }
  catch (e) { console.error('✗ ADMIN_USER / ADMIN_PASSWORD:', e.message); process.exit(1); }
}
const server = http.createServer(app.handler);
server.keepAliveTimeout = 65e3; server.headersTimeout = 70e3; server.requestTimeout = 30e3;
server.listen(cfg.port, cfg.host, () => console.log(`SBP AirCare ${VERSION} · http://${cfg.host}:${cfg.port}/ · home ${cfg.home} · db ${cfg.dbFile} · mail ${cfg.mailTransport}${cfg.dev ? ' · DEV' : ''}`));

const timers = [];
timers.push(setInterval(() => app.ctx.notifier.drain().catch(e => console.error('outbox', e)), 15e3));
timers.push(setInterval(() => app.ctx.rl.sweep(), 10 * 60e3));
if (app.ctx.omise.enabled) timers.push(setInterval(async () => {
  // webhooks are not guaranteed: re-check charges still pending from the last 2 days
  const rows = app.db.prepare(`SELECT providerRef FROM payments WHERE provider = 'omise' AND status = 'pending' AND createdAt >= ?`).all(now(Date.now() - 2 * 864e5));
  for (const r of rows) {
    try { const c = await app.ctx.omise.retrieve(r.providerRef); app.ctx.payments.gatewayResult({ provider: 'omise', providerRef: c.id, ticketId: String(c.metadata?.ticket_id || ''), reqId: String(c.metadata?.req_id || ''), amount: +c.amount, status: c.status }); }
    catch (e) { console.error('omise poll', r.providerRef, e.message); }
  }
}, 5 * 60e3));
// in-process nightly backup (BACKUP_AT=HH:MM Bangkok); the systemd timer in deploy/ does the same from outside
const at = /^(\d{2}):(\d{2})$/.exec(process.env.BACKUP_AT || '');
let lastBackup = '';
if (at) timers.push(setInterval(() => {
  const t = now(); if (t.slice(11, 16) < `${at[1]}:${at[2]}` || lastBackup === today()) return;
  lastBackup = today();
  try { const r = backupNow(app.db, cfg); console.log('backup', r.file, r.bytes); } catch (e) { console.error('backup failed', e); }
}, 60e3));
// PDPA retention (RETENTION_DAYS) runs once a day on its own — it must not depend on the in-process backup being on
let lastRetention = '';
if (cfg.retentionDays > 0) timers.push(setInterval(() => {
  if (now().slice(11, 16) < '03:30' || lastRetention === today()) return;
  lastRetention = today();
  try { console.log('retention', JSON.stringify(anonymizeOld(app.db, cfg.retentionDays))); } catch (e) { console.error('retention failed', e); }
}, 60e3));

let closing = false;
const shutdown = sig => {
  if (closing) return; closing = true;
  console.log(`${sig}: closing`);
  timers.forEach(clearInterval);
  server.close(() => { app.close(); process.exit(0); });
  setTimeout(() => { app.close(); process.exit(0); }, 10e3).unref();
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
