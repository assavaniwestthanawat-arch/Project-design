// SBP AirCare server — staff accounts and sessions. Rev.10.
// The Apps Script back office had one shared STAFF_TOKEN and a self-typed staff name. Production adds per-person
// accounts (scrypt password hashes, 12-hour sessions, roles) so every status change and every payment is attributed to a
// real person. The staff board keeps its two login fields: "ชื่อผู้ใช้" + "รหัสผ่าน" → {action:'login'} → a session
// token that the board then sends exactly where it used to send STAFF_TOKEN. STAFF_TOKEN still works when set
// (legacy / first login), as role admin.
import { scryptSync, randomBytes, timingSafeEqual } from 'node:crypto';
import { sha256, token, safeEqual, str, now, nowMs } from './util.mjs';
import { audit } from './db.mjs';

export const ROLES = { admin: 'ผู้ดูแล', staff: 'เจ้าหน้าที่', tech: 'ช่าง' };
const SESSION_MS = 12 * 3600e3;
const N = 16384, R = 8, P = 1, KEYLEN = 32;

export function hashPw(pw) {
  const salt = randomBytes(16);
  const h = scryptSync(String(pw), salt, KEYLEN, { N, r: R, p: P });
  return `scrypt$${N}$${R}$${P}$${salt.toString('base64')}$${h.toString('base64')}`;
}
export function verifyPw(pw, stored) {
  const [alg, n, r, p, salt, hash] = String(stored || '').split('$');
  if (alg !== 'scrypt') return false;
  const want = Buffer.from(hash, 'base64');
  const got = scryptSync(String(pw), Buffer.from(salt, 'base64'), want.length, { N: +n, r: +r, p: +p });
  return got.length === want.length && timingSafeEqual(got, want);
}
let dummy = null;
const DUMMY_GET = () => dummy || (dummy = hashPw(randomBytes(12).toString('hex')));
export const pwProblem = pw => (typeof pw !== 'string' || pw.length < 10 ? 'รหัสผ่านต้องยาวอย่างน้อย 10 ตัวอักษร' : null);

export function addStaff(db, { username, name, role = 'staff', password }) {
  username = str(username, 40).toLowerCase();
  if (!/^[a-z0-9._-]{3,40}$/.test(username)) throw new Error('username: 3–40 ตัว a-z 0-9 . _ -');
  if (!ROLES[role]) throw new Error('role: admin | staff | tech');
  const bad = pwProblem(password); if (bad) throw new Error(bad);
  db.prepare(`INSERT INTO staff (username, name, role, pwHash, createdAt) VALUES (?, ?, ?, ?, ?)`).run(username, str(name) || username, role, hashPw(password), now());
  audit(db, 'cli', 'staff.add', '', { username, role });
}
export function setPassword(db, username, password) {
  const bad = pwProblem(password); if (bad) throw new Error(bad);
  const r = db.prepare(`UPDATE staff SET pwHash = ? WHERE username = ?`).run(hashPw(password), str(username, 40).toLowerCase());
  if (!r.changes) throw new Error('ไม่พบผู้ใช้');
  db.prepare(`DELETE FROM sessions WHERE staffId = (SELECT id FROM staff WHERE username = ?)`).run(str(username, 40).toLowerCase());
}
export function setActive(db, username, active) {
  const r = db.prepare(`UPDATE staff SET active = ? WHERE username = ?`).run(active ? 1 : 0, str(username, 40).toLowerCase());
  if (!r.changes) throw new Error('ไม่พบผู้ใช้');
  if (!active) db.prepare(`DELETE FROM sessions WHERE staffId = (SELECT id FROM staff WHERE username = ?)`).run(str(username, 40).toLowerCase());
}

export function login(ctx, b, req) {
  const { db, rl, cfg } = ctx;
  const ip = req && req.ip || '', user = str(b.user, 40).toLowerCase(), W = 15 * 60e3, max = cfg.limits.loginPerIp;
  // only FAILED attempts count (per address and per username): a shared office address must not lock the team out
  if (!rl.peek('login:ip:' + ip, max) || !rl.peek('login:u:' + user, max)) return { ok: false, error: 'rate_limited' };
  const u = db.prepare(`SELECT * FROM staff WHERE username = ? AND active = 1`).get(user);
  // an unknown user still pays for one scrypt, so the reply time does not tell which usernames exist
  if (!verifyPw(String(b.password || ''), u ? u.pwHash : DUMMY_GET()) || !u) {
    rl.hit('login:ip:' + ip, max, W); rl.hit('login:u:' + user, max, W);
    audit(db, str(b.user, 40) || '-', 'staff.login_failed', '', { ip: sha256('ip:' + ip).slice(0, 12) }); return { ok: false, error: 'unauthorized' };
  }
  const tk = token(32);
  db.prepare(`DELETE FROM sessions WHERE expiresMs < ?`).run(nowMs());
  db.prepare(`INSERT INTO sessions (tokenHash, staffId, createdAt, expiresMs) VALUES (?, ?, ?, ?)`).run(sha256(tk), u.id, now(), nowMs() + SESSION_MS);
  db.prepare(`UPDATE staff SET lastLogin = ? WHERE id = ?`).run(now(), u.id);
  audit(db, u.name, 'staff.login', '', '');
  return { ok: true, token: tk, name: u.name, role: u.role, roleTh: ROLES[u.role] };
}
export function logout(ctx, tk) { if (tk) ctx.db.prepare(`DELETE FROM sessions WHERE tokenHash = ?`).run(sha256(String(tk))); return { ok: true }; }

// → {staff:{id,name,role}} | {error}
export function authenticate(ctx, tk, typedName, req) {
  const { db, cfg, rl } = ctx;
  const accounts = db.prepare(`SELECT COUNT(*) n FROM staff WHERE active = 1`).get().n;
  if (!cfg.staffToken && !accounts) return { error: 'staff_disabled' };
  const ip = req && req.ip || '';
  if (tk && typeof tk === 'string') {
    const s = db.prepare(`SELECT s.expiresMs, st.id, st.name, st.role FROM sessions s JOIN staff st ON st.id = s.staffId WHERE s.tokenHash = ? AND st.active = 1`).get(sha256(tk));
    if (s && s.expiresMs > nowMs()) {
      if (s.expiresMs - nowMs() < SESSION_MS / 2) db.prepare(`UPDATE sessions SET expiresMs = ? WHERE tokenHash = ?`).run(nowMs() + SESSION_MS, sha256(tk));   // sliding
      return { staff: { id: s.id, name: s.name, role: s.role } };
    }
    if (cfg.staffToken && safeEqual(tk, cfg.staffToken)) return { staff: { id: 0, name: str(typedName) || 'staff', role: 'admin', legacy: true } };
  }
  if (!rl.hit('auth:fail:' + ip, 30, 15 * 60e3)) return { error: 'rate_limited' };
  return { error: 'unauthorized' };
}
