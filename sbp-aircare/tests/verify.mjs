// r20 one-command verification of A · B · C → tests/out/summary.md (+ one log per check in tests/out/)
//   npm run verify          full set (~60–90 min on the swiftshader container: smoke, flows, axe, measured audit …)
//   npm run verify:quick    the fast subset (~10 min) — run before every commit
// Starts `python3 -m http.server 8765` when nothing answers on BASE. Recon runs only when internal/sbp_real.json exists
// (the internal Pricebook extract is never committed — CLAUDE.md §7). Exit 1 when any check fails.
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..'), OUT = join(ROOT, 'tests', 'out');
const BASE = process.env.BASE || 'http://localhost:8765';
const QUICK = process.argv.includes('--quick');
const JOBS = Math.max(1, +(process.env.VERIFY_JOBS || 2));
mkdirSync(OUT, { recursive: true });

const node = (f, ...a) => ['node', [`tests/${f}`, ...a]];
const E = 'abc';
const checks = [
  ['ราคา: หลักร้อย ก่อน VAT ใบกำกับภาษี ราคาขั้นบันได', 'pricing', node('pricing.mjs')],
  ['กระทบยอดราคากับ Pricebook ภายใน (recon)', 'recon', existsSync(join(ROOT, 'internal', 'sbp_real.json')) ? ['python3', ['tools_recon.py']] : null],
  ...[...E].map(v => [`คำต้องห้าม ต้นทุน อัตราภายใน · ${v.toUpperCase()}`, `textscan-${v}`, node('textscan.mjs', `${v}.html`)]),
  ...[...E].map(v => [`smoke 1366 · ${v.toUpperCase()} (error, WebGL, เลื่อนแนวนอน)`, `smoke-${v}-1366`, node('smoke.mjs', `${v}.html`)]),
  ...(QUICK ? [] : [...E].map(v => [`smoke 390 · ${v.toUpperCase()}`, `smoke-${v}-390`, node('smoke.mjs', `${v}.html`, '390', '844')])),
  ...(QUICK ? [['flow C 390 มืด', 'flow-c-390', node('abc-flow.mjs', 'c', '390', 'dark')]]
    : [['flow A 1366 สว่าง', 'flow-a-1366', node('abc-flow.mjs', 'a', '1366', 'light')], ['flow B 1366 มืด', 'flow-b-1366', node('abc-flow.mjs', 'b', '1366', 'dark')], ['flow C 390 มืด', 'flow-c-390', node('abc-flow.mjs', 'c', '390', 'dark')]]),
  ...(QUICK ? [['axe WCAG 2.2 AA · C มืด 1366', 'axe-c-dark', node('axe.mjs', 'c', 'dark')]]
    : [['a', 'light'], ['a', 'dark'], ['b', 'light'], ['b', 'dark'], ['c', 'dark'], ['c', 'light']].map(([v, t]) => [`axe WCAG 2.2 AA · ${v.toUpperCase()} ${t === 'dark' ? 'มืด' : 'สว่าง'} 1366`, `axe-${v}-${t}`, node('axe.mjs', v, t)]).concat([['axe WCAG 2.2 AA · C มืด 390', 'axe-c-dark-390', node('axe.mjs', 'c', 'dark', '390')], ['axe WCAG 2.2 AA · หน้าระบบออกแบบ (styleguide)', 'axe-styleguide', node('axe.mjs', 'styleguide', 'light')]])),
  ...(QUICK ? [] : [...E].map(v => [`วัดค่า มือถือ 390 DPR 3 · ${v.toUpperCase()} (ตัวอักษร เป้ากด ตัดคำ)`, `audit-${v}-390`, node('audit.mjs', v, '390', v === 'c' ? 'dark' : 'light', '3')])
    .concat([['วัดค่า จอใหญ่ 1366 DPR 2 · C', 'audit-c-1366', node('audit.mjs', 'c', '1366', 'dark', '2')]])),
  ...(QUICK ? [] : [['จองคิว → ticket → หลังบ้าน (A 1366)', 'booking-e2e-a', node('booking-e2e.mjs', 'a.html', '1366', 'light')]]),
];

