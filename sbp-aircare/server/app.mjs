// SBP AirCare server — HTTP app: the ticket/payment API on /exec (same contract as Apps Script) + allowlisted static site.
// Rev.10. createApp() is used by index.mjs (production) and by the tests (fresh DB, memory mail, injectable clock).
import { openDb } from './db.mjs';
import { loadPricing } from './pricing.mjs';
import { createPayments } from './payments.mjs';
import { createNotifier } from './notify.mjs';
import { createStatic, securityHeaders } from './static.mjs';
import { createOmise, handleWebhook } from './providers/omise.mjs';
import * as T from './tickets.mjs';
import * as S from './staff.mjs';
import { limiter, token, now } from './util.mjs';
import { ROOT, VERSION } from './config.mjs';

export async function createApp(cfg, { root = ROOT, log = console } = {}) {
  await loadPricing(root);
  const db = openDb(cfg.dbFile);
  const ctx = { db, cfg, rl: limiter(), log };
  ctx.omise = createOmise(cfg.omise);
  ctx.payments = createPayments(ctx);
  const N = createNotifier(ctx);
  Object.assign(ctx, { notifyCreated: N.notifyCreated, notifyUpdated: N.notifyUpdated, notifyPayRequest: N.notifyPayRequest, notifyPaid: N.notifyPaid, notifyStaff: N.notifyStaff, notifier: N });
  const stat = createStatic(cfg, root);
  const started = Date.now();

  const clientIp = req => (cfg.trustProxy ? String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() : '') || req.socket.remoteAddress || '';
  const json = (req, res, status, o) => {
    const body = JSON.stringify(o);
    res.writeHead(status, { ...securityHeaders(req, cfg), 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Length': Buffer.byteLength(body) });
    res.end(body);
  };
  const readBody = (req, max) => new Promise(resolve => {
    const chunks = []; let n = 0, over = false;
    req.on('data', c => { n += c.length; if (n > max) { over = true; req.destroy(); return; } chunks.push(c); });
    req.on('end', () => resolve(over ? null : Buffer.concat(chunks)));
    req.on('close', () => resolve(over ? null : Buffer.concat(chunks)));
    req.on('error', () => resolve(null));
  });

  // staff-only actions: authenticate the token the board sends (session from {action:'login'} or the legacy STAFF_TOKEN)
  const staffActions = {
    list: (b, st) => T.list(ctx, b),
    update: (b, st) => T.update(ctx, b.id, b.patch || {}, st),
    me: (b, st) => ({ ok: true, name: st.name, role: st.role, roleTh: S.ROLES[st.role] }),
    paydetail: (b, st) => ctx.payments.detail(b, st),
    payreq: (b, st) => ctx.payments.request(b, st),
    payvoid: (b, st) => ctx.payments.voidReq(b, st),
    payrecord: (b, st) => ctx.payments.record(b, st),
    payverify: (b, st) => ctx.payments.verify(b, st),
    refund: (b, st) => ctx.payments.refund(b, st),
  };
  async function dispatch(b, req) {
    switch (b.action) {
      case 'create': return T.create(ctx, b.ticket || {}, req);
      case 'track': return T.track(ctx, b.id, b.tel, req);
      case 'slots': return T.slots(ctx, b.from, b.days);
      case 'pay': return b.method === 'gateway' ? ctx.payments.payGateway(b, req) : ctx.payments.pay(b, req);
      case 'paid': return ctx.payments.paid(b, req);
      case 'login': return S.login(ctx, b, req);
      case 'logout': return S.logout(ctx, b.token);
      default:
        if (Object.prototype.hasOwnProperty.call(staffActions, b.action)) {
          const a = S.authenticate(ctx, b.token, b.staff, req);
          if (a.error) return { ok: false, error: a.error };
          return staffActions[b.action](b, a.staff);
        }
        return { ok: false, error: 'unknown_action' };
    }
  }

  async function api(req, res) {
    if (req.method === 'GET' || req.method === 'HEAD') return json(req, res, 200, { ok: true, service: 'SBP AirCare back office', version: VERSION });
    if (req.method !== 'POST') return json(req, res, 405, { ok: false, error: 'method' });
    const raw = await readBody(req, cfg.limits.bodyBytes);
    if (raw == null) return json(req, res, 200, { ok: false, error: 'too_large' });
    const text = raw.toString('utf8');
    if (text.length > 30000) return json(req, res, 200, { ok: false, error: 'too_large' });   // same limit as Code.gs (characters)
    let b; try { b = JSON.parse(text || '{}'); } catch (e) { return json(req, res, 200, { ok: false, error: 'bad_json' }); }
    if (!b || typeof b !== 'object' || Array.isArray(b)) return json(req, res, 200, { ok: false, error: 'unknown_action' });
    req.ip = clientIp(req);
    try { return json(req, res, 200, await dispatch(b, req)); }
    catch (e) {
      const ref = token(6);
      log.error(`[${now()}] api error ${ref} action=${String(b.action).slice(0, 20)}:`, e && e.stack || e);
      return json(req, res, 200, { ok: false, error: 'server', ref });   // never echo internal messages
    }
  }

  async function handler(req, res) {
    let url; try { url = new URL(req.url, 'http://x'); } catch (e) { res.writeHead(400); return res.end(); }
    const p = url.pathname;
    try {
      if (p === '/exec' || p === '/api/exec') return await api(req, res);
      if (p === '/healthz') {
        let dbOk = false, pending = null;
        try { db.prepare('SELECT 1').get(); dbOk = true; pending = db.prepare(`SELECT COUNT(*) n FROM outbox WHERE status = 'pending'`).get().n; } catch (e) {}
        return json(req, res, dbOk ? 200 : 503, { ok: dbOk, version: VERSION, uptimeS: Math.round((Date.now() - started) / 1000), outboxPending: pending });
      }
      if (p === '/api/webhooks/omise' && req.method === 'POST') {
        const raw = await readBody(req, 256 * 1024);
        if (raw == null) return json(req, res, 413, { ok: false });
        const r = await handleWebhook(ctx, raw.toString('utf8'), req.headers);
        return json(req, res, r.status, { ok: r.status === 200 });
      }
      if (p === '/__outbox' && cfg.dev) return json(req, res, 200, N.memory);
      if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405, { ...securityHeaders(req, cfg), Allow: 'GET, HEAD' }); return res.end(); }
      if (stat.handle(req, res, p)) return;
      return stat.notFound(req, res);
    } catch (e) {
      log.error(`[${now()}] request error ${p}:`, e && e.stack || e);
      if (!res.headersSent) { res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('server error'); }
    }
  }

  return { handler, ctx, db, close: () => { try { db.close(); } catch (e) {} } };
}
