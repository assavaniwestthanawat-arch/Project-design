// SBP AirCare server — payments: PromptPay QR / bank transfer / pay on site, recorded and confirmed by the office. Rev.10.
// Owner decision 9 ต.ค. 2569: customers can pay online AND on site. Rules kept here (research + CLAUDE.md §6.6):
//   · the office asks for money with a payment request (payreq) on a ticket — the amount comes from the SERVER's quote
//     (pricing.mjs) when every line is priced, otherwise staff type the amount they confirmed with the customer
//     (survey / "ประเมินหน้างาน" items are never charged until priced and agreed; a request can never be 0 baht)
//   · a payment counts only when VERIFIED by staff against the bank statement / cash in hand (a customer's "I have paid"
//     is SUBMITTED, never paid); every verified payment gets a running receipt number
//   · refunds are recorded (manual transfer back, or a gateway refund in phase 2) — nothing is ever deleted; the ticket's
//     money status is derived from the rows (no hand-kept "paid" flag)
//   · customers see only their own requests and receipt numbers after id + phone (same check as track)
import { tx, audit } from './db.mjs';
import { str, own, now, today, addDays, beYear, token, code, toSatang, fmtBaht } from './util.mjs';
import { promptpayPayload, qrDataUrl, maskId } from './promptpay.mjs';
import { findByIdTel } from './tickets.mjs';

export const REQ_KINDS = { full: 'ชำระเต็มจำนวน', deposit: 'มัดจำ', balance: 'ส่วนที่เหลือ', extra: 'งานเพิ่มหน้างาน' };
export const REQ_STATUS = { open: 'รอชำระ', paid: 'ชำระแล้ว', void: 'ยกเลิกรายการ', expired: 'หมดอายุ' };
export const PAY_METHODS = { promptpay: 'พร้อมเพย์ (QR)', transfer: 'โอนเข้าบัญชีบริษัท', cash: 'เงินสด (หน้างาน)', edc: 'บัตร (เครื่องรูดหน้างาน)', cheque: 'เช็ค', gateway: 'ชำระออนไลน์ผ่านผู้ให้บริการ', other: 'อื่น ๆ' };
export const PAY_STATUS = { submitted: 'รอตรวจยอด', verified: 'ได้รับเงินแล้ว', rejected: 'ไม่พบยอด', pending: 'รอชำระ', failed: 'ไม่สำเร็จ', expired: 'หมดอายุ' };
const MONEY_TH = { none: '', unpaid: 'รอชำระ', partial: 'ชำระบางส่วน', paid: 'ชำระครบแล้ว', overpaid: 'ชำระเกิน รอคืนส่วนต่าง', refunded: 'คืนเงินแล้ว', part_refunded: 'คืนเงินบางส่วน' };
const MAX_SATANG = 50_000_000_00;   // 50 ล้านบาท ต่อรายการ — anything larger is a typo
const fail = error => ({ ok: false, error });

