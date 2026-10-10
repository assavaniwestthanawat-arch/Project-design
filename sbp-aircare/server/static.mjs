// SBP AirCare server — static files by ALLOWLIST (never the repo root), security headers, compression, caching. Rev.10.
// Public: the chosen home page at "/", the public variants, legal pages, the staff board, and assets/ files of web types.
// Never: *.md docs, tools/, tests/, backoffice/ (Apps Script + dev data), internal/ (special/project rates — CLAUDE.md
// §6.6 #3/#4), legacy hub pages (internal decisions, competitor review), test-*.html, preview*.html, package/build files.
import { readFileSync, statSync, existsSync } from 'node:fs';
import { join, extname, normalize, sep } from 'node:path';
import { createHash } from 'node:crypto';
import { gzipSync, brotliCompressSync, constants as Z } from 'node:zlib';

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.avif': 'image/avif',
  '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml; charset=utf-8', '.ico': 'image/png',
};
const ASSET_EXT = new Set(['.js', '.css', '.woff2', '.png', '.jpg', '.jpeg', '.webp', '.avif', '.svg']);
const ASSET_JSON = new Set(['assets/sbp-data.json', 'assets/thai-provinces.json', 'assets/product-media.json']);
const ASSET_DENY = /^assets\/(photos\/photos\.json|.*\.(md|txt))$/;
export const LEGAL = ['privacy.html', 'terms.html', 'refund.html'];
const TEXTY = /^(text\/|application\/(json|xml)|image\/svg)/;

