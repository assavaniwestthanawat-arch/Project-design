// SBP AirCare — production server configuration (env → typed config). Rev.10 (9 ต.ค. 2569).
// Every secret (STAFF_TOKEN, SMTP_PASS, LINE_TOKEN, OMISE_*) comes from the environment only — never from the repo
// (see deploy/.env.example). Values the owner still has to confirm (PromptPay id, bank account, home page) default to
// "off" so the site never shows a payment target that nobody approved.
import { fileURLToPath } from 'node:url';
import { join, resolve } from 'node:path';

export const ROOT = fileURLToPath(new URL('..', import.meta.url));   // sbp-aircare/
export const VERSION = 'r10-2569-10-09';
export const PAGES = ['a', 'b', 'c', 'd', 'a2', 'b2', 'c2', 'd2', 'a3', 'b3', 'c3'].map(v => v + '.html');

const bool = (v, d = false) => (v == null || v === '' ? d : /^(1|true|yes|on)$/i.test(String(v)));
const int = (v, d) => (v == null || v === '' || !Number.isFinite(+v) ? d : Math.trunc(+v));
const list = (v, d) => (v == null || v === '' ? d : String(v).split(',').map(s => s.trim()).filter(Boolean));
const json = (v, d) => { try { const j = JSON.parse(v); return j == null ? d : j; } catch (e) { return d; } };

export function loadConfig(env = process.env) {
  const prod = env.NODE_ENV === 'production';
  const dataDir = resolve(env.DATA_DIR || join(ROOT, 'data'));
  const home = (env.HOME_PAGE || 'c.html').replace(/^\/+/, '');
  const pages = list(env.PUBLIC_PAGES, PAGES).filter(p => PAGES.includes(p));
  const promptpayId = String(env.PROMPTPAY_ID || '').replace(/\D/g, '');
  const cfg = {
    prod, dev: !prod && bool(env.DEV, false),
    host: env.HOST || '127.0.0.1', port: int(env.PORT, 8080),
    // hosted platforms publish the service address themselves (Render: RENDER_EXTERNAL_URL · Railway: RAILWAY_PUBLIC_DOMAIN)
    siteUrl: String(env.SITE_URL || env.RENDER_EXTERNAL_URL || (env.RAILWAY_PUBLIC_DOMAIN ? 'https://' + env.RAILWAY_PUBLIC_DOMAIN : '')).replace(/\/+$/, ''),
    // behind a proxy: X-Forwarded-For entry counted from the right (1 = Caddy/nginx appends the client last; Render's own
    // proxy appends one more hop, so its default is 2). Entries further left are client-supplied and never trusted.
    trustProxy: bool(env.TRUST_PROXY, !!env.RENDER),
    proxyHops: Math.max(1, int(env.TRUST_PROXY_HOPS, env.RENDER ? 2 : 1)),
    // first admin for hosted installs without a shell: created at start only while the staff table is empty
    bootstrapAdmin: env.ADMIN_USER && env.ADMIN_PASSWORD ? { username: env.ADMIN_USER, name: env.ADMIN_NAME || env.ADMIN_USER, password: env.ADMIN_PASSWORD } : null,
    dataDir, dbFile: resolve(env.DB_FILE || join(dataDir, 'aircare.sqlite')),
    backupDir: resolve(env.BACKUP_DIR || join(dataDir, 'backups')), backupKeep: int(env.BACKUP_KEEP, 14),
    home: PAGES.includes(home) ? home : 'c.html',
    // beta (default): prototype chrome stays (Beta bar, feedback, design switcher) · live: public launch — the server hides it
    siteMode: env.SITE_MODE === 'live' ? 'live' : 'beta',
    pages: pages.includes(home) ? pages : [...pages, home],
    // tickets (same knobs as the Apps Script properties — backoffice/README.md)
    staffToken: env.STAFF_TOKEN || '',
    teams: (a => (Array.isArray(a) && a.length ? a.map(String) : ['ทีม 1', 'ทีม 2', 'ผู้รับเหมา']))(json(env.TEAMS, null)),
    slotCapacity: (n => (n > 0 ? n : 2))(+(env.SLOT_CAPACITY || 2)),
    notifyEmail: list(env.NOTIFY_EMAIL, []),
    customerAck: bool(env.CUSTOMER_ACK, false),
    customerNotify: bool(env.CUSTOMER_NOTIFY, false),
    retentionDays: int(env.RETENTION_DAYS, 0),
    // outgoing mail (company Gmail: smtp.gmail.com 465 + App Password) and LINE Messaging API
    smtp: { host: env.SMTP_HOST || '', port: int(env.SMTP_PORT, 465), secure: bool(env.SMTP_SECURE, int(env.SMTP_PORT, 465) === 465), user: env.SMTP_USER || '', pass: env.SMTP_PASS || '', from: env.MAIL_FROM || env.SMTP_USER || '' },
    mailTransport: env.MAIL_TRANSPORT || (env.SMTP_HOST ? 'smtp' : 'none'),   // smtp | memory (dev/tests) | none
    line: { token: env.LINE_TOKEN || '', to: env.LINE_TO || '' },
    // payments — phase 1 (no gateway): PromptPay QR to the company's own PromptPay id + bank transfer + pay on site;
    // the office confirms every payment against the bank statement. Phase 2: a gateway (OMISE_*), off unless keys are set.
    pay: {
      promptpayId: /^(\d{10}|\d{13}|\d{15})$/.test(promptpayId) ? promptpayId : '',
      payee: env.PAYEE_NAME || 'บริษัท สหบูรพากรุ๊ป จำกัด',
      bank: env.BANK_NAME || '', accountName: env.BANK_ACCOUNT_NAME || '', accountNo: env.BANK_ACCOUNT_NO || '',
      onsite: bool(env.PAY_ONSITE, true),
      requestDays: int(env.PAY_REQUEST_DAYS, 7),
    },
    omise: { publicKey: env.OMISE_PUBLIC_KEY || '', secretKey: env.OMISE_SECRET_KEY || '', webhookSecret: env.OMISE_WEBHOOK_SECRET || '', api: env.OMISE_API || 'https://api.omise.co' },
    limits: {
      bodyBytes: 64 * 1024, createPerTel: 5, createPerIp: 20, createGlobal: 300, trackPerIp: 30, loginPerIp: 10, payPerIp: 20,
    },
  };
  return cfg;
}

