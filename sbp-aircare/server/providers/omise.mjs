// SBP AirCare server — phase 2 payment gateway adapter: Omise (Thailand). Rev.10. OFF unless OMISE_SECRET_KEY and
// OMISE_WEBHOOK_SECRET are set. Plain REST with Node's fetch — no SDK, no card fields on our pages (PCI scope stays small).
// Built from the published API (docs.omise.co: charges, PromptPay source, webhooks HMAC-SHA256 over "<timestamp>.<raw body>"
// with the base64-decoded secret). ⚠ Run it end-to-end with Omise TEST keys before using live keys (deploy/DEPLOY_TH.md).
// Notes from the research (9 ต.ค. 2569): PromptPay 20–150,000 THB per charge; PromptPay charges cannot be refunded through
// Omise (refund by bank transfer and record it); webhook retries are not guaranteed → the server also polls pending charges.
import { createHmac, timingSafeEqual } from 'node:crypto';

const MIN_SATANG = 2000, MAX_SATANG = 150000_00;

export function verifyWebhook(raw, headers, secretB64, { toleranceSec = 600, nowSec = Math.floor(Date.now() / 1000) } = {}) {
  const ts = String(headers['omise-signature-timestamp'] || '');
  const sigs = String(headers['omise-signature'] || '').split(',').map(s => s.trim()).filter(Boolean);
  if (!/^\d+$/.test(ts) || !sigs.length || !secretB64) return false;
  if (Math.abs(nowSec - +ts) > toleranceSec) return false;
  const want = createHmac('sha256', Buffer.from(secretB64, 'base64')).update(ts + '.').update(raw).digest();
  return sigs.some(s => { const got = Buffer.from(s, 'hex'); return got.length === want.length && timingSafeEqual(got, want); });
}

async function call(o, method, path, form) {
  const r = await fetch(o.api.replace(/\/+$/, '') + path, {
    method, headers: { Authorization: 'Basic ' + Buffer.from(o.secretKey + ':').toString('base64'), ...(form ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}) },
    body: form ? new URLSearchParams(form).toString() : undefined, signal: AbortSignal.timeout(20000),
  });
  const j = await r.json().catch(() => null);
  if (!r.ok || !j || j.object === 'error') throw new Error('omise ' + (j && (j.code || j.message) || r.status));
  return j;
}

export function createOmise(o) {
  const enabled = !!(o.secretKey && o.webhookSecret);
  return {
    enabled,
    async promptpayCharge({ amountSatang, ticketId, reqId, description }) {
      if (!enabled) throw new Error('gateway off');
      if (amountSatang < MIN_SATANG || amountSatang > MAX_SATANG) throw Object.assign(new Error('amount outside PromptPay limits'), { code: 'pay_unavailable' });
      const c = await call(o, 'POST', '/charges', { amount: String(amountSatang), currency: 'thb', 'source[type]': 'promptpay', description: String(description || '').slice(0, 200), 'metadata[ticket_id]': ticketId, 'metadata[req_id]': reqId });
      const img = c.source && c.source.scannable_code && c.source.scannable_code.image && c.source.scannable_code.image.download_uri;
      let qr = '';
      if (img && /^https:\/\//.test(img)) {   // inline the QR image so the page CSP stays img-src 'self' data:
        const r = await fetch(img, { signal: AbortSignal.timeout(15000) });
        const buf = Buffer.from(await r.arrayBuffer());
        if (r.ok && buf.length < 300_000) qr = `data:${(r.headers.get('content-type') || 'image/svg+xml').split(';')[0]};base64,${buf.toString('base64')}`;
      }
      return { id: c.id, status: c.status, amount: c.amount, qr, expiresAt: c.expires_at || '' };
    },
    retrieve: id => call(o, 'GET', '/charges/' + encodeURIComponent(id)),
  };
}

// webhook → re-fetch the charge (the event body is never trusted for amount/status) → payments.gatewayResult
export async function handleWebhook(ctx, raw, headers) {
  const { cfg, db, payments, omise } = ctx;
  if (!omise || !omise.enabled) return { status: 404 };
  if (!verifyWebhook(raw, headers, cfg.omise.webhookSecret)) return { status: 401 };
  let ev; try { ev = JSON.parse(raw); } catch (e) { return { status: 400 }; }
  if (!ev || !ev.id || !ev.key) return { status: 400 };
  const fresh = db.prepare(`INSERT OR IGNORE INTO webhook_events (provider, eventId, receivedAt) VALUES ('omise', ?, datetime('now'))`).run(String(ev.id)).changes;
  if (!fresh) return { status: 200 };   // duplicate delivery
  if (!/^charge\./.test(ev.key) || !ev.data || !ev.data.id) return { status: 200 };
  const c = await omise.retrieve(ev.data.id);
  const md = c.metadata || {};
  if (c.currency && String(c.currency).toLowerCase() !== 'thb') return { status: 200 };
  payments.gatewayResult({ provider: 'omise', providerRef: c.id, ticketId: String(md.ticket_id || ''), reqId: String(md.req_id || ''), amount: +c.amount, status: c.status });
  return { status: 200 };
}
