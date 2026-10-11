// Rev.10 — hosted deploy (render.yaml / Railway): the platform's own public address stands in for SITE_URL, the client IP
// comes from the right X-Forwarded-For hop behind the platform proxy, and ADMIN_USER / ADMIN_PASSWORD create the first
// admin only while no staff account exists. Starts the real server (NODE_ENV=production) on a free port with a temp DATA_DIR.
// usage: node --disable-warning=ExperimentalWarning tests/deploy.mjs
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadConfig, checkConfig } from '../server/config.mjs';

const ROOT = new URL('..', import.meta.url).pathname;
let fails = 0, n = 0;
const ok = (c, m, x) => { n++; if (!c) { fails++; console.log('✗', m, x !== undefined ? JSON.stringify(x) : ''); } else console.log('✓', m); };

// config only
const r = loadConfig({ NODE_ENV: 'production', RENDER: 'true', RENDER_EXTERNAL_URL: 'https://sbp-aircare.onrender.com/' });
ok(r.siteUrl === 'https://sbp-aircare.onrender.com' && r.trustProxy && r.proxyHops === 2, 'Render: site URL from RENDER_EXTERNAL_URL, proxy trusted, 2 hops', [r.siteUrl, r.trustProxy, r.proxyHops]);
ok(!checkConfig(r).errors.length, 'Render: production config starts without SITE_URL', checkConfig(r).errors);
const w = loadConfig({ NODE_ENV: 'production', RAILWAY_PUBLIC_DOMAIN: 'sbp.up.railway.app', TRUST_PROXY: '1' });
ok(w.siteUrl === 'https://sbp.up.railway.app' && w.proxyHops === 1, 'Railway: https:// + RAILWAY_PUBLIC_DOMAIN, 1 hop', [w.siteUrl, w.proxyHops]);
const s = loadConfig({ NODE_ENV: 'production', SITE_URL: 'https://www.example.co.th', RENDER: 'true', RENDER_EXTERNAL_URL: 'https://x.onrender.com', TRUST_PROXY: '0', TRUST_PROXY_HOPS: '3' });
ok(s.siteUrl === 'https://www.example.co.th' && !s.trustProxy && s.proxyHops === 3, 'explicit SITE_URL / TRUST_PROXY / TRUST_PROXY_HOPS win', [s.siteUrl, s.trustProxy, s.proxyHops]);
ok(loadConfig({}).bootstrapAdmin === null && loadConfig({ ADMIN_USER: 'owner' }).bootstrapAdmin === null, 'no first admin unless both ADMIN_USER and ADMIN_PASSWORD are set');
ok(checkConfig(loadConfig({ NODE_ENV: 'production', SITE_URL: 'https://a.b', ADMIN_USER: 'owner', ADMIN_PASSWORD: 'short' })).errors.some(e => /ADMIN_PASSWORD/.test(e)), 'short ADMIN_PASSWORD refuses to start');

// the real server
const port = () => new Promise(res => { const v = createServer().listen(0, '127.0.0.1', () => { const p = v.address().port; v.close(() => res(p)); }); });
const DATA = mkdtempSync(join(tmpdir(), 'sbp-deploy-'));
const start = async (extra = {}) => {
  const PORT = await port();
  const env = { ...process.env, NODE_ENV: 'production', HOST: '127.0.0.1', PORT: String(PORT), DATA_DIR: DATA, MAIL_TRANSPORT: 'none', DEV: '',
    RENDER: 'true', RENDER_EXTERNAL_URL: 'https://sbp-aircare.onrender.com', ADMIN_USER: 'owner', ADMIN_NAME: 'เจ้าของ', ADMIN_PASSWORD: 'first-admin-pass-1', ...extra };
  const srv = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'server/index.mjs'], { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] });
  let out = '';
  srv.stdout.on('data', d => { out += d; }); srv.stderr.on('data', d => { out += d; });
  const code = await new Promise(res => {
    const t = setInterval(() => { if (/SBP AirCare .* http:\/\//.test(out)) { clearInterval(t); res(null); } }, 50);
    srv.on('exit', c => { clearInterval(t); res(c); });
    setTimeout(() => { clearInterval(t); res('timeout'); }, 20000);
  });
  const api = (body, xff) => fetch(`http://127.0.0.1:${PORT}/exec`, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8', ...(xff ? { 'X-Forwarded-For': xff } : {}) }, body: JSON.stringify(body) }).then(x => x.json());
  return { srv, code, out: () => out, api, stop: () => new Promise(res => { if (srv.exitCode != null) return res(); srv.on('exit', res); srv.kill('SIGTERM'); }) };
};

try {
  const a = await start();
  ok(a.code === null, 'production server starts with only the Render variables + first admin', a.out().slice(-400));
  ok(/created the first admin account "owner"/.test(a.out()) && !/first-admin-pass-1/.test(a.out()), 'first admin created, password never printed');
  const li = await a.api({ action: 'login', user: 'owner', password: 'first-admin-pass-1' });
  ok(li.ok && li.role === 'admin' && li.name === 'เจ้าของ', 'first admin can sign in as admin', li);
  // client IP = second entry from the right (Render appends its own hop); the client-supplied left part is ignored
  const bad = xff => a.api({ action: 'login', user: 'owner', password: 'wrong-password-x' }, xff);
  for (let i = 0; i < 10; i++) await bad(`9.9.9.${i}, 203.0.113.7, 10.1.2.3`);
  const lim = await bad('8.8.8.8, 203.0.113.7, 10.9.9.9');
  ok(lim.error === 'rate_limited', 'same client behind the platform proxy is limited even with a forged left entry', lim);
  const other = await a.api({ action: 'login', user: 'nobody-here', password: 'wrong-password-x' }, '203.0.113.8, 10.1.2.3');
  ok(other.error === 'unauthorized', 'a different client is not caught by that limit', other);
  await a.stop();

  const b = await start({ ADMIN_PASSWORD: 'changed-later-pass-2', ADMIN_USER: 'owner2' });
  ok(b.code === null && !/created the first admin/.test(b.out()), 'restart with staff present creates nothing', b.out().slice(-300));
  const old = await b.api({ action: 'login', user: 'owner', password: 'first-admin-pass-1' });
  const neu = await b.api({ action: 'login', user: 'owner2', password: 'changed-later-pass-2' });
  ok(old.ok && neu.error === 'unauthorized', 'existing admin keeps its password; ADMIN_* is ignored once staff exist', [old.ok, neu.error]);
  await b.stop();

  rmSync(DATA, { recursive: true, force: true });
  const c = await start({ ADMIN_PASSWORD: 'short' });
  ok(c.code === 1 && /ADMIN_PASSWORD/.test(c.out()), 'short ADMIN_PASSWORD stops the production start', [c.code, c.out().slice(-200)]);
  await c.stop();
} finally {
  rmSync(DATA, { recursive: true, force: true });
}
console.log(`RESULT ${JSON.stringify({ test: 'deploy', n, fails, pass: !fails })}`);
process.exit(fails ? 1 : 0);