function amountSatang(v) {   // staff type baht ("1,500" / "1500.50"); payments are kept in satang
  const s = String(v == null ? '' : v).replace(/[,\s฿]/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const n = toSatang(+s);
  return n >= 100 && n <= MAX_SATANG ? n : null;
}

export function createPayments(ctx) {
  const { db, cfg } = ctx;
  const rid = p => p + '-' + token(6).replace(/[-_]/g, 'x').slice(0, 8).toUpperCase();
  const reqs = id => db.prepare(`SELECT * FROM payreq WHERE ticketId = ? ORDER BY createdAt, id`).all(id);
  const pays = id => db.prepare(`SELECT * FROM payments WHERE ticketId = ? ORDER BY createdAt, id`).all(id);
  const refs = id => db.prepare(`SELECT * FROM refunds WHERE ticketId = ? ORDER BY createdAt, id`).all(id);

  function expireOld(ticketId) {
    db.prepare(`UPDATE payreq SET status = 'expired', closedAt = ? WHERE ticketId = ? AND status = 'open' AND expiresAt <> '' AND expiresAt < ?`).run(now(), ticketId, today());
  }
  function paidFor(reqId) { return db.prepare(`SELECT COALESCE(SUM(amount), 0) s FROM payments WHERE reqId = ? AND status = 'verified'`).get(reqId).s; }
  function settle(reqId) {   // a request is paid once verified payments against it reach its amount
    const r = db.prepare(`SELECT * FROM payreq WHERE id = ?`).get(reqId);
    if (r && r.status === 'open' && paidFor(reqId) >= r.amount) db.prepare(`UPDATE payreq SET status = 'paid', closedAt = ? WHERE id = ?`).run(now(), reqId);
  }
  function nextReceipt() {
    const t = today(), y = beYear(), k = 'R' + y + t.slice(5, 7);
    const n = db.prepare(`INSERT INTO seq (k, n) VALUES (?, 1) ON CONFLICT(k) DO UPDATE SET n = n + 1 RETURNING n`).get(k).n;
    return 'RC' + String(y).slice(-2) + t.slice(5, 7) + '-' + String(n).padStart(4, '0');
  }
  function summary(ticketId) {
    expireOld(ticketId);
    const R = reqs(ticketId), P = pays(ticketId), F = refs(ticketId);
    if (!R.length && !P.length && !F.length) return null;
    const paid = P.filter(p => p.status === 'verified').reduce((a, p) => a + p.amount, 0);
    const refunded = F.filter(f => f.status === 'done').reduce((a, f) => a + f.amount, 0);
    const open = R.filter(r => r.status === 'open');
    const due = open.reduce((a, r) => a + Math.max(0, r.amount - paidFor(r.id)), 0);
    const asked = R.filter(r => r.status === 'open' || r.status === 'paid').reduce((a, r) => a + r.amount, 0);
    const pending = P.filter(p => p.status === 'submitted').length;
    const net = paid - refunded;
    const status = refunded && net <= 0 ? 'refunded' : refunded ? 'part_refunded' : due > 0 ? (paid > 0 ? 'partial' : 'unpaid') : net > asked && asked > 0 ? 'overpaid' : paid > 0 ? 'paid' : 'none';
    return { status, statusTh: MONEY_TH[status], due, paid, refunded, asked, pending, open: open.length };
  }
  function suggested(t) {
    let rq = null; try { rq = t.quoteJson ? JSON.parse(t.quoteJson) : null; } catch (e) {}
    if (!rq || !rq.payable) return null;
    const s = summary(t.id), already = s ? s.asked : 0, total = toSatang(rq.totals.total);
    return total - already >= 100 ? { amount: total - already, basis: 'server_quote', tax: rq.tax, totalEx: rq.totals.totalEx, vat: rq.totals.vat } : null;
  }
  const payee = () => ({
    name: cfg.pay.payee,
    promptpay: cfg.pay.promptpayId ? maskId(cfg.pay.promptpayId) : '',
    bank: cfg.pay.bank && cfg.pay.accountNo ? { name: cfg.pay.bank, accountName: cfg.pay.accountName || cfg.pay.payee, accountNo: cfg.pay.accountNo } : null,
  });
  const methodsFor = () => [cfg.pay.promptpayId ? 'promptpay' : null, cfg.pay.bank && cfg.pay.accountNo ? 'transfer' : null, cfg.pay.onsite ? 'onsite' : null].filter(Boolean);

  // what the customer may see after id + phone: amounts, request references, receipt numbers — no staff names or notes
  function publicView(t) {
    const s = summary(t.id);
    if (!s) return null;
    const P = pays(t.id);
    return {
      status: s.status, statusTh: s.statusTh, due: s.due / 100, paid: s.paid / 100, refunded: s.refunded / 100, pending: s.pending > 0,
      methods: ctx.omise && ctx.omise.enabled ? ['gateway', ...methodsFor()] : methodsFor(), payee: payee().name,
      requests: reqs(t.id).filter(r => r.status !== 'void').map(r => ({ id: r.id, kind: r.kind, kindTh: REQ_KINDS[r.kind] || r.kind, amount: r.amount / 100, remaining: Math.max(0, r.amount - paidFor(r.id)) / 100, status: r.status, statusTh: REQ_STATUS[r.status] || r.status, ref: r.ref, expiresAt: r.expiresAt, submitted: P.some(p => p.reqId === r.id && p.status === 'submitted') })),
      receipts: P.filter(p => p.status === 'verified' && p.receiptNo).map(p => ({ no: p.receiptNo, amount: p.amount / 100, at: p.verifiedAt.slice(0, 10), method: PAY_METHODS[p.method] || p.method })),
    };
  }

  /* ---------- public actions (id + tel) ---------- */
  function openReq(t, reqId) {
    expireOld(t.id);
    const r = db.prepare(`SELECT * FROM payreq WHERE id = ? AND ticketId = ?`).get(str(reqId, 40), t.id);
    return r && r.status === 'open' ? r : null;
  }
  function pay(b, req) {
    if (!ctx.rl.hit('pay:ip:' + (req && req.ip || ''), cfg.limits.payPerIp, 10 * 60e3)) return fail('rate_limited');
    const t = findByIdTel(db, b.id, b.tel); if (!t) return fail('not_found');
    const r = openReq(t, b.req); if (!r) return fail('pay_closed');
    const remaining = r.amount - paidFor(r.id);
    if (remaining < 100) return fail('pay_closed');
    const out = { req: r.id, kind: r.kind, kindTh: REQ_KINDS[r.kind], amount: remaining / 100, amountTh: fmtBaht(remaining), ref: r.ref, payee: payee().name, expiresAt: r.expiresAt };
    if (b.method === 'promptpay') {
      if (!cfg.pay.promptpayId) return fail('pay_unavailable');
      const payload = promptpayPayload(cfg.pay.promptpayId, remaining);
      return { ok: true, pay: { ...out, method: 'promptpay', promptpay: maskId(cfg.pay.promptpayId), payload, qr: qrDataUrl(payload) } };
    }
    if (b.method === 'transfer') {
      const p = payee(); if (!p.bank) return fail('pay_unavailable');
      return { ok: true, pay: { ...out, method: 'transfer', bank: p.bank } };
    }
    if (b.method === 'onsite') {
      if (!cfg.pay.onsite) return fail('pay_unavailable');
      audit(db, 'ลูกค้า', 'pay.onsite', t.id, { req: r.id });
      return { ok: true, pay: { ...out, method: 'onsite' } };
    }
    return fail('bad_method');
  }
  // the customer says "I have transferred" — recorded as SUBMITTED; the office verifies against the statement
  function paid(b, req) {
    if (!ctx.rl.hit('pay:ip:' + (req && req.ip || ''), cfg.limits.payPerIp, 10 * 60e3)) return fail('rate_limited');
    const t = findByIdTel(db, b.id, b.tel); if (!t) return fail('not_found');
    const method = b.method === 'transfer' ? 'transfer' : 'promptpay';
    if (!methodsFor().includes(method)) return fail('pay_unavailable');
    let res;
    tx(db, () => {
      const r = openReq(t, b.req); if (!r) { res = fail('pay_closed'); return; }
      const remaining = r.amount - paidFor(r.id);
      const dup = db.prepare(`SELECT id FROM payments WHERE reqId = ? AND status = 'submitted'`).get(r.id);
      if (!dup) {
        const id = rid('PM');
        db.prepare(`INSERT INTO payments (id, ticketId, reqId, method, amount, status, reference, note, byWho, createdAt) VALUES (?, ?, ?, ?, ?, 'submitted', ?, ?, 'ลูกค้า', ?)`)
          .run(id, t.id, r.id, method, remaining, str(b.reference, 120), str(b.note, 400), now());
        audit(db, 'ลูกค้า', 'pay.submitted', t.id, { payment: id, req: r.id, amount: remaining, method });
        res = { ok: true, created: id };
      } else res = { ok: true, created: null };
    });
    if (!res.ok) return res;
    if (res.created && ctx.notifyStaff) ctx.notifyStaff(`[SBP ชำระเงิน] ${t.id} ลูกค้าแจ้งโอนแล้ว — รอตรวจยอด`, `ลูกค้าแจ้งว่าชำระแล้ว: ${t.id} · ${t.name} · โทร ${t.tel}\nวิธี: ${PAY_METHODS[method]}\nกรุณาตรวจยอดในบัญชีบริษัท แล้วกด "ยืนยันได้รับเงิน" ในหน้าหลังบ้าน`, t.id);
    return { ok: true, payment: publicView(t) };
  }

  /* ---------- staff actions ---------- */
  const role = (staff, ...allowed) => allowed.includes(staff.role);
  function ticketOr404(id) { return db.prepare(`SELECT * FROM tickets WHERE id = ?`).get(str(id, 40)); }
  function detail(b, staff) {
    const t = ticketOr404(b.id); if (!t) return fail('not_found');
    expireOld(t.id);
    let rq = null; try { rq = t.quoteJson ? JSON.parse(t.quoteJson) : null; } catch (e) {}
    return {
      ok: true, id: t.id, summary: (x => x && { ...x, due: x.due / 100, paid: x.paid / 100, refunded: x.refunded / 100, asked: x.asked / 100 })(summary(t.id)),
      suggested: (x => x && { ...x, amount: x.amount / 100 })(suggested(t)), quote: rq, payee: payee(), methods: PAY_METHODS, kinds: REQ_KINDS,
      requests: reqs(t.id).map(r => ({ ...r, amount: r.amount / 100, paid: paidFor(r.id) / 100, statusTh: REQ_STATUS[r.status] })),
      payments: pays(t.id).map(p => ({ ...p, amount: p.amount / 100, statusTh: PAY_STATUS[p.status], methodTh: PAY_METHODS[p.method] })),
      refunds: refs(t.id).map(f => ({ ...f, amount: f.amount / 100 })),
      can: { request: role(staff, 'admin', 'staff'), verify: role(staff, 'admin', 'staff'), refund: role(staff, 'admin') },
    };
  }
  function request(b, staff) {
    if (!role(staff, 'admin', 'staff')) return fail('forbidden');
    const t = ticketOr404(b.id); if (!t) return fail('not_found');
    if (t.status === 'cancelled') return fail('ticket_cancelled');
    if (!own(REQ_KINDS, b.kind)) return fail('bad_kind');
    let amount = b.amount === '' || b.amount == null ? null : amountSatang(b.amount), basis = 'staff_confirmed';
    if (b.amount === '' || b.amount == null) { const s = suggested(t); if (!s) return fail('amount_required'); amount = s.amount; basis = 'server_quote'; }
    if (!amount) return fail('bad_amount');
    let r;
    tx(db, () => {
      r = { id: rid('PR'), ref: code(6), expiresAt: addDays(today(), Math.max(1, cfg.pay.requestDays)) };
      db.prepare(`INSERT INTO payreq (id, ticketId, kind, amount, status, ref, note, basis, createdAt, createdBy, expiresAt) VALUES (?, ?, ?, ?, 'open', ?, ?, ?, ?, ?, ?)`)
        .run(r.id, t.id, b.kind, amount, r.ref, str(b.note, 400), basis, now(), staff.name, r.expiresAt);
      audit(db, staff.name, 'pay.request', t.id, { req: r.id, kind: b.kind, amount, basis });
    });
    if (ctx.notifyPayRequest) ctx.notifyPayRequest(t, { id: r.id, kind: b.kind, amount, ref: r.ref, expiresAt: r.expiresAt });
    return { ok: true, ...detail({ id: t.id }, staff) };
  }
  function voidReq(b, staff) {
    if (!role(staff, 'admin', 'staff')) return fail('forbidden');
    const r = db.prepare(`SELECT * FROM payreq WHERE id = ?`).get(str(b.req, 40)); if (!r) return fail('not_found');
    if (r.status !== 'open') return fail('pay_closed');
    // verified money, or a transfer the customer reported and the office has not checked yet, keeps the request visible
    if (db.prepare(`SELECT COUNT(*) n FROM payments WHERE reqId = ? AND status IN ('verified', 'submitted', 'pending')`).get(r.id).n) return fail('has_payments');
    db.prepare(`UPDATE payreq SET status = 'void', closedAt = ?, note = ? WHERE id = ?`).run(now(), str([r.note, 'ยกเลิก: ' + str(b.reason, 200)].filter(Boolean).join(' · '), 400), r.id);
    audit(db, staff.name, 'pay.void', r.ticketId, { req: r.id, reason: str(b.reason, 200) });
    return { ok: true, ...detail({ id: r.ticketId }, staff) };
  }
  // money received on site / by transfer, typed in by staff (a technician's entry waits for the office to verify)
  function record(b, staff) {
    const t = ticketOr404(b.id); if (!t) return fail('not_found');
    if (!own(PAY_METHODS, b.method) || b.method === 'gateway') return fail('bad_method');
    const amount = amountSatang(b.amount); if (!amount) return fail('bad_amount');
    let reqId = '';
    if (b.req) { const r = db.prepare(`SELECT * FROM payreq WHERE id = ? AND ticketId = ?`).get(str(b.req, 40), t.id); if (!r) return fail('not_found'); reqId = r.id; }
    const verified = role(staff, 'admin', 'staff');
    const id = rid('PM');
    tx(db, () => {
      db.prepare(`INSERT INTO payments (id, ticketId, reqId, method, amount, status, reference, note, byWho, createdAt, verifiedBy, verifiedAt, receiptNo) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(id, t.id, reqId, b.method, amount, verified ? 'verified' : 'submitted', str(b.reference, 120), str(b.note, 400), staff.name, now(), verified ? staff.name : '', verified ? now() : '', verified ? nextReceipt() : null);
      if (reqId) settle(reqId);
      audit(db, staff.name, 'pay.record', t.id, { payment: id, req: reqId, method: b.method, amount, verified });
    });
    if (verified && ctx.notifyPaid) ctx.notifyPaid(t, db.prepare(`SELECT * FROM payments WHERE id = ?`).get(id));
    return { ok: true, ...detail({ id: t.id }, staff) };
  }
  function verify(b, staff) {
    if (!role(staff, 'admin', 'staff')) return fail('forbidden');
    const p = db.prepare(`SELECT * FROM payments WHERE id = ?`).get(str(b.payment, 40)); if (!p) return fail('not_found');
    if (p.status !== 'submitted') return fail('pay_closed');
    const ok = b.decision === 'verify';
    if (!ok && b.decision !== 'reject') return fail('bad_decision');
    // the office may correct the amount actually received (e.g. a customer transferred less) before verifying
    const amount = b.amount != null && b.amount !== '' ? amountSatang(b.amount) : p.amount; if (!amount) return fail('bad_amount');
    tx(db, () => {
      if (ok) db.prepare(`UPDATE payments SET status = 'verified', amount = ?, verifiedBy = ?, verifiedAt = ?, receiptNo = ?, note = ? WHERE id = ?`).run(amount, staff.name, now(), nextReceipt(), str([p.note, str(b.note, 200)].filter(Boolean).join(' · '), 400), p.id);
      else db.prepare(`UPDATE payments SET status = 'rejected', verifiedBy = ?, verifiedAt = ?, note = ? WHERE id = ?`).run(staff.name, now(), str([p.note, str(b.note, 200)].filter(Boolean).join(' · '), 400), p.id);
      if (ok && p.reqId) settle(p.reqId);
      audit(db, staff.name, ok ? 'pay.verify' : 'pay.reject', p.ticketId, { payment: p.id, amount });
    });
    if (ok && ctx.notifyPaid) ctx.notifyPaid(ticketOr404(p.ticketId), db.prepare(`SELECT * FROM payments WHERE id = ?`).get(p.id));
    return { ok: true, ...detail({ id: p.ticketId }, staff) };
  }
  function refund(b, staff) {
    if (!role(staff, 'admin')) return fail('forbidden');
    const t = ticketOr404(b.id); if (!t) return fail('not_found');
    const amount = amountSatang(b.amount); if (!amount) return fail('bad_amount');
    if (!['transfer', 'cash', 'promptpay', 'gateway', 'other'].includes(b.method)) return fail('bad_method');
    if (!str(b.reason, 200)) return fail('reason_required');
    let res;
    tx(db, () => {
      const s = summary(t.id) || { paid: 0, refunded: 0 };
      if (amount > s.paid - s.refunded) { res = fail('refund_too_large'); return; }
      const id = rid('RF');
      db.prepare(`INSERT INTO refunds (id, ticketId, paymentId, amount, method, status, reason, reference, byWho, createdAt, completedAt) VALUES (?, ?, ?, ?, ?, 'done', ?, ?, ?, ?, ?)`)
        .run(id, t.id, str(b.payment, 40), amount, b.method, str(b.reason, 200), str(b.reference, 120), staff.name, now(), now());
      audit(db, staff.name, 'pay.refund', t.id, { refund: id, amount, method: b.method });
      res = { ok: true };
    });
    return res.ok ? { ok: true, ...detail({ id: t.id }, staff) } : res;
  }
  function summaries(ids) {
    const out = {};
    if (!ids.length) return out;
    const have = new Set(db.prepare(`SELECT DISTINCT ticketId FROM payreq WHERE ticketId IN (${ids.map(() => '?').join(',')}) UNION SELECT DISTINCT ticketId FROM payments WHERE ticketId IN (${ids.map(() => '?').join(',')})`).all(...ids, ...ids).map(r => r.ticketId));
    for (const id of have) { const s = summary(id); if (s) out[id] = { ...s, due: s.due / 100, paid: s.paid / 100, refunded: s.refunded / 100, asked: s.asked / 100 }; }
    return out;
  }
  // phase 2: a gateway reports a charge (already signature-checked and re-fetched by the provider module)
  function gatewayResult({ provider, providerRef, ticketId, reqId, amount, status, method = 'gateway' }) {
    let res = null, done = false;
    tx(db, () => {
      const t = ticketOr404(ticketId); if (!t) return;
      const ex = db.prepare(`SELECT * FROM payments WHERE provider = ? AND providerRef = ?`).get(provider, providerRef);
      const st = status === 'successful' ? 'verified' : status === 'failed' ? 'failed' : status === 'expired' ? 'expired' : 'pending';
      if (ex) {
        if (ex.status === st || ex.status === 'verified') return;   // idempotent; a success is never downgraded
        db.prepare(`UPDATE payments SET status = ?, verifiedBy = ?, verifiedAt = ?, receiptNo = COALESCE(receiptNo, ?) WHERE id = ?`).run(st, st === 'verified' ? provider : '', st === 'verified' ? now() : '', st === 'verified' ? nextReceipt() : null, ex.id);
        res = ex.id;
      } else {
        const id = rid('PM');
        db.prepare(`INSERT INTO payments (id, ticketId, reqId, method, provider, providerRef, amount, status, byWho, createdAt, verifiedBy, verifiedAt, receiptNo) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
          .run(id, t.id, reqId || '', method, provider, providerRef, amount, st, provider, now(), st === 'verified' ? provider : '', st === 'verified' ? now() : '', st === 'verified' ? nextReceipt() : null);
        res = id;
      }
      if (st === 'verified' && reqId) settle(reqId);
      done = st === 'verified';
      audit(db, provider, 'pay.gateway', t.id, { providerRef, status: st, amount });
    });
    if (done && ctx.notifyPaid) ctx.notifyPaid(ticketOr404(ticketId), db.prepare(`SELECT * FROM payments WHERE id = ?`).get(res));
    return res;
  }

  // phase 2: PromptPay through the gateway (charge confirmed by the gateway's webhook / polling, not by staff)
  async function payGateway(b, req) {
    if (!ctx.omise || !ctx.omise.enabled) return fail('pay_unavailable');
    if (!ctx.rl.hit('pay:ip:' + (req && req.ip || ''), cfg.limits.payPerIp, 10 * 60e3)) return fail('rate_limited');
    const t = findByIdTel(db, b.id, b.tel); if (!t) return fail('not_found');
    const r = openReq(t, b.req); if (!r) return fail('pay_closed');
    const remaining = r.amount - paidFor(r.id);
    if (remaining < 100) return fail('pay_closed');
    let c;
    try { c = await ctx.omise.promptpayCharge({ amountSatang: remaining, ticketId: t.id, reqId: r.id, description: `SBP AirCare ${t.id} ${r.ref}` }); }
    catch (e) { return fail(e.code || 'gateway_error'); }
    gatewayResult({ provider: 'omise', providerRef: c.id, ticketId: t.id, reqId: r.id, amount: remaining, status: c.status === 'successful' ? 'successful' : 'pending' });
    return { ok: true, pay: { req: r.id, kind: r.kind, kindTh: REQ_KINDS[r.kind], amount: remaining / 100, amountTh: fmtBaht(remaining), ref: r.ref, payee: payee().name, method: 'gateway', qr: c.qr, charge: c.id, expiresAt: c.expiresAt } };
  }
  function methodsForPublic() { const m = methodsFor(); return ctx.omise && ctx.omise.enabled ? ['gateway', ...m] : m; }

  return { publicView, summaries, summary, suggested, pay, paid, payGateway, detail, request, voidReq, record, verify, refund, gatewayResult, methodsFor: methodsForPublic };
}
