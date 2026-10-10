// SBP AirCare server — minimal SMTP client (no dependencies). Rev.10.
// Gmail: SMTP_HOST=smtp.gmail.com SMTP_PORT=465 (implicit TLS) with an App Password; 587 uses STARTTLS.
// Plain text UTF-8 mail only (base64 body, RFC 2047 subject) — enough for ticket and payment notices.
import net from 'node:net';
import tls from 'node:tls';
import { randomBytes } from 'node:crypto';
import { hostname } from 'node:os';

const b64 = s => Buffer.from(String(s), 'utf8').toString('base64');
const enc = s => (/^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${b64(s)}?=`);
const addr = s => { const m = /<([^>]+)>/.exec(s); return (m ? m[1] : String(s)).trim(); };
const wrap = s => s.replace(/.{1,76}/g, '$&\r\n');

export function buildMessage({ from, to, subject, text }) {
  const fromName = /^(.*?)\s*<[^>]+>$/.exec(from);
  const domain = addr(from).split('@')[1] || 'localhost';
  const headers = [
    `From: ${fromName && fromName[1] ? `${enc(fromName[1].replace(/"/g, ''))} <${addr(from)}>` : addr(from)}`,
    `To: ${to.map(addr).join(', ')}`,
    `Subject: ${enc(subject)}`,
    `Date: ${new Date().toUTCString().replace('GMT', '+0000')}`,
    `Message-ID: <${randomBytes(12).toString('hex')}@${domain}>`,
    'MIME-Version: 1.0', 'Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: base64',
  ];
  return headers.join('\r\n') + '\r\n\r\n' + wrap(b64(text));
}

export function sendMail(smtp, { to, subject, text }, { timeoutMs = 20000 } = {}) {
  const rcpt = (Array.isArray(to) ? to : String(to).split(',')).map(s => s.trim()).filter(Boolean);
  if (!rcpt.length) return Promise.reject(new Error('no recipient'));
  return new Promise((resolve, reject) => {
    let sock = smtp.secure ? tls.connect({ host: smtp.host, port: smtp.port, servername: smtp.host }) : net.connect({ host: smtp.host, port: smtp.port });
    let buf = '', waiter = null, done = false;
    const finish = (err, v) => { if (done) return; done = true; clearTimeout(timer); try { sock.destroy(); } catch (e) {} err ? reject(err) : resolve(v); };
    const timer = setTimeout(() => finish(new Error('smtp timeout')), timeoutMs);
    const onData = d => {
      buf += d.toString('utf8');
      // a reply is complete when its last line is "NNN text" (not "NNN-text")
      const lines = buf.split('\r\n'); if (lines[lines.length - 1] !== '') return;
      const last = lines[lines.length - 2] || '';
      if (/^\d{3} /.test(last) || /^\d{3}$/.test(last)) { const r = { code: +last.slice(0, 3), text: buf }; buf = ''; const w = waiter; waiter = null; w && w(r); }
    };
    const attach = s => { s.on('data', onData); s.on('error', e => finish(e)); };
    attach(sock);
    const read = () => new Promise(res => { waiter = res; });
    const cmd = async (line, ok) => { sock.write(line + '\r\n'); const r = await read(); if (!ok.includes(r.code)) throw new Error(`smtp ${line.split(' ')[0]} → ${r.code}`); return r; };
    (async () => {
      let r = await read(); if (r.code !== 220) throw new Error('smtp greeting ' + r.code);
      const me = hostname() || 'localhost';
      r = await cmd(`EHLO ${me}`, [250]);
      if (!smtp.secure && /STARTTLS/i.test(r.text)) {
        await cmd('STARTTLS', [220]);
        sock.removeAllListeners('data');
        sock = tls.connect({ socket: sock, servername: smtp.host }); attach(sock);
        await new Promise((res, rej) => { sock.once('secureConnect', res); sock.once('error', rej); });
        r = await cmd(`EHLO ${me}`, [250]);
      }
      if (smtp.user) { await cmd('AUTH LOGIN', [334]); await cmd(b64(smtp.user), [334]); await cmd(b64(smtp.pass), [235]); }
      await cmd(`MAIL FROM:<${addr(smtp.from || smtp.user)}>`, [250]);
      for (const a of rcpt) await cmd(`RCPT TO:<${addr(a)}>`, [250, 251]);
      await cmd('DATA', [354]);
      const msg = buildMessage({ from: smtp.from || smtp.user, to: rcpt, subject, text });
      r = await cmd(msg + '\r\n.', [250]);
      try { sock.write('QUIT\r\n'); } catch (e) {}
      finish(null, { accepted: rcpt.length, reply: r.text.trim().slice(0, 200) });
    })().catch(e => finish(e));
  });
}