// Problems that must stop a production start (and warnings worth printing). Never prints secret values.
export function checkConfig(cfg) {
  const errors = [], warnings = [];
  if (cfg.prod) {
    if (!cfg.siteUrl.startsWith('https://')) errors.push('SITE_URL must be the public https:// address in production');
    if (cfg.staffToken && cfg.staffToken.length < 24) errors.push('STAFF_TOKEN must be at least 24 characters (or unset it and use staff accounts)');
    if (cfg.mailTransport === 'smtp' && (!cfg.smtp.user || !cfg.smtp.pass)) errors.push('SMTP_USER and SMTP_PASS are required when SMTP_HOST is set');
    if (cfg.bootstrapAdmin && cfg.bootstrapAdmin.password.length < 10) errors.push('ADMIN_PASSWORD must be at least 10 characters');
    if (!cfg.trustProxy) warnings.push('TRUST_PROXY is off — behind Caddy/nginx every visitor shares the proxy address for the per-address limits (set TRUST_PROXY=1)');
    if (!cfg.notifyEmail.length && !cfg.line.token) warnings.push('NOTIFY_EMAIL / LINE_TOKEN not set — new tickets reach staff only through the back office');
  }
  if (!cfg.pay.promptpayId) warnings.push('PROMPTPAY_ID not set — online PromptPay QR is off (bank transfer / pay on site only)');
  if (cfg.omise.secretKey && !cfg.omise.webhookSecret) errors.push('OMISE_WEBHOOK_SECRET is required when OMISE_SECRET_KEY is set');
  return { errors, warnings };
}
