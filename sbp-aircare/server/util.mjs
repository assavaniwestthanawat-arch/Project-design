// SBP AirCare server — small shared helpers (Bangkok time, text cleaning, ids, hashing). Rev.10.
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

export const TZ_OFFSET_MS = 7 * 3600e3;   // Asia/Bangkok, no DST
// clock is injectable for tests: setClock(() => Date.parse('2026-10-09T03:00:00Z'))
let clock = () => Date.now();
export const setClock = f => { clock = f || (() => Date.now()); };
export const nowMs = () => clock();
const bkk = (ms = clock()) => new Date(ms + TZ_OFFSET_MS).toISOString();
export const now = (ms) => bkk(ms).slice(0, 19).replace('T', ' ');         // 'yyyy-MM-dd HH:mm:ss' (Gregorian, Bangkok) — same as Code.gs now_()
export const today = (ms) => bkk(ms).slice(0, 10);                          // 'yyyy-MM-dd'
export const addDays = (ymd, n) => new Date(Date.parse(ymd + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10);
export const beYear = (ms) => +bkk(ms).slice(0, 4) + 543;

export const MAX = { short: 120, mid: 400, long: 2000, payload: 30000 };
export const str = (v, max = MAX.short) => (v == null ? '' : String(v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, max));
export const digits = v => String(v == null ? '' : v).replace(/\D/g, '');
export const own = (o, k) => typeof k === 'string' && Object.prototype.hasOwnProperty.call(o, k);
// a real calendar date (Code.gs only checked the shape — 2099-13-45 passed)
export const isDate = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && new Date(s + 'T00:00:00Z').toISOString().slice(0, 10) === s;

export const sha256 = s => createHash('sha256').update(s).digest('hex');
export const token = (n = 24) => randomBytes(n).toString('base64url');
export const safeEqual = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && timingSafeEqual(x, y); };
// short human code for bank-transfer memos: no 0/O/1/I to avoid misreading
const ALPHA = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
export const code = (n = 6) => { const b = randomBytes(n); let s = ''; for (let i = 0; i < n; i++) s += ALPHA[b[i] % ALPHA.length]; return s; };

// money: the pricebook is whole baht; payments are kept in satang (integer) so nothing is ever rounded twice
export const toSatang = baht => Math.round(+baht * 100);
export const bahtOf = satang => satang / 100;
export const fmtBaht = satang => (satang / 100).toLocaleString('en-US', { minimumFractionDigits: satang % 100 ? 2 : 0, maximumFractionDigits: 2 });

// fixed-window counters (single process; reset on restart — fine for abuse limits, not for billing)
export function limiter() {
  const m = new Map();
  return {
    hit(key, max, windowMs) {
      const t = clock(); let e = m.get(key);
      if (!e || e.reset <= t) { e = { n: 0, reset: t + windowMs }; m.set(key, e); }
      if (e.n >= max) return false;
      e.n++; return true;
    },
    peek(key, max) { const e = m.get(key); return !e || e.reset <= clock() || e.n < max; },
    sweep() { const t = clock(); for (const [k, e] of m) if (e.reset <= t) m.delete(k); },
    size: () => m.size,
  };
}
