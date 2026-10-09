// SBP AirCare — the owner's smoothness test panel (r15, owner 6 ต.ค. 2569: "เตรียมให้ผมทดสอบทุก version ในส่วนของการพัฒนา
// Lighting effect, Animation, Motion, Movement, 5D, 4D, 3D ให้ smooth ไม่สะดุดติด bug ใดๆ").
// Opened from the beta bar of every edition ("ทดสอบความลื่น") or with #perftest at the end of the link. It measures THIS page
// on THIS device — the numbers that matter are the owner's phone and computer, not a test server:
//   live meter   frames per second, the slowest frames (95th percentile), stutters (a frame longer than 50 ms), main-thread
//                stalls (long tasks — Chrome / Edge / Android only), 3D scenes on / budget, resolution level, page errors
//   auto tour    opens every page view, brings each part on screen, waits for its 3D to start, presses the controls of every
//                3D tool (type tabs, steps, x-ray, explode, play …) and records how each part ran — never cart, booking, links
//   every model  shows all catalogue models one after another in the 3D viewer of the product panel (model3d.js) and checks
//                each one was built (a finite size, no error) and how long it took
//   resolution   automatic (adaptive, gl-pool) or pinned — to compare sharpness against smoothness on this device
// Nothing is sent by itself: "ส่งผลให้ทีม" opens the beta feedback form with the summary filled in.
// What the words mean here (said in the panel): 3D = a model you can turn · 4D = 3D that moves in time (airflow, the crew at
// work, cleaning steps, camera moves) · 5D = 4D + another sense (room sound, and a short vibration on Android phones).
import { h, $, $$, DEMO, BRAND_BY_ID } from './sbp-core.js';
import { glStats, glLock, glFocus, GL_STEPS } from './gl-pool.js';
import { openFeedback } from './feedback.js';

const SKIP = /ใบเสนอราคา|จอง|เพิ่ม|ส่ง|โทร|ติดต่อ|ให้ความเห็น|ค้นหา|เทียบ|ปิด|ซื้อ|สอบถาม|ดูราคา|รายละเอียด|เปิดหน้า|คัดลอก|ตะกร้า|ชำระ|ยืนยัน|นัด/;
const wait = ms => new Promise(r => setTimeout(r, ms));
const frames2 = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
let P = null;   // the open panel

/* ---- measurement: every frame interval and long task since the panel opened (bounded) ---- */
function meter() {
  const fr = [], lt = [], errs = []; let last = 0, raf = 0, po = null;
  const f = t => { if (last) { fr.push([t, t - last]); if (fr.length > 20000) fr.splice(0, 5000); } last = t; raf = requestAnimationFrame(f); };
  raf = requestAnimationFrame(f);
  try { po = new PerformanceObserver(l => l.getEntries().forEach(e => lt.push([e.startTime, e.duration]))); po.observe({ type: 'longtask', buffered: false }); } catch (_) { po = null; }
  const onErr = e => errs.push([performance.now(), String(e.message || (e.reason && (e.reason.message || e.reason)) || 'error').slice(0, 160)]);
  addEventListener('error', onErr); addEventListener('unhandledrejection', onErr);
  // when the tab is hidden rAF stops: the gap is not a stutter
  const vis = () => { last = 0; }; document.addEventListener('visibilitychange', vis);
  return {
    fr, lt, errs, longtasks: !!po,
    since(t0) {
      const d = fr.filter(x => x[0] >= t0).map(x => x[1]).sort((a, b) => a - b), n = d.length;
      const q = k => n ? Math.round(d[Math.min(n - 1, Math.floor(n * k))]) : 0;
      const secs = n ? fr.filter(x => x[0] >= t0).reduce((s, x) => s + x[1], 0) / 1000 : 0;
      const L = lt.filter(x => x[0] >= t0);
      return { n, fps: secs ? Math.round(n / secs) : 0, p50: q(0.5), p95: q(0.95), max: n ? Math.round(d[n - 1]) : 0, jank: d.filter(x => x > 50).length,
        stall: L.length ? Math.round(Math.max(...L.map(x => x[1]))) : 0, stalls: L.filter(x => x[1] > 200).length, errors: errs.filter(x => x[0] >= t0).map(x => x[1]) };
    },
    stop() { cancelAnimationFrame(raf); po && po.disconnect(); removeEventListener('error', onErr); removeEventListener('unhandledrejection', onErr); document.removeEventListener('visibilitychange', vis); },
  };
}
const grade = r => r.n < 5 ? 'na' : r.jank / r.n > 0.1 || r.stall > 400 || r.p95 > 70 ? 'bad' : r.jank / r.n > 0.03 || r.stall > 150 || r.p95 > 40 ? 'warn' : 'ok';
const GTH = { ok: 'ลื่น', warn: 'สะดุดเล็กน้อย', bad: 'สะดุด', na: 'ไม่มีภาพเคลื่อนไหว' };

