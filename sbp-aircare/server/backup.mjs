// SBP AirCare server — online backup + verification (restore drill). Rev.10.
// VACUUM INTO writes a consistent, compacted copy while the site keeps running (WAL); each copy is opened again and must
// pass PRAGMA integrity_check before it counts. Keep copies OFF the server too (deploy/DEPLOY_TH.md: rclone to cloud storage).
//   node server/backup.mjs                 → back up DB_FILE into BACKUP_DIR, keep the newest BACKUP_KEEP
//   node server/backup.mjs --verify <file> → integrity + row counts of a backup (or any copy you are about to restore)
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readdirSync, statSync, unlinkSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { now } from './util.mjs';

export function verifyBackup(file) {
  if (!existsSync(file)) return { ok: false, error: 'missing' };
  const db = new DatabaseSync(file);
  try {
    const integrity = db.prepare('PRAGMA integrity_check').get().integrity_check;
    const count = t => { try { return db.prepare(`SELECT COUNT(*) n FROM ${t}`).get().n; } catch (e) { return null; } };
    const latest = (() => { try { return db.prepare(`SELECT id, createdAt FROM tickets ORDER BY createdAt DESC LIMIT 1`).get() || null; } catch (e) { return null; } })();
    const schema = (() => { try { return +db.prepare(`SELECT v FROM meta WHERE k = 'schema'`).get().v; } catch (e) { return null; } })();
    return { ok: integrity === 'ok' && schema != null, integrity, schema, tickets: count('tickets'), payments: count('payments'), refunds: count('refunds'), staff: count('staff'), latest };
  } finally { db.close(); }
}

export function backupNow(db, cfg) {
  mkdirSync(cfg.backupDir, { recursive: true });
  // one file per second (the name pattern below is also used by deploy/offsite-backup.sh) — a second run in the same second waits
  const name = () => join(cfg.backupDir, `aircare-${now().replace(/[-: ]/g, '').replace(/^(\d{8})(\d{6})$/, '$1-$2')}.sqlite`);
  let file = name();
  for (let i = 0; i < 12 && existsSync(file); i++) { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250); file = name(); }
  db.exec(`VACUUM INTO '${file.replace(/'/g, "''")}'`);
  const v = verifyBackup(file);
  if (!v.ok) throw new Error('backup verification failed: ' + JSON.stringify(v));
  // keep the newest N copies
  const all = readdirSync(cfg.backupDir).filter(f => /^aircare-\d{8}-\d{6}\.sqlite$/.test(f)).sort();
  for (const f of all.slice(0, Math.max(0, all.length - Math.max(1, cfg.backupKeep)))) unlinkSync(join(cfg.backupDir, f));
  return { file, bytes: statSync(file).size, ...v };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { loadConfig } = await import('./config.mjs');
  const { openDb } = await import('./db.mjs');
  const cfg = loadConfig();
  const i = process.argv.indexOf('--verify');
  if (i > 0) { const r = verifyBackup(resolve(process.argv[i + 1] || '')); console.log(JSON.stringify(r, null, 1)); process.exit(r.ok ? 0 : 1); }
  const db = openDb(cfg.dbFile);
  try { console.log(JSON.stringify(backupNow(db, cfg), null, 1)); } finally { db.close(); }
}
