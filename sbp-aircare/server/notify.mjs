// SBP AirCare server — notifications through a durable outbox (email + LINE Messaging API). Rev.10.
// Messages are written to the `outbox` table in the same request that creates the ticket/payment, then a background
// worker sends them with retries (1 min → 6 h, 8 tries). A mail server or LINE outage never loses a notice and never
// blocks the customer. Texts never promise a response time or appointment (CLAUDE.md §6.6 #23) and avoid the banned
// phrases (§6.6 #11).
import { sendMail } from './smtp.mjs';
import { KINDS, SERVICES, STATUSES, SLOTS, summary } from './tickets.mjs';
import { REQ_KINDS } from './payments.mjs';
import { now, nowMs, fmtBaht } from './util.mjs';

const BACKOFF = [60e3, 5 * 60e3, 15 * 60e3, 3600e3, 3 * 3600e3, 6 * 3600e3, 6 * 3600e3];
const SIGN = '\n\nบริษัท สหบูรพากรุ๊ป จำกัด (SBP AirCare)';

export function createNotifier(ctx) {
  const { db, cfg } = ctx;
  const memory = [];   // MAIL_TRANSPORT=memory (development / tests): what would have been sent
  const site = () => cfg.siteUrl || '';
  const trackUrl = id => (site() ? `${site()}/?track=${encodeURIComponent(id)}#booking` : '');
  const enqueue = (channel, recipient, subject, body, ticketId = '') => {
    if (!recipient) return;
    db.prepare(`INSERT INTO outbox (channel, recipient, subject, body, ticketId, createdAt, nextMs) VALUES (?, ?, ?, ?, ?, ?, 0)`).run(channel, recipient, subject, body, ticketId, now());
  };
  const toTeam = (subject, body, ticketId) => {
    if (cfg.notifyEmail.length) enqueue('email', cfg.notifyEmail.join(','), subject, body, ticketId);
    if (cfg.line.token && cfg.line.to) enqueue('line', cfg.line.to, '', (subject + '\n' + body).slice(0, 4900), ticketId);
  };

  const notifyCreated = o => {
    const text = summary(o);
    toTeam(`[SBP ${KINDS[o.kind]}] ${o.id} · ${o.name}`, text + (site() ? `\n\nเปิดหน้าหลังบ้าน: ${site()}/backoffice.html` : '\n\nเปิดหน้าหลังบ้านเพื่อยืนยันนัด'), o.id);
    if (cfg.customerAck && o.email) enqueue('email', o.email, `SBP AirCare ได้รับคำขอของคุณแล้ว · ${o.id}`,
      `เรียนคุณ ${o.name}\n\nบริษัทได้รับคำขอเลขที่ ${o.id} แล้ว ทีมจะติดต่อกลับเพื่อยืนยันรายละเอียดและนัดหมาย\nตรวจสถานะได้ที่หน้าเว็บไซต์ด้วยเลขที่คำขอและเบอร์โทร${trackUrl(o.id) ? '\n' + trackUrl(o.id) : ''}` + SIGN, o.id);
  };
  const notifyUpdated = (o, ch) => {
    if (!cfg.customerNotify || !o.email || o.kind === 'feedback') return;
    if (!(ch.s || ch.date || ch.slot)) return;   // team / internal note changes are not the customer's business
    const when = o.schedDate ? `\nนัดหมาย: ${o.schedDate} ${SLOTS[o.schedSlot] || ''}`.trimEnd() : '';
    enqueue('email', o.email, `SBP AirCare · อัปเดตคำขอ ${o.id}`,
      `เรียนคุณ ${o.name}\n\nคำขอเลขที่ ${o.id} (${SERVICES[o.service] || KINDS[o.kind]})\nสถานะ: ${STATUSES[o.status] || o.status}${when}${trackUrl(o.id) ? '\n\nตรวจสถานะ: ' + trackUrl(o.id) : ''}\n\nหากต้องการเปลี่ยนวันนัด กรุณาโทรหาบริษัท` + SIGN, o.id);
  };
  const notifyPayRequest = (t, r) => {
    if (!cfg.customerNotify || !t.email) return;
    enqueue('email', t.email, `SBP AirCare · รายการชำระเงิน ${t.id}`,
      `เรียนคุณ ${t.name}\n\nรายการชำระเงินสำหรับคำขอเลขที่ ${t.id}\n${REQ_KINDS[r.kind] || r.kind}: ${fmtBaht(r.amount)} บาท\nรหัสอ้างอิงสำหรับใส่ในบันทึกการโอน: ${r.ref}\nชำระได้ถึง: ${r.expiresAt}\n\nเลือกวิธีชำระ (พร้อมเพย์ โอนเข้าบัญชีบริษัท หรือชำระหน้างาน) ที่หน้าเว็บไซต์ด้วยเลขที่คำขอและเบอร์โทร${trackUrl(t.id) ? '\n' + trackUrl(t.id) : ''}\nบริษัทยืนยันยอดจากบัญชีธนาคารก่อนออกเลขที่ใบเสร็จ` + SIGN, t.id);
  };
  const notifyPaid = (t, p) => {
    if (!cfg.customerNotify || !t || !t.email) return;
    enqueue('email', t.email, `SBP AirCare · ได้รับชำระเงินแล้ว ${t.id}`,
      `เรียนคุณ ${t.name}\n\nบริษัทได้รับชำระเงินสำหรับคำขอเลขที่ ${t.id} แล้ว\nจำนวน: ${fmtBaht(p.amount)} บาท\nเลขที่ใบเสร็จ: ${p.receiptNo}\n\nหากต้องการใบกำกับภาษีหรือเอกสารเพิ่มเติม กรุณาติดต่อบริษัท` + SIGN, t.id);
  };
  const notifyStaff = (subject, body, ticketId) => toTeam(subject, body + (site() ? `\n${site()}/backoffice.html` : ''), ticketId);

  async function deliver(m) {
    if (m.channel === 'email') {
      if (cfg.mailTransport === 'memory') { memory.push({ to: m.recipient, subject: m.subject, body: m.body, at: now() }); return 'memory'; }
      if (cfg.mailTransport !== 'smtp') return 'skipped';
      await sendMail(cfg.smtp, { to: m.recipient, subject: m.subject, text: m.body });
      return 'smtp';
    }
    if (m.channel === 'line') {
      if (cfg.mailTransport === 'memory') { memory.push({ line: m.recipient, body: m.body, at: now() }); return 'memory'; }
      const r = await fetch('https://api.line.me/v2/bot/message/push', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.line.token}` }, body: JSON.stringify({ to: m.recipient, messages: [{ type: 'text', text: m.body.slice(0, 4900) }] }), signal: AbortSignal.timeout(15000) });
      if (!r.ok) throw new Error('line ' + r.status);
      return 'line';
    }
    return 'skipped';
  }
  let running = false;
  async function drain(limit = 20) {
    if (running) return 0; running = true;
    let n = 0;
    try {
      const rows = db.prepare(`SELECT * FROM outbox WHERE status = 'pending' AND nextMs <= ? ORDER BY id LIMIT ?`).all(nowMs(), limit);
      for (const m of rows) {
        try {
          const how = await deliver(m);
          db.prepare(`UPDATE outbox SET status = ?, attempts = attempts + 1, sentAt = ?, lastError = '' WHERE id = ?`).run(how === 'skipped' ? 'skipped' : 'sent', now(), m.id);
          n++;
        } catch (e) {
          const tries = m.attempts + 1;
          db.prepare(`UPDATE outbox SET attempts = ?, status = ?, nextMs = ?, lastError = ? WHERE id = ?`).run(tries, tries >= 8 ? 'failed' : 'pending', nowMs() + BACKOFF[Math.min(tries - 1, BACKOFF.length - 1)], String(e && e.message || e).slice(0, 300), m.id);
        }
      }
    } finally { running = false; }
    return n;
  }
  return { enqueue, notifyCreated, notifyUpdated, notifyPayRequest, notifyPaid, notifyStaff, drain, memory };
}