/* ---- the parts of a page, in order: site.js views ([data-sx]) or the sections of a one-page edition ---- */
function parts() {
  const list = $$('main [data-sx], main > section, main > .wrap > section, main section[id]').filter((el, i, a) => a.indexOf(el) === i && !a.some(o => o !== el && o.contains(el)));
  return list.filter(el => !el.closest('.ph-hud'));
}
const nameOf = el => ((el.querySelector('h1,h2,h3') || {}).textContent || el.id || el.dataset.sx || 'ส่วนของหน้า').trim().replace(/\s+/g, ' ').slice(0, 48);
// the controls of the 3D tools inside a part: buttons / tabs / ranges sharing a box with a canvas
function controlsIn(el, max = 8) {
  const boxes = $$('canvas', el).filter(c => !c.closest('.ph-hud')).map(c => { let b = c.parentElement; for (let i = 0; i < 6 && b && b !== el; i++) { if (b.querySelectorAll('button,[role="tab"],input[type="range"]').length >= 2) break; b = b.parentElement; } return b || el; });
  const seen = new Set(), out = [];
  boxes.forEach(b => $$('button, [role="tab"], input[type="range"]', b).forEach(x => {
    if (seen.has(x) || out.length >= max) return; seen.add(x);
    if (!x.offsetParent || x.disabled || SKIP.test(x.textContent || x.getAttribute('aria-label') || '') || x.closest('a,[data-cart-btn],form,.ph-hud,[data-feedback]')) return;
    out.push(x);
  }));
  return out;
}
function press(x, i) {
  if (x.type === 'range') { const lo = +x.min || 0, hi = +x.max || 100; x.value = String(lo + (hi - lo) * (i % 2 ? 0.75 : 0.25)); x.dispatchEvent(new Event('input', { bubbles: true })); x.dispatchEvent(new Event('change', { bubbles: true })); }
  else x.click();
}

