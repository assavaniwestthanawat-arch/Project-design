// SBP AirCare server — SQLite storage (node:sqlite, WAL). Rev.10.
// The `tickets` table keeps the 35 columns of the Apps Script "Tickets" sheet in the same order and with the same names
// (backoffice/apps-script/Code.gs HEADERS) so the staff board and any export read exactly what they read before;
// production-only data lives in extra columns and separate tables (payments, staff, outbox, audit).
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { now } from './util.mjs';

export const HEADERS = ['id', 'createdAt', 'status', 'kind', 'service', 'units', 'teamDays', 'prefDate', 'slot', 'altDate', 'name', 'tel', 'email', 'company',
  'taxInvoice', 'taxName', 'taxId', 'address', 'area', 'zoneTier', 'travelFee', 'building', 'access', 'quoteTotalEx', 'quoteLines', 'details', 'notes',
  'source', 'team', 'schedDate', 'schedSlot', 'staffNote', 'updatedAt', 'history', 'payload'];
const NUMERIC = new Set(['teamDays', 'travelFee', 'quoteTotalEx']);   // '' or a number, like the sheet

const MIGRATIONS = [
  // 1 — tickets (sheet columns + production extras), id counters, staff accounts, sessions, audit
  `CREATE TABLE tickets (
    ${HEADERS.map(k => `${k} ${NUMERIC.has(k) ? 'REAL' : "TEXT NOT NULL DEFAULT ''"}`).join(',\n    ')},
    quoteJson TEXT NOT NULL DEFAULT '', priceCheck TEXT NOT NULL DEFAULT '', consentText TEXT NOT NULL DEFAULT '', consentAt TEXT NOT NULL DEFAULT '',
    rid TEXT NOT NULL DEFAULT '', ipHash TEXT NOT NULL DEFAULT '', anonymizedAt TEXT NOT NULL DEFAULT '',
    PRIMARY KEY (id)
  );
  CREATE INDEX tickets_created ON tickets(createdAt);
  CREATE INDEX tickets_status ON tickets(status);
  CREATE INDEX tickets_tel ON tickets(tel);
  CREATE INDEX tickets_rid ON tickets(rid) WHERE rid <> '';
  CREATE TABLE seq (k TEXT PRIMARY KEY, n INTEGER NOT NULL);
  CREATE TABLE staff (id INTEGER PRIMARY KEY, username TEXT NOT NULL UNIQUE, name TEXT NOT NULL, role TEXT NOT NULL CHECK (role IN ('admin','staff','tech')),
    pwHash TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, createdAt TEXT NOT NULL, lastLogin TEXT NOT NULL DEFAULT '');
  CREATE TABLE sessions (tokenHash TEXT PRIMARY KEY, staffId INTEGER NOT NULL REFERENCES staff(id), createdAt TEXT NOT NULL, expiresMs INTEGER NOT NULL);
  CREATE TABLE audit (id INTEGER PRIMARY KEY, at TEXT NOT NULL, actor TEXT NOT NULL, action TEXT NOT NULL, ticketId TEXT NOT NULL DEFAULT '', detail TEXT NOT NULL DEFAULT '');
  CREATE INDEX audit_ticket ON audit(ticketId);`,
  // 2 — payments: what we ask for (payreq), what came in (payments, one row per attempt), what went back (refunds); outbox; webhook dedupe
  `CREATE TABLE payreq (id TEXT PRIMARY KEY, ticketId TEXT NOT NULL REFERENCES tickets(id), kind TEXT NOT NULL, amount INTEGER NOT NULL CHECK (amount > 0),
    status TEXT NOT NULL, ref TEXT NOT NULL UNIQUE, note TEXT NOT NULL DEFAULT '', basis TEXT NOT NULL DEFAULT '', createdAt TEXT NOT NULL, createdBy TEXT NOT NULL,
    expiresAt TEXT NOT NULL DEFAULT '', closedAt TEXT NOT NULL DEFAULT '');
  CREATE INDEX payreq_ticket ON payreq(ticketId);
  CREATE TABLE payments (id TEXT PRIMARY KEY, ticketId TEXT NOT NULL REFERENCES tickets(id), reqId TEXT NOT NULL DEFAULT '', method TEXT NOT NULL,
    provider TEXT NOT NULL DEFAULT 'manual', providerRef TEXT NOT NULL DEFAULT '', amount INTEGER NOT NULL CHECK (amount > 0), status TEXT NOT NULL,
    reference TEXT NOT NULL DEFAULT '', note TEXT NOT NULL DEFAULT '', byWho TEXT NOT NULL, createdAt TEXT NOT NULL,
    verifiedBy TEXT NOT NULL DEFAULT '', verifiedAt TEXT NOT NULL DEFAULT '', receiptNo TEXT);
  CREATE INDEX payments_ticket ON payments(ticketId);
  CREATE UNIQUE INDEX payments_receipt ON payments(receiptNo) WHERE receiptNo IS NOT NULL;
  CREATE UNIQUE INDEX payments_provider ON payments(provider, providerRef) WHERE providerRef <> '';
  CREATE TABLE refunds (id TEXT PRIMARY KEY, ticketId TEXT NOT NULL REFERENCES tickets(id), paymentId TEXT NOT NULL DEFAULT '', amount INTEGER NOT NULL CHECK (amount > 0),
    method TEXT NOT NULL, status TEXT NOT NULL, reason TEXT NOT NULL DEFAULT '', reference TEXT NOT NULL DEFAULT '', byWho TEXT NOT NULL, createdAt TEXT NOT NULL, completedAt TEXT NOT NULL DEFAULT '');
  CREATE INDEX refunds_ticket ON refunds(ticketId);
  CREATE TABLE outbox (id INTEGER PRIMARY KEY, channel TEXT NOT NULL, recipient TEXT NOT NULL, subject TEXT NOT NULL DEFAULT '', body TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', attempts INTEGER NOT NULL DEFAULT 0, nextMs INTEGER NOT NULL DEFAULT 0, lastError TEXT NOT NULL DEFAULT '',
    ticketId TEXT NOT NULL DEFAULT '', createdAt TEXT NOT NULL, sentAt TEXT NOT NULL DEFAULT '');
  CREATE INDEX outbox_pending ON outbox(status, nextMs);
  CREATE TABLE webhook_events (provider TEXT NOT NULL, eventId TEXT NOT NULL, receivedAt TEXT NOT NULL, PRIMARY KEY (provider, eventId));`,
];

