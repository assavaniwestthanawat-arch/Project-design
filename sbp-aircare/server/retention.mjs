// SBP AirCare server — PDPA helpers: export one customer's data, erase it, and age out old tickets. Rev.10.
// Money records (payments, refunds, receipt numbers, amounts) are kept for accounting even when a person's contact
// details are erased; the ticket keeps its id, dates, service, status and totals so the books still add up.
import { tx, audit } from './db.mjs';
import { now, nowMs } from './util.mjs';

const PII = ['name', 'tel', 'email', 'company', 'taxName', 'taxId', 'address', 'area', 'building', 'access', 'details', 'notes', 'staffNote', 'payload', 'consentText', 'ipHash'];

export function exportTicket(db, id) {
  const t = db.prepare(`SELECT * FROM tickets WHERE id = ?`).get(id);
  if (!t) return null;
  const parse = s => { try { return JSON.parse(s); } catch (e) { return s; } };
  return {
    ticket: { ...t, payload: parse(t.payload), history: parse(t.history), quoteJson: parse(t.quoteJson), priceCheck: parse(t.priceCheck) },
    paymentRequests: db.prepare(`SELECT * FROM payreq WHERE ticketId = ?`).all(id),
    payments: db.prepare(`SELECT * FROM payments WHERE ticketId = ?`).all(id),
    refunds: db.prepare(`SELECT * FROM refunds WHERE ticketId = ?`).all(id),
    exportedAt: now(),
  };
}

export function anonymizeTicket(db, id, actor = 'cli') {
  return tx(db, () => {
    const t = db.prepare(`SELECT id, anonymizedAt FROM tickets WHERE id = ?`).get(id);
    if (!t) return false;
    db.prepare(`UPDATE tickets SET ${PII.map(k => `${k} = ''`).join(', ')}, name = '(ลบข้อมูลส่วนบุคคลแล้ว)', quoteJson = '', anonymizedAt = ? WHERE id = ?`).run(now(), id);
    db.prepare(`UPDATE payments SET reference = '', note = '' WHERE ticketId = ?`).run(id);
    db.prepare(`UPDATE outbox SET recipient = '', body = '' WHERE ticketId = ?`).run(id);
    audit(db, actor, 'pdpa.anonymize', id, '');
    return true;
  });
}

// tickets finished (done / cancelled) or untouched for `days` days lose their personal data; tickets with money
// records are kept intact until the accounting period (5 years) has passed
export function anonymizeOld(db, days, { keepMoneyDays = 5 * 366 } = {}) {
  if (!(days > 0)) return { anonymized: 0 };
  const cut = now(nowMs() - days * 864e5), cutMoney = now(nowMs() - Math.max(days, keepMoneyDays) * 864e5);
  const rows = db.prepare(`SELECT t.id, (SELECT COUNT(*) FROM payments p WHERE p.ticketId = t.id) + (SELECT COUNT(*) FROM payreq r WHERE r.ticketId = t.id) AS money
    FROM tickets t WHERE t.anonymizedAt = '' AND t.createdAt < ? AND (t.status IN ('done','cancelled') OR t.updatedAt = '' OR t.updatedAt < ?)`).all(cut, cut);
  let n = 0;
  for (const r of rows) {
    if (r.money) { const c = db.prepare(`SELECT createdAt FROM tickets WHERE id = ?`).get(r.id).createdAt; if (c >= cutMoney) continue; }
    if (anonymizeTicket(db, r.id, 'retention')) n++;
  }
  db.prepare(`DELETE FROM outbox WHERE status IN ('sent','skipped','failed') AND createdAt < ?`).run(cut);
  db.prepare(`DELETE FROM sessions WHERE expiresMs < ?`).run(nowMs());
  return { anonymized: n };
}