export function securityHeaders(req, cfg) {
  const h = {
    'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin', 'X-Frame-Options': 'DENY',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()', 'Cross-Origin-Opener-Policy': 'same-origin',
  };
  const https = cfg.trustProxy ? String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim() === 'https' : !!req.socket.encrypted;
  if (https || cfg.siteUrl.startsWith('https://')) h['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains';
  return h;
}

export function createStatic(cfg, root) {
  const cache = new Map();   // path → {mtime, body, type, etag, csp, gz?, br?}
  const pageSet = new Set(cfg.pages);

  function htmlTransform(rel, src) {
    // same-origin API: ticket.js reads <meta name="sbp-api"> (Artifact / offline builds have none → "not connected")
    let html = src.replace(/<head>/i, '<head>\n<meta name="sbp-api" content="/exec">');
    if (cfg.siteUrl && rel === cfg.home && !/rel="canonical"/.test(html)) html = html.replace(/<\/head>/i, `<link rel="canonical" href="${cfg.siteUrl}/">\n</head>`);
    if (!/rel="icon"/.test(html)) html = html.replace(/<\/head>/i, '<link rel="icon" href="/favicon.ico" type="image/png">\n</head>');
    // CSP: every executable inline script by hash (each page has exactly one inline module — build.py asserts it)
    const hashes = [];
    for (const m of html.matchAll(/<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/gi)) {
      if (/type\s*=\s*["']?application\/(ld\+)?json/i.test(m[1])) continue;
      hashes.push(`'sha256-${createHash('sha256').update(m[2], 'utf8').digest('base64')}'`);
    }
    const csp = [`default-src 'none'`, `script-src 'self' ${hashes.join(' ')}`.trim(), `style-src 'self' 'unsafe-inline'`, `img-src 'self' data: blob:`,
      `font-src 'self'`, `connect-src 'self'`, `media-src 'self' blob:`, `worker-src 'self' blob:`, `manifest-src 'self'`, `base-uri 'none'`, `form-action 'self'`,
      `frame-ancestors 'none'`, `object-src 'none'`].join('; ');
    return { body: Buffer.from(html, 'utf8'), csp };
  }

  // URL path → repo-relative file, or null (404)
  function resolvePath(pathname) {
    let p;
    try { p = decodeURIComponent(pathname); } catch (e) { return null; }
    if (p.includes('\0') || p.includes('\\')) return null;
    p = normalize(p).split(sep).join('/').replace(/^\/+/, '');
    if (p.split('/').some(s => s === '..' || s.startsWith('.'))) return null;
    if (p === '' || p === 'index.html') return cfg.home;
    if (pageSet.has(p) || LEGAL.includes(p) || p === 'backoffice.html' || p === '404.html') return p;
    if (p.startsWith('assets/')) {
      if (ASSET_DENY.test(p)) return null;
      const ext = extname(p).toLowerCase();
      if (ASSET_EXT.has(ext) || (ext === '.json' && ASSET_JSON.has(p))) return p;
    }
    return null;
  }

  function load(rel) {
    const f = join(root, rel);
    let st; try { st = statSync(f); } catch (e) { return null; }
    if (!st.isFile()) return null;
    const hit = cache.get(rel);
    if (hit && hit.mtime === st.mtimeMs && hit.size === st.size) return hit;
    const ext = extname(rel).toLowerCase(), type = TYPES[ext] || 'application/octet-stream';
    let body = readFileSync(f), csp = '';
    if (ext === '.html') ({ body, csp } = htmlTransform(rel, body.toString('utf8')));
    const e = { mtime: st.mtimeMs, size: st.size, body, type, csp, etag: '"' + createHash('sha1').update(body).digest('base64url').slice(0, 20) + '"' };
    cache.set(rel, e);
    return e;
  }

  function send(req, res, rel, extra = {}) {
    const e = load(rel);
    if (!e) return false;
    const ext = extname(rel).toLowerCase();
    const h = { ...securityHeaders(req, cfg), 'Content-Type': e.type, ETag: e.etag, Vary: 'Accept-Encoding', ...extra };
    if (ext === '.html') {
      h['Content-Security-Policy'] = e.csp;
      h['Cache-Control'] = rel === 'backoffice.html' ? 'no-store' : 'no-cache';
      if (rel === 'backoffice.html' || (rel !== cfg.home && !LEGAL.includes(rel))) h['X-Robots-Tag'] = 'noindex';
    } else h['Cache-Control'] = /\.(woff2|png|jpe?g|webp|avif)$/.test(ext) ? 'public, max-age=604800' : 'no-cache';   // asset names are not hashed
    if (req.headers['if-none-match'] === e.etag) { res.writeHead(304, h); res.end(); return true; }
    let body = e.body;
    const ae = String(req.headers['accept-encoding'] || '');
    if (TEXTY.test(e.type) && body.length > 1024) {
      if (/\bbr\b/.test(ae)) { e.br = e.br || brotliCompressSync(body, { params: { [Z.BROTLI_PARAM_QUALITY]: 9 } }); body = e.br; h['Content-Encoding'] = 'br'; }
      else if (/\bgzip\b/.test(ae)) { e.gz = e.gz || gzipSync(body, { level: 9 }); body = e.gz; h['Content-Encoding'] = 'gzip'; }
    }
    h['Content-Length'] = body.length;
    res.writeHead(extra.status || 200, h);
    res.end(req.method === 'HEAD' ? undefined : body);
    return true;
  }

  function special(req, res, pathname) {
    const base = { ...securityHeaders(req, cfg), 'Cache-Control': 'public, max-age=3600' };
    if (pathname === '/robots.txt') {
      const body = ['User-agent: *', 'Disallow: /backoffice.html', 'Disallow: /exec', 'Disallow: /api/', ...(cfg.siteUrl ? [`Sitemap: ${cfg.siteUrl}/sitemap.xml`] : [])].join('\n') + '\n';
      res.writeHead(200, { ...base, 'Content-Type': TYPES['.txt'] }); res.end(body); return true;
    }
    if (pathname === '/sitemap.xml') {
      if (!cfg.siteUrl) return false;
      const urls = ['/', ...LEGAL.filter(p => existsSync(join(root, p))).map(p => '/' + p)];
      const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(u => `  <url><loc>${cfg.siteUrl}${u}</loc></url>`).join('\n')}\n</urlset>\n`;
      res.writeHead(200, { ...base, 'Content-Type': TYPES['.xml'] }); res.end(body); return true;
    }
    if (pathname === '/favicon.ico') return send(req, res, 'assets/logos/sbp.png', { 'Content-Type': 'image/png' });
    return false;
  }

  return {
    handle(req, res, pathname) {
      if (special(req, res, pathname)) return true;
      const rel = resolvePath(pathname);
      if (rel && send(req, res, rel)) return true;
      return false;
    },
    notFound(req, res) {
      const h = { ...securityHeaders(req, cfg), 'Content-Type': TYPES['.html'], 'Cache-Control': 'no-store', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; img-src 'self'; base-uri 'none'; frame-ancestors 'none'" };
      res.writeHead(404, h);
      res.end(`<!doctype html><html lang="th"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ไม่พบหน้านี้ · SBP AirCare</title><body style="font:16px/1.6 system-ui,sans-serif;max-width:36rem;margin:15vh auto;padding:0 16px;color:#15202C"><h1 style="font-size:1.5rem">ไม่พบหน้านี้</h1><p>ลิงก์อาจพิมพ์ผิดหรือหน้านี้ถูกย้ายแล้ว</p><p><a href="/" style="color:#1B51A4">กลับหน้าแรก SBP AirCare</a></p></body></html>`);
    },
    resolvePath, load,
  };
}