export function openPerfHud({ variant = '' } = {}) {
  if (P) { P.box.hidden = false; P.min(false); return P; }
  const M = meter(), t0 = performance.now();
  let stop = false, busy = false;
  const res = { tour: null, models: null };

  /* ---- panel ---- */
  const live = h('dl', { class: 'ph-live' });
  const spark = h('canvas', { width: 280, height: 44, class: 'ph-spark', 'aria-hidden': 'true' });
  const status = h('p', { class: 'ph-status', 'aria-live': 'polite' }, 'กำลังวัดหน้านี้บนเครื่องนี้ เลื่อนดูหรือกดเล่นภาพ 3 มิติได้ตามปกติ');
  const out = h('div', { class: 'ph-out' });
  const stage = h('div', { class: 'ph-stage', hidden: true });
  const btnTour = h('button', { type: 'button', onclick: () => run(tour) }, 'ทัวร์อัตโนมัติทุกส่วน');
  const btnModels = h('button', { type: 'button', onclick: () => run(walk) }, `ไล่ดูครบทุกรุ่น (${DEMO.skuCount || '…'} รุ่น)`);
  const btnStop = h('button', { type: 'button', hidden: true, onclick: () => { stop = true; } }, 'หยุด');
  const btnSend = h('button', { type: 'button', class: 'ph-send', onclick: send }, 'ส่งผลให้ทีม');
  const lvlSel = h('select', { 'aria-label': 'ความละเอียดภาพ 3 มิติ', onchange: () => glLock(lvlSel.value === '' ? null : +lvlSel.value) },
    h('option', { value: '' }, 'อัตโนมัติ (แนะนำ)'), GL_STEPS.map((s, i) => h('option', { value: i }, i === 0 ? 'คมสุด 100%' : `ลื่นขึ้น ${Math.round(s * 100)}%`)));
  const body = h('div', { class: 'ph-b' },
    live, spark, status,
    h('div', { class: 'ph-acts' }, btnTour, btnModels, btnStop, btnSend),
    h('label', { class: 'ph-lvl' }, 'ความละเอียด 3 มิติ', lvlSel),
    stage, out,
    h('details', { class: 'ph-help' }, h('summary', {}, 'ทดสอบอะไรได้บ้าง'),
      h('ul', {},
        h('li', {}, h('b', {}, '3D'), ' หมุน ลาก ซูมดูเครื่อง ห้อง และบ้านจำลอง'),
        h('li', {}, h('b', {}, '4D'), ' ภาพ 3 มิติที่เคลื่อนไหวตามเวลา ลมแอร์ ทีมช่างทำงาน ขั้นตอนล้าง กล้องเคลื่อน'),
        h('li', {}, h('b', {}, '5D'), ' เพิ่มประสาทสัมผัส เสียงลมในห้อง และสั่นสั้น ๆ บนมือถือ Android (ปุ่ม "เสียงลม" ใน "ดูรุ่นนี้แบบ 3 มิติ")'),
        h('li', {}, h('b', {}, 'แสงและเงา'), ' เงานุ่ม แสงสะท้อน แสงฟุ้ง ในภาพยนตร์ 3 มิติ (รุ่นที่ 2) และ "ดูรุ่นนี้แบบ 3 มิติ" ทุกเวอร์ชัน'),
        h('li', {}, h('b', {}, 'ลื่นแค่ไหน'), ' ลื่น = ภาพสะดุดน้อยกว่า 3% · สะดุดเล็กน้อย = 3–10% · สะดุด = มากกว่า 10% หรือหน้าค้างเกิน 0.4 วินาที'),
        h('li', {}, 'ผลขึ้นกับเครื่องที่ใช้ทดสอบ ควรลองทั้งมือถือและคอมพิวเตอร์ เบราว์เซอร์ Safari ไม่รายงานอาการหน้าค้าง'))));
  const minB = h('button', { type: 'button', class: 'ph-ic', 'aria-expanded': 'true', 'aria-label': 'ย่อแผง', onclick: () => min(!body.hidden) }, '–');
  const closeB = h('button', { type: 'button', class: 'ph-ic', 'aria-label': 'ปิดแผงทดสอบ', onclick: close }, '×');
  const box = h('section', { class: 'ph-hud', 'aria-label': 'แผงทดสอบความลื่น' }, h('header', { class: 'ph-h' }, h('b', {}, `ทดสอบความลื่น${variant ? ' · แบบ ' + variant : ''}`), minB, closeB), body);
  document.body.append(box);
  function min(v) { body.hidden = v; minB.setAttribute('aria-expanded', String(!v)); minB.textContent = v ? '+' : '–'; minB.setAttribute('aria-label', v ? 'ขยายแผง' : 'ย่อแผง'); }
  function close() { stop = true; clearInterval(tick); M.stop(); glLock(null); box.remove(); P = null; }

  /* ---- live meter, twice a second ---- */
  const tick = setInterval(() => {
    if (body.hidden) return;
    const now = performance.now(), r = M.since(now - 3000), g = glStats();
    const on = g.scenes.filter(s => s.state === 'live').length, act = g.scenes.filter(s => s.active);
    const row = (k, v, cls) => [h('dt', {}, k), h('dd', { class: cls || null }, v)];
    live.replaceChildren(
      ...row('ภาพต่อวินาที', r.n ? String(r.fps) : '—', r.fps && r.fps < 40 ? 'warn' : null),
      ...row('เฟรมช้าสุด 5%', r.n ? `${r.p95} มิลลิวินาที` : '—', r.p95 > 50 ? 'bad' : r.p95 > 33 ? 'warn' : null),
      ...row('สะดุด (3 วินาที)', String(r.jank), r.jank > 4 ? 'bad' : r.jank ? 'warn' : null),
      ...row('หน้าค้างนานสุด', M.longtasks ? (r.stall ? `${r.stall} มิลลิวินาที` : 'ไม่มี') : 'เบราว์เซอร์นี้ไม่รายงาน', r.stall > 200 ? 'bad' : null),
      ...row('ภาพ 3 มิติ', `${act.length} เคลื่อนไหว · ${on}/${g.max} เปิดอยู่`),
      ...row('ความละเอียด', `${Math.round(g.scale * 100)}%${g.locked ? ' (กำหนดเอง)' : ''}`),
      ...row('ข้อผิดพลาด', String(M.errs.length), M.errs.length ? 'bad' : null));
    // frame-time strip: last ~4 s, 16.7 ms and 50 ms guides
    const c = spark.getContext('2d'), W = spark.width, H = spark.height, d = M.fr.slice(-240);
    c.clearRect(0, 0, W, H); const y = ms => H - Math.min(H, ms / 100 * H);
    c.fillStyle = 'rgba(127,140,160,.25)'; c.fillRect(0, y(16.7), W, 1); c.fillStyle = 'rgba(214,69,65,.45)'; c.fillRect(0, y(50), W, 1);
    d.forEach(([, ms], i) => { c.fillStyle = ms > 50 ? '#d64541' : ms > 25 ? '#e0a100' : '#2f9e6b'; const x = W - (d.length - i) * (W / 240); c.fillRect(x, y(ms), Math.max(1, W / 240 - 0.2), H - y(ms)); });
  }, 500);

  /* ---- auto tour ---- */
  async function tour() {
    const list = parts(), rows = [];
    res.tour = rows;
    for (let i = 0; i < list.length && !stop; i++) {
      const el = list[i], name = nameOf(el);
      status.textContent = `ทัวร์ ${i + 1}/${list.length} · ${name}`;
      const a = performance.now();
      el.scrollIntoView({ block: 'start' });   // site.js editions: switches to the view this part belongs to
      await wait(1400);
      // long parts: walk down so lazy 3D tools further down start too
      const r0 = el.getBoundingClientRect();
      for (let y = innerHeight * 0.8; y < r0.height - innerHeight * 0.4 && !stop; y += innerHeight * 0.8) { scrollBy(0, innerHeight * 0.8); await wait(500); }
      await wait(600);
      const ctl = controlsIn(el), b = performance.now();
      for (let k = 0; k < ctl.length && !stop; k++) {
        const x = ctl[k]; if (!x.isConnected || !x.offsetParent) continue;
        x.scrollIntoView({ block: 'center' }); press(x, k); await wait(900);
      }
      if (ctl.length) await wait(600);
      const boot = M.since(a), use = ctl.length ? M.since(b) : null, gl = $$('canvas', el).length;
      rows.push({ name, gl, controls: ctl.length, boot, use, grade: grade(use || boot) });
      draw();
    }
    status.textContent = stop ? 'หยุดทัวร์แล้ว' : `ทัวร์ครบ ${rows.length} ส่วน`;
  }

  /* ---- every model ---- */
  async function walk() {
    const { viewer, modelScene, hasGL } = await import('./model3d.js');
    if (!hasGL()) { status.textContent = 'เครื่องนี้แสดงภาพ 3 มิติไม่ได้'; return; }
    stage.hidden = false; stage.replaceChildren(h('div', { class: 'ph-gl' }), h('p', { class: 'ph-cap' }, 'แบบจำลองเพื่ออธิบาย'));
    const C = await viewer(stage.firstChild); C.auto(false);
    const all = DEMO.models.flatMap(m => m.skus.map((s, i) => ({ m, s, i }))), rows = [], byType = {};
    res.models = { rows, byType, total: all.length };
    for (let k = 0; k < all.length && !stop; k++) {
      const { m, s } = all[k], sc = modelScene(m, s), t = byType[sc.type] || (byType[sc.type] = { n: 0, ok: 0, spec: 0, ms: [], bad: [] });
      const a = performance.now(); let err = null, pr = null;
      try { C.scene({ ...sc, power: true, mode: 'cool', swing: true, xray: false, explode: 0, shot: 'hero', cut: true, auto: false }); await frames2(); pr = C.probe(); } catch (e) { err = String(e.message || e).slice(0, 120); }
      const ms = performance.now() - a;
      const okSize = pr && pr.type === sc.type && pr.box.every(v => Number.isFinite(v) && v > 0.05 && v < 4);
      t.n++; t.ms.push(ms); if (sc.src === 'spec') t.spec++;
      if (!err && okSize) t.ok++; else t.bad.push(`${BRAND_BY_ID[m.brand].name} ${s.sku}${err ? ' · ' + err : ' · ขนาดผิดปกติ'}`);
      rows.push({ sku: s.sku, type: sc.type, ms: Math.round(ms), ok: !err && okSize });
      if (k % 8 === 0 || k === all.length - 1) { status.textContent = `รุ่นที่ ${k + 1}/${all.length} · ${BRAND_BY_ID[m.brand].name} ${s.sku}`; draw(); }
    }
    status.textContent = stop ? `หยุดที่ ${rows.length}/${all.length} รุ่น` : `ตรวจครบ ${rows.length} รุ่น`;
    draw();
  }

  /* ---- results ---- */
  const TYPE_TH = { wall: 'ติดผนัง', ceiling: 'แขวนใต้ฝ้า', cassette: 'สี่ทิศทาง', floor: 'ตั้งพื้น' };
  function draw() {
    out.replaceChildren();
    if (res.tour && res.tour.length) {
      const bad = res.tour.filter(r => r.grade === 'bad').length, warn = res.tour.filter(r => r.grade === 'warn').length;
      out.append(h('h3', {}, `ทัวร์ ${res.tour.length} ส่วน · ลื่น ${res.tour.filter(r => r.grade === 'ok').length} · สะดุดเล็กน้อย ${warn} · สะดุด ${bad}`),
        h('div', { class: 'ph-tw' }, h('table', {}, h('thead', {}, h('tr', {}, h('th', {}, 'ส่วน'), h('th', {}, '3D'), h('th', {}, 'เฟรมช้าสุด 5%'), h('th', {}, 'ค้างนานสุด'), h('th', {}, 'ผล'))),
          h('tbody', {}, res.tour.map(r => { const x = r.use || r.boot; return h('tr', { class: 'g-' + r.grade }, h('td', {}, r.name), h('td', {}, r.gl ? `${r.gl} · ${r.controls} ปุ่ม` : '—'), h('td', {}, x.n ? `${x.p95} ms` : '—'), h('td', {}, M.longtasks ? `${Math.max(r.boot.stall, r.use ? r.use.stall : 0)} ms` : '—'), h('td', {}, GTH[r.grade] + (x.errors.length ? ' · มีข้อผิดพลาด' : ''))); })))));
    }
    if (res.models) {
      const T = res.models.byType, done = res.models.rows.length, ok = res.models.rows.filter(r => r.ok).length;
      out.append(h('h3', {}, `ทุกรุ่น ${done}/${res.models.total} · สร้างภาพได้ ${ok}`),
        h('div', { class: 'ph-tw' }, h('table', {}, h('thead', {}, h('tr', {}, h('th', {}, 'ประเภท'), h('th', {}, 'รุ่น'), h('th', {}, 'ผ่าน'), h('th', {}, 'ขนาดตามสเปก'), h('th', {}, 'เวลาเฉลี่ย / ช้าสุด'))),
          h('tbody', {}, Object.entries(T).map(([k, t]) => h('tr', { class: t.ok === t.n ? 'g-ok' : 'g-bad' }, h('td', {}, TYPE_TH[k] || k), h('td', {}, String(t.n)), h('td', {}, String(t.ok)), h('td', {}, String(t.spec)), h('td', {}, `${Math.round(t.ms.reduce((a, b) => a + b, 0) / t.ms.length)} / ${Math.round(Math.max(...t.ms))} ms`)))))),
        ...Object.values(T).flatMap(t => t.bad.slice(0, 5)).map(x => h('p', { class: 'ph-bad' }, x)));
    }
  }
  function summary() {
    const g = glStats(), all = M.since(t0), ua = navigator.userAgent;
    const L = [`ผลทดสอบความลื่น · แบบ ${variant || document.title}`, `เครื่อง: ${ua.slice(0, 140)}`, `จอ ${innerWidth}×${innerHeight} @${devicePixelRatio}x · ภาพ 3 มิติพร้อมกันสูงสุด ${g.max} · ความละเอียดตอนนี้ ${Math.round(g.scale * 100)}%`,
      `ตลอดการทดสอบ: ${all.fps} ภาพ/วินาที · เฟรมช้าสุด 5% ${all.p95} ms · สะดุด ${all.jank} ครั้ง · ค้างนานสุด ${M.longtasks ? all.stall + ' ms' : 'ไม่รายงาน'} · ข้อผิดพลาด ${M.errs.length}`];
    if (res.tour) res.tour.forEach(r => { const x = r.use || r.boot; L.push(`- ${r.name}: ${GTH[r.grade]} (p95 ${x.p95} ms, สะดุด ${x.jank}, ค้าง ${Math.max(r.boot.stall, r.use ? r.use.stall : 0)} ms${x.errors.length ? ', ข้อผิดพลาด ' + x.errors[0] : ''})`); });
    if (res.models) { L.push(`ทุกรุ่น: ${res.models.rows.filter(r => r.ok).length}/${res.models.rows.length} สร้างภาพได้ (จาก ${res.models.total})`); Object.entries(res.models.byType).forEach(([k, t]) => L.push(`- ${TYPE_TH[k] || k}: ${t.ok}/${t.n} · เฉลี่ย ${Math.round(t.ms.reduce((a, b) => a + b, 0) / t.ms.length)} ms · ช้าสุด ${Math.round(Math.max(...t.ms))} ms${t.bad.length ? ' · ไม่ผ่าน: ' + t.bad.slice(0, 3).join(', ') : ''}`)); }
    M.errs.slice(0, 5).forEach(e => L.push(`ข้อผิดพลาด: ${e[1]}`));
    return L.join('\n');
  }
  function send() { min(true); openFeedback({ variant: variant || '', pages: [], seen: [], note: summary() }); }

  async function run(fn) {
    if (busy) return; busy = true; stop = false; glFocus(null);   // every scene draws while it is measured
    btnTour.disabled = btnModels.disabled = true; btnStop.hidden = false;
    try { await fn(); } catch (e) { status.textContent = 'การทดสอบหยุดเพราะข้อผิดพลาด: ' + String(e.message || e).slice(0, 120); }
    busy = false; btnTour.disabled = btnModels.disabled = false; btnStop.hidden = true;
  }
  P = { box, min, close, summary, results: res, run: { tour: () => run(tour), models: () => run(walk) }, stop: () => { stop = true; } };
  return P;
}