const up = async () => { try { return (await fetch(`${BASE}/a.html`, { method: 'HEAD' })).ok; } catch (e) { return false; } };
let srv = null;
if (!(await up())) {
  srv = spawn('python3', ['-m', 'http.server', new URL(BASE).port || '8765'], { cwd: ROOT, stdio: 'ignore' });
  for (let i = 0; i < 40 && !(await up()); i++) await new Promise(r => setTimeout(r, 250));
}
const run = ([label, key, cmd]) => new Promise(res => {
  if (!cmd) return res({ label, key, status: 'skip', ms: 0, line: 'ไม่มี internal/sbp_real.json (ไฟล์ภายใน — เจ้าของอัปโหลดให้เมื่อต้องรัน)' });
  const t0 = Date.now(); let log = '';
  const c = spawn(cmd[0], cmd[1], { cwd: ROOT, env: { ...process.env, BASE } });
  c.stdout.on('data', d => log += d); c.stderr.on('data', d => log += d);
  c.on('close', code => {
    writeFileSync(join(OUT, key + '.log'), log);
    const lines = log.trim().split('\n'), r = lines.filter(l => l.startsWith('RESULT ')).pop();
    const line = r ? r.slice(7) : (lines.filter(l => /^\{.*\}$/.test(l.trim())).pop() || lines.pop() || '').slice(0, 300);
    const out = { label, key, status: code === 0 ? 'pass' : 'fail', ms: Date.now() - t0, line };
    console.log(`${out.status === 'pass' ? 'ok  ' : 'FAIL'} ${label} (${Math.round(out.ms / 1000)} s)`);
    res(out);
  });
});
const results = new Array(checks.length); let next = 0;
await Promise.all(Array.from({ length: JOBS }, async () => { while (next < checks.length) { const i = next++; results[i] = await run(checks[i]); } }));
if (srv) srv.kill();

const fail = results.filter(r => r.status === 'fail'), pass = results.filter(r => r.status === 'pass');
const git = await new Promise(r => { let o = ''; const g = spawn('git', ['log', '-1', '--format=%h %s'], { cwd: ROOT }); g.stdout.on('data', d => o += d); g.on('close', () => r(o.trim())); });
const md = [
  `# ผลตรวจ A · B · C ${QUICK ? '(ชุดเร็ว)' : '(ชุดเต็ม)'}`,
  '', `- วันที่: ${new Date().toISOString().replace('T', ' ').slice(0, 16)} UTC · commit: \`${git}\` · BASE: ${BASE}`,
  `- ผล: **${fail.length ? `ไม่ผ่าน ${fail.length} จาก ${pass.length + fail.length}` : `ผ่านทั้งหมด ${pass.length}`}**${results.some(r => r.status === 'skip') ? ` · ข้าม ${results.filter(r => r.status === 'skip').length}` : ''}`,
  '', '| ผล | การตรวจ | เวลา | สรุป |', '|---|---|---|---|',
  ...results.map(r => `| ${r.status === 'pass' ? '✅' : r.status === 'skip' ? '⏭️' : '❌'} | ${r.label} | ${Math.round(r.ms / 1000)} s | \`${(r.line || '').replace(/\|/g, '\\|').slice(0, 220)}\` |`),
  '', 'log ของแต่ละการตรวจ: `tests/out/<key>.log` · ภาพ 3 มิติบนเครื่องทดสอบใช้ WebGL แบบซอฟต์แวร์ (swiftshader) — ค่าความคมของ canvas และความเร็วใช้เทียบก่อน/หลังเท่านั้น', '',
];
writeFileSync(join(OUT, 'summary.md'), md.join('\n'));
console.log(`\n${fail.length ? 'FAIL' : 'ok'} — tests/out/summary.md`);
process.exit(fail.length ? 1 : 0);