export function openDb(file) {
  if (file !== ':memory:') mkdirSync(dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec(`PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;`);
  db.exec(`CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT NOT NULL)`);
  const ver = +(db.prepare(`SELECT v FROM meta WHERE k = 'schema'`).get()?.v || 0);
  for (let i = ver; i < MIGRATIONS.length; i++) {
    tx(db, () => { db.exec(MIGRATIONS[i]); db.prepare(`INSERT INTO meta (k, v) VALUES ('schema', ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v`).run(String(i + 1)); });
  }
  return db;
}

// one synchronous connection + BEGIN IMMEDIATE = the Apps Script script lock (ids and inserts can never interleave)
export function tx(db, fn) {
  db.exec('BEGIN IMMEDIATE');
  try { const r = fn(); db.exec('COMMIT'); return r; } catch (e) { try { db.exec('ROLLBACK'); } catch (_) {} throw e; }
}

// a ticket row as the sheet/board sees it: the 34 visible columns (no payload), numbers or ''
export function sheetRow(r) {
  const o = {};
  for (const k of HEADERS) if (k !== 'payload') o[k] = NUMERIC.has(k) ? (r[k] == null ? '' : r[k]) : (r[k] == null ? '' : r[k]);
  return o;
}

export function audit(db, actor, action, ticketId = '', detail = '') {
  db.prepare(`INSERT INTO audit (at, actor, action, ticketId, detail) VALUES (?, ?, ?, ?, ?)`).run(now(), String(actor).slice(0, 120), action, ticketId, typeof detail === 'string' ? detail : JSON.stringify(detail));
}
