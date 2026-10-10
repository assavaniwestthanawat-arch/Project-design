#!/usr/bin/env node
// SBP AirCare — admin command line (run on the server, same environment as the site). Rev.10.
//   node server/cli.mjs staff add <username> "<ชื่อที่แสดง>" <admin|staff|tech>   (asks for the password; or STAFF_PASSWORD=…)
//   node server/cli.mjs staff passwd <username> · staff disable <username> · staff enable <username> · staff list
//   node server/cli.mjs backup · verify-backup <file> · restore <file>   (restore: stop the service first)
//   node server/cli.mjs export <ticket id>        PDPA access request → JSON on stdout
//   node server/cli.mjs anonymize <ticket id>     PDPA erasure request (money records stay for accounting)
//   node server/cli.mjs retention <days>          erase personal data of finished tickets older than <days>
//   node server/cli.mjs outbox                    undelivered notices (failed / pending)
import { copyFileSync, existsSync, renameSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { loadConfig } from './config.mjs';
import { openDb } from './db.mjs';
import { addStaff, setPassword, setActive, ROLES } from './staff.mjs';
import { backupNow, verifyBackup } from './backup.mjs';
import { exportTicket, anonymizeTicket, anonymizeOld } from './retention.mjs';

const cfg = loadConfig();
const [cmd, sub, ...rest] = process.argv.slice(2);
const die = m => { console.error('✗ ' + m); process.exit(1); };

function askHidden(q) {
  if (process.env.STAFF_PASSWORD) return Promise.resolve(process.env.STAFF_PASSWORD);
  return new Promise(res => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = s => { if (s.includes(q)) process.stdout.write(s); };   // do not echo the password
    rl.question(q, a => { rl.close(); process.stdout.write('\n'); res(a); });
  });
}

if (cmd === 'restore') {
  const src = sub; if (!src || !existsSync(src)) die('ระบุไฟล์ backup ที่มีอยู่');
  const v = verifyBackup(src); if (!v.ok) die('ไฟล์ backup ไม่ผ่านการตรวจ: ' + JSON.stringify(v));
  if (existsSync(cfg.dbFile)) { const keep = cfg.dbFile + '.before-restore-' + Date.now(); renameSync(cfg.dbFile, keep); console.log('เก็บฐานข้อมูลเดิมไว้ที่', keep); }
  for (const x of ['-wal', '-shm']) if (existsSync(cfg.dbFile + x)) renameSync(cfg.dbFile + x, cfg.dbFile + x + '.old');
  copyFileSync(src, cfg.dbFile);
  console.log('กู้คืนแล้ว', JSON.stringify(verifyBackup(cfg.dbFile)));
  process.exit(0);
}
if (cmd === 'verify-backup') { const r = verifyBackup(sub || ''); console.log(JSON.stringify(r, null, 1)); process.exit(r.ok ? 0 : 1); }

const db = openDb(cfg.dbFile);
try {
  if (cmd === 'staff') {
    if (sub === 'add') {
      const [username, name, role = 'staff'] = rest;
      if (!username || !name) die('staff add <username> "<ชื่อ>" <admin|staff|tech>');
      const pw = await askHidden('รหัสผ่าน (อย่างน้อย 10 ตัว): ');
      addStaff(db, { username, name, role, password: pw }); console.log(`เพิ่ม ${username} (${ROLES[role]}) แล้ว`);
    } else if (sub === 'passwd') {
      const pw = await askHidden('รหัสผ่านใหม่: '); setPassword(db, rest[0], pw); console.log('เปลี่ยนรหัสผ่านแล้ว (ออกจากระบบทุกเครื่องของผู้ใช้นี้)');
    } else if (sub === 'disable' || sub === 'enable') { setActive(db, rest[0], sub === 'enable'); console.log('อัปเดตแล้ว'); }
    else if (sub === 'list') console.table(db.prepare(`SELECT username, name, role, active, createdAt, lastLogin FROM staff ORDER BY id`).all());
    else die('staff add | passwd | disable | enable | list');
  } else if (cmd === 'backup') console.log(JSON.stringify(backupNow(db, cfg), null, 1));
  else if (cmd === 'export') { const r = exportTicket(db, sub); if (!r) die('ไม่พบเลขที่คำขอ'); console.log(JSON.stringify(r, null, 1)); }
  else if (cmd === 'anonymize') { if (!anonymizeTicket(db, sub, 'cli')) die('ไม่พบเลขที่คำขอ'); console.log('ลบข้อมูลส่วนบุคคลของ', sub, 'แล้ว'); }
  else if (cmd === 'retention') console.log(JSON.stringify(anonymizeOld(db, +sub)));
  else if (cmd === 'outbox') console.table(db.prepare(`SELECT id, channel, status, attempts, lastError, ticketId, createdAt FROM outbox WHERE status IN ('pending','failed') ORDER BY id DESC LIMIT 50`).all());
  else die('คำสั่ง: staff | backup | verify-backup | restore | export | anonymize | retention | outbox');
} catch (e) { die(e.message); } finally { db.close(); }
